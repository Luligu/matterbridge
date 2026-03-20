// src/castingVideoPlayer.test.ts

const MATTER_PORT = 8018;
const NAME = 'CastingVideoPlayer';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { ContentLauncherServer } from '@matter/node/behaviors/content-launcher';
import { KeypadInputServer } from '@matter/node/behaviors/keypad-input';
import { MediaPlaybackServer } from '@matter/node/behaviors/media-playback';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { LogLevel } from 'node-ansi-logger';

// Matterbridge
import {
  addDevice,
  aggregator,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  loggerLogSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestHelpers.js';
import { castingVideoPlayer } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { CastingVideoPlayer } from './castingVideoPlayer.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment(MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, castingVideoPlayer.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a casting video player device', async () => {
    device = new CastingVideoPlayer('CastingVideoPlayer Test Device', 'CVP123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('CastingVideoPlayerTestDevice-CVP123456');
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(MediaPlayback.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(KeypadInput.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ContentLauncher.Cluster.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'powerSource', 'onOff', 'mediaPlayback', 'keypadInput', 'contentLauncher']);
  });

  test('add a casting video player device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
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
    expect(attributes.length).toBe(49);
  });

  test('invoke commands', async () => {
    expect(device.behaviors.has(MediaPlaybackServer)).toBeTruthy();
    expect(device.behaviors.has(KeypadInputServer)).toBeTruthy();
    expect(device.behaviors.has(ContentLauncherServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(MediaPlaybackServer).commands.has('play')).toBeTruthy();
    expect(device.behaviors.elementsOf(MediaPlaybackServer).commands.has('pause')).toBeTruthy();
    expect(device.behaviors.elementsOf(MediaPlaybackServer).commands.has('stop')).toBeTruthy();
    expect(device.behaviors.elementsOf(KeypadInputServer).commands.has('sendKey')).toBeTruthy();
    expect((device as any).state['mediaPlayback'].acceptedCommandList).toEqual([0, 1, 2, 4, 5, 8, 9]);
    expect((device as any).state['mediaPlayback'].generatedCommandList).toEqual([0xa]);
    expect((device as any).state['keypadInput'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['keypadInput'].generatedCommandList).toEqual([1]);
    expect((device as any).state['contentLauncher'].acceptedCommandList).toEqual([]);
    expect((device as any).state['contentLauncher'].generatedCommandList).toEqual([]);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('onOff', 'on', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.play', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Play (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.pause', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.stop', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stop (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('keypadInput', 'KeypadInput.sendKey', { keyCode: KeypadInput.CecKeyCode.Down });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `SendKey keyCode ${KeypadInput.CecKeyCode.Down} (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('onOff', 'OnOff.off', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);

    jest.clearAllMocks();
    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.play', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Play (endpoint ${device.id}.${device.number})`);

    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.play', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);
    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.pause', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);
    await device.invokeBehaviorCommand('mediaPlayback', 'MediaPlayback.stop', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);
  });

  test('remove the casting video player device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
