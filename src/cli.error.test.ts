// src\cli.error.test.ts
const NAME = 'CliError';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', './cli.js', '-memorycheck', '-frontend', '0', '-profile', 'JestCli', '-debug', '-logger', 'debug', '-matterlogger', 'debug'];

import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

const loadInstance = jest.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  // console.log('mockImplementation of Matterbridge.loadInstance() called');
  throw new Error('Mock implementation of loadInstance called.'); // Simulate an error by throwing an exception
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

  it('should start matterbridge and fail', async () => {
    // Dynamically import the cli module
    const cli = await import('./cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Matterbridge.loadInstance() failed with error:`));
  });
});
