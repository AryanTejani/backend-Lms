import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * AuthenticatedUser interface
 */
export interface AuthenticatedUser {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
}

/**
 * @CurrentUser() Decorator
 * Extracts the authenticated user from the request
 */
export const CurrentUser = createParamDecorator(
    (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | string | null | undefined => {
        const request = ctx.switchToHttp().getRequest<Request>();
        const user = request.user as AuthenticatedUser | undefined;

        // If a specific property is requested, return just that
        if (data && user) {
            return user[data];
        }

        return user;
    },
);

/**
 * @SessionId() Decorator
 * Extracts the session ID from the request
 */
export const SessionId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();

    return request.sessionId;
});

// Extend Express Request interface
declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
            sessionId?: string;
        }
    }
}
