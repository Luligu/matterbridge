/**
 * @file packages/core/vitest/devices/dimmablePlugInUnit.test.ts
 * @description This file contains the tests for the DimmablePlugInUnit device.
 * @author Luca Liguori
 */

const NAME = 'DimmablePlugInUnit';
const MATTER_PORT = 8033;
const MATTER_CREATE_ONLY = true;

import { Groups } from '@matter/types/clusters/groups';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ScenesManagement } from '@matter/types/clusters/scenes-management';
import {
  addBridgedDevice,
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

import { DimmablePlugInUnit } from '../../src/devices/dimmablePlugInUnit.js';
import { dimmablePlugInUnit, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { featuresFor } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: DimmablePlugInUnit;
  let fullDevice: DimmablePlugInUnit;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, dimmablePlugInUnit.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a device with default options', () => {
    device = new DimmablePlugInUnit('Dimmable Plug-in Unit Test Device', 'DP123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('DimmablePlug-inUnitTestDevice-DP123456');
    expect(Array.from(device.deviceTypes.keys())).toEqual([dimmablePlugInUnit.code, powerSource.code]);

    expect(device.hasClusterServer(Identify.id)).toBe(true);
    expect(device.hasClusterServer(Groups.id)).toBe(true);
    expect(device.hasClusterServer(ScenesManagement.id)).toBe(true);
    expect(device.hasClusterServer(OnOff.id)).toBe(true);
    expect(device.hasClusterServer(LevelControl.id)).toBe(true);
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    expect(device.getClusterServerOptions(OnOff.id)).toMatchObject({ onOff: false, startUpOnOff: null });
    expect(device.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'AC Power' });
  });

  test('create a device with all options', () => {
    fullDevice = new DimmablePlugInUnit('Dimmable Plug-in Unit Full Device', 'DP000001', {
      onOff: true,
      startUpOnOff: OnOff.StartUpOnOff.On,
      currentLevel: 300,
      onLevel: 100,
      startUpCurrentLevel: 50,
      id: 'DimmablePlugInUnitFullDeviceId',
    });
    expect(fullDevice.id).toBe('DimmablePlugInUnitFullDeviceId');
    expect(Array.from(fullDevice.deviceTypes.keys())).toEqual([dimmablePlugInUnit.code, powerSource.code]);
    expect(fullDevice.hasClusterServer(LevelControl.id)).toBe(true);
    expect(fullDevice.getClusterServerOptions(OnOff.id)).toMatchObject({ onOff: true, startUpOnOff: OnOff.StartUpOnOff.On });
    expect(fullDevice.getClusterServerOptions(LevelControl.id)).toMatchObject({ currentLevel: 254, minLevel: 1, maxLevel: 254, onLevel: 100, startUpCurrentLevel: 50 });
  });

  test('add the devices', async () => {
    expect(await addDevice(server, device)).toBe(true);
    // Sibling endpoints with the same device type need a Descriptor TagList: add the second device under the aggregator
    expect(await addBridgedDevice(aggregator, fullDevice)).toBe(true);
  });

  test('check attributes after adding the devices', () => {
    expect(featuresFor(device, OnOff.id)).toMatchObject({ lighting: true });
    expect(featuresFor(fullDevice, LevelControl.id)).toMatchObject({ onOff: true, lighting: true });
    expect(device.getOnOff()).toBe(false);
    expect(device.getLevel()).toBe(254);
    expect(fullDevice.getOnOff()).toBe(true);
    // StartUpCurrentLevel (50) is applied to CurrentLevel when the endpoint starts
    expect(fullDevice.getLevel()).toBe(50);
  });

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    const list = attributes
      .map(
        ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
          `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
      )
      .toSorted();
    // TEMPORARY: fail on purpose so the CI diff prints the full forEachAttribute snapshot.
    expect(list).toEqual([]);
  });

  test('setOnOff and getOnOff', async () => {
    await device.setOnOff(true);
    expect(device.getOnOff()).toBe(true);
    await device.setOnOff(false);
    expect(device.getOnOff()).toBe(false);
  });

  test('setLevel coerces and ignores invalid values', async () => {
    await device.setLevel(100.4);
    expect(device.getLevel()).toBe(100);
    await device.setLevel(300);
    expect(device.getLevel()).toBe(254);
    await device.setLevel(0);
    expect(device.getLevel()).toBe(1);
    await device.setLevel(Number.NaN);
    expect(device.getLevel()).toBe(1);
  });

  test('remove the full device', async () => {
    expect(await deleteDevice(aggregator, fullDevice)).toBe(true);
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
