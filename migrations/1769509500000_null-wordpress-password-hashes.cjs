/**
 * Migration: Null out WordPress password hashes for migrated customers
 *
 * Migrated customers from the old WordPress site have password hashes
 * in WordPress phpass format ($P$, $H$) or custom WordPress format ($wp$).
 * These hashes are incompatible with bcrypt verification and cause login
 * failures. Setting them to NULL triggers the PASSWORD_RESET_REQUIRED flow,
 * which redirects users to the forgot-password page to set a new password.
 *
 * Only WordPress-format hashes are affected. Customers who registered
 * through the new system (bcrypt hashes starting with $2a$ or $2b$) are
 * left untouched.
 */

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE customers
    SET password_hash = NULL
    WHERE password_hash LIKE '$P$%'
       OR password_hash LIKE '$H$%'
       OR password_hash LIKE '$wp$%'
  `);
};

exports.down = () => {
  // No-op: WordPress hashes cannot be restored once nulled.
  // Affected users will go through the forgot-password flow to set a new bcrypt password.
};
