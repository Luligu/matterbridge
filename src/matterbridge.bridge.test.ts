/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-logger', 'debug', '-matterlogger', 'debug', '-bridge', '-frontend', '8801', '-profile', 'JestBridge', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { jest } from '@jest/globals';

// jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils/utils.js';
import { Environment, StorageService } from '@matter/main';
import path from 'path';
import os from 'os';
import { PluginManager } from './pluginManager.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { pressureSensor } from './matterbridgeDeviceTypes.js';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  // eslint-disable-next-line no-console
  console.log('mockImplementation of process.exit() called');
  return undefined as never;
});

describe('Matterbridge loadInstance() and cleanup() -bridge mode', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

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
  }, 30000);

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    // Reset matterstorage Jest
    const environment = Environment.default;
    environment.vars.set('path.root', path.join(os.homedir(), '.matterbridge', 'matterstorage.Jest'));
    const matterStorageService = environment.get(StorageService);
    expect(matterStorageService).toBeDefined();
    const matterStorageManager = await matterStorageService.open('Matterbridge');
    expect(matterStorageManager).toBeDefined();
    await matterStorageManager?.createContext('persist').clearAll();
    await matterStorageManager?.createContext('events')?.clearAll();
    await matterStorageManager?.createContext('fabrics')?.clearAll();
    await matterStorageManager?.createContext('root')?.clearAll();
    await matterStorageManager?.createContext('sessions')?.clearAll();

    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    matterbridge.log.warn('***Matterbridge instance loaded');
    expect(matterbridge.profile).toBe('JestBridge');
    expect(matterbridge.bridgeMode).toBe('bridge');

    // Clear all plugins
    matterbridge.plugins.clear();
    await matterbridge.plugins.saveToStorage();

    expect((matterbridge as any).initialized).toBeTruthy();
    expect((matterbridge as any).log).toBeDefined();
    expect((matterbridge as any).homeDirectory).not.toBe('');
    expect((matterbridge as any).matterbridgeDirectory).not.toBe('');
    expect((matterbridge as any).plugins).toBeDefined();
    expect((matterbridge as any).plugins.size).toBe(0);
    expect((matterbridge as any).devices).toBeDefined();
    expect((matterbridge as any).devices.size).toBe(0);

    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();

    expect((matterbridge as any).nodeStorage).toBeDefined();
    expect((matterbridge as any).nodeContext).toBeDefined();
    expect((matterbridge as any).nodeStorageName).toBe('storage.JestBridge');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).matterStorageName).toBe('matterstorage.JestBridge');

    expect((matterbridge as any).serverNode).toBeDefined();
    expect((matterbridge as any).aggregatorNode).toBeDefined();

    expect((matterbridge as any).mdnsInterface).toBe(undefined);
    expect((matterbridge as any).port).toBe(5555 + 1);
    expect((matterbridge as any).passcode).toBe(123456 + 1);
    expect((matterbridge as any).discriminator).toBe(3860 + 1);

    await waiter(
      'Matter server started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
      },
      false,
      60000,
      1000,
      true,
    );

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8801${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval for Matterbridge`);
  }, 60000);

  test('stop advertise node', async () => {
    await matterbridge.stopAdvertiseServerNode(matterbridge.serverNode);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Stopped advertising for Matterbridge`);
  });

  test('advertise node', async () => {
    const pairing = await matterbridge.advertiseServerNode(matterbridge.serverNode);
    expect(pairing).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Advertising for Matterbridge is now started`));
  });

  test('add plugin', async () => {
    plugins = (matterbridge as any).plugins;
    expect(plugins.length).toBe(0);
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    expect(plugins.length).toBe(1);
    expect(await plugins.add('./src/mock/plugin2')).not.toBeNull();
    expect(plugins.length).toBe(2);
    expect(await plugins.add('./src/mock/plugin3')).not.toBeNull();
    expect(plugins.length).toBe(3);
  });

  test('load plugins', async () => {
    plugins = (matterbridge as any).plugins;
    for (const plugin of plugins) {
      await plugins.load(plugin);
      expect(plugin.loaded).toBeTruthy();
    }
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('Restart initialize() -bridge mode', async () => {
    expect((matterbridge as any).initialized).toBeFalsy();
    await matterbridge.initialize();
    expect((matterbridge as any).initialized).toBeTruthy();

    plugins = (matterbridge as any).plugins;
    expect(plugins.length).toBe(3);
    for (const plugin of plugins) {
      expect(plugin.type).toBe('DynamicPlatform');
    }

    await waiter(
      'Matter server started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
      },
      false,
      60000,
      1000,
      true,
    );

    for (const plugin of plugins) {
      expect(plugin.serverNode).toBeUndefined();
      expect(plugin.aggregatorNode).toBeUndefined();
    }
    expect(matterbridge.serverNode?.lifecycle.isReady).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isCommissioned).toBeFalsy();
  }, 60000);

  test('stop advertise node 2', async () => {
    await matterbridge.stopAdvertiseServerNode(matterbridge.serverNode);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Stopped advertising for Matterbridge`);
  });

  test('advertise node 2', async () => {
    const pairing = await matterbridge.advertiseServerNode(matterbridge.serverNode);
    expect(pairing).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Advertising for Matterbridge is now started`));
  });

  test('add device -bridge mode', async () => {
    let i = 1;
    for (const plugin of plugins) {
      const device = new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'pressureSensor' + i })
        .createDefaultBridgedDeviceBasicInformationClusterServer('Pressure sensor ' + i, '0x123456789', 0xfff1, 'Matterbridge', 'PressureSensor')
        .addRequiredClusterServers();
      expect(device).toBeDefined();
      device.plugin = 'matterbridge-mock' + i;
      await matterbridge.addBridgedEndpoint('matterbridge-mock' + i++, device);
    }
  }, 60000);

  test('remove all devices', async () => {
    expect(plugins.length).toBe(3);
    expect(matterbridge.devices.size).toBe(3);
    let i = 1;
    for (const plugin of plugins) {
      expect(plugin.type).toBe('DynamicPlatform');
      expect(plugin.addedDevices).toBe(1);
      expect(plugin.registeredDevices).toBe(1);
      await matterbridge.removeAllBridgedEndpoints('matterbridge-mock' + i);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${'matterbridge-mock' + i}${db}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Removing bridged endpoint ${plg}${'matterbridge-mock' + i++}${db}`));
      expect(plugin.addedDevices).toBe(0);
      expect(plugin.registeredDevices).toBe(0);
    }
    expect(plugins.length).toBe(3);
    expect(matterbridge.devices.size).toBe(0);
  }, 60000);

  test('Again Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('Cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
  }, 60000);
});
