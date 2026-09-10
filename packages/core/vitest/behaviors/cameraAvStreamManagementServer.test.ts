/**
 * @file vitest/behaviors/cameraAvStreamManagementServer.test.ts
 * @description This file contains the tests for the MatterbridgeCameraAvStreamManagementServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

const NAME = 'CameraAvStreamManagementServerBehavior';
const MATTER_PORT = 6003;
const MATTER_CREATE_ONLY = true;

import { StreamUsage, ThreeLevelAuto } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { loggerDebugSpy, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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

import {
  cameraColorTestJpegForResolution,
  createDefaultAudioCameraAvStreamManagementClusterServer,
  createDefaultCameraAvStreamManagementClusterServer,
  createDefaultIntercomCameraAvStreamManagementClusterServer,
  createDefaultSnapshotCameraAvStreamManagementClusterServer,
  MatterbridgeCameraAvStreamManagementServer,
} from '../../src/behaviors/cameraAvStreamManagementServer.js';
import { AudioDoorbell } from '../../src/devices/audioDoorbell.js';
import { Camera } from '../../src/devices/camera.js';
import { SnapshotCamera } from '../../src/devices/snapshotCamera.js';
import { camera as cameraDeviceType, intercom as intercomDeviceType } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

await setupTest(NAME);

describe('MatterbridgeCameraAvStreamManagementServer', () => {
  let device: SnapshotCamera;
  let priorityDevice: SnapshotCamera;
  let camera: Camera;

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

  it('should create and register a snapshot camera using the Camera AV Stream Management behavior', async () => {
    device = new SnapshotCamera('Snapshot Camera Behavior', 'CAMERA-BEHAVIOR', {
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.Recording, StreamUsage.LiveView],
    });
    expect(device.behaviors.has(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Snapshot))).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();

    // allocatedSnapshotStreams is persisted (not a constructor option); replace the self-allocated default stream
    // (see MatterbridgeCameraAvStreamManagementServer#initialize) with the fixture the tests below build on.
    await device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
    await device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', {
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      maxFrameRate: 5,
      minResolution: { width: 320, height: 240 },
      maxResolution: { width: 640, height: 480 },
      quality: 75,
    });
  });

  it('should reject setting stream priorities while a snapshot stream is allocated', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording],
      }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated');
  });

  it('should allocate a snapshot stream with the next available identifier', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', listener);
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', {
        imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
        maxFrameRate: 10,
        minResolution: { width: 320, height: 240 },
        maxResolution: { width: 1280, height: 720 },
        quality: 90,
      }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toContainEqual({
      snapshotStreamId: 1,
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      frameRate: 10,
      minResolution: { width: 320, height: 240 },
      maxResolution: { width: 1280, height: 720 },
      quality: 90,
      referenceCount: 0,
      encodedPixels: false,
      hardwareEncoder: false,
    });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('allocated snapshot stream 1'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'snapshotStreamAllocate',
        cluster: CameraAvStreamManagement.name[0].toLowerCase() + CameraAvStreamManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should reject allocating a snapshot stream with a resolution range not present in snapshotCapabilities', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', listener);
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', {
        imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
        maxFrameRate: 10,
        minResolution: { width: 100, height: 100 },
        maxResolution: { width: 200, height: 200 },
        quality: 90,
      }),
    ).rejects.toThrow('snapshotStreamAllocate requested minResolution/maxResolution range does not match any entry in snapshotCapabilities');
    expect(listener).not.toHaveBeenCalled();
  });

  it('should reuse an existing snapshot stream whose resolution range overlaps a narrower request', async () => {
    const listener = vi.fn();
    device.subscribeCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', listener);
    // Overlaps only the stream allocated above (snapshotStreamId 1, range 320x240-1280x720), not the pre-existing
    // one (snapshotStreamId 0, range 320x240-640x480), and still matches the 1280x720 snapshotCapabilities entry.
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', {
        imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
        maxFrameRate: 10,
        minResolution: { width: 700, height: 500 },
        maxResolution: { width: 1280, height: 720 },
        quality: 90,
      }),
    ).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toContainEqual(
      expect.objectContaining({ snapshotStreamId: 1, minResolution: { width: 700, height: 500 }, maxResolution: { width: 1280, height: 720 } }),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reused snapshot stream 1'));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'snapshotStreamAllocate',
        cluster: CameraAvStreamManagement.name[0].toLowerCase() + CameraAvStreamManagement.name.slice(1),
        endpoint: device,
        context: expect.anything(),
      }),
    );
  });

  it('should deallocate an existing snapshot stream', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 1 })).resolves.toBeUndefined();

    expect(device.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).not.toContainEqual(expect.objectContaining({ snapshotStreamId: 1 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('deallocated snapshot stream 1'));
  });

  it('should reject deallocation when the snapshot stream does not exist', async () => {
    await expect(device.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 99 })).rejects.toThrow(
      'snapshot stream 99 is not present in allocatedSnapshotStreams',
    );
  });

  it('should capture a snapshot using the requested stream and resolution', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'captureSnapshot', {
        snapshotStreamId: 0,
        requestedResolution: { width: 640, height: 480 },
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('capturing snapshot 0'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeCameraAvStreamManagementServer: captureSnapshot called with snapshotStreamId 0'));
  });

  it('should capture a snapshot using automatic stream selection', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'captureSnapshot', {
        snapshotStreamId: null,
        requestedResolution: { width: 1280, height: 720 },
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('capturing snapshot auto'));
  });

  it('should reject capturing a snapshot with a snapshotStreamId not present in allocatedSnapshotStreams', async () => {
    await expect(
      device.invokeBehaviorCommand(CameraAvStreamManagement, 'captureSnapshot', {
        snapshotStreamId: 77,
        requestedResolution: { width: 640, height: 480 },
      }),
    ).rejects.toThrow('snapshot stream 77 is not present in allocatedSnapshotStreams');
  });

  it.each([
    [
      { width: 640, height: 480 },
      { width: 640, height: 480 },
    ],
    [
      { width: 1280, height: 720 },
      { width: 1280, height: 720 },
    ],
    [
      { width: 1920, height: 1080 },
      { width: 1920, height: 1080 },
    ],
  ])('should return the calibration card matching a requested resolution of %o', (requestedResolution, expectedResolution) => {
    expect(cameraColorTestJpegForResolution(requestedResolution).resolution).toEqual(expectedResolution);
  });

  it('should fall back to the 640x480 calibration card for a non-standard requested resolution', () => {
    expect(cameraColorTestJpegForResolution({ width: 800, height: 600 }).resolution).toEqual({ width: 640, height: 480 });
  });

  it('should create and register a snapshot camera with no allocated streams for setStreamPriorities validation', async () => {
    priorityDevice = new SnapshotCamera('Snapshot Camera Priorities', 'CAMERA-PRIORITIES', {
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.Recording, StreamUsage.LiveView],
    });
    expect(await addDevice(aggregator, priorityDevice)).toBeTruthy();

    // A default snapshot stream is self-allocated on construction (see MatterbridgeCameraAvStreamManagementServer#initialize).
    // Deallocate it so this device starts from a genuinely empty state for the tests below.
    expect(priorityDevice.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([
      {
        snapshotStreamId: 0,
        imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
        frameRate: 10,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        quality: 90,
        referenceCount: 0,
        encodedPixels: false,
        hardwareEncoder: false,
      },
    ]);
    await priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
    expect(priorityDevice.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([]);
  });

  it('should reject capturing a snapshot with automatic selection when no snapshot stream is allocated', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'captureSnapshot', {
        snapshotStreamId: null,
        requestedResolution: { width: 640, height: 480 },
      }),
    ).rejects.toThrow('snapshot stream auto is not present in allocatedSnapshotStreams');
  });

  it('should reject setting stream priorities with an unsupported stream usage', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Analysis],
      }),
    ).rejects.toThrow('streamPriorities shall only contain entries found in supportedStreamUsages');
  });

  it('should reject setting stream priorities with duplicate values', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Recording, StreamUsage.Recording],
      }),
    ).rejects.toThrow('streamPriorities shall not contain duplicate values');
  });

  it('should replace stream usage priorities', async () => {
    await expect(
      priorityDevice.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording],
      }),
    ).resolves.toBeUndefined();

    expect(priorityDevice.getAttribute(CameraAvStreamManagement, 'streamUsagePriorities')).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('setting stream priorities to [3, 1]'));
  });

  it('should create and register a camera using the Camera AV Stream Management behavior', async () => {
    camera = new Camera('Camera Behavior', 'CAMERA-AV-BEHAVIOR', { maxConcurrentEncoders: 2 });
    expect(await addDevice(aggregator, camera)).toBeTruthy();

    // Default video/audio/snapshot streams are self-allocated on construction (see
    // MatterbridgeCameraAvStreamManagementServer#initialize). Deallocate them so this device starts from a
    // genuinely empty state for the sequential allocation tests below.
    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    await camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    await camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([expect.objectContaining({ snapshotStreamId: 0 })]);
    await camera.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([]);
    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([]);
    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([]);
  });

  it('should reject allocating a video stream with an unsupported stream usage', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Analysis,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('stream usage 2 is not present in streamUsagePriorities');
  });

  it('should reject allocating a video stream with stream usage Internal', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Internal,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('stream usage Internal is not allowed for VideoStreamAllocate');
  });

  it('should reject allocating a video stream with an invalid videoCodec', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: 10 as CameraAvStreamManagement.VideoCodec,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('videoCodec 10 is not a valid VideoCodecEnum value');
  });

  it('should reject allocating a video stream with minFrameRate greater than maxFrameRate', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 31,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('minFrameRate 31 must not be greater than MaxFrameRate 30');
  });

  it('should reject allocating a video stream with minBitRate greater than maxBitRate', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 2_000_001,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('minBitRate 2000001 must not be greater than MaxBitRate 2000000');
  });

  it('should reject allocating a video stream that does not match any rateDistortionTradeOffPoints entry', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 7680, height: 4320 },
        maxResolution: { width: 7680, height: 4320 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('videoStreamAllocate requested parameters do not match any entry in rateDistortionTradeOffPoints or exceed videoSensorParams');
  });

  it('should allocate a video stream with the next available identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toContainEqual(
      expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView, referenceCount: 0 }),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('allocated video stream 0 for usage 3'));
  });

  it('should reuse an existing video stream that matches an identical request', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toHaveLength(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reused video stream 0 for usage 3'));
  });

  it('should reject allocating a video stream that would exceed maxConcurrentEncoders', async () => {
    const singleEncoderCamera = new Camera('Camera Single Encoder', 'CAMERA-SINGLE-ENCODER');
    expect(await addDevice(aggregator, singleEncoderCamera)).toBeTruthy();

    // Deallocate the self-allocated default video stream (see MatterbridgeCameraAvStreamManagementServer#initialize)
    // so this maxConcurrentEncoders=1 device starts genuinely empty for this test.
    await singleEncoderCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });

    await expect(
      singleEncoderCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    await expect(
      singleEncoderCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).rejects.toThrow('videoStreamAllocate would exceed maxConcurrentEncoders (1)');
  });

  it('should allocate a second video stream with an incremented identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toContainEqual(
      expect.objectContaining({ videoStreamId: 1, streamUsage: StreamUsage.Recording, referenceCount: 0 }),
    );
  });

  it('should reject deallocating a video stream that does not exist', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 99 })).rejects.toThrow(
      'video stream 99 is not present in allocatedVideoStreams',
    );
  });

  it('should deallocate an existing video stream', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 1 })).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).not.toContainEqual(expect.objectContaining({ videoStreamId: 1 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('deallocated video stream 1'));
  });

  it('should reject allocating an audio stream with an unsupported stream usage', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.Analysis,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).rejects.toThrow('stream usage 2 is not present in streamUsagePriorities');
  });

  it('should reject allocating an audio stream with stream usage Internal', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.Internal,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).rejects.toThrow('stream usage Internal is not allowed for AudioStreamAllocate');
  });

  it('should reject allocating an audio stream with an invalid audioCodec', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: 10 as CameraAvStreamManagement.AudioCodec,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).rejects.toThrow('audioCodec 10 is not a valid AudioCodecEnum value');
  });

  it('should reject allocating an audio stream with an invalid bitDepth', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 48,
      }),
    ).rejects.toThrow('bitDepth 48 is not one of 8, 16, 24, 32');
  });

  it('should reject allocating an audio stream not supported by microphoneCapabilities', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 44100,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).rejects.toThrow('audioStreamAllocate requested audioCodec, channelCount, sampleRate or bitDepth is not supported by microphoneCapabilities');
  });

  it('should allocate an audio stream with the next available identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toContainEqual(
      expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView, referenceCount: 0 }),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('allocated audio stream 0 for usage 3'));
  });

  it('should reuse an existing audio stream that matches an identical request', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toHaveLength(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reused audio stream 0 for usage 3'));
  });

  it('should allocate a second audio stream with an incremented identifier', async () => {
    await expect(
      camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.Recording,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toContainEqual(
      expect.objectContaining({ audioStreamId: 1, streamUsage: StreamUsage.Recording, referenceCount: 0 }),
    );
  });

  it('should deallocate the second audio stream', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 1 })).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).not.toContainEqual(expect.objectContaining({ audioStreamId: 1 }));
  });

  it('should reject deallocating an audio stream that does not exist', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 99 })).rejects.toThrow(
      'audio stream 99 is not present in allocatedAudioStreams',
    );
  });

  it('should deallocate an existing audio stream', async () => {
    await expect(camera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 })).resolves.toBeUndefined();

    expect(camera.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).not.toContainEqual(expect.objectContaining({ audioStreamId: 0 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('deallocated audio stream 0'));
  });

  it('should reject setting stream priorities while a video stream is allocated', async () => {
    const videoOnlyCamera = new Camera('Camera Video Priorities', 'CAMERA-VIDEO-PRIORITIES');
    expect(await addDevice(aggregator, videoOnlyCamera)).toBeTruthy();

    // Deallocate all self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so only
    // the explicit video stream allocated below is present, matching this test's stated precondition.
    await videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
    await videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
    await videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

    await expect(
      videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 360 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 500_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 2000,
      }),
    ).resolves.toBeUndefined();

    await expect(
      videoOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView],
      }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated');
  });

  it('should reject setting stream priorities while an audio stream is allocated', async () => {
    const audioOnlyCamera = new Camera('Camera Audio Priorities', 'CAMERA-AUDIO-PRIORITIES');
    expect(await addDevice(aggregator, audioOnlyCamera)).toBeTruthy();

    // Deallocate all self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so only
    // the explicit audio stream allocated below is present, matching this test's stated precondition.
    await audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
    await audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
    await audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

    await expect(
      audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32000,
        bitDepth: 16,
      }),
    ).resolves.toBeUndefined();

    await expect(
      audioOnlyCamera.invokeBehaviorCommand(CameraAvStreamManagement, 'setStreamPriorities', {
        streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView],
      }),
    ).rejects.toThrow('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated');
  });

  it('should include watermarkEnabled/osdEnabled in the self-allocated default video and snapshot streams when Watermark/OnScreenDisplay are supported', async () => {
    const endpoint = new MatterbridgeEndpoint([cameraDeviceType], { id: 'WatermarkOsdDefaultStream' });
    endpoint.behaviors.require(
      MatterbridgeCameraAvStreamManagementServer.with(
        CameraAvStreamManagement.Feature.Video,
        CameraAvStreamManagement.Feature.Snapshot,
        CameraAvStreamManagement.Feature.Watermark,
        CameraAvStreamManagement.Feature.OnScreenDisplay,
      ),
      {
        maxContentBufferSize: 4_194_304,
        maxNetworkBandwidth: 10_000_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 1920 * 1080 * 30,
        videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        minViewportResolution: { width: 640, height: 360 },
        rateDistortionTradeOffPoints: [{ codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 }],
        currentFrameRate: 30,
        viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 },
        allocatedVideoStreams: [],
        snapshotCapabilities: [
          { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
          { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        ],
        allocatedSnapshotStreams: [],
        hardPrivacyModeOn: false,
        statusLightEnabled: false,
        statusLightBrightness: ThreeLevelAuto.Auto,
      },
    );
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([
      expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView, watermarkEnabled: false, osdEnabled: false }),
    ]);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([
      expect.objectContaining({ snapshotStreamId: 0, watermarkEnabled: false, osdEnabled: false }),
    ]);
  });

  it('should skip self-allocating default streams when MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT=1', async () => {
    const originalSkip = process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT;
    process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT = '1';
    try {
      const endpoint = new Camera('Camera Skip Auto Allocate', 'CAMERA-SKIP-AUTO-ALLOCATE');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([]);
      expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([]);
      expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toEqual([]);
    } finally {
      if (originalSkip === undefined) delete process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT;
      else process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT = originalSkip;
    }
  });

  it('should add createDefaultCameraAvStreamManagementClusterServer to an endpoint', () => {
    const device = new Camera('Camera Helper', 'CAMERA-HELPER');
    // The constructor already creates the CameraAvStreamManagement cluster server; calling the helper again should return the same endpoint.
    expect(
      createDefaultCameraAvStreamManagementClusterServer(device, {
        maxContentBufferSize: 4_194_304,
        maxNetworkBandwidth: 10_000_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 1920 * 1080 * 30,
        videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        minViewportResolution: { width: 640, height: 360 },
        rateDistortionTradeOffPoints: [{ codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 }],
        currentFrameRate: 30,
        viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 },
        microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
        snapshotCapabilities: [{ resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false }],
      }),
    ).toBe(device);
  });

  it('should add createDefaultAudioCameraAvStreamManagementClusterServer to an endpoint', () => {
    const device = new AudioDoorbell('Audio Doorbell Helper', 'AUDIO-DOORBELL-HELPER');
    // The constructor already creates the CameraAvStreamManagement cluster server; calling the helper again should return the same endpoint.
    expect(
      createDefaultAudioCameraAvStreamManagementClusterServer(device, {
        maxContentBufferSize: 65_536,
        maxNetworkBandwidth: 128_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      }),
    ).toBe(device);
  });

  it('should add createDefaultSnapshotCameraAvStreamManagementClusterServer to an endpoint', () => {
    const device = new SnapshotCamera('Snapshot Camera Helper', 'CAMERA-HELPER', { powerSourceType: 'None' });

    expect(
      createDefaultSnapshotCameraAvStreamManagementClusterServer(device, {
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 10000000,
        maxContentBufferSize: 1024,
        snapshotCapabilities: [{ resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false }],
        maxNetworkBandwidth: 10000,
        supportedStreamUsages: [StreamUsage.Recording],
        streamUsagePriorities: [StreamUsage.Recording],
      }),
    ).toBe(device);
  });

  it('should add createDefaultIntercomCameraAvStreamManagementClusterServer to an endpoint', async () => {
    const audioCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] };
    const endpoint = new MatterbridgeEndpoint([intercomDeviceType], { id: 'IntercomHelper' });

    expect(
      createDefaultIntercomCameraAvStreamManagementClusterServer(endpoint, {
        maxContentBufferSize: 65_536,
        maxNetworkBandwidth: 128_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        microphoneCapabilities: audioCapabilities,
        speakerCapabilities: audioCapabilities,
        twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex,
      }),
    ).toBe(endpoint);

    // TODO: use addRequiredClusters() here once the Intercom device type's required WebRtcTransportProvider/WebRtcTransportRequestor
    // client clusters have a registered client behavior: today it logs "addClusterClients: no client behavior found" warnings, which
    // this suite's afterEach rejects. The Intercom device wires those clients itself via addWebRtcTransportProviderClient()/
    // addWebRtcTransportRequestorClient(), so they are not part of this helper's contract.
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    // The Audio and Speaker features are enabled, the Video, Snapshot and ImageControl features are not.
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'microphoneCapabilities')).toEqual(audioCapabilities);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'speakerCapabilities')).toEqual(audioCapabilities);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'twoWayTalkSupport')).toBe(CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'speakerMuted')).toBe(false);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'speakerVolumeLevel')).toBe(128);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'speakerMaxLevel')).toBe(254);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'speakerMinLevel')).toBe(0);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'microphoneMuted')).toBe(false);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'microphoneVolumeLevel')).toBe(128);
    expect(endpoint.hasAttributeServer(CameraAvStreamManagement, 'allocatedVideoStreams')).toBe(false);
    expect(endpoint.hasAttributeServer(CameraAvStreamManagement, 'allocatedSnapshotStreams')).toBe(false);
    // The Audio feature self-allocates a default audio stream from microphoneCapabilities in initialize().
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([
      expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView, audioCodec: CameraAvStreamManagement.AudioCodec.Opus }),
    ]);
  });
});
