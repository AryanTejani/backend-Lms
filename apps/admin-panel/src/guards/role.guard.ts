import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Errors } from '@app/shared/exceptions/auth.exception';

export const ROLES_KEY = 'roles';

/**
 * @Roles() Decorator
 * Sets required roles for a route or controller
 */
export const Roles = (...roles: Array<'admin' | 'instructor'>) => {
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): void => {
    if (descriptor) {
      Reflect.defineMetadata(ROLES_KEY, roles, descriptor.value as object);
    } else {
      Reflect.defineMetadata(ROLES_KEY, roles, target);
    }
  };
};

/**
 * Role Guard
 * Checks if the authenticated admin has the required role
 * Must be used after AdminSessionGuard
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Array<'admin' | 'instructor'>>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.adminUser;

    if (!user) {
      throw Errors.unauthorized();
    }

    if (!requiredRoles.includes(user.role)) {
      throw Errors.insufficientRole();
    }

    return true;
  }
}
