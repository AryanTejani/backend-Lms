/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.addColumns('products', {
    stripe_product_id: { type: 'varchar(255)', notNull: false },
    stripe_price_id: { type: 'varchar(255)', notNull: false },
  });

  pgm.createIndex('products', 'stripe_product_id', {
    name: 'idx_products_stripe_product',
    where: 'stripe_product_id IS NOT NULL',
  });

  pgm.createIndex('products', 'stripe_price_id', {
    name: 'idx_products_stripe_price',
    where: 'stripe_price_id IS NOT NULL',
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropIndex('products', 'stripe_price_id', { name: 'idx_products_stripe_price' });
  pgm.dropIndex('products', 'stripe_product_id', { name: 'idx_products_stripe_product' });
  pgm.dropColumns('products', ['stripe_product_id', 'stripe_price_id']);
};
