export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessTokenTtl: process.env.ACCESS_TOKEN_TTL ?? '15m',
    refreshTokenTtl: process.env.REFRESH_TOKEN_TTL ?? '30d',
  },
  cors: {
    origins: process.env.CORS_ORIGINS ?? 'http://localhost:5173',
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX ?? '10', 10),
  },
  verification: {
    // Outbound domain-verification fetches are expensive and user-triggered;
    // stricter per-IP limit than the global default (approved decision, P5).
    rateLimitMax: parseInt(process.env.VERIFICATION_RATE_LIMIT_MAX ?? '5', 10),
    /**
     * Non-production-only bypass for CI. Read here for reporting only - the
     * authoritative gate lives in config/verification-methods.ts and is
     * resolved once at module load so no request can influence it.
     */
    devBypassEnabled:
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_VERIFICATION_BYPASS === 'true',
    sandboxDomainSuffix: process.env.SANDBOX_DOMAIN_SUFFIX ?? '',
    // Per-organization limits (FR-DOM-13). The tenant, not the IP, is the
    // abuse boundary for endpoints that make outbound requests.
    domainRateLimitTtl: parseInt(process.env.DOMAIN_RATE_LIMIT_TTL ?? '3600', 10),
    domainAddRateLimitMax: parseInt(process.env.DOMAIN_ADD_RATE_LIMIT_MAX ?? '10', 10),
    domainVerifyRateLimitMax: parseInt(process.env.DOMAIN_VERIFY_RATE_LIMIT_MAX ?? '20', 10),
  },
});
