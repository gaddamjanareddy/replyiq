-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DOMAIN_PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('DNS_TXT', 'HTML_META');

-- AlterTable: Business
ALTER TABLE "businesses" ADD COLUMN "description" TEXT,
ADD COLUMN "websiteUrl" VARCHAR(500),
ADD COLUMN "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED';

-- AlterTable: BusinessDomain
ALTER TABLE "business_domains" ADD COLUMN "verificationMethod" "VerificationMethod";

-- CreateTable
CREATE TABLE "onboarding_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "businessId" UUID NOT NULL,
    "profileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "profileCompletedAt" TIMESTAMPTZ,
    "firstDomainAdded" BOOLEAN NOT NULL DEFAULT false,
    "firstDomainAddedAt" TIMESTAMPTZ,
    "firstDomainVerified" BOOLEAN NOT NULL DEFAULT false,
    "firstDomainVerifiedAt" TIMESTAMPTZ,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_progress_businessId_key" ON "onboarding_progress"("businessId");

-- CreateIndex
CREATE INDEX "businesses_onboardingStatus_idx" ON "businesses"("onboardingStatus");

-- AddForeignKey
ALTER TABLE "onboarding_progress" ADD CONSTRAINT "onboarding_progress_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
