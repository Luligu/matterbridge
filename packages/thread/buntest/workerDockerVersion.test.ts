/**
 * @file packages/thread/buntest/workerDockerVersion.test.ts
 * @description This file contains the tests for the DockerVersion worker.
 * @author Luca Liguori
 */

import { afterAll, beforeAll, beforeEach, describe, expect, mock, type Mock, test, vi } from 'bun:test';
// oxlint-disable-next-line import/no-namespace
import * as fs from 'node:fs';

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
// oxlint-disable-next-line import/no-namespace
import * as utilsError from '@matterbridge/utils/error';
import { LogLevel } from 'node-ansi-logger';

// Copies of the real modules, spread into the partial mocks below.
const actualFs = { ...fs };
const actualUtilsError = { ...utilsError };

const DOCKER_BUILD_PATH = '/matterbridge/.dockerbuild.json';

type FnMock = Mock<(...args: any[]) => any>;
type RunResult = { success: boolean; loggerMock: FnMock; snackBarMock: FnMock; requestMock: FnMock };

// Setup the test environment
await setupTest('WorkerDockerVersion', false);

describe('workerDockerVersion', () => {
  const getDockerVersion = vi.fn<(owner: string, repo: string, tag?: string) => Promise<string | undefined>>();
  const takeDockerVersionWarning = vi.fn<() => string | undefined>();
  const inspectError = vi.fn<(...args: any[]) => string>();
  // Only the docker build config read is faked: any other path goes to the real readFileSync.
  const readDockerBuild = vi.fn<() => string>();
  const readFileSync = vi.fn((...args: Parameters<typeof fs.readFileSync>) => (args[0] === DOCKER_BUILD_PATH ? readDockerBuild() : actualFs.readFileSync(...args)));
  let wrapperName: string | undefined;
  let entrypoint: (worker: any) => Promise<boolean>;

  /**
   * Run the worker entrypoint with a fake ThreadsWrapper.
   *
   * @returns {Promise<RunResult>} The entrypoint result and the fake worker mocks.
   */
  async function runWorker(): Promise<RunResult> {
    const loggerMock = vi.fn<(...args: any[]) => any>();
    const snackBarMock = vi.fn<(...args: any[]) => any>();
    const requestMock = vi.fn<(...args: any[]) => any>();
    const worker = { logger: loggerMock, snackBar: snackBarMock, log: { debug: vi.fn<(...args: any[]) => any>() }, server: { request: requestMock } };
    const success = await entrypoint(worker);
    return { success, loggerMock, snackBarMock, requestMock };
  }

  /**
   * Make getDockerVersion resolve the given latest and dev versions.
   *
   * @param {string | undefined} latest - The version returned for the latest tag.
   * @param {string | undefined} dev - The version returned for the dev tag.
   */
  function setDockerVersions(latest: string | undefined, dev: string | undefined): void {
    getDockerVersion.mockImplementation(async (_owner, _repo, tag) => await Promise.resolve(tag === 'dev' ? dev : latest));
  }

  /**
   * Build the expected matterbridge_docker_version request.
   *
   * @param {object} params - The expected request params.
   * @returns {object} The expected request message.
   */
  function dockerVersionRequest(params: object): object {
    return { type: 'matterbridge_docker_version', src: 'manager', dst: 'matterbridge', params };
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
    await mock.module('../src/dockerVersion.js', () => ({ getDockerVersion, takeDockerVersionWarning }));
    await mock.module('@matterbridge/utils/error', () => ({ ...actualUtilsError, inspectError }));
    await mock.module('node:fs', () => ({ ...actualFs, readFileSync }));
    await import('../src/workerDockerVersion.js');
  });

  beforeEach(() => {
    setDockerVersions('3.5.5', '3.5.6-dev');
    takeDockerVersionWarning.mockReset();
    inspectError.mockReset().mockReturnValue('inspected error');
    readDockerBuild.mockReset().mockReturnValue('{"version":"3.5.4","dev":false}');
    readFileSync.mockClear();
  });

  afterAll(() => {
    mock.restore();
    resetTest();
  });

  test('should get the latest and dev versions and suggest the latest image when the build is older', async () => {
    const { success, loggerMock, snackBarMock, requestMock } = await runWorker();

    expect(wrapperName).toBe('DockerVersion');
    expect(success).toBe(true);
    expect(readFileSync).toHaveBeenCalledWith(DOCKER_BUILD_PATH, 'utf-8');
    expect(getDockerVersion).toHaveBeenNthCalledWith(1, 'luligu', 'matterbridge', 'latest');
    expect(getDockerVersion).toHaveBeenNthCalledWith(2, 'luligu', 'matterbridge', 'dev');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Starting docker version check...');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker build config: version=3.5.4 dev=false');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=3.5.6-dev, current=3.5.4');
    expect(snackBarMock).toHaveBeenCalledWith('A new Docker image is available: v.3.5.5. Pull the latest Docker image and recreate the container to apply it.', 0, 'info');
    expect(requestMock).toHaveBeenCalledWith(dockerVersionRequest({ dockerVersion: '3.5.4', dockerDev: false, dockerLatestVersion: '3.5.5', dockerDevVersion: '3.5.6-dev' }));
  });

  test('should log an unknown current version when the docker build config is missing', async () => {
    readDockerBuild.mockImplementation(() => {
      throw new Error('readFileSync failed');
    });
    const { success, loggerMock, requestMock } = await runWorker();

    expect(success).toBe(true);
    expect(readFileSync).toHaveBeenCalledWith(DOCKER_BUILD_PATH, 'utf-8');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.DEBUG, 'Failed to read docker build config');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=3.5.6-dev, current=unknown');
    expect(requestMock).toHaveBeenCalledWith(dockerVersionRequest({ dockerVersion: undefined, dockerDev: undefined, dockerLatestVersion: '3.5.5', dockerDevVersion: '3.5.6-dev' }));
  });

  test('should suggest the dev image when the dev build is older', async () => {
    readDockerBuild.mockReturnValue('{"version":"3.5.4-dev","dev":true}');
    const { success, loggerMock, snackBarMock, requestMock } = await runWorker();

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.WARN,
      'You are using the v.3.5.4-dev dev Docker image. Please pull the dev Docker image v.3.5.6-dev and recreate the container to apply it.',
    );
    expect(snackBarMock).toHaveBeenCalledWith('A new dev Docker image is available: v.3.5.6-dev. Pull the dev Docker image and recreate the container to apply it.', 0, 'info');
    expect(requestMock).toHaveBeenCalledWith(dockerVersionRequest({ dockerVersion: '3.5.4-dev', dockerDev: true, dockerLatestVersion: '3.5.5', dockerDevVersion: '3.5.6-dev' }));
  });

  test('should warn when the Docker Hub rate limit prevents the latest version lookup', async () => {
    const warning = 'Docker Hub rate limit reached while checking luligu/matterbridge:latest. Docker image version is unavailable.';
    setDockerVersions(undefined, undefined);
    takeDockerVersionWarning.mockReturnValueOnce(warning);
    const { success, loggerMock, requestMock } = await runWorker();

    expect(success).toBe(true);
    expect(takeDockerVersionWarning).toHaveBeenCalledTimes(2);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, warning);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=undefined, dev=undefined, current=3.5.4');
    expect(requestMock).toHaveBeenCalledWith(dockerVersionRequest({ dockerVersion: '3.5.4', dockerDev: false, dockerLatestVersion: undefined, dockerDevVersion: undefined }));
  });

  test('should warn when the Docker Hub rate limit prevents the dev version lookup', async () => {
    const warning = 'Docker Hub rate limit reached while checking luligu/matterbridge:dev. Docker image version is unavailable.';
    setDockerVersions('3.5.5', undefined);
    const warnings = [undefined, warning];
    takeDockerVersionWarning.mockImplementation(() => warnings.shift());
    const { success, loggerMock, requestMock } = await runWorker();

    expect(success).toBe(true);
    expect(takeDockerVersionWarning).toHaveBeenCalledTimes(2);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, warning);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=undefined, current=3.5.4');
    expect(requestMock).toHaveBeenCalledWith(dockerVersionRequest({ dockerVersion: '3.5.4', dockerDev: false, dockerLatestVersion: '3.5.5', dockerDevVersion: undefined }));
  });

  test('should log the inspected error and return false when getDockerVersion throws', async () => {
    getDockerVersion.mockRejectedValue(new Error('getDockerVersion failed'));
    const { success, loggerMock, requestMock } = await runWorker();

    expect(success).toBe(false);
    expect(getDockerVersion).toHaveBeenCalledWith('luligu', 'matterbridge', 'latest');
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to check docker version', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
    expect(requestMock).toHaveBeenCalledWith(dockerVersionRequest({ dockerVersion: '3.5.4', dockerDev: false, dockerLatestVersion: undefined, dockerDevVersion: undefined }));
  });
});
