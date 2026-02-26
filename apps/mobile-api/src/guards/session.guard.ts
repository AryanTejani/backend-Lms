import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '@app/shared/decorators/public.decorator';
import { Errors } from '@app/shared/exceptions/auth.exception';

// Forward reference to avoid circular dependency
import type { CustomerAuthService } from '@app/auth/services/customer-auth.service';

/**
 * Session Guard for Mobile API
 * Supports both standard cookies and Authorization header
 */
@Injectable()
export class SessionGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly configService: ConfigService,
        @Inject('CustomerAuthService')
        private readonly customerAuthService: CustomerAuthService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Check if route is marked as public
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

        if (isPublic) {
            return true;
        }

        const request = context.switchToHttp().getRequest<Request>();
        const sessionId = this.extractSessionId(request);

        if (!sessionId) {
            throw Errors.unauthorized();
        }

        const user = await this.customerAuthService.validateSession(sessionId);

        if (!user) {
            throw Errors.sessionInvalid();
        }

        // Attach user and sessionId to request
        request.user = user;
        request.sessionId = sessionId;

        return true;
    }

    private extractSessionId(request: Request): string | undefined {
        // 1. Check cookies (for web-based mobile views or standard browser testing)
        const cookieName = this.configService.get<string>('session.cookieName') ?? 'session_id';
        const cookies = request.cookies as Record<string, string> | undefined;
        const cookieSessionId = cookies?.[cookieName];

        if (cookieSessionId) return cookieSessionId;

        // 2. Check Authorization header (standard for mobile apps)
        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return undefined;
    }
}

/**
 * Optional Session Guard
 * Allows unauthenticated access but extracts user if session exists
 */
@Injectable()
export class OptionalSessionGuard implements CanActivate {
    constructor(
        private readonly configService: ConfigService,
        @Inject('CustomerAuthService')
        private readonly customerAuthService: CustomerAuthService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const sessionId = this.extractSessionId(request);

        if (!sessionId) {
            return true;
        }

        try {
            const user = await this.customerAuthService.validateSession(sessionId);

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
        const cookieSessionId = cookies?.[cookieName];

        if (cookieSessionId) return cookieSessionId;

        const authHeader = request.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }

        return undefined;
    }
}
