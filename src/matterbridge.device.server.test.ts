// src\matterbridge.device.server.test.ts

const MATTER_PORT = 6012;
const NAME = 'MatterbridgeDeviceServer';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.server.test.js', '-novirtual', '-logger', 'debug', '-matterlogger', 'debug', '-debug', '-bridge', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

// Mock the createESMWorker from workers module before importing it
jest.unstable_mockModule('./workers.js', () => ({
  createESMWorker: jest.fn(() => {
    return undefined; // Mock the createESMWorker function to return immediately
  }),
}));
const workerModule = await import('./workers.js');
const createESMWorker = workerModule.createESMWorker as jest.MockedFunction<typeof workerModule.createESMWorker>;

import path from 'node:path';

import { jest } from '@jest/globals';
import { Environment } from '@matter/general';
import { db, LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { dev, plg } from './matterbridgeTypes.js';
import { closeMdnsInstance, destroyInstance, loggerLogSpy, setupTest } from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge Device serverMode=server', () => {
  let matterbridge: Matterbridge;
  let serverDevice: MatterbridgeEndpoint;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Matterbridge.loadInstance(true)', async () => {
    // Load Matterbridge instance and initialize it
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateInterval).toBeDefined();
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);
    expect(matterbridge.profile).toBeUndefined();
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect(Environment.default.vars.get('path.root')).toBe(path.join(HOMEDIR, '.matterbridge', 'matterstorage'));

    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).toBe(HOMEDIR);
    expect((matterbridge as any).matterbridgeDirectory).toBe(path.join(HOMEDIR, '.matterbridge'));
    expect((matterbridge as any).matterbridgePluginDirectory).toBe(path.join(HOMEDIR, 'Matterbridge'));
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).plugins.size).toBe(0);
    expect((matterbridge as any).devices).toBeDefined();
    expect((matterbridge as any).devices.size).toBe(0);

    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();

    expect((matterbridge as any).serverNode).toBeDefined();
    expect((matterbridge as any).aggregatorNode).toBeDefined();

    expect((matterbridge as any).mdnsInterface).toBe(undefined);
    expect((matterbridge as any).port).toBe(MATTER_PORT + 1);
    expect((matterbridge as any).passcode).toBeDefined();
    expect((matterbridge as any).discriminator).toBeDefined();

    await new Promise<void>((resolve) => {
      matterbridge.once('online', (name) => {
        if (name === 'Matterbridge') resolve();
      });
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in bridge mode`);
  }, 60000);

  test('add mocked plugin pluginserverdevice', async () => {
    expect(matterbridge.plugins.length).toBe(0);

    await new Promise<void>((resolve) => {
      matterbridge.plugins.once('added', (name) => {
        if (name === 'serverdevicetest') resolve();
      });
      matterbridge.plugins.add('./src/mock/pluginserverdevice');
    });

    expect(matterbridge.plugins.length).toBe(1);
    expect(matterbridge.plugins.get('serverdevicetest')).toBeDefined();
    expect(matterbridge.plugins.get('serverdevicetest')?.type).toBe('AnyPlatform');
  });

  test('load mocked plugin serverdevicetest', async () => {
    expect(matterbridge.plugins.size).toBe(1);
    expect(matterbridge.devices.size).toBe(0);

    await new Promise<void>((resolve) => {
      matterbridge.plugins.once('loaded', (name) => {
        if (name === 'serverdevicetest') resolve();
      });
      const plugin = matterbridge.plugins.get('serverdevicetest');
      expect(plugin).toBeDefined();
      if (plugin) matterbridge.plugins.load(plugin);
    });

    expect(matterbridge.plugins.size).toBe(1);
    expect(matterbridge.devices.size).toBe(0);
    expect(matterbridge.plugins.get('serverdevicetest')).toBeDefined();
    expect(matterbridge.plugins.get('serverdevicetest')?.type).toBe('AccessoryPlatform');
  });

  test('Matterbridge.destroyInstance()', async () => {
    const stopServerNodeSpy = jest.spyOn(matterbridge as any, 'stopServerNode');

    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 0, 0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(stopServerNodeSpy).toHaveBeenCalledTimes(1);
  });

  test('Restart initialize()', async () => {
    const startServerNodeSpy = jest.spyOn(matterbridge as any, 'startServerNode');

    expect((matterbridge as any).initialized).toBeFalsy();
    await (matterbridge as any).initialize();
    expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateInterval).toBeDefined();
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);
    expect((matterbridge as any).initialized).toBeTruthy();

    expect(matterbridge.plugins.length).toBe(1);

    const online = new Promise<void>((resolve) => {
      matterbridge.on('online', (name) => {
        if (name === 'Matterbridge') resolve();
      });
    });

    const deviceOnline = new Promise<void>((resolve) => {
      matterbridge.on('online', (name) => {
        if (name === 'Servernodedevice') resolve();
      });
    });

    const started = new Promise<void>((resolve) => {
      matterbridge.plugins.on('started', (name) => {
        if (name === 'serverdevicetest') resolve();
      });
    });

    await Promise.all([online, deviceOnline, started]);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Creating server node for device ${dev}Server node device${db} of plugin ${plg}serverdevicetest${db}...`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Creating device ${plg}serverdevicetest${db}:${dev}Server node device${db} server node...`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Adding ${plg}serverdevicetest${db}:${dev}Server node device${db} to server node...`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Added ${plg}serverdevicetest${db}:${dev}Server node device${db} to server node`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Starting server node for device ${dev}Server node device${db} in server mode...`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating server node for device`));

    expect(startServerNodeSpy).toHaveBeenCalledTimes(2);

    expect(matterbridge.plugins.get('serverdevicetest')).toBeDefined();
    expect(matterbridge.plugins.get('serverdevicetest')?.serverNode).toBeUndefined();
    expect(matterbridge.plugins.get('serverdevicetest')?.aggregatorNode).toBeUndefined();

    expect(matterbridge.serverNode?.lifecycle.isReady).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isCommissioned).toBeFalsy();
    expect(matterbridge.plugins.size).toBe(1);
    expect(matterbridge.devices.size).toBe(1);

    for (const device of matterbridge.devices) {
      expect(device.uniqueId).toBeDefined();
      expect(device.mode).toBe('server');
      expect(device.serverNode).toBeDefined();
      serverDevice = device;
    }
  }, 60000);

  test('Check device server node online', async () => {
    expect(serverDevice.serverNode).toBeDefined();
    expect(serverDevice.serverNode?.lifecycle.isReady).toBeTruthy();
    expect(serverDevice.serverNode?.lifecycle.isOnline).toBeTruthy();
    expect(serverDevice.serverNode?.lifecycle.isCommissioned).toBeFalsy();
  });

  test('Should log error if createDeviceServerNode fails', async () => {
    jest.spyOn(Matterbridge.prototype as any, 'createDeviceServerNode').mockImplementationOnce(() => {
      throw new Error('Test error creating server node');
    });
    await matterbridge.addBridgedEndpoint('serverdevicetest', { mode: 'server' } as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating server node for device`));
  });

  test('Finally Matterbridge.destroyInstance() with -bridge', async () => {
    const stopServerNodeSpy = jest.spyOn(matterbridge as any, 'stopServerNode');

    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 0, 0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(stopServerNodeSpy).toHaveBeenCalledTimes(2);
  });
});
