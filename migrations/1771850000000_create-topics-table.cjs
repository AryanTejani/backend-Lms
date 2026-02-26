/**
 * Migration: Create topics table for 3-tier course hierarchy
 *
 * Adds Topic as a child of Lesson, creating a Section > Lesson > Topic hierarchy.
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // 1. Create topic_type enum
  pgm.createType('topic_type', ['video', 'text']);

  // 2. Create topics table
  pgm.createTable('topics', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    lesson_id: {
      type: 'uuid',
      notNull: true,
      references: 'lessons(id)',
      onDelete: 'CASCADE',
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'products(id)',
      onDelete: 'CASCADE',
    },
    section_id: {
      type: 'uuid',
      notNull: true,
      references: 'sections(id)',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(500)', notNull: true },
    content: { type: 'text' },
    video_id: {
      type: 'uuid',
      references: 'videos(id)',
      onDelete: 'SET NULL',
    },
    topic_type: {
      type: 'topic_type',
      notNull: true,
      default: 'text',
    },
    duration: { type: 'integer', default: 0 },
    sort_order: { type: 'integer', default: 0 },
    is_published: { type: 'boolean', default: false },
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

  // 3. Create indexes
  pgm.createIndex('topics', 'lesson_id', { name: 'idx_topics_lesson' });
  pgm.createIndex('topics', 'product_id', { name: 'idx_topics_product' });
  pgm.createIndex('topics', 'section_id', { name: 'idx_topics_section' });
  pgm.createIndex('topics', 'video_id', { name: 'idx_topics_video' });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('topics');
  pgm.dropType('topic_type');
};
