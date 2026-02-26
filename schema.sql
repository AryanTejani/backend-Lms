-- ============================================
-- POSTGRESQL SCHEMA FOR SURECART MIGRATION
-- 6 Tables, Read-Optimized, All Edge Cases
-- ============================================
--
-- Tables:
--   1. products     - Merged product + price (~60 rows, cached)
--   2. customers    - Customer data with denormalized stats
--   3. orders       - Transactions (partitioned by year)
--   4. order_items  - Line items (partitioned by year)
--   5. subscriptions - Recurring billing management
--   6. purchases    - Access entitlements (most critical)
--
-- Key Features:
--   - Zero joins for access checks
--   - Multiple purchases per customer+product (subscription + lifetime)
--   - Partitioned tables for scale
--   - All data denormalized for read performance
--   - surecart_id fields for migration traceability
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- UUID v7 Implementation (PostgreSQL 16 compatible)
-- Generates time-ordered UUIDs with millisecond timestamp prefix
CREATE OR REPLACE FUNCTION uuidv7() RETURNS UUID AS $$
DECLARE
    unix_ts_ms BYTEA;
    uuid_bytes BYTEA;
BEGIN
    -- Get current Unix timestamp in milliseconds (48 bits)
    unix_ts_ms := substring(int8send(floor(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT) from 3 for 6);

    -- Generate random bytes for the rest
    uuid_bytes := unix_ts_ms || gen_random_bytes(10);

    -- Set version to 7 (bits 48-51: 0111)
    uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);

    -- Set variant to RFC 4122 (bits 64-65: 10)
    uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);

    RETURN encode(uuid_bytes, 'hex')::UUID;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Helper function for GENERATED columns (must be IMMUTABLE)
CREATE OR REPLACE FUNCTION extract_year(ts TIMESTAMPTZ) RETURNS INTEGER AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM ts)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE order_status AS ENUM (
    'pending',
    'paid',
    'payment_failed',
    'void',
    'refunded',
    'partially_refunded'
);

-- Product content type (Scenario 4: Master Classes)
CREATE TYPE product_content_type AS ENUM (
    'course',           -- Regular self-paced course
    'master_class',     -- Live event with recording
    'bundle',           -- Collection of products
    'digital_download'  -- One-time downloadable content
);

CREATE TYPE order_type AS ENUM (
    'checkout',
    'subscription'
);

CREATE TYPE subscription_status AS ENUM (
    'trialing',
    'active',
    'past_due',
    'canceled',
    'paused'
);

CREATE TYPE purchase_status AS ENUM (
    'active',
    'revoked',
    'expired'
);

-- Lesson content type
CREATE TYPE lesson_type AS ENUM ('video', 'text');

-- Staff roles (admin, instructor)
CREATE TYPE staff_role AS ENUM (
    'admin',
    'instructor'
);

-- ============================================
-- TABLE: staff
-- Admin and Instructor accounts (separate from customers)
-- Must be defined early as other tables reference it
-- ============================================

CREATE TABLE staff (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Identity
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),

    -- Role
    role staff_role NOT NULL DEFAULT 'instructor',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Profile
    bio TEXT,
    avatar_url VARCHAR(500),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_email ON staff USING hash(email);
CREATE INDEX idx_staff_role ON staff(role) WHERE is_active = true;
CREATE INDEX idx_staff_active ON staff(is_active) WHERE is_active = true;

-- ============================================
-- COUPON VALIDITY AND DISCOUNT TYPES
-- ============================================

CREATE TYPE coupon_validity_type AS ENUM ('lifetime', 'duration', 'one_time');
CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed_amount', 'free_trial');

-- ============================================
-- TABLE: coupons (NEW)
-- Centralized coupon management
-- ============================================

CREATE TABLE coupons (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Migration References
    surecart_id VARCHAR(100) UNIQUE,
    surecart_promotion_id VARCHAR(100),

    -- Coupon Identity
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Discount Configuration
    discount_type coupon_discount_type NOT NULL,
    discount_value BIGINT NOT NULL, -- cents for fixed, basis points for % (2000 = 20%)
    currency VARCHAR(3) DEFAULT 'usd',

    -- Validity Rules
    validity_type coupon_validity_type NOT NULL,
    duration_months INTEGER, -- for 'duration' type

    -- Usage Limits
    max_redemptions INTEGER,
    current_redemptions INTEGER DEFAULT 0,
    max_per_customer INTEGER DEFAULT 1,

    -- Restrictions
    applies_to VARCHAR(20) DEFAULT 'any', -- 'any', 'specific_products', 'specific_prices'
    min_purchase_amount_cents BIGINT,

    -- Dates
    valid_from TIMESTAMPTZ,
    valid_until TIMESTAMPTZ,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,

    -- New user only restriction (Scenario 1)
    is_new_customer_only BOOLEAN DEFAULT false,

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coupons_code ON coupons(code) WHERE is_active = true;
CREATE INDEX idx_coupons_surecart ON coupons(surecart_id) WHERE surecart_id IS NOT NULL;
CREATE INDEX idx_coupons_active ON coupons(valid_from, valid_until) WHERE is_active = true;
CREATE INDEX idx_coupons_new_customer ON coupons(is_new_customer_only)
WHERE is_new_customer_only = true AND is_active = true;

-- ============================================
-- TABLE 1: products
-- Merged product + price (no joins needed)
-- Small table - fully cached in application
-- ============================================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Migration Reference
    surecart_price_id VARCHAR(100) UNIQUE,
    surecart_product_id VARCHAR(100),  -- SureCart Product ID (different from Price ID)

    -- Product Info
    product_name VARCHAR(255) NOT NULL,
    product_slug VARCHAR(255),
    product_description TEXT,

    -- Price Info
    amount_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',

    -- Billing Type
    is_recurring BOOLEAN DEFAULT false,
    recurring_interval VARCHAR(20) CHECK (recurring_interval IN ('day', 'week', 'month', 'year')),
    recurring_interval_count INTEGER DEFAULT 1,

    -- Trial
    trial_days INTEGER DEFAULT 0,

    -- Setup Fee
    setup_fee_enabled BOOLEAN DEFAULT false,
    setup_fee_cents BIGINT DEFAULT 0,
    setup_fee_name VARCHAR(255),

    -- Tax
    tax_category VARCHAR(50),
    tax_enabled BOOLEAN DEFAULT true,

    -- Fulfillment
    allow_out_of_stock_purchases BOOLEAN DEFAULT false,
    auto_fulfill BOOLEAN DEFAULT true,

    -- Access Control
    revoke_after_days INTEGER,
    purchase_limit INTEGER,

    -- Inventory
    track_inventory BOOLEAN DEFAULT false,
    stock_quantity INTEGER,
    allow_out_of_stock BOOLEAN DEFAULT false,

    requires_shipping BOOLEAN DEFAULT false,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,

    -- Content type (Scenario 4: Master Classes)
    content_type product_content_type DEFAULT 'course',
    max_attendees INTEGER,
    current_attendees INTEGER DEFAULT 0,

    -- Staff ownership
    created_by_staff_id UUID REFERENCES staff(id),
    instructor_id UUID REFERENCES staff(id),  -- Primary instructor (can edit)

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_products_surecart_price ON products(surecart_price_id);
CREATE INDEX idx_products_surecart_product ON products(surecart_product_id) WHERE surecart_product_id IS NOT NULL;
CREATE INDEX idx_products_slug ON products(product_slug);
CREATE INDEX idx_products_active ON products(id) WHERE is_active = true AND is_archived = false;
CREATE INDEX idx_products_content_type ON products(content_type) WHERE content_type != 'course';
CREATE INDEX idx_products_instructor ON products(instructor_id) WHERE instructor_id IS NOT NULL;

-- ============================================
-- TABLE: coupon_product_restrictions (NEW)
-- Per-product coupon restrictions
-- ============================================

CREATE TABLE coupon_product_restrictions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(coupon_id, product_id)
);

CREATE INDEX idx_coupon_restrictions_coupon ON coupon_product_restrictions(coupon_id);
CREATE INDEX idx_coupon_restrictions_product ON coupon_product_restrictions(product_id);

-- ============================================
-- TABLE: bundle_items
-- Defines what products are included in each bundle
-- ============================================

CREATE TABLE bundle_items (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    bundle_product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_product_id UUID NOT NULL REFERENCES products(id),

    -- Optional: quantity if bundle includes multiple of same item
    quantity INTEGER DEFAULT 1,

    -- Tracking
    added_by_staff_id UUID REFERENCES staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(bundle_product_id, item_product_id)
);

CREATE INDEX idx_bundle_items_bundle ON bundle_items(bundle_product_id);
CREATE INDEX idx_bundle_items_item ON bundle_items(item_product_id);

-- ============================================
-- TABLE 2: customers
-- Denormalized with computed stats
-- ============================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Migration Reference
    surecart_id VARCHAR(100) UNIQUE,

    -- Basic Info
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_nicename VARCHAR(100),
    phone VARCHAR(50),

    -- Tax
    tax_identifier VARCHAR(100),
    tax_identifier_type VARCHAR(50),

    -- Payment Provider IDs
    stripe_customer_id VARCHAR(255),

    -- Password Reset (for migrated users without passwords)
    requires_password_reset BOOLEAN DEFAULT false,

    -- Computed Stats (updated via triggers)
    total_orders INTEGER DEFAULT 0,
    total_spent_cents BIGINT DEFAULT 0,
    active_subscriptions INTEGER DEFAULT 0,

    metadata JSONB DEFAULT '{}',
    is_live_mode BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_customers_email ON customers USING hash(email);
CREATE INDEX idx_customers_surecart ON customers(surecart_id) WHERE surecart_id IS NOT NULL;
CREATE INDEX idx_customers_stripe ON customers(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_customers_created ON customers(created_at DESC);

-- ============================================
-- TABLE: customer_addresses (NEW)
-- Normalized address storage
-- ============================================

CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    address_type VARCHAR(20) NOT NULL CHECK (address_type IN ('billing', 'shipping')),

    line_1 VARCHAR(255),
    line_2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(2),

    is_default BOOLEAN DEFAULT false,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_addresses_customer ON customer_addresses(customer_id);
CREATE INDEX idx_addresses_default ON customer_addresses(customer_id, is_default) WHERE is_default = true;
-- Ensure only one default address per customer per type
CREATE UNIQUE INDEX idx_addresses_one_default ON customer_addresses(customer_id, address_type) WHERE is_default = true;

-- ============================================
-- TABLE 3: orders
-- Partitioned by year for scale
-- Fully denormalized - no joins for list view
-- ============================================

CREATE TABLE orders (
    id UUID NOT NULL DEFAULT uuidv7(),

    -- Migration Reference
    surecart_id VARCHAR(100),

    -- Order Identification
    order_number VARCHAR(50) NOT NULL,
    status order_status NOT NULL DEFAULT 'pending',
    order_type order_type NOT NULL DEFAULT 'checkout',

    -- Customer FK
    customer_id UUID NOT NULL REFERENCES customers(id),

    -- Coupon FK (order-level discount)
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,

    -- Amounts (in cents)
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    subtotal_cents BIGINT NOT NULL DEFAULT 0,
    discount_cents BIGINT NOT NULL DEFAULT 0,
    tax_cents BIGINT NOT NULL DEFAULT 0,
    shipping_cents BIGINT NOT NULL DEFAULT 0,
    total_cents BIGINT NOT NULL DEFAULT 0,
    amount_due_cents BIGINT NOT NULL DEFAULT 0,
    trial_cents BIGINT DEFAULT 0,
    proration_cents BIGINT DEFAULT 0,

    -- Address Snapshots (JSONB for historical accuracy)
    billing_address_snapshot JSONB,
    shipping_address_snapshot JSONB,

    -- Tax
    tax_identifier VARCHAR(100),
    tax_identifier_type VARCHAR(50),

    -- Payment Info
    payment_method VARCHAR(50),
    payment_failure_reason TEXT,
    stripe_payment_intent_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),

    -- Refund Info
    refund_amount_cents BIGINT DEFAULT 0,
    refund_reason TEXT,
    refunded_at TIMESTAMPTZ,

    -- Shipping
    tracking_numbers TEXT[],

    -- External
    invoice_url VARCHAR(500),

    metadata JSONB DEFAULT '{}',
    is_live_mode BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    paid_at TIMESTAMPTZ,

    -- Partition Key (populated by trigger)
    created_year INTEGER NOT NULL,

    PRIMARY KEY (id, created_year)
) PARTITION BY RANGE (created_year);

-- Partitions
CREATE TABLE orders_2023 PARTITION OF orders FOR VALUES FROM (2023) TO (2024);
CREATE TABLE orders_2024 PARTITION OF orders FOR VALUES FROM (2024) TO (2025);
CREATE TABLE orders_2025 PARTITION OF orders FOR VALUES FROM (2025) TO (2026);
CREATE TABLE orders_2026 PARTITION OF orders FOR VALUES FROM (2026) TO (2027);
CREATE TABLE orders_2027 PARTITION OF orders FOR VALUES FROM (2027) TO (2028);
CREATE TABLE orders_2028 PARTITION OF orders FOR VALUES FROM (2028) TO (2029);
CREATE TABLE orders_2029 PARTITION OF orders FOR VALUES FROM (2029) TO (2030);
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- Indexes
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_coupon ON orders(coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_customer_recent ON orders(customer_id, created_at DESC);
CREATE INDEX idx_orders_surecart ON orders(surecart_id) WHERE surecart_id IS NOT NULL;
CREATE INDEX idx_orders_paid ON orders(paid_at DESC) WHERE status = 'paid';
CREATE INDEX idx_orders_year ON orders(created_year);

-- ============================================
-- TABLE 4: order_items
-- Line items - partitioned with orders
-- Fully denormalized product/price info
-- ============================================

CREATE TABLE order_items (
    id UUID NOT NULL DEFAULT uuidv7(),

    -- Order Reference
    order_id UUID NOT NULL,
    order_year INTEGER NOT NULL,

    -- Per-item coupon (for complex cart scenarios)
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,

    -- Product FK
    product_id UUID NOT NULL REFERENCES products(id),

    -- Amounts (transaction snapshot)
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_amount_cents BIGINT NOT NULL,
    discount_cents BIGINT DEFAULT 0,
    tax_cents BIGINT DEFAULT 0,
    total_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',

    -- Subscription Link (FK added via ALTER TABLE after subscriptions table exists)
    subscription_id UUID,

    -- Refund Tracking (for bundle partial refunds)
    refund_status VARCHAR(20) DEFAULT NULL CHECK (refund_status IN ('refunded', 'partial')),
    refund_amount_cents BIGINT DEFAULT 0,
    refunded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (id, order_year),
    FOREIGN KEY (order_id, order_year) REFERENCES orders(id, created_year) ON DELETE CASCADE
) PARTITION BY RANGE (order_year);

-- Partitions
CREATE TABLE order_items_2023 PARTITION OF order_items FOR VALUES FROM (2023) TO (2024);
CREATE TABLE order_items_2024 PARTITION OF order_items FOR VALUES FROM (2024) TO (2025);
CREATE TABLE order_items_2025 PARTITION OF order_items FOR VALUES FROM (2025) TO (2026);
CREATE TABLE order_items_2026 PARTITION OF order_items FOR VALUES FROM (2026) TO (2027);
CREATE TABLE order_items_2027 PARTITION OF order_items FOR VALUES FROM (2027) TO (2028);
CREATE TABLE order_items_2028 PARTITION OF order_items FOR VALUES FROM (2028) TO (2029);
CREATE TABLE order_items_2029 PARTITION OF order_items FOR VALUES FROM (2029) TO (2030);
CREATE TABLE order_items_default PARTITION OF order_items DEFAULT;

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_order_items_coupon ON order_items(coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX idx_order_items_subscription ON order_items(subscription_id) WHERE subscription_id IS NOT NULL;

-- ============================================
-- TABLE: subscription_plans
-- Admin-created plans (e.g., "$50 Plan", "$100 Plan")
-- ============================================

CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Plan Identity
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,

    -- Pricing
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) DEFAULT 'usd',
    recurring_interval VARCHAR(20) NOT NULL CHECK (recurring_interval IN ('day', 'week', 'month', 'year')),
    recurring_interval_count INTEGER DEFAULT 1,

    -- Trial
    trial_days INTEGER DEFAULT 0,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_archived BOOLEAN DEFAULT false,

    -- Created by admin
    created_by_staff_id UUID REFERENCES staff(id),

    -- Stripe integration
    stripe_product_id VARCHAR(255),
    stripe_price_id VARCHAR(255),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = true;
CREATE INDEX idx_subscription_plans_stripe ON subscription_plans(stripe_product_id) WHERE stripe_product_id IS NOT NULL;

-- ============================================
-- TABLE: subscription_plan_products
-- What products are included in each plan
-- ============================================

CREATE TABLE subscription_plan_products (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    plan_id UUID NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),

    added_by_staff_id UUID REFERENCES staff(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(plan_id, product_id)
);

CREATE INDEX idx_plan_products_plan ON subscription_plan_products(plan_id);
CREATE INDEX idx_plan_products_product ON subscription_plan_products(product_id);

-- ============================================
-- TABLE 5: subscriptions
-- Customer subscriptions to plans
-- ============================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Migration Reference
    surecart_id VARCHAR(100) UNIQUE,

    -- Coupon FK
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,

    -- Customer FK
    customer_id UUID NOT NULL REFERENCES customers(id),

    -- Plan FK (subscriptions are now plan-based, nullable for migration)
    plan_id UUID REFERENCES subscription_plans(id),

    -- Legacy Product FK (for old SureCart product-based subscriptions)
    -- Used when plan_id is NULL - supports dual-mode (plan-based + product-based)
    legacy_product_id UUID REFERENCES products(id),

    -- Status
    status subscription_status NOT NULL DEFAULT 'active',

    -- Billing
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    unit_amount_cents BIGINT NOT NULL,

    -- Recurring Info
    recurring_interval VARCHAR(20) NOT NULL CHECK (recurring_interval IN ('day', 'week', 'month', 'year')),
    recurring_interval_count INTEGER DEFAULT 1,
    quantity INTEGER DEFAULT 1,

    -- Trial Periods
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,

    -- Periods
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,

    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,

    -- External
    stripe_subscription_id VARCHAR(255),

    metadata JSONB DEFAULT '{}',
    is_live_mode BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX idx_subscriptions_coupon ON subscriptions(coupon_id) WHERE coupon_id IS NOT NULL;
CREATE INDEX idx_subscriptions_status_active ON subscriptions(status) WHERE status IN ('active', 'trialing');
CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_period_end ON subscriptions(current_period_end) WHERE status = 'active';
CREATE INDEX idx_subscriptions_customer_active ON subscriptions(customer_id, status) WHERE status IN ('active', 'trialing');
CREATE INDEX idx_subscriptions_surecart ON subscriptions(surecart_id) WHERE surecart_id IS NOT NULL;
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_subscriptions_legacy_product ON subscriptions(legacy_product_id) WHERE legacy_product_id IS NOT NULL;

-- Add FK constraint for order_items.subscription_id (now that subscriptions table exists)
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_subscription
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL;

-- ============================================
-- TABLE 6: purchases
-- MOST CRITICAL TABLE - Access checks
-- Zero joins, allows multiple per customer+product
-- ============================================

CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuidv7(),

    -- Migration Reference
    surecart_id VARCHAR(100) UNIQUE,

    -- Customer FK
    customer_id UUID NOT NULL REFERENCES customers(id),

    -- Product FK
    product_id UUID NOT NULL REFERENCES products(id),

    -- Purchase Type (CRITICAL for access logic)
    is_lifetime BOOLEAN DEFAULT false,

    -- Amounts (transaction snapshot)
    currency VARCHAR(3) NOT NULL DEFAULT 'usd',
    unit_amount_cents BIGINT NOT NULL,

    -- Source Tracking (order_id cannot FK to partitioned orders table)
    order_id UUID,

    -- Subscription Link (NULL for one-time purchases)
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,

    -- Access Status
    status purchase_status NOT NULL DEFAULT 'active',

    -- Revocation
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,

    -- Expiration
    expires_at TIMESTAMPTZ,

    metadata JSONB DEFAULT '{}',
    is_live_mode BOOLEAN DEFAULT true,

    granted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL INDEXES FOR ACCESS CHECKS
CREATE INDEX idx_purchases_access_check ON purchases(customer_id, product_id, status)
WHERE status = 'active';

CREATE INDEX idx_purchases_customer ON purchases USING hash(customer_id);
CREATE INDEX idx_purchases_product ON purchases(product_id);
CREATE INDEX idx_purchases_subscription ON purchases(subscription_id) WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_purchases_customer_list ON purchases(customer_id, granted_at DESC);
CREATE INDEX idx_purchases_surecart ON purchases(surecart_id) WHERE surecart_id IS NOT NULL;
CREATE INDEX idx_purchases_expiring ON purchases(expires_at) WHERE status = 'active' AND expires_at IS NOT NULL;
-- Index for refund revocation lookup (Scenario 3)
CREATE INDEX idx_purchases_order ON purchases(order_id) WHERE order_id IS NOT NULL;

-- ============================================
-- TABLE: master_class_sessions (Scenario 4)
-- Tracks live sessions for master class products
-- ============================================

CREATE TABLE master_class_sessions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

    session_number INTEGER NOT NULL DEFAULT 1,
    session_title VARCHAR(255),

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- Platform
    platform VARCHAR(50) NOT NULL,  -- 'zoom', 'youtube_live', etc.
    live_url VARCHAR(500),

    -- Recording
    recording_status VARCHAR(20) DEFAULT 'pending' CHECK (recording_status IN ('pending', 'processing', 'available')),
    recording_url VARCHAR(500),
    recording_available_at TIMESTAMPTZ,

    -- Status
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')),

    -- Staff tracking
    scheduled_by_staff_id UUID REFERENCES staff(id),
    updated_by_staff_id UUID REFERENCES staff(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(product_id, session_number)
);

CREATE INDEX idx_mcs_product ON master_class_sessions(product_id);
CREATE INDEX idx_mcs_scheduled ON master_class_sessions(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_mcs_scheduled_by ON master_class_sessions(scheduled_by_staff_id) WHERE scheduled_by_staff_id IS NOT NULL;

-- ============================================
-- TABLE: master_class_attendees (Scenario 4)
-- Tracks customer registration and attendance
-- ============================================

CREATE TABLE master_class_attendees (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    session_id UUID NOT NULL REFERENCES master_class_sessions(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(id),
    purchase_id UUID NOT NULL REFERENCES purchases(id),

    registered_at TIMESTAMPTZ DEFAULT NOW(),
    attended BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ,

    recording_watched BOOLEAN DEFAULT false,

    UNIQUE(session_id, customer_id)
);

CREATE INDEX idx_mca_customer ON master_class_attendees(customer_id);

-- ============================================
-- TABLE: courses
-- Course containers linking to products for access control
-- ============================================

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(500) NOT NULL UNIQUE,
    description TEXT,
    thumbnail_url VARCHAR(1000),
    instructor_id UUID NOT NULL REFERENCES staff(id) ON DELETE RESTRICT ON UPDATE NO ACTION,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMPTZ,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX courses_instructor_id_index ON courses(instructor_id);
CREATE INDEX courses_slug_index ON courses(slug);
CREATE INDEX idx_courses_product ON courses(product_id);

-- ============================================
-- TABLE: lessons
-- Individual lessons within courses
-- ============================================

CREATE TABLE lessons (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE ON UPDATE NO ACTION,
    title VARCHAR(500) NOT NULL,
    content TEXT,
    video_id UUID REFERENCES videos(id) ON DELETE SET NULL,
    lesson_type lesson_type NOT NULL DEFAULT 'text',
    duration INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX lessons_course_id_index ON lessons(course_id);
CREATE INDEX idx_lessons_video ON lessons(video_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Check if staff can edit product (admin or owner)
CREATE OR REPLACE FUNCTION can_edit_product(
    p_staff_id UUID,
    p_product_id UUID
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM staff s
        WHERE s.id = p_staff_id
        AND s.is_active = true
        AND (
            s.role = 'admin'
            OR EXISTS (
                SELECT 1 FROM products p
                WHERE p.id = p_product_id
                AND p.instructor_id = p_staff_id
            )
        )
    );
$$ LANGUAGE sql STABLE;

-- Check subscription access via plan_products OR legacy_product_id
-- Supports dual-mode: new plan-based subscriptions + legacy product-based subscriptions
CREATE OR REPLACE FUNCTION has_subscription_access(
    p_customer_id UUID,
    p_product_id UUID
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1
        FROM subscriptions s
        WHERE s.customer_id = p_customer_id
        AND s.status IN ('active', 'trialing')
        AND s.current_period_end > NOW()
        AND (
            -- New plan-based: check subscription_plan_products
            EXISTS (
                SELECT 1 FROM subscription_plan_products spp
                WHERE spp.plan_id = s.plan_id
                AND spp.product_id = p_product_id
            )
            OR
            -- Legacy product-based: direct product link
            s.legacy_product_id = p_product_id
        )
        LIMIT 1
    );
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Check if customer has product access (purchases OR subscription)
CREATE OR REPLACE FUNCTION has_access(
    p_customer_id UUID,
    p_product_id UUID
) RETURNS BOOLEAN AS $$
    -- Direct purchase (lifetime or active)
    SELECT EXISTS (
        SELECT 1 FROM purchases
        WHERE customer_id = p_customer_id
        AND product_id = p_product_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
    )
    -- OR subscription access (via plan_products - plan level)
    OR has_subscription_access(p_customer_id, p_product_id);
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Check access by email (now requires JOIN to customers)
CREATE OR REPLACE FUNCTION has_access_by_email(
    p_email VARCHAR,
    p_product_id UUID
) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM purchases p
        INNER JOIN customers c ON c.id = p.customer_id
        WHERE c.email = LOWER(TRIM(p_email))
        AND p.product_id = p_product_id
        AND p.status = 'active'
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        LIMIT 1
    );
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Get all active products for customer with details
CREATE OR REPLACE FUNCTION get_customer_products(p_customer_id UUID)
RETURNS TABLE (
    purchase_id UUID,
    product_id UUID,
    product_name VARCHAR,
    product_slug VARCHAR,
    is_lifetime BOOLEAN,
    subscription_id UUID,
    subscription_status subscription_status,
    granted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    coupon_code VARCHAR
) AS $$
    SELECT
        p.id,
        p.product_id,
        prod.product_name,
        prod.product_slug,
        p.is_lifetime,
        p.subscription_id,
        s.status,
        p.granted_at,
        p.expires_at,
        c.code
    FROM purchases p
    INNER JOIN products prod ON prod.id = p.product_id
    LEFT JOIN subscriptions s ON s.id = p.subscription_id
    LEFT JOIN coupons c ON c.id = s.coupon_id
    WHERE p.customer_id = p_customer_id
    AND p.status = 'active'
    AND (p.expires_at IS NULL OR p.expires_at > NOW())
    ORDER BY p.granted_at DESC;
$$ LANGUAGE sql STABLE PARALLEL SAFE;

-- Revoke ONLY subscription-linked purchases (not lifetime!)
CREATE OR REPLACE FUNCTION revoke_subscription_purchases(
    p_subscription_id UUID,
    p_reason TEXT DEFAULT 'Subscription ended'
) RETURNS INTEGER AS $$
DECLARE
    affected INTEGER;
BEGIN
    UPDATE purchases
    SET
        status = 'revoked',
        revoked_at = NOW(),
        revoke_reason = p_reason,
        updated_at = NOW()
    WHERE subscription_id = p_subscription_id
    AND status = 'active'
    AND is_lifetime = false;

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number(p_prefix VARCHAR DEFAULT 'ORDER')
RETURNS VARCHAR AS $$
DECLARE
    next_num BIGINT;
BEGIN
    SELECT COALESCE(MAX(
        NULLIF(REGEXP_REPLACE(order_number, '[^0-9]', '', 'g'), '')::BIGINT
    ), 0) + 1
    INTO next_num
    FROM orders;

    RETURN p_prefix || '-' || next_num;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- BUNDLE FUNCTIONS
-- ============================================

-- Grant bundle access (creates individual purchases for each bundle item)
CREATE OR REPLACE FUNCTION grant_bundle_access(
    p_order_id UUID,
    p_bundle_product_id UUID,
    p_customer_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_item RECORD;
BEGIN
    FOR v_item IN
        SELECT bi.item_product_id, p.amount_cents, p.currency
        FROM bundle_items bi
        INNER JOIN products p ON p.id = bi.item_product_id
        WHERE bi.bundle_product_id = p_bundle_product_id
    LOOP
        INSERT INTO purchases (
            customer_id, product_id, order_id,
            is_lifetime, unit_amount_cents, currency, status
        ) VALUES (
            p_customer_id, v_item.item_product_id, p_order_id,
            true, v_item.amount_cents, v_item.currency, 'active'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Revoke specific bundle item on partial refund
CREATE OR REPLACE FUNCTION revoke_bundle_item(
    p_order_id UUID,
    p_item_product_id UUID,
    p_reason TEXT DEFAULT 'Item refunded'
) RETURNS BOOLEAN AS $$
DECLARE
    v_affected INTEGER;
BEGIN
    UPDATE purchases
    SET status = 'revoked',
        revoked_at = NOW(),
        revoke_reason = p_reason,
        updated_at = NOW()
    WHERE order_id = p_order_id
    AND product_id = p_item_product_id
    AND status = 'active'
    AND is_lifetime = true;

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COUPON VALIDATION FUNCTIONS (Scenarios 1 & 2)
-- ============================================

-- Check if customer is eligible for a specific coupon
CREATE OR REPLACE FUNCTION is_customer_eligible_for_coupon(
    p_customer_id UUID,
    p_coupon_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_coupon RECORD;
    v_has_prior_purchases BOOLEAN;
BEGIN
    SELECT is_new_customer_only, is_active, valid_from, valid_until,
           max_redemptions, current_redemptions, max_per_customer
    INTO v_coupon FROM coupons WHERE id = p_coupon_id;

    IF NOT FOUND OR NOT v_coupon.is_active THEN RETURN false; END IF;

    -- Date checks
    IF v_coupon.valid_from IS NOT NULL AND NOW() < v_coupon.valid_from THEN RETURN false; END IF;
    IF v_coupon.valid_until IS NOT NULL AND NOW() > v_coupon.valid_until THEN RETURN false; END IF;

    -- Redemption limits
    IF v_coupon.max_redemptions IS NOT NULL
       AND v_coupon.current_redemptions >= v_coupon.max_redemptions THEN RETURN false; END IF;

    -- Per-customer limit
    IF v_coupon.max_per_customer IS NOT NULL THEN
        IF (SELECT COUNT(*) FROM orders
            WHERE customer_id = p_customer_id AND coupon_id = p_coupon_id AND status = 'paid'
           ) >= v_coupon.max_per_customer THEN RETURN false; END IF;
    END IF;

    -- NEW CUSTOMER CHECK (Scenario 1)
    IF v_coupon.is_new_customer_only THEN
        SELECT EXISTS (SELECT 1 FROM orders WHERE customer_id = p_customer_id AND status = 'paid' LIMIT 1)
        INTO v_has_prior_purchases;
        IF v_has_prior_purchases THEN RETURN false; END IF;
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Validate coupon for cart with minimum value check (Scenario 2)
CREATE OR REPLACE FUNCTION validate_coupon_for_cart(
    p_customer_id UUID,
    p_coupon_code VARCHAR,
    p_cart_subtotal_cents BIGINT,
    p_cart_currency VARCHAR DEFAULT 'usd'
) RETURNS TABLE (
    is_valid BOOLEAN,
    error_code VARCHAR,
    error_message TEXT,
    final_discount_cents BIGINT
) AS $$
DECLARE
    v_coupon RECORD;
BEGIN
    SELECT * INTO v_coupon FROM coupons WHERE code = p_coupon_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'COUPON_NOT_FOUND'::VARCHAR, 'Coupon not found'::TEXT, NULL::BIGINT;
        RETURN;
    END IF;

    IF NOT is_customer_eligible_for_coupon(p_customer_id, v_coupon.id) THEN
        RETURN QUERY SELECT false, 'NOT_ELIGIBLE'::VARCHAR, 'Not eligible for this coupon'::TEXT, NULL::BIGINT;
        RETURN;
    END IF;

    -- MINIMUM CART VALUE CHECK (Scenario 2)
    IF v_coupon.min_purchase_amount_cents IS NOT NULL
       AND p_cart_subtotal_cents < v_coupon.min_purchase_amount_cents THEN
        RETURN QUERY SELECT false, 'MIN_CART_NOT_MET'::VARCHAR,
            format('Minimum cart value of $%s required', (v_coupon.min_purchase_amount_cents / 100.0))::TEXT,
            NULL::BIGINT;
        RETURN;
    END IF;

    -- Calculate discount
    RETURN QUERY SELECT true, NULL::VARCHAR, NULL::TEXT,
        CASE v_coupon.discount_type
            WHEN 'percentage' THEN (p_cart_subtotal_cents * v_coupon.discount_value) / 10000
            WHEN 'fixed_amount' THEN LEAST(v_coupon.discount_value, p_cart_subtotal_cents)
            ELSE 0::BIGINT
        END;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- REFUND ACCESS REVOCATION FUNCTIONS (Scenario 3)
-- ============================================

-- Preview refund impact before processing
CREATE OR REPLACE FUNCTION preview_refund_impact(p_order_id UUID)
RETURNS TABLE (
    product_name VARCHAR,
    is_lifetime BOOLEAN,
    has_subscription BOOLEAN,
    will_be_revoked BOOLEAN
) AS $$
    SELECT pr.product_name, p.is_lifetime, p.subscription_id IS NOT NULL,
           (p.is_lifetime AND p.subscription_id IS NULL)
    FROM purchases p
    INNER JOIN products pr ON pr.id = p.product_id
    WHERE p.order_id = p_order_id AND p.status = 'active';
$$ LANGUAGE sql STABLE;

-- Revoke purchase for specific product (partial refund)
CREATE OR REPLACE FUNCTION revoke_purchase_by_product(
    p_order_id UUID,
    p_product_id UUID,
    p_reason TEXT DEFAULT 'Item refunded'
) RETURNS BOOLEAN AS $$
DECLARE
    v_affected INTEGER;
BEGIN
    UPDATE purchases
    SET status = 'revoked',
        revoked_at = NOW(),
        revoke_reason = p_reason,
        updated_at = NOW()
    WHERE order_id = p_order_id
    AND product_id = p_product_id
    AND status = 'active'
    AND is_lifetime = true
    AND subscription_id IS NULL;

    GET DIAGNOSTICS v_affected = ROW_COUNT;
    RETURN v_affected > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MASTER CLASS FUNCTIONS (Scenario 4)
-- ============================================

-- Get customer's master class access with session details
CREATE OR REPLACE FUNCTION get_customer_master_classes(p_customer_id UUID)
RETURNS TABLE (
    product_name VARCHAR,
    session_title VARCHAR,
    scheduled_at TIMESTAMPTZ,
    session_status VARCHAR,
    can_join_live BOOLEAN,
    live_url VARCHAR,
    recording_available BOOLEAN,
    recording_url VARCHAR
) AS $$
    SELECT p.product_name, mcs.session_title, mcs.scheduled_at, mcs.status,
        (mcs.status IN ('scheduled', 'live')
         AND mcs.scheduled_at BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() + INTERVAL '2 hours'),
        CASE WHEN mcs.status IN ('scheduled', 'live') THEN mcs.live_url ELSE NULL END,
        mcs.recording_status = 'available',
        CASE WHEN mcs.recording_status = 'available' THEN mcs.recording_url ELSE NULL END
    FROM purchases pur
    INNER JOIN products p ON p.id = pur.product_id
    INNER JOIN master_class_sessions mcs ON mcs.product_id = p.id
    WHERE pur.customer_id = p_customer_id AND pur.status = 'active' AND p.content_type = 'master_class'
    ORDER BY mcs.scheduled_at DESC;
$$ LANGUAGE sql STABLE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_coupons_updated BEFORE UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customer_addresses_updated BEFORE UPDATE ON customer_addresses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_order_items_updated BEFORE UPDATE ON order_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscriptions_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_subscription_plans_updated BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_purchases_updated BEFORE UPDATE ON purchases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_master_class_sessions_updated BEFORE UPDATE ON master_class_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_lessons_updated BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-populate partition key (created_year) from created_at
-- Only sets if not already provided (for migration compatibility)
CREATE OR REPLACE FUNCTION set_partition_year()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-set if not already provided (allows explicit partition key in migrations)
    IF NEW.created_year IS NULL THEN
        NEW.created_year = extract_year(NEW.created_at);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_partition_year
BEFORE INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_partition_year();

-- Auto-populate order_year for order_items from the referenced order
-- Note: This queries across partitions by order_id. For better performance,
-- consider passing order_year explicitly from the application layer.
CREATE OR REPLACE FUNCTION set_order_items_year()
RETURNS TRIGGER AS $$
BEGIN
    -- Only auto-set if not already provided
    IF NEW.order_year IS NULL THEN
        SELECT created_year INTO NEW.order_year
        FROM orders WHERE id = NEW.order_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_year
BEFORE INSERT ON order_items
FOR EACH ROW
EXECUTE FUNCTION set_order_items_year();

-- Revoke purchases when subscription is canceled
-- Note: Subscription access via plan_products is automatically revoked by status check
CREATE OR REPLACE FUNCTION sync_purchase_from_subscription()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NEW.status = 'canceled' AND NEW.ended_at IS NOT NULL THEN
            -- Revoke any direct purchases linked to this subscription
            PERFORM revoke_subscription_purchases(NEW.id, 'Subscription canceled');
            -- Plan-based access is automatically revoked because has_subscription_access()
            -- checks subscription.status IN ('active', 'trialing')
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_sync
AFTER UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION sync_purchase_from_subscription();

-- Cancel all subscriptions when plan is disabled (hard disable)
-- Stripe is source of truth - also need to cancel in Stripe via application layer
CREATE OR REPLACE FUNCTION cancel_subscriptions_on_plan_disable()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when is_active changes from true to false
    IF OLD.is_active = true AND NEW.is_active = false THEN
        UPDATE subscriptions
        SET status = 'canceled',
            canceled_at = NOW(),
            ended_at = NOW(),
            updated_at = NOW()
        WHERE plan_id = NEW.id
        AND status IN ('active', 'trialing');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plan_disable_cancel_subs
AFTER UPDATE ON subscription_plans
FOR EACH ROW
EXECUTE FUNCTION cancel_subscriptions_on_plan_disable();

-- Update customer stats when order is paid
CREATE OR REPLACE FUNCTION update_customer_order_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'paid')
       OR (TG_OP = 'UPDATE' AND OLD.status != 'paid' AND NEW.status = 'paid') THEN
        UPDATE customers
        SET
            total_orders = total_orders + 1,
            total_spent_cents = total_spent_cents + NEW.total_cents,
            updated_at = NOW()
        WHERE id = NEW.customer_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_customer_stats
AFTER INSERT OR UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_customer_order_stats();

-- Update customer subscription count
CREATE OR REPLACE FUNCTION update_customer_subscription_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.status IN ('active', 'trialing') THEN
        UPDATE customers
        SET active_subscriptions = active_subscriptions + 1,
            updated_at = NOW()
        WHERE id = NEW.customer_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status NOT IN ('active', 'trialing') AND NEW.status IN ('active', 'trialing') THEN
            UPDATE customers
            SET active_subscriptions = active_subscriptions + 1,
                updated_at = NOW()
            WHERE id = NEW.customer_id;
        ELSIF OLD.status IN ('active', 'trialing') AND NEW.status NOT IN ('active', 'trialing') THEN
            UPDATE customers
            SET active_subscriptions = GREATEST(0, active_subscriptions - 1),
                updated_at = NOW()
            WHERE id = NEW.customer_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_subscription_customer_count
AFTER INSERT OR UPDATE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_customer_subscription_count();

-- ============================================
-- REFUND ACCESS REVOCATION TRIGGER (Scenario 3)
-- ============================================

-- Revoke lifetime purchases when order is refunded
CREATE OR REPLACE FUNCTION revoke_purchases_on_refund()
RETURNS TRIGGER AS $$
BEGIN
    -- Only on status change TO refunded
    IF (TG_OP = 'UPDATE'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status = 'refunded') THEN

        -- Revoke ONLY lifetime purchases (NOT subscription-linked)
        UPDATE purchases
        SET status = 'revoked',
            revoked_at = NOW(),
            revoke_reason = COALESCE(NEW.refund_reason, 'Order refunded'),
            updated_at = NOW()
        WHERE order_id = NEW.id
        AND status = 'active'
        AND is_lifetime = true
        AND subscription_id IS NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_refund_revoke
AFTER UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION revoke_purchases_on_refund();

-- ============================================
-- MATERIALIZED VIEWS (For Dashboards)
-- ============================================

-- Monthly Revenue
CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT
    DATE_TRUNC('month', created_at) AS month,
    currency,
    COUNT(*) AS order_count,
    SUM(total_cents) AS revenue_cents,
    SUM(discount_cents) AS discounts_cents,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM orders
WHERE status = 'paid'
GROUP BY 1, 2
ORDER BY 1 DESC;

CREATE UNIQUE INDEX idx_mv_revenue ON mv_monthly_revenue(month, currency);

-- Active Subscriptions by Plan
CREATE MATERIALIZED VIEW mv_active_subscriptions AS
SELECT
    s.plan_id,
    sp.name AS plan_name,
    s.recurring_interval,
    s.currency,
    COUNT(*) AS active_count,
    SUM(s.unit_amount_cents) AS mrr_cents
FROM subscriptions s
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE s.status IN ('active', 'trialing')
GROUP BY 1, 2, 3, 4;

CREATE UNIQUE INDEX idx_mv_subs ON mv_active_subscriptions(COALESCE(plan_id, '00000000-0000-0000-0000-000000000000'::uuid), recurring_interval, currency);

-- Product Sales
CREATE MATERIALIZED VIEW mv_product_sales AS
SELECT
    pur.product_id,
    p.product_name,
    COUNT(*) AS total_purchases,
    COUNT(DISTINCT pur.customer_id) AS unique_customers,
    SUM(pur.unit_amount_cents) AS total_revenue_cents
FROM purchases pur
LEFT JOIN products p ON p.id = pur.product_id
WHERE pur.status = 'active'
GROUP BY 1, 2;

CREATE UNIQUE INDEX idx_mv_products ON mv_product_sales(product_id);

-- Refresh Function
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_active_subscriptions;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_product_sales;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- HELPER VIEWS (Optional)
-- ============================================

-- Active subscriptions with details
CREATE VIEW v_active_subscriptions AS
SELECT
    s.id,
    s.surecart_id,
    s.customer_id,
    c.email as customer_email,
    c.first_name || ' ' || c.last_name as customer_name,
    s.plan_id,
    sp.name AS plan_name,
    s.status,
    s.unit_amount_cents,
    s.currency,
    s.recurring_interval,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.created_at
FROM subscriptions s
LEFT JOIN customers c ON c.id = s.customer_id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
WHERE s.status IN ('active', 'trialing');

-- Customer purchases with access info
CREATE VIEW v_customer_access AS
SELECT
    pur.customer_id,
    c.email as customer_email,
    pur.product_id,
    p.product_name,
    pur.is_lifetime,
    pur.subscription_id,
    s.status as subscription_status,
    pur.status AS purchase_status,
    pur.granted_at,
    pur.expires_at
FROM purchases pur
LEFT JOIN customers c ON c.id = pur.customer_id
LEFT JOIN products p ON p.id = pur.product_id
LEFT JOIN subscriptions s ON s.id = pur.subscription_id
WHERE pur.status = 'active'
AND (pur.expires_at IS NULL OR pur.expires_at > NOW());

-- ============================================
-- BACKWARD COMPATIBILITY VIEWS
-- For applications expecting denormalized data
-- ============================================

-- Orders with denormalized customer/product data
CREATE VIEW v_orders_denormalized AS
SELECT
    o.*,
    c.email as customer_email,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    coup.code as coupon_code,
    coup.name as coupon_name,
    (SELECT COUNT(*) FROM order_items oi
     WHERE oi.order_id = o.id AND oi.order_year = o.created_year) as item_count,
    (SELECT array_agg(p.product_name) FROM order_items oi
     INNER JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = o.id AND oi.order_year = o.created_year) as product_names
FROM orders o
LEFT JOIN customers c ON c.id = o.customer_id
LEFT JOIN coupons coup ON coup.id = o.coupon_id;

-- Subscriptions with denormalized data
CREATE VIEW v_subscriptions_denormalized AS
SELECT
    s.*,
    c.email as customer_email,
    c.first_name || ' ' || c.last_name as customer_name,
    sp.name AS plan_name,
    sp.slug AS plan_slug,
    coup.code as coupon_code
FROM subscriptions s
LEFT JOIN customers c ON c.id = s.customer_id
LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
LEFT JOIN coupons coup ON coup.id = s.coupon_id;

-- Subscription plan products with details (what's in each plan)
CREATE VIEW v_subscription_plan_products_denormalized AS
SELECT
    spp.*,
    sp.name AS plan_name,
    sp.slug AS plan_slug,
    sp.amount_cents AS plan_amount_cents,
    sp.recurring_interval,
    p.product_name,
    p.product_slug,
    p.content_type,
    p.instructor_id
FROM subscription_plan_products spp
INNER JOIN subscription_plans sp ON sp.id = spp.plan_id
LEFT JOIN products p ON p.id = spp.product_id;

-- Purchases with denormalized data
CREATE VIEW v_purchases_denormalized AS
SELECT
    pur.*,
    c.email as customer_email,
    c.first_name as customer_first_name,
    c.last_name as customer_last_name,
    p.product_name,
    p.product_slug,
    p.surecart_price_id as surecart_product_id,
    sub.status as subscription_status,
    sub.current_period_end as subscription_period_end
FROM purchases pur
LEFT JOIN customers c ON c.id = pur.customer_id
LEFT JOIN products p ON p.id = pur.product_id
LEFT JOIN subscriptions sub ON sub.id = pur.subscription_id;
