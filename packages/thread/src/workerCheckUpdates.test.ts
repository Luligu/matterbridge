import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  debugParam: boolean;
  verboseParam: boolean;
  debugWorkerParam?: boolean;
  verboseWorkerParam?: boolean;
  isMainThread?: boolean;
  parentPortPresent?: boolean;
  fetchThrows?: boolean;
  checkUpdatesThrows?: boolean;
}>;

async function runWorkerCheckUpdates(options: RunOptions) {
  jest.resetModules();

  const parentPost = jest.fn();
  const parentLog = jest.fn();
  const threadLogger = jest.fn();
  const logWorkerInfo = jest.fn();

  const fetchMock = options.fetchThrows
    ? jest.fn(async () => {
        throw new Error('fetch failed');
      })
    : jest.fn(async () => ({ result: { data: { logLevel: LogLevel.INFO } } }));
  const closeMock = jest.fn();

  const checkUpdates = options.checkUpdatesThrows
    ? jest.fn(async () => {
        throw new Error('checkUpdates failed');
      })
    : jest.fn(async () => undefined);

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
    workerData: { threadName: 'CheckUpdates' },
  }));

  jest.unstable_mockModule('@matterbridge/utils', () => ({
    hasParameter,
    inspectError,
  }));

  jest.unstable_mockModule('./checkUpdates.js', () => ({
    checkUpdates,
  }));

  jest.unstable_mockModule('./worker.js', () => ({
    logWorkerInfo,
    parentLog,
    parentPost,
    threadLogger,
  }));

  jest.unstable_mockModule('./broadcastServer.js', () => ({
    BroadcastServer: class {
      public fetch = fetchMock;
      public close = closeMock;
      // eslint-disable-next-line @typescript-eslint/no-useless-constructor
      constructor() {}
    },
  }));

  await import('./workerCheckUpdates.js');

  return {
    parentPost,
    parentLog,
    threadLogger,
    logWorkerInfo,
    fetchMock,
    closeMock,
    checkUpdates,
    hasParameter,
    inspectError,
  };
}

describe('workerCheckUpdates', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: debug via --debug (init/exit + checkUpdates + close)', async () => {
    const { parentPost, parentLog, threadLogger, fetchMock, closeMock, checkUpdates } = await runWorkerCheckUpdates({
      debugParam: true,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
    });

    expect(parentPost).toHaveBeenCalledWith({ type: 'init', threadId: 1, threadName: 'CheckUpdates', success: true });
    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'CheckUpdates', success: true });

    expect(parentLog).toHaveBeenCalledWith('MatterbridgeCheckUpdates', LogLevel.INFO, expect.stringMatching(/initialized/));
    expect(parentLog).toHaveBeenCalledWith('MatterbridgeCheckUpdates', LogLevel.INFO, expect.stringMatching(/exiting with success: true/));

    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 1000);
    expect(checkUpdates).toHaveBeenCalledWith({ logLevel: LogLevel.INFO });

    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeCheckUpdates', LogLevel.INFO, 'Starting check updates...');
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeCheckUpdates', LogLevel.INFO, 'Check updates succeeded');

    expect(closeMock).toHaveBeenCalledTimes(1);
  });

  test('success: debug via --verbose (2nd OR operand) and verbose logs worker info', async () => {
    const { hasParameter, logWorkerInfo, parentLog } = await runWorkerCheckUpdates({
      debugParam: false,
      verboseParam: true,
      debugWorkerParam: false,
      verboseWorkerParam: false,
    });

    expect(hasParameter).toHaveBeenCalledWith('verbose');
    expect(logWorkerInfo).toHaveBeenCalledWith(expect.anything(), true);
    expect(parentLog).toHaveBeenCalled();
  });

  test('success: debug via --debug-worker (3rd OR operand)', async () => {
    const { hasParameter, parentLog } = await runWorkerCheckUpdates({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: true,
      verboseWorkerParam: false,
    });

    expect(hasParameter).toHaveBeenCalledWith('debug-worker');
    expect(parentLog).toHaveBeenCalled();
  });

  test('success: debug via --verbose-worker (4th OR operand) and verbose-worker logs worker info', async () => {
    const { hasParameter, logWorkerInfo, parentLog } = await runWorkerCheckUpdates({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: true,
    });

    expect(hasParameter).toHaveBeenCalledWith('verbose-worker');
    expect(logWorkerInfo).toHaveBeenCalledWith(expect.anything(), true);
    expect(parentLog).toHaveBeenCalled();
  });

  test('error: checkUpdates throws -> inspected error logged and exit success false', async () => {
    const { inspectError, threadLogger, parentPost, closeMock, parentLog } = await runWorkerCheckUpdates({
      debugParam: false,
      verboseParam: false,
      debugWorkerParam: false,
      verboseWorkerParam: false,
      checkUpdatesThrows: true,
    });

    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to check updates', expect.any(Error));
    expect(threadLogger).toHaveBeenCalledWith('MatterbridgeCheckUpdates', LogLevel.ERROR, 'inspected error');
    expect(closeMock).toHaveBeenCalledTimes(1);

    expect(parentPost).toHaveBeenCalledWith({ type: 'exit', threadId: 1, threadName: 'CheckUpdates', success: false });
    expect(parentLog).not.toHaveBeenCalled();
  });

  test('main thread / no parentPort: does not post init/exit', async () => {
    const { parentPost, parentLog, closeMock } = await runWorkerCheckUpdates({
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
