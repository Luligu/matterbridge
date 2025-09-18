// src\utils\spawn.test.ts
/* eslint-disable jest/no-conditional-expect */

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
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { Matterbridge } from '../matterbridge.js';

import { spawnCommand } from './spawn.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = true; // Set to true to see console output during tests

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

describe('Spawn', () => {
  const matterbridge = {
    log: new AnsiLogger({ logName: 'SpawnCommand', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG }),
    frontend: {
      wssSendMessage: jest.fn(),
    },
  } as unknown as Matterbridge;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should spawn a command successfully -nosudo', async () => {
    process.argv = ['node', 'spawn.test.js', '-nosudo'];
    const command = 'npm';
    const args = ['list', '--depth=0'];

    const result = await spawnCommand(matterbridge, command, args);

    expect(spawn).toHaveBeenCalled();
    expect(result).toBe(true);
    if (process.platform === 'win32') {
      expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn command cmd.exe with`));
    } else {
      expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn command ${command} with`));
    }
  }, 10000);

  /*
  it('should mock a spawn command with sudo', async () => {
    process.argv = ['node', 'spawn.test.js', '-sudo'];
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
    const result = await spawnCommand(matterbridge, command, args);

    expect(result).toBe(true);
    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn command sudo with`));
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
    await expect(spawnCommand(matterbridge, command, args)).rejects.toThrow('Spawn error');

    expect(matterbridge.log.log).toHaveBeenCalledWith('error', expect.stringContaining(`Failed to start child process`));
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
    await expect(spawnCommand(matterbridge, command, args)).rejects.toThrow();

    expect(matterbridge.log.log).toHaveBeenCalledWith('error', expect.stringContaining(`closed with code 1 and signal null`));
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
    await expect(spawnCommand(matterbridge, command, args)).rejects.toThrow();

    expect(matterbridge.log.log).toHaveBeenCalledWith('error', expect.stringContaining(`exited with code 1 and signal null`));
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
    await spawnCommand(matterbridge, command, args);

    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn output (stdout): Hello from stdout`));
    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn verbose (stderr): Hello from stderr`));
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
    await spawnCommand(matterbridge, command, args);

    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn output (stdout): Hello from stdout`));
    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining(`Spawn verbose (stderr): Hello from stderr`));

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

    const result = await spawnCommand(matterbridge, command, args);

    expect(result).toBe(true);
    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining('Spawn command sudo with npm install -g test-package'));

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

    const result = await spawnCommand(matterbridge, command, args);

    expect(result).toBe(true);
    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining('Spawn command npm with install -g test-package'));

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

    const result = await spawnCommand(matterbridge, command, args);

    expect(result).toBe(true);
    expect(matterbridge.log.log).toHaveBeenCalledWith('debug', expect.stringContaining('Spawn command ls with -la'));

    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
    });
  });
  */
});
