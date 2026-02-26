/**
 * Seed Admin Script
 * Creates the initial admin user in the staff table
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-admin.ts
 *
 * Environment variables:
 *   ADMIN_EMAIL    - Admin email (required)
 *   ADMIN_PASSWORD - Admin password (required, min 12 chars)
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Database connection
 */

import 'dotenv/config';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcrypt';
import pg from 'pg';

const { Pool } = pg;

// Simple UUIDv7 implementation
function generateUuidV7(): string {
  const timestamp = BigInt(Date.now());
  const timestampHex = timestamp.toString(16).padStart(12, '0');
  const randomHex = randomBytes(10).toString('hex');

  const uuid =
    timestampHex.slice(0, 8) +
    '-' +
    timestampHex.slice(8, 12) +
    '-7' +
    randomHex.slice(0, 3) +
    '-' +
    ((parseInt(randomHex.slice(3, 4), 16) & 0x3) | 0x8).toString(16) +
    randomHex.slice(4, 7) +
    '-' +
    randomHex.slice(7, 19);

  return uuid;
}

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required');
    console.error('Usage: ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=yourpassword npx ts-node scripts/seed-admin.ts');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('Error: Password must be at least 12 characters');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    database: process.env.DB_NAME ?? 'auth_service',
    user: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  try {
    console.log('Connecting to database...');

    // Check if admin already exists
    const existing = await pool.query('SELECT id, email FROM staff WHERE email = $1', [email.toLowerCase()]);

    if (existing.rows.length > 0) {
      console.log(`Admin user already exists: ${existing.rows[0].email} (${existing.rows[0].id})`);
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    const id = generateUuidV7();

    // Insert admin
    await pool.query(
      `INSERT INTO staff (id, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'admin', true)`,
      [id, email.toLowerCase(), passwordHash],
    );

    console.log(`Admin user created successfully:`);
    console.log(`  ID:    ${id}`);
    console.log(`  Email: ${email.toLowerCase()}`);
    console.log(`  Role:  admin`);
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
