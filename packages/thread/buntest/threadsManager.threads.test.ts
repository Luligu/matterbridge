/**
 * @file packages/thread/buntest/threadsManager.threads.test.ts
 * @description This file contains the tests for the ThreadsManager class with threads.
 * @author Luca Liguori
 */

/* oxlint-disable no-use-before-define */

const NAME = 'ThreadsManagerThreads';
const HOMEDIR = path.join('.cache', 'bun', NAME);

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';
import path from 'node:path';
import url from 'node:url';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import type { WorkerMessage } from '@matterbridge/types';
import { waiter } from '@matterbridge/utils/wait';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from '../src/broadcastServer.js';
import { ThreadsManager } from '../src/threadsManager.js';

// Setup the test environment
await setupTest(NAME, false);

// Directory of the @matterbridge/core cli module used to resolve the core runners
const coreDirectory = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', 'core', 'src');

describe('ThreadsManagerThreads', () => {
  const log = new AnsiLogger({ logName: 'ThreadsManagerThreads', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  let broadcastserverMatterbridge: BroadcastServer;
  let broadcastserverPlugins: BroadcastServer;
  let manager: ThreadsManager;

  beforeAll(() => {
    // process.argv.push('--debug-worker');
    // Create ThreadsManager instance
    manager = new ThreadsManager(coreDirectory);
    // Create mocked broadcast servers
    broadcastserverMatterbridge = new BroadcastServer('matterbridge', log);
    broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
      if (broadcastserverMatterbridge.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
        broadcastserverMatterbridge.respond({ ...msg, result: { data: { matterbridgeVersion: '1.0.0', logLevel: LogLevel.ERROR } as any, success: true } });
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
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // The tests resolve when manager_run answers, which is as soon as each worker starts. Wait until every worker has
    // sent its exit message (worker cleared), so none is still logging to the console when the test file is torn down.
    await waiter('All threads stopped', () => manager['threads'].every((thread) => thread.worker === undefined), false, 60_000, 100);
    // Close broadcast servers
    broadcastserverMatterbridge.close();
    broadcastserverPlugins.close();
    // Destroy ThreadsManager instance
    manager.destroy();
    // Restore all mocks
    vi.restoreAllMocks();
    resetTest();
  }, 70_000);

  test('Run GlobalPrefix as a worker thread', async () => {
    await new Promise<void>((resolve) => {
      broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
        if (broadcastserverMatterbridge.isWorkerResponse(msg) && msg.type === 'manager_run' && msg.result?.success) {
          resolve();
        }
      });
      broadcastserverMatterbridge.request({ type: 'manager_run', src: 'matterbridge', dst: 'manager', params: { name: 'GlobalPrefix', pipedOutput: true } });
    });
    expect(true).toBe(true);
  }, 30000);

  test('Run CheckUpdates as a worker thread', async () => {
    await new Promise<void>((resolve) => {
      broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
        if (broadcastserverMatterbridge.isWorkerResponse(msg) && msg.type === 'manager_run' && msg.result?.success) {
          resolve();
        }
      });
      broadcastserverMatterbridge.request({ type: 'manager_run', src: 'matterbridge', dst: 'manager', params: { name: 'CheckUpdates', pipedOutput: true } });
    });
    expect(true).toBe(true);
  }, 30000);

  test('Run SystemCheck as a worker thread', async () => {
    await new Promise<void>((resolve) => {
      broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
        if (broadcastserverMatterbridge.isWorkerResponse(msg) && msg.type === 'manager_run' && msg.result?.success) {
          resolve();
        }
      });
      broadcastserverMatterbridge.request({ type: 'manager_run', src: 'matterbridge', dst: 'manager', params: { name: 'SystemCheck', pipedOutput: true } });
    });
    expect(true).toBe(true);
  }, 30000);

  test('Run SpawnCommand as a worker thread', async () => {
    await new Promise<void>((resolve) => {
      broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
        if (broadcastserverMatterbridge.isWorkerResponse(msg) && msg.type === 'manager_run' && msg.result?.success) {
          resolve();
        }
      });
      broadcastserverMatterbridge.request({
        type: 'manager_run',
        src: 'matterbridge',
        dst: 'manager',
        // @ts-expect-error - This is intentional to test the SpawnCommand with specific workerData
        params: {
          name: 'SpawnCommand',
          pipedOutput: true,
          workerData: { threadName: 'SpawnCommand', command: 'npm', args: ['prefix', '-g'], packageCommand: 'npm', packageName: 'prefix' },
        },
      });
    });
    expect(true).toBe(true);
  }, 30000);

  test('Run ArchiveCommand as a worker thread', async () => {
    await new Promise<void>((resolve) => {
      broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
        if (broadcastserverMatterbridge.isWorkerResponse(msg) && msg.type === 'manager_run' && msg.result?.success) {
          resolve();
        }
      });
      broadcastserverMatterbridge.request({
        type: 'manager_run',
        src: 'matterbridge',
        dst: 'manager',
        params: {
          name: 'ArchiveCommand',
          pipedOutput: true,
          workerData: {
            threadName: 'ArchiveCommand',
            command: 'zip',
            archivePath: path.join(HOMEDIR, 'test.zip'),
            sourcePaths: ['docker/Dockerfile.latest', 'docker/Dockerfile.dev', 'docker/rootfs/'],
            destinationPath: '',
          },
        },
      });
    });
    expect(true).toBe(true);
  }, 30000);
});
