// src/castingVideoPlayer.test.ts

const MATTER_PORT = 8018;
const NAME = 'CastingVideoPlayer';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';
// @matter
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { MediaPlaybackServer } from '@matter/node/behaviors/media-playback';
import { KeypadInputServer } from '@matter/node/behaviors/keypad-input';
import { PowerSource } from '@matter/types/clusters/power-source';
import { OnOff } from '@matter/types/clusters/on-off';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { ContentLauncherServer } from '@matter/node/behaviors/content-launcher';

// Matterbridge
import { basicVideoPlayer } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { addDevice, aggregator, createTestEnvironment, deleteDevice, loggerLogSpy, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';

import { CastingVideoPlayer } from './castingVideoPlayer.js';

// Setup the test environment
await setupTest(NAME, false);

// Setup the Matter test environment
createTestEnvironment(NAME);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, basicVideoPlayer.code);
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
    await invokeBehaviorCommand(device, 'onOff', 'on', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'mediaPlayback', 'play', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Play (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'mediaPlayback', 'pause', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'mediaPlayback', 'stop', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stop (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'keypadInput', 'sendKey', { keyCode: KeypadInput.CecKeyCode.Down });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `SendKey keyCode ${KeypadInput.CecKeyCode.Down} (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'onOff', 'off', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'mediaPlayback', 'play', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Play (endpoint ${device.id}.${device.number})`);

    await invokeBehaviorCommand(device, 'mediaPlayback', 'play', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);
    await invokeBehaviorCommand(device, 'mediaPlayback', 'pause', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);
    await invokeBehaviorCommand(device, 'mediaPlayback', 'stop', {});
    expect(device.getAttribute('mediaPlayback', 'currentState')).toBe(MediaPlayback.PlaybackState.NotPlaying);
  });

  test('remove the casting video player device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
