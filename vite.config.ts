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
      '**/jest-utils/', // Plugins test package for Jest
      '**/vitest-utils/', // Plugins test package for Vitest
      '**/matterNode*.test.ts', // Not released yet, so ignore for now
      '**/backend*.test.ts', // Not released yet, so ignore for now
    ],
    globals: true,
    clearMocks: false,
    restoreMocks: false,
    environment: 'node',
    maxWorkers: '100%',
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage/vitest',
      reporter: ['lcov', 'text', 'json'],
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
        '**/src/**/*.d.ts', // TypeScript declaration files should be excluded from coverage
        '**/src/**/*.{spec,test}.{ts,mts,cts}', // Any test files should be excluded from coverage, even if they are not in the vitest folder
        'src/export.ts', // Root package entrypoint re-export file
        'src/clusters/export.ts', // Root package entrypoint re-export file
        'src/devices/export.ts', // Root package entrypoint re-export file
        'src/dgram/export.ts', // Root package entrypoint re-export file
        'src/jest-utils/export.ts', // Root package entrypoint re-export file
        'src/jest-utils/matter.ts', // Root package entrypoint re-export file
        'src/jestutils/export.ts', // Root package entrypoint re-export file
        'src/logger/export.ts', // Root package entrypoint re-export file
        'src/matter/behaviors.ts', // Root package entrypoint re-export file
        'src/matter/clusters.ts', // Root package entrypoint re-export file
        'src/matter/devices.ts', // Root package entrypoint re-export file
        'src/matter/endpoints.ts', // Root package entrypoint re-export file
        'src/matter/export.ts', // Root package entrypoint re-export file
        'src/matter/model.ts', // Root package entrypoint re-export file
        'src/matter/types.ts', // Root package entrypoint re-export file
        'src/storage/export.ts', // Root package entrypoint re-export file
        'src/utils/export.ts', // Root package entrypoint re-export file
        'src/vitest-utils/export.ts', // Root package entrypoint re-export file
        'src/vitest-utils/matter.ts', // Root package entrypoint re-export file
        'packages/core/src/behaviors/export.ts', // Core behavior barrel re-export file
        'packages/core/src/matterbridgeEndpointTypes.ts', // Type-only module with no behavior to cover
        'packages/types/src/broadcastServerTypes.ts', // Type-only module with no behavior to cover
        'packages/types/src/matterbridgePlatformTypes.ts', // Type-only module with no behavior to cover
        'packages/core/src/jestutils/**/*.{ts,mts,cts}', // Internal deprecated jest test utilities
        'packages/core/src/backend.ts', // Not released yet, so ignore for now
        'packages/core/src/backendExpress.ts', // Not released yet, so ignore for now
        'packages/core/src/backendWsServer.ts', // Not released yet, so ignore for now
        'packages/core/src/matterNode.ts', // Not released yet, so ignore for now
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
