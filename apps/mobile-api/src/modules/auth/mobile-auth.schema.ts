import { z } from 'zod';
import { emailSchema } from '../../../../main-panel/src/modules/auth/schemas/auth.schema';

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
    email: emailSchema,
    password: z.string().min(12, 'Password must be at least 12 characters'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
