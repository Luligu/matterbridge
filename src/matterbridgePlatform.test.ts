// src\matterbridgePlatform.test.ts

/* eslint-disable jest/no-conditional-expect */

const NAME = 'MatterbridgePlatform';
const MATTER_PORT = 7000;
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '--novirtual', '--frontend', '0', '--homedir', HOMEDIR];

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, CYAN, db, er, LogLevel, wr } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';
import { Descriptor } from '@matter/types/clusters/descriptor';
import { EndpointNumber } from '@matter/types/datatype';

import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { bridgedNode, contactSensor, humiditySensor, powerSource, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { addMatterbridgePlatform, createMatterbridgeEnvironment, destroyMatterbridgeEnvironment, flushAsync, loggerLogSpy, matterbridge, setupTest, startMatterbridgeEnvironment, stopMatterbridgeEnvironment } from './jestutils/jestHelpers.js';
import { Matterbridge } from './matterbridge.js';

jest.spyOn(Matterbridge.prototype, 'addBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
  // console.log(`Mocked addBridgedEndpoint: ${pluginName} ${device.name}`);
  return Promise.resolve();
});
jest.spyOn(Matterbridge.prototype, 'removeBridgedEndpoint').mockImplementation((pluginName: string, device: MatterbridgeEndpoint) => {
  // console.log(`Mocked removeBridgedEndpoint: ${pluginName} ${device.name}`);
  return Promise.resolve();
});
jest.spyOn(Matterbridge.prototype, 'removeAllBridgedEndpoints').mockImplementation((pluginName: string) => {
  // console.log(`Mocked removeAllBridgedEndpoint: ${pluginName}`);
  return Promise.resolve();
});

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge platform', () => {
  let platform: MatterbridgePlatform;

  async function registerDevice(deviceName: string, serialNumber: string, uniqueId: string | undefined, id: string | undefined, number?: number): Promise<MatterbridgeEndpoint> {
    const device = new MatterbridgeEndpoint([bridgedNode, powerSource], { id, number: number ? EndpointNumber(number) : undefined }, true);
    device.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber);
    device.createDefaultPowerSourceBatteryClusterServer();
    if (uniqueId) device.uniqueId = uniqueId;
    await platform.registerDevice(device);
    return device;
  }

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('should have created an instance of NodeStorageManager', async () => {
    // @ts-expect-error access private constructor
    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    // Add the platform to the Matterbridge environment
    addMatterbridgePlatform(platform, 'test');
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(MatterbridgePlatform);
    expect(platform.storage).toBeDefined();
    expect(platform.storage).toBeInstanceOf(NodeStorageManager);
    expect(platform.context).toBeUndefined();
    expect((platform as any).selectDevice).toBeDefined();
    expect((platform as any).selectDevice).toBeInstanceOf(Map);
    expect((platform as any).selectDevice.size).toBe(0);
    expect((platform as any).selectEntity).toBeDefined();
    expect((platform as any).selectEntity).toBeInstanceOf(Map);
    expect((platform as any).selectEntity.size).toBe(0);
    expect(platform.ready).toBeInstanceOf(Promise);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Creating storage for plugin test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Creating context for plugin test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Loading selectDevice for plugin test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Loading selectEntity for plugin test'));

    jest.clearAllMocks();
    await platform.ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Created context for plugin test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Loaded 0 selectDevice for plugin test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Loaded 0 selectEntity for plugin test'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('MatterbridgePlatform for plugin test is fully initialized'));
  });

  test('onStart should throw an error if not overridden', async () => {
    try {
      await platform.onStart('test reason');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Plugins must override onStart.');
    }
  });

  it('should validate version', () => {
    matterbridge.matterbridgeVersion = '1.5.4';
    expect(platform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
    expect(platform.verifyMatterbridgeVersion('2.0.0-dev.1')).toBe(false);
  });

  it('should validate version with unused versions', () => {
    matterbridge.matterbridgeVersion = '1.5.4';
    expect(platform.verifyMatterbridgeVersion('1.5')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('1.5.3.5')).toBe(true);
  });

  it('should validate version with unused versions bis', () => {
    matterbridge.matterbridgeVersion = '1.5';
    expect(platform.verifyMatterbridgeVersion('1')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('2')).toBe(false);
    expect(platform.verifyMatterbridgeVersion('1.5.0')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('1.5.3.5')).toBe(false);
  });

  it('should validate version beta', () => {
    matterbridge.matterbridgeVersion = '1.5.4-dev.1';
    expect(platform.verifyMatterbridgeVersion('1.5.3')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('1.5.4')).toBe(true);
    expect(platform.verifyMatterbridgeVersion('2.0.0')).toBe(false);
  });

  it('should validate with white and black list', () => {
    platform.config.whiteList = ['white1', 'white2', 'white3'];
    platform.config.blackList = ['black1', 'black2', 'black3'];
    expect(platform.validateDevice('white1')).toBe(true);
    expect(platform.validateDevice('black2')).toBe(false);
    expect(platform.validateDevice(['white1', 'black2'])).toBe(false);
    expect(platform.validateDevice('xDevice')).toBe(false);
    expect(platform.validateDevice('')).toBe(false);
  });

  it('should validate with white list', () => {
    platform.config.whiteList = ['white1', 'white2', 'white3'];
    platform.config.blackList = [];
    expect(platform.validateDevice('white1')).toBe(true);
    expect(platform.validateDevice('black2')).toBe(false);
    expect(platform.validateDevice(['white1', 'black2'])).toBe(true);
    expect(platform.validateDevice('xDevice')).toBe(false);
    expect(platform.validateDevice('')).toBe(false);
  });

  it('should validate with black list', () => {
    platform.config.whiteList = [];
    platform.config.blackList = ['black1', 'black2', 'black3'];
    expect(platform.validateDevice('whiteDevice')).toBe(true);
    expect(platform.validateDevice('whiteDevice')).toBe(true);
    expect(platform.validateDevice('black1')).toBe(false);
    expect(platform.validateDevice('black2')).toBe(false);
    expect(platform.validateDevice('black3')).toBe(false);
    expect(platform.validateDevice(['x', 'y', 'z'])).toBe(true);
    expect(platform.validateDevice(['x', 'y', 'z', 'black3'])).toBe(false);
    expect(platform.validateDevice('xDevice')).toBe(true);
    expect(platform.validateDevice('')).toBe(true);
  });

  it('should validate with no white and black list', () => {
    platform.config.whiteList = [];
    platform.config.blackList = [];
    expect(platform.validateDevice('whiteDevice')).toBe(true);
    expect(platform.validateDevice(['whiteDevice', '123456'])).toBe(true);
    expect(platform.validateDevice('blackDevice')).toBe(true);
    expect(platform.validateDevice(['blackDevice', '123456'])).toBe(true);
    expect(platform.validateDevice('')).toBe(true);
  });

  it('should validate with undefined list', () => {
    platform.config.entityWhiteList = undefined;
    platform.config.entityBlackList = undefined;
    platform.config.deviceEntityBlackList = undefined;

    expect(platform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('any', 'blackEntity')).toBe(true);
    expect(platform.validateEntity('any', '')).toBe(true);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with empty list', () => {
    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('any', 'blackEntity')).toBe(true);
    expect(platform.validateEntity('any', '')).toBe(true);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with entity black list', () => {
    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = ['blackEntity'];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntity('any', '')).toBe(true);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with entity white list', () => {
    platform.config.entityWhiteList = ['whiteEntity'];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntity('any', '')).toBe(false);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should not validate with entity white list if in black list', () => {
    platform.config.entityWhiteList = ['whiteEntity'];
    platform.config.entityBlackList = ['whiteEntity'];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntity('any', 'whiteEntity')).toBe(false);
    expect(platform.validateEntity('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntity('any', '')).toBe(false);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with device entity black list and entity black list', async () => {
    platform.config.entityBlackList = ['blackEntity'];
    platform.config.deviceEntityBlackList = { device1: ['blackEntityDevice1'] };
    expect(platform.validateEntity('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntity('any', 'blackEntityDevice1')).toBe(true);
    expect(platform.validateEntity('any', '')).toBe(true);

    expect(platform.validateEntity('device1', 'whiteEntity')).toBe(true);
    expect(platform.validateEntity('device1', 'blackEntity')).toBe(false);
    expect(platform.validateEntity('device1', 'blackEntityDevice1')).toBe(false);
    expect(platform.validateEntity('device1', '')).toBe(true);

    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should not create storage manager without a name', async () => {
    expect(() => {
      // @ts-expect-error access private constructor
      new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: undefined as any, type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    }).toThrow();
  });

  it('should not create storage manager with name empty', async () => {
    expect(() => {
      // @ts-expect-error access private constructor
      new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: '', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    }).toThrow();
  });

  it('should save the select', async () => {
    // @ts-expect-error access private constructor
    let platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    (platform as any).selectDevice.clear();
    (platform as any).selectEntity.clear();
    for (let i = 1; i <= 100; i++) {
      (platform as any).selectDevice.set('serial' + i, { serial: 'serial' + i, name: 'name' + i });
      (platform as any).selectEntity.set('name' + i, { name: 'name' + i, description: 'description' + i });
    }
    expect((platform as any).selectDevice.size).toBe(100);
    expect((platform as any).selectDevice.has('serial1')).toBeTruthy();
    expect((platform as any).selectDevice.has('serial100')).toBeTruthy();
    expect((platform as any).selectEntity.size).toBe(100);
    expect((platform as any).selectEntity.has('name1')).toBeTruthy();
    expect((platform as any).selectEntity.has('name100')).toBeTruthy();
    await platform.onShutdown();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saving 100 selectDevice...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saving 100 selectEntity...`);
    loggerLogSpy.mockClear();

    // @ts-expect-error access private constructor
    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loading selectDevice for plugin matterbridge-jest`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loading selectEntity for plugin matterbridge-jest`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded 100 selectDevice for plugin matterbridge-jest`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded 100 selectEntity for plugin matterbridge-jest`);
    expect((platform as any).selectDevice.size).toBe(100);
    expect((platform as any).selectDevice.has('serial1')).toBeTruthy();
    expect((platform as any).selectDevice.has('serial100')).toBeTruthy();
    expect((platform as any).selectEntity.size).toBe(100);
    expect((platform as any).selectEntity.has('name1')).toBeTruthy();
    expect((platform as any).selectEntity.has('name100')).toBeTruthy();
    (platform as any).selectDevice.clear();
    (platform as any).selectEntity.clear();
    await platform.onShutdown();
  });

  test('should clear the selects', async () => {
    // @ts-expect-error access private constructor
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub');
    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub', [{ name: 'name1', description: 'description1', icon: 'icon1' }]);
    platform.setSelectDeviceEntity('serial1', 'name1', 'description1', 'icon1');
    platform.setSelectEntity('name1', 'description1', 'hub');
    platform.getSelectDevices();
    platform.getSelectEntities();
    await platform.clearSelect();
    expect((platform as any).selectDevice.size).toBe(0);
    expect((platform as any).selectEntity.size).toBe(0);
    await platform.destroy();
  });

  test('should clear the device selects', async () => {
    // @ts-expect-error access private constructor
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub');
    platform.clearDeviceSelect('serial1');
    expect((platform as any).selectDevice.size).toBe(0);
    expect((platform as any).selectEntity.size).toBe(0);
    await platform.destroy();
  });

  test('should clear the entity selects', async () => {
    // @ts-expect-error access private constructor
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    platform.setSelectEntity('name1', 'description1', 'component');
    platform.clearEntitySelect('name1');
    expect((platform as any).selectDevice.size).toBe(0);
    expect((platform as any).selectEntity.size).toBe(0);
    await platform.destroy();
  });

  it('should update a not existing entity selects', async () => {
    // @ts-expect-error access private constructor
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    await platform.clearSelect();
    expect((platform as any).selectDevice.size).toBe(0);
    expect((platform as any).selectEntity.size).toBe(0);

    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub');
    expect((platform as any).selectDevice.size).toBe(1);
    expect((platform as any).selectEntity.size).toBe(0);
    expect((platform as any).selectDevice.get('serial1')?.entities).toEqual(undefined);

    platform.setSelectDeviceEntity('serial1', 'name2', 'description2', 'hub2');
    expect((platform as any).selectDevice.get('serial1')?.entities).toEqual([{ description: 'description2', icon: 'hub2', name: 'name2' }]);
    await platform.destroy();
  });

  it('should update an existing entity selects', async () => {
    // @ts-expect-error access private constructor
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    await platform.clearSelect();
    expect((platform as any).selectDevice.size).toBe(0);
    expect((platform as any).selectEntity.size).toBe(0);

    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub', [{ name: 'name1', description: 'description1', icon: 'hub1' }]);
    expect((platform as any).selectDevice.size).toBe(1);
    expect((platform as any).selectEntity.size).toBe(0);
    expect((platform as any).selectDevice.get('serial1')?.entities).toEqual([{ description: 'description1', icon: 'hub1', name: 'name1' }]);

    platform.setSelectDeviceEntity('serial1', 'name2', 'description2', 'hub2');
    expect((platform as any).selectDevice.get('serial1')?.entities).toEqual([
      { description: 'description1', icon: 'hub1', name: 'name1' },
      { description: 'description2', icon: 'hub2', name: 'name2' },
    ]);
    await platform.destroy();
  });

  test('should check checkNotLatinCharacters', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'nonLatin' }, true);
    testDevice.createDefaultBasicInformationClusterServer('nonLatin조명', 'serial012345');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    expect(platform.hasDeviceName('nonLatin조명')).toBeTruthy();
    expect(platform.hasDeviceName('none')).toBeFalsy();
    expect(platform.hasDeviceUniqueId(testDevice.uniqueId ?? 'none')).toBeTruthy();
    expect(platform.hasDeviceName('nonLatin조명')).toBeTruthy();
  });

  test('checkEndpointNumbers should return -1', async () => {
    const storage = platform.storage;
    (platform.storage as any) = undefined; // Simulate no storage available
    expect(await (platform as any).checkEndpointNumbers()).toBe(-1);
    platform.storage = storage; // Restore storage
  });

  test('checkEndpointNumbers should be empty', async () => {
    const context = await platform.storage?.createStorage('endpointNumbers');
    await context?.set('endpointMap', []);
    expect(await (platform as any).checkEndpointNumbers()).toBe(0);
  });

  test('checkEndpointNumbers should not validate without uniqueId', async () => {
    const context = await platform.storage?.createStorage('endpointNumbers');
    await context?.set('endpointMap', []);
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.uniqueId = 'test';
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    testDevice.uniqueId = undefined;
    expect(await (platform as any).checkEndpointNumbers()).toBe(0);
    testDevice.uniqueId = 'test';
    expect(await (platform as any).checkEndpointNumbers()).toBe(0);
  });

  test('checkEndpointNumbers should not be empty', async () => {
    const context = await platform.storage?.createStorage('endpointNumbers');
    await context?.set('endpointMap', []);
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    expect(platform.hasDeviceName('test')).toBeTruthy();
    expect(platform.hasDeviceName('none')).toBeFalsy();
    expect(platform.hasDeviceUniqueId(testDevice.uniqueId ?? 'none')).toBeTruthy();
    expect(platform.hasDeviceName('test')).toBeTruthy();

    testDevice.number = 100;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    expect(await (platform as any).checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
  });

  test('checkEndpointNumbers should check the testDevice', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    testDevice.number = 100;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    expect(await (platform as any).checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
  });

  test('checkEndpointNumbers should not check the testDevice', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    expect(await (platform as any).checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Endpoint number for device ${CYAN}${testDevice.deviceName}${wr} changed from ${CYAN}100${wr} to ${CYAN}101${wr}`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
  });

  test('checkEndpointNumbers should not check the testDevice without uniqueId', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    testDevice.uniqueId = undefined;
    expect(await (platform as any).checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Not checking device ${testDevice.deviceName} without uniqueId or maybeNumber`);
  });

  test('checkEndpointNumbers should check the testDevice with child endpoints', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    const child1 = testDevice.addChildDeviceType('child1', temperatureSensor, undefined, true);
    child1.addRequiredClusterServers();
    child1.number = 201;
    const child2 = testDevice.addChildDeviceType('child2', humiditySensor, undefined, true);
    child2.addRequiredClusterServers();
    child2.number = 202;
    const child3 = testDevice.addChildDeviceType('child3', humiditySensor, undefined, true);
    child3.addRequiredClusterServers();
    // child3.number = undefined;
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    expect(testDevice.getChildEndpoints()).toHaveLength(3);
    jest.clearAllMocks();
    expect(await (platform as any).checkEndpointNumbers()).toBe(3);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, `Endpoint number for device ${CYAN}${testDevice.uniqueId}${wr} changed from ${CYAN}100${wr} to ${CYAN}101${wr}`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Setting child endpoint number for device ${CYAN}${testDevice.uniqueId}${db}.${CYAN}child1${db} to ${CYAN}201${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Setting child endpoint number for device ${CYAN}${testDevice.uniqueId}${db}.${CYAN}child2${db} to ${CYAN}202${db}`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting child endpoint number for device ${CYAN}${testDevice.uniqueId}${db}.${CYAN}child3${db} to ${CYAN}202${db}`);
  });

  test('checkEndpointNumbers should validate the testDevice with child endpoints', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    const child1 = testDevice.addChildDeviceType('child1', [temperatureSensor], undefined, true);
    child1.addRequiredClusterServers();
    child1.number = 201;
    const child2 = testDevice.addChildDeviceType('child2', [humiditySensor], undefined, true);
    child2.addRequiredClusterServers();
    child2.number = 202;
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    expect(testDevice.getChildEndpoints()).toHaveLength(2);
    jest.clearAllMocks();
    expect(await (platform as any).checkEndpointNumbers()).toBe(3);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Checking endpoint numbers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Endpoint numbers check completed.');
  });

  test('checkEndpointNumbers should not validate the testDevice with child endpoints', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { id: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    testDevice.addRequiredClusterServers();
    const child1 = testDevice.addChildDeviceType('child1', [temperatureSensor], undefined, true);
    child1.addRequiredClusterServers();
    child1.number = 203;
    const child2 = testDevice.addChildDeviceType('child2', [humiditySensor], undefined, true);
    child2.addRequiredClusterServers();
    child2.number = 204;
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (platform as any).registeredEndpoints.set(testDevice.uniqueId, testDevice);
    expect(testDevice.getChildEndpoints()).toHaveLength(2);
    jest.clearAllMocks();
    expect(await (platform as any).checkEndpointNumbers()).toBe(3);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Checking endpoint numbers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Saving endpointNumbers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Endpoint numbers check completed.');
  });

  test('wssSendRestartRequired', async () => {
    expect(platform.wssSendRestartRequired()).toBeUndefined();
  });

  test('wssSendSnackbarMessage', async () => {
    expect(platform.wssSendSnackbarMessage('Test message')).toBeUndefined();
  });

  test('onConfigure should log a message', async () => {
    await platform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Configuring platform test');
  });

  test('onAction should log a message', async () => {
    await platform.onAction('Test');
    await platform.onAction('Test', 'value', 'id', {} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`doesn't override onAction.`), undefined);
  });

  test('onConfigChanged should log a message', async () => {
    await platform.onConfigChanged({} as any);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`doesn't override onConfigChanged`));
  });

  test('onChangeLoggerLevel should log a debug message if not overridden', async () => {
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, "The plugin doesn't override onChangeLoggerLevel. Logger level set to: debug");
  });

  test('onShutdown should log a message', async () => {
    await platform.onShutdown('test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Shutting down platform test', 'test reason');
  });

  test('getDevice should return []', async () => {
    expect(platform.getDevices()).toEqual([]);
  });

  test('saveConfig', async () => {
    const originalName = platform.name;
    platform.name = 'unknown';
    expect(() => platform.saveConfig(platform.config)).toThrow('Plugin unknown not found');

    (matterbridge.plugins as any)._plugins.set('unknown', { name: 'unknown', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false } as any);
    expect(() => platform.saveConfig(platform.config)).not.toThrow();
    (matterbridge.plugins as any)._plugins.delete('unknown');
    platform.name = originalName;
    await flushAsync();
  });

  test('getSchema', async () => {
    const originalName = platform.name;
    platform.name = 'unknown';
    expect(() => platform.getSchema()).toThrow('Plugin unknown not found');

    (matterbridge.plugins as any)._plugins.set('unknown', { name: 'unknown', type: 'type', version: '1.0.0', schemaJson: {}, debug: false, unregisterOnShutdown: false } as any);
    expect(() => platform.getSchema()).not.toThrow();
    (matterbridge.plugins as any)._plugins.delete('unknown');
    platform.name = originalName;
    await flushAsync();
  });

  test('setSchema', async () => {
    const originalName = platform.name;
    platform.name = 'unknown';
    expect(() => platform.setSchema(platform.config)).toThrow('Plugin unknown not found');

    (matterbridge.plugins as any)._plugins.set('unknown', { name: 'unknown', type: 'type', version: '1.0.0', debug: false, unregisterOnShutdown: false } as any);
    expect(() => platform.setSchema(platform.config)).not.toThrow();
    (matterbridge.plugins as any)._plugins.delete('unknown');
    platform.name = originalName;
    await flushAsync();
  });

  test('registerVirtualDevice', async () => {
    async function testCallback(): Promise<void> {}
    expect(await platform.registerVirtualDevice('Virtual', 'switch', testCallback)).toBe(true);
    expect(matterbridge.aggregatorNode?.parts.has('Virtual' + ':' + 'switch')).toBeTruthy();

    jest.spyOn(matterbridge.plugins, 'get').mockReturnValueOnce({ name: platform.name, type: 'type', version: '1.0.0', aggregatorNode: matterbridge.aggregatorNode } as any);
    matterbridge.bridgeMode = 'childbridge';
    expect(await platform.registerVirtualDevice('VirtualChildbridge', 'switch', testCallback)).toBe(true);
    matterbridge.bridgeMode = 'bridge';
    expect(matterbridge.aggregatorNode?.parts.has('VirtualChildbridge' + ':' + 'switch')).toBeTruthy();

    expect(await platform.registerVirtualDevice('Virtual', 'switch', testCallback)).toBe(false);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Virtual device Virtual already registered. Please use a different name.`);

    const savedAggregatorNode = matterbridge.aggregatorNode;
    matterbridge.aggregatorNode = undefined;
    expect(await platform.registerVirtualDevice('Virtual', 'switch', testCallback)).toBe(false);
    matterbridge.aggregatorNode = savedAggregatorNode;
  });

  test('registerDevice calls matterbridge.addBridgedEndpoint with correct parameters', async () => {
    await platform.unregisterAllDevices();
    const testDevice = new MatterbridgeEndpoint(powerSource);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    await platform.registerDevice(testDevice);
    expect(platform.size()).toBe(1);
    expect(matterbridge.addBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterDevice calls matterbridge.removeBridgedEndpoint with correct parameters', async () => {
    await platform.unregisterAllDevices();
    const testDevice = new MatterbridgeEndpoint(powerSource);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234');
    await platform.unregisterDevice(testDevice);
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterAllDevices calls matterbridge.removeAllBridgedEndpoints with correct parameters', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
  });

  test('registerDevice should log error if the device uniqueid is undefined', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    await platform.registerDevice(device);
    expect(platform.size()).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `Device with name ${CYAN}${device.deviceName}${er} has no uniqueId. Did you forget to call createDefaultBasicInformationClusterServer() or createDefaultBridgedDeviceBasicInformationClusterServer()? The device will not be added.`,
    );
  });

  test('registerDevice should log error if the device deviceName is undefined', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    expect(device).toBeDefined();
    expect(device.deviceName).toBeUndefined();
    device.createDefaultBasicInformationClusterServer('', 'serial01234');
    expect(device.deviceName).toBe('');
    expect(device.serialNumber).toBe('serial01234');
    await platform.registerDevice(device);
    expect(platform.size()).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with uniqueId ${CYAN}${device.uniqueId}${er} has no deviceName. The device will not be added.`);
  });

  test('registerDevice should log error if the device serialNumber is undefined', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    expect(device).toBeDefined();
    expect(device.serialNumber).toBeUndefined();
    device.createDefaultBasicInformationClusterServer('Device1234', '');
    expect(device.deviceName).toBe('Device1234');
    expect(device.serialNumber).toBe('');
    await platform.registerDevice(device);
    expect(platform.size()).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with uniqueId ${CYAN}${device.uniqueId}${er} has no serialNumber. The device will not be added.`);
  });

  test('registerDevice should add bridgeNode and BridgedDeviceBasicInformation if not present', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    expect(device).toBeDefined();
    expect(device.deviceTypes.has(bridgedNode.code)).toBeFalsy();
    device.createDefaultBasicInformationClusterServer('Device1234', '123456789');
    expect(device.deviceName).toBe('Device1234');
    expect(device.serialNumber).toBe('123456789');
    expect(device.hasClusterServer('BasicInformation')).toBeFalsy();
    expect(device.hasClusterServer('BridgedDeviceBasicInformation')).toBeFalsy();
    await platform.registerDevice(device);
    expect(device.deviceTypes.has(bridgedNode.code)).toBeTruthy();
    expect(device.getClusterServerOptions(Descriptor.Cluster.id)?.deviceTypeList).toEqual([
      { 'deviceType': 17, 'revision': 1 },
      { 'deviceType': 19, 'revision': 3 },
    ]);
    expect(device.hasClusterServer('BasicInformation')).toBeFalsy();
    expect(device.hasClusterServer('BridgedDeviceBasicInformation')).toBeTruthy();
    expect(platform.size()).toBe(1);

    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
  });

  test('registerDevice should log error if the device name already exist', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    await registerDevice('test', 'serial01234', 'uniqueId0123', 'Test Id');
    expect(platform.size()).toBe(1);
    const device = new MatterbridgeEndpoint(powerSource, { id: 'Test Id' }, true);
    device.createDefaultBasicInformationClusterServer('test', 'serial01234');
    await platform.registerDevice(device);
    expect(platform.size()).toBe(1);
    expect(platform.getDevices()).toHaveLength(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with name ${CYAN}${device.deviceName}${er} is already registered. The device will not be added. Please change the device name.`);
  });

  test('Device retrieval methods should return undefined for unregistered devices', async () => {
    await platform.unregisterAllDevices();
    expect(platform.size()).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = await registerDevice('test', 'serial01234', 'uniqueId0123', 'Test Id', 155);
    expect(platform.size()).toBe(1);
    expect(platform.getDevices()).toHaveLength(1);

    expect(platform.hasDeviceUniqueId('uniqueId0123')).toBeTruthy();
    expect(platform.hasDeviceUniqueId('unknown')).toBeFalsy();
    expect(platform.hasDeviceName('test')).toBeTruthy();
    expect(platform.hasDeviceName('unknown')).toBeFalsy();

    expect(platform.getDeviceByName('test')).toBeDefined();
    expect(platform.getDeviceByName('Test')).toBeUndefined();
    expect(platform.getDeviceByUniqueId(device.uniqueId || '')).toBeDefined();
    expect(platform.getDeviceByUniqueId('')).toBeUndefined();
    expect(platform.getDeviceBySerialNumber('serial01234')).toBeDefined();
    expect(platform.getDeviceBySerialNumber('')).toBeUndefined();
    expect(platform.getDeviceById('TestId')).toBeDefined();
    expect(platform.getDeviceById('Test Id')).toBeUndefined();
    expect(platform.getDeviceByOriginalId('Test Id')).toBeDefined();
    expect(platform.getDeviceByOriginalId('TestId')).toBeUndefined();
    expect(platform.getDeviceByNumber(EndpointNumber(155))).toBeDefined();
    expect(platform.getDeviceByNumber(EndpointNumber(10))).toBeUndefined();
    expect(platform.getDeviceByNumber(155)).toBeDefined();
    expect(platform.getDeviceByNumber(10)).toBeUndefined();

    await platform.onShutdown();
  });
});
