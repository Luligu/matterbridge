import { LogLevel } from 'node-ansi-logger';
import type { Mock } from 'vitest';

type RunOptions = Readonly<{
  command?: 'zip' | 'verify' | 'unzip';
  createZipResult?: number;
  readZipResult?: Array<Record<string, unknown>>;
  unZipResult?: string;
  workerData?: Record<string, unknown>;
}>;

type RunWorkerArchiveCommandResult = Readonly<{
  wrapperName: string | undefined;
  success: boolean;
  loggerMock: Mock<(...args: any[]) => any>;
  respondMock: Mock<(...args: any[]) => any>;
  createZip: Mock<(...args: any[]) => any>;
  readZip: Mock<(...args: any[]) => any>;
  unZip: Mock<(...args: any[]) => any>;
  workerData: any;
}>;

async function runWorkerArchiveCommand(options: RunOptions): Promise<RunWorkerArchiveCommandResult> {
  vi.resetModules();

  const loggerMock = vi.fn<(...args: any[]) => any>();
  const respondMock = vi.fn<(...args: any[]) => any>();

  const workerData = {
    threadName: 'ArchiveCommand',
    logLevel: LogLevel.INFO,
    debug: false,
    verbose: false,
    tracker: false,
    command: 'zip',
    archivePath: '/tmp/archive.zip',
    sourcePaths: ['/tmp/source-a', '/tmp/source-b'],
    destinationPath: '/tmp/unpacked',
    ...options.workerData,
    ...(options.command ? { command: options.command } : {}),
  };

  const worker = {
    logger: loggerMock,
    log: { debug: vi.fn<(...args: any[]) => any>() },
    server: { respond: respondMock, getUniqueId: () => 123456789 },
    workerData,
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const createZip = vi.fn<(...args: any[]) => any>(async () => await Promise.resolve(options.createZipResult ?? 128));
  const readZip = vi.fn<(...args: any[]) => any>(async () => await Promise.resolve(options.readZipResult ?? [{ filename: 'file.txt' }]));
  const unZip = vi.fn<(...args: any[]) => any>(async () => await Promise.resolve(options.unZipResult ?? workerData.destinationPath));

  vi.doMock('../src/zipjs.js', () => ({ createZip, readZip, unZip }));

  vi.doMock('../src/workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  await import('../src/workerArchiveCommand.js');
  const success = await (runPromise ?? Promise.resolve(false));

  return { wrapperName, success, loggerMock, respondMock, createZip, readZip, unZip, workerData };
}

describe('workerArchiveCommand', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('success: zip command creates archive and logs success', async () => {
    const { wrapperName, success, loggerMock, respondMock, createZip, readZip, unZip, workerData } = await runWorkerArchiveCommand({
      command: 'zip',
      createZipResult: 256,
    });

    expect(wrapperName).toBe('ArchiveCommand');
    expect(success).toBe(true);

    expect(createZip).toHaveBeenCalledWith(workerData.archivePath, workerData.sourcePaths);
    expect(readZip).not.toHaveBeenCalled();
    expect(unZip).not.toHaveBeenCalled();
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting archive command ${workerData.command} on ${workerData.archivePath} with source paths ${workerData.sourcePaths.join(', ')} and destination path ${workerData.destinationPath}...`,
    );
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Archive command ${workerData.command} on ${workerData.archivePath} with source paths ${workerData.sourcePaths.join(', ')} and destination path ${workerData.destinationPath} executed successfully`,
    );
    expect(respondMock).toHaveBeenCalledWith({
      type: 'manager_archive_response',
      src: 'manager',
      dst: 'frontend',
      id: 123456789,
      result: {
        command: workerData.command,
        archivePath: workerData.archivePath,
        sourcePaths: workerData.sourcePaths,
        destinationPath: workerData.destinationPath,
        success: true,
      },
    });
  });

  test('success: verify command reads archive and logs success', async () => {
    const { success, createZip, readZip, unZip, workerData } = await runWorkerArchiveCommand({
      command: 'verify',
      readZipResult: [{ filename: 'verified.txt' }],
    });

    expect(success).toBe(true);
    expect(createZip).not.toHaveBeenCalled();
    expect(readZip).toHaveBeenCalledWith(workerData.archivePath);
    expect(unZip).not.toHaveBeenCalled();
  });

  test('success: unzip command extracts archive and logs success', async () => {
    const { success, createZip, readZip, unZip, workerData } = await runWorkerArchiveCommand({
      command: 'unzip',
      unZipResult: '/tmp/unpacked',
    });

    expect(success).toBe(true);
    expect(createZip).not.toHaveBeenCalled();
    expect(readZip).not.toHaveBeenCalled();
    expect(unZip).toHaveBeenCalledWith(workerData.archivePath, workerData.destinationPath);
  });

  test('failure: logs error when archive command result is empty', async () => {
    const { success, loggerMock, respondMock, readZip, workerData } = await runWorkerArchiveCommand({
      command: 'verify',
      readZipResult: [],
    });

    expect(success).toBe(false);
    expect(readZip).toHaveBeenCalledWith(workerData.archivePath);
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `Archive command ${workerData.command} on ${workerData.archivePath} with source paths ${workerData.sourcePaths.join(', ')} and destination path ${workerData.destinationPath} failed`,
    );
    expect(respondMock).toHaveBeenCalledWith({
      type: 'manager_archive_response',
      src: 'manager',
      dst: 'frontend',
      id: 123456789,
      result: {
        command: workerData.command,
        archivePath: workerData.archivePath,
        sourcePaths: workerData.sourcePaths,
        destinationPath: workerData.destinationPath,
        success: false,
      },
    });
  });

  test('invalid workerData: logs error and returns false without running archive helpers', async () => {
    const { success, loggerMock, respondMock, createZip, readZip, unZip } = await runWorkerArchiveCommand({
      workerData: { destinationPath: 123 },
    });

    expect(success).toBe(false);
    expect(createZip).not.toHaveBeenCalled();
    expect(readZip).not.toHaveBeenCalled();
    expect(unZip).not.toHaveBeenCalled();
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'ArchiveCommand invalid parameters');
    expect(respondMock).not.toHaveBeenCalled();
  });
});
