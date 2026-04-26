// src/castingVideoPlayer.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'CastingVideoPlayer';
const MATTER_PORT = 8018;
const MATTER_CREATE_ONLY = true;

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
import { LogLevel, stringify } from 'node-ansi-logger';

// Jest utilities for Matter testing
import {
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
} from '../jestutils/jestMatterTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerLogSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { castingVideoPlayer } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { CastingVideoPlayer } from './castingVideoPlayer.js';

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
    await createServerNode(MATTER_PORT, castingVideoPlayer.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

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
        'contentLauncher(0x50a).acceptedCommandList(0xfff9)=[  ]',
        'contentLauncher(0x50a).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'contentLauncher(0x50a).clusterRevision(0xfffd)=2',
        'contentLauncher(0x50a).featureMap(0xfffc)={ contentSearch: false, urlPlayback: false, advancedSeek: false, textTracks: false, audioTracks: false }',
        'contentLauncher(0x50a).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 35, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 6, 29, 47, 1286, 1289, 1290 ]',
        'keypadInput(0x509).acceptedCommandList(0xfff9)=[ 0 ]',
        'keypadInput(0x509).attributeList(0xfffb)=[ 65528, 65529, 65531, 65532, 65533 ]',
        'keypadInput(0x509).clusterRevision(0xfffd)=1',
        'keypadInput(0x509).featureMap(0xfffc)={ navigationKeyCodes: false, locationKeys: false, numberKeys: false }',
        'keypadInput(0x509).generatedCommandList(0xfff8)=[ 1 ]',
        'mediaPlayback(0x506).acceptedCommandList(0xfff9)=[ 0, 1, 2, 4, 5, 8, 9 ]',
        'mediaPlayback(0x506).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'mediaPlayback(0x506).clusterRevision(0xfffd)=2',
        'mediaPlayback(0x506).currentState(0x0)=2',
        'mediaPlayback(0x506).featureMap(0xfffc)={ advancedSeek: false, variableSpeed: false, textTracks: false, audioTracks: false, audioAdvance: false }',
        'mediaPlayback(0x506).generatedCommandList(0xfff8)=[ 10 ]',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2 ]',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).clusterRevision(0xfffd)=6',
        'onOff(0x6).featureMap(0xfffc)={ lighting: false, deadFrontBehavior: false, offOnly: false }',
        'onOff(0x6).generatedCommandList(0xfff8)=[  ]',
        'onOff(0x6).onOff(0x0)=false',
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
      ].toSorted(),
    );
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
