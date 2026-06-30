import { LogLevel } from 'node-ansi-logger';
import type { Mock } from 'vitest';

type RunOptions = Readonly<{
  checkUpdatesThrows?: boolean;
}>;

type RunWorkerCheckUpdatesResult = Readonly<{
  wrapperName: string | undefined;
  success: boolean;
  loggerMock: Mock<(...args: any[]) => any>;
  fetchMock: Mock<(...args: any[]) => any>;
  checkUpdates: Mock<(...args: any[]) => any>;
  inspectError: Mock<(...args: any[]) => any>;
}>;

async function runWorkerCheckUpdates(options: RunOptions): Promise<RunWorkerCheckUpdatesResult> {
  vi.resetModules();

  const loggerMock = vi.fn<(...args: any[]) => any>();
  const fetchMock = vi.fn<(...args: any[]) => any>(async () => await Promise.resolve({ result: { data: { logLevel: LogLevel.INFO } } }));

  const worker = {
    logger: loggerMock,
    log: { debug: vi.fn<(...args: any[]) => any>() },
    server: { fetch: fetchMock, request: vi.fn<(...args: any[]) => any>() },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const checkUpdates = options.checkUpdatesThrows
    ? vi.fn<(...args: any[]) => any>(async () => {
        await Promise.resolve();
        throw new Error('checkUpdates failed');
      })
    : vi.fn<(...args: any[]) => any>(async () => await Promise.resolve());

  const inspectError = vi.fn<(...args: any[]) => any>(() => 'inspected error');

  vi.doMock('../src/workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  vi.doMock('../src/checkUpdates.js', () => ({ checkUpdates }));
  vi.doMock('@matterbridge/utils/error', () => ({ inspectError }));

  await import('../src/workerCheckUpdates.js');
  const success = await (runPromise ?? Promise.resolve(false));

  return { wrapperName, success, loggerMock, fetchMock, checkUpdates, inspectError };
}

describe('workerCheckUpdates', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('success: runs fetch + checkUpdates + logs success', async () => {
    const { wrapperName, success, loggerMock, fetchMock, checkUpdates } = await runWorkerCheckUpdates({});

    expect(wrapperName).toBe('CheckUpdates');
    expect(success).toBe(true);

    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 5000);
    expect(checkUpdates).toHaveBeenCalledWith({ logLevel: LogLevel.INFO }, expect.objectContaining({ fetch: fetchMock }));

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
