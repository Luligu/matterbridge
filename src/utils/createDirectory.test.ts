// src\utils\createDirectory.test.ts

const NAME = 'CreateDirectory';

import path from 'node:path';
import fs from 'node:fs';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { loggerLogSpy, setupTest } from '../jestutils/jestHelpers.js';

import { createDirectory } from './createDirectory.js';

const log = new AnsiLogger({ logName: 'CreateDirectory', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

await fs.promises.rmdir(path.join('jest', 'newDir'), { recursive: true }).catch(() => {});

// Setup the test environment
setupTest(NAME, false);

describe('createDirectory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log a message if the directory already exists', async () => {
    await createDirectory(path.join('src', 'mock'), 'Mock', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Directory Mock already exists at path: ${path.join('src', 'mock')}`);
  });

  it('should create directory if it does not exist', async () => {
    await createDirectory(path.join('jest', 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Created Jest New Directory: ${path.join('jest', 'newDir')}`);
    await fs.promises.rmdir(path.join('jest', 'newDir'), { recursive: true }).catch(() => {});
  });

  it('should handle errors when creating directory', async () => {
    jest.spyOn(fs.promises, 'mkdir').mockRejectedValueOnce(new Error('Failed to create directory'));
    await createDirectory(path.join('jest', 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Error creating dir Jest New Directory path ${path.join('jest', 'newDir')}: Error: Failed to create directory`);
  });

  it('should handle errors when accessing directory', async () => {
    const errorMessage = 'Access denied';
    jest.spyOn(fs.promises, 'access').mockRejectedValueOnce(new Error(errorMessage));
    await createDirectory(path.join('jest', 'newDir'), 'Jest New Directory', log);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Error accessing dir Jest New Directory path ${path.join('jest', 'newDir')}: Error: ${errorMessage}`);
  });
});
