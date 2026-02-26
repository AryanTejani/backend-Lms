import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must be less than 500 characters'),
  content: z.string().min(1, 'Content is required').max(500000, 'Content must be less than 500000 characters'),
  excerpt: z.string().max(1000, 'Excerpt must be less than 1000 characters').optional(),
  coverImageUrl: z.url('Invalid URL').max(1000).optional(),
  subscriptionPlanId: z.string().uuid().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export const updatePostSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).max(500000).optional(),
  excerpt: z.string().max(1000).nullable().optional(),
  coverImageUrl: z.url('Invalid URL').max(1000).nullable().optional(),
  subscriptionPlanId: z.string().uuid().nullable().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
