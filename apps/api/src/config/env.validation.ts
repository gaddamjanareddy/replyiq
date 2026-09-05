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
