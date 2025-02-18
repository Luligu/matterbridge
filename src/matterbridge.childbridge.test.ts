/* eslint-disable @typescript-eslint/no-unused-vars */

/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-logger', 'debug', '-matterlogger', 'debug', '-childbridge', '-frontend', '8802', '-profile', 'JestChildbridge', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { jest } from '@jest/globals';

import { AnsiLogger, db, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/export.js';
import { Environment, StorageService } from '@matter/main';
import path from 'node:path';
import os from 'node:os';
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

describe('Matterbridge loadInstance() and cleanup() -childbridge mode', () => {
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

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Matterbridge.loadInstance(true) -childbridge mode', async () => {
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
    plugins = (matterbridge as any).plugins;

    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('JestChildbridge');
    expect(matterbridge.bridgeMode).toBe('childbridge');

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
    expect((matterbridge as any).nodeStorageName).toBe('storage.JestChildbridge');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).matterStorageName).toBe('matterstorage.JestChildbridge');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).serverNode).toBeUndefined();
    expect((matterbridge as any).aggregatorNode).toBeUndefined();

    expect((matterbridge as any).mdnsInterface).toBe(undefined);
    expect((matterbridge as any).port).toBe(5555);
    expect((matterbridge as any).passcode).toBe(123456);
    expect((matterbridge as any).discriminator).toBe(3860);

    await waiter(
      'Matterbridge started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined;
      },
      false,
      60000,
      1000,
      true,
    );

    // Now in childbridgemode we have no serverNodes running since 0 plugins.

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8802${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in childbridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in childbridge mode`);
  }, 60000);

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

  test('create and start server node for each plugin', async () => {
    plugins = (matterbridge as any).plugins;
    for (const plugin of plugins) {
      await (matterbridge as any).createDynamicPlugin(plugin, true);
      expect(plugin.serverNode).toBeDefined();
      expect(plugin.aggregatorNode).toBeDefined();
      expect(plugin.serverNode?.lifecycle.isReady).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isOnline).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isCommissioned).toBeFalsy();
      await plugins.load(plugin);
      expect(plugin.loaded).toBeTruthy();
    }
  });

  test('Matterbridge.destroyInstance() -childbridge mode', async () => {
    expect(matterbridge.bridgeMode).toBe('childbridge');
    for (const plugin of plugins) {
      expect(plugin.serverNode).toBeDefined();
      expect(plugin.aggregatorNode).toBeDefined();
    }
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock1 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock2 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock3 MdnsService`);
  }, 60000);

  test('Restart initialize() -childbridge mode', async () => {
    expect((matterbridge as any).initialized).toBeFalsy();
    await matterbridge.initialize();
    expect((matterbridge as any).initialized).toBeTruthy();

    plugins = (matterbridge as any).plugins;
    expect(plugins.length).toBe(3);
    for (const plugin of plugins) {
      expect(plugin.type).toBe('DynamicPlatform');
    }

    await waiter(
      'Matterbridge started',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && plugins.array()[0].reachabilityTimeout !== undefined && plugins.array()[1].reachabilityTimeout !== undefined && plugins.array()[2].reachabilityTimeout !== undefined;
      },
      false,
      60000,
      1000,
      true,
    );

    await waiter(
      'Matter servers online',
      () => {
        return plugins.array()[0].serverNode?.lifecycle.isOnline === true && plugins.array()[1].serverNode?.lifecycle.isOnline === true && plugins.array()[2].serverNode?.lifecycle.isOnline === true;
      },
      false,
      60000,
      1000,
      true,
    );

    for (const plugin of plugins) {
      expect(plugin.serverNode).toBeDefined();
      expect(plugin.aggregatorNode).toBeDefined();
      expect(plugin.serverNode?.lifecycle.isReady).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isOnline).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isCommissioned).toBeFalsy();
    }
  }, 60000);

  test('stop advertise node', async () => {
    for (const plugin of plugins) {
      await matterbridge.stopAdvertiseServerNode(plugin.serverNode);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Stopped advertising for ${plugin.name}`));
    }
  });

  test('advertise node', async () => {
    for (const plugin of plugins) {
      const pairing = await matterbridge.advertiseServerNode(plugin.serverNode);
      expect(pairing).toBeDefined();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining(`Started advertising for ${plugin.name}`));
    }
  });

  test('add device -childbridge mode', async () => {
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

  test('Again Matterbridge.destroyInstance() -childbridge mode', async () => {
    expect(matterbridge.bridgeMode).toBe('childbridge');
    for (const plugin of plugins) {
      expect(plugin.serverNode).toBeDefined();
    }
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock1 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock2 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock3 MdnsService`);
  }, 60000);

  test('Cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
  }, 60000);
});
