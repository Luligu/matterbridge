// src\matterbridge.childbridge.test.ts

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-console */
/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = [
  'node',
  'matterbridge.test.js',
  '-novirtual',
  '-logger',
  'debug',
  '-matterlogger',
  'debug',
  '-childbridge',
  '-frontend',
  '8802',
  '-homedir',
  'matterstorage/MatterbridgeChildBridge',
  '-profile',
  'JestChildbridge',
  '-port',
  '5555',
  '-passcode',
  '123456',
  '-discriminator',
  '3860',
];

import { jest } from '@jest/globals';
import path from 'node:path';
import { Environment } from '@matter/main';
import { AnsiLogger, db, LogLevel, pl, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils/export.js';
import { PluginManager } from './pluginManager.js';
import { rmSync } from 'node:fs';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

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
rmSync('matterstorage/MatterbridgeChildBridge', { recursive: true, force: true });

describe('Matterbridge loadInstance() and cleanup() -childbridge mode', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;

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
    // Load Matterbridge instance and initialize it
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('JestChildbridge');
    expect(matterbridge.bridgeMode).toBe('childbridge');
    expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, 'matterstorage.JestChildbridge'));

    // Clear all plugins
    plugins = matterbridge.plugins;
    plugins.clear();
    await plugins.saveToStorage();

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
      100,
      true,
    );

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8802${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in childbridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in childbridge mode`);
  }, 60000);

  test('add plugin', async () => {
    expect(plugins.length).toBe(0);
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    expect(plugins.length).toBe(1);
    expect(await plugins.add('./src/mock/plugin2')).not.toBeNull();
    expect(plugins.length).toBe(2);
    expect(await plugins.add('./src/mock/plugin3')).not.toBeNull();
    expect(plugins.length).toBe(3);
    expect(await plugins.add('./src/mock/plugin4')).not.toBeNull();
    expect(plugins.length).toBe(4);
    expect(plugins.get('matterbridge-mock1')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock2')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock3')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock4')?.type).toBe('AnyPlatform');
  });

  test('create and start server node for each plugin', async () => {
    plugins = (matterbridge as any).plugins;
    expect(plugins.length).toBe(4);
    for (const plugin of plugins.array()) {
      console.log(`${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
    }

    for (const plugin of plugins.array()) {
      console.log(`${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
      await plugins.load(plugin);
      expect(plugin.loaded).toBeTruthy();
      console.log(`Loaded ${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
      await plugins.start(plugin);
      expect(plugin.started).toBeTruthy();
      console.log(`Started ${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
      expect(plugin.serverNode).toBeDefined();
      if (plugin.type === 'DynamicPlatform') expect(plugin.aggregatorNode).toBeDefined();
      if (plugin.type === 'DynamicPlatform') expect(plugin.device).toBeUndefined();
      if (plugin.type === 'AccessoryPlatform') expect(plugin.aggregatorNode).toBeUndefined();
      if (plugin.type === 'AccessoryPlatform') expect(plugin.device).toBeDefined();
      console.log(`Verified ${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
      // Start the Matter server node
      await (matterbridge as any).startServerNode(plugin.serverNode);
      expect(plugin.serverNode?.lifecycle.isReady).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isOnline).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isCommissioned).toBeFalsy();
      console.log(`Started server node for ${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
    }
    for (const plugin of plugins.array()) {
      console.log(`${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
    }
    expect(plugins.get('matterbridge-mock1')?.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-mock2')?.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-mock3')?.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-mock4')?.type).toBe('AccessoryPlatform');
  }, 60000);

  test('Matterbridge.destroyInstance() -childbridge mode', async () => {
    expect(matterbridge.bridgeMode).toBe('childbridge');
    let i = 1;
    for (const plugin of plugins) {
      console.log(`Verify ${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
      expect(plugin.serverNode).toBeDefined();
      if (plugin.type === 'DynamicPlatform') {
        expect(plugin.aggregatorNode).toBeDefined();
        expect(plugin.device).toBeUndefined();
      } else {
        expect(plugin.aggregatorNode).toBeUndefined();
        expect(plugin.device).toBeDefined();
      }
      console.log(`Verified ${pl}${plugin.name}${rs} ${dev}${plugin.type}${rs}`);
      await matterbridge.removeAllBridgedEndpoints('matterbridge-mock' + i);
      i++;
    }
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock1 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock2 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock3 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock4 MdnsService`);
  }, 60000);

  test('Restart initialize() -childbridge mode', async () => {
    expect((matterbridge as any).initialized).toBeFalsy();
    await matterbridge.initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    plugins = (matterbridge as any).plugins;
    expect(matterbridge.plugins.size).toBe(4);
    expect(matterbridge.devices.size).toBe(0);

    await waiter(
      'Matterbridge restarted',
      () => {
        return (
          (matterbridge as any).configureTimeout !== undefined &&
          plugins.array()[0].reachabilityTimeout !== undefined &&
          plugins.array()[1].reachabilityTimeout !== undefined &&
          plugins.array()[2].reachabilityTimeout !== undefined &&
          plugins.array()[3].reachabilityTimeout !== undefined
        );
      },
      false,
      10000,
      100,
      true,
    );

    await waiter(
      'Matter servers online',
      () => {
        return (
          plugins.array()[0].serverNode?.lifecycle.isOnline === true &&
          plugins.array()[1].serverNode?.lifecycle.isOnline === true &&
          plugins.array()[2].serverNode?.lifecycle.isOnline === true &&
          plugins.array()[3].serverNode?.lifecycle.isOnline === true
        );
      },
      false,
      10000,
      100,
      true,
    );

    for (const plugin of plugins) {
      expect(plugin.serverNode).toBeDefined();
      if (plugin.type === 'DynamicPlatform') {
        expect(plugin.aggregatorNode).toBeDefined();
        expect(plugin.device).toBeUndefined();
      } else {
        expect(plugin.aggregatorNode).toBeUndefined();
        expect(plugin.device).toBeDefined();
      }
      expect(plugin.serverNode?.lifecycle.isReady).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isOnline).toBeTruthy();
      expect(plugin.serverNode?.lifecycle.isCommissioned).toBeFalsy();
    }

    expect(matterbridge.plugins.size).toBe(4);
    expect(matterbridge.devices.size).toBe(4);
  }, 300000);

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

  test('remove all devices', async () => {
    expect(matterbridge.plugins.size).toBe(4);
    expect(matterbridge.devices.size).toBe(4);
    let i = 1;
    for (const plugin of plugins) {
      expect(plugin.type).toBe(i < 4 ? 'DynamicPlatform' : 'AccessoryPlatform');
      expect(plugin.addedDevices).toBe(1);
      expect(plugin.registeredDevices).toBe(1);
      await matterbridge.removeAllBridgedEndpoints('matterbridge-mock' + i);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${'matterbridge-mock' + i}${db}`);
      if (plugin.type === 'DynamicPlatform') expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Removing bridged endpoint ${plg}${'matterbridge-mock' + i++}${db}`));
      expect(plugin.addedDevices).toBe(0);
      expect(plugin.registeredDevices).toBe(0);
    }
    expect(plugins.length).toBe(4);
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock4 MdnsService`);
  }, 60000);

  test('Cleanup storage', async () => {
    console.log('Cleanup storage started');
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
    console.log('Cleanup storage finished');
  }, 60000);
});
