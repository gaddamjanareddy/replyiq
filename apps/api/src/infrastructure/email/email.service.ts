import { Injectable, Logger } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for DI metadata
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';

/**
 * Transactional email.
 *
 * Deliberately tiny: the product sends a handful of operational messages, not
 * campaigns. A full templating and delivery stack would be scaffolding for a
 * problem we do not have.
 *
 * ── Why a transport switch rather than a hard dependency ──────────────────
 * Password reset is the first thing that needs email, and it is useless
 * without it - a user who cannot receive the message stays locked out. But
 * requiring a provider account to run the app locally would make the whole
 * auth flow untestable on a laptop. So the default transport logs the message
 * instead of sending it, and production is expected to configure a real one.
 *
 * ── Why three transports ──────────────────────────────────────────────────
 * They solve genuinely different problems, and which one is cheapest depends
 * on what the operator already has:
 *
 *   log     Development. The reset link has to be readable somewhere, and
 *           stdout is that somewhere.
 *   resend  Needs a sending domain you control. Branded and scales, so it is
 *           the right end state - but Resend delivers only to the account
 *           owner's own address until a domain is verified, and verifying one
 *           requires DNS you control.
 *   smtp    Any mailbox, including a plain Gmail account with an app
 *           password. Unbranded and rate-limited (~500/day on free Gmail),
 *           but it reaches real recipients with no domain at all - which is
 *           the difference between a product whose users can recover their
 *           accounts and one whose users cannot.
 *
 * `canDeliverEmail` exists because the failure mode is otherwise silent and
 * terrible: a deployed app that cheerfully accepts reset requests, logs them to
 * stdout, and tells every user their message is on the way.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  /** Plain text is required. Some clients render nothing else, and it is what
   *  ends up in the log transport. */
  text: string;
  html?: string;
}

/** Which transport is in use. `log` never sends anything. */
export type EmailTransport = 'log' | 'resend' | 'smtp';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  get transport(): EmailTransport {
    const configured = this.configService.get<string>('EMAIL_TRANSPORT');
    // Anything unrecognised falls back to `log`, which cannot send. Failing
    // closed matters: a typo in the transport name must not quietly become a
    // working sender running on the wrong configuration.
    return configured === 'resend' || configured === 'smtp' ? configured : 'log';
  }

  /**
   * Send one message.
   *
   * Resolves on success and throws on failure, so a caller that must not leak
   * whether an address exists can catch and swallow deliberately rather than
   * by accident.
   */
  async send(message: EmailMessage): Promise<void> {
    if (this.transport === 'resend') {
      await this.sendViaResend(message);
      return;
    }
    if (this.transport === 'smtp') {
      await this.sendViaSmtp(message);
      return;
    }

    // The log transport prints the whole body on purpose. During local
    // development the reset link IS the delivery mechanism - there is nowhere
    // else to read it from.
    this.logger.log(
      [
        '',
        '─── email (not sent: EMAIL_TRANSPORT is "log") ───',
        `to:      ${message.to}`,
        `subject: ${message.subject}`,
        '',
        message.text,
        '──────────────────────────────────────────────────',
      ].join('\n'),
    );
  }

  private async sendViaResend(message: EmailMessage): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('EMAIL_FROM');
    if (!apiKey || !from) {
      throw new Error('EMAIL_TRANSPORT=resend requires RESEND_API_KEY and EMAIL_FROM');
    }

    // A fixed, trusted endpoint - not a user-supplied URL - so this correctly
    // uses plain fetch rather than the SSRF-guarded client.
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });

    if (!response.ok) {
      // The body can contain the recipient address; keep it out of the log.
      throw new Error(`email provider rejected the message (${response.status})`);
    }
  }

  /**
   * Send over SMTP.
   *
   * The point of this path is that it needs no domain: an ordinary mailbox
   * with an app password reaches real recipients today, which is what makes
   * account recovery genuinely work for a product that has not bought a domain
   * yet.
   *
   * A fresh connection per message, deliberately. Password reset is
   * low-volume and bursty, so a pooled connection would spend nearly all its
   * life idle and occasionally dead - and discovering a stale socket during
   * the one request that mattered is worse than reconnecting every time.
   */
  private async sendViaSmtp(message: EmailMessage): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASSWORD');
    const from = this.configService.get<string>('EMAIL_FROM');
    if (!host || !user || !pass || !from) {
      throw new Error(
        'EMAIL_TRANSPORT=smtp requires SMTP_HOST, SMTP_USER, SMTP_PASSWORD and EMAIL_FROM',
      );
    }

    const port = Number(this.configService.get<string>('SMTP_PORT') ?? '587');
    const transporter = createTransport({
      host,
      port,
      // 465 is implicit TLS; 587 begins in plaintext and upgrades via
      // STARTTLS. Getting this pairing wrong produces a connection that hangs
      // rather than a clear error, so it is derived from the port rather than
      // left as one more thing to configure inconsistently.
      secure: port === 465,
      auth: { user, pass },
    });

    try {
      await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      });
    } finally {
      transporter.close();
    }
  }
}

/**
 * Whether email can actually be delivered right now.
 *
 * Callers use this to refuse a request outright rather than accept it and
 * quietly drop the message. Password reset without delivery is worse than no
 * password reset at all: the user is told to check an inbox that will never
 * receive anything, so they wait instead of asking for help.
 */
export function canDeliverEmail(env: NodeJS.ProcessEnv = process.env): boolean {
  // The log transport "delivers" to stdout, which is genuinely useful in
  // development - the reset link has to be readable somewhere.
  if (env.NODE_ENV !== 'production') return true;

  // Every credential a transport needs is checked here rather than at send
  // time. A half-configured mailer would otherwise pass this gate, have the
  // request accepted, and fail in the background - which is precisely the
  // "told to check an inbox that never receives anything" trap this exists to
  // prevent.
  if (env.EMAIL_TRANSPORT === 'resend') {
    return Boolean(env.RESEND_API_KEY) && Boolean(env.EMAIL_FROM);
  }
  if (env.EMAIL_TRANSPORT === 'smtp') {
    return (
      Boolean(env.SMTP_HOST) &&
      Boolean(env.SMTP_USER) &&
      Boolean(env.SMTP_PASSWORD) &&
      Boolean(env.EMAIL_FROM)
    );
  }
  return false;
}

/**
 * Warn - loudly, once, at boot - that production cannot send email.
 *
 * Deliberately NOT fatal. An unconfigured mailer is a missing feature, not a
 * compromised one, and refusing to boot over it would take a running product
 * offline to punish it for a capability it never had. The affected endpoint
 * declines honestly instead (see `canDeliverEmail`), which contains the damage
 * to the one feature that needs email.
 */
export function warnIfEmailNotConfiguredInProduction(
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = (m) => console.warn(m),
): void {
  if (canDeliverEmail(env)) return;
  log(
    'WARNING: no email transport is configured, so password reset is DISABLED. ' +
      'Requests to it are declined with a clear message rather than silently dropped. ' +
      'Enable it with either EMAIL_TRANSPORT=resend (RESEND_API_KEY, EMAIL_FROM) or ' +
      'EMAIL_TRANSPORT=smtp (SMTP_HOST, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM).',
  );
}
