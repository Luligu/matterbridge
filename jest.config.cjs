// jest.config.cjs

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // 🧪 Use ts-jest to transform TypeScript files during test runs
  preset: 'ts-jest',

  // 🧾 Simulate a Node.js environment (e.g. for fs, path, etc.)
  testEnvironment: 'node',

  // 🎯 Use ts-jest to transform all `.ts` and `.tsx` files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },

  // ⚠️ Force Jest to treat everything as CommonJS (do not activate ESM mode)
  extensionsToTreatAsEsm: [],

  // 🛠 Fix for import paths ending with `.js` (used in ESM source, but stripped in tests)
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // 📂 Look for tests only inside the ./test directory
  roots: ['<rootDir>/test'],

  // 🔍 Match test files by naming convention
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],

  // 🚫 Ignore these paths when discovering test files
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/frontend/', '/src/crypto/', '/src/mock/', '/vitest/'],

  // 🚫 Ignore these paths for coverage reporting
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/frontend/', '/src/crypto/', '/src/mock/', '/vitest/'],

  // 🚀 Use all available CPU cores when running tests
  maxWorkers: '100%',
};
