import { jest } from '@jest/globals';
import { ThreadNames } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

type MockedParentPort = {
  postMessage: jest.MockedFunction<(...args: any[]) => any>;
  on: jest.MockedFunction<(...args: any[]) => any>;
  close: jest.MockedFunction<(...args: any[]) => any>;
};

describe('WorkerWrapper', () => {
  beforeEach(() => {
    // node-ansi-logger ultimately writes to console.*; keep tests quiet.
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function setup(options: {
    isMainThread: boolean;
    threadId: number;
    threadName: string;
    parentPortPresent: boolean;
    debugParam?: boolean;
    verboseParam?: boolean;
    workerDataPresent?: boolean;
  }) {
    jest.resetModules();

    let onMessageHandler: ((message: any) => void) | undefined;

    const parentPort: MockedParentPort | null = options.parentPortPresent
      ? {
          postMessage: jest.fn(),
          on: jest.fn((event: string, handler: (message: any) => void) => {
            if (event === 'message') onMessageHandler = handler;
          }),
          close: jest.fn(),
        }
      : null;

    const serverClose = jest.fn();
    const serverRequest = jest.fn();

    const hasParameterMock = jest.fn((parameter: string) => {
      if (parameter === 'debug') return options.debugParam ?? false;
      if (parameter === 'verbose') return options.verboseParam ?? false;
      if (parameter === 'debug-threads') return false;
      if (parameter === 'verbose-threads') return false;
      return false;
    });

    jest.unstable_mockModule('@matterbridge/utils/cli', () => ({
      hasParameter: hasParameterMock,
    }));

    jest.unstable_mockModule('node:worker_threads', async () => {
      const actual = jest.requireActual<any>('node:worker_threads');
      return {
        ...actual,
        isMainThread: options.isMainThread,
        threadId: options.threadId,
        workerData: options.workerDataPresent === false ? undefined : { threadName: options.threadName },
        parentPort,
      };
    });

    jest.unstable_mockModule('./broadcastServer.js', () => ({
      BroadcastServer: class {
        request = serverRequest;
        close = serverClose;
        // eslint-disable-next-line @typescript-eslint/no-useless-constructor
        constructor() {}
      },
    }));

    jest.unstable_mockModule('./threadsManager.js', () => ({
      // eslint-disable-next-line @typescript-eslint/no-extraneous-class
      ThreadsManager: class {
        static logLevel = LogLevel.DEBUG;
      },
    }));

    const { WorkerWrapper } = await import('./workerWrapper.js');
    const waitImmediate = () => new Promise<void>((resolve) => setImmediate(resolve));

    return {
      WorkerWrapper,
      parentPort,
      getOnMessageHandler: () => onMessageHandler,
      hasParameterMock,
      serverRequest,
      serverClose,
      waitImmediate,
    };
  }

  test('worker thread: posts init, can log, closes server, posts exit', async () => {
    const { WorkerWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 7,
      threadName: 'ThreadA',
    });

    const callback = jest.fn(async (worker: InstanceType<typeof WorkerWrapper>) => {
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
  });

  test('worker thread: logs callback failures and exits with success false', async () => {
    const { WorkerWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 8,
      threadName: 'ThreadFail',
    });

    const callbackError = new Error('boom');
    const callback = jest.fn(async () => {
      throw callbackError;
    });

    const worker = new WorkerWrapper('FailWorker' as unknown as ThreadNames, callback);
    const errorSpy = jest.spyOn(worker.log, 'error');

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

  test('worker thread: responds to ping with pong', async () => {
    const { WorkerWrapper, parentPort, getOnMessageHandler } = await setup({
      isMainThread: false,
      parentPortPresent: true,
      threadId: 9,
      threadName: 'ThreadPing',
    });

    new WorkerWrapper('Pinger' as unknown as ThreadNames, async () => true);

    const onMessageHandler = getOnMessageHandler();
    expect(onMessageHandler).toBeDefined();
    onMessageHandler?.({ type: 'ping' });

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = (parentPort!.postMessage as jest.Mock).mock.calls.map((c) => c[0]);
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

    new WorkerWrapper('DbgWorker' as unknown as ThreadNames, async () => true);

    const onMessageHandler = getOnMessageHandler();
    expect(onMessageHandler).toBeDefined();
    onMessageHandler?.({ type: 'pong' });
    onMessageHandler?.({ type: 'something-else' } as any);

    await waitImmediate();

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const sent = (parentPort!.postMessage as jest.Mock).mock.calls.map((c) => c[0]);
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

    const worker = new WorkerWrapper('NoPortWorker' as unknown as ThreadNames, async () => true);
    expect(() => worker.parentPost({ type: 'ping', threadId: 1, threadName: 'NoPort' } as any)).toThrow(/parentPort is not available/);
  });

  test('parentLog throws when parentPort missing', async () => {
    const { WorkerWrapper } = await setup({
      isMainThread: false,
      parentPortPresent: false,
      threadId: 2,
      threadName: 'NoPort',
    });

    const worker = new WorkerWrapper('NoPortWorker' as unknown as ThreadNames, async () => true);
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

    new WorkerWrapper('NoWorkerData' as unknown as ThreadNames, async () => true);
    await waitImmediate();

    // Without workerData, init/exit messages are not emitted.
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect((parentPort!.postMessage as jest.Mock).mock.calls.map((c) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'init' }));
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect((parentPort!.postMessage as jest.Mock).mock.calls.map((c) => c[0])).not.toContainEqual(expect.objectContaining({ type: 'exit' }));
    expect(serverClose).toHaveBeenCalledTimes(1);
  });

  test('main thread: does not post init/exit but still runs callback and closes server', async () => {
    const { WorkerWrapper, parentPort, serverClose, waitImmediate } = await setup({
      isMainThread: true,
      parentPortPresent: false,
      threadId: 0,
      threadName: 'Ignored',
    });

    const callback = jest.fn(async () => true);
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
    const createSpy = jest.spyOn(ansi.AnsiLogger, 'create');
    const logSpy = jest.fn();
    createSpy.mockReturnValue({ log: logSpy } as any);

    const callback = jest.fn(async (worker: InstanceType<typeof WorkerWrapper>) => {
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

    const wrapper = new WorkerWrapper('SnackBarWrapper' as unknown as ThreadNames, async () => true);
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

    const wrapper = new WorkerWrapper('WorkerInfoActive' as unknown as ThreadNames, async () => true);
    const debug = jest.fn();
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
      const wrapper = new WorkerWrapper('Info' as unknown as ThreadNames, async () => true);
      const debug = jest.fn();
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
      const wrapper = new WorkerWrapper('InfoArgs' as unknown as ThreadNames, async () => true);
      const debug = jest.fn();
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

    const wrapper = new WorkerWrapper('InfoNoData' as unknown as ThreadNames, async () => true);
    const debug = jest.fn();
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

    const wrapper = new WorkerWrapper('InfoDefaultArg' as unknown as ThreadNames, async () => true);
    const debug = jest.fn();
    wrapper.logWorkerInfo({ debug } as any);

    expect(debug).toHaveBeenCalledWith('Env: not logged');
  });
});
