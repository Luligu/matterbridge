/**
 * @file packages/thread/buntest/workerGlobalPrefix.test.ts
 * @description This file contains the tests for the GlobalPrefix worker.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, type Mock, test, vi } from 'bun:test';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
// oxlint-disable-next-line import/no-namespace
import * as utilsError from '@matterbridge/utils/error';
// oxlint-disable-next-line import/no-namespace
import * as utilsNpmPrefix from '@matterbridge/utils/npm-prefix';
import { LogLevel } from 'node-ansi-logger';

// Copies of the real modules, spread into the partial mocks below.
const actualUtilsError = { ...utilsError };
const actualUtilsNpmPrefix = { ...utilsNpmPrefix };

type FnMock = Mock<(...args: any[]) => any>;
type RunResult = { success: boolean; loggerMock: FnMock; requestMock: FnMock };

// Setup the test environment
await setupTest('WorkerGlobalPrefix', false);

describe('workerGlobalPrefix', () => {
  const getGlobalNodeModules = vi.fn<() => Promise<string>>();
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
    const requestMock = vi.fn<(...args: any[]) => any>();
    const worker = { logger: loggerMock, log: { debug: vi.fn<(...args: any[]) => any>() }, server: { request: requestMock } };
    const success = await entrypoint(worker);
    return { success, loggerMock, requestMock };
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
    await mock.module('@matterbridge/utils/npm-prefix', () => ({ ...actualUtilsNpmPrefix, getGlobalNodeModules }));
    await mock.module('@matterbridge/utils/error', () => ({ ...actualUtilsError, inspectError }));
    await import('../src/workerGlobalPrefix.js');
  });

  beforeEach(() => {
    getGlobalNodeModules.mockReset().mockResolvedValue('/usr/local/lib/node_modules');
    inspectError.mockReset().mockReturnValue('inspected error');
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should request the global prefix and log it when getGlobalNodeModules succeeds', async () => {
    getGlobalNodeModules.mockResolvedValue('/custom/prefix');
    const { success, loggerMock, requestMock } = await runWorker();

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

  test('should log the inspected error and return false when getGlobalNodeModules throws', async () => {
    getGlobalNodeModules.mockRejectedValue(new Error('getGlobalNodeModules failed'));
    const { success, loggerMock, requestMock } = await runWorker();

    expect(success).toBe(false);
    expect(requestMock).not.toHaveBeenCalled();
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to get global node modules', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });
});
