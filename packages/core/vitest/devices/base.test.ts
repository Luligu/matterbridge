/**
 * @file packages/core/vitest/devices/base.test.ts
 * @description This file contains the tests for the base device class.
 * @author Luca Liguori
 */

const NAME = 'BaseTest';
const MATTER_PORT = 8000;
const MATTER_CREATE_ONLY = true;

import { Descriptor } from '@matter/types/clusters/descriptor';
import { Groups } from '@matter/types/clusters/groups';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { ScenesManagement } from '@matter/types/clusters/scenes-management';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

import { bridge, onOffLight } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    const environment = await createTestEnvironment();
    expect(environment.vars.string('endpoint.validation')).toBe('strict');
  });

  beforeEach(() => {
    // Clear all mocks
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

  test('createTestEnvironment sets the requested endpoint validation mode', async () => {
    expect((await createTestEnvironment('off')).vars.string('endpoint.validation')).toBe('off');
    expect((await createTestEnvironment('warn')).vars.string('endpoint.validation')).toBe('warn');
    // Restore the default strict mode before the server node is created
    expect((await createTestEnvironment()).vars.string('endpoint.validation')).toBe('strict');
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, bridge.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create and add onOffLight device', async () => {
    device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight' }).createDefaultIdentifyClusterServer().createDefaultOnOffClusterServer().addRequiredClusters();
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight');
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'onOff', 'groups', 'scenesManagement']);
    expect(device.hasClusterServer(Descriptor)).toBeTruthy();
    expect(device.hasClusterServer(OnOff)).toBeTruthy();
    expect(device.hasClusterServer(LevelControl)).toBeFalsy();
    expect(device.hasClusterServer(Groups)).toBeTruthy();
    expect(device.hasClusterServer(ScenesManagement)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
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
      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'bridgedDeviceBasicInformation(0x39).acceptedCommandList(0xfff9)=[  ]',
        'bridgedDeviceBasicInformation(0x39).attributeList(0xfffb)=[ 1, 2, 3, 5, 7, 8, 9, 10, 13, 14, 15, 17, 18, 24, 65528, 65529, 65531, 65532, 65533 ]',
        'bridgedDeviceBasicInformation(0x39).clusterRevision(0xfffd)=6',
        'bridgedDeviceBasicInformation(0x39).configurationVersion(0x18)=1',
        'bridgedDeviceBasicInformation(0x39).featureMap(0xfffc)={ bridgedIcdSupport: false }',
        'bridgedDeviceBasicInformation(0x39).generatedCommandList(0xfff8)=[  ]',
        'bridgedDeviceBasicInformation(0x39).hardwareVersion(0x7)=1',
        "bridgedDeviceBasicInformation(0x39).hardwareVersionString(0x8)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).nodeLabel(0x5)='OnOffLight'",
        "bridgedDeviceBasicInformation(0x39).productLabel(0xe)='Matter Bridged Endpoint'",
        "bridgedDeviceBasicInformation(0x39).productName(0x3)='Matterbridge device'",
        "bridgedDeviceBasicInformation(0x39).productUrl(0xd)='https://matterbridge.io'",
        'bridgedDeviceBasicInformation(0x39).reachable(0x11)=true',
        "bridgedDeviceBasicInformation(0x39).serialNumber(0xf)='SN-OnOffLight'",
        'bridgedDeviceBasicInformation(0x39).softwareVersion(0x9)=1',
        "bridgedDeviceBasicInformation(0x39).softwareVersionString(0xa)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).uniqueId(0x12)='4ed1f5a7d8aa7c1778fe6d8463477f6f'",
        'bridgedDeviceBasicInformation(0x39).vendorId(0x2)=65521',
        "bridgedDeviceBasicInformation(0x39).vendorName(0x1)='Matterbridge'",
        'onOff(0x6).globalSceneControl(0x4000)=false',
        'onOff(0x6).offWaitTime(0x4002)=0',
        'onOff(0x6).onTime(0x4001)=0',
        'onOff(0x6).startUpOnOff(0x4003)=null',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 256, revision: 4 }, { deviceType: 19, revision: 3 } ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 4, 6, 29, 57, 98 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'onOff(0x6).clusterRevision(0xfffd)=6',
        'onOff(0x6).featureMap(0xfffc)={ lighting: true, deadFrontBehavior: false, offOnly: false }',
        'onOff(0x6).onOff(0x0)=false',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 16384, 16385, 16386, 16387, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2, 64, 65, 66 ]',
        'onOff(0x6).generatedCommandList(0xfff8)=[  ]',
        'groups(0x4).clusterRevision(0xfffd)=4',
        'groups(0x4).featureMap(0xfffc)={ groupNames: true }',
        'groups(0x4).nameSupport(0x0)={ groupNames: true }',
        'groups(0x4).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'groups(0x4).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3, 4, 5 ]',
        'groups(0x4).generatedCommandList(0xfff8)=[ 0, 1, 2, 3 ]',
        'scenesManagement(0x62).clusterRevision(0xfffd)=1',
        'scenesManagement(0x62).featureMap(0xfffc)={ sceneNames: true }',
        'scenesManagement(0x62).sceneTableSize(0x1)=128',
        'scenesManagement(0x62).fabricSceneInfo(0x2)=[  ]',
        'scenesManagement(0x62).attributeList(0xfffb)=[ 1, 2, 65528, 65529, 65531, 65532, 65533 ]',
        'scenesManagement(0x62).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3, 4, 5, 6, 64 ]',
        'scenesManagement(0x62).generatedCommandList(0xfff8)=[ 0, 1, 2, 3, 4, 6, 64 ]',
      ].toSorted(),
    );
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
