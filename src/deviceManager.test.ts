/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-debug', '-frontend', '0', '-profile', 'Jest'];

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, BLUE, db, er, LogLevel, nf, nt, pl, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { DeviceManager } from './deviceManager.js';
import { DeviceTypes } from '@project-chip/matter-node.js/device';
import { PluginManager } from './pluginManager.js';
import exp from 'constants';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('DeviceManager with mocked devices', () => {
  let matterbridge: Matterbridge;
  let devices: DeviceManager;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });
    matterbridge = await Matterbridge.loadInstance(true);
    devices = new DeviceManager(matterbridge, (matterbridge as any).nodeContext);
  });

  afterAll(async () => {
    await matterbridge.destroyInstance();
    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  });

  test('constructor initializes correctly', () => {
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('logLevel changes correctly', () => {
    devices.logLevel = LogLevel.DEBUG;
    expect(devices.logLevel).toBe(LogLevel.DEBUG);
    expect((devices as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('clear and load from storage', async () => {
    devices.clear();
    expect(await plugins.saveToStorage()).toBe(0);
    expect(await plugins.loadFromStorage()).toHaveLength(0);
  });
  */

  test('size returns correct number of plugins', () => {
    expect(devices.size).toBe(0);
    expect(devices.length).toBe(0);
    devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeDevice);
    devices.set({ name: 'DeviceType2', serialNumber: 'DeviceSerial2', deviceName: 'Device2', uniqueId: 'DeviceUniqueId2' } as unknown as MatterbridgeDevice);
    devices.set({ name: 'DeviceType3', serialNumber: 'DeviceSerial3', deviceName: 'Device3', uniqueId: 'DeviceUniqueId3' } as unknown as MatterbridgeDevice);
    expect(devices.size).toBe(3);
    expect(devices.length).toBe(3);
  });

  test('set without uniqueId to throw', () => {
    expect(() => devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeDevice)).toThrow();
  });

  test('set already registered device to log error', () => {
    devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeDevice);
    expect((devices as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, `The device ${dev}Device1${er} with uniqueId ${BLUE}DeviceUniqueId1${er} serialNumber ${BLUE}DeviceSerial1${er} is already in the device manager`);
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
    await devices.forEach(async (device: MatterbridgeDevice) => {
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
    await devices.forEach(async (device: MatterbridgeDevice) => {
      count++;
      throw new Error('Test error');
    });
    expect(count).toBe(3);
    expect((devices as any).log.log).toHaveBeenCalledTimes(3);
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
    expect(() => devices.remove({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeDevice)).toThrow();
  });

  test('remove not registered device to log error', () => {
    devices.remove({ name: 'DeviceType4', serialNumber: 'DeviceSerial4', deviceName: 'Device4', uniqueId: 'DeviceUniqueId4' } as unknown as MatterbridgeDevice);
    expect((devices as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, `The device ${dev}Device4${er} with uniqueId ${BLUE}DeviceUniqueId4${er} serialNumber ${BLUE}DeviceSerial4${er} is not registered in the device manager`);
  });

  test('clear to reset the devices', () => {
    devices.clear();
    expect(devices.length).toBe(0);
  });
});

describe('DeviceManager with real devices', () => {
  let matterbridge: Matterbridge;
  let plugins: PluginManager;
  let devices: DeviceManager;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // Mock implementation or empty function
    });
    matterbridge = await Matterbridge.loadInstance(true);
    plugins = (matterbridge as any).plugins;
    devices = (matterbridge as any).devices;
  });

  afterAll(async () => {
    await matterbridge.destroyInstance();
    // Restore the mocked AnsiLogger.log method
    loggerLogSpy.mockRestore();
    // Restore the mocked console.log
    consoleLogSpy.mockRestore();
  });

  test('constructor initializes correctly', () => {
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('add contactSensor and occupancySensor device', async () => {
    plugins.set({ name: 'matterbridge-mock1', path: './src/mock/plugin1/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    plugins.set({ name: 'matterbridge-mock2', path: './src/mock/plugin2/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    plugins.set({ name: 'matterbridge-mock3', path: './src/mock/plugin3/package.json', type: 'Unknown', version: '1.0.0', description: 'To update', author: 'To update' });
    expect(plugins.size).toBe(3);

    MatterbridgeDevice.bridgeMode = 'bridge';
    const device1 = await MatterbridgeDevice.loadInstance(DeviceTypes.CONTACT_SENSOR);
    device1.createDefaultBridgedDeviceBasicInformationClusterServer('Contact sensor', 'Serial', 1, 'VendorName', 'ProductName');
    device1.addRequiredClusterServers(device1);
    device1.plugin = 'matterbridge-mock1';

    const device2 = await MatterbridgeDevice.loadInstance(DeviceTypes.OCCUPANCY_SENSOR);
    device2.createDefaultBridgedDeviceBasicInformationClusterServer('Ocuppancy sensor', 'Serial', 1, 'VendorName', 'ProductName');
    device2.addRequiredClusterServers(device2);
    device2.plugin = 'matterbridge-mock2';

    matterbridge.addBridgedDevice('matterbridge-mock1', device1);
    expect(devices.size).toBe(1);

    matterbridge.addBridgedDevice('matterbridge-mock2', device2);
    expect(devices.size).toBe(2);

    matterbridge.removeBridgedDevice('matterbridge-mock1', device1);
    expect(devices.size).toBe(1);

    matterbridge.removeBridgedDevice('matterbridge-mock2', device2);
    expect(devices.size).toBe(0);
  });
});