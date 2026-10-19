/**
 * @file packages/core/buntest/deviceManager.test.ts
 * @description This file contains the tests for deviceManager.
 * @author Luca Liguori
 */

const NAME = 'DeviceManager';

import { afterAll, beforeEach, describe, expect, test, vi } from 'bun:test';

import { loggerLogSpy, setDebug, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { BroadcastServer } from '@matterbridge/thread/server';
import type { BaseDevice } from '@matterbridge/types';
import { dev } from '@matterbridge/types';
import { AnsiLogger, BLUE, er, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { DeviceManager } from '../src/deviceManager.js';
import type { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('DeviceManager', () => {
  let devices: DeviceManager;

  const log = new AnsiLogger({ logName: 'TestBroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const testServer = new BroadcastServer('manager', log);

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Close the test server
    testServer.close();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('constructor', () => {
    devices = new DeviceManager();
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('unknown server message type', () => {
    // @ts-expect-error -- Testing unknown message type
    expect(testServer.request({ type: 'devices_unknown', src: testServer.name, dst: 'devices', params: {} })).toBeUndefined();
  });

  test('logLevel changes correctly', async () => {
    devices.logLevel = LogLevel.DEBUG;
    expect((devices as any).log.logLevel).toBe(LogLevel.DEBUG);

    expect((await testServer.fetch({ type: 'set_log_level', src: testServer.name, dst: 'devices', params: { logLevel: LogLevel.DEBUG } }, 1000)).result.logLevel).toBe(
      LogLevel.DEBUG,
    );
    expect((await testServer.fetch({ type: 'get_log_level', src: testServer.name, dst: 'devices' }, 1000)).result.logLevel).toBe(LogLevel.DEBUG);
  });

  test('size returns correct number of devices', async () => {
    expect(devices.size).toBe(0);
    expect(devices.length).toBe(0);
    devices.set({
      name: 'DeviceType1',
      serialNumber: 'DeviceSerial1',
      deviceName: 'Device1',
      uniqueId: 'DeviceUniqueId1',
      id: 'DeviceId1',
      number: 1,
      maybeId: 'DeviceId1',
      maybeNumber: 1,
    } as unknown as MatterbridgeEndpoint);
    devices.set({
      name: 'DeviceType2',
      serialNumber: 'DeviceSerial2',
      deviceName: 'Device2',
      uniqueId: 'DeviceUniqueId2',
      id: 'DeviceId2',
      number: 2,
      maybeId: 'DeviceId2',
      maybeNumber: 2,
    } as unknown as MatterbridgeEndpoint);
    devices.set({
      plugin: 'jest',
      name: 'DeviceType3',
      serialNumber: 'DeviceSerial3',
      deviceName: 'Device3',
      uniqueId: 'DeviceUniqueId3',
      id: 'DeviceId3',
      number: 3,
      maybeId: 'DeviceId3',
      maybeNumber: 3,
    } as unknown as MatterbridgeEndpoint);
    expect(devices.size).toBe(3);
    expect(devices.length).toBe(3);
    await (devices as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'devices_basearray', src: 'frontend', dst: 'devices', params: {} } as any);
    await (devices as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'devices_basearray', src: 'frontend', dst: 'devices', params: { pluginName: 'jest' } } as any);

    expect((await testServer.fetch({ type: 'devices_size', src: testServer.name, dst: 'devices' })).result.size).toBe(3);
    expect((await testServer.fetch({ type: 'devices_length', src: testServer.name, dst: 'devices' })).result.length).toBe(3);
  });

  test('set without uniqueId to throw', () => {
    expect(() => devices.set({ name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } as unknown as MatterbridgeEndpoint)).toThrow();
    expect(() =>
      (devices as any).msgHandler({
        id: 123456,
        timestamp: Date.now(),
        type: 'devices_set',
        src: 'frontend',
        dst: 'devices',
        params: { device: { name: 'DeviceType1', serialNumber: 'DeviceSerial1', deviceName: 'Device1' } },
      }),
    ).toThrow();
  });

  test('set already registered device to log error', async () => {
    const device = {
      name: 'DeviceType1',
      serialNumber: 'DeviceSerial1',
      deviceName: 'Device1',
      uniqueId: 'DeviceUniqueId1',
      id: 'DeviceId1',
      number: 1,
      maybeId: 'DeviceId1',
      maybeNumber: 1,
    } as unknown as MatterbridgeEndpoint;
    devices.set(device);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `The device ${dev}Device1${er} with uniqueId ${BLUE}DeviceUniqueId1${er} serialNumber ${BLUE}DeviceSerial1${er} is already in the device manager`,
    );

    expect(devices.size).toBe(3);
    const baseDevice = {
      name: 'DeviceType1bis',
      serialNumber: 'DeviceSerial1bis',
      deviceName: 'Device1bis',
      uniqueId: 'DeviceUniqueId1bis',
      id: 'DeviceId1bis',
      number: 10,
      productLabel: 'Device label',
      productUrl: 'https://matterbridge.io/device',
      configurationVersion: 2,
    } as unknown as BaseDevice;
    expect((await testServer.fetch({ type: 'devices_set', src: testServer.name, dst: 'devices', params: { device: baseDevice } })).result.device).toBeDefined();
    expect(devices.size).toBe(4);
    let getDevice: BaseDevice | undefined = (await testServer.fetch({ type: 'devices_set', src: testServer.name, dst: 'devices', params: { device: baseDevice } })).result.device;
    expect(getDevice).toMatchObject({
      deviceName: 'Device1bis',
      id: 'DeviceId1bis',
      name: 'DeviceType1bis',
      number: 10,
      productLabel: 'Device label',
      productUrl: 'https://matterbridge.io/device',
      configurationVersion: 2,
      serialNumber: 'DeviceSerial1bis',
      uniqueId: 'DeviceUniqueId1bis',
    });
    // oxlint-disable-next-line typescript/no-non-null-assertion
    getDevice = (await testServer.fetch({ type: 'devices_get', src: testServer.name, dst: 'devices', params: { uniqueId: baseDevice.uniqueId! } })).result.device;
    expect(getDevice).toMatchObject({
      deviceName: 'Device1bis',
      id: 'DeviceId1bis',
      name: 'DeviceType1bis',
      number: 10,
      productLabel: 'Device label',
      productUrl: 'https://matterbridge.io/device',
      configurationVersion: 2,
      serialNumber: 'DeviceSerial1bis',
      uniqueId: 'DeviceUniqueId1bis',
    });
    // A partial update merges into the existing device and preserves the fields not sent
    const partialDevice = { uniqueId: 'DeviceUniqueId1bis', productLabel: 'Updated label' } as unknown as BaseDevice;
    getDevice = (await testServer.fetch({ type: 'devices_set', src: testServer.name, dst: 'devices', params: { device: partialDevice } })).result.device;
    expect(devices.size).toBe(4);
    expect(getDevice).toMatchObject({
      deviceName: 'Device1bis',
      id: 'DeviceId1bis',
      name: 'DeviceType1bis',
      number: 10,
      productLabel: 'Updated label',
      productUrl: 'https://matterbridge.io/device',
      configurationVersion: 2,
      serialNumber: 'DeviceSerial1bis',
      uniqueId: 'DeviceUniqueId1bis',
    });
    expect((await testServer.fetch({ type: 'devices_remove', src: testServer.name, dst: 'devices', params: { device: baseDevice } })).result.success).toBe(true);
    expect(devices.size).toBe(3);
  });

  test('has returns true if device exists', async () => {
    expect(devices.has('Unknown')).toBe(false);
    expect(devices.has('DeviceUniqueId1')).toBe(true);
    expect(devices.has('DeviceUniqueId2')).toBe(true);
    expect(devices.has('DeviceUniqueId3')).toBe(true);

    expect((await testServer.fetch({ type: 'devices_has', src: testServer.name, dst: 'devices', params: { uniqueId: 'Unknown' } })).result.has).toBe(false);
    expect((await testServer.fetch({ type: 'devices_has', src: testServer.name, dst: 'devices', params: { uniqueId: 'DeviceUniqueId1' } })).result.has).toBe(true);
  });

  test('get returns the correct devices', async () => {
    expect(devices.get('DeviceUniqueId1')).toBeDefined();
    expect(devices.get('DeviceUniqueId2')).toBeDefined();
    expect(devices.get('DeviceUniqueId3')).toBeDefined();
    expect(devices.get('DeviceUniqueId1')?.serialNumber).toBe('DeviceSerial1');
    expect(devices.get('DeviceUniqueId2')?.serialNumber).toBe('DeviceSerial2');
    expect(devices.get('DeviceUniqueId3')?.serialNumber).toBe('DeviceSerial3');

    expect((await testServer.fetch({ type: 'devices_get', src: testServer.name, dst: 'devices', params: { uniqueId: 'Unknown' } })).result.device).toBeUndefined();
    expect((await testServer.fetch({ type: 'devices_get', src: testServer.name, dst: 'devices', params: { uniqueId: 'DeviceUniqueId1' } })).result.device).toBeDefined();
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
    await setDebug(true);
    expect(devices.array()).toHaveLength(3);

    expect((await testServer.fetch({ type: 'devices_basearray', src: testServer.name, dst: 'devices', params: {} })).result.devices).toHaveLength(3);
    expect((await testServer.fetch({ type: 'devices_basearray', src: testServer.name, dst: 'devices', params: {} })).result.devices).toMatchObject([
      {
        configUrl: undefined,
        deviceName: 'Device1',
        deviceType: undefined,
        id: 'DeviceId1',
        mode: undefined,
        name: 'DeviceType1',
        number: 1,
        plugin: undefined,
        productUrl: undefined,
        serialNumber: 'DeviceSerial1',
        uniqueId: 'DeviceUniqueId1',
      },
      {
        configUrl: undefined,
        deviceName: 'Device2',
        deviceType: undefined,
        id: 'DeviceId2',
        mode: undefined,
        name: 'DeviceType2',
        number: 2,
        plugin: undefined,
        productUrl: undefined,
        serialNumber: 'DeviceSerial2',
        uniqueId: 'DeviceUniqueId2',
      },
      {
        configUrl: undefined,
        deviceName: 'Device3',
        deviceType: undefined,
        id: 'DeviceId3',
        mode: undefined,
        name: 'DeviceType3',
        number: 3,
        plugin: 'jest',
        productUrl: undefined,
        serialNumber: 'DeviceSerial3',
        uniqueId: 'DeviceUniqueId3',
      },
    ]);
    await setDebug(false);
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
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.ERROR,
      `The device ${dev}Device4${er} with uniqueId ${BLUE}DeviceUniqueId4${er} serialNumber ${BLUE}DeviceSerial4${er} is not registered in the device manager`,
    );
  });

  test('clear to reset the devices', async () => {
    devices.clear();
    expect(devices.length).toBe(0);

    expect((await testServer.fetch({ type: 'devices_clear', src: testServer.name, dst: 'devices' })).result.success).toBe(true);
  });

  test('async forEach to return immediately if no devices', async () => {
    expect(devices.length).toBe(0);
    let count = 0;
    await devices.forEach(async (device: MatterbridgeEndpoint) => {
      count++;
    });
    expect(count).toBe(0);
  });

  test('apiDeviceArray and devices_apidevicearray', async () => {
    devices.clear();
    const fake = (props: Record<string, unknown>): MatterbridgeEndpoint =>
      ({
        plugin: 'plugin1',
        deviceType: 0x0100,
        name: 'OnOffLight',
        deviceName: 'Light',
        serialNumber: 'SN',
        uniqueId: 'unique',
        id: 'light',
        number: 5,
        productUrl: 'https://product',
        configUrl: 'https://config',
        lifecycle: { isReady: true },
        construction: { status: 'active' },
        hasClusterServer: () => false,
        getChildEndpoints: () => [],
        forEachAttribute: () => {},
        ownerOfType: () => null,
        ...props,
      }) as unknown as MatterbridgeEndpoint;

    devices.set(fake({}));
    devices.set(fake({ uniqueId: 'other', plugin: 'plugin2', deviceName: 'Other' }));
    devices.set(fake({ uniqueId: 'notReady', lifecycle: { isReady: false } }));
    devices.set(fake({ uniqueId: 'noPlugin', plugin: '' }));
    devices.set(
      fake({
        uniqueId: 'server',
        deviceName: 'Server',
        mode: 'server',
        serverNode: {
          id: 'server-store',
          lifecycle: { isOnline: true },
          state: {
            commissioning: { commissioned: false, pairingCodes: { qrPairingCode: 'QR', manualPairingCode: 'MAN' }, fabrics: {} },
            administratorCommissioning: { windowStatus: 0 },
            sessions: { sessions: {} },
            basicInformation: { serialNumber: 'SN', reachable: true },
          },
        },
      }),
    );

    const all = devices.apiDeviceArray();
    expect(all.map((d) => d.uniqueId)).toEqual(['unique', 'other', 'server']);
    expect(all[0]).toEqual({
      plugin: 'plugin1',
      type: 'OnOffLight (0x0100)',
      number: 5,
      id: 'light',
      deviceName: 'Light',
      serialNumber: 'SN',
      productUrl: 'https://product',
      configUrl: 'https://config',
      uniqueId: 'unique',
      reachable: true,
      powerSource: undefined,
      batteryLevel: undefined,
      matter: undefined,
      cluster: '',
    });
    expect(all[2].reachable).toBe(true);
    expect(all[2].matter).toBeUndefined();
    expect(devices.apiDeviceArray(undefined, false)).toEqual(all);
    const extended = devices.apiDeviceArray(undefined, true);
    expect(extended.map((d) => d.uniqueId)).toEqual(['unique', 'other', 'server']);
    expect(extended[0].reachable).toBe(false);
    expect(extended[2].reachable).toBe(true);
    expect(extended[2].matter).toMatchObject({ id: 'server-store', online: true, commissioned: false, qrPairingCode: 'QR', manualPairingCode: 'MAN', serialNumber: 'SN' });

    expect(devices.apiDeviceArray('plugin2').map((d) => d.uniqueId)).toEqual(['other']);
    expect(devices.apiDeviceArray('missing')).toEqual([]);

    expect((await testServer.fetch({ type: 'devices_apidevicearray', src: testServer.name, dst: 'devices', params: {} })).result.devices).toEqual(all);
    for (const extended of [false, true]) {
      for (const pluginName of [undefined, 'plugin1', 'plugin2', 'missing']) {
        const response = await testServer.fetch({
          type: 'devices_apidevicearray',
          src: testServer.name,
          dst: 'devices',
          params: { pluginName, extended },
        });
        expect(response.result.devices).toEqual(devices.apiDeviceArray(pluginName, extended));
      }
    }
    devices.clear();
  });

  test('should ignore the message when it is not a request', () => {
    const respondSpy = vi.spyOn((devices as any).server, 'respond');
    (devices as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'devices_size', src: 'frontend', dst: 'devices', result: { size: 0 } });
    expect(respondSpy).not.toHaveBeenCalled();
  });

  test('destroy', () => {
    devices.destroy();
    expect(devices).toBeInstanceOf(DeviceManager);
  });

  test('should log at debug level the requests and the unknown messages when verbose', async () => {
    process.argv.push('--verbose');
    const verboseDevices = new DeviceManager();
    expect((verboseDevices as any).log.logLevel).toBe(LogLevel.DEBUG);
    expect((await testServer.fetch({ type: 'devices_size', src: testServer.name, dst: 'devices' })).result.size).toBe(0);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Received request message'));
    (verboseDevices as any).msgHandler({ id: 123456, timestamp: Date.now(), type: 'devices_unknown', src: 'frontend', dst: 'devices', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Unknown broadcast message'));
    verboseDevices.destroy();
    process.argv.splice(process.argv.indexOf('--verbose'), 1);
  });
});
