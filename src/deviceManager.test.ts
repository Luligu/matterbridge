// src\deviceManager.test.ts

process.argv = ['node', 'matterbridge.test.js', '-novirtual', '-logger', 'info', '-matterlogger', 'info', '-bridge', '-frontend', '0', '-homedir', path.join('test', 'DeviceManager')];

import { jest } from '@jest/globals';
import { AnsiLogger, BLUE, er, LogLevel } from 'node-ansi-logger';
import { rmSync } from 'node:fs';
import path from 'node:path';

import { Matterbridge } from './matterbridge.ts';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.ts';
import { DeviceManager } from './deviceManager.ts';
import { PluginManager } from './pluginManager.ts';
import { contactSensor, occupancySensor } from './matterbridgeDeviceTypes.ts';
import { dev } from './matterbridgeTypes.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

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
rmSync(path.join('test', 'DeviceManager'), { recursive: true, force: true });

/**
 * Waits for the `isOnline` property to become `true`.
 *
 * @param {Matterbridge} matterbridge - The Matterbridge instance to check.
 * @param {number} timeout - The maximum time to wait in milliseconds.
 * @returns {Promise<void>} A promise that resolves when `isOnline` becomes `true` or rejects if the timeout is reached.
 */
async function waitForOnline(matterbridge: Matterbridge, timeout = 10000): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const checkOnline = () => {
      if (matterbridge.serverNode?.lifecycle.isOnline) {
        resolve();
      } else if (Date.now() - start >= timeout) {
        reject(new Error('Timeout waiting for matterbridge.serverNode.lifecycle.isOnline to become true'));
      } else {
        setTimeout(checkOnline, 100); // Check every 100ms
      }
    };

    checkOnline();
  });
}

describe('DeviceManager with mocked devices', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;
  let devices: DeviceManager;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  test('Load matterbridge', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeInstanceOf(Matterbridge);
    plugins = (matterbridge as any).plugins;
    expect(plugins).toBeInstanceOf(PluginManager);
    devices = (matterbridge as any).devices;
    expect(devices).toBeInstanceOf(DeviceManager);
  }, 60000);

  test('matterbridge loads correctly', async () => {
    await waitForOnline(matterbridge);
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBe(true);
  }, 60000);

  test('constructor initializes correctly', () => {
    devices = new DeviceManager(matterbridge, (matterbridge as any).nodeContext);
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('logLevel changes correctly', () => {
    devices.logLevel = LogLevel.DEBUG;
    expect((devices as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('size returns correct number of devices', () => {
    expect(devices.size).toBe(0);
    expect(devices.length).toBe(0);
    devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeEndpoint);
    devices.set({ name: 'DeviceType2', serialNumber: 'DeviceSerial2', deviceName: 'Device2', uniqueId: 'DeviceUniqueId2' } as unknown as MatterbridgeEndpoint);
    devices.set({ name: 'DeviceType3', serialNumber: 'DeviceSerial3', deviceName: 'Device3', uniqueId: 'DeviceUniqueId3' } as unknown as MatterbridgeEndpoint);
    expect(devices.size).toBe(3);
    expect(devices.length).toBe(3);
  });

  test('set without uniqueId to throw', () => {
    expect(() => devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeEndpoint)).toThrow();
  });

  test('set already registered device to log error', () => {
    devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `The device ${dev}Device1${er} with uniqueId ${BLUE}DeviceUniqueId1${er} serialNumber ${BLUE}DeviceSerial1${er} is already in the device manager`);
  });

  test('has returns true if plugin exists', () => {
    expect(devices.has('Unknown')).toBe(false);
    expect(devices.has('DeviceUniqueId1')).toBe(true);
    expect(devices.has('DeviceUniqueId2')).toBe(true);
    expect(devices.has('DeviceUniqueId3')).toBe(true);
  });

  test('get returns the correct devices', () => {
    expect(devices.get('DeviceUniqueId1')).toBeDefined();
    expect(devices.get('DeviceUniqueId2')).toBeDefined();
    expect(devices.get('DeviceUniqueId3')).toBeDefined();
    expect(devices.get('DeviceUniqueId1')?.serialNumber).toBe('DeviceSerial1');
    expect(devices.get('DeviceUniqueId2')?.serialNumber).toBe('DeviceSerial2');
    expect(devices.get('DeviceUniqueId3')?.serialNumber).toBe('DeviceSerial3');
  });

  test('Symbol.iterator allows for iteration over devices', () => {
    let count = 0;
    for (const device of devices) {
      expect(device.name).toBeDefined();
      expect(device.serialNumber).toBeDefined();
      expect(device.deviceName).toBeDefined();
      expect(device.uniqueId).toBeDefined();
      count++;
    }
    expect(count).toBe(3);
  });

  test('async forEach allows for iteration over devices', async () => {
    let count = 0;
    await devices.forEach(async (device: MatterbridgeEndpoint) => {
      expect(device.name).toBeDefined();
      expect(device.serialNumber).toBeDefined();
      expect(device.deviceName).toBeDefined();
      expect(device.uniqueId).toBeDefined();
      count++;
    });
    expect(count).toBe(3);
  });

  test('async forEach to not throw', async () => {
    loggerLogSpy.mockClear();
    let count = 0;
    await devices.forEach(async (device: MatterbridgeEndpoint) => {
      count++;
      throw new Error('Test error');
    });
    expect(count).toBe(3);
    expect(loggerLogSpy).toHaveBeenCalledTimes(3);
  });

  test('array to return all the devices', () => {
    expect(devices.array()).toHaveLength(3);
  });

  test('remove returns true', () => {
    const device1 = devices.get('DeviceUniqueId1');
    expect(device1).toBeDefined();
    if (!device1) return;
    expect(devices.remove(device1)).toBe(true);

    const device2 = devices.get('DeviceUniqueId2');
    expect(device2).toBeDefined();
    if (!device2) return;
    expect(devices.remove(device2)).toBe(true);

    expect(devices.has('DeviceUniqueId1')).toBe(false);
    expect(devices.has('DeviceUniqueId2')).toBe(false);
    expect(devices.has('DeviceUniqueId3')).toBe(true);

    expect(devices.length).toBe(1);
  });

  test('remove without uniqueId to throw', () => {
    expect(() => devices.remove({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeEndpoint)).toThrow();
  });

  test('remove not registered device to log error', () => {
    devices.remove({ name: 'DeviceType4', serialNumber: 'DeviceSerial4', deviceName: 'Device4', uniqueId: 'DeviceUniqueId4' } as unknown as MatterbridgeEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `The device ${dev}Device4${er} with uniqueId ${BLUE}DeviceUniqueId4${er} serialNumber ${BLUE}DeviceSerial4${er} is not registered in the device manager`);
  });

  test('clear to reset the devices', () => {
    devices.clear();
    expect(devices.length).toBe(0);
  });

  test('async forEach to return immediately if no devices', async () => {
    expect(devices.length).toBe(0);
    let count = 0;
    await devices.forEach(async (device: MatterbridgeEndpoint) => {
      count++;
    });
    expect(count).toBe(0);
  });

  test('Destroy matterbridge', async () => {
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
  }, 60000);
});

describe('DeviceManager with real devices', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;
  let devices: DeviceManager;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Load matterbridge', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeInstanceOf(Matterbridge);
  }, 60000);

  test('matterbridge loads correctly', async () => {
    await waitForOnline(matterbridge);
    expect(matterbridge.serverNode?.lifecycle.isOnline).toBe(true);
  }, 60000);

  test('devices initializes correctly', () => {
    devices = (matterbridge as any).devices;
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('plugins initializes correctly', () => {
    plugins = (matterbridge as any).plugins;
    expect(plugins).toBeInstanceOf(PluginManager);
  });

  test('add contactSensor and occupancySensor device', async () => {
    plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    plugins.set({ name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(plugins.size).toBe(3);

    MatterbridgeEndpoint.bridgeMode = 'bridge';
    const device1 = await MatterbridgeEndpoint.loadInstance(contactSensor, { uniqueStorageKey: 'contactSensor' });
    device1.createDefaultBridgedDeviceBasicInformationClusterServer('Contact sensor', 'Serial', 1, 'VendorName', 'ProductName');
    device1.addRequiredClusterServers();
    device1.plugin = 'matterbridge-mock1';

    const device2 = await MatterbridgeEndpoint.loadInstance(occupancySensor, { uniqueStorageKey: 'occupancySensor' });
    device2.createDefaultBridgedDeviceBasicInformationClusterServer('Ocuppancy sensor', 'Serial', 1, 'VendorName', 'ProductName');
    device2.addRequiredClusterServers();
    device2.plugin = 'matterbridge-mock2';

    await matterbridge.addBridgedEndpoint('matterbridge-mock1', device1);
    expect(devices.size).toBe(1);

    await matterbridge.addBridgedEndpoint('matterbridge-mock2', device2);
    expect(devices.size).toBe(2);

    await matterbridge.removeBridgedEndpoint('matterbridge-mock1', device1);
    expect(devices.size).toBe(1);

    await matterbridge.removeBridgedEndpoint('matterbridge-mock2', device2);
    expect(devices.size).toBe(0);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  test('Matterbridge.destroyInstance()', async () => {
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);

    // Wait for the promises to settle
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
  }, 60000);
});
