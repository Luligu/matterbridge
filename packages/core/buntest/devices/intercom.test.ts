/**
 * @file packages/core/buntest/devices/intercom.test.ts
 * @description This file contains the tests for the Intercom device.
 * @author Luca Liguori
 */

const NAME = 'IntercomDevice';
const MATTER_PORT = 6010;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { ChimeClient } from '@matter/node/behaviors/chime';
import { WebRtcTransportProviderClient } from '@matter/node/behaviors/web-rtc-transport-provider';
import { WebRtcTransportRequestorClient, WebRtcTransportRequestorServer } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Chime } from '@matter/types/clusters/chime';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Switch } from '@matter/types/clusters/switch';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import { EndpointNumber } from '@matter/types/datatype';
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
import { MatterbridgeWebRtcTransportRequestorServer } from '../../src/behaviors/webRtcTransportRequestorServer.js';
import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import { Intercom } from '../../src/devices/intercom.js';
import { genericSwitch } from '../../src/matterbridgeDeviceTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Intercom', () => {
  let defaultDevice: Intercom;

  beforeAll(async () => {
    // Setup the Matter test environment
    // Warn instead of strict: the Root Node conditions these device types assert (TimeSynchronization, TLS Certificate and Client Management) have no matter.js implementation yet
    await createTestEnvironment('warn');

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

  it('should create an intercom device with default options', async () => {
    const device = new Intercom('Intercom Default', 'INTERCOM-DEFAULT');
    expect(device.id).toBe('IntercomDefault-INTERCOM-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();
    expect(device.hasClusterServer(WebRtcTransportProvider.id)).toBeTruthy();
    expect(device.hasClusterServer(WebRtcTransportRequestor.id)).toBeTruthy();

    // The required WebRtcTransportProvider/WebRtcTransportRequestor and optional Chime client clusters are added
    // automatically and should not trigger a "no client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportProvider.id, WebRtcTransportRequestor.id, Chime.id]);
    expect(device.type.clientClusters['webRtcTransportProvider']).toBe(WebRtcTransportProviderClient);
    expect(device.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);
    expect(device.type.clientClusters['chime']).toBe(ChimeClient);

    // Matter 1.6.1 § 16.4.4: the mandatory Generic Switch component is a child endpoint with a momentary switch (§ 16.4.8)
    const switchChild = device.getChildEndpointById('Switch');
    expect(switchChild).toBeDefined();
    expect(switchChild?.deviceTypes.has(genericSwitch.code)).toBeTruthy();
    expect(switchChild?.hasClusterServer(Identify.id)).toBeTruthy();
    expect(switchChild?.hasClusterServer(Switch.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(switchChild?.getAttribute(Switch.id, 'featureMap')).toMatchObject({ momentarySwitch: true, latchingSwitch: false });
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
    expect(device.getAttribute(CameraAvStreamManagement, 'speakerCapabilities')).toEqual({
      maxNumberOfChannels: 1,
      supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus],
      supportedSampleRates: [48000],
      supportedBitDepths: [16],
    });
    expect(device.getAttribute(CameraAvStreamManagement, 'twoWayTalkSupport')).toBe(CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex);
    expect(device.getAttribute(CameraAvStreamManagement, 'speakerMuted')).toBe(false);
    expect(device.getAttribute(WebRtcTransportProvider, 'currentSessions')).toEqual([]);
    expect(device.getAttribute(WebRtcTransportRequestor, 'currentSessions')).toEqual([]);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new Intercom('Intercom Snapshot', 'INTERCOM-SNAPSHOT');
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
        'cameraAvStreamManagement(0x551).attributeList(0xfffb)=[ 6, 7, 8, 9, 11, 14, 16, 18, 21, 25, 26, 27, 28, 29, 30, 31, 32, 33, 39, 65528, 65529, 65531, 65532, 65533 ]',
        'cameraAvStreamManagement(0x551).clusterRevision(0xfffd)=2',
        'cameraAvStreamManagement(0x551).featureMap(0xfffc)={ audio: true, video: false, snapshot: false, privacy: false, speaker: true, imageControl: false, watermark: false, onScreenDisplay: false, localStorage: false, highDynamicRange: false, nightVision: false }',
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
        'cameraAvStreamManagement(0x551).speakerCapabilities(0x8)={ maxNumberOfChannels: 1, supportedCodecs: [ 0 ], supportedSampleRates: [ 48000 ], supportedBitDepths: [ 16 ] }',
        'cameraAvStreamManagement(0x551).speakerMaxLevel(0x1b)=254',
        'cameraAvStreamManagement(0x551).speakerMinLevel(0x1c)=0',
        'cameraAvStreamManagement(0x551).speakerMuted(0x19)=false',
        'cameraAvStreamManagement(0x551).speakerVolumeLevel(0x1a)=128',
        'cameraAvStreamManagement(0x551).statusLightEnabled(0x27)=false',
        'cameraAvStreamManagement(0x551).streamUsagePriorities(0x12)=[ 3 ]',
        'cameraAvStreamManagement(0x551).supportedStreamUsages(0xe)=[ 3 ]',
        'cameraAvStreamManagement(0x551).twoWayTalkSupport(0x9)=2',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1363, 1364, 1366 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 320, revision: 2 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 5 ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 30, 47, 1361, 1363, 1364 ]',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 4, 5 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'webRtcTransportProvider(0x553).acceptedCommandList(0xfff9)=[ 0, 2, 4, 5, 6 ]',
        'webRtcTransportProvider(0x553).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'webRtcTransportProvider(0x553).clusterRevision(0xfffd)=2',
        'webRtcTransportProvider(0x553).currentSessions(0x0)=[  ]',
        'webRtcTransportProvider(0x553).featureMap(0xfffc)={ metadata: false }',
        'webRtcTransportProvider(0x553).generatedCommandList(0xfff8)=[ 1, 3 ]',
        'webRtcTransportRequestor(0x554).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3 ]',
        'webRtcTransportRequestor(0x554).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'webRtcTransportRequestor(0x554).clusterRevision(0xfffd)=2',
        'webRtcTransportRequestor(0x554).currentSessions(0x0)=[  ]',
        'webRtcTransportRequestor(0x554).featureMap(0xfffc)={  }',
        'webRtcTransportRequestor(0x554).generatedCommandList(0xfff8)=[  ]',
      ].toSorted(),
    );
  });

  it('should create an intercom device with custom identify options', async () => {
    const device = new Intercom('Intercom Identify', 'INTERCOM-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create an intercom device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new Intercom(`Intercom ${powerSourceType}`, `INTERCOM-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create an intercom device with no power source', async () => {
    const device = new Intercom('Intercom None', 'INTERCOM-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create an intercom device with custom stream usages', async () => {
    const device = new Intercom('Intercom Custom', 'INTERCOM-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities: [StreamUsage.LiveView, StreamUsage.Recording],
    });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
  });

  it('should create an intercom device with custom werift offer options', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { offerVideo: false, offerAudio: true, videoSource: 'none', audioSource: 'test' };
    const device = new Intercom('Intercom Werift', 'INTERCOM-WERIFT', { weriftOfferOptions });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });

  it('should create the mandatory switch with custom switchOptions', async () => {
    const device = new Intercom('Intercom Switch Options', 'INTERCOM-SWITCH-OPTIONS', {
      id: 'IntercomSwitchOptions',
      number: EndpointNumber(16_04),
      switchOptions: { name: 'Call Button', number: EndpointNumber(16_04_2), identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator },
    });
    const switchChild = device.getChildEndpointById('CallButton');
    expect(switchChild).toBeDefined();
    expect(switchChild?.number).toBe(EndpointNumber(16_04_2));

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(switchChild?.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(switchChild?.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it('should add additional switches with tags and trigger a switch event', async () => {
    // Sibling switches share a device type, so each one needs a distinct TagList (Matter 1.6.1 Core § 9.2.9)
    const device = new Intercom('Intercom Multi Switch', 'INTERCOM-MULTI-SWITCH', { switchOptions: { tagList: [{ mfgCode: null, namespaceId: 8, tag: 4, label: 'Middle' }] } });
    const left = device.addSwitch('Left Switch', { tagList: [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Left' }] });
    expect(left.id).toBe('LeftSwitch');
    expect(left.deviceTypes.has(genericSwitch.code)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(await left.triggerSwitchEvent('Single', left.log)).toBeTruthy();
    expect(left.getAttribute(Switch, 'currentPosition')).toBe(0);
  });
  it.each(['offer', 'answer', 'iceCandidates', 'end'] as const)('should notify %s subscribers only after the inherited handler succeeds', async (command) => {
    const request = { webRtcSessionId: 1, sdp: 'sdp', iceCandidates: [{ candidate: 'candidate', sdpMid: null, sdpmLineIndex: null }], reason: 0 };
    const device = new Intercom(`Intercom ${command}`, `INTERCOM-${command}`);
    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    const listener = vi.fn();
    device.subscribeCommand(WebRtcTransportRequestor.id, command, listener);
    const handler = vi.spyOn(WebRtcTransportRequestorServer.prototype, command).mockImplementation(async () => {
      expect(listener).not.toHaveBeenCalled();
    });
    try {
      await device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request));
      expect(handler).toHaveBeenCalledWith(request);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ command, cluster: 'webRtcTransportRequestor', request, endpoint: device, context: expect.anything() }));

      listener.mockClear();
      handler.mockRejectedValueOnce(new Error('Rejected signaling'));
      expect(device.act(async (agent) => agent.get(MatterbridgeWebRtcTransportRequestorServer)[command](request))).rejects.toThrow('Rejected signaling');
      expect(listener).not.toHaveBeenCalled();
    } finally {
      handler.mockRestore();
    }
  });
});
