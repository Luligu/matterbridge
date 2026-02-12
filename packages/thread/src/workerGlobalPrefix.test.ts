import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  debugParam: boolean;
  verboseParam: boolean;
  debugWorkerParam?: boolean;
  verboseWorkerParam?: boolean;
  isMainThread?: boolean;
  parentPortPresent?: boolean;
  globalPrefix?: string;
  getGlobalThrows?: boolean;
}>;

async function runWorkerGlobalPrefix(options: RunOptions) {
  jest.resetModules();

  const parentPost = jest.fn();
  const parentLog = jest.fn();
  const threadLogger = jest.fn();
  const logWorkerInfo = jest.fn();

  const requestMock = jest.fn();
  const closeMock = jest.fn();

  const getGlobalNodeModules = options.getGlobalThrows
    ? jest.fn(async () => {
        throw new Error('getGlobalNodeModules failed');
      })
    : jest.fn(async () => options.globalPrefix ?? '/usr/local/lib/node_modules');

  const hasParameter = jest.fn((parameter: string) => {
    if (parameter === 'debug') return options.debugParam;
    if (parameter === 'verbose') return options.verboseParam;
    if (parameter === 'debug-worker') return options.debugWorkerParam ?? false;
    if (parameter === 'verbose-worker') return options.verboseWorkerParam ?? false;
    return false;
  });

  const inspectError = jest.fn(() => 'inspected error');

  const isMainThread = options.isMainThread ?? false;
  const parentPort = (options.parentPortPresent ?? true) ? {} : null;

  jest.unstable_mockModule('node:worker_threads', () => ({
    threadId: 1,
    isMainThread,
    parentPort,
    workerData: { threadName: 'GlobalPrefix' },
  }));

  jest.unstable_mockModule('@matterbridge/utils', () => ({
    getGlobalNodeModules,
    hasParameter,
    inspectError,
  }));

  jest.unstable_mockModule('./worker.js', () => ({
    logWorkerInfo,
    parentLog,
    parentPost,
    threadLogger,
  }));

  jest.unstable_mockModule('./broadcastServer.js', () => ({
    BroadcastServer: class {
      public request = requestMock;
      public close = closeMock;
      // eslint-disable-next-line @typescript-eslint/no-useless-constructor
      constructor() {}
    },
  }));

  await import('./workerGlobalPrefix.js');

  return {
    parentPost,
    parentLog,
    threadLogger,
    logWorkerInfo,
    requestMock,
    closeMock,
    getGlobalNodeModules,
    hasParameter,
    inspectError,
  };
}

describe('workerGlobalPrefix', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: debug via --debug (init/exit + request + close)', async () => {
    const { parentPost, parentLog, threadLogger, requestMock, closeMock, getGlobalNodeModules, hasParameter } = await runWorkerGlobalPrefix({
      debugParam: true,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      globalPrefix: '/custom/prefix',
    });

    expect(hasParameter).toHaveBeenCalledWith('debug');
    expect(getGlobalNodeModules).toHaveBeenCalledTimes(1);

    expect(parentPost).toHaveBeenCalledWith({ type: 'init', threadId: 1, threadName: 'GlobalPrefix', success: true });
    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'GlobalPrefix', success: true });

    expect(parentLog).toHaveBeenCalledWith('MatterbridgeGlobalPrefix', LogLevel.INFO, expect.stringMatching(/initialized/));
    expect(parentLog).toHaveBeenCalledWith('MatterbridgeGlobalPrefix', LogLevel.INFO, expect.stringMatching(/exiting with success: true/));

    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeGlobalPrefix', LogLevel.INFO, 'Starting global prefix check...');
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeGlobalPrefix', LogLevel.INFO, 'Global node_modules directory: /custom/prefix');

    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_global_prefix',
      src: 'matterbridge',
      dst: 'matterbridge',
      params: { prefix: '/custom/prefix' },
    });

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test('success: debug via --verbose (2nd OR operand) + verbose logs worker info', async () => {
    const { logWorkerInfo, hasParameter, parentLog } = await runWorkerGlobalPrefix({
      debugParam: false,
      verboseParam: true,
      debugWorkerParam: false,
      verboseWorkerParam: false,
    });

    expect(hasParameter).toHaveBeenCalledWith('debug');
    expect(hasParameter).toHaveBeenCalledWith('verbose');
    expect(logWorkerInfo).toHaveBeenCalledWith(expect.anything(), true);
    expect(parentLog).toHaveBeenCalled();
  });

  test('success: debug via --debug-worker (3rd OR operand)', async () => {
    const { hasParameter, parentLog } = await runWorkerGlobalPrefix({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: true,
      verboseWorkerParam: false,
    });

    expect(hasParameter).toHaveBeenCalledWith('debug-worker');
    expect(parentLog).toHaveBeenCalled();
  });

  test('success: debug via --verbose-worker (4th OR operand) + verbose-worker logs worker info', async () => {
    const { hasParameter, logWorkerInfo, parentLog } = await runWorkerGlobalPrefix({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: true,
    });

    expect(hasParameter).toHaveBeenCalledWith('verbose-worker');
    expect(logWorkerInfo).toHaveBeenCalledWith(expect.anything(), true);
    expect(parentLog).toHaveBeenCalled();
  });

  test('error: getGlobalNodeModules throws -> inspected error logged and exit success false', async () => {
    const { inspectError, threadLogger, parentPost, requestMock, closeMock, parentLog } = await runWorkerGlobalPrefix({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      getGlobalThrows: true,
    });

    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to get global node modules', expect.any(Error));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeGlobalPrefix', LogLevel.ERROR, 'inspected error');

    expect(requestMock).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);

    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'GlobalPrefix', success: false });
    expect(parentLog).not.toHaveBeenCalled();
  });

  test('main thread / no parentPort: does not post init/exit', async () => {
    const { parentPost, parentLog, closeMock } = await runWorkerGlobalPrefix({
      debugParam: false,
      verboseParam: false,
      isMainThread: true,
      parentPortPresent: false,
    });

    expect(parentPost).not.toHaveBeenCalled();
    expect(parentLog).not.toHaveBeenCalled();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
