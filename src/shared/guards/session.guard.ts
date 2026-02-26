import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { Errors } from '../exceptions/auth.exception';

// Forward reference to avoid circular dependency
import type { EmailAuthService } from '../../modules/auth/application/services/email-auth.service';

/**
 * Session Guard
 * Replaces authenticate middleware from src/middlewares/auth.middleware.ts
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject('EmailAuthService')
    private readonly emailAuthService: EmailAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      throw Errors.unauthorized();
    }

    const user = await this.emailAuthService.validateSession(sessionId);


    if (!user) {
      throw Errors.sessionInvalid();
    }

    // Attach user and sessionId to request (like Express middleware)
    request.user = user;
    request.sessionId = sessionId;

    return true;
  }

  private extractSessionId(request: Request): string | undefined {
    const cookieName = this.configService.get<string>('session.cookieName') ?? 'session_id';
    const cookies = request.cookies as Record<string, string> | undefined;


    return cookies?.[cookieName];
  }
}

/**
 * Optional Session Guard
 * Replaces optionalAuth middleware - allows unauthenticated access
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    @Inject('EmailAuthService')
    private readonly emailAuthService: EmailAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      return true;
    }

    try {
      const user = await this.emailAuthService.validateSession(sessionId);


      if (user) {
        request.user = user;
        request.sessionId = sessionId;
      }
    } catch {
      // Invalid session - continue without user
    }

    return true;
  }

  private extractSessionId(request: Request): string | undefined {
    const cookieName = this.configService.get<string>('session.cookieName') ?? 'session_id';
    const cookies = request.cookies as Record<string, string> | undefined;


    return cookies?.[cookieName];
  }
}
