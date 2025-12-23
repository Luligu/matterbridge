// src\utils\spawn.test.ts
/* eslint-disable jest/no-conditional-expect */

process.argv = [...originalProcessArgv, '--verbose'];

// Mock the spawn function from the child_process module. We use jest.unstable_mockModule to ensure that the mock is applied correctly and can be used in the tests.
jest.unstable_mockModule('node:child_process', async () => {
  const originalModule = jest.requireActual<typeof import('node:child_process')>('node:child_process');

  return {
    ...originalModule,
    spawn: jest.fn((command: string, args: string[], options: SpawnOptionsWithStdioTuple<StdioNull, StdioPipe, StdioPipe>) => {
      // console.error('spawn called with command:', command);
      return (originalModule.spawn as typeof originalModule.spawn)(command, args, options);
    }),
  };
});

const { spawn } = await import('node:child_process');
import { SpawnOptionsWithStdioTuple, StdioNull, StdioPipe } from 'node:child_process';

import { jest } from '@jest/globals';

import { flushAsync, loggerDebugSpy, loggerErrorSpy, originalProcessArgv, setDebug, setupTest } from '../jestutils/jestHelpers.js';

import { spawnCommand } from './spawn.js';

await setupTest('SpawnCommand', false);

describe('Spawn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  it('should spawn a command successfully -nosudo', async () => {
    process.argv = ['node', 'spawn.test.js', '--verbose', '-nosudo'];
    const command = 'npm';
    const args = ['list', '--depth=0'];

    const result = await spawnCommand(command, args);

    expect(spawn).toHaveBeenCalled();
    expect(result).toBe(true);
    if (process.platform === 'win32') {
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn command cmd.exe with`));
    } else {
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn command ${command} with`));
    }
  });

  it('should mock a spawn command with sudo', async () => {
    process.argv = ['node', 'spawn.test.js', '--verbose', '-sudo'];
    const command = 'npm';
    const args = ['list', '--depth=0'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'disconnect' && callback) {
            callback(null, null);
          }
        }),
      } as any;
    });
    const result = await spawnCommand(command, args);

    expect(result).toBe(true);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn command sudo with`));
  });

  it('should mock a spawn command and throw an error', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: (err: Error) => void) => {
          if (event === 'error' && callback) {
            callback(new Error('Spawn error'));
          }
        }),
      } as any;
    });
    // await expect(spawnCommand(matterbridge, command, args)).rejects.toThrow('Spawn error');
    expect(await spawnCommand(command, args)).toBe(false);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to start child process`));
  });

  it('should mock a spawn command and throw an error on close', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'close' && callback) {
            callback(1, null);
          }
        }),
      } as any;
    });
    // await expect(spawnCommand(matterbridge, command, args)).rejects.toThrow();
    expect(await spawnCommand(command, args)).toBe(false);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`closed with code 1 and signal null`));
  });

  it('should mock a spawn command and throw an error on exit', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'exit' && callback) {
            callback(1, null);
          }
        }),
      } as any;
    });
    // await expect(spawnCommand(matterbridge, command, args)).rejects.toThrow();
    expect(await spawnCommand(command, args)).toBe(false);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`exited with code 1 and signal null`));
  });

  it('should mock a spawn command and send data on stdout and stderr', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 500);
          }
        }),

        stdout: {
          on: jest.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data' && callback) {
              callback(Buffer.from('Hello from stdout'));
            }
          }),
        },
        stderr: {
          on: jest.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data' && callback) {
              callback(Buffer.from('Hello from stderr'));
            }
          }),
        },
      } as any;
    });
    await spawnCommand(command, args);

    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn output (stdout): Hello from stdout`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn verbose (stderr): Hello from stderr`));
  });

  it('should mock a spawn command on windows and send data on stdout and stderr', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      writable: true,
    });
    const command = 'npm';
    const args = ['list', '--depth=0'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 500);
          }
        }),

        stdout: {
          on: jest.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data' && callback) {
              callback(Buffer.from('Hello from stdout'));
            }
          }),
        },
        stderr: {
          on: jest.fn((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data' && callback) {
              callback(Buffer.from('Hello from stderr'));
            }
          }),
        },
      } as any;
    });
    await spawnCommand(command, args);

    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn output (stdout): Hello from stdout`));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn verbose (stderr): Hello from stderr`));

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should use sudo on non-win32 platform for npm command without docker or nosudo flags', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });
    process.argv = ['node', 'spawn.test.js'];
    const command = 'npm';
    const args = ['install', '-g', 'test-package'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 100);
          }
        }),
      } as any;
    });

    const result = await spawnCommand(command, args);

    expect(result).toBe(true);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Spawn command sudo with npm install -g test-package'));

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should not use sudo on non-win32 platform when docker flag is present', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });
    process.argv = ['node', 'spawn.test.js', '-docker'];
    const command = 'npm';
    const args = ['install', '-g', 'test-package'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 100);
          }
        }),
      } as any;
    });

    const result = await spawnCommand(command, args);

    expect(result).toBe(true);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Spawn command npm with install -g test-package'));

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });

  it('should not use sudo on non-win32 platform for non-npm commands', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
    });
    process.argv = ['node', 'spawn.test.js'];
    const command = 'ls';
    const args = ['-la'];

    (spawn as jest.MockedFunction<typeof spawn>).mockImplementationOnce(() => {
      return {
        on: jest.fn((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 100);
          }
        }),
      } as any;
    });

    const result = await spawnCommand(command, args);

    expect(result).toBe(true);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Spawn command ls with -la'));

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });
});
