/**
 * Migration: Create videos table with access control
 *
 * - video_access_type enum (free, subscription, paid)
 * - videos table with Bunny CDN integration fields + access control
 * - Foreign keys to products, staff, categories
 * - Indexes on instructor_id, access_type, is_published
 */

exports.up = (pgm) => {
  // Create the access type enum
  pgm.createType('video_access_type', ['free', 'subscription', 'paid']);

  // Create videos table
  pgm.createTable('videos', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    bunny_video_id: {
      type: 'varchar(100)',
      notNull: true,
      unique: true,
    },
    title: {
      type: 'varchar(500)',
      notNull: true,
    },
    description: {
      type: 'text',
    },
    thumbnail_url: {
      type: 'varchar(1000)',
    },
    duration: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    access_type: {
      type: 'video_access_type',
      notNull: true,
      default: 'free',
    },
    product_id: {
      type: 'uuid',
      references: 'products(id)',
      onDelete: 'SET NULL',
    },
    instructor_id: {
      type: 'uuid',
      notNull: true,
      references: 'staff(id)',
      onDelete: 'RESTRICT',
    },
    category_id: {
      type: 'uuid',
      references: 'categories(id)',
      onDelete: 'SET NULL',
    },
    is_published: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    published_at: {
      type: 'timestamptz',
    },
    sort_order: {
      type: 'integer',
      notNull: true,
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamptz',
    },
  });

  // Indexes
  pgm.createIndex('videos', 'instructor_id', {
    name: 'idx_videos_instructor',
  });

  pgm.createIndex('videos', 'access_type', {
    name: 'idx_videos_access_type',
  });

  pgm.createIndex('videos', 'is_published', {
    name: 'idx_videos_published',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('videos', { ifExists: true });
  pgm.dropType('video_access_type', { ifExists: true });
};
