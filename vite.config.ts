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
      '**/jest-utils/', // Test package for Jest
      '**/vitest-utils/', // Test package for Vitest
      '**/matterNode*.test.ts', // Not released yet, so ignore for now
      '**/backend*.test.ts', // Not released yet, so ignore for now
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
      // include: ['**/src/**/*.{ts,mts,cts}'],
      include: [
        'packages/utils/src/**/*.{ts,mts,cts}',
        'packages/dgram/src/**/*.{ts,mts,cts}',
        'packages/types/src/**/*.{ts,mts,cts}',
        'packages/thread/src/**/*.{ts,mts,cts}',
        'packages/core/src/**/*.{ts,mts,cts}',
      ],
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
        'packages/core/src/jestutils/**/*.{ts,mts,cts}', // Internal jest test utilities
        'packages/core/src/backend.ts', // Not released yet, so ignore for now
        'packages/core/src/backendExpress.ts', // Not released yet, so ignore for now
        'packages/core/src/backendWsServer.ts', // Not released yet, so ignore for now
        'packages/core/src/matterNode.ts', // Not released yet, so ignore for now
        '**/src/**/*.{spec,test}.{ts,mts,cts}',
      ],
      thresholds: {
        'perFile': true,
        'packages/{utils,dgram,types,thread}/src/**/*.{ts,mts,cts}': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'packages/core/src/{behaviors,clusters,devices}/**/*.{ts,mts,cts}': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'packages/core/src/{deviceManager,helpers,matterbridgeAccessoryPlatform,matterbridgeDeviceTypes,matterbridgeDynamicPlatform,matterbridgeEndpointCommandHandler,matterbridgeFactory}.ts':
          {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
          },
        'packages/core/src/{frontend,matterbridge,matterbridgeEndpoint,matterbridgeEndpointHelpers}.ts': {
          functions: 100,
          lines: 100,
        },
      },
    },
  },
});
