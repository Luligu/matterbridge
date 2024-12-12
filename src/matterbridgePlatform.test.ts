/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest'];

import { jest } from '@jest/globals';

import { AnsiLogger, LogLevel, pl } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { powerSource } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

describe('Matterbridge platform', () => {
  let matterbridge: Matterbridge;
  let platform: MatterbridgePlatform;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'debug').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked debug: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'info').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked info: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'warn').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked warn: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'error').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked error: ${message}`, ...parameters);
    });
    jest.spyOn(Matterbridge.prototype, 'addBridgedDevice').mockImplementation((pluginName: string, device: MatterbridgeDevice) => {
      // console.log(`Mocked addBridgedDevice: ${pluginName} ${device.name}`);
      return Promise.resolve();
    });
    jest.spyOn(Matterbridge.prototype, 'removeBridgedDevice').mockImplementation((pluginName: string, device: MatterbridgeDevice) => {
      // console.log(`Mocked removeBridgedDevice: ${pluginName} ${device.name}`);
      return Promise.resolve();
    });
    jest.spyOn(Matterbridge.prototype, 'removeAllBridgedDevices').mockImplementation((pluginName: string) => {
      // console.log(`Mocked removeAllBridgedDevices: ${pluginName}`);
      return Promise.resolve();
    });
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

    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('should do a partial mock of AnsiLogger', () => {
    const log = new AnsiLogger({ logName: 'Mocked log' });
    expect(log).toBeDefined();
    log.log(LogLevel.INFO, 'Hello, world!');
    log.logLevel = LogLevel.DEBUG;
    expect(log.log).toBeDefined();
    expect(log.log).toHaveBeenCalled();
  });

  test('onStart should throw an error if not overridden', async () => {
    (platform.log.debug as jest.Mock).mockClear();
    expect.assertions(2);
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
    expect(platform.validateDeviceWhiteBlackList('white1')).toBe(true);
    expect(platform.validateDeviceWhiteBlackList('black2')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList(['white1', 'black2'])).toBe(false);
    expect(platform.validateDeviceWhiteBlackList('xDevice')).toBe(false);
    expect(platform.validateDeviceWhiteBlackList('')).toBe(false);
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

  it('should validate with entity black list', () => {
    platform.config.entityBlackList = ['blackEntity'];
    platform.config.deviceEntityBlackList = {};
    expect(platform.validateEntityBlackList('any', 'whiteEntity')).toBe(true);
    expect(platform.validateEntityBlackList('any', 'blackEntity')).toBe(false);
    expect(platform.validateEntityBlackList('any', '')).toBe(true);

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

  test('onConfigure should log a debug message if not overridden', async () => {
    await platform.onConfigure();
    expect(platform.log.debug).toHaveBeenCalledWith("The plugin doesn't override onConfigure.");
  });

  test('onChangeLoggerLevel should log a debug message if not overridden', async () => {
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(platform.log.debug).toHaveBeenCalledWith("The plugin doesn't override onChangeLoggerLevel. Logger level set to: debug");
  });

  test('onShutdown should log a debug message if not overridden', async () => {
    await platform.onShutdown('test reason');
    expect(platform.log.debug).toHaveBeenCalledWith("The plugin doesn't override onShutdown.", 'test reason');
  });

  test('registerDevice calls matterbridge.addBridgedDevice with correct parameters', async () => {
    const testDevice = new MatterbridgeDevice(powerSource);
    await platform.registerDevice(testDevice);
    expect(matterbridge.addBridgedDevice).toHaveBeenCalled();
  });

  test('registerDevice calls matterbridge.addBridgedEndpoint with correct parameters', async () => {
    const testDevice = new MatterbridgeEndpoint(powerSource);
    await platform.registerDevice(testDevice);
    expect(matterbridge.addBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterDevice calls matterbridge.removeBridgedDevice with correct parameters', async () => {
    const testDevice = new MatterbridgeDevice(powerSource);
    await platform.unregisterDevice(testDevice);
    expect(matterbridge.removeBridgedDevice).toHaveBeenCalled();
  });

  test('unregisterDevice calls matterbridge.removeBridgedEndpoint with correct parameters', async () => {
    const testDevice = new MatterbridgeEndpoint(powerSource);
    await platform.unregisterDevice(testDevice);
    expect(matterbridge.removeBridgedEndpoint).toHaveBeenCalled();
  });

  test('unregisterAllDevices calls matterbridge.removeAllBridgedDevices with correct parameters', async () => {
    await platform.unregisterAllDevices();
    expect(matterbridge.removeAllBridgedDevices).toHaveBeenCalled();
  });

  test('unregisterAllDevices calls matterbridge.removeAllBridgedEndpoints with correct parameters', async () => {
    platform.matterbridge.edge = true;
    await platform.unregisterAllDevices();
    expect(matterbridge.removeAllBridgedEndpoints).toHaveBeenCalled();
    platform.matterbridge.edge = false;
  });
});
