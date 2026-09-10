/**
 * @file vitest/devices/camera.test.ts
 * @description This file contains the tests for the Camera device.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'CameraDevice';
const MATTER_PORT = 6003;
const MATTER_CREATE_ONLY = true;

import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { StreamUsage } from '@matter/types';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
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

import { MatterbridgeBindingServer } from '../../src/behaviors/bindingServer.js';
import { MatterbridgeWebRtcTransportProviderServer } from '../../src/behaviors/webRtcTransportProviderServer.js';
import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import { Camera } from '../../src/devices/camera.js';

await setupTest(NAME);

describe('Camera', () => {
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'maxContentBufferSize')).toBe(4_194_304);
    expect(device.getAttribute(CameraAvStreamManagement, 'maxNetworkBandwidth')).toBe(10_000_000);
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(device.getAttribute(CameraAvStreamManagement, 'videoSensorParams')).toEqual({ sensorWidth: 1920, sensorHeight: 1080, maxFps: 60 });
    expect(device.getAttribute(CameraAvStreamManagement, 'viewport')).toEqual({ x1: 0, y1: 0, x2: 1920, y2: 1080 });
    // A default video stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView })]);
  });

  it('should create a camera device with identify enabled', async () => {
    const device = new Camera('Camera Identify', 'CAMERA-IDENTIFY', { identifyTime: 5, identifyType: Identify.IdentifyType.VisibleIndicator });
    expect(device.hasClusterServer(Identify.id)).toBeTruthy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(PowerSource, 'batChargeLevel')).toBe(expectedChargeLevel);
  });

  it('should create a camera device with no power source', async () => {
    const device = new Camera('Camera None', 'CAMERA-NONE', { powerSourceType: 'None' });
    expect(device.hasClusterServer(PowerSource.id)).toBeFalsy();

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should create a camera device with custom stream usages', async () => {
    const device = new Camera('Camera Custom', 'CAMERA-CUSTOM', {
      supportedStreamUsages: [StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.LiveView],
    });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.getAttribute(CameraAvStreamManagement, 'supportedStreamUsages')).toEqual([StreamUsage.LiveView]);
    expect(device.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView]);
  });

  it('should create a camera device with default snapshot capabilities', async () => {
    const device = new Camera('Camera Snapshot Defaults', 'CAMERA-SNAPSHOT-DEFAULTS');

    expect(await addDevice(aggregator, device)).toBeTruthy();
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
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

    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should create a camera device with custom werift offer options', async () => {
    const weriftOfferOptions: WeriftOfferOptions = { video: true, audio: false, videoSource: 'test', audioSource: 'none', videoResolution: '1280x720' };
    const device = new Camera('Camera Werift', 'CAMERA-WERIFT', { weriftOfferOptions });

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual(weriftOfferOptions);
  });

  it('should create a camera device with the default werift offer options', async () => {
    const device = new Camera('Camera Werift Defaults', 'CAMERA-WERIFT-DEFAULTS');

    expect(await addDevice(aggregator, device)).toBeTruthy();
    expect(device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions).toEqual({ video: true, audio: true, videoSource: 'none', audioSource: 'none' });
  });
});
