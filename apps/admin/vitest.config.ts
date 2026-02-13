import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    exclude: ['node_modules', '.next', 'tests/integration/**', 'e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'lib/ops/**/*.ts',
        'lib/prompt/composition/**/*.ts',
        'lib/pipeline/**/*.ts',
        'lib/utils/**/*.ts',
        'lib/lab/**/*.ts',
        'app/**/*.tsx',
        'app/api/**/*.ts',
      ],
    },
    // Mock Prisma by default
    setupFiles: ['./tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
