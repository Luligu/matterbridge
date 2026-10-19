/**
 * @file packages/thread/buntest/spawnCommand.test.ts
 * @description This file contains the tests for spawnCommand.
 * @author Luca Liguori
 */

import { afterAll, beforeEach, describe, expect, it, spyOn, vi } from 'bun:test';
// The namespace is what spyOn() needs to patch the spawn export that spawnCommand() imports dynamically.
// oxlint-disable-next-line import/no-namespace
import * as childProcess from 'node:child_process';

import { loggerDebugSpy, loggerErrorSpy, originalProcessArgv, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
// The namespace is what spyOn() needs to replace isBun, which spawnCommand() imports statically: bun updates the live binding.
// oxlint-disable-next-line import/no-namespace
import * as runtimeBun from '@matterbridge/utils/bun';

import { BroadcastServer } from '../src/broadcastServer.js';
import { spawnCommand } from '../src/spawnCommand.js';

// Spy on spawn and pass the calls through to the real implementation, so each test can override it with mockImplementationOnce.
const originalSpawn = childProcess.spawn;
const spawn = spyOn(childProcess, 'spawn').mockImplementation(((...args: Parameters<typeof originalSpawn>) => originalSpawn(...args)) as typeof originalSpawn);

// Run as on Node.js, like the vitest suite: hide the bun version so isBun() is false unless a test sets process.versions.bun.
const bunVersions = process.versions;
const { bun: _bun, ...nodeVersions } = bunVersions;
Object.defineProperty(process, 'versions', { configurable: true, value: nodeVersions });
spyOn(runtimeBun, 'isBun').mockImplementation(() => typeof process.versions.bun === 'string');

// Setup the test environment
await setupTest('SpawnCommand', false);

describe('Spawn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
    resetTest();
    Object.defineProperty(process, 'versions', { configurable: true, value: bunVersions });
  });

  it('should spawn a command successfully -nosudo', async () => {
    process.argv = [...originalProcessArgv.slice(0, 2), '--verbose', '--nosudo'];
    const command = 'npm';
    const args = ['list', '--depth=0'];

    const result = await spawnCommand(command, args, 'install', 'test-package');

    expect(spawn).toHaveBeenCalled();
    expect(result).toBe(true);
    if (process.platform === 'win32') {
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn command cmd.exe with`));
    } else {
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn command ${command} with`));
    }
  }, 30000);

  it('should mock a spawn command with sudo', async () => {
    process.argv = [...originalProcessArgv.slice(0, 2), '--verbose', '--sudo'];
    const command = 'npm';
    const args = ['list', '--depth=0'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'disconnect' && callback) {
            callback(null, null);
          }
        }),
      } as any;
    });
    const result = await spawnCommand(command, args, 'uninstall', 'test-package');

    expect(result).toBe(true);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Spawn command sudo with`));
  });

  it('should mock a spawn command and throw an error', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: (err: Error) => void) => {
          if (event === 'error' && callback) {
            callback(new Error('Spawn error'));
          }
        }),
      } as any;
    });
    // expect(spawnCommand(matterbridge, command, args)).rejects.toThrow('Spawn error');
    expect(await spawnCommand(command, args)).toBe(false);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to start child process`));
  }, 10000);

  it('should log a debug message when the frontend log message cannot be sent', async () => {
    const requestSpy = spyOn(BroadcastServer.prototype, 'request').mockImplementationOnce(() => {
      throw new Error('Request failed');
    });
    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'disconnect' && callback) {
            callback(null, null);
          }
        }),
      } as any;
    });

    try {
      expect(await spawnCommand('npm', ['list', '--depth=0'], 'install', 'test-package')).toBe(true);
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to send log message to frontend: Request failed'));
    } finally {
      requestSpy.mockRestore();
    }
  }, 10000);

  it('should mock a spawn command and throw an error on close', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'close' && callback) {
            callback(1, null);
          }
        }),
      } as any;
    });
    // expect(spawnCommand(matterbridge, command, args)).rejects.toThrow();
    expect(await spawnCommand(command, args)).toBe(false);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`closed with code 1 and signal null`));
  });

  it('should mock a spawn command and throw an error on exit', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: (code: number | null, signal: NodeJS.Signals | null) => void) => {
          if (event === 'exit' && callback) {
            callback(1, null);
          }
        }),
      } as any;
    });
    // expect(spawnCommand(matterbridge, command, args)).rejects.toThrow();
    expect(await spawnCommand(command, args)).toBe(false);

    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`exited with code 1 and signal null`));
  });

  it('should mock a spawn command and send data on stdout and stderr', async () => {
    const command = 'npm';
    const args = ['list', '--depth=0'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 0);
          }
        }),

        stdout: {
          on: vi.fn<(...args: any[]) => any>((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data' && callback) {
              callback(Buffer.from('Hello from stdout'));
            }
          }),
        },
        stderr: {
          on: vi.fn<(...args: any[]) => any>((event: string, callback: (data: Buffer) => void) => {
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

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 0);
          }
        }),

        stdout: {
          on: vi.fn<(...args: any[]) => any>((event: string, callback: (data: Buffer) => void) => {
            if (event === 'data' && callback) {
              callback(Buffer.from('Hello from stdout'));
            }
          }),
        },
        stderr: {
          on: vi.fn<(...args: any[]) => any>((event: string, callback: (data: Buffer) => void) => {
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

  it('should use Bun in the Windows command wrapper when running on Bun', async () => {
    const originalPlatform = process.platform;
    const originalVersions = process.versions;
    const savedArgv = process.argv;
    Object.defineProperty(process, 'platform', { configurable: true, value: 'win32', writable: true });
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });
    process.argv = originalProcessArgv.slice(0, 2);

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect') callback();
        }),
      } as any;
    });

    try {
      expect(spawnCommand('npm', ['install', '-g', 'test-package'])).resolves.toBe(true);
      expect(spawn).toHaveBeenCalledWith('cmd.exe', ['/c', 'bun install -g test-package'], expect.anything());
    } finally {
      process.argv = savedArgv;
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform, writable: true });
      Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    }
  });

  it('should spawn Bun instead of npm when running on Bun without sudo', async () => {
    const originalPlatform = process.platform;
    const originalVersions = process.versions;
    const savedArgv = process.argv;
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux', writable: true });
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });
    process.argv = [...originalProcessArgv.slice(0, 2), '--nosudo'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect') callback();
        }),
      } as any;
    });

    try {
      expect(spawnCommand('npm', ['install', '-g', 'test-package'])).resolves.toBe(true);
      expect(spawn).toHaveBeenCalledWith('bun', ['install', '-g', 'test-package'], expect.anything());
    } finally {
      process.argv = savedArgv;
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform, writable: true });
      Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    }
  });

  it('should spawn Bun directly when running on Bun without nosudo', async () => {
    const originalPath = process.env.PATH;
    const originalPlatform = process.platform;
    const originalVersions = process.versions;
    const savedArgv = process.argv;
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux', writable: true });
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });
    process.env.PATH = '/usr/local/bin';
    process.argv = originalProcessArgv.slice(0, 2);

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect') callback();
        }),
      } as any;
    });

    try {
      expect(spawnCommand('npm', ['install', '-g', 'test-package'])).resolves.toBe(true);
      expect(spawn).toHaveBeenCalledWith('bun', ['install', '-g', 'test-package'], expect.anything());
    } finally {
      process.argv = savedArgv;
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform, writable: true });
      Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    }
  });

  it('should use sudo with Bun when sudo is forced', async () => {
    const originalPlatform = process.platform;
    const originalVersions = process.versions;
    const savedArgv = process.argv;
    Object.defineProperty(process, 'platform', { configurable: true, value: 'linux', writable: true });
    Object.defineProperty(process, 'versions', { configurable: true, value: { ...originalVersions, bun: '1.2.3' } });
    process.argv = [...originalProcessArgv.slice(0, 2), '--sudo'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect') callback();
        }),
      } as any;
    });

    try {
      expect(spawnCommand('npm', ['install', '-g', 'test-package'])).resolves.toBe(true);
      expect(spawn).toHaveBeenCalledWith('sudo', ['bun', 'install', '-g', 'test-package'], expect.anything());
    } finally {
      process.argv = savedArgv;
      Object.defineProperty(process, 'platform', { configurable: true, value: originalPlatform, writable: true });
      Object.defineProperty(process, 'versions', { configurable: true, value: originalVersions });
    }
  });

  it('should use sudo on non-win32 platform for npm command without docker or nosudo flags', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      writable: true,
    });
    process.argv = originalProcessArgv.slice(0, 2);
    const command = 'npm';
    const args = ['install', '-g', 'test-package'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 0);
          }
        }),
      } as any;
    });

    const result = await spawnCommand(command, args);

    expect(result).toBe(true);
    if (process.env.PATH?.includes('/.nvm/versions/node/')) {
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Spawn command npm with install -g test-package'));
    } else {
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Spawn command sudo with npm install -g test-package'));
    }

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
    process.argv = [...originalProcessArgv.slice(0, 2), '-docker'];
    const command = 'npm';
    const args = ['install', '-g', 'test-package'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 0);
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
    process.argv = originalProcessArgv.slice(0, 2);
    const command = 'ls';
    const args = ['-la'];

    spawn.mockImplementationOnce(() => {
      return {
        on: vi.fn<(...args: any[]) => any>((event: string, callback: () => void) => {
          if (event === 'disconnect' && callback) {
            setTimeout(() => {
              callback();
            }, 0);
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
