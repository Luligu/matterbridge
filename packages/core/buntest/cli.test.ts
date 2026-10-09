/**
 * @file packages/core/buntest/cli.test.ts
 * @description This file contains the bun tests for cli.
 * @author Luca Liguori
 */

/* oxlint-disable unicorn/no-useless-undefined */

const NAME = 'CliMain';

import { afterAll, beforeEach, describe, expect, mock, test, vi } from 'bun:test';
import { EventEmitter } from 'node:events';

import { consoleLogSpy, loggerLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { ThreadsManager } from '@matterbridge/thread/manager';
import { BroadcastServer } from '@matterbridge/thread/server';
import { formatBytes, formatUptime } from '@matterbridge/utils/format';
import { Inspector } from '@matterbridge/utils/inspector';
import { Tracker, type TrackerSnapshot } from '@matterbridge/utils/tracker';
import { LogLevel } from 'node-ansi-logger';

import { cliEmitter } from '../src/cliEmitter.js';
import type { Matterbridge } from '../src/matterbridge.js';

/** Minimal stand-in for the Matterbridge instance: the CLI only listens to its events and reads `shutdown`. */
class FakeMatterbridge extends EventEmitter {
  shutdown = false;
}

// Mock the Matterbridge module before cli.ts imports it lazily, so no real Matterbridge is loaded.
const loadInstance = vi.fn<(initialize?: boolean) => Promise<FakeMatterbridge | undefined>>();
await mock.module('../src/matterbridge.js', () => ({ Matterbridge: { loadInstance } }));

const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
const closeBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'close');
const startTrackerSpy = vi.spyOn(Tracker.prototype, 'start').mockImplementation(() => {});
const stopTrackerSpy = vi.spyOn(Tracker.prototype, 'stop').mockImplementation(() => {});
const startInspectorSpy = vi.spyOn(Inspector.prototype, 'start').mockImplementation(async () => {});
const stopInspectorSpy = vi.spyOn(Inspector.prototype, 'stop').mockImplementation(async () => {});
const takeHeapSnapshotSpy = vi.spyOn(Inspector.prototype, 'takeHeapSnapshot').mockImplementation(async () => {});
const runGarbageCollectorSpy = vi.spyOn(Inspector.prototype, 'runGarbageCollector').mockImplementation(() => {});
const runThreadSpy = vi.spyOn(ThreadsManager.prototype, 'runThread').mockImplementation(() => undefined as never);

// Setup the test environment: --help and --version run at module load, --inspect drives the inspector branches
await setupTest(NAME, false, ['--help', '--version', '--inspect', '--debug']);

/**
 * Yields to the event loop until the CLI logs a message at the given level, so the tests never wait on fixed timers.
 *
 * @param {LogLevel} level - The log level to wait for.
 * @param {string} message - The start of the message to wait for.
 * @returns {Promise<void>} Resolves once the message has been logged.
 */
async function waitForLog(level: LogLevel, message: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (loggerLogSpy.mock.calls.some(([lvl, msg]) => lvl === level && typeof msg === 'string' && msg.startsWith(message))) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`Timed out waiting for log message: ${message}`);
}

describe('Cli', () => {
  let cli: typeof import('../src/cli.js');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should show help and version, then exit with code 1 when both loading Matterbridge and the shutdown fail at module load', async () => {
    loadInstance.mockRejectedValueOnce(new Error('loadInstance failed'));
    stopInspectorSpy.mockRejectedValueOnce(new Error('stop inspector failed'));
    const exited = new Promise<void>((resolve) => {
      exitSpy.mockImplementation(((code?: number) => {
        if (code === 1) resolve();
      }) as typeof process.exit);
    });
    cli = await import('../src/cli.js');
    await exited;
    exitSpy.mockImplementation(() => undefined as never);

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Usage: matterbridge [options] [command]'));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringMatching(/^Matterbridge version \d+\.\d+\.\d+/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Matterbridge.loadInstance() failed with error'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received shutdown event, exiting...');
    expect(cli.instance).toBeUndefined();
    expect(startTrackerSpy).toHaveBeenCalledTimes(1);
    expect(startInspectorSpy).toHaveBeenCalledTimes(1);
    expect(stopInspectorSpy).toHaveBeenCalledTimes(1);
    // --help, --version and the failed shutdown
    expect(exitSpy.mock.calls).toEqual([[0], [0], [1]]);
  });

  test('should start the experimental backend, then shut down when loading Matterbridge returns undefined', async () => {
    loadInstance.mockResolvedValueOnce(undefined);
    process.argv.push('--experimental-backend');
    try {
      await cli.main();
    } finally {
      process.argv.pop();
    }

    expect(runThreadSpy).toHaveBeenCalledWith('Backend');
    expect(cli.instance).toBeUndefined();
    expect(loadInstance).toHaveBeenCalledWith(true);
    expect(stopInspectorSpy).toHaveBeenCalledTimes(1);
    expect(stopTrackerSpy).toHaveBeenCalledTimes(1);
    expect(closeBroadcastServerSpy).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received shutdown event, exit with code 0');
    expect(exitSpy.mock.calls).toEqual([[0]]);
  });

  test('should shut down when the loaded instance requests a shutdown', async () => {
    const matterbridge = new FakeMatterbridge();
    matterbridge.shutdown = true;
    loadInstance.mockResolvedValueOnce(matterbridge);
    await cli.main();

    expect(cli.instance).toBe(matterbridge as unknown as Matterbridge);
    expect(matterbridge.listenerCount('shutdown')).toBe(0);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  test.each<{ name: string; env: Record<string, string>; argv: string[]; expected: string | undefined }>([
    { name: 'colors are enabled', env: { TERM: 'xterm' }, argv: [], expected: undefined },
    { name: 'NO_COLOR is set', env: { NO_COLOR: 'true', TERM: 'xterm' }, argv: [], expected: '1' },
    { name: 'TERM is dumb', env: { TERM: 'dumb' }, argv: [], expected: '1' },
    { name: 'FORCE_COLOR is zero', env: { TERM: 'xterm', FORCE_COLOR: '0' }, argv: [], expected: '1' },
    { name: '--no-ansi is passed', env: { TERM: 'xterm' }, argv: ['--no-ansi'], expected: '1' },
    { name: '-no-ansi is passed', env: { TERM: 'xterm' }, argv: ['-no-ansi'], expected: '1' },
  ])('should configure ANSI output when $name', async ({ env, argv, expected }) => {
    const savedEnv = { NO_COLOR: process.env.NO_COLOR, TERM: process.env.TERM, FORCE_COLOR: process.env.FORCE_COLOR };
    const savedArgv = process.argv;
    delete process.env.NO_COLOR;
    delete process.env.FORCE_COLOR;
    Object.assign(process.env, env);
    process.argv = [...savedArgv, ...argv];
    loadInstance.mockResolvedValueOnce(undefined);
    try {
      await cli.main();
      expect(process.env.NO_COLOR as string | undefined).toBe(expected);
    } finally {
      process.argv = savedArgv;
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) Reflect.deleteProperty(process.env, key);
        else process.env[key] = value;
      }
    }
  });

  describe('with a running instance', () => {
    const matterbridge = new FakeMatterbridge();

    test('should start and register the event handlers', async () => {
      loadInstance.mockResolvedValueOnce(matterbridge);
      const ready = new Promise<void>((resolve) => cliEmitter.once('ready', resolve));
      await cli.main();
      await ready;

      expect(cli.instance).toBe(matterbridge as unknown as Matterbridge);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registered event handlers');
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cli main() ready');
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('should forward the tracker uptime and snapshot to the cli emitter', () => {
      const uptime = vi.fn();
      const memory = vi.fn();
      const cpu = vi.fn();
      cliEmitter.once('uptime', uptime);
      cliEmitter.once('memory', memory);
      cliEmitter.once('cpu', cpu);

      cli.tracker.emit('uptime', 61.5, 3601.9);
      cli.tracker.emit('snapshot', {
        osCpu: 12.5,
        processCpu: 3.25,
        totalMemory: 2048,
        freeMemory: 1024,
        rss: 512,
        heapTotal: 256,
        heapUsed: 128,
        external: 64,
        arrayBuffers: 32,
      } as TrackerSnapshot);

      expect(uptime).toHaveBeenCalledWith(formatUptime(61), formatUptime(3601));
      expect(memory).toHaveBeenCalledWith(...[2048, 1024, 512, 256, 128, 64, 32].map((bytes) => formatBytes(bytes)));
      expect(cpu).toHaveBeenCalledWith(12.5, 3.25);
    });

    test('should handle the memory check, inspector and gc events', async () => {
      matterbridge.emit('startmemorycheck');
      matterbridge.emit('stopmemorycheck');
      matterbridge.emit('startinspector');
      matterbridge.emit('stopinspector');
      matterbridge.emit('takeheapsnapshot');
      matterbridge.emit('triggergarbagecollection');
      await Promise.resolve();

      expect(startTrackerSpy).toHaveBeenCalledTimes(1);
      expect(stopTrackerSpy).toHaveBeenCalledTimes(1);
      expect(startInspectorSpy).toHaveBeenCalledTimes(1);
      expect(stopInspectorSpy).toHaveBeenCalledTimes(1);
      expect(takeHeapSnapshotSpy).toHaveBeenCalledTimes(1);
      expect(runGarbageCollectorSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test('should log the failures of the event handlers', async () => {
      startInspectorSpy.mockRejectedValueOnce(new Error('start failed'));
      stopInspectorSpy.mockRejectedValueOnce(new Error('stop failed'));
      takeHeapSnapshotSpy.mockRejectedValueOnce(new Error('snapshot failed'));
      loadInstance.mockRejectedValueOnce(new Error('restart failed')).mockRejectedValueOnce(new Error('update failed'));
      matterbridge.emit('startinspector');
      matterbridge.emit('stopinspector');
      matterbridge.emit('takeheapsnapshot');
      matterbridge.emit('restart');
      matterbridge.emit('update');
      for (const message of ['Failed to start inspector', 'Failed to stop inspector', 'Failed to take heap snapshot', 'Failed to restart', 'Failed to update']) {
        await waitForLog(LogLevel.ERROR, message);
      }

      // The shutdown fails at stopInspector, before stopping the tracker and exiting
      stopInspectorSpy.mockRejectedValueOnce(new Error('shutdown failed'));
      matterbridge.emit('shutdown');
      await waitForLog(LogLevel.ERROR, 'Failed to shutdown');

      expect(cli.instance).toBe(matterbridge as unknown as Matterbridge);
      expect(stopTrackerSpy).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
    });

    test.each(['restart', 'update'] as const)('should reload Matterbridge on %s', async (event) => {
      const reloaded = new FakeMatterbridge();
      loadInstance.mockResolvedValueOnce(reloaded);
      matterbridge.emit(event);
      await waitForLog(LogLevel.DEBUG, 'Registered event handlers');

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, event === 'restart' ? 'Received restart event, loading...' : 'Received update event, updating...');
      expect(loadInstance).toHaveBeenCalledWith(true);
      expect(cli.instance).toBe(reloaded as unknown as Matterbridge);
      expect(reloaded.listenerCount('shutdown')).toBe(1);
    });

    test('should shut down on the shutdown event of the reloaded instance', async () => {
      const shutdown = new Promise<void>((resolve) => cliEmitter.once('shutdown', resolve));
      (cli.instance as unknown as FakeMatterbridge).emit('shutdown');
      await shutdown;

      expect(stopInspectorSpy).toHaveBeenCalledTimes(1);
      expect(stopTrackerSpy).toHaveBeenCalledTimes(1);
      expect(closeBroadcastServerSpy).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });
});
