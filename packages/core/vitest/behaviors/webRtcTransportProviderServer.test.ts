/**
 * @file vitest/behaviors/webRtcTransportProviderServer.test.ts
 * @description This file contains the tests for the MatterbridgeWebRtcTransportProviderServer behavior.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 */

// These tests raise the suite timeout because werift always gathers ICE against stun.l.google.com, even when
// iceServers is set to []; a dropped STUN response stalls an offer/answer for werift's full 5s gathering timeout.
// See https://github.com/shinyoshiaki/werift-webrtc/issues/691

const NAME = 'WebRtcTransportProviderServerBehavior';
const MATTER_PORT = 6005;
const MATTER_CREATE_ONLY = true;

import { Node } from '@matter/main';
import { EndpointNumber, FabricIndex, NodeId, StreamUsage, ThreeLevelAuto } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { WebRtcTransportDefinitions } from '@matter/types/clusters/web-rtc-transport-definitions';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { loggerDebugSpy, loggerErrorSpy, loggerFatalSpy, loggerInfoSpy, loggerNoticeSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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
import {
  allocateWebRtcSessionId,
  createDefaultWebRtcTransportProviderClusterServer,
  MatterbridgeWebRtcTransportProviderServer,
} from '../../src/behaviors/webRtcTransportProviderServer.js';
import { Camera } from '../../src/devices/camera.js';
import { camera } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { internalFor } from '../../src/matterbridgeEndpointHelpers.js';

await setupTest(NAME);

// Timeout raised for the STUN gathering stall described in the file header above: the WeriftWebRtcSession
// instances these tests drive gather ICE the same way.
vi.setConfig({ testTimeout: 30_000 });

describe('MatterbridgeWebRtcTransportProviderServer', () => {
  let device: Camera;
  let testExistingSessionId: number;

  function clearExpectedWarnings(...expectedMessages: string[]): void {
    const unexpectedWarnings = loggerWarnSpy.mock.calls.filter(([message]) => !expectedMessages.some((expectedMessage) => message.includes(expectedMessage)));
    expect(unexpectedWarnings).toEqual([]);
    loggerWarnSpy.mockClear();
  }

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

  it('should create and register a camera device using the MatterbridgeWebRtcTransportProviderServer behavior', async () => {
    // maxConcurrentEncoders is raised above the default of 1 because this shared device accumulates auto-allocated
    // and explicitly allocated video streams across many tests in this file.
    device = new Camera('WebRtc Behavior', 'WEBRTC-BEHAVIOR', { maxConcurrentEncoders: 10 });
    expect(device.behaviors.has(MatterbridgeWebRtcTransportProviderServer)).toBeTruthy();
    expect(await addDevice(aggregator, device)).toBeTruthy();
  });

  it('should create a brand-new video and audio stream via automatic assignment when nothing is allocated', async () => {
    // A default video/audio/snapshot stream is self-allocated on construction (see
    // MatterbridgeCameraAvStreamManagementServer#initialize), so #autoAssignStreams()'s own "create a new stream"
    // fallback is normally never reached (there's always something to select instead). Deallocate everything first
    // to exercise that fallback explicitly.
    const endpoint = new Camera('WebRtc Auto Create', 'WEBRTC-AUTO-CREATE');
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();
    await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
    await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
    await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([]);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([]);

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).resolves.toBeUndefined();

    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams')).toEqual([expect.objectContaining({ videoStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    expect(endpoint.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams')).toEqual([expect.objectContaining({ audioStreamId: 0, streamUsage: StreamUsage.LiveView })]);
    const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions[0].videoStreams).toEqual([0]);
    expect(currentSessions[0].audioStreams).toEqual([0]);
  });

  it('should solicit an offer with automatically assigned video and audio streams when none are provided', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 0'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions[0].videoStreams).toEqual([0]);
    expect(currentSessions[0].audioStreams).toEqual([0]);
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // Restores currentSessions to empty without resetting the monotonically increasing session id allocator.
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should solicit an offer and record a deferred session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        videoStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 1'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(1);
    expect(currentSessions[0].streamUsage).toBe(StreamUsage.LiveView);
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
  });

  it('should solicit a second offer with an incremented session id', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.Recording,
        originatingEndpointId: EndpointNumber(1),
        audioStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session 2'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].id).toBe(2);
  });

  it('should end the second solicited session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 2, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(1);
  });

  it('should provide an offer for a new session with automatically assigned video and audio streams', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer' })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 3'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].videoStreams).toEqual([0]);
    expect(currentSessions[1].audioStreams).toEqual([0]);

    // Restores currentSessions to the session created by the main flow.
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 3, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should provide an offer for a new session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: null,
        sdp: 'v=0 o=- offer',
        streamUsage: StreamUsage.Recording,
        audioStreams: [0],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 4'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
    expect(currentSessions[1].id).toBe(4);
  });

  it('should provide an offer for a new session with default stream usage and originating endpoint', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 5'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].streamUsage).toBe(StreamUsage.LiveView);
  });

  it('should end the session created with default stream usage and originating endpoint', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 5, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should provide an offer for a new session using the deprecated videoStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreamId: 0, audioStreamId: null }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 6'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].videoStreams).toEqual([0]);
    expect(currentSessions[2].audioStreams).toBeUndefined();
  });

  it('should end the session created with the deprecated videoStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 6, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should provide an offer for a new session using the deprecated audioStreamId field', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', audioStreamId: 1 })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session 7'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(3);
    expect(currentSessions[2].audioStreams).toEqual([1]);
  });

  it('should end the session created with the deprecated audioStreamId field', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 7, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(2);
  });

  it('should echo a null deprecated videoStreamId when no video stream was resolved for the request', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreamId: null, audioStreamId: 5 }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const session = currentSessions[currentSessions.length - 1];
    expect(session.videoStreams).toBeUndefined();
    expect(session.audioStreams).toEqual([5]);

    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: session.id, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should solicit an offer with only the deprecated audioStreamId field set to null, automatically assigning streams', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), audioStreamId: null }),
    ).resolves.toBeUndefined();

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const session = currentSessions[currentSessions.length - 1];
    expect(session.videoStreams).toEqual([0]);
    expect(session.audioStreams).toEqual([0]);
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // Restores currentSessions to its pre-test state without resetting the session id allocator.
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: session.id, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should provide an offer for an existing session', async () => {
    // Renegotiating session 1 here (rather than creating a dedicated session) would feed a real werift peer
    // connection a remote re-offer with no media sections, wiping out the video m-line the later ICE-candidate and
    // provideAnswer tests below depend on. Use a disposable session instead so session 1 stays untouched.
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        videoStreams: [0],
      }),
    ).resolves.toBeUndefined();
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const existingSessionId = currentSessions[currentSessions.length - 1].id;

    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: existingSessionId,
        sdp: 'v=0 o=- re-offer',
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining(`MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session ${existingSessionId}`),
    );
    clearExpectedWarnings();

    // Kept alive for the "log a non-Error rejection reason" test below; ended there.
    testExistingSessionId = existingSessionId;
  });

  it('should log a non-Error rejection reason when the peer WebRtcTransportRequestor endpoint cannot be resolved', async () => {
    vi.spyOn(Node, 'forEndpoint').mockImplementationOnce(() => {
      // oxlint-disable-next-line typescript/only-throw-error -- intentionally exercises the non-Error branch of the catch's error formatting.
      throw 'boom';
    });

    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: testExistingSessionId,
        sdp: 'v=0 o=- re-offer',
      }),
    ).resolves.toBeUndefined();

    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringMatching(/could not resolve peer WebRtcTransportRequestor endpoint.*boom/));
    clearExpectedWarnings();

    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', {
      webRtcSessionId: testExistingSessionId,
      reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup,
    });
  });

  it('should reject provideOffer for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: 99, sdp: 'v=0 o=- offer' })).rejects.toThrow(
      'webRTC session 99 is not present in currentSessions',
    );
  });

  // Applied to session 1 before provideAnswer below: session 1's real local offer (from solicitOffer) already has a
  // real video m-line, and the ICE candidate lookup resolves against it. Applying provideAnswer's fake, media-less
  // SDP first would clear that m-line and leave nothing for sdpMLineIndex 0 to resolve against.
  it('should provide ICE candidates for an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: received 1 ICE candidate(s) for session 1'),
    );
  });

  it('should provide an answer for an existing session', async () => {
    // Uses a dedicated session rather than session 1: session 1 already has a real ICE candidate buffered against
    // its real video m-line (see the ICE-candidate test above), and applying this fake, media-less answer SDP to it
    // would drop that m-line, so werift's flush of the buffered candidate against the new answer fails to resolve.
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        videoStreams: [0],
      }),
    ).resolves.toBeUndefined();
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const answerSessionId = currentSessions[currentSessions.length - 1].id;

    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: answerSessionId, sdp: 'v=0 o=- answer' })).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining(`MatterbridgeWebRtcTransportProviderServer.provideAnswer: received an SDP answer for session ${answerSessionId}`),
    );

    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: answerSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should reject provideAnswer for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 99, sdp: 'v=0 o=- answer' })).rejects.toThrow(
      'MatterbridgeWebRtcTransportProviderServer.provideAnswer: webRTC session 99 is not present in currentSessions',
    );
  });

  it('should apply mDNS host ICE candidates by delegating mDNS resolution to werift-ice', async () => {
    const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
    const webRtcPeer = internal?.sessions.get(1);
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
    const addIceCandidateSpy = vi.spyOn(webRtcPeer!, 'addIceCandidate').mockResolvedValueOnce();

    const candidate = 'candidate:1 1 UDP 1 8f4f3af1-a0a0-4f2c-9276-c6b423a3d2fd.local 54321 typ host';
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate, sdpMid: null, sdpmLineIndex: null }],
      }),
    ).resolves.toBeUndefined();

    expect(addIceCandidateSpy).toHaveBeenCalledWith(candidate, null, null);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applying ICE candidate 1/1'));
  });

  it('should log a warning when applying an ICE candidate fails', async () => {
    const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
    const webRtcPeer = internal?.sessions.get(1);
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
    vi.spyOn(webRtcPeer!, 'addIceCandidate').mockRejectedValueOnce(new Error('addIceCandidate failed'));

    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: null }],
      }),
    ).resolves.toBeUndefined();

    // The command response no longer waits on candidate application (see provideIceCandidates's doc comment), so
    // the warning is logged in the background and must be awaited rather than asserted immediately.
    await vi.waitFor(() =>
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate')),
    );
    loggerWarnSpy.mockClear();
  });

  it('should log a warning when applying an ICE candidate times out', async () => {
    vi.useFakeTimers();
    try {
      const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
      const webRtcPeer = internal?.sessions.get(1);
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
      vi.spyOn(webRtcPeer!, 'addIceCandidate').mockImplementationOnce(async () => new Promise(() => {}));

      const invocation = device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      });
      await vi.advanceTimersByTimeAsync(5000);

      await expect(invocation).resolves.toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('timed out applying an ICE candidate after 5000ms'));
      loggerWarnSpy.mockClear();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should apply ICE candidates concurrently so one candidate timing out does not delay a sibling candidate', async () => {
    vi.useFakeTimers();
    try {
      const internal = await internalFor<MatterbridgeWebRtcTransportProviderServer.Internal>(device, 'webRtcTransportProvider');
      const webRtcPeer = internal?.sessions.get(1);
      // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was created by an earlier test in this flow.
      const peer = webRtcPeer!;
      const addIceCandidateSpy = vi
        .spyOn(peer, 'addIceCandidate')
        .mockImplementationOnce(async () => new Promise(() => {}))
        .mockResolvedValueOnce();

      const invocation = device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 1,
        iceCandidates: [
          { candidate: 'candidate:1 1 UDP 1 stuck-interface.local 1 typ host', sdpMid: null, sdpmLineIndex: 0 },
          { candidate: 'candidate:2 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 1 },
        ],
      });

      // Let both candidates start applying before the first one's timeout fires, proving they run concurrently
      // rather than the second one waiting for the first's 5s timeout to elapse first.
      await vi.advanceTimersByTimeAsync(0);
      expect(addIceCandidateSpy).toHaveBeenCalledTimes(2);
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applied ICE candidate 2/2'));

      await vi.advanceTimersByTimeAsync(5000);
      await expect(invocation).resolves.toBeUndefined();
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate 1/2'));
      loggerWarnSpy.mockClear();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reject provideIceCandidates for an unknown session', async () => {
    await expect(device.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', { webRtcSessionId: 99, iceCandidates: [] })).rejects.toThrow(
      'MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: webRTC session 99 is not present in currentSessions',
    );
  });

  it('should reject endSession for an unknown session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 99, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).rejects.toThrow('MatterbridgeWebRtcTransportProviderServer.endSession: webRTC session 99 is not present in currentSessions');
  });

  it('should end an existing session', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 1, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeWebRtcTransportProviderServer.endSession: ended webRTC session 1'));
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions).toHaveLength(1);
    expect(currentSessions[0].id).toBe(4);
  });

  it('should allocate, wrap, skip active, and exhaust WebRTC session ids', () => {
    expect(allocateWebRtcSessionId(0, new Set())).toEqual({ webRtcSessionId: 0, nextCandidate: 1 });
    expect(allocateWebRtcSessionId(65534, new Set())).toEqual({ webRtcSessionId: 65534, nextCandidate: 0 });
    expect(allocateWebRtcSessionId(0, new Set([0]))).toEqual({ webRtcSessionId: 1, nextCandidate: 2 });

    const allSessionIds = new Set<number>();
    for (let id = 0; id <= 65534; id++) allSessionIds.add(id);
    expect(() => allocateWebRtcSessionId(0, allSessionIds)).toThrow('No WebRTC session identifier is available');
  });

  it('should use state video resolution for webcam capture instead of the allocated stream resolution', async () => {
    const originalOptions = device.stateOf(MatterbridgeWebRtcTransportProviderServer).weriftOfferOptions;
    await device.setStateOf(MatterbridgeWebRtcTransportProviderServer, {
      weriftOfferOptions: { ...originalOptions, videoSource: 'webcam', videoSourceDevice: 'test-webcam-device', videoResolution: '1280x720' },
    });

    try {
      // maxResolution must bracket the device's default rateDistortionTradeOffPoints entry (1920x1080, Matter 1.6 §11.2.8.4.8).
      await device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const allocatedVideoStreams = device.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];
      const { videoStreamId } = allocatedVideoStreams[allocatedVideoStreams.length - 1];

      await expect(
        device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreams: [videoStreamId],
        }),
      ).resolves.toBeUndefined();

      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('local webcam (test-webcam-device, 1280x720)'));
      clearExpectedWarnings('No injectable video codec available on negotiated transceivers', 'Cannot inject video stream: missing dependency ffmpeg');

      const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      const webRtcSessionId = currentSessions[currentSessions.length - 1].id;
      await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
      await device.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId });
    } finally {
      await device.setStateOf(MatterbridgeWebRtcTransportProviderServer, { weriftOfferOptions: originalOptions });
    }
  });

  it('should still solicit an offer when the requested video stream id has no matching allocated stream', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [999] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor"),
    );
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // solicitOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const webRtcSessionId = currentSessions[currentSessions.length - 1].id;
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should not solicit an offer without a bound WebRtcTransportRequestor', async () => {
    await expect(
      device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor"),
    );
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // solicitOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    const currentSessions = device.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    const webRtcSessionId = currentSessions[currentSessions.length - 1].id;
    await device.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should not solicit an offer when no WebRtcTransportRequestor client is registered at all', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoClientCluster' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor"),
    );
    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');

    // solicitOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    await endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should not provide an offer when no WebRtcTransportRequestor client is registered at all', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcProvideOfferNoClientCluster' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', videoStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.stringContaining("MatterbridgeWebRtcTransportProviderServer.provideOffer: could not reach the peer's WebRtcTransportRequestor"),
    );

    // provideOffer with a video stream creates a real WeriftWebRtcSession backed by a real ffmpeg process; end it so
    // the test doesn't leak that process.
    await endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup });
  });

  it('should evict the newest session with OutOfResources when solicitOffer exceeds MAX_CONCURRENT_SESSIONS', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcCapacitySolicit' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    for (let i = 0; i < 5; i++) {
      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), audioStreams: [0] }),
      ).resolves.toBeUndefined();
    }
    expect(endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions')).toHaveLength(5);

    // The 6th session is accepted normally (a real session id is allocated) but immediately evicted since it pushes
    // the count past MAX_CONCURRENT_SESSIONS=5; currentSessions stays capped at 5, no Offer is ever sent for it.
    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1), audioStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions')).toHaveLength(5);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining('session 5 exceeds MAX_CONCURRENT_SESSIONS (5); evicting with WebRtcEndReason.OutOfResources'));
  });

  it('should evict the newest session with OutOfResources when provideOffer exceeds MAX_CONCURRENT_SESSIONS', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcCapacityProvide' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    for (let i = 0; i < 5; i++) {
      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', audioStreams: [0] }),
      ).resolves.toBeUndefined();
    }
    expect(endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions')).toHaveLength(5);

    // The 6th session is accepted normally (a real session id is allocated) but immediately evicted since it pushes
    // the count past MAX_CONCURRENT_SESSIONS=5; currentSessions stays capped at 5, no Answer is ever sent for it.
    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer', audioStreams: [0] }),
    ).resolves.toBeUndefined();

    expect(endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions')).toHaveLength(5);
    expect(loggerNoticeSpy).toHaveBeenCalledWith(expect.stringContaining('session 5 exceeds MAX_CONCURRENT_SESSIONS (5); evicting with WebRtcEndReason.OutOfResources'));
  });

  it('should reject solicitOffer without videoStreams or audioStreams when the endpoint has no CameraAvStreamManagement cluster', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoCameraAvStreamManagement' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).rejects.toThrow('solicitOffer: requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically');
  });

  it('should reject provideOffer without videoStreams or audioStreams when the endpoint has no CameraAvStreamManagement cluster', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcProvideOfferNoCameraAvStreamManagement' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer' })).rejects.toThrow(
      'provideOffer: requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically',
    );
  });

  it('should reject solicitOffer with both videoStreamId and videoStreams present', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcConflictingVideoFields' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        videoStreamId: 0,
        videoStreams: [0],
      }),
    ).rejects.toThrow('videoStreams/audioStreams and the deprecated videoStreamId/audioStreamId fields are mutually exclusive');
  });

  it('should reject provideOffer with both audioStreamId and audioStreams present', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcConflictingAudioFields' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
        webRtcSessionId: null,
        sdp: 'v=0 o=- offer',
        streamUsage: StreamUsage.LiveView,
        originatingEndpointId: EndpointNumber(1),
        audioStreamId: 0,
        audioStreams: [0],
      }),
    ).rejects.toThrow('videoStreams/audioStreams and the deprecated videoStreamId/audioStreamId fields are mutually exclusive');
  });

  it('should auto-assign only an audio stream when the camera has no assignable video capability', async () => {
    const endpoint = new Camera('WebRtc No Video Capability', 'WEBRTC-NO-VIDEO-CAPABILITY', { rateDistortionTradeOffPoints: [] });
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).resolves.toBeUndefined();

    const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions[0].videoStreams).toBeUndefined();
    expect(currentSessions[0].audioStreams).toEqual([0]);
  });

  it('should reject solicitOffer without videoStreams or audioStreams when the camera has no assignable video or audio capability', async () => {
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcNoAssignableCapability' });
    endpoint.behaviors.require(
      MatterbridgeCameraAvStreamManagementServer.with(
        CameraAvStreamManagement.Feature.Video,
        CameraAvStreamManagement.Feature.Snapshot,
        CameraAvStreamManagement.Feature.ImageControl,
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
      },
    );
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).rejects.toThrow('solicitOffer: requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically');
  });

  it('should reject solicitOffer with no stream fields at all when MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit', 'WEBRTC-STRICT-SOLICIT');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
      ).rejects.toThrow('solicitOffer: requires at least one of videoStreams, audioStreams, videoStreamId or audioStreamId to be present');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject provideOffer with no stream fields at all when MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Provide', 'WEBRTC-STRICT-PROVIDE');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      await expect(endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', { webRtcSessionId: null, sdp: 'v=0 o=- offer' })).rejects.toThrow(
        'provideOffer: requires at least one of videoStreams, audioStreams, videoStreamId or audioStreamId to be present',
      );
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should still auto-assign streams for solicitOffer when MATTERBRIDGE_STRICT_WEBRTCTRANSPORT is unset', async () => {
    const endpoint = new Camera('WebRtc Not Strict Solicit', 'WEBRTC-NOT-STRICT-SOLICIT');
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', { streamUsage: StreamUsage.LiveView, originatingEndpointId: EndpointNumber(1) }),
    ).resolves.toBeUndefined();

    clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
    const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
    expect(currentSessions[0].videoStreams).toEqual([0]);
  });

  it('should reject solicitOffer with an explicit non-null videoStreamId when nothing is allocated (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      // Mirrors SmartThings' real-world ProvideOffer/SolicitOffer shape: a present, non-null id with nothing ever
      // allocated (see chipTests.md "Real-World Client Traces").
      const endpoint = new Camera('WebRtc Strict Solicit NonNull Empty', 'WEBRTC-STRICT-SOLICIT-NONNULL-EMPTY');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so this
      // endpoint is genuinely empty, matching the scenario this test targets.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreamId: 0,
          audioStreamId: 0,
        }),
      ).rejects.toThrow('no video stream is allocated (AllocatedVideoStreams is empty)');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with an explicit null videoStreamId when nothing is allocated (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Null Empty', 'WEBRTC-STRICT-SOLICIT-NULL-EMPTY');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so this
      // endpoint is genuinely empty, matching the scenario this test targets.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreamId: null,
          audioStreamId: null,
        }),
      ).rejects.toThrow('no video stream is allocated (AllocatedVideoStreams is empty)');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with an explicit null audioStreamId when nothing is allocated for audio (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Audio Null Empty', 'WEBRTC-STRICT-SOLICIT-AUDIO-NULL-EMPTY');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Only deallocate audio, leaving the self-allocated video stream in place, so the request below omits
      // any video fields entirely and only the audio branch of #resolveStrictStreamLists is exercised.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          audioStreamId: null,
        }),
      ).rejects.toThrow('no audio stream is allocated (AllocatedAudioStreams is empty)');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should select an existing allocated video stream for solicitOffer with an explicit null videoStreamId (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Null Existing', 'WEBRTC-STRICT-SOLICIT-NULL-EXISTING');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so the
      // only existing video stream is the one explicitly allocated below.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const [{ videoStreamId }] = endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreamId: null,
        }),
      ).resolves.toBeUndefined();

      clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
      const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      expect(currentSessions[0].videoStreams).toEqual([videoStreamId]);
      expect(currentSessions[0].audioStreams).toBeUndefined();
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with a videoStreamId that does not match any allocated stream (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Not Found', 'WEBRTC-STRICT-SOLICIT-NOT-FOUND');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so the
      // only existing video stream is the one explicitly allocated below.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const [{ videoStreamId }] = endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreamId: videoStreamId + 1,
        }),
      ).rejects.toThrow(`video stream ${videoStreamId + 1} is not present in AllocatedVideoStreams`);
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with duplicate entries in videoStreams (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Duplicate', 'WEBRTC-STRICT-SOLICIT-DUPLICATE');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so the
      // only existing video stream is the one explicitly allocated below.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const [{ videoStreamId }] = endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreams: [videoStreamId, videoStreamId],
        }),
      ).rejects.toThrow('duplicate video stream id in the request');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should select an existing allocated audio stream for solicitOffer with an explicit null audioStreamId (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Audio Null Existing', 'WEBRTC-STRICT-SOLICIT-AUDIO-NULL-EXISTING');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32_000,
        bitDepth: 16,
      });
      const [{ audioStreamId }] = endpoint.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams') ?? [];

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          audioStreamId: null,
        }),
      ).resolves.toBeUndefined();

      clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
      const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      expect(currentSessions[0].audioStreams).toEqual([audioStreamId]);
      expect(currentSessions[0].videoStreams).toBeUndefined();
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should accept an explicit non-null audioStreamId and an explicit audioStreams list matching an allocated stream (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Solicit Audio NonNull', 'WEBRTC-STRICT-SOLICIT-AUDIO-NONNULL');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        audioCodec: CameraAvStreamManagement.AudioCodec.Opus,
        channelCount: 1,
        sampleRate: 48000,
        bitRate: 32_000,
        bitDepth: 16,
      });
      const [{ audioStreamId }] = endpoint.getAttribute(CameraAvStreamManagement, 'allocatedAudioStreams') ?? [];

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          audioStreamId,
        }),
      ).resolves.toBeUndefined();
      let currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      expect(currentSessions[currentSessions.length - 1].audioStreams).toEqual([audioStreamId]);
      await endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', {
        webRtcSessionId: currentSessions[currentSessions.length - 1].id,
        reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup,
      });

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          audioStreams: [audioStreamId],
        }),
      ).resolves.toBeUndefined();

      clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
      currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      expect(currentSessions[currentSessions.length - 1].audioStreams).toEqual([audioStreamId]);
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with a null videoStreamId when the endpoint has no CameraAvStreamManagement cluster (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcStrictNoAvsmVideo' });
      createDefaultWebRtcTransportProviderClusterServer(endpoint);
      endpoint.addRequiredClusterServers();
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // With no CameraAvStreamManagement cluster bound, streamUsagePriorities defaults to empty, so the
      // #validateStreamUsage check (which runs before stream-id resolution/validation) rejects first.
      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          videoStreamId: null,
        }),
      ).rejects.toThrow('is not present in streamUsagePriorities');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with a null audioStreamId when the endpoint has no CameraAvStreamManagement cluster (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcStrictNoAvsmAudio' });
      createDefaultWebRtcTransportProviderClusterServer(endpoint);
      endpoint.addRequiredClusterServers();
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // See the equivalent comment in the videoStreamId variant above.
      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(1),
          audioStreamId: null,
        }),
      ).rejects.toThrow('is not present in streamUsagePriorities');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject solicitOffer with an unsupported streamUsage when nothing is allocated (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      await expect(
        device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.Analysis,
          originatingEndpointId: EndpointNumber(1),
          videoStreams: [0],
        }),
      ).rejects.toThrow('stream usage 2 is not present in streamUsagePriorities');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should accept solicitOffer with a supported non-default streamUsage (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      await expect(
        device.invokeBehaviorCommand(WebRtcTransportProvider, 'solicitOffer', {
          streamUsage: StreamUsage.Recording,
          originatingEndpointId: EndpointNumber(1),
          videoStreams: [0],
        }),
      ).resolves.toBeUndefined();
      clearExpectedWarnings('No injectable video codec available on negotiated transceivers');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should reject provideOffer with SmartThings-shape explicit stream ids when nothing is allocated (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Provide NonNull Empty', 'WEBRTC-STRICT-PROVIDE-NONNULL-EMPTY');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated defaults (see MatterbridgeCameraAvStreamManagementServer#initialize) so this
      // endpoint is genuinely empty, matching the scenario this test targets.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'audioStreamDeallocate', { audioStreamId: 0 });
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', { snapshotStreamId: 0 });

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
          webRtcSessionId: null,
          sdp: 'v=0 o=- offer',
          streamUsage: StreamUsage.LiveView,
          originatingEndpointId: EndpointNumber(0),
          videoStreamId: 0,
          audioStreamId: 0,
        }),
      ).rejects.toThrow('no video stream is allocated (AllocatedVideoStreams is empty)');
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should default to LiveView stream usage for provideOffer when streamUsage is omitted (MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1)', async () => {
    const originalStrict = process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
    process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = '1';
    try {
      const endpoint = new Camera('WebRtc Strict Provide Default Usage', 'WEBRTC-STRICT-PROVIDE-DEFAULT-USAGE');
      expect(await addDevice(aggregator, endpoint)).toBeTruthy();

      // Deallocate the self-allocated default video stream (see MatterbridgeCameraAvStreamManagementServer#initialize)
      // so this maxConcurrentEncoders=1 device has room for the explicit allocation below.
      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamDeallocate', { videoStreamId: 0 });

      await endpoint.invokeBehaviorCommand(CameraAvStreamManagement, 'videoStreamAllocate', {
        streamUsage: StreamUsage.LiveView,
        videoCodec: CameraAvStreamManagement.VideoCodec.H264,
        minFrameRate: 15,
        maxFrameRate: 30,
        minResolution: { width: 640, height: 480 },
        maxResolution: { width: 1920, height: 1080 },
        minBitRate: 1_000_000,
        maxBitRate: 2_000_000,
        keyFrameInterval: 4000,
      });
      const [{ videoStreamId }] = endpoint.getAttribute(CameraAvStreamManagement, 'allocatedVideoStreams') ?? [];

      await expect(
        endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideOffer', {
          webRtcSessionId: null,
          sdp: 'v=0 o=- offer',
          originatingEndpointId: EndpointNumber(0),
          videoStreamId: null,
        }),
      ).resolves.toBeUndefined();

      clearExpectedWarnings('No injectable video codec available on negotiated transceivers', 'Cannot inject video stream: missing dependency ffmpeg');
      const currentSessions = endpoint.getAttribute(WebRtcTransportProvider, 'currentSessions') ?? [];
      expect(currentSessions[0].videoStreams).toEqual([videoStreamId]);
      expect(currentSessions[0].streamUsage).toBe(StreamUsage.LiveView);
    } finally {
      if (originalStrict === undefined) delete process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT;
      else process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT = originalStrict;
    }
  });

  it('should not touch a real peer connection for a session restored from persisted state without one', async () => {
    // currentSessions is a replicated attribute (persisted across restarts); the werift peer connection in `internal`
    // is not. Seed a session directly, bypassing solicitOffer/provideOffer, to simulate that post-restart state.
    const endpoint = new MatterbridgeEndpoint([camera], { id: 'WebRtcOrphanSession' });
    createDefaultWebRtcTransportProviderClusterServer(endpoint);
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await endpoint.setAttribute(WebRtcTransportProvider, 'currentSessions', [
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

    await expect(endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideAnswer', { webRtcSessionId: 0, sdp: 'v=0 o=- answer' })).resolves.toBeUndefined();
    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'provideIceCandidates', {
        webRtcSessionId: 0,
        iceCandidates: [{ candidate: 'candidate:1 1 UDP 1 127.0.0.1 1 typ host', sdpMid: null, sdpmLineIndex: 0 }],
      }),
    ).resolves.toBeUndefined();
    await expect(
      endpoint.invokeBehaviorCommand(WebRtcTransportProvider, 'endSession', { webRtcSessionId: 0, reason: WebRtcTransportDefinitions.WebRtcEndReason.UserHangup }),
    ).resolves.toBeUndefined();
  });
});
