// @ts-check
// jest.config.js 2.0.2

// This Jest configuration is designed for a TypeScript project using ESM modules with ts-jest.

import { createDefaultEsmPreset } from 'ts-jest';

// Create an ESM configuration to process TypeScript files (.ts/.mts/.tsx/.mtsx).
/** @typedef {{ tsconfig: string }} TsJestEsmPresetOptions */

/** @type {TsJestEsmPresetOptions} */
const tsJestEsmPresetOptions = {
  tsconfig: './tsconfig.jest.json',
};

/** @type {import('ts-jest').DefaultEsmPreset} */
const presetConfig = createDefaultEsmPreset(tsJestEsmPresetOptions);

/** @type {import('ts-jest').JestConfigWithTsJest} */
const jestConfig = {
  ...presetConfig,
  // Use Node.js environment for testing
  testEnvironment: 'node',
  // Use a custom cache directory for Jest to improve performance
  cacheDirectory: '<rootDir>/.cache/jest',
  // Handle ESM imports by removing the .js extension
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  // Match test files in src and test directories (glob)
  testMatch: ['**/src/**/*.{spec,test}.{ts,mts,cts}', '**/test/**/*.{spec,test}.{ts,mts,cts}'],
  // Ignore specific paths for test files (regex)
  testPathIgnorePatterns: [
    '/.cache/',
    '/apps/',
    '/build/',
    '/chip/',
    '/coverage/',
    '/dist/',
    '/node_modules/',
    '/screenshots/',
    '/scripts/',
    '/src/mock/',
    '/temp/',
    '/vendor/',
    '/vitest/',
    // Matterbridge specific paths to ignore
    '/packages/core/src/crypto/',
    '/packages/core/src/workers/',
    '/packages/core/src/mock/',
    '/packages/core/src/jestutils/',
    '/packages/core/test/backend', // Not released yet, so ignore for now
    '/packages/core/test/matterNode', // Not released yet, so ignore for now
    '/packages/vitest-utils/',
    '/packages/jest-utils/',
  ],
  collectCoverageFrom: ['**/src/**/*.{ts,mts,cts}'],
  coverageDirectory: 'coverage/jest',
  coverageReporters: ['lcov', 'text', 'json'],
  // Ignore specific paths for coverage files (regex)
  coveragePathIgnorePatterns: [
    '/.cache/',
    '/apps/',
    '/build/',
    '/chip/',
    '/coverage/',
    '/dist/',
    '/node_modules/',
    '/screenshots/',
    '/scripts/',
    '/src/mock/',
    '/temp/',
    '/vendor/',
    '/vitest/',
    '/src/.*\\.d\\.ts$',
    // Matterbridge specific paths to ignore
    '/packages/core/src/crypto/',
    '/packages/core/src/workers/',
    '/packages/core/src/mock/',
    '/packages/core/src/jestutils/',
    '/packages/core/src/backend', // Not released yet, so ignore for now
    '/packages/core/src/matterNode', // Not released yet, so ignore for now
    '/packages/vitest-utils/',
    '/packages/jest-utils/',
    // Vitest specific paths to ignore
    '/packages/core/src/matterbridgeFactory.ts',
  ],
  // Use all available CPU cores for running tests
  maxWorkers: '100%',
};

export default jestConfig;
