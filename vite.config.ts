// vite.config.ts 2.0.5

// This Vitest configuration is designed for a TypeScript project.

import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.cache/vitest',
  test: {
    include: ['**/vitest/**/*.{spec,test}.{ts,mts,cts}'],
    exclude: [
      '**/.cache/',
      '**/apps/',
      '**/build/',
      '**/chip/',
      '**/coverage/',
      '**/dist/',
      '**/node_modules/',
      '**/screenshots/',
      '**/scripts/',
      '**/src/mock/',
      '**/temp/',
      '**/vendor/',
    ],
    globals: true,
    clearMocks: false,
    restoreMocks: false,
    environment: 'node',
    maxWorkers: '100%',
    coverage: {
      provider: 'istanbul',
      reportsDirectory: 'coverage/vitest',
      reporter: ['lcov', 'text', 'json'],
      include: ['**/src/**/*.{ts,mts,cts}'],
      exclude: [
        '**/.cache/',
        '**/apps/',
        '**/build/',
        '**/chip/',
        '**/coverage/',
        '**/dist/',
        '**/node_modules/',
        '**/screenshots/',
        '**/scripts/',
        '**/src/mock/',
        '**/temp/',
        '**/vendor/',
        '**/vitest/**',
        '**/src/**/*.d.ts',
      ],
    },
  },
});
