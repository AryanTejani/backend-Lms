/**
 * Migration: Create posts table for blog/content management
 *
 * References `staff(id)` via author_id with RESTRICT on delete.
 */

exports.up = (pgm) => {
  pgm.createTable('posts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    title: {
      type: 'varchar(500)',
      notNull: true,
    },
    slug: {
      type: 'varchar(500)',
      notNull: true,
      unique: true,
    },
    content: {
      type: 'text',
      notNull: true,
    },
    excerpt: {
      type: 'varchar(1000)',
    },
    cover_image_url: {
      type: 'varchar(1000)',
    },
    author_id: {
      type: 'uuid',
      notNull: true,
      references: 'staff(id)',
      onDelete: 'RESTRICT',
    },
    is_published: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    published_at: {
      type: 'timestamptz',
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

  pgm.createIndex('posts', 'author_id', {
    name: 'posts_author_id_index',
  });

  pgm.createIndex('posts', 'slug', {
    name: 'posts_slug_index',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('posts', { ifExists: true });
};
