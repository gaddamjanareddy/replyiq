import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PrismaClient } from '@replyiq/database';
import type { Session } from '@replyiq/database';

@Injectable()
export class SessionService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
  ) {}

  generateSessionId(): string {
    return randomUUID();
  }

  async createSession(
    sessionId: string,
    userId: string,
    refreshTokenHash: string,
    expiresAt: Date,
    options?: { ipAddress?: string; userAgent?: string },
  ): Promise<Session> {
    return this.prisma.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash,
        expiresAt,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent,
      },
    });
  }

  async findSessionById(sessionId: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { id: sessionId },
    });
  }

  async rotateRefreshToken(
    sessionId: string,
    newRefreshTokenHash: string,
  ): Promise<Session> {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        updatedAt: new Date(),
      },
    });
  }

  async updateLastUsed(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }
}
