import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    globalSetup: ['./vitest.integration.global-setup.ts'],
    // Concurrency test relies on controlled parallelism inside one file.
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
