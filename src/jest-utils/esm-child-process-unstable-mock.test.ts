// test\esm-child-process-unstable-mock.test.ts

// ESM unstable mock of 'node:child_process'

jest.unstable_mockModule('node:child_process', () => {
  const originalModule = jest.requireActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...originalModule,

    exec: jest.fn((command: string, options?: import('node:child_process').ExecOptions) => {
      return (originalModule.exec as typeof originalModule.exec)(command, options);
    }),
    execSync: jest.fn((command: string, options?: import('node:child_process').ExecSyncOptions) => {
      return (originalModule.execSync as typeof originalModule.execSync)(command, options);
    }),
    spawn: jest.fn((command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>) => {
      return (originalModule.spawn as typeof originalModule.spawn)(command, args, options);
    }),
    spawnSync: jest.fn((command: string, args?: readonly string[], options?: SpawnSyncOptions) => {
      return (originalModule.spawnSync as typeof originalModule.spawnSync)(command, args, options);
    }),
  };
});
const { exec, execSync, spawn, spawnSync } = await import('node:child_process');

import type { SpawnOptionsWithStdioTuple, SpawnSyncOptions, StdioNull, StdioPipe } from 'node:child_process';

import { jest } from '@jest/globals';

describe('ESM module node:child_process unstable mock module test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call the original child_process.exec method', async () => {
    const execResult = exec('echo Hello!');
    expect(exec).toHaveBeenCalledTimes(1);
    expect(execResult).toBeDefined();
  });

  it('should mock child_process.exec method', async () => {
    // Now we mock the child_process.exec method
    (exec as jest.Mocked<any>).mockImplementation((command: string, options?: import('node:child_process').ExecOptions) => {
      return {} as ReturnType<typeof exec>;
    });

    const execResult = exec('echo Hello!');
    expect(exec).toHaveBeenCalledTimes(1);
    expect(execResult).toBeDefined();
  });

  it('should call the original child_process.execSync method', async () => {
    const execSyncResult = execSync('echo Hello!');
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(execSyncResult).toBeDefined();
  });

  it('should mock child_process.execSync method', async () => {
    // Now we mock the child_process.execSync method
    (execSync as jest.Mocked<any>).mockImplementation((command: string, options?: import('node:child_process').ExecSyncOptions) => {
      return {} as ReturnType<typeof execSync>;
    });

    const execSyncResult = execSync('echo Hello!');
    expect(execSync).toHaveBeenCalledTimes(1);
    expect(execSyncResult).toBeDefined();
  });

  it('should call the original child_process.spawn method', async () => {
    const spawnResult = process.platform === 'win32' ? spawn('cmd.exe', ['/c', 'echo', 'Hello!'], { stdio: 'inherit' }) : spawn('echo', ['Hello!'], { stdio: 'inherit' });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawnResult).toBeDefined();
  });

  it('should mock child_process.spawn method', async () => {
    // Now we mock the child_process.spawn method
    (spawn as jest.Mocked<any>).mockImplementation((command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>) => {
      return {} as ReturnType<typeof spawn>;
    });

    const spawnResult = process.platform === 'win32' ? spawn('cmd.exe', ['/c', 'echo', 'Hello!'], { stdio: 'inherit' }) : spawn('echo', ['Hello!'], { stdio: 'inherit' });
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawnResult).toBeDefined();
  });

  it('should call the original child_process.spawnSync method', async () => {
    const spawnSyncResult = spawnSync('echo', ['Hello!'], { stdio: 'inherit' });
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSyncResult).toBeDefined();
  });

  it('should mock child_process.spawnSync method', async () => {
    // Now we mock the child_process.spawnSync method
    (spawnSync as jest.Mocked<any>).mockImplementation((command: string, args?: readonly string[], options?: SpawnSyncOptions) => {
      return {} as ReturnType<typeof spawnSync>;
    });

    const spawnSyncResult = spawnSync('echo', ['Hello!'], { stdio: 'inherit' });
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSyncResult).toBeDefined();
  });
});
