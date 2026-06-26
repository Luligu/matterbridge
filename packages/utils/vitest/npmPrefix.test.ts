// vitest\npmPrefix.test.ts

import type { ChildProcess, ExecException } from 'node:child_process';

import type { Mock } from 'vitest';

type ExecFn = (command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void) => ChildProcess;

// ESM mock for child_process exec
let mockedExec: Mock<ExecFn>;
vi.doMock('node:child_process', () => {
  mockedExec = vi.fn<ExecFn>((command, callback) => {
    if (command === 'npm root -g' && callback) {
      callback(null, '/usr/lib/node_modules\n', '');
    }
    return {} as ChildProcess;
  });

  return { exec: mockedExec };
});

import { setupTest } from './vitestSetupTest.js';

const { getGlobalNodeModules } = await import('../src/npmPrefix.js');

await setupTest('NpmRoot');

describe('getGlobalNodeModules()', () => {
  it('resolves with trimmed global modules path', async () => {
    await expect(getGlobalNodeModules()).resolves.toBe('/usr/lib/node_modules');
  });

  it('rejects on exec error', async () => {
    mockedExec.mockImplementationOnce((command, callback) => {
      if (command === 'npm root -g' && callback) {
        callback(Object.assign(new Error('fail'), { cmd: command }), '', '');
      }
      return {} as ChildProcess;
    });
    await expect(getGlobalNodeModules()).rejects.toThrow('fail');
  });

  it('returns the global Bun modules path when running on Bun', async () => {
    const originalVersions = process.versions;
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });
    mockedExec.mockClear();
    try {
      const { getGlobalBunModules } = await import('../src/bunPrefix.js');
      await expect(getGlobalNodeModules()).resolves.toBe(getGlobalBunModules());
      expect(mockedExec).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    }
  });
});
