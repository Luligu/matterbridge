// src\workers.test.ts

const NAME = 'Workers';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import type { Worker } from 'node:worker_threads';
import { inspect } from 'node:util';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, rs, TimestampFormat } from 'node-ansi-logger';

import { loggerDebugSpy, setupTest } from './jestutils/jestHelpers.js';
import { createESMWorker, logWorkerInfo } from './workers.js';
import type { ParentPortMessage } from './workerTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Workers', () => {
  const log = new AnsiLogger({ logName: 'MatterbridgeWorkers', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Run worker info in main thread', async () => {
    logWorkerInfo(log, true);
    expect(loggerDebugSpy).toHaveBeenCalled();
  });

  test('Run workerGlobalPrefix in the mainThread', async () => {
    // process.argv.push('--verbose');
    await import('./workerGlobalPrefix.js');
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/Global node_modules Directory:/));
    // process.argv.pop();
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
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error.message}`);
        reject(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      expect(worker).toBeDefined();
      worker.on('exit', resolve);
      worker.on('error', (error) => {
        log.error(`Worker thread ${workerName}:${workerId} encountered an error: ${error.message}`);
        reject(error);
      });
    });
  });
});
