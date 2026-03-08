import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  checkUpdatesThrows?: boolean;
}>;

async function runWorkerCheckUpdates(options: RunOptions) {
  jest.resetModules();

  const loggerMock = jest.fn();
  const fetchMock = jest.fn(async () => ({ result: { data: { logLevel: LogLevel.INFO } } }));

  const worker = {
    logger: loggerMock,
    log: { debug: jest.fn() },
    server: { fetch: fetchMock },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const checkUpdates = options.checkUpdatesThrows
    ? jest.fn(async () => {
        throw new Error('checkUpdates failed');
      })
    : jest.fn(async () => undefined);

  const inspectError = jest.fn(() => 'inspected error');

  jest.unstable_mockModule('./workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  jest.unstable_mockModule('./checkUpdates.js', () => ({ checkUpdates }));
  jest.unstable_mockModule('@matterbridge/utils/error', () => ({ inspectError }));

  await import('./workerCheckUpdates.js');
  const success = await runPromise;

  return { wrapperName, success, loggerMock, fetchMock, checkUpdates, inspectError };
}

describe('workerCheckUpdates', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: runs fetch + checkUpdates + logs success', async () => {
    const { wrapperName, success, loggerMock, fetchMock, checkUpdates } = await runWorkerCheckUpdates({});

    expect(wrapperName).toBe('GlobalPrefix');
    expect(success).toBe(true);

    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 5000);
    expect(checkUpdates).toHaveBeenCalledWith({ logLevel: LogLevel.INFO });

    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Starting check updates...');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Check updates succeeded');
  });

  test('error: checkUpdates throws -> logs inspected error and returns false', async () => {
    const { success, loggerMock, inspectError } = await runWorkerCheckUpdates({ checkUpdatesThrows: true });

    expect(success).toBe(false);
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to check updates', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });
});
