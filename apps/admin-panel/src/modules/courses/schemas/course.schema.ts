import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(50000).optional(),
  thumbnail_url: z.string().url().max(1000).optional(),
});

export const updateCourseSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  thumbnail_url: z.string().url().max(1000).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export type CreateCourseInput = z.infer<typeof createCourseSchema>;
export type UpdateCourseInput = z.infer<typeof updateCourseSchema>;
