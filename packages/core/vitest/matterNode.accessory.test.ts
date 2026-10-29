/**
 * @file packages/core/vitest/matterNode.accessory.test.ts
 * @description This file contains the tests for the MatterNode class in accessory mode.
 * @author Luca Liguori
 */

const MATTER_PORT = 10400;
const NAME = 'MatterNodeAccessory';
const PASSCODE = 123458;
const DISCRIMINATOR = 3862;
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

describe('MatterNode accessory', () => {
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
    matter = new MatterNode(matterbridge, 'matterbridge-mock4');
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

    expect(await pluginManager.add('./packages/core/src/mock/plugin4')).not.toBeNull();
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
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, powerSource], { id: `Outlet ${i}` }, true)
        .createDefaultBasicInformationClusterServer(`Outlet ${i}`, `OUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock4';
      await matter.addBridgedEndpoint('matterbridge-mock4', outlet);
      expect(outlet.owner).toBeDefined();
      expect(deviceManager.length).toBe(i);
    }
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = matter.serverNode?.parts.get(`Outlet${i}`) as MatterbridgeEndpoint;
      await matter.removeBridgedEndpoint('matterbridge-mock4', outlet);
    }
    expect(deviceManager.length).toBe(0);
  }, 30000);

  test('Start MatterNode in childbridge mode', async () => {
    await matter.start();
    expect(matter.matterStorageManager).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
  });

  test('Stress test adding and removing bridged endpoints in bridge mode started', async () => {
    expect(deviceManager.length).toBe(1);
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, powerSource], { id: `Outlet ${i}` }, true)
        .createDefaultBasicInformationClusterServer(`Outlet ${i}`, `OUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock4';
      await matter.addBridgedEndpoint('matterbridge-mock4', outlet);
      expect(outlet.owner).toBeDefined();
      expect(deviceManager.length).toBe(i + 1); // +1 for the server node
    }
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = matter.serverNode?.parts.get(`Outlet${i}`) as MatterbridgeEndpoint;
      await matter.removeBridgedEndpoint('matterbridge-mock4', outlet);
    }
    expect(deviceManager.length).toBe(1);
  }, 30000);

  test('Change server reachable attribute for Accessory plugin', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    await matter.setServerReachability(false);
    await matter.setServerReachability(true);
  });

  test('Add and remove endpoint to the Matter server node for Accessory plugin', async () => {
    expect(deviceManager.length).toBe(1);
    const device = new MatterbridgeEndpoint([pressureSensor, powerSource], { id: 'Climate sensor' }, true)
      .createDefaultBasicInformationClusterServer('Climate sensor', 'CLIMATE1234567890')
      .createDefaultPowerSourceBatteryClusterServer()
      .addRequiredClusterServers();
    device.plugin = 'matterbridge-mock4';

    await matter.addBridgedEndpoint('matterbridge-mock4', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Added endpoint`));
    expect(device.owner).toBeDefined();
    expect(device.lifecycle.isReady).toBe(true);
    expect(deviceManager.length).toBe(2);

    // Remove with no server to test that code path
    const savedServer = matter.serverNode;
    matter.serverNode = undefined;
    await expect(async () => matter.removeBridgedEndpoint('matterbridge-mock4', device)).rejects.toThrow(
      `Error removing endpoint ${plg}matterbridge-mock4${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): server node not found`,
    );
    matter.serverNode = savedServer; // Restore server node

    // Remove the endpoint correctly
    await matter.removeBridgedEndpoint('matterbridge-mock4', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Removed bridged endpoint`));
    expect(device.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);

    // Close endpoint stores to avoid number persistence issues
    await matter.serverNode?.env.get(ServerNodeStore)?.endpointStores.close();

    // Wrong matter device with bridged device
    const occSensor = new MatterbridgeEndpoint([occupancySensor, bridgedNode], { id: 'Motion sensor', mode: 'matter' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Motion sensor', 'MOT1234567890')
      .addRequiredClusterServers();
    occSensor.plugin = 'matterbridge-mock4';
    expect(await matter.addBridgedEndpoint('matterbridge-mock4', occSensor)).toBeUndefined();
    expect(occSensor.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);
  });

  test('Stop MatterNode in childbridge mode', async () => {
    await matter.stop();
    expect(matter.serverNode).toBeUndefined();
    expect(matter.matterStorageManager).toBeUndefined();
  });
});
