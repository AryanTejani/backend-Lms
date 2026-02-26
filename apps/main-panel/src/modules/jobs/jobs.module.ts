import { Module } from '@nestjs/common';
import { AuthDomainModule } from '@app/auth';
import { SessionCleanupService } from './session-cleanup.service';

/**
 * Jobs Module
 * Contains scheduled background jobs
 */
@Module({
  imports: [AuthDomainModule],
  providers: [SessionCleanupService],
})
export class JobsModule {}
