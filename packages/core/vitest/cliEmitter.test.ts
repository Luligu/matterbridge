/**
 * @file packages/core/vitest/cliEmitter.test.ts
 * @description This file contains the tests for cliEmitter.
 * @author Luca Liguori
 */

import { setupTest } from '@matterbridge/test-utils/vitest';

import { cliEmitter, lastOsCpuUsage, lastProcessCpuUsage, setLastOsCpuUsage, setLastProcessCpuUsage } from '../src/cliEmitter.js';

// Setup the test environment
await setupTest('CliEmitter', false);

describe('cliEmitter', () => {
  it('should be an instance of EventEmitter', () => {
    expect(cliEmitter).toBeDefined();
    expect(typeof cliEmitter.on).toBe('function');
    expect(typeof cliEmitter.emit).toBe('function');
  });
});

describe('lastOsCpuUsage variable and setLastOsCpuUsage', () => {
  it('should default to 0', () => {
    expect(lastOsCpuUsage).toBe(0);
  });

  it('should update lastOsCpuUsage via setLastOsCpuUsage', () => {
    setLastOsCpuUsage(55);
    expect(lastOsCpuUsage).toBe(55);
  });
});

describe('lastProcessCpuUsage variable and setLastProcessCpuUsage', () => {
  it('should default to 0', () => {
    expect(lastProcessCpuUsage).toBe(0);
  });

  it('should update lastProcessCpuUsage via setLastProcessCpuUsage', () => {
    setLastProcessCpuUsage(55);
    expect(lastProcessCpuUsage).toBe(55);
  });
});
