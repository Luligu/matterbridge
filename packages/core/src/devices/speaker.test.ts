// src/speaker.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'Speaker';
const MATTER_PORT = 8015;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
// @matter
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { stringify } from 'node-ansi-logger';

// Jest utilities for Matter testing
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
} from '../jestutils/jestMatterTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { speakerDevice } from '../matterbridgeDeviceTypes.js';
import { Speaker } from './speaker.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Speaker;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, speakerDevice.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create speaker device (defaults)', async () => {
    device = new Speaker('Living Room Speaker', 'SPK123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('LivingRoomSpeaker-SPK123456');

    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LevelControl.Cluster.id)).toBeTruthy();
  });

  test('create speaker device (custom states)', async () => {
    const custom = new Speaker('Bedroom Speaker', 'SPK654321', true, 10);
    expect(custom.id).toBe('BedroomSpeaker-SPK654321');
    expect(custom.getClusterServerOptions(OnOff.Cluster.id)).toEqual({ onOff: false });
    expect(custom.getClusterServerOptions(LevelControl.Cluster.id)).toEqual({
      currentLevel: 10,
      onLevel: null,
      options: {
        coupleColorTempToLevel: false,
        executeIfOff: false,
      },
    });
  });

  test('create speaker device (volume clamping cases)', () => {
    const cases: Array<[any, number]> = [
      [NaN, 128], // not finite -> default 128
      [Infinity, 128], // not finite -> default 128
      [-5, 1], // below min -> clamp to 1
      [0, 1], // zero -> clamp to 1
      [255, 254], // above max -> clamp to 254
      [5000, 254], // far above max -> clamp to 254
    ];
    for (const [input, expected] of cases) {
      const s = new Speaker(`Clamp ${input}`, `V${expected}`, false, input as any);
      const level = s.getClusterServerOptions(LevelControl.Cluster.id) as any;
      expect(level && level.currentLevel).toBe(expected);
    }
  });

  test('add speaker to server', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('check attributes after adding speaker to server', async () => {
    expect(device.getAttribute(OnOff.Cluster.id, 'onOff')).toBe(true); // unmuted
    expect(device.getAttribute(LevelControl.Cluster.id, 'currentLevel')).toBe(128);
  });

  test('mute / volume helpers', async () => {
    // toggle mute
    await device.setMuted(true);
    expect(device.isMuted()).toBe(true);
    expect(device.getAttribute(OnOff.Cluster.id, 'onOff')).toBe(false);
    await device.setMuted(false);
    expect(device.isMuted()).toBe(false);
    expect(device.getAttribute(OnOff.Cluster.id, 'onOff')).toBe(true);

    // volume adjustments & clamping
    await device.setVolume(200);
    expect(device.getVolume()).toBe(200);
    await device.setVolume(0); // clamp to 1
    expect(device.getVolume()).toBe(1);
    await device.setVolume(9999); // clamp to 254
    expect(device.getVolume()).toBe(254);
  });

  test('setVolume ignores non-finite values (NaN branch)', async () => {
    // set to a known value
    await device.setVolume(100);
    expect(device.getVolume()).toBe(100);
    // attempt to set NaN -> should be ignored and remain 100
    await device.setVolume(NaN);
    expect(device.getVolume()).toBe(100);
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
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 34, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 6, 8, 29 ]',
        'levelControl(0x8).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3, 4, 5, 6, 7 ]',
        'levelControl(0x8).attributeList(0xfffb)=[ 0, 15, 17, 65528, 65529, 65531, 65532, 65533 ]',
        'levelControl(0x8).clusterRevision(0xfffd)=6',
        'levelControl(0x8).currentLevel(0x0)=100',
        'levelControl(0x8).featureMap(0xfffc)={ onOff: false, lighting: false, frequency: false }',
        'levelControl(0x8).generatedCommandList(0xfff8)=[  ]',
        'levelControl(0x8).onLevel(0x11)=null',
        'levelControl(0x8).options(0xf)={ executeIfOff: false, coupleColorTempToLevel: false }',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2 ]',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).clusterRevision(0xfffd)=6',
        'onOff(0x6).featureMap(0xfffc)={ lighting: false, deadFrontBehavior: false, offOnly: false }',
        'onOff(0x6).generatedCommandList(0xfff8)=[  ]',
        'onOff(0x6).onOff(0x0)=true',
      ].sort(),
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
