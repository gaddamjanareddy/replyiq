import { Inject, Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { PrismaClient } from '@replyiq/database';
import { createHash, randomBytes } from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { PasswordService } from '../../common/security/password.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { EmailService } from '../../infrastructure/email/email.service.js';
import { canDeliverEmail } from '../../infrastructure/email/email.service.js';
import { ErrorCode, codedBadRequest } from '../../common/errors/error-codes.js';

/**
 * Password reset.
 *
 * Before this existed, a user who forgot their password was locked out of
 * their business permanently - there was no recovery path anywhere in the
 * product. That made it the one defect that could lose an account outright.
 *
 * ── The two rules this flow lives by ──────────────────────────────────────
 *
 * 1. **Never reveal whether an address has an account.** Every request gets
 *    the same response and the same shape of work, whether or not the address
 *    exists. An endpoint that answers differently is a free account-enumeration
 *    oracle, and it is the classic way this feature leaks.
 *
 * 2. **A reset is a security event, not a settings change.** Completing one
 *    revokes every session on every device. If the account was taken over, the
 *    owner resetting their password is exactly the moment the attacker must be
 *    ejected - leaving their session alive would make the reset theatre.
 */

/** Short enough to limit the window, long enough to survive a slow inbox. */
const TOKEN_TTL_MINUTES = 30;
/** 32 bytes of CSPRNG output - far beyond guessing, even unthrottled. */
const TOKEN_BYTES = 32;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Begin a reset.
   *
   * Always resolves the same way for a well-formed address. The caller returns
   * one fixed message regardless.
   */
  async requestReset(email: string, ipAddress?: string): Promise<void> {
    // Checked before anything else: if the deployment cannot send email, the
    // honest answer is "this is unavailable", not "check your inbox" followed
    // by silence. This is a property of the deployment, not of the address, so
    // it reveals nothing about whether an account exists.
    if (!canDeliverEmail()) {
      throw codedBadRequest(
        ErrorCode.AUTH_RESET_UNAVAILABLE,
        'Password reset is not available on this deployment.',
      );
    }

    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalized, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, email: true },
    });

    // No account, or a suspended one. Return exactly as if we had sent a
    // message - see rule 1. Logged at debug so an operator can still see it.
    if (!user) {
      this.logger.debug(`Reset requested for an address with no active account`);
      return;
    }

    // One live token per user. Without this, every request leaves another
    // working key in another inbox, so the attack surface grows with each
    // click of "resend".
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });

    const rawToken = randomBytes(TOKEN_BYTES).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MINUTES * 60_000),
        ipAddress,
      },
    });

    try {
      await this.emailService.send(this.buildResetEmail(user.email, user.name, rawToken));
    } catch (error) {
      // Swallowed on purpose. Throwing here would answer "does this address
      // exist?" with a different outcome than the no-account branch above,
      // undoing rule 1. A send failure is an infrastructure problem that
      // affects every address equally, so it belongs in the log and in
      // monitoring - not in this response.
      this.logger.error(
        `Failed to deliver a password reset email: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Complete a reset.
   *
   * Every rejection is the same error, because distinguishing "no such token"
   * from "expired" from "already used" tells an attacker which guesses were
   * close.
   */
  async confirmReset(rawToken: string, newPassword: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      select: { id: true, userId: true, expiresAt: true, usedAt: true },
    });

    const invalid = codedBadRequest(
      ErrorCode.AUTH_RESET_TOKEN_INVALID,
      'This reset link is no longer valid.',
    );

    if (!record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
      throw invalid;
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    // One transaction: a partial reset that changed the password but left the
    // token live, or revoked sessions without changing the password, would
    // each be their own kind of broken.
    await this.prisma.$transaction(async (tx) => {
      // Consume the token by id AND unused-ness, so two requests racing with
      // the same link cannot both succeed.
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      if (consumed.count === 0) throw invalid;

      await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });

      // Any other outstanding link for this user is now dead too.
      await tx.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Rule 2: eject every existing session. If someone else was signed in as
      // this user, this is the moment they stop being.
      await tx.session.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    this.logger.log(`Password reset completed; all sessions revoked for user ${record.userId}`);
  }

  private buildResetEmail(to: string, name: string, rawToken: string) {
    const base = (this.configService.get<string>('WEB_URL') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    const link = `${base}/reset-password?token=${encodeURIComponent(rawToken)}`;

    return {
      to,
      subject: 'Reset your ReplyIQ password',
      text: [
        `Hi ${name},`,
        '',
        'Use this link to choose a new password:',
        link,
        '',
        `The link works once and expires in ${TOKEN_TTL_MINUTES} minutes.`,
        '',
        "If you didn't ask for this, you can ignore this email - your password",
        'has not changed.',
      ].join('\n'),
    };
  }
}

/**
 * Hash a reset token for storage and lookup.
 *
 * SHA-256, not bcrypt: the input is 32 bytes of CSPRNG output, so there is no
 * dictionary to attack and a work factor would only slow down the legitimate
 * lookup. Password hashing solves a problem this value does not have.
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
