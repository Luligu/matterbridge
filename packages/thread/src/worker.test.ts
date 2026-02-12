// src\worker.test.ts

const NAME = 'Workers';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import type { Worker } from 'node:worker_threads';
import { inspect } from 'node:util';
import { existsSync } from 'node:fs';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, rs, TimestampFormat } from 'node-ansi-logger';
import { setupTest } from '@matterbridge/core/jestutils';
import type { WorkerMessage, ParentPortMessage } from '@matterbridge/types';

import { BroadcastServer } from './broadcastServer.js';
import { createESMWorker } from './worker.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Workers', () => {
  const log = new AnsiLogger({ logName: 'MatterbridgeWorkers', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  let broadcastserverMatterbridge: BroadcastServer;
  let broadcastserverPlugins: BroadcastServer;

  beforeAll(async () => {
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

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Close broadcast servers
    broadcastserverMatterbridge.close();
    broadcastserverPlugins.close();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Run workerGlobalPrefix as a worker thread', async () => {
    let worker: Worker;
    let workerName: string | null;
    let workerId: number;

    expect(existsSync('./packages/thread/dist/workerGlobalPrefix.js')).toBe(true);

    function messageHandler(message: ParentPortMessage): void {
      log.notice(`Main thread received message from worker ${message.threadName}:${message.threadId}:${rs}\n${inspect(message, false, 2, true)}`);
    }

    await new Promise<void>((resolve, reject) => {
      worker = createESMWorker('NpmGlobalPrefix', './packages/thread/dist/workerGlobalPrefix.js', undefined, undefined, undefined, undefined, true);
      worker.stdout?.on('data', () => {});
      worker.stderr?.on('data', () => {});

      worker.on('message', messageHandler);
      workerName = 'NpmGlobalPrefix';
      workerId = worker.threadId;
      expect(worker).toBeDefined();
      expect(workerName).toBeDefined();
      expect(workerId).toBeGreaterThan(0);
      worker.on('online', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error}`);
        reject(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      expect(worker).toBeDefined();
      worker.on('exit', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error}`);
        reject(error);
      });
    });
  }, 10000);

  test('Run workerCheckUpdates as a worker thread', async () => {
    let worker: Worker;
    let workerName: string | null;
    let workerId: number;

    expect(existsSync('./packages/thread/dist/workerCheckUpdates.js')).toBe(true);

    function messageHandler(message: ParentPortMessage): void {
      log.notice(`Main thread received message from worker ${message.threadName}:${message.threadId}:${rs}\n${inspect(message, false, 2, true)}`);
    }

    await new Promise<void>((resolve, reject) => {
      worker = createESMWorker('CheckUpdates', './packages/thread/dist/workerCheckUpdates.js', undefined, undefined, undefined, undefined, true);
      worker.stdout?.on('data', () => {});
      worker.stderr?.on('data', () => {});
      worker.on('message', messageHandler);
      workerName = 'CheckUpdates';
      workerId = worker.threadId;
      expect(worker).toBeDefined();
      expect(workerName).toBeDefined();
      expect(workerId).toBeGreaterThan(0);
      worker.on('online', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error}`);
        reject(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      expect(worker).toBeDefined();
      worker.on('exit', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error}`);
        reject(error);
      });
    });
  }, 10000);

  test('Run workerSystemCheck as a worker thread', async () => {
    let worker: Worker;
    let workerName: string | null;
    let workerId: number;

    expect(existsSync('./packages/thread/dist/workerSystemCheck.js')).toBe(true);

    function messageHandler(message: ParentPortMessage): void {
      log.notice(`Main thread received message from worker ${message.threadName}:${message.threadId}:${rs}\n${inspect(message, false, 2, true)}`);
    }

    await new Promise<void>((resolve, reject) => {
      worker = createESMWorker('SystemCheck', './packages/thread/dist/workerSystemCheck.js', undefined, undefined, undefined, undefined, true);
      worker.stdout?.on('data', () => {});
      worker.stderr?.on('data', () => {});
      worker.on('message', messageHandler);
      workerName = 'SystemCheck';
      workerId = worker.threadId;
      expect(worker).toBeDefined();
      expect(workerName).toBeDefined();
      expect(workerId).toBeGreaterThan(0);
      worker.on('online', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error}`);
        reject(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      expect(worker).toBeDefined();
      worker.on('exit', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error}`);
        reject(error);
      });
    });
  }, 10000);
});
