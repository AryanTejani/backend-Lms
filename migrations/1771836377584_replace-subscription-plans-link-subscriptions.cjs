exports.up = (pgm) => {
  // 1. Delete the 6 old plans (0 FK references — safe)
  pgm.sql(`
    DELETE FROM subscription_plans
    WHERE slug IN (
      'foundations-bundle',
      'global-trend-alert',
      'the-tml-talk',
      'tl-research',
      'the-weekly-playbook',
      'trade-lab-with-richard-moglen'
    )
    AND stripe_product_id IS NULL
  `);

  // 2. Create 5 new subscription plans (matching the 5 subscription services)
  pgm.sql(`
    INSERT INTO subscription_plans (id, name, slug, description, amount_cents, currency, recurring_interval, recurring_interval_count, trial_days, is_active, is_archived)
    VALUES
      (uuidv7(), 'Trade Lab with Richard Moglen', 'trade-lab-with-richard-moglen', 'Annual subscription to Trade Lab with Richard Moglen', 74500, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'The TML Talk', 'the-tml-talk', 'Annual subscription to The TML Talk with Ross Haber', 49900, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'Global Trend Alert', 'global-trend-alert', 'Annual subscription to Global Trend Alert by Stan Weinstein', 1000000, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'TL Research', 'tl-research', 'Annual subscription to TL Research', 49000, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'The Weekly Playbook', 'the-weekly-playbook', 'Annual subscription to The Weekly Playbook', 25000, 'usd', 'year', 1, 0, true, false)
  `);

  // 3. Link plans to their products via subscription_plan_products
  //    Each plan may have multiple price-tier products (e.g., Trade Lab has $745/yr and $70/mo)
  pgm.sql(`
    INSERT INTO subscription_plan_products (id, plan_id, product_id)
    SELECT uuidv7(), sp.id, p.id
    FROM subscription_plans sp
    JOIN products p ON p.product_slug = sp.slug AND p.is_recurring = true
    WHERE sp.slug IN ('trade-lab-with-richard-moglen', 'the-tml-talk', 'global-trend-alert', 'tl-research', 'the-weekly-playbook')
    ON CONFLICT (plan_id, product_id) DO NOTHING
  `);

  // 4. Link existing subscriptions to their correct plans
  //    Match via legacy_product_id -> product -> plan (through subscription_plan_products)
  pgm.sql(`
    UPDATE subscriptions s
    SET plan_id = spp.plan_id
    FROM subscription_plan_products spp
    WHERE spp.product_id = s.legacy_product_id
      AND s.plan_id IS NULL
  `);
};

exports.down = (pgm) => {
  // 1. Unlink subscriptions from plans
  pgm.sql(`
    UPDATE subscriptions
    SET plan_id = NULL
    WHERE plan_id IN (
      SELECT id FROM subscription_plans
      WHERE slug IN ('trade-lab-with-richard-moglen', 'the-tml-talk', 'global-trend-alert', 'tl-research', 'the-weekly-playbook')
      AND stripe_product_id IS NULL
    )
  `);

  // 2. Remove subscription_plan_products links
  pgm.sql(`
    DELETE FROM subscription_plan_products
    WHERE plan_id IN (
      SELECT id FROM subscription_plans
      WHERE slug IN ('trade-lab-with-richard-moglen', 'the-tml-talk', 'global-trend-alert', 'tl-research', 'the-weekly-playbook')
      AND stripe_product_id IS NULL
    )
  `);

  // 3. Delete the 5 new plans
  pgm.sql(`
    DELETE FROM subscription_plans
    WHERE slug IN ('trade-lab-with-richard-moglen', 'the-tml-talk', 'global-trend-alert', 'tl-research', 'the-weekly-playbook')
    AND stripe_product_id IS NULL
  `);

  // 4. Recreate the 6 old plans (without Stripe IDs)
  pgm.sql(`
    INSERT INTO subscription_plans (id, name, slug, description, amount_cents, currency, recurring_interval, recurring_interval_count, trial_days, is_active, is_archived)
    VALUES
      (uuidv7(), 'Foundations Bundle', 'foundations-bundle', NULL, 49975, 'usd', 'month', 1, 0, true, false),
      (uuidv7(), 'Global Trend Alert', 'global-trend-alert', NULL, 1000000, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'The TML Talk', 'the-tml-talk', NULL, 49900, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'TL Research', 'tl-research', NULL, 49000, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'The Weekly Playbook', 'the-weekly-playbook', NULL, 25000, 'usd', 'year', 1, 0, true, false),
      (uuidv7(), 'Trade Lab with Richard Moglen', 'trade-lab-with-richard-moglen', NULL, 74500, 'usd', 'year', 1, 0, true, false)
  `);
};
