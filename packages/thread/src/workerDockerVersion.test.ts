import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  getDockerVersionThrows?: boolean;
  dockerVersionLatest?: string;
  dockerVersionDev?: string;
  dockerBuildConfigJson?: string;
  readDockerBuildConfigThrows?: boolean;
}>;

async function runWorkerDockerVersion(options: RunOptions) {
  jest.resetModules();

  const loggerMock = jest.fn();

  const worker = {
    logger: loggerMock,
    log: { debug: jest.fn() },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const getDockerVersion = options.getDockerVersionThrows
    ? jest.fn(async () => {
        throw new Error('getDockerVersion failed');
      })
    : jest.fn(async (_owner: string, _repo: string, tag?: string) => {
        if (tag === 'dev') return options.dockerVersionDev ?? '3.5.6-dev';
        return options.dockerVersionLatest ?? '3.5.5';
      });

  const inspectError = jest.fn(() => 'inspected error');
  const readFileSync = options.readDockerBuildConfigThrows
    ? jest.fn(() => {
        throw new Error('readFileSync failed');
      })
    : jest.fn(() => options.dockerBuildConfigJson ?? '{"version":"3.5.4","dev":false}');

  jest.unstable_mockModule('./workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  jest.unstable_mockModule('./dockerVersion.js', () => ({ getDockerVersion }));
  jest.unstable_mockModule('@matterbridge/utils/error', () => ({ inspectError }));
  jest.unstable_mockModule('node:fs', () => ({ readFileSync }));

  await import('./workerDockerVersion.js');
  const success = await runPromise;

  return { wrapperName, success, loggerMock, getDockerVersion, inspectError, readFileSync };
}

describe('workerDockerVersion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: gets latest + dev docker versions and logs success with current docker build version', async () => {
    const { wrapperName, success, loggerMock, getDockerVersion, readFileSync } = await runWorkerDockerVersion({
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
  });

  test('success: missing docker build config logs unknown current version', async () => {
    const { success, loggerMock, readFileSync } = await runWorkerDockerVersion({
      readDockerBuildConfigThrows: true,
    });

    expect(success).toBe(true);
    expect(readFileSync).toHaveBeenCalledWith('/matterbridge/.dockerbuild.json', 'utf-8');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.DEBUG, 'Failed to read docker build config');
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, 'Docker version check succeeded: latest=3.5.5, dev=3.5.6-dev, current=unknown');
  });

  test('error: getDockerVersion throws -> logs inspected error and returns false', async () => {
    const { success, loggerMock, inspectError, getDockerVersion } = await runWorkerDockerVersion({ getDockerVersionThrows: true });

    expect(success).toBe(false);
    expect(getDockerVersion).toHaveBeenCalledWith('luligu', 'matterbridge', 'latest');
    expect(inspectError).toHaveBeenCalledWith(expect.anything(), 'Failed to check docker version', expect.any(Error));
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'inspected error');
  });
});
