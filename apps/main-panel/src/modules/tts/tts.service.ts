import { Injectable, Logger } from '@nestjs/common';
import { Communicate } from 'edge-tts-universal';

const VOICE_MAP: Record<string, { male: string; female: string }> = {
  'hi-IN': { male: 'hi-IN-MadhurNeural', female: 'hi-IN-SwaraNeural' },
  'te-IN': { male: 'te-IN-MohanNeural', female: 'te-IN-ShrutiNeural' },
  'ta-IN': { male: 'ta-IN-ValluvarNeural', female: 'ta-IN-PallaviNeural' },
  'bn-IN': { male: 'bn-IN-BashkarNeural', female: 'bn-IN-TanishaaNeural' },
  'en-IN': { male: 'en-IN-PrabhatNeural', female: 'en-IN-NeerjaNeural' },
};

const DEFAULT_LANG = 'en-IN';

@Injectable()
export class TtsService {
  private readonly logger = new Logger(TtsService.name);

  async synthesize(text: string, lang: string, gender: 'male' | 'female'): Promise<Buffer> {
    const voices = VOICE_MAP[lang] ?? VOICE_MAP[DEFAULT_LANG];

    if (!voices) {
      throw new Error(`No voice mapping for language: ${lang}`);
    }

    const voice = voices[gender];

    this.logger.debug(`[TTS] Synthesizing ${text.length} chars with voice=${voice} lang=${lang}`);

    const communicate = new Communicate(text, { voice });
    const chunks: Buffer[] = [];

    for await (const chunk of communicate.stream()) {
      if (chunk.type === 'audio' && chunk.data) {
        chunks.push(chunk.data);
      }
    }

    return Buffer.concat(chunks);
  }
}
