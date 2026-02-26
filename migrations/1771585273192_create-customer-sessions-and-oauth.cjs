/**
 * Migration: Create sessions and oauth_accounts tables for customer auth
 *
 * - sessions: stores customer login sessions (JWT refresh tokens)
 * - oauth_accounts: links customers to Google/Apple OAuth providers
 */

exports.up = (pgm) => {
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

  pgm.createIndex('oauth_accounts', ['provider', 'provider_account_id'], {
    name: 'oauth_accounts_provider_provider_account_id_index',
  });

  pgm.createIndex('oauth_accounts', 'customer_id', {
    name: 'oauth_accounts_customer_id_index',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('oauth_accounts', { ifExists: true });
  pgm.dropTable('sessions', { ifExists: true });
};
