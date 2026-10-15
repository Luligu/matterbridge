/**
 * @file packages/core/buntest/devices/camera.test.ts
 * @description This file contains the tests for the Camera device.
 * @author Luca Liguori
 */

const NAME = 'CameraDevice';
const MATTER_PORT = 6003;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
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
import { Camera } from '../../src/devices/camera.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Camera', () => {
  let defaultDevice: Camera;

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

  it('should create a camera device with default options', async () => {
    const device = new Camera('Camera Default', 'CAMERA-DEFAULT');
    expect(device.id).toBe('CameraDefault-CAMERA-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    // The required WebRtcTransportRequestor client cluster is added automatically and should not trigger a "no
    // client behavior found" warning.
    const clientList = (device.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(clientList).toEqual([WebRtcTransportRequestor.id]);
    expect(device.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(4_194_304);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10_000_000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'videoSensorParams')).toEqual({ sensorWidth: 1920, sensorHeight: 1080, maxFps: 60 });
    expect(device.getAttribute(CameraAvStreamManagement, 'viewport')).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
    // A default video stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView })]);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new Camera('Camera Snapshot', 'CAMERA-SNAPSHOT');
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
        'cameraAvStreamManagement(0x551).acceptedCommandList(0xfff9)=[ 0, 2, 3, 6, 7, 10, 11, 12 ]',
        'cameraAvStreamManagement(0x551).allocatedAudioStreams(0x10)=[ { audioStreamId: 0, streamUsage: 3, audioCodec: 0, channelCount: 1, sampleRate: 48000, bitRate: 32000, bitDepth: 16, referenceCount: 0 } ]',
        'cameraAvStreamManagement(0x551).allocatedSnapshotStreams(0x11)=[ { snapshotStreamId: 0, imageCodec: 0, frameRate: 10, minResolution: { width: 640, height: 480 }, maxResolution: { width: 1920, height: 1080 }, quality: 90, referenceCount: 0, encodedPixels: false, hardwareEncoder: false, watermarkEnabled: undefined, osdEnabled: undefined } ]',
        'cameraAvStreamManagement(0x551).allocatedVideoStreams(0xf)=[ { videoStreamId: 0, streamUsage: 3, videoCodec: 0, minFrameRate: 1, maxFrameRate: 60, minResolution: { width: 640, height: 360 }, maxResolution: { width: 1920, height: 1080 }, minBitRate: 1000000, maxBitRate: 4000000, keyFrameInterval: 4000, watermarkEnabled: undefined, osdEnabled: undefined, referenceCount: 0 } ]',
        'cameraAvStreamManagement(0x551).attributeList(0xfffb)=[ 0, 1, 2, 4, 5, 6, 7, 10, 11, 12, 14, 15, 16, 17, 18, 21, 24, 29, 30, 31, 32, 33, 34, 35, 36, 39, 40, 65528, 65529, 65531, 65532, 65533 ]',
        'cameraAvStreamManagement(0x551).clusterRevision(0xfffd)=2',
        'cameraAvStreamManagement(0x551).currentFrameRate(0xc)=30',
        'cameraAvStreamManagement(0x551).featureMap(0xfffc)={ audio: true, video: true, snapshot: true, privacy: false, speaker: false, imageControl: true, watermark: false, onScreenDisplay: false, localStorage: false, highDynamicRange: false, nightVision: false }',
        'cameraAvStreamManagement(0x551).generatedCommandList(0xfff8)=[ 1, 4, 8, 13 ]',
        'cameraAvStreamManagement(0x551).hardPrivacyModeOn(0x15)=false',
        'cameraAvStreamManagement(0x551).imageFlipHorizontal(0x23)=false',
        'cameraAvStreamManagement(0x551).imageFlipVertical(0x24)=false',
        'cameraAvStreamManagement(0x551).imageRotation(0x22)=0',
        'cameraAvStreamManagement(0x551).maxConcurrentEncoders(0x0)=1',
        'cameraAvStreamManagement(0x551).maxContentBufferSize(0x6)=4194304',
        'cameraAvStreamManagement(0x551).maxEncodedPixelRate(0x1)=124416000',
        'cameraAvStreamManagement(0x551).maxNetworkBandwidth(0xb)=10000000',
        'cameraAvStreamManagement(0x551).microphoneAgcEnabled(0x21)=false',
        'cameraAvStreamManagement(0x551).microphoneCapabilities(0x7)={ maxNumberOfChannels: 1, supportedCodecs: [ 0 ], supportedSampleRates: [ 48000 ], supportedBitDepths: [ 16 ] }',
        'cameraAvStreamManagement(0x551).microphoneMaxLevel(0x1f)=254',
        'cameraAvStreamManagement(0x551).microphoneMinLevel(0x20)=0',
        'cameraAvStreamManagement(0x551).microphoneMuted(0x1d)=false',
        'cameraAvStreamManagement(0x551).microphoneVolumeLevel(0x1e)=128',
        'cameraAvStreamManagement(0x551).minViewportResolution(0x4)={ width: 640, height: 360 }',
        'cameraAvStreamManagement(0x551).rateDistortionTradeOffPoints(0x5)=[ { codec: 0, resolution: { width: 640, height: 480 }, minBitRate: 250000 }, { codec: 0, resolution: { width: 1280, height: 720 }, minBitRate: 500000 }, { codec: 0, resolution: { width: 1920, height: 1080 }, minBitRate: 1000000 } ]',
        'cameraAvStreamManagement(0x551).snapshotCapabilities(0xa)=[ { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: 0, requiresEncodedPixels: false, requiresHardwareEncoder: undefined }, { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: 0, requiresEncodedPixels: false, requiresHardwareEncoder: undefined }, { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: 0, requiresEncodedPixels: false, requiresHardwareEncoder: undefined } ]',
        'cameraAvStreamManagement(0x551).statusLightBrightness(0x28)=0',
        'cameraAvStreamManagement(0x551).statusLightEnabled(0x27)=false',
        'cameraAvStreamManagement(0x551).streamUsagePriorities(0x12)=[ 3, 1 ]',
        'cameraAvStreamManagement(0x551).supportedStreamUsages(0xe)=[ 3, 1 ]',
        'cameraAvStreamManagement(0x551).videoSensorParams(0x2)={ sensorWidth: 1920, sensorHeight: 1080, maxFps: 60, maxHdrfps: undefined }',
        'cameraAvStreamManagement(0x551).viewport(0x18)={ x1: 0, y1: 0, x2: 1920, y2: 1080 }',
        'bridgedDeviceBasicInformation(0x39).acceptedCommandList(0xfff9)=[  ]',
        'bridgedDeviceBasicInformation(0x39).attributeList(0xfffb)=[ 1, 2, 3, 4, 5, 7, 8, 9, 10, 13, 14, 15, 17, 18, 24, 65528, 65529, 65531, 65532, 65533 ]',
        'bridgedDeviceBasicInformation(0x39).clusterRevision(0xfffd)=6',
        'bridgedDeviceBasicInformation(0x39).configurationVersion(0x18)=1',
        'bridgedDeviceBasicInformation(0x39).featureMap(0xfffc)={ bridgedIcdSupport: false }',
        'bridgedDeviceBasicInformation(0x39).generatedCommandList(0xfff8)=[  ]',
        'bridgedDeviceBasicInformation(0x39).hardwareVersion(0x7)=1',
        "bridgedDeviceBasicInformation(0x39).hardwareVersionString(0x8)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).nodeLabel(0x5)='Camera Snapshot'",
        'bridgedDeviceBasicInformation(0x39).productId(0x4)=32768',
        "bridgedDeviceBasicInformation(0x39).productLabel(0xe)='Matter Bridged Endpoint'",
        "bridgedDeviceBasicInformation(0x39).productName(0x3)='Matterbridge Camera'",
        "bridgedDeviceBasicInformation(0x39).productUrl(0xd)='https://matterbridge.io'",
        'bridgedDeviceBasicInformation(0x39).reachable(0x11)=true',
        "bridgedDeviceBasicInformation(0x39).serialNumber(0xf)='CAMERA-SNAPSHOT'",
        'bridgedDeviceBasicInformation(0x39).softwareVersion(0x9)=1',
        "bridgedDeviceBasicInformation(0x39).softwareVersionString(0xa)='1.0.0'",
        "bridgedDeviceBasicInformation(0x39).uniqueId(0x12)='aaa9cc4e2c8e655c0009b1bf5f451dca'",
        'bridgedDeviceBasicInformation(0x39).vendorId(0x2)=65521',
        "bridgedDeviceBasicInformation(0x39).vendorName(0x1)='Matterbridge'",
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1364 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 322, revision: 1 }, { deviceType: 17, revision: 1 }, { deviceType: 19, revision: 3 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 30, 47, 57, 1361, 1363 ]',
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
        'webRtcTransportProvider(0x553).acceptedCommandList(0xfff9)=[ 0, 2, 4, 5, 6 ]',
        'webRtcTransportProvider(0x553).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'webRtcTransportProvider(0x553).clusterRevision(0xfffd)=2',
        'webRtcTransportProvider(0x553).currentSessions(0x0)=[  ]',
        'webRtcTransportProvider(0x553).featureMap(0xfffc)={ metadata: false }',
        'webRtcTransportProvider(0x553).generatedCommandList(0xfff8)=[ 1, 3 ]',
      ].toSorted(),
    );
  });

  it('should create a camera device with identify enabled', async () => {
    const device = new Camera('Camera Identify', 'CAMERA-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a camera device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new Camera(`Camera ${powerSourceType}`, `CAMERA-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a camera device with no power source', async () => {
    const device = new Camera('Camera None', 'CAMERA-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create a camera device with custom stream usages', async () => {
    const device = new Camera('Camera Custom', 'CAMERA-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.LiveView],
    });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
  });

  it('should create a camera device with default snapshot capabilities', async () => {
    const device = new Camera('Camera Snapshot Defaults', 'CAMERA-SNAPSHOT-DEFAULTS');

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'snapshotCapabilities')).toEqual([
      { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
    ]);
    // A default snapshot stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([expect.objectContaining({ snapshotStreamId: 0 })]);
  });

  it('should create a camera device with ptz enabled', async () => {
    const device = new Camera('Camera Ptz', 'CAMERA-PTZ', { ptz: true });
    expect(device.hasClusterServer(CameraAvSettingsUserLevelManagement.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMin')).toBe(-170);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMax')).toBe(170);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMin')).toBe(-20);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMax')).toBe(90);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'zoomMax')).toBe(10);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 0, tilt: 0, zoom: 1 });
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'movementState')).toBe(CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle);
  });

  it('should create a camera device with ptz enabled and custom pan, tilt and zoom ranges', async () => {
    const device = new Camera('Camera Ptz Custom', 'CAMERA-PTZ-CUSTOM', {
      ptz: true,
      panMin: -90,
      panMax: 90,
      tiltMin: -10,
      tiltMax: 45,
      zoomMax: 4,
      mptzPosition: { pan: 10, tilt: 5, zoom: 2 },
    });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMin')).toBe(-90);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'panMax')).toBe(90);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMin')).toBe(-10);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'tiltMax')).toBe(45);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'zoomMax')).toBe(4);
    expect(device.getAttribute(CameraAvSettingsUserLevelManagement, 'mptzPosition')).toEqual({ pan: 10, tilt: 5, zoom: 2 });
  });

  it('should not create the CameraAvSettingsUserLevelManagement cluster server when ptz is disabled', async () => {
    const device = new Camera('Camera No Ptz', 'CAMERA-NO-PTZ');
    expect(device.hasClusterServer(CameraAvSettingsUserLevelManagement.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create a camera device with custom werift offer options', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { offerVideo: true, offerAudio: false, videoSource: 'test', audioSource: 'none', videoResolution: '1280x720' };
    const device = new Camera('Camera Werift', 'CAMERA-WERIFT', { weriftOfferOptions });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });

  it('should create a camera device with the default werift offer options', async () => {
    const device = new Camera('Camera Werift Defaults', 'CAMERA-WERIFT-DEFAULTS');

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual({ offerVideo: true, offerAudio: true, videoSource: 'none', audioSource: 'none' });
  });
});
