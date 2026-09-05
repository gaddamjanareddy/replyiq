import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import configuration from './config/configuration.js';
import { validate } from './config/env.validation.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { BusinessModule } from './modules/business/business.module.js';
import { DomainModule } from './modules/domain/domain.module.js';
import { OnboardingModule } from './modules/onboarding/onboarding.module.js';
import { KnowledgeModule } from './modules/knowledge/knowledge.module.js';
import { DatabaseModule } from './shared/database/database.module.js';
import { AuditModule } from './infrastructure/audit/audit.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl: config.get<number>('rateLimit.ttl', 60) * 1000,
        limit: config.get<number>('rateLimit.max', 10),
      }],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        /**
         * pino-http serialises the whole request object, which includes
         * headers. Without this, every log line carries a live
         * `Authorization: Bearer <jwt>` - a working credential written into log
         * storage and forwarded to any log drain. Cookies and the response's
         * Set-Cookie are redacted for the same reason, ahead of the planned
         * move to httpOnly cookie sessions (NFR-SEC-09).
         */
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers["set-cookie"]',
            // Defence in depth for any future body logging.
            'req.body.password',
            'req.body.refreshToken',
          ],
          censor: '[redacted]',
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
      },
    }),
    DatabaseModule,
    AuditModule,
    HealthModule,
    AuthModule,
    IdentityModule,
    UsersModule,
    BusinessModule,
    DomainModule,
    OnboardingModule,
    KnowledgeModule,
  ],
})
export class AppModule {}
