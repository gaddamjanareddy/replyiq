import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { HttpStatus, ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import cors from '@fastify/cors';
import { AppModule } from './app.module.js';
 
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { assertVerificationBypassNotEnabledInProduction } from './config/verification-methods.js';
import { buildValidationException } from './common/validation/validation-exception.js';
import { warnIfEmailNotConfiguredInProduction } from './infrastructure/email/email.service.js';

async function bootstrap() {
  // Fail loud, at deploy time, rather than running forever with a weakened
  // verification path (FR-TEST-10). Checked before anything else starts, so a
  // misconfigured production deployment never accepts a single request.
  assertVerificationBypassNotEnabledInProduction();

  // Not fatal, unlike the check above: a missing mailer disables one feature,
  // it does not weaken a live one. Password reset declines honestly rather
  // than accepting requests it cannot fulfil.
  warnIfEmailNotConfiguredInProduction();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ bodyLimit: 100 * 1024 }),
    { bufferLogs: true },
  );

  await app.register(helmet);
  await app.register(compress);

  /**
   * NOTE for client authors: do NOT send `Content-Type: application/json` on a
   * request with no body.
   *
   * Fastify rejects that with "Body cannot be empty when content-type is set",
   * before the route runs - which silently broke domain removal in the web app
   * until it was found by driving the real UI. The fix belongs in the client
   * (see apps/web/src/api/client.ts, which only sets the header when there is
   * a body, with a regression test).
   *
   * An attempt to accommodate it server-side by replacing Fastify's JSON parser
   * was reverted: the Nest adapter registers that parser itself and will not
   * release it, and overriding global body parsing to smooth over a client bug
   * is a poor trade for the blast radius.
   */

  /**
   * CORS for the public receptionist widget.
   *
   * Registered BEFORE @fastify/cors so it can answer the preflight itself.
   * The widget runs on each customer's own website, so its origin is different
   * for every business and unknowable at boot — the fixed allow-list below
   * cannot express that, and without this the browser blocks the request
   * before any of our code runs.
   *
   * `*` is correct here rather than lax. CORS is NOT the authorization
   * boundary for these routes: ReceptionistService checks the Origin header
   * against the business's verified domains and returns 403 otherwise. This
   * endpoint takes no cookies and no Authorization header, so a permissive
   * ACAO grants a caller nothing they could not get with curl — and it is
   * exactly the reason `credentials` is not set here.
   */
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onRequest', (request, reply, done) => {
    if (!request.url.startsWith('/api/v1/receptionist/')) return done();

    reply.header('access-control-allow-origin', '*');
    reply.header('access-control-allow-methods', 'GET, POST, OPTIONS');
    reply.header('access-control-allow-headers', 'Content-Type');
    reply.header('access-control-max-age', '86400');
    // Origin decides the answer, so caches must not serve one site's response
    // to another.
    reply.header('vary', 'Origin');

    if (request.method === 'OPTIONS') {
      void reply.code(204).send();
      return;
    }
    return done();
  });

  // Render's blueprint can inject another service's address, but it supplies a
  // bare hostname ("replyiq-web.onrender.com") while CORS matches full origins.
  // Normalising here means the deployment config can stay declarative and
  // self-wiring instead of needing a hand-typed URL that drifts.
  const corsOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:5173';
  const allowedOrigins = corsOrigins
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0)
    .map((o) => (/^https?:\/\//.test(o) ? o : `https://${o}`));
  await app.register(cors, {
    origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
    credentials: true,
    // Declared explicitly. Left to the default, the preflight advertised only
    // GET, HEAD and POST, so every PATCH (all four onboarding steps, the
    // business profile) and every DELETE (removing a domain) was blocked by
    // the browser. Registration and login still worked, which made the app
    // look healthy while onboarding was impossible to finish.
    //
    // This never showed up locally because the Vite dev server proxies /api,
    // making requests same-origin - CORS is only exercised in a deployed
    // environment where the dashboard and API are on different hosts.
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  });

  app.useGlobalFilters(new GlobalExceptionFilter(app.get(Logger)));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      // 422 for field-level validation, per the documented exception mapping.
      // Business-rule failures that are not field validation (e.g. "complete
      // the profile step first") remain 400, so the two are distinguishable.
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      // Adds a `fields` map to the body so the dashboard can put each message
      // on the input it belongs to. Without it the only signal is prose in an
      // array, which the client cannot attach to anything - so a rejected form
      // looked like a button that did nothing.
      exceptionFactory: buildValidationException,
    }),
  );

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  app.useLogger(app.get(Logger));

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  const logger = app.get(Logger);
  logger.log(`Server running on http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  // A boot failure must be visible and must stop the process. Without this the
  // fatal bypass-misconfiguration check above would surface only as an
  // unhandled rejection, which some runtimes still survive.
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
