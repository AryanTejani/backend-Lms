import { Injectable, CanActivate, ExecutionContext, SetMetadata, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { CacheService } from '../cache/cache.service';

// Metadata key for throttle options
export const THROTTLE_KEY = 'throttle';

// Throttle options interface
export interface ThrottleOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
  failOpen?: boolean;
}

/**
 * Throttle Decorator
 * Applies rate limiting to a route
 */
export const Throttle = (options: ThrottleOptions): ReturnType<typeof SetMetadata> => SetMetadata(THROTTLE_KEY, options);

/**
 * Throttle Guard
 * Replaces rateLimit.middleware.ts from Express
 * Preserves the Lua script-based rate limiting
 */
@Injectable()
export class ThrottleGuard implements CanActivate {
  private readonly logger = new Logger(ThrottleGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const throttleOptions = this.reflector.getAllAndOverride<ThrottleOptions | undefined>(THROTTLE_KEY, [context.getHandler(), context.getClass()]);

    // No throttle options means no rate limiting
    if (!throttleOptions) {
      return true;
    }

    const { windowMs, max, keyPrefix = 'rl', message = 'Too many requests, please try again later' } = throttleOptions;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const key = this.generateKey(request, keyPrefix);

    try {
      const result = await this.cacheService.checkAndIncrementRateLimit(key, max, windowMs);

      // Set rate limit headers
      response.setHeader('X-RateLimit-Limit', max);
      response.setHeader('X-RateLimit-Remaining', result.remaining);
      response.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt.getTime() / 1000));

      if (!result.allowed) {
        response.setHeader('Retry-After', Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
        response.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message,
            retryAfter: result.resetAt.toISOString(),
          },
        });

        return false;
      }

      return true;
    } catch (error) {
      this.logger.warn(`Rate limit check failed: ${error instanceof Error ? error.message : error}`);

      return throttleOptions.failOpen !== false;
    }
  }

  private generateKey(request: Request, prefix: string): string {
    // Use user ID if authenticated, otherwise use IP
    const identifier = (request as Record<string, any>).user?.id ?? request.ip ?? 'unknown';

    return `${prefix}:${identifier}`;
  }
}

/**
 * Pre-configured throttle options (matches rateLimiters.ts)
 */
export const ThrottlePresets = {
  login: {
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    keyPrefix: 'login',
    message: 'Too many login attempts, please try again later',
    failOpen: false,
  },
  signup: {
    windowMs: 60 * 1000,
    max: 3,
    keyPrefix: 'signup',
    message: 'Too many signup attempts, please try again later',
    failOpen: false,
  },
  forgotPassword: {
    windowMs: 60 * 1000,
    max: 3,
    keyPrefix: 'forgot-password',
    message: 'Too many password reset requests, please try again later',
    failOpen: false,
  },
  resetPassword: {
    windowMs: 60 * 1000,
    max: 3,
    keyPrefix: 'reset-password',
    message: 'Too many password reset attempts, please try again later',
    failOpen: false,
  },
} as const;
