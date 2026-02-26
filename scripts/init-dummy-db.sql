-- =============================================================================
-- VidyaSetu: init-dummy-db.sql
-- Recreates the complete schema in a fresh PostgreSQL database and seeds
-- VidyaSetu-themed dummy data.
--
-- Run with:
--   psql postgresql://postgres:StrongPassword123@localhost:5432/dummy \
--        -f traderlion-platform-backend/scripts/init-dummy-db.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1: Extensions & uuidv7() function
-- ---------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid
  LANGUAGE plpgsql AS
$$
DECLARE
  unix_ts_ms BIGINT;
  uuid_bytes BYTEA;
BEGIN
  unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
  uuid_bytes := substring(int8send(unix_ts_ms) FROM 3 FOR 6);
  uuid_bytes := uuid_bytes || gen_random_bytes(10);
  -- Set version to 7 (0111)
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112);
  -- Set variant to RFC 4122 (10xx)
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128);
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

-- Immutable year-extraction helper required for the GENERATED ALWAYS AS column
-- on the partitioned orders table (EXTRACT(year FROM timestamptz) is STABLE,
-- not IMMUTABLE, so PostgreSQL rejects it directly in a generated expression).
CREATE OR REPLACE FUNCTION extract_year_utc(ts timestamptz) RETURNS integer
  LANGUAGE SQL IMMUTABLE PARALLEL SAFE AS $$
    SELECT EXTRACT(year FROM ts AT TIME ZONE 'UTC')::integer
$$;

-- ---------------------------------------------------------------------------
-- SECTION 2: ENUMs (13 types)
-- ---------------------------------------------------------------------------

CREATE TYPE staff_role AS ENUM ('admin', 'instructor');

CREATE TYPE order_status AS ENUM (
  'pending', 'paid', 'payment_failed', 'void', 'refunded', 'partially_refunded'
);

CREATE TYPE order_type AS ENUM ('checkout', 'subscription');

CREATE TYPE product_content_type AS ENUM (
  'course', 'master_class', 'bundle', 'digital_download'
);

CREATE TYPE subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled', 'paused'
);

CREATE TYPE purchase_status AS ENUM ('active', 'revoked', 'expired');

CREATE TYPE coupon_validity_type AS ENUM ('lifetime', 'duration', 'one_time');

CREATE TYPE coupon_discount_type AS ENUM ('percentage', 'fixed_amount', 'free_trial');

CREATE TYPE lesson_type AS ENUM ('video', 'text');

CREATE TYPE topic_type AS ENUM ('video', 'text');

CREATE TYPE bunny_library_type AS ENUM ('public', 'private');

CREATE TYPE video_status AS ENUM ('processing', 'ready', 'failed');

CREATE TYPE question_type AS ENUM ('single', 'multiple');

-- ---------------------------------------------------------------------------
-- SECTION 3: Tables (FK-safe creation order)
-- ---------------------------------------------------------------------------

-- ── Tier 1: No FK dependencies ─────────────────────────────────────────────

CREATE TABLE pgmigrations (
  id     serial       PRIMARY KEY,
  name   varchar(255) NOT NULL,
  run_on timestamp    NOT NULL
);

CREATE TABLE staff (
  id            uuid         PRIMARY KEY DEFAULT uuidv7(),
  email         varchar(255) NOT NULL UNIQUE,
  password_hash varchar(255),
  first_name    varchar(100),
  last_name     varchar(100),
  role          staff_role   NOT NULL DEFAULT 'instructor',
  is_active     boolean      NOT NULL DEFAULT true,
  bio           text,
  avatar_url    varchar(500),
  metadata      jsonb        DEFAULT '{}',
  created_at    timestamptz  NOT NULL DEFAULT NOW(),
  updated_at    timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_staff_email ON staff (email);

CREATE TABLE customers (
  id                    uuid         PRIMARY KEY DEFAULT uuidv7(),
  surecart_id           varchar(100) UNIQUE,
  email                 varchar(255) NOT NULL UNIQUE,
  password_hash         varchar(255),
  first_name            varchar(100),
  last_name             varchar(100),
  user_nicename         varchar(100),
  phone                 varchar(50),
  tax_identifier        varchar(100),
  tax_identifier_type   varchar(50),
  stripe_customer_id    varchar(255),
  requires_password_reset boolean    NOT NULL DEFAULT false,
  total_orders          integer      NOT NULL DEFAULT 0,
  total_spent_cents     bigint       NOT NULL DEFAULT 0,
  active_subscriptions  integer      NOT NULL DEFAULT 0,
  metadata              jsonb        DEFAULT '{}',
  is_live_mode          boolean      NOT NULL DEFAULT true,
  created_at            timestamptz  NOT NULL DEFAULT NOW(),
  updated_at            timestamptz  NOT NULL DEFAULT NOW(),
  deleted_at            timestamptz,
  language_preference   varchar(10)  NOT NULL DEFAULT 'en',
  age                   smallint,
  grade                 varchar(20),
  subjects              jsonb        NOT NULL DEFAULT '[]',
  learning_goals        jsonb        NOT NULL DEFAULT '[]',
  onboarding_completed  boolean      NOT NULL DEFAULT false
);
CREATE INDEX idx_customers_email ON customers (email);

CREATE TABLE categories (
  id          uuid         PRIMARY KEY DEFAULT uuidv7(),
  name        varchar(255) NOT NULL,
  slug        varchar(255) NOT NULL UNIQUE,
  description text,
  created_at  timestamptz  NOT NULL DEFAULT NOW(),
  updated_at  timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX categories_slug_index ON categories (slug);

CREATE TABLE tags (
  id         uuid         PRIMARY KEY DEFAULT uuidv7(),
  name       varchar(255) NOT NULL,
  slug       varchar(255) NOT NULL UNIQUE,
  created_at timestamptz  NOT NULL DEFAULT NOW(),
  updated_at timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX tags_slug_index ON tags (slug);

CREATE TABLE coupons (
  id                       uuid                 PRIMARY KEY DEFAULT uuidv7(),
  surecart_id              varchar(100)         UNIQUE,
  surecart_promotion_id    varchar(100),
  code                     varchar(100)         NOT NULL UNIQUE,
  name                     varchar(255)         NOT NULL,
  description              text,
  discount_type            coupon_discount_type NOT NULL,
  discount_value           bigint               NOT NULL,
  currency                 varchar(3)           DEFAULT 'usd',
  validity_type            coupon_validity_type NOT NULL,
  duration_months          integer,
  max_redemptions          integer,
  current_redemptions      integer              NOT NULL DEFAULT 0,
  max_per_customer         integer              DEFAULT 1,
  applies_to               varchar(20)          DEFAULT 'any',
  min_purchase_amount_cents bigint,
  valid_from               timestamptz,
  valid_until              timestamptz,
  is_active                boolean              NOT NULL DEFAULT true,
  is_archived              boolean              NOT NULL DEFAULT false,
  is_new_customer_only     boolean              NOT NULL DEFAULT false,
  metadata                 jsonb                DEFAULT '{}',
  created_at               timestamptz          NOT NULL DEFAULT NOW(),
  updated_at               timestamptz          NOT NULL DEFAULT NOW()
);

-- ── Tier 2: FK → staff ─────────────────────────────────────────────────────

CREATE TABLE subscription_plans (
  id                     uuid         PRIMARY KEY DEFAULT uuidv7(),
  name                   varchar(255) NOT NULL,
  slug                   varchar(255) UNIQUE,
  description            text,
  amount_cents           bigint       NOT NULL,
  currency               varchar(3)   NOT NULL DEFAULT 'usd',
  recurring_interval     varchar(20)  NOT NULL,
  recurring_interval_count integer    NOT NULL DEFAULT 1,
  trial_days             integer      NOT NULL DEFAULT 0,
  is_active              boolean      NOT NULL DEFAULT true,
  is_archived            boolean      NOT NULL DEFAULT false,
  created_by_staff_id    uuid         REFERENCES staff(id) ON DELETE SET NULL,
  stripe_product_id      varchar(255),
  stripe_price_id        varchar(255),
  metadata               jsonb        DEFAULT '{}',
  created_at             timestamptz  NOT NULL DEFAULT NOW(),
  updated_at             timestamptz  NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscription_plans_slug ON subscription_plans (slug);

CREATE TABLE products (
  id                       uuid                 PRIMARY KEY DEFAULT uuidv7(),
  surecart_price_id        varchar(100)         UNIQUE,
  surecart_product_id      varchar(100),
  product_name             varchar(255)         NOT NULL,
  product_slug             varchar(255),
  product_description      text,
  amount_cents             bigint               NOT NULL DEFAULT 0,
  currency                 varchar(3)           NOT NULL DEFAULT 'usd',
  is_recurring             boolean              NOT NULL DEFAULT false,
  recurring_interval       varchar(20),
  recurring_interval_count integer              NOT NULL DEFAULT 1,
  trial_days               integer              NOT NULL DEFAULT 0,
  setup_fee_enabled        boolean              NOT NULL DEFAULT false,
  setup_fee_cents          bigint               NOT NULL DEFAULT 0,
  setup_fee_name           varchar(255),
  tax_category             varchar(50),
  tax_enabled              boolean              NOT NULL DEFAULT true,
  allow_out_of_stock_purchases boolean          NOT NULL DEFAULT false,
  auto_fulfill             boolean              NOT NULL DEFAULT true,
  revoke_after_days        integer,
  purchase_limit           integer,
  track_inventory          boolean              NOT NULL DEFAULT false,
  stock_quantity           integer,
  allow_out_of_stock       boolean              NOT NULL DEFAULT false,
  requires_shipping        boolean              NOT NULL DEFAULT false,
  is_active                boolean              NOT NULL DEFAULT true,
  is_archived              boolean              NOT NULL DEFAULT false,
  content_type             product_content_type NOT NULL DEFAULT 'course',
  max_attendees            integer,
  current_attendees        integer              NOT NULL DEFAULT 0,
  thumbnail_url            varchar(1000),
  stripe_product_id        varchar(255),
  stripe_price_id          varchar(255),
  is_published             boolean              NOT NULL DEFAULT false,
  published_at             timestamptz,
  sort_order               integer              NOT NULL DEFAULT 0,
  created_by_staff_id      uuid                 REFERENCES staff(id) ON DELETE SET NULL,
  instructor_id            uuid                 REFERENCES staff(id) ON DELETE SET NULL,
  wp_post_id               integer,
  metadata                 jsonb                DEFAULT '{}',
  created_at               timestamptz          NOT NULL DEFAULT NOW(),
  updated_at               timestamptz          NOT NULL DEFAULT NOW(),
  deleted_at               timestamptz
);
CREATE INDEX idx_products_surecart_price ON products (surecart_price_id);
CREATE INDEX idx_products_slug           ON products (product_slug);
CREATE INDEX idx_products_instructor     ON products (instructor_id);
CREATE INDEX idx_products_wp_post_id     ON products (wp_post_id);
CREATE INDEX idx_products_stripe_product ON products (stripe_product_id) WHERE stripe_product_id IS NOT NULL;
CREATE INDEX idx_products_stripe_price   ON products (stripe_price_id)   WHERE stripe_price_id   IS NOT NULL;

CREATE TABLE videos (
  id               uuid             PRIMARY KEY DEFAULT uuidv7(),
  bunny_video_id   varchar(100)     NOT NULL UNIQUE,
  title            varchar(500)     NOT NULL,
  description      text,
  thumbnail_url    varchar(1000),
  duration         integer          NOT NULL DEFAULT 0,
  bunny_library_type bunny_library_type NOT NULL DEFAULT 'private',
  video_status     video_status     NOT NULL DEFAULT 'processing',
  encode_progress  smallint         NOT NULL DEFAULT 0,
  instructor_id    uuid             NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  category_id      uuid             REFERENCES categories(id) ON DELETE SET NULL,
  is_published     boolean          NOT NULL DEFAULT false,
  published_at     timestamptz,
  sort_order       integer          NOT NULL DEFAULT 0,
  created_at       timestamptz      NOT NULL DEFAULT NOW(),
  updated_at       timestamptz      NOT NULL DEFAULT NOW(),
  deleted_at       timestamptz
);
CREATE INDEX idx_videos_instructor ON videos (instructor_id);
CREATE INDEX idx_videos_published  ON videos (is_published);

-- ── Tier 3: FK → coupons + products + staff ────────────────────────────────

CREATE TABLE coupon_product_restrictions (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  coupon_id  uuid        NOT NULL REFERENCES coupons(id)  ON DELETE CASCADE,
  product_id uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (coupon_id, product_id)
);
CREATE INDEX idx_coupon_restrictions_coupon  ON coupon_product_restrictions (coupon_id);
CREATE INDEX idx_coupon_restrictions_product ON coupon_product_restrictions (product_id);

CREATE TABLE bundle_items (
  id               uuid        PRIMARY KEY DEFAULT uuidv7(),
  bundle_product_id uuid       NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  item_product_id  uuid        NOT NULL REFERENCES products(id),
  quantity         integer     NOT NULL DEFAULT 1,
  added_by_staff_id uuid       REFERENCES staff(id),
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (bundle_product_id, item_product_id)
);
CREATE INDEX idx_bundle_items_bundle ON bundle_items (bundle_product_id);
CREATE INDEX idx_bundle_items_item   ON bundle_items (item_product_id);

CREATE TABLE subscription_plan_products (
  id               uuid        PRIMARY KEY DEFAULT uuidv7(),
  plan_id          uuid        NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  product_id       uuid        NOT NULL REFERENCES products(id),
  added_by_staff_id uuid       REFERENCES staff(id),
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (plan_id, product_id)
);
CREATE INDEX idx_plan_products_plan    ON subscription_plan_products (plan_id);
CREATE INDEX idx_plan_products_product ON subscription_plan_products (product_id);

-- ── Tier 4: FK → customers + subscription_plans + products + coupons ───────

CREATE TABLE subscriptions (
  id                     uuid                PRIMARY KEY DEFAULT uuidv7(),
  surecart_id            varchar(100)        UNIQUE,
  coupon_id              uuid                REFERENCES coupons(id)            ON DELETE SET NULL,
  customer_id            uuid                NOT NULL REFERENCES customers(id),
  plan_id                uuid                REFERENCES subscription_plans(id),
  legacy_product_id      uuid                REFERENCES products(id),
  status                 subscription_status NOT NULL DEFAULT 'active',
  currency               varchar(3)          NOT NULL DEFAULT 'usd',
  unit_amount_cents      bigint              NOT NULL,
  recurring_interval     varchar(20)         NOT NULL,
  recurring_interval_count integer           NOT NULL DEFAULT 1,
  quantity               integer             NOT NULL DEFAULT 1,
  trial_start            timestamptz,
  trial_end              timestamptz,
  current_period_start   timestamptz         NOT NULL,
  current_period_end     timestamptz         NOT NULL,
  cancel_at_period_end   boolean             NOT NULL DEFAULT false,
  canceled_at            timestamptz,
  ended_at               timestamptz,
  stripe_subscription_id varchar(255),
  metadata               jsonb               DEFAULT '{}',
  is_live_mode           boolean             NOT NULL DEFAULT true,
  created_at             timestamptz         NOT NULL DEFAULT NOW(),
  updated_at             timestamptz         NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_subscriptions_customer ON subscriptions (customer_id);
CREATE INDEX idx_subscriptions_plan     ON subscriptions (plan_id);

-- orders — partitioned by created_year
-- NOTE: PostgreSQL does not allow a GENERATED column as a partition key, so
-- created_year is a regular NOT NULL integer populated by a BEFORE INSERT trigger.
CREATE OR REPLACE FUNCTION orders_set_created_year() RETURNS trigger
  LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.created_year IS NULL THEN
    NEW.created_year := extract_year_utc(NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE orders (
  id                      uuid         NOT NULL DEFAULT uuidv7(),
  surecart_id             varchar(100),
  order_number            varchar(50)  NOT NULL,
  status                  order_status NOT NULL DEFAULT 'pending',
  order_type              order_type   NOT NULL DEFAULT 'checkout',
  customer_id             uuid         NOT NULL REFERENCES customers(id),
  coupon_id               uuid         REFERENCES coupons(id) ON DELETE SET NULL,
  currency                varchar(3)   NOT NULL DEFAULT 'usd',
  subtotal_cents          bigint       NOT NULL DEFAULT 0,
  discount_cents          bigint       NOT NULL DEFAULT 0,
  tax_cents               bigint       NOT NULL DEFAULT 0,
  shipping_cents          bigint       NOT NULL DEFAULT 0,
  total_cents             bigint       NOT NULL DEFAULT 0,
  amount_due_cents        bigint       NOT NULL DEFAULT 0,
  trial_cents             bigint       DEFAULT 0,
  proration_cents         bigint       DEFAULT 0,
  billing_address_snapshot jsonb,
  shipping_address_snapshot jsonb,
  tax_identifier          varchar(100),
  tax_identifier_type     varchar(50),
  payment_method          varchar(50),
  payment_failure_reason  text,
  stripe_payment_intent_id varchar(255),
  stripe_invoice_id       varchar(255),
  refund_amount_cents     bigint       DEFAULT 0,
  refund_reason           text,
  refunded_at             timestamptz,
  tracking_numbers        text[]       NOT NULL DEFAULT '{}',
  invoice_url             varchar(500),
  metadata                jsonb        DEFAULT '{}',
  is_live_mode            boolean      NOT NULL DEFAULT true,
  created_at              timestamptz  NOT NULL DEFAULT NOW(),
  updated_at              timestamptz  DEFAULT NOW(),
  paid_at                 timestamptz,
  created_year            integer      NOT NULL DEFAULT extract_year_utc(NOW()),
  PRIMARY KEY (id, created_year)
) PARTITION BY LIST (created_year);

CREATE TRIGGER orders_set_year
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION orders_set_created_year();

CREATE TABLE orders_2025 PARTITION OF orders FOR VALUES IN (2025);
CREATE TABLE orders_2026 PARTITION OF orders FOR VALUES IN (2026);

CREATE INDEX idx_orders_customer ON orders (customer_id);
CREATE INDEX idx_orders_number   ON orders (order_number);
CREATE INDEX idx_orders_status   ON orders (status);

-- ── Tier 5: FK → products + staff (sections, posts, master classes) ────────

CREATE TABLE sections (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  title       varchar(500) NOT NULL,
  description text,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_published boolean    NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_sections_product ON sections (product_id);

CREATE TABLE master_class_sessions (
  id                    uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id            uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  session_number        integer     NOT NULL DEFAULT 1,
  session_title         varchar(255),
  scheduled_at          timestamptz NOT NULL,
  duration_minutes      integer     NOT NULL DEFAULT 60,
  timezone              varchar(50) DEFAULT 'UTC',
  platform              varchar(50) NOT NULL,
  live_url              varchar(500),
  recording_status      varchar(20) DEFAULT 'pending',
  recording_url         varchar(500),
  recording_available_at timestamptz,
  status                varchar(20) DEFAULT 'scheduled',
  scheduled_by_staff_id uuid        REFERENCES staff(id),
  updated_by_staff_id   uuid        REFERENCES staff(id),
  created_at            timestamptz NOT NULL DEFAULT NOW(),
  updated_at            timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (product_id, session_number)
);
CREATE INDEX idx_mcs_product ON master_class_sessions (product_id);

-- order_items — partitioned by order_year
CREATE TABLE order_items (
  id                uuid         NOT NULL DEFAULT uuidv7(),
  order_id          uuid         NOT NULL,
  order_year        integer      NOT NULL,
  coupon_id         uuid         REFERENCES coupons(id)        ON DELETE SET NULL,
  product_id        uuid         NOT NULL REFERENCES products(id),
  quantity          integer      NOT NULL DEFAULT 1,
  unit_amount_cents bigint       NOT NULL,
  discount_cents    bigint       NOT NULL DEFAULT 0,
  tax_cents         bigint       NOT NULL DEFAULT 0,
  total_cents       bigint       NOT NULL,
  currency          varchar(3)   NOT NULL DEFAULT 'usd',
  subscription_id   uuid         REFERENCES subscriptions(id)  ON DELETE SET NULL,
  refund_status     varchar(20),
  refund_amount_cents bigint     DEFAULT 0,
  refunded_at       timestamptz,
  created_at        timestamptz  NOT NULL DEFAULT NOW(),
  updated_at        timestamptz  DEFAULT NOW(),
  PRIMARY KEY (id, order_year),
  FOREIGN KEY (order_id, order_year) REFERENCES orders(id, created_year) ON DELETE CASCADE
) PARTITION BY LIST (order_year);

CREATE TABLE order_items_2025 PARTITION OF order_items FOR VALUES IN (2025);
CREATE TABLE order_items_2026 PARTITION OF order_items FOR VALUES IN (2026);

CREATE INDEX idx_order_items_order   ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- ── Tier 6: FK → customers + products + subscriptions (purchases) ──────────

CREATE TABLE purchases (
  id              uuid           PRIMARY KEY DEFAULT uuidv7(),
  surecart_id     varchar(100)   UNIQUE,
  customer_id     uuid           NOT NULL REFERENCES customers(id),
  product_id      uuid           NOT NULL REFERENCES products(id),
  is_lifetime     boolean        NOT NULL DEFAULT false,
  currency        varchar(3)     NOT NULL DEFAULT 'usd',
  unit_amount_cents bigint       NOT NULL,
  order_id        uuid,          -- plain uuid, NO FK (partitioned table limitation)
  subscription_id uuid           REFERENCES subscriptions(id) ON DELETE SET NULL,
  status          purchase_status NOT NULL DEFAULT 'active',
  revoked_at      timestamptz,
  revoke_reason   text,
  expires_at      timestamptz,
  metadata        jsonb          DEFAULT '{}',
  is_live_mode    boolean        NOT NULL DEFAULT true,
  granted_at      timestamptz    NOT NULL DEFAULT NOW(),
  created_at      timestamptz    NOT NULL DEFAULT NOW(),
  updated_at      timestamptz    NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_purchases_customer ON purchases (customer_id);
CREATE INDEX idx_purchases_product  ON purchases (product_id);

-- ── Tier 7: FK → sections + products + videos ──────────────────────────────

CREATE TABLE lessons (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id  uuid        NOT NULL REFERENCES products(id)  ON DELETE CASCADE,
  section_id  uuid        NOT NULL REFERENCES sections(id)  ON DELETE CASCADE,
  title       varchar(500) NOT NULL,
  content     text,
  video_id    uuid        REFERENCES videos(id) ON DELETE SET NULL,
  lesson_type lesson_type NOT NULL DEFAULT 'text',
  duration    integer     DEFAULT 0,
  sort_order  integer     NOT NULL DEFAULT 0,
  section_name varchar(500),
  is_published boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW(),
  deleted_at  timestamptz
);
CREATE INDEX lessons_product_id_index ON lessons (product_id);
CREATE INDEX idx_lessons_section      ON lessons (section_id);
CREATE INDEX idx_lessons_video        ON lessons (video_id);

CREATE TABLE quizzes (
  id                uuid        PRIMARY KEY DEFAULT uuidv7(),
  product_id        uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  section_id        uuid        REFERENCES sections(id) ON DELETE SET NULL,
  title             varchar(500) NOT NULL,
  description       text,
  passing_percentage integer    NOT NULL DEFAULT 80,
  time_limit_seconds integer,
  sort_order        integer     NOT NULL DEFAULT 0,
  section_name      text,
  is_published      boolean     NOT NULL DEFAULT false,
  wp_post_id        integer,
  metadata          jsonb       DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT NOW(),
  updated_at        timestamptz NOT NULL DEFAULT NOW(),
  deleted_at        timestamptz
);
CREATE INDEX idx_quizzes_product    ON quizzes (product_id);
CREATE INDEX idx_quizzes_section    ON quizzes (section_id);
CREATE INDEX idx_quizzes_wp_post_id ON quizzes (wp_post_id);

-- ── Tier 8: FK → posts, master_class_sessions, lessons, quizzes ────────────

CREATE TABLE posts (
  id                 uuid        PRIMARY KEY DEFAULT uuidv7(),
  title              varchar(500) NOT NULL,
  slug               varchar(500) NOT NULL UNIQUE,
  content            text        NOT NULL,
  excerpt            varchar(1000),
  cover_image_url    varchar(1000),
  author_id          uuid        NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  is_published       boolean     NOT NULL DEFAULT false,
  published_at       timestamptz,
  seo_title          varchar(500),
  seo_description    varchar(1000),
  seo_keywords       varchar(500),
  wp_post_id         integer,
  subscription_plan_id uuid      REFERENCES subscription_plans(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT NOW(),
  updated_at         timestamptz NOT NULL DEFAULT NOW(),
  deleted_at         timestamptz
);
CREATE INDEX posts_author_id_index       ON posts (author_id);
CREATE INDEX posts_slug_index            ON posts (slug);
CREATE INDEX posts_wp_post_id_index      ON posts (wp_post_id);
CREATE INDEX idx_posts_subscription_plan ON posts (subscription_plan_id);

CREATE TABLE master_class_attendees (
  id               uuid        PRIMARY KEY DEFAULT uuidv7(),
  session_id       uuid        NOT NULL REFERENCES master_class_sessions(id) ON DELETE CASCADE,
  customer_id      uuid        NOT NULL REFERENCES customers(id),
  purchase_id      uuid        NOT NULL REFERENCES purchases(id),
  registered_at    timestamptz NOT NULL DEFAULT NOW(),
  attended         boolean     NOT NULL DEFAULT false,
  joined_at        timestamptz,
  recording_watched boolean    NOT NULL DEFAULT false,
  UNIQUE (session_id, customer_id)
);
CREATE INDEX idx_mca_customer ON master_class_attendees (customer_id);

CREATE TABLE topics (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  lesson_id   uuid        NOT NULL REFERENCES lessons(id)  ON DELETE CASCADE,
  product_id  uuid        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  section_id  uuid        NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title       varchar(500) NOT NULL,
  content     text,
  video_id    uuid        REFERENCES videos(id) ON DELETE SET NULL,
  topic_type  topic_type  NOT NULL DEFAULT 'text',
  duration    integer     DEFAULT 0,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_published boolean    NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_topics_lesson   ON topics (lesson_id);
CREATE INDEX idx_topics_product  ON topics (product_id);
CREATE INDEX idx_topics_section  ON topics (section_id);
CREATE INDEX idx_topics_video    ON topics (video_id);

-- ── Tier 9: FK → quizzes + posts + categories + tags ───────────────────────

CREATE TABLE quiz_questions (
  id             uuid          PRIMARY KEY DEFAULT uuidv7(),
  quiz_id        uuid          NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question_text  text          NOT NULL,
  question_type  question_type NOT NULL DEFAULT 'single',
  points         integer       NOT NULL DEFAULT 1,
  sort_order     integer       NOT NULL DEFAULT 0,
  hint           text,
  wp_post_id     integer,
  question_pro_id integer,
  metadata       jsonb         DEFAULT '{}',
  created_at     timestamptz   NOT NULL DEFAULT NOW(),
  updated_at     timestamptz   NOT NULL DEFAULT NOW(),
  deleted_at     timestamptz
);
CREATE INDEX idx_quiz_questions_quiz ON quiz_questions (quiz_id);

CREATE TABLE post_categories (
  post_id     uuid NOT NULL REFERENCES posts(id)       ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, category_id)
);
CREATE INDEX post_categories_category_id_index ON post_categories (category_id);

CREATE TABLE post_tags (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id  uuid NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
CREATE INDEX post_tags_tag_id_index ON post_tags (tag_id);

-- ── Tier 10: FK → quiz_questions ───────────────────────────────────────────

CREATE TABLE quiz_question_options (
  id          uuid        PRIMARY KEY DEFAULT uuidv7(),
  question_id uuid        NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text text        NOT NULL,
  is_correct  boolean     NOT NULL DEFAULT false,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  deleted_at  timestamptz
);
CREATE INDEX idx_quiz_options_question ON quiz_question_options (question_id);

-- ── Customer auth tables (reference customers) ─────────────────────────────

CREATE TABLE oauth_accounts (
  id                  uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid         NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider            varchar(50)  NOT NULL,
  provider_account_id varchar(255) NOT NULL,
  created_at          timestamptz  NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX oauth_accounts_customer_id_index                     ON oauth_accounts (customer_id);
CREATE INDEX oauth_accounts_provider_provider_account_id_index    ON oauth_accounts (provider, provider_account_id);

CREATE TABLE sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  revoked_at  timestamptz
);
CREATE INDEX sessions_customer_id_index ON sessions (customer_id);

CREATE TABLE customer_addresses (
  id           uuid        PRIMARY KEY DEFAULT uuidv7(),
  customer_id  uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address_type varchar(20) NOT NULL,
  line_1       varchar(255),
  line_2       varchar(255),
  city         varchar(100),
  state        varchar(100),
  postal_code  varchar(20),
  country      varchar(2),
  is_default   boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_addresses_customer ON customer_addresses (customer_id);

CREATE TABLE staff_sessions (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  staff_id   uuid        NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  revoked_at timestamptz
);
CREATE INDEX staff_sessions_staff_id_index ON staff_sessions (staff_id);

-- ---------------------------------------------------------------------------
-- SECTION 4: Seed pgmigrations (all 24 filenames, run_on = NOW)
-- ---------------------------------------------------------------------------

INSERT INTO pgmigrations (name, run_on) VALUES
  ('1769509400000_create-auth-tables-for-customers',          NOW()),
  ('1769509500000_null-wordpress-password-hashes',            NOW()),
  ('1769509600000_create-staff-sessions',                     NOW()),
  ('1769509700000_create-posts',                              NOW()),
  ('1769509800000_create-categories-tags',                    NOW()),
  ('1769509900000_add-post-seo-fields',                       NOW()),
  ('1769510000000_create-videos-table',                       NOW()),
  ('1769510100000_add-bunny-library-type',                    NOW()),
  ('1769510150000_create-courses-lessons',                    NOW()),
  ('1769510200000_simplify-course-architecture',              NOW()),
  ('1769510300000_add-video-status',                          NOW()),
  ('1771501764479_drop-courses-link-lessons-to-products',     NOW()),
  ('1771585273192_create-customer-sessions-and-oauth',        NOW()),
  ('1771586778863_add-requires-password-reset-to-customers',  NOW()),
  ('1771589754004_add-learndash-migration-fields',            NOW()),
  ('1771590000000_add-quiz-tables',                           NOW()),
  ('1771829190937_add-section-name-to-quizzes',              NOW()),
  ('1771830054961_unpublish-empty-topic-lessons',             NOW()),
  ('1771836377584_replace-subscription-plans-link-subscriptions', NOW()),
  ('1771848229782_add-sections-table',                        NOW()),
  ('1771850000000_create-topics-table',                       NOW()),
  ('1771934828911_add-stripe-ids-to-products',                NOW()),
  ('1772023274136_fix-migrated-video-types',                  NOW()),
  ('1772040267570_add-soft-delete-to-lessons-quizzes',        NOW()),
  ('1772100000000_add-onboarding-fields-to-customers',       NOW());

-- ---------------------------------------------------------------------------
-- SECTION 5: VidyaSetu Dummy Data
-- All UUIDs are hardcoded for predictable FK references.
-- UUID pattern: 00000000-0000-0000-{group}-{sequence}
--   group 0000 = staff
--   group 0001 = categories
--   group 0002 = tags
--   group 0003 = subscription_plans
--   group 0004 = products
--   group 0005 = videos
--   group 0006 = sections
--   group 0007 = lessons
--   group 0008 = topics
--   group 0009 = quizzes
--   group 000a = quiz_questions
--   group 000b = quiz_question_options
--   group 000c = coupons
--   group 000d = posts
--   group 000e = subscription_plan_products
-- ---------------------------------------------------------------------------

-- 1. Staff (5 rows)
INSERT INTO staff (id, email, password_hash, first_name, last_name, role, is_active, bio, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin@vidyasetu.in',           '$2b$12$placeholder_hash_admin',     'VidyaSetu',    'Admin',         'admin',      true, 'Platform administrator for VidyaSetu AI Learning Portal.',           NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000002', 'maths.ai@vidyasetu.in',        '$2b$12$placeholder_hash_maths',     'Maths',        'AI',            'instructor', true, 'AI instructor specialising in NCERT Mathematics for Grades 4–8.',    NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000003', 'science.ai@vidyasetu.in',      '$2b$12$placeholder_hash_science',   'Science',      'AI',            'instructor', true, 'AI instructor specialising in NCERT Science for Grades 4–8.',        NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000004', 'language.ai@vidyasetu.in',     '$2b$12$placeholder_hash_language',  'Language',     'AI',            'instructor', true, 'AI instructor for English reading comprehension and Hindi literacy.', NOW(), NOW()),
  ('00000000-0000-0000-0000-000000000005', 'socialstudies.ai@vidyasetu.in','$2b$12$placeholder_hash_social',    'Social Studies','AI',           'instructor', true, 'AI instructor for NCERT Social Studies and History.',                NOW(), NOW());

-- 2. Categories (5 rows)
INSERT INTO categories (id, name, slug, description, created_at, updated_at) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Mathematics',    'mathematics',    'NCERT Mathematics curriculum for primary and middle school.',  NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000002', 'Science',        'science',        'NCERT Science curriculum covering life, physical and earth sciences.', NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000003', 'English',        'english',        'English language and reading comprehension skills.',           NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000004', 'Social Studies', 'social-studies', 'History, Geography and Civics from the NCERT syllabus.',       NOW(), NOW()),
  ('00000000-0000-0000-0001-000000000005', 'Languages',      'languages',      'Hindi, Telugu and other Indian regional language support.',    NOW(), NOW());

-- 3. Tags (8 rows)
INSERT INTO tags (id, name, slug, created_at, updated_at) VALUES
  ('00000000-0000-0000-0002-000000000001', 'NCERT',       'ncert',       NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000002', 'Class 5',     'class-5',     NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000003', 'Class 4',     'class-4',     NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000004', 'Hindi',       'hindi',       NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000005', 'Telugu',      'telugu',      NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000006', 'Free',        'free',        NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000007', 'Beginner',    'beginner',    NOW(), NOW()),
  ('00000000-0000-0000-0002-000000000008', 'Rural India', 'rural-india', NOW(), NOW());

-- 4. Subscription Plans (3 rows — using 'inr' for Indian market)
INSERT INTO subscription_plans (id, name, slug, description, amount_cents, currency, recurring_interval, recurring_interval_count, trial_days, is_active, is_archived, created_by_staff_id, created_at, updated_at) VALUES
  ('00000000-0000-0000-0003-000000000001',
   'VidyaSetu Free',
   'vidyasetu-free',
   'Free forever plan — access select NCERT lessons with AI tutor in Hindi and Telugu.',
   0, 'inr', 'month', 1, 0, true, false,
   '00000000-0000-0000-0000-000000000001', NOW(), NOW()),

  ('00000000-0000-0000-0003-000000000002',
   'VidyaSetu Standard',
   'vidyasetu-standard',
   'Full access to all NCERT courses for Classes 4–8 with multilingual AI tutor.',
   9900, 'inr', 'month', 1, 7, true, false,
   '00000000-0000-0000-0000-000000000001', NOW(), NOW()),

  ('00000000-0000-0000-0003-000000000003',
   'VidyaSetu Premium',
   'vidyasetu-premium',
   'All Standard features plus live doubt-clearing sessions and progress reports.',
   19900, 'inr', 'month', 1, 7, true, false,
   '00000000-0000-0000-0000-000000000001', NOW(), NOW());

-- 5. Products (4 courses)
INSERT INTO products (id, product_name, product_slug, product_description, amount_cents, currency, content_type, is_published, published_at, sort_order, instructor_id, created_by_staff_id, created_at, updated_at) VALUES
  ('00000000-0000-0000-0004-000000000001',
   'Fractions & Decimals',
   'fractions-and-decimals',
   'Master NCERT Class 5 Maths — fractions, decimals and number sense with interactive AI explanations.',
   0, 'usd', 'course', true, NOW(), 1,
   '00000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000001',
   NOW(), NOW()),

  ('00000000-0000-0000-0004-000000000002',
   'Plants & Photosynthesis',
   'plants-and-photosynthesis',
   'Explore NCERT Class 5 Science — how plants make food, life cycles and ecosystems.',
   0, 'usd', 'course', true, NOW(), 2,
   '00000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000001',
   NOW(), NOW()),

  ('00000000-0000-0000-0004-000000000003',
   'Reading & Comprehension',
   'reading-and-comprehension',
   'Build English reading skills with NCERT Class 5 passages — answered in Hindi and Telugu too.',
   0, 'usd', 'course', true, NOW(), 3,
   '00000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000001',
   NOW(), NOW()),

  ('00000000-0000-0000-0004-000000000004',
   'History of India',
   'history-of-india',
   'Journey through NCERT Class 5 Social Studies — ancient civilisations to the freedom movement.',
   0, 'usd', 'course', true, NOW(), 4,
   '00000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000001',
   NOW(), NOW());

-- 6. Subscription Plan Products (Standard + Premium × 4 products = 8 rows)
INSERT INTO subscription_plan_products (id, plan_id, product_id, added_by_staff_id, created_at) VALUES
  -- Standard plan
  ('00000000-0000-0000-000e-000000000001', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000001', NOW()),
  ('00000000-0000-0000-000e-000000000002', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000001', NOW()),
  ('00000000-0000-0000-000e-000000000003', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000001', NOW()),
  ('00000000-0000-0000-000e-000000000004', '00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0000-000000000001', NOW()),
  -- Premium plan
  ('00000000-0000-0000-000e-000000000005', '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0000-000000000001', NOW()),
  ('00000000-0000-0000-000e-000000000006', '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0000-000000000001', NOW()),
  ('00000000-0000-0000-000e-000000000007', '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0000-000000000001', NOW()),
  ('00000000-0000-0000-000e-000000000008', '00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0000-000000000001', NOW());

-- 7. Videos (6 rows — 2 per subject pair)
INSERT INTO videos (id, bunny_video_id, title, instructor_id, category_id, bunny_library_type, video_status, encode_progress, is_published, published_at, sort_order, created_at, updated_at) VALUES
  ('00000000-0000-0000-0005-000000000001', 'dummy-vid-001', 'Introduction to Fractions',       '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0001-000000000001', 'private', 'ready', 100, true, NOW(), 1, NOW(), NOW()),
  ('00000000-0000-0000-0005-000000000002', 'dummy-vid-002', 'Understanding Decimals',           '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0001-000000000001', 'private', 'ready', 100, true, NOW(), 2, NOW(), NOW()),
  ('00000000-0000-0000-0005-000000000003', 'dummy-vid-003', 'How Plants Make Food',             '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0001-000000000002', 'private', 'ready', 100, true, NOW(), 1, NOW(), NOW()),
  ('00000000-0000-0000-0005-000000000004', 'dummy-vid-004', 'Plant Life Cycles',                '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0001-000000000002', 'private', 'ready', 100, true, NOW(), 2, NOW(), NOW()),
  ('00000000-0000-0000-0005-000000000005', 'dummy-vid-005', 'Reading Comprehension Strategies', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0001-000000000003', 'private', 'ready', 100, true, NOW(), 1, NOW(), NOW()),
  ('00000000-0000-0000-0005-000000000006', 'dummy-vid-006', 'Ancient India — Civilisations',    '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0001-000000000004', 'private', 'ready', 100, true, NOW(), 1, NOW(), NOW());

-- 8. Sections (8 rows — 2 per product)
INSERT INTO sections (id, product_id, title, sort_order, is_published, created_at, updated_at) VALUES
  -- Product 1: Fractions & Decimals
  ('00000000-0000-0000-0006-000000000001', '00000000-0000-0000-0004-000000000001', 'Introduction to Fractions',  1, true, NOW(), NOW()),
  ('00000000-0000-0000-0006-000000000002', '00000000-0000-0000-0004-000000000001', 'Advanced Fractions',         2, true, NOW(), NOW()),
  -- Product 2: Plants & Photosynthesis
  ('00000000-0000-0000-0006-000000000003', '00000000-0000-0000-0004-000000000002', 'Photosynthesis Basics',      1, true, NOW(), NOW()),
  ('00000000-0000-0000-0006-000000000004', '00000000-0000-0000-0004-000000000002', 'Plant Life Cycles',          2, true, NOW(), NOW()),
  -- Product 3: Reading & Comprehension
  ('00000000-0000-0000-0006-000000000005', '00000000-0000-0000-0004-000000000003', 'Reading Strategies',         1, true, NOW(), NOW()),
  ('00000000-0000-0000-0006-000000000006', '00000000-0000-0000-0004-000000000003', 'Vocabulary & Grammar',       2, true, NOW(), NOW()),
  -- Product 4: History of India
  ('00000000-0000-0000-0006-000000000007', '00000000-0000-0000-0004-000000000004', 'Ancient Civilisations',      1, true, NOW(), NOW()),
  ('00000000-0000-0000-0006-000000000008', '00000000-0000-0000-0004-000000000004', 'Freedom Movement',           2, true, NOW(), NOW());

-- 9. Lessons (24 rows — 3 per section)
INSERT INTO lessons (id, product_id, section_id, title, lesson_type, video_id, section_name, sort_order, is_published, created_at, updated_at) VALUES
  -- Section 1: Introduction to Fractions (Product 1)
  ('00000000-0000-0000-0007-000000000001', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0006-000000000001', 'What is a Fraction?',         'video', '00000000-0000-0000-0005-000000000001', 'Introduction to Fractions', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000002', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0006-000000000001', 'Numerator and Denominator',   'video', '00000000-0000-0000-0005-000000000001', 'Introduction to Fractions', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000003', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0006-000000000001', 'Equivalent Fractions',        'video', '00000000-0000-0000-0005-000000000001', 'Introduction to Fractions', 3, true, NOW(), NOW()),
  -- Section 2: Advanced Fractions (Product 1)
  ('00000000-0000-0000-0007-000000000004', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0006-000000000002', 'Adding Fractions',            'video', '00000000-0000-0000-0005-000000000002', 'Advanced Fractions', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000005', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0006-000000000002', 'Subtracting Fractions',       'video', '00000000-0000-0000-0005-000000000002', 'Advanced Fractions', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000006', '00000000-0000-0000-0004-000000000001', '00000000-0000-0000-0006-000000000002', 'Fractions to Decimals',       'video', '00000000-0000-0000-0005-000000000002', 'Advanced Fractions', 3, true, NOW(), NOW()),
  -- Section 3: Photosynthesis Basics (Product 2)
  ('00000000-0000-0000-0007-000000000007', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0006-000000000003', 'What is Photosynthesis?',     'video', '00000000-0000-0000-0005-000000000003', 'Photosynthesis Basics', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000008', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0006-000000000003', 'Chlorophyll and Sunlight',    'video', '00000000-0000-0000-0005-000000000003', 'Photosynthesis Basics', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000009', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0006-000000000003', 'Glucose and Oxygen',          'video', '00000000-0000-0000-0005-000000000003', 'Photosynthesis Basics', 3, true, NOW(), NOW()),
  -- Section 4: Plant Life Cycles (Product 2)
  ('00000000-0000-0000-0007-000000000010', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0006-000000000004', 'Seed Germination',            'video', '00000000-0000-0000-0005-000000000004', 'Plant Life Cycles', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000011', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0006-000000000004', 'Pollination & Fertilisation', 'video', '00000000-0000-0000-0005-000000000004', 'Plant Life Cycles', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000012', '00000000-0000-0000-0004-000000000002', '00000000-0000-0000-0006-000000000004', 'Seed Dispersal',              'video', '00000000-0000-0000-0005-000000000004', 'Plant Life Cycles', 3, true, NOW(), NOW()),
  -- Section 5: Reading Strategies (Product 3)
  ('00000000-0000-0000-0007-000000000013', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0006-000000000005', 'Skimming & Scanning',         'video', '00000000-0000-0000-0005-000000000005', 'Reading Strategies', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000014', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0006-000000000005', 'Identifying Main Idea',       'video', '00000000-0000-0000-0005-000000000005', 'Reading Strategies', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000015', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0006-000000000005', 'Making Inferences',           'video', '00000000-0000-0000-0005-000000000005', 'Reading Strategies', 3, true, NOW(), NOW()),
  -- Section 6: Vocabulary & Grammar (Product 3)
  ('00000000-0000-0000-0007-000000000016', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0006-000000000006', 'Word Meanings in Context',    'video', '00000000-0000-0000-0005-000000000005', 'Vocabulary & Grammar', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000017', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0006-000000000006', 'Nouns and Pronouns',          'video', '00000000-0000-0000-0005-000000000005', 'Vocabulary & Grammar', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000018', '00000000-0000-0000-0004-000000000003', '00000000-0000-0000-0006-000000000006', 'Tenses — Past and Present',   'video', '00000000-0000-0000-0005-000000000005', 'Vocabulary & Grammar', 3, true, NOW(), NOW()),
  -- Section 7: Ancient Civilisations (Product 4)
  ('00000000-0000-0000-0007-000000000019', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0006-000000000007', 'Indus Valley Civilisation',   'video', '00000000-0000-0000-0005-000000000006', 'Ancient Civilisations', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000020', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0006-000000000007', 'Vedic Age',                   'video', '00000000-0000-0000-0005-000000000006', 'Ancient Civilisations', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000021', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0006-000000000007', 'Maurya Empire',               'video', '00000000-0000-0000-0005-000000000006', 'Ancient Civilisations', 3, true, NOW(), NOW()),
  -- Section 8: Freedom Movement (Product 4)
  ('00000000-0000-0000-0007-000000000022', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0006-000000000008', '1857 — First War of Independence', 'video', '00000000-0000-0000-0005-000000000006', 'Freedom Movement', 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000023', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0006-000000000008', 'Gandhiji and Non-cooperation', 'video', '00000000-0000-0000-0005-000000000006', 'Freedom Movement', 2, true, NOW(), NOW()),
  ('00000000-0000-0000-0007-000000000024', '00000000-0000-0000-0004-000000000004', '00000000-0000-0000-0006-000000000008', 'Independence and Partition',  'video', '00000000-0000-0000-0005-000000000006', 'Freedom Movement', 3, true, NOW(), NOW());

-- 10. Topics (48 rows — 2 per lesson, topic_type: 'text')
INSERT INTO topics (id, lesson_id, product_id, section_id, title, topic_type, sort_order, is_published, created_at, updated_at) VALUES
  -- Lesson 1
  ('00000000-0000-0000-0008-000000000001','00000000-0000-0000-0007-000000000001','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000001','Parts of a Fraction — Explanation','text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000002','00000000-0000-0000-0007-000000000001','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000001','Practice: Identify Fractions',      'text',2,true,NOW(),NOW()),
  -- Lesson 2
  ('00000000-0000-0000-0008-000000000003','00000000-0000-0000-0007-000000000002','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000001','Numerator vs Denominator Quiz',     'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000004','00000000-0000-0000-0007-000000000002','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000001','Drawing Fractions Activity',        'text',2,true,NOW(),NOW()),
  -- Lesson 3
  ('00000000-0000-0000-0008-000000000005','00000000-0000-0000-0007-000000000003','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000001','Finding Equivalent Fractions',      'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000006','00000000-0000-0000-0007-000000000003','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000001','Simplifying Fractions',             'text',2,true,NOW(),NOW()),
  -- Lesson 4
  ('00000000-0000-0000-0008-000000000007','00000000-0000-0000-0007-000000000004','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000002','Adding Like Fractions',             'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000008','00000000-0000-0000-0007-000000000004','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000002','Adding Unlike Fractions',           'text',2,true,NOW(),NOW()),
  -- Lesson 5
  ('00000000-0000-0000-0008-000000000009','00000000-0000-0000-0007-000000000005','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000002','Subtracting Like Fractions',        'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000010','00000000-0000-0000-0007-000000000005','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000002','Subtracting Unlike Fractions',      'text',2,true,NOW(),NOW()),
  -- Lesson 6
  ('00000000-0000-0000-0008-000000000011','00000000-0000-0000-0007-000000000006','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000002','Converting Fractions to Decimals',  'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000012','00000000-0000-0000-0007-000000000006','00000000-0000-0000-0004-000000000001','00000000-0000-0000-0006-000000000002','Decimals on a Number Line',         'text',2,true,NOW(),NOW()),
  -- Lesson 7
  ('00000000-0000-0000-0008-000000000013','00000000-0000-0000-0007-000000000007','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000003','Definition of Photosynthesis',      'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000014','00000000-0000-0000-0007-000000000007','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000003','Inputs and Outputs',                'text',2,true,NOW(),NOW()),
  -- Lesson 8
  ('00000000-0000-0000-0008-000000000015','00000000-0000-0000-0007-000000000008','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000003','Role of Chlorophyll',               'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000016','00000000-0000-0000-0007-000000000008','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000003','Sunlight as Energy Source',         'text',2,true,NOW(),NOW()),
  -- Lesson 9
  ('00000000-0000-0000-0008-000000000017','00000000-0000-0000-0007-000000000009','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000003','Glucose — Food for Plants',         'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000018','00000000-0000-0000-0007-000000000009','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000003','Oxygen Release Explained',          'text',2,true,NOW(),NOW()),
  -- Lesson 10
  ('00000000-0000-0000-0008-000000000019','00000000-0000-0000-0007-000000000010','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000004','Conditions for Germination',        'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000020','00000000-0000-0000-0007-000000000010','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000004','Stages of Seed Germination',        'text',2,true,NOW(),NOW()),
  -- Lesson 11
  ('00000000-0000-0000-0008-000000000021','00000000-0000-0000-0007-000000000011','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000004','How Pollination Happens',           'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000022','00000000-0000-0000-0007-000000000011','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000004','Fertilisation in Plants',           'text',2,true,NOW(),NOW()),
  -- Lesson 12
  ('00000000-0000-0000-0008-000000000023','00000000-0000-0000-0007-000000000012','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000004','Types of Seed Dispersal',           'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000024','00000000-0000-0000-0007-000000000012','00000000-0000-0000-0004-000000000002','00000000-0000-0000-0006-000000000004','Animals and Wind Dispersal',        'text',2,true,NOW(),NOW()),
  -- Lesson 13
  ('00000000-0000-0000-0008-000000000025','00000000-0000-0000-0007-000000000013','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000005','What is Skimming?',                 'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000026','00000000-0000-0000-0007-000000000013','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000005','What is Scanning?',                 'text',2,true,NOW(),NOW()),
  -- Lesson 14
  ('00000000-0000-0000-0008-000000000027','00000000-0000-0000-0007-000000000014','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000005','Finding the Topic Sentence',        'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000028','00000000-0000-0000-0007-000000000014','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000005','Summarising a Passage',             'text',2,true,NOW(),NOW()),
  -- Lesson 15
  ('00000000-0000-0000-0008-000000000029','00000000-0000-0000-0007-000000000015','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000005','Clues in Context',                  'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000030','00000000-0000-0000-0007-000000000015','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000005','Drawing Conclusions',               'text',2,true,NOW(),NOW()),
  -- Lesson 16
  ('00000000-0000-0000-0008-000000000031','00000000-0000-0000-0007-000000000016','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000006','Using a Dictionary',                'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000032','00000000-0000-0000-0007-000000000016','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000006','Synonyms and Antonyms',             'text',2,true,NOW(),NOW()),
  -- Lesson 17
  ('00000000-0000-0000-0008-000000000033','00000000-0000-0000-0007-000000000017','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000006','Types of Nouns',                    'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000034','00000000-0000-0000-0007-000000000017','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000006','Personal Pronouns',                 'text',2,true,NOW(),NOW()),
  -- Lesson 18
  ('00000000-0000-0000-0008-000000000035','00000000-0000-0000-0007-000000000018','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000006','Simple Past Tense',                 'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000036','00000000-0000-0000-0007-000000000018','00000000-0000-0000-0004-000000000003','00000000-0000-0000-0006-000000000006','Simple Present Tense',              'text',2,true,NOW(),NOW()),
  -- Lesson 19
  ('00000000-0000-0000-0008-000000000037','00000000-0000-0000-0007-000000000019','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000007','Harappa and Mohenjo-daro',          'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000038','00000000-0000-0000-0007-000000000019','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000007','Urban Planning in Ancient India',   'text',2,true,NOW(),NOW()),
  -- Lesson 20
  ('00000000-0000-0000-0008-000000000039','00000000-0000-0000-0007-000000000020','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000007','The Rig Veda',                      'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000040','00000000-0000-0000-0007-000000000020','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000007','Society in the Vedic Age',          'text',2,true,NOW(),NOW()),
  -- Lesson 21
  ('00000000-0000-0000-0008-000000000041','00000000-0000-0000-0007-000000000021','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000007','Chandragupta Maurya',               'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000042','00000000-0000-0000-0007-000000000021','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000007','Ashoka the Great',                  'text',2,true,NOW(),NOW()),
  -- Lesson 22
  ('00000000-0000-0000-0008-000000000043','00000000-0000-0000-0007-000000000022','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000008','Causes of the 1857 Uprising',       'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000044','00000000-0000-0000-0007-000000000022','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000008','Key Leaders of 1857',               'text',2,true,NOW(),NOW()),
  -- Lesson 23
  ('00000000-0000-0000-0008-000000000045','00000000-0000-0000-0007-000000000023','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000008','Salt Satyagraha',                   'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000046','00000000-0000-0000-0007-000000000023','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000008','Quit India Movement',               'text',2,true,NOW(),NOW()),
  -- Lesson 24
  ('00000000-0000-0000-0008-000000000047','00000000-0000-0000-0007-000000000024','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000008','15 August 1947',                    'text',1,true,NOW(),NOW()),
  ('00000000-0000-0000-0008-000000000048','00000000-0000-0000-0007-000000000024','00000000-0000-0000-0004-000000000004','00000000-0000-0000-0006-000000000008','The Partition of India',            'text',2,true,NOW(),NOW());

-- 11. Quizzes (4 rows — 1 per product)
INSERT INTO quizzes (id, product_id, title, passing_percentage, sort_order, is_published, created_at, updated_at) VALUES
  ('00000000-0000-0000-0009-000000000001', '00000000-0000-0000-0004-000000000001', 'Fractions & Decimals Quiz',      80, 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0009-000000000002', '00000000-0000-0000-0004-000000000002', 'Plants & Photosynthesis Quiz',    80, 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0009-000000000003', '00000000-0000-0000-0004-000000000003', 'Reading & Comprehension Quiz',   80, 1, true, NOW(), NOW()),
  ('00000000-0000-0000-0009-000000000004', '00000000-0000-0000-0004-000000000004', 'History of India Quiz',          80, 1, true, NOW(), NOW());

-- 12. Quiz Questions (12 rows — 3 per quiz)
INSERT INTO quiz_questions (id, quiz_id, question_text, question_type, points, sort_order, created_at, updated_at) VALUES
  -- Quiz 1: Fractions
  ('00000000-0000-0000-000a-000000000001','00000000-0000-0000-0009-000000000001','In the fraction 3/4, what is the denominator?',                    'single',1,1,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000002','00000000-0000-0000-0009-000000000001','Which of the following is equivalent to 1/2?',                    'single',1,2,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000003','00000000-0000-0000-0009-000000000001','What is 1/4 + 2/4?',                                              'single',1,3,NOW(),NOW()),
  -- Quiz 2: Science
  ('00000000-0000-0000-000a-000000000004','00000000-0000-0000-0009-000000000002','What is the green pigment in plants called?',                     'single',1,1,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000005','00000000-0000-0000-0009-000000000002','Which gas do plants release during photosynthesis?',              'single',1,2,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000006','00000000-0000-0000-0009-000000000002','What do seeds need to germinate?',                               'single',1,3,NOW(),NOW()),
  -- Quiz 3: Reading
  ('00000000-0000-0000-000a-000000000007','00000000-0000-0000-0009-000000000003','What is the purpose of skimming a text?',                         'single',1,1,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000008','00000000-0000-0000-0009-000000000003','A sentence that states the main idea of a paragraph is called a?','single',1,2,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000009','00000000-0000-0000-0009-000000000003','Which tense describes actions happening now?',                    'single',1,3,NOW(),NOW()),
  -- Quiz 4: History
  ('00000000-0000-0000-000a-000000000010','00000000-0000-0000-0009-000000000004','Where was the Indus Valley Civilisation located?',                'single',1,1,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000011','00000000-0000-0000-0009-000000000004','Who led the Dandi March in 1930?',                               'single',1,2,NOW(),NOW()),
  ('00000000-0000-0000-000a-000000000012','00000000-0000-0000-0009-000000000004','India gained independence in which year?',                        'single',1,3,NOW(),NOW());

-- 13. Quiz Question Options (48 rows — 4 per question, first option is correct)
INSERT INTO quiz_question_options (id, question_id, option_text, is_correct, sort_order, created_at) VALUES
  -- Q1
  ('00000000-0000-0000-000b-000000000001','00000000-0000-0000-000a-000000000001','4',    true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000002','00000000-0000-0000-000a-000000000001','3',    false,2,NOW()),
  ('00000000-0000-0000-000b-000000000003','00000000-0000-0000-000a-000000000001','7',    false,3,NOW()),
  ('00000000-0000-0000-000b-000000000004','00000000-0000-0000-000a-000000000001','1',    false,4,NOW()),
  -- Q2
  ('00000000-0000-0000-000b-000000000005','00000000-0000-0000-000a-000000000002','2/4',  true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000006','00000000-0000-0000-000a-000000000002','1/3',  false,2,NOW()),
  ('00000000-0000-0000-000b-000000000007','00000000-0000-0000-000a-000000000002','3/4',  false,3,NOW()),
  ('00000000-0000-0000-000b-000000000008','00000000-0000-0000-000a-000000000002','1/4',  false,4,NOW()),
  -- Q3
  ('00000000-0000-0000-000b-000000000009','00000000-0000-0000-000a-000000000003','3/4',  true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000010','00000000-0000-0000-000a-000000000003','1/4',  false,2,NOW()),
  ('00000000-0000-0000-000b-000000000011','00000000-0000-0000-000a-000000000003','2/4',  false,3,NOW()),
  ('00000000-0000-0000-000b-000000000012','00000000-0000-0000-000a-000000000003','4/4',  false,4,NOW()),
  -- Q4
  ('00000000-0000-0000-000b-000000000013','00000000-0000-0000-000a-000000000004','Chlorophyll',  true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000014','00000000-0000-0000-000a-000000000004','Carotene',     false,2,NOW()),
  ('00000000-0000-0000-000b-000000000015','00000000-0000-0000-000a-000000000004','Anthocyanin',  false,3,NOW()),
  ('00000000-0000-0000-000b-000000000016','00000000-0000-0000-000a-000000000004','Melanin',      false,4,NOW()),
  -- Q5
  ('00000000-0000-0000-000b-000000000017','00000000-0000-0000-000a-000000000005','Oxygen',       true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000018','00000000-0000-0000-000a-000000000005','Carbon dioxide',false,2,NOW()),
  ('00000000-0000-0000-000b-000000000019','00000000-0000-0000-000a-000000000005','Nitrogen',     false,3,NOW()),
  ('00000000-0000-0000-000b-000000000020','00000000-0000-0000-000a-000000000005','Hydrogen',     false,4,NOW()),
  -- Q6
  ('00000000-0000-0000-000b-000000000021','00000000-0000-0000-000a-000000000006','Water, air, warmth',  true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000022','00000000-0000-0000-000a-000000000006','Only sunlight',       false,2,NOW()),
  ('00000000-0000-0000-000b-000000000023','00000000-0000-0000-000a-000000000006','Fertiliser only',     false,3,NOW()),
  ('00000000-0000-0000-000b-000000000024','00000000-0000-0000-000a-000000000006','Salt and sugar',      false,4,NOW()),
  -- Q7
  ('00000000-0000-0000-000b-000000000025','00000000-0000-0000-000a-000000000007','To get a quick overview', true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000026','00000000-0000-0000-000a-000000000007','To read every word',      false,2,NOW()),
  ('00000000-0000-0000-000b-000000000027','00000000-0000-0000-000a-000000000007','To memorise the text',    false,3,NOW()),
  ('00000000-0000-0000-000b-000000000028','00000000-0000-0000-000a-000000000007','To rewrite the text',     false,4,NOW()),
  -- Q8
  ('00000000-0000-0000-000b-000000000029','00000000-0000-0000-000a-000000000008','Topic sentence',    true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000030','00000000-0000-0000-000a-000000000008','Supporting detail', false,2,NOW()),
  ('00000000-0000-0000-000b-000000000031','00000000-0000-0000-000a-000000000008','Conclusion',        false,3,NOW()),
  ('00000000-0000-0000-000b-000000000032','00000000-0000-0000-000a-000000000008','Introduction',      false,4,NOW()),
  -- Q9
  ('00000000-0000-0000-000b-000000000033','00000000-0000-0000-000a-000000000009','Simple present',   true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000034','00000000-0000-0000-000a-000000000009','Simple past',      false,2,NOW()),
  ('00000000-0000-0000-000b-000000000035','00000000-0000-0000-000a-000000000009','Future tense',     false,3,NOW()),
  ('00000000-0000-0000-000b-000000000036','00000000-0000-0000-000a-000000000009','Perfect tense',    false,4,NOW()),
  -- Q10
  ('00000000-0000-0000-000b-000000000037','00000000-0000-0000-000a-000000000010','Present-day Pakistan and northwest India', true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000038','00000000-0000-0000-000a-000000000010','South India',                              false,2,NOW()),
  ('00000000-0000-0000-000b-000000000039','00000000-0000-0000-000a-000000000010','Northeast India',                          false,3,NOW()),
  ('00000000-0000-0000-000b-000000000040','00000000-0000-0000-000a-000000000010','Sri Lanka',                                false,4,NOW()),
  -- Q11
  ('00000000-0000-0000-000b-000000000041','00000000-0000-0000-000a-000000000011','Mahatma Gandhi',   true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000042','00000000-0000-0000-000a-000000000011','Nehru',            false,2,NOW()),
  ('00000000-0000-0000-000b-000000000043','00000000-0000-0000-000a-000000000011','Tilak',            false,3,NOW()),
  ('00000000-0000-0000-000b-000000000044','00000000-0000-0000-000a-000000000011','Bose',             false,4,NOW()),
  -- Q12
  ('00000000-0000-0000-000b-000000000045','00000000-0000-0000-000a-000000000012','1947',  true, 1,NOW()),
  ('00000000-0000-0000-000b-000000000046','00000000-0000-0000-000a-000000000012','1942',  false,2,NOW()),
  ('00000000-0000-0000-000b-000000000047','00000000-0000-0000-000a-000000000012','1950',  false,3,NOW()),
  ('00000000-0000-0000-000b-000000000048','00000000-0000-0000-000a-000000000012','1935',  false,4,NOW());

-- 14. Coupons (2 rows)
INSERT INTO coupons (id, code, name, description, discount_type, discount_value, currency, validity_type, is_active, created_at, updated_at) VALUES
  ('00000000-0000-0000-000c-000000000001',
   'WELCOME50', 'Welcome 50% Off',
   'Get 50% off your first month on VidyaSetu Standard or Premium.',
   'percentage', 50, 'inr', 'one_time', true, NOW(), NOW()),

  ('00000000-0000-0000-000c-000000000002',
   'FREEMONTH', 'One Free Month',
   'Claim one free trial month on any VidyaSetu plan.',
   'free_trial', 0, 'inr', 'one_time', true, NOW(), NOW());

-- 15. Posts (3 rows — all published, author = admin)
INSERT INTO posts (id, title, slug, content, excerpt, author_id, is_published, published_at, created_at, updated_at) VALUES
  ('00000000-0000-0000-000d-000000000001',
   'Welcome to VidyaSetu!',
   'welcome-to-vidyasetu',
   '<p>VidyaSetu is India''s AI-powered multilingual learning portal designed for students in rural India. Learn NCERT curriculum in Hindi, Telugu, and English with an intelligent AI tutor available 24/7.</p>',
   'Discover how VidyaSetu brings quality NCERT education to every child in rural India.',
   '00000000-0000-0000-0000-000000000001',
   true, NOW(), NOW(), NOW()),

  ('00000000-0000-0000-000d-000000000002',
   'New NCERT Class 5 Science Course Launched',
   'new-class-5-science-course',
   '<p>We are excited to announce the launch of our Plants &amp; Photosynthesis course covering the full NCERT Class 5 Science syllabus. Learn how plants make food, about life cycles, and more — all explained by our Science AI tutor in your preferred language.</p>',
   'Our new Class 5 Science course on Plants & Photosynthesis is now live on VidyaSetu.',
   '00000000-0000-0000-0000-000000000001',
   true, NOW(), NOW(), NOW()),

  ('00000000-0000-0000-000d-000000000003',
   'How to Study in Hindi Using VidyaSetu AI Tutor',
   'learn-hindi-ai-tutor',
   '<p>VidyaSetu''s AI tutor supports Hindi, Telugu, and English. Students can ask questions in their mother tongue and receive clear, simple explanations aligned with the NCERT curriculum. Here is how to get started.</p>',
   'A step-by-step guide to using VidyaSetu''s AI tutor in Hindi for NCERT subjects.',
   '00000000-0000-0000-0000-000000000001',
   true, NOW(), NOW(), NOW());

-- 16. Post Categories (3 rows — one per post)
INSERT INTO post_categories (post_id, category_id) VALUES
  ('00000000-0000-0000-000d-000000000001', '00000000-0000-0000-0001-000000000001'), -- Welcome → Mathematics
  ('00000000-0000-0000-000d-000000000002', '00000000-0000-0000-0001-000000000002'), -- Science post → Science
  ('00000000-0000-0000-000d-000000000003', '00000000-0000-0000-0001-000000000005'); -- Hindi post → Languages

-- 17. Post Tags (6 rows — 2 per post)
INSERT INTO post_tags (post_id, tag_id) VALUES
  ('00000000-0000-0000-000d-000000000001', '00000000-0000-0000-0002-000000000001'), -- Welcome → ncert
  ('00000000-0000-0000-000d-000000000001', '00000000-0000-0000-0002-000000000006'), -- Welcome → free
  ('00000000-0000-0000-000d-000000000002', '00000000-0000-0000-0002-000000000001'), -- Science → ncert
  ('00000000-0000-0000-000d-000000000002', '00000000-0000-0000-0002-000000000002'), -- Science → class-5
  ('00000000-0000-0000-000d-000000000003', '00000000-0000-0000-0002-000000000004'), -- Hindi → hindi
  ('00000000-0000-0000-000d-000000000003', '00000000-0000-0000-0002-000000000007'); -- Hindi → beginner

-- End of init-dummy-db.sql
