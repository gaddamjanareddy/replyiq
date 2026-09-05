import { describe, it, expect, vi } from 'vitest';
import { RolesGuard } from './roles.guard.js';
import type { ExecutionContext } from '@nestjs/common';
import type { UserRole } from '@replyiq/database';

function makeContext(options: {
  requiredRoles?: UserRole[];
  userRole?: UserRole;
}): { context: ExecutionContext; reflector: { getAllAndOverride: ReturnType<typeof vi.fn> } } {
  const reflector = { getAllAndOverride: vi.fn(() => options.requiredRoles) };
  const request = { user: options.userRole ? { role: options.userRole } : undefined };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('RolesGuard (approved D-07 matrix)', () => {
  it('allows any authenticated user when no @Roles metadata is present', () => {
    const { context, reflector } = makeContext({ requiredRoles: undefined });
    const guard = new RolesGuard(reflector as never);
    const request = context.switchToHttp().getRequest() as { user?: unknown };

    expect(guard.canActivate(context)).toBe(true);

    // Even with no user at all the guard defers to the auth pipeline.
    request.user = undefined;
    expect(guard.canActivate(context)).toBe(true);
  });

  it.each<UserRole>(['OWNER', 'ADMIN'])('allows %s on mutation endpoints', (role) => {
    const { context, reflector } = makeContext({ requiredRoles: ['OWNER', 'ADMIN'], userRole: role });
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('denies MANAGER on OWNER/ADMIN-only endpoints', () => {
    const { context, reflector } = makeContext({ requiredRoles: ['OWNER', 'ADMIN'], userRole: 'MANAGER' });
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('denies unauthenticated requests when roles are required', () => {
    const { context, reflector } = makeContext({ requiredRoles: ['OWNER'] });
    const guard = new RolesGuard(reflector as never);
    expect(guard.canActivate(context)).toBe(false);
  });

  it('enforces single-role requirements exactly', () => {
    for (const [required, acting, expected] of [
      ['OWNER', 'OWNER', true],
      ['OWNER', 'ADMIN', false],
      ['MANAGER', 'MANAGER', true],
      ['MANAGER', 'ADMIN', false],
    ] as const) {
      const { context, reflector } = makeContext({
        requiredRoles: [required as UserRole],
        userRole: acting as UserRole,
      });
      const guard = new RolesGuard(reflector as never);
      expect(guard.canActivate(context)).toBe(expected);
    }
  });
});
