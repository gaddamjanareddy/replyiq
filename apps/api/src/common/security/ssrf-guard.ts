import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF protection primitives for outbound fetches that target user-controlled
 * hostnames (domain ownership verification). Pure functions are exported for
 * unit testing; see domain-verification.service.ts for usage.
 *
 * Controls implemented (approved decision D-01):
 *  - scheme + port allow-list on every hop
 *  - rejection of IP-literal hostnames
 *  - DNS resolution validated against private/reserved ranges
 *  - connection pinned to a pre-validated IP (DNS rebinding protection:
 *    every resolution, including re-resolutions inside the request, passes
 *    through the same validator)
 *  - manual redirect handling with hop cap and per-hop revalidation
 *  - response size cap enforced while streaming the body
 */

export class SsrfViolationError extends Error {
  constructor(public readonly reason: string) {
    super(`SSRF protection triggered: ${reason}`);
    this.name = 'SsrfViolationError';
  }
}

export class DnsResolutionError extends Error {
  constructor(public readonly hostname: string, cause?: unknown) {
    super(`DNS resolution failed for ${hostname}`);
    this.name = 'DnsResolutionError';
    this.cause = cause;
  }
}

const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // RFC1918 private
  ['100.64.0.0', 10], // CGNAT shared address space
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local / cloud metadata
  ['172.16.0.0', 12], // RFC1918 private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.88.99.0', 24], // 6to4 relay anycast (deprecated)
  ['192.168.0.0', 16], // RFC1918 private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved / broadcast
];

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const value = Number(part);
    if (value > 255) return null;
    result = result * 256 + value;
  }
  return result;
}

function inCidr4(value: number, base: string, bits: number): boolean {
  const baseLong = ipv4ToLong(base);
  if (baseLong === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (baseLong & mask);
}

export function isPrivateIpv4(ip: string): boolean {
  const value = ipv4ToLong(ip);
  if (value === null) return true;
  return BLOCKED_IPV4_RANGES.some(([base, bits]) => inCidr4(value, base, bits));
}

/** Expand an IPv6 address to its full 32-nibble lowercase form. */
export function expandIpv6(address: string): string | null {
  if (!address.includes(':')) return null;
  let head: string[];
  let tail: string[];
  if (address.includes('::')) {
    const pieces = address.split('::');
    if (pieces.length > 2) return null;
    head = pieces[0] ? pieces[0].split(':') : [];
    tail = pieces[1] ? pieces[1].split(':') : [];
  } else {
    head = address.split(':');
    tail = [];
  }

  // Normalize a trailing dotted-quad (e.g. "::ffff:8.8.8.8") into two hex groups.
  const normalizeGroup = (group: string): string[] => {
    if (!group.includes('.')) return [group];
    const bytes = group.split('.');
    if (bytes.length !== 4 || bytes.some((b) => !/^\d{1,3}$/.test(b))) return [group];
    const values = bytes.map((b) => Number(b));
    if (values.some((v) => v > 255)) return [group];
    return [
      (((values[0] ?? 0) << 8) | (values[1] ?? 0)).toString(16),
      (((values[2] ?? 0) << 8) | (values[3] ?? 0)).toString(16),
    ];
  };
  head = head.flatMap(normalizeGroup);
  tail = tail.flatMap(normalizeGroup);

  if (head.length + tail.length > 8) return null;
  const missing = 8 - head.length - tail.length;
  const groups = [...head, ...Array<string>(missing).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const expanded = groups.map((g) => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    return g.toLowerCase().padStart(4, '0');
  });
  if (expanded.some((g) => g === null)) return null;
  return expanded.join('');
}

function embeddedIpv4(groups: string, offsetBytes: number): string | null {
  const hex = groups.slice(offsetBytes * 2, offsetBytes * 2 + 8);
  if (hex.length !== 8) return null;
  const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16));
  if (!bytes || bytes.length !== 4) return null;
  return bytes.join('.');
}

export function isPrivateIpv6(address: string): boolean {
  const groups = address?.toLowerCase();
  const expanded = expandIpv6(groups ?? '');
  if (!expanded) return true;

  const startsWith = (prefix: string): boolean => expanded.startsWith(prefix);

  if (expanded === '0'.repeat(32)) return true; // ::
  if (expanded === '0'.repeat(31) + '1') return true; // ::1 loopback
  if (/^f[cd]/.test(expanded)) return true; // ULA fc00::/7 (fc00..fdff)
  if (startsWith('fe80')) return true; // link-local fe80::/10
  if (startsWith('ff')) return true; // multicast ff00::/8
  if (startsWith('0100' + '0'.repeat(12))) return true; // discard-only 100::/64
  if (startsWith('20010db8')) return true; // documentation 2001:db8::/32

  // IPv4-mapped ::ffff:0:0/96 -> validate the embedded IPv4 (bytes 12..16)
  if (startsWith('0'.repeat(20) + 'ffff')) {
    const v4 = embeddedIpv4(expanded, 12);
    return v4 === null ? true : isPrivateIpv4(v4);
  }
  // 6to4 2002::/16 -> validate the embedded IPv4 (bytes 2..6)
  if (startsWith('2002')) {
    const v4 = embeddedIpv4(expanded, 2);
    return v4 === null ? true : isPrivateIpv4(v4);
  }
  // Teredo 2001:0000::/32 -> block outright (transition technology)
  if (startsWith('20010000')) return true;

  return false;
}

export function isPublicIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !isPrivateIpv4(ip);
  if (version === 6) return !isPrivateIpv6(ip);
  return false;
}

const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

/**
 * Hostname must be a public DNS name (never an IP literal, never bare
 * "localhost"). Callers pass an already-lowercased, trimmed hostname.
 */
export function assertPublicHostname(hostname: string): void {
  if (isIP(hostname.replace(/^\[|\]$/g, ''))) {
    throw new SsrfViolationError('ip-literal hostnames are not allowed');
  }
  if (!HOSTNAME_PATTERN.test(hostname)) {
    throw new SsrfViolationError(`hostname failed validation: ${hostname}`);
  }
}

export interface ResolvedTarget {
  /** Public IP address that passed validation. */
  address: string;
  isIpv6: boolean;
}

/**
 * Resolve every A/AAAA record and require ALL of them to be public.
 * The first valid IPv4 wins (falls back to IPv6); the caller dials this
 * address directly so no second, unvalidated resolution can occur.
 */
export async function resolvePinnedAddress(
  hostname: string,
  resolver: Pick<Resolver, 'resolve4' | 'resolve6'> = new Resolver(),
): Promise<ResolvedTarget> {
  assertPublicHostname(hostname);

  const [v4, v6] = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
  const allFailed = v4.status === 'rejected' && v6.status === 'rejected';
  if (allFailed) {
    throw new DnsResolutionError(
      hostname,
      v4.status === 'rejected' ? v4.reason : v6.status === 'rejected' ? (v6 as PromiseRejectedResult).reason : undefined,
    );
  }

  const candidates: Array<{ ip: string; isIpv6: boolean }> = [];
  if (v4.status === 'fulfilled') {
    for (const ip of v4.value) candidates.push({ ip, isIpv6: false });
  }
  if (v6.status === 'fulfilled') {
    for (const ip of v6.value) candidates.push({ ip, isIpv6: true });
  }
  if (candidates.length === 0) {
    throw new DnsResolutionError(hostname, new Error('no address records'));
  }

  for (const candidate of candidates) {
    if (!isPublicIp(candidate.ip)) {
      throw new SsrfViolationError(`${candidate.ip} resolved from ${hostname} is a private/reserved address`);
    }
  }

  const preferred = candidates.find((c) => !c.isIpv6) ?? candidates[0];
  if (!preferred) throw new DnsResolutionError(hostname, new Error('no usable records'));
  return { address: preferred.ip, isIpv6: preferred.isIpv6 };
}

const ALLOWED_PORTS_BY_SCHEME: Record<string, number> = { http: 80, https: 443 };

/** Validate scheme/port/host of one redirect hop. Returns the explicit port. */
export function assertSafeHop(url: URL): number {
  const port = ALLOWED_PORTS_BY_SCHEME[url.protocol.replace(':', '')];
  if (port === undefined) {
    throw new SsrfViolationError(`scheme not allowed: ${url.protocol}`);
  }
  const explicitPort = url.port === '' ? port : Number(url.port);
  if (explicitPort !== port || !Number.isInteger(explicitPort)) {
    throw new SsrfViolationError(`port not allowed: ${url.port || '(default)'}`);
  }
  assertPublicHostname(url.hostname.toLowerCase().replace(/\.$/, ''));
  if (url.username || url.password) {
    throw new SsrfViolationError('userinfo credentials are not allowed');
  }
  return explicitPort;
}
