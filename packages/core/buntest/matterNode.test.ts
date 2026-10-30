/**
 * @file packages/core/buntest/matterNode.test.ts
 * @description This file contains the tests for the MatterNode class.
 * @author Luca Liguori
 */

const MATTER_PORT = 10000;
const NAME = 'MatterNode';
const PASSCODE = 123456;
const DISCRIMINATOR = 3860;

import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

import { StorageContext } from '@matter/general';
import { BasicInformationServer } from '@matter/node/behaviors/basic-information';
import { PowerSourceServer } from '@matter/node/behaviors/power-source';
import { Identify, PowerSource, PressureMeasurement, RelativeHumidityMeasurement, TemperatureMeasurement } from '@matter/types/clusters';
import { FabricIndex } from '@matter/types/datatype';
import { closeServerNodeStores, getSharedMatterbridge } from '@matterbridge/test-utils/buntest/matter';
import { loggerDebugSpy, loggerErrorSpy, loggerInfoSpy, loggerNoticeSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { BroadcastServer } from '@matterbridge/thread';
import type { SharedMatterbridge } from '@matterbridge/types';
import { dev, MATTER_STORAGE_DIR, NODE_STORAGE_DIR, plg } from '@matterbridge/types';
import { copyDirectory } from '@matterbridge/utils';
import { getInterfaceName } from '@matterbridge/utils/network';
import { AnsiLogger, CYAN, db, er, LogLevel, nf, TimestampFormat, zb } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { DeviceManager } from '../src/deviceManager.js';
import type { Matterbridge } from '../src/matterbridge.js';
import { bridgedNode, flowSensor, humiditySensor, powerSource, pressureSensor, temperatureSensor } from '../src/matterbridgeDeviceTypes.js';
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

  beforeAll(() => {
    // Create MatterNode instance
    matter = new MatterNode(matterbridge);
    expect(loggerDebugSpy).toHaveBeenCalledWith('MatterNode for Matterbridge loaded');
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Close broadcast server and mDNS instance
    await matter.destroy();

    // Close broadcast servers
    pluginManager.destroy();
    deviceManager.destroy();

    // Restore all mocks
    vi.restoreAllMocks();

    // Log any keep-alive handles
    // logKeepAlives(matter.log);
  });

  test('Broadcast unknown server message type', () => {
    // @ts-expect-error -- Testing unknown message type
    expect(testServer.request({ type: 'unknown', src: testServer.name, dst: 'matter', params: {} })).toBeUndefined();
  });

  test('Broadcast response server message type', () => {
    // @ts-expect-error -- Testing unknown message type
    expect(testServer.respond({ type: 'unknown', id: 123456, timestamp: Date.now(), src: testServer.name, dst: 'matter', result: { success: true } })).toBeUndefined();
    expect(
      testServer.respond({ type: 'get_log_level', id: 123456, timestamp: Date.now(), src: testServer.name, dst: 'matter', result: { logLevel: LogLevel.DEBUG } }),
    ).toBeUndefined();
    expect(
      testServer.respond({ type: 'set_log_level', id: 123456, timestamp: Date.now(), src: testServer.name, dst: 'matter', result: { logLevel: LogLevel.DEBUG } }),
    ).toBeUndefined();
  });

  test('Broadcast logLevel changes correctly', async () => {
    expect((await testServer.fetch({ type: 'set_log_level', src: testServer.name, dst: 'matter', params: { logLevel: LogLevel.DEBUG } })).result.logLevel).toBe(LogLevel.DEBUG);
    expect((await testServer.fetch({ type: 'get_log_level', src: testServer.name, dst: 'matter' })).result.logLevel).toBe(LogLevel.DEBUG);
  });

  test('Broadcast close', () => {
    expect(testServer.close()).toBeUndefined();
  });

  test('should log errors when the broadcast message handler rejects', async () => {
    const error = new Error('Broadcast handler rejection');
    const handlerSpy = vi.spyOn(matter, 'msgHandler').mockRejectedValueOnce(error);
    try {
      // @ts-expect-error access private property
      matter.server.emit('broadcast_message', { type: 'get_log_level', src: 'test', dst: 'matter' });
      await Promise.resolve();
      expect(handlerSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Broadcast message handler failed'));
    } finally {
      handlerSpy.mockRestore();
    }
  });

  test('MatterNode instance', () => {
    expect(matter).toBeDefined();
    expect(matter).toBeInstanceOf(MatterNode);
    // @ts-expect-error access private property
    expect(matter.server.name).toBe('matter');
    // @ts-expect-error access private property
    expect(matter.server.listenerCount('broadcast_message')).toBe(1);
  });

  test('pluginStatusUpdate should update the plugin manager and broadcast a plugin_status_update message to the frontend', () => {
    // @ts-expect-error access private property
    const requestSpy = vi.spyOn(matter.server, 'request').mockImplementation(() => {});
    try {
      matter.pluginStatusUpdate('matterbridge-test', { started: true, registeredDevices: 2 });
      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(requestSpy).toHaveBeenCalledWith({
        type: 'plugins_set',
        src: 'matter',
        dst: 'plugins',
        params: { plugin: { name: 'matterbridge-test', started: true, registeredDevices: 2 } },
      });
      expect(requestSpy).toHaveBeenCalledWith({
        type: 'frontend_broadcast_message',
        src: 'matter',
        dst: 'frontend',
        params: {
          msg: {
            id: 0,
            src: 'Matterbridge',
            dst: 'Frontend',
            method: 'plugin_status_update',
            success: true,
            response: { plugin: 'matterbridge-test', status: { started: true, registeredDevices: 2 } },
          },
        },
      });
    } finally {
      requestSpy.mockRestore();
    }
  });

  test('matterbridgeStatusUpdate should broadcast a matterbridge_status_update message to the frontend', () => {
    // @ts-expect-error access private property
    const requestSpy = vi.spyOn(matter.server, 'request').mockImplementation(() => {});
    try {
      matter.matterbridgeStatusUpdate('started');
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({
        type: 'frontend_broadcast_message',
        src: 'matter',
        dst: 'frontend',
        params: { msg: { id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'matterbridge_status_update', success: true, response: { status: 'started' } } },
      });
    } finally {
      requestSpy.mockRestore();
    }
  });

  test('PluginManager instance', () => {
    // @ts-expect-error access private property
    expect(matter.pluginManager.matterbridge.getPlatformMatterbridge()).toBe(matterbridge);
    expect(pluginManager).toBeDefined();
    expect(pluginManager).toBeInstanceOf(PluginManager);
    expect(pluginManager.length).toBe(0);
  });

  test('DeviceManager instance', () => {
    expect(deviceManager).toBeDefined();
    expect(deviceManager).toBeInstanceOf(DeviceManager);
    expect(deviceManager.length).toBe(0);
  });

  test('Should throw', async () => {
    expect(matter.start()).rejects.toThrow();
    expect(matter.stop()).rejects.toThrow();
    expect((matter as any).createServerNodeContext()).rejects.toThrow();
    expect((matter as any).createServerNode()).rejects.toThrow();
    expect((matter as any).startServerNode()).rejects.toThrow();
    expect((matter as any).stopServerNode()).rejects.toThrow();
    expect((matter as any).createAggregatorNode()).rejects.toThrow();
    expect((matter as any).createAccessoryPlugin('unknown')).rejects.toThrow();
    expect((matter as any).createDynamicPlugin('unknown')).rejects.toThrow();
    expect((matter as any).createDeviceServerNode('unknown')).rejects.toThrow();
  });

  test('Should resolve plugin name', async () => {
    const plugin: Plugin = {
      name: 'serverdevicetest',
      path: path.join('./src/mock/pluginserverdevice/package.json'),
      type: 'AccessoryPlatform',
      version: '1.0.0',
      configurationVersion: 1,
      description: 'Test accessory plugin',
      author: 'Test Author',
      enabled: true,
      private: true,
    };
    matter.pluginManager.set(plugin);
    const sensor = new MatterbridgeEndpoint([flowSensor], { id: 'Temperature sensor' }, true)
      .createDefaultBasicInformationClusterServer('Flow sensor', 'FLOW1234567890')
      .addRequiredClusterServers();
    expect((matter as any).createAccessoryPlugin('serverdevicetest')).rejects.toThrow();
    expect((matter as any).createDynamicPlugin('serverdevicetest')).rejects.toThrow();
    expect((matter as any).createDeviceServerNode('serverdevicetest')).rejects.toThrow();
    matter.pluginManager.clear();
  });

  test('Load all plugins', async () => {
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeStorage = new NodeStorageManager({
      dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
    });
    // @ts-expect-error access private property
    pluginManager.matterbridge.nodeContext = await pluginManager.matterbridge.nodeStorage.createStorage('matterbridge');
    // @ts-expect-error access private properties
    matter.pluginManager.matterbridge.nodeStorage = pluginManager.matterbridge.nodeStorage;
    // @ts-expect-error access private properties
    matter.pluginManager.matterbridge.nodeContext = pluginManager.matterbridge.nodeContext;

    expect(await pluginManager.add('./packages/core/src/mock/plugin1')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/plugin2')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/plugin3')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/plugin4')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/plugin5')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/plugin6')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/pluginmatterdevice')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/pluginserverdevice')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/pluginmbatest')).not.toBeNull();
    expect(await pluginManager.add('./packages/core/src/mock/pluginmbdtest')).not.toBeNull();
    expect(pluginManager.length).toBe(10);
  });

  test('Create server node context without matter storage manager', async () => {
    // @ts-expect-error -- Testing without storage
    expect(matter.createServerNodeContext()).rejects.toThrow('No storage manager initialized');
  });

  test('Copy fabrics for server node for Matterbridge', async () => {
    const result = await copyDirectory(
      path.join('./packages/core/src/mock/matterstorage/Matterbridge'),
      path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_DIR, 'Matterbridge'),
    );
    expect(result).toBeTruthy();
  });

  test('Start matter storage', async () => {
    expect(await matter.startMatterStorage()).toBeUndefined();
    expect(matter.matterStorageManager).toBeDefined();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Opened matter node storage manager with store ID ${CYAN}${matter.storeId}${nf}`);
  });

  test('should write missing and changed context values while preserving unchanged values and identity', async () => {
    const setSpy = vi.spyOn(StorageContext.prototype, 'set');
    const createContext = async (name: string, serialNumber?: string, uniqueId?: string): Promise<StorageContext> =>
      matter.createServerNodeContext(
        'ConditionalWrites',
        name,
        matter.aggregatorDeviceType,
        matter.aggregatorVendorId,
        matter.aggregatorVendorName,
        matter.aggregatorProductId,
        matter.aggregatorProductName,
        serialNumber,
        uniqueId,
      );
    try {
      const context = await createContext('Original node');
      expect(setSpy).toHaveBeenCalledTimes(17);
      const serialNumber = await context.get('serialNumber');
      const uniqueId = await context.get('uniqueId');
      setSpy.mockClear();
      await createContext('Original node', 'Replacement serial', 'Replacement ID');
      expect(setSpy).not.toHaveBeenCalled();
      await createContext('Renamed node');
      expect(setSpy.mock.calls).toMatchObject([
        ['deviceName', 'Renamed node'],
        ['nodeLabel', 'Renamed node'],
      ]);
      expect(await context.get('serialNumber')).toBe(serialNumber);
      expect(await context.get('uniqueId')).toBe(uniqueId);
    } finally {
      setSpy.mockRestore();
    }
  });

  test('should validate commissioning and Basic Information values before creating a Matter node', async () => {
    matter.matterStorageContext = await matter.createServerNodeContext(
      'InvalidCommissioning',
      'Invalid commissioning node',
      matter.aggregatorDeviceType,
      matter.aggregatorVendorId,
      matter.aggregatorVendorName,
      matter.aggregatorProductId,
      matter.aggregatorProductName,
      'INVALID1234567890',
      'INVALID1234567890',
      1.5,
      '',
      1.5,
      '',
      `Matterbridge ${'P'.repeat(70)}`,
      'http://matterbridge.io/device',
      1.5,
    );

    process.argv.push('--root-power-source');
    const invalidServerNode = await matter.createServerNode(MATTER_PORT + 1, -1, 0x1000);
    process.argv.splice(process.argv.indexOf('--root-power-source'), 1);

    expect(invalidServerNode.state.commissioning.pairingCodes.manualPairingCode).toEqual(expect.any(String));
    expect(invalidServerNode.state.commissioning.pairingCodes.qrPairingCode).toEqual(expect.any(String));
    expect(invalidServerNode.state.basicInformation.softwareVersion).toBe(1);
    expect(invalidServerNode.state.basicInformation.softwareVersionString).toBe('1.0.0');
    expect(invalidServerNode.state.basicInformation.hardwareVersion).toBe(1);
    expect(invalidServerNode.state.basicInformation.hardwareVersionString).toBe('1.0.0');
    expect(invalidServerNode.state.basicInformation.productLabel).toBe('P'.repeat(64));
    expect(invalidServerNode.state.basicInformation.productUrl).toBe('https://matterbridge.io');
    expect(invalidServerNode.state.basicInformation.configurationVersion).toBe(1);
    expect(invalidServerNode.behaviors.has(PowerSourceServer.with(PowerSource.Feature.Wired))).toBe(true);
    const powerSourceState = invalidServerNode.stateOf(PowerSourceServer.with(PowerSource.Feature.Wired));
    expect(powerSourceState.status).toBe(PowerSource.PowerSourceStatus.Active);
    expect(powerSourceState.order).toBe(0);
    expect(powerSourceState.endpointList as unknown).toEqual([0]);
    expect(powerSourceState.wiredCurrentType).toBe(PowerSource.WiredCurrentType.Ac);
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Invalid passcode -1 for server node InvalidCommissioning. Passcode must be between 0 and 99999999. Generating a random passcode...',
    );
    expect(loggerWarnSpy).toHaveBeenCalledWith(
      'Invalid discriminator 4096 for server node InvalidCommissioning. Discriminator must be between 0 and 4095 (0xFFF). Generating a random discriminator...',
    );

    await invalidServerNode.close();
  });

  test('should not add the TestEventTrigger server when MATTERBRIDGE_CHIP_TEST is set and chipTests.js is not available', async () => {
    process.env.MATTERBRIDGE_CHIP_TEST = '1';
    try {
      const chipServerNode = await matter.createServerNode(MATTER_PORT + 1, PASSCODE, DISCRIMINATOR);
      expect(loggerWarnSpy).not.toHaveBeenCalledWith(' * MATTERBRIDGE_CHIP_TEST environment variable is set. Running TestEventTrigger server. *');
      await chipServerNode.close();
    } finally {
      delete process.env.MATTERBRIDGE_CHIP_TEST;
    }
  });

  test('should add the TestEventTrigger server when MATTERBRIDGE_CHIP_TEST is set and chipTests.js is available', async () => {
    // From src there is only chipTests.ts: report chipTests.js as present, Bun then resolves the import to the .ts source.
    const existsSync = fs.existsSync;
    const existsSyncSpy = vi.spyOn(fs, 'existsSync').mockImplementation((file) => (typeof file === 'string' && path.basename(file) === 'chipTests.js') || existsSync(file));
    process.env.MATTERBRIDGE_CHIP_TEST = '1';
    try {
      const chipServerNode = await matter.createServerNode(MATTER_PORT + 1, PASSCODE, DISCRIMINATOR);
      expect(loggerWarnSpy).toHaveBeenCalledWith(' * MATTERBRIDGE_CHIP_TEST environment variable is set. Running TestEventTrigger server. *');
      const { MatterbridgeGeneralDiagnosticsServer } = await import('../src/chipTests.js');
      expect(chipServerNode.behaviors.has(MatterbridgeGeneralDiagnosticsServer)).toBe(true);
      await chipServerNode.close();
    } finally {
      delete process.env.MATTERBRIDGE_CHIP_TEST;
      existsSyncSpy.mockRestore();
    }
  });

  test('Create server node for Matterbridge', async () => {
    expect(await matter.createMatterbridgeServerNode()).toBeDefined();
    await matter.serverNode?.construction.ready;
    await matter.aggregatorNode?.construction.ready;
    expect(loggerDebugSpy).toHaveBeenCalledWith(`Created ${plg}Matterbridge${db} server node`);
    // Without --root-power-source, the Root endpoint SHALL NOT expose a Power Source cluster.
    expect(matter.serverNode?.behaviors.has(PowerSourceServer.with(PowerSource.Feature.Wired))).toBeFalsy();
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

  test.each([
    { args: [], expectedVersion: 1, description: 'leave the version unchanged without the flag' },
    { args: ['--configuration-version'], expectedVersion: 2, description: 'increment the current version with a bare flag' },
    { args: ['--configuration-version', 'invalid'], expectedVersion: 2, description: 'increment the current version with an invalid value' },
    { args: ['--configuration-version', '42'], expectedVersion: 42, description: 'use the explicit version' },
    { args: ['--configuration-version', '0'], expectedVersion: 1, description: 'clamp zero to one' },
    { args: ['--configuration-version', '-10'], expectedVersion: 2, description: 'increment when the value is parsed as another flag' },
    { args: ['--configuration-version', '4294967296'], expectedVersion: 4294967295, description: 'clamp the version to UINT32_MAX' },
  ])('should $description when the server node goes online', async ({ args, expectedVersion }) => {
    const serverNode = matter.serverNode;
    if (!serverNode) throw new Error('Server node is not initialized');
    const savedArgv = process.argv;
    const originalVersion = serverNode.state.basicInformation.configurationVersion;
    const setStateSpy = vi.spyOn(serverNode, 'setStateOf').mockImplementation(async () => await Promise.resolve());
    process.argv = [...savedArgv, ...args];
    try {
      await serverNode.act(async (agent) => {
        await serverNode.lifecycle.online.emit(agent.context);
      });
      await Promise.all(setStateSpy.mock.results.map((result) => result.value));
      expect(setStateSpy.mock.calls as unknown).toEqual(args.length > 0 ? [[BasicInformationServer, { configurationVersion: expectedVersion }]] : []);
      expect(serverNode.state.basicInformation.configurationVersion).toBe(originalVersion);
      expect(loggerNoticeSpy.mock.calls.filter(([message]) => message.startsWith('Configuration version for server node Matterbridge is now'))).toEqual(
        args.length > 0 ? [[`Configuration version for server node Matterbridge is now ${expectedVersion}`]] : [],
      );
    } finally {
      process.argv = savedArgv;
      setStateSpy.mockRestore();
    }
  });

  test('Server node commissioned', () => {
    matter.serverNode?.lifecycle.commissioned.emit(undefined as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Server node for Matterbridge was initially commissioned successfully!`);
  });

  test('Server node decommissioned', () => {
    matter.serverNode?.lifecycle.decommissioned.emit(undefined as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Server node for Matterbridge was fully decommissioned successfully!`);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(`Server node for Matterbridge was reset to factory defaults: restart Matterbridge before pairing it again`);
  });

  test('Server node fabricsChanged', () => {
    matter.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), 'added');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} added on server node`));
    matter.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), 'deleted');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} removed on server node`));
    matter.serverNode?.events.commissioning.fabricsChanged.emit(FabricIndex(1), 'updated');
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Commissioned fabric index ${FabricIndex(1)} updated on server node`));
  });

  test('Server node sessions.opened', () => {
    matter.serverNode?.events.sessions.opened.emit({} as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Session opened on server node for Matterbridge`));
  });

  test('Server node sessions.closed', () => {
    matter.serverNode?.events.sessions.closed.emit({} as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Session closed on server node for Matterbridge`));
  });

  test('Server node sessions.subscriptionsChanged', () => {
    matter.serverNode?.events.sessions.subscriptionsChanged.emit({} as any);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining(`Session subscriptions changed on server node for Matterbridge`));
  });

  test('Broadcast matter_apimatter', async () => {
    expect(matter.serverNode).toBeDefined();
    if (!matter.serverNode) return;
    // The shared testServer is closed in a previous test
    const apiServer = new BroadcastServer('frontend', log);
    // The owner of the server node responds with its data
    const response = await apiServer.fetch({ type: 'matter_apimatter', src: apiServer.name, dst: 'matter', params: { id: matter.serverNode.id } });
    expect(response.result.matter.id).toBe(matter.serverNode.id);
    expect(response.result.matter.qrPairingCode).toBe(matter.serverNode.state.commissioning.pairingCodes.qrPairingCode);
    // No MatterNode owns an unknown server node, so nobody responds and the fetch times out
    expect(apiServer.fetch({ type: 'matter_apimatter', src: apiServer.name, dst: 'matter', params: { id: 'unknown' } }, 20)).rejects.toThrow();
    apiServer.close();
  });

  test('Set aggregator reachability', async () => {
    const tempSensor = new MatterbridgeEndpoint([temperatureSensor, bridgedNode], { id: 'Temperature sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890')
      .addRequiredClusterServers();
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
    device.addChildDeviceTypeWithClusterServer('Temperature sensor child', temperatureSensor, [Identify.id, TemperatureMeasurement.id]);
    device.addChildDeviceTypeWithClusterServer('Humidity sensor child', humiditySensor, [Identify.id, RelativeHumidityMeasurement.id]);
    device.plugin = 'matterbridge-mock1';

    // Test adding to unknown plugin
    expect(matter.addBridgedEndpoint('matterbridge-unknown', device)).rejects.toThrow(
      `Error adding bridged endpoint ${plg}matterbridge-unknown${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): plugin not found`,
    );
    expect(deviceManager.length).toBe(0);
    vi.clearAllMocks();

    // Test adding when no aggregator node
    const saved = matter.aggregatorNode; // Save aggregator node
    matter.aggregatorNode = undefined;
    expect(await matter.pluginManager.add('./packages/core/src/mock/plugin1')).not.toBeNull();
    expect(matter.addBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(
      `Aggregator node not found for endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`,
    );
    matter.aggregatorNode = saved; // Restore aggregator node
    expect(deviceManager.length).toBe(0);
    vi.clearAllMocks();

    // Test adding matter mode when no server node
    const savedServer = matter.serverNode; // Save server node
    matter.serverNode = undefined;
    device.mode = 'matter';
    expect(matter.addBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(
      `Server node not found for matter endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er})`,
    );
    matter.serverNode = savedServer; // Restore server node
    device.mode = undefined; // Restore mode
    expect(deviceManager.length).toBe(0);
    vi.clearAllMocks();

    // Test adding not device
    await matter.addBridgedEndpoint('matterbridge-mock1', {} as any);
    expect(deviceManager.length).toBe(0);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Matter error adding bridged endpoint`));
    vi.clearAllMocks();

    // Add correctly
    await matter.addBridgedEndpoint('matterbridge-mock1', device);
    expect(device.owner).toBeDefined();
    expect(device.lifecycle.isReady).toBe(true);
    expect(deviceManager.length).toBe(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`Added endpoint`));
    expect(await device.setAttribute(PressureMeasurement.id, 'measuredValue', 1000)).toBeTruthy();
    expect(device.getChildEndpointById('Temperature sensor child')).toBeUndefined(); // Test getChildEndpointByName with name with spaces
    expect(device.getChildEndpointById('Humidity sensor child')).toBeUndefined(); // Test getChildEndpointByName with name with spaces
    expect(device.getChildEndpointByOriginalId('Temperature sensor child')).toBeDefined(); // Test getChildEndpointByName with originalId
    expect(device.getChildEndpointByOriginalId('Humidity sensor child')).toBeDefined(); // Test getChildEndpointByName with originalId
    expect(await device.getChildEndpointByOriginalId('Temperature sensor child')?.setAttribute(TemperatureMeasurement.id, 'measuredValue', 2850)).toBeTruthy();
    expect(await device.getChildEndpointByOriginalId('Humidity sensor child')?.setAttribute(RelativeHumidityMeasurement.id, 'measuredValue', 5500)).toBeTruthy();

    await closeServerNodeStores(matter.serverNode);
    /*
    matter.serverNode?.env.get(ServerNodeStore)?.endpointStores.deactivateStoreForEndpoint(device);
    for (const child of device.getChildEndpoints()) {
      matter.serverNode?.env.get(ServerNodeStore)?.endpointStores.deactivateStoreForEndpoint(child);
    }
    */
    // Add time to process asynchronous operations in ServerEndpointStores.storeForEndpoint
    // await matter.yieldToNode(250);
  });

  test('Remove endpoint from the Matter aggregator node for Matterbridge', async () => {
    expect(deviceManager.length).toBe(1);

    // Test removing from unknown plugin
    expect(matter.removeBridgedEndpoint('matterbridge-unknown', device)).rejects.toThrow(
      `Error removing bridged endpoint ${plg}matterbridge-unknown${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): plugin not found`,
    );
    expect(deviceManager.length).toBe(1);

    // Test removing when no aggregator node
    const savedAggregator = matter.aggregatorNode;
    matter.aggregatorNode = undefined;
    expect(matter.removeBridgedEndpoint('matterbridge-mock1', device)).rejects.toThrow(
      `Error removing bridged endpoint ${plg}matterbridge-mock1${er}:${dev}${device.deviceName}${er} (${zb}${device.name}${er}): aggregator node not found`,
    );
    expect(deviceManager.length).toBe(1);
    matter.aggregatorNode = savedAggregator; // Restore aggregator node

    // Test removing correctly
    await matter.removeBridgedEndpoint('matterbridge-mock1', device);
    expect(device.owner).toBeUndefined();
    expect(deviceManager.length).toBe(0);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Removed bridged endpoint #undefined ${plg}matterbridge-mock1${nf}:${dev}${device.deviceName}${nf} (${zb}${device.name}${nf})`);
  });

  test('Remove all endpoints from the Matter aggregator node for Matterbridge', async () => {
    expect(deviceManager.length).toBe(0);

    const tmpSensor = new MatterbridgeEndpoint([temperatureSensor, bridgedNode], { id: 'Temperature sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Temperature sensor', 'TEMP1234567890')
      .addRequiredClusterServers();
    tmpSensor.plugin = 'matterbridge-mock1';
    await matter.addBridgedEndpoint('matterbridge-mock1', tmpSensor);
    expect(tmpSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(1);

    const humSensor = new MatterbridgeEndpoint([humiditySensor, bridgedNode], { id: 'Humidity sensor' }, true)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Humidity sensor', 'HUM1234567890')
      .addRequiredClusterServers();
    humSensor.plugin = 'matterbridge-mock1';
    await matter.addBridgedEndpoint('matterbridge-mock1', humSensor);
    expect(humSensor.owner).toBeDefined();
    expect(deviceManager.length).toBe(2);

    // Test removing from unknown plugin
    expect(matter.removeAllBridgedEndpoints('matterbridge-unknown')).rejects.toThrow(
      `Error removing all bridged endpoints for plugin ${plg}matterbridge-unknown${er}: plugin not found`,
    );
    expect(deviceManager.length).toBe(2);

    // Test removing correctly
    await matter.removeAllBridgedEndpoints('matterbridge-mock1', 10);
    expect(deviceManager.length).toBe(0);
  });

  test('Add virtual endpoint to the Matter aggregator node for Matterbridge', async () => {
    expect(deviceManager.length).toBe(0);

    // Test adding to unknown plugin
    expect(await matter.addVirtualEndpoint('matterbridge-unknown', 'Virtual device', 'switch', async () => {})).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Error adding virtual endpoint ${plg}matterbridge-unknown${er}:${dev}Virtual device${er}: plugin not found`);

    // Test adding AccessoryPlugin
    (matter as any).matterbridge.bridgeMode = 'childbridge';
    // @ts-expect-error access private property
    matter.pluginManager.matterbridge.bridgeMode = 'childbridge';
    expect(await matter.pluginManager.add('./packages/core/src/mock/plugin4')).not.toBeNull();
    expect(await matter.addVirtualEndpoint('matterbridge-mock4', 'Virtual device', 'switch', async () => {})).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith(`Virtual devices are only supported in bridge mode and childbridge mode with a DynamicPlatform`);
    (matter as any).matterbridge.bridgeMode = 'bridge';
    // @ts-expect-error access private property
    matter.pluginManager.matterbridge.bridgeMode = 'bridge';

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

    expect(await matter.pluginManager.remove('./packages/core/src/mock/plugin1')).not.toBeNull();
    expect(await matter.pluginManager.remove('./packages/core/src/mock/plugin4')).not.toBeNull();
  });

  test('Stop server node for Matterbridge', async () => {
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
      configurationVersion: 1,
      description: 'Test accessory plugin',
      author: 'Test Author',
      enabled: true,
      private: true,
    };
    const sensor = new MatterbridgeEndpoint(temperatureSensor, { id: 'Temperature sensor' }, true)
      .createDefaultBasicInformationClusterServer(
        'Temperature sensor',
        'TEMP1234567890',
        0xfff1,
        'Matterbridge',
        0x8000,
        'Temperature Sensor',
        123,
        '1.2.3',
        456,
        '4.5.6',
        'Accessory Sensor',
        'https://matterbridge.io/accessory',
        2,
      )
      .addRequiredClusterServers();
    expect(sensor.softwareVersion).toBe(123);
    expect(sensor.softwareVersionString).toBe('1.2.3');
    expect(sensor.hardwareVersion).toBe(456);
    expect(sensor.hardwareVersionString).toBe('4.5.6');
    expect(sensor.productLabel).toBe('Accessory Sensor');
    expect(sensor.productUrl).toBe('https://matterbridge.io/accessory');
    expect(sensor.configurationVersion).toBe(2);
    expect(await matter.createAccessoryPlugin(plugin, sensor)).toBeDefined();
    expect(matter.serverNode?.state.basicInformation.softwareVersion).toBe(123);
    expect(matter.serverNode?.state.basicInformation.softwareVersionString).toBe('1.2.3');
    expect(matter.serverNode?.state.basicInformation.hardwareVersion).toBe(456);
    expect(matter.serverNode?.state.basicInformation.hardwareVersionString).toBe('4.5.6');
    expect(matter.serverNode?.state.basicInformation.productLabel).toBe('Accessory Sensor');
    expect(matter.serverNode?.state.basicInformation.productUrl).toBe('https://matterbridge.io/accessory');
    expect(matter.serverNode?.state.basicInformation.configurationVersion).toBe(2);
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
      configurationVersion: 1,
      description: 'Test dynamic plugin',
      author: 'Test Author',
      enabled: true,
      private: true,
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
      configurationVersion: 1,
      description: 'A test accessory plugin',
      author: 'Test Author',
      enabled: true,
      private: true,
    };
    const sensor = new MatterbridgeEndpoint(temperatureSensor, { id: 'Temperature sensor', mode: 'server' }, true)
      .createDefaultBasicInformationClusterServer(
        'Temperature sensor',
        'TEMP1234567890',
        0xfff1,
        'Matterbridge',
        0x8000,
        'Temperature Sensor',
        234,
        '2.3.4',
        567,
        '5.6.7',
        'Server Sensor',
        'https://matterbridge.io/server',
        3,
      )
      .addRequiredClusterServers();
    expect(sensor.softwareVersion).toBe(234);
    expect(sensor.softwareVersionString).toBe('2.3.4');
    expect(sensor.hardwareVersion).toBe(567);
    expect(sensor.hardwareVersionString).toBe('5.6.7');
    expect(sensor.productLabel).toBe('Server Sensor');
    expect(sensor.productUrl).toBe('https://matterbridge.io/server');
    expect(sensor.configurationVersion).toBe(3);
    expect(await matter.createDeviceServerNode(plugin, sensor)).toBeDefined();
    expect(matter.serverNode?.state.basicInformation.softwareVersion).toBe(234);
    expect(matter.serverNode?.state.basicInformation.softwareVersionString).toBe('2.3.4');
    expect(matter.serverNode?.state.basicInformation.hardwareVersion).toBe(567);
    expect(matter.serverNode?.state.basicInformation.hardwareVersionString).toBe('5.6.7');
    expect(matter.serverNode?.state.basicInformation.productLabel).toBe('Server Sensor');
    expect(matter.serverNode?.state.basicInformation.productUrl).toBe('https://matterbridge.io/server');
    expect(matter.serverNode?.state.basicInformation.configurationVersion).toBe(3);
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

  test('should log an error when the server node fails to start or to close', async () => {
    const savedServer = matter.serverNode;
    // @ts-expect-error -- Minimal server node that fails to start and to close
    matter.serverNode = {
      id: 'FailingServerNode',
      start: async (): Promise<void> => {
        throw new Error('Start failure');
      },
      close: async (): Promise<void> => {
        throw new Error('Close failure');
      },
    };
    try {
      await matter.startServerNode();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to start FailingServerNode server node: Start failure');
      await matter.stopServerNode();
      expect(loggerErrorSpy).toHaveBeenCalledWith('Failed to close FailingServerNode server node: Close failure');
    } finally {
      matter.serverNode = savedServer;
    }
  });

  test('Stop matter storage', async () => {
    expect(await matter.stopMatterStorage()).toBeUndefined();
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Closed matter node storage`);
  });
});
