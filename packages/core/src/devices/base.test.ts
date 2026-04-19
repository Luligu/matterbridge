// src\base.test.ts

const NAME = 'BaseTest';
const MATTER_PORT = 8000;

import { jest } from '@jest/globals';
import { Descriptor } from '@matter/types/clusters/descriptor';
import { Groups } from '@matter/types/clusters/groups';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { ScenesManagement } from '@matter/types/clusters/scenes-management';
import { stringify } from 'node-ansi-logger';

// Jest utilities for Matter testing
import { addDevice, aggregator, createServerNode, createTestEnvironment, destroyTestEnvironment, server, startServerNode, stopServerNode } from '../jestutils/jestMatterTest.js';
import { setupTest } from '../jestutils/jestSetupTest.js';
// Matterbridge
import { bridge, onOffLight } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, bridge.code, 0, 0, 0);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create and add onOffLight device', async () => {
    device = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight' }).createDefaultIdentifyClusterServer().createOnOffClusterServer().addRequiredClusterServers();
    expect(device).toBeDefined();
    expect(device.id).toBe('OnOffLight');
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'onOff', 'groups', 'scenesManagement']);
    expect(device.hasClusterServer(Descriptor.Cluster)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster)).toBeTruthy();
    expect(device.hasClusterServer(LevelControl.Cluster)).toBeFalsy();
    expect(device.hasClusterServer(Groups.Cluster)).toBeTruthy();
    expect(device.hasClusterServer(ScenesManagement.Cluster)).toBeTruthy();
    await addDevice(aggregator, device, 0);
  });

  test('device forEachAttribute', async () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;

      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');
      expect(clusterName.length).toBeGreaterThanOrEqual(1);

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');
      expect(attributeName.length).toBeGreaterThanOrEqual(1);

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);

      // Sort arrays for consistent snapshot testing
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = Array.from(attributeValue as number[]).sort((a, b) => a - b);
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
        .sort(),
    ).toEqual(
      [
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 256, revision: 3 } ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 4, 6, 29, 98 ]',
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
        'onOff(0x6).featureMap(0xfffc)={ lighting: false, deadFrontBehavior: false, offOnly: false }',
        'onOff(0x6).onOff(0x0)=false',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2 ]',
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
      ].sort(),
    );
  });

  test('start the server node', async () => {
    await startServerNode(0, 0, 0);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    await stopServerNode(0, 0, 0);
  });
});
