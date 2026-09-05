import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';
import type { User, UserRole } from '@replyiq/database';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PasswordService } from '../../common/security/password.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { TokenService } from '../../common/security/token.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { SessionService } from '../../infrastructure/security/session/session.service.js';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ErrorCode, codedUnauthorized } from '../../common/errors/error-codes.js';

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      organizationId: string;
      businessId: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface RefreshResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      organizationId: string;
      businessId: string;
    };
    accessToken: string;
    refreshToken: string;
  };
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface CurrentUserResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
      organizationId: string;
      businessId: string;
    };
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<LoginResponse> {
    const user = await this.findUserByEmail(dto.email);

    if (!user) {
      throw codedUnauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw codedUnauthorized(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Invalid email or password');
    }

    return this.createSession(user, meta);
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshResponse> {
    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw codedUnauthorized(ErrorCode.AUTH_REFRESH_INVALID, 'Invalid or expired refresh token');
    }

    const session = await this.sessionService.findSessionById(payload.sessionId);

    if (!session) {
      throw codedUnauthorized(ErrorCode.AUTH_REFRESH_INVALID, 'Invalid or expired refresh token');
    }

    if (session.revokedAt) {
      throw codedUnauthorized(ErrorCode.AUTH_REFRESH_INVALID, 'Invalid or expired refresh token');
    }

    if (session.expiresAt < new Date()) {
      throw codedUnauthorized(ErrorCode.AUTH_REFRESH_INVALID, 'Invalid or expired refresh token');
    }

    const isValid = await this.passwordService.verify(
      dto.refreshToken,
      session.refreshTokenHash,
    );

    if (!isValid) {
      throw codedUnauthorized(ErrorCode.AUTH_REFRESH_INVALID, 'Invalid refresh token');
    }

    const user = await this.findUserById(payload.sub);

    if (!user) {
      throw codedUnauthorized(ErrorCode.AUTH_REFRESH_INVALID, 'Invalid or expired refresh token');
    }

    const accessTokenPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
      sessionId: session.id,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.tokenService.generateAccessToken(accessTokenPayload),
      this.tokenService.generateRefreshToken({ sub: user.id, sessionId: session.id }),
    ]);

    const newRefreshTokenHash = await this.passwordService.hash(refreshToken);

    await this.sessionService.rotateRefreshToken(
      session.id,
      newRefreshTokenHash,
    );

    await this.sessionService.updateLastUsed(session.id);

    const business = await this.prisma.business.findFirst({
      where: { organizationId: user.organizationId },
    });

    return {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          businessId: business?.id ?? '',
        },
        accessToken,
        refreshToken,
      },
    };
  }

  async logout(sessionId: string): Promise<LogoutResponse> {
    const session = await this.sessionService.findSessionById(sessionId);

    if (!session) {
      throw codedUnauthorized(ErrorCode.AUTH_UNAUTHENTICATED, 'Session not found');
    }

    if (session.revokedAt) {
      throw codedUnauthorized(ErrorCode.AUTH_UNAUTHENTICATED, 'Session already revoked');
    }

    await this.sessionService.revokeSession(sessionId);

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  async getCurrentUser(payload: JwtPayload): Promise<CurrentUserResponse> {
    const user = await this.findUserById(payload.sub);

    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedException();
    }

    const business = await this.prisma.business.findFirst({
      where: { organizationId: user.organizationId },
    });

    return {
      success: true,
      message: 'Current user retrieved successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          businessId: business?.id ?? '',
        },
      },
    };
  }

  private async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  private async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  private async createSession(
    user: User,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<LoginResponse> {
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

    await this.sessionService.createSession(
      sessionId,
      user.id,
      refreshTokenHash,
      expiresAt,
      meta,
    );

    const business = await this.prisma.business.findFirst({
      where: { organizationId: user.organizationId },
    });

    return {
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
          businessId: business?.id ?? '',
        },
        accessToken,
        refreshToken,
      },
    };
  }

  private getRefreshTokenExpiresAt(): Date {
    const ttl = this.configService.get<string>('jwt.refreshTokenTtl', '30d');
    const seconds = this.parseTtlToSeconds(ttl);
    return new Date(Date.now() + seconds * 1000);
  }

  private parseTtlToSeconds(ttl: string): number {
    const match = ttl.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 30 * 86400;
    }
    const valueStr = match[1];
    const unit = match[2];
    if (!valueStr || !unit) {
      return 30 * 86400;
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
        return 30 * 86400;
    }
  }
}
