/**
 * Migration: Add quiz tables for LearnDash quiz content migration
 *
 * - Create question_type enum (single, multiple)
 * - Create quizzes table (linked to products)
 * - Create quiz_questions table (linked to quizzes)
 * - Create quiz_question_options table (linked to questions)
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // 1. Create question_type enum
  pgm.createType('question_type', ['single', 'multiple']);

  // 2. Create quizzes table
  pgm.createTable('quizzes', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    product_id: {
      type: 'uuid',
      notNull: true,
      references: 'products(id)',
      onDelete: 'CASCADE',
    },
    title: { type: 'varchar(500)', notNull: true },
    description: { type: 'text' },
    passing_percentage: { type: 'integer', default: 80 },
    time_limit_seconds: { type: 'integer' },
    sort_order: { type: 'integer', default: 0 },
    is_published: { type: 'boolean', default: false },
    wp_post_id: { type: 'integer' },
    metadata: { type: 'jsonb', default: '{}' },
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

  pgm.createIndex('quizzes', 'product_id', { name: 'idx_quizzes_product' });
  pgm.createIndex('quizzes', 'wp_post_id', { name: 'idx_quizzes_wp_post_id' });

  // 3. Create quiz_questions table
  pgm.createTable('quiz_questions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    quiz_id: {
      type: 'uuid',
      notNull: true,
      references: 'quizzes(id)',
      onDelete: 'CASCADE',
    },
    question_text: { type: 'text', notNull: true },
    question_type: {
      type: 'question_type',
      notNull: true,
      default: 'single',
    },
    points: { type: 'integer', default: 1 },
    sort_order: { type: 'integer', default: 0 },
    hint: { type: 'text' },
    wp_post_id: { type: 'integer' },
    question_pro_id: { type: 'integer' },
    metadata: { type: 'jsonb', default: '{}' },
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

  pgm.createIndex('quiz_questions', 'quiz_id', { name: 'idx_quiz_questions_quiz' });

  // 4. Create quiz_question_options table
  pgm.createTable('quiz_question_options', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuidv7()'),
    },
    question_id: {
      type: 'uuid',
      notNull: true,
      references: 'quiz_questions(id)',
      onDelete: 'CASCADE',
    },
    option_text: { type: 'text', notNull: true },
    is_correct: { type: 'boolean', default: false },
    sort_order: { type: 'integer', default: 0 },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('quiz_question_options', 'question_id', { name: 'idx_quiz_options_question' });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropTable('quiz_question_options');
  pgm.dropTable('quiz_questions');
  pgm.dropTable('quizzes');
  pgm.dropType('question_type');
};
