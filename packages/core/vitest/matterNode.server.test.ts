/**
 * @file packages/core/vitest/matterNode.server.test.ts
 * @description This file contains the tests for the MatterNode class in server mode.
 * @author Luca Liguori
 */

/* oxlint-disable typescript/explicit-function-return-type */

const MATTER_PORT = 10200;
const NAME = 'MatterNodeServer';
const PASSCODE = 123460;
const DISCRIMINATOR = 3864;
const STRESS_TEST_ITERATIONS = 5;

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { getSharedMatterbridge } from '@matterbridge/test-utils/vitest/matter';
import { HOMEDIR, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { BroadcastServer } from '@matterbridge/thread';
import type { SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { NODE_STORAGE_DIR } from '@matterbridge/types';
import { AnsiLogger } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { DeviceManager } from '../src/deviceManager.js';
import type { Matterbridge } from '../src/matterbridge.js';
import { onOffPlugInUnit, powerSource, temperatureSensor } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { MatterNode } from '../src/matterNode.js';
import { PluginManager } from '../src/pluginManager.js';

// Setup the test environment
await setupTest(NAME, false, ['--verbose'], { MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS: '10' });

const matterbridgePackageJson = JSON.parse(fs.readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
const frontendPackageJson = JSON.parse(fs.readFileSync(new URL('../../../apps/frontend/package.json', import.meta.url), 'utf8'));

const matterbridge: SharedMatterbridge = {
  ...getSharedMatterbridge(),
  uuid: '',
  rootDirectory: path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../'),
  globalModulesDirectory: path.join('.', 'node_modules'),
  matterbridgeVersion: matterbridgePackageJson.version,
  matterbridgeLatestVersion: matterbridgePackageJson.version,
  matterbridgeDevVersion: matterbridgePackageJson.version,
  frontendVersion: frontendPackageJson.version,
  bridgeMode: 'bridge',
  virtualMode: 'disabled',
  fileLogger: true,
  matterFileLogger: true,
  port: MATTER_PORT,
  discriminator: DISCRIMINATOR,
  passcode: PASSCODE,
};
// process.stdout.write(`Shared matterbridge:\n${JSON.stringify(matterbridge, null, 2)}\n`);

describe('MatterNode server', () => {
  let matter: MatterNode;

  // Override matterbridge methods to call MatterNode methods
  (matterbridge as any).addBridgedEndpoint = async (pluginName: string, endpoint: MatterbridgeEndpoint) => {
    return await matter.addBridgedEndpoint(pluginName, endpoint);
  };
  (matterbridge as any).removeBridgedEndpoint = async (pluginName: string, endpoint: MatterbridgeEndpoint) => {
    return await matter.removeBridgedEndpoint(pluginName, endpoint);
  };
  (matterbridge as any).removeAllBridgedEndpoints = async (pluginName: string) => {
    return await matter.removeAllBridgedEndpoints(pluginName);
  };
  (matterbridge as any).addVirtualEndpoint = async (pluginName: string, name: string, type: 'light' | 'outlet' | 'switch' | 'mounted_switch', callback: () => Promise<void>) => {
    return await matter.addVirtualEndpoint(pluginName, name, type, callback);
  };

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
    // process.stdout.write('=== Starting MatterNode server tests ===\n\n');

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

    // process.stdout.write('=== Finished MatterNode server tests ===\n\n');
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

  test('Create MatterNode in bridge mode', async () => {
    Object.assign(matter, { port: undefined, passcode: undefined, discriminator: undefined });
    await matter.create();
    expect(nextSettings).toEqual({ port: MATTER_PORT + 1, passcode: PASSCODE + 1, discriminator: DISCRIMINATOR + 1 });
    expect(matter.serverNode?.state.network.port).toBe(MATTER_PORT);
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(false);
    expect(matter.aggregatorNode).toBeDefined();
  });

  test('Create MatterNode instance in server mode', async () => {
    const tmpSensor = new MatterbridgeEndpoint([temperatureSensor], { id: 'Temperature sensor', mode: 'server' }, true)
      .createDefaultBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890')
      .addRequiredClusterServers();
    tmpSensor.plugin = 'matterbridge-mock1';
    const spy = vi.spyOn(MatterNode.prototype, 'create').mockImplementationOnce(() => {
      throw new Error('Simulated create error');
    });
    expect(await matter.addBridgedEndpoint('matterbridge-mock1', tmpSensor)).toBeUndefined();
    spy.mockRestore();
    void matter.dependantMatterNodes.get('Temperaturesensor')?.destroy();
    expect(await matter.addBridgedEndpoint('matterbridge-mock1', tmpSensor)).not.toBeUndefined();
  }, 30000);

  test('Stress test adding and removing server mode endpoints in bridge mode not started', async () => {
    const devices = deviceManager.length;
    const dependantNodes = matter.dependantMatterNodes.size;
    const outlets: MatterbridgeEndpoint[] = [];
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, powerSource], { id: `Server outlet ${i}`, mode: 'server' }, true)
        .createDefaultBasicInformationClusterServer(`Server outlet ${i}`, `SERVEROUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock1';
      expect(await matter.addBridgedEndpoint('matterbridge-mock1', outlet)).toBe(outlet);
      expect(matter.dependantMatterNodes.get(outlet.id)).toBeDefined();
      expect(deviceManager.length).toBe(devices + i);
      outlets.push(outlet);
    }
    for (const outlet of outlets) {
      expect(await matter.removeBridgedEndpoint('matterbridge-mock1', outlet)).toBe(outlet);
      expect(matter.dependantMatterNodes.get(outlet.id)).toBeUndefined();
    }
    expect(deviceManager.length).toBe(devices);
    expect(matter.dependantMatterNodes.size).toBe(dependantNodes);
  }, 30000);

  test('Start MatterNode in bridge mode', async () => {
    await matter.start();
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
    expect(matter.aggregatorNode).toBeDefined();
  });

  test('Stress test adding and removing server mode endpoints in bridge mode started', async () => {
    const devices = deviceManager.length;
    const dependantNodes = matter.dependantMatterNodes.size;
    const outlets: MatterbridgeEndpoint[] = [];
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, powerSource], { id: `Server outlet ${i}`, mode: 'server' }, true)
        .createDefaultBasicInformationClusterServer(`Server outlet ${i}`, `SERVEROUTLET1234567890-${i}`)
        .createDefaultPowerSourceBatteryClusterServer()
        .addRequiredClusterServers();
      outlet.plugin = 'matterbridge-mock1';
      expect(await matter.addBridgedEndpoint('matterbridge-mock1', outlet)).toBe(outlet);
      expect(matter.dependantMatterNodes.get(outlet.id)).toBeDefined();
      expect(deviceManager.length).toBe(devices + i);
      outlets.push(outlet);
    }
    for (const outlet of outlets) {
      expect(await matter.removeBridgedEndpoint('matterbridge-mock1', outlet)).toBe(outlet);
      expect(matter.dependantMatterNodes.get(outlet.id)).toBeUndefined();
    }
    expect(deviceManager.length).toBe(devices);
    expect(matter.dependantMatterNodes.size).toBe(dependantNodes);
  }, 30000);

  test('Remove a server mode endpoint whose MatterNode is already gone', async () => {
    const devices = deviceManager.length;
    const dependantNodes = matter.dependantMatterNodes.size;
    const outlet = new MatterbridgeEndpoint([onOffPlugInUnit, powerSource], { id: 'Server outlet gone', mode: 'server' }, true)
      .createDefaultBasicInformationClusterServer('Server outlet gone', 'SERVEROUTLET1234567890-0')
      .createDefaultPowerSourceBatteryClusterServer()
      .addRequiredClusterServers();
    outlet.plugin = 'matterbridge-mock1';
    expect(await matter.addBridgedEndpoint('matterbridge-mock1', outlet)).toBe(outlet);
    // Close and drop the MatterNode outside removeBridgedEndpoint()
    const dependantNode = matter.dependantMatterNodes.get(outlet.id);
    await dependantNode?.stop();
    await dependantNode?.destroy(false);
    matter.dependantMatterNodes.delete(outlet.id);
    expect(await matter.removeBridgedEndpoint('matterbridge-mock1', outlet)).toBe(outlet);
    expect(deviceManager.length).toBe(devices);
    expect(matter.dependantMatterNodes.size).toBe(dependantNodes);
  }, 30000);

  test('Stop MatterNode in bridge mode', async () => {
    await matter.stop();
    expect(matter.serverNode).toBeUndefined();
    expect(matter.aggregatorNode).toBeUndefined();
    expect(matter.matterStorageService).toBeUndefined();
  });
});
