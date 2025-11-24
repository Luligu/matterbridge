// src\matterNode.bridge.test.ts

const MATTER_PORT = 10001;
const NAME = 'MatterNodeBridge';
const HOMEDIR = path.join('jest', NAME);
const PASSCODE = 123457;
const DISCRIMINATOR = 3861;

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
import { SharedMatterbridge, Plugin, plg, dev, NODE_STORAGE_DIR } from './matterbridgeTypes.js';
import { closeServerNodeStores, flushAsync, logKeepAlives, originalProcessArgv, setDebug, setupTest } from './jestutils/jestHelpers.js';
import { getInterfaceDetails } from './utils/network.js';
import { formatBytes, formatPercent, formatUptime } from './utils/format.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { PluginManager } from './pluginManager.js';
import type { Matterbridge } from './matterbridge.js';
import { DeviceManager } from './deviceManager.js';
import { bridgedNode, flowSensor, humiditySensor, occupancySensor, temperatureSensor } from './matterbridgeDeviceTypes.js';

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
  bridgeMode: 'bridge',
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

describe('MatterNode bridge', () => {
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
    // process.stdout.write('=== Starting MatterNode bridge tests ===\n\n');

    // Create MatterNode instance
    matter = new MatterNode(matterbridge);
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

    // process.stdout.write('=== Finished MatterNode bridge tests ===\n\n');
  });

  test('Add plugin', async () => {
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeStorage = new NodeStorageManager({ dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeContext = await pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');

    expect(await pluginManager.add('./src/mock/plugin1')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/plugin4')).not.toBeNull();
    expect(pluginManager.length).toBe(2);
  });

  test('Create MatterNode in bridge mode', async () => {
    await expect(matter.start()).rejects.toThrow();
    await expect(matter.stop()).rejects.toThrow();

    await matter.create();
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
      registeredDevices: 0,
    };
    matter.pluginManager.set(pluginMatter);

    const tmpSensor = new MatterbridgeEndpoint([temperatureSensor], { id: 'Temperature sensor', mode: 'matter' }, true).createDefaultBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890').addRequiredClusterServers();
    tmpSensor.plugin = 'matterdevicetest';

    // Test no server node
    const savedServer = matter.serverNode;
    matter.serverNode = undefined;
    await expect(() => matter.addBridgedEndpoint('matterdevicetest', tmpSensor)).rejects.toThrow(`Server node not found for matter endpoint ${plg}matterdevicetest${er}:${dev}${tmpSensor.deviceName}${er} (${zb}${tmpSensor.name}${er})`);
    matter.serverNode = savedServer;

    // Test correctly adding
    await matter.addBridgedEndpoint('matterdevicetest', tmpSensor);
    expect(tmpSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(1);

    const humSensor = new MatterbridgeEndpoint([humiditySensor, bridgedNode], { id: 'Humidity sensor' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Humidity sensor', 'HUM1234567890').addRequiredClusterServers();
    humSensor.plugin = 'serverdevicetest';
    await matter.addBridgedEndpoint('serverdevicetest', humSensor);
    expect(humSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(2);

    // Close endpoint stores to avoid number persistence issues with next test
    await closeServerNodeStores(matter.serverNode);

    // Wrong matter device with bridged device
    const occSensor = new MatterbridgeEndpoint([occupancySensor, bridgedNode], { id: 'Motion sensor', mode: 'matter' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Motion sensor', 'MOT1234567890').addRequiredClusterServers();
    occSensor.plugin = 'serverdevicetest';
    expect(await matter.addBridgedEndpoint('serverdevicetest', occSensor)).toBeUndefined();
    expect(occSensor.owner).toBeUndefined();
    expect(deviceManager.length).toBe(2);

    await matter.removeAllBridgedEndpoints('matterdevicetest');
    await matter.removeAllBridgedEndpoints('serverdevicetest');
    expect(deviceManager.length).toBe(0);

    const sensor = new MatterbridgeEndpoint([flowSensor, bridgedNode], { id: 'Flow sensor' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Flow sensor', 'FLOW1234567890').addRequiredClusterServers();
    sensor.plugin = 'serverdevicetest';
    await matter.addBridgedEndpoint('serverdevicetest', sensor);
    expect(sensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(1);
    await matter.aggregatorNode?.parts.get('Flowsensor')?.delete();
    await expect(matter.removeAllBridgedEndpoints('serverdevicetest')).rejects.toThrow(`Endpoint ${plg}${sensor.plugin}${er}:${dev}${sensor.deviceName}${er} id ${sensor.id} not found removing all endpoints`);
  });

  test('Start MatterNode in bridge mode', async () => {
    await setDebug(false);
    await matter.start();
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(true);
    expect(matter.aggregatorNode).toBeDefined();
  });

  test('Stop MatterNode in bridge mode', async () => {
    await matter.stop();
    expect(matter.serverNode).toBeUndefined();
    expect(matter.aggregatorNode).toBeUndefined();
    expect(matter.matterStorageService).toBeUndefined();
  });
});
