import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

const shared = {
  environment: 'node' as const,
  globals: true,
  setupFiles: ['./tests/setup.ts'],
  restoreMocks: true,
  clearMocks: true,
  unstubEnvs: true,
  unstubGlobals: true,
};

export default defineConfig({
  resolve: {
    alias: {
      '@': root,
      'server-only': fileURLToPath(new URL('./tests/server-only.ts', import.meta.url)),
    },
  },
  test: {
    ...shared,
    include: [
      'services/**/*.vitest.test.ts',
      'tests/**/*.vitest.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['services/documents/**/*.ts'],
      exclude: [
        'services/documents/**/*.vitest.test.ts',
        'services/documents/**/__tests__/**',
        'services/documents/legacy-openai-document-migration.ts',
      ],
    },
  },
});
