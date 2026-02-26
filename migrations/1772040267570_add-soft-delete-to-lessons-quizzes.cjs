/**
 * Migration: Add soft-delete (deleted_at) to lessons, quizzes, quiz_questions, quiz_question_options
 *
 * Replaces hard-deletes with soft-deletes following the project convention.
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn('lessons', {
    deleted_at: { type: 'timestamptz', default: null },
  });

  pgm.addColumn('quizzes', {
    deleted_at: { type: 'timestamptz', default: null },
  });

  pgm.addColumn('quiz_questions', {
    deleted_at: { type: 'timestamptz', default: null },
  });

  pgm.addColumn('quiz_question_options', {
    deleted_at: { type: 'timestamptz', default: null },
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropColumn('quiz_question_options', 'deleted_at');
  pgm.dropColumn('quiz_questions', 'deleted_at');
  pgm.dropColumn('quizzes', 'deleted_at');
  pgm.dropColumn('lessons', 'deleted_at');
};
