import { Controller, Post, Body, UseGuards, Res, Logger } from '@nestjs/common';
import { Response } from 'express';
import { SessionGuard } from '../../guards/session.guard';
import { Errors } from '@app/shared/exceptions/auth.exception';
import { TtsService } from './tts.service';
import { ttsRequestSchema } from './schemas/tts.schema';

@Controller('tts')
@UseGuards(SessionGuard)
export class TtsController {
  private readonly logger = new Logger(TtsController.name);

  constructor(private readonly ttsService: TtsService) {}

  @Post('speak')
  async speak(@Body() body: unknown, @Res() res: Response): Promise<void> {
    const result = ttsRequestSchema.safeParse(body);

    if (!result.success) {
      this.logger.error(`[POST /tts/speak] Validation failed: ${JSON.stringify(result.error.issues)}`);

      throw Errors.validationError(result.error.issues[0]?.message ?? 'Validation failed');
    }

    const { text, lang, gender } = result.data;

    try {
      const audio = await this.ttsService.synthesize(text, lang, gender);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audio.length);
      res.setHeader('Cache-Control', 'no-cache');
      res.end(audio);
    } catch (error) {
      this.logger.error(`[POST /tts/speak] TTS error: ${error instanceof Error ? error.message : String(error)}`);

      throw Errors.validationError('Failed to generate speech. Please try again.');
    }
  }
}
