/**
 * Migration: Create staff_sessions table for admin/instructor session auth
 *
 * Mirrors the `sessions` table (customer auth) but references `staff(id)`.
 */

exports.up = (pgm) => {
  pgm.createTable('staff_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    staff_id: {
      type: 'uuid',
      notNull: true,
      references: 'staff(id)',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    revoked_at: {
      type: 'timestamptz',
    },
  });

  pgm.createIndex('staff_sessions', 'staff_id', {
    name: 'staff_sessions_staff_id_index',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('staff_sessions', { ifExists: true });
};
