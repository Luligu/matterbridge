/**
 * @file packages/thread/vitest/threadsWrapper.test.ts
 * @description This file contains the tests for the ThreadsWrapper class.
 * @author Luca Liguori
 */

import { originalProcessArgv, setupTest } from '@matterbridge/test-utils/vitest/setup';
import type { ThreadNames, ThreadType } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';
import type { Mock } from 'vitest';

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
  ThreadsWrapper: typeof import('../src/threadsWrapper.js').ThreadsWrapper;
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

describe('ThreadsWrapper', () => {
  beforeEach(() => {
    // node-ansi-logger ultimately writes to console.*; keep tests quiet.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('@matterbridge/utils/tracker');
  });

  async function setup(options: SetupOptions): Promise<SetupResult> {
    vi.resetModules();

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

    const serverClose = vi.fn<(...args: any[]) => any>();
    const serverRequest = vi.fn<(...args: any[]) => any>();

    const hasParameterMock = vi.fn<(...args: any[]) => any>((parameter: string) => {
      if (parameter === 'debug') return options.debugParam ?? false;
      if (parameter === 'verbose') return options.verboseParam ?? false;
      if (parameter === 'tracker') return options.trackerParam ?? false;
      if (parameter === 'debug-threads') return false;
      if (parameter === 'verbose-threads') return false;
      return false;
    });

    vi.doMock('@matterbridge/utils/cli', () => ({
      hasParameter: hasParameterMock,
      hasAnyParameter: (...parameters: string[]): boolean => parameters.some((parameter) => hasParameterMock(parameter)),
    }));

    vi.doMock('node:worker_threads', async () => {
      const actual = await vi.importActual<any>('node:worker_threads');
      return {
        ...actual,
        isMainThread: options.isMainThread,
        threadId: options.threadId,
        workerData: options.workerDataPresent === false ? undefined : { threadName: options.threadName, type: options.type ?? 'worker' },
        parentPort,
      };
    });

    vi.doMock('../src/broadcastServer.js', () => ({
      BroadcastServer: class {
        request = serverRequest;
        close = serverClose;
        // oxlint-disable-next-line typescript/no-useless-constructor
        constructor() {}
      },
    }));

    vi.doMock('../src/threadsManager.js', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class
      ThreadsManager: class {
        static logLevel = LogLevel.DEBUG;
      },
    }));

    const { ThreadsWrapper } = await import('../src/threadsWrapper.js');
    const waitImmediate = async (): Promise<void> => await new Promise<void>((resolve) => setImmediate(resolve));

    return {
      ThreadsWrapper,
      parentPort,
      getOnMessageHandler: (): ((message: any) => void) | undefined => onMessageHandler,
      hasParameterMock,
      serverRequest,
      serverClose,
      waitImmediate,
    };
  }

  test('should keep a successful continuous thread alive and responsive until explicitly destroyed', async () => {
    const { ThreadsWrapper, parentPort, getOnMessageHandler, serverClose, waitImmediate } = await setup({
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
    expect(serverClose).toHaveBeenCalledOnce();
    expect(parentPort?.close).toHaveBeenCalledOnce();
  });

  test.each(['false', 'throw'] as const)('should destroy a continuous thread when startup fails (%s)', async (failure) => {
    const { ThreadsWrapper, parentPort, serverClose, waitImmediate } = await setup({
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
      expect(serverClose).toHaveBeenCalledOnce();
      expect(parentPort?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'exit', success: false }));
    } finally {
      worker.destroy(false);
    }
  });

  test('should enable debug and verbose logging in the main thread', async () => {
    const { ThreadsWrapper, serverClose } = await setup({
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
    expect(serverClose).toHaveBeenCalledOnce();
  });

  test.each([
    { debugParam: false, useTracker: true },
    { debugParam: true, useTracker: true },
    { debugParam: false, useTracker: false },
  ])('should initialize the Tracker with the current flags ($debugParam, $useTracker)', async ({ debugParam, useTracker }) => {
    const { ThreadsWrapper } = await setup({
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
    const Tracker = vi.fn(function () {
      return tracker;
    });
    vi.doMock('@matterbridge/utils/tracker', () => ({ Tracker }));

    const worker = new ThreadsWrapper('Backend', asyncTrue);
    // Flags can change while the asynchronous module import is pending.
    worker.useTracker = useTracker;
    try {
      await vi.dynamicImportSettled();
      expect(worker.useTracker).toBe(useTracker);
      expect(Tracker).toHaveBeenCalledExactlyOnceWith('ThreadBackend', debugParam || useTracker, false, useTracker);
      expect(worker.tracker).toBe(tracker);
      expect(start).toHaveBeenCalledOnce();
      expect(stop).not.toHaveBeenCalled();
    } finally {
      worker.destroy(true);
    }
    expect(stop).toHaveBeenCalledOnce();
  });

  test('should log an error and keep the worker responsive when the Tracker import fails', async () => {
    const { ThreadsWrapper, parentPort, getOnMessageHandler, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'Backend',
      type: 'thread',
      trackerParam: true,
    });
    const rejectTrackerImport = vi.fn(() => {
      throw new Error('Tracker module unavailable');
    });
    vi.doMock('@matterbridge/utils/tracker', rejectTrackerImport);

    const worker = new ThreadsWrapper('Backend', asyncTrue);
    try {
      await vi.dynamicImportSettled();
      expect(rejectTrackerImport).toHaveBeenCalledOnce();
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
    expect(serverClose).toHaveBeenCalledOnce();
  });

  test('worker thread: posts init, can log, closes server, posts exit', async () => {
    const { ThreadsWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'ThreadA',
    });

    const entrypoint = vi.fn<(...args: any[]) => any>(async (worker: InstanceType<typeof ThreadsWrapper>) => {
      await Promise.resolve();
      worker.logger(LogLevel.INFO, 'hello');
      return true;
    });

    new ThreadsWrapper('MyWorker' as unknown as ThreadNames, entrypoint);

    expect(parentPort?.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'init', threadId: 7, threadName: 'MyWorker', success: true }));

    await waitImmediate();

    expect(entrypoint).toHaveBeenCalledTimes(1);
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

  test('worker thread: logs entrypoint failures and exits with success false', async () => {
    const { ThreadsWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 8,
      threadName: 'ThreadFail',
    });

    const entrypointError = new Error('boom');
    const entrypoint = vi.fn<(...args: any[]) => any>(async () => {
      await Promise.resolve();
      throw entrypointError;
    });

    const worker = new ThreadsWrapper('FailWorker' as unknown as ThreadNames, entrypoint);
    const errorSpy = vi.spyOn(worker.log, 'error');

    await waitImmediate();

    expect(entrypoint).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [loggedMessage] = errorSpy.mock.calls[0] as [string];
    expect(loggedMessage).toContain('Worker FailWorker entrypoint failed:');
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
    const { ThreadsWrapper, parentPort, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 13,
      threadName: 'ThreadUnhandled',
    });

    const entrypoint = vi.fn<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    new ThreadsWrapper('UnhandledWorker' as unknown as ThreadNames, entrypoint);
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
    const { ThreadsWrapper, parentPort, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 14,
      threadName: 'ThreadUncaught',
    });

    const entrypoint = vi.fn<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    new ThreadsWrapper('UncaughtWorker' as unknown as ThreadNames, entrypoint);
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
    const { ThreadsWrapper, parentPort, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 15,
      threadName: 'ThreadReportFail',
    });

    const entrypoint = vi.fn<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    const worker = new ThreadsWrapper('ReportFailWorker' as unknown as ThreadNames, entrypoint);
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
    const { ThreadsWrapper, parentPort, getOnMessageHandler } = await setup({
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
    const sent = (parentPort!.postMessage as Mock).mock.calls.map((c) => c[0]);
    expect(sent).toContainEqual({ type: 'pong', threadId: 9, threadName: 'Pinger' });
  });

  test('should emit startup and shutdown when the parent sends the matching message', async () => {
    const { ThreadsWrapper, getOnMessageHandler } = await setup({ isMainThread: false, parentPortPresent: true, threadId: 10, threadName: 'ThreadLifecycle' });

    const worker = new ThreadsWrapper('Lifecycle' as unknown as ThreadNames, asyncTrue);
    const onStartup = vi.fn<() => void>();
    const onShutdown = vi.fn<() => void>();
    worker.on('startup', onStartup);
    worker.on('shutdown', onShutdown);

    getOnMessageHandler()?.({ type: 'startup' });
    // The events are emitted on the next setImmediate, after the entrypoint has registered its listeners
    expect(onStartup).not.toHaveBeenCalled();
    await new Promise((resolve) => setImmediate(resolve));
    expect(onStartup).toHaveBeenCalledTimes(1);
    expect(onShutdown).not.toHaveBeenCalled();

    getOnMessageHandler()?.({ type: 'shutdown' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(onStartup).toHaveBeenCalledTimes(1);
  });

  test('worker thread (debug+verbose): warns on unknown message types, pong included', async () => {
    const { ThreadsWrapper, parentPort, getOnMessageHandler, waitImmediate } = await setup({
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
    const sent = (parentPort!.postMessage as Mock).mock.calls.map((c) => c[0]);
    // The manager never sends pong to a worker, so it is handled as an unknown message type
    expect(sent.filter((m) => m.type === 'log' && m.logLevel === LogLevel.WARN && String(m.message).includes('unknown message type'))).toHaveLength(2);
  });

  test('parentPost throws when parentPort missing', async () => {
    const { ThreadsWrapper } = await setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 1,
      threadName: 'NoPort',
    });

    const worker = new ThreadsWrapper('NoPortWorker' as unknown as ThreadNames, asyncTrue);
    expect(() => worker.parentPost({ type: 'ping', threadId: 1, threadName: 'NoPort' } as any)).toThrow(/parentPort is not available/);
  });

  test('parentLog throws when parentPort missing', async () => {
    const { ThreadsWrapper } = await setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 2,
      threadName: 'NoPort',
    });

    const worker = new ThreadsWrapper('NoPortWorker' as unknown as ThreadNames, asyncTrue);
    expect(() => worker.parentLog('X', LogLevel.INFO, 'msg')).toThrow(/parentPort is not available/);
  });

  test('worker thread: missing workerData skips init/exit and still closes server', async () => {
    const { ThreadsWrapper, parentPort, serverClose, waitImmediate } = await setup({
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
    expect((parentPort!.postMessage as Mock).mock.calls.map((c) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'init' }));
    // oxlint-disable-next-line typescript/no-non-null-assertion
    expect((parentPort!.postMessage as Mock).mock.calls.map((c) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'exit' }));
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('main thread: does not post init/exit but still runs entrypoint and closes server', async () => {
    const { ThreadsWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const entrypoint = vi.fn<(...args: any[]) => any>(asyncTrue);
    const worker = new ThreadsWrapper('MainThreadWrapper' as unknown as ThreadNames, entrypoint);
    expect(parentPort).toBeNull();

    await waitImmediate();

    expect(entrypoint).toHaveBeenCalledTimes(0);
    expect(serverClose).toHaveBeenCalledTimes(0);

    const success = await worker.entrypoint(worker);
    worker.destroy(success);

    expect(entrypoint).toHaveBeenCalledTimes(1);
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('main thread: logger uses AnsiLogger.create path', async () => {
    const { ThreadsWrapper } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const ansi = await import('node-ansi-logger');
    const createSpy = vi.spyOn(ansi.AnsiLogger, 'create');
    const logSpy = vi.fn<(...args: any[]) => any>();
    createSpy.mockReturnValue({ log: logSpy } as any);

    const entrypoint = vi.fn<(...args: any[]) => any>(async (worker: InstanceType<typeof ThreadsWrapper>) => {
      await Promise.resolve();
      worker.logger(LogLevel.INFO, 'hi');
      return true;
    });

    const worker = new ThreadsWrapper('MainThreadLogger' as unknown as ThreadNames, entrypoint);
    await worker.entrypoint(worker);

    expect(createSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(LogLevel.INFO, 'hi');
  });

  test('snackBar sends frontend request through the broadcast server', async () => {
    const { ThreadsWrapper, serverRequest } = await setup({
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
    const { ThreadsWrapper } = await setup({
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
    const { ThreadsWrapper } = await setup({
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
    const { ThreadsWrapper } = await setup({
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
    const { ThreadsWrapper } = await setup({
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
    const { ThreadsWrapper } = await setup({
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
