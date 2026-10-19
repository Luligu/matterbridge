/**
 * @file packages/utils/buntest/copyDirectory.test.ts
 * @description This file contains the tests for copyDirectory.
 * @author Luca Liguori
 */

import { afterAll, beforeEach, describe, expect, spyOn, test, vi } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const NAME = 'CopyDirectoryTest';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';

// Prepare fake implementations
const fakeMkdir = vi.fn<(path: string, options: { recursive: boolean }) => Promise<void>>();
const fakeReaddir = vi.fn<(path: string, options: { withFileTypes: true }) => Promise<{ name: string; isFile(): boolean; isDirectory(): boolean }[]>>();
const fakeCopyFile = vi.fn<(src: string, dest: string) => Promise<void>>();

// Bun has no vi.doMock(): route the fs promises and path.join through the fakes instead.
// copyDirectory() reads fs.promises and the path default export on each call, so the spies intercept it.
spyOn(fs.promises, 'mkdir').mockImplementation(fakeMkdir as unknown as typeof fs.promises.mkdir);
spyOn(fs.promises, 'readdir').mockImplementation(fakeReaddir as unknown as typeof fs.promises.readdir);
spyOn(fs.promises, 'copyFile').mockImplementation(fakeCopyFile as unknown as typeof fs.promises.copyFile);
spyOn(path, 'join').mockImplementation((...parts: string[]) => parts.join('/'));

// Import the function under test after mocking
const { copyDirectory } = await import('../src/copyDirectory.js');

// Helper Dirent-like objects
const makeDirent = (name: string, isFile: boolean, isDirectory: boolean): { name: string; isFile(): boolean; isDirectory(): boolean } => ({
  name,
  isFile: (): boolean => isFile,
  isDirectory: (): boolean => isDirectory,
});

// Setup the test environment
await setupTest(NAME, false);

describe('copyDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('throw error if the directories are undefined', async () => {
    expect(copyDirectory('', 'dest')).rejects.toThrow('Source directory must be specified.');
    expect(copyDirectory('src', '')).rejects.toThrow('Destination directory must be specified.');
    expect(copyDirectory('same', 'same')).rejects.toThrow('Source and destination directories must be different.');
    expect(copyDirectory('src', undefined as any)).rejects.toThrow('Destination directory must be specified.');
    expect(copyDirectory(undefined as any, 'dst')).rejects.toThrow('Source directory must be specified.');
  });

  test('throw error if the directories are the same', async () => {
    expect(copyDirectory('src', 'src')).rejects.toThrow('Source and destination directories must be different.');
  });

  test('successfully copies flat directory', async () => {
    // Setup: one file
    fakeMkdir.mockResolvedValue();
    fakeReaddir.mockResolvedValue([makeDirent('a.txt', true, false)]);
    fakeCopyFile.mockResolvedValue();

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(true);
    expect(fakeMkdir).toHaveBeenCalledWith('dest', { recursive: true });
    expect(fakeReaddir).toHaveBeenCalledWith('src', { withFileTypes: true });
    expect(fakeCopyFile).toHaveBeenCalledWith('src/a.txt', 'dest/a.txt');
  });

  test('recursively copies nested directories', async () => {
    // Outer dir contains a subdir and a file
    fakeMkdir.mockResolvedValue();
    fakeReaddir
      .mockResolvedValueOnce([makeDirent('sub', false, true), makeDirent('f.txt', true, false)])
      // For recursive call on subdir
      .mockResolvedValueOnce([makeDirent('inner.txt', true, false)]);
    fakeCopyFile.mockResolvedValue();

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
    fakeMkdir.mockResolvedValue();
    fakeReaddir.mockRejectedValue(new Error('fail-read'));

    const result = await copyDirectory('src', 'dest');
    expect(result).toBe(false);
    expect(fakeMkdir).toHaveBeenCalledWith('dest', { recursive: true });
    expect(fakeReaddir).toHaveBeenCalledWith('src', { withFileTypes: true });
  });

  test('ignores non-file, non-directory entries', async () => {
    fakeMkdir.mockResolvedValue();
    fakeReaddir.mockResolvedValue([{ name: 'weird', isFile: (): boolean => false, isDirectory: (): boolean => false }]);

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

afterAll(() => {
  vi.restoreAllMocks();
  resetTest();
});
