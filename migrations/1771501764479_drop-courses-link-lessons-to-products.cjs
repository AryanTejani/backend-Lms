/**
 * Migration: Drop courses table, link lessons directly to products
 *
 * - Add thumbnail_url, is_published, published_at, sort_order to products
 * - Change lessons FK from course_id -> product_id
 * - Drop courses table
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // 1. Add course-specific columns to products
  pgm.addColumns('products', {
    thumbnail_url: { type: 'varchar(1000)' },
    is_published: { type: 'boolean', default: false },
    published_at: { type: 'timestamptz' },
    sort_order: { type: 'integer', default: 0 },
  });

  // 2. Add product_id column to lessons (nullable initially)
  pgm.addColumns('lessons', {
    product_id: {
      type: 'uuid',
      references: 'products(id)',
      onDelete: 'CASCADE',
    },
  });

  // 3. Drop old course_id FK, index, and column from lessons
  pgm.dropIndex('lessons', 'course_id', { name: 'lessons_course_id_index' });
  pgm.dropColumn('lessons', 'course_id');

  // 4. Make product_id NOT NULL on lessons
  pgm.alterColumn('lessons', 'product_id', { notNull: true });

  // 5. Create index on lessons.product_id
  pgm.createIndex('lessons', 'product_id', { name: 'lessons_product_id_index' });

  // 6. Drop courses table (CASCADE to remove any remaining FKs)
  pgm.dropTable('courses', { cascade: true });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  // Recreate courses table
  pgm.createTable('courses', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('uuidv7()') },
    title: { type: 'varchar(500)', notNull: true },
    slug: { type: 'varchar(500)', notNull: true, unique: true },
    description: { type: 'text' },
    thumbnail_url: { type: 'varchar(1000)' },
    instructor_id: { type: 'uuid', notNull: true, references: 'staff(id)', onDelete: 'RESTRICT' },
    product_id: { type: 'uuid', references: 'products(id)', onDelete: 'SET NULL' },
    is_published: { type: 'boolean', default: false },
    published_at: { type: 'timestamptz' },
    sort_order: { type: 'integer', default: 0 },
    created_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    updated_at: { type: 'timestamptz', default: pgm.func('NOW()') },
    deleted_at: { type: 'timestamptz' },
  });

  pgm.createIndex('courses', 'instructor_id', { name: 'courses_instructor_id_index' });
  pgm.createIndex('courses', 'slug', { name: 'courses_slug_index' });
  pgm.createIndex('courses', 'product_id', { name: 'idx_courses_product' });

  // Restore course_id on lessons
  pgm.dropIndex('lessons', 'product_id', { name: 'lessons_product_id_index' });
  pgm.dropColumn('lessons', 'product_id');
  pgm.addColumns('lessons', {
    course_id: { type: 'uuid', notNull: true, references: 'courses(id)', onDelete: 'CASCADE' },
  });
  pgm.createIndex('lessons', 'course_id', { name: 'lessons_course_id_index' });

  // Remove course-specific columns from products
  pgm.dropColumns('products', ['thumbnail_url', 'is_published', 'published_at', 'sort_order']);
};
