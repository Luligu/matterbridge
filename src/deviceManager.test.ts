// src\deviceManager.test.ts

const NAME = 'DeviceManager';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'deviceManager.test.js', '-logger', 'info', '-matterlogger', 'info', '-homedir', HOMEDIR];

import path from 'node:path';

import { jest } from '@jest/globals';
import { BLUE, er, LogLevel } from 'node-ansi-logger';

import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { DeviceManager } from './deviceManager.js';
import { dev } from './matterbridgeTypes.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';

// Mock BroadcastServer methods
const broadcastServerIsWorkerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest').mockImplementation(() => true);
const broadcastServerIsWorkerResponseSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse').mockImplementation(() => true);
const broadcastServerBroadcastMessageHandlerSpy = jest.spyOn(BroadcastServer.prototype as any, 'broadcastMessageHandler').mockImplementation(() => {});
const broadcastServerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'request').mockImplementation(() => {});
const broadcastServerRespondSpy = jest.spyOn(BroadcastServer.prototype, 'respond').mockImplementation(() => {});
const broadcastServerFetchSpy = jest.spyOn(BroadcastServer.prototype, 'fetch').mockImplementation(async () => {
  return Promise.resolve(undefined) as any;
});

// Setup the test environment
setupTest(NAME, false);

describe('DeviceManager', () => {
  let devices: DeviceManager;

  beforeAll(async () => {});

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {});

  test('constructor', () => {
    devices = new DeviceManager();
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('broadcast handler', async () => {
    expect((devices as any).server).toBeInstanceOf(BroadcastServer);
    broadcastServerIsWorkerRequestSpy.mockImplementationOnce(() => false);
    await (devices as any).msgHandler({} as any);

    await (devices as any).msgHandler({ type: 'jest', src: 'frontend', dst: 'devices' } as any); // no id
    await (devices as any).msgHandler({ id: 123456, type: 'jest', src: 'frontend', dst: 'unknown' } as any); // unknown dst
    await (devices as any).msgHandler({ id: 123456, type: 'jest', src: 'frontend', dst: 'devices' } as any); // valid
    await (devices as any).msgHandler({ id: 123456, type: 'jest', src: 'frontend', dst: 'all' } as any); // valid
    await (devices as any).msgHandler({ id: 123456, type: 'get_log_level', src: 'frontend', dst: 'devices', params: {} } as any);
    await (devices as any).msgHandler({ id: 123456, type: 'set_log_level', src: 'frontend', dst: 'devices', params: { logLevel: LogLevel.DEBUG } } as any);
    for (const type of ['jest', 'devices_length', 'devices_size', 'devices_has', 'devices_get', 'devices_set', 'devices_remove', 'devices_clear', 'devices_basearray'] as const) {
      await (devices as any).msgHandler({ id: 123456, type, src: 'frontend', dst: 'all', params: { uniqueId: 'testDevice', device: { uniqueId: 'testDevice' } } } as any);
    }
  });

  test('logLevel changes correctly', () => {
    devices.logLevel = LogLevel.DEBUG;
    expect((devices as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('size returns correct number of devices', async () => {
    expect(devices.size).toBe(0);
    expect(devices.length).toBe(0);
    devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeEndpoint);
    devices.set({ name: 'DeviceType2', serialNumber: 'DeviceSerial2', deviceName: 'Device2', uniqueId: 'DeviceUniqueId2' } as unknown as MatterbridgeEndpoint);
    devices.set({ plugin: 'jest', name: 'DeviceType3', serialNumber: 'DeviceSerial3', deviceName: 'Device3', uniqueId: 'DeviceUniqueId3' } as unknown as MatterbridgeEndpoint);
    expect(devices.size).toBe(3);
    expect(devices.length).toBe(3);
    await (devices as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'devices_basearray', src: 'frontend', dst: 'devices', params: {} } as any);
    await (devices as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'devices_basearray', src: 'frontend', dst: 'devices', params: { pluginName: 'jest' } } as any);
  });

  test('set without uniqueId to throw', () => {
    expect(() => devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeEndpoint)).toThrow();
  });

  test('set already registered device to log error', () => {
    devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeEndpoint);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `The device ${dev}Device1${er} with uniqueId ${BLUE}DeviceUniqueId1${er} serialNumber ${BLUE}DeviceSerial1${er} is already in the device manager`);
  });

  test('has returns true if device exists', () => {
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

  test('destroy', () => {
    devices.destroy();
    expect(devices).toBeInstanceOf(DeviceManager);
  });
});
