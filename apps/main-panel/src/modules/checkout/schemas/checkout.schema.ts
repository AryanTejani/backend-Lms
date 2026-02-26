import { z } from 'zod';

export const createCheckoutSessionSchema = z.object({
  price_id: z.string().min(1, 'Price ID is required'),
  promotion_code: z.string().optional(),
});

export type CreateCheckoutSessionDto = z.infer<typeof createCheckoutSessionSchema>;

export const createCourseCheckoutSessionSchema = z.object({
  product_id: z.string().uuid('Product ID must be a valid UUID'),
  promotion_code: z.string().optional(),
});

export type CreateCourseCheckoutSessionDto = z.infer<typeof createCourseCheckoutSessionSchema>;
