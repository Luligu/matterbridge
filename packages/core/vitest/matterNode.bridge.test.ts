/**
 * @file packages/core/vitest/matterNode.bridge.test.ts
 * @description This file contains the tests for the MatterNode class in bridge mode.
 * @author Luca Liguori
 */

const MATTER_PORT = 10100;
const NAME = 'MatterNodeBridge';
const PASSCODE = 123457;
const DISCRIMINATOR = 3861;
const STRESS_TEST_ITERATIONS = 3;

import path from 'node:path';

import { closeServerNodeStores, getSharedMatterbridge } from '@matterbridge/test-utils/vitest/matter';
import { setupTest } from '@matterbridge/test-utils/vitest/setup';
import { BroadcastServer } from '@matterbridge/thread';
import type { SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { dev, NODE_STORAGE_DIR, plg } from '@matterbridge/types';
import { getInterfaceName } from '@matterbridge/utils/network';
import { AnsiLogger, er, LogLevel, TimestampFormat, zb } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { DeviceManager } from '../src/deviceManager.js';
import type { Matterbridge } from '../src/matterbridge.js';
import { bridgedNode, flowSensor, humiditySensor, occupancySensor, onOffPlugInUnit, powerSource, temperatureSensor } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { MatterNode } from '../src/matterNode.js';
import { type Plugin, PluginManager } from '../src/pluginManager.js';

// Setup the test environment
await setupTest(NAME, false, ['--verbose'], { MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS: '10' });

const matterbridge: SharedMatterbridge = {
  ...getSharedMatterbridge(),
  bridgeMode: 'bridge',
  virtualMode: 'disabled',
  fileLogger: true,
  matterFileLogger: true,
  port: MATTER_PORT,
  discriminator: DISCRIMINATOR,
  passcode: PASSCODE,
  mdnsInterface: getInterfaceName(),
};

describe('MatterNode bridge', () => {
  let matter: MatterNode;

  // Create PluginManager and DeviceManager to simulate the normal environment
  /* Simulate normal environment in test */
  const pluginManager = new PluginManager(matterbridge as Matterbridge);
  /* Simulate normal environment in test */
  const deviceManager = new DeviceManager();

  const matterbridgeServer = new BroadcastServer('matterbridge', new AnsiLogger({ logName: 'TestMatterbridgeServer' }));
  const nextSettings = { port: MATTER_PORT, passcode: PASSCODE, discriminator: DISCRIMINATOR };
  matterbridgeServer.on('broadcast_message', (msg: WorkerMessage) => {
    if (matterbridgeServer.isWorkerRequestOfType(msg, 'matterbridge_matterdata')) {
      matterbridgeServer.respond({ ...msg, result: { ...nextSettings } });
      nextSettings.port++;
      nextSettings.passcode++;
      nextSettings.discriminator++;
    }
  });

  beforeAll(() => {
    // Create MatterNode instance
    matter = new MatterNode(matterbridge);
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Close broadcast server and mDNS instance
    await matter.destroy();
    matterbridgeServer.close();

    // Close PluginManager and DeviceManager
    pluginManager.destroy();
    deviceManager.destroy();

    // Restore all mocks
    vi.restoreAllMocks();

    // Log any keep-alive handles
    // logKeepAlives(matter.log);
  });

  test('Add plugin', async () => {
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeStorage = new NodeStorageManager({
      dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
    });
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeContext = await pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');

    expect(await pluginManager.add('./packages/core/src/mock/plugin1')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/plugin4')).not.toBeNull();
    expect(pluginManager.length).toBe(2);
  });

  test('Create MatterNode in bridge mode', async () => {
    await expect(matter.start()).rejects.toThrow();
    await expect(matter.stop()).rejects.toThrow();

    Object.assign(matter, { port: undefined, passcode: undefined, discriminator: undefined });
    await matter.create();
    expect(nextSettings).toEqual({ port: MATTER_PORT + 1, passcode: PASSCODE + 1, discriminator: DISCRIMINATOR + 1 });
    expect(matter.serverNode?.state.network.port).toBe(MATTER_PORT);
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(false);
    expect(matter.aggregatorNode).toBeDefined();
  });

  test('Add and remove bridged endpoints in bridge mode', async () => {
    const pluginServer: Plugin = {
      name: 'serverdevicetest',
      path: path.join('./src/mock/pluginserverdevice/package.json'),
      type: 'AccessoryPlatform',
      version: '1.0.0',
      description: 'Test accessory plugin',
      author: 'Test Author',
      enabled: true,
      private: true,
      configurationVersion: 1,
      registeredDevices: 0,
    };
    matter.pluginManager.set(pluginServer);

    const pluginMatter: Plugin = {
      name: 'matterdevicetest',
      path: path.join('./src/mock/pluginmatterdevice/package.json'),
      type: 'AccessoryPlatform',
      version: '1.0.0',
      description: 'Test accessory plugin',
      author: 'Test Author',
      enabled: true,
      private: true,
      configurationVersion: 1,
      registeredDevices: 0,
    };
    matter.pluginManager.set(pluginMatter);

    const tmpSensor = new MatterbridgeEndpoint([temperatureSensor], { id: 'Temperature sensor', mode: 'matter' }, true)
      .createDefaultBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890')
      .addRequiredClusterServers();
    tmpSensor.plugin = 'matterdevicetest';

    // Test no server node
    const savedServer = matter.serverNode;
    matter.serverNode = undefined;
    await expect(async () => matter.addBridgedEndpoint('matterdevicetest', tmpSensor)).rejects.toThrow(
      `Server node not found for matter endpoint ${plg}matterdevicetest${er}:${dev}${tmpSensor.deviceName}${er} (${zb}${tmpSensor.name}${er})`,
    );
    matter.serverNode = savedServer;

    // Test correctly adding
    await matter.addBridgedEndpoint('matterdevicetest', tmpSensor);
    expect(tmpSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(1);

    const humSensor = new MatterbridgeEndpoint([humiditySensor, bridgedNode], { id: 'Humidity sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Humidity sensor', 'HUM1234567890')
      .addRequiredClusterServers();
    humSensor.plugin = 'serverdevicetest';
    await matter.addBridgedEndpoint('serverdevicetest', humSensor);
    expect(humSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(2);

    // Close endpoint stores to avoid number persistence issues with next test
    await closeServerNodeStores(matter.serverNode);

    // Wrong matter device with bridged device
    const occSensor = new MatterbridgeEndpoint([occupancySensor, bridgedNode], { id: 'Motion sensor', mode: 'matter' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Motion sensor', 'MOT1234567890')
      .addRequiredClusterServers();
    occSensor.plugin = 'serverdevicetest';
    expect(await matter.addBridgedEndpoint('serverdevicetest', occSensor)).toBeUndefined();
    expect(occSensor.owner).toBeUndefined();
    expect(deviceManager.length).toBe(2);

    await matter.removeAllBridgedEndpoints('matterdevicetest');
    await matter.removeAllBridgedEndpoints('serverdevicetest');
    expect(deviceManager.length).toBe(0);

    const sensor = new MatterbridgeEndpoint([flowSensor, bridgedNode], { id: 'Flow sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Flow sensor', 'FLOW1234567890')
      .addRequiredClusterServers();
    sensor.plugin = 'serverdevicetest';
    await matter.addBridgedEndpoint('serverdevicetest', sensor);
    expect(sensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(1);
    await matter.aggregatorNode?.parts.get('Flowsensor')?.delete();
    await expect(matter.removeAllBridgedEndpoints('serverdevicetest')).rejects.toThrow(
      `Endpoint ${plg}${sensor.plugin}${er}:${dev}${sensor.deviceName}${er} id ${sensor.id} not found removing all endpoints`,
    );
    deviceManager.clear();
    expect(deviceManager.length).toBe(0);
  });

  test('Stress test adding and removing bridged endpoints in bridge mode not started', async () => {
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, bridgedNode, powerSource], { id: `Outlet ${i}` }, true)
        .createDefaultBridgedDeviceBasicInformationClusterServer(`Outlet ${i}`, `OUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock1';
      await matter.addBridgedEndpoint('matterbridge-mock1', outlet);
      expect(outlet.owner).toBeDefined();
      expect(deviceManager.length).toBe(i);
    }
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = matter.aggregatorNode?.parts.get(`Outlet${i}`) as MatterbridgeEndpoint;
      await matter.removeBridgedEndpoint('matterbridge-mock1', outlet);
    }
    expect(deviceManager.length).toBe(0);
  }, 30000);

  test('Start MatterNode in bridge mode', async () => {
    await matter.start();
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
    expect(matter.aggregatorNode).toBeDefined();
  });

  test('Stress test adding and removing bridged endpoints in bridge mode started', async () => {
    expect(deviceManager.length).toBe(2);
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, bridgedNode, powerSource], { id: `Outlet ${i}` }, true)
        .createDefaultBridgedDeviceBasicInformationClusterServer(`Outlet ${i}`, `OUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock1';
      await matter.addBridgedEndpoint('matterbridge-mock1', outlet);
      expect(outlet.owner).toBeDefined();
      expect(deviceManager.length).toBe(i + 2); // +2 from plugin
    }
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = matter.aggregatorNode?.parts.get(`Outlet${i}`) as MatterbridgeEndpoint;
      await matter.removeBridgedEndpoint('matterbridge-mock1', outlet);
    }
    expect(deviceManager.length).toBe(2);
  }, 30000);

  test('Stress test adding and removing all bridged endpoints in bridge mode started', async () => {
    expect(deviceManager.length).toBe(2);
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, bridgedNode, powerSource], { id: `Outlet ${i}` }, true)
        .createDefaultBridgedDeviceBasicInformationClusterServer(`Outlet ${i}`, `OUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock1';
      await matter.addBridgedEndpoint('matterbridge-mock1', outlet);
      expect(outlet.owner).toBeDefined();
      expect(deviceManager.length).toBe(i + 2); // +2 from plugin
    }
    await matter.removeAllBridgedEndpoints('matterbridge-mock1');
    expect(deviceManager.length).toBe(1);
  }, 30000);

  test('Stop MatterNode in bridge mode', async () => {
    await matter.stop();
    expect(matter.serverNode).toBeUndefined();
    expect(matter.aggregatorNode).toBeUndefined();
    expect(matter.matterStorageService).toBeUndefined();
  });

  test('Ignore matter_start and matter_stop for another storeId', async () => {
    const testServer = new BroadcastServer(
      'frontend',
      new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG }),
    );
    await expect(testServer.fetch({ type: 'matter_start', src: testServer.name, dst: 'matter', params: { storeId: 'unknown' } }, 100)).rejects.toThrow();
    await expect(testServer.fetch({ type: 'matter_stop', src: testServer.name, dst: 'matter', params: { storeId: 'unknown' } }, 100)).rejects.toThrow();
    testServer.close();
  });

  test('Log error on matter_stop when MatterNode is not started', async () => {
    const testServer = new BroadcastServer(
      'frontend',
      new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG }),
    );
    // stop() throws since the server node is not created: the error is logged and nobody responds
    await expect(testServer.fetch({ type: 'matter_stop', src: testServer.name, dst: 'matter', params: { storeId: 'Matterbridge' } }, 100)).rejects.toThrow();
    testServer.close();
  });

  test('Log error on matter_start when create fails', async () => {
    const testServer = new BroadcastServer(
      'frontend',
      new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG }),
    );
    const createSpy = vi.spyOn(matter, 'create').mockRejectedValueOnce(new Error('Test create error'));
    await expect(testServer.fetch({ type: 'matter_start', src: testServer.name, dst: 'matter', params: { storeId: 'Matterbridge' } }, 100)).rejects.toThrow();
    expect(createSpy).toHaveBeenCalledTimes(1);
    createSpy.mockRestore();
    testServer.close();
  });

  test('Start MatterNode in bridge mode with matter_start', async () => {
    const testServer = new BroadcastServer(
      'frontend',
      new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG }),
    );
    const response = await testServer.fetch({ type: 'matter_start', src: testServer.name, dst: 'matter', params: { storeId: 'Matterbridge' } }, 30000);
    expect(response.result).toEqual({ storeId: 'Matterbridge', success: true });
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
    expect(matter.aggregatorNode).toBeDefined();
    testServer.close();
  }, 30000);

  test('Stop MatterNode in bridge mode with matter_stop', async () => {
    const testServer = new BroadcastServer(
      'frontend',
      new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG }),
    );
    const response = await testServer.fetch({ type: 'matter_stop', src: testServer.name, dst: 'matter', params: { storeId: 'Matterbridge' } }, 30000);
    expect(response.result).toEqual({ storeId: 'Matterbridge', success: true });
    expect(matter.serverNode).toBeUndefined();
    expect(matter.aggregatorNode).toBeUndefined();
    expect(matter.matterStorageService).toBeUndefined();
    testServer.close();
  }, 30000);
});
