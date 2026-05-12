// vite.config.ts
// vite.config.ts 2.0.3

// This Vitest configuration is designed for a TypeScript project.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.cache/vitest',
  test: {
    include: ['**/vitest/**/*.spec.{ts,mts,cts}', '**/vitest/**/*.test.{ts,mts,cts}'],
    exclude: ['**/.cache', '**/apps/', '**/build', '**/chip', '**/coverage', '**/dist/', '**/node_modules/', '**/screenshots', '**/temp', '**/vendor'],
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    environment: 'node',
    maxWorkers: 100,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['**/src/**/*.{ts,mts,cts}'],
      exclude: ['**/.cache', '**/apps/', '**/build', '**/chip', '**/coverage', '**/dist/', '**/node_modules/', '**/screenshots', '**/temp', '**/vendor', '**/src/**/*.d.ts'],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
