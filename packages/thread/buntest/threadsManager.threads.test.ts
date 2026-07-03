// buntest\threadsManager.threads.test.ts

// oxlint-disable no-use-before-define

const NAME = 'ThreadsManagerThreads';
const HOMEDIR = path.join('.cache', 'bun', NAME);

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import path from 'node:path';

import type { WorkerMessage } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { setupTest } from '../../../buntest/bunSetupTest.js';
import { BroadcastServer } from '../src/broadcastServer.js';
import { ThreadsManager } from '../src/threadsManager.js';

// Setup the test environment
await setupTest(NAME, false);

type ThreadInfoForTest = {
  name: string;
  worker?: unknown;
  runCount?: number;
  lastStarted?: number;
  lastStopped?: number;
  lastDuration?: number;
  errorCount?: number;
};

type ThreadRunProbe = {
  name: string;
  startedAt: number;
  previousRunCount: number;
  previousErrorCount: number;
};

describe('ThreadsManagerThreads', () => {
  const log = new AnsiLogger({ logName: 'ThreadsManagerThreads', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  let broadcastserverMatterbridge: BroadcastServer;
  let broadcastserverPlugins: BroadcastServer;
  let manager: ThreadsManager;

  beforeAll(() => {
    // process.argv.push('--debug-worker');
    // Create ThreadsManager instance
    manager = new ThreadsManager();
    // Create mocked broadcast servers
    broadcastserverMatterbridge = new BroadcastServer('matterbridge', log);
    broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
      if (broadcastserverMatterbridge.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
        broadcastserverMatterbridge.respond({
          ...msg,
          result: {
            data: {
              uuid: 'threads-manager-bun-test',
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

  async function runThreadAndWaitStopped(name: string, params: Record<string, unknown>, timeoutMs: number = 15_000): Promise<ThreadInfoForTest> {
    const probe = createThreadRunProbe(name);
    const response = await broadcastserverMatterbridge.fetch({ type: 'manager_run', src: 'matterbridge', dst: 'manager', params } as any, timeoutMs);
    expect((response.result as { success: boolean }).success).toBe(true);

    const threadInfo = await waitForThreadStopped(probe, timeoutMs);
    expectStoppedAfterRun(threadInfo, probe);
    return threadInfo;
  }

  function createThreadRunProbe(name: string): ThreadRunProbe {
    const threadInfo = getThreadInfo(name);
    return {
      name,
      startedAt: Date.now(),
      previousRunCount: threadInfo.runCount ?? 0,
      previousErrorCount: threadInfo.errorCount ?? 0,
    };
  }

  function getThreadInfo(name: string): ThreadInfoForTest {
    const threadInfo = ((manager as any).threads as ThreadInfoForTest[]).find((thread) => thread.name === name);
    if (!threadInfo) throw new Error(`Thread ${name} not found`);
    return threadInfo;
  }

  function expectStoppedAfterRun(threadInfo: ThreadInfoForTest, probe: ThreadRunProbe): void {
    expect(threadInfo.worker).toBeUndefined();
    expect(threadInfo.runCount).toBe(probe.previousRunCount + 1);
    expect(threadInfo.errorCount ?? 0).toBe(probe.previousErrorCount);
    expect(threadInfo.lastStarted).toBeGreaterThanOrEqual(probe.startedAt);
    expect(threadInfo.lastStopped).toBeGreaterThanOrEqual(threadInfo.lastStarted ?? probe.startedAt);
    expect(threadInfo.lastDuration).toBeGreaterThanOrEqual(0);
  }

  async function waitForThreadStopped(probe: ThreadRunProbe, timeoutMs: number): Promise<ThreadInfoForTest> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const threadInfo = getThreadInfo(probe.name);
      if (!threadInfo.worker && (threadInfo.runCount ?? 0) === probe.previousRunCount + 1 && threadInfo.lastStopped !== undefined && threadInfo.lastStopped >= probe.startedAt)
        return threadInfo;
      await new Promise<void>((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Thread ${probe.name} did not stop within ${timeoutMs} ms`);
  }

  test('Run GlobalPrefix as a worker thread', async () => {
    await runThreadAndWaitStopped('GlobalPrefix', { name: 'GlobalPrefix', pipedOutput: true });
  }, 20000);

  test('Run CheckUpdates as a worker thread', async () => {
    await runThreadAndWaitStopped('CheckUpdates', { name: 'CheckUpdates', pipedOutput: true }, 20_000);
  }, 20000);

  test('Run SystemCheck as a worker thread', async () => {
    await runThreadAndWaitStopped('SystemCheck', { name: 'SystemCheck', pipedOutput: true });
  }, 20000);

  test('Run SpawnCommand as a worker thread', async () => {
    await runThreadAndWaitStopped('SpawnCommand', {
      name: 'SpawnCommand',
      pipedOutput: true,
      workerData: { threadName: 'SpawnCommand', command: process.execPath, args: ['--version'], packageCommand: 'install', packageName: 'node' },
    });
  }, 20000);

  test('Run ArchiveCommand as a worker thread', async () => {
    await runThreadAndWaitStopped('ArchiveCommand', {
      name: 'ArchiveCommand',
      pipedOutput: true,
      workerData: {
        threadName: 'ArchiveCommand',
        command: 'zip',
        archivePath: path.join(HOMEDIR, 'test.zip'),
        sourcePaths: ['docker/Dockerfile.latest', 'docker/Dockerfile.dev', 'docker/rootfs/'],
        destinationPath: '',
      },
    });
  }, 20000);

  test('Pause', async () => {
    await new Promise<void>((resolve) => setTimeout(resolve, 2000));
    expect(true).toBe(true);
  });
});
