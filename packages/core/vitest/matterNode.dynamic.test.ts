/**
 * @file packages/core/vitest/matterNode.dynamic.test.ts
 * @description This file contains the tests for the MatterNode class in dynamic mode.
 * @author Luca Liguori
 */

const MATTER_PORT = 10300;
const NAME = 'MatterNodeDynamic';
const PASSCODE = 123459;
const DISCRIMINATOR = 3863;
const STRESS_TEST_ITERATIONS = 3;

import path from 'node:path';

import { ServerNodeStore } from '@matter/node';
import { getSharedMatterbridge } from '@matterbridge/test-utils/vitest/matter';
import { loggerInfoSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { BroadcastServer } from '@matterbridge/thread';
import type { SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { dev, NODE_STORAGE_DIR, plg } from '@matterbridge/types';
import { getInterfaceName } from '@matterbridge/utils/network';
import { AnsiLogger, er, zb } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { DeviceManager } from '../src/deviceManager.js';
import type { Matterbridge } from '../src/matterbridge.js';
import { bridgedNode, occupancySensor, onOffPlugInUnit, powerSource, pressureSensor } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { MatterNode } from '../src/matterNode.js';
import { PluginManager } from '../src/pluginManager.js';

// Setup the test environment
await setupTest(NAME, false, ['--verbose'], { MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS: '10' });

const matterbridge: SharedMatterbridge = {
  ...getSharedMatterbridge(),
  bridgeMode: 'childbridge',
  virtualMode: 'disabled',
  fileLogger: true,
  matterFileLogger: true,
  port: MATTER_PORT,
  discriminator: DISCRIMINATOR,
  passcode: PASSCODE,
  mdnsInterface: getInterfaceName(),
};

describe('MatterNode dynamic', () => {
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
    matter = new MatterNode(matterbridge, 'matterbridge-mock1');
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
    expect(pluginManager.length).toBe(1);
  });

  test('Create MatterNode in childbridge mode', async () => {
    Object.assign(matter, { port: undefined, passcode: undefined, discriminator: undefined });
    await matter.create();
    expect(nextSettings).toEqual({ port: MATTER_PORT + 1, passcode: PASSCODE + 1, discriminator: DISCRIMINATOR + 1 });
    expect(matter.port).toBe(MATTER_PORT);
    expect(matter.matterStorageManager).toBeDefined();
    expect(matter.serverNode).toBeUndefined(); // In childbridge mode, serverNode is created on start
  });

  test('Stress test adding and removing bridged endpoints in bridge mode not started', async () => {
    expect(deviceManager.length).toBe(0);
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

  test('Start MatterNode in childbridge mode', async () => {
    await matter.start();
    expect(matter.matterStorageManager).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
  });

  test('Change server reachable attribute for Dynamic plugin', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    await matter.setServerReachability(false);
    await matter.setServerReachability(true);
  });

  test('Add and remove endpoint to the Matter server node for Dynamic plugin', async () => {
    expect(deviceManager.length).toBe(1);
    const device = new MatterbridgeEndpoint([pressureSensor, bridgedNode, powerSource], { id: 'Climate sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Climate sensor', 'CLIMATE1234567890')
      .createDefaultPowerSourceBatteryClusterServer()
      .addRequiredClusterServers();
    device.plugin = 'matterbridge-mock1';

    await matter.addBridgedEndpoint('matterbridge-mock1', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Added endpoint`));
    expect(device.owner).toBeDefined();
    expect(device.lifecycle.isReady).toBe(true);
    expect(deviceManager.length).toBe(2);

    await matter.removeBridgedEndpoint('matterbridge-mock1', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Removed bridged endpoint`));
    expect(device.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);
  });

  test('Add and remove matter endpoint to the Matter server node for Dynamic plugin', async () => {
    expect(deviceManager.length).toBe(1);
    const device = new MatterbridgeEndpoint([pressureSensor, bridgedNode, powerSource], { id: 'Climate sensor', mode: 'matter' }, true)
      .createDefaultBasicInformationClusterServer('Climate sensor', 'CLIMATE1234567890')
      .createDefaultPowerSourceBatteryClusterServer()
      .addRequiredClusterServers();
    device.plugin = 'matterbridge-mock1';

    await matter.addBridgedEndpoint('matterbridge-mock1', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Added endpoint`));
    expect(device.owner).toBeDefined();
    expect(device.lifecycle.isReady).toBe(true);
    expect(deviceManager.length).toBe(2);

    // Remove with no aggregator to test that code path
    const savedAggregator = matter.aggregatorNode;
    matter.aggregatorNode = undefined;
    await expect(async () => matter.removeBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(
      `Error removing bridged endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`,
    );
    matter.aggregatorNode = savedAggregator; // Restore aggregator node

    await matter.removeBridgedEndpoint('matterbridge-mock1', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Removed bridged endpoint`));
    expect(device.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);

    // Close endpoint stores to avoid number persistence issues
    await matter.serverNode?.env.get(ServerNodeStore)?.endpointStores.close();

    // Wrong matter device with bridged device
    const occSensor = new MatterbridgeEndpoint(
      [occupancySensor, bridgedNode],
      { id: 'Motion sensor', mode: 'matter' },
      true,
    ).createDefaultBridgedDeviceBasicInformationClusterServer('Motion sensor', 'MOT1234567890');
    occSensor.plugin = 'matterbridge-mock1';
    expect(await matter.addBridgedEndpoint('matterbridge-mock1', occSensor)).toBeUndefined();
    expect(occSensor.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);
  });

  test('Stress test adding and removing bridged endpoints in bridge mode started', async () => {
    expect(deviceManager.length).toBe(1);
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, bridgedNode, powerSource], { id: `Outlet ${i}` }, true)
        .createDefaultBridgedDeviceBasicInformationClusterServer(`Outlet ${i}`, `OUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock1';
      await matter.addBridgedEndpoint('matterbridge-mock1', outlet);
      expect(outlet.owner).toBeDefined();
      expect(deviceManager.length).toBe(i + 1); // +1 for the initial device
    }
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = matter.aggregatorNode?.parts.get(`Outlet${i}`) as MatterbridgeEndpoint;
      await matter.removeBridgedEndpoint('matterbridge-mock1', outlet);
    }
    expect(deviceManager.length).toBe(1);
  }, 30000);

  test('Stop MatterNode in childbridge mode', async () => {
    await matter.stop();
    expect(matter.serverNode).toBeUndefined();
    expect(matter.matterStorageManager).toBeUndefined();
  });
});
