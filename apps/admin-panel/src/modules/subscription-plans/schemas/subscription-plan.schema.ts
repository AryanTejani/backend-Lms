import { z } from 'zod';

export const createSubscriptionPlanSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  slug: z.string().max(255).optional(),
  description: z.string().max(5000).optional(),
  amount_cents: z.number().int().min(0, 'Amount must be non-negative'),
  currency: z.string().length(3).default('inr').optional(),
  recurring_interval: z.enum(['day', 'week', 'month', 'year']),
  recurring_interval_count: z.number().int().min(1).default(1).optional(),
  trial_days: z.number().int().min(0).default(0).optional(),
  is_active: z.boolean().default(true).optional(),
});

export const updateSubscriptionPlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().max(255).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  amount_cents: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  recurring_interval: z.enum(['day', 'week', 'month', 'year']).optional(),
  recurring_interval_count: z.number().int().min(1).optional(),
  trial_days: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export type CreateSubscriptionPlanInput = z.infer<typeof createSubscriptionPlanSchema>;
export type UpdateSubscriptionPlanInput = z.infer<typeof updateSubscriptionPlanSchema>;
