/**
 * @file packages/core/vitest/cliEmitter.test.ts
 * @description This file contains the tests for cliEmitter.
 * @author Luca Liguori
 */

import { setupTest } from '@matterbridge/test-utils/vitest/setup';

import { cliEmitter } from '../src/cliEmitter.js';

// Setup the test environment
await setupTest('CliEmitter', false);

describe('cliEmitter', () => {
  it('should be an instance of EventEmitter', () => {
    expect(cliEmitter).toBeDefined();
    expect(typeof cliEmitter.on).toBe('function');
    expect(typeof cliEmitter.emit).toBe('function');
  });
});
