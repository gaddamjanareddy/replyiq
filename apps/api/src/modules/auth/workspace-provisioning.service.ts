import { Injectable, Inject } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';
import type { Organization, Business, User } from '@replyiq/database';
import type { UserRole, OnboardingStatus } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PasswordService } from '../../common/security/password.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { TokenService } from '../../common/security/token.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { SessionService } from '../../infrastructure/security/session/session.service.js';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';
import type { RegisterWorkspaceDto } from './dto/register-workspace.dto.js';
import { ErrorCode, codedConflict } from '../../common/errors/error-codes.js';

type TransactionClient = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];

/**
 * Registration now uses the same `{ success, message, data }` envelope as every
 * other endpoint (D-03R). It previously returned a bare object, which forced
 * the client to special-case exactly one response shape - a permanent papercut
 * that every new client would have to rediscover. Both sides changed together.
 */
export interface RegisterWorkspaceResponse {
  success: boolean;
  message: string;
  data: RegisterWorkspaceData;
}

export interface RegisterWorkspaceData {
  session: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
  };
  business: {
    id: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
}

@Injectable()
export class WorkspaceProvisioningService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async register(
    dto: RegisterWorkspaceDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<RegisterWorkspaceResponse> {
    const passwordHash = await this.passwordService.hash(dto.password);
    const normalizedName = this.normalizeName(dto.businessName);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await this.createOrganization(tx, normalizedName);
        const business = await this.createBusiness(tx, organization.id, normalizedName);
        const user = await this.createOwner(
          tx,
          organization.id,
          dto.ownerName,
          dto.email,
          passwordHash,
        );
        return this.createSession(tx, user, organization, business, meta);
      });
    } catch (error: unknown) {
      if (this.isPrismaUniqueConstraintError(error)) {
        throw codedConflict(ErrorCode.AUTH_EMAIL_TAKEN, 'Email already in use');
      }
      throw error;
    }
  }

  private isPrismaUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    );
  }

  private normalizeName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private async createOrganization(
    tx: TransactionClient,
    name: string,
  ): Promise<Organization> {
    return tx.organization.create({ data: { name } });
  }

  private async createBusiness(
    tx: TransactionClient,
    organizationId: string,
    name: string,
  ): Promise<Business> {
    const business = await tx.business.create({
      data: {
        organizationId,
        name,
        onboardingStatus: 'NOT_STARTED' as OnboardingStatus,
      },
    });

    await tx.onboardingProgress.create({
      data: { businessId: business.id },
    });

    return business;
  }

  private async createOwner(
    tx: TransactionClient,
    organizationId: string,
    name: string,
    email: string,
    passwordHash: string,
  ): Promise<User> {
    return tx.user.create({
      data: {
        organizationId,
        name,
        email,
        role: 'OWNER' as UserRole,
        passwordHash,
      },
    });
  }

  private async createSession(
    tx: TransactionClient,
    user: User,
    organization: Organization,
    business: Business,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<RegisterWorkspaceResponse> {
    const sessionId = this.sessionService.generateSessionId();

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(payload),
      this.tokenService.generateRefreshToken({ sub: user.id, sessionId }),
    ]);

    const refreshTokenHash = await this.passwordService.hash(refreshToken);
    const expiresAt = this.getRefreshTokenExpiresAt();

    await tx.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash,
        expiresAt,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });

    const expiresIn = this.getAccessTokenExpiresInSeconds();

    return {
      success: true,
      message: 'Workspace created successfully',
      data: {
        session: { accessToken, refreshToken, expiresIn },
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        business: { id: business.id, name: business.name },
        organization: { id: organization.id, name: organization.name },
      },
    };
  }

  private getRefreshTokenExpiresAt(): Date {
    const ttl = this.configService.get<string>('jwt.refreshTokenTtl', '30d');
    const seconds = this.parseTtlToSeconds(ttl);
    return new Date(Date.now() + seconds * 1000);
  }

  private getAccessTokenExpiresInSeconds(): number {
    const ttl = this.configService.get<string>('jwt.accessTokenTtl') ?? '15m';
    return this.parseTtlToSeconds(ttl);
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900;
    }
    const valueStr = match[1];
    const unit = match[2];
    if (!valueStr || !unit) {
      return 900;
    }
    const value = parseInt(valueStr, 10);
    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 900;
    }
  }
}
