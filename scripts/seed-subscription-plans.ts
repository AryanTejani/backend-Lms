/**
 * Seed Subscription Plans Script
 * Creates the initial subscription plans in the subscription_plans table
 * and syncs them to Stripe (creates products + prices).
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/seed-subscription-plans.ts
 *
 * Environment variables:
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD - Database connection
 *   STRIPE_SECRET_KEY - Stripe API key for creating products/prices
 */

import 'dotenv/config';
import { randomBytes } from 'crypto';
import pg from 'pg';
import Stripe from 'stripe';

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

interface PlanSeed {
  name: string;
  slug: string;
  description: string;
  amount_cents: number;
  currency: string;
  recurring_interval: string;
  recurring_interval_count: number;
  trial_days: number;
}

const plans: PlanSeed[] = [
  {
    name: 'Monthly',
    slug: 'monthly',
    description: 'Monthly access to TraderLion platform',
    amount_cents: 5999,
    currency: 'inr',
    recurring_interval: 'month',
    recurring_interval_count: 1,
    trial_days: 7,
  },
  {
    name: 'Quarterly',
    slug: 'quarterly',
    description: 'Quarterly access to TraderLion platform',
    amount_cents: 14999,
    currency: 'inr',
    recurring_interval: 'month',
    recurring_interval_count: 3,
    trial_days: 7,
  },
  {
    name: 'Yearly',
    slug: 'yearly',
    description: 'Yearly access to TraderLion platform',
    amount_cents: 47999,
    currency: 'inr',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    trial_days: 7,
  },
  {
    name: 'Trade Lab with Richard Moglen',
    slug: 'trade-lab-with-richard-moglen',
    description: 'Annual subscription to Trade Lab with Richard Moglen',
    amount_cents: 74500,
    currency: 'inr',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    trial_days: 0,
  },
  {
    name: 'The TML Talk',
    slug: 'the-tml-talk',
    description: 'Annual subscription to The TML Talk with Ross Haber',
    amount_cents: 49900,
    currency: 'inr',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    trial_days: 0,
  },
  {
    name: 'Global Trend Alert',
    slug: 'global-trend-alert',
    description: 'Annual subscription to Global Trend Alert by Stan Weinstein',
    amount_cents: 1000000,
    currency: 'inr',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    trial_days: 0,
  },
  {
    name: 'TL Research',
    slug: 'tl-research',
    description: 'Annual subscription to TL Research',
    amount_cents: 49000,
    currency: 'inr',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    trial_days: 0,
  },
  {
    name: 'The Weekly Playbook',
    slug: 'the-weekly-playbook',
    description: 'Annual subscription to The Weekly Playbook',
    amount_cents: 25000,
    currency: 'inr',
    recurring_interval: 'year',
    recurring_interval_count: 1,
    trial_days: 0,
  },
];

async function main(): Promise<void> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY environment variable is required');
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });

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

    for (const plan of plans) {
      // Check if plan already exists by slug
      const existing = await pool.query(
        'SELECT id, name, stripe_product_id, stripe_price_id FROM subscription_plans WHERE slug = $1',
        [plan.slug],
      );

      let planId: string;

      if (existing.rows.length > 0) {
        const row = existing.rows[0];
        planId = row.id;

        if (row.stripe_product_id && row.stripe_price_id) {
          console.log(`Plan already synced: ${row.name} (${planId}) — Stripe price: ${row.stripe_price_id}`);
          continue;
        }

        console.log(`Plan exists but missing Stripe IDs: ${row.name} (${planId}) — syncing to Stripe...`);
      } else {
        planId = generateUuidV7();

        await pool.query(
          `INSERT INTO subscription_plans (id, name, slug, description, amount_cents, currency, recurring_interval, recurring_interval_count, trial_days, is_active, is_archived)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, false)`,
          [planId, plan.name, plan.slug, plan.description, plan.amount_cents, plan.currency, plan.recurring_interval, plan.recurring_interval_count, plan.trial_days],
        );

        console.log(`Created plan: ${plan.name} ($${(plan.amount_cents / 100).toFixed(2)}/${plan.recurring_interval}) — ID: ${planId}`);
      }

      // Create Stripe product and price
      try {
        const product = await stripe.products.create({
          name: plan.name,
          description: plan.description,
          metadata: { traderlion_plan_id: planId },
        });

        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.amount_cents,
          currency: plan.currency,
          recurring: {
            interval: plan.recurring_interval as Stripe.PriceCreateParams.Recurring.Interval,
            interval_count: plan.recurring_interval_count,
          },
        });

        await pool.query(
          `UPDATE subscription_plans SET stripe_product_id = $1, stripe_price_id = $2, updated_at = NOW() WHERE id = $3`,
          [product.id, price.id, planId],
        );

        console.log(`  Stripe synced: product=${product.id}, price=${price.id}`);
      } catch (stripeError) {
        console.error(`  Failed to sync plan "${plan.name}" to Stripe:`, stripeError instanceof Error ? stripeError.message : stripeError);
        console.error('  Continuing with remaining plans...');
      }
    }

    console.log('\nSubscription plans seeded successfully!');
  } catch (error) {
    console.error('Failed to seed subscription plans:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
