// buntest\threadsManager.concurrent.test.ts

// oxlint-disable no-use-before-define

const NAME = 'ThreadsManagerConcurrent';
const HOMEDIR = path.join('.cache', 'bun', NAME);

import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

import type { WorkerMessage } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { loggerLogSpy, setupTest } from '../../../buntest/bunSetupTest.js';
import { BroadcastServer } from '../src/broadcastServer.js';
import { ThreadsManager } from '../src/threadsManager.js';

// Setup the test environment
await setupTest(NAME, true, ['--debug']);

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

describe('ThreadsManagerConcurrent', () => {
  const log = new AnsiLogger({ logName: 'ThreadsManagerConcurrent', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const archivePath = path.join(HOMEDIR, 'test-concurrent.zip');

  let broadcastserverMatterbridge: BroadcastServer;
  let broadcastserverPlugins: BroadcastServer;
  let manager: ThreadsManager;

  beforeAll(() => {
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

  function expectLogMessage(message: string): void {
    const messages = loggerLogSpy.mock.calls.map((call) => call[1]).filter((value): value is string => typeof value === 'string');
    expect(messages.some((logMessage) => logMessage.includes(message))).toBe(true);
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

  async function startThread(name: string, params: Record<string, unknown>, timeoutMs: number = 15_000): Promise<ThreadRunProbe> {
    const probe = createThreadRunProbe(name);
    const response = await broadcastserverMatterbridge.fetch({ type: 'manager_run', src: 'matterbridge', dst: 'manager', params } as any, timeoutMs);
    expect((response.result as { success: boolean }).success).toBe(true);
    return probe;
  }

  async function delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  test('Run all worker threads concurrently', async () => {
    const threadRuns = [
      { name: 'GlobalPrefix', params: { name: 'GlobalPrefix', pipedOutput: true } },
      { name: 'CheckUpdates', params: { name: 'CheckUpdates', pipedOutput: true } },
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
            sourcePaths: ['docker/Dockerfile.latest', 'docker/Dockerfile.dev', 'docker/rootfs/'],
            destinationPath: '',
          },
        },
      },
    ];

    const probes: ThreadRunProbe[] = [];
    for (const thread of threadRuns) {
      probes.push(await startThread(thread.name, thread.params, 20_000));
      await delay(2000);
    }
    const stoppedThreads = await Promise.all(probes.map(async (probe) => waitForThreadStopped(probe, 20_000)));
    stoppedThreads.forEach((threadInfo, index) => {
      expectStoppedAfterRun(threadInfo, probes[index]);
    });

    expect(existsSync(archivePath)).toBe(true);
    expect(statSync(archivePath).size).toBeGreaterThan(0);

    expectLogMessage('Starting global prefix check');
    expectLogMessage('Global node_modules directory');
    expectLogMessage('Starting check updates');
    expectLogMessage('Check updates succeeded');
    expectLogMessage('Starting system check');
    expectLogMessage('System check succeeded');
    expectLogMessage('Starting spawn command');
    expectLogMessage('Spawn command');
    expectLogMessage('Starting archive command');
    expectLogMessage('Archive command zip');
  }, 60000);
});
