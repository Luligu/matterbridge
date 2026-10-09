/**
 * @file packages/core/vitest/cli.test.ts
 * @description This file contains the tests for cli.
 * @author Luca Liguori
 */

const NAME = 'CliMain';

import { consoleLogSpy, loggerLogSpy, originalProcessArgv, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { BroadcastServer } from '@matterbridge/thread/server';
import { Inspector, Tracker } from '@matterbridge/utils';
import { LogLevel } from 'node-ansi-logger';

import { cliEmitter } from '../src/cliEmitter.js';
import type { Matterbridge } from '../src/matterbridge.js';
// oxlint-disable-next-line typescript/ban-ts-comment
// @ts-ignore cause is not included in the tsconfig include, but is needed for testing
import { MockMatterbridge } from '../src/mock/mockMatterbridge.js';

const loadInstance = vi.hoisted(() => vi.fn<typeof Matterbridge.loadInstance>());
vi.mock('../src/matterbridge.js', () => ({ Matterbridge: { loadInstance } }));

// Keep spied-on classes stable when reloading the CLI for startup error cases.
vi.mock('@matterbridge/thread/server', async (importOriginal) => importOriginal<typeof import('@matterbridge/thread/server')>());
vi.mock('@matterbridge/utils/tracker', async (importOriginal) => importOriginal<typeof import('@matterbridge/utils/tracker')>());
vi.mock('@matterbridge/utils/inspector', async (importOriginal) => importOriginal<typeof import('@matterbridge/utils/inspector')>());
vi.mock('node-ansi-logger', async (importOriginal) => importOriginal<typeof import('node-ansi-logger')>());

loadInstance.mockImplementation(async (_initialize?: boolean) => {
  return MockMatterbridge.loadInstance() as unknown as Matterbridge; // Simulate a successful load by returning an instance of MockMatterbridge
});

const exit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
  return undefined as never; // Prevent actual exit during tests
});

const closeBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'close');

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
await setupTest(NAME, false, [
  '--inspect',
  '--snapshotinterval',
  '60000',
  '--frontend',
  '0',
  '--help',
  '--version',
  '--loader',
  '--verbose',
  '--logger',
  'debug',
  '--matterlogger',
  'debug',
]);

afterAll(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  process.argv = [...originalProcessArgv];
});

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
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
    expect(loggerLogSpy.mock.contexts[0]).toMatchObject({ logLevel: LogLevel.DEBUG });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check starting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) called');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) exited');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registering event handlers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registered event handlers');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('--tls:                   enable SSL for the frontend and the WebSocketServer (the server will use the certificates and switch to https)'),
    );
    expect(closeBroadcastServerSpy).not.toHaveBeenCalled();
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
    const shutdown = new Promise<void>((resolve) => {
      cliEmitter.once('shutdown', resolve);
    });
    matterbridge.emit('shutdown');
    await shutdown;

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received shutdown event, exiting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cpu memory check stopping...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cpu memory check stopped'));
    expect(closeBroadcastServerSpy).toHaveBeenCalledTimes(2);
    expect(closeBroadcastServerSpy.mock.contexts).toMatchObject([{ name: 'cli' }, { name: 'manager' }]);
    expect(closeBroadcastServerSpy.mock.invocationCallOrder[0]).toBeLessThan(exit.mock.invocationCallOrder[0]);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('should start memory check', () => {
    matterbridge.emit('startmemorycheck');

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check starting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check started');
    expect(exit).not.toHaveBeenCalled();
    expect(startTrackerSpy).toHaveBeenCalledTimes(1);
  });

  it('should stop memory check', () => {
    matterbridge.emit('stopmemorycheck');

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check stopping...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check stopped');
    expect(exit).not.toHaveBeenCalled();
    expect(stopTrackerSpy).toHaveBeenCalledTimes(1);
  });

  it('should start inspector', () => {
    matterbridge.emit('startinspector');
    expect(startInspectorSpy).toHaveBeenCalled();
  });

  it('should stop inspector', () => {
    matterbridge.emit('stopinspector');
    expect(stopInspectorSpy).toHaveBeenCalled();
  });

  it('should call takeHeapSnapshot', () => {
    matterbridge.emit('takeheapsnapshot');
    expect(takeHeapSnapshotSpy).toHaveBeenCalled();
  });

  it('should trigger gc', () => {
    matterbridge.emit('triggergarbagecollection');
    expect(runGarbageCollectionSpy).toHaveBeenCalled();
  });

  it('should restart matterbridge', async () => {
    matterbridge.emit('restart');
    await vi.waitFor(() => {
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registered event handlers');
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received restart event, loading...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  });

  it('should update matterbridge', async () => {
    matterbridge.emit('update');
    await vi.waitFor(() => {
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registered event handlers');
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received update event, updating...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  });

  it('should shutdown again matterbridge', async () => {
    const shutdown = new Promise<void>((resolve) => {
      cliEmitter.once('shutdown', resolve);
    });
    matterbridge.emit('shutdown');
    await shutdown;
    expect(closeBroadcastServerSpy).toHaveBeenCalledTimes(2);
    expect(closeBroadcastServerSpy.mock.contexts).toMatchObject([{ name: 'cli' }, { name: 'manager' }]);
    expect(exit).toHaveBeenCalledWith(0);
  });
});

describe('Matterbridge startup errors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    loadInstance.mockResolvedValue(undefined as never);
    process.argv = originalProcessArgv.slice(0, 2);
  });

  afterEach(() => {
    process.argv = [...originalProcessArgv];
  });

  it('should shut down when loading Matterbridge fails', async () => {
    process.argv.push('--debug', '--no-ansi');
    loadInstance.mockRejectedValueOnce(new Error('Mock implementation of loadInstance called.'));
    const { cliEmitter } = await import('../src/cliEmitter.js');
    const shutdown = new Promise<void>((resolve) => {
      cliEmitter.once('shutdown', resolve);
    });
    const cli = await import('../src/cli.js');
    await shutdown;

    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(closeBroadcastServerSpy).toHaveBeenCalledTimes(2);
    expect(closeBroadcastServerSpy.mock.contexts).toMatchObject([{ name: 'cli' }, { name: 'manager' }]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cli main() started');
    expect(loggerLogSpy.mock.contexts[0]).toMatchObject({ logLevel: LogLevel.DEBUG });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Matterbridge.loadInstance() failed with error:'));
  });

  it('should shut down when loading Matterbridge returns undefined', async () => {
    process.argv.push('-no-ansi');
    const { cliEmitter } = await import('../src/cliEmitter.js');
    const shutdown = new Promise<void>((resolve) => {
      cliEmitter.once('shutdown', resolve);
    });
    const cli = await import('../src/cli.js');
    await shutdown;

    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
    expect(stopTrackerSpy).toHaveBeenCalledTimes(1);
    expect(closeBroadcastServerSpy).toHaveBeenCalledTimes(2);
    expect(closeBroadcastServerSpy.mock.contexts).toMatchObject([{ name: 'cli' }, { name: 'manager' }]);
    expect(loggerLogSpy.mock.contexts[0]).toMatchObject({ logLevel: LogLevel.INFO });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Received shutdown event, exiting...'));
  });
});

describe('Matterbridge ANSI output', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadInstance.mockResolvedValue(undefined as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.argv = [...originalProcessArgv];
  });

  it.each([
    { name: 'colors are enabled', noColor: undefined, term: 'xterm', forceColor: undefined, argv: [], expected: undefined },
    { name: 'NO_COLOR is set', noColor: 'true', term: 'xterm', forceColor: undefined, argv: [], expected: '1' },
    { name: 'TERM is dumb', noColor: undefined, term: 'dumb', forceColor: undefined, argv: [], expected: '1' },
    { name: 'FORCE_COLOR is zero', noColor: undefined, term: 'xterm', forceColor: '0', argv: [], expected: '1' },
    { name: '--no-ansi is passed', noColor: undefined, term: 'xterm', forceColor: undefined, argv: ['--no-ansi'], expected: '1' },
    { name: '-no-ansi is passed', noColor: undefined, term: 'xterm', forceColor: undefined, argv: ['-no-ansi'], expected: '1' },
  ])('should configure ANSI output when $name', async ({ noColor, term, forceColor, argv, expected }) => {
    vi.stubEnv('NO_COLOR', noColor);
    vi.stubEnv('TERM', term);
    vi.stubEnv('FORCE_COLOR', forceColor);
    process.argv = [...originalProcessArgv.slice(0, 2), ...argv];

    const cli = await import('../src/cli.js');
    await cli.main();

    expect(process.env.NO_COLOR).toBe(expected);
    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(startTrackerSpy).toHaveBeenCalledTimes(1);
    expect(stopTrackerSpy).toHaveBeenCalledTimes(1);
    expect(closeBroadcastServerSpy).toHaveBeenCalledTimes(2);
    expect(closeBroadcastServerSpy.mock.contexts).toMatchObject([{ name: 'cli' }, { name: 'manager' }]);
    expect(exit).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });
});
