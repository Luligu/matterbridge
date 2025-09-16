// src\matterbridge.bridge.test.ts

/* eslint-disable jest/no-conditional-expect */

const MATTER_PORT = 6013;
const NAME = 'MatterbridgeBridge';
const HOMEDIR = path.join('jest', NAME);

process.argv = [
  'node',
  'matterbridge.test.js',
  '-novirtual',
  '-logger',
  'debug',
  '-matterlogger',
  'debug',
  '-bridge',
  '-frontend',
  '8801',
  '-homedir',
  HOMEDIR,
  '-profile',
  'JestBridge',
  '-port',
  MATTER_PORT.toString(),
  '-passcode',
  '123456',
  '-discriminator',
  '3860',
];

import path from 'node:path';

import { jest } from '@jest/globals';
import { Environment } from '@matter/main';
import { db, LogLevel, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors';

import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils/export.js';
import { PluginManager } from './pluginManager.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { pressureSensor } from './matterbridgeDeviceTypes.js';
import { plg } from './matterbridgeTypes.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge loadInstance() and cleanup() -bridge mode', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;

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
    expect(matterbridge.profile).toBe('JestBridge');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, 'matterstorage.JestBridge'));

    // Clear all plugins
    plugins = matterbridge.plugins;
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
    expect((matterbridge as any).port).toBe(MATTER_PORT + 1);
    expect((matterbridge as any).passcode).toBe(123456 + 1);
    expect((matterbridge as any).discriminator).toBe(3860 + 1);

    await new Promise((resolve) => {
      matterbridge.once('online', resolve);
    });
    // await Promise.resolve();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8801${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval for Matterbridge`);
  }, 60000);

  test('addBridgedEndpoint with invalid plugin', async () => {
    await matterbridge.addBridgedEndpoint('invalid-plugin', {} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error adding bridged endpoint`));
  });

  test('removeBridgedEndpoint with invalid plugin', async () => {
    await matterbridge.removeBridgedEndpoint('invalid-plugin', {} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error removing bridged endpoint`));
  });

  test('addBridgedEndpoint with no aggregator', async () => {
    const aggregator = matterbridge.aggregatorNode;
    matterbridge.aggregatorNode = undefined;
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    await matterbridge.addBridgedEndpoint('matterbridge-mock1', {} as any);
    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
    matterbridge.aggregatorNode = aggregator;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Aggregator node not found for Matterbridge`));
  });

  test('removeBridgedEndpoint with no aggregator', async () => {
    const aggregator = matterbridge.aggregatorNode;
    matterbridge.aggregatorNode = undefined;
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    await matterbridge.removeBridgedEndpoint('matterbridge-mock1', {} as any);
    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
    matterbridge.aggregatorNode = aggregator;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`aggregator node not found`));
  });

  test('addBridgedEndpoint fails adding', async () => {
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    await matterbridge.addBridgedEndpoint('matterbridge-mock1', {} as any);
    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error adding bridged endpoint`));
  });

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
    expect(await plugins.add('./src/mock/plugin5')).not.toBeNull();
    expect(plugins.length).toBe(5);
    expect(await plugins.add('./src/mock/plugin6')).not.toBeNull();
    expect(plugins.length).toBe(6);
    expect(plugins.get('matterbridge-mock1')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock2')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock3')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock4')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock5')?.type).toBe('AnyPlatform');
    expect(plugins.get('matterbridge-mock6')?.type).toBe('AnyPlatform');
  });

  test('load plugins', async () => {
    expect(matterbridge.plugins.size).toBe(6);
    expect(matterbridge.devices.size).toBe(0);
    for (const plugin of matterbridge.plugins) {
      await matterbridge.plugins.load(plugin);
      expect(plugin.loaded).toBeTruthy();
    }
    expect(matterbridge.plugins.size).toBe(6);
    expect(matterbridge.devices.size).toBe(0);
    expect(plugins.get('matterbridge-mock1')?.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-mock2')?.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-mock3')?.type).toBe('DynamicPlatform');
    expect(plugins.get('matterbridge-mock4')?.type).toBe('AccessoryPlatform');
    expect(plugins.get('matterbridge-mock5')?.type).toBe('AccessoryPlatform');
    expect(plugins.get('matterbridge-mock6')?.type).toBe('AccessoryPlatform');
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('Restart initialize() -bridge mode', async () => {
    expect((matterbridge as any).initialized).toBeFalsy();
    await matterbridge.initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    plugins = matterbridge.plugins;
    expect(plugins.length).toBe(6);

    await waiter(
      'Matter server node restarted',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
      },
      false,
      60000,
      100,
      true,
    );

    await waiter(
      'Matterbridge plugins started',
      () => {
        return plugins.array()[0].started === true && plugins.array()[1].started === true && plugins.array()[2].started === true && plugins.array()[3].started === true && plugins.array()[4].started === true && plugins.array()[5].started === true;
      },
      false,
      60000,
      100,
      true,
    );

    let i = 1;
    for (const plugin of plugins) {
      if (i < 4) expect(plugin.type).toBe('DynamicPlatform');
      else expect(plugin.type).toBe('AccessoryPlatform');
      expect(plugin.serverNode).toBeUndefined();
      expect(plugin.aggregatorNode).toBeUndefined();
      i++;
    }
    expect(matterbridge.serverNode?.lifecycle.isReady).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBeTruthy();
    expect(matterbridge.serverNode?.lifecycle.isCommissioned).toBeFalsy();
    expect(matterbridge.plugins.size).toBe(6);
    expect(matterbridge.devices.size).toBe(6);
  }, 60000);

  test('add device -bridge mode', async () => {
    let i = 1;
    for (const plugin of plugins) {
      if (i >= 4) break;
      const device = new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'pressureSensor' + i })
        .createDefaultBridgedDeviceBasicInformationClusterServer('Pressure sensor ' + i, '0x123456789', 0xfff1, 'Matterbridge', 'PressureSensor')
        .addRequiredClusterServers();
      expect(device).toBeDefined();
      device.plugin = 'matterbridge-mock' + i;
      await matterbridge.addBridgedEndpoint('matterbridge-mock' + i++, device);
    }
  }, 60000);

  test('set reachable -bridge mode', async () => {
    for (const device of matterbridge.devices.array()) {
      expect(device).toBeDefined();
      if (device.hasClusterServer(BridgedDeviceBasicInformationServer)) device?.setStateOf(BridgedDeviceBasicInformationServer, { reachable: false });
    }
  }, 60000);

  test('remove all devices', async () => {
    expect(plugins.length).toBe(6);
    expect(matterbridge.devices.size).toBe(9);
    let i = 1;
    for (const plugin of plugins) {
      expect(plugin.type).toBe(i < 4 ? 'DynamicPlatform' : 'AccessoryPlatform');
      expect(plugin.addedDevices).toBe(i < 4 ? 2 : 1);
      expect(plugin.registeredDevices).toBe(i < 4 ? 2 : 1);
      await matterbridge.removeAllBridgedEndpoints('matterbridge-mock' + i);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${'matterbridge-mock' + i}${db}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Removing bridged endpoint ${plg}${'matterbridge-mock' + i++}${db}`));
      expect(plugin.addedDevices).toBe(0);
      expect(plugin.registeredDevices).toBe(0);
    }
    expect(plugins.length).toBe(6);
    expect(matterbridge.devices.size).toBe(0);
  }, 60000);

  test('Finally Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);
});
