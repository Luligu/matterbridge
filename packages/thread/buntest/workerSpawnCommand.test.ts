/**
 * @file packages/thread/buntest/workerSpawnCommand.test.ts
 * @description This file contains the tests for the SpawnCommand worker.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, type Mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

type FnMock = Mock<(...args: any[]) => any>;
type RunResult = { success: boolean; loggerMock: FnMock; respondMock: FnMock; workerData: any };

// Setup the test environment
await setupTest('WorkerSpawnCommand', false);

describe('workerSpawnCommand', () => {
  const spawnCommand = vi.fn<(...args: any[]) => Promise<boolean>>();
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
      command: 'echo',
      args: ['--foo', 'bar'],
      packageCommand: 'install',
      packageName: '@matterbridge/thread',
      type: 'worker',
      threadName: 'SpawnCommand',
      logLevel: LogLevel.INFO,
      debug: false,
      verbose: false,
      tracker: false,
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
    await mock.module('../src/spawnCommand.js', () => ({ spawnCommand }));
    await import('../src/workerSpawnCommand.js');
  });

  beforeEach(() => {
    spawnCommand.mockReset().mockResolvedValue(true);
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should spawn the command and log success when spawnCommand succeeds', async () => {
    const { success, loggerMock, respondMock, workerData } = await runWorker();

    expect(wrapperName).toBe('SpawnCommand');
    expect(success).toBe(true);
    expect(spawnCommand).toHaveBeenCalledWith(workerData.command, workerData.args, workerData.packageCommand, workerData.packageName);
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting spawn command ${workerData.command} with args ${workerData.args.join(' ')} and package command ${workerData.packageCommand} for package ${workerData.packageName}...`,
    );
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, `Spawn command ${workerData.command} with args ${workerData.args.join(' ')} executed successfully`);
    expect(respondMock).toHaveBeenCalledWith({
      type: 'manager_spawn_response',
      src: 'manager',
      dst: 'all',
      id: 123456789,
      result: {
        command: workerData.command,
        args: workerData.args,
        packageCommand: workerData.packageCommand,
        packageName: workerData.packageName,
        success: true,
      },
    });
  });

  test('should log an error when spawnCommand returns false', async () => {
    spawnCommand.mockResolvedValue(false);
    const { success, loggerMock, respondMock, workerData } = await runWorker();

    expect(success).toBe(false);
    expect(spawnCommand).toHaveBeenCalledWith(workerData.command, workerData.args, workerData.packageCommand, workerData.packageName);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, `Spawn command ${workerData.command} with args ${workerData.args.join(' ')} failed`);
    expect(respondMock).toHaveBeenCalledWith({
      type: 'manager_spawn_response',
      src: 'manager',
      dst: 'all',
      id: 123456789,
      result: {
        command: workerData.command,
        args: workerData.args,
        packageCommand: workerData.packageCommand,
        packageName: workerData.packageName,
        success: false,
      },
    });
  });

  test('should log an error and return false without spawning when workerData is invalid', async () => {
    const { success, loggerMock, respondMock } = await runWorker({ packageCommand: 'build' });

    expect(success).toBe(false);
    expect(spawnCommand).not.toHaveBeenCalled();
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'SpawnCommand invalid parameters');
    expect(respondMock).not.toHaveBeenCalled();
  });
});
