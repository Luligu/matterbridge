import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  getDockerVersionThrows?: boolean;
  dockerVersionLatest?: string;
  dockerVersionDev?: string;
  dockerBuildConfigJson?: string;
  readDockerBuildConfigThrows?: boolean;
}>;

async function runWorkerDockerVersion(options: RunOptions) {
  vi.resetModules();

  const loggerMock = vi.fn();
  const snackBarMock = vi.fn();
  const requestMock = vi.fn();

  const worker = {
    logger: loggerMock,
    snackBar: snackBarMock,
    log: { debug: vi.fn() },
    server: { request: requestMock },
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const getDockerVersion = options.getDockerVersionThrows
    ? vi.fn(async () => {
        throw new Error('getDockerVersion failed');
      })
    : vi.fn(async (_owner: string, _repo: string, tag?: string) => {
        if (tag === 'dev') return options.dockerVersionDev ?? '3.5.6-dev';
        return options.dockerVersionLatest ?? '3.5.5';
      });

  const inspectError = vi.fn(() => 'inspected error');
  const readFileSync = options.readDockerBuildConfigThrows
    ? vi.fn(() => {
        throw new Error('readFileSync failed');
      })
    : vi.fn(() => options.dockerBuildConfigJson ?? '{"version":"3.5.4","dev":false}');

  vi.doMock('../src/workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  vi.doMock('../src/dockerVersion.js', () => ({ getDockerVersion }));
  vi.doMock('@matterbridge/utils/error', () => ({ inspectError }));
  vi.doMock('node:fs', () => ({ readFileSync }));

  await import('../src/workerDockerVersion.js');
  const success = await runPromise;

  return { wrapperName, success, loggerMock, snackBarMock, requestMock, getDockerVersion, inspectError, readFileSync };
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
