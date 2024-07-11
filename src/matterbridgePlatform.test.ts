/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jest/no-conditional-expect */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils/utils.js';
import { MatterbridgePlatform } from './matterbridgePlatform.js';
import { MatterbridgeDevice, powerSource } from './matterbridgeDevice.js';

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
      // console.log(`Mocked unregisterDevice: ${pluginName} ${device.name}`);
      return Promise.resolve();
    });
    jest.spyOn(Matterbridge.prototype, 'removeAllBridgedDevices').mockImplementation((pluginName: string) => {
      // console.log(`Mocked removeAllBridgedDevices: ${pluginName}`);
      return Promise.resolve();
    });
    matterbridge = await Matterbridge.loadInstance(true);
    platform = new MatterbridgePlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
  });

  afterAll(async () => {
    // Destroy the Matterbridge instance
    // console.log('Destroying Matterbridge');
    await matterbridge.destroyInstance();

    // Wait for the Matterbridge instance to be destroyed (give time to getGlobalNodeModules and getMatterbridgeLatestVersion)
    await waiter(
      'Matterbridge destroyed',
      () => {
        return (Matterbridge as any).instance === undefined;
      },
      false,
      20000,
    );

    // Restore the mocked AnsiLogger.log method
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('should do a partial mock of AnsiLogger', () => {
    const log = new AnsiLogger({ logName: 'Mocked log' });
    expect(log).toBeDefined();
    log.log(LogLevel.INFO, 'Hello, world!');
    log.setLogDebug(true);
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

  test('onConfigure should log a debug message if not overridden', async () => {
    await platform.onConfigure();
    expect(platform.log.debug).toHaveBeenCalledWith("The plugin doesn't override onConfigure.");
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

  test('unregisterDevice calls matterbridge.removeBridgedDevice with correct parameters', async () => {
    const testDevice = new MatterbridgeDevice(powerSource);
    await platform.unregisterDevice(testDevice);
    expect(matterbridge.removeBridgedDevice).toHaveBeenCalled();
  });

  test('unregisterAllDevices calls matterbridge.removeAllBridgedDevices with correct parameters', async () => {
    await platform.unregisterAllDevices();
    expect(matterbridge.removeAllBridgedDevices).toHaveBeenCalled();
  });
});
