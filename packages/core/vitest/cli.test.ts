// vitest\cli.test.ts

const NAME = 'CliMain';

import { Inspector, Tracker } from '@matterbridge/utils';
import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
import { LogLevel } from 'node-ansi-logger';

import { cliEmitter } from '../src/cliEmitter.js';
import { Matterbridge } from '../src/matterbridge.js';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore cause is not included in the tsconfig include, but is needed for testing
import { MockMatterbridge } from '../src/mock/mockMatterbridge.js';

// oxlint-disable-next-line typescript/require-await
const loadInstance = vi.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  return MockMatterbridge.loadInstance() as unknown as Matterbridge; // Simulate a successful load by returning an instance of MockMatterbridge
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

// setupTest resets process.argv; set the cli args afterwards (they are read when cli.js is imported)
process.argv = [
  'node',
  './cli.js',
  '--inspect',
  '--snapshotinterval',
  '60000',
  '--frontend',
  '0',
  '--help',
  '--version',
  '--loader',
  '--debug',
  '--verbose',
  '--logger',
  'debug',
  '--matterlogger',
  'debug',
];

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should start matterbridge', async () => {
    const ready = new Promise<void>((resolve) => {
      cliEmitter.once('ready', resolve);
    });
    const cli = await import('../src/cli.js');
    await ready;
    expect(cli.instance).toBeDefined();
    expect(cli.instance).toBeInstanceOf(MockMatterbridge);
    matterbridge = cli.instance as unknown as Matterbridge;
    clearTimeout((matterbridge as any).systemCheckTimeout);
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);

    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cli main() started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check starting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) called');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) exited');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registering event handlers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registered event handlers');
  }, 10000);

  it('should trigger cpu and memory event', async () => {
    const cli = await import('../src/cli.js');
    expect(cli.instance).toBeDefined();
    cli.tracker.emit('uptime', 12.34, 23.45);
    cli.tracker.emit('snapshot', {
      osCpu: 12.34,
      processCpu: 23.45,
      totalMemory: 123456789,
      freeMemory: 987654321,
      rss: 12345678,
      heapTotal: 87654321,
      heapUsed: 6543210,
      external: 123456,
      arrayBuffers: 98765,
    } as any);
  });

  it('should shutdown matterbridge', async () => {
    matterbridge.emit('shutdown');
    await new Promise<void>((resolve) => {
      cliEmitter.once('shutdown', resolve);
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received shutdown event, exiting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cpu memory check stopping...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cpu memory check stopped'));
    expect(exit).toHaveBeenCalled();
  });

  it('should start memory check', async () => {
    matterbridge.emit('startmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received start memory check event');
    expect(exit).not.toHaveBeenCalled();
    expect(startTrackerSpy).toHaveBeenCalled();
  });

  it('should stop memory check', async () => {
    matterbridge.emit('stopmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received stop memory check event');
    expect(exit).not.toHaveBeenCalled();
    expect(stopTrackerSpy).toHaveBeenCalled();
  });

  it('should start inspector', async () => {
    matterbridge.emit('startinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(startInspectorSpy).toHaveBeenCalled();
  });

  it('should stop inspector', async () => {
    matterbridge.emit('stopinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(stopInspectorSpy).toHaveBeenCalled();
  });

  it('should call takeHeapSnapshot', async () => {
    matterbridge.emit('takeheapsnapshot');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(takeHeapSnapshotSpy).toHaveBeenCalled();
  });

  it('should trigger gc', async () => {
    matterbridge.emit('triggergarbagecollection');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(runGarbageCollectionSpy).toHaveBeenCalled();
  });

  it('should restart matterbridge', async () => {
    matterbridge.emit('restart');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received restart event, loading...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  });

  it('should update matterbridge', async () => {
    matterbridge.emit('update');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received update event, updating...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  });

  it('should shutdown again matterbridge', async () => {
    matterbridge.emit('shutdown');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(exit).toHaveBeenCalled();
  });
});
