// src\matterNode.bridge.test.ts

const MATTER_PORT = 10020;
const NAME = 'MatterNodeServer';
const HOMEDIR = path.join('jest', NAME);
const PASSCODE = 123460;
const DISCRIMINATOR = 3864;
const STRESS_TEST_ITERATIONS = 5;

process.argv = [...originalProcessArgv, '--verbose'];
process.env['MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS'] = '10';

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';
import { formatBytes, formatPercent, formatUptime, getInterfaceDetails } from '@matterbridge/utils';

import { MatterNode } from './matterNode.js';
import { SharedMatterbridge, NODE_STORAGE_DIR } from './matterbridgeTypes.js';
import { originalProcessArgv, setupTest, setDebug } from './jestutils/jestHelpers.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { PluginManager } from './pluginManager.js';
import type { Matterbridge } from './matterbridge.js';
import { DeviceManager } from './deviceManager.js';
import { temperatureSensor } from './matterbridgeDeviceTypes.js';

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

  beforeAll(async () => {
    // process.stdout.write('=== Starting MatterNode server tests ===\n\n');

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

    // process.stdout.write('=== Finished MatterNode server tests ===\n\n');
  });

  test('Add plugin', async () => {
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeStorage = new NodeStorageManager({ dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeContext = await pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');

    expect(await pluginManager.add('./src/mock/plugin1')).not.toBeNull();
    expect(pluginManager.length).toBe(1);
  });

  test('Create MatterNode in bridge mode', async () => {
    await matter.create();
    expect(matter.matterStorageService).toBeDefined();
    expect(matter.serverNode).toBeDefined();
    expect(matter.serverNode?.lifecycle.isOnline).toBe(false);
    expect(matter.aggregatorNode).toBeDefined();
  });

  test('Create MatterNode instance in server mode', async () => {
    const tmpSensor = new MatterbridgeEndpoint([temperatureSensor], { id: 'Temperature sensor', mode: 'server' }, true).createDefaultBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890').addRequiredClusterServers();
    tmpSensor.plugin = 'matterbridge-mock1';
    const spy = jest.spyOn(MatterNode.prototype, 'create').mockImplementationOnce(async () => {
      throw new Error('Simulated create error');
    });
    expect(await matter.addBridgedEndpoint('matterbridge-mock1', tmpSensor)).toBeUndefined();
    spy.mockRestore();
    matter.dependantMatterNodes.get('Temperaturesensor')?.destroy();
    expect(await matter.addBridgedEndpoint('matterbridge-mock1', tmpSensor)).not.toBeUndefined();
  });

  test('Start MatterNode in bridge mode', async () => {
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
