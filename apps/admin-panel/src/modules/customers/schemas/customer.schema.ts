import { z } from 'zod';

export const updateCustomerEmailSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .transform((email) => email.trim().toLowerCase()),
});

export type UpdateCustomerEmailInput = z.infer<typeof updateCustomerEmailSchema>;

export const refundOrderSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('full'),
    order_year: z.number().int().min(2020).max(2099),
    reason: z.string().optional(),
  }),
  z.object({
    type: z.literal('partial'),
    order_year: z.number().int().min(2020).max(2099),
    amount_cents: z.number().int().positive('Refund amount must be positive'),
    reason: z.string().optional(),
  }),
]);

export type RefundOrderInput = z.infer<typeof refundOrderSchema>;

export const cancelSubscriptionSchema = z.object({
  cancel_at_period_end: z.boolean(),
  reason: z.string().optional(),
});

export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
