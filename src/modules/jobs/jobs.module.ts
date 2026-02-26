import { Module } from '@nestjs/common';
import { SessionCleanupService } from './session-cleanup.service';
import { AuthModule } from '../auth/auth.module';

/**
 * Jobs Module
 * Contains scheduled background jobs
 */
@Module({
  imports: [AuthModule],
  providers: [SessionCleanupService],
})
export class JobsModule {}
