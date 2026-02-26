/**
 * Migration: Create courses and lessons tables
 *
 * - lesson_type enum (video, text)
 * - courses table with product_id FK for access control
 * - lessons table with video_id FK and lesson_type
 * - Indexes on instructor_id, slug, product_id, course_id, video_id
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // 1. Create lesson_type enum
  pgm.createType('lesson_type', ['video', 'text']);

  // 2. Create courses table with all columns
  pgm.createTable('courses', {
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
    description: {
      type: 'text',
    },
    thumbnail_url: {
      type: 'varchar(1000)',
    },
    instructor_id: {
      type: 'uuid',
      notNull: true,
      references: 'staff(id)',
      onDelete: 'RESTRICT',
    },
    product_id: {
      type: 'uuid',
      references: 'products(id)',
      onDelete: 'SET NULL',
    },
    is_published: {
      type: 'boolean',
      default: false,
    },
    published_at: {
      type: 'timestamptz',
    },
    sort_order: {
      type: 'integer',
      default: 0,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('courses', 'instructor_id', { name: 'courses_instructor_id_index' });
  pgm.createIndex('courses', 'slug', { name: 'courses_slug_index' });
  pgm.createIndex('courses', 'product_id', { name: 'idx_courses_product' });

  // 3. Create lessons table with all columns
  pgm.createTable('lessons', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    course_id: {
      type: 'uuid',
      notNull: true,
      references: 'courses(id)',
      onDelete: 'CASCADE',
    },
    title: {
      type: 'varchar(500)',
      notNull: true,
    },
    content: {
      type: 'text',
    },
    video_id: {
      type: 'uuid',
      references: 'videos(id)',
      onDelete: 'SET NULL',
    },
    lesson_type: {
      type: 'lesson_type',
      notNull: true,
      default: 'text',
    },
    duration: {
      type: 'integer',
      default: 0,
    },
    sort_order: {
      type: 'integer',
      default: 0,
    },
    is_published: {
      type: 'boolean',
      default: false,
    },
    created_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('lessons', 'course_id', { name: 'lessons_course_id_index' });
  pgm.createIndex('lessons', 'video_id', { name: 'idx_lessons_video' });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('lessons', { ifExists: true });
  pgm.dropTable('courses', { ifExists: true });
  pgm.dropType('lesson_type', { ifExists: true });
};
