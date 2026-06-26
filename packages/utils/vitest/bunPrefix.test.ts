// vitest\bunPrefix.test.ts

import os from 'node:os';
import path from 'node:path';

import { getGlobalBunModules, isBun } from '../src/bunPrefix.js';
import { setupTest } from './vitestSetupTest.js';

await setupTest('BunPrefix');

describe('isBun()', () => {
  it('should return false when the Bun version is unavailable', () => {
    expect(isBun()).toBe(false);
  });

  it('should return true when the Bun version is available', () => {
    const originalVersions = process.versions;
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });

    try {
      expect(isBun()).toBe(true);
    } finally {
      Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    }
  });
});

describe('getGlobalBunModules() outside Bun', () => {
  it('should throw when the Bun version is unavailable', () => {
    expect(getGlobalBunModules).toThrow('getGlobalBunModules can only be called in a Bun environment.');
  });
});

describe('getGlobalBunModules()', () => {
  const originalBunInstall = process.env.BUN_INSTALL;
  const originalVersions = process.versions;

  beforeEach(() => {
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    if (originalBunInstall === undefined) delete process.env.BUN_INSTALL;
    else process.env.BUN_INSTALL = originalBunInstall;
  });

  it('should derive the path from BUN_INSTALL when it is set', () => {
    process.env.BUN_INSTALL = path.join('/opt', 'bun');
    expect(getGlobalBunModules()).toBe(path.join('/opt', 'bun', 'install', 'global', 'node_modules'));
  });

  it('should fall back to the home directory when BUN_INSTALL is unset', () => {
    delete process.env.BUN_INSTALL;
    vi.spyOn(os, 'homedir').mockReturnValue('/home/tester');
    expect(getGlobalBunModules()).toBe(path.join('/home/tester', '.bun', 'install', 'global', 'node_modules'));
  });
});
