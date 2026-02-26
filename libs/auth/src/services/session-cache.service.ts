import { Injectable } from '@nestjs/common';
import { CacheService, AuthenticatedUser, CachedSession } from '@app/shared/cache/cache.service';

/**
 * Session Cache Service
 * Handles Redis session caching operations
 * Extracted for single responsibility
 */
@Injectable()
export class SessionCacheService {
  constructor(private readonly cacheService: CacheService) {}

  async get(sessionId: string): Promise<CachedSession | null> {
    return this.cacheService.getCachedSession(sessionId);
  }

  async set(sessionId: string, customerId: string, user: AuthenticatedUser): Promise<void> {
    return this.cacheService.cacheSession(sessionId, customerId, user);
  }

  async invalidate(sessionId: string): Promise<void> {
    return this.cacheService.invalidateCachedSession(sessionId);
  }

  async invalidateAllForCustomer(customerId: string): Promise<number> {
    return this.cacheService.invalidateAllCustomerSessions(customerId);
  }
}
