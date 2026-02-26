/**
 * Migration: Add fields for LearnDash course content migration
 *
 * - Add section_name to lessons (WordPress 3-level → 2-level flattening)
 * - Add subscription_plan_id to posts (link blog posts to subscription plans)
 * - Add wp_post_id to products (track WordPress course ID)
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // 1. Add section_name to lessons
  pgm.addColumns('lessons', {
    section_name: { type: 'varchar(500)' },
  });

  // 2. Add subscription_plan_id to posts
  pgm.addColumns('posts', {
    subscription_plan_id: {
      type: 'uuid',
      references: 'subscription_plans(id)',
      onDelete: 'SET NULL',
    },
  });
  pgm.createIndex('posts', 'subscription_plan_id', {
    name: 'idx_posts_subscription_plan',
  });

  // 3. Add wp_post_id to products
  pgm.addColumns('products', {
    wp_post_id: { type: 'integer' },
  });
  pgm.createIndex('products', 'wp_post_id', {
    name: 'idx_products_wp_post_id',
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex('products', 'wp_post_id', { name: 'idx_products_wp_post_id' });
  pgm.dropColumn('products', 'wp_post_id');

  pgm.dropIndex('posts', 'subscription_plan_id', { name: 'idx_posts_subscription_plan' });
  pgm.dropColumn('posts', 'subscription_plan_id');

  pgm.dropColumn('lessons', 'section_name');
};
