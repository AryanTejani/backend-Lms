import { Injectable } from '@nestjs/common';
import { CacheService } from '@app/shared/cache/cache.service';
import { AuthenticatedAdmin } from '../types/admin-auth.types';
import { CachedAdminSession } from '@app/shared/cache/cache.service';

/**
 * Admin Session Cache Service
 * Handles Redis session caching for staff sessions
 */
@Injectable()
export class AdminSessionCacheService {
  constructor(private readonly cacheService: CacheService) {}

  async get(sessionId: string): Promise<CachedAdminSession | null> {
    return this.cacheService.getCachedAdminSession(sessionId);
  }

  async set(sessionId: string, staffId: string, user: AuthenticatedAdmin): Promise<void> {
    return this.cacheService.cacheAdminSession(sessionId, staffId, user);
  }

  async invalidate(sessionId: string): Promise<void> {
    return this.cacheService.invalidateCachedAdminSession(sessionId);
  }

  async invalidateAllForStaff(staffId: string): Promise<number> {
    return this.cacheService.invalidateAllAdminSessions(staffId);
  }
}
