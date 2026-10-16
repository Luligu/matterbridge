/**
 * @file packages/core/buntest/devices/audioDoorbell.test.ts
 * @description This file contains the tests for the AudioDoorbell device.
 * @author Luca Liguori
 */

const NAME = 'AudioDoorbellDevice';
const MATTER_PORT = 6008;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { ChimeClient } from '@matter/node/behaviors/chime';
import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Chime } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Switch } from '@matter/types/clusters/switch';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import { StreamUsage } from '@matter/types/globals';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/buntest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { stringify } from 'node-ansi-logger';

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { MatterbridgeWebRtcTransportProviderServer } from '../../src/behaviors/webRtcTransportProviderServer.js';
import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import { AudioDoorbell } from '../../src/devices/audioDoorbell.js';

// Setup the test environment
await setupTest(NAME, false);

describe('AudioDoorbell', () => {
  let defaultDevice: AudioDoorbell;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT, undefined, 0, 0, 0);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // No errors logged during tests
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode(0, 0, 0, 0);
    else await stopServerNode();
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should create an audio doorbell device with default options', async () => {
    const device = new AudioDoorbell('Audio Doorbell Default', 'AUDIO-DOORBELL-DEFAULT');
    expect(device.id).toBe('AudioDoorbellDefault-AUDIO-DOORBELL-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Switch.id)).toBeTruthy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    // The required Chime and WebRtcTransportRequestor client clusters are added automatically and should not
    // trigger a "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([Chime.id, WebRtcTransportRequestor.id]);
    expect(device.type.clientClusters['chime']).toBe(ChimeClient);
    expect(device.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Switch, 'numberOfPositions')).toBe(2);
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(65_536);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(128_000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
    // A default audio stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    expect(device.getAttribute(CameraAvStreamManagement, 'microphoneCapabilities')).toEqual({
      maxNumberOfChannels: 1,
      supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus],
      supportedSampleRates: [48000],
      supportedBitDepths: [16],
    });
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new AudioDoorbell('Audio Doorbell Snapshot', 'AUDIO-DOORBELL-SNAPSHOT');
    expect(await addDevice(aggregator, defaultDevice, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should expose the expected attributes on the device', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    defaultDevice.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'binding(0x1e).acceptedCommandList(0xfff9)=[  ]',
        'binding(0x1e).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'binding(0x1e).binding(0x0)=[  ]',
        'binding(0x1e).clusterRevision(0xfffd)=1',
        'binding(0x1e).featureMap(0xfffc)={  }',
        'binding(0x1e).generatedCommandList(0xfff8)=[  ]',
        'cameraAvStreamManagement(0x551).acceptedCommandList(0xfff9)=[ 0, 2, 11 ]',
        'cameraAvStreamManagement(0x551).allocatedAudioStreams(0x10)=[ { audioStreamId: 0, streamUsage: 3, audioCodec: 0, channelCount: 1, sampleRate: 48000, bitRate: 32000, bitDepth: 16, referenceCount: 0 } ]',
        'cameraAvStreamManagement(0x551).attributeList(0xfffb)=[ 6, 7, 11, 14, 16, 18, 21, 29, 30, 31, 32, 33, 39, 65528, 65529, 65531, 65532, 65533 ]',
        'cameraAvStreamManagement(0x551).clusterRevision(0xfffd)=2',
        'cameraAvStreamManagement(0x551).featureMap(0xfffc)={ audio: true, video: false, snapshot: false, privacy: false, speaker: false, imageControl: false, watermark: false, onScreenDisplay: false, localStorage: false, highDynamicRange: false, nightVision: false }',
        'cameraAvStreamManagement(0x551).generatedCommandList(0xfff8)=[ 1 ]',
        'cameraAvStreamManagement(0x551).hardPrivacyModeOn(0x15)=false',
        'cameraAvStreamManagement(0x551).maxContentBufferSize(0x6)=65536',
        'cameraAvStreamManagement(0x551).maxNetworkBandwidth(0xb)=128000',
        'cameraAvStreamManagement(0x551).microphoneAgcEnabled(0x21)=false',
        'cameraAvStreamManagement(0x551).microphoneCapabilities(0x7)={ maxNumberOfChannels: 1, supportedCodecs: [ 0 ], supportedSampleRates: [ 48000 ], supportedBitDepths: [ 16 ] }',
        'cameraAvStreamManagement(0x551).microphoneMaxLevel(0x1f)=254',
        'cameraAvStreamManagement(0x551).microphoneMinLevel(0x20)=0',
        'cameraAvStreamManagement(0x551).microphoneMuted(0x1d)=false',
        'cameraAvStreamManagement(0x551).microphoneVolumeLevel(0x1e)=128',
        'cameraAvStreamManagement(0x551).statusLightEnabled(0x27)=false',
        'cameraAvStreamManagement(0x551).streamUsagePriorities(0x12)=[ 3 ]',
        'cameraAvStreamManagement(0x551).supportedStreamUsages(0xe)=[ 3 ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1364, 1366 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 321, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 30, 47, 59, 1361, 1363 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 3 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'switch(0x3b).acceptedCommandList(0xfff9)=[  ]',
        'switch(0x3b).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'switch(0x3b).clusterRevision(0xfffd)=2',
        'switch(0x3b).currentPosition(0x1)=0',
        'switch(0x3b).featureMap(0xfffc)={ latchingSwitch: false, momentarySwitch: true, momentarySwitchRelease: false, momentarySwitchLongPress: false, momentarySwitchMultiPress: false, actionSwitch: false }',
        'switch(0x3b).generatedCommandList(0xfff8)=[  ]',
        'switch(0x3b).numberOfPositions(0x0)=2',
        'webRtcTransportProvider(0x553).acceptedCommandList(0xfff9)=[ 0, 2, 4, 5, 6 ]',
        'webRtcTransportProvider(0x553).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'webRtcTransportProvider(0x553).clusterRevision(0xfffd)=2',
        'webRtcTransportProvider(0x553).currentSessions(0x0)=[  ]',
        'webRtcTransportProvider(0x553).featureMap(0xfffc)={ metadata: false }',
        'webRtcTransportProvider(0x553).generatedCommandList(0xfff8)=[ 1, 3 ]',
      ].toSorted(),
    );
  });

  it('should create an audio doorbell device with custom identify options', async () => {
    const device = new AudioDoorbell('Audio Doorbell Identify', 'AUDIO-DOORBELL-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create an audio doorbell device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new AudioDoorbell(`Audio Doorbell ${powerSourceType}`, `AUDIO-DOORBELL-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create an audio doorbell device with no power source', async () => {
    const device = new AudioDoorbell('Audio Doorbell None', 'AUDIO-DOORBELL-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should trigger a single press switch event', async () => {
    const device = new AudioDoorbell('Audio Doorbell Press', 'AUDIO-DOORBELL-PRESS', { powerSourceType: 'None' });
    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();

    expect(await device.triggerSwitchEvent('Single', device.log)).toBeTruthy();
    expect(device.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create an audio doorbell device with custom stream usages', async () => {
    const device = new AudioDoorbell('Audio Doorbell Custom', 'AUDIO-DOORBELL-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities: [StreamUsage.LiveView, StreamUsage.Recording],
    });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
  });

  it('should create an audio doorbell device with custom werift offer options', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { offerVideo: false, offerAudio: true, videoSource: 'none', audioSource: 'test' };
    const device = new AudioDoorbell('Audio Doorbell Werift', 'AUDIO-DOORBELL-WERIFT', { weriftOfferOptions });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });
});
