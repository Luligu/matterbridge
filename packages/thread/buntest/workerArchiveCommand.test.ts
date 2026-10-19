/**
 * @file packages/thread/buntest/workerArchiveCommand.test.ts
 * @description This file contains the tests for the ArchiveCommand worker.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, type Mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

type FnMock = Mock<(...args: any[]) => any>;
type RunResult = { success: boolean; loggerMock: FnMock; respondMock: FnMock; workerData: any };

// Setup the test environment
await setupTest('WorkerArchiveCommand', false);

describe('workerArchiveCommand', () => {
  const createZip = vi.fn<(...args: any[]) => Promise<number>>();
  const readZip = vi.fn<(...args: any[]) => Promise<Array<Record<string, unknown>>>>();
  const unZip = vi.fn<(...args: any[]) => Promise<string>>();
  let wrapperName: string | undefined;
  let entrypoint: (worker: any) => Promise<boolean>;

  /**
   * Run the worker entrypoint with a fake ThreadsWrapper.
   *
   * @param {Record<string, unknown>} [overrides] - Fields that replace the default workerData.
   * @returns {Promise<RunResult>} The entrypoint result, the fake worker mocks and the workerData.
   */
  async function runWorker(overrides: Record<string, unknown> = {}): Promise<RunResult> {
    const loggerMock = vi.fn<(...args: any[]) => any>();
    const respondMock = vi.fn<(...args: any[]) => any>();
    const workerData = {
      type: 'worker',
      threadName: 'ArchiveCommand',
      logLevel: LogLevel.INFO,
      debug: false,
      verbose: false,
      tracker: false,
      command: 'zip',
      archivePath: '/tmp/archive.zip',
      sourcePaths: ['/tmp/source-a', '/tmp/source-b'],
      destinationPath: '/tmp/unpacked',
      ...overrides,
    };
    const worker = {
      logger: loggerMock,
      log: { debug: vi.fn<(...args: any[]) => any>() },
      server: { respond: respondMock, getUniqueId: (): number => 123456789 },
      workerData,
    };
    const success = await entrypoint(worker);
    return { success, loggerMock, respondMock, workerData };
  }

  /**
   * Build the expected manager_archive_response.
   *
   * @param {any} workerData - The workerData passed to the worker.
   * @param {boolean} success - The expected success flag.
   * @returns {object} The expected response message.
   */
  function archiveResponse(workerData: any, success: boolean): object {
    return {
      type: 'manager_archive_response',
      src: 'manager',
      dst: 'frontend',
      id: 123456789,
      result: { command: workerData.command, archivePath: workerData.archivePath, sourcePaths: workerData.sourcePaths, destinationPath: workerData.destinationPath, success },
    };
  }

  beforeAll(async () => {
    await mock.module('../src/threadsWrapper.js', () => ({
      // oxlint-disable-next-line typescript/no-extraneous-class -- Capture the entrypoint instead of starting a thread.
      ThreadsWrapper: class {
        constructor(name: string, fn: (worker: any) => Promise<boolean>) {
          wrapperName = name;
          entrypoint = fn;
        }
      },
    }));
    await mock.module('../src/zipjs.js', () => ({ createZip, readZip, unZip }));
    await import('../src/workerArchiveCommand.js');
  });

  beforeEach(() => {
    createZip.mockReset().mockResolvedValue(128);
    readZip.mockReset().mockResolvedValue([{ filename: 'file.txt' }]);
    unZip.mockReset().mockResolvedValue('/tmp/unpacked');
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should create the archive and log success when the command is zip', async () => {
    createZip.mockResolvedValue(256);
    const { success, loggerMock, respondMock, workerData } = await runWorker({ command: 'zip' });

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
    expect(respondMock).toHaveBeenCalledWith(archiveResponse(workerData, true));
  });

  test('should read the archive and log success when the command is verify', async () => {
    readZip.mockResolvedValue([{ filename: 'verified.txt' }]);
    const { success, workerData } = await runWorker({ command: 'verify' });

    expect(success).toBe(true);
    expect(createZip).not.toHaveBeenCalled();
    expect(readZip).toHaveBeenCalledWith(workerData.archivePath);
    expect(unZip).not.toHaveBeenCalled();
  });

  test('should extract the archive and log success when the command is unzip', async () => {
    const { success, workerData } = await runWorker({ command: 'unzip' });

    expect(success).toBe(true);
    expect(createZip).not.toHaveBeenCalled();
    expect(readZip).not.toHaveBeenCalled();
    expect(unZip).toHaveBeenCalledWith(workerData.archivePath, workerData.destinationPath);
  });

  test('should log an error when the archive command result is empty', async () => {
    readZip.mockResolvedValue([]);
    const { success, loggerMock, respondMock, workerData } = await runWorker({ command: 'verify' });

    expect(success).toBe(false);
    expect(readZip).toHaveBeenCalledWith(workerData.archivePath);
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `Archive command ${workerData.command} on ${workerData.archivePath} with source paths ${workerData.sourcePaths.join(', ')} and destination path ${workerData.destinationPath} failed`,
    );
    expect(respondMock).toHaveBeenCalledWith(archiveResponse(workerData, false));
  });

  test('should log an error and return false without running the archive helpers when workerData is invalid', async () => {
    const { success, loggerMock, respondMock } = await runWorker({ destinationPath: 123 });

    expect(success).toBe(false);
    expect(createZip).not.toHaveBeenCalled();
    expect(readZip).not.toHaveBeenCalled();
    expect(unZip).not.toHaveBeenCalled();
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'ArchiveCommand invalid parameters');
    expect(respondMock).not.toHaveBeenCalled();
  });
});
