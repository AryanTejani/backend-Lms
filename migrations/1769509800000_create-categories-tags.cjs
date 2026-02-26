/**
 * Migration: Create categories, tags, and junction tables for posts
 *
 * - categories (id, name, slug, description, created_at, updated_at)
 * - tags (id, name, slug, created_at, updated_at)
 * - post_categories (post_id, category_id) junction with CASCADE deletes
 * - post_tags (post_id, tag_id) junction with CASCADE deletes
 */

exports.up = (pgm) => {
  // Categories table
  pgm.createTable('categories', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    slug: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    description: {
      type: 'text',
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
  });

  pgm.createIndex('categories', 'slug', {
    name: 'categories_slug_index',
  });

  // Tags table
  pgm.createTable('tags', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    name: {
      type: 'varchar(255)',
      notNull: true,
    },
    slug: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
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
  });

  pgm.createIndex('tags', 'slug', {
    name: 'tags_slug_index',
  });

  // Post-Categories junction table
  pgm.createTable('post_categories', {
    post_id: {
      type: 'uuid',
      notNull: true,
      references: 'posts(id)',
      onDelete: 'CASCADE',
    },
    category_id: {
      type: 'uuid',
      notNull: true,
      references: 'categories(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.addConstraint('post_categories', 'post_categories_pkey', {
    primaryKey: ['post_id', 'category_id'],
  });

  pgm.createIndex('post_categories', 'category_id', {
    name: 'post_categories_category_id_index',
  });

  // Post-Tags junction table
  pgm.createTable('post_tags', {
    post_id: {
      type: 'uuid',
      notNull: true,
      references: 'posts(id)',
      onDelete: 'CASCADE',
    },
    tag_id: {
      type: 'uuid',
      notNull: true,
      references: 'tags(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.addConstraint('post_tags', 'post_tags_pkey', {
    primaryKey: ['post_id', 'tag_id'],
  });

  pgm.createIndex('post_tags', 'tag_id', {
    name: 'post_tags_tag_id_index',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('post_tags', { ifExists: true });
  pgm.dropTable('post_categories', { ifExists: true });
  pgm.dropTable('tags', { ifExists: true });
  pgm.dropTable('categories', { ifExists: true });
};
