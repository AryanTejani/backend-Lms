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
  language_preference: string;
  onboarding_completed: boolean;
}

/**
 * @CurrentUser() Decorator
 * Extracts the authenticated user from the request
 * Replaces req.user access pattern from Express
 *
 * Usage:
 * @Get('me')
 * getProfile(@CurrentUser() user: AuthenticatedUser) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext): AuthenticatedUser | string | boolean | null | undefined => {
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
 * Replaces req.sessionId access pattern from Express
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
