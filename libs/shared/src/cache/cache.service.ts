import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

// Key prefixes (preserved from src/modules/shared/redis.repository.ts)
const OAUTH_STATE_PREFIX = 'oauth:state:';
const RATE_LIMIT_PREFIX = 'ratelimit:';
const SESSION_CACHE_PREFIX = 'session:cache:';
const PASSWORD_RESET_TOKEN_PREFIX = 'password_reset:token:';
const PASSWORD_RESET_COOLDOWN_PREFIX = 'password_reset:cooldown:';
const ADMIN_SESSION_CACHE_PREFIX = 'admin:session:cache:';

// TTL constants
const OAUTH_STATE_TTL_SECONDS = 10 * 60; // 10 minutes

// Types
export interface CachedSession {
  customerId: string;
  user: AuthenticatedUser;
  cachedAt: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface OAuthState {
  provider: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

export interface PasswordResetTokenData {
  email: string;
  createdAt: number;
  attempts: number;
}

export interface CachedAdminSession {
  staffId: string;
  user: AuthenticatedAdmin;
  cachedAt: number;
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'instructor';
}

/**
 * Cache Service (formerly Redis Service)
 * Preserves all operations from src/modules/shared/redis.repository.ts
 * including the Lua script for rate limiting
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redis!: Redis;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const redisUrl = this.configService.get<string>('redis.url') ?? 'redis://localhost:6379';
    const redisTls = this.configService.get<boolean>('redis.tls') ?? false;

    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      connectTimeout: 10_000,
      retryStrategy(times: number): number | null {
        if (times > 5) {
          return null;
        }

        return Math.min(times * 200, 2_000);
      },
    };

    // Enable TLS for AWS ElastiCache (in-transit encryption)
    // Activated via REDIS_TLS=true env var or rediss:// URL scheme
    if (redisTls || redisUrl.startsWith('rediss://')) {
      options.tls = {};
    }

    this.redis = new Redis(redisUrl, options);

    this.redis.on('error', (err: Error) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis TCP connected');
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready (protocol handshake complete)');
    });

    try {
      await this.redis.connect();
      this.logger.log('Redis initialization complete');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.logger.error(`Failed to connect to Redis at ${redisUrl.replace(/\/\/.*@/, '//<credentials>@')}: ${message}`);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
      this.logger.log('Redis connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis connection:', error);
    }
  }

  // ==================== SESSION CACHE OPERATIONS ====================

  async getCachedSession(sessionId: string): Promise<CachedSession | null> {
    const key = `${SESSION_CACHE_PREFIX}${sessionId}`;
    const data = await this.redis.get(key);

    if (data === null) {
      return null;
    }

    return JSON.parse(data) as CachedSession;
  }

  async cacheSession(sessionId: string, customerId: string, user: AuthenticatedUser): Promise<void> {
    const key = `${SESSION_CACHE_PREFIX}${sessionId}`;
    const cacheTtl = this.configService.get<number>('session.cacheTtlSeconds') ?? 300;
    const data: CachedSession = {
      customerId,
      user,
      cachedAt: Date.now(),
    };

    await this.redis.setex(key, cacheTtl, JSON.stringify(data));
  }

  async invalidateCachedSession(sessionId: string): Promise<void> {
    const key = `${SESSION_CACHE_PREFIX}${sessionId}`;

    await this.redis.del(key);
  }

  async invalidateAllCustomerSessions(customerId: string): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;
    const pattern = `${SESSION_CACHE_PREFIX}*`;

    do {
      const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

      cursor = newCursor;

      for (const key of keys) {
        const data = await this.redis.get(key);

        if (data !== null) {
          const session = JSON.parse(data) as CachedSession;

          if (session.customerId === customerId) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  }

  // ==================== OAUTH STATE OPERATIONS ====================

  async createOAuthState(state: string, provider: string, codeVerifier: string, redirectUri: string): Promise<void> {
    const key = `${OAUTH_STATE_PREFIX}${state}`;
    const value: OAuthState = {
      provider,
      codeVerifier,
      redirectUri,
      createdAt: Date.now(),
    };

    await this.redis.setex(key, OAUTH_STATE_TTL_SECONDS, JSON.stringify(value));
  }

  async consumeOAuthState(state: string): Promise<OAuthState | null> {
    const key = `${OAUTH_STATE_PREFIX}${state}`;

    // Atomic get-and-delete (GETDEL)
    const value = await this.redis.getdel(key);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as OAuthState;
  }

  // ==================== RATE LIMITING WITH LUA SCRIPT ====================

  /**
   * Check and increment rate limit using sliding window counter
   * Preserves exact Lua script from src/modules/shared/redis.repository.ts:138-154
   */
  async checkAndIncrementRateLimit(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;
    const windowSeconds = Math.ceil(windowMs / 1000);

    // Exact Lua script from Express implementation
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      local count = tonumber(current) or 0
      local ttl = redis.call('TTL', KEYS[1])

      if count < tonumber(ARGV[1]) then
        if count == 0 then
          redis.call('SETEX', KEYS[1], ARGV[2], 1)
          ttl = tonumber(ARGV[2])
        else
          redis.call('INCR', KEYS[1])
        end
        return {1, count + 1, ttl}
      else
        return {0, count, ttl}
      end
    `;

    const result = (await this.redis.eval(luaScript, 1, redisKey, maxRequests.toString(), windowSeconds.toString())) as [number, number, number];

    const [allowed, count, ttl] = result;
    const resetAt = new Date(Date.now() + (ttl > 0 ? ttl * 1000 : windowMs));

    return {
      allowed: allowed === 1,
      remaining: Math.max(0, maxRequests - count),
      resetAt,
    };
  }

  async resetRateLimit(key: string): Promise<void> {
    const redisKey = `${RATE_LIMIT_PREFIX}${key}`;

    await this.redis.del(redisKey);
  }

  // ==================== PASSWORD RESET TOKEN OPERATIONS ====================

  async checkPasswordResetCooldown(email: string): Promise<number | null> {
    const normalizedEmail = email.toLowerCase();
    const cooldownKey = `${PASSWORD_RESET_COOLDOWN_PREFIX}${normalizedEmail}`;
    const ttl = await this.redis.ttl(cooldownKey);

    return ttl > 0 ? ttl : null;
  }

  async setPasswordResetCooldown(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const cooldownKey = `${PASSWORD_RESET_COOLDOWN_PREFIX}${normalizedEmail}`;
    const cooldownSeconds = this.configService.get<number>('passwordReset.cooldownSeconds') ?? 60;

    await this.redis.setex(cooldownKey, cooldownSeconds, '1');
  }

  async storePasswordResetToken(email: string, tokenHash: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const tokenKey = `${PASSWORD_RESET_TOKEN_PREFIX}${tokenHash}`;
    const tokenTtlMinutes = this.configService.get<number>('passwordReset.tokenTtlMinutes') ?? 60;
    const data: PasswordResetTokenData = {
      email: normalizedEmail,
      createdAt: Date.now(),
      attempts: 0,
    };

    const ttlSeconds = tokenTtlMinutes * 60;

    await this.redis.setex(tokenKey, ttlSeconds, JSON.stringify(data));
  }

  async getPasswordResetToken(tokenHash: string): Promise<PasswordResetTokenData | null> {
    const tokenKey = `${PASSWORD_RESET_TOKEN_PREFIX}${tokenHash}`;
    const value = await this.redis.get(tokenKey);

    if (value === null) {
      return null;
    }

    const data = JSON.parse(value) as PasswordResetTokenData;

    // Handle legacy tokens that don't have attempts field

    if (data.attempts === undefined) {
      data.attempts = 0;
    }

    return data;
  }

  async incrementPasswordResetAttempts(tokenHash: string): Promise<number> {
    const tokenKey = `${PASSWORD_RESET_TOKEN_PREFIX}${tokenHash}`;

    // Atomic increment via Lua to prevent race conditions
    const luaScript = `
      local value = redis.call('GET', KEYS[1])
      if not value then return -1 end
      local data = cjson.decode(value)
      data.attempts = (data.attempts or 0) + 1
      local ttl = redis.call('TTL', KEYS[1])
      if ttl > 0 then
        redis.call('SETEX', KEYS[1], ttl, cjson.encode(data))
      end
      return data.attempts
    `;

    const result = (await this.redis.eval(luaScript, 1, tokenKey)) as number;

    return result === -1 ? 0 : result;
  }

  async deletePasswordResetToken(tokenHash: string): Promise<void> {
    const tokenKey = `${PASSWORD_RESET_TOKEN_PREFIX}${tokenHash}`;

    await this.redis.del(tokenKey);
  }

  async clearPasswordResetData(email: string): Promise<void> {
    const normalizedEmail = email.toLowerCase();
    const cooldownKey = `${PASSWORD_RESET_COOLDOWN_PREFIX}${normalizedEmail}`;

    await this.redis.del(cooldownKey);
  }

  // ==================== ADMIN SESSION CACHE OPERATIONS ====================

  async getCachedAdminSession(sessionId: string): Promise<CachedAdminSession | null> {
    const key = `${ADMIN_SESSION_CACHE_PREFIX}${sessionId}`;
    const data = await this.redis.get(key);

    if (data === null) {
      return null;
    }

    return JSON.parse(data) as CachedAdminSession;
  }

  async cacheAdminSession(sessionId: string, staffId: string, user: AuthenticatedAdmin): Promise<void> {
    const key = `${ADMIN_SESSION_CACHE_PREFIX}${sessionId}`;
    const cacheTtl = this.configService.get<number>('session.cacheTtlSeconds') ?? 300;
    const data: CachedAdminSession = {
      staffId,
      user,
      cachedAt: Date.now(),
    };

    await this.redis.setex(key, cacheTtl, JSON.stringify(data));
  }

  async invalidateCachedAdminSession(sessionId: string): Promise<void> {
    const key = `${ADMIN_SESSION_CACHE_PREFIX}${sessionId}`;

    await this.redis.del(key);
  }

  async invalidateAllAdminSessions(staffId: string): Promise<number> {
    let cursor = '0';
    let deletedCount = 0;
    const pattern = `${ADMIN_SESSION_CACHE_PREFIX}*`;

    do {
      const [newCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);

      cursor = newCursor;

      for (const key of keys) {
        const data = await this.redis.get(key);

        if (data !== null) {
          const session = JSON.parse(data) as CachedAdminSession;

          if (session.staffId === staffId) {
            await this.redis.del(key);
            deletedCount++;
          }
        }
      }
    } while (cursor !== '0');

    return deletedCount;
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generic set with expiry
   */
  async set(key: string, value: string, mode: 'NX' | 'XX', expireMode: 'EX', time: number): Promise<string | null> {
    if (mode === 'NX') {
      return this.redis.set(key, value, 'EX', time, 'NX');
    }

    return this.redis.set(key, value, 'EX', time);
  }

  /**
   * Generic delete
   */
  async del(key: string): Promise<number> {
    return this.redis.del(key);
  }

  /**
   * Get underlying Redis client (for advanced use cases)
   */
  getClient(): Redis {
    return this.redis;
  }
}
