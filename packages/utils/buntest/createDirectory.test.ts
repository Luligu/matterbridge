/**
 * @file packages/utils/buntest/createDirectory.test.ts
 * @description This file contains the tests for createDirectory.
 * @author Luca Liguori
 */

import { afterAll, beforeEach, describe, expect, it, spyOn, vi } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

import { HOMEDIR, log, loggerLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { createDirectory } from '../src/createDirectory.js';

// Mocks AnsiLogger.prototype.log and the console methods, and sets process.argv to ['bun', NAME].
await setupTest('CreateDirectoryTest');

await fs.promises.rmdir(path.join(HOMEDIR, 'newDir')).catch(() => {});

describe('createDirectory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should log a message if the directory already exists', async () => {
    fs.mkdirSync(path.join(HOMEDIR, 'existingDir'), { recursive: true });
    await createDirectory(path.join(HOMEDIR, 'existingDir'), 'Existing Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Directory Existing Directory already exists at path: ${path.join(HOMEDIR, 'existingDir')}`);
  });

  it('should create directory if it does not exist', async () => {
    await createDirectory(path.join(HOMEDIR, 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Created Jest New Directory: ${path.join(HOMEDIR, 'newDir')}`);
    await fs.promises.rmdir(path.join(HOMEDIR, 'newDir')).catch(() => {});
  });

  it('should handle errors when creating directory', async () => {
    spyOn(fs.promises, 'mkdir').mockRejectedValueOnce(new Error('Failed to create directory'));
    await createDirectory(path.join(HOMEDIR, 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining(`Error creating dir Jest New Directory path ${path.join(HOMEDIR, 'newDir')}: Failed to create directory`),
    );
  });

  it('should handle errors when accessing directory', async () => {
    const errorMessage = 'Access denied';
    spyOn(fs.promises, 'access').mockRejectedValueOnce(new Error(errorMessage));
    await createDirectory(path.join(HOMEDIR, 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      expect.stringContaining(`Error accessing dir Jest New Directory path ${path.join(HOMEDIR, 'newDir')}: ${errorMessage}`),
    );
  });
});

afterAll(() => {
  vi.restoreAllMocks();
  resetTest();
});
