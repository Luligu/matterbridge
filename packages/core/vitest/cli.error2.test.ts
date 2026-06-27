// vitest\cli.error2.test.ts

const NAME = 'CliError2';

import { Inspector, Tracker } from '@matterbridge/utils';
import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
import { LogLevel } from 'node-ansi-logger';

import { Matterbridge } from '../src/matterbridge.js';

const loadInstance = vi.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  return undefined as never; // Simulate an error by returning undefined
});

const exit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
  return undefined as never; // Prevent actual exit during tests
});

const startTrackerSpy = vi.spyOn(Tracker.prototype, 'start').mockImplementation(function () {
  return;
});

const stopTrackerSpy = vi.spyOn(Tracker.prototype, 'stop').mockImplementation(function () {
  return;
});

const startInspectorSpy = vi.spyOn(Inspector.prototype, 'start').mockImplementation(async function () {
  return Promise.resolve();
});

const stopInspectorSpy = vi.spyOn(Inspector.prototype, 'stop').mockImplementation(async function () {
  return Promise.resolve();
});

const takeHeapSnapshotSpy = vi.spyOn(Inspector.prototype, 'takeHeapSnapshot').mockImplementation(async function () {
  return Promise.resolve();
});

// oxlint-disable-next-line typescript/no-misused-promises
const runGarbageCollectionSpy = vi.spyOn(Inspector.prototype, 'runGarbageCollector').mockImplementation(async function () {
  return Promise.resolve();
});

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should start matterbridge and return undefined', async () => {
    process.argv = ['node', './cli.js', '-frontend', '0', '-logger', 'debug', '-matterlogger', 'debug', '-no-ansi'];
    const cli = await import('../src/cli.js');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Received shutdown event, exiting...'));
  });
});
