import { z } from 'zod';

export const ttsRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  lang: z.string().min(2).max(10),
  gender: z.enum(['male', 'female']),
});

export type TtsRequestInput = z.infer<typeof ttsRequestSchema>;
