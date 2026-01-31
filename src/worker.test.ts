// src\worker.test.ts

const NAME = 'Workers';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import type { Worker } from 'node:worker_threads';
import { inspect } from 'node:util';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, rs, TimestampFormat } from 'node-ansi-logger';

import { setupTest } from './jestutils/jestHelpers.js';
import { createESMWorker } from './worker.js';
import type { ParentPortMessage } from './workerTypes.js';
import { BroadcastServer } from './broadcastServer.js';
import { WorkerMessage } from './broadcastServerTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Workers', () => {
  const log = new AnsiLogger({ logName: 'MatterbridgeWorkers', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  // Broadcast servers
  const serverMatterbridge = new BroadcastServer('matterbridge', log);
  serverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
    if (serverMatterbridge.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
      serverMatterbridge.respond({ ...msg, result: { data: { matterbridgeVersion: '1.0.0', logLevel: LogLevel.ERROR } as any, success: true } });
    }
  });
  const serverPlugins = new BroadcastServer('plugins', log);
  serverPlugins.on('broadcast_message', (msg: WorkerMessage) => {
    if (serverPlugins.isWorkerRequest(msg) && msg.type === 'plugins_apipluginarray') {
      serverPlugins.respond({ ...msg, result: { plugins: [] } });
    }
  });

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Close broadcast servers
    serverMatterbridge.close();
    serverPlugins.close();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Run workerGlobalPrefix as a worker thread', async () => {
    let worker: Worker;
    let workerName: string | null;
    let workerId: number;

    function messageHandler(message: ParentPortMessage): void {
      log.notice(`Main thread received message from worker ${message.threadName}:${message.threadId}:${rs}\n${inspect(message, false, 2, true)}`);
    }

    await new Promise<void>((resolve, reject) => {
      worker = createESMWorker('NpmGlobalPrefix', './dist/workerGlobalPrefix.js');
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

    function messageHandler(message: ParentPortMessage): void {
      log.notice(`Main thread received message from worker ${message.threadName}:${message.threadId}:${rs}\n${inspect(message, false, 2, true)}`);
    }

    await new Promise<void>((resolve, reject) => {
      worker = createESMWorker('CheckUpdates', './dist/workerCheckUpdates.js');
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
});
