import { z } from 'zod';

const envSchema = z.object({
  PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('30d'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  RATE_LIMIT_TTL: z.string().default('60'),
  RATE_LIMIT_MAX: z.string().default('10'),
  VERIFICATION_RATE_LIMIT_MAX: z.string().default('5'),

  // --- Transactional email -------------------------------------------------
  /**
   * 'log' prints messages to stdout instead of sending them, which is how the
   * reset link is read during local development. 'resend' actually delivers.
   *
   * A production deployment left on 'log' does not fail to boot - an
   * unconfigured mailer is a missing feature, not a compromised one, and
   * refusing to start would take a running product offline over a capability
   * it never had. Password reset declines honestly instead.
   */
  EMAIL_TRANSPORT: z.enum(['log', 'resend']).default('log'),
  RESEND_API_KEY: z.string().default(''),
  /** Envelope sender, e.g. 'ReplyIQ <noreply@yourdomain.com>'. */
  EMAIL_FROM: z.string().default(''),
  /**
   * Public origin of the dashboard, used to build links inside emails. Must be
   * the address a user's browser can reach - not an internal service name.
   */
  WEB_URL: z.string().default('http://localhost:5173'),

  // --- Domain verification -------------------------------------------------
  /**
   * Enables the DEV_BYPASS verification method. Only honoured when NODE_ENV is
   * not 'production'; a production process with this set to 'true' refuses to
   * boot (see config/verification-methods.ts). Anything other than the exact
   * string 'true' means disabled - the gate fails closed.
   */
  ALLOW_DEV_VERIFICATION_BYPASS: z.enum(['true', 'false']).default('false'),
  /**
   * Optional additional sandbox namespace the operator provably controls, e.g.
   * 'sandbox.replyiq.app'. Empty means IANA-reserved namespaces only. A bare
   * TLD is rejected by the classifier, so this cannot accidentally make every
   * .com address sandbox-eligible.
   */
  SANDBOX_DOMAIN_SUFFIX: z.string().default(''),
  /** Per-organization limits on the two abuse-sensitive domain routes. */
  DOMAIN_RATE_LIMIT_TTL: z.string().default('3600'),
  DOMAIN_ADD_RATE_LIMIT_MAX: z.string().default('10'),
  DOMAIN_VERIFY_RATE_LIMIT_MAX: z.string().default('20'),
  /** Test-only fixture host for the website-verification fetch. Ignored unless
   *  NODE_ENV === 'test'. */
  DOMAIN_VERIFICATION_FETCH_HOST_OVERRIDE: z.string().optional(),

  // --- Knowledge ingestion -------------------------------------------------
  /** One ingest request fans out into a dozen outbound fetches against a third
   *  party's server, so both abuse and politeness argue for a tight limit. */
  KNOWLEDGE_INGEST_TTL: z.string().default('3600'),
  KNOWLEDGE_INGEST_MAX: z.string().default('5'),
});

export type Environment = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>): Environment {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid environment configuration:');
    console.error(result.error.format());
    process.exit(1);
  }
  return result.data;
}
