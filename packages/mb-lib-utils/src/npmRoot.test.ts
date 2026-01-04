// src\utils\npmRoot.test.ts

// ESM mock for child_process exec
let mockedExec: jest.MockedFunction<typeof exec>;
jest.unstable_mockModule('node:child_process', () => {
  mockedExec = jest.fn((command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void) => {
    if (command === 'npm root -g' && callback) {
      callback(null, '/usr/lib/node_modules\n', '');
    }
    // Return a mock ChildProcess to match the expected return type
    return {} as ChildProcess;
  }) as unknown as jest.MockedFunction<typeof exec>;

  return { exec: mockedExec };
});

import { exec, ChildProcess, ExecException } from 'node:child_process';

import { jest } from '@jest/globals';
import { setupTest } from 'mb-lib-test';

import { getGlobalNodeModules } from './npmRoot.js';

await setupTest('NpmRoot');

describe('getGlobalNodeModules()', () => {
  it('resolves with trimmed global modules path', async () => {
    await expect(getGlobalNodeModules()).resolves.toBe('/usr/lib/node_modules');
  });

  it('rejects on exec error', async () => {
    // Change the implementation for the next call only
    (mockedExec as any).mockImplementationOnce((command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void) => {
      if (command === 'npm root -g' && callback) {
        callback(new Error('fail'), '', '');
      }
      // Return a mock ChildProcess to match the expected return type
      return {} as ChildProcess;
    });
    await expect(getGlobalNodeModules()).rejects.toThrow('fail');
  });
});
