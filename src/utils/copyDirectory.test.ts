// src\utils\copyDirectory.test.ts

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';

// Prepare fake implementations
const fakeMkdir: jest.MockedFunction<(path: string, options: { recursive: boolean }) => Promise<void>> = jest.fn();
const fakeReaddir: jest.MockedFunction<(path: string, options: { withFileTypes: true }) => Promise<{ name: string; isFile(): boolean; isDirectory(): boolean }[]>> = jest.fn();
const fakeCopyFile: jest.MockedFunction<(src: string, dest: string) => Promise<void>> = jest.fn();

// ESM module mocks
jest.unstable_mockModule('node:fs', async () => ({
  __esModule: true,
  promises: {
    mkdir: fakeMkdir,
    readdir: fakeReaddir,
    copyFile: fakeCopyFile,
  },
}));

jest.unstable_mockModule('node:path', () =>
  Promise.resolve({
    __esModule: true,
    default: {
      join: (...parts: string[]) => parts.join('/'),
    },
    join: (...parts: string[]) => parts.join('/'),
  }),
);

// Import the function under test after mocking
const { copyDirectory } = await import('./copyDirectory.js');

// Helper Dirent-like objects
const makeDirent = (name: string, isFile: boolean, isDirectory: boolean) => ({
  name,
  isFile: () => isFile,
  isDirectory: () => isDirectory,
});

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

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

describe('copyDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('throw error if the directories are undefined', async () => {
    await expect(copyDirectory('', 'dest')).rejects.toThrow('Source directory must be specified.');
    await expect(copyDirectory('src', '')).rejects.toThrow('Destination directory must be specified.');
    await expect(copyDirectory('same', 'same')).rejects.toThrow('Source and destination directories must be different.');
    await expect(copyDirectory('src', undefined as any)).rejects.toThrow('Destination directory must be specified.');
    await expect(copyDirectory(undefined as any, 'dst')).rejects.toThrow('Source directory must be specified.');
  });

  test('throw error if the directories are the same', async () => {
    await expect(copyDirectory('src', 'src')).rejects.toThrow('Source and destination directories must be different.');
  });

  test('successfully copies flat directory', async () => {
    // Setup: one file
    fakeMkdir.mockResolvedValue(undefined);
    fakeReaddir.mockResolvedValue([makeDirent('a.txt', true, false)]);
    fakeCopyFile.mockResolvedValue(undefined);

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(true);
    expect(fakeMkdir).toHaveBeenCalledWith('dest', { recursive: true });
    expect(fakeReaddir).toHaveBeenCalledWith('src', { withFileTypes: true });
    expect(fakeCopyFile).toHaveBeenCalledWith('src/a.txt', 'dest/a.txt');
  });

  test('recursively copies nested directories', async () => {
    // Outer dir contains a subdir and a file
    fakeMkdir.mockResolvedValue(undefined);
    fakeReaddir
      .mockResolvedValueOnce([makeDirent('sub', false, true), makeDirent('f.txt', true, false)])
      // For recursive call on subdir
      .mockResolvedValueOnce([makeDirent('inner.txt', true, false)]);
    fakeCopyFile.mockResolvedValue(undefined);

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(true);
    // mkdir called for both dest and dest/sub
    expect(fakeMkdir).toHaveBeenCalledWith('dest', { recursive: true });
    expect(fakeMkdir).toHaveBeenCalledWith('dest/sub', { recursive: true });
    // readdir called for both
    expect(fakeReaddir).toHaveBeenCalledWith('src', { withFileTypes: true });
    expect(fakeReaddir).toHaveBeenCalledWith('src/sub', { withFileTypes: true });
    // copyFile called for files
    expect(fakeCopyFile).toHaveBeenCalledWith('src/f.txt', 'dest/f.txt');
    expect(fakeCopyFile).toHaveBeenCalledWith('src/sub/inner.txt', 'dest/sub/inner.txt');
  });

  test('returns false on mkdir error', async () => {
    fakeMkdir.mockRejectedValue(new Error('fail-mkdir'));

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(false);
    // should attempt mkdir once and then exit
    expect(fakeMkdir).toHaveBeenCalledWith('dest', { recursive: true });
    expect(fakeReaddir).not.toHaveBeenCalled();
  });

  test('returns false if readdir throws', async () => {
    fakeMkdir.mockResolvedValue(undefined);
    fakeReaddir.mockRejectedValue(new Error('fail-read'));

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(false);
    expect(fakeMkdir).toHaveBeenCalledWith('dest', { recursive: true });
    expect(fakeReaddir).toHaveBeenCalledWith('src', { withFileTypes: true });
  });

  test('ignores non-file, non-directory entries', async () => {
    fakeMkdir.mockResolvedValue(undefined);
    fakeReaddir.mockResolvedValue([{ name: 'weird', isFile: () => false, isDirectory: () => false }]);

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(true);
    // mkdir and readdir called, but copyFile not called
    expect(fakeCopyFile).not.toHaveBeenCalled();
  });

  test('logs error and returns false on copyFile error', async () => {
    fakeMkdir.mockResolvedValueOnce();
    fakeReaddir.mockResolvedValueOnce([makeDirent('a.txt', true, false)]);
    fakeCopyFile.mockRejectedValueOnce(new Error('fail-copy'));

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(false);
  });

  test('logs error and returns false on copyFile error not Error', async () => {
    fakeMkdir.mockResolvedValueOnce();
    fakeReaddir.mockResolvedValueOnce([makeDirent('a.txt', true, false)]);
    // Reject with a non-Error value, e.g. a string
    fakeCopyFile.mockRejectedValueOnce('string-error');

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(false);
  });
});
