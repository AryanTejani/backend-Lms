/**
 * Migration: Add requires_password_reset column to customers table
 *
 * This column was defined in schema.sql but missing from the current database.
 * Used by the auth flow to force migrated users (who lack passwords) through
 * the password-reset flow before they can log in.
 */

exports.up = (pgm) => {
  pgm.addColumn('customers', {
    requires_password_reset: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('customers', 'requires_password_reset');
};
