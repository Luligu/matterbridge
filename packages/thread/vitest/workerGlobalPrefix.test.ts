import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  globalPrefix?: string;
  getGlobalThrows?: boolean;
}>;

async function runWorkerGlobalPrefix(options: RunOptions) {
  vi.resetModules();

  const loggerMock = vi.fn();
  const requestMock = vi.fn();

  const worker = {
    logger: loggerMock,
    log: { debug: vi.fn() },
    server: { request: requestMock },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const getGlobalNodeModules = options.getGlobalThrows
    ? vi.fn(async () => {
        throw new Error('getGlobalNodeModules failed');
      })
    : vi.fn(async () => options.globalPrefix ?? '/usr/local/lib/node_modules');

  const inspectError = vi.fn(() => 'inspected error');

  vi.doMock('../src/workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  vi.doMock('@matterbridge/utils/npm-prefix', () => ({ getGlobalNodeModules }));
  vi.doMock('@matterbridge/utils/error', () => ({ inspectError }));

  await import('../src/workerGlobalPrefix.js');
  const success = await runPromise;

  return { wrapperName, success, loggerMock, requestMock, getGlobalNodeModules, inspectError };
}

describe('workerGlobalPrefix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('success: requests global prefix and logs it', async () => {
    const { wrapperName, success, loggerMock, requestMock, getGlobalNodeModules } = await runWorkerGlobalPrefix({
      globalPrefix: '/custom/prefix',
    });

    expect(wrapperName).toBe('GlobalPrefix');
    expect(success).toBe(true);

    expect(getGlobalNodeModules).toHaveBeenCalledTimes(1);
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_global_prefix',
      src: 'matterbridge',
      dst: 'matterbridge',
      params: { prefix: '/custom/prefix' },
    });
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Starting global prefix check...');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Global node_modules directory: /custom/prefix');
  });

  test('error: getGlobalNodeModules throws -> logs inspected error and returns false', async () => {
    const { success, loggerMock, inspectError, requestMock } = await runWorkerGlobalPrefix({ getGlobalThrows: true });

    expect(success).toBe(false);
    expect(requestMock).not.toHaveBeenCalled();
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to get global node modules', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });
});
