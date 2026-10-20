/**
 * @file packages/core/buntest/devices/videoDoorbell.test.ts
 * @description This file contains the tests for the VideoDoorbell device.
 * @author Luca Liguori
 */

const NAME = 'VideoDoorbellDevice';
const MATTER_PORT = 6011;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { ChimeClient } from '@matter/node/behaviors/chime';
import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Chime } from '@matter/types/clusters/chime';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { Switch } from '@matter/types/clusters/switch';
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
import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import { VideoDoorbell } from '../../src/devices/videoDoorbell.js';

// Setup the test environment
await setupTest(NAME, false);

describe('VideoDoorbell', () => {
  let defaultDevice: VideoDoorbell;

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

  it('should create a video doorbell device with default options and the mandatory camera and doorbell', async () => {
    const device = new VideoDoorbell('Video Doorbell Default', 'VIDEO-DOORBELL-DEFAULT');
    expect(device.id).toBe('VideoDoorbellDefault-VIDEO-DOORBELL-DEFAULT');
    expect(device.deviceName).toBe('Video Doorbell Default');
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();

    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild).toBeDefined();
    expect(cameraChild?.hasClusterServer(Identify.id)).toBeFalsy();
    expect(cameraChild?.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();

    // The required WebRtcTransportRequestor client cluster is added automatically on the Camera child endpoint and
    // should not trigger a "no client behavior found" warning.
    const cameraClientList = (cameraChild?.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(cameraClientList).toEqual([WebRtcTransportRequestor.id]);
    expect(cameraChild?.type.clientClusters['webRtcTransportRequestor']).toBe(WebRtcTransportRequestorClient);

    const doorbellChild = device.getChildEndpointById('Doorbell');
    expect(doorbellChild).toBeDefined();
    expect(doorbellChild?.hasClusterServer(Identify.id)).toBeTruthy();
    expect(doorbellChild?.hasClusterServer(Switch.id)).toBeTruthy();

    // The required Chime client cluster is added automatically on the Doorbell child endpoint and should not
    // trigger a "no client behavior found" warning.
    const doorbellClientList = (doorbellChild?.behaviors.optionsFor(MatterbridgeBindingServer) as { clientList?: number[] })?.clientList ?? [];
    expect(doorbellClientList).toEqual([Chime.id]);
    expect(doorbellChild?.type.clientClusters['chime']).toBe(ChimeClient);

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(FixedLabel, 'labelList')).toEqual([{ label: 'composed', value: 'VideoDoorbell' }]);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(4_194_304);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10_000_000);
    expect(doorbellChild?.getAttribute(Switch, 'numberOfPositions')).toBe(2);
    expect(doorbellChild?.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new VideoDoorbell('Video Doorbell Snapshot', 'VIDEO-DOORBELL-SNAPSHOT');
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
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 323, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[ 6, 7 ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 47, 64 ]',
        'fixedLabel(0x40).acceptedCommandList(0xfff9)=[  ]',
        'fixedLabel(0x40).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'fixedLabel(0x40).clusterRevision(0xfffd)=1',
        'fixedLabel(0x40).featureMap(0xfffc)={  }',
        'fixedLabel(0x40).generatedCommandList(0xfff8)=[  ]',
        "fixedLabel(0x40).labelList(0x0)=[ { label: 'composed', value: 'VideoDoorbell' } ]",
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 5, 6, 7 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
      ].toSorted(),
    );
  });

  it('should expose the expected attributes on the Camera child endpoint', () => {
    const child = defaultDevice.getChildEndpointById('Camera');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1364 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 322, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 30, 1361, 1363 ]',
        'webRtcTransportProvider(0x553).acceptedCommandList(0xfff9)=[ 0, 2, 4, 5, 6 ]',
        'webRtcTransportProvider(0x553).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'webRtcTransportProvider(0x553).clusterRevision(0xfffd)=2',
        'webRtcTransportProvider(0x553).currentSessions(0x0)=[  ]',
        'webRtcTransportProvider(0x553).featureMap(0xfffc)={ metadata: false }',
        'webRtcTransportProvider(0x553).generatedCommandList(0xfff8)=[ 1, 3 ]',
      ].toSorted(),
    );
  });

  it('should expose the expected attributes on the Doorbell child endpoint', () => {
    const child = defaultDevice.getChildEndpointById('Doorbell');
    expect(child).toBeDefined();
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    child?.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[ 1366 ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 328, revision: 2 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 30, 59 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'switch(0x3b).acceptedCommandList(0xfff9)=[  ]',
        'switch(0x3b).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'switch(0x3b).clusterRevision(0xfffd)=2',
        'switch(0x3b).currentPosition(0x1)=0',
        'switch(0x3b).featureMap(0xfffc)={ latchingSwitch: false, momentarySwitch: true, momentarySwitchRelease: false, momentarySwitchLongPress: false, momentarySwitchMultiPress: false, actionSwitch: false }',
        'switch(0x3b).generatedCommandList(0xfff8)=[  ]',
        'switch(0x3b).numberOfPositions(0x0)=2',
      ].toSorted(),
    );
  });

  it('should create the mandatory doorbell with custom doorbellOptions', async () => {
    const device = new VideoDoorbell('Video Doorbell Doorbell Options', 'VIDEO-DOORBELL-DOORBELL-OPTIONS', {
      doorbellOptions: {
        name: 'Front Doorbell',
        tagList: [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Front' }],
        identifyTime: 5,
        identifyType: Identify.IdentifyType.VisibleIndicator,
      },
    });
    const doorbellChild = device.getChildEndpointById('FrontDoorbell');
    expect(doorbellChild).toBeDefined();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(doorbellChild?.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(doorbellChild?.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it('should create a video doorbell device with the camera identify enabled', async () => {
    const device = new VideoDoorbell('Video Doorbell Identify', 'VIDEO-DOORBELL-IDENTIFY', {
      cameraOptions: { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator },
    });
    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild?.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(cameraChild?.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(cameraChild?.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a video doorbell device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new VideoDoorbell(`Video Doorbell ${powerSourceType}`, `VIDEO-DOORBELL-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a video doorbell device with no power source', async () => {
    const device = new VideoDoorbell('Video Doorbell None', 'VIDEO-DOORBELL-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create the child endpoints with explicit endpoint numbers', async () => {
    const device = new VideoDoorbell('Video Doorbell Numbers', 'VIDEO-DOORBELL-NUMBERS', {
      id: 'VideoDoorbellNumbers',
      number: EndpointNumber(16_03),
      cameraOptions: { number: EndpointNumber(16_03_1) },
      doorbellOptions: { number: EndpointNumber(16_03_2) },
    });
    expect(device.number).toBe(EndpointNumber(16_03));
    expect(device.getChildEndpointById('Camera')?.number).toBe(EndpointNumber(16_03_1));
    expect(device.getChildEndpointById('Doorbell')?.number).toBe(EndpointNumber(16_03_2));

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create the camera child endpoint with a tagList', async () => {
    const device = new VideoDoorbell('Video Doorbell Camera Tags', 'VIDEO-DOORBELL-CAMERA-TAGS', {
      cameraOptions: { tagList: [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Front' }] },
    });
    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild).toBeDefined();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(cameraChild?.getAttribute('Descriptor', 'tagList')).toEqual([{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Front' }]);
  });

  it('should add an additional doorbell with an explicit endpoint number', async () => {
    const device = new VideoDoorbell('Video Doorbell Doorbell Number', 'VIDEO-DOORBELL-DOORBELL-NUMBER');
    const doorbellChild = device.addDoorbell('Side Doorbell', { number: EndpointNumber(16_03_0) });
    expect(doorbellChild.number).toBe(EndpointNumber(16_03_0));

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should add additional doorbells with tags and trigger a switch event', async () => {
    const device = new VideoDoorbell('Video Doorbell Multi Doorbell', 'VIDEO-DOORBELL-MULTI-DOORBELL');
    const left = device.addDoorbell('Left Doorbell', { tagList: [{ mfgCode: null, namespaceId: 8, tag: 0, label: 'Left' }] });
    const right = device.addDoorbell('Right Doorbell', { tagList: [{ mfgCode: null, namespaceId: 8, tag: 1, label: 'Right' }] });
    expect(left.id).toBe('LeftDoorbell');
    expect(right.id).toBe('RightDoorbell');

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(await left.triggerSwitchEvent('Single', left.log)).toBeTruthy();
    expect(left.getAttribute(Switch, 'currentPosition')).toBe(0);
  });

  it('should create a video doorbell device with custom stream usages on the camera child', async () => {
    const device = new VideoDoorbell('Video Doorbell Custom', 'VIDEO-DOORBELL-CUSTOM', {
      cameraOptions: {
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
      },
    });
    const cameraChild = device.getChildEndpointById('Camera');

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(cameraChild?.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
  });

  it('should create a video doorbell device with custom werift offer options on the camera child', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { offerVideo: true, offerAudio: false, videoSource: 'test', audioSource: 'none', videoResolution: '1280x720' };
    const device = new VideoDoorbell('Video Doorbell Werift', 'VIDEO-DOORBELL-WERIFT', { cameraOptions: { weriftOfferOptions } });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    const cameraChild = device.getChildEndpointById('Camera');
    expect(cameraChild?.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });
});
