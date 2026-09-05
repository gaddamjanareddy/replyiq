import { describe, expect, it } from 'vitest';
import { canDeliverEmail, warnIfEmailNotConfiguredInProduction } from './email.service.js';

/**
 * These guard the decision that a production deployment without a mailer stays
 * up and disables one feature, rather than refusing to boot.
 *
 * Both halves matter. Booting is what keeps a running product online. Reporting
 * `canDeliverEmail() === false` is what stops the reset endpoint telling users
 * to check an inbox that will never receive anything.
 */

describe('canDeliverEmail', () => {
  it('is true outside production regardless of transport', () => {
    // The log transport genuinely "delivers" in development - the reset link
    // has to be readable somewhere, and stdout is that somewhere.
    expect(canDeliverEmail({ NODE_ENV: 'development' })).toBe(true);
    expect(canDeliverEmail({ NODE_ENV: 'test' })).toBe(true);
  });

  it('is false in production on the log transport', () => {
    // The trap this exists to prevent: accepting reset requests and writing
    // the link to the server log.
    expect(canDeliverEmail({ NODE_ENV: 'production', EMAIL_TRANSPORT: 'log' })).toBe(false);
  });

  it('is false in production when the transport is set but incomplete', () => {
    const base = { NODE_ENV: 'production', EMAIL_TRANSPORT: 'resend' };
    expect(canDeliverEmail({ ...base })).toBe(false);
    expect(canDeliverEmail({ ...base, RESEND_API_KEY: 'k' })).toBe(false);
    expect(canDeliverEmail({ ...base, EMAIL_FROM: 'a@b.c' })).toBe(false);
  });

  it('is true in production once the transport is fully configured', () => {
    expect(
      canDeliverEmail({
        NODE_ENV: 'production',
        EMAIL_TRANSPORT: 'resend',
        RESEND_API_KEY: 'k',
        EMAIL_FROM: 'ReplyIQ <a@b.c>',
      }),
    ).toBe(true);
  });
});

describe('warnIfEmailNotConfiguredInProduction', () => {
  it('warns when production cannot send', () => {
    const messages: string[] = [];
    warnIfEmailNotConfiguredInProduction({ NODE_ENV: 'production' }, (m) => messages.push(m));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatch(/password reset is DISABLED/i);
  });

  it('does not throw - a missing mailer must never take the app down', () => {
    // Regression guard for a deliberate reversal: this check was briefly fatal,
    // which would have killed a running production deployment that had never
    // had email configured.
    expect(() => warnIfEmailNotConfiguredInProduction({ NODE_ENV: 'production' }, () => {})).not.toThrow();
  });

  it('stays silent when delivery is possible', () => {
    const messages: string[] = [];
    warnIfEmailNotConfiguredInProduction({ NODE_ENV: 'development' }, (m) => messages.push(m));
    expect(messages).toHaveLength(0);
  });
});
