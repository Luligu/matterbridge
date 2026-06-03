import { jest } from '@jest/globals';
import { id, LogLevel } from 'node-ansi-logger';

type RunOptions = Readonly<{
  spawnSuccess: boolean;
  workerData?: Record<string, unknown>;
}>;

async function runWorkerSpawnCommand(options: RunOptions) {
  jest.resetModules();

  const loggerMock = jest.fn();
  const respondMock = jest.fn();

  const workerData = {
    command: 'echo',
    args: ['--foo', 'bar'],
    packageCommand: 'install',
    packageName: '@matterbridge/thread',
    threadName: 'SpawnCommand',
    logLevel: LogLevel.INFO,
    debug: false,
    verbose: false,
    tracker: false,
    ...options.workerData,
  };

  const worker = {
    logger: loggerMock,
    log: { debug: jest.fn() },
    server: { respond: respondMock, getUniqueId: () => 123456789 },
    workerData,
  } as any;

  let wrapperName: string | undefined;
  let runPromise: Promise<boolean> | undefined;

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

  return { wrapperName, success, loggerMock, respondMock, spawnCommand, workerData };
}

describe('workerSpawnCommand', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('success: spawns command and logs success', async () => {
    const { wrapperName, success, loggerMock, respondMock, spawnCommand, workerData } = await runWorkerSpawnCommand({ spawnSuccess: true });

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

  test('failure: logs error when spawnCommand returns false', async () => {
    const { success, loggerMock, respondMock, spawnCommand, workerData } = await runWorkerSpawnCommand({ spawnSuccess: false });

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

  test('invalid workerData: logs error and returns false without spawning', async () => {
    const { success, loggerMock, respondMock, spawnCommand } = await runWorkerSpawnCommand({
      spawnSuccess: true,
      workerData: { packageCommand: 'build' },
    });

    expect(success).toBe(false);
    expect(spawnCommand).not.toHaveBeenCalled();
    expect(loggerMock).toHaveBeenCalledWith(LogLevel.ERROR, 'SpawnCommand invalid parameters');
    expect(respondMock).not.toHaveBeenCalled();
  });
});
