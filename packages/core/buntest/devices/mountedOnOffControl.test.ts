/**
 * @file packages/core/buntest/devices/mountedOnOffControl.test.ts
 * @description This file contains the tests for the MountedOnOffControl device.
 * @author Luca Liguori
 */

const NAME = 'MountedOnOffControl';
const MATTER_PORT = 8034;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';

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
} from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { stringify } from 'node-ansi-logger';

import { MountedOnOffControl } from '../../src/devices/mountedOnOffControl.js';
import { mountedOnOffControl, onOffPlugInUnit, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { featuresFor } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MountedOnOffControl;
  let fullDevice: MountedOnOffControl;

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
    await createServerNode(MATTER_PORT, mountedOnOffControl.code, 0, 0, 0);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a device with default options', () => {
    device = new MountedOnOffControl('Mounted On Off Control Test Device', 'MO123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('MountedOnOffControlTestDevice-MO123456');
    expect(Array.from(device.deviceTypes.keys())).toEqual([mountedOnOffControl.code, onOffPlugInUnit.code, powerSource.code]);

    expect(device.hasClusterServer(Identify.id)).toBe(true);
    expect(device.hasClusterServer(Groups.id)).toBe(true);
    expect(device.hasClusterServer(ScenesManagement.id)).toBe(true);
    expect(device.hasClusterServer(OnOff.id)).toBe(true);
    expect(device.hasClusterServer(LevelControl.id)).toBe(false);
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);

    expect(device.getClusterServerOptions(OnOff.id)).toMatchObject({ onOff: false, startUpOnOff: null });
    expect(device.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'AC Power' });
  });

  test('create a device with all options', () => {
    fullDevice = new MountedOnOffControl('Mounted On Off Control Full Device', 'MO000001', {
      onOff: true,
      startUpOnOff: OnOff.StartUpOnOff.On,
      currentLevel: 300,
      onLevel: 100,
      startUpCurrentLevel: 50,
      levelControl: true,
      plugInUnitDeviceType: false,
      id: 'MountedOnOffControlFullDeviceId',
    });
    expect(fullDevice.id).toBe('MountedOnOffControlFullDeviceId');
    expect(Array.from(fullDevice.deviceTypes.keys())).toEqual([mountedOnOffControl.code, powerSource.code]);
    expect(fullDevice.hasClusterServer(LevelControl.id)).toBe(true);
    expect(fullDevice.getClusterServerOptions(OnOff.id)).toMatchObject({ onOff: true, startUpOnOff: OnOff.StartUpOnOff.On });
    expect(fullDevice.getClusterServerOptions(LevelControl.id)).toMatchObject({ currentLevel: 254, minLevel: 1, maxLevel: 254, onLevel: 100, startUpCurrentLevel: 50 });
  });

  test('add the devices', async () => {
    expect(await addDevice(server, device, 0, 0, 0, 0)).toBe(true);
    // Sibling endpoints with the same device type need a Descriptor TagList: add the second device under the aggregator
    expect(await addBridgedDevice(aggregator, fullDevice, 0, 0, 0, 0)).toBe(true);
  });

  test('check attributes after adding the devices', () => {
    expect(featuresFor(device, OnOff.id)).toMatchObject({ lighting: true });
    expect(featuresFor(fullDevice, LevelControl.id)).toMatchObject({ onOff: true, lighting: true });
    expect(device.getOnOff()).toBe(false);
    expect(device.getLevel()).toBeUndefined();
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
    expect(list).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 271, revision: 3 }, { deviceType: 266, revision: 5 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 4, 6, 29, 47, 98 ]',
        'groups(0x4).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3, 4, 5 ]',
        'groups(0x4).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'groups(0x4).clusterRevision(0xfffd)=4',
        'groups(0x4).featureMap(0xfffc)={ groupNames: true }',
        'groups(0x4).generatedCommandList(0xfff8)=[ 0, 1, 2, 3 ]',
        'groups(0x4).nameSupport(0x0)={ groupNames: true }',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2, 64, 65, 66 ]',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 16384, 16385, 16386, 16387, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).clusterRevision(0xfffd)=6',
        'onOff(0x6).featureMap(0xfffc)={ lighting: true, deadFrontBehavior: false, offOnly: false }',
        'onOff(0x6).generatedCommandList(0xfff8)=[  ]',
        'onOff(0x6).globalSceneControl(0x4000)=false',
        'onOff(0x6).offWaitTime(0x4002)=0',
        'onOff(0x6).onOff(0x0)=false',
        'onOff(0x6).onTime(0x4001)=0',
        'onOff(0x6).startUpOnOff(0x4003)=null',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'scenesManagement(0x62).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3, 4, 5, 6, 64 ]',
        'scenesManagement(0x62).attributeList(0xfffb)=[ 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'scenesManagement(0x62).clusterRevision(0xfffd)=1',
        'scenesManagement(0x62).fabricSceneInfo(0x2)=[  ]',
        'scenesManagement(0x62).featureMap(0xfffc)={ sceneNames: true }',
        'scenesManagement(0x62).generatedCommandList(0xfff8)=[ 0, 1, 2, 3, 4, 6, 64 ]',
        'scenesManagement(0x62).sceneTableSize(0x1)=128',
      ].toSorted(),
    );
  });

  test('setOnOff and getOnOff', async () => {
    await device.setOnOff(true);
    expect(device.getOnOff()).toBe(true);
    await device.setOnOff(false);
    expect(device.getOnOff()).toBe(false);
  });

  test('setLevel coerces and ignores invalid values', async () => {
    await fullDevice.setLevel(100.4);
    expect(fullDevice.getLevel()).toBe(100);
    await fullDevice.setLevel(300);
    expect(fullDevice.getLevel()).toBe(254);
    await fullDevice.setLevel(0);
    expect(fullDevice.getLevel()).toBe(1);
    await fullDevice.setLevel(Number.NaN);
    expect(fullDevice.getLevel()).toBe(1);
    // Without the Level Control cluster setLevel is ignored
    await device.setLevel(100);
    expect(device.getLevel()).toBeUndefined();
  });

  test('remove the full device', async () => {
    expect(await deleteDevice(aggregator, fullDevice, 0, 0, 0, 0)).toBe(true);
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode(0, 0, 0, 0);
    else await stopServerNode();
  });
});
