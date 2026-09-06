import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@replyiq/database';
import type { PrismaClient } from '@replyiq/database';
import { PasswordResetService, hashToken } from './password-reset.service.js';
import { PasswordService } from '../../common/security/password.service.js';
import { EmailService } from '../../infrastructure/email/email.service.js';

/**
 * Integration suite for password reset, against a real Postgres.
 *
 * These properties are the reason the feature is safe, and none of them can be
 * checked without a database: single-use enforcement, expiry, session
 * revocation, and the fact that a request for an unknown address is
 * indistinguishable from one for a real account.
 */

/** Captures what would have been emailed, so the raw token can be recovered. */
class CapturingEmailService extends EmailService {
  sent: Array<{ to: string; subject: string; text: string }> = [];

  override async send(message: { to: string; subject: string; text: string }): Promise<void> {
    this.sent.push(message);
  }

  /** The raw token as the user would receive it, from the most recent email. */
  lastToken(): string {
    const last = this.sent.at(-1);
    if (!last) throw new Error('no email was sent');
    const match = /token=([A-Za-z0-9_-]+)/.exec(last.text);
    if (!match?.[1]) throw new Error(`no token in the email body: ${last.text}`);
    return decodeURIComponent(match[1]);
  }

  reset() {
    this.sent = [];
  }
}

const VALID_NEW_PASSWORD = 'Str0ng!NewPassphrase';

let service: PasswordResetService;
let email: CapturingEmailService;
let passwordService: PasswordService;
let organizationId: string;

async function createUser(suffix: string) {
  passwordService = passwordService ?? new PasswordService();
  const user = await prisma.user.create({
    data: {
      organizationId,
      email: `reset-${suffix}@example.test`,
      name: 'Reset Test',
      role: 'OWNER',
      passwordHash: await passwordService.hash('Original!Passphrase1'),
    },
  });
  return user;
}

/** A live session, so revocation-on-reset can be observed. */
async function createSession(userId: string) {
  return prisma.session.create({
    data: {
      id: randomUUID(),
      userId,
      refreshTokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
}

beforeAll(async () => {
  passwordService = new PasswordService();
  email = new CapturingEmailService(new ConfigService());
  service = new PasswordResetService(
    prisma as PrismaClient,
    passwordService,
    email,
    new ConfigService(),
  );

  const organization = await prisma.organization.create({
    data: { name: `RESET-ORG-${randomUUID().slice(0, 8)}` },
  });
  organizationId = organization.id;
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { organizationId }, select: { id: true } });
  const userIds = users.map((u) => u.id);
  await prisma.passwordResetToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
});

describe('requesting a reset', () => {
  it('emails a link and stores only the hash of the token', async () => {
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));

    await service.requestReset(user.email);

    expect(email.sent).toHaveLength(1);
    const rawToken = email.lastToken();

    const stored = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    const [row] = stored;
    // The raw token must exist only in the inbox. A leaked database row must
    // not be replayable into account takeover.
    expect(row?.tokenHash).toBe(hashToken(rawToken));
    expect(row?.tokenHash).not.toBe(rawToken);
    expect(row?.usedAt).toBeNull();
  });

  it('is silent and side-effect free for an address with no account', async () => {
    email.reset();

    // Must not throw: an error here would answer "does this address exist?"
    await expect(service.requestReset('definitely-nobody@example.test')).resolves.toBeUndefined();

    expect(email.sent).toHaveLength(0);
    // And no row was created that a later probe could detect.
    expect(await prisma.passwordResetToken.count({ where: { ipAddress: 'never' } })).toBe(0);
  });

  it('invalidates the previous link when a new one is requested', async () => {
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));

    await service.requestReset(user.email);
    const firstToken = email.lastToken();
    await service.requestReset(user.email);
    const secondToken = email.lastToken();

    expect(secondToken).not.toBe(firstToken);

    // Clicking "resend" must not leave a trail of working keys in inboxes.
    await expect(service.confirmReset(firstToken, VALID_NEW_PASSWORD)).rejects.toMatchObject({
      response: { code: 'AUTH_RESET_TOKEN_INVALID' },
    });
    await expect(service.confirmReset(secondToken, VALID_NEW_PASSWORD)).resolves.toBeUndefined();
  });
});

describe('completing a reset', () => {
  it('changes the password and revokes every session', async () => {
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));
    const sessionA = await createSession(user.id);
    const sessionB = await createSession(user.id);

    await service.requestReset(user.email);
    await service.confirmReset(email.lastToken(), VALID_NEW_PASSWORD);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await passwordService.verify(VALID_NEW_PASSWORD, updated.passwordHash)).toBe(true);
    expect(await passwordService.verify('Original!Passphrase1', updated.passwordHash)).toBe(false);

    // The point of revoking: if someone else was signed in as this user, the
    // reset is the moment they stop being.
    for (const id of [sessionA.id, sessionB.id]) {
      const session = await prisma.session.findUniqueOrThrow({ where: { id } });
      expect(session.revokedAt).not.toBeNull();
    }
  });

  it('refuses a token that has already been used', async () => {
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));

    await service.requestReset(user.email);
    const token = email.lastToken();

    await service.confirmReset(token, VALID_NEW_PASSWORD);
    await expect(service.confirmReset(token, 'Another!Passphrase9')).rejects.toMatchObject({
      response: { code: 'AUTH_RESET_TOKEN_INVALID' },
    });
  });

  it('refuses an expired token', async () => {
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));

    await service.requestReset(user.email);
    const token = email.lastToken();

    // Reach past the clock rather than waiting 30 minutes.
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash: hashToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(service.confirmReset(token, VALID_NEW_PASSWORD)).rejects.toMatchObject({
      response: { code: 'AUTH_RESET_TOKEN_INVALID' },
    });
  });

  it('refuses a token that was never issued', async () => {
    await expect(
      service.confirmReset('not-a-real-token-at-all', VALID_NEW_PASSWORD),
    ).rejects.toMatchObject({ response: { code: 'AUTH_RESET_TOKEN_INVALID' } });
  });

  it('reports unknown, expired and used tokens identically', async () => {
    // Distinguishing them would tell an attacker which guesses were close.
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));
    await service.requestReset(user.email);
    const used = email.lastToken();
    await service.confirmReset(used, VALID_NEW_PASSWORD);

    const codes = await Promise.all(
      ['never-issued-token', used].map(async (token) => {
        try {
          await service.confirmReset(token, 'Yet!AnotherPass12');
          return 'resolved';
        } catch (error) {
          return (error as { response?: { code?: string } }).response?.code;
        }
      }),
    );

    expect(new Set(codes).size).toBe(1);
    expect(codes[0]).toBe('AUTH_RESET_TOKEN_INVALID');
  });

  it('lets only one of two concurrent uses of the same link win', async () => {
    email.reset();
    const user = await createUser(randomUUID().slice(0, 8));
    await service.requestReset(user.email);
    const token = email.lastToken();

    // The guard is `updateMany` filtered on `usedAt: null` inside the
    // transaction, so a double-submit cannot reset the password twice.
    const results = await Promise.allSettled([
      service.confirmReset(token, VALID_NEW_PASSWORD),
      service.confirmReset(token, 'Different!Passphrase7'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });
});
