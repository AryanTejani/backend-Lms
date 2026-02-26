/**
 * Migration: Add sections table for 3-level course hierarchy
 *
 * Introduces a Section entity between Product (Course) and Lesson/Quiz.
 * - Create sections table
 * - Add section_id FK to lessons (NOT NULL after data migration)
 * - Add section_id FK to quizzes (nullable)
 * - Migrate existing section_name data into sections records
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  // 1. Create sections table
  pgm.createTable('sections', {
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
    sort_order: { type: 'integer', default: 0 },
    is_published: { type: 'boolean', default: true },
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

  pgm.createIndex('sections', 'product_id', { name: 'idx_sections_product' });

  // 2. Add section_id to lessons (nullable initially for data migration)
  pgm.addColumn('lessons', {
    section_id: {
      type: 'uuid',
      references: 'sections(id)',
      onDelete: 'CASCADE',
    },
  });

  pgm.createIndex('lessons', 'section_id', { name: 'idx_lessons_section' });

  // 3. Add section_id to quizzes (nullable)
  pgm.addColumn('quizzes', {
    section_id: {
      type: 'uuid',
      references: 'sections(id)',
      onDelete: 'SET NULL',
    },
  });

  pgm.createIndex('quizzes', 'section_id', { name: 'idx_quizzes_section' });

  // 4. Data migration: create sections from existing section_name values
  pgm.sql(`
    -- Insert sections from distinct (product_id, section_name) combinations
    -- across both lessons and quizzes.
    -- COALESCE is applied BEFORE the UNION so that NULL and 'General'
    -- are treated as the same value during deduplication.
    WITH distinct_sections AS (
      SELECT DISTINCT product_id, COALESCE(section_name, 'General') AS title
      FROM lessons
      UNION
      SELECT product_id, section_name AS title
      FROM quizzes
      WHERE section_name IS NOT NULL
    ),
    section_data AS (
      SELECT
        ds.product_id,
        ds.title,
        COALESCE(
          (SELECT MIN(l.sort_order) FROM lessons l WHERE l.product_id = ds.product_id AND COALESCE(l.section_name, 'General') = ds.title),
          0
        ) AS sort_order
      FROM distinct_sections ds
    )
    INSERT INTO sections (id, product_id, title, sort_order, is_published)
    SELECT uuidv7(), product_id, title, sort_order, true
    FROM section_data;

    -- Update lessons to point to their matching section
    UPDATE lessons l
    SET section_id = s.id
    FROM sections s
    WHERE s.product_id = l.product_id
      AND s.title = COALESCE(l.section_name, 'General');

    -- Update quizzes to point to their matching section
    UPDATE quizzes q
    SET section_id = s.id
    FROM sections s
    WHERE s.product_id = q.product_id
      AND q.section_name IS NOT NULL
      AND s.title = q.section_name;
  `);

  // 5. Make section_id NOT NULL on lessons after data migration
  pgm.alterColumn('lessons', 'section_id', { notNull: true });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropIndex('quizzes', 'section_id', { name: 'idx_quizzes_section' });
  pgm.dropColumn('quizzes', 'section_id');
  pgm.dropIndex('lessons', 'section_id', { name: 'idx_lessons_section' });
  pgm.dropColumn('lessons', 'section_id');
  pgm.dropTable('sections');
};
