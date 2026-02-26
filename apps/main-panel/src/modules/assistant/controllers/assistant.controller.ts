import { Controller, Post, Body, UseGuards, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { SessionGuard } from '../../../guards/session.guard';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { AssistantService } from '../services/assistant.service';
import { chatRequestSchema, quizRequestSchema } from '../schemas/assistant.schema';

@Controller('assistant')
@UseGuards(SessionGuard)
export class AssistantController {
  private readonly logger = new Logger(AssistantController.name);

  constructor(private readonly assistantService: AssistantService) {}

  @Post('chat')
  async chat(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const result = chatRequestSchema.safeParse(body);

    if (!result.success) {
      this.logger.error(`[POST /assistant/chat] Validation failed: ${JSON.stringify(result.error.issues)}`);

      throw Errors.validationError(result.error.issues[0]?.message ?? 'Validation failed');
    }

    const { tutorProfile, message, history, language, image } = result.data;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      const stream = this.assistantService.streamChat(tutorProfile, message, history, language, image);

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      res.write('data: [DONE]\n\n');
    } catch (error) {
      this.logger.error(`[POST /assistant/chat] Stream error: ${error instanceof Error ? error.message : String(error)}`);
      res.write(`data: ${JSON.stringify({ error: 'An error occurred while generating the response.' })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('generate-quiz')
  async generateQuiz(@Body() body: unknown): Promise<unknown> {
    const result = quizRequestSchema.safeParse(body);

    if (!result.success) {
      this.logger.error(`[POST /assistant/generate-quiz] Validation failed: ${JSON.stringify(result.error.issues)}`);

      throw Errors.validationError(result.error.issues[0]?.message ?? 'Validation failed');
    }

    const { tutorProfile, topic, language } = result.data;

    try {
      const quiz = await this.assistantService.generateQuiz(tutorProfile, topic, language);

      return quiz;
    } catch (error) {
      this.logger.error(`[POST /assistant/generate-quiz] Error: ${error instanceof Error ? error.message : String(error)}`);

      throw Errors.validationError('Failed to generate quiz. Please try again.');
    }
  }
}
