// src/speaker.test.ts

const MATTER_PORT = 8015;
const NAME = 'Speaker';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { OnOff, LevelControl } from '@matter/types/clusters';

// helpers
import { addDevice, aggregator, createTestEnvironment, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';

import { Speaker } from './speaker.js';

// Setup the test environment
setupTest(NAME, true);

// Setup the Matter test environment
createTestEnvironment(NAME);

describe('Matterbridge ' + NAME, () => {
  let device: Speaker;

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  test('create and start server node', async () => {
    await startServerNode(NAME, MATTER_PORT);
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
    expect(custom.getClusterServerOptions(OnOff.Cluster.id)).toEqual({ 'onOff': false });
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
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId) => {
      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);
      attributes.push({ clusterName, clusterId, attributeName, attributeId });
    });
    expect(attributes.length).toBe(28);
    expect(attributes).toEqual([
      {
        'attributeId': 65533,
        'attributeName': 'clusterRevision',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 65532,
        'attributeName': 'featureMap',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 0,
        'attributeName': 'deviceTypeList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 1,
        'attributeName': 'serverList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 2,
        'attributeName': 'clientList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 3,
        'attributeName': 'partsList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 65531,
        'attributeName': 'attributeList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 65529,
        'attributeName': 'acceptedCommandList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 65528,
        'attributeName': 'generatedCommandList',
        'clusterId': 29,
        'clusterName': 'descriptor',
      },
      {
        'attributeId': 65533,
        'attributeName': 'clusterRevision',
        'clusterId': 6,
        'clusterName': 'onOff',
      },
      {
        'attributeId': 65532,
        'attributeName': 'featureMap',
        'clusterId': 6,
        'clusterName': 'onOff',
      },
      {
        'attributeId': 0,
        'attributeName': 'onOff',
        'clusterId': 6,
        'clusterName': 'onOff',
      },
      {
        'attributeId': 65531,
        'attributeName': 'attributeList',
        'clusterId': 6,
        'clusterName': 'onOff',
      },
      {
        'attributeId': 65529,
        'attributeName': 'acceptedCommandList',
        'clusterId': 6,
        'clusterName': 'onOff',
      },
      {
        'attributeId': 65528,
        'attributeName': 'generatedCommandList',
        'clusterId': 6,
        'clusterName': 'onOff',
      },
      {
        'attributeId': 65533,
        'attributeName': 'clusterRevision',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 65532,
        'attributeName': 'featureMap',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 0,
        'attributeName': 'currentLevel',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 3,
        'attributeName': 'maxLevel',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 16,
        'attributeName': 'onOffTransitionTime',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 17,
        'attributeName': 'onLevel',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 18,
        'attributeName': 'onTransitionTime',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 19,
        'attributeName': 'offTransitionTime',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 20,
        'attributeName': 'defaultMoveRate',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 15,
        'attributeName': 'options',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 65531,
        'attributeName': 'attributeList',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 65529,
        'attributeName': 'acceptedCommandList',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
      {
        'attributeId': 65528,
        'attributeName': 'generatedCommandList',
        'clusterId': 8,
        'clusterName': 'levelControl',
      },
    ]);
  });

  test('stop server', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
