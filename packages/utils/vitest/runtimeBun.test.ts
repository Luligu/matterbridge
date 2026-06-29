// vitest\runtimeBun.test.ts

import os from 'node:os';
import path from 'node:path';

import { setupTest } from './vitestSetupTest.js';

await setupTest('RuntimeBun');

type RuntimeBunModule = typeof import('../src/runtimeBun.js');

const originalBunDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'Bun');
const originalBunInstall = process.env.BUN_INSTALL;
const originalArgv = [...process.argv];
const originalVersions = process.versions;

async function importRuntimeBun(): Promise<RuntimeBunModule> {
  vi.resetModules();
  return await import('../src/runtimeBun.js');
}

function restoreBunGlobal(): void {
  if (originalBunDescriptor) Object.defineProperty(globalThis, 'Bun', originalBunDescriptor);
  else Reflect.deleteProperty(globalThis, 'Bun');
}

function setProcessVersions(bun?: string): void {
  Object.defineProperty(process, 'versions', { configurable: true, value: bun === undefined ? originalVersions : { ...originalVersions, bun } });
}

function setBunGlobal(bun: unknown): void {
  Object.defineProperty(globalThis, 'Bun', { configurable: true, value: bun });
}

afterEach(() => {
  vi.restoreAllMocks();
  restoreBunGlobal();
  setProcessVersions();
  process.argv.splice(0, process.argv.length, ...originalArgv);
  if (originalBunInstall === undefined) delete process.env.BUN_INSTALL;
  else process.env.BUN_INSTALL = originalBunInstall;
});

describe('isBun()', () => {
  it('should return false when the Bun runtime is unavailable', async () => {
    restoreBunGlobal();
    setProcessVersions();

    const { isBun } = await importRuntimeBun();

    expect(isBun()).toBe(false);
  });

  it('should return true when only the Bun version is available', async () => {
    restoreBunGlobal();
    setProcessVersions('1.2.3');

    const { isBun } = await importRuntimeBun();

    expect(isBun()).toBe(true);
  });
});

describe('Node fallback runtime helpers', () => {
  it('should use Node-compatible fallback paths when Bun is unavailable', async () => {
    restoreBunGlobal();
    setProcessVersions();
    process.argv[1] = path.join('test', 'entry.js');
    const hrtimeSpy = vi.spyOn(process.hrtime, 'bigint').mockReturnValue(123n);

    const { gc, getBun, getBunRevision, getBunRuntimeInfo, getBunVersion, getGlobalBunModules, getNodeCompatVersion, isBun, nanoseconds, setGcLevel, sleep, which } =
      await importRuntimeBun();

    expect(isBun()).toBe(false);
    expect(getBun()).toBeUndefined();
    expect(getBunVersion()).toBeUndefined();
    expect(getBunRevision()).toBeUndefined();
    expect(getNodeCompatVersion()).toBe(originalVersions.node);
    expect(getGlobalBunModules).toThrow('getGlobalBunModules can only be called in a Bun environment.');
    expect(nanoseconds()).toBe(123);
    expect(hrtimeSpy).toHaveBeenCalledOnce();
    await expect(sleep(0)).resolves.toBeUndefined();
    expect(which('node')).toBeNull();
    expect(gc()).toBeUndefined();
    expect(setGcLevel(1)).toBeUndefined();
    expect(getBunRuntimeInfo()).toEqual({
      isBun: false,
      version: undefined,
      revision: undefined,
      nodeCompat: originalVersions.node,
      execPath: process.execPath,
      main: path.join('test', 'entry.js'),
      arch: process.arch,
      platform: process.platform,
    });
  });
});

describe('getGlobalBunModules()', () => {
  it('should derive the path from BUN_INSTALL when only the Bun version is set', async () => {
    restoreBunGlobal();
    setProcessVersions('1.2.3');
    process.env.BUN_INSTALL = path.join('/opt', 'bun');

    const { getGlobalBunModules } = await importRuntimeBun();

    expect(getGlobalBunModules()).toBe(path.join('/opt', 'bun', 'install', 'global', 'node_modules'));
  });

  it('should fall back to the home directory when BUN_INSTALL is unset', async () => {
    restoreBunGlobal();
    setProcessVersions('1.2.3');
    delete process.env.BUN_INSTALL;
    vi.spyOn(os, 'homedir').mockReturnValue('/home/tester');

    const { getGlobalBunModules } = await importRuntimeBun();

    expect(getGlobalBunModules()).toBe(path.join('/home/tester', '.bun', 'install', 'global', 'node_modules'));
  });
});

describe('Bun runtime helpers', () => {
  it('should use Bun APIs when the Bun global is available', async () => {
    const fakeBun = {
      version: '1.3.14',
      revision: '0d9b296af33f2b851fcbf4df3e9ec89751734ba4',
      main: path.join('bun', 'main.ts'),
      nanoseconds: vi.fn(() => 42),
      sleep: vi.fn(async () => {}),
      which: vi.fn(() => path.join('bin', 'bun')),
      gc: vi.fn(),
      unsafe: {
        gcAggressionLevel: vi.fn(() => 0 as const),
      },
    };
    setBunGlobal(fakeBun);
    setProcessVersions('1.3.14');
    process.env.BUN_INSTALL = path.join('/opt', 'bun');

    const { gc, getBun, getBunRevision, getBunRuntimeInfo, getBunVersion, getGlobalBunModules, getNodeCompatVersion, isBun, nanoseconds, setGcLevel, sleep, which } =
      await importRuntimeBun();

    expect(isBun()).toBe(true);
    expect(getBun()).toBe(fakeBun);
    expect(getBunVersion()).toBe('1.3.14');
    expect(getBunRevision()).toBe('0d9b296af33f2b851fcbf4df3e9ec89751734ba4');
    expect(getNodeCompatVersion()).toBe(originalVersions.node);
    expect(getGlobalBunModules()).toBe(path.join('/opt', 'bun', 'install', 'global', 'node_modules'));
    expect(nanoseconds()).toBe(42);
    expect(fakeBun.nanoseconds).toHaveBeenCalledOnce();
    await expect(sleep(10)).resolves.toBeUndefined();
    expect(fakeBun.sleep).toHaveBeenCalledWith(10);
    expect(which('bun')).toBe(path.join('bin', 'bun'));
    expect(fakeBun.which).toHaveBeenCalledWith('bun');
    gc(false);
    expect(fakeBun.gc).toHaveBeenCalledWith(false);
    expect(setGcLevel(2)).toBe(0);
    expect(fakeBun.unsafe.gcAggressionLevel).toHaveBeenCalledWith(2);
    expect(getBunRuntimeInfo()).toEqual({
      isBun: true,
      version: '1.3.14',
      revision: '0d9b296af33f2b851fcbf4df3e9ec89751734ba4',
      nodeCompat: originalVersions.node,
      execPath: process.execPath,
      main: path.join('bun', 'main.ts'),
      arch: process.arch,
      platform: process.platform,
    });
  });
});
