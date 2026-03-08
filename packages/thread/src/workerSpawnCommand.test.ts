import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  spawnSuccess: boolean;
}>;

async function runWorkerSpawnCommand(options: RunOptions) {
  jest.resetModules();

  const loggerMock = jest.fn();
  const worker = {
    logger: loggerMock,
    log: { debug: jest.fn() },
    server: {},
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

  const workerData = {
    command: 'echo',
    args: ['--foo', 'bar'],
    packageCommand: 'build',
    packageName: '@matterbridge/thread',
  };

  const spawnCommand = jest.fn(async () => options.spawnSuccess);

  jest.unstable_mockModule('node:worker_threads', async () => {
    const actual = jest.requireActual<any>('node:worker_threads');
    return { ...actual, workerData };
  });

  jest.unstable_mockModule('./spawnCommand.js', () => ({ spawnCommand }));

  jest.unstable_mockModule('./workerWrapper.js', () => ({
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    WorkerWrapper: class {
      constructor(name: string, callback: (w: any) => Promise<boolean>) {
        wrapperName = name;
        runPromise = callback(worker);
      }
    },
  }));

  await import('./workerSpawnCommand.js');
  const success = await runPromise;

  return { wrapperName, success, loggerMock, spawnCommand, workerData };
}

describe('workerSpawnCommand', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: spawns command and logs success', async () => {
    const { wrapperName, success, loggerMock, spawnCommand, workerData } = await runWorkerSpawnCommand({ spawnSuccess: true });

    expect(wrapperName).toBe('GlobalPrefix');
    expect(success).toBe(true);

    expect(spawnCommand).toHaveBeenCalledWith(workerData.command, workerData.args, workerData.packageCommand, workerData.packageName);
    expect(loggerMock).toHaveBeenCalledWith(
      LogLevel.INFO,
      `Starting spawn command ${workerData.command} with args ${workerData.args.join(' ')} and package command ${workerData.packageCommand} for package ${workerData.packageName}...`,
    );
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.INFO, `Spawn command ${workerData.command} with args ${workerData.args.join(' ')} executed successfully`);
  });

  test('failure: logs error when spawnCommand returns false', async () => {
    const { success, loggerMock, spawnCommand, workerData } = await runWorkerSpawnCommand({ spawnSuccess: false });

    expect(success).toBe(false);
    expect(spawnCommand).toHaveBeenCalledWith(workerData.command, workerData.args, workerData.packageCommand, workerData.packageName);
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, `Spawn command ${workerData.command} with args ${workerData.args.join(' ')} failed`);
  });
});
