// src\matterbridge.bridge.test.ts

/* eslint-disable jest/no-conditional-expect */

const MATTER_PORT = 6500;
const FRONTEND_PORT = 8801;
const NAME = 'MatterbridgeBridge';
const HOMEDIR = path.join('jest', NAME);
const PASSCODE = 123456;
const DISCRIMINATOR = 3860;

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
  FRONTEND_PORT.toString(),
  '-homedir',
  HOMEDIR,
  '-profile',
  'JestBridge',
  '-port',
  MATTER_PORT.toString(),
  '-passcode',
  PASSCODE.toString(),
  '-discriminator',
  DISCRIMINATOR.toString(),
];
process.env['MATTERBRIDGE_START_MATTER_INTERVAL_MS'] = '10';
process.env['MATTERBRIDGE_PAUSE_MATTER_INTERVAL_MS'] = '10';

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
import { db, LogLevel, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { BridgedDeviceBasicInformationServer, PressureMeasurementServer } from '@matter/node/behaviors';
import { waiter } from '@matterbridge/utils';

import { Matterbridge } from './matterbridge.js';
import { PluginManager } from './pluginManager.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { pressureSensor } from './matterbridgeDeviceTypes.js';
import { MATTER_STORAGE_NAME, plg } from './matterbridgeTypes.js';
import { loggerLogSpy, setupTest, flushAsync, destroyInstance, closeMdnsInstance, loggerErrorSpy } from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

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
    expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME));

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

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();

    expect((matterbridge as any).serverNode).toBeDefined();
    expect((matterbridge as any).aggregatorNode).toBeDefined();

    expect((matterbridge as any).mdnsInterface).toBe(undefined);
    expect((matterbridge as any).port).toBe(MATTER_PORT + 1);
    expect((matterbridge as any).passcode).toBe(PASSCODE + 1);
    expect((matterbridge as any).discriminator).toBe(DISCRIMINATOR + 1);

    if (!matterbridge.serverNode?.lifecycle.isOnline === true) {
      await new Promise((resolve) => {
        matterbridge.once('online', resolve);
      });
    }
    await flushAsync(undefined, undefined, 100);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:${FRONTEND_PORT}${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in bridge mode`);
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

  test('addVirtualEndpoint', async () => {
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    const plugin = plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (!plugin) return;

    await matterbridge.addVirtualEndpoint('matterbridge-unknown', 'Virtual', 'outlet', {} as any);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`plugin not found`));
    jest.clearAllMocks();

    matterbridge.aggregatorNode = { parts: { has: () => true } } as any;
    await matterbridge.addVirtualEndpoint('matterbridge-mock1', 'Virtual', 'outlet', {} as any);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Please use a different name`));

    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
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
    for (const plugin of matterbridge.plugins) {
      await matterbridge.plugins.shutdown(plugin, 'Test Shutdown', false, true);
      expect(plugin.loaded).toBeFalsy();
    }
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 10, 10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
  });

  test('Restart initialize() -bridge mode', async () => {
    expect((matterbridge as any).initialized).toBeFalsy();
    await (matterbridge as any).initialize();
    expect((matterbridge as any).initialized).toBeTruthy();
    plugins = matterbridge.plugins;
    expect(plugins.length).toBe(6);

    await waiter(
      'Matter server node restarted',
      () => {
        return (matterbridge as any).configureTimeout !== undefined && (matterbridge as any).reachabilityTimeout !== undefined && matterbridge.serverNode?.lifecycle.isOnline === true;
      },
      true,
      60000,
      100,
      true,
    );

    await waiter(
      'Matterbridge plugins started',
      () => {
        return plugins.array()[0].started === true && plugins.array()[1].started === true && plugins.array()[2].started === true && plugins.array()[3].started === true && plugins.array()[4].started === true && plugins.array()[5].started === true;
      },
      true,
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
      const device = new MatterbridgeEndpoint(pressureSensor, { id: 'pressureSensor' + i })
        .createDefaultBridgedDeviceBasicInformationClusterServer('Pressure sensor ' + i, '0x123456789', 0xfff1, 'Matterbridge', 'PressureSensor')
        .addRequiredClusterServers();
      expect(device).toBeDefined();
      const child = device.addChildDeviceType('PressureSensor', pressureSensor);
      child.addRequiredClusterServers();
      device.plugin = 'matterbridge-mock' + i;
      await matterbridge.addBridgedEndpoint('matterbridge-mock' + i++, device);
    }
  });

  test('set reachable -bridge mode', async () => {
    for (const device of matterbridge.devices.array()) {
      expect(device).toBeDefined();
      if (device.hasClusterServer(BridgedDeviceBasicInformationServer)) device?.setStateOf(BridgedDeviceBasicInformationServer, { reachable: false });
      device.getChildEndpoints().some(async (child) => {
        if (child.hasClusterServer(PressureMeasurementServer)) await child.setStateOf(PressureMeasurementServer, { measuredValue: 9900 });
      });
    }
    await flushAsync(undefined, undefined, 100);
  });

  test('remove all devices', async () => {
    expect(plugins.length).toBe(6);
    expect(matterbridge.devices.size).toBe(9);
    let i = 1;
    for (const plugin of plugins) {
      expect(plugin.type).toBe(i < 4 ? 'DynamicPlatform' : 'AccessoryPlatform');
      expect(plugin.registeredDevices).toBe(i < 4 ? 2 : 1);
      await matterbridge.removeAllBridgedEndpoints('matterbridge-mock' + i);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${'matterbridge-mock' + i}${db}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Removing bridged endpoint ${plg}${'matterbridge-mock' + i++}${db}`));
      expect(plugin.registeredDevices).toBe(0);
    }
    expect(plugins.length).toBe(6);
    expect(matterbridge.devices.size).toBe(0);
    await flushAsync(undefined, undefined, 100);
  });

  test('Finally Matterbridge.destroyInstance() -bridge mode', async () => {
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge, 10, 10);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);

    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
  });
});
