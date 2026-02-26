import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { SessionGuard } from '../../guards/session.guard';

@Module({
  imports: [AuthDomainModule],
  controllers: [TtsController],
  providers: [TtsService, SessionGuard],
})
export class TtsModule {}
