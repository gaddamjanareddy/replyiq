import { describe, it, expect } from 'vitest';
import type { Resolver } from 'node:dns/promises';
import {
  SsrfViolationError,
  DnsResolutionError,
  assertSafeHop,
  assertPublicHostname,
  isPrivateIpv4,
  isPrivateIpv6,
  isPublicIp,
  resolvePinnedAddress,
} from './ssrf-guard.js';

describe('isPrivateIpv4', () => {
  const privateCases = [
    '0.0.0.0',
    '10.0.0.1',
    '10.255.255.255',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254', // cloud metadata endpoint
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '198.18.0.1',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
  ];

  const publicCases = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '198.20.0.1'];

  it.each(privateCases)('treats %s as private', (ip) => {
    expect(isPrivateIpv4(ip)).toBe(true);
  });

  it.each(publicCases)('treats %s as public', (ip) => {
    expect(isPrivateIpv4(ip)).toBe(false);
  });

  it('treats malformed input as private (fail closed)', () => {
    expect(isPrivateIpv4('not-an-ip')).toBe(true);
    expect(isPrivateIpv4('999.1.1.1')).toBe(true);
  });
});

describe('isPrivateIpv6 / isPublicIp', () => {
  const privateV6 = [
    '::',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12::1',
    'ff02::1',
    '::ffff:127.0.0.1', // IPv4-mapped loopback
    '::ffff:10.0.0.5',
    '2002:7f00:0001::', // 6to4 embedding 127.0.0.1
    '2001:db8::1', // documentation range
  ];
  const publicV6 = ['2606:4700::1111', '2001:4860:4860::8888', '::ffff:8.8.8.8'];

  it.each(privateV6)('treats %s as private', (ip) => {
    expect(isPrivateIpv6(ip)).toBe(true);
  });

  it.each(publicV6)('treats %s as public', (ip) => {
    expect(isPrivateIpv6(ip)).toBe(false);
  });

  it('isPublicIp dispatches by version and fails closed on garbage', () => {
    expect(isPublicIp('8.8.8.8')).toBe(true);
    expect(isPublicIp('127.0.0.1')).toBe(false);
    expect(isPublicIp('::1')).toBe(false);
    expect(isPublicIp('bogus')).toBe(false);
  });
});

describe('assertPublicHostname', () => {
  it('accepts ordinary public hostnames', () => {
    expect(() => assertPublicHostname('example.com')).not.toThrow();
    expect(() => assertPublicHostname('sub.example.co.uk')).not.toThrow();
  });

  it('rejects IP literals, localhost, and malformed names', () => {
    expect(() => assertPublicHostname('127.0.0.1')).toThrow(SsrfViolationError);
    expect(() => assertPublicHostname('[::1]')).toThrow(SsrfViolationError);
    expect(() => assertPublicHostname('localhost')).toThrow(SsrfViolationError);
    expect(() => assertPublicHostname('-bad.example.com')).toThrow(SsrfViolationError);
    expect(() => assertPublicHostname('bad_.example.com')).toThrow(SsrfViolationError);
    expect(() => assertPublicHostname('singlelabel')).toThrow(SsrfViolationError);
    expect(() => assertPublicHostname(`${'a'.repeat(260)}.com`)).toThrow(SsrfViolationError);
  });
});

function fakeResolver(
  v4: string[] | Error,
  v6: string[] | Error = new Error('no AAAA'),
) {
  const resolve4 = async (): Promise<string[]> => {
    if (v4 instanceof Error) throw v4;
    return v4;
  };
  const resolve6 = async (): Promise<string[]> => {
    if (v6 instanceof Error) throw v6;
    return v6;
  };
  // The production code only calls the no-options overloads; cast past the
  // multi-signature dns type for test purposes.
  return { resolve4, resolve6 } as unknown as Pick<Resolver, 'resolve4' | 'resolve6'>;
}

describe('resolvePinnedAddress', () => {
  const hostname = 'example.com';

  it('returns the first public IPv4 address', async () => {
    const result = await resolvePinnedAddress(hostname, fakeResolver(['93.184.216.34']));
    expect(result).toEqual({ address: '93.184.216.34', isIpv6: false });
  });

  it('falls back to public IPv6 when no A record exists', async () => {
    const result = await resolvePinnedAddress(
      hostname,
      fakeResolver(new Error('NXDOMAIN'), ['2606:4700::1111']),
    );
    expect(result.address).toBe('2606:4700::1111');
    expect(result.isIpv6).toBe(true);
  });

  it('rejects when ANY resolved address is private', async () => {
    await expect(
      resolvePinnedAddress(hostname, fakeResolver(['93.184.216.34', '192.168.0.9'])),
    ).rejects.toThrow(SsrfViolationError);
  });

  it('rejects loopback/metadata targets outright', async () => {
    await expect(resolvePinnedAddress(hostname, fakeResolver(['127.0.0.1']))).rejects.toThrow(
      SsrfViolationError,
    );
    await expect(resolvePinnedAddress(hostname, fakeResolver(['169.254.169.254']))).rejects.toThrow(
      SsrfViolationError,
    );
  });

  it('maps total DNS failure to DnsResolutionError (retryable/pending)', async () => {
    await expect(
      resolvePinnedAddress(hostname, fakeResolver(new Error('ENOTFOUND'), new Error('ENOTFOUND'))),
    ).rejects.toThrow(DnsResolutionError);
  });

  it('rejects IP-literal hostnames before any DNS work', async () => {
    await expect(resolvePinnedAddress('10.0.0.1', fakeResolver(['10.0.0.1']))).rejects.toThrow(
      SsrfViolationError,
    );
  });
});

describe('assertSafeHop', () => {
  it('allows default http/https ports', () => {
    expect(assertSafeHop(new URL('http://example.com/replyiq-verification.html'))).toBe(80);
    expect(assertSafeHop(new URL('https://example.com/x'))).toBe(443);
  });

  it('blocks non-http(s) schemes, explicit odd ports, and userinfo', () => {
    expect(() => assertSafeHop(new URL('ftp://example.com/f'))).toThrow(SsrfViolationError);
    expect(() => assertSafeHop(new URL('file:///etc/passwd'))).toThrow(SsrfViolationError);
    expect(() => assertSafeHop(new URL('http://example.com:8080/f'))).toThrow(SsrfViolationError);
    expect(() => assertSafeHop(new URL('http://user:pass@example.com/f'))).toThrow(
      SsrfViolationError,
    );
    expect(() => assertSafeHop(new URL('http://169.254.169.254/latest/meta-data'))).toThrow(
      SsrfViolationError,
    );
  });
});
