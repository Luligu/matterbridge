/**
 * @file packages/core/buntest/devices/snapshotCamera.test.ts
 * @description This file contains the tests for the SnapshotCamera device.
 * @author Luca Liguori
 */

const NAME = 'SnapshotCameraDevice';
const MATTER_PORT = 6002;
const MATTER_CREATE_ONLY = true;

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'bun:test';

import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
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

import { MatterbridgeCameraAvStreamManagementServer } from '../../src/behaviors/cameraAvStreamManagementServer.js';
import { SnapshotCamera } from '../../src/devices/snapshotCamera.js';

// Setup the test environment
await setupTest(NAME, false);

describe('SnapshotCamera', () => {
  let defaultDevice: SnapshotCamera;

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

  it('should create a snapshot camera device with default options', async () => {
    const device = new SnapshotCamera('Snapshot Camera Default', 'CAMERA-DEFAULT');
    expect(device.id).toBe('SnapshotCameraDefault-CAMERA-DEFAULT');
    expect(device.hasClusterServer(Identify.id)).toBeFalsy();
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();
    expect(device.hasClusterServer(CameraAvStreamManagement.id)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Snapshot))).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'maxConcurrentEncoders')).toBe(1);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxEncodedPixelRate')).toBe(10000000);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(1024);
    expect(device.getAttribute(CameraAvStreamManagement, 'snapshotCapabilities')).toEqual([
      { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
    ]);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.Recording]);
    // A default snapshot stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([expect.objectContaining({ snapshotStreamId: 0 })]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.Recording]);
  });

  it('should create the default device for the attribute snapshot', async () => {
    defaultDevice = new SnapshotCamera('Snapshot Camera Snapshot', 'SNAPSHOT-CAMERA-SNAPSHOT');
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
        'cameraAvStreamManagement(0x551).acceptedCommandList(0xfff9)=[ 7, 10, 11, 12 ]',
        'cameraAvStreamManagement(0x551).allocatedSnapshotStreams(0x11)=[ { snapshotStreamId: 0, imageCodec: 0, frameRate: 10, minResolution: { width: 640, height: 480 }, maxResolution: { width: 1920, height: 1080 }, quality: 90, referenceCount: 0, encodedPixels: false, hardwareEncoder: false, watermarkEnabled: undefined, osdEnabled: undefined } ]',
        'cameraAvStreamManagement(0x551).attributeList(0xfffb)=[ 0, 1, 6, 10, 11, 14, 17, 18, 65528, 65529, 65531, 65532, 65533 ]',
        'cameraAvStreamManagement(0x551).clusterRevision(0xfffd)=2',
        'cameraAvStreamManagement(0x551).featureMap(0xfffc)={ audio: false, video: false, snapshot: true, privacy: false, speaker: false, imageControl: false, watermark: false, onScreenDisplay: false, localStorage: false, highDynamicRange: false, nightVision: false }',
        'cameraAvStreamManagement(0x551).generatedCommandList(0xfff8)=[ 8, 13 ]',
        'cameraAvStreamManagement(0x551).maxConcurrentEncoders(0x0)=1',
        'cameraAvStreamManagement(0x551).maxContentBufferSize(0x6)=1024',
        'cameraAvStreamManagement(0x551).maxEncodedPixelRate(0x1)=10000000',
        'cameraAvStreamManagement(0x551).maxNetworkBandwidth(0xb)=10000',
        'cameraAvStreamManagement(0x551).snapshotCapabilities(0xa)=[ { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: 0, requiresEncodedPixels: false, requiresHardwareEncoder: undefined }, { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: 0, requiresEncodedPixels: false, requiresHardwareEncoder: undefined }, { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: 0, requiresEncodedPixels: false, requiresHardwareEncoder: undefined } ]',
        'cameraAvStreamManagement(0x551).streamUsagePriorities(0x12)=[ 1 ]',
        'cameraAvStreamManagement(0x551).supportedStreamUsages(0xe)=[ 1 ]',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 325, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 47, 1361 ]',
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
      ].toSorted(),
    );
  });

  it('should create a snapshot camera device with identify enabled', async () => {
    const device = new SnapshotCamera('Snapshot Camera Identify', 'CAMERA-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(Identify, 'identifyTime')).toBe(5);
    expect(device.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.VisibleIndicator);
  });

  it.each([
    ['Rechargeable', PowerSource.BatChargeLevel.Ok],
    ['Replaceable', PowerSource.BatChargeLevel.Ok],
    ['Battery', PowerSource.BatChargeLevel.Ok],
  ] as const)('should create a snapshot camera device with a %s power source', async (powerSourceType, expectedChargeLevel) => {
    const device = new SnapshotCamera(`Snapshot Camera ${powerSourceType}`, `CAMERA-${powerSourceType.toUpperCase()}`, { powerSourceType });
    expect(device.hasClusterServer(PowerSource.id)).toBeTruthy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a snapshot camera device with no power source', async () => {
    const device = new SnapshotCamera('Snapshot Camera None', 'CAMERA-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  });

  it('should create a snapshot camera device with custom stream options', async () => {
    const snapshotCapabilities = [
      {
        resolution: { width: 640, height: 480 },
        maxFrameRate: 5,
        imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
        requiresEncodedPixels: true,
        requiresHardwareEncoder: true,
      },
    ];
    const device = new SnapshotCamera('Snapshot Camera Custom', 'CAMERA-CUSTOM', {
      maxConcurrentEncoders: 2,
      maxEncodedPixelRate: 20000000,
      maxContentBufferSize: 2048,
      snapshotCapabilities,
      maxNetworkBandwidth: 20000,
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.LiveView, StreamUsage.Recording],
      snapshotSource: 'webcam',
      snapshotSourceDevice: '/dev/video0',
    });

    expect(await addDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    // The device installs the Snapshot-only derivation, so the state must be addressed through that same feature set.
    const snapshotServer = MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Snapshot);
    expect(device.stateOf(snapshotServer).snapshotSource).toBe('webcam');
    expect(device.stateOf(snapshotServer).snapshotSourceDevice).toBe('/dev/video0');
    expect(device.getAttribute(CameraAvStreamManagement, 'maxConcurrentEncoders')).toBe(2);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxEncodedPixelRate')).toBe(20000000);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(2048);
    expect(device.getAttribute(CameraAvStreamManagement, 'snapshotCapabilities')).toEqual(snapshotCapabilities);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(20000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.Recording, StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
  });
});
