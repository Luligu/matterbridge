// Vitest configuration file for a React project

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
  },
});
