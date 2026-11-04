/**
 * @file packages/core/buntest/behaviors/webRtcTransportProviderServer.test.ts
 * @description This file contains the bun tests for webRtcTransportProviderServer.
 * @author Luca Liguori
 */

const NAME = 'WebRtcTransportProviderServerBehavior';
const MATTER_PORT = 6005;

import { afterEach, describe, expect, setDefaultTimeout, spyOn, test, vi } from 'bun:test';

import { Node } from '@matter/main';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { WebRtcTransportDefinitions } from '@matter/types/clusters/web-rtc-transport-definitions';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { EndpointNumber, FabricIndex, NodeId } from '@matter/types/datatype';
import { StreamUsage, ThreeLevelAuto } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerDebugSpy, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerNoticeSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeCameraAvStreamManagementServer } from '../../src/behaviors/cameraAvStreamManagementServer.js';
import {
  allocateWebRtcSessionId,
  closeWebRtcSessions,
  createDefaultWebRtcTransportProviderClusterServer,
  MatterbridgeWebRtcTransportProviderServer,
} from '../../src/behaviors/webRtcTransportProviderServer.js';
import { Camera } from '../../src/devices/camera.js';
import { FloodlightCamera } from '../../src/devices/floodlightCamera.js';
import { bridgedNode, camera } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { internalFor } from '../../src/matterbridgeEndpointHelpers.js';
import { advanceTimersByTimeAsync, useServerNode, waitFor } from '../bunUtils.js';

await setupTest(NAME, false);
setDefaultTimeout(30_000);

const AV = CameraAvStreamManagement;
const WEBRTC = WebRtcTransportProvider;
const NO_VIDEO_CODEC = 'No injectable video codec available on negotiated transceivers';
const hangup = WebRtcTransportDefinitions.WebRtcEndReason.UserHangup;
type SessionFields = { id: number; streamUsage: number; videoStreams?: number[]; audioStreams?: number[] };

/**
 * Checks that every logged warning is one of the expected ones, then clears them.
 *
 * @param {...string} expected - The expected warning fragments.
 * @returns {void}
 */
function clearExpectedWarnings(...expected: string[]): void {
  expect(loggerWarnSpy.mock.calls.filter(([message]) => !expected.some((fragment) => message.includes(fragment)))).toEqual([]);
  loggerWarnSpy.mockClear();
}

/**
 * Reads the CurrentSessions of an endpoint as plain values.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint.
 * @returns {SessionFields[]} The sessions.
 */
const sessions = (endpoint: MatterbridgeEndpoint): SessionFields[] =>
  JSON.parse(
    JSON.stringify(endpoint.getAttribute(WEBRTC, 'currentSessions') ?? [], (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value)),
  ) as SessionFields[];
const lastSession = (endpoint: MatterbridgeEndpoint): SessionFields => sessions(endpoint).toReversed()[0];
const referenceCount = (endpoint: MatterbridgeEndpoint, name: 'allocatedVideoStreams' | 'allocatedAudioStreams'): unknown =>
  (endpoint.getAttribute(AV, name)?.[0] as { referenceCount?: number } | undefined)?.referenceCount;
const solicit = async (endpoint: MatterbridgeEndpoint, fields: Record<string, unknown> = {}): Promise<unknown> =>
  endpoint.invokeBehaviorCommand(WEBRTC, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), ...fields } as never);
const provide = async (endpoint: MatterbridgeEndpoint, fields: Record<string, unknown> = {}): Promise<unknown> =>
  endpoint.invokeBehaviorCommand(WEBRTC, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', ...fields } as never);
const end = async (endpoint: MatterbridgeEndpoint, webRtcSessionId: number): Promise<unknown> =>
  endpoint.invokeBehaviorCommand(WEBRTC, 'endSession', { webRtcSessionId, reason: hangup });
const logged = (spy: typeof loggerInfoSpy, text: string): void => expect(spy).toHaveBeenCalledWith(expect.stringContaining(text));

/**
 * Creates and adds a bridged node with only the WebRtcTransportProvider server.
 *
 * @param {string} id - The endpoint id.
 * @returns {Promise<MatterbridgeEndpoint>} The endpoint.
 */
async function addProviderOnly(id: string): Promise<MatterbridgeEndpoint> {
  const endpoint = new MatterbridgeEndpoint([bridgedNode], { id });
  createDefaultWebRtcTransportProviderClusterServer(endpoint);
  endpoint.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
  return endpoint;
}

/**
 * Creates and adds a camera, optionally deallocating its self-allocated default streams.
 *
 * @param {string} name - The camera name, also used as serial number.
 * @param {Array<'video' | 'audio' | 'snapshot'>} [deallocate] - The default streams to deallocate.
 * @returns {Promise<Camera>} The camera.
 */
async function addCamera(name: string, deallocate: Array<'video' | 'audio' | 'snapshot'> = []): Promise<Camera> {
  const endpoint = new Camera(name, name.toUpperCase().replaceAll(' ', '-'));
  expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
  if (deallocate.includes('video')) await endpoint.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId: 0 });
  if (deallocate.includes('audio')) await endpoint.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 0 });
  if (deallocate.includes('snapshot')) await endpoint.invokeBehaviorCommand(AV, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
  return endpoint;
}

/**
 * Allocates a LiveView H264 video stream.
 *
 * @param {MatterbridgeEndpoint} endpoint - The camera endpoint.
 * @returns {Promise<number>} The id of the first allocated video stream.
 */
async function allocateVideo(endpoint: MatterbridgeEndpoint): Promise<number> {
  await endpoint.invokeBehaviorCommand(AV, 'videoStreamAllocate', {
    streamUsage: StreamUsage.LiveView,
    videoCodec: AV.VideoCodec.H264,
    minFrameRate: 15,
    maxFrameRate: 30,
    minResolution: { width: 640, height: 480 },
    maxResolution: { width: 1920, height: 1080 },
    minBitRate: 1_000_000,
    maxBitRate: 2_000_000,
    keyFrameInterval: 4000,
  });
  return (endpoint.getAttribute(AV, 'allocatedVideoStreams') ?? [])[0].videoStreamId;
}

/**
 * Runs a test step with MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1, restoring the previous value afterwards.
 *
 * @param {() => Promise<void>} run - The test step.
 * @returns {Promise<void>} Resolves once the step has run.
 */
async function withStrict(run: () => Promise<void>): Promise<void> {
  const original = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
  process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
  try {
    await run();
  } finally {
    if (original === undefined) Reflect.deleteProperty(process.env, 'MATTERBRIDGE_STRICT_WEBRTCTRANSPORT');
    else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = original;
  }
}

describe('MatterbridgeWebRtcTransportProviderServer', () => {
  useServerNode(MATTER_PORT);
  let device: Camera;

  afterEach(() => {
    vi.useRealTimers();
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  test('with nothing allocated, automatic assignment creates a new video and audio stream', async () => {
    device = new Camera('WebRtc Behavior', 'WEBRTC-BEHAVIOR', { maxConcurrentEncoders: 10 });
    expect(device.behaviors.has(MatterbridgeWebRtcTransportProviderServer)).toBeTruthy();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();

    const empty = new Camera('WebRtc Auto Create', 'WEBRTC-AUTO-CREATE');
    expect(await addBridgedDevice(aggregator, empty, 0, 0, 0, 0)).toBeTruthy();
    await empty.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId: 0 });
    await empty.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 0 });
    await empty.invokeBehaviorCommand(AV, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
    await solicit(empty);
    clearExpectedWarnings(NO_VIDEO_CODEC);
    expect([referenceCount(empty, 'allocatedVideoStreams'), referenceCount(empty, 'allocatedAudioStreams')]).toEqual([1, 1]);
    expect(sessions(empty)[0]).toMatchObject({ videoStreams: [0], audioStreams: [0] });
  });

  test('sessions are solicited and provided, track the stream reference counts, and end', async () => {
    // Session 0: automatic assignment, which holds the streams until it ends.
    await solicit(device);
    logged(loggerInfoSpy, 'MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 0');
    expect(sessions(device)[0]).toMatchObject({ videoStreams: [0], audioStreams: [0] });
    clearExpectedWarnings(NO_VIDEO_CODEC);
    expect([referenceCount(device, 'allocatedVideoStreams'), referenceCount(device, 'allocatedAudioStreams')]).toEqual([1, 1]);
    expect(device.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId: 0 })).rejects.toThrow('video stream 0 is in use');
    expect(device.invokeBehaviorCommand(AV, 'audioStreamDeallocate', { audioStreamId: 0 })).rejects.toThrow('audio stream 0 is in use');
    await end(device, 0);
    expect([referenceCount(device, 'allocatedVideoStreams'), referenceCount(device, 'allocatedAudioStreams')]).toEqual([0, 0]);

    // Sessions 1 and 2 are solicited and announced; 2 is ended.
    const emitted: string[] = [];
    device.subscribeCommand(WEBRTC, 'solicitOffer', (data) => emitted.push(data.command));
    device.subscribeCommand(WEBRTC, 'endSession', (data) => emitted.push(data.command));
    await solicit(device, { videoStreams: [0] });
    logged(loggerInfoSpy, 'solicited a WebRTC offer for session 1');
    expect(sessions(device)).toMatchObject([{ id: 1, streamUsage: StreamUsage.LiveView }]);
    clearExpectedWarnings(NO_VIDEO_CODEC);
    await solicit(device, { streamUsage: StreamUsage.Recording, audioStreams: [0] });
    logged(loggerInfoSpy, 'solicited a WebRTC offer for session 2');
    await end(device, 2);
    expect(sessions(device).map((session) => session.id)).toEqual([1]);
    expect(emitted).toEqual(['solicitOffer', 'solicitOffer', 'endSession']);

    // Session 3: a provided offer with automatic assignment.
    await provide(device);
    logged(loggerInfoSpy, 'MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 3');
    expect(sessions(device)[1]).toMatchObject({ videoStreams: [0], audioStreams: [0] });
    expect([referenceCount(device, 'allocatedVideoStreams'), referenceCount(device, 'allocatedAudioStreams')]).toEqual([2, 1]);
    await end(device, 3);

    // Session 4 (kept), 5 with the default usage, 6 and 7 with the deprecated single stream ids.
    await provide(device, { streamUsage: StreamUsage.Recording, audioStreams: [0] });
    logged(loggerInfoSpy, 'received an SDP offer for session 4');
    expect(lastSession(device).id).toBe(4);
    await provide(device, { videoStreams: [0] });
    expect(lastSession(device)).toMatchObject({ id: 5, streamUsage: StreamUsage.LiveView });
    await end(device, 5);
    await provide(device, { videoStreamId: 0, audioStreamId: null });
    expect(lastSession(device)).toMatchObject({ id: 6, videoStreams: [0] });
    expect(lastSession(device).audioStreams).toBeUndefined();
    await end(device, 6);
    await provide(device, { audioStreamId: 1 });
    expect(lastSession(device)).toMatchObject({ id: 7, audioStreams: [1] });
    await end(device, 7);
    expect(sessions(device)).toHaveLength(2);

    // A null deprecated videoStreamId with no resolved video stream is echoed as no video.
    await provide(device, { videoStreamId: null, audioStreamId: 5 });
    expect(lastSession(device).videoStreams).toBeUndefined();
    expect(lastSession(device).audioStreams).toEqual([5]);
    await end(device, lastSession(device).id);
    // Only a null deprecated audioStreamId still assigns both streams automatically.
    await solicit(device, { audioStreamId: null });
    expect(lastSession(device)).toMatchObject({ videoStreams: [0], audioStreams: [0] });
    clearExpectedWarnings(NO_VIDEO_CODEC);
    await end(device, lastSession(device).id);
  });

  test('an existing session takes a new offer, an answer and ICE candidates; unknown sessions are rejected', async () => {
    await solicit(device, { videoStreams: [0] });
    clearExpectedWarnings(NO_VIDEO_CODEC);
    const existing = lastSession(device).id;
    await provide(device, { webRtcSessionId: existing, sdp: 'v=0 o=- re-offer' });
    logged(loggerInfoSpy, `MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session ${existing}`);
    clearExpectedWarnings(NO_VIDEO_CODEC);
    // A peer requestor that cannot be resolved with a non-Error reason is logged.
    spyOn(Node, 'forEndpoint').mockImplementationOnce(() => {
      // oxlint-disable-next-line typescript/only-throw-error -- the non-Error reason is the case under test.
      throw 'boom';
    });
    await provide(device, { webRtcSessionId: existing, sdp: 'v=0 o=- re-offer' });
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/could not resolve peer WebRtcTransportRequestor endpoint.*boom/));
    clearExpectedWarnings();
    await end(device, existing);
    expect(provide(device, { webRtcSessionId: 99 })).rejects.toThrow('webRTC session 99 is not present in currentSessions');

    await device.invokeBehaviorCommand(WEBRTC, 'provideIceCandidates', {
      webRtcSessionId: 1,
      iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
    });
    logged(loggerInfoSpy, 'MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: received 1 ICE candidate(s) for session 1');

    await solicit(device, { videoStreams: [0] });
    clearExpectedWarnings(NO_VIDEO_CODEC);
    const answered = lastSession(device).id;
    await device.invokeBehaviorCommand(WEBRTC, 'provideAnswer', { webRtcSessionId: answered, sdp: 'v=0 o=- answer' });
    logged(loggerInfoSpy, `MatterbridgeWebRtcTransportProviderServer.provideAnswer: received an SDP answer for session ${answered}`);
    await end(device, answered);

    for (const [command, request, message] of [
      [
        'provideAnswer',
        { webRtcSessionId: 99, sdp: 'v=0 o=- answer' },
        'MatterbridgeWebRtcTransportProviderServer.provideAnswer: webRTC session 99 is not present in currentSessions',
      ],
      [
        'provideIceCandidates',
        { webRtcSessionId: 99, iceCandidates: [] },
        'MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: webRTC session 99 is not present in currentSessions',
      ],
      ['endSession', { webRtcSessionId: 99, reason: hangup }, 'MatterbridgeWebRtcTransportProviderServer.endSession: webRTC session 99 is not present in currentSessions'],
    ] as const) {
      expect(device.invokeBehaviorCommand(WEBRTC, command, request as never)).rejects.toThrow(message);
    }
  });

  test('ICE candidates are applied concurrently, an mDNS host is delegated to werift, failures and timeouts warn', async () => {
    const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
    const peer = internal?.sessions.get(1);
    if (!peer) throw new Error('session 1 has no peer connection');
    const provideCandidates = async (iceCandidates: { candidate: string; sdpMid: null; sdpmLineIndex: number | null }[]): Promise<unknown> =>
      device.invokeBehaviorCommand(WEBRTC, 'provideIceCandidates', { webRtcSessionId: 1, iceCandidates });
    const warned = (text: string): boolean => loggerWarnSpy.mock.calls.some(([message]) => message.includes(text));

    // An mDNS host candidate is passed to werift as is.
    const mdns = 'candidate:1 1 UDP 1 8f4f3af1-a0a0-4f2c-9276-c6b423a3d2fd.local 54321 typ host';
    const add = spyOn(peer, 'addIceCandidate').mockResolvedValueOnce();
    await provideCandidates([{ candidate: mdns, sdpMid: null, sdpmLineIndex: null }]);
    expect(add).toHaveBeenCalledWith(mdns, null, null);
    logged(loggerDebugSpy, 'MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applying ICE candidate 1/1');
    add.mockRestore();

    // A failing candidate warns.
    const failing = spyOn(peer, 'addIceCandidate').mockRejectedValueOnce(new Error('addIceCandidate failed'));
    await provideCandidates([{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: null }]);
    await waitFor(() => warned('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate'));
    loggerWarnSpy.mockClear();
    failing.mockRestore();

    // A stuck candidate times out after 5 s without delaying its sibling.
    vi.useFakeTimers();
    const stuck = spyOn(peer, 'addIceCandidate')
      .mockImplementationOnce(async () => new Promise(() => {}))
      .mockResolvedValueOnce();
    const invocation = provideCandidates([
      { candidate: 'candidate:1 1 UDP 1 stuck-interface.local 1 typ host', sdpMid: null, sdpmLineIndex: 0 },
      { candidate: 'candidate:2 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 1 },
    ]);
    await advanceTimersByTimeAsync(0);
    expect(stuck).toHaveBeenCalledTimes(2);
    logged(loggerDebugSpy, 'MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applied ICE candidate 2/2');
    await advanceTimersByTimeAsync(5000, 10);
    expect(invocation).resolves.toBeUndefined();
    expect(warned('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate 1/2')).toBe(true);
    expect(warned('timed out applying an ICE candidate after 5000ms')).toBe(true);
    loggerWarnSpy.mockClear();
    stuck.mockRestore();
    vi.useRealTimers();

    await end(device, 1);
    logged(loggerInfoSpy, 'MatterbridgeWebRtcTransportProviderServer.endSession: ended webRTC session 1');
    expect(sessions(device).map((session) => session.id)).toEqual([4]);
  });

  test('allocateWebRtcSessionId allocates, wraps, skips the active ids and reports exhaustion', () => {
    expect(allocateWebRtcSessionId(0, new Set())).toEqual({ webRtcSessionId: 0, nextCandidate: 1 });
    expect(allocateWebRtcSessionId(65534, new Set())).toEqual({ webRtcSessionId: 65534, nextCandidate: 0 });
    expect(allocateWebRtcSessionId(0, new Set([0]))).toEqual({ webRtcSessionId: 1, nextCandidate: 2 });
    expect(() => allocateWebRtcSessionId(0, new Set(Array.from({ length: 65535 }, (_, id) => id)))).toThrow('No WebRTC session identifier is available');
  });

  test('webcam capture uses the configured video resolution, and an unreachable requestor is logged', async () => {
    const originalOptions = device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions;
    await device.setStateOf(MatterbridgeWebRtcTransportProviderServer, {
      weriftOfferOptions: { ...originalOptions, videoSource: 'webcam', videoSourceDevice: 'test-webcam-device', videoResolution: '1280x720' },
    });
    try {
      await device.invokeBehaviorCommand(AV, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: AV.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const { videoStreamId } = (device.getAttribute(AV, 'allocatedVideoStreams') ?? []).at(-1) as { videoStreamId: number };
      await solicit(device, { videoStreams: [videoStreamId] });
      logged(loggerDebugSpy, 'local webcam (test-webcam-device, 1280x720)');
      clearExpectedWarnings(NO_VIDEO_CODEC, 'Cannot inject video stream: missing dependency ffmpeg', 'ffmpeg could not be resolved on this host');
      await end(device, lastSession(device).id);
      await device.invokeBehaviorCommand(AV, 'videoStreamDeallocate', { videoStreamId });
    } finally {
      await device.setStateOf(MatterbridgeWebRtcTransportProviderServer, { weriftOfferOptions: originalOptions });
    }

    // An unknown video stream id, and no bound requestor: the offer is still solicited, the requestor is unreachable.
    for (const videoStreams of [[999], [0]]) {
      await solicit(device, { videoStreams });
      logged(loggerInfoSpy, "MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor");
      clearExpectedWarnings(NO_VIDEO_CODEC);
      await end(device, lastSession(device).id);
    }
    // No WebRtcTransportRequestor client at all, for a solicited and a provided offer.
    const solicitOnly = await addProviderOnly('WebRtcNoClientCluster');
    await solicit(solicitOnly, { videoStreams: [0] });
    logged(loggerInfoSpy, "MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor");
    clearExpectedWarnings(NO_VIDEO_CODEC);
    await end(solicitOnly, 0);
    const provideOnly = await addProviderOnly('WebRtcProvideOfferNoClientCluster');
    await provide(provideOnly, { videoStreams: [0] });
    logged(loggerInfoSpy, "MatterbridgeWebRtcTransportProviderServer.provideOffer: could not reach the peer's WebRtcTransportRequestor");
    await end(provideOnly, 0);
  });

  test('past MAX_CONCURRENT_SESSIONS solicitOffer evicts the newest session, provideOffer is ResourceExhausted', async () => {
    const solicited = await addProviderOnly('WebRtcCapacitySolicit');
    for (let i = 0; i < 6; i++) await solicit(solicited, { audioStreams: [0] });
    expect(sessions(solicited)).toHaveLength(5);
    logged(loggerNoticeSpy, 'session 5 exceeds MAX_CONCURRENT_SESSIONS (5); evicting with WebRtcEndReason.OutOfResources');

    const provided = await addProviderOnly('WebRtcCapacityProvide');
    for (let i = 0; i < 5; i++) await provide(provided, { audioStreams: [0] });
    expect(provide(provided, { audioStreams: [0] })).rejects.toThrow('cannot sustain more than MAX_CONCURRENT_SESSIONS (5) concurrent webRTC sessions');
    expect(sessions(provided)).toHaveLength(5);
  });

  test('without assignable streams, or with both stream forms, the offers are rejected', async () => {
    const NO_STREAM = 'requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically';
    const CONFLICT = 'videoStreams/audioStreams and the deprecated videoStreamId/audioStreamId fields are mutually exclusive';
    const providerOnly = await addProviderOnly('WebRtcNoCameraAvStreamManagement');
    expect(solicit(providerOnly)).rejects.toThrow(`solicitOffer: ${NO_STREAM}`);
    expect(provide(providerOnly)).rejects.toThrow(`provideOffer: ${NO_STREAM}`);
    expect(solicit(providerOnly, { videoStreamId: 0, videoStreams: [0] })).rejects.toThrow(CONFLICT);
    expect(provide(providerOnly, { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), audioStreamId: 0, audioStreams: [0] })).rejects.toThrow(CONFLICT);
    // In strict mode, with no CameraAvStreamManagement the empty streamUsagePriorities reject before the stream ids are resolved.
    await withStrict(async () => {
      for (const fields of [{ videoStreamId: null }, { audioStreamId: null }]) expect(solicit(providerOnly, fields)).rejects.toThrow('is not present in streamUsagePriorities');
    });

    const noCapability = new MatterbridgeEndpoint([bridgedNode], { id: 'WebRtcNoAssignableCapability' });
    noCapability.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(AV.Feature.Video, AV.Feature.Snapshot, AV.Feature.ImageControl), {
      maxContentBufferSize: 4_194_304,
      maxNetworkBandwidth: 10_000_000,
      supportedStreamUsages: [StreamUsage.LiveView],
      streamUsagePriorities: [StreamUsage.LiveView],
      maxConcurrentEncoders: 1,
      maxEncodedPixelRate: 1920 * 1080 * 30,
      videoSensorParams: { sensorWidth: 1920, sensorHeight: 1080, maxFps: 30 },
      minViewportResolution: { width: 640, height: 360 },
      rateDistortionTradeOffPoints: [],
      currentFrameRate: 30,
      viewport: { x1: 0, y1: 0, x2: 1920, y2: 1080 },
      snapshotCapabilities: [],
      allocatedSnapshotStreams: [],
      allocatedVideoStreams: [],
      hardPrivacyModeOn: false,
      statusLightEnabled: false,
      statusLightBrightness: ThreeLevelAuto.Auto,
      imageRotation: 0,
      imageFlipVertical: false,
      imageFlipHorizontal: false,
    });
    createDefaultWebRtcTransportProviderClusterServer(noCapability);
    noCapability.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, noCapability, 0, 0, 0, 0)).toBeTruthy();
    expect(solicit(noCapability)).rejects.toThrow(`solicitOffer: ${NO_STREAM}`);

    // A camera with no assignable video capability is assigned only an audio stream.
    const audioOnly = new Camera('WebRtc No Video Capability', 'WEBRTC-NO-VIDEO-CAPABILITY', { rateDistortionTradeOffPoints: [] });
    expect(await addBridgedDevice(aggregator, audioOnly, 0, 0, 0, 0)).toBeTruthy();
    await solicit(audioOnly);
    expect(sessions(audioOnly)[0].videoStreams).toBeUndefined();
    expect(sessions(audioOnly)[0].audioStreams).toEqual([0]);
  });

  test('strict mode requires stream fields and a supported usage; without it the streams are still auto-assigned', async () => {
    await withStrict(async () => {
      expect(solicit(device)).rejects.toThrow('solicitOffer: requires at least one of videoStreams, audioStreams, videoStreamId or audioStreamId to be present');
      expect(provide(device)).rejects.toThrow('provideOffer: requires at least one of videoStreams, audioStreams, videoStreamId or audioStreamId to be present');
      expect(solicit(device, { streamUsage: StreamUsage.Analysis, videoStreams: [0] })).rejects.toThrow('stream usage 2 is not present in streamUsagePriorities');
      await solicit(device, { streamUsage: StreamUsage.Recording, videoStreams: [0] });
      clearExpectedWarnings(NO_VIDEO_CODEC);
      await end(device, lastSession(device).id);
    });
    await solicit(device);
    clearExpectedWarnings(NO_VIDEO_CODEC);
    expect(lastSession(device).videoStreams).toEqual([0]);
    await end(device, lastSession(device).id);
  });

  test('strict mode resolves the explicit video stream ids against the allocated streams', async () => {
    await withStrict(async () => {
      // Nothing allocated: the SmartThings shape (present ids, nothing ever allocated) and null ids are rejected.
      const empty = await addCamera('WebRtc Strict Video', ['video', 'audio', 'snapshot']);
      for (const ids of [0, null])
        expect(solicit(empty, { videoStreamId: ids, audioStreamId: ids })).rejects.toThrow('no video stream is allocated (AllocatedVideoStreams is empty)');
      expect(provide(empty, { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(0), videoStreamId: 0, audioStreamId: 0 })).rejects.toThrow(
        'no video stream is allocated (AllocatedVideoStreams is empty)',
      );

      // One allocated stream: a null id selects it, an unknown id and duplicates are rejected.
      const videoStreamId = await allocateVideo(empty);
      await solicit(empty, { videoStreamId: null });
      clearExpectedWarnings(NO_VIDEO_CODEC);
      expect(lastSession(empty).videoStreams).toEqual([videoStreamId]);
      expect(lastSession(empty).audioStreams).toBeUndefined();
      expect(solicit(empty, { videoStreamId: videoStreamId + 1 })).rejects.toThrow(`video stream ${videoStreamId + 1} is not present in AllocatedVideoStreams`);
      expect(solicit(empty, { videoStreams: [videoStreamId, videoStreamId] })).rejects.toThrow('duplicate video stream id in the request');

      // provideOffer without streamUsage defaults to LiveView.
      await provide(empty, { originatingEndpointId: EndpointNumber(0), videoStreamId: null });
      clearExpectedWarnings(NO_VIDEO_CODEC, 'Cannot inject video stream: missing dependency ffmpeg', 'ffmpeg could not be resolved on this host');
      expect(lastSession(empty)).toMatchObject({ videoStreams: [videoStreamId], streamUsage: StreamUsage.LiveView });
    });
  });

  test('strict mode resolves the explicit audio stream ids against the allocated streams', async () => {
    await withStrict(async () => {
      const endpoint = await addCamera('WebRtc Strict Audio', ['audio']);
      expect(solicit(endpoint, { audioStreamId: null })).rejects.toThrow('no audio stream is allocated (AllocatedAudioStreams is empty)');

      await endpoint.invokeBehaviorCommand(AV, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: AV.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32_000,
        bitDepth: 16,
      });
      const { audioStreamId } = (endpoint.getAttribute(AV, 'allocatedAudioStreams') ?? [])[0];
      // A null id selects the allocated stream, an explicit id and an explicit list match it.
      for (const fields of [{ audioStreamId: null }, { audioStreamId }, { audioStreams: [audioStreamId] }]) {
        await solicit(endpoint, fields);
        clearExpectedWarnings(NO_VIDEO_CODEC);
        expect(lastSession(endpoint).audioStreams).toEqual([audioStreamId]);
        if ('audioStreamId' in fields && fields.audioStreamId === null) expect(lastSession(endpoint).videoStreams).toBeUndefined();
        await end(endpoint, lastSession(endpoint).id);
      }
    });
  });

  test('a session restored from persisted state without a peer connection is answered and ended safely', async () => {
    // currentSessions is persisted across restarts, the werift peer connection in `internal` is not: seed the session directly.
    const endpoint = await addProviderOnly('WebRtcOrphanSession');
    await endpoint.setAttribute(WEBRTC, 'currentSessions', [
      {
        id: 0,
        peerNodeId: NodeId(0),
        peerEndpointId: EndpointNumber(1),
        streamUsage: StreamUsage.LiveView,
        metadataEnabled: false,
        videoStreams: [0],
        audioStreams: undefined,
        fabricIndex: FabricIndex(1),
      },
    ]);
    await endpoint.invokeBehaviorCommand(WEBRTC, 'provideAnswer', { webRtcSessionId: 0, sdp: 'v=0 o=- answer' });
    await endpoint.invokeBehaviorCommand(WEBRTC, 'provideIceCandidates', {
      webRtcSessionId: 0,
      iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
    });
    await end(endpoint, 0);
    expect(sessions(endpoint)).toEqual([]);
  });

  describe('closeWebRtcSessions', () => {
    /**
     * Solicits one automatically assigned session.
     *
     * @param {MatterbridgeEndpoint} endpoint - The camera endpoint.
     * @returns {Promise<void>} Resolves once the session exists.
     */
    async function solicitSession(endpoint: MatterbridgeEndpoint): Promise<void> {
      await solicit(endpoint);
      clearExpectedWarnings(NO_VIDEO_CODEC);
    }
    const peersOf = async (endpoint: MatterbridgeEndpoint): Promise<MatterbridgeWebRtcTransportProviderServer.Internal['sessions'] | undefined> =>
      (await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(endpoint, 'webRtcTransportProvider'))?.sessions;

    test('closes only the sessions of the given device and releases its stream reference counts', async () => {
      const first = await addCamera('WebRtc Close First');
      const second = await addCamera('WebRtc Close Second');
      await solicitSession(first);
      await solicitSession(first);
      await solicitSession(second);
      expect(referenceCount(first, 'allocatedVideoStreams')).toBe(2);
      const firstPeers = await peersOf(first);
      const closeSpies = [...(firstPeers?.values() ?? [])].map((webRtcPeer) => spyOn(webRtcPeer, 'close'));
      expect(closeSpies).toHaveLength(2);

      await closeWebRtcSessions(first);
      for (const closeSpy of closeSpies) expect(closeSpy).toHaveBeenCalledTimes(1);
      expect(firstPeers?.size).toBe(0);
      expect(sessions(first)).toEqual([]);
      expect([referenceCount(first, 'allocatedVideoStreams'), referenceCount(first, 'allocatedAudioStreams')]).toEqual([0, 0]);
      logged(loggerInfoSpy, 'MatterbridgeWebRtcTransportProviderServer.closeAllSessions: closed 2 webRTC session(s)');

      // The other device keeps its session until it is closed in turn.
      const secondPeers = await peersOf(second);
      expect([secondPeers?.size, sessions(second).length]).toEqual([1, 1]);
      await closeWebRtcSessions(second);
      expect([secondPeers?.size, sessions(second).length]).toEqual([0, 0]);
    });

    test('skips a device without the provider and closes the camera child endpoint of a composed device', async () => {
      expect(closeWebRtcSessions(new MatterbridgeEndpoint([camera], { id: 'WebRtcCloseNoProvider' }))).resolves.toBeUndefined();
      expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('closeAllSessions'));

      const floodlight = new FloodlightCamera('WebRtc Close Floodlight', 'WEBRTC-CLOSE-FLOODLIGHT');
      expect(await addBridgedDevice(aggregator, floodlight, 0, 0, 0, 0)).toBeTruthy();
      const cameraChild = floodlight.getChildEndpoints().find((child) => child.behaviors.has(MatterbridgeWebRtcTransportProviderServer));
      if (!cameraChild) throw new Error('the floodlight has no camera child endpoint');
      await solicitSession(cameraChild);
      expect(sessions(cameraChild)).toHaveLength(1);
      await closeWebRtcSessions(floodlight);
      expect(sessions(cameraChild)).toEqual([]);
      logged(loggerInfoSpy, 'MatterbridgeWebRtcTransportProviderServer.closeAllSessions: closed 1 webRTC session(s)');
    });

    test('logs a session that fails to close and still closes the others', async () => {
      const endpoint = await addCamera('WebRtc Close Failure');
      for (let i = 0; i < 3; i++) await solicitSession(endpoint);
      const peers = await peersOf(endpoint);
      const [[errorId, errorPeer], [stringId, stringPeer], [, okPeer]] = [...(peers?.entries() ?? [])];
      const errorSpy = spyOn(errorPeer, 'close').mockRejectedValueOnce(new Error('close failed'));
      const stringSpy = spyOn(stringPeer, 'close').mockRejectedValueOnce('close rejected');
      const okSpy = spyOn(okPeer, 'close');

      await closeWebRtcSessions(endpoint);
      expect(okSpy).toHaveBeenCalledTimes(1);
      expect(peers?.size).toBe(0);
      expect(sessions(endpoint)).toEqual([]);
      logged(loggerErrorSpy, `closeAllSessions: failed to close webRTC session ${errorId}: close failed`);
      logged(loggerErrorSpy, `closeAllSessions: failed to close webRTC session ${stringId}: close rejected`);
      loggerErrorSpy.mockClear();

      // The mocked closes skipped the real cleanup: close the two peer connections for real so the test leaks nothing.
      errorSpy.mockRestore();
      stringSpy.mockRestore();
      await errorPeer.close();
      await stringPeer.close();
    });
  });
});
