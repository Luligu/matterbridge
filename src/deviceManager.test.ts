// src\deviceManager.test.ts

const NAME = 'DeviceManager';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'deviceManager.test.js', '-logger', 'info', '-matterlogger', 'info', '-homedir', HOMEDIR];

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, BLUE, er, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { DeviceManager } from './deviceManager.js';
import { BaseDevice, dev } from './matterbridgeTypes.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';

// Setup the test environment
setupTest(NAME, false);

describe('DeviceManager', () => {
  let devices: DeviceManager;

  const log = new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const testServer = new BroadcastServer('manager', log);

  beforeAll(async () => {});

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Close the test server
    testServer.close();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('constructor', () => {
    devices = new DeviceManager();
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('unknown server message type', async () => {
    // @ts-expect-error -- Testing unknown message type
    expect(await testServer.request({ type: 'devices_unknown', src: testServer.name, dst: 'devices', params: {} })).toBeUndefined();
  });

  test('logLevel changes correctly', async () => {
    devices.logLevel = LogLevel.DEBUG;
    expect((devices as any).log.logLevel).toBe(LogLevel.DEBUG);

    expect((await testServer.fetch({ type: 'set_log_level', src: testServer.name, dst: 'devices', params: { logLevel: LogLevel.DEBUG } })).response.logLevel).toBe(LogLevel.DEBUG);
    expect((await testServer.fetch({ type: 'get_log_level', src: testServer.name, dst: 'devices' })).response.logLevel).toBe(LogLevel.DEBUG);
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

    expect((await testServer.fetch({ type: 'devices_size', src: testServer.name, dst: 'devices' })).response.size).toBe(3);
    expect((await testServer.fetch({ type: 'devices_length', src: testServer.name, dst: 'devices' })).response.length).toBe(3);
  });

  test('set without uniqueId to throw', () => {
    expect(() => devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeEndpoint)).toThrow();
  });

  test('set already registered device to log error', async () => {
    const device = { name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1', uniqueId: 'DeviceUniqueId1' } as unknown as MatterbridgeEndpoint;
    devices.set(device);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `The device ${dev}Device1${er} with uniqueId ${BLUE}DeviceUniqueId1${er} serialNumber ${BLUE}DeviceSerial1${er} is already in the device manager`);

    const baseDevice = { name: 'DeviceType1bis', serialNumber: 'DeviceSerial1bis', deviceName: 'Device1bis', uniqueId: 'DeviceUniqueId1bis' } as unknown as BaseDevice;
    expect((await testServer.fetch({ type: 'devices_set', src: testServer.name, dst: 'devices', params: { device: baseDevice } })).response.device).toBeDefined();
    expect((await testServer.fetch({ type: 'devices_remove', src: testServer.name, dst: 'devices', params: { device: baseDevice } })).response.success).toBe(true);
  });

  test('has returns true if device exists', async () => {
    expect(devices.has('Unknown')).toBe(false);
    expect(devices.has('DeviceUniqueId1')).toBe(true);
    expect(devices.has('DeviceUniqueId2')).toBe(true);
    expect(devices.has('DeviceUniqueId3')).toBe(true);

    expect((await testServer.fetch({ type: 'devices_has', src: testServer.name, dst: 'devices', params: { uniqueId: 'Unknown' } })).response.has).toBe(false);
    expect((await testServer.fetch({ type: 'devices_has', src: testServer.name, dst: 'devices', params: { uniqueId: 'DeviceUniqueId1' } })).response.has).toBe(true);
  });

  test('get returns the correct devices', async () => {
    expect(devices.get('DeviceUniqueId1')).toBeDefined();
    expect(devices.get('DeviceUniqueId2')).toBeDefined();
    expect(devices.get('DeviceUniqueId3')).toBeDefined();
    expect(devices.get('DeviceUniqueId1')?.serialNumber).toBe('DeviceSerial1');
    expect(devices.get('DeviceUniqueId2')?.serialNumber).toBe('DeviceSerial2');
    expect(devices.get('DeviceUniqueId3')?.serialNumber).toBe('DeviceSerial3');

    expect((await testServer.fetch({ type: 'devices_get', src: testServer.name, dst: 'devices', params: { uniqueId: 'Unknown' } })).response.device).toBeUndefined();
    expect((await testServer.fetch({ type: 'devices_get', src: testServer.name, dst: 'devices', params: { uniqueId: 'DeviceUniqueId1' } })).response.device).toBeDefined();
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

  test('array to return all the devices', async () => {
    expect(devices.array()).toHaveLength(3);

    expect((await testServer.fetch({ type: 'devices_basearray', src: testServer.name, dst: 'devices', params: {} })).response.devices).toHaveLength(3);
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

  test('clear to reset the devices', async () => {
    devices.clear();
    expect(devices.length).toBe(0);

    expect((await testServer.fetch({ type: 'devices_clear', src: testServer.name, dst: 'devices' })).response.success).toBe(true);
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
