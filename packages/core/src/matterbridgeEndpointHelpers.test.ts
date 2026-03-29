// src\matterbridgeEndpointHelpers.test.ts

const NAME = 'MatterbridgeEndpointHelpers';
const MATTER_PORT = 11300;
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { NumberTag, PowerSourceTag } from '@matter/node';
import { TemperatureMeasurementServer } from '@matter/node/behaviors/temperature-measurement';
import { VendorId } from '@matter/types';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { db, er, hk, or } from 'node-ansi-logger';

import { MatterbridgeDoorLockServer } from './behaviors/doorLockServer.js';
import {
  addDevice,
  aggregator,
  createMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  log,
  setupTest,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
} from './jestutils/jestHelpers.js';
import { doorLockDevice, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  getApparentElectricalPowerMeasurementClusterServer,
  getCluster,
  getDefaultDeviceEnergyManagementClusterServer,
  getDefaultDeviceEnergyManagementModeClusterServer,
  getDefaultElectricalEnergyMeasurementClusterServer,
  getDefaultElectricalPowerMeasurementClusterServer,
  getDefaultFlowMeasurementClusterServer,
  getDefaultIlluminanceMeasurementClusterServer,
  getDefaultOccupancySensingClusterServer,
  getDefaultOperationalStateClusterServer,
  getDefaultPowerSourceBatteryClusterServer,
  getDefaultPowerSourceRechargeableBatteryClusterServer,
  getDefaultPowerSourceReplaceableBatteryClusterServer,
  getDefaultPressureMeasurementClusterServer,
  getDefaultRelativeHumidityMeasurementClusterServer,
  getDefaultTemperatureMeasurementClusterServer,
  getSemtag,
  getSnapshot,
  internalFor,
  setCluster,
} from './matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Options helpers', () => {
  let device: MatterbridgeEndpoint;

  class ManagedValue {
    constructor(
      public label: string,
      public nested: unknown,
    ) {}

    get upperLabel() {
      return this.label.toUpperCase();
    }
  }

  beforeAll(async () => {
    // Create Matterbridge environment
    await createMatterbridgeEnvironment(NAME, MATTER_CREATE_ONLY);
    await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy Matterbridge environment
    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
    await destroyMatterbridgeEnvironment(undefined, undefined, !MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('getSemtag helper', () => {
    expect(getSemtag(PowerSourceTag.Solar)).toEqual({ mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Solar.tag });
    expect(getSemtag(NumberTag.TwentyFour, 'My Label')).toEqual({ label: 'My Label', mfgCode: null, namespaceId: NumberTag.TwentyFour.namespaceId, tag: NumberTag.TwentyFour.tag });
    expect(getSemtag(NumberTag.One, 'My Label', VendorId(12))).toEqual({
      label: 'My Label',
      mfgCode: 12,
      namespaceId: 7,
      tag: 1,
    });
    expect(getSemtag(NumberTag.One, '   0123456789012345678901234567890123456789012345678901234567890123456789   ', VendorId(12))).toEqual({
      label: '0123456789012345678901234567890123456789012345678901234567890123', // Label should be trimmed to 64 characters
      mfgCode: 12,
      namespaceId: 7,
      tag: 1,
    });
    expect(NumberTag.Two).toEqual({ label: 'Two', mfgCode: null, namespaceId: 7, tag: 2 });
  });

  test('options helpers', () => {
    expect(getDefaultPowerSourceBatteryClusterServer()).toBeDefined();
    expect(getDefaultPowerSourceReplaceableBatteryClusterServer()).toBeDefined();
    expect(getDefaultPowerSourceRechargeableBatteryClusterServer()).toBeDefined();
    expect(getDefaultElectricalEnergyMeasurementClusterServer()).toBeDefined();
    expect(getDefaultElectricalPowerMeasurementClusterServer()).toBeDefined();
    expect(getApparentElectricalPowerMeasurementClusterServer()).toBeDefined();
    expect(getDefaultDeviceEnergyManagementClusterServer()).toBeDefined();
    expect(getDefaultDeviceEnergyManagementModeClusterServer()).toBeDefined();
    expect(getDefaultOperationalStateClusterServer()).toBeDefined();
    expect(getDefaultTemperatureMeasurementClusterServer()).toBeDefined();
    expect(getDefaultRelativeHumidityMeasurementClusterServer()).toBeDefined();
    expect(getDefaultPressureMeasurementClusterServer()).toBeDefined();
    expect(getDefaultIlluminanceMeasurementClusterServer()).toBeDefined();
    expect(getDefaultFlowMeasurementClusterServer()).toBeDefined();
    expect(getDefaultOccupancySensingClusterServer()).toBeDefined();
  });

  test('internalFor returns the live behavior internal state', async () => {
    device = new MatterbridgeEndpoint(doorLockDevice, { id: 'DoorLockHelper' });
    device.behaviors.require(
      MatterbridgeDoorLockServer.enable({
        events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
        commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
      }),
      {
        lockState: DoorLock.LockState.Locked,
        lockType: DoorLock.LockType.DeadBolt,
        actuatorEnabled: true,
        operatingMode: DoorLock.OperatingMode.Normal,
        supportedOperatingModes: { normal: false, vacation: true, privacy: true, noRemoteLockUnlock: false, passage: true, alwaysSet: 2047 },
        autoRelockTime: 0,
      },
    );
    device.addRequiredClusterServers();

    expect(await addDevice(aggregator, device)).toBeDefined();

    expect(await internalFor<MatterbridgeDoorLockServer.Internal>(device, 'UnknownBehavior')).toBeUndefined();

    const internal = await internalFor<MatterbridgeDoorLockServer.Internal>(device, MatterbridgeDoorLockServer);
    expect(internal).toBeDefined();
    if (!internal) throw new Error('MatterbridgeDoorLockServer internal state not found');

    expect(internal.enableTimeout).toBe(false);
    internal.enableTimeout = true;

    expect((await internalFor<MatterbridgeDoorLockServer.Internal>(device, MatterbridgeDoorLockServer))?.enableTimeout).toBe(true);
  });

  test('getSnapshot returns non-object values unchanged', () => {
    const symbolValue = Symbol('plain-cluster-symbol');
    const functionValue = () => 'plain-cluster-function';

    expect(getSnapshot(undefined)).toBeUndefined();
    expect(getSnapshot(null)).toBeNull();
    expect(getSnapshot(true)).toBe(true);
    expect(getSnapshot(false)).toBe(false);
    expect(getSnapshot(123)).toBe(123);
    expect(getSnapshot(123n)).toBe(123n);
    expect(getSnapshot('value')).toBe('value');
    expect(getSnapshot(symbolValue)).toBe(symbolValue);
    expect(getSnapshot(functionValue)).toBe(functionValue);
  });

  test('getSnapshot recursively detaches every supported container type', () => {
    const dateValue = new Date('2026-03-16T10:11:12.000Z');
    const regexValue = /preset-(cool|heat)/giu;
    const bufferValue = Buffer.from([1, 2, 3, 4]);
    const uint8Value = new Uint8Array([5, 6, 7, 8]);
    const mapKey = { room: 'kitchen', info: { zone: 1 } };
    const setObject = { stage: 'sleep', payload: { buffer: bufferValue, uint8: uint8Value } };
    const mapValue = {
      buffer: bufferValue,
      uint8: uint8Value,
      date: dateValue,
      regex: regexValue,
      set: new Set([setObject, new Map([[{ slot: 'nested-key' }, new Set([bufferValue, uint8Value, { deep: true }])]])]),
    };
    const source = {
      nil: null,
      bool: true,
      number: 42,
      bigint: 99n,
      string: 'plain snapshot',
      buffer: bufferValue,
      uint8: uint8Value,
      date: dateValue,
      regex: regexValue,
      map: new Map([[mapKey, mapValue]]),
      set: new Set([bufferValue, uint8Value, { regex: regexValue, nested: [dateValue, { copy: true }] }]),
      array: [bufferValue, uint8Value, dateValue, regexValue, new Map([['inner', new Set([{ label: 'deep-object' }, bufferValue, uint8Value])]])],
      managed: new ManagedValue('managed', {
        map: new Map([[{ level: 1 }, new Set([{ detail: 'value' }])]]),
        array: [new ManagedValue('inner', { enabled: true })],
      }),
    };

    const snapshot = getSnapshot(source);

    expect(snapshot).not.toBe(source);
    expect(snapshot).toEqual({
      nil: null,
      bool: true,
      number: 42,
      bigint: 99n,
      string: 'plain snapshot',
      buffer: Buffer.from([1, 2, 3, 4]),
      uint8: new Uint8Array([5, 6, 7, 8]),
      date: new Date('2026-03-16T10:11:12.000Z'),
      regex: /preset-(cool|heat)/giu,
      map: new Map([
        [
          { room: 'kitchen', info: { zone: 1 } },
          {
            buffer: Buffer.from([1, 2, 3, 4]),
            uint8: new Uint8Array([5, 6, 7, 8]),
            date: new Date('2026-03-16T10:11:12.000Z'),
            regex: /preset-(cool|heat)/giu,
            set: new Set([
              { stage: 'sleep', payload: { buffer: Buffer.from([1, 2, 3, 4]), uint8: new Uint8Array([5, 6, 7, 8]) } },
              new Map([[{ slot: 'nested-key' }, new Set([Buffer.from([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8]), { deep: true }])]]),
            ]),
          },
        ],
      ]),
      set: new Set([Buffer.from([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8]), { regex: /preset-(cool|heat)/giu, nested: [new Date('2026-03-16T10:11:12.000Z'), { copy: true }] }]),
      array: [
        Buffer.from([1, 2, 3, 4]),
        new Uint8Array([5, 6, 7, 8]),
        new Date('2026-03-16T10:11:12.000Z'),
        /preset-(cool|heat)/giu,
        new Map([['inner', new Set([{ label: 'deep-object' }, Buffer.from([1, 2, 3, 4]), new Uint8Array([5, 6, 7, 8])])]]),
      ],
      managed: {
        label: 'managed',
        nested: {
          map: new Map([[{ level: 1 }, new Set([{ detail: 'value' }])]]),
          array: [{ label: 'inner', nested: { enabled: true } }],
        },
      },
    });

    expect(Buffer.isBuffer(snapshot.buffer)).toBe(true);
    expect(snapshot.buffer).not.toBe(bufferValue);
    expect(snapshot.buffer.equals(bufferValue)).toBe(true);
    expect(snapshot.uint8).toBeInstanceOf(Uint8Array);
    expect(snapshot.uint8).not.toBe(uint8Value);
    expect(Array.from(snapshot.uint8)).toEqual(Array.from(uint8Value));
    expect(snapshot.date).toBeInstanceOf(Date);
    expect(snapshot.date).not.toBe(dateValue);
    expect(snapshot.date.getTime()).toBe(dateValue.getTime());
    expect(snapshot.regex).toBeInstanceOf(RegExp);
    expect(snapshot.regex).not.toBe(regexValue);
    expect(snapshot.regex.source).toBe(regexValue.source);
    expect(snapshot.regex.flags).toBe(regexValue.flags);

    expect(snapshot.map).toBeInstanceOf(Map);
    expect(snapshot.map).not.toBe(source.map);
    const [[snapshotMapKey, snapshotMapValue]] = Array.from(snapshot.map.entries()) as [Record<string, unknown>, Record<string, unknown>][];
    expect(snapshotMapKey).not.toBe(mapKey);
    expect(Object.getPrototypeOf(snapshotMapKey)).toBe(Object.prototype);
    expect(snapshotMapValue).not.toBe(mapValue);

    const snapshotMapSet = snapshotMapValue.set as Set<unknown>;
    expect(snapshotMapSet).toBeInstanceOf(Set);
    const [snapshotSetObject, snapshotNestedMap] = Array.from(snapshotMapSet);
    expect(snapshotSetObject).not.toBe(setObject);
    expect(snapshotNestedMap).toBeInstanceOf(Map);
    const [[snapshotNestedMapKey, snapshotNestedMapSet]] = Array.from((snapshotNestedMap as Map<unknown, unknown>).entries());
    expect(Object.getPrototypeOf(snapshotNestedMapKey as object)).toBe(Object.prototype);
    expect(snapshotNestedMapSet).toBeInstanceOf(Set);

    expect(snapshot.set).toBeInstanceOf(Set);
    expect(snapshot.set).not.toBe(source.set);
    expect(snapshot.array).toBeInstanceOf(Array);
    expect(snapshot.array).not.toBe(source.array);

    expect(snapshot.managed).not.toBeInstanceOf(ManagedValue);
    expect(Object.getPrototypeOf(snapshot.managed)).toBe(Object.prototype);
    expect((snapshot.managed as unknown as Record<string, unknown>).upperLabel).toBeUndefined();

    const snapshotManaged = snapshot.managed as { label: string; nested: { array: Array<Record<string, unknown>> } };
    expect(snapshotManaged.nested.array[0]).not.toBeInstanceOf(ManagedValue);
    expect(Object.getPrototypeOf(snapshotManaged.nested.array[0])).toBe(Object.prototype);
  });

  test('getCluster setCluster helper', async () => {
    device = new MatterbridgeEndpoint(temperatureSensor, { id: 'TestEndpoint' });
    device.createDefaultTemperatureMeasurementClusterServer(2200, 1000, 5000);
    device.addRequiredClusterServers();
    expect(device.hasClusterServer('TemperatureMeasurement')).toBe(true);

    const cluster = getCluster(device, 'TemperatureMeasurement', log);
    expect(cluster).toBeUndefined();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`getCluster ${hk}TemperatureMeasurement${er} error:`));
    jest.clearAllMocks();

    const behavior = device.getCluster(TemperatureMeasurementServer, log);
    expect(behavior).toBeUndefined();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`getCluster ${hk}TemperatureMeasurement${er} error:`));
    jest.clearAllMocks();

    const cluster0 = await device.setCluster('TemperatureMeasurement', { measuredValue: 2000 }, log);
    expect(cluster0).toBeFalsy();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`setCluster ${hk}TemperatureMeasurement${er} error:`));

    await addDevice(aggregator, device);

    expect(await device.setCluster(TemperatureMeasurementServer, { measuredValue: 1900, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 }, log)).toBe(true);
    const behavior1 = device.getCluster(TemperatureMeasurementServer, log);
    expect(behavior1?.measuredValue).toBe(1900);
    expect(behavior1).toMatchObject({ measuredValue: 1900, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    jest.clearAllMocks();

    expect(await device.setCluster(TemperatureMeasurement.Cluster, { measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 }, log)).toBe(true);
    const clustertype = device.getCluster(TemperatureMeasurement.Cluster, log);
    expect(clustertype?.measuredValue).toBe(2000);
    expect(clustertype).toMatchObject({ measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    jest.clearAllMocks();

    const cluster1 = getCluster(device, 'NonExistentCluster', log);
    expect(cluster1).toBeUndefined();
    expect(device.log.error).toHaveBeenCalledWith(`getCluster error: cluster not found on endpoint ${or}${device.maybeId}${er}:${or}${device.maybeNumber}${er}`);

    const cluster2 = await setCluster(device, 'NonExistentCluster', { measuredValue: 2000 }, log);
    expect(cluster2).toBeFalsy();
    expect(device.log.error).toHaveBeenCalledWith(`setCluster error: cluster not found on endpoint ${or}${device.maybeId}${er}:${or}${device.maybeNumber}${er}`);

    const cluster3 = device.getCluster('TemperatureMeasurement', log);
    expect(cluster3).toMatchObject({ measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    expect(Object.getPrototypeOf(cluster3)).toBe(Object.prototype);
    expect(device.log.info).toHaveBeenCalledWith(expect.stringContaining(`${db}Get endpoint ${or}${device.id}${db}:${or}${device.number}${db} cluster`));

    const cluster4 = await device.setCluster('TemperatureMeasurement', { measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 }, log);
    expect(cluster4).toBeTruthy();
    expect(device.log.info).toHaveBeenCalledWith(expect.stringContaining(`${db}Set endpoint ${or}${device.id}${db}:${or}${device.number}${db} cluster`));

    const cluster5 = getCluster(device, 'TemperatureMeasurement', log);
    expect(cluster5).toMatchObject({ measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    expect(device.log.info).toHaveBeenCalledWith(expect.stringContaining(`${db}Get endpoint ${or}${device.id}${db}:${or}${device.number}${db} cluster`));
  });
});
