/**
 * @file src/behaviors/webRtcTransportProviderServer.ts
 * @description This file contains the MatterbridgeWebRtcTransportProviderServer class of Matterbridge.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-13
 * @version 2.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Endpoint, ServerNode } from '@matter/main';
import { Node } from '@matter/main';
import { WebRtcTransportProviderServer } from '@matter/node/behaviors/web-rtc-transport-provider';
import { WebRtcTransportRequestorClient } from '@matter/node/behaviors/web-rtc-transport-requestor';
import { EndpointNumber, FabricIndex, NodeId, StreamUsage, Status, StatusResponseError } from '@matter/types';
import { WebRtcTransportDefinitions } from '@matter/types/clusters/web-rtc-transport-definitions';
import type { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeCameraAvStreamManagementServer } from './cameraAvStreamManagementServer.js';
import { MatterbridgeServer } from './matterbridgeServer.js';
import { WeriftWebRtcSession } from './weriftSession.js';

/**
 * Delay before firing a deferred Offer/Answer invoke on the peer's WebRtcTransportRequestor (see
 * {@link MatterbridgeWebRtcTransportProviderServer.#invokeDeferred}). The peer needs to receive and process our own
 * SolicitOffer/ProvideOffer response first, since that response is what tells it the session id this invoke is for;
 * without this delay, an invoke to a peer with an already-established Matter session can outrace our own response.
 */
const DEFERRED_INVOKE_DELAY_MS = 250;

/**
 * Per-candidate timeout for {@link MatterbridgeWebRtcTransportProviderServer.provideIceCandidates}. mDNS host
 * candidates (`*.local`) are resolved by werift-ice via a real multicast DNS query before being applied (see the
 * method's doc comment), so this must leave enough headroom for a multicast round trip on the LAN in addition to
 * the candidate application itself, while still failing well before werift-ice's own 10s internal mDNS timeout so
 * a candidate that truly can't be resolved (e.g. no multicast routing between subnets) is reported promptly.
 */
const ICE_CANDIDATE_APPLY_TIMEOUT_MS = 5000;

/** Highest WebRTC session identifier allocated before the Matter-mandated wrap to zero. */
const MAX_WEB_RTC_SESSION_ID = 0xfffe;

/**
 * Maximum number of concurrent WebRTC sessions this implementation sustains at once (see
 * {@link MatterbridgeWebRtcTransportProviderServer.#evictIfOverCapacity}). Matter 1.6 §11.4.5.2's
 * WebRTCEndReasonEnum.OutOfResources exists precisely for a provider that can accept a session request but can't
 * actually sustain it; a real camera's concurrent-stream capacity is finite (encoder/CPU/bandwidth), so this caps
 * it rather than accepting unbounded sessions.
 */
const MAX_CONCURRENT_SESSIONS = 5;

/**
 * Allocates a WebRTC session identifier according to the Matter specification.
 *
 * Identifiers start at zero, increase monotonically for every new allocation, wrap after 65534, and skip any
 * identifier that is still active.
 *
 * @param {number} nextCandidate - The next monotonically increasing identifier candidate.
 * @param {ReadonlySet<number>} activeSessionIds - Identifiers belonging to active sessions.
 * @returns {{ webRtcSessionId: number; nextCandidate: number }} The allocated identifier and the following candidate.
 * @throws {StatusResponseError} With status ResourceExhausted if every allocatable identifier is active.
 */
export function allocateWebRtcSessionId(nextCandidate: number, activeSessionIds: ReadonlySet<number>): { webRtcSessionId: number; nextCandidate: number } {
  const firstCandidate = nextCandidate;
  let candidate = firstCandidate;

  do {
    const followingCandidate = candidate === MAX_WEB_RTC_SESSION_ID ? 0 : candidate + 1;
    if (!activeSessionIds.has(candidate)) return { webRtcSessionId: candidate, nextCandidate: followingCandidate };
    candidate = followingCandidate;
  } while (candidate !== firstCandidate);

  throw new StatusResponseError('No WebRTC session identifier is available', Status.ResourceExhausted);
}

/**
 * The subset of a remote command context's session used by {@link MatterbridgeWebRtcTransportProviderServer.#getPeerInfo}.
 */
interface RemoteActorSessionContext {
  session?: {
    peerNodeId?: NodeId;
    fabric?: { fabricIndex: FabricIndex };
  };
}

/**
 * WebRtcTransportProvider server that tracks WebRTC session bookkeeping (SolicitOffer, ProvideOffer, ProvideAnswer,
 * ProvideIceCandidates, EndSession) in the CurrentSessions attribute.
 *
 * Each session is backed by a real werift RTCPeerConnection (see {@link WeriftWebRtcSession}). WebRtcTransportProvider
 * and WebRtcTransportRequestor address each other directly using the peer node id captured from the incoming
 * request's session (comparable to the OTA Provider/Requestor cluster pair) — see
 * {@link #resolvePeerRequestorEndpoint} — rather than via the Binding cluster:
 * - SolicitOffer creates the session's peer connection and invokes Offer, with a real generated SDP offer, on the
 *   peer's WebRtcTransportRequestor, if it can be reached; otherwise the Offer is silently skipped.
 * - ProvideOffer applies the received SDP offer to the session's peer connection (creating one first for a new
 *   session) and invokes Answer, with the real generated SDP answer, on the peer's WebRtcTransportRequestor, if it
 *   can be reached; otherwise the Answer is silently skipped.
 * - ProvideAnswer and ProvideIceCandidates apply the received SDP answer/ICE candidates to the session's peer
 *   connection, if one exists.
 * - EndSession closes the session's peer connection.
 *
 * This implementation has no mechanism to send a deferred Offer/Answer later once the peer becomes reachable after
 * the fact. The underlying WeriftWebRtcSession can inject a synthetic moving test pattern video track for end-to-end media
 * validation when video is negotiated.
 *
 */
export class MatterbridgeWebRtcTransportProviderServer extends WebRtcTransportProviderServer {
  /**
   * Behaviors are ephemeral (matter.js constructs a new instance per Agent), so the werift peer connection wrappers
   * must live in `internal` state, which is backed by the endpoint rather than the instance, to survive from the
   * command that creates a session (SolicitOffer/ProvideOffer) to the later, separate commands that use it
   * (ProvideAnswer/ProvideIceCandidates/EndSession). A plain instance field would silently reset between them.
   */
  declare internal: MatterbridgeWebRtcTransportProviderServer.Internal;

  /**
   * Fires an outbound Offer/Answer invoke on the peer's WebRtcTransportRequestor without awaiting it.
   *
   * The peer must receive and process our own SolicitOffer/ProvideOffer response (which carries the session id it
   * needs to accept this invoke) before this invoke reaches it. Awaiting the invoke here, before returning our
   * response, would send it first and the peer would reject it as an unknown session.
   *
   * @param {() => void | PromiseLike<void>} action - Invokes the command on the peer's WebRtcTransportRequestor.
   * @param {string} description - Human-readable description of the invoke, for the error log on failure.
   */
  /* v8 ignore next 8 -- only reachable once a real peer WebRtcTransportRequestor can be reached; see the v8 ignore
   * comments at this method's call sites. */
  #invokeDeferred(action: () => void | PromiseLike<void>, description: string): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    setTimeout(() => {
      Promise.resolve(action()).catch((error: unknown) => {
        device.log.error(`Failed to invoke ${description} on the peer's WebRtcTransportRequestor: ${error instanceof Error ? error.message : String(error)}`);
      });
    }, DEFERRED_INVOKE_DELAY_MS);
  }

  /**
   * Resolves the peer's WebRtcTransportRequestor client endpoint by connecting directly to the peer node that sent
   * the current request (identified by peerNodeId/fabricIndex from the incoming session, and peerEndpointId from
   * originatingEndpointId) — WebRtcTransportProvider/Requestor address each other this way, comparable to the OTA
   * Provider/Requestor cluster pair, and do not use the Binding cluster.
   *
   * @param {NodeId} peerNodeId - The peer's node id.
   * @param {FabricIndex} fabricIndex - The fabric shared with the peer.
   * @param {EndpointNumber} peerEndpointId - The peer's endpoint hosting WebRtcTransportRequestor.
   * @returns {Promise<Endpoint | undefined>} The peer's WebRtcTransportRequestor endpoint, or undefined if the peer
   * could not be reached (e.g. no real remote peer is connected, as in this project's vitest harness).
   */
  async #resolvePeerRequestorEndpoint(peerNodeId: NodeId, fabricIndex: FabricIndex, peerEndpointId: EndpointNumber): Promise<Endpoint | undefined> {
    try {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- this endpoint always belongs to the Matterbridge server node.
      const serverNode = Node.forEndpoint(this.endpoint) as ServerNode;
      const peerNode = await serverNode.peers.forAddress({ nodeId: peerNodeId, fabricIndex });
      /* v8 ignore start -- requires a real commissioned fabric with a connectable peer node, which this project's
       * vitest harness has no infrastructure to set up (no remote peer test helpers exist). */
      const peerEndpoint = peerNode.endpoints.require(peerEndpointId);
      peerEndpoint.behaviors.require(WebRtcTransportRequestorClient);
      return peerEndpoint;
      /* v8 ignore stop */
    } catch (error) {
      this.endpoint
        .stateOf(MatterbridgeServer)
        .log.debug(
          `Could not resolve peer WebRtcTransportRequestor endpoint (peerNodeId=${peerNodeId}, fabricIndex=${fabricIndex}, peerEndpointId=${peerEndpointId}): ${error instanceof Error ? error.message : String(error)}`,
        );
      return undefined;
    }
  }

  /**
   * Reads the accessing peer's node id and fabric index off the current command context.
   *
   * Not all commands are necessarily invoked by a remote actor (e.g. the test harness), so `this.context` is read
   * defensively via a narrow structural cast instead of matter.js's own `hasRemoteActor` type guard, which lives in the
   * matter.js protocol package and is not reliably resolvable as a direct dependency of this plugin.
   *
   * @returns {{ peerNodeId: NodeId; fabricIndex: FabricIndex }} The peer node id and fabric index, or fallback values if the command was not invoked by a remote actor.
   */
  #getPeerInfo(): { peerNodeId: NodeId; fabricIndex: FabricIndex } {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- see this method's doc comment above.
    const session = (this.context as unknown as RemoteActorSessionContext).session;
    return {
      peerNodeId: session?.peerNodeId ?? NodeId(0),
      // WebRtcSession is fabric-scoped data: FabricIndex.NO_FABRIC (0) is rejected by the schema for list entries, so fall
      // back to the first valid fabric index instead.
      fabricIndex: session?.fabric?.fabricIndex ?? FabricIndex(1),
    };
  }

  /**
   * Allocates the next WebRTC session identifier according to the Matter specification.
   *
   * Identifiers start at zero, increase monotonically for every new allocation, wrap after 65534, and skip any
   * identifier that is still present in CurrentSessions.
   *
   * @returns {number} The next unique WebRTC session identifier.
   * @throws {StatusResponseError} With status ResourceExhausted if every allocatable identifier is active.
   */
  #allocateWebRtcSessionId(): number {
    const activeSessionIds = new Set(this.state.currentSessions.map((session) => session.id));
    const allocation = allocateWebRtcSessionId(this.internal.nextWebRtcSessionId, activeSessionIds);
    this.internal.nextWebRtcSessionId = allocation.nextCandidate;
    return allocation.webRtcSessionId;
  }

  /**
   * Resolves the effective video/audio stream lists for a SolicitOffer/ProvideOffer request, folding the deprecated
   * cluster revision 1 `videoStreamId`/`audioStreamId` fields into the `videoStreams`/`audioStreams` lists when the
   * modern list fields are not provided, per the Matter specification's backwards-compatibility rules.
   *
   * @param {{ videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant fields of the SolicitOffer/ProvideOffer request.
   * @returns {{ videoStreams?: number[]; audioStreams?: number[] }} The resolved stream lists.
   */
  #resolveStreamLists(request: { videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }): {
    videoStreams?: number[];
    audioStreams?: number[];
  } {
    return {
      videoStreams: request.videoStreams ?? (request.videoStreamId !== undefined && request.videoStreamId !== null ? [request.videoStreamId] : undefined),
      audioStreams: request.audioStreams ?? (request.audioStreamId !== undefined && request.audioStreamId !== null ? [request.audioStreamId] : undefined),
    };
  }

  /**
   * Whether a SolicitOffer/ProvideOffer request has none of videoStreams, audioStreams, videoStreamId or
   * audioStreamId present at all (as opposed to present but empty/null).
   *
   * @param {{ videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant fields of the SolicitOffer/ProvideOffer request.
   * @returns {boolean} True if none of the four stream-identifying fields is present in the request.
   */
  #hasNoStreamFields(request: { videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }): boolean {
    return request.videoStreams === undefined && request.audioStreams === undefined && request.videoStreamId === undefined && request.audioStreamId === undefined;
  }

  /**
   * Validates that a SolicitOffer/ProvideOffer request does not present both the deprecated `videoStreamId`/
   * `audioStreamId` fields and their modern `videoStreams`/`audioStreams` list counterparts for the same stream
   * type, per Matter 1.6/1.5.1 Application Cluster Specification §11.5.6.1.10/§11.5.6.3.5: "If the VideoStreams or
   * AudioStreams fields are present, and the VideoStreamID or AudioStreamID fields are present: Fail the command
   * with InvalidCommand." Applied unconditionally (independent of {@link #isStrictWebRtcTransport}): this is a
   * basic request-shape check, not a semantic behavior change, and no real controller (SmartThings,
   * python-matter-server; see "Real-World Client Traces" in chipTests.md) ever sends both forms at once.
   *
   * @param {{ videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant fields of the SolicitOffer/ProvideOffer request.
   * @throws {StatusResponseError} With status InvalidCommand if both the deprecated and modern fields are present for video and/or audio.
   */
  #validateNoConflictingStreamFields(request: { videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }): void {
    if ((request.videoStreams !== undefined && request.videoStreamId !== undefined) || (request.audioStreams !== undefined && request.audioStreamId !== undefined)) {
      throw new StatusResponseError(
        'MatterbridgeWebRtcTransportProviderServer: videoStreams/audioStreams and the deprecated videoStreamId/audioStreamId fields are mutually exclusive',
        Status.InvalidCommand,
      );
    }
  }

  /**
   * Whether SolicitOffer/ProvideOffer requests with no stream-identifying fields at all should be rejected with
   * InvalidCommand instead of falling back to automatic stream selection (see {@link #autoAssignStreams}).
   *
   * The Matter specification's choice conformance for these commands requires at least one of videoStreams,
   * audioStreams, videoStreamId or audioStreamId to be present; matter.js logs this as a conformance warning but
   * does not enforce it, so by default this server instead treats a completely empty request as a request for
   * automatic stream selection, for compatibility with revision-1 clients that never allocate streams explicitly
   * (e.g. Home Assistant's Matter camera integration). Setting the `MATTERBRIDGE_STRICT_WEBRTCTRANSPORT`
   * environment variable to `1` switches to strict spec conformance instead, for use against the CHIP WebRTC
   * Transport Provider conformance test suite (`TC_WEBRTCP_2_2`, `2_3`, `2_5`, `2_27`, `2_28`, `2_29`, `2_31`).
   *
   * @returns {boolean} True if a completely empty request should be rejected with InvalidCommand.
   */
  #isStrictWebRtcTransport(): boolean {
    return process.env.MATTERBRIDGE_STRICT_WEBRTCTRANSPORT === '1';
  }

  /**
   * Resolves the webcam capture resolution matching the client's requested video stream, from the endpoint's
   * CameraAvStreamManagement allocatedVideoStreams state, so a real client's stream/resolution selection (e.g. a
   * quality picker in its UI, which allocates a video stream with a given maxResolution before soliciting/providing
   * an offer) is reflected in the injected webcam capture.
   *
   * @param {number[]} [videoStreams] - The resolved videoStreams ids for the request (see {@link #resolveStreamLists}).
   * @returns {string | undefined} The "widthxheight" resolution of the first matching allocated video stream, or undefined if none is found.
   */
  #resolveVideoResolution(videoStreams?: number[]): string | undefined {
    const videoStreamId = videoStreams?.[0];
    if (videoStreamId === undefined) return undefined;
    if (!this.endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)) return undefined;
    const { allocatedVideoStreams } = this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer);
    const stream = allocatedVideoStreams.find((allocatedStream) => allocatedStream.videoStreamId === videoStreamId);
    if (!stream) return undefined;
    return `${stream.maxResolution.width}x${stream.maxResolution.height}`;
  }

  /**
   * Selects an already allocated video stream id matching the request's stream usage, falling back to the
   * endpoint's first allocated video stream, without allocating a new one. Used to auto-select from an existing
   * `AllocatedVideoStreams` entry when a request's `VideoStreamID` is present and `null` (Matter 1.6/1.5.1
   * Application Cluster Specification §11.5.6.1.10: "Automatically select an existing video stream").
   *
   * Both call sites already guarantee a CameraAvStreamManagement cluster is bound before calling this:
   * {@link #autoAssignStreams} has its own early-return when unbound, and {@link #resolveStrictStreamLists} is
   * only reached after {@link #validateStreamUsage} has already confirmed the cluster is present.
   *
   * @param {StreamUsage} streamUsage - The requested stream usage.
   * @returns {number | undefined} The selected video stream id, or undefined if no video stream is allocated at all.
   */
  #selectExistingVideoStreamId(streamUsage: StreamUsage): number | undefined {
    // Spread into a plain array first: state's list attributes throw on out-of-bounds index access (e.g. `[0]` on
    // an empty list) instead of returning undefined like a normal JS array.
    const allocatedVideoStreams = [...this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer).allocatedVideoStreams];
    return (allocatedVideoStreams.find((stream) => stream.streamUsage === streamUsage) ?? allocatedVideoStreams[0])?.videoStreamId;
  }

  /**
   * Selects an already allocated audio stream id matching the request's stream usage, falling back to the
   * endpoint's first allocated audio stream, without allocating a new one. See {@link #selectExistingVideoStreamId},
   * the audio counterpart (including the call-site invariant that the cluster is already known to be bound).
   *
   * @param {StreamUsage} streamUsage - The requested stream usage.
   * @returns {number | undefined} The selected audio stream id, or undefined if no audio stream is allocated at all.
   */
  #selectExistingAudioStreamId(streamUsage: StreamUsage): number | undefined {
    const allocatedAudioStreams = [...this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer).allocatedAudioStreams];
    return (allocatedAudioStreams.find((stream) => stream.streamUsage === streamUsage) ?? allocatedAudioStreams[0])?.audioStreamId;
  }

  /**
   * Resolves the video/audio stream ids for a SolicitOffer/ProvideOffer request that omitted videoStreams and
   * audioStreams (and their deprecated single-id counterparts), per the Matter specification's automatic stream
   * selection for revision 1 clients (e.g. Home Assistant's Matter camera integration and SmartThings, neither of
   * which allocates streams explicitly), which never allocates streams explicitly and expects the camera to select
   * or allocate them on its own.
   *
   * Reuses an already allocated stream matching the request's stream usage (via {@link #selectExistingVideoStreamId}/
   * {@link #selectExistingAudioStreamId}), and only allocates a new one, from the endpoint's CameraAvStreamManagement
   * default video/audio capabilities, when none exists yet. This is a deliberate compatibility extension beyond the
   * Matter specification (see {@link #validateAllocatedStreamIds}'s doc comment) — used only when
   * {@link #isStrictWebRtcTransport} is false.
   *
   * @param {StreamUsage} streamUsage - The requested stream usage.
   * @returns {Promise<{ videoStreams?: number[]; audioStreams?: number[] }>} The resolved video/audio stream id lists; a list is omitted if the endpoint has no CameraAvStreamManagement cluster or no allocatable stream of that kind.
   */
  async #autoAssignStreams(streamUsage: StreamUsage): Promise<{ videoStreams?: number[]; audioStreams?: number[] }> {
    if (!this.endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)) return {};
    const state = this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer);

    let videoStreamId = this.#selectExistingVideoStreamId(streamUsage);
    if (videoStreamId === undefined && state.rateDistortionTradeOffPoints.length > 0) {
      // Pick the highest-resolution trade-off point rather than just the first one, so an auto-assigned
      // stream represents the camera's top resolution regardless of how many lower-resolution entries
      // precede it (see the equivalent default-stream selection in cameraAvStreamManagementServer.ts#initialize).
      let largestTradeOffPoint = state.rateDistortionTradeOffPoints[0];
      for (const point of state.rateDistortionTradeOffPoints) {
        if (point.resolution.width * point.resolution.height > largestTradeOffPoint.resolution.width * largestTradeOffPoint.resolution.height) largestTradeOffPoint = point;
      }
      const { codec, resolution, minBitRate } = largestTradeOffPoint;
      ({ videoStreamId } = await this.endpoint.act((agent) =>
        agent.get(MatterbridgeCameraAvStreamManagementServer).videoStreamAllocate({
          streamUsage,
          videoCodec: codec,
          minFrameRate: 1,
          maxFrameRate: state.videoSensorParams.maxFps,
          minResolution: state.minViewportResolution,
          maxResolution: resolution,
          minBitRate,
          // See the equivalent comment in cameraAvStreamManagementServer.ts#initialize: RateDistortionTradeOffPointsStruct
          // only carries a floor MinBitRate, no matching max, so MaxBitRate is synthesized with typical VBR headroom.
          maxBitRate: minBitRate * 4,
          keyFrameInterval: 4000,
        }),
      ));
    }

    let audioStreamId = this.#selectExistingAudioStreamId(streamUsage);
    if (audioStreamId === undefined && state.microphoneCapabilities.supportedCodecs.length > 0) {
      const { microphoneCapabilities } = state;
      ({ audioStreamId } = await this.endpoint.act((agent) =>
        agent.get(MatterbridgeCameraAvStreamManagementServer).audioStreamAllocate({
          streamUsage,
          audioCodec: microphoneCapabilities.supportedCodecs[0],
          channelCount: microphoneCapabilities.maxNumberOfChannels,
          sampleRate: microphoneCapabilities.supportedSampleRates[0],
          bitRate: 32_000,
          bitDepth: microphoneCapabilities.supportedBitDepths[0],
        }),
      ));
    }

    return {
      videoStreams: videoStreamId === undefined ? undefined : [videoStreamId],
      /* v8 ignore next -- microphoneCapabilities.supportedCodecs is schema-enforced to have at least 1 entry
       * whenever the Audio feature is present, and MatterbridgeCameraAvStreamManagementServer always enables Audio
       * (see its class declaration); audioStreamId can therefore never be undefined here. */
      audioStreams: audioStreamId === undefined ? undefined : [audioStreamId],
    };
  }

  /**
   * Validates a resolved `videoStreams`/`audioStreams` id list against the endpoint's `AllocatedVideoStreams`/
   * `AllocatedAudioStreams` attribute, per Matter 1.6/1.5.1 Application Cluster Specification §11.5.6.1.10 (mirrored
   * for ProvideOffer at §11.5.6.3.5): "If VideoStreams is present: If AllocatedVideoStreams is empty, fail with
   * InvalidInState; if there are duplicate entries, fail with AlreadyExists; for each entry, if not found in
   * AllocatedVideoStreams, fail with DynamicConstraintError" (identically for AudioStreams/AllocatedAudioStreams).
   *
   * `AllocatedVideoStreams`/`AllocatedAudioStreams` (§11.2.7.16/.17) are `CameraAvStreamManagement` attributes,
   * populated exclusively by that cluster's own `VideoStreamAllocate`/`AudioStreamAllocate` commands —
   * `WebRtcTransportProvider` has no authority anywhere in the spec to create entries in them. Only enforced when
   * {@link #isStrictWebRtcTransport} is true; the default (non-strict) behavior is {@link #autoAssignStreams}'s
   * looser compatibility extension instead, since real clients observed in production (e.g. SmartThings) send
   * stream ids without ever calling `VideoStreamAllocate`/`AudioStreamAllocate` at all.
   *
   * Only ever called (via {@link #resolveStrictStreamLists}) after {@link #validateStreamUsage} has already
   * confirmed a CameraAvStreamManagement cluster is bound to this endpoint — an unbound endpoint has no
   * StreamUsagePriorities to match against and is rejected there first, so this can assume the cluster is present.
   *
   * @param {'video' | 'audio'} kind - Which stream type is being validated.
   * @param {number[]} ids - The resolved videoStreams/audioStreams id list to validate.
   * @throws {StatusResponseError} With status InvalidInState if no stream of this kind is allocated at all.
   * @throws {StatusResponseError} With status AlreadyExists if `ids` contains a duplicate entry.
   * @throws {StatusResponseError} With status DynamicConstraintError if an id in `ids` is not present in the allocated list.
   */
  #validateAllocatedStreamIds(kind: 'video' | 'audio', ids: number[]): void {
    const state = this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer);
    const attributeName = kind === 'video' ? 'AllocatedVideoStreams' : 'AllocatedAudioStreams';
    const allocatedIds = kind === 'video' ? state.allocatedVideoStreams.map((stream) => stream.videoStreamId) : state.allocatedAudioStreams.map((stream) => stream.audioStreamId);
    if (allocatedIds.length === 0) {
      throw new StatusResponseError(`MatterbridgeWebRtcTransportProviderServer: no ${kind} stream is allocated (${attributeName} is empty)`, Status.InvalidInState);
    }
    if (new Set(ids).size !== ids.length) {
      throw new StatusResponseError(`MatterbridgeWebRtcTransportProviderServer: duplicate ${kind} stream id in the request`, Status.AlreadyExists);
    }
    for (const id of ids) {
      if (!allocatedIds.includes(id)) {
        throw new StatusResponseError(`MatterbridgeWebRtcTransportProviderServer: ${kind} stream ${id} is not present in ${attributeName}`, Status.DynamicConstraintError);
      }
    }
  }

  /**
   * Validates a SolicitOffer/ProvideOffer request's StreamUsage against the bound CameraAvStreamManagement
   * cluster's StreamUsagePriorities, per §11.5.6.1.10/§11.5.6.3.5 ("If StreamUsage is not found in the
   * StreamUsagePriorities: Fail the command with the status code DYNAMIC_CONSTRAINT_ERROR"). This check runs
   * before stream-id resolution/validation ({@link #resolveStrictStreamLists}/{@link #validateAllocatedStreamIds}),
   * matching the Effect-on-Receipt ordering in the spec. Only enforced when {@link #isStrictWebRtcTransport} is
   * true — no real client observed in production (see chipTests.md's "Real-World Client Traces") has ever sent a
   * StreamUsage outside StreamUsagePriorities, so the lenient default is left unchanged.
   *
   * @param {StreamUsage} streamUsage - The requested stream usage.
   * @throws {StatusResponseError} With status DynamicConstraintError if streamUsage is not present in StreamUsagePriorities.
   */
  #validateStreamUsage(streamUsage: StreamUsage): void {
    const streamUsagePriorities = this.endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)
      ? this.endpoint.stateOf(MatterbridgeCameraAvStreamManagementServer).streamUsagePriorities
      : [];
    if (!streamUsagePriorities.includes(streamUsage)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer: stream usage ${streamUsage} is not present in streamUsagePriorities`,
        Status.DynamicConstraintError,
      );
    }
  }

  /**
   * Resolves and validates the video/audio stream ids for a SolicitOffer/ProvideOffer request under strict Matter
   * specification conformance (see {@link #isStrictWebRtcTransport}), per §11.5.6.1.10/§11.5.6.3.5: a present
   * `VideoStreamID`/`AudioStreamID` that is `null` is resolved by selecting from already-allocated streams (see
   * {@link #selectExistingVideoStreamId}/{@link #selectExistingAudioStreamId}, never allocating a new one); a
   * present non-null id, or an explicit `videoStreams`/`audioStreams` list, is used as-is. Either way, the result is
   * then validated against `AllocatedVideoStreams`/`AllocatedAudioStreams` via {@link #validateAllocatedStreamIds}.
   *
   * @param {{ videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant fields of the SolicitOffer/ProvideOffer request.
   * @param {StreamUsage} streamUsage - The requested stream usage.
   * @returns {{ videoStreams?: number[]; audioStreams?: number[] }} The resolved and validated stream id lists; a list is omitted if the corresponding fields were not present in the request at all.
   * @throws {StatusResponseError} With status InvalidInState, AlreadyExists, or DynamicConstraintError — see {@link #validateAllocatedStreamIds}.
   */
  #resolveStrictStreamLists(
    request: { videoStreams?: number[]; audioStreams?: number[]; videoStreamId?: number | null; audioStreamId?: number | null },
    streamUsage: StreamUsage,
  ): { videoStreams?: number[]; audioStreams?: number[] } {
    let videoStreams: number[] | undefined;
    if (request.videoStreams !== undefined) {
      videoStreams = request.videoStreams;
    } else if (request.videoStreamId === null) {
      const selected = this.#selectExistingVideoStreamId(streamUsage);
      videoStreams = selected === undefined ? [] : [selected];
    } else if (request.videoStreamId !== undefined) {
      videoStreams = [request.videoStreamId];
    }
    if (videoStreams !== undefined) this.#validateAllocatedStreamIds('video', videoStreams);

    let audioStreams: number[] | undefined;
    if (request.audioStreams !== undefined) {
      audioStreams = request.audioStreams;
    } else if (request.audioStreamId === null) {
      const selected = this.#selectExistingAudioStreamId(streamUsage);
      audioStreams = selected === undefined ? [] : [selected];
    } else if (request.audioStreamId !== undefined) {
      audioStreams = [request.audioStreamId];
    }
    if (audioStreams !== undefined) this.#validateAllocatedStreamIds('audio', audioStreams);

    return { videoStreams, audioStreams };
  }

  /**
   * Builds the deprecated single-id `videoStreamId`/`audioStreamId` echo fields for a SolicitOfferResponse/ProvideOfferResponse.
   *
   * Per the Matter specification, their presence in the response is tied to the corresponding deprecated request field
   * (`videoStreamId`/`audioStreamId`) being present, regardless of whether the modern `videoStreams`/`audioStreams` list
   * was used instead: revision 1 clients (e.g. Home Assistant's Matter camera integration) send the deprecated field as
   * null to request automatic stream selection, and read the response's echoed id to learn which stream was selected.
   *
   * @param {{ videoStreamId?: number | null; audioStreamId?: number | null }} request - The relevant deprecated fields of the SolicitOffer/ProvideOffer request.
   * @param {number[]} [videoStreams] - The resolved videoStreams ids for the request (see {@link #resolveStreamLists}/{@link #autoAssignStreams}).
   * @param {number[]} [audioStreams] - The resolved audioStreams ids for the request (see {@link #resolveStreamLists}/{@link #autoAssignStreams}).
   * @returns {{ videoStreamId?: number | null; audioStreamId?: number | null }} The echo fields to include in the response; a field is omitted if the corresponding deprecated request field was not present.
   */
  #echoDeprecatedStreamIds(
    request: { videoStreamId?: number | null; audioStreamId?: number | null },
    videoStreams?: number[],
    audioStreams?: number[],
  ): { videoStreamId?: number | null; audioStreamId?: number | null } {
    return {
      videoStreamId: request.videoStreamId === undefined ? undefined : (videoStreams?.[0] ?? null),
      audioStreamId: request.audioStreamId === undefined ? undefined : (audioStreams?.[0] ?? null),
    };
  }

  /**
   * Enforces {@link MAX_CONCURRENT_SESSIONS}: if `webRtcSessionId` (just added to `currentSessions` by the caller,
   * before any werift peer connection exists for it — both call sites check this first) pushed the session count
   * past the cap, evicts it immediately — removes it from `currentSessions` and invokes End on the peer's
   * WebRtcTransportRequestor with reason `OutOfResources` (Matter 1.6 §11.4.5.2). The session is still accepted
   * normally up to this point (a real SolicitOfferResponse/ProvideOfferResponse with a valid session id), matching
   * the CHIP conformance suite's expectation that resource exhaustion is signaled by the device proactively ending
   * the new session rather than by rejecting the command outright — the device just can't sustain it.
   *
   * @param {number} webRtcSessionId - The just-created session id to evict if it pushed the count over capacity.
   * @param {Endpoint | undefined} requestorEndpoint - The peer's WebRtcTransportRequestor endpoint, if reachable.
   * @returns {boolean} true if the session was evicted; callers must skip any further SDP/peer-connection setup
   * and Offer/Answer invoke for it.
   */
  #evictIfOverCapacity(webRtcSessionId: number, requestorEndpoint: Endpoint | undefined): boolean {
    if (this.state.currentSessions.length <= MAX_CONCURRENT_SESSIONS) return false;

    this.state.currentSessions = this.state.currentSessions.filter((session) => session.id !== webRtcSessionId);
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.notice(
      `MatterbridgeWebRtcTransportProviderServer: session ${webRtcSessionId} exceeds MAX_CONCURRENT_SESSIONS (${MAX_CONCURRENT_SESSIONS}); evicting with WebRtcEndReason.OutOfResources (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    /* v8 ignore next 6 -- requires a real connectable peer node, which this project's vitest harness has no
     * infrastructure to set up (no remote peer test helpers exist). */
    if (requestorEndpoint) {
      this.#invokeDeferred(
        async () => requestorEndpoint.commandsOf(WebRtcTransportRequestorClient).end({ webRtcSessionId, reason: WebRtcTransportDefinitions.WebRtcEndReason.OutOfResources }),
        `End (OutOfResources) for session ${webRtcSessionId}`,
      );
    }
    return true;
  }

  /**
   * Handles the SolicitOffer command.
   * Creates a real werift peer connection for the new session (see {@link WeriftWebRtcSession}) and, if a
   * WebRtcTransportRequestor is bound to this endpoint, invokes Offer on it with the SDP offer generated by that
   * peer connection. If no requestor is bound yet, the Offer is silently skipped; this implementation has no
   * mechanism to send it later once a binding is established. If accepting this session pushes the concurrent
   * session count past {@link MAX_CONCURRENT_SESSIONS}, the session is evicted instead (see
   * {@link #evictIfOverCapacity}): the response below is still returned normally, but no SDP offer is ever
   * generated or sent, and the peer instead receives a deferred End invoke with reason OutOfResources.
   *
   * @param {WebRtcTransportProvider.SolicitOfferRequest} request - SolicitOffer request payload.
   * @returns {Promise<WebRtcTransportProvider.SolicitOfferResponse>} The newly allocated session identifier, with deferredOffer set to false: this
   * implementation has no standby/low-power state, so stream resolution and SDP offer generation both complete before this response is built.
   * @throws {StatusResponseError} With status InvalidCommand if MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 and none of videoStreams, audioStreams, videoStreamId or audioStreamId is present (see {@link #isStrictWebRtcTransport}).
   * @throws {StatusResponseError} With status DynamicConstraintError if MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 and streamUsage is not present in streamUsagePriorities (see {@link #validateStreamUsage}).
   * @throws {StatusResponseError} With status InvalidInState, AlreadyExists, or DynamicConstraintError if MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 (see {@link #resolveStrictStreamLists}/{@link #validateAllocatedStreamIds}).
   * @throws {StatusResponseError} With status ConstraintError if neither videoStreams nor audioStreams is provided or automatically assignable (see {@link #autoAssignStreams}).
   * @throws {StatusResponseError} With status InvalidCommand if both a deprecated single-id field and its modern list counterpart are present (see {@link #validateNoConflictingStreamFields}).
   */
  override async solicitOffer(request: WebRtcTransportProvider.SolicitOfferRequest): Promise<WebRtcTransportProvider.SolicitOfferResponse> {
    this.#validateNoConflictingStreamFields(request);
    let videoStreams: number[] | undefined;
    let audioStreams: number[] | undefined;
    if (this.#isStrictWebRtcTransport()) {
      if (this.#hasNoStreamFields(request)) {
        throw new StatusResponseError(
          'MatterbridgeWebRtcTransportProviderServer.solicitOffer requires at least one of videoStreams, audioStreams, videoStreamId or audioStreamId to be present',
          Status.InvalidCommand,
        );
      }
      this.#validateStreamUsage(request.streamUsage);
      ({ videoStreams, audioStreams } = this.#resolveStrictStreamLists(request, request.streamUsage));
    } else {
      ({ videoStreams, audioStreams } = this.#resolveStreamLists(request));
      if (!videoStreams?.length && !audioStreams?.length) {
        ({ videoStreams, audioStreams } = await this.#autoAssignStreams(request.streamUsage));
      }
    }
    if (!videoStreams?.length && !audioStreams?.length) {
      throw new StatusResponseError(
        'MatterbridgeWebRtcTransportProviderServer.solicitOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically',
        Status.ConstraintError,
      );
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const webRtcSessionId = this.#allocateWebRtcSessionId();
    const { peerNodeId, fabricIndex } = this.#getPeerInfo();
    this.state.currentSessions = [
      ...this.state.currentSessions,
      {
        id: webRtcSessionId,
        peerNodeId,
        peerEndpointId: request.originatingEndpointId,
        streamUsage: request.streamUsage,
        metadataEnabled: request.metadataEnabled ?? false,
        videoStreams,
        audioStreams,
        // Deprecated but still optionally-present per Matter 1.6 §11.4.5.5 (fields 4/5 of WebRTCSessionStruct),
        // distinct from the VideoStreams/AudioStreams lists above; a legacy client reading CurrentSessions
        // through these fields (rather than the modern lists) should still see the resolved stream.
        videoStreamId: videoStreams?.[0] ?? null,
        audioStreamId: audioStreams?.[0] ?? null,
        fabricIndex,
      },
    ];
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.solicitOffer: solicited a WebRTC offer for session ${webRtcSessionId} (stream usage ${request.streamUsage}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    const requestorEndpoint = await this.#resolvePeerRequestorEndpoint(peerNodeId, fabricIndex, request.originatingEndpointId);
    if (this.#evictIfOverCapacity(webRtcSessionId, requestorEndpoint)) {
      return { webRtcSessionId, deferredOffer: false, ...this.#echoDeprecatedStreamIds(request, videoStreams, audioStreams) };
    }

    const webRtcPeer = new WeriftWebRtcSession(webRtcSessionId);
    this.internal.sessions.set(webRtcSessionId, webRtcPeer);
    const sdp = await webRtcPeer.createOffer({ video: !!videoStreams?.length, audio: !!audioStreams?.length, videoResolution: this.#resolveVideoResolution(videoStreams) });

    /* v8 ignore next 6 -- requires a real connectable peer node, which this project's vitest harness has no
     * infrastructure to set up (no remote peer test helpers exist). */
    if (requestorEndpoint) {
      this.#invokeDeferred(async () => requestorEndpoint.commandsOf(WebRtcTransportRequestorClient).offer({ webRtcSessionId, sdp }), `Offer for session ${webRtcSessionId}`);
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.solicitOffer: invoking Offer on the peer's WebRtcTransportRequestor for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    } else {
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.solicitOffer: could not reach the peer's WebRtcTransportRequestor; the Offer for session ${webRtcSessionId} was not sent (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    return { webRtcSessionId, deferredOffer: false, ...this.#echoDeprecatedStreamIds(request, videoStreams, audioStreams) };
  }

  /**
   * Handles the ProvideOffer command.
   * Records the SDP offer against a new or existing session, applies it to that session's real werift peer
   * connection (see {@link WeriftWebRtcSession}), and, if a WebRtcTransportRequestor is bound to this endpoint,
   * invokes Answer on it with the SDP answer generated by that peer connection. If no requestor is bound yet, the
   * Answer is silently skipped; this implementation has no mechanism to send it later once a binding is established.
   * If a null webRtcSessionId creates a new session that pushes the concurrent session count past
   * {@link MAX_CONCURRENT_SESSIONS}, that new session is evicted instead (see {@link #evictIfOverCapacity}): the
   * response below is still returned normally, but no SDP answer is ever generated or sent, and the peer instead
   * receives a deferred End invoke with reason OutOfResources.
   *
   * @param {WebRtcTransportProvider.ProvideOfferRequest} request - ProvideOffer request payload.
   * @returns {Promise<WebRtcTransportProvider.ProvideOfferResponse>} The session identifier the offer was recorded against.
   * @throws {StatusResponseError} With status NotFound if a non-null webRtcSessionId is not present in currentSessions.
   * @throws {StatusResponseError} With status InvalidCommand if webRtcSessionId is null, MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1, and none of videoStreams, audioStreams, videoStreamId or audioStreamId is present (see {@link #isStrictWebRtcTransport}).
   * @throws {StatusResponseError} With status DynamicConstraintError if webRtcSessionId is null, MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1, and streamUsage is not present in streamUsagePriorities (see {@link #validateStreamUsage}).
   * @throws {StatusResponseError} With status InvalidInState, AlreadyExists, or DynamicConstraintError if webRtcSessionId is null and MATTERBRIDGE_STRICT_WEBRTCTRANSPORT=1 (see {@link #resolveStrictStreamLists}/{@link #validateAllocatedStreamIds}).
   * @throws {StatusResponseError} With status ConstraintError if webRtcSessionId is null and neither videoStreams nor audioStreams is provided or automatically assignable (see {@link #autoAssignStreams}).
   * @throws {StatusResponseError} With status InvalidCommand if webRtcSessionId is null and both a deprecated single-id field and its modern list counterpart are present (see {@link #validateNoConflictingStreamFields}).
   */
  override async provideOffer(request: WebRtcTransportProvider.ProvideOfferRequest): Promise<WebRtcTransportProvider.ProvideOfferResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    let webRtcSessionId = request.webRtcSessionId;
    if (webRtcSessionId === null) {
      this.#validateNoConflictingStreamFields(request);
      let videoStreams: number[] | undefined;
      let audioStreams: number[] | undefined;
      if (this.#isStrictWebRtcTransport()) {
        if (this.#hasNoStreamFields(request)) {
          throw new StatusResponseError(
            'MatterbridgeWebRtcTransportProviderServer.provideOffer requires at least one of videoStreams, audioStreams, videoStreamId or audioStreamId to be present',
            Status.InvalidCommand,
          );
        }
        this.#validateStreamUsage(request.streamUsage ?? StreamUsage.LiveView);
        ({ videoStreams, audioStreams } = this.#resolveStrictStreamLists(request, request.streamUsage ?? StreamUsage.LiveView));
      } else {
        ({ videoStreams, audioStreams } = this.#resolveStreamLists(request));
        if (!videoStreams?.length && !audioStreams?.length) {
          ({ videoStreams, audioStreams } = await this.#autoAssignStreams(request.streamUsage ?? StreamUsage.LiveView));
        }
      }
      if (!videoStreams?.length && !audioStreams?.length) {
        throw new StatusResponseError(
          'MatterbridgeWebRtcTransportProviderServer.provideOffer requires at least one of videoStreams or audioStreams; the camera has no video or audio stream to assign automatically',
          Status.ConstraintError,
        );
      }
      webRtcSessionId = this.#allocateWebRtcSessionId();
      const { peerNodeId, fabricIndex } = this.#getPeerInfo();
      this.state.currentSessions = [
        ...this.state.currentSessions,
        {
          id: webRtcSessionId,
          peerNodeId,
          peerEndpointId: request.originatingEndpointId ?? EndpointNumber(0),
          streamUsage: request.streamUsage ?? StreamUsage.LiveView,
          metadataEnabled: request.metadataEnabled ?? false,
          videoStreams,
          audioStreams,
          // See the equivalent comment in solicitOffer above.
          videoStreamId: videoStreams?.[0] ?? null,
          audioStreamId: audioStreams?.[0] ?? null,
          fabricIndex,
        },
      ];

      const requestorEndpointForCapacityCheck = await this.#resolvePeerRequestorEndpoint(peerNodeId, fabricIndex, request.originatingEndpointId ?? EndpointNumber(0));
      if (this.#evictIfOverCapacity(webRtcSessionId, requestorEndpointForCapacityCheck)) {
        return { webRtcSessionId, ...this.#echoDeprecatedStreamIds(request, videoStreams, audioStreams) };
      }
    } else if (!this.state.currentSessions.some((session) => session.id === webRtcSessionId)) {
      throw new StatusResponseError(`WebRTC session ${webRtcSessionId} is not present in currentSessions`, Status.NotFound);
    }
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.log.debug(`MatterbridgeWebRtcTransportProviderServer.provideOffer: received an SDP offer for session ${webRtcSessionId}:\n${request.sdp}`);

    // oxlint-disable-next-line typescript/no-non-null-assertion -- the session was just created or found above.
    const session = this.state.currentSessions.find((s) => s.id === webRtcSessionId)!;
    const webRtcPeer = this.internal.sessions.get(webRtcSessionId) ?? new WeriftWebRtcSession(webRtcSessionId);
    this.internal.sessions.set(webRtcSessionId, webRtcPeer);
    const sdp = await webRtcPeer.createAnswer(request.sdp, this.#resolveVideoResolution(session.videoStreams));

    const requestorEndpoint = await this.#resolvePeerRequestorEndpoint(session.peerNodeId, session.fabricIndex, session.peerEndpointId);
    /* v8 ignore next 6 -- requires a real connectable peer node, which this project's vitest harness has no
     * infrastructure to set up (no remote peer test helpers exist). */
    if (requestorEndpoint) {
      this.#invokeDeferred(async () => requestorEndpoint.commandsOf(WebRtcTransportRequestorClient).answer({ webRtcSessionId, sdp }), `Answer for session ${webRtcSessionId}`);
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.provideOffer: invoking Answer on the peer's WebRtcTransportRequestor for session ${webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    } else {
      device.log.info(
        `MatterbridgeWebRtcTransportProviderServer.provideOffer: could not reach the peer's WebRtcTransportRequestor; the Answer for session ${webRtcSessionId} was not sent (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Spread into plain arrays first: state's list attributes throw on out-of-bounds index access (e.g. `[0]` on an
    // empty list) instead of returning undefined like a normal JS array.
    return { webRtcSessionId, ...this.#echoDeprecatedStreamIds(request, session.videoStreams && [...session.videoStreams], session.audioStreams && [...session.audioStreams]) };
  }

  /**
   * Handles the ProvideAnswer command.
   * Records the SDP answer received in response to a previously sent offer and applies it to that session's real
   * werift peer connection (see {@link WeriftWebRtcSession}), if one was created by {@link solicitOffer} or
   * {@link provideOffer}.
   *
   * @param {WebRtcTransportProvider.ProvideAnswerRequest} request - ProvideAnswer request payload.
   * @returns {Promise<void>} Resolves once the answer has been recorded and, if applicable, applied.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override async provideAnswer(request: WebRtcTransportProvider.ProvideAnswerRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer.provideAnswer: webRTC session ${request.webRtcSessionId} is not present in currentSessions`,
        Status.NotFound,
      );
    }
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.provideAnswer: received an SDP answer for session ${request.webRtcSessionId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.log.debug(`MatterbridgeWebRtcTransportProviderServer.provideAnswer: received SDP answer for session ${request.webRtcSessionId}:\n${request.sdp}`);

    const webRtcPeer = this.internal.sessions.get(request.webRtcSessionId);
    if (webRtcPeer) {
      await webRtcPeer.applyAnswer(request.sdp);
    }
  }

  /**
   * Handles the ProvideIceCandidates command.
   * Records the ICE candidates gathered for a session and applies them to that session's real werift peer
   * connection (see {@link WeriftWebRtcSession}), if one was created by {@link solicitOffer} or {@link provideOffer}.
   *
   * mDNS host candidates (`*.local`, e.g. from a browser with WebRTC IP obfuscation enabled) are applied like any
   * other candidate: werift-ice resolves them via a real multicast DNS query before pairing them (see
   * `IceGatherer.addRemoteCandidate` in the werift-ice dependency), so this method does not need to special-case
   * them itself.
   *
   * Candidates are applied concurrently rather than one at a time, and this command does not wait for that
   * application to finish before returning: a browser routinely offers one host candidate per local network
   * interface, and an interface with no multicast route to this peer (e.g. an inactive VPN/virtual adapter) makes
   * its candidate's mDNS resolution run out the full {@link ICE_CANDIDATE_APPLY_TIMEOUT_MS} budget. A sibling
   * candidate on a reachable interface routinely succeeds in milliseconds, so blocking this command's response on
   * every candidate (even applied concurrently) would still needlessly hold the peer waiting on the doomed one for
   * up to {@link ICE_CANDIDATE_APPLY_TIMEOUT_MS} — the same reason {@link #invokeDeferred} does not block
   * SolicitOffer/ProvideOffer's response on the peer's Offer/Answer invoke.
   *
   * @param {WebRtcTransportProvider.ProvideIceCandidatesRequest} request - ProvideIceCandidates request payload.
   * @returns {Promise<void>} Resolves once the candidates have been recorded; their application against the peer
   * connection continues in the background and is only reflected in the log.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  // oxlint-disable-next-line typescript/require-await
  override async provideIceCandidates(request: WebRtcTransportProvider.ProvideIceCandidatesRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: webRTC session ${request.webRtcSessionId} is not present in currentSessions`,
        Status.NotFound,
      );
    }
    // Captured now, rather than read again from `this.endpoint` in the background application below: this behavior
    // instance is ephemeral (see this class's doc comment) and may no longer be valid by the time that code runs.
    const endpointLabel = `${this.endpoint.maybeId}.${this.endpoint.maybeNumber}`;
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: received ${request.iceCandidates.length} ICE candidate(s) for session ${request.webRtcSessionId} (endpoint ${endpointLabel})`,
    );

    const webRtcPeer = this.internal.sessions.get(request.webRtcSessionId);
    if (webRtcPeer) {
      // Not awaited: see this method's doc comment for why the command response must not wait on candidate
      // application. Every candidate's own errors/timeouts are caught below, so this can never reject.
      void Promise.allSettled(
        request.iceCandidates.map(async (candidate, index) => {
          const startedAt = Date.now();
          device.log.debug(
            `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applying ICE candidate ${index + 1}/${request.iceCandidates.length} for session ${request.webRtcSessionId} ` +
              `(mid=${candidate.sdpMid ?? 'null'}, mLine=${candidate.sdpmLineIndex ?? 'null'}, endOfCandidates=${candidate.candidate.trim() === ''}) ` +
              `(endpoint ${endpointLabel})`,
          );
          try {
            let timeout: NodeJS.Timeout | undefined;
            try {
              await Promise.race([
                webRtcPeer.addIceCandidate(candidate.candidate, candidate.sdpMid, candidate.sdpmLineIndex),
                new Promise<void>((resolve, reject) => {
                  timeout = setTimeout(
                    () =>
                      reject(new Error(`MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: ICE candidate apply timeout after ${ICE_CANDIDATE_APPLY_TIMEOUT_MS}ms`)),
                    ICE_CANDIDATE_APPLY_TIMEOUT_MS,
                  );
                }),
              ]);
            } finally {
              clearTimeout(timeout);
            }
            device.log.debug(
              `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: applied ICE candidate ${index + 1}/${request.iceCandidates.length} for session ${request.webRtcSessionId} ` +
                `in ${Date.now() - startedAt}ms (endpoint ${endpointLabel})`,
            );
          } catch (error) {
            device.log.warn(
              `MatterbridgeWebRtcTransportProviderServer.provideIceCandidates: failed ICE candidate ${index + 1}/${request.iceCandidates.length} for session ${request.webRtcSessionId} after ${Date.now() - startedAt}ms ` +
                `(endpoint ${endpointLabel}): ${String(error)}`,
            );
          }
        }),
      );
    }
  }

  /**
   * Handles the EndSession command.
   * Removes the session from currentSessions and closes its real werift peer connection, if one was created by
   * {@link solicitOffer}.
   *
   * @param {WebRtcTransportProvider.EndSessionRequest} request - EndSession request payload.
   * @throws {StatusResponseError} With status NotFound if webRtcSessionId is not present in currentSessions.
   */
  override async endSession(request: WebRtcTransportProvider.EndSessionRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (!this.state.currentSessions.some((session) => session.id === request.webRtcSessionId)) {
      throw new StatusResponseError(
        `MatterbridgeWebRtcTransportProviderServer.endSession: webRTC session ${request.webRtcSessionId} is not present in currentSessions`,
        Status.NotFound,
      );
    }
    this.state.currentSessions = this.state.currentSessions.filter((session) => session.id !== request.webRtcSessionId);
    const webRtcPeer = this.internal.sessions.get(request.webRtcSessionId);
    if (webRtcPeer) {
      this.internal.sessions.delete(request.webRtcSessionId);
      await webRtcPeer.close();
    }
    device.log.info(
      `MatterbridgeWebRtcTransportProviderServer.endSession: ended webRTC session ${request.webRtcSessionId} (reason ${request.reason}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }
}

/**
 * matter.js's own Behavior subclasses declare Internal/State/Events this way (see e.g. @matter/node's
 * SubscriptionsServer.ts); it's how the framework resolves `this.internal`'s type, so an ES module can't replace it.
 */
// oxlint-disable-next-line typescript-eslint/no-namespace
export namespace MatterbridgeWebRtcTransportProviderServer {
  /**
   * Internal (endpoint-scoped, not instance-scoped) state for {@link MatterbridgeWebRtcTransportProviderServer}.
   */
  export class Internal {
    /** The next WebRTC session identifier candidate, retained across ephemeral behavior agents. */
    nextWebRtcSessionId = 0;

    /**
     * The real werift peer connection wrappers backing each session in {@link WebRtcTransportProvider.State.currentSessions},
     * keyed by WebRTC session id.
     */
    sessions = new Map<number, WeriftWebRtcSession>();
  }
  /* v8 ignore next -- compiler-generated fallback (`Foo || (Foo = {})`) for namespace/class declaration merging;
   * the class is always already defined by the time this runs, so the assignment branch is structurally unreachable. */
}

/**
 * Creates a default WebRtcTransportProvider cluster server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the WebRtcTransportProvider cluster server on.
 * @returns {MatterbridgeEndpoint} The endpoint with the WebRtcTransportProvider cluster server created.
 */
export function createDefaultWebRtcTransportProviderClusterServer(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeWebRtcTransportProviderServer, { currentSessions: [] });
  return endpoint;
}
