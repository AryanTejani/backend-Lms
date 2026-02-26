import { z } from 'zod';

export const createLessonSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(500),
    lesson_type: z.enum(['video', 'text']),
    content: z.string().max(500000).optional(),
    video_id: z.string().uuid().optional(),
    duration: z.number().int().min(0).optional(),
    section_id: z.string().uuid(),
  })
  .refine(
    (data) => {
      if (data.lesson_type === 'video') {
return !!data.video_id;
}

      if (data.lesson_type === 'text') {
return !!data.content;
}
      
return true;
    },
    { message: 'Video lessons require video_id; text lessons require content' },
  );

export const updateLessonSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().max(500000).nullable().optional(),
  video_id: z.string().uuid().nullable().optional(),
  lesson_type: z.enum(['video', 'text']).optional(),
  duration: z.number().int().min(0).nullable().optional(),
  section_id: z.string().uuid().optional(),
  is_published: z.boolean().optional(),
});

export const reorderLessonsSchema = z.object({
  lesson_ids: z.array(z.string().uuid()).min(1),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;
