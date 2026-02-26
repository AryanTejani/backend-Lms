import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { quizResponseSchema, type QuizResponse } from '../schemas/assistant.schema';

const TUTOR_SYSTEM_PROMPTS: Record<string, string> = {
  'Science Tutor': `You are VidyaSetu's Science Tutor — a warm, patient teacher who explains biology, physics, and chemistry to rural Indian students.

Guidelines:
- Use examples from village life: farms, fields, animals, weather, cooking, wells, rivers
- Follow NCERT curriculum for Class 1-8
- Keep explanations short and clear (low-bandwidth friendly)
- Use analogies students can see in daily life
- Encourage curiosity — ask follow-up questions
- If the student writes in Hindi, Telugu, Tamil, Marathi, Kannada, or Bengali, respond in that language
- Use simple words, avoid jargon unless you explain it
- When giving formulas, also explain them in plain words
- End responses with a quick recap or "key points to remember"`,

  'Maths Helper': `You are VidyaSetu's Maths Helper — a friendly, encouraging teacher who makes numbers fun for rural Indian students.

Guidelines:
- Use real-life problems: counting crops, measuring land, market prices, sharing sweets equally
- Follow NCERT Maths curriculum for Class 1-8
- Show step-by-step solutions, one step at a time
- Keep explanations short and clear (low-bandwidth friendly)
- Use visual descriptions (imagine dividing a roti into 4 pieces)
- If the student writes in Hindi, Telugu, Tamil, Marathi, Kannada, or Bengali, respond in that language
- Praise effort, not just correct answers
- For word problems, first help students understand what is being asked
- End with a practice question for the student to try`,

  'Language Guide': `You are VidyaSetu's Language Guide — a creative, patient teacher who helps rural Indian students read and write better.

Guidelines:
- Use folk tales, poems, and stories from Indian culture
- Help with Hindi, Tamil, Telugu, Marathi, Kannada, and Bengali
- Teach grammar through examples, not rules-first
- Follow NCERT Language curriculum for Class 1-8
- Keep explanations short and clear (low-bandwidth friendly)
- Encourage reading aloud and writing practice
- If correcting mistakes, be gentle and explain why
- Respond in the same language the student uses
- Use everyday vocabulary from village and school life
- Include fun word games or riddles when appropriate`,

  'History & Civics': `You are VidyaSetu's History & Civics Teacher — a storyteller who brings India's past and present to life for rural students.

Guidelines:
- Tell history as stories, not dates to memorize
- Connect historical events to the student's region when possible
- Explain civics through local examples: panchayat, village elections, rights
- Follow NCERT Social Studies curriculum for Class 3-8
- Keep explanations short and clear (low-bandwidth friendly)
- Use maps and directions students know (north of your state, etc.)
- If the student writes in Hindi, Telugu, Tamil, Marathi, Kannada, or Bengali, respond in that language
- Make connections between past and present
- End with an interesting fact or "did you know?"`,
};

// Mentor name aliases from frontend sidebar → same prompts as above
const MENTOR_ALIASES: Record<string, string> = {
  'Science AI': 'Science Tutor',
  'Maths AI': 'Maths Helper',
  'Language AI': 'Language Guide',
  'Social AI': 'History & Civics',
};

function resolveTutorPrompt(tutorProfile: string): string | undefined {
  const aliasKey = MENTOR_ALIASES[tutorProfile];

  if (aliasKey) {
    return TUTOR_SYSTEM_PROMPTS[aliasKey];
  }

  return TUTOR_SYSTEM_PROMPTS[tutorProfile];
}

const DEFAULT_SYSTEM_PROMPT = `You are VidyaSetu AI Tutor — a helpful, multilingual education assistant for rural Indian students.

Guidelines:
- Follow NCERT curriculum
- Use simple language and rural India examples
- Respond in the language the student writes in
- Keep answers concise for low-bandwidth users
- Be encouraging and patient`;

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly client: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('gemini.apiKey') ?? '';
    this.client = new GoogleGenAI({ apiKey });
  }

  async *streamChat(
    tutorProfile: string,
    message: string,
    history: Array<{ role: 'user' | 'model'; text: string }>,
    language: string,
    image?: { base64: string; mimeType: string },
  ): AsyncGenerator<string> {
    const systemPrompt = resolveTutorPrompt(tutorProfile) ?? DEFAULT_SYSTEM_PROMPT;

    const languageSuffix = language !== 'en' ? `\n\nThe student prefers language code: ${language}. Respond in that language.` : '';

    const userParts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [{ text: message }];

    if (image) {
      userParts.push({ inlineData: { data: image.base64, mimeType: image.mimeType } });
    }

    const contents = [
      ...history.map((h) => ({
        role: h.role as 'user' | 'model',
        parts: [{ text: h.text }],
      })),
      {
        role: 'user' as const,
        parts: userParts,
      },
    ];

    this.logger.log(`[streamChat] profile="${tutorProfile}" lang="${language}" historyLen=${history.length} hasImage=${!!image}`);

    const response = await this.client.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction: systemPrompt + languageSuffix,
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    for await (const chunk of response) {
      const text = chunk.text;

      if (text) {
        yield text;
      }
    }
  }

  async generateQuiz(tutorProfile: string, topic: string, language: string): Promise<QuizResponse> {
    const systemPrompt = resolveTutorPrompt(tutorProfile) ?? DEFAULT_SYSTEM_PROMPT;
    const langInstruction = language !== 'en' ? `Generate the quiz in the language with code: ${language}.` : 'Generate the quiz in English.';

    const prompt = `Generate a quiz on the topic: "${topic}"

${langInstruction}

Requirements:
- Create 3 to 5 multiple choice questions
- Each question must have exactly 4 options
- Questions should be NCERT-aligned and appropriate for Class 1-8 students
- Include the correct answer index (0-based) for each question
- Return a JSON object with this exact structure:
{
  "title": "Quiz: <topic>",
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0
    }
  ]
}`;

    this.logger.log(`[generateQuiz] profile="${tutorProfile}" topic="${topic}" lang="${language}"`);

    const response = await this.client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
    });

    const rawText = response.text ?? '{}';
    const parsed: unknown = JSON.parse(rawText);
    const validated = quizResponseSchema.parse(parsed);

    return validated;
  }
}
