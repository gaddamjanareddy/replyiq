import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value import required for emitDecoratorMetadata DI
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@replyiq/database';
import type { JwtPayload } from '../../../common/types/jwt-payload.interface.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    return !!user && requiredRoles.includes(user.role);
  }
}
