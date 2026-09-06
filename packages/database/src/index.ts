export { prisma } from './client.js';
// `Prisma` carries the query-building helpers (Prisma.sql, Prisma.raw) that
// callers need to compose parameterised raw SQL safely.
export { Prisma, PrismaClient } from '@prisma/client';
export type {
  Organization,
  User,
  Business,
  BusinessDomain,
  Session,
  OnboardingProgress,
  AuditLog,
  KnowledgeSource,
  KnowledgeItem,
  OrganizationStatus,
  BusinessStatus,
  UserRole,
  UserStatus,
  BusinessDomainStatus,
  OnboardingStatus,
  VerificationMethod,
  KnowledgeSourceType,
  KnowledgeSourceStatus,
} from '@prisma/client';
