import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    first_name: z.string().min(1).max(100).optional(),
    last_name: z.string().min(1).max(100).optional(),
  })
  .refine((d) => d.first_name !== undefined || d.last_name !== undefined, {
    message: 'At least one field must be provided',
  });

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export const ordersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type OrdersQueryDto = z.infer<typeof ordersQuerySchema>;

export const requestRefundSchema = z.object({
  order_id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export type RequestRefundDto = z.infer<typeof requestRefundSchema>;

export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
