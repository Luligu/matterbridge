// vitest\matterbridgeEndpointHelpers.test.ts

/**
 * WARNING!!!
 * The tests in this unit are supposed to run sequentially because they depend on the Matterbridge/Matter state.
 * Is not possible for timing reasons to create and destroy a Matter node each test to keep isolation.
 */

const NAME = 'MatterbridgeEndpointHelpers';
const MATTER_PORT = 11300;
const MATTER_CREATE_ONLY = true;

import { CommonNumberTag, PowerSourceTag } from '@matter/node';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { TemperatureMeasurementServer } from '@matter/node/behaviors/temperature-measurement';
import { VendorId } from '@matter/types';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import type { ClusterId } from '@matter/types/datatype';
import { log, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { db, er, hk, or, wr } from 'node-ansi-logger';

import { MatterbridgeBindingServer } from '../src/behaviors/bindingServer.js';
import { MatterbridgeDoorLockServer } from '../src/behaviors/doorLockServer.js';
import { closureController, doorLock, irrigationSystem, temperatureSensor } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
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
  getDefaultSoilMeasurementClusterServer,
  getDefaultTemperatureMeasurementClusterServer,
  getSemtag,
  getSnapshot,
  internalFor,
  setCluster,
} from '../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Options helpers', () => {
  let device: MatterbridgeEndpoint;

  class ManagedValue {
    constructor(
      public label: string,
      public nested: unknown,
    ) {}

    get upperLabel(): string {
      return this.label.toUpperCase();
    }
  }

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('getSemtag helper', () => {
    expect(getSemtag(PowerSourceTag.Solar)).toEqual({ mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Solar.tag });
    expect(getSemtag(CommonNumberTag.TwentyFour, 'My Label')).toEqual({
      label: 'My Label',
      mfgCode: null,
      namespaceId: CommonNumberTag.TwentyFour.namespaceId,
      tag: CommonNumberTag.TwentyFour.tag,
    });
    expect(getSemtag(CommonNumberTag.One, 'My Label', VendorId(12))).toEqual({
      label: 'My Label',
      mfgCode: 12,
      namespaceId: 7,
      tag: 1,
    });
    expect(getSemtag(CommonNumberTag.One, '   0123456789012345678901234567890123456789012345678901234567890123456789   ', VendorId(12))).toEqual({
      label: '0123456789012345678901234567890123456789012345678901234567890123', // Label should be trimmed to 64 characters
      mfgCode: 12,
      namespaceId: 7,
      tag: 1,
    });
    expect(CommonNumberTag.Two).toEqual({ label: 'Two', mfgCode: null, namespaceId: 7, tag: 2 });
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
    expect(getDefaultSoilMeasurementClusterServer()).toBeDefined();
  });

  test('internalFor returns the live behavior internal state for every overload shape', async () => {
    device = new MatterbridgeEndpoint(doorLock, { id: 'DoorLockHelper' });
    device.behaviors.require(
      MatterbridgeDoorLockServer.with().enable({
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

    expect(await internalFor(device, 'UnknownBehavior')).toBeUndefined();

    const internalFromBehavior = await internalFor(device, MatterbridgeDoorLockServer);
    expect(internalFromBehavior).toBeDefined();
    if (!internalFromBehavior) throw new Error('MatterbridgeDoorLockServer internal state not found');

    // expect(internalFromBehavior.enableTimeout).toBe(true);

    const internalFromCluster = await internalFor(device, DoorLock);
    const internalFromClusterId = await internalFor(device, DoorLock.id);
    const internalFromString = await internalFor(device, 'DoorLock');

    expect(internalFromCluster).toBe(internalFromBehavior);
    expect(internalFromClusterId).toBe(internalFromBehavior);
    expect(internalFromString).toBe(internalFromBehavior);

    /*
    internalFromBehavior.enableTimeout = false;

    expect((await internalFor(device, MatterbridgeDoorLockServer))?.enableTimeout).toBe(false);
    expect((await internalFor(device, DoorLock))?.enableTimeout).toBe(false);
    expect((await internalFor(device, DoorLock.id))?.enableTimeout).toBe(false);
    expect((await internalFor(device, 'DoorLock'))?.enableTimeout).toBe(false);
    */
  });

  test('getSnapshot returns non-object values unchanged', () => {
    const symbolValue = Symbol('plain-cluster-symbol');
    const functionValue = (): string => 'plain-cluster-function';

    // @ts-expect-error: Testing getSnapshot with various types, including null and undefined
    expect(getSnapshot()).toBeUndefined();
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
    vi.clearAllMocks();

    const behavior = device.getCluster(TemperatureMeasurementServer, log);
    expect(behavior).toBeUndefined();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`getCluster ${hk}TemperatureMeasurement${er} error:`));
    vi.clearAllMocks();

    const cluster0 = await device.setCluster('TemperatureMeasurement', { measuredValue: 2000 }, log);
    expect(cluster0).toBeFalsy();
    expect(device.log.error).toHaveBeenCalledWith(expect.stringContaining(`setCluster ${hk}TemperatureMeasurement${er} error:`));

    await addDevice(aggregator, device);

    expect(await device.setCluster(TemperatureMeasurementServer, { measuredValue: 1900, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 }, log)).toBe(true);
    const behavior1 = device.getCluster(TemperatureMeasurementServer, log);
    expect(behavior1?.measuredValue).toBe(1900);
    expect(behavior1).toMatchObject({ measuredValue: 1900, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    vi.clearAllMocks();

    expect(await device.setCluster(TemperatureMeasurement, { measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 }, log)).toBe(true);
    const clustertype = device.getCluster(TemperatureMeasurement, log);
    expect(clustertype?.measuredValue).toBe(2000);
    expect(clustertype).toMatchObject({ measuredValue: 2000, minMeasuredValue: 0, maxMeasuredValue: 6000, tolerance: 100 });
    vi.clearAllMocks();

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

  test('addClusterClients with empty list is a no-op', async () => {
    device = new MatterbridgeEndpoint(doorLock, { id: 'ClusterClientsEmpty' });
    device.addClusterClients([]);
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBeFalsy();
    await addDevice(aggregator, device);
    expect(device.stateOf(DescriptorServer).clientList).toHaveLength(0);
  });

  test('addClusterClients with unknown cluster log message', async () => {
    device = new MatterbridgeEndpoint(doorLock, { id: 'ClusterClientsUnknown' });
    device.addClusterClients([0xffff as ClusterId]);
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBeTruthy();
    await addDevice(aggregator, device);
    expect(device.stateOf(DescriptorServer).clientList).toHaveLength(1);
    expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`addClusterClients: no client behavior found for clusterId ${hk}0xffff${wr}`));
  });

  test('addClusterClients called twice merges clientList without duplicates', async () => {
    device = new MatterbridgeEndpoint(doorLock, { id: 'ClusterClientsMerge' });
    device.addClusterClients([ClosureControl.id]);
    device.addClusterClients([FlowMeasurement.id, ClosureControl.id]);
    await addDevice(aggregator, device);
    const clientList = device.stateOf(DescriptorServer).clientList;
    expect(clientList).toContain(ClosureControl.id);
    expect(clientList).toContain(FlowMeasurement.id);
    expect(clientList.filter((id) => id === ClosureControl.id)).toHaveLength(1);
  });

  test('addRequiredClusterClients requires MatterbridgeBindingServer for device types with required client clusters', async () => {
    device = new MatterbridgeEndpoint(closureController, { id: 'ClusterClientsRequired' });
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBeFalsy();
    device.addRequiredClusterClients();
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBe(true);
    await addDevice(aggregator, device);
    expect(device.stateOf(DescriptorServer).clientList).toContain(ClosureControl.id);
  });

  test('addOptionalClusterClients requires MatterbridgeBindingServer for device types with optional client clusters', async () => {
    device = new MatterbridgeEndpoint(irrigationSystem, { id: 'ClusterClientsOptional' });
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBeFalsy();
    device.addOptionalClusterClients();
    expect(device.behaviors.has(MatterbridgeBindingServer)).toBe(true);
    await addDevice(aggregator, device);
    expect(device.stateOf(DescriptorServer).clientList).toContain(FlowMeasurement.id);
  });
});
