/**
 * @file packages/utils/buntest/runtimeBun.test.ts
 * @description This file contains the tests for runtimeBun.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn, vi } from 'bun:test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  bunAvailable,
  gc,
  getBun,
  getBunLatestVersion,
  getBunRevision,
  getBunRuntimeInfo,
  getBunVersion,
  getGlobalBunModules,
  getNodeCompatVersion,
  isBun,
  memoryFootprint,
  nanoseconds,
  setGcLevel,
  sleep,
  which,
} from '../src/runtimeBun.js';
// The namespace is what spyOn() needs to replace isBun; spying it also intercepts the module's
// own internal calls, which is what makes the isBun()-guarded branches testable.
// oxlint-disable-next-line import/no-namespace
import * as runtimeBun from '../src/runtimeBun.js';

// Spies installed by the current test, restored in afterEach. vi.restoreAllMocks() is kept for afterAll,
// since it would also detach the spies of other helpers such as setupTest.
const testSpies: { mockRestore: () => void }[] = [];

/**
 * Register a spy so that afterEach restores it once the current test is done.
 *
 * @param {T} spy - The spy to restore after the current test.
 * @returns {T} The same spy, to keep chaining or assigning it.
 */
function track<T extends { mockRestore: () => void }>(spy: T): T {
  testSpies.push(spy);
  return spy;
}

// Under the Bun runtime the `Bun` global is non-configurable and non-writable, so it cannot be
// deleted or replaced. The `HAS_BUN_GLOBAL` constant in runtimeBun.ts is therefore always true here,
// and the branches that read it directly (the fallback arms of getBunVersion(), getBunRevision(),
// getBun(), nanoseconds(), sleep(), which(), gc(), setGcLevel() and memoryFootprint()) cannot be reached from bun:test.
// The branches that go through isBun() are reachable: spying on the exported isBun also intercepts
// the module's own calls to it, which is how bunAvailable() and getGlobalBunModules() are covered.
// The module is imported statically: re-importing it with a cache-busting query string yields a module
// instance that bun's coverage does not attribute back to src/runtimeBun.ts.

const originalBunInstall = process.env.BUN_INSTALL;
const originalHome = process.env.HOME;
const originalPath = process.env.PATH;

// A HOME that really does contain <home>/.bun/bin/bun, so the check does not depend on the machine.
const fakeHome = path.join(os.tmpdir(), 'matterbridge-runtimeBun-test-home');

beforeAll(() => {
  mkdirSync(path.join(fakeHome, '.bun', 'bin'), { recursive: true });
  writeFileSync(path.join(fakeHome, '.bun', 'bin', 'bun'), '');
});

afterAll(() => {
  rmSync(fakeHome, { recursive: true, force: true });
});

afterEach(() => {
  for (const spy of testSpies.splice(0)) spy.mockRestore();
  if (originalBunInstall === undefined) delete process.env.BUN_INSTALL;
  else process.env.BUN_INSTALL = originalBunInstall;
  process.env.HOME = originalHome;
  process.env.PATH = originalPath;
});

describe('isBun()', () => {
  it('should return true when running in the Bun runtime', () => {
    expect(isBun()).toBe(true);
  });
});

describe('bunAvailable()', () => {
  it('should return true when running in the Bun runtime', () => {
    expect(bunAvailable()).toBe(true);
  });

  it('should return true when the Bun executable exists under HOME', () => {
    track(spyOn(runtimeBun, 'isBun').mockReturnValue(false));
    process.env.HOME = fakeHome;

    expect(bunAvailable()).toBe(true);
  });

  it('should return true when Bun is only on PATH', () => {
    track(spyOn(runtimeBun, 'isBun').mockReturnValue(false));
    process.env.HOME = path.join(os.tmpdir(), 'matterbridge-runtimeBun-test-missing');

    expect(bunAvailable()).toBe(true);
  });

  it('should return false when Bun is neither under HOME nor on PATH', () => {
    track(spyOn(runtimeBun, 'isBun').mockReturnValue(false));
    process.env.HOME = path.join(os.tmpdir(), 'matterbridge-runtimeBun-test-missing');
    process.env.PATH = '';

    expect(bunAvailable()).toBe(false);
  });
});

describe('getBunVersion()', () => {
  it('should return the running Bun version', () => {
    expect(getBunVersion()).toBe(Bun.version);
    expect(getBunVersion()).toBe(process.versions.bun);
  });
});

describe('getBunRevision()', () => {
  it('should return the revision Bun was built from', () => {
    expect(getBunRevision()).toBe(Bun.revision);
  });
});

describe('getNodeCompatVersion()', () => {
  it('should return the emulated Node.js version', () => {
    expect(getNodeCompatVersion()).toBe(process.versions.node);
  });
});

describe('getBun()', () => {
  it('should return the Bun namespace when running in the Bun runtime', () => {
    expect(getBun()).toBe(Bun);
  });
});

describe('getBunLatestVersion()', () => {
  it('should return the stable version when GitHub returns a valid release', async () => {
    const fetchMock = track(spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ tag_name: 'bun-v1.4.0' })));

    expect(getBunLatestVersion()).resolves.toBe('1.4.0');
    expect(fetchMock).toHaveBeenCalledWith('https://api.github.com/repos/oven-sh/bun/releases/latest', {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'matterbridge' },
      signal: expect.any(AbortSignal),
    });
  });

  it('should return undefined when GitHub returns an HTTP error', async () => {
    track(spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 403 })));

    expect(getBunLatestVersion()).resolves.toBeUndefined();
  });

  it.each([null, {}, { tag_name: 123 }, { tag_name: 'canary' }, { tag_name: 'bun-v1.4.0-canary' }, { tag_name: '1.4.0' }])(
    'should return undefined when the release payload is invalid: %j',
    async (release) => {
      track(spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(release)));

      expect(getBunLatestVersion()).resolves.toBeUndefined();
    },
  );

  it('should return undefined when the response is not valid JSON', async () => {
    track(spyOn(globalThis, 'fetch').mockResolvedValue(new Response('invalid json')));

    expect(getBunLatestVersion()).resolves.toBeUndefined();
  });

  it.each([new Error('Network unavailable'), new DOMException('Request timed out', 'TimeoutError')])('should return undefined when the request fails: %s', async (error) => {
    track(spyOn(globalThis, 'fetch').mockRejectedValue(error));

    expect(getBunLatestVersion()).resolves.toBeUndefined();
  });
});

describe('getGlobalBunModules()', () => {
  it('should derive the path from BUN_INSTALL when it is set', () => {
    process.env.BUN_INSTALL = path.join('/opt', 'bun');

    expect(getGlobalBunModules()).toBe(path.join('/opt', 'bun', 'install', 'global', 'node_modules'));
  });

  it('should throw when not running in the Bun runtime', () => {
    track(spyOn(runtimeBun, 'isBun').mockReturnValue(false));

    expect(() => getGlobalBunModules()).toThrow('getGlobalBunModules can only be called in a Bun environment.');
  });

  it('should fall back to the home directory when BUN_INSTALL is unset', () => {
    delete process.env.BUN_INSTALL;
    track(spyOn(os, 'homedir').mockReturnValue('/home/tester'));

    expect(getGlobalBunModules()).toBe(path.join('/home/tester', '.bun', 'install', 'global', 'node_modules'));
  });
});

describe('nanoseconds()', () => {
  it('should return the monotonic time reported by Bun', () => {
    const nanosecondsMock = track(spyOn(Bun, 'nanoseconds').mockReturnValue(42));

    expect(nanoseconds()).toBe(42);
    expect(nanosecondsMock).toHaveBeenCalledTimes(1);
  });
});

describe('sleep()', () => {
  it('should delegate to the Bun sleep implementation', async () => {
    const sleepMock = track(spyOn(Bun, 'sleep').mockImplementation(async () => {}));

    expect(sleep(10)).resolves.toBeUndefined();
    expect(sleepMock).toHaveBeenCalledWith(10);
  });
});

describe('which()', () => {
  it('should return the path when Bun locates the command', () => {
    const whichMock = track(spyOn(Bun, 'which').mockReturnValue(path.join('bin', 'bun')));

    expect(which('bun')).toBe(path.join('bin', 'bun'));
    expect(whichMock).toHaveBeenCalledWith('bun');
  });

  it('should return null when Bun cannot locate the command', () => {
    track(spyOn(Bun, 'which').mockReturnValue(null));

    expect(which('not-a-real-command')).toBeNull();
  });
});

describe('gc()', () => {
  it('should request a synchronous collection when force defaults to true', () => {
    const gcMock = track(spyOn(Bun, 'gc').mockImplementation(() => {}));

    expect(gc()).toBeUndefined();
    expect(gcMock).toHaveBeenCalledWith(true);
  });

  it('should forward an explicit force flag', () => {
    const gcMock = track(spyOn(Bun, 'gc').mockImplementation(() => {}));

    expect(gc(false)).toBeUndefined();
    expect(gcMock).toHaveBeenCalledWith(false);
  });
});

describe('memoryFootprint()', () => {
  it('should return the footprint reported by Bun', () => {
    const footprintMock = track(spyOn(Bun.unsafe, 'memoryFootprint').mockReturnValue(123));
    track(spyOn(process, 'memoryUsage').mockReturnValue({ rss: 456, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 4 }));

    expect(memoryFootprint()).toBe(123);
    expect(footprintMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'undefined footprint', footprint: undefined },
    { name: 'zero footprint', footprint: 0 },
    { name: 'negative footprint', footprint: -1 },
    { name: 'non-finite footprint', footprint: Number.NaN },
  ])('should fall back to RSS with $name', ({ footprint }) => {
    track(spyOn(Bun.unsafe, 'memoryFootprint').mockReturnValue(footprint as unknown as number));
    track(spyOn(process, 'memoryUsage').mockReturnValue({ rss: 456, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 4 }));

    expect(memoryFootprint()).toBe(456);
  });

  it('should fall back to RSS when the footprint API throws', () => {
    track(
      spyOn(Bun.unsafe, 'memoryFootprint').mockImplementation(() => {
        throw new Error('Unavailable');
      }),
    );
    track(spyOn(process, 'memoryUsage').mockReturnValue({ rss: 456, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 4 }));

    expect(memoryFootprint()).toBe(456);
  });
});

describe('setGcLevel()', () => {
  it('should return the previous level reported by Bun', () => {
    const gcLevelMock = track(spyOn(Bun.unsafe, 'gcAggressionLevel').mockReturnValue(1));

    expect(setGcLevel(2)).toBe(1);
    expect(gcLevelMock).toHaveBeenCalledWith(2);
  });

  it('should query the current level when no level is given', () => {
    const gcLevelMock = track(spyOn(Bun.unsafe, 'gcAggressionLevel').mockReturnValue(0));

    expect(setGcLevel()).toBe(0);
    expect(gcLevelMock).toHaveBeenCalledTimes(1);
  });
});

describe('getBunRuntimeInfo()', () => {
  it('should collect a snapshot of the Bun runtime', () => {
    expect(getBunRuntimeInfo()).toEqual({
      isBun: true,
      version: Bun.version,
      revision: Bun.revision,
      nodeCompat: process.versions.node,
      execPath: process.execPath,
      main: Bun.main,
      arch: process.arch,
      platform: process.platform,
    });
  });
});
