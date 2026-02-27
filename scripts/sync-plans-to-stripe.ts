/**
 * Sync Subscription Plans to Stripe
 *
 * Reads all subscription_plans from the DB that are missing Stripe IDs
 * (stripe_price_id IS NULL AND amount_cents > 0), creates a Stripe Product +
 * recurring Price for each, then writes the IDs back.
 *
 * Usage:
 *   npx tsx scripts/sync-plans-to-stripe.ts
 *
 * Environment variables (reads .env automatically):
 *   DATABASE_URL          - PostgreSQL connection string
 *   STRIPE_SECRET_KEY     - Stripe API key
 */

import 'dotenv/config';
import pg from 'pg';
import Stripe from 'stripe';

const { Pool } = pg;

async function main(): Promise<void> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

  if (!stripeSecretKey) {
    console.error('STRIPE_SECRET_KEY environment variable is required');
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  });

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Find plans that need syncing: no stripe_price_id AND paid (amount > 0)
    const { rows: plans } = await pool.query<{
      id: string;
      name: string;
      description: string | null;
      amount_cents: string;
      currency: string;
      recurring_interval: string;
      recurring_interval_count: number;
    }>(
      `SELECT id, name, description, amount_cents, currency, recurring_interval, recurring_interval_count
       FROM subscription_plans
       WHERE stripe_price_id IS NULL AND amount_cents > 0 AND is_archived = false
       ORDER BY amount_cents ASC`,
    );

    if (plans.length === 0) {
      console.log('All paid plans already have Stripe IDs. Nothing to sync.');
      return;
    }

    console.log(`Found ${plans.length} plan(s) to sync to Stripe:\n`);

    for (const plan of plans) {
      const amountCents = parseInt(plan.amount_cents, 10);
      const label = `${plan.name} (${amountCents} ${plan.currency}/${plan.recurring_interval})`;

      console.log(`Syncing: ${label}`);

      const product = await stripe.products.create({
        name: plan.name,
        ...(plan.description && { description: plan.description }),
        metadata: { plan_id: plan.id },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amountCents,
        currency: plan.currency,
        recurring: {
          interval: plan.recurring_interval as Stripe.PriceCreateParams.Recurring.Interval,
          interval_count: plan.recurring_interval_count,
        },
      });

      await pool.query(
        `UPDATE subscription_plans
         SET stripe_product_id = $1, stripe_price_id = $2, updated_at = NOW()
         WHERE id = $3`,
        [product.id, price.id, plan.id],
      );

      console.log(`  -> product=${product.id}  price=${price.id}\n`);
    }

    console.log('Done! All plans synced to Stripe.');
  } catch (error) {
    console.error('Sync failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
