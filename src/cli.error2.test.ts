// src\cli.error2.test.ts

process.argv = ['node', './cli.js', '-memorycheck', '-frontend', '0', '-profile', 'JestCli', '-debug', '-logger', 'debug', '-matterlogger', 'debug'];

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

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

const loadInstance = jest.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  // console.log('mockImplementation of Matterbridge.loadInstance() called');
  return undefined as never; // Simulate an error by returning undefined
});

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  // console.log('mockImplementation of process.exit() called');
  return undefined as never; // Prevent actual exit during tests
});

describe('Matterbridge', () => {
  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should start matterbridge and return undefined', async () => {
    // Dynamically import the cli module
    const cli = await import('./cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Received shutdown event, exiting...'));
  });
});
