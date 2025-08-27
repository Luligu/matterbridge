// src\matterbridgePlatform.test.ts

/* eslint-disable jest/no-conditional-expect */

const NAME = 'MatterbridgePlatform';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-homedir', HOMEDIR];

import { jest } from '@jest/globals';

import path from 'node:path';
import { rmSync } from 'node:fs';

import { AnsiLogger, CYAN, db, er, LogLevel, pl, wr } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import { Matterbridge } from './matterbridge.ts';
import { MatterbridgePlatform } from './matterbridgePlatform.ts';
import { bridgedNode, contactSensor, humiditySensor, powerSource, temperatureSensor } from './matterbridgeDeviceTypes.ts';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.ts';
import { Descriptor } from '@matter/main/clusters/descriptor';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge platform', () => {
  let matterbridge: Matterbridge;
  let platform: MatterbridgePlatform;

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
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  }, 60000);

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
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

  test('should create an instance of Matterbridge', async () => {
    // Load the Matterbridge instance
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeInstanceOf(Matterbridge);

    await new Promise<void>((resolve) => {
      matterbridge.once('online', (name) => {
        if (name === 'Matterbridge') resolve();
      });
    });
  }, 60000);

  test('should have created an instance of NodeStorageManager', async () => {
    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform).toBeDefined();
    expect(platform).toBeInstanceOf(MatterbridgePlatform);
    expect(platform.storage).toBeDefined();
    expect(platform.storage).toBeInstanceOf(NodeStorageManager);
    expect(platform.context).toBeUndefined();
    expect(platform.selectDevice).toBeDefined();
    expect(platform.selectDevice).toBeInstanceOf(Map);
    expect(platform.selectDevice.size).toBe(0);
    expect(platform.selectEntity).toBeDefined();
    expect(platform.selectEntity).toBeInstanceOf(Map);
    expect(platform.selectEntity.size).toBe(0);
    expect((platform as any)._contextReady).toBeInstanceOf(Promise);
    expect((platform as any)._selectDeviceContextReady).toBeInstanceOf(Promise);
    expect((platform as any)._selectEntityContextReady).toBeInstanceOf(Promise);
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

  it('should validate with device entity black list and entity black list', () => {
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
      new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: undefined, type: 'type', debug: false, unregisterOnShutdown: false });
    }).toThrow();
  });

  it('should not create storage manager with name empty', async () => {
    expect(() => {
      new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: '', type: 'type', debug: false, unregisterOnShutdown: false });
    }).toThrow();
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

  test('should clear the selects', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
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
    expect(platform.selectDevice.size).toBe(0);
    expect(platform.selectEntity.size).toBe(0);
  });

  test('should clear the device selects', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub');
    platform.clearDeviceSelect('serial1');
    expect(platform.selectDevice.size).toBe(0);
    expect(platform.selectEntity.size).toBe(0);
  });

  test('should clear the entity selects', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    platform.setSelectEntity('name1', 'description1', 'component');
    platform.clearEntitySelect('name1');
    expect(platform.selectDevice.size).toBe(0);
    expect(platform.selectEntity.size).toBe(0);
  });

  it('should update a not existing entity selects', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    await platform.clearSelect();
    expect(platform.selectDevice.size).toBe(0);
    expect(platform.selectEntity.size).toBe(0);

    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub');
    expect(platform.selectDevice.size).toBe(1);
    expect(platform.selectEntity.size).toBe(0);
    expect(platform.selectDevice.get('serial1')?.entities).toEqual(undefined);

    platform.setSelectDeviceEntity('serial1', 'name2', 'description2', 'hub2');
    expect(platform.selectDevice.get('serial1')?.entities).toEqual([{ description: 'description2', icon: 'hub2', name: 'name2' }]);
  });

  it('should update an existing entity selects', async () => {
    const platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'matterbridge-jest', type: 'type', debug: false, unregisterOnShutdown: false });
    await platform.ready;
    expect(platform.storage).toBeDefined();
    expect(platform.context).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgePlatform for plugin matterbridge-jest is fully initialized`);
    await platform.clearSelect();
    expect(platform.selectDevice.size).toBe(0);
    expect(platform.selectEntity.size).toBe(0);

    platform.setSelectDevice('serial1', 'name1', 'url1', 'hub', [{ name: 'name1', description: 'description1', icon: 'hub1' }]);
    expect(platform.selectDevice.size).toBe(1);
    expect(platform.selectEntity.size).toBe(0);
    expect(platform.selectDevice.get('serial1')?.entities).toEqual([{ description: 'description1', icon: 'hub1', name: 'name1' }]);

    platform.setSelectDeviceEntity('serial1', 'name2', 'description2', 'hub2');
    expect(platform.selectDevice.get('serial1')?.entities).toEqual([
      { description: 'description1', icon: 'hub1', name: 'name1' },
      { description: 'description2', icon: 'hub2', name: 'name2' },
    ]);
  });

  test('should check checkNotLatinCharacters', async () => {
    const testDevice = new MatterbridgeEndpoint(contactSensor, { uniqueStorageKey: 'nonLatin' }, true);
    testDevice.createDefaultBasicInformationClusterServer('nonLatin조명', 'serial012345', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    testDevice.addRequiredClusterServers();
    await platform.registerDevice(testDevice);
    expect(platform.hasDeviceName('nonLatin조명')).toBeTruthy();
    expect(platform.hasDeviceName('none')).toBeFalsy();
    expect((platform as any)._registeredEndpoints.has(testDevice.uniqueId ?? 'none')).toBeTruthy();
    expect((platform as any)._registeredEndpointsByName.has('nonLatin조명')).toBeTruthy();
  });

  test('checkEndpointNumbers should return -1', async () => {
    const storage = platform.storage;
    (platform.storage as any) = undefined; // Simulate no storage available
    expect(await platform.checkEndpointNumbers()).toBe(-1);
    platform.storage = storage; // Restore storage
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
    expect((platform as any)._registeredEndpoints.has(testDevice.uniqueId ?? 'none')).toBeTruthy();
    expect((platform as any)._registeredEndpointsByName.has('test')).toBeTruthy();

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

  test('onAction should log a message', async () => {
    await platform.onAction('Test');
    await platform.onAction('Test', 'value', 'id', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`doesn't override onAction.`), undefined);
  });

  test('onConfigChanged should log a message', async () => {
    await platform.onConfigChanged({});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`doesn't override onConfigChanged`));
  });

  test('onChangeLoggerLevel should log a debug message if not overridden', async () => {
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, "The plugin doesn't override onChangeLoggerLevel. Logger level set to: debug");
  });

  test('onShutdown should log a message', async () => {
    await platform.onShutdown('test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Shutting down platform ', 'test reason');
  });

  test('getDevice should return []', async () => {
    expect(platform.getDevices()).toEqual([]);
  });

  test('registerDevice calls matterbridge.addBridgedEndpoint with correct parameters', async () => {
    await platform.unregisterAllDevices();
    const testDevice = new MatterbridgeEndpoint(powerSource);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    await platform.registerDevice(testDevice);
    expect((platform as any)._registeredEndpoints.size).toBe(1);
    expect(matterbridge.addBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterDevice calls matterbridge.removeBridgedEndpoint with correct parameters', async () => {
    await platform.unregisterAllDevices();
    const testDevice = new MatterbridgeEndpoint(powerSource);
    testDevice.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    await platform.unregisterDevice(testDevice);
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect(matterbridge.removeBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterAllDevices calls matterbridge.removeAllBridgedEndpoints with correct parameters', async () => {
    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
  });

  test('registerDevice should log error if the device uniqueid is undefined', async () => {
    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    await platform.registerDevice(device);
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `Device with name ${CYAN}${device.deviceName}${er} has no uniqueId. Did you forget to call createDefaultBasicInformationClusterServer() or createDefaultBridgedDeviceBasicInformationClusterServer()? The device will not be added.`,
    );
  });

  test('registerDevice should log error if the device deviceName is undefined', async () => {
    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    expect(device).toBeDefined();
    expect(device.deviceName).toBeUndefined();
    device.createDefaultBasicInformationClusterServer('', 'serial01234');
    expect(device.deviceName).toBe('');
    expect(device.serialNumber).toBe('serial01234');
    await platform.registerDevice(device);
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with uniqueId ${CYAN}${device.uniqueId}${er} has no deviceName. The device will not be added.`);
  });

  test('registerDevice should log error if the device serialNumber is undefined', async () => {
    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    const device = new MatterbridgeEndpoint(powerSource);
    expect(device).toBeDefined();
    expect(device.serialNumber).toBeUndefined();
    device.createDefaultBasicInformationClusterServer('Device1234', '');
    expect(device.deviceName).toBe('Device1234');
    expect(device.serialNumber).toBe('');
    await platform.registerDevice(device);
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with uniqueId ${CYAN}${device.uniqueId}${er} has no serialNumber. The device will not be added.`);
  });

  test('registerDevice should add bridgeNode and BridgedDeviceBasicInformation if not present', async () => {
    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
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
    expect((platform as any)._registeredEndpoints.size).toBe(1);
    expect((platform as any)._registeredEndpointsByName.size).toBe(1);

    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
  });

  test('registerDevice should log error if the device name already exist', async () => {
    await platform.unregisterAllDevices();
    expect((platform as any)._registeredEndpoints.size).toBe(0);
    expect((platform as any)._registeredEndpointsByName.size).toBe(0);
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();

    (platform as any)._registeredEndpoints.set('test', new MatterbridgeEndpoint(powerSource));
    (platform as any)._registeredEndpointsByName.set('test', new MatterbridgeEndpoint(powerSource));
    const device = new MatterbridgeEndpoint(powerSource);
    device.createDefaultBasicInformationClusterServer('test', 'serial01234', 0xfff1, 'Matterbridge', 0x8001, 'Test device');
    await platform.registerDevice(device);
    expect((platform as any)._registeredEndpoints.size).toBe(1);
    expect((platform as any)._registeredEndpointsByName.size).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Device with name ${CYAN}${device.deviceName}${er} is already registered. The device will not be added. Please change the device name.`);
  });

  test('destroyInstance()', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Destroy instance...`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
  }, 60000);
});
