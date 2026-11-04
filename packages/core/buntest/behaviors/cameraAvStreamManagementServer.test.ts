/**
 * @file packages/core/buntest/behaviors/cameraAvStreamManagementServer.test.ts
 * @description This file contains the bun tests for cameraAvStreamManagementServer.
 * @author Luca Liguori
 */

const NAME = 'CameraAvStreamManagementServerBehavior';
const MATTER_PORT = 6003;

import { afterEach, beforeEach, describe, expect, mock, test, vi } from 'bun:test';

import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Status, StreamUsage } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerDebugSpy, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import type { WeriftOfferOptions } from '../../src/behaviors/weriftSession.js';
import type { MatterbridgeEndpoint as MatterbridgeEndpointType } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

// captureSnapshot() runs ffmpeg: replace it before the modules that import it are loaded.
const captureSnapshot = vi.fn();
const snapshotModule = await import('../../src/behaviors/snapshot.js');
await mock.module('../../src/behaviors/snapshot.js', () => ({ ...snapshotModule, captureSnapshot }));
const { TEST_SNAPSHOT_SOURCE } = snapshotModule;
const {
  createDefaultAudioCameraAvStreamManagementClusterServer,
  createDefaultCameraAvStreamManagementClusterServer,
  createDefaultIntercomCameraAvStreamManagementClusterServer,
  createDefaultSnapshotCameraAvStreamManagementClusterServer,
  MatterbridgeCameraAvStreamManagementServer,
} = await import('../../src/behaviors/cameraAvStreamManagementServer.js');
const { addWebRtcTransportProviderClient, addWebRtcTransportRequestorClient } = await import('../../src/behaviors/clients.js');
const { createDefaultWebRtcTransportProviderClusterServer, MatterbridgeWebRtcTransportProviderServer } = await import('../../src/behaviors/webRtcTransportProviderServer.js');
const { createDefaultWebRtcTransportRequestorClusterServer } = await import('../../src/behaviors/webRtcTransportRequestorServer.js');
const { AudioDoorbell } = await import('../../src/devices/audioDoorbell.js');
const { Camera } = await import('../../src/devices/camera.js');
const { SnapshotCamera } = await import('../../src/devices/snapshotCamera.js');
const { genericSwitch, intercom: intercomDeviceType } = await import('../../src/matterbridgeDeviceTypes.js');
const { MatterbridgeEndpoint } = await import('../../src/matterbridgeEndpoint.js');

const AV = CameraAvStreamManagement;
type StreamAttribute = 'allocatedVideoStreams' | 'allocatedAudioStreams' | 'allocatedSnapshotStreams';
const captured = Buffer.from('captured-jpeg');
const priorityError = 'setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated';
const video = (fields: Partial<CameraAvStreamManagement.VideoStreamAllocateRequest> = {}): CameraAvStreamManagement.VideoStreamAllocateRequest => ({
  streamUsage: StreamUsage.LiveView,
  videoCodec: AV.VideoCodec.H264,
  minFrameRate: 15,
  maxFrameRate: 30,
  minResolution: { width: 640, height: 360 },
  maxResolution: { width: 1920, height: 1080 },
  minBitRate: 500_000,
  maxBitRate: 2_000_000,
  keyFrameInterval: 2000,
  ...fields,
});
const audio = (fields: Partial<CameraAvStreamManagement.AudioStreamAllocateRequest> = {}): CameraAvStreamManagement.AudioStreamAllocateRequest => ({
  streamUsage: StreamUsage.LiveView,
  audioCodec: AV.AudioCodec.Opus,
  channelCount: 1,
  sampleRate: 48000,
  bitRate: 32000,
  bitDepth: 16,
  ...fields,
});
const opus = { maxNumberOfChannels: 1, supportedCodecs: [AV.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] };

/**
 * Reads a list of allocated streams as plain values: the attribute is a live matter.js view.
 *
 * @param {MatterbridgeEndpointType} endpoint - The endpoint.
 * @param {StreamAttribute} name - The attribute.
 * @returns {Record<string, unknown>[]} The streams.
 */
const streams = (endpoint: MatterbridgeEndpointType, name: StreamAttribute): Record<string, unknown>[] =>
  JSON.parse(JSON.stringify(endpoint.getAttribute(AV, name) ?? [])) as Record<string, unknown>[];

/**
 * Adds an endpoint and releases the streams the server self-allocated, so a test starts from none.
 *
 * @param {MatterbridgeEndpointType} endpoint - The camera.
 * @param {StreamAttribute[]} release - The kinds of self-allocated stream 0 to deallocate.
 * @returns {Promise<MatterbridgeEndpointType>} The camera.
 */
async function addAndRelease(endpoint: MatterbridgeEndpointType, release: StreamAttribute[]): Promise<MatterbridgeEndpointType> {
  expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
  if (release.includes('allocatedVideoStreams')) await endpoint.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId: 0 });
  if (release.includes('allocatedAudioStreams')) await endpoint.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 0 });
  if (release.includes('allocatedSnapshotStreams')) await endpoint.invokeBehaviorCommand(AV, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
  return endpoint;
}

describe('MatterbridgeCameraAvStreamManagementServer', () => {
  useServerNode(MATTER_PORT);

  beforeEach(() => {
    captureSnapshot.mockReset();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  test('snapshot streams are allocated, reused, validated and deallocated, and captureSnapshot reads its source', async () => {
    const device = new SnapshotCamera('Snapshot Camera Behavior', 'CAMERA-BEHAVIOR', {
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.Recording, StreamUsage.LiveView],
    });
    expect(device.behaviors.has(MatterbridgeCameraAvStreamManagementServer.with(AV.Feature.Snapshot))).toBeTruthy();
    await addAndRelease(device, ['allocatedSnapshotStreams']);
    const snapshot = (fields: object): CameraAvStreamManagement.SnapshotStreamAllocateRequest => ({
      imageCodec: AV.ImageCodec.Jpeg,
      maxFrameRate: 10,
      minResolution: { width: 320, height: 240 },
      maxResolution: { width: 1280, height: 720 },
      quality: 90,
      ...fields,
    });
    const emitted: unknown[] = [];
    device.subscribeCommand(AV, 'snapshotStreamAllocate', (data) => emitted.push(data.command));
    await device.invokeBehaviorCommand(AV, 'snapshotStreamAllocate', snapshot({ maxFrameRate: 5, maxResolution: { width: 640, height: 480 }, quality: 75 }));
    // Any allocated stream blocks SetStreamPriorities.
    expect(device.invokeBehaviorCommand(AV, 'setStreamPriorities', { streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording] })).rejects.toThrow(priorityError);

    // The next identifier is allocated, a range outside SnapshotCapabilities is rejected, an overlapping one reuses the stream.
    await device.invokeBehaviorCommand(AV, 'snapshotStreamAllocate', snapshot({}));
    expect(streams(device, 'allocatedSnapshotStreams')).toContainEqual({
      snapshotStreamId: 1,
      imageCodec: AV.ImageCodec.Jpeg,
      frameRate: 10,
      minResolution: { width: 320, height: 240 },
      maxResolution: { width: 1280, height: 720 },
      quality: 90,
      referenceCount: 0,
      encodedPixels: false,
      hardwareEncoder: false,
    });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('allocated snapshot stream 1'));
    expect(
      device.invokeBehaviorCommand(AV, 'snapshotStreamAllocate', snapshot({ minResolution: { width: 100, height: 100 }, maxResolution: { width: 200, height: 200 } })),
    ).rejects.toThrow('snapshotStreamAllocate requested minResolution/maxResolution range does not match any entry in snapshotCapabilities');
    await device.invokeBehaviorCommand(AV, 'snapshotStreamAllocate', snapshot({ minResolution: { width: 700, height: 500 } }));
    expect(streams(device, 'allocatedSnapshotStreams')).toContainEqual(
      expect.objectContaining({ snapshotStreamId: 1, minResolution: { width: 700, height: 500 }, maxResolution: { width: 1280, height: 720 } }),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reused snapshot stream 1'));
    expect(emitted).toEqual(['snapshotStreamAllocate', 'snapshotStreamAllocate', 'snapshotStreamAllocate']);
    await device.invokeBehaviorCommand(AV, 'snapshotStreamDeallocate', { snapshotStreamId: 1 });
    expect(streams(device, 'allocatedSnapshotStreams')).not.toContainEqual(expect.objectContaining({ snapshotStreamId: 1 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('deallocated snapshot stream 1'));
    expect(device.invokeBehaviorCommand(AV, 'snapshotStreamDeallocate', { snapshotStreamId: 99 })).rejects.toThrow('snapshot stream 99 is not present in allocatedSnapshotStreams');

    // Without a snapshotSource and without a WebRtcTransportProvider there is nothing to capture from.
    for (const [snapshotStreamId, label] of [
      [0, '0'],
      [null, 'auto'],
    ] as const) {
      expect(device.invokeBehaviorCommand(AV, 'captureSnapshot', { snapshotStreamId, requestedResolution: { width: 640, height: 480 } })).rejects.toThrow(
        'cannot capture snapshot: no snapshotSource is configured and the endpoint has no WebRtcTransportProvider cluster to read the video source from',
      );
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining(`capturing snapshot ${label}`));
    }
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeCameraAvStreamManagementServer: captureSnapshot called with snapshotStreamId 0'));
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('cannot capture snapshot: no snapshotSource is configured and the endpoint has no WebRtcTransportProvider cluster'),
    );
    expect(captureSnapshot).not.toHaveBeenCalled();
    expect(device.invokeBehaviorCommand(AV, 'captureSnapshot', { snapshotStreamId: 77, requestedResolution: { width: 640, height: 480 } })).rejects.toThrow(
      'snapshot stream 77 is not present in allocatedSnapshotStreams',
    );

    // A snapshotSource configured on the cluster: the test pattern, or the configured device.
    const server = MatterbridgeCameraAvStreamManagementServer.with(AV.Feature.Snapshot);
    const capture = async (): Promise<CameraAvStreamManagement.CaptureSnapshotResponse> =>
      device.act(async (agent) => agent.get(MatterbridgeCameraAvStreamManagementServer).captureSnapshot({ snapshotStreamId: 0, requestedResolution: { width: 640, height: 480 } }));
    captureSnapshot.mockResolvedValue({ data: captured, byteLength: captured.length, width: 640, height: 480, quality: 6, downgraded: false });
    await device.setStateOf(server, { snapshotSource: 'test' });
    expect(await capture()).toEqual({ data: captured, imageCodec: AV.ImageCodec.Jpeg, resolution: { width: 640, height: 480 } });
    expect(captureSnapshot).toHaveBeenLastCalledWith({ src: TEST_SNAPSHOT_SOURCE, width: 640, height: 480 });
    for (const [snapshotSource, snapshotSourceDevice] of [
      ['webcam', '/dev/video0'],
      ['rtsp', 'rtsp://user:pass@camera/stream'],
    ] as const) {
      await device.setStateOf(server, { snapshotSource, snapshotSourceDevice });
      await capture();
      expect(captureSnapshot).toHaveBeenLastCalledWith({ src: snapshotSourceDevice, width: 640, height: 480 });
    }
    captureSnapshot.mockClear();
    await device.setStateOf(server, { snapshotSource: 'webcam', snapshotSourceDevice: undefined });
    expect(capture()).rejects.toMatchObject({ code: Status.Failure, message: expect.stringContaining('snapshotSource=webcam requires snapshotSourceDevice to be set') });
    expect(captureSnapshot).not.toHaveBeenCalled();
    await device.setStateOf(server, { snapshotSource: undefined, snapshotSourceDevice: undefined });
    loggerErrorSpy.mockClear();
  });

  test('setStreamPriorities validates the priorities once no stream is allocated', async () => {
    const device = new SnapshotCamera('Snapshot Camera Priorities', 'CAMERA-PRIORITIES', {
      supportedStreamUsages: [StreamUsage.Recording, StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.Recording, StreamUsage.LiveView],
    });
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(streams(device, 'allocatedSnapshotStreams')).toEqual([
      {
        snapshotStreamId: 0,
        imageCodec: AV.ImageCodec.Jpeg,
        frameRate: 10,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        quality: 90,
        referenceCount: 0,
        encodedPixels: false,
        hardwareEncoder: false,
      },
    ]);
    await device.invokeBehaviorCommand(AV, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
    expect(streams(device, 'allocatedSnapshotStreams')).toEqual([]);
    expect(device.invokeBehaviorCommand(AV, 'captureSnapshot', { snapshotStreamId: null, requestedResolution: { width: 640, height: 480 } })).rejects.toThrow(
      'snapshot stream auto is not present in allocatedSnapshotStreams',
    );
    expect(device.invokeBehaviorCommand(AV, 'setStreamPriorities', { streamPriorities: [StreamUsage.Analysis] })).rejects.toThrow(
      'streamPriorities shall only contain entries found in supportedStreamUsages',
    );
    expect(device.invokeBehaviorCommand(AV, 'setStreamPriorities', { streamPriorities: [StreamUsage.Recording, StreamUsage.Recording] })).rejects.toThrow(
      'streamPriorities shall not contain duplicate values',
    );
    await device.invokeBehaviorCommand(AV, 'setStreamPriorities', { streamPriorities: [StreamUsage.LiveView, StreamUsage.Recording] });
    expect([...(device.getAttribute(AV, 'streamUsagePriorities') ?? [])]).toEqual([StreamUsage.LiveView, StreamUsage.Recording]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('setting stream priorities to [3, 1]'));
  });

  test('a camera self-allocates one stream of each kind, all released by the deallocate commands', async () => {
    const camera = new Camera('Camera Behavior', 'CAMERA-AV-BEHAVIOR', { maxConcurrentEncoders: 2 });
    expect(await addBridgedDevice(aggregator, camera, 0, 0, 0, 0)).toBeTruthy();
    expect(streams(camera, 'allocatedVideoStreams')).toEqual([expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    expect(streams(camera, 'allocatedAudioStreams')).toEqual([expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    expect(streams(camera, 'allocatedSnapshotStreams')).toEqual([expect.objectContaining({ snapshotStreamId: 0 })]);
    for (const [command, field] of [
      ['videoStreamDeallocate', 'videoStreamId'],
      ['audioStreamDeallocate', 'audioStreamId'],
      ['snapshotStreamDeallocate', 'snapshotStreamId'],
    ] as const) {
      await camera.invokeBehaviorCommand(AV, command, { [field]: 0 } as never);
    }
    for (const name of ['allocatedVideoStreams', 'allocatedAudioStreams', 'allocatedSnapshotStreams'] as const) expect(streams(camera, name)).toEqual([]);

    // Video: invalid requests are rejected, then streams are allocated, reused and deallocated.
    const videoRejections: [Partial<CameraAvStreamManagement.VideoStreamAllocateRequest>, string][] = [
      [{ streamUsage: StreamUsage.Analysis }, 'stream usage 2 is not present in streamUsagePriorities'],
      [{ streamUsage: StreamUsage.Internal }, 'stream usage Internal is not allowed for VideoStreamAllocate'],
      // oxlint-disable-next-line typescript/no-unsafe-enum-assignment
      [{ videoCodec: 10 as CameraAvStreamManagement.VideoCodec }, 'videoCodec 10 is not a valid VideoCodecEnum value'],
      [{ minFrameRate: 31 }, 'minFrameRate 31 must not be greater than MaxFrameRate 30'],
      [{ minBitRate: 2_000_001 }, 'minBitRate 2000001 must not be greater than MaxBitRate 2000000'],
      [
        { minResolution: { width: 7680, height: 4320 }, maxResolution: { width: 7680, height: 4320 } },
        'videoStreamAllocate requested parameters do not match any entry in rateDistortionTradeOffPoints or exceed videoSensorParams',
      ],
    ];
    for (const [fields, message] of videoRejections) expect(camera.invokeBehaviorCommand(AV, 'videoStreamAllocate', video(fields))).rejects.toThrow(message);
    await camera.invokeBehaviorCommand(AV, 'videoStreamAllocate', video());
    expect(streams(camera, 'allocatedVideoStreams')).toContainEqual(expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView, referenceCount: 0 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('allocated video stream 0 for usage 3'));
    await camera.invokeBehaviorCommand(AV, 'videoStreamAllocate', video());
    expect(streams(camera, 'allocatedVideoStreams')).toHaveLength(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reused video stream 0 for usage 3'));
    await camera.invokeBehaviorCommand(AV, 'videoStreamAllocate', video({ streamUsage: StreamUsage.Recording }));
    expect(streams(camera, 'allocatedVideoStreams')).toContainEqual(expect.objectContaining({ videoStreamId: 1, streamUsage: StreamUsage.Recording, referenceCount: 0 }));
    expect(camera.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId: 99 })).rejects.toThrow('video stream 99 is not present in allocatedVideoStreams');
    await camera.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId: 1 });
    expect(streams(camera, 'allocatedVideoStreams')).not.toContainEqual(expect.objectContaining({ videoStreamId: 1 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('deallocated video stream 1'));

    // Audio: the same flow.
    const audioRejections: [Partial<CameraAvStreamManagement.AudioStreamAllocateRequest>, string][] = [
      [{ streamUsage: StreamUsage.Analysis }, 'stream usage 2 is not present in streamUsagePriorities'],
      [{ streamUsage: StreamUsage.Internal }, 'stream usage Internal is not allowed for AudioStreamAllocate'],
      // oxlint-disable-next-line typescript/no-unsafe-enum-assignment
      [{ audioCodec: 10 as CameraAvStreamManagement.AudioCodec }, 'audioCodec 10 is not a valid AudioCodecEnum value'],
      [{ bitDepth: 48 }, 'bitDepth 48 is not one of 8, 16, 24, 32'],
      [{ sampleRate: 44100 }, 'audioStreamAllocate requested audioCodec, channelCount, sampleRate or bitDepth is not supported by microphoneCapabilities'],
    ];
    for (const [fields, message] of audioRejections) expect(camera.invokeBehaviorCommand(AV, 'audioStreamAllocate', audio(fields))).rejects.toThrow(message);
    await camera.invokeBehaviorCommand(AV, 'audioStreamAllocate', audio());
    expect(streams(camera, 'allocatedAudioStreams')).toContainEqual(expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView, referenceCount: 0 }));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('allocated audio stream 0 for usage 3'));
    await camera.invokeBehaviorCommand(AV, 'audioStreamAllocate', audio());
    expect(streams(camera, 'allocatedAudioStreams')).toHaveLength(1);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('reused audio stream 0 for usage 3'));
    await camera.invokeBehaviorCommand(AV, 'audioStreamAllocate', audio({ streamUsage: StreamUsage.Recording }));
    expect(streams(camera, 'allocatedAudioStreams')).toContainEqual(expect.objectContaining({ audioStreamId: 1, streamUsage: StreamUsage.Recording, referenceCount: 0 }));
    await camera.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 1 });
    expect(camera.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 99 })).rejects.toThrow('audio stream 99 is not present in allocatedAudioStreams');
    await camera.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 0 });
    expect(streams(camera, 'allocatedAudioStreams')).toEqual([]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('deallocated audio stream 0'));
  });

  test('MaxConcurrentEncoders, and an allocated video or audio stream blocking SetStreamPriorities', async () => {
    const single = await addAndRelease(new Camera('Camera Single Encoder', 'CAMERA-SINGLE-ENCODER'), ['allocatedVideoStreams']);
    await single.invokeBehaviorCommand(AV, 'videoStreamAllocate', video());
    expect(single.invokeBehaviorCommand(AV, 'videoStreamAllocate', video({ streamUsage: StreamUsage.Recording }))).rejects.toThrow(
      'videoStreamAllocate would exceed maxConcurrentEncoders (1)',
    );

    const all: StreamAttribute[] = ['allocatedVideoStreams', 'allocatedAudioStreams', 'allocatedSnapshotStreams'];
    const videoOnly = await addAndRelease(new Camera('Camera Video Priorities', 'CAMERA-VIDEO-PRIORITIES'), all);
    await videoOnly.invokeBehaviorCommand(AV, 'videoStreamAllocate', video());
    expect(videoOnly.invokeBehaviorCommand(AV, 'setStreamPriorities', { streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView] })).rejects.toThrow(priorityError);
    const audioOnly = await addAndRelease(new Camera('Camera Audio Priorities', 'CAMERA-AUDIO-PRIORITIES'), all);
    await audioOnly.invokeBehaviorCommand(AV, 'audioStreamAllocate', audio());
    expect(audioOnly.invokeBehaviorCommand(AV, 'setStreamPriorities', { streamPriorities: [StreamUsage.Recording, StreamUsage.LiveView] })).rejects.toThrow(priorityError);
  });

  test('the default streams: no watermark or OSD, the full snapshot range, and none with the skip variable', async () => {
    const plain = new Camera('Camera Default Stream Features', 'CAMERA-DEFAULT-STREAM-FEATURES');
    expect(await addBridgedDevice(aggregator, plain, 0, 0, 0, 0)).toBeTruthy();
    expect(plain.getAttribute(AV.id, 'featureMap')).toMatchObject({ watermark: false, onScreenDisplay: false });
    const [videoStream] = streams(plain, 'allocatedVideoStreams');
    const [snapshotStream] = streams(plain, 'allocatedSnapshotStreams');
    for (const stream of [videoStream, snapshotStream]) expect([stream.watermarkEnabled, stream.osdEnabled]).toEqual([undefined, undefined]);
    expect(plain.getAttribute(AV.id, 'acceptedCommandList')).not.toContain(0x05);
    expect(plain.getAttribute(AV.id, 'acceptedCommandList')).not.toContain(0x09);

    // Unsorted SnapshotCapabilities: the default stream spans the smallest to the largest.
    const capability = (width: number, height: number, maxFrameRate: number): CameraAvStreamManagement.SnapshotCapabilities => ({
      resolution: { width, height },
      maxFrameRate,
      imageCodec: AV.ImageCodec.Jpeg,
      requiresEncodedPixels: false,
    });
    const unsorted = new Camera('Camera Unsorted Snapshots', 'CAMERA-UNSORTED-SNAPSHOTS', {
      snapshotCapabilities: [capability(1280, 720, 5), capability(640, 480, 10), capability(1920, 1080, 15)],
    });
    expect(await addBridgedDevice(aggregator, unsorted, 0, 0, 0, 0)).toBeTruthy();
    expect(streams(unsorted, 'allocatedSnapshotStreams')).toEqual([
      expect.objectContaining({ snapshotStreamId: 0, minResolution: { width: 640, height: 480 }, maxResolution: { width: 1920, height: 1080 }, frameRate: 15 }),
    ]);

    const originalSkip = process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT;
    process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT = '1';
    try {
      const skipped = new Camera('Camera Skip Auto Allocate', 'CAMERA-SKIP-AUTO-ALLOCATE');
      expect(await addBridgedDevice(aggregator, skipped, 0, 0, 0, 0)).toBeTruthy();
      for (const name of ['allocatedVideoStreams', 'allocatedAudioStreams', 'allocatedSnapshotStreams'] as const) expect(streams(skipped, name)).toEqual([]);
    } finally {
      if (originalSkip === undefined) delete process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT;
      else process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT = originalSkip;
    }
  });

  test('captureSnapshot reads the WebRtcTransportProvider video source', async () => {
    const camera = new Camera('Camera Snapshot Source', 'CAMERA-SNAPSHOT-SOURCE', {
      weriftOfferOptions: { offerVideo: true, offerAudio: false, videoSource: 'test', audioSource: 'none' },
    });
    expect(await addBridgedDevice(aggregator, camera, 0, 0, 0, 0)).toBeTruthy();
    const request = { snapshotStreamId: null, requestedResolution: { width: 1920, height: 1080 } };
    const capture = async (): Promise<CameraAvStreamManagement.CaptureSnapshotResponse> =>
      camera.act(async (agent) => agent.get(MatterbridgeCameraAvStreamManagementServer).captureSnapshot(request));
    const setVideoSource = async (options: Partial<WeriftOfferOptions>): Promise<void> => {
      const original = camera.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions;
      await camera.setStateOf(MatterbridgeWebRtcTransportProviderServer, { weriftOfferOptions: { ...original, ...options } });
    };
    const fullHd = { data: captured, byteLength: captured.length, width: 1920, height: 1080, quality: 6, downgraded: false };
    captureSnapshot.mockResolvedValue(fullHd);

    expect(await capture()).toEqual({ data: captured, imageCodec: AV.ImageCodec.Jpeg, resolution: { width: 1920, height: 1080 } });
    expect(captureSnapshot).toHaveBeenLastCalledWith({ src: TEST_SNAPSHOT_SOURCE, width: 1920, height: 1080 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('captured snapshot 13B at 1920x1080, quality 6 (endpoint'));
    for (const [videoSource, videoSourceDevice] of [
      ['webcam', '/dev/video0'],
      ['rtsp', 'rtsp://user:pass@camera/stream'],
    ] as const) {
      await setVideoSource({ videoSource, videoSourceDevice });
      await capture();
      expect(captureSnapshot).toHaveBeenLastCalledWith({ src: videoSourceDevice, width: 1920, height: 1080 });
      // Without the device it is rejected before capturing.
      captureSnapshot.mockClear();
      await setVideoSource({ videoSource, videoSourceDevice: undefined });
      expect(capture()).rejects.toThrow(`cannot capture snapshot: weriftOfferOptions.videoSource=${videoSource} requires videoSourceDevice to be set`);
      expect(captureSnapshot).not.toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`weriftOfferOptions.videoSource=${videoSource} requires videoSourceDevice to be set`));
      loggerErrorSpy.mockClear();
    }

    // A downgraded capture reports the derived height.
    await setVideoSource({ videoSource: 'test' });
    captureSnapshot.mockResolvedValue({ ...fullHd, width: 640, height: -1, quality: 31, downgraded: true });
    expect((await capture()).resolution).toEqual({ width: 640, height: 360 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('captured snapshot 13B at 640x360, quality 31 (downgraded)'));
    // A failed capture, an Error or not, is FAILURE.
    for (const [rejection, message] of [
      [new Error('Cannot capture snapshot: missing dependency ffmpeg'), 'snapshot capture failed: Cannot capture snapshot: missing dependency ffmpeg'],
      ['ffmpeg crashed', 'snapshot capture failed: ffmpeg crashed'],
    ] as const) {
      captureSnapshot.mockRejectedValue(rejection);
      expect(capture()).rejects.toMatchObject({ code: Status.Failure, message: expect.stringContaining(message) });
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(message));
      loggerErrorSpy.mockClear();
    }
    // videoSource none has no source at all.
    captureSnapshot.mockClear();
    await setVideoSource({ videoSource: 'none' });
    expect(capture()).rejects.toMatchObject({ code: Status.Failure, message: expect.stringContaining('weriftOfferOptions.videoSource=none provides no video source') });
    expect(captureSnapshot).not.toHaveBeenCalled();
    loggerErrorSpy.mockClear();
  });

  test('the create helpers return the endpoint, and the intercom variant has audio but no video or snapshot', async () => {
    const jpeg = { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: AV.ImageCodec.Jpeg, requiresEncodedPixels: false };
    const camera = new Camera('Camera Helper', 'CAMERA-HELPER');
    expect(
      createDefaultCameraAvStreamManagementClusterServer(camera, {
        maxContentBufferSize: 4_194_304,
        maxNetworkBandwidth: 10_000_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 1920 * 1080 * 30,
        videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
        minViewportResolution: { width: 640, height: 360 },
        rateDistortionTradeOffPoints: [{ codec: AV.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 }],
        currentFrameRate: 30,
        viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 },
        microphoneCapabilities: opus,
        snapshotCapabilities: [jpeg],
      }),
    ).toBe(camera);
    const doorbell = new AudioDoorbell('Audio Doorbell Helper', 'AUDIO-DOORBELL-HELPER');
    expect(
      createDefaultAudioCameraAvStreamManagementClusterServer(doorbell, {
        maxContentBufferSize: 65_536,
        maxNetworkBandwidth: 128_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        microphoneCapabilities: opus,
      }),
    ).toBe(doorbell);
    const snapshotCamera = new SnapshotCamera('Snapshot Camera Helper', 'CAMERA-HELPER', { powerSourceType: 'None' });
    expect(
      createDefaultSnapshotCameraAvStreamManagementClusterServer(snapshotCamera, {
        maxConcurrentEncoders: 1,
        maxEncodedPixelRate: 10000000,
        maxContentBufferSize: 1024,
        snapshotCapabilities: [jpeg],
        maxNetworkBandwidth: 10000,
        supportedStreamUsages: [StreamUsage.Recording],
        streamUsagePriorities: [StreamUsage.Recording],
      }),
    ).toBe(snapshotCamera);

    const intercom = new MatterbridgeEndpoint([intercomDeviceType], { id: 'IntercomHelper' });
    expect(
      createDefaultIntercomCameraAvStreamManagementClusterServer(intercom, {
        maxContentBufferSize: 65_536,
        maxNetworkBandwidth: 128_000,
        supportedStreamUsages: [StreamUsage.LiveView],
        streamUsagePriorities: [StreamUsage.LiveView],
        microphoneCapabilities: opus,
        speakerCapabilities: opus,
        twoWayTalkSupport: AV.TwoWayTalkSupportType.FullDuplex,
      }),
    ).toBe(intercom);
    createDefaultWebRtcTransportProviderClusterServer(intercom);
    createDefaultWebRtcTransportRequestorClusterServer(intercom);
    addWebRtcTransportProviderClient(intercom);
    addWebRtcTransportRequestorClient(intercom);
    intercom.addChildDeviceType('Switch', genericSwitch).createDefaultIdentifyClusterServer().createDefaultMomentarySwitchClusterServer();
    intercom.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, intercom, 0, 0, 0, 0)).toBeTruthy();
    const read = (name: string): unknown => JSON.parse(JSON.stringify(intercom.getAttribute(AV.id, name)));
    expect([read('microphoneCapabilities'), read('speakerCapabilities'), read('twoWayTalkSupport')]).toEqual([opus, opus, AV.TwoWayTalkSupportType.FullDuplex]);
    expect(['speakerMuted', 'speakerVolumeLevel', 'speakerMaxLevel', 'speakerMinLevel', 'microphoneMuted', 'microphoneVolumeLevel'].map(read)).toEqual([
      false,
      128,
      254,
      0,
      false,
      128,
    ]);
    expect(intercom.hasAttributeServer(AV, 'allocatedVideoStreams')).toBe(false);
    expect(intercom.hasAttributeServer(AV, 'allocatedSnapshotStreams')).toBe(false);
    expect(streams(intercom, 'allocatedAudioStreams')).toEqual([expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView, audioCodec: AV.AudioCodec.Opus })]);
  });
});
