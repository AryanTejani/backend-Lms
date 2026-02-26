/**
 * Migration: Add onboarding profile fields to customers table
 *
 * Adds language_preference, age, grade, subjects, learning_goals,
 * and onboarding_completed for the VidyaSetu onboarding flow.
 */

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.addColumn('customers', {
    language_preference: {
      type: 'varchar(10)',
      notNull: true,
      default: "'en'",
    },
    age: {
      type: 'smallint',
      default: null,
    },
    grade: {
      type: 'varchar(20)',
      default: null,
    },
    subjects: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    learning_goals: {
      type: 'jsonb',
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    onboarding_completed: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });
};

/** @type {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.dropColumn('customers', 'onboarding_completed');
  pgm.dropColumn('customers', 'learning_goals');
  pgm.dropColumn('customers', 'subjects');
  pgm.dropColumn('customers', 'grade');
  pgm.dropColumn('customers', 'age');
  pgm.dropColumn('customers', 'language_preference');
};
