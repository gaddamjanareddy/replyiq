import { describe, it, expect, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { GlobalExceptionFilter } from './global-exception.filter.js';
import type { ArgumentsHost } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

type SentBody = Record<string, unknown>;

function sentBody(sent: SentBody[], index: number): SentBody {
  const body = sent[index];
  if (body === undefined) {
    throw new Error(`no response body captured at index ${index}`);
  }
  return body;
}

function makeHarness() {
  const sent: SentBody[] = [];
  const reply = {
    status: vi.fn(() => reply),
    send: vi.fn((body: SentBody) => {
      sent.push(body);
      return reply;
    }),
  } as unknown as FastifyReply & { status: ReturnType<typeof vi.fn> };

  const host = {
    switchToHttp: () => ({ getResponse: () => reply }),
  } as unknown as ArgumentsHost;

  const logger = { error: vi.fn() } as never;
  const filter = new GlobalExceptionFilter(logger);

  return { filter, host, sent };
}

describe('GlobalExceptionFilter stable-code contract', () => {
  it('passes through explicit codes from coded exceptions', () => {
    const { filter, host, sent } = makeHarness();
    filter.catch(new ConflictException({ code: 'DOMAIN_LAST_VERIFIED', message: 'nope' }), host);

    expect(sentBody(sent, 0)).toMatchObject({
      statusCode: 409,
      code: 'DOMAIN_LAST_VERIFIED',
      message: 'nope',
    });
    expect(typeof sentBody(sent, 0).timestamp).toBe('string');
  });

  it('maps bare 401 exceptions to AUTH_UNAUTHENTICATED (passport/JWT)', () => {
    const { filter, host, sent } = makeHarness();
    filter.catch(new UnauthorizedException(), host);
    expect(sentBody(sent, 0).code).toBe('AUTH_UNAUTHENTICATED');
    expect(sentBody(sent, 0).statusCode).toBe(401);
  });

  it('maps bare 403/404/429 to their default codes', () => {
    const { filter, host, sent } = makeHarness();
    filter.catch(new NotFoundException(), host);
    expect(sentBody(sent, 0).code).toBe('RESOURCE_NOT_FOUND');

    filter.catch(new ThrottlerException(), host);
    expect(sentBody(sent, 1).code).toBe('RATE_LIMITED');
    expect(sentBody(sent, 1).statusCode).toBe(429);
  });

  it('maps validation failures to VALIDATION_FAILED and preserves the message array', () => {
    const { filter, host, sent } = makeHarness();
    filter.catch(new BadRequestException(['domain must match pattern', 'name is required']), host);

    expect(sentBody(sent, 0).code).toBe('VALIDATION_FAILED');
    expect(sentBody(sent, 0).message).toEqual(['domain must match pattern', 'name is required']);
  });

  it('never leaks internals for unexpected errors, but still carries a code', () => {
    const { filter, host, sent } = makeHarness();
    filter.catch(new Error('ECONNREFUSED 127.0.0.1:5432 super-secret'), host);

    expect(sentBody(sent, 0).statusCode).toBe(500);
    expect(sentBody(sent, 0).message).toBe('Internal server error');
    // A stable INTERNAL_ERROR is not a leak - it is what lets the client say
    // "this isn't something you did" instead of falling back to a shrug. The
    // leak test is the assertion below.
    expect(sentBody(sent, 0).code).toBe('INTERNAL_ERROR');
    const serialized = JSON.stringify(sentBody(sent, 0));
    expect(serialized).not.toContain('ECONNREFUSED');
    expect(serialized).not.toContain('127.0.0.1');
    expect(serialized).not.toContain('5432');
    expect(serialized).not.toContain('super-secret');
  });

  it('handles string-only HttpExceptions with default mapping', () => {
    const { filter, host, sent } = makeHarness();
    filter.catch(new HttpException('Forbidden resource', 403), host);
    expect(sentBody(sent, 0).code).toBe('AUTHZ_FORBIDDEN');
    expect(sentBody(sent, 0).message).toBe('Forbidden resource');
  });
});
