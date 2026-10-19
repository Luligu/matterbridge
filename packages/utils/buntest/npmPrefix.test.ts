/**
 * @file packages/utils/buntest/npmPrefix.test.ts
 * @description This file contains the tests for npmPrefix.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, type Mock, spyOn, vi } from 'bun:test';
import type { ChildProcess, ExecException } from 'node:child_process';
// Namespace import: spyOn() on it also intercepts the source's `await import(...)` of the same module.
// oxlint-disable-next-line import/no-namespace
import * as childProcess from 'node:child_process';

type ExecFn = (command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void) => ChildProcess;

// ESM mock for child_process exec
const mockedExec: Mock<ExecFn> = vi.fn<ExecFn>((command, callback) => {
  if (command === 'npm root -g' && callback) {
    callback(null, '/usr/lib/node_modules\n', '');
  }
  return {} as ChildProcess;
});

// Bun has no vi.doMock(): route node:child_process exec() through the fake instead.
spyOn(childProcess, 'exec').mockImplementation(mockedExec as unknown as typeof childProcess.exec);

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';

// oxlint-disable-next-line import/no-namespace
import * as runtimeBun from '../src/runtimeBun.js';

const { getGlobalNodeModules } = await import('../src/npmPrefix.js');

// Mocks AnsiLogger.prototype.log and the console methods, and sets process.argv to ['bun', NAME].
await setupTest('NpmRootTest');

describe('getGlobalNodeModules()', () => {
  // Under bun:test isBun() is always true, so spy on it to reach the Node.js exec path.
  let isBunSpy: Mock<typeof runtimeBun.isBun>;

  beforeEach(() => {
    isBunSpy = spyOn(runtimeBun, 'isBun').mockReturnValue(false);
  });

  afterEach(() => {
    isBunSpy.mockRestore();
  });

  it('resolves with trimmed global modules path', async () => {
    expect(getGlobalNodeModules()).resolves.toBe('/usr/lib/node_modules');
  });

  it('rejects on exec error', async () => {
    mockedExec.mockImplementationOnce((command, callback) => {
      if (command === 'npm root -g' && callback) {
        callback(Object.assign(new Error('fail'), { cmd: command }), '', '');
      }
      return {} as ChildProcess;
    });
    expect(getGlobalNodeModules()).rejects.toThrow('fail');
  });

  it('returns the global Bun modules path when running on Bun', async () => {
    isBunSpy.mockReturnValue(true);
    mockedExec.mockClear();
    expect(getGlobalNodeModules()).resolves.toBe(runtimeBun.getGlobalBunModules());
    expect(mockedExec).not.toHaveBeenCalled();
  });
});

afterAll(() => {
  resetTest();
});
