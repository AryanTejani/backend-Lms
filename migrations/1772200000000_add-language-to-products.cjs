/* eslint-disable @typescript-eslint/no-require-imports */
const { PgLiteral } = require('node-pg-migrate');

/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
  pgm.addColumn('products', {
    language: {
      type: 'varchar(10)',
      notNull: true,
      default: new PgLiteral("'en'"),
    },
  });

  pgm.createIndex('products', 'language', { name: 'idx_products_language' });
};

/**
 * @type {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
  pgm.dropIndex('products', 'language', { name: 'idx_products_language' });
  pgm.dropColumn('products', 'language');
};
