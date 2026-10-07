/**
 * @file packages/thread/buntest/threadsWrapper.test.ts
 * @description This file contains the tests for the ThreadsWrapper class.
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, type Mock, spyOn, test, vi } from 'bun:test';
// oxlint-disable-next-line import/no-namespace
import * as workerThreads from 'node:worker_threads';

import { flushAsync } from '@matterbridge/test-utils';
import { originalProcessArgv, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import type { ThreadNames, ThreadType } from '@matterbridge/types';
// oxlint-disable-next-line import/no-namespace
import * as cli from '@matterbridge/utils/cli';
// oxlint-disable-next-line import/no-namespace
import * as trackerModule from '@matterbridge/utils/tracker';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { BroadcastServer } from '../src/broadcastServer.js';
import { ThreadsWrapper } from '../src/threadsWrapper.js';

// Copy of the real exports, used to put node:worker_threads back after each test replaces its thread bindings.
const actualWorkerThreads = { ...workerThreads };

// Setup the test environment
await setupTest('ThreadsWrapper', false);

type MockedParentPort = {
  postMessage: Mock<(...args: any[]) => any>;
  on: Mock<(...args: any[]) => any>;
  close: Mock<(...args: any[]) => any>;
};

type SetupOptions = Readonly<{
  isMainThread: boolean;
  threadId: number;
  threadName: string;
  parentPortPresent: boolean;
  debugParam?: boolean;
  verboseParam?: boolean;
  trackerParam?: boolean;
  workerDataPresent?: boolean;
  type?: ThreadType;
}>;

type SetupResult = Readonly<{
  parentPort: MockedParentPort | null;
  getOnMessageHandler: () => ((message: any) => void) | undefined;
  hasParameterMock: Mock<(...args: any[]) => any>;
  serverRequest: Mock<(...args: any[]) => any>;
  serverClose: Mock<(...args: any[]) => any>;
  waitImmediate: () => Promise<void>;
}>;

type ThreadsWrapperInternals = {
  handleUnhandledRejection(reason: unknown): void;
};

const asyncTrue = async (): Promise<boolean> => await Promise.resolve(true);

/**
 * Lets the dynamic Tracker import started by the ThreadsWrapper constructor settle (bun has no vi.dynamicImportSettled).
 *
 * @returns {Promise<void>} Resolves after the pending immediates and microtasks have run.
 */
const settleImports = async (): Promise<void> => await flushAsync(3, 10, 0);

describe('ThreadsWrapper', () => {
  beforeEach(() => {
    // node-ansi-logger ultimately writes to console.*; keep tests quiet.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Bun shares one module instance across tests, so let worker startups scheduled with setImmediate finish
    // while this test's node:worker_threads bindings are still in place.
    await new Promise<void>((resolve) => setImmediate(resolve));
    vi.restoreAllMocks();
    void vi.mock('node:worker_threads', () => actualWorkerThreads);
  });

  afterAll(() => {
    resetTest();
  });

  function setup(options: SetupOptions): SetupResult {
    let onMessageHandler: ((message: any) => void) | undefined;

    const parentPort: MockedParentPort | null = options.parentPortPresent
      ? {
          postMessage: vi.fn<(...args: any[]) => any>(),
          on: vi.fn<(...args: any[]) => any>((event: string, handler: (message: any) => void) => {
            if (event === 'message') onMessageHandler = handler;
          }),
          close: vi.fn<(...args: any[]) => any>(),
        }
      : null;

    // The real BroadcastServer is created, so close still releases its channel; request never reaches other threads.
    const serverClose = spyOn(BroadcastServer.prototype, 'close') as Mock<(...args: any[]) => any>;
    const serverRequest = spyOn(BroadcastServer.prototype, 'request').mockImplementation(() => {}) as Mock<(...args: any[]) => any>;

    const hasParameterMock = vi.fn<(...args: any[]) => any>((parameter: string) => {
      if (parameter === 'debug') return options.debugParam ?? false;
      if (parameter === 'verbose') return options.verboseParam ?? false;
      if (parameter === 'tracker') return options.trackerParam ?? false;
      if (parameter === 'debug-threads') return false;
      if (parameter === 'verbose-threads') return false;
      return false;
    });
    spyOn(cli, 'hasAnyParameter').mockImplementation((...parameters: string[]): boolean => parameters.some((parameter) => hasParameterMock(parameter)));

    // Bun updates the live bindings already imported by threadsWrapper.ts, so no module reset is needed.
    void vi.mock('node:worker_threads', () => ({
      ...actualWorkerThreads,
      isMainThread: options.isMainThread,
      threadId: options.threadId,
      workerData: options.workerDataPresent === false ? undefined : { threadName: options.threadName, type: options.type ?? 'worker' },
      parentPort,
    }));

    const waitImmediate = async (): Promise<void> => await new Promise<void>((resolve) => setImmediate(resolve));

    return {
      parentPort,
      getOnMessageHandler: (): ((message: any) => void) | undefined => onMessageHandler,
      hasParameterMock,
      serverRequest,
      serverClose,
      waitImmediate,
    };
  }

  test('should keep a successful continuous thread alive and responsive until explicitly destroyed', async () => {
    const { parentPort, getOnMessageHandler, serverClose, waitImmediate } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'Backend',
      type: 'thread',
    });
    const worker = new ThreadsWrapper('Backend', asyncTrue);
    try {
      await waitImmediate();
      expect(serverClose).not.toHaveBeenCalled();
      expect(parentPort?.close).not.toHaveBeenCalled();
      expect(parentPort?.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'exit' }));
      getOnMessageHandler()?.({ type: 'ping' });
      expect(parentPort?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'pong' }));
    } finally {
      worker.destroy(true);
    }
    expect(serverClose).toHaveBeenCalledTimes(1);
    expect(parentPort?.close).toHaveBeenCalledTimes(1);
  });

  test.each(['false', 'throw'] as const)('should destroy a continuous thread when startup fails (%s)', async (failure) => {
    const { parentPort, serverClose, waitImmediate } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'Backend',
      type: 'thread',
    });
    const worker = new ThreadsWrapper('Backend', async () => {
      await Promise.resolve();
      if (failure === 'throw') throw new Error('Startup failed');
      return false;
    });
    try {
      await waitImmediate();
      expect(serverClose).toHaveBeenCalledTimes(1);
      expect(parentPort?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'exit', success: false }));
    } finally {
      worker.destroy(false);
    }
  });

  test('should enable debug and verbose logging in the main thread', async () => {
    const { serverClose } = setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Backend',
      debugParam: true,
      verboseParam: true,
    });
    const worker = new ThreadsWrapper('Backend', asyncTrue);
    try {
      expect(worker.debug).toBe(true);
      expect(worker.verbose).toBe(true);
      expect(worker.useTracker).toBe(false);
      expect(worker.log.logLevel).toBe(LogLevel.DEBUG);
    } finally {
      worker.destroy(true);
    }
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test.each([
    { debugParam: false, useTracker: true },
    { debugParam: true, useTracker: true },
    { debugParam: false, useTracker: false },
  ])('should initialize the Tracker with the current flags ($debugParam, $useTracker)', async ({ debugParam, useTracker }) => {
    setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Backend',
      trackerParam: true,
      debugParam,
    });
    const start = vi.fn<() => void>();
    const stop = vi.fn<() => void>();
    const tracker = { start, stop };
    // Typed as a plain function so the partial tracker can be returned from the mocked constructor.
    const Tracker = (spyOn(trackerModule, 'Tracker') as unknown as Mock<(...args: unknown[]) => typeof tracker>).mockImplementation(function () {
      return tracker;
    });

    const worker = new ThreadsWrapper('Backend', asyncTrue);
    // Flags can change while the asynchronous module import is pending.
    worker.useTracker = useTracker;
    try {
      await settleImports();
      expect(worker.useTracker).toBe(useTracker);
      expect(Tracker).toHaveBeenCalledTimes(1);
      expect(Tracker).toHaveBeenCalledWith('ThreadBackend', debugParam || useTracker, false, useTracker);
      expect<object | undefined>(worker.tracker).toBe(tracker);
      expect(start).toHaveBeenCalledTimes(1);
      expect(stop).not.toHaveBeenCalled();
    } finally {
      worker.destroy(true);
    }
    expect(stop).toHaveBeenCalledTimes(1);
  });

  test('should log an error and keep the worker responsive when the Tracker import fails', async () => {
    const { parentPort, getOnMessageHandler, serverClose } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'Backend',
      type: 'thread',
      trackerParam: true,
    });
    // Bun cannot mock a module whose import rejects, so the Tracker constructor throws instead: it fails inside the same .then and reaches the same .catch.
    const rejectTrackerImport = (spyOn(trackerModule, 'Tracker') as unknown as Mock<() => never>).mockImplementation(() => {
      throw new Error('Tracker module unavailable');
    });

    const worker = new ThreadsWrapper('Backend', asyncTrue);
    try {
      await settleImports();
      expect(rejectTrackerImport).toHaveBeenCalledTimes(1);
      expect(worker.tracker).toBeUndefined();
      expect(parentPort?.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'log',
          logLevel: LogLevel.ERROR,
          message: expect.stringMatching(/^ThreadsWrapper Backend: failed to load Tracker .+/),
        }),
      );
      expect(serverClose).not.toHaveBeenCalled();
      getOnMessageHandler()?.({ type: 'ping' });
      expect(parentPort?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'pong' }));
    } finally {
      worker.destroy(true);
    }
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('worker thread: posts init, can log, closes server, posts exit', async () => {
    const { parentPort, serverClose, waitImmediate } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'ThreadA',
    });

    const callback = vi.fn<(...args: any[]) => any>(async (worker: ThreadsWrapper) => {
      await Promise.resolve();
      worker.logger(LogLevel.INFO, 'hello');
      return true;
    });

    new ThreadsWrapper('MyWorker' as unknown as ThreadNames, callback);

    expect(parentPort?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'init', threadId: 7, threadName: 'MyWorker', success: true }));

    await waitImmediate();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'log',
        threadId: 7,
        threadName: 'MyWorker',
        logName: 'MyWorker',
        logLevel: LogLevel.INFO,
        message: 'hello',
      }),
    );
    expect(serverClose).toHaveBeenCalledTimes(1);
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'exit',
        threadId: 7,
        threadName: 'MyWorker',
        success: true,
      }),
    );
    expect(parentPort?.close).toHaveBeenCalledTimes(1);
  });

  test('worker thread: logs callback failures and exits with success false', async () => {
    const { parentPort, serverClose, waitImmediate } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 8,
      threadName: 'ThreadFail',
    });

    const callbackError = new Error('boom');
    const callback = vi.fn<(...args: any[]) => any>(async () => {
      await Promise.resolve();
      throw callbackError;
    });

    const worker = new ThreadsWrapper('FailWorker' as unknown as ThreadNames, callback);
    const errorSpy = vi.spyOn(worker.log, 'error');

    await waitImmediate();

    expect(callback).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [loggedMessage] = errorSpy.mock.calls[0] as [string];
    expect(loggedMessage).toContain('Worker FailWorker callback failed:');
    expect(loggedMessage).toContain('boom');
    expect(serverClose).toHaveBeenCalledTimes(1);
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'exit',
        threadId: 8,
        threadName: 'FailWorker',
        success: false,
      }),
    );
    expect(parentPort?.close).toHaveBeenCalledTimes(1);
  });

  test('worker thread: handles unhandled rejections and exits with success false', async () => {
    const { parentPort, serverClose } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 13,
      threadName: 'ThreadUnhandled',
    });

    const callback = vi.fn<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    new ThreadsWrapper('UnhandledWorker' as unknown as ThreadNames, callback);
    process.emit('unhandledRejection', new Error('late rejection'), Promise.resolve());

    expect(serverClose).toHaveBeenCalledTimes(1);
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'log',
        threadId: 13,
        threadName: 'UnhandledWorker',
        logLevel: LogLevel.ERROR,
        message: expect.stringContaining('late rejection'),
      }),
    );
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'exit',
        threadId: 13,
        threadName: 'UnhandledWorker',
        success: false,
      }),
    );
    expect(parentPort?.close).toHaveBeenCalledTimes(1);
  });

  test('worker thread: handles uncaught exceptions and exits with success false', async () => {
    const { parentPort, serverClose } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 14,
      threadName: 'ThreadUncaught',
    });

    const callback = vi.fn<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    new ThreadsWrapper('UncaughtWorker' as unknown as ThreadNames, callback);
    process.emit('uncaughtException', new Error('late exception'), 'uncaughtException');

    expect(serverClose).toHaveBeenCalledTimes(1);
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'log',
        threadId: 14,
        threadName: 'UncaughtWorker',
        logLevel: LogLevel.ERROR,
        message: expect.stringContaining('late exception'),
      }),
    );
    expect(parentPort?.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'exit',
        threadId: 14,
        threadName: 'UncaughtWorker',
        success: false,
      }),
    );
    expect(parentPort?.close).toHaveBeenCalledTimes(1);
  });

  test('worker thread: handles failures while reporting unhandled rejections', async () => {
    const { parentPort, serverClose } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 15,
      threadName: 'ThreadReportFail',
    });

    const callback = vi.fn<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    const worker = new ThreadsWrapper('ReportFailWorker' as unknown as ThreadNames, callback);
    const errorSpy = vi.spyOn(worker.log, 'error');
    parentPort?.postMessage.mockImplementation(() => {
      throw new Error('port closed');
    });
    parentPort?.close.mockImplementation(() => {
      throw new Error('close failed');
    });
    process.emit('unhandledRejection', new Error('report failure'), Promise.resolve());

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to send error log to parent'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to send exit message to parent'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('failed to close parentPort'));
    expect(serverClose).toHaveBeenCalledTimes(1);

    (worker as unknown as ThreadsWrapperInternals).handleUnhandledRejection(new Error('already destroyed'));

    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('worker thread: responds to ping with pong', async () => {
    const { parentPort, getOnMessageHandler } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 9,
      threadName: 'ThreadPing',
    });

    new ThreadsWrapper('Pinger' as unknown as ThreadNames, asyncTrue);

    const onMessageHandler = getOnMessageHandler();
    expect(onMessageHandler).toBeDefined();
    onMessageHandler?.({ type: 'ping' });

    // oxlint-disable-next-line typescript/no-non-null-assertion
    const sent = parentPort!.postMessage.mock.calls.map((c) => c[0]);
    expect(sent).toContainEqual({ type: 'pong', threadId: 9, threadName: 'Pinger' });
  });

  test('worker thread (debug+verbose): handles pong and unknown message types', async () => {
    const { parentPort, getOnMessageHandler, waitImmediate } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 10,
      threadName: 'ThreadDbg',
      debugParam: true,
      verboseParam: true,
    });

    new ThreadsWrapper('DbgWorker' as unknown as ThreadNames, asyncTrue);

    const onMessageHandler = getOnMessageHandler();
    expect(onMessageHandler).toBeDefined();
    onMessageHandler?.({ type: 'pong' });
    onMessageHandler?.({ type: 'something-else' } as any);

    await waitImmediate();

    // oxlint-disable-next-line typescript/no-non-null-assertion
    const sent = parentPort!.postMessage.mock.calls.map((c) => c[0]);
    expect(sent).toContainEqual(expect.objectContaining({ type: 'log', logLevel: LogLevel.DEBUG }));
    expect(sent).toContainEqual(expect.objectContaining({ type: 'log', logLevel: LogLevel.WARN }));
  });

  test('parentPost throws when parentPort missing', async () => {
    setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 1,
      threadName: 'NoPort',
    });

    const worker = new ThreadsWrapper('NoPortWorker' as unknown as ThreadNames, asyncTrue);
    expect(() => worker.parentPost({ type: 'ping', threadId: 1, threadName: 'NoPort' } as any)).toThrow(/parentPort is not available/);
  });

  test('parentLog throws when parentPort missing', async () => {
    setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 2,
      threadName: 'NoPort',
    });

    const worker = new ThreadsWrapper('NoPortWorker' as unknown as ThreadNames, asyncTrue);
    expect(() => worker.parentLog('X', LogLevel.INFO, 'msg')).toThrow(/parentPort is not available/);
  });

  test('worker thread: missing workerData skips init/exit and still closes server', async () => {
    const { parentPort, serverClose, waitImmediate } = setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 11,
      threadName: 'Ignored',
      workerDataPresent: false,
    });

    new ThreadsWrapper('NoWorkerData' as unknown as ThreadNames, asyncTrue);
    await waitImmediate();

    // Without workerData, init/exit messages are not emitted.
    // oxlint-disable-next-line typescript/no-non-null-assertion
    expect(parentPort!.postMessage.mock.calls.map((c) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'init' }));
    // oxlint-disable-next-line typescript/no-non-null-assertion
    expect(parentPort!.postMessage.mock.calls.map((c) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'exit' }));
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('main thread: does not post init/exit but still runs callback and closes server', async () => {
    const { parentPort, serverClose, waitImmediate } = setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const callback = vi.fn<(...args: any[]) => any>(asyncTrue);
    const worker = new ThreadsWrapper('MainThreadWrapper' as unknown as ThreadNames, callback);
    expect(parentPort).toBeNull();

    await waitImmediate();

    expect(callback).toHaveBeenCalledTimes(0);
    expect(serverClose).toHaveBeenCalledTimes(0);

    const success = await worker.callback(worker);
    worker.destroy(success);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('main thread: logger uses AnsiLogger.create path', async () => {
    setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const createSpy = vi.spyOn(AnsiLogger, 'create');
    const logSpy = vi.fn<(...args: any[]) => any>();
    createSpy.mockReturnValue({ log: logSpy } as any);

    const callback = vi.fn<(...args: any[]) => any>(async (worker: ThreadsWrapper) => {
      await Promise.resolve();
      worker.logger(LogLevel.INFO, 'hi');
      return true;
    });

    const worker = new ThreadsWrapper('MainThreadLogger' as unknown as ThreadNames, callback);
    await worker.callback(worker);

    expect(createSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(LogLevel.INFO, 'hi');
  });

  test('snackBar sends frontend request through the broadcast server', async () => {
    const { serverRequest } = setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const wrapper = new ThreadsWrapper('SnackBarWrapper' as unknown as ThreadNames, asyncTrue);
    wrapper.snackBar('system issue', 0, 'error');

    expect(serverRequest).toHaveBeenCalledWith({
      type: 'frontend_snackbarmessage',
      src: 'matterbridge',
      dst: 'frontend',
      params: { message: 'system issue', timeout: 0, severity: 'error' },
    });

    wrapper.snackBar('default issue');

    expect(serverRequest).toHaveBeenCalledWith({
      type: 'frontend_snackbarmessage',
      src: 'matterbridge',
      dst: 'frontend',
      params: { message: 'default issue', timeout: 5, severity: 'info' },
    });
  });

  test('logWorkerInfo covers worker-thread and active parentPort branches', async () => {
    setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 12,
      threadName: 'Ignored',
      workerDataPresent: false,
    });

    const wrapper = new ThreadsWrapper('WorkerInfoActive' as unknown as ThreadNames, asyncTrue);
    const debug = vi.fn<(...args: any[]) => any>();
    wrapper.logWorkerInfo({ debug } as any, false);

    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Worker thread: /));
    expect(debug).toHaveBeenCalledWith('ParentPort: active');
  });

  test('logWorkerInfo covers argv/env branches (logEnv=true)', async () => {
    setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const savedArgv = process.argv;
    process.argv = originalProcessArgv.slice(0, 2);

    try {
      const wrapper = new ThreadsWrapper('Info' as unknown as ThreadNames, asyncTrue);
      const debug = vi.fn<(...args: any[]) => any>();
      wrapper.logWorkerInfo({ debug } as any, true);

      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Main thread: /));
      expect(debug).toHaveBeenCalledWith('ParentPort: not active');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^WorkerData: /));
      expect(debug).toHaveBeenCalledWith('Argv: none');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Env: /));
    } finally {
      process.argv = savedArgv;
    }
  });

  test('logWorkerInfo prints argv when extra args are present', async () => {
    setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const savedArgv = process.argv;
    process.argv = [...originalProcessArgv.slice(0, 2), '--foo', 'bar'];

    try {
      const wrapper = new ThreadsWrapper('InfoArgs' as unknown as ThreadNames, asyncTrue);
      const debug = vi.fn<(...args: any[]) => any>();
      wrapper.logWorkerInfo({ debug } as any, false);

      expect(debug).toHaveBeenCalledWith('Argv: --foo bar');
    } finally {
      process.argv = savedArgv;
    }
  });

  test("logWorkerInfo prints 'WorkerData: none' when workerData is missing", async () => {
    setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
      workerDataPresent: false,
    });

    const wrapper = new ThreadsWrapper('InfoNoData' as unknown as ThreadNames, asyncTrue);
    const debug = vi.fn<(...args: any[]) => any>();
    wrapper.logWorkerInfo({ debug } as any, false);

    expect(debug).toHaveBeenCalledWith('WorkerData: none');
  });

  test('logWorkerInfo uses default logEnv=false when omitted', async () => {
    setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const wrapper = new ThreadsWrapper('InfoDefaultArg' as unknown as ThreadNames, asyncTrue);
    const debug = vi.fn<(...args: any[]) => any>();
    wrapper.logWorkerInfo({ debug } as any);

    expect(debug).toHaveBeenCalledWith('Env: not logged');
  });
});
