/**
 * @file packages/thread/buntest/workerCheckUpdates.test.ts
 * @description This file contains the tests for the CheckUpdates worker.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, type Mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
// oxlint-disable-next-line import/no-namespace
import * as utilsError from '@matterbridge/utils/error';
import { LogLevel } from 'node-ansi-logger';

// Copy of the real module, spread into the partial mock below.
const actualUtilsError = { ...utilsError };

type FnMock = Mock<(...args: any[]) => any>;
type RunResult = { success: boolean; loggerMock: FnMock; fetchMock: FnMock };

// Setup the test environment
await setupTest('WorkerCheckUpdates', false);

describe('workerCheckUpdates', () => {
  const checkUpdates = vi.fn<(...args: any[]) => Promise<void>>();
  const inspectError = vi.fn<(...args: any[]) => string>();
  let wrapperName: string | undefined;
  let entrypoint: (worker: any) => Promise<boolean>;

  /**
   * Run the worker entrypoint with a fake ThreadsWrapper.
   *
   * @returns {Promise<RunResult>} The entrypoint result and the fake worker mocks.
   */
  async function runWorker(): Promise<RunResult> {
    const loggerMock = vi.fn<(...args: any[]) => any>();
    const fetchMock = vi.fn<(...args: any[]) => any>(async () => await Promise.resolve({ result: { data: { logLevel: LogLevel.INFO } } }));
    const worker = {
      logger: loggerMock,
      log: { debug: vi.fn<(...args: any[]) => any>() },
      server: { fetch: fetchMock, request: vi.fn<(...args: any[]) => any>() },
    };
    const success = await entrypoint(worker);
    return { success, loggerMock, fetchMock };
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
    await mock.module('../src/checkUpdates.js', () => ({ checkUpdates }));
    await mock.module('@matterbridge/utils/error', () => ({ ...actualUtilsError, inspectError }));
    await import('../src/workerCheckUpdates.js');
  });

  beforeEach(() => {
    checkUpdates.mockReset().mockImplementation(async () => {});
    inspectError.mockReset().mockReturnValue('inspected error');
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should fetch the shared data, run checkUpdates and log success', async () => {
    const { success, loggerMock, fetchMock } = await runWorker();

    expect(wrapperName).toBe('CheckUpdates');
    expect(success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith({ type: 'matterbridge_shared', src: 'matterbridge', dst: 'matterbridge' }, 5000);
    expect(checkUpdates).toHaveBeenCalledWith({ logLevel: LogLevel.INFO }, expect.objectContaining({ fetch: fetchMock }));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Starting check updates...');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Check updates succeeded');
  });

  test('should log the inspected error and return false when checkUpdates throws', async () => {
    checkUpdates.mockRejectedValue(new Error('checkUpdates failed'));
    const { success, loggerMock } = await runWorker();

    expect(success).toBe(false);
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to check updates', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });
});
