process.env.NODE_ENV = 'test';

// Unit tests never touch a database; this URL exists only so that module-scope
// PrismaClient construction does not throw. The integration suite uses its own
// config (vitest.integration.config.ts) pointing at the isolated replyiq_test db.
process.env.DATABASE_URL =
  'postgresql://replyiq:replyiq_dev_password@localhost:5432/replyiq_test?schema=public';
