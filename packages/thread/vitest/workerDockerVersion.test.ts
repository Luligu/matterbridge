import { LogLevel } from 'node-ansi-logger';
import type { Mock } from 'vitest';

type RunOptions = Readonly<{
  getDockerVersionThrows?: boolean;
  dockerVersionLatest?: string;
  dockerVersionDev?: string;
  dockerVersionWarnings?: Array<string | undefined>;
  dockerBuildConfigJson?: string;
  readDockerBuildConfigThrows?: boolean;
}>;

type RunWorkerDockerVersionResult = Readonly<{
  wrapperName: string | undefined;
  success: boolean;
  loggerMock: Mock<(...args: any[]) => any>;
  snackBarMock: Mock<(...args: any[]) => any>;
  requestMock: Mock<(...args: any[]) => any>;
  getDockerVersion: Mock<(...args: any[]) => any>;
  takeDockerVersionWarning: Mock<(...args: any[]) => any>;
  inspectError: Mock<(...args: any[]) => any>;
  readFileSync: Mock<(...args: any[]) => any>;
}>;

async function runWorkerDockerVersion(options: RunOptions): Promise<RunWorkerDockerVersionResult> {
  vi.resetModules();

  const loggerMock = vi.fn<(...args: any[]) => any>();
  const snackBarMock = vi.fn<(...args: any[]) => any>();
  const requestMock = vi.fn<(...args: any[]) => any>();

  const worker = {
    logger: loggerMock,
    snackBar: snackBarMock,
    log: { debug: vi.fn<(...args: any[]) => any>() },
    server: { request: requestMock },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const getDockerVersion = options.getDockerVersionThrows
    ? vi.fn<(...args: any[]) => any>(async () => {
        await Promise.resolve();
        throw new Error('getDockerVersion failed');
      })
    : vi.fn<(...args: any[]) => any>(async (_owner: string, _repo: string, tag?: string) => {
        await Promise.resolve();
        if (tag === 'dev') return Object.hasOwn(options, 'dockerVersionDev') ? options.dockerVersionDev : '3.5.6-dev';
        return Object.hasOwn(options, 'dockerVersionLatest') ? options.dockerVersionLatest : '3.5.5';
      });
  const dockerVersionWarnings = [...(options.dockerVersionWarnings ?? [])];
  const takeDockerVersionWarning = vi.fn<(...args: any[]) => any>(() => dockerVersionWarnings.shift());

  const inspectError = vi.fn<(...args: any[]) => any>(() => 'inspected error');
  const readFileSync = options.readDockerBuildConfigThrows
    ? vi.fn<(...args: any[]) => any>(() => {
        throw new Error('readFileSync failed');
      })
    : vi.fn<(...args: any[]) => any>(() => options.dockerBuildConfigJson ?? '{"version":"3.5.4","dev":false}');

  vi.doMock('../src/workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  vi.doMock('../src/dockerVersion.js', () => ({ getDockerVersion, takeDockerVersionWarning }));
  vi.doMock('@matterbridge/utils/error', () => ({ inspectError }));
  vi.doMock('node:fs', () => ({ readFileSync }));

  await import('../src/workerDockerVersion.js');
  const success = await (runPromise ?? Promise.resolve(false));

  return { wrapperName, success, loggerMock, snackBarMock, requestMock, getDockerVersion, takeDockerVersionWarning, inspectError, readFileSync };
}

describe('workerDockerVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('success: gets latest + dev docker versions and logs success with current docker build version', async () => {
    const { wrapperName, success, loggerMock, snackBarMock, requestMock, getDockerVersion, readFileSync } = await runWorkerDockerVersion({
      dockerVersionLatest: '3.5.5',
      dockerVersionDev: '3.5.6-dev',
      dockerBuildConfigJson: '{"version":"3.5.4","dev":false}',
    });

    expect(wrapperName).toBe('DockerVersion');
    expect(success).toBe(true);

    expect(readFileSync).toHaveBeenCalledWith('/matterbridge/.dockerbuild.json', 'utf-8');
    expect(getDockerVersion).toHaveBeenNthCalledWith(1, 'luligu', 'matterbridge', 'latest');
    expect(getDockerVersion).toHaveBeenNthCalledWith(2, 'luligu', 'matterbridge', 'dev');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Starting docker version check...');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker build config: version=3.5.4 dev=false');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=3.5.6-dev, current=3.5.4');
    expect(snackBarMock).toHaveBeenCalledWith('A new Docker image is available: v.3.5.5. Pull the latest Docker image and recreate the container to apply it.', 0, 'info');
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_docker_version',
      src: 'manager',
      dst: 'matterbridge',
      params: {
        dockerVersion: '3.5.4',
        dockerDev: false,
        dockerLatestVersion: '3.5.5',
        dockerDevVersion: '3.5.6-dev',
      },
    });
  });

  test('success: missing docker build config logs unknown current version', async () => {
    const { success, loggerMock, requestMock, readFileSync } = await runWorkerDockerVersion({
      readDockerBuildConfigThrows: true,
    });

    expect(success).toBe(true);
    expect(readFileSync).toHaveBeenCalledWith('/matterbridge/.dockerbuild.json', 'utf-8');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.DEBUG, 'Failed to read docker build config');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=3.5.6-dev, current=unknown');
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_docker_version',
      src: 'manager',
      dst: 'matterbridge',
      params: {
        dockerVersion: undefined,
        dockerDev: undefined,
        dockerLatestVersion: '3.5.5',
        dockerDevVersion: '3.5.6-dev',
      },
    });
  });

  test('success: warns when dev docker image is outdated', async () => {
    const { success, loggerMock, snackBarMock, requestMock } = await runWorkerDockerVersion({
      dockerVersionLatest: '3.5.5',
      dockerVersionDev: '3.5.6-dev',
      dockerBuildConfigJson: '{"version":"3.5.4-dev","dev":true}',
    });

    expect(success).toBe(true);
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.WARN,
      'You are using the v.3.5.4-dev dev Docker image. Please pull the dev Docker image v.3.5.6-dev and recreate the container to apply it.',
    );
    expect(snackBarMock).toHaveBeenCalledWith('A new dev Docker image is available: v.3.5.6-dev. Pull the dev Docker image and recreate the container to apply it.', 0, 'info');
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_docker_version',
      src: 'manager',
      dst: 'matterbridge',
      params: {
        dockerVersion: '3.5.4-dev',
        dockerDev: true,
        dockerLatestVersion: '3.5.5',
        dockerDevVersion: '3.5.6-dev',
      },
    });
  });

  test('success: warns when Docker Hub rate limit prevents version lookup', async () => {
    const { success, loggerMock, requestMock, takeDockerVersionWarning } = await runWorkerDockerVersion({
      dockerVersionLatest: undefined,
      dockerVersionDev: undefined,
      dockerVersionWarnings: ['Docker Hub rate limit reached while checking luligu/matterbridge:latest. Docker image version is unavailable.', undefined],
    });

    expect(success).toBe(true);
    expect(takeDockerVersionWarning).toHaveBeenCalledTimes(2);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, 'Docker Hub rate limit reached while checking luligu/matterbridge:latest. Docker image version is unavailable.');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=undefined, dev=undefined, current=3.5.4');
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_docker_version',
      src: 'manager',
      dst: 'matterbridge',
      params: {
        dockerVersion: '3.5.4',
        dockerDev: false,
        dockerLatestVersion: undefined,
        dockerDevVersion: undefined,
      },
    });
  });

  test('success: warns when Docker Hub rate limit prevents dev version lookup', async () => {
    const { success, loggerMock, requestMock, takeDockerVersionWarning } = await runWorkerDockerVersion({
      dockerVersionLatest: '3.5.5',
      dockerVersionDev: undefined,
      dockerVersionWarnings: [undefined, 'Docker Hub rate limit reached while checking luligu/matterbridge:dev. Docker image version is unavailable.'],
    });

    expect(success).toBe(true);
    expect(takeDockerVersionWarning).toHaveBeenCalledTimes(2);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.WARN, 'Docker Hub rate limit reached while checking luligu/matterbridge:dev. Docker image version is unavailable.');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=undefined, current=3.5.4');
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_docker_version',
      src: 'manager',
      dst: 'matterbridge',
      params: {
        dockerVersion: '3.5.4',
        dockerDev: false,
        dockerLatestVersion: '3.5.5',
        dockerDevVersion: undefined,
      },
    });
  });

  test('error: getDockerVersion throws -> logs inspected error and returns false', async () => {
    const { success, loggerMock, requestMock, inspectError, getDockerVersion } = await runWorkerDockerVersion({ getDockerVersionThrows: true });

    expect(success).toBe(false);
    expect(getDockerVersion).toHaveBeenCalledWith('luligu', 'matterbridge', 'latest');
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to check docker version', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
    expect(requestMock).toHaveBeenCalledWith({
      type: 'matterbridge_docker_version',
      src: 'manager',
      dst: 'matterbridge',
      params: {
        dockerVersion: '3.5.4',
        dockerDev: false,
        dockerLatestVersion: undefined,
        dockerDevVersion: undefined,
      },
    });
  });
});
