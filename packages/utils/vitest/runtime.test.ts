/**
 * @file packages/utils/vitest/runtime.test.ts
 * @description This file contains the tests for runtime.
 * @author Luca Liguori
 */

import { spawnSync } from 'node:child_process';

import { setupTest } from '@matterbridge/test-utils/vitest/setup';

import { hasPasswordlessSudo, isRoot } from '../src/runtime.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return { ...actual, spawnSync: vi.fn() };
});

// Setup the test environment
await setupTest('Runtime', false);

const spawnSyncMock = vi.mocked(spawnSync);
const originalPlatform = process.platform;
const originalGetuid = process.getuid;

afterEach(() => {
  spawnSyncMock.mockReset();
  Object.defineProperty(process, 'platform', { value: originalPlatform });
  process.getuid = originalGetuid;
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
    spawnSyncMock.mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>);

    expect(hasPasswordlessSudo()).toBe(true);
    expect(spawnSyncMock).toHaveBeenCalledWith('sudo', ['-n', 'true'], expect.objectContaining({ stdio: 'ignore' }));
  });

  it('should return false when sudo needs a password', () => {
    spawnSyncMock.mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>);

    expect(hasPasswordlessSudo()).toBe(false);
  });

  it('should return false when sudo is missing', () => {
    spawnSyncMock.mockReturnValue({ status: null, error: new Error('spawn sudo ENOENT') } as unknown as ReturnType<typeof spawnSync>);

    expect(hasPasswordlessSudo()).toBe(false);
  });

  it('should return false when spawning sudo throws', () => {
    spawnSyncMock.mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(hasPasswordlessSudo()).toBe(false);
  });

  it('should return false on Windows without running sudo', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(hasPasswordlessSudo()).toBe(false);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });
});
