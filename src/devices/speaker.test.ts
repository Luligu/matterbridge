// src/speaker.test.ts
// Tests the Speaker device with simple constructor parameters (no options object).

const MATTER_PORT = 6032;
const NAME = 'Speaker';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/general';
import { DeviceTypeId, VendorId } from '@matter/types';
import { MdnsService } from '@matter/protocol';
import { ServerNode, Endpoint, PositionTag } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { OnOff, LevelControl } from '@matter/types/clusters';

// helpers
import { addDevice, createTestEnvironment, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { Speaker } from './speaker.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: Speaker;

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
  });

  test('create and start server node', async () => {
    [server, aggregator] = await startServerNode(NAME, MATTER_PORT);
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
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(29);
  });

  test('stop server', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
