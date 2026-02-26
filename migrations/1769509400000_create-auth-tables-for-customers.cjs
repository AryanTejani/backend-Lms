/**
 * Migration: Replace old auth tables (user_id → users) with new ones (customer_id → customers)
 *
 * The v2 database already has a `customers` table. The old `sessions` and
 * `oauth_accounts` tables reference `users(id)` which is no longer needed.
 * This migration drops those legacy tables and recreates them against `customers`.
 */

exports.up = (pgm) => {
  // Drop old auth tables that reference users(id)
  pgm.dropTable('sessions', { ifExists: true, cascade: true });
  pgm.dropTable('oauth_accounts', { ifExists: true, cascade: true });
  pgm.dropTable('users', { ifExists: true, cascade: true });

  // Create oauth_accounts referencing customers(id)
  pgm.createTable('oauth_accounts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    customer_id: {
      type: 'uuid',
      notNull: true,
      references: 'customers(id)',
      onDelete: 'CASCADE',
    },
    provider: {
      type: 'varchar(50)',
      notNull: true,
    },
    provider_account_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('oauth_accounts', 'oauth_accounts_provider_unique', {
    unique: ['provider', 'provider_account_id'],
  });
  pgm.createIndex('oauth_accounts', 'customer_id', {
    name: 'oauth_accounts_customer_id_index',
  });
  pgm.createIndex('oauth_accounts', ['provider', 'provider_account_id'], {
    name: 'oauth_accounts_provider_provider_account_id_index',
  });

  // Create sessions referencing customers(id)
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    customer_id: {
      type: 'uuid',
      notNull: true,
      references: 'customers(id)',
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

  pgm.createIndex('sessions', 'customer_id', {
    name: 'sessions_customer_id_index',
  });
};

exports.down = (pgm) => {
  // Drop the new customer-based tables
  pgm.dropTable('sessions', { ifExists: true });
  pgm.dropTable('oauth_accounts', { ifExists: true });

  // Restore old users table
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
      notNull: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.createIndex('users', 'email');

  // Restore old oauth_accounts referencing users
  pgm.createTable('oauth_accounts', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    provider: {
      type: 'varchar(50)',
      notNull: true,
    },
    provider_account_id: {
      type: 'varchar(255)',
      notNull: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.addConstraint('oauth_accounts', 'oauth_accounts_provider_unique', {
    unique: ['provider', 'provider_account_id'],
  });
  pgm.createIndex('oauth_accounts', 'user_id');
  pgm.createIndex('oauth_accounts', ['provider', 'provider_account_id']);

  // Restore old sessions referencing users
  pgm.createTable('sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    revoked_at: {
      type: 'timestamptz',
      notNull: false,
    },
  });

  pgm.createIndex('sessions', 'user_id');
  pgm.createIndex('sessions', 'id', {
    where: 'revoked_at IS NULL',
    name: 'idx_sessions_active',
  });
};
