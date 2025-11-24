// src\matterNode.test.ts

const MATTER_PORT = 10000;
const NAME = 'MatterNode';
const HOMEDIR = path.join('jest', NAME);
const PASSCODE = 123456;
const DISCRIMINATOR = 3860;

process.argv = [...originalProcessArgv, '--verbose'];
process.env['MATTERBRIDGE_REMOVE_ALL_ENDPOINT_TIMEOUT_MS'] = '10';

import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import url from 'node:url';

import { jest } from '@jest/globals';
import { AnsiLogger, CYAN, db, er, LogLevel, nf, TimestampFormat, zb } from 'node-ansi-logger';
import { Logger } from '@matter/general';
import { ExposedFabricInformation, FabricAction } from '@matter/protocol';
import { FabricId, FabricIndex, NodeId, VendorId } from '@matter/types/datatype';
import { SessionsBehavior } from '@matter/main/node';
import { NodeStorageManager } from 'node-persist-manager';
import { Identify, PressureMeasurement, RelativeHumidityMeasurement, TemperatureMeasurement } from '@matter/main/clusters';

import { MatterNode } from './matterNode.js';
import { SharedMatterbridge, Plugin, plg, dev, MATTER_STORAGE_NAME, NODE_STORAGE_DIR } from './matterbridgeTypes.js';
import { flushAsync, loggerDebugSpy, loggerErrorSpy, loggerInfoSpy, loggerNoticeSpy, logKeepAlives, originalProcessArgv, setDebug, setupTest } from './jestutils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';
import { getInterfaceDetails } from './utils/network.js';
import { formatBytes, formatPercent, formatUptime } from './utils/format.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { bridgedNode, flowSensor, humiditySensor, powerSource, pressureSensor, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { copyDirectory } from './utils/copyDirectory.js';
import { PluginManager } from './pluginManager.js';
import type { Matterbridge } from './matterbridge.js';
import { DeviceManager } from './deviceManager.js';

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

describe('MatterNode', () => {
  let matter: MatterNode;

  // Create BroadcastServer for tests
  const log = new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const testServer = new BroadcastServer('manager', log);

  // Create PluginManager and DeviceManager to simulate the normal environment
  /* Simulate normal environment in test */
  const pluginManager = new PluginManager(matterbridge as Matterbridge);
  /* Simulate normal environment in test */
  const deviceManager = new DeviceManager();

  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    process.stdout.write('=== Starting MatterNode tests ===\n\n');

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

    // Close broadcast servers
    pluginManager.destroy();
    deviceManager.destroy();

    // Restore all mocks
    jest.restoreAllMocks();

    // Log any keep-alive handles
    await flushAsync();
    // @ts-expect-error log is private
    logKeepAlives(matter.log);

    process.stdout.write('=== Finished MatterNode tests ===\n\n');
  });

  test('Broadcast unknown server message type', async () => {
    // @ts-expect-error -- Testing unknown message type
    expect(testServer.request({ type: 'unknown', src: testServer.name, dst: 'matter', params: {} })).toBeUndefined();
  });

  test('Broadcast response server message type', async () => {
    // @ts-expect-error -- Testing unknown message type
    expect(testServer.respond({ type: 'unknown', id: 123456, timestamp: Date.now(), src: testServer.name, dst: 'matter', response: {} })).toBeUndefined();
    expect(testServer.respond({ type: 'get_log_level', id: 123456, timestamp: Date.now(), src: testServer.name, dst: 'matter', response: { logLevel: LogLevel.DEBUG, success: true } })).toBeUndefined();
    expect(testServer.respond({ type: 'set_log_level', id: 123456, timestamp: Date.now(), src: testServer.name, dst: 'matter', response: { logLevel: LogLevel.DEBUG, success: true } })).toBeUndefined();
  });

  test('Broadcast logLevel changes correctly', async () => {
    expect((await testServer.fetch({ type: 'set_log_level', src: testServer.name, dst: 'matter', params: { logLevel: LogLevel.DEBUG } })).response.logLevel).toBe(LogLevel.DEBUG);
    expect((await testServer.fetch({ type: 'get_log_level', src: testServer.name, dst: 'matter' })).response.logLevel).toBe(LogLevel.DEBUG);
  });

  test('Broadcast close', async () => {
    expect(testServer.close()).toBeUndefined();
  });

  test('MatterNode instance', async () => {
    expect(matter).toBeDefined();
    expect(matter).toBeInstanceOf(MatterNode);
    // @ts-expect-error access private property
    expect(matter.server.name).toBe('matter');
    // @ts-expect-error access private property
    expect(matter.server.listenerCount('broadcast_message')).toBe(1);
  });

  test('PluginManager instance', async () => {
    expect(pluginManager).toBeDefined();
    expect(pluginManager).toBeInstanceOf(PluginManager);
    expect(pluginManager.length).toBe(0);
  });

  test('DeviceManager instance', async () => {
    expect(deviceManager).toBeDefined();
    expect(deviceManager).toBeInstanceOf(DeviceManager);
    expect(deviceManager.length).toBe(0);
  });

  test('Should throw', async () => {
    await expect(matter.start()).rejects.toThrow();
    await expect(matter.stop()).rejects.toThrow();
    await expect((matter as any).createServerNodeContext()).rejects.toThrow();
    await expect((matter as any).createServerNode()).rejects.toThrow();
    await expect((matter as any).startServerNode()).rejects.toThrow();
    await expect((matter as any).stopServerNode()).rejects.toThrow();
    await expect((matter as any).createAggregatorNode()).rejects.toThrow();
    await expect((matter as any).createAccessoryPlugin('unknown')).rejects.toThrow();
    await expect((matter as any).createDynamicPlugin('unknown')).rejects.toThrow();
    await expect((matter as any).createDeviceServerNode('unknown')).rejects.toThrow();
  });

  test('Should resolve plugin name', async () => {
    const plugin: Plugin = {
      name: 'serverdevicetest',
      path: path.join('./src/mock/pluginserverdevice/package.json'),
      type: 'AccessoryPlatform',
      version: '1.0.0',
      description: 'Test accessory plugin',
      author: 'Test Author',
      enabled: true,
    };
    matter.pluginManager.set(plugin);
    const sensor = new MatterbridgeEndpoint([flowSensor], { id: 'Temperature sensor' }, true).createDefaultBasicInformationClusterServer('Flow sensor', 'FLOW1234567890').addRequiredClusterServers();
    await expect((matter as any).createAccessoryPlugin('serverdevicetest')).rejects.toThrow();
    await expect((matter as any).createDynamicPlugin('serverdevicetest')).rejects.toThrow();
    await expect((matter as any).createDeviceServerNode('serverdevicetest')).rejects.toThrow();
    matter.pluginManager.clear();
  });

  test('Load all plugins', async () => {
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeStorage = new NodeStorageManager({ dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeContext = await pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');

    expect(await pluginManager.add('./src/mock/plugin1')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/plugin2')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/plugin3')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/plugin4')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/plugin5')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/plugin6')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/pluginmatterdevice')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/pluginserverdevice')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/pluginmbatest')).not.toBeNull();
    expect(await pluginManager.add('./src/mock/pluginmbdtest')).not.toBeNull();
    expect(pluginManager.length).toBe(10);
  });

  test('Matter logger', async () => {
    await fs.promises.mkdir(matterbridge.matterbridgeDirectory, { recursive: true });
    expect(Logger.get('Matter')).toBeDefined();
    Logger.get('Matter').debug('Testing Matter logger debug message');
    Logger.get('Matter').info('Testing Matter logger info message');
    Logger.get('Matter').notice('Testing Matter logger notice message');
    Logger.get('Matter').warn('Testing Matter logger warn message');
    Logger.get('Matter').error('Testing Matter logger error message');
    Logger.get('Matter').fatal('Testing Matter logger fatal message');
  });

  test('Create server node context without matter storage service', async () => {
    // @ts-expect-error -- Testing without storage
    await expect(matter.createServerNodeContext()).rejects.toThrow('No storage service initialized');
  });

  test('Copy fabrics for server node for Matterbridge', async () => {
    const result = await copyDirectory(path.join('./src/mock/matterstorage/Matterbridge'), path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME, 'Matterbridge'));
    expect(result).toBeTruthy();
  });

  test('Start matter storage', async () => {
    expect(await matter.startMatterStorage()).toBeUndefined();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Started matter node storage in ${CYAN}${matter.matterStorageService?.location}${nf}`);
  });

  test('Create server node for Matterbridge', async () => {
    expect(await matter.createMatterbridgeServerNode()).toBeDefined();
    await matter.serverNode?.construction.ready;
    await matter.aggregatorNode?.construction.ready;
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Created ${plg}Matterbridge${db} server node`);
  });

  test('Start server node for Matterbridge', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const startPromise = matter.startServerNode();
    const onlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('online', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in online event');
      });
    });
    await Promise.all([startPromise, onlinePromise]);
  });

  test('Get server node for Matterbridge data', async () => {
    expect(matter.serverNode).toBeDefined();
    if (matter.serverNode === undefined) return;
    expect(matter.getServerNodeData(matter.serverNode)).toEqual({
      advertiseTime: expect.any(Number),
      advertising: false,
      commissioned: true,
      fabricInformations: [
        {
          fabricId: '2',
          fabricIndex: 1,
          label: 'Home',
          nodeId: '116',
          rootNodeId: '112233',
          rootVendorId: 4939,
          rootVendorName: '(HomeAssistant)',
        },
      ],
      id: 'Matterbridge',
      manualPairingCode: '35055412360',
      online: true,
      qrPairingCode: 'MT:Y.K90Q1212TG3D0AG00',
      serialNumber: expect.any(String),
      sessionInformations: [],
      windowStatus: 0,
    });
  });

  test('Server node commissioned', async () => {
    matter.serverNode?.lifecycle.commissioned.emit(undefined as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Server node for Matterbridge was initially commissioned successfully!`);
  });

  test('Server node decommissioned', async () => {
    matter.serverNode?.lifecycle.decommissioned.emit(undefined as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Server node for Matterbridge was fully decommissioned successfully!`);
  });

  test('Server node fabricsChanged', async () => {
    matter.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), FabricAction.Added);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} added on server node`));
    matter.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), FabricAction.Removed);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} removed on server node`));
    matter.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), FabricAction.Updated);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} updated on server node`));
  });

  test('Server node sessions.opened', async () => {
    matter.serverNode?.events.sessions.opened.emit({} as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Session opened on server node for Matterbridge`));
  });

  test('Server node sessions.closed', async () => {
    matter.serverNode?.events.sessions.closed.emit({} as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Session closed on server node for Matterbridge`));
  });

  test('Server node sessions.subscriptionsChanged', async () => {
    matter.serverNode?.events.sessions.subscriptionsChanged.emit({} as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Session subscriptions changed on server node for Matterbridge`));
  });

  test('Set aggregator reachability', async () => {
    const tempSensor = new MatterbridgeEndpoint([temperatureSensor, bridgedNode], { id: 'Temperature sensor' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890').addRequiredClusterServers();
    await matter.aggregatorNode?.add(tempSensor);
    expect(await (matter as any).setAggregatorReachability(matter.aggregatorNode, false)).toBeUndefined();
    expect(await (matter as any).setAggregatorReachability(matter.aggregatorNode, true)).toBeUndefined();
    await tempSensor.delete();
  });

  test('Add endpoint to the Matter aggregator node for Matterbridge', async () => {
    expect(deviceManager.length).toBe(0);
    device = new MatterbridgeEndpoint([pressureSensor, bridgedNode, powerSource], { id: 'Climate sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Climate sensor', 'CLIMATE1234567890')
      .createDefaultPowerSourceBatteryClusterServer()
      .addRequiredClusterServers();
    device.addChildDeviceTypeWithClusterServer('Temperature sensor child', temperatureSensor, [Identify.Cluster.id, TemperatureMeasurement.Cluster.id]);
    device.addChildDeviceTypeWithClusterServer('Humidity sensor child', humiditySensor, [Identify.Cluster.id, RelativeHumidityMeasurement.Cluster.id]);
    device.plugin = 'matterbridge-mock1';

    // Test adding to unknown plugin
    await expect(() => matter.addBridgedEndpoint('matterbridge-unknown', device)).rejects.toThrow(`Error adding bridged endpoint ${plg}matterbridge-unknown${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): plugin not found`);
    expect(deviceManager.length).toBe(0);
    jest.clearAllMocks();

    // Test adding when no aggregator node
    const saved = matter.aggregatorNode; // Save aggregator node
    matter.aggregatorNode = undefined;
    expect(await matter.pluginManager.add('./src/mock/plugin1')).not.toBeNull();
    await expect(() => matter.addBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(`Aggregator node not found for endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`);
    matter.aggregatorNode = saved; // Restore aggregator node
    expect(deviceManager.length).toBe(0);
    jest.clearAllMocks();

    // Test adding matter mode when no server node
    const savedServer = matter.serverNode; // Save server node
    matter.serverNode = undefined;
    device.mode = 'matter';
    await expect(() => matter.addBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(`Server node not found for matter endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`);
    matter.serverNode = savedServer; // Restore server node
    device.mode = undefined; // Restore mode
    expect(deviceManager.length).toBe(0);
    jest.clearAllMocks();

    // Test adding not device
    await matter.addBridgedEndpoint('matterbridge-mock1', {} as any);
    expect(deviceManager.length).toBe(0);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Matter error adding bridged endpoint`));
    jest.clearAllMocks();

    // Add correctly
    await matter.addBridgedEndpoint('matterbridge-mock1', device);
    expect(device.owner).toBeDefined();
    expect(device.lifecycle.isReady).toBe(true);
    expect(deviceManager.length).toBe(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Added endpoint`));
    expect(await device.setAttribute(PressureMeasurement.Cluster.id, 'measuredValue', 1000)).toBeTruthy();
    expect(device.getChildEndpointByName('Temperature sensor child')).toBeUndefined(); // Test getChildEndpointByName with name with spaces
    expect(device.getChildEndpointByName('Humidity sensor child')).toBeUndefined(); // Test getChildEndpointByName with name with spaces
    expect(device.getChildEndpointByOriginalId('Temperature sensor child')).toBeDefined(); // Test getChildEndpointByName with originalId
    expect(device.getChildEndpointByOriginalId('Humidity sensor child')).toBeDefined(); // Test getChildEndpointByName with originalId
    expect(await device.getChildEndpointByOriginalId('Temperature sensor child')?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', 2850)).toBeTruthy();
    expect(await device.getChildEndpointByOriginalId('Humidity sensor child')?.setAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', 5500)).toBeTruthy();

    // Add time to process asynchronous operations in ServerEndpointStores.storeForEndpoint
    await matter.yieldToNode(250);
  });

  test('Remove endpoint from the Matter aggregator node for Matterbridge', async () => {
    await setDebug(false);
    expect(deviceManager.length).toBe(1);

    // Test removing from unknown plugin
    await expect(() => matter.removeBridgedEndpoint('matterbridge-unknown', device)).rejects.toThrow(`Error removing bridged endpoint ${plg}matterbridge-unknown${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): plugin not found`);
    expect(deviceManager.length).toBe(1);

    // Test removing when no aggregator node
    const savedAggregator = matter.aggregatorNode;
    matter.aggregatorNode = undefined;
    await expect(() => matter.removeBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(`Error removing bridged endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`);
    expect(deviceManager.length).toBe(1);
    matter.aggregatorNode = savedAggregator; // Restore aggregator node

    // Test removing correctly
    await matter.removeBridgedEndpoint('matterbridge-mock1', device);
    expect(device.owner).toBeUndefined();
    expect(deviceManager.length).toBe(0);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Removed bridged endpoint #undefined ${plg}matterbridge-mock1${nf}:${dev}${device.deviceName}${nf} (${zb}${device.name}${nf})`);
  });

  test('Remove all endpoints from the Matter aggregator node for Matterbridge', async () => {
    await setDebug(false);
    expect(deviceManager.length).toBe(0);

    const tmpSensor = new MatterbridgeEndpoint([temperatureSensor, bridgedNode], { id: 'Temperature sensor' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890').addRequiredClusterServers();
    tmpSensor.plugin = 'matterbridge-mock1';
    await matter.addBridgedEndpoint('matterbridge-mock1', tmpSensor);
    expect(tmpSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(1);

    const humSensor = new MatterbridgeEndpoint([humiditySensor, bridgedNode], { id: 'Humidity sensor' }, true).createDefaultBridgedDeviceBasicInformationClusterServer('Humidity sensor', 'HUM1234567890').addRequiredClusterServers();
    humSensor.plugin = 'matterbridge-mock1';
    await matter.addBridgedEndpoint('matterbridge-mock1', humSensor);
    expect(humSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(2);

    // Test removing from unknown plugin
    await expect(() => matter.removeAllBridgedEndpoints('matterbridge-unknown')).rejects.toThrow(`Error removing all bridged endpoints for plugin ${plg}matterbridge-unknown${er}: plugin not found`);
    expect(deviceManager.length).toBe(2);

    // Test removing correctly
    await matter.removeAllBridgedEndpoints('matterbridge-mock1', 10);
    expect(deviceManager.length).toBe(0);
  });

  test('Add virtual endpoint to the Matter aggregator node for Matterbridge', async () => {
    await setDebug(false);
    expect(deviceManager.length).toBe(0);

    // Test adding to unknown plugin
    expect(await matter.addVirtualEndpoint('matterbridge-unknown', 'Virtual device', 'switch', async () => {})).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Error adding virtual endpoint ${plg}matterbridge-unknown${er}:${dev}Virtual device${er}: plugin not found`);

    // Test adding AccessoryPlugin
    (matter as any).matterbridge.bridgeMode = 'childbridge';
    expect(await matter.pluginManager.add('./src/mock/plugin4')).not.toBeNull();
    expect(await matter.addVirtualEndpoint('matterbridge-mock4', 'Virtual device', 'switch', async () => {})).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Virtual devices are only supported in bridge mode and childbridge mode with a DynamicPlatform`);
    (matter as any).matterbridge.bridgeMode = 'bridge';

    // Test adding with no aggregator node
    const saved = matter.aggregatorNode;
    matter.aggregatorNode = undefined;
    expect(await matter.addVirtualEndpoint('matterbridge-mock1', 'Virtual device', 'switch', async () => {})).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Aggregator node not found for plugin ${plg}matterbridge-mock1${er} adding virtual endpoint ${dev}Virtual device${er}`);
    matter.aggregatorNode = saved;

    // Test correctly
    expect(await matter.addVirtualEndpoint('matterbridge-mock1', 'Virtual device', 'switch', async () => {})).toBe(true);
    expect(deviceManager.length).toBe(0);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Created virtual device ${plg}matterbridge-mock1${db}:${dev}Virtual device${db}`);

    // Test duplicated
    expect(await matter.addVirtualEndpoint('matterbridge-mock1', 'Virtual device', 'switch', async () => {})).toBe(false);
    expect(deviceManager.length).toBe(0);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Virtual device ${plg}matterbridge-mock1${er}:${dev}Virtual device${er} already registered. Please use a different name.`);

    expect(await matter.pluginManager.remove('./src/mock/plugin1')).not.toBeNull();
    expect(await matter.pluginManager.remove('./src/mock/plugin4')).not.toBeNull();
  });

  test('Stop server node for Matterbridge', async () => {
    await setDebug(false);
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const stopPromise = matter.stopServerNode();
    const offlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('offline', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in offline event');
      });
    });
    await Promise.all([stopPromise, offlinePromise]);
  });

  test('Create server node for Accessory plugin', async () => {
    const plugin: Plugin = {
      name: 'TestAccessoryPlugin',
      path: path.join('./src/mock/plugin4/package.json'),
      type: 'AccessoryPlatform',
      version: '1.0.0',
      description: 'Test accessory plugin',
      author: 'Test Author',
      enabled: true,
    };
    const sensor = new MatterbridgeEndpoint(temperatureSensor, { id: 'Temperature sensor' }, true).createDefaultBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890').addRequiredClusterServers();
    expect(await matter.createAccessoryPlugin(plugin, sensor)).toBeDefined();
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Created accessory plugin ${plg}${plugin.name}${db} server node`);
  });

  test('Start server node for Accessory plugin', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const startPromise = matter.startServerNode();
    const onlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('online', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in online event');
      });
    });
    await Promise.all([startPromise, onlinePromise]);
  });

  test('Stop server node for Accessory plugin', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const stopPromise = matter.stopServerNode();
    const offlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('offline', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in offline event');
      });
    });
    await Promise.all([stopPromise, offlinePromise]);
  });

  test('Create server node for Dynamic plugin', async () => {
    const plugin: Plugin = {
      name: 'TestDynamicPlugin',
      path: path.join('./src/mock/plugin1/package.json'),
      type: 'DynamicPlatform',
      version: '1.0.0',
      description: 'Test dynamic plugin',
      author: 'Test Author',
      enabled: true,
    };
    expect(await matter.createDynamicPlugin(plugin)).toBeDefined();
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Created dynamic plugin ${plg}${plugin.name}${db} server node`);
  });

  test('Start server node for Dynamic plugin', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const startPromise = matter.startServerNode();
    const onlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('online', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in online event');
      });
    });
    await Promise.all([startPromise, onlinePromise]);
  });

  test('Stop server node for Dynamic plugin', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const stopPromise = matter.stopServerNode();
    const offlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('offline', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in offline event');
      });
    });
    await Promise.all([stopPromise, offlinePromise]);
  });

  test('Create device server node', async () => {
    const plugin: Plugin = {
      name: 'TestServerDevice',
      path: path.join('./src/mock/pluginserverdevice/package.json'),
      type: 'AccessoryPlatform',
      version: '1.0.0',
      description: 'A test accessory plugin',
      author: 'Test Author',
      enabled: true,
    };
    const sensor = new MatterbridgeEndpoint(temperatureSensor, { id: 'Temperature sensor', mode: 'server' }, true).createDefaultBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890').addRequiredClusterServers();
    expect(await matter.createDeviceServerNode(plugin, sensor)).toBeDefined();
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Created device ${plg}${plugin.name}${db}:${dev}${sensor.deviceName}${db} server node`);
  });

  test('Start device server node', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const startPromise = matter.startServerNode();
    const onlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('online', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in online event');
      });
    });
    await Promise.all([startPromise, onlinePromise]);
  });

  test('Stop device server node', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    const stopPromise = matter.stopServerNode();
    const offlinePromise = new Promise<void>((resolve, reject) => {
      matter.once('offline', (nodeId) => {
        if (nodeId === matter.serverNode?.id) resolve();
        else reject('Incorrect nodeId in offline event');
      });
    });
    await Promise.all([stopPromise, offlinePromise]);
  });

  test('Stop matter storage', async () => {
    expect(await matter.stopMatterStorage()).toBeUndefined();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Closed matter node storage`);
  });

  test('Sanitize fabrics', () => {
    const fabricInfos: ExposedFabricInformation[] = [
      {
        fabricIndex: FabricIndex(1),
        fabricId: FabricId(45653242346465555556n),
        nodeId: NodeId(556546442432656555556n),
        rootNodeId: NodeId(5565442324264656555556n),
        rootVendorId: VendorId(4996),
        label: 'Fabric 1 label',
      },
      {
        fabricIndex: FabricIndex(2),
        fabricId: FabricId(45654621214656555556n),
        nodeId: NodeId(556546462112156555556n),
        rootNodeId: NodeId(556546412212656555556n),
        rootVendorId: VendorId(4937),
        label: 'Fabric 2 label',
      },
    ];
    expect(matter.sanitizeFabricInformations(fabricInfos).length).toBe(2);
    expect(() => {
      JSON.stringify(fabricInfos);
    }).toThrow();
    expect(JSON.stringify(matter.sanitizeFabricInformations(fabricInfos)).length).toBe(402);
  });

  test('Sanitize sessions', () => {
    let sessionInfos: SessionsBehavior.Session[] = [
      {
        name: 'secure/64351',
        nodeId: NodeId(16784206195868397986n),
        peerNodeId: NodeId(1604858123872676291n),
        fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
        isPeerActive: true,
        lastInteractionTimestamp: 1720035723121269,
        lastActiveTimestamp: 1720035761223121,
        numberOfActiveSubscriptions: 0,
      },
    ];
    expect(() => {
      JSON.stringify(sessionInfos);
    }).toThrow();
    expect(matter.sanitizeSessionInformation(sessionInfos).length).toBe(1);
    expect(JSON.stringify(matter.sanitizeSessionInformation(sessionInfos)).length).toBe(450);
    sessionInfos = [
      {
        name: 'secure/64351',
        nodeId: NodeId(16784206195868397986n),
        peerNodeId: NodeId(1604858123872676291n),
        fabric: { fabricIndex: FabricIndex(2), fabricId: FabricId(456546212146567986n), nodeId: NodeId(1678420619586823323397986n), rootNodeId: NodeId(18446744060824623349729n), rootVendorId: VendorId(4362), label: 'SmartThings Hub 0503' },
        isPeerActive: false,
        lastInteractionTimestamp: 1720035723121269,
        lastActiveTimestamp: 1720035761223121,
        numberOfActiveSubscriptions: 0,
      },
    ];
    expect(matter.sanitizeSessionInformation(sessionInfos).length).toBe(0);
  });

  test('Get VendorId name', () => {
    expect((matter as any).getVendorIdName(undefined)).toBe('');
    expect((matter as any).getVendorIdName(4937)).toContain('AppleHome');
    expect((matter as any).getVendorIdName(4996)).toContain('AppleKeyChain');
    expect((matter as any).getVendorIdName(4362)).toContain('SmartThings');
    expect((matter as any).getVendorIdName(4939)).toContain('HomeAssistant');
    expect((matter as any).getVendorIdName(24582)).toContain('GoogleHome');
    expect((matter as any).getVendorIdName(4631)).toContain('Alexa');
    expect((matter as any).getVendorIdName(4701)).toContain('Tuya');
    expect((matter as any).getVendorIdName(4718)).toContain('Xiaomi');
    expect((matter as any).getVendorIdName(4742)).toContain('eWeLink');
    expect((matter as any).getVendorIdName(5264)).toContain('Shelly');
    expect((matter as any).getVendorIdName(0x1488)).toContain('ShortcutLabsFlic');
    expect((matter as any).getVendorIdName(65521)).toContain('MatterTest');
    expect((matter as any).getVendorIdName(1)).toContain('Unknown vendorId');
  });
});
