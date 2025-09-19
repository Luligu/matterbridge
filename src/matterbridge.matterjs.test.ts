// src\matterbridge.matterjs.test.ts

const MATTER_PORT = 6010;
const NAME = 'MatterbridgeMatterjs';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.matterjs.test.js', '-novirtual', '-logger', 'debug', '-matterlogger', 'debug', '-bridge', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';
import { Environment, FabricIndex } from '@matter/main';
import { FabricAction } from '@matter/main/protocol';

import { Matterbridge } from './matterbridge.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge matterjs', () => {
  let matterbridge: Matterbridge;

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
    // await Promise.resolve();

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
