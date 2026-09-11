/**
 * @file vitest/devices/snapshotCamera.test.ts
 * @description This file contains the tests for the SnapshotCamera device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'SnapshotCameraDevice';
const MATTER_PORT = 6002;
const MATTER_CREATE_ONLY = true;

import { StreamUsage } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { MatterbridgeCameraAvStreamManagementServer } from '../../src/behaviors/cameraAvStreamManagementServer.js';
import { SnapshotCamera } from '../../src/devices/snapshotCamera.js';

await setupTest(NAME);

describe('SnapshotCamera', () => {
  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

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
    if (MATTER_CREATE_ONLY) await flushServerNode();
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
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

  it('should create a snapshot camera device with identify enabled', async () => {
    const device = new SnapshotCamera('Snapshot Camera Identify', 'CAMERA-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a snapshot camera device with no power source', async () => {
    const device = new SnapshotCamera('Snapshot Camera None', 'CAMERA-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
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
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'maxConcurrentEncoders')).toBe(2);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxEncodedPixelRate')).toBe(20000000);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(2048);
    expect(device.getAttribute(CameraAvStreamManagement, 'snapshotCapabilities')).toEqual(snapshotCapabilities);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(20000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.Recording, StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
  });
});
