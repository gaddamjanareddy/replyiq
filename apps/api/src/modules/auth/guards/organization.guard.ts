import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value import required for emitDecoratorMetadata DI
import { Reflector } from '@nestjs/core';
import type { PrismaClient } from '@replyiq/database';
import type { JwtPayload } from '../../../common/types/jwt-payload.interface.js';
import { ErrorCode } from '../../../common/errors/error-codes.js';

export const BUSINESS_KEY = 'businessId';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Tenant isolation guard (approved hardening decision).
 *
 * Runs after JwtAuthGuard. For every route that addresses an
 * organization-scoped resource via a `:businessId` path parameter, it loads
 * the owning organization directly from the database and rejects the request
 * unless it belongs to the JWT subject's organization. The client-supplied
 * `organizationId` is never trusted; only the signed token claim is used.
 *
 * Service-level `ensureAccess(...)` checks remain in place as defense in
 * depth - this guard is the outer perimeter, not the only control.
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;
    if (!user) return true;

    const businessId =
      this.reflector.get<string>(BUSINESS_KEY, context.getHandler()) ??
      request.params?.businessId;
    if (!businessId) return true;

    if (!UUID_PATTERN.test(businessId)) {
      throw new ForbiddenException({ code: ErrorCode.AUTHZ_FORBIDDEN, message: 'Access denied' });
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { organizationId: true },
    });

    if (!business || business.organizationId !== user.organizationId) {
      throw new ForbiddenException({ code: ErrorCode.AUTHZ_FORBIDDEN, message: 'Access denied' });
    }
    return true;
  }
}
