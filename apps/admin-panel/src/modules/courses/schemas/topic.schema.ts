import { z } from 'zod';

export const createTopicSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(500),
    topic_type: z.enum(['video', 'text']),
    lesson_id: z.string().uuid(),
    section_id: z.string().uuid(),
    content: z.string().max(500000).optional(),
    video_id: z.string().uuid().optional(),
    duration: z.number().int().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.topic_type === 'video') {
        return !!data.video_id;
      }

      if (data.topic_type === 'text') {
        return !!data.content;
      }

      return true;
    },
    { message: 'Video topics require video_id; text topics require content' },
  );

export const updateTopicSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500000).nullable().optional(),
  video_id: z.string().uuid().nullable().optional(),
  topic_type: z.enum(['video', 'text']).optional(),
  duration: z.number().int().min(0).nullable().optional(),
  lesson_id: z.string().uuid().optional(),
  is_published: z.boolean().optional(),
});

export const reorderTopicsSchema = z.object({
  topic_ids: z.array(z.string().uuid()).min(1),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
export type ReorderTopicsInput = z.infer<typeof reorderTopicsSchema>;
