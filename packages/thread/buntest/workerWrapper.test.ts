import { afterEach, beforeEach, describe, expect, mock, spyOn, test, type Mock } from 'bun:test';
import {
  BroadcastChannel,
  getEnvironmentData,
  isMainThread,
  markAsUntransferable,
  MessageChannel,
  MessagePort,
  moveMessagePortToContext,
  parentPort,
  receiveMessageOnPort,
  setEnvironmentData,
  SHARE_ENV,
  threadId,
  Worker,
  workerData,
} from 'node:worker_threads';

import type { ThreadNames } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

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
  workerDataPresent?: boolean;
}>;

type SetupResult = Readonly<{
  WorkerWrapper: typeof import('../src/workerWrapper.js').WorkerWrapper;
  parentPort: MockedParentPort | null;
  getOnMessageHandler: () => ((message: any) => void) | undefined;
  hasParameterMock: Mock<(...args: any[]) => any>;
  serverRequest: Mock<(...args: any[]) => any>;
  serverClose: Mock<(...args: any[]) => any>;
  processExit: Mock<(...args: any[]) => any>;
  waitImmediate: () => Promise<void>;
}>;

type WorkerWrapperInternals = {
  handleUnhandledRejection(reason: unknown): void;
};

const workerThreadsActual = {
  BroadcastChannel,
  getEnvironmentData,
  isMainThread,
  markAsUntransferable,
  MessageChannel,
  MessagePort,
  moveMessagePortToContext,
  parentPort,
  receiveMessageOnPort,
  setEnvironmentData,
  SHARE_ENV,
  threadId,
  Worker,
  workerData,
};

const asyncTrue = async (): Promise<boolean> => await Promise.resolve(true);

describe('WorkerWrapper', () => {
  beforeEach(() => {
    // node-ansi-logger ultimately writes to console.*; keep tests quiet.
    spyOn(console, 'log').mockImplementation(() => {});
    spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    mock.restore();
    void mock.module('node:worker_threads', () => workerThreadsActual);
  });

  async function setup(options: SetupOptions): Promise<SetupResult> {
    mock.clearAllMocks();

    let onMessageHandler: ((message: any) => void) | undefined;

    const parentPort: MockedParentPort | null = options.parentPortPresent
      ? {
          postMessage: mock<(...args: any[]) => any>(),
          on: mock<(...args: any[]) => any>((event: string, handler: (message: any) => void) => {
            if (event === 'message') onMessageHandler = handler;
          }),
          close: mock<(...args: any[]) => any>(),
        }
      : null;

    const serverClose = mock<(...args: any[]) => any>();
    const serverRequest = mock<(...args: any[]) => any>();
    const processExit = spyOn(process, 'exit').mockImplementation((() => {}) as any);

    const hasParameterMock = mock<(...args: any[]) => any>((parameter: string) => {
      if (parameter === 'debug') return options.debugParam ?? false;
      if (parameter === 'verbose') return options.verboseParam ?? false;
      if (parameter === 'debug-threads') return false;
      if (parameter === 'verbose-threads') return false;
      return false;
    });

    void mock.module('@matterbridge/utils/cli', () => ({
      hasParameter: hasParameterMock,
    }));

    void mock.module('node:worker_threads', () => {
      return {
        isMainThread: options.isMainThread,
        threadId: options.threadId,
        workerData: options.workerDataPresent === false ? null : { threadName: options.threadName },
        parentPort,
      };
    });

    void mock.module('../src/broadcastServer.js', () => ({
      BroadcastServer: class {
        request = serverRequest;
        close = serverClose;
        // eslint-disable-next-line @typescript-eslint/no-useless-constructor
        constructor() {}
      },
    }));

    void mock.module('../src/threadsManager.js', () => ({
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      ThreadsManager: class {
        static logLevel = LogLevel.DEBUG;
      },
    }));

    const { WorkerWrapper } = await import(`../src/workerWrapper.js?buntest=${Date.now()}-${Math.random()}`);
    const waitImmediate = async (): Promise<void> => await new Promise<void>((resolve) => setImmediate(resolve));

    return {
      WorkerWrapper,
      parentPort,
      getOnMessageHandler: (): ((message: any) => void) | undefined => onMessageHandler,
      hasParameterMock,
      serverRequest,
      serverClose,
      processExit: processExit as unknown as Mock<(...args: any[]) => any>,
      waitImmediate,
    };
  }

  test('worker thread: posts init, can log, closes server, posts exit', async () => {
    const { WorkerWrapper, parentPort, serverClose, processExit, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'ThreadA',
    });

    const callback = mock<(...args: any[]) => any>(async (worker: InstanceType<typeof WorkerWrapper>) => {
      await Promise.resolve();
      worker.logger(LogLevel.INFO, 'hello');
      return true;
    });

    new WorkerWrapper('MyWorker' as unknown as ThreadNames, callback);

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
    expect(processExit).toHaveBeenCalledWith(0);
  });

  test('worker thread: logs callback failures and exits with success false', async () => {
    const { WorkerWrapper, parentPort, serverClose, processExit, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 8,
      threadName: 'ThreadFail',
    });

    const callbackError = new Error('boom');
    const callback = mock<(...args: any[]) => any>(async () => {
      await Promise.resolve();
      throw callbackError;
    });

    const worker = new WorkerWrapper('FailWorker' as unknown as ThreadNames, callback);
    const errorSpy = spyOn(worker.log, 'error');

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
    expect(processExit).toHaveBeenCalledWith(1);
  });

  test('worker thread: handles unhandled rejections and exits with success false', async () => {
    const { WorkerWrapper, parentPort, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 13,
      threadName: 'ThreadUnhandled',
    });

    const callback = mock<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    new WorkerWrapper('UnhandledWorker' as unknown as ThreadNames, callback);
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
    const { WorkerWrapper, parentPort, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 14,
      threadName: 'ThreadUncaught',
    });

    const callback = mock<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    new WorkerWrapper('UncaughtWorker' as unknown as ThreadNames, callback);
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
    const { WorkerWrapper, parentPort, serverClose } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 15,
      threadName: 'ThreadReportFail',
    });

    const callback = mock<(...args: any[]) => any>(async () => await new Promise<boolean>(() => {}));

    const worker = new WorkerWrapper('ReportFailWorker' as unknown as ThreadNames, callback);
    const errorSpy = spyOn(worker.log, 'error');
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

    (worker as unknown as WorkerWrapperInternals).handleUnhandledRejection(new Error('already destroyed'));

    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('worker thread: responds to ping with pong', async () => {
    const { WorkerWrapper, parentPort, getOnMessageHandler } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 9,
      threadName: 'ThreadPing',
    });

    new WorkerWrapper('Pinger' as unknown as ThreadNames, asyncTrue);

    const onMessageHandler = getOnMessageHandler();
    expect(onMessageHandler).toBeDefined();
    onMessageHandler?.({ type: 'ping' });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = (parentPort!.postMessage as Mock<(...args: any[]) => any>).mock.calls.map((c: any[]) => c[0]);
    expect(sent).toContainEqual({ type: 'pong', threadId: 9, threadName: 'Pinger' });
  });

  test('worker thread (debug+verbose): handles pong and unknown message types', async () => {
    const { WorkerWrapper, parentPort, getOnMessageHandler, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 10,
      threadName: 'ThreadDbg',
      debugParam: true,
      verboseParam: true,
    });

    new WorkerWrapper('DbgWorker' as unknown as ThreadNames, asyncTrue);

    const onMessageHandler = getOnMessageHandler();
    expect(onMessageHandler).toBeDefined();
    onMessageHandler?.({ type: 'pong' });
    onMessageHandler?.({ type: 'something-else' } as any);

    await waitImmediate();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = (parentPort!.postMessage as Mock<(...args: any[]) => any>).mock.calls.map((c: any[]) => c[0]);
    expect(sent).toContainEqual(expect.objectContaining({ type: 'log', logLevel: LogLevel.DEBUG }));
    expect(sent).toContainEqual(expect.objectContaining({ type: 'log', logLevel: LogLevel.WARN }));
  });

  test('parentPost throws when parentPort missing', async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 1,
      threadName: 'NoPort',
    });

    const worker = new WorkerWrapper('NoPortWorker' as unknown as ThreadNames, asyncTrue);
    expect(() => worker.parentPost({ type: 'ping', threadId: 1, threadName: 'NoPort' } as any)).toThrow(/parentPort is not available/);
  });

  test('parentLog throws when parentPort missing', async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 2,
      threadName: 'NoPort',
    });

    const worker = new WorkerWrapper('NoPortWorker' as unknown as ThreadNames, asyncTrue);
    expect(() => worker.parentLog('X', LogLevel.INFO, 'msg')).toThrow(/parentPort is not available/);
  });

  test('worker thread: missing workerData skips init/exit and still closes server', async () => {
    const { WorkerWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 11,
      threadName: 'Ignored',
      workerDataPresent: false,
    });

    new WorkerWrapper('NoWorkerData' as unknown as ThreadNames, asyncTrue);
    parentPort?.postMessage.mockClear();
    await waitImmediate();

    // Without workerData, init/exit messages are not emitted.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect((parentPort!.postMessage as Mock<(...args: any[]) => any>).mock.calls.map((c: any[]) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'init' }));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect((parentPort!.postMessage as Mock<(...args: any[]) => any>).mock.calls.map((c: any[]) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'exit' }));
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('main thread: does not post init/exit but still runs callback and closes server', async () => {
    const { WorkerWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const callback = mock<(...args: any[]) => any>(asyncTrue);
    const worker = new WorkerWrapper('MainThreadWrapper' as unknown as ThreadNames, callback);
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
    const { WorkerWrapper } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const ansi = await import('node-ansi-logger');
    const createSpy = spyOn(ansi.AnsiLogger, 'create');
    const logSpy = mock<(...args: any[]) => any>();
    createSpy.mockReturnValue({ log: logSpy } as any);

    const callback = mock<(...args: any[]) => any>(async (worker: InstanceType<typeof WorkerWrapper>) => {
      await Promise.resolve();
      worker.logger(LogLevel.INFO, 'hi');
      return true;
    });

    const worker = new WorkerWrapper('MainThreadLogger' as unknown as ThreadNames, callback);
    await worker.callback(worker);

    expect(createSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(LogLevel.INFO, 'hi');
  });

  test('snackBar sends frontend request through the broadcast server', async () => {
    const { WorkerWrapper, serverRequest } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const wrapper = new WorkerWrapper('SnackBarWrapper' as unknown as ThreadNames, asyncTrue);
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
    const { WorkerWrapper } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 12,
      threadName: 'Ignored',
      workerDataPresent: false,
    });

    const wrapper = new WorkerWrapper('WorkerInfoActive' as unknown as ThreadNames, asyncTrue);
    const debug = mock<(...args: any[]) => any>();
    wrapper.logWorkerInfo({ debug } as any, false);

    expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Worker thread: /));
    expect(debug).toHaveBeenCalledWith('ParentPort: active');
  });

  test('logWorkerInfo covers argv/env branches (logEnv=true)', async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const originalArgv = process.argv;
    process.argv = ['node', 'script'];

    try {
      const wrapper = new WorkerWrapper('Info' as unknown as ThreadNames, asyncTrue);
      const debug = mock<(...args: any[]) => any>();
      wrapper.logWorkerInfo({ debug } as any, true);

      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Main thread: /));
      expect(debug).toHaveBeenCalledWith('ParentPort: not active');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^WorkerData: /));
      expect(debug).toHaveBeenCalledWith('Argv: none');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Env: /));
    } finally {
      process.argv = originalArgv;
    }
  });

  test('logWorkerInfo prints argv when extra args are present', async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const originalArgv = process.argv;
    process.argv = ['node', 'script', '--foo', 'bar'];

    try {
      const wrapper = new WorkerWrapper('InfoArgs' as unknown as ThreadNames, asyncTrue);
      const debug = mock<(...args: any[]) => any>();
      wrapper.logWorkerInfo({ debug } as any, false);

      expect(debug).toHaveBeenCalledWith('Argv: --foo bar');
    } finally {
      process.argv = originalArgv;
    }
  });

  test("logWorkerInfo prints 'WorkerData: none' when workerData is missing", async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
      workerDataPresent: false,
    });

    const wrapper = new WorkerWrapper('InfoNoData' as unknown as ThreadNames, asyncTrue);
    const debug = mock<(...args: any[]) => any>();
    wrapper.logWorkerInfo({ debug } as any, false);

    expect(debug).toHaveBeenCalledWith('WorkerData: none');
  });

  test('logWorkerInfo uses default logEnv=false when omitted', async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const wrapper = new WorkerWrapper('InfoDefaultArg' as unknown as ThreadNames, asyncTrue);
    const debug = mock<(...args: any[]) => any>();
    wrapper.logWorkerInfo({ debug } as any);

    expect(debug).toHaveBeenCalledWith('Env: not logged');
  });
});
