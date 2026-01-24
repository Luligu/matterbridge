// jest.config.js

// This Jest configuration is designed for a TypeScript project using ESM modules with ts-jest.
// @ts-check

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
  testEnvironment: 'node', // Use Node.js environment for testing
  cacheDirectory: '<rootDir>/.cache/jest',
  coverageProvider: 'v8', // Avoid Babel-based instrumentation (and its large-file deoptimised styling notes)
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }, // Handle ESM imports by removing the .js extension
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/vitest/', '/frontend/', '/src/crypto/', '/src/mock/', 'jestHelpers.ts'], // Ignore specific paths for test files
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/vitest/', '/frontend/', '/src/crypto/', '/src/mock/', 'jestHelpers.ts'], // Ignore specific paths for test and coverage
  maxWorkers: '100%', // Use all available CPU cores for running tests
};

export default jestConfig;
