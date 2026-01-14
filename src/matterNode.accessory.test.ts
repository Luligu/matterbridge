// src\matterNode.dynamic.test.ts

const MATTER_PORT = 10040;
const NAME = 'MatterNodeAccessory';
const HOMEDIR = path.join('jest', NAME);
const PASSCODE = 123458;
const DISCRIMINATOR = 3862;
const STRESS_TEST_ITERATIONS = 5;

process.argv = [...originalProcessArgv, '--verbose'];
process.env['MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS'] = '10';

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';

import { jest } from '@jest/globals';
import { er, LogLevel, zb } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';
import { ServerNodeStore } from '@matter/main/node';

import { MatterNode } from './matterNode.js';
import { SharedMatterbridge, NODE_STORAGE_DIR, plg, dev } from './matterbridgeTypes.js';
import { loggerInfoSpy, originalProcessArgv, setupTest } from './jestutils/jestHelpers.js';
import { getInterfaceDetails } from './utils/network.js';
import { formatBytes, formatPercent, formatUptime } from './utils/format.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { PluginManager } from './pluginManager.js';
import type { Matterbridge } from './matterbridge.js';
import { DeviceManager } from './deviceManager.js';
import { bridgedNode, occupancySensor, onOffOutlet, powerSource, pressureSensor } from './matterbridgeDeviceTypes.js';

const matterbridgePackageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const frontendPackageJson = JSON.parse(fs.readFileSync(new URL('../frontend/package.json', import.meta.url), 'utf8'));
const nic = getInterfaceDetails();

const matterbridge: SharedMatterbridge = {
  rootDirectory: path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../'),
  homeDirectory: HOMEDIR,
  matterbridgeDirectory: path.join(HOMEDIR, '.matterbridge'),
  matterbridgePluginDirectory: path.join(HOMEDIR, 'Matterbridge'),
  matterbridgeCertDirectory: path.join(HOMEDIR, '.mattercert'),
  globalModulesDirectory: path.join('.', 'node_modules'),
  matterbridgeVersion: matterbridgePackageJson.version,
  matterbridgeLatestVersion: matterbridgePackageJson.version,
  matterbridgeDevVersion: matterbridgePackageJson.version,
  frontendVersion: frontendPackageJson.version,
  bridgeMode: 'childbridge',
  restartMode: '',
  virtualMode: 'disabled',
  profile: undefined,
  logLevel: LogLevel.DEBUG,
  fileLogger: true,
  matterLogLevel: LogLevel.DEBUG,
  matterFileLogger: true,
  mdnsInterface: undefined,
  ipv4Address: undefined,
  ipv6Address: undefined,
  port: MATTER_PORT,
  discriminator: DISCRIMINATOR,
  passcode: PASSCODE,
  shellySysUpdate: false,
  shellyMainUpdate: false,
  systemInformation: {
    interfaceName: nic?.interfaceName || '',
    macAddress: nic?.macAddress || '',
    ipv4Address: nic?.ipv4Address || '',
    ipv6Address: nic?.ipv6Address || '',
    nodeVersion: process.versions.node,
    hostname: os.hostname(),
    user: os.userInfo().username,
    osType: os.type(),
    osRelease: os.release(),
    osPlatform: os.platform(),
    osArch: os.arch(),

    totalMemory: formatBytes(os.totalmem()),
    freeMemory: formatBytes(os.freemem()),
    systemUptime: formatUptime(os.uptime()),
    processUptime: formatUptime(Math.floor(process.uptime())),
    cpuUsage: formatPercent(0),
    processCpuUsage: formatPercent(0),
    rss: formatBytes(process.memoryUsage().rss),
    heapTotal: formatBytes(process.memoryUsage().heapTotal),
    heapUsed: formatBytes(process.memoryUsage().heapUsed),
  },
};
// process.stdout.write(`Shared matterbridge:\n${JSON.stringify(matterbridge, null, 2)}\n`);

// Setup the test environment
await setupTest(NAME, false);

describe('MatterNode accessory', () => {
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

  beforeAll(async () => {
    // process.stdout.write('=== Starting MatterNode childbridge tests ===\n\n');

    // Create MatterNode instance
    matter = new MatterNode(matterbridge, 'matterbridge-mock4');
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Close broadcast server and mDNS instance
    await matter.destroy();

    // Close PluginManager and DeviceManager
    pluginManager.destroy();
    deviceManager.destroy();

    // Restore all mocks
    jest.restoreAllMocks();

    // Log any keep-alive handles
    // logKeepAlives(matter.log);

    // process.stdout.write('=== Finished MatterNode childbridge tests ===\n\n');
  });

  test('Add plugin', async () => {
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeStorage = new NodeStorageManager({ dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeContext = await pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');

    expect(await pluginManager.add('./src/mock/plugin4')).not.toBeNull();
    expect(pluginManager.length).toBe(1);
  });

  test('Create MatterNode in childbridge mode', async () => {
    await matter.create();
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeUndefined(); // In childbridge mode, serverNode is created on start
  });

  test('Stress test adding and removing bridged endpoints in bridge mode not started', async () => {
    expect(deviceManager.length).toBe(0);
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffOutlet, powerSource], { id: `Outlet ${i}` }, true)
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
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
  });

  test('Stress test adding and removing bridged endpoints in bridge mode started', async () => {
    expect(deviceManager.length).toBe(1);
    for (let i = 1; i <= STRESS_TEST_ITERATIONS; i++) {
      const outlet = new MatterbridgeEndpoint([onOffOutlet, powerSource], { id: `Outlet ${i}` }, true)
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
    await expect(() => matter.removeBridgedEndpoint('matterbridge-mock4', device)).rejects.toThrow(`Error removing endpoint ${plg}matterbridge-mock4${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): server node not found`);
    matter.serverNode = savedServer; // Restore server node

    // Remove the endpoint correctly
    await matter.removeBridgedEndpoint('matterbridge-mock4', device);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Removed bridged endpoint`));
    expect(device.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);

    // Close endpoint stores to avoid number persistence issues
    await matter.serverNode?.env.get(ServerNodeStore)?.endpointStores.close();

    // Wrong matter device with bridged device
    const occSensor = new MatterbridgeEndpoint([occupancySensor, bridgedNode], { id: 'Motion sensor', mode: 'matter' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Motion sensor', 'MOT1234567890').addRequiredClusterServers();
    occSensor.plugin = 'matterbridge-mock4';
    expect(await matter.addBridgedEndpoint('matterbridge-mock4', occSensor)).toBeUndefined();
    expect(occSensor.owner).toBeUndefined();
    expect(deviceManager.length).toBe(1);
  });

  test('Stop MatterNode in childbridge mode', async () => {
    await matter.stop();
    expect(matter.serverNode).toBeUndefined();
    expect(matter.matterStorageService).toBeUndefined();
  });
});
