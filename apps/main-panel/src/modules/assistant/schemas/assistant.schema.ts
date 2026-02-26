import { z } from 'zod';

export const chatRequestSchema = z.object({
  tutorProfile: z.string().min(1).max(100),
  message: z.string().min(1).max(5000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'model']),
        text: z.string(),
      }),
    )
    .default([]),
  language: z.string().min(2).max(10).default('en'),
  image: z
    .object({
      base64: z.string().max(6_000_000),
      mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    })
    .optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

export const quizRequestSchema = z.object({
  tutorProfile: z.string().min(1).max(100),
  topic: z.string().min(1).max(500),
  language: z.string().min(2).max(10).default('en'),
});

export type QuizRequestInput = z.infer<typeof quizRequestSchema>;

export const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctIndex: z.number().int().min(0),
});

export const quizResponseSchema = z.object({
  title: z.string(),
  questions: z.array(quizQuestionSchema).min(1).max(10),
});

export type QuizResponse = z.infer<typeof quizResponseSchema>;
