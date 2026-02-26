import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * AuthenticatedAdmin interface
 */
export interface AuthenticatedAdmin {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'instructor';
}

/**
 * @CurrentAdmin() Decorator
 * Extracts the authenticated admin from the request
 */
export const CurrentAdmin = createParamDecorator(
  (data: keyof AuthenticatedAdmin | undefined, ctx: ExecutionContext): AuthenticatedAdmin | string | null | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.adminUser as AuthenticatedAdmin | undefined;

    if (data && user) {
      return user[data];
    }

    return user;
  },
);

/**
 * @AdminSessionId() Decorator
 * Extracts the admin session ID from the request
 */
export const AdminSessionId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<Request>();

  return request.adminSessionId;
});

// Extend Express Request interface for admin
declare global {
  namespace Express {
    interface Request {
      adminUser?: AuthenticatedAdmin;
      adminSessionId?: string;
    }
  }
}
