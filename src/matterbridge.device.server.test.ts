// src\matterbridge.device.server.test.ts

const MATTER_PORT = 6012;
const NAME = 'MatterbridgeDeviceServer';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.server.test.js', '-novirtual', '-logger', 'debug', '-matterlogger', 'debug', '-bridge', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

import { jest } from '@jest/globals';
import path from 'node:path';
import { rmSync } from 'node:fs';
import { Environment } from '@matter/main';
import { AnsiLogger, db, LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.ts';
import { PluginManager } from './pluginManager.ts';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.ts';
import { DeviceManager } from './deviceManager.ts';
import { dev, plg } from './matterbridgeTypes.ts';

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  // eslint-disable-next-line no-console
  console.log('mockImplementation of process.exit() called');
  return undefined as never;
});

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

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

describe('Matterbridge Device serverMode=server', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;
  let devices: DeviceManager;
  let serverDevice: MatterbridgeEndpoint;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  }, 30000);

  test('Matterbridge.loadInstance(true)', async () => {
    // Load Matterbridge instance and initialize it
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBeUndefined();
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect(Environment.default.vars.get('path.root')).toBe(path.join(HOMEDIR, '.matterbridge', 'matterstorage'));

    // Clear all plugins
    plugins = matterbridge.plugins;
    matterbridge.plugins.clear();
    await matterbridge.plugins.saveToStorage();

    // Clear all devices
    devices = matterbridge.devices;
    matterbridge.devices.clear();

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
    expect((matterbridge as any).nodeStorageName).toBe('storage');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).matterStorageName).toBe('matterstorage');

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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval for Matterbridge`);
  }, 60000);

  test('add mocked plugin pluginserverdevice', async () => {
    expect(plugins.length).toBe(0);

    await new Promise<void>((resolve) => {
      plugins.once('added', (name) => {
        if (name === 'serverdevicetest') resolve();
      });
      plugins.add('./src/mock/pluginserverdevice');
    });

    expect(plugins.length).toBe(1);
    expect(plugins.get('serverdevicetest')).toBeDefined();
    expect(plugins.get('serverdevicetest')?.type).toBe('AnyPlatform');
  });

  test('load plugins', async () => {
    expect(matterbridge.plugins.size).toBe(1);
    expect(matterbridge.devices.size).toBe(0);

    await new Promise<void>((resolve) => {
      plugins.once('loaded', (name) => {
        if (name === 'serverdevicetest') resolve();
      });
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      plugins.load(plugins.get('serverdevicetest')!);
    });

    expect(matterbridge.plugins.size).toBe(1);
    expect(matterbridge.devices.size).toBe(0);
    expect(plugins.get('serverdevicetest')).toBeDefined();
    expect(plugins.get('serverdevicetest')?.type).toBe('AccessoryPlatform');
  });

  test('Matterbridge.destroyInstance()', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();

    // Let any already‐queued microtasks run first
    await Promise.resolve();

    // Wait for the cleanup to finish
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('Restart initialize()', async () => {
    expect((matterbridge as any).initialized).toBeFalsy();
    await matterbridge.initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    plugins = matterbridge.plugins;
    expect(plugins.length).toBe(1);

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
      plugins.on('started', (name) => {
        if (name === 'serverdevicetest') resolve();
      });
    });

    await Promise.all([online, deviceOnline, started]);

    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Creating server node for device ${dev}Server node device${db} of plugin ${plg}serverdevicetest${db}...`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Creating device ${plg}serverdevicetest${db}:${dev}Server node device${db} server node...`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Adding ${plg}serverdevicetest${db}:${dev}Server node device${db} to server node...`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Added ${plg}serverdevicetest${db}:${dev}Server node device${db} to server node`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Starting server node for device ${dev}Server node device${db} in server mode...`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating server node for device`));

    expect(plugins.get('serverdevicetest')).toBeDefined();
    expect(plugins.get('serverdevicetest')?.serverNode).toBeUndefined();
    expect(plugins.get('serverdevicetest')?.aggregatorNode).toBeUndefined();

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
  }, 60000);

  test('Should log error if createDeviceServerNode fails', async () => {
    jest.spyOn(Matterbridge.prototype as any, 'createDeviceServerNode').mockImplementationOnce(() => {
      throw new Error('Test error creating server node');
    });
    await matterbridge.addBridgedEndpoint('serverdevicetest', { mode: 'server' } as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating server node for device`));
  });

  test('Finally Matterbridge.destroyInstance()', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();

    // Let any already‐queued microtasks run first
    await Promise.resolve();

    // Wait for the cleanup to finish
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);
});
