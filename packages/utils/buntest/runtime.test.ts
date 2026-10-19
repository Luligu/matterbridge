/**
 * @file packages/utils/buntest/runtime.test.ts
 * @description This file contains the tests for runtime.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
// The namespace is what spyOn() needs to replace spawnSync.
// oxlint-disable-next-line import/no-namespace
import * as childProcess from 'node:child_process';

import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { hasPasswordlessSudo, isRoot } from '../src/runtime.js';

// Setup the test environment
await setupTest('Runtime', false);

const spawnSyncSpy = spyOn(childProcess, 'spawnSync');
const originalPlatform = process.platform;
const originalGetuid = process.getuid;

afterEach(() => {
  spawnSyncSpy.mockReset();
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  process.getuid = originalGetuid;
});

afterAll(() => {
  spawnSyncSpy.mockRestore();
});

describe('isRoot()', () => {
  it('should return true when the user id is 0', () => {
    process.getuid = (): number => 0;
    expect(isRoot()).toBe(true);
  });

  it('should return false when the user id is not 0', () => {
    process.getuid = (): number => 1000;
    expect(isRoot()).toBe(false);
  });

  it('should return false when there are no user ids, as on Windows', () => {
    process.getuid = undefined;
    expect(isRoot()).toBe(false);
  });
});

describe('hasPasswordlessSudo()', () => {
  beforeEach(() => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
  });

  it('should return true when sudo -n true succeeds', () => {
    spawnSyncSpy.mockReturnValue({ status: 0 } as ReturnType<typeof childProcess.spawnSync>);

    expect(hasPasswordlessSudo()).toBe(true);
    expect(spawnSyncSpy).toHaveBeenCalledWith('sudo', ['-n', 'true'], expect.objectContaining({ stdio: 'ignore' }));
  });

  it('should return false when sudo needs a password', () => {
    spawnSyncSpy.mockReturnValue({ status: 1 } as ReturnType<typeof childProcess.spawnSync>);

    expect(hasPasswordlessSudo()).toBe(false);
  });

  it('should return false when sudo is missing', () => {
    spawnSyncSpy.mockReturnValue({ status: null, error: new Error('spawn sudo ENOENT') } as unknown as ReturnType<typeof childProcess.spawnSync>);

    expect(hasPasswordlessSudo()).toBe(false);
  });

  it('should return false when spawning sudo throws', () => {
    spawnSyncSpy.mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(hasPasswordlessSudo()).toBe(false);
  });

  it('should return false on Windows without running sudo', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(hasPasswordlessSudo()).toBe(false);
    expect(spawnSyncSpy).not.toHaveBeenCalled();
  });
});
