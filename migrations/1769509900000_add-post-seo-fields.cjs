/**
 * Migration: Add SEO fields and WordPress tracking to posts table
 *
 * Adds seo_title, seo_description, seo_keywords for SEO metadata,
 * and wp_post_id for migration tracking/idempotency.
 */

exports.up = (pgm) => {
  pgm.addColumns('posts', {
    seo_title: {
      type: 'varchar(500)',
    },
    seo_description: {
      type: 'varchar(1000)',
    },
    seo_keywords: {
      type: 'varchar(500)',
    },
    wp_post_id: {
      type: 'integer',
    },
  });

  pgm.createIndex('posts', 'wp_post_id', {
    name: 'posts_wp_post_id_index',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('posts', 'wp_post_id', { name: 'posts_wp_post_id_index' });
  pgm.dropColumns('posts', ['seo_title', 'seo_description', 'seo_keywords', 'wp_post_id']);
};
