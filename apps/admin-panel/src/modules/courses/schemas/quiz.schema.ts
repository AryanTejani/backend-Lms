import { z } from 'zod';

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(50000).optional(),
  passing_percentage: z.number().int().min(0).max(100).optional(),
  time_limit_seconds: z.number().int().min(0).optional(),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  passing_percentage: z.number().int().min(0).max(100).optional(),
  time_limit_seconds: z.number().int().min(0).nullable().optional(),
  is_published: z.boolean().optional(),
});

export const reorderQuizzesSchema = z.object({
  quiz_ids: z.array(z.string().uuid()).min(1),
});

export const createQuestionSchema = z.object({
  question_text: z.string().min(1, 'Question text is required').max(50000),
  question_type: z.enum(['single', 'multiple']).optional(),
  points: z.number().int().min(0).optional(),
  hint: z.string().max(5000).optional(),
});

export const updateQuestionSchema = z.object({
  question_text: z.string().min(1).max(50000).optional(),
  question_type: z.enum(['single', 'multiple']).optional(),
  points: z.number().int().min(0).optional(),
  hint: z.string().max(5000).nullable().optional(),
});

export const reorderQuestionsSchema = z.object({
  question_ids: z.array(z.string().uuid()).min(1),
});

export const createOptionSchema = z.object({
  option_text: z.string().min(1, 'Option text is required').max(10000),
  is_correct: z.boolean().optional(),
});

export const updateOptionSchema = z.object({
  option_text: z.string().min(1).max(10000).optional(),
  is_correct: z.boolean().optional(),
});

export const reorderOptionsSchema = z.object({
  option_ids: z.array(z.string().uuid()).min(1),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type ReorderQuizzesInput = z.infer<typeof reorderQuizzesSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;
export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;
export type ReorderOptionsInput = z.infer<typeof reorderOptionsSchema>;
