// vitest.config.ts v.2.0.8

// Vitest configuration file for a Vite / React project v.2.0.8

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  plugins: react(),
  test: {
    environment: 'jsdom',
    globals: true,
    // Disable Node's experimental built-in webstorage so the jsdom `localStorage` is used.
    // It is a Node bootstrap flag, so it must be passed to the pool worker processes (where
    // the tests run) via execArgv rather than set from within this config at runtime.
    execArgv: ['--no-experimental-webstorage'],
    // Every run also writes a JUnit XML report with the duration of each test (handy to find slow tests).
    // A --reporter passed on the command line replaces this list.
    reporters: ['default', 'junit'],
    outputFile: { junit: '.cache/vitest/junit.xml' },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text', 'json'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 90,
        statements: 90,
      },
    },
  },
});
