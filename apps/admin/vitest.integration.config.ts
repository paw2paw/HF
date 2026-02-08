import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for integration tests.
 *
 * Unlike unit tests:
 * - No mocking of fs, Prisma, or fetch
 * - Requires server running on localhost:3000
 * - Tests against real filesystem and database
 *
 * Run with: npm run test:integration
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    exclude: ['node_modules', '.next'],
    setupFiles: ['./tests/integration/setup.ts'],
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
