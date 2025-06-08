// src\utils\createDirectory.test.ts
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import path from 'node:path';
import fs from 'node:fs';
import { AnsiLogger, LogLevel, TimestampFormat } from '../logger/export.js';

import { createDirectory } from './createDirectory.js';

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

const log = new AnsiLogger({ logName: 'CreateDirectory', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

await fs.promises.rmdir(path.join('jest', 'newDir'), { recursive: true }).catch(() => {});

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
