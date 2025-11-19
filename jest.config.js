// jest.config.js

// This Jest configuration is designed for a TypeScript project using ESM modules with ts-jest.

import { createDefaultEsmPreset } from 'ts-jest';

// Create an ESM configuration to process TypeScript files (.ts/.mts/.tsx/.mtsx).
const presetConfig = createDefaultEsmPreset({
  tsconfig: './tsconfig.jest.json',
});

const jestConfig = {
  ...presetConfig,
  testEnvironment: 'node', // Use Node.js environment for testing
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' }, // Handle ESM imports by removing the .js extension
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/vitest/', '/frontend/', '/src/crypto/', '/src/mock/', 'jestHelpers.ts'], // Ignore specific paths for test files
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/vitest/', '/frontend/', '/src/crypto/', '/src/mock/', 'jestHelpers.ts', 'matterNode.ts'], // Ignore specific paths for test and coverage
  maxWorkers: '100%', // Use all available CPU cores for running tests
};

export default jestConfig;
