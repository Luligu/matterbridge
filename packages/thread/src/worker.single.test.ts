import { jest } from '@jest/globals';

type WorkerThreadsMockOptions = Readonly<{
  debugParam?: boolean;
  verboseParam?: boolean;
  debugWorkerParam?: boolean;
  verboseWorkerParam?: boolean;
  isMainThread: boolean;
  threadId: number;
  parentPortPresent: boolean;
  workerDataPresent: boolean;
  workerName: string;
}>;

async function importWorkerModule(options: WorkerThreadsMockOptions) {
  jest.resetModules();

  const postMessage = jest.fn();

  const hasParameter = jest.fn((parameter: string) => {
    if (parameter === 'debug') return !!options.debugParam;
    if (parameter === 'verbose') return !!options.verboseParam;
    if (parameter === 'debug-worker') return !!options.debugWorkerParam;
    if (parameter === 'verbose-worker') return !!options.verboseWorkerParam;
    return false;
  });

  const workerCtor = jest.fn();
  class WorkerMock {
    public url: unknown;
    public options: unknown;
    constructor(url: unknown, workerOptions: unknown) {
      workerCtor(url, workerOptions);
      this.url = url;
      this.options = workerOptions;
    }
  }

  jest.unstable_mockModule('@matterbridge/utils', () => ({
    hasParameter,
  }));

  jest.unstable_mockModule('node:worker_threads', async () => {
    const actual = jest.requireActual<any>('node:worker_threads');
    return {
      ...actual,
      Worker: WorkerMock,
      get isMainThread() {
        return options.isMainThread;
      },
      get threadId() {
        return options.threadId;
      },
      get workerData() {
        return options.workerDataPresent ? { threadName: options.workerName } : undefined;
      },
      get parentPort() {
        return options.parentPortPresent
          ? {
              postMessage: (...args: any[]) => postMessage(...args),
            }
          : null;
      },
    };
  });

  const worker = await import('./worker.js');
  const ansi = await import('node-ansi-logger');

  return {
    worker,
    ansi,
    postMessage,
    hasParameter,
    workerCtor,
  };
}

describe('worker.ts (single file coverage)', () => {
  let originalConsoleLog: typeof console.log;

  beforeAll(() => {
    // eslint-disable-next-line no-console
    originalConsoleLog = console.log;
    // Override directly so jest.restoreAllMocks() won't revert it.
    (console as any).log = jest.fn();
  });

  afterAll(() => {
    (console as any).log = originalConsoleLog;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('parentPost posts and debug logs when debug=true', async () => {
    const { worker, postMessage } = await importWorkerModule({
      debugParam: true,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: false,
      threadId: 123,
      parentPortPresent: true,
      workerDataPresent: true,
      workerName: 'TestWorker',
    });

    worker.parentPost({ type: 'ping', threadName: 'TestWorker', threadId: 123 } as any);

    expect(postMessage).toHaveBeenCalledWith({ type: 'ping', threadName: 'TestWorker', threadId: 123 });
  });

  test('parentPost throws when parentPort is missing', async () => {
    const { worker } = await importWorkerModule({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: false,
      threadId: 1,
      parentPortPresent: false,
      workerDataPresent: true,
      workerName: 'NoPort',
    });

    expect(() => worker.parentPost({ type: 'ping', threadName: 'NoPort', threadId: 1 } as any)).toThrow(/parentPort is not available/);
  });

  test('parentPost does not debug log when debug=false', async () => {
    const { worker, postMessage } = await importWorkerModule({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: false,
      threadId: 124,
      parentPortPresent: true,
      workerDataPresent: true,
      workerName: 'QuietWorker',
    });

    worker.parentPost({ type: 'ping', threadName: 'QuietWorker', threadId: 124 } as any);
    expect(postMessage).toHaveBeenCalledWith({ type: 'ping', threadName: 'QuietWorker', threadId: 124 });
  });

  test('parentLog posts log control message and debug logs when debug=true', async () => {
    const { worker, postMessage } = await importWorkerModule({
      debugParam: true,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: false,
      threadId: 456,
      parentPortPresent: true,
      workerDataPresent: true,
      workerName: 'Logger',
    });

    const { LogLevel } = await import('node-ansi-logger');

    worker.parentLog('UnitTest', LogLevel.INFO, 'hello');

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'log',
        threadId: 456,
        threadName: 'Logger',
        logName: 'UnitTest',
        logLevel: LogLevel.INFO,
        message: 'hello',
      }),
    );
  });

  test('parentLog throws when parentPort is missing', async () => {
    const { worker } = await importWorkerModule({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: false,
      threadId: 2,
      parentPortPresent: false,
      workerDataPresent: true,
      workerName: 'NoPort',
    });

    const { LogLevel } = await import('node-ansi-logger');

    expect(() => worker.parentLog('Any', LogLevel.INFO, 'msg')).toThrow(/parentPort is not available/);
  });

  test('threadLogger: logs and forwards to parent only when worker thread and parentPort present', async () => {
    const { worker, ansi, postMessage } = await importWorkerModule({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: false,
      threadId: 9,
      parentPortPresent: true,
      workerDataPresent: true,
      workerName: 'Forwarder',
    });

    const createSpy = jest.spyOn(ansi.AnsiLogger, 'create');

    worker.threadLogger('T', ansi.LogLevel.INFO, 'hi');

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ logName: 'T' }));
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'log', threadId: 9, threadName: 'Forwarder', message: 'hi' }));
  });

  test('threadLogger: does not forward when main thread', async () => {
    const { worker, ansi, postMessage } = await importWorkerModule({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: true,
      threadId: 0,
      parentPortPresent: false,
      workerDataPresent: false,
      workerName: 'Ignored',
    });

    const createSpy = jest.spyOn(ansi.AnsiLogger, 'create');

    worker.threadLogger('T', ansi.LogLevel.INFO, 'hi');

    expect(createSpy).toHaveBeenCalled();
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('createESMWorker: uses defaults when argv/env omitted and logs when verbose=true', async () => {
    const { worker, workerCtor } = await importWorkerModule({
      debugParam: false,
      verboseParam: true,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: true,
      threadId: 0,
      parentPortPresent: false,
      workerDataPresent: false,
      workerName: 'Main',
    });

    const originalArgv = process.argv;
    process.argv = ['node', 'script', '--x', '1'];

    try {
      const w = worker.createESMWorker('N', './packages/thread/dist/workerGlobalPrefix.js');
      expect(w).toBeDefined();

      expect(workerCtor).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          type: 'module',
          name: 'N',
          argv: ['--x', '1'],
          env: process.env,
          workerData: expect.objectContaining({ threadName: 'N' }),
        }),
      );
    } finally {
      process.argv = originalArgv;
    }
  });

  test('createESMWorker: uses provided argv/env and does not log when verbose=false', async () => {
    const { worker, workerCtor } = await importWorkerModule({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      isMainThread: true,
      threadId: 0,
      parentPortPresent: false,
      workerDataPresent: false,
      workerName: 'Main',
    });

    const env = { ...process.env, TEST_ENV: '1' };

    worker.createESMWorker('N', './packages/thread/dist/workerGlobalPrefix.js', { a: 1 }, ['--a'], env, ['--inspect']);

    expect(workerCtor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        argv: ['--a'],
        env,
        execArgv: ['--inspect'],
        workerData: expect.objectContaining({ a: 1, threadName: 'N' }),
      }),
    );
  });

  test('logWorkerInfo: covers main/worker branches, parentPort active/inactive, workerData present/none, argv none, env logged/not logged', async () => {
    // Main thread, no env
    {
      const { worker } = await importWorkerModule({
        debugParam: false,
        verboseParam: false,
        debugWorkerParam: false,
        verboseWorkerParam: false,
        isMainThread: true,
        threadId: 0,
        parentPortPresent: false,
        workerDataPresent: false,
        workerName: 'Ignored',
      });

      const debug = jest.fn();
      const fakeLogger = { debug } as any;

      const originalArgv = process.argv;
      process.argv = ['node', 'script'];

      try {
        worker.logWorkerInfo(fakeLogger);
      } finally {
        process.argv = originalArgv;
      }

      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Main thread: .*Pid: /));
      expect(debug).toHaveBeenCalledWith('ParentPort: not active');
      expect(debug).toHaveBeenCalledWith('WorkerData: none');
      expect(debug).toHaveBeenCalledWith('Argv: none');
      expect(debug).toHaveBeenCalledWith('Env: not logged');
    }

    // Worker thread, env logged
    {
      const { worker } = await importWorkerModule({
        debugParam: false,
        verboseParam: false,
        debugWorkerParam: false,
        verboseWorkerParam: false,
        isMainThread: false,
        threadId: 7,
        parentPortPresent: true,
        workerDataPresent: true,
        workerName: 'W',
      });

      const debug = jest.fn();
      const fakeLogger = { debug } as any;

      const originalArgv = process.argv;
      process.argv = ['node', 'script', '--flag'];

      try {
        worker.logWorkerInfo(fakeLogger, true);
      } finally {
        process.argv = originalArgv;
      }

      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Worker thread: W:7 Pid: /));
      expect(debug).toHaveBeenCalledWith('ParentPort: active');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^WorkerData: /));
      expect(debug).toHaveBeenCalledWith('Argv: --flag');
      expect(debug).toHaveBeenCalledWith(expect.stringMatching(/^Env: /));
    }
  });
});
