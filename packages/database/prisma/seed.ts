/// <reference types="node" />
import { hash } from 'argon2';
import { PrismaClient, OrganizationStatus, UserRole, UserStatus, BusinessStatus, BusinessDomainStatus, OnboardingStatus, VerificationMethod } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'ReplyIQ Corp',
      status: OrganizationStatus.ACTIVE,
    },
  });

  const passwordHash = await hash('Password@123');
  const owner = await prisma.user.upsert({
    where: { email: 'jan@replyiq.com' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      organizationId: organization.id,
      name: 'Janardhan Reddy',
      email: 'jan@replyiq.com',
      role: UserRole.OWNER,
      status: UserStatus.ACTIVE,
      passwordHash,
    },
  });

  const business = await prisma.business.upsert({
    where: { id: '00000000-0000-0000-0000-000000000003' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000003',
      organizationId: organization.id,
      name: 'ReplyIQ',
      industry: 'SaaS / AI',
      description: 'AI-powered customer engagement platform',
      websiteUrl: 'https://replyiq.com',
      onboardingStatus: OnboardingStatus.COMPLETED,
      status: BusinessStatus.ACTIVE,
    },
  });

  // Addressed by id, not by domain: uniqueness on `domain` is a PARTIAL index
  // (active rows only), which Prisma cannot express as a unique input.
  const domain = await prisma.businessDomain.upsert({
    where: { id: '00000000-0000-0000-0000-000000000004' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000004',
      businessId: business.id,
      domain: 'replyiq.com',
      isPrimary: true,
      status: BusinessDomainStatus.VERIFIED,
      verifiedAt: new Date(),
      verificationMethod: VerificationMethod.DNS_TXT,
      isSandbox: false,
    },
  });

  // A ready-made Test Mode domain so a developer can exercise the sandbox path
  // immediately after seeding. `.example.com` is IANA-reserved, so this can
  // never collide with a real customer's claim.
  const sandboxDomain = await prisma.businessDomain.upsert({
    where: { id: '00000000-0000-0000-0000-000000000005' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000005',
      businessId: business.id,
      domain: 'demo.example.com',
      isPrimary: false,
      status: BusinessDomainStatus.VERIFIED,
      verifiedAt: new Date(),
      verificationMethod: VerificationMethod.SANDBOX,
      isSandbox: true,
    },
  });

  await prisma.onboardingProgress.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      profileCompleted: true,
      profileCompletedAt: new Date(),
      firstDomainAdded: true,
      firstDomainAddedAt: new Date(),
      firstDomainVerified: true,
      firstDomainVerifiedAt: new Date(),
      onboardingCompleted: true,
      onboardingCompletedAt: new Date(),
    },
  });

  console.log('Seeded:');
  console.log(`  Organization: ${organization.name} (${organization.id})`);
  console.log(`  User:         ${owner.name} (${owner.email})`);
  console.log(`  Business:     ${business.name} (${business.id})`);
  console.log(`  Domain:       ${domain.domain} (live)`);
  console.log(`  Domain:       ${sandboxDomain.domain} (test mode)`);
  console.log(`  Onboarding:   Completed`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
