/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'JestPlatform'];

import { jest } from '@jest/globals';

import { AnsiLogger, CYAN, db, er, LogLevel, pl, wr } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { contactSensor, humiditySensor, powerSource, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { Environment, StorageService } from '@matter/main';
import path from 'path';
import os from 'os';
import { waiter } from './utils/utils.js';

describe('Matterbridge platform', () => {
  let matterbridge: Matterbridge;
  let platform: MatterbridgePlatform;

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  beforeAll(async () => {
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

    // Load the Matterbridge instance
    matterbridge = await Matterbridge.loadInstance(true);
    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
  });

  afterAll(async () => {
    // Destroy the Matterbridge instance
    await matterbridge.destroyInstance();

    // Restore all mocks
    jest.restoreAllMocks();
  }, 60000);

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('should clear JestPlatform', async () => {
    // Clear all storage contexts
    const environment = Environment.default;
    environment.vars.set('path.root', path.join(os.homedir(), '.matterbridge', 'matterstorage.JestPlatform'));
    const matterStorageService = environment.get(StorageService);
    expect(matterStorageService).toBeDefined();
    const matterStorageManager = await matterStorageService.open('Matterbridge');
    expect(matterStorageManager).toBeDefined();
    await matterStorageManager?.createContext('persist').clearAll();
    await matterStorageManager?.createContext('events')?.clearAll();
    await matterStorageManager?.createContext('fabrics')?.clearAll();
    await matterStorageManager?.createContext('root')?.clearAll();
    await matterStorageManager?.createContext('sessions')?.clearAll();
  });

  test('should be instance of MattebridgePlatform', () => {
    expect(platform).toBeInstanceOf(MatterbridgePlatform);
  });

  test('should have created an instance of NodeStorageManager', () => {
    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.storage).toBeDefined();
    expect(platform.storage).toBeInstanceOf(NodeStorageManager);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Creating storage for plugin test'));
  });

  test('should do a partial mock of AnsiLogger', () => {
    const log = new AnsiLogger({ logName: 'Mocked log' });
    expect(log).toBeDefined();
    log.log(LogLevel.INFO, 'Hello, world!');
    log.logLevel = LogLevel.DEBUG;
    expect(log.log).toBeDefined();
    expect(log.log).toHaveBeenCalled();
    expect(log.log).toHaveBeenCalledWith(LogLevel.INFO, 'Hello, world!');
  });

  test('onStart should throw an error if not overridden', async () => {
    // (platform.log.debug as jest.Mock).mockClear();
    // expect.assertions(2);
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
    expect(platform.validateDeviceWhiteBlackList('white1')).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('black2')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList(['white1', 'black2'])).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('xDevice')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList('')).toBe(false);
  });

  it('should validate with black list', () => {
    platform.config.whiteList = [];
    platform.config.blackList = ['black1', 'black2', 'black3'];
    expect(platform.validateDeviceWhiteBlackList('whiteDevice')).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('black1')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList('black2')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList('black3')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList(['x', 'y', 'z'])).toBe(true);
    expect(platform.validateDeviceWhiteBlackList(['x', 'y', 'z', 'black3'])).toBe(false);
    expect(platform.validateDeviceWhiteBlackList('xDevice')).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('')).toBe(true);
  });

  it('should validate with no white and black list', () => {
    platform.config.whiteList = [];
    platform.config.blackList = [];
    expect(platform.validateDeviceWhiteBlackList('whiteDevice')).toBe(true);
    expect(platform.validateDeviceWhiteBlackList(['whiteDevice', '123456'])).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('blackDevice')).toBe(true);
    expect(platform.validateDeviceWhiteBlackList(['blackDevice', '123456'])).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('')).toBe(true);
  });

  it('should validate with undefined list', () => {
    platform.config.entityWhiteList = undefined;
    platform.config.entityBlackList = undefined;
    platform.config.deviceEntityBlackList = undefined;

    expect(platform.validateEntityBlackList('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', 'blackEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', '')).toBe(true);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with empty list', () => {
    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntityBlackList('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', 'blackEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', '')).toBe(true);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with entity black list', () => {
    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = ['blackEntity'];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntityBlackList('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntityBlackList('any', '')).toBe(true);

    platform.config.entityWhiteList = [];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should validate with entity white list', () => {
    platform.config.entityWhiteList = ['whiteEntity'];
    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};

    expect(platform.validateEntityBlackList('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntityBlackList('any', '')).toBe(false);

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

  it('should validate with device entity black list and entity black list', () => {
    platform.config.entityBlackList = ['blackEntity'];
    platform.config.deviceEntityBlackList = { device1: ['blackEntityDevice1'] };
    expect(platform.validateEntityBlackList('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntityBlackList('any', 'blackEntityDevice1')).toBe(true);
    expect(platform.validateEntityBlackList('any', '')).toBe(true);

    expect(platform.validateEntityBlackList('device1', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('device1', 'blackEntity')).toBe(false);
    expect(platform.validateEntityBlackList('device1', 'blackEntityDevice1')).toBe(false);
    expect(platform.validateEntityBlackList('device1', '')).toBe(true);

    platform.config.entityBlackList = [];
    platform.config.deviceEntityBlackList = {};
  });

  it('should not create storage manager without a name', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: undefined, type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.storage).toBeUndefined();
    expect(await platform.checkEndpointNumbers()).toBe(-1);
  });

  it('should not create storage manager with name empty', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: '', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.storage).toBeUndefined();
    expect(await platform.checkEndpointNumbers()).toBe(-1);
  });

  it('should save the select', async () => {
    let platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    platform.selectDevice.clear();
    platform.selectEntity.clear();
    for (let i = 1; i <= 100; i++) {
      platform.selectDevice.set('serial' + i, { serial: 'serial' + i, name: 'name' + i });
      platform.selectEntity.set('name' + i, { name: 'name' + i, description: 'description' + i });
    }
    expect(platform.selectDevice.size).toBe(100);
    expect(platform.selectDevice.has('serial1')).toBeTruthy();
    expect(platform.selectDevice.has('serial100')).toBeTruthy();
    expect(platform.selectEntity.size).toBe(100);
    expect(platform.selectEntity.has('name1')).toBeTruthy();
    expect(platform.selectEntity.has('name100')).toBeTruthy();
    await platform.onShutdown();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saving 100 selectDevice...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Saving 100 selectEntity...`);
    loggerLogSpy.mockClear();

    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loading selectDevice for plugin matterbridge-jest`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loading selectEntity for plugin matterbridge-jest`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded 100 selectDevice for plugin matterbridge-jest`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Loaded 100 selectEntity for plugin matterbridge-jest`);

    expect(platform.selectDevice.size).toBe(100);
    expect(platform.selectDevice.has('serial1')).toBeTruthy();
    expect(platform.selectDevice.has('serial100')).toBeTruthy();
    expect(platform.selectEntity.size).toBe(100);
    expect(platform.selectEntity.has('name1')).toBeTruthy();
    expect(platform.selectEntity.has('name100')).toBeTruthy();
    platform.selectDevice.clear();
    platform.selectEntity.clear();
    await platform.onShutdown();
  });

  test('should check checkNotLatinCharacters', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'nonLatin' }, true);
    testDevice.createDefaultBasicInformationClusterServer('nonLatin조명', 'serial012345', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    expect(platform.hasDeviceName('nonLatin조명')).toBeTruthy();
    expect(platform.hasDeviceName('none')).toBeFalsy();
    expect(platform.registeredEndpoints.has(testDevice.uniqueId ?? 'none')).toBeTruthy();
    expect(platform.registeredEndpointsByName.has('nonLatin조명')).toBeTruthy();
  });

  test('checkEndpointNumbers should be empty', async () => {
    const context = await platform.storage?.createStorage('endpointNumbers');
    await context?.set('endpointMap', []);
    expect(await platform.checkEndpointNumbers()).toBe(0);
  });

  test('checkEndpointNumbers should not validate without uniqueId', async () => {
    const context = await platform.storage?.createStorage('endpointNumbers');
    await context?.set('endpointMap', []);
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.uniqueId = 'test';
    (matterbridge as any).devices.set(testDevice);
    testDevice.uniqueId = undefined;
    expect(await platform.checkEndpointNumbers()).toBe(0);
    testDevice.uniqueId = 'test';
    expect(await platform.checkEndpointNumbers()).toBe(0);
  });

  test('checkEndpointNumbers should not be empty', async () => {
    const context = await platform.storage?.createStorage('endpointNumbers');
    await context?.set('endpointMap', []);
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    expect(platform.hasDeviceName('test')).toBeTruthy();
    expect(platform.hasDeviceName('none')).toBeFalsy();
    expect(platform.registeredEndpoints.has(testDevice.uniqueId ?? 'none')).toBeTruthy();
    expect(platform.registeredEndpointsByName.has('test')).toBeTruthy();

    testDevice.number = 100;
    (matterbridge as any).devices.set(testDevice);
    expect(await platform.checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
  });

  test('checkEndpointNumbers should check the testDevice', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    testDevice.number = 100;
    (matterbridge as any).devices.set(testDevice);
    expect(await platform.checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
  });

  test('checkEndpointNumbers should not check the testDevice', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (matterbridge as any).devices.set(testDevice);
    expect(await platform.checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Endpoint number for device ${CYAN}${testDevice.deviceName}${wr} changed from ${CYAN}100${wr} to ${CYAN}101${wr}`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
  });

  test('checkEndpointNumbers should not check the testDevice without uniqueId', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (matterbridge as any).devices.set(testDevice);
    testDevice.uniqueId = undefined;
    expect(await platform.checkEndpointNumbers()).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Not checking device ${testDevice.deviceName} without uniqueId or maybeNumber`);
  });

  test('checkEndpointNumbers should check the testDevice with child endpoints', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
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
    (matterbridge as any).devices.set(testDevice);
    expect(testDevice.getChildEndpoints()).toHaveLength(3);
    jest.clearAllMocks();
    expect(await platform.checkEndpointNumbers()).toBe(3);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, `Endpoint number for device ${CYAN}${testDevice.uniqueId}${wr} changed from ${CYAN}100${wr} to ${CYAN}101${wr}`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting endpoint number for device ${CYAN}${testDevice.uniqueId}${db} to ${CYAN}${testDevice.maybeNumber}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Setting child endpoint number for device ${CYAN}${testDevice.uniqueId}${db}.${CYAN}child1${db} to ${CYAN}201${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Setting child endpoint number for device ${CYAN}${testDevice.uniqueId}${db}.${CYAN}child2${db} to ${CYAN}202${db}`);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, `Setting child endpoint number for device ${CYAN}${testDevice.uniqueId}${db}.${CYAN}child3${db} to ${CYAN}202${db}`);
  });

  test('checkEndpointNumbers should validate the testDevice with child endpoints', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    const child1 = testDevice.addChildDeviceType('child1', [temperatureSensor], undefined, true);
    child1.addRequiredClusterServers();
    child1.number = 201;
    const child2 = testDevice.addChildDeviceType('child2', [humiditySensor], undefined, true);
    child2.addRequiredClusterServers();
    child2.number = 202;
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (matterbridge as any).devices.set(testDevice);
    expect(testDevice.getChildEndpoints()).toHaveLength(2);
    jest.clearAllMocks();
    expect(await platform.checkEndpointNumbers()).toBe(3);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.WARN, expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Checking endpoint numbers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Endpoint numbers check completed.');
  });

  test('checkEndpointNumbers should not validate the testDevice with child endpoints', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'test' }, true);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    const child1 = testDevice.addChildDeviceType('child1', [temperatureSensor], undefined, true);
    child1.addRequiredClusterServers();
    child1.number = 203;
    const child2 = testDevice.addChildDeviceType('child2', [humiditySensor], undefined, true);
    child2.addRequiredClusterServers();
    child2.number = 204;
    await platform.registerDevice(testDevice);
    testDevice.number = 101;
    (matterbridge as any).devices.set(testDevice);
    expect(testDevice.getChildEndpoints()).toHaveLength(2);
    jest.clearAllMocks();
    expect(await platform.checkEndpointNumbers()).toBe(3);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Checking endpoint numbers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Saving endpointNumbers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Endpoint numbers check completed.');
  });

  test('onConfigure should log a message', async () => {
    await platform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Configuring platform ');
  });

  test('onChangeLoggerLevel should log a debug message if not overridden', async () => {
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, "The plugin doesn't override onChangeLoggerLevel. Logger level set to: debug");
  });

  test('onShutdown should log a message', async () => {
    await platform.onShutdown('test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Shutting down platform ', 'test reason');
  });

  test('registerDevice calls matterbridge.addBridgedEndpoint with correct parameters', async () => {
    await platform.unregisterAllDevices();
    const testDevice = new MatterbridgeEndpoint(powerSource);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    await platform.registerDevice(testDevice);
    expect(platform.registeredEndpoints.size).toBe(1);
    expect(matterbridge.addBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterDevice calls matterbridge.removeBridgedEndpoint with correct parameters', async () => {
    await platform.unregisterAllDevices();
    const testDevice = new MatterbridgeEndpoint(powerSource);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    await platform.unregisterDevice(testDevice);
    expect(platform.registeredEndpoints.size).toBe(0);
    expect(matterbridge.removeBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterAllDevices calls matterbridge.removeAllBridgedEndpoints with correct parameters', async () => {
    await platform.unregisterAllDevices();
    expect(platform.registeredEndpoints.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
  });

  test('registerDevice should log error if the device name already exist', async () => {
    await platform.unregisterAllDevices();
    expect(platform.registeredEndpoints.size).toBe(0);
    expect(platform.registeredEndpointsByName.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    platform.registeredEndpoints.set('test', new MatterbridgeEndpoint(powerSource));
    platform.registeredEndpointsByName.set('test', new MatterbridgeEndpoint(powerSource));
    const device = new MatterbridgeEndpoint(powerSource);
    device.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    await platform.registerDevice(device);
    expect(platform.registeredEndpoints.size).toBe(1);
    expect(platform.registeredEndpointsByName.size).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with name ${CYAN}${device.deviceName}${er} is already registered. The device will not be added. Please change the device name.`);
  });
});
