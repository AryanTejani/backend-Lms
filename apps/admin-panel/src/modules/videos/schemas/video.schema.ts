import { z } from 'zod';

export const createVideoSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  library_type: z.enum(['public', 'private']).default('private').optional(),
});

export const updateVideoSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const fetchVideoSchema = z.object({
  url: z.string().url().min(1, 'URL is required'),
  headers: z.record(z.string(), z.string()).optional(),
  title: z.string().optional(),
});

export const addCaptionSchema = z.object({
  label: z.string().optional(),
  captionsFile: z.string().optional(),
});

export const setThumbnailUrlSchema = z.object({
  thumbnailUrl: z.string().url('Invalid URL'),
});

export const syncVideosSchema = z.object({
  instructor_id: z.string().uuid('Invalid instructor ID'),
});

export type SyncVideosInput = z.infer<typeof syncVideosSchema>;
export type CreateVideoInput = z.infer<typeof createVideoSchema>;
export type UpdateVideoInput = z.infer<typeof updateVideoSchema>;
export type FetchVideoInput = z.infer<typeof fetchVideoSchema>;
export type AddCaptionInput = z.infer<typeof addCaptionSchema>;
export type SetThumbnailUrlInput = z.infer<typeof setThumbnailUrlSchema>;
