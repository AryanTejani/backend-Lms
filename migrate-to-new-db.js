/**
 * SureCart Database Migration Script
 *
 * Migrates SureCart CSV exports and WordPress users to normalized PostgreSQL schema v2.0
 *
 * Usage:
 *   node migrate-to-new-db.js           # Run all phases
 *   node migrate-to-new-db.js products  # Run specific phase
 *   DRY_RUN=true node migrate-to-new-db.js  # Dry run mode
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// ============================================
// CONFIGURATION
// ============================================

const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME || 'surecart_normalized_v2',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
  },
  migration: {
    dryRun: process.env.DRY_RUN === 'true',
    batchSize: parseInt(process.env.BATCH_SIZE) || 100,
    skipSchemaSetup: process.env.SKIP_SCHEMA_SETUP === 'true',
  },
  csvDir: process.env.CSV_DIR || '../',
};

const pool = new Pool(config.db);

// ============================================
// LOGGING UTILITIES
// ============================================

const log = {
  info: (msg) => console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`),
  warn: (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`),
  error: (msg) => console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`),
  dry: (msg) => console.log(`\x1b[35m[DRY-RUN]\x1b[0m ${msg}`),
  phase: (msg) => console.log(`\n\x1b[1m\x1b[34m========== ${msg} ==========\x1b[0m\n`),
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Parse CSV file and return array of records
 */
function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    const fullPath = path.join(config.csvDir, filePath);

    if (!fs.existsSync(fullPath)) {
      return reject(new Error(`CSV file not found: ${fullPath}`));
    }

    fs.createReadStream(fullPath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

/**
 * Validate UUID format
 */
function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Parse timestamp from SureCart format
 */
function parseTimestamp(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
}

/**
 * Convert dollar amount to cents
 */
function dollarsToCents(amount) {
  if (!amount || amount === '') return 0;
  return Math.round(parseFloat(amount) * 100);
}

/**
 * Detect product content type from name/description
 */
function detectContentType(name, description) {
  const text = `${name} ${description}`.toLowerCase();

  if (text.includes('masterclass') || text.includes('master class')) {
    return 'master_class';
  } else if (text.includes('bundle') || text.includes('package')) {
    return 'bundle';
  } else if (text.includes('course') || text.includes('training')) {
    return 'course';
  }

  return 'course'; // default
}

/**
 * Fix malformed JSON metadata from CSV export
 * Converts {key: ""value""} to {"key": "value"}
 */
function fixMetadataJson(metadata) {
  if (!metadata || metadata.trim() === '' || metadata === '{}') {
    return '{}';
  }

  try {
    // First, try to parse as-is (maybe it's valid JSON)
    JSON.parse(metadata);
    return metadata;
  } catch {
    // Fix common issues from CSV export:
    // 1. Unquoted keys: {page_id: "value"} -> {"page_id": "value"}
    // 2. Double-double quotes: ""value"" -> "value"
    let fixed = metadata
      .replace(/""/g, '"')  // Fix double-double quotes first
      .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // Quote unquoted keys

    try {
      JSON.parse(fixed);
      return fixed;
    } catch {
      // If still invalid, return empty object
      return '{}';
    }
  }
}

/**
 * Batch process array
 */
async function processBatch(items, batchSize, processor) {
  const results = {
    processed: 0,
    errors: [],
  };

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    log.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

    for (const item of batch) {
      try {
        await processor(item);
        results.processed++;
      } catch (err) {
        results.errors.push({ item, error: err.message });
        log.error(`Error processing item: ${err.message}`);
      }
    }

    // Rate limiting pause between batches
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return results;
}

// ============================================
// PHASE 1: SCHEMA SETUP
// ============================================

async function setupSchema() {
  log.phase('PHASE 1: SCHEMA SETUP');

  if (config.migration.skipSchemaSetup) {
    log.info('Skipping schema setup (SKIP_SCHEMA_SETUP=true)');
    return;
  }

  const schemaPath = path.join(config.csvDir, 'schema.sql');

  if (!fs.existsSync(schemaPath)) {
    throw new Error(`Schema file not found: ${schemaPath}`);
  }

  log.info('Reading schema.sql...');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  if (config.migration.dryRun) {
    log.dry('Would execute schema.sql');
    return;
  }

  log.info('Executing schema.sql...');
  await pool.query(schema);
  log.success('Schema created successfully');

  // Verify tables
  const { rows: tables } = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);

  log.success(`Created ${tables.length} tables: ${tables.map(t => t.table_name).join(', ')}`);
}

// ============================================
// PHASE 2: PRODUCTS MIGRATION
// ============================================

async function migrateProducts() {
  log.phase('PHASE 2: PRODUCTS MIGRATION');

  log.info('Parsing prices_1769186945.csv...');
  const prices = await parseCSV('prices_1769186945.csv');
  log.info(`Found ${prices.length} products to migrate`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const price of prices) {
    try {
      // Skip if product already has Stripe ID (already migrated)
      const existing = await pool.query(
        `SELECT id FROM products WHERE surecart_price_id = $1`,
        [price.ID]
      );

      if (existing.rows.length > 0) {
        log.info(`Skipping ${price.Name} - already exists`);
        skipped++;
        continue;
      }

      if (config.migration.dryRun) {
        log.dry(`Would create product: ${price.Name} (${price['Product Name']})`);
        created++;
        continue;
      }

      // Determine content type
      const contentType = detectContentType(
        price['Product Name'] || '',
        price['Product Description'] || ''
      );

      // Insert product
      await pool.query(`
        INSERT INTO products (
          surecart_price_id,
          surecart_product_id,
          product_name,
          product_slug,
          product_description,
          content_type,
          amount_cents,
          currency,
          is_recurring,
          recurring_interval,
          recurring_interval_count,
          trial_days,
          is_active,
          is_archived,
          requires_shipping,
          track_inventory,
          stock_quantity,
          allow_out_of_stock,
          tax_enabled,
          metadata,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22
        )
      `, [
        price.ID,
        price.Product, // SureCart Product ID (different from Price ID)
        price['Product Name'] || price.Name,
        (price['Product Name'] || price.Name).toLowerCase().replace(/\s+/g, '-'),
        price['Product Description'] || '',
        contentType,
        parseInt(price.Amount) || 0,
        'usd',
        !!(price['Recurring Interval'] && price['Recurring Interval'] !== ''),
        price['Recurring Interval'] || null,
        parseInt(price['Recurring Interval Count']) || null,
        parseInt(price['Trial Duration (Days)']) || 0,
        price.Archived !== 'true',
        price.Archived === 'true',
        false, // Digital products don't require shipping
        false, // Digital products don't track inventory
        null,  // No stock quantity
        false, // No out of stock purchases
        price['Tax Enabled'] === 'true',
        JSON.stringify({
          revoke_after_days: price['Revoke After Days'] || null,
          ad_hoc: price['Ad Hoc'] === 'true',
        }),
        parseTimestamp(price.Created),
        parseTimestamp(price.Updated),
      ]);

      log.success(`Created product: ${price['Product Name'] || price.Name}`);
      created++;

    } catch (err) {
      log.error(`Failed to migrate product ${price.Name}: ${err.message}`);
      errors++;
    }
  }

  // Add missing products that exist in orders but not in prices CSV
  // These are past Annual Trading Conference products
  const missingProducts = [
    { id: '0e5be6fb-07f7-4c36-9a37-4158c166cac7', name: '2022: Annual Trading Conference' },
    { id: '30f9d642-7c6d-408b-a1b9-67e6eb090453', name: '2021: Annual Trading Conference' },
    { id: 'c295f928-2da6-4f37-847e-8779f6c4cced', name: '2023: Annual Trading Conference' },
  ];

  log.info('\nAdding missing products from orders...');
  for (const product of missingProducts) {
    try {
      // Check if product already exists
      const existing = await pool.query(
        `SELECT id FROM products WHERE surecart_product_id = $1`,
        [product.id]
      );

      if (existing.rows.length === 0) {
        await pool.query(`
          INSERT INTO products (
            surecart_product_id,
            product_name,
            product_slug,
            content_type,
            amount_cents,
            currency,
            is_recurring,
            is_active,
            is_archived
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
          product.id,
          product.name,
          product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          'course',
          0,          // Price unknown - set to 0
          'usd',
          false,      // One-time event
          false,      // Archived (past events)
          true,
        ]);
        log.success(`Added missing product: ${product.name}`);
        created++;
      } else {
        log.info(`Product already exists: ${product.name}`);
      }
    } catch (err) {
      log.error(`Failed to add missing product ${product.name}: ${err.message}`);
      errors++;
    }
  }

  log.info(`\nProducts migration complete: ${created} created, ${skipped} skipped, ${errors} errors`);
  return { created, skipped, errors };
}

// ============================================
// PHASE 3: CUSTOMERS MIGRATION
// ============================================

async function migrateCustomers() {
  log.phase('PHASE 3: CUSTOMERS MIGRATION');

  log.info('Parsing customers_1769186938.csv...');
  const surecartCustomers = await parseCSV('customers_1769186938.csv');
  log.info(`Found ${surecartCustomers.length} SureCart customers`);

  log.info('Parsing wp_users.csv...');
  const wpUsers = await parseCSV('wp_users.csv');
  log.info(`Found ${wpUsers.length} WordPress users`);

  // Create email-based map for merging
  log.info('Merging customers and WordPress users by email...');
  const customerMap = new Map();

  // First, add all SureCart customers
  for (const customer of surecartCustomers) {
    if (!customer.Email) continue;

    customerMap.set(customer.Email.toLowerCase(), {
      surecart_id: customer.ID,
      email: customer.Email,
      first_name: customer['First Name'] || null,
      last_name: customer['Last Name'] || null,
      phone: customer.Phone || null,
      tax_identifier: customer['Tax Identifier'] || null,
      tax_identifier_type: customer['Tax Identifier Type'] || null,
      stripe_customer_id: customer['Stripe Customer ID'] || null,
      is_live_mode: customer['Live Mode'] === 'true',
      billing_line1: customer['Billing Line 1'] || null,
      billing_line2: customer['Billing Line 2'] || null,
      billing_city: customer['Billing City'] || null,
      billing_state: customer['Billing State'] || null,
      billing_postal_code: customer['Billing Postal Code'] || null,
      billing_country: customer['Billing Country'] || null,
      shipping_line1: customer['Shipping Line 1'] || null,
      shipping_line2: customer['Shipping Line 2'] || null,
      shipping_city: customer['Shipping City'] || null,
      shipping_state: customer['Shipping State'] || null,
      shipping_postal_code: customer['Shipping Postal Code'] || null,
      shipping_country: customer['Shipping Country'] || null,
      created_at: parseTimestamp(customer.Created),
      updated_at: parseTimestamp(customer.Updated),
      password_hash: null,
      user_nicename: null,
    });
  }

  // Merge WordPress users
  for (const wpUser of wpUsers) {
    if (!wpUser.user_email) continue;

    const email = wpUser.user_email.toLowerCase();

    if (customerMap.has(email)) {
      // Merge: add password and nicename
      const customer = customerMap.get(email);
      customer.password_hash = wpUser.user_pass;
      customer.user_nicename = wpUser.user_nicename || wpUser.user_login;
    } else {
      // Create new customer from WordPress user
      customerMap.set(email, {
        surecart_id: null,
        email: wpUser.user_email,
        first_name: wpUser.display_name?.split(' ')[0] || null,
        last_name: wpUser.display_name?.split(' ').slice(1).join(' ') || null,
        phone: null,
        tax_identifier: null,
        tax_identifier_type: null,
        stripe_customer_id: null,
        is_live_mode: true, // WordPress users default to live mode
        billing_line1: null,
        billing_line2: null,
        billing_city: null,
        billing_state: null,
        billing_postal_code: null,
        billing_country: null,
        shipping_line1: null,
        shipping_line2: null,
        shipping_city: null,
        shipping_state: null,
        shipping_postal_code: null,
        shipping_country: null,
        created_at: parseTimestamp(wpUser.user_registered),
        updated_at: parseTimestamp(wpUser.user_registered),
        password_hash: wpUser.user_pass,
        user_nicename: wpUser.user_nicename || wpUser.user_login,
      });
    }
  }

  log.info(`Merged into ${customerMap.size} unique customers`);

  // Insert customers
  let created = 0;
  let errors = 0;
  const customerIds = new Map(); // email -> uuid for address linkage

  for (const [email, customer] of customerMap) {
    try {
      if (config.migration.dryRun) {
        log.dry(`Would create customer: ${email}`);
        created++;
        continue;
      }

      // Insert customer
      const result = await pool.query(`
        INSERT INTO customers (
          surecart_id,
          email,
          password_hash,
          first_name,
          last_name,
          user_nicename,
          phone,
          tax_identifier,
          tax_identifier_type,
          stripe_customer_id,
          is_live_mode,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id
      `, [
        customer.surecart_id,
        customer.email,
        customer.password_hash,
        customer.first_name,
        customer.last_name,
        customer.user_nicename,
        customer.phone,
        customer.tax_identifier,
        customer.tax_identifier_type,
        customer.stripe_customer_id,
        customer.is_live_mode,
        customer.created_at,
        customer.updated_at,
      ]);

      const customerId = result.rows[0].id;
      customerIds.set(email.toLowerCase(), customerId);

      // Insert billing address if exists
      if (customer.billing_line1) {
        await pool.query(`
          INSERT INTO customer_addresses (
            customer_id, address_type, line_1, line_2, city, state, postal_code, country
          ) VALUES ($1, 'billing', $2, $3, $4, $5, $6, $7)
        `, [
          customerId,
          customer.billing_line1,
          customer.billing_line2,
          customer.billing_city,
          customer.billing_state,
          customer.billing_postal_code,
          customer.billing_country,
        ]);
      }

      // Insert shipping address if exists and different from billing
      if (customer.shipping_line1 && customer.shipping_line1 !== customer.billing_line1) {
        await pool.query(`
          INSERT INTO customer_addresses (
            customer_id, address_type, line_1, line_2, city, state, postal_code, country
          ) VALUES ($1, 'shipping', $2, $3, $4, $5, $6, $7)
        `, [
          customerId,
          customer.shipping_line1,
          customer.shipping_line2,
          customer.shipping_city,
          customer.shipping_state,
          customer.shipping_postal_code,
          customer.shipping_country,
        ]);
      }

      created++;

      if (created % 1000 === 0) {
        log.info(`Progress: ${created}/${customerMap.size} customers created...`);
      }

    } catch (err) {
      log.error(`Failed to migrate customer ${email}: ${err.message}`);
      errors++;
    }
  }

  // Save customer IDs to global for later phases
  global.customerIdsByEmail = customerIds;
  global.customerIdsBySurecartId = new Map();

  for (const [email, customer] of customerMap) {
    if (customer.surecart_id && customerIds.has(email.toLowerCase())) {
      global.customerIdsBySurecartId.set(customer.surecart_id, customerIds.get(email.toLowerCase()));
    }
  }

  log.info(`\nCustomers migration complete: ${created} created, ${errors} errors`);
  return { created, errors };
}

// ============================================
// PHASE 4: ORDERS MIGRATION
// ============================================

async function migrateOrders() {
  log.phase('PHASE 4: ORDERS MIGRATION');

  log.info('Parsing orders_1769188284.csv...');
  const orders = await parseCSV('orders_1769188284.csv');
  log.info(`Found ${orders.length} orders to migrate`);

  let created = 0;
  let errors = 0;
  const couponCache = new Map(); // coupon name -> id

  for (const order of orders) {
    try {
      // Lookup customer
      const customerEmail = order.Email?.toLowerCase()?.trim();
      const surecartCustomerId = order.Customer;

      let customerId = null;

      // First try global cache
      if (customerEmail && global.customerIdsByEmail) {
        customerId = global.customerIdsByEmail.get(customerEmail);
      }
      if (!customerId && surecartCustomerId && global.customerIdsBySurecartId) {
        customerId = global.customerIdsBySurecartId.get(surecartCustomerId);
      }

      // Fallback to database query (for individual phase runs)
      if (!customerId && customerEmail) {
        const customerResult = await pool.query(
          `SELECT id FROM customers WHERE LOWER(email) = $1`,
          [customerEmail]
        );
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].id;
        }
      }
      if (!customerId && surecartCustomerId) {
        const customerResult = await pool.query(
          `SELECT id FROM customers WHERE surecart_id = $1`,
          [surecartCustomerId]
        );
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].id;
        }
      }

      if (!customerId) {
        log.warn(`Skipping order ${order.ID} - customer not found (${customerEmail || surecartCustomerId})`);
        errors++;
        continue;
      }

      if (config.migration.dryRun) {
        log.dry(`Would create order: ${order.Number}`);
        created++;
        continue;
      }

      // Handle coupon
      let couponId = null;
      if (order['Coupon Name']) {
        if (couponCache.has(order['Coupon Name'])) {
          couponId = couponCache.get(order['Coupon Name']);
        } else {
          // Check if coupon exists
          const existingCoupon = await pool.query(
            `SELECT id FROM coupons WHERE name = $1`,
            [order['Coupon Name']]
          );

          if (existingCoupon.rows.length > 0) {
            couponId = existingCoupon.rows[0].id;
          } else {
            // Create coupon
            const newCoupon = await pool.query(`
              INSERT INTO coupons (
                code, name, discount_type, discount_value, validity_type, is_active
              ) VALUES ($1, $2, $3, $4, $5, $6)
              RETURNING id
            `, [
              `${order['Coupon Name'].replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`,
              order['Coupon Name'],
              'fixed_amount',
              dollarsToCents(order['Discount Amount']) || 0,
              'one_time',
              false, // Historical coupons are archived
            ]);
            couponId = newCoupon.rows[0].id;
          }

          couponCache.set(order['Coupon Name'], couponId);
        }
      }

      // Billing address snapshot
      const billingSnapshot = JSON.stringify({
        line1: order['Billing Line 1'],
        line2: order['Billing Line 2'],
        city: order['Billing City'],
        state: order['Billing State'],
        postal_code: order['Billing Postal Code'],
        country: order['Billing Country'],
      });

      // Insert order
      // Calculate created_year for partitioning (must be provided to avoid trigger conflict)
      const createdAt = parseTimestamp(order.Created);
      const createdYear = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();

      const orderResult = await pool.query(`
        INSERT INTO orders (
          surecart_id,
          customer_id,
          status,
          order_type,
          order_number,
          subtotal_cents,
          discount_cents,
          tax_cents,
          total_cents,
          amount_due_cents,
          shipping_cents,
          currency,
          coupon_id,
          billing_address_snapshot,
          shipping_address_snapshot,
          invoice_url,
          metadata,
          is_live_mode,
          created_at,
          updated_at,
          paid_at,
          created_year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        RETURNING id, created_year
      `, [
        order.ID,
        customerId,
        order.Status.toLowerCase(),
        order['Order Type']?.toLowerCase() || 'checkout',
        order.Number,
        dollarsToCents(order['Subtotal Amount']),
        dollarsToCents(order['Discount Amount']),
        dollarsToCents(order['Tax Amount']),
        dollarsToCents(order['Total Amount']),
        dollarsToCents(order['Amount Due']),
        0, // Digital products - no shipping
        order.Currency || 'usd',
        couponId,
        billingSnapshot,
        null, // Digital products - no shipping address
        order['Invoice URL'] || null,
        fixMetadataJson(order.Metadata),
        order['Live Mode'] === 'true',
        createdAt,
        parseTimestamp(order.Updated),
        order.Status.toLowerCase() === 'paid' ? createdAt : null,
        createdYear,
      ]);

      const newOrderId = orderResult.rows[0].id;
      const newOrderYear = orderResult.rows[0].created_year;

      // Create order items - lookup each product's actual price
      const productIds = order['Product ID(s)']?.split(',') || [];

      for (let i = 0; i < productIds.length; i++) {
        const productId = productIds[i]?.trim();
        if (!productId) continue;

        // Lookup product by surecart_product_id AND get its price
        const product = await pool.query(
          `SELECT id, amount_cents FROM products WHERE surecart_product_id = $1`,
          [productId]
        );

        if (product.rows.length === 0) {
          log.warn(`Product not found for order item: ${productId}`);
          continue;
        }

        const productPrice = product.rows[0].amount_cents;  // Actual price from products table

        await pool.query(`
          INSERT INTO order_items (
            order_id,
            order_year,
            product_id,
            quantity,
            unit_amount_cents,
            total_cents
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          newOrderId,
          newOrderYear,
          product.rows[0].id,
          1,
          productPrice,     // Use actual product price (not divided total)
          productPrice,     // Same for total (quantity=1)
        ]);
      }

      created++;

      if (created % 1000 === 0) {
        log.info(`Progress: ${created}/${orders.length} orders created...`);
      }

    } catch (err) {
      log.error(`Failed to migrate order ${order.ID}: ${err.message}`);
      errors++;
    }
  }

  log.info(`\nOrders migration complete: ${created} created, ${errors} errors`);
  return { created, errors };
}

// ============================================
// PHASE 5: SUBSCRIPTIONS MIGRATION
// Supports dual-mode: plan-based + legacy product-based
// ============================================

async function migrateSubscriptions() {
  log.phase('PHASE 5: SUBSCRIPTIONS MIGRATION');

  log.info('Parsing subscriptions_1769186927.csv...');
  const subscriptions = await parseCSV('subscriptions_1769186927.csv');
  log.info(`Found ${subscriptions.length} subscriptions to migrate`);

  log.info('Parsing prices_1769186945.csv for price -> product mapping...');
  const prices = await parseCSV('prices_1769186945.csv');
  const priceMap = new Map();
  prices.forEach(p => priceMap.set(p.ID, p));

  let created = 0;
  let skipped = 0;
  let errors = 0;
  let withPlan = 0;
  let legacyOnly = 0;

  for (const sub of subscriptions) {
    try {
      // Lookup customer by email or surecart_id
      const customerEmail = sub['Customer Email']?.toLowerCase()?.trim();
      const surecartCustomerId = sub.Customer;

      let customerId = null;

      // First try global cache
      if (customerEmail && global.customerIdsByEmail) {
        customerId = global.customerIdsByEmail.get(customerEmail);
      }
      if (!customerId && surecartCustomerId && global.customerIdsBySurecartId) {
        customerId = global.customerIdsBySurecartId.get(surecartCustomerId);
      }

      // Fallback to database query (for individual phase runs)
      if (!customerId && customerEmail) {
        const customerResult = await pool.query(
          `SELECT id FROM customers WHERE LOWER(email) = $1`,
          [customerEmail]
        );
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].id;
        }
      }
      if (!customerId && surecartCustomerId) {
        const customerResult = await pool.query(
          `SELECT id FROM customers WHERE surecart_id = $1`,
          [surecartCustomerId]
        );
        if (customerResult.rows.length > 0) {
          customerId = customerResult.rows[0].id;
        }
      }

      if (!customerId) {
        log.warn(`Skipping subscription ${sub.ID} - customer not found (${customerEmail || surecartCustomerId})`);
        skipped++;
        continue;
      }

      // Get price info for recurring interval and product mapping
      const priceInfo = priceMap.get(sub.Price);
      const recurringInterval = priceInfo?.['Recurring Interval']?.toLowerCase() || 'month';
      const recurringIntervalCount = parseInt(priceInfo?.['Recurring Interval Count']) || 1;

      // Get legacy_product_id from price -> product mapping
      let legacyProductId = null;
      if (priceInfo?.Product) {
        const productResult = await pool.query(
          `SELECT id FROM products WHERE surecart_product_id = $1`,
          [priceInfo.Product]
        );
        if (productResult.rows.length > 0) {
          legacyProductId = productResult.rows[0].id;
        }
      }

      // Try to find matching plan (optional - don't skip if not found)
      let planId = null;
      const planResult = await pool.query(`
        SELECT id FROM subscription_plans
        WHERE amount_cents = $1
        AND recurring_interval = $2
        AND recurring_interval_count = $3
        LIMIT 1
      `, [
        parseInt(sub['Unit Amount']) || 0,
        recurringInterval,
        recurringIntervalCount,
      ]);

      if (planResult.rows.length > 0) {
        planId = planResult.rows[0].id;
        withPlan++;
      } else {
        legacyOnly++;
      }

      // Lookup coupon if exists
      let subCouponId = null;
      if (sub.Coupon) {
        const couponResult = await pool.query(
          `SELECT id FROM coupons WHERE name = $1 OR code = $1`,
          [sub.Coupon]
        );
        if (couponResult.rows.length > 0) {
          subCouponId = couponResult.rows[0].id;
        }
      }

      if (config.migration.dryRun) {
        log.dry(`Would create subscription for ${customerEmail} (plan: ${planId ? 'yes' : 'no'}, legacy_product: ${legacyProductId ? 'yes' : 'no'})`);
        created++;
        continue;
      }

      // Insert subscription with both plan_id and legacy_product_id
      await pool.query(`
        INSERT INTO subscriptions (
          surecart_id,
          customer_id,
          plan_id,
          legacy_product_id,
          coupon_id,
          status,
          unit_amount_cents,
          currency,
          recurring_interval,
          recurring_interval_count,
          quantity,
          trial_start,
          trial_end,
          current_period_start,
          current_period_end,
          cancel_at_period_end,
          ended_at,
          canceled_at,
          metadata,
          is_live_mode,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      `, [
        sub.ID,                                           // surecart_id
        customerId,
        planId,                                           // plan_id (may be NULL)
        legacyProductId,                                  // legacy_product_id (for access)
        subCouponId,                                      // coupon_id
        sub.Status.toLowerCase(),
        parseInt(sub['Unit Amount']) || 0,
        'usd',
        recurringInterval,
        recurringIntervalCount,
        parseInt(sub.Quantity) || 1,
        parseTimestamp(sub['Trial Start']),
        parseTimestamp(sub['Trial End']),
        parseTimestamp(sub['Current Period Start At']),
        parseTimestamp(sub['Current Period End At']),
        sub['Cancel at Period End'] === 'true',
        parseTimestamp(sub['Ended At']),
        sub.Status.toLowerCase() === 'canceled' ? parseTimestamp(sub['Ended At']) : null,
        fixMetadataJson(sub.Metadata),
        sub['Live Mode'] === 'true',                      // is_live_mode
        parseTimestamp(sub.Created),
        parseTimestamp(sub.Updated),
      ]);

      created++;

      if (created % 500 === 0) {
        log.info(`Progress: ${created}/${subscriptions.length} subscriptions created...`);
      }

    } catch (err) {
      log.error(`Failed to migrate subscription ${sub.ID}: ${err.message}`);
      errors++;
    }
  }

  log.info(`\nSubscriptions migration complete:`);
  log.info(`  - Created: ${created}`);
  log.info(`  - With plan_id: ${withPlan}`);
  log.info(`  - Legacy only (no plan): ${legacyOnly}`);
  log.info(`  - Skipped: ${skipped}`);
  log.info(`  - Errors: ${errors}`);

  return { created, skipped, errors, withPlan, legacyOnly };
}

// ============================================
// PHASE 6: PURCHASES MIGRATION
// ============================================

async function migratePurchases() {
  log.phase('PHASE 6: PURCHASES MIGRATION');

  log.info('Parsing purchases_1769187186.csv...');
  const purchases = await parseCSV('purchases_1769187186.csv');
  log.info(`Found ${purchases.length} purchases to migrate`);

  let created = 0;
  let errors = 0;

  for (const purchase of purchases) {
    try {
      // Note: CSV structure may vary - adjust column names based on actual CSV
      const customerId = purchase.Customer; // Adjust field name
      const productId = purchase.Product;   // Adjust field name

      if (!customerId || !productId) {
        log.warn(`Skipping purchase ${purchase.ID} - missing customer or product`);
        errors++;
        continue;
      }

      if (config.migration.dryRun) {
        log.dry(`Would create purchase: ${purchase.ID}`);
        created++;
        continue;
      }

      // Lookup customer - try by surecart_id first, then by email
      let customerResult = await pool.query(
        `SELECT id FROM customers WHERE surecart_id = $1`,
        [customerId]
      );

      if (customerResult.rows.length === 0 && purchase['Customer Email']) {
        customerResult = await pool.query(
          `SELECT id FROM customers WHERE LOWER(email) = $1`,
          [purchase['Customer Email'].toLowerCase().trim()]
        );
      }

      // Lookup product by surecart_product_id
      const productResult = await pool.query(
        `SELECT id FROM products WHERE surecart_product_id = $1`,
        [productId]
      );

      if (customerResult.rows.length === 0 || productResult.rows.length === 0) {
        log.warn(`Skipping purchase ${purchase.ID} - customer or product not found`);
        errors++;
        continue;
      }

      // Determine if this is a subscription purchase
      const isLifetime = !purchase.Subscription || purchase.Subscription === '';

      await pool.query(`
        INSERT INTO purchases (
          surecart_id,
          customer_id,
          product_id,
          subscription_id,
          order_id,
          status,
          is_lifetime,
          unit_amount_cents,
          currency,
          is_live_mode,
          granted_at,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        purchase.ID,                                      // surecart_id
        customerResult.rows[0].id,
        productResult.rows[0].id,
        null,                                             // subscription_id - link later if needed
        null,                                             // order_id - link later if needed
        purchase.Revoked === 'true' ? 'revoked' : 'active',
        isLifetime,
        parseInt(purchase['Unit Amount']) || 0,
        purchase.Currency || 'usd',
        purchase['Live Mode'] === 'true',                 // is_live_mode
        parseTimestamp(purchase.Created),
        parseTimestamp(purchase.Created),
        parseTimestamp(purchase.Updated),
      ]);

      created++;

      if (created % 1000 === 0) {
        log.info(`Progress: ${created}/${purchases.length} purchases created...`);
      }

    } catch (err) {
      log.error(`Failed to migrate purchase ${purchase.ID}: ${err.message}`);
      errors++;
    }
  }

  log.info(`\nPurchases migration complete: ${created} created, ${errors} errors`);
  return { created, errors };
}

// ============================================
// PHASE 7: VERIFICATION
// ============================================

async function verifyMigration() {
  log.phase('PHASE 7: VERIFICATION');

  log.info('Running verification checks...\n');

  // Record counts
  const tables = [
    'products', 'customers', 'orders', 'order_items',
    'subscriptions', 'purchases', 'customer_addresses', 'coupons'
  ];

  console.log('===========================================');
  console.log('    MIGRATION VERIFICATION REPORT');
  console.log('===========================================\n');

  console.log('RECORD COUNTS:');
  for (const table of tables) {
    const { rows } = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    console.log(`  ✓ ${table.padEnd(20)}: ${rows[0].count}`);
  }

  // Stripe integration status
  console.log('\nSTRIPE INTEGRATION:');
  const { rows: [stripeCustomers] } = await pool.query(
    `SELECT COUNT(*) as count FROM customers WHERE stripe_customer_id IS NOT NULL`
  );
  const { rows: [totalCustomers] } = await pool.query(`SELECT COUNT(*) as count FROM customers`);
  console.log(`  ✓ Customers with Stripe ID: ${stripeCustomers.count} / ${totalCustomers.count}`);

  const { rows: [stripeSubs] } = await pool.query(
    `SELECT COUNT(*) as count FROM subscriptions WHERE stripe_subscription_id IS NOT NULL`
  );
  const { rows: [totalSubs] } = await pool.query(`SELECT COUNT(*) as count FROM subscriptions`);
  console.log(`  ✓ Subscriptions with Stripe ID: ${stripeSubs.count} / ${totalSubs.count}`);

  // Data quality checks
  console.log('\nDATA QUALITY:');
  const { rows: [duplicates] } = await pool.query(`
    SELECT COUNT(*) as count FROM (
      SELECT email, COUNT(*) FROM customers GROUP BY email HAVING COUNT(*) > 1
    ) duplicates
  `);
  console.log(`  ${duplicates.count === '0' ? '✓' : '✗'} Duplicate customers: ${duplicates.count}`);

  const { rows: [orphanedOrders] } = await pool.query(`
    SELECT COUNT(*) as count FROM orders WHERE customer_id NOT IN (SELECT id FROM customers)
  `);
  console.log(`  ${orphanedOrders.count === '0' ? '✓' : '✗'} Orphaned orders: ${orphanedOrders.count}`);

  const { rows: [subsWithoutPlan] } = await pool.query(`
    SELECT COUNT(*) as count FROM subscriptions WHERE plan_id IS NULL
  `);
  if (subsWithoutPlan.count !== '0') {
    console.log(`  ⚠ Subscriptions without plan: ${subsWithoutPlan.count}`);
  }

  console.log('\n===========================================\n');

  log.success('Verification complete!');
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  const command = process.argv[2] || 'all';

  console.log('\n');
  log.info('SureCart Database Migration v2.0');
  log.info(`Database: ${config.db.database} @ ${config.db.host}`);
  log.info(`Mode: ${config.migration.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('\n');

  if (config.migration.dryRun) {
    log.warn('Running in DRY RUN mode - no data will be written');
  }

  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    log.success('Database connection established');

    switch (command.toLowerCase()) {
      case 'schema':
        await setupSchema();
        break;
      case 'products':
        await migrateProducts();
        break;
      case 'customers':
        await migrateCustomers();
        break;
      case 'orders':
        await migrateOrders();
        break;
      case 'subscriptions':
        await migrateSubscriptions();
        break;
      case 'purchases':
        await migratePurchases();
        break;
      case 'verify':
        await verifyMigration();
        break;
      case 'all':
        log.info('Running full migration (all phases)...\n');
        await setupSchema();
        await migrateProducts();
        await migrateCustomers();
        await migrateOrders();
        await migrateSubscriptions();
        await migratePurchases();
        await verifyMigration();
        break;
      default:
        log.error(`Unknown command: ${command}`);
        console.log(`
Usage: node migrate-to-new-db.js [command]

Commands:
  all (default)    Run all migration phases
  schema           Set up database schema
  products         Migrate products
  customers        Migrate customers (includes wp_users merge)
  orders           Migrate orders
  subscriptions    Migrate subscriptions
  purchases        Migrate purchases
  verify           Verify migration

Environment:
  DRY_RUN=${config.migration.dryRun}
  BATCH_SIZE=${config.migration.batchSize}
        `);
        process.exit(1);
    }

    log.success('\nMigration completed successfully!');

  } catch (err) {
    log.error(`\nMigration failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run migration
main();
