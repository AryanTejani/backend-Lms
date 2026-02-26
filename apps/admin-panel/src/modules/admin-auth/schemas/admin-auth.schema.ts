import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Invalid email format')
    .max(255, 'Email must be less than 255 characters')
    .transform((email) => email.trim().toLowerCase()),
  password: z.string().min(1, 'Password is required').max(128, 'Password must be less than 128 characters'),
});

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
