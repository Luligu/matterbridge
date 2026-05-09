// @ts-check
// jest.config.js 2.0.1

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
  testEnvironment: 'node', // Use Node.js environment for testing
  cacheDirectory: '<rootDir>/.cache/jest',
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }, // Handle ESM imports by removing the .js extension
  testPathIgnorePatterns: [
    '/.cache/',
    '/dist/',
    '/build/',
    '/node_modules/',
    '/scripts/',
    '/vitest/',
    '/apps/',
    '/src/mock/',
    '/vendor/',
    '/temp/',
    '/packages/core/src/crypto/',
    '/packages/core/src/workers/',
    '/packages/core/src/mock/',
    '/packages/core/src/jestutils/',
    'matterNode',
  ], // Ignore specific paths for test files
  coveragePathIgnorePatterns: [
    '/.cache/',
    '/dist/',
    '/build/',
    '/node_modules/',
    '/scripts/',
    '/vitest/',
    '/apps/',
    '/src/mock/',
    '/vendor/',
    '/temp/',
    '/packages/core/src/crypto/',
    '/packages/core/src/workers/',
    '/packages/core/src/mock/',
    '/packages/core/src/jestutils/',
    'matterNode',
  ], // Ignore specific paths for test and coverage
  maxWorkers: '100%', // Use all available CPU cores for running tests
};

export default jestConfig;
