import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@/shared/cache/cache.service';
import { SessionRepository } from '../auth/infrastructure/persistence/session.repository';

// Batch size for cleanup queries (delete in batches to avoid long-running transactions)
const BATCH_SIZE = 1000;

// Lock key for distributed lock
const CLEANUP_LOCK_KEY = 'session-cleanup-lock';

/**
 * Session Cleanup Service
 * Preserves functionality from src/jobs/sessionCleanup.ts
 * Uses @nestjs/schedule for cron jobs with distributed locking
 */
@Injectable()
export class SessionCleanupService implements OnModuleInit {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    // Run cleanup on startup (fire-and-forget)
    void this.runCleanupWithLogging();
  }

  /**
   * Run session cleanup every hour
   * Uses distributed lock for multi-instance safety
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runScheduledCleanup(): Promise<void> {
    await this.runCleanupWithLogging();
  }

  private async runCleanupWithLogging(): Promise<void> {
    // Acquire distributed lock (prevents multiple instances from running)
    const acquired = await this.cacheService.set(
      CLEANUP_LOCK_KEY,
      process.pid.toString(),
      'NX',
      'EX',
      300, // Lock expires after 5 minutes
    );

    if (!acquired) {
      this.logger.debug('Skipping session cleanup - another instance is running');

      return;
    }

    try {
      const result = await this.cleanupSessions();
      const total = result.deletedRevoked + result.deletedExpired;

      if (total > 0) {
        this.logger.log(
          `Session cleanup completed: ${result.deletedRevoked} revoked, ${result.deletedExpired} expired`,
        );
      }
    } catch (error) {
      this.logger.error('Session cleanup failed:', error);
    } finally {
      // Release lock
      await this.cacheService.del(CLEANUP_LOCK_KEY);
    }
  }

  /**
   * Clean up old sessions
   * 1. Delete revoked sessions older than retention period
   * 2. Delete expired sessions (older than max age + buffer)
   */
  async cleanupSessions(): Promise<{ deletedRevoked: number; deletedExpired: number }> {
    const retentionDays = this.configService.get<number>('session.revokedRetentionDays') ?? 7;
    const maxAgeDays = this.configService.get<number>('session.maxAgeDays') ?? 30;

    // Delete old revoked sessions in batches
    const deletedRevoked = await this.sessionRepository.cleanupRevoked(
      retentionDays,
      BATCH_SIZE,
    );

    // Delete expired sessions (past max age, even if not explicitly revoked)
    const deletedExpired = await this.sessionRepository.cleanupExpired(
      maxAgeDays,
      BATCH_SIZE,
    );

    return { deletedRevoked, deletedExpired };
  }
}
