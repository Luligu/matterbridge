// src\cli.error2.test.ts
const NAME = 'CliError2';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path/posix';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';
import { Inspector } from './utils/inspector.js';
import { Tracker } from './utils/tracker.js';

const loadInstance = jest.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  return undefined as never; // Simulate an error by returning undefined
});

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  return undefined as never; // Prevent actual exit during tests
});

const startTrackerSpy = jest.spyOn(Tracker.prototype, 'start').mockImplementation(function () {
  return;
});

const stopTrackerSpy = jest.spyOn(Tracker.prototype, 'stop').mockImplementation(function () {
  return;
});

const startInspectorSpy = jest.spyOn(Inspector.prototype, 'start').mockImplementation(async function () {
  return Promise.resolve();
});

const stopInspectorSpy = jest.spyOn(Inspector.prototype, 'stop').mockImplementation(async function () {
  return Promise.resolve();
});

const takeHeapSnapshotSpy = jest.spyOn(Inspector.prototype, 'takeHeapSnapshot').mockImplementation(async function () {
  return Promise.resolve();
});

const runGarbageCollectionSpy = jest.spyOn(Inspector.prototype, 'runGarbageCollector').mockImplementation(async function () {
  return Promise.resolve();
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
    process.argv = ['node', './cli.js', '-frontend', '0', '-logger', 'debug', '-matterlogger', 'debug'];
    const cli = await import('./cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Received shutdown event, exiting...'));
  });
});
