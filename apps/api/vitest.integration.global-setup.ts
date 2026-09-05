import { execSync } from 'node:child_process';
import path from 'node:path';

const TEST_DB_URL =
  'postgresql://replyiq:replyiq_dev_password@localhost:5432/replyiq_test?schema=public';

/**
 * Prepares the isolated integration database:
 *  - applies all Prisma migrations (forward-only, never a reset)
 *  - purges leftovers from previous runs so every run starts hermetic
 */
export default async function setup(): Promise<void> {
  const databasePkgDir = path.resolve(process.cwd(), '..', '..', 'packages', 'database');

  execSync('npx prisma migrate deploy', {
    cwd: databasePkgDir,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: 'inherit',
  });

  // Remove rows from any previously interrupted run (marker-prefixed data only).
  const purgeSql = [
    'DELETE FROM "business_domains" WHERE "businessId" IN (SELECT b."id" FROM "businesses" b JOIN "organizations" o ON o."id" = b."organizationId" WHERE o."name" LIKE \'HARDEN-ORG-%\');',
    'DELETE FROM "onboarding_progress" WHERE "businessId" IN (SELECT b."id" FROM "businesses" b JOIN "organizations" o ON o."id" = b."organizationId" WHERE o."name" LIKE \'HARDEN-ORG-%\');',
    'DELETE FROM "businesses" WHERE "organizationId" IN (SELECT "id" FROM "organizations" WHERE "name" LIKE \'HARDEN-ORG-%\');',
    'DELETE FROM "users" WHERE "organizationId" IN (SELECT "id" FROM "organizations" WHERE "name" LIKE \'HARDEN-ORG-%\');',
    'DELETE FROM "organizations" WHERE "name" LIKE \'HARDEN-ORG-%\';',
  ].join('\n');

  execSync(`npx prisma db execute --stdin --url "${TEST_DB_URL}"`, {
    cwd: databasePkgDir,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    input: purgeSql,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}
