// src\matterbridge.childbridge.test.ts

/* eslint-disable no-console */
/* eslint-disable jest/no-conditional-expect */

const MATTER_PORT = 6014;
const NAME = 'MatterbridgeChildBridge';
const HOMEDIR = path.join('jest', NAME);

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
  HOMEDIR,
  '-profile',
  'JestChildbridge',
  '-port',
  MATTER_PORT.toString(),
  '-passcode',
  '123456',
  '-discriminator',
  '3860',
];

import path from 'node:path';

import { jest } from '@jest/globals';
import { db, LogLevel, pl, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Environment } from '@matter/main';
import { BasicInformationServer } from '@matter/main/behaviors';

import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils/export.js';
import { PluginManager } from './pluginManager.js';
import { dev, plg } from './matterbridgeTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { pressureSensor } from './matterbridgeDeviceTypes.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge loadInstance() and cleanup() -childbridge mode', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;

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
    expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, 'matterstorage'));

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
    expect((matterbridge as any).nodeStorageName).toBe('storage');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).matterStorageName).toBe('matterstorage');

    expect((matterbridge as any).matterStorageService).toBeDefined();
    expect((matterbridge as any).matterStorageManager).toBeDefined();
    expect((matterbridge as any).matterbridgeContext).toBeDefined();
    expect((matterbridge as any).mattercontrollerContext).toBeUndefined();
    expect((matterbridge as any).serverNode).toBeUndefined();
    expect((matterbridge as any).aggregatorNode).toBeUndefined();

    expect((matterbridge as any).mdnsInterface).toBe(undefined);
    expect((matterbridge as any).port).toBe(MATTER_PORT);
    expect((matterbridge as any).passcode).toBe(123456);
    expect((matterbridge as any).discriminator).toBe(3860);

    await new Promise<void>((resolve) => {
      matterbridge.once('childbridge_started', () => {
        resolve();
      });
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8802${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in childbridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in childbridge mode`);
  }, 60000);

  test('addBridgedEndpoint with invalid plugin', async () => {
    await matterbridge.addBridgedEndpoint('invalid-plugin', {} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error adding bridged endpoint`));
  });

  test('removeBridgedEndpoint with invalid plugin', async () => {
    await matterbridge.removeBridgedEndpoint('invalid-plugin', {} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error removing bridged endpoint`));
  });

  test('addBridgedEndpoint twice for AccessoryPlatform', async () => {
    expect(await plugins.add('./src/mock/plugin4')).not.toBeNull();
    const plugin = plugins.get('matterbridge-mock4');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.type = 'AccessoryPlatform';
    plugin.serverNode = {} as any;
    await matterbridge.addBridgedEndpoint('matterbridge-mock4', new MatterbridgeEndpoint(pressureSensor, { uniqueStorageKey: 'invalidDevice' }));
    expect(await plugins.remove('./src/mock/plugin4')).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Only one device is allowed per AccessoryPlatform plugin.`));
  });

  test('addBridgedEndpoint for AccessoryPlatform with mode = matter', async () => {
    jest.spyOn(matterbridge, 'subscribeAttributeChanged' as any).mockImplementationOnce(async () => {
      return Promise.resolve();
    });
    expect(await plugins.add('./src/mock/plugin4')).not.toBeNull();
    const plugin = plugins.get('matterbridge-mock4');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.type = 'AccessoryPlatform';
    plugin.serverNode = { add: jest.fn() } as any;
    await matterbridge.addBridgedEndpoint('matterbridge-mock4', { mode: 'matter', uniqueId: '123', uniqueStorageKey: 'invalidDevice' } as any);
    expect(await plugins.remove('./src/mock/plugin4')).not.toBeNull();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Only one device is allowed per AccessoryPlatform plugin.`));
  });

  test('addBridgedEndpoint for DynamicPlatform with mode = matter', async () => {
    jest.spyOn(matterbridge, 'subscribeAttributeChanged' as any).mockImplementationOnce(async () => {
      return Promise.resolve();
    });
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    const plugin = plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.type = 'DynamicPlatform';
    plugin.serverNode = { add: jest.fn() } as any;
    await matterbridge.addBridgedEndpoint('matterbridge-mock1', { mode: 'matter', uniqueId: '123', uniqueStorageKey: 'invalidDevice' } as any);
    expect(await plugins.remove('./src/mock/plugin1')).not.toBeNull();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Only one device is allowed per AccessoryPlatform plugin.`));
  });

  test('addBridgedEndpoint fails adding for AccessoryPlatform', async () => {
    expect(await plugins.add('./src/mock/plugin4')).not.toBeNull();
    const plugin = plugins.get('matterbridge-mock4');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.type = 'AccessoryPlatform';
    jest.spyOn(Matterbridge.prototype, 'createAccessoryPlugin' as any).mockImplementationOnce(async () => {
      throw new Error('Error creating endpoint');
    });
    await matterbridge.addBridgedEndpoint('matterbridge-mock4', {} as any);
    expect(await plugins.remove('./src/mock/plugin4')).not.toBeNull();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error creating endpoint`));
  });

  test('addBridgedEndpoint fails adding for DynamicPlatform', async () => {
    expect(await plugins.add('./src/mock/plugin1')).not.toBeNull();
    const plugin = plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.type = 'DynamicPlatform';
    jest.spyOn(Matterbridge.prototype, 'createDynamicPlugin' as any).mockImplementationOnce(async () => {
      throw new Error('Error creating endpoint');
    });
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

  test('addBridgedEndpoint fails adding for DynamicPlatform cause aggregatorNode', async () => {
    const plugin = plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    const aggregatorNode = plugin.aggregatorNode;
    plugin.aggregatorNode = undefined;
    await matterbridge.addBridgedEndpoint('matterbridge-mock1', {} as any);
    plugin.aggregatorNode = aggregatorNode;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Aggregator node not found for plugin`));
  });

  test('removeBridgedEndpoint fails removing for DynamicPlatform cause aggregatorNode', async () => {
    const plugin = plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (!plugin) return;
    const aggregatorNode = plugin.aggregatorNode;
    plugin.aggregatorNode = undefined;
    await matterbridge.removeBridgedEndpoint('matterbridge-mock1', {} as any);
    plugin.aggregatorNode = aggregatorNode;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`aggregator node not found`));
  });

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
    await matterbridge.destroyInstance(10);
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
    await Promise.resolve();

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
    await Promise.resolve();

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

  test('set reachable -bridge mode', async () => {
    for (const plugin of matterbridge.plugins.array()) {
      expect(plugin).toBeDefined();
      plugin.serverNode?.setStateOf(BasicInformationServer, { reachable: false });
    }
  }, 60000);

  test('remove all devices', async () => {
    expect(matterbridge.plugins.size).toBe(4);
    expect(matterbridge.devices.size).toBe(4);
    let i = 1;
    for (const plugin of plugins) {
      expect(plugin.type).toBe(i < 4 ? 'DynamicPlatform' : 'AccessoryPlatform');
      expect(plugin.registeredDevices).toBe(1);
      await matterbridge.removeAllBridgedEndpoints('matterbridge-mock' + i);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Removing all bridged endpoints for plugin ${plg}${'matterbridge-mock' + i}${db}`);
      if (plugin.type === 'DynamicPlatform') expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Removing bridged endpoint ${plg}${'matterbridge-mock' + i++}${db}`));
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
    await matterbridge.destroyInstance(10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock1 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock2 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock3 MdnsService`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed matterbridge-mock4 MdnsService`);
  }, 60000);
});
