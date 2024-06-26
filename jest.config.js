// jest.config.js
/*

How to install:
  npm install --save-dev jest ts-jest @types/jest eslint-plugin-jest

Add package.json scripts:
  "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
  "test:verbose": "node --experimental-vm-modules node_modules/jest/bin/jest.js --verbose",
  "test:watch": "node --experimental-vm-modules node_modules/jest/bin/jest.js --watch",

*/

export default {
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  transformIgnorePatterns: ['/node_modules/'],
};
