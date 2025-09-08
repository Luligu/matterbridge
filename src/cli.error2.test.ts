// src\cli.error2.test.ts
const NAME = 'CliError2';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', './cli.js', '-memorycheck', '-frontend', '0', '-profile', 'JestCli', '-debug', '-logger', 'debug', '-matterlogger', 'debug'];

import path from 'node:path/posix';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

const loadInstance = jest.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  // console.log('mockImplementation of Matterbridge.loadInstance() called');
  return undefined as never; // Simulate an error by returning undefined
});

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  // console.log('mockImplementation of process.exit() called');
  return undefined as never; // Prevent actual exit during tests
});

// Setup the test environment
setupTest(NAME, false);

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
