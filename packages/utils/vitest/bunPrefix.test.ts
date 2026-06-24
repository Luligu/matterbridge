// vitest\bunPrefix.test.ts

import os from 'node:os';
import path from 'node:path';

import { getGlobalBunModules } from '../src/bunPrefix.js';
import { setupTest } from './vitestSetupTest.js';

await setupTest('BunPrefix');

describe('getGlobalBunModules()', () => {
  const originalBunInstall = process.env.BUN_INSTALL;

  afterEach(() => {
    vi.restoreAllMocks();
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
