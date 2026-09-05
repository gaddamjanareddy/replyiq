import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { JwtPayload } from '../types/jwt-payload.interface.js';

/**
 * Rate limiting keyed on the authenticated **organization** rather than the
 * client IP.
 *
 * The abuse this exists to stop is one tenant driving the domain-verify
 * endpoint in a loop to make the server issue outbound requests to hosts of
 * their choosing - an amplification and internal-probing surface (FR-DOM-13).
 * A per-IP limit is the wrong boundary for that: the tenant controls their own
 * IP and can rotate it freely, while a shared office NAT would penalise
 * unrelated tenants for each other's usage.
 *
 * Unauthenticated requests fall back to IP, so the guard is still meaningful if
 * it is ever applied to a public route.
 */
@Injectable()
export class OrgThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as JwtPayload | undefined;
    if (user?.organizationId) {
      return `org:${user.organizationId}`;
    }
    const ip =
      (req.ip as string | undefined) ??
      ((req.ips as string[] | undefined)?.[0]) ??
      'unknown';
    return `ip:${ip}`;
  }
}
