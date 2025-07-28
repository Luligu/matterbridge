// src\matterbridge.matterjs.test.ts

/* eslint-disable no-console */

const MATTER_PORT = 6010;
const NAME = 'MatterbridgeMatterjs';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.matterjs.test.js', '-novirtual', '-logger', 'debug', '-matterlogger', 'debug', '-bridge', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

import { jest } from '@jest/globals';
import path from 'node:path';
import { rmSync } from 'node:fs';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { Environment, FabricIndex, NodeLifecycle } from '@matter/main';

import { Matterbridge } from './matterbridge.ts';
import { FabricAction } from '@matter/main/protocol';

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  console.log('mockImplementation of process.exit() called');
  return undefined as never;
});

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge matterjs', () => {
  let matterbridge: Matterbridge;

  beforeAll(async () => {
    //
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    // Load Matterbridge instance and initialize it
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe(undefined);
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, 'matterstorage'));
    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).serverNode).toBeDefined();
    expect((matterbridge as any).aggregatorNode).toBeDefined();

    await new Promise((resolve) => {
      matterbridge.once('online', resolve);
    });
    await Promise.resolve();

    expect((matterbridge as any).endAdvertiseTimeout).toBeDefined();

    // Check the starts the matter storage
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Starting matter node storage...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Matter node storage started`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Creating matter node storage backup...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Created matter node storage backup`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Creating server node storage context "Matterbridge.persist" for Matterbridge...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Created server node storage context "Matterbridge.persist" for Matterbridge:`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Creating server node for Matterbridge on port ${MATTER_PORT}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Created server node for Matterbridge`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval for Matterbridge`);
  }, 60000);

  test('backupMatterStorage fails for empty values', async () => {
    await (matterbridge as any).backupMatterStorage('', '');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating matter node storage backup`), expect.any(Error));
  });

  test('backupMatterStorage fails for same values', async () => {
    await (matterbridge as any).backupMatterStorage('src', 'src');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating matter node storage backup`), expect.any(Error));
  });

  test('backupMatterStorage fails for undefined values', async () => {
    await (matterbridge as any).backupMatterStorage(undefined, undefined);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating matter node storage backup`), expect.any(Error));
  });

  test('createServerNodeContext fails for empty values', async () => {
    const matterStorageService = (matterbridge as any).matterStorageService;
    (matterbridge as any).matterStorageService = undefined;
    await expect((matterbridge as any).createServerNodeContext()).rejects.toThrow('No storage service initialized');
    (matterbridge as any).matterStorageService = matterStorageService;
  });

  test('serverNode commissioned', async () => {
    matterbridge.serverNode?.lifecycle.commissioned.emit(undefined as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge was initially commissioned successfully!`);
  });

  test('serverNode decommissioned', async () => {
    matterbridge.serverNode?.lifecycle.decommissioned.emit(undefined as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge was fully decommissioned successfully!`);
  });

  test('serverNode endAdvertiseTimeout', async () => {
    expect((matterbridge as any).endAdvertiseTimeout).toBeDefined();
  });

  test('serverNode fabricsChanged', async () => {
    matterbridge.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), FabricAction.Added);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} added on server node`));
    matterbridge.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), FabricAction.Removed);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} removed on server node`));
    matterbridge.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), FabricAction.Updated);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} updated on server node`));
  });

  test('serverNode sessions.opened', async () => {
    matterbridge.serverNode?.events.sessions.opened.emit({} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Session opened on server node for Matterbridge`));
  });

  test('serverNode sessions.closed', async () => {
    matterbridge.serverNode?.events.sessions.closed.emit({} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Session closed on server node for Matterbridge`));
  });

  test('serverNode sessions.subscriptionsChanged', async () => {
    matterbridge.serverNode?.events.sessions.subscriptionsChanged.emit({} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Session subscriptions changed on server node for Matterbridge`));
  });

  test('startServerNode undefined', async () => {
    await (matterbridge as any).startServerNode();
    expect(loggerLogSpy).toHaveBeenCalledTimes(0);
  });

  test('stopServerNode undefined', async () => {
    await (matterbridge as any).stopServerNode();
    expect(loggerLogSpy).toHaveBeenCalledTimes(0);
  });

  test('stop advertise node', async () => {
    await matterbridge.stopAdvertiseServerNode(matterbridge.serverNode);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Stopped advertising for Matterbridge`);
  });

  test('advertise node', async () => {
    const pairing = await matterbridge.advertiseServerNode(matterbridge.serverNode);
    expect(pairing).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Started advertising for Matterbridge`));
  });

  test('startEndAdvertiseTimer', async () => {
    expect((matterbridge as any).endAdvertiseTimeout).toBeDefined();
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBe(true);

    jest.useFakeTimers();
    (matterbridge as any).startEndAdvertiseTimer(matterbridge.serverNode);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Clear ${matterbridge.serverNode?.id} server node end advertise timer`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Starting ${matterbridge.serverNode?.id} server node end advertise timer`));
    jest.advanceTimersByTime(15 * 60 * 1000); // Advance time by 15 minutes
    jest.useRealTimers();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Advertising stopped. Restart to commission again.`));
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBe(true);

    jest.spyOn(matterbridge.serverNode as any, 'close').mockImplementationOnce(() => {
      throw new Error('Test error creating server node');
    });
    await (matterbridge as any).stopServerNode(matterbridge.serverNode, 100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Closing Matterbridge server node`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to close Matterbridge server node`));
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    await Promise.resolve();

    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing matter node storage...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Matter node storage closed`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);
});
