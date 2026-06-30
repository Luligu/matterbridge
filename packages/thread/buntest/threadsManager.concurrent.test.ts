// packages/thread/buntest/threadsManager.concurrent.test.ts

/**
 * Run all workers concurrently.
 */

// Run: bun test threadsManager.concurrent.test.ts
// Run: bun test --rerun-each 100 threadsManager.concurrent.test.ts

const NAME = 'ThreadsManagerConcurrent';

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { Worker } from 'node:worker_threads';

import type { ThreadNames, WorkerMessage } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { HOMEDIR, loggerDebugSpy, loggerLogSpy, setupTest } from '../../../buntest/bunSetupTest.js';
import { BroadcastServer } from '../src/broadcastServer.js';
import { ThreadsManager } from '../src/threadsManager.js';

// Setup the test environment
await setupTest(NAME, false);
// await setupTest(NAME, true, ['--debug']);

interface ThreadInfo {
  /** Logical name used to identify the thread (also passed as workerData.threadName). */
  name: ThreadNames;
  /** Worker script/build artifact file name (resolved via resolvePath) or relative path. */
  path: string;
  /** Execution type (worker runs and exits, thread runs continuously). */
  type: 'worker' | 'thread';
  /** Last created Worker instance for this thread (if started). */
  worker?: Worker;
  /** Number of times this thread has been started via runThread(). */
  runCount?: number;
  /** Number of times this thread has encountered an error. */
  errorCount?: number;
  /** Timestamp in ms when the thread was last started (Date.now()). */
  lastStarted?: number;
  /** Timestamp in ms when the thread was last stopped (Date.now()). */
  lastStopped?: number;
  /** Duration in ms between last start and stop, if known. */
  lastDuration?: number;
  /** Timestamp in ms when the thread was last seen (Date.now()). */
  lastSeen?: number;
}

describe('ThreadsManagerConcurrent', () => {
  const log = new AnsiLogger({ logName: 'ThreadsManagerConcurrent', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const archivePath = path.join(HOMEDIR, 'test-concurrent.zip');

  let broadcastserverMatterbridge: BroadcastServer;
  let broadcastserverPlugins: BroadcastServer;
  let manager: ThreadsManager;
  let threads: ThreadInfo[] = [];

  beforeAll(() => {
    // Create ThreadsManager instance
    manager = new ThreadsManager();
    threads = (manager as any).threads as ThreadInfo[];
    // Create mocked broadcast servers
    broadcastserverMatterbridge = new BroadcastServer('matterbridge', log);
    broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
      if (broadcastserverMatterbridge.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
        broadcastserverMatterbridge.respond({
          ...msg,
          result: {
            data: {
              uuid: 'threads-manager-concurrent-bun-test',
              matterbridgeVersion: '1.0.0',
              dockerVersion: undefined,
              bridgeMode: 'bridge',
              restartMode: 'none',
              logLevel: LogLevel.ERROR,
            } as any,
            success: true,
          },
        });
      }
    });
    broadcastserverPlugins = new BroadcastServer('plugins', log);
    broadcastserverPlugins.on('broadcast_message', (msg: WorkerMessage) => {
      if (broadcastserverPlugins.isWorkerRequest(msg) && msg.type === 'plugins_apipluginarray') {
        broadcastserverPlugins.respond({ ...msg, result: { plugins: [] } });
      }
    });
  });

  beforeEach(() => {
    // Clear all mocks
    mock.clearAllMocks();
  });

  afterAll(() => {
    // Close broadcast servers
    broadcastserverMatterbridge.close();
    broadcastserverPlugins.close();
    // Destroy ThreadsManager instance
    manager.destroy();
  });

  function expectStoppedAfterRun(name: ThreadNames): void {
    const threadInfo = threads.find((t) => t.name === name);
    expect(threadInfo).toBeDefined();
    if (!threadInfo) return;
    expect(threadInfo.worker).toBeUndefined();
    expect(threadInfo.runCount).toBe(1);
    expect(threadInfo.errorCount).toBe(undefined);
    expect(threadInfo.lastStarted).toBeDefined();
    expect(threadInfo.lastStopped).toBeDefined();
    expect(threadInfo.lastDuration).toBeDefined();
    // expect(threadInfo.lastStopped).toBeGreaterThanOrEqual(threadInfo.lastStarted ?? 0);
  }

  test('Run all worker threads concurrently', async () => {
    const threadRuns: { name: ThreadNames; params: Record<string, unknown> }[] = [
      { name: 'GlobalPrefix', params: { name: 'GlobalPrefix', pipedOutput: true } },
      // { name: 'CheckUpdates', params: { name: 'CheckUpdates', pipedOutput: true } },
      { name: 'SystemCheck', params: { name: 'SystemCheck', pipedOutput: true } },
      {
        name: 'SpawnCommand',
        params: {
          name: 'SpawnCommand',
          pipedOutput: true,
          workerData: { threadName: 'SpawnCommand', command: process.execPath, args: ['--version'], packageCommand: 'install', packageName: 'node' },
        },
      },
      {
        name: 'ArchiveCommand',
        params: {
          name: 'ArchiveCommand',
          pipedOutput: true,
          workerData: {
            threadName: 'ArchiveCommand',
            command: 'zip',
            archivePath,
            sourcePaths: ['docker/Dockerfile.latest', 'docker/Dockerfile.dev'],
            destinationPath: '',
          },
        },
      },
      { name: 'DockerVersion', params: { name: 'DockerVersion', pipedOutput: true } },
    ];

    // Run all threads concurrently
    process.stderr.write('Starting all threads concurrently...\n');
    for (const thread of threadRuns) {
      const response = await broadcastserverMatterbridge.fetch({ type: 'manager_run', src: 'matterbridge', dst: 'manager', params: thread.params } as any);
      expect((response.result as { success: boolean }).success).toBe(true);
    }
    process.stderr.write('Started all threads concurrently\n');

    // Wait for all threads to stop
    process.stderr.write('Waiting for all threads to stop...\n');
    await Promise.all(
      threadRuns.map(async ({ name }) => {
        await new Promise<void>((resolve, reject) => {
          const interval = setInterval(() => {
            const threadInfo = threads.find((t) => t.name === name);
            if (!threadInfo) {
              clearInterval(interval);
              reject(new Error(`Thread ${name} not found`));
              return;
            }
            if (threadInfo.runCount === 1 && threadInfo.lastStopped !== undefined) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      }),
    );
    process.stderr.write('All threads have stopped\n');

    // Terminate any remaining threads (if any) to ensure a clean exit
    process.stderr.write('Terminating any running threads...\n');
    for (const worker of (manager as any).terminateWorkers as Set<Worker>) {
      await worker.terminate();
    }
    (manager as any).terminateWorkers.clear();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Thread GlobalPrefix has exited at/));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Thread SystemCheck has exited at/));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Thread SpawnCommand has exited at/));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Thread ArchiveCommand has exited at/));
    // expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Thread CheckUpdates has exited at/));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/^Thread DockerVersion has exited at/));
    process.stderr.write('All threads have been terminated\n');

    // Check that all threads have stopped and have the expected properties
    process.stderr.write('Checking that all threads have the expected properties...\n');
    for (const { name } of threadRuns) {
      expectStoppedAfterRun(name);
    }
    process.stderr.write('All threads have have the expected properties\n');

    // Check that the archive file was created and has a size greater than 0
    expect(existsSync(archivePath)).toBe(true);
    expect(statSync(archivePath).size).toBeGreaterThan(0);

    // Check that the expected log messages were emitted
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting global prefix check/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Global node_modules directory/));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting check updates/));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Check updates succeeded/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting system check/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/System check succeeded/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting spawn command/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Spawn command/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting archive command/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Archive command zip/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Starting docker version check/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Docker version check succeeded/));
  }, 60000);
});
