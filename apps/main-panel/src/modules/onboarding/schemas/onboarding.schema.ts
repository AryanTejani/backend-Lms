import { z } from 'zod';

export const saveOnboardingSchema = z.object({
  languagePreference: z.string().min(2).max(5).nullable(),
  age: z.number().int().min(5).max(99).nullable().optional(),
  grade: z.string().max(100).nullable().optional(),
  subjects: z.array(z.string().max(100)).default([]),
  learningGoals: z.array(z.string().max(200)).default([]),
});

export const updatePreferenceSchema = z.object({
  languagePreference: z.string().min(2).max(5),
});

export type SaveOnboardingInput = z.infer<typeof saveOnboardingSchema>;
export type UpdatePreferenceInput = z.infer<typeof updatePreferenceSchema>;
