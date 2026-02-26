import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '@app/shared/decorators/public.decorator';
import { Errors } from '@app/shared/exceptions/auth.exception';
import type { AdminAuthService } from '@app/auth/services/admin-auth.service';

/**
 * Admin Session Guard
 * Validates admin sessions from httpOnly cookies
 */
@Injectable()
export class AdminSessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    @Inject('AdminAuthService')
    private readonly adminAuthService: AdminAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = this.extractSessionId(request);

    if (!sessionId) {
      throw Errors.unauthorized();
    }

    const user = await this.adminAuthService.validateSession(sessionId);

    if (!user) {
      throw Errors.sessionInvalid();
    }

    request.adminUser = user;
    request.adminSessionId = sessionId;

    return true;
  }

  private extractSessionId(request: Request): string | undefined {
    const cookieName = this.configService.get<string>('session.cookieName') ?? 'admin_session_id';
    const cookies = request.cookies as Record<string, string> | undefined;

    return cookies?.[cookieName];
  }
}
