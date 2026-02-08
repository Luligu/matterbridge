// src/worker.mock.test.ts
// Tests for worker without spawning real worker threads.

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import { WorkerMessage } from './broadcastServerTypes.js';

const postMessage = jest.fn();
let mockedThreadId = 0;
let mockedThreadName = 'TestWorker';
let mockedIsMainThread = false;
let mockedHasParentPort = true;
let mockedHasWorkerData = true;

jest.unstable_mockModule('node:worker_threads', async () => {
  const actual = jest.requireActual<any>('node:worker_threads');
  return {
    ...actual,
    get isMainThread() {
      return mockedIsMainThread;
    },
    get threadId() {
      return mockedThreadId;
    },
    get workerData() {
      return mockedHasWorkerData ? { threadName: mockedThreadName } : undefined;
    },
    get parentPort() {
      return mockedHasParentPort
        ? {
            postMessage: (...args: any[]) => postMessage(...args),
          }
        : null;
    },
  };
});

describe('worker parentPort (mocked)', () => {
  // Broadcast servers
  const log = new AnsiLogger({ logName: 'WorkerMockTest', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
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

  afterAll(() => {
    serverMatterbridge.close();
    serverPlugins.close();
  });

  test('parentPost posts message to mocked parentPort', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      postMessage.mockClear();
      mockedThreadId = 123;
      mockedThreadName = 'TestWorker';
      mockedIsMainThread = false;
      mockedHasParentPort = true;
      mockedHasWorkerData = true;

      const { parentPost } = await import('./worker.js');

      const message = { type: 'ping', threadName: 'TestWorker', threadId: 123 };
      parentPost(message as any);

      expect(postMessage).toHaveBeenCalledWith(message);
    });
  });

  test('parentLog posts a log control message to mocked parentPort', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      postMessage.mockClear();
      mockedThreadId = 456;
      mockedThreadName = 'TestWorker';
      mockedIsMainThread = false;
      mockedHasParentPort = true;
      mockedHasWorkerData = true;

      const { parentLog } = await import('./worker.js');
      const { LogLevel } = await import('node-ansi-logger');

      parentLog('UnitTest', LogLevel.INFO, 'hello');

      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'log',
          threadId: 456,
          threadName: 'TestWorker',
          logName: 'UnitTest',
          logLevel: LogLevel.INFO,
          message: 'hello',
        }),
      );
    });
  });

  test('logWorkerInfo logs main thread info without env', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      mockedThreadId = 0;
      mockedThreadName = 'Ignored';
      mockedIsMainThread = true;
      mockedHasParentPort = false;
      mockedHasWorkerData = false;

      const { logWorkerInfo } = await import('./worker.js');

      const debug = jest.fn();
      const fakeLogger = { debug } as any;

      logWorkerInfo(fakeLogger, false);

      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Main thread: .*Pid: /));
      expect(debug).toHaveBeenCalledWith('ParentPort: not active');
      expect(debug).toHaveBeenCalledWith('WorkerData: none');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Argv: /));
      expect(debug).toHaveBeenCalledWith('Env: not logged');
    });
  });

  test('logWorkerInfo logs worker thread info with env', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      mockedThreadId = 7;
      mockedThreadName = 'TestWorker';
      mockedIsMainThread = false;
      mockedHasParentPort = true;
      mockedHasWorkerData = true;

      const { logWorkerInfo } = await import('./worker.js');

      const debug = jest.fn();
      const fakeLogger = { debug } as any;

      logWorkerInfo(fakeLogger, true);

      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Worker thread: TestWorker:7 Pid: /));
      expect(debug).toHaveBeenCalledWith('ParentPort: active');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^WorkerData: /));
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Argv: /));
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Env: /));
      expect(debug).not.toHaveBeenCalledWith('Env: not logged');
    });
  });

  test('Run workerGlobalPrefix in the mainThread', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockedThreadId = 123;
      mockedThreadName = 'GlobalPrefixWorker';
      mockedIsMainThread = false;
      mockedHasParentPort = true;
      mockedHasWorkerData = true;

      process.argv.push('--verbose');
      await import('./workerGlobalPrefix.js');
      process.argv.pop();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/Global node_modules Directory:/));

      consoleLogSpy.mockRestore();
    });
  }, 10000);

  test('Run workerCheckUpdates in the mainThread', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      mockedThreadId = 456;
      mockedThreadName = 'CheckUpdatesWorker';
      mockedIsMainThread = false;
      mockedHasParentPort = true;
      mockedHasWorkerData = true;

      process.argv.push('--verbose');
      await import('./workerCheckUpdates.js');
      process.argv.pop();

      expect(consoleLogSpy).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/Check updates succeeded/));

      consoleLogSpy.mockRestore();
    });
  }, 10000);
});
