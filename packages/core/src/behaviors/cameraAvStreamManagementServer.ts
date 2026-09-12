/**
 * @file packages/core/src/behaviors/cameraAvStreamManagementServer.ts
 * @description This file contains the MatterbridgeCameraAvStreamManagementServer class of Matterbridge.
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

import { readFileSync } from 'node:fs';

import { CameraAvStreamManagementServer } from '@matter/node/behaviors/camera-av-stream-management';
import { Status, StatusResponseError, StreamUsage, ThreeLevelAuto } from '@matter/types';
import type { Viewport } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * A static JPEG television calibration card available to serve from `CaptureSnapshot`, at a given resolution.
 */
export interface CameraColorTestJpeg {
  /** The JPEG image data. */
  data: Buffer;
  /** The resolution of the JPEG image. */
  resolution: CameraAvStreamManagement.VideoResolution;
}

const DEFAULT_CAMERA_COLOR_TEST_RESOLUTION = '640x480';

/**
 * Valid AudioStreamAllocate BitDepth values per Matter 1.6 Application Cluster spec §11.2.8.1 ("8, 16, 24, 32").
 * This is a discrete set rather than a simple min/max range, so matter.js does not enforce it automatically.
 */
const AUDIO_STREAM_BIT_DEPTHS = [8, 16, 24, 32];

/**
 * Returns the numeric member values of a matter.js numeric enum object, ignoring the reverse string mappings
 * TypeScript generates alongside them.
 *
 * @param {Record<string, number | string>} enumObject - The enum object to read member values from.
 * @returns {number[]} The enum's numeric member values.
 */
function numericEnumValues(enumObject: Record<string, number | string>): number[] {
  return Object.values(enumObject).filter((value): value is number => typeof value === 'number');
}

/** Valid AudioCodecEnum member values; unlike ImageCodec, matter.js does not reject unknown AudioCodec values before the command handler runs. */
const AUDIO_CODECS = numericEnumValues(CameraAvStreamManagement.AudioCodec);

/** Valid VideoCodecEnum member values; unlike ImageCodec, matter.js does not reject unknown VideoCodec values before the command handler runs. */
const VIDEO_CODECS = numericEnumValues(CameraAvStreamManagement.VideoCodec);

const cameraColorTestJpegs: Record<string, CameraColorTestJpeg> = {
  '640x480': { data: readFileSync(new URL('../../assets/camera-color-test-640-480.jpeg', import.meta.url)), resolution: { width: 640, height: 480 } },
  '1280x720': { data: readFileSync(new URL('../../assets/camera-color-test-1280-720.jpeg', import.meta.url)), resolution: { width: 1280, height: 720 } },
  '1920x1080': { data: readFileSync(new URL('../../assets/camera-color-test-1920-1080.jpeg', import.meta.url)), resolution: { width: 1920, height: 1080 } },
};

/**
 * Returns the {@link CameraColorTestJpeg} calibration card matching the requested resolution exactly.
 *
 * Edge cases:
 *  - Falls back to the 640x480 card when the requested resolution isn't one of the standard camera resolutions (640x480, 1280x720, 1920x1080).
 *
 * @param {CameraAvStreamManagement.VideoResolution} requestedResolution - The resolution requested by the client.
 * @returns {CameraColorTestJpeg} The matching calibration card.
 */
export function cameraColorTestJpegForResolution(requestedResolution: CameraAvStreamManagement.VideoResolution): CameraColorTestJpeg {
  return cameraColorTestJpegs[`${requestedResolution.width}x${requestedResolution.height}`] ?? cameraColorTestJpegs[DEFAULT_CAMERA_COLOR_TEST_RESOLUTION];
}

/**
 * CameraAvStreamManagement server, specialized for the Snapshot feature only, that implements the
 * stream-priority, snapshot-stream allocation, and snapshot-capture commands required by a Snapshot Camera device.
 */
export class MatterbridgeCameraAvStreamManagementServer extends CameraAvStreamManagementServer.with(
  CameraAvStreamManagement.Feature.Video,
  CameraAvStreamManagement.Feature.Audio,
  CameraAvStreamManagement.Feature.Snapshot,
  CameraAvStreamManagement.Feature.ImageControl,
) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Whether {@link initialize}'s default stream self-allocation is skipped entirely. Set via the
   * `MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT` environment variable (`1` to skip), for the CHIP
   * WebRTC/AVSM conformance test suite: `TC_AVSM_2_2`/`TC_AVSM_2_5` assert `AllocatedSnapshotStreams`/
   * `AllocatedAudioStreams` are empty immediately after commissioning, which self-allocation would otherwise violate
   * — the certification suite models allocation as purely commissioner-driven and never anticipates a device
   * pre-allocating on its own. Left unset (the default), self-allocation runs normally.
   *
   * @returns {boolean} True if self-allocation should be skipped.
   */
  #isAutoAllocateSkipped(): boolean {
    return process.env.MATTERBRIDGE_SKIP_AUTO_ALLOCATE_CAMERA_AV_STREAM_MANAGEMENT === '1';
  }

  /**
   * Self-allocates a default video/audio/snapshot stream for any feature this endpoint supports that has none
   * allocated yet, so `AllocatedVideoStreams`/`AllocatedAudioStreams`/`AllocatedSnapshotStreams` are never
   * unexpectedly empty for a client that assumes the Matter 1.6/1.5.1 §11.2.1.1 "Stream Lifecycle" recommendation
   * holds (a Commissioner allocates once at commissioning time, and the resulting streams then have very long
   * lifetimes) but never actually calls `VideoStreamAllocate`/`AudioStreamAllocate`/`SnapshotStreamAllocate` itself
   * (e.g. SmartThings, observed in production only ever sending `ProvideOffer` with a guessed stream id and no prior
   * allocation — see `chipTests.md`'s "Real-World Client Traces"). Also a safety net against
   * `AllocatedVideoStreams`/`AllocatedAudioStreams`/`AllocatedSnapshotStreams` (`N`-quality, i.e. Matter-mandated
   * non-volatile per §11.2.7) being legitimately reset by matter.js when this cluster's `FeatureMap` changes between
   * restarts, since a passive client has no reason to notice or reallocate after that.
   *
   * Runs once per endpoint construction, after persisted state (if any) has already been loaded — so this only ever
   * populates streams that are genuinely absent, never overwrites a real allocation (including one restored from
   * storage). Bypasses the `videoStreamAllocate`/`audioStreamAllocate`/`snapshotStreamAllocate` command handlers
   * entirely (calling a command on this same behavior from within its own `initialize()`, before construction
   * finishes, is not safe) and instead constructs the same struct shape those handlers build, directly. Skipped
   * entirely when {@link #isAutoAllocateSkipped} is true.
   */
  override initialize(): void {
    if (this.#isAutoAllocateSkipped()) return;

    if (this.features.video && this.state.allocatedVideoStreams.length === 0 && this.state.rateDistortionTradeOffPoints.length > 0 && this.state.streamUsagePriorities.length > 0) {
      const { rateDistortionTradeOffPoints } = this.state;
      // Pick the highest-resolution trade-off point rather than just the first one, so the default stream
      // represents the camera's top resolution regardless of how many lower-resolution entries precede it.
      let largestTradeOffPoint = rateDistortionTradeOffPoints[0];
      for (const point of rateDistortionTradeOffPoints) {
        if (point.resolution.width * point.resolution.height > largestTradeOffPoint.resolution.width * largestTradeOffPoint.resolution.height) largestTradeOffPoint = point;
      }
      const { codec, resolution, minBitRate } = largestTradeOffPoint;
      this.state.allocatedVideoStreams = [
        {
          videoStreamId: 0,
          streamUsage: this.state.streamUsagePriorities[0],
          videoCodec: codec,
          minFrameRate: 1,
          maxFrameRate: this.state.videoSensorParams.maxFps,
          minResolution: this.state.minViewportResolution,
          maxResolution: resolution,
          minBitRate,
          // RateDistortionTradeOffPointsStruct (Matter 1.6 §11.2.6.9) only carries a floor MinBitRate, no
          // matching max — MaxBitRate must be synthesized. 4x is a typical H.264 VBR peak-to-floor ratio for
          // camera streams; MaxBitRate === MinBitRate would leave the stream no room to vary at all.
          maxBitRate: minBitRate * 4,
          keyFrameInterval: 4000,
          // watermarkEnabled/osdEnabled are conformance-gated by the Watermark/OnScreenDisplay features (Matter 1.6 §11.2.9.1.9/.10)
          // and rejected outright when present but unsupported, so they're only included when actually enabled.
          ...(this.features.watermark ? { watermarkEnabled: false } : {}),
          ...(this.features.onScreenDisplay ? { osdEnabled: false } : {}),
          referenceCount: 0,
        },
      ];
    }

    if (
      this.features.audio &&
      this.state.allocatedAudioStreams.length === 0 &&
      this.state.microphoneCapabilities.supportedCodecs.length > 0 &&
      this.state.streamUsagePriorities.length > 0
    ) {
      const { microphoneCapabilities } = this.state;
      this.state.allocatedAudioStreams = [
        {
          audioStreamId: 0,
          streamUsage: this.state.streamUsagePriorities[0],
          audioCodec: microphoneCapabilities.supportedCodecs[0],
          channelCount: microphoneCapabilities.maxNumberOfChannels,
          sampleRate: microphoneCapabilities.supportedSampleRates[0],
          bitRate: 32_000,
          bitDepth: microphoneCapabilities.supportedBitDepths[0],
          referenceCount: 0,
        },
      ];
    }

    if (this.features.snapshot && this.state.allocatedSnapshotStreams.length === 0 && this.state.snapshotCapabilities.length > 0) {
      const { snapshotCapabilities } = this.state;
      // Span the full supported resolution range (smallest to largest capability) rather than a single fixed point, so
      // that a real client's request for any of the device's own advertised snapshotCapabilities entries (not just the
      // smallest one) dedup-matches this default stream in snapshotStreamAllocate (Matter 1.6 §11.2.8.8.8) instead of
      // spawning an unwanted duplicate allocation. Mirrors how the video default stream spans minViewportResolution to
      // its top rateDistortionTradeOffPoints resolution, above.
      let smallestCapability = snapshotCapabilities[0];
      let largestCapability = snapshotCapabilities[0];
      for (const capability of snapshotCapabilities) {
        if (capability.resolution.width * capability.resolution.height < smallestCapability.resolution.width * smallestCapability.resolution.height)
          smallestCapability = capability;
        if (capability.resolution.width * capability.resolution.height > largestCapability.resolution.width * largestCapability.resolution.height) largestCapability = capability;
      }
      this.state.allocatedSnapshotStreams = [
        {
          snapshotStreamId: 0,
          imageCodec: largestCapability.imageCodec,
          frameRate: largestCapability.maxFrameRate,
          minResolution: smallestCapability.resolution,
          maxResolution: largestCapability.resolution,
          quality: 90,
          referenceCount: 0,
          encodedPixels: false,
          hardwareEncoder: false,
          // See the equivalent comment above for allocatedVideoStreams.
          ...(this.features.watermark ? { watermarkEnabled: false } : {}),
          ...(this.features.onScreenDisplay ? { osdEnabled: false } : {}),
        },
      ];
    }
  }

  /**
   * Handles the SetStreamPriorities command.
   * Sets the relative priorities of the various stream usages on the camera.
   *
   * @param {CameraAvStreamManagement.SetStreamPrioritiesRequest} request - SetStreamPriorities request payload.
   * @throws {StatusResponseError} With status InvalidInState if a snapshot, video, or audio stream is currently allocated.
   * @throws {StatusResponseError} With status DynamicConstraintError if streamPriorities contains an unsupported stream usage.
   * @throws {StatusResponseError} With status AlreadyExists if streamPriorities contains a duplicate value.
   */
  override setStreamPriorities(request: CameraAvStreamManagement.SetStreamPrioritiesRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    if (
      // Matter 1.6.0 § 11.2.8.12.2: Fail SetStreamPriorities with INVALID_IN_STATE if any entry exists in AllocatedSnapshotStreams, AllocatedVideoStreams or AllocatedAudioStreams.
      (this.features.snapshot && this.state.allocatedSnapshotStreams.length > 0) ||
      (this.features.video && this.state.allocatedVideoStreams.length > 0) ||
      (this.features.audio && this.state.allocatedAudioStreams.length > 0)
    ) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.0 § 11.2.8.12.2: Fail SetStreamPriorities with DYNAMIC_CONSTRAINT_ERROR if a requested StreamPriorities value is not found in SupportedStreamUsages.
    if (!request.streamPriorities.every((usage) => this.state.supportedStreamUsages.includes(usage))) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: streamPriorities shall only contain entries found in supportedStreamUsages (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }
    // Matter 1.6.0 § 11.2.8.12.2: Fail SetStreamPriorities with ALREADY_EXISTS if StreamPriorities contains duplicate stream usages.
    if (new Set(request.streamPriorities).size !== request.streamPriorities.length) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: streamPriorities shall not contain duplicate values (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.AlreadyExists,
      );
    }
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: setting stream priorities to [${request.streamPriorities.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 11.2.8.12.2: Update the StreamUsagePriorities attribute with the contents of StreamPriorities.
    this.state.streamUsagePriorities = request.streamPriorities;
    this.endpoint.emitCommand(CameraAvStreamManagement, 'setStreamPriorities', request, this.context);
  }

  /**
   * Handles the VideoStreamAllocate command.
   * Allocates a video stream on the camera and returns the newly allocated video stream identifier, reusing an
   * already allocated stream's identifier when one matches the request.
   *
   * @param {CameraAvStreamManagement.VideoStreamAllocateRequest} request - VideoStreamAllocate request payload.
   * @returns {CameraAvStreamManagement.VideoStreamAllocateResponse} The newly allocated or reused video stream identifier.
   * @throws {StatusResponseError} With status ConstraintError if the requested stream usage is Internal, or videoCodec is not a valid VideoCodecEnum value.
   * @throws {StatusResponseError} With status InvalidInState if the requested stream usage is not present in streamUsagePriorities.
   * @throws {StatusResponseError} With status DynamicConstraintError if no entry in rateDistortionTradeOffPoints matches the requested videoCodec, minResolution/maxResolution range and maxBitRate, or maxFrameRate exceeds videoSensorParams.
   * @throws {StatusResponseError} With status ResourceExhausted if allocating a new (non-reused) stream would exceed maxConcurrentEncoders.
   */
  override videoStreamAllocate(request: CameraAvStreamManagement.VideoStreamAllocateRequest): CameraAvStreamManagement.VideoStreamAllocateResponse {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.2.8.4: Reject with CONSTRAINT_ERROR; the VideoStreamAllocate StreamUsage field is constrained to Recording, Analysis and LiveView, so Internal is out of range.
    if (request.streamUsage === StreamUsage.Internal) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: stream usage Internal is not allowed for VideoStreamAllocate (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.2.8.4.12: Fail VideoStreamAllocate with INVALID_IN_STATE if the requested StreamUsage is not found in StreamUsagePriorities.
    if (!this.state.streamUsagePriorities.includes(request.streamUsage)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: stream usage ${request.streamUsage} is not present in streamUsagePriorities (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.0 § 11.2.8.4: Reject with CONSTRAINT_ERROR; the VideoCodec field is constrained to the VideoCodecEnum values.
    if (!VIDEO_CODECS.includes(request.videoCodec)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: videoCodec ${request.videoCodec} is not a valid VideoCodecEnum value (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // These two are cross-field bounds, which matter.js does not auto-enforce from the cluster definition.
    // Matter 1.6.0 § 11.2.8.4: Reject with CONSTRAINT_ERROR; the MinFrameRate field is constrained to "1 to MaxFrameRate".
    if (request.minFrameRate > request.maxFrameRate) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: minFrameRate ${request.minFrameRate} must not be greater than MaxFrameRate ${request.maxFrameRate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.2.8.4: Reject with CONSTRAINT_ERROR; the MinBitRate field is constrained to "1 to MaxBitRate".
    if (request.minBitRate > request.maxBitRate) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: minBitRate ${request.minBitRate} must not be greater than MaxBitRate ${request.maxBitRate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const matchesTradeOffPoint = this.state.rateDistortionTradeOffPoints.some(
      (point) =>
        point.codec === request.videoCodec &&
        point.resolution.width >= request.minResolution.width &&
        point.resolution.width <= request.maxResolution.width &&
        point.resolution.height >= request.minResolution.height &&
        point.resolution.height <= request.maxResolution.height &&
        point.minBitRate <= request.maxBitRate,
    );
    // Matter 1.6.0 § 11.2.8.4.12: Fail VideoStreamAllocate with DYNAMIC_CONSTRAINT_ERROR if an unsupported codec, frame rate, resolution or bit rate is requested.
    if (!matchesTradeOffPoint || request.maxFrameRate > this.state.videoSensorParams.maxFps) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: videoStreamAllocate requested parameters do not match any entry in rateDistortionTradeOffPoints or exceed videoSensorParams (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }

    const existingStream = this.state.allocatedVideoStreams.find(
      (stream) =>
        stream.streamUsage === request.streamUsage &&
        stream.videoCodec === request.videoCodec &&
        stream.minFrameRate === request.minFrameRate &&
        stream.maxFrameRate === request.maxFrameRate &&
        stream.minResolution.width === request.minResolution.width &&
        stream.minResolution.height === request.minResolution.height &&
        stream.maxResolution.width === request.maxResolution.width &&
        stream.maxResolution.height === request.maxResolution.height &&
        stream.minBitRate === request.minBitRate &&
        stream.maxBitRate === request.maxBitRate &&
        stream.keyFrameInterval === request.keyFrameInterval,
    );
    // Matter 1.6.0 § 11.2.8.4.12: Return the existing VideoStreamID when an entry in AllocatedVideoStreams matches the request, with no other side effects.
    if (existingStream) {
      device.log.info(
        `MatterbridgeCameraAvStreamManagementServer: reused video stream ${existingStream.videoStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      this.endpoint.emitCommand(CameraAvStreamManagement, 'videoStreamAllocate', request, this.context);
      return { videoStreamId: existingStream.videoStreamId };
    }
    // Matter 1.6.0 § 11.2.8.4.12: Fail VideoStreamAllocate with RESOURCE_EXHAUSTED if there are not enough resources to allocate a new video stream.
    if (this.state.allocatedVideoStreams.length >= this.state.maxConcurrentEncoders) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: videoStreamAllocate would exceed maxConcurrentEncoders (${this.state.maxConcurrentEncoders}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ResourceExhausted,
      );
    }

    let videoStreamId = 0;
    for (const stream of this.state.allocatedVideoStreams) {
      videoStreamId = Math.max(videoStreamId, stream.videoStreamId + 1);
    }
    // Matter 1.6.0 § 11.2.8.4.12: Allocate a new VideoStreamID and append its VideoStreamStruct to AllocatedVideoStreams.
    this.state.allocatedVideoStreams = [
      ...this.state.allocatedVideoStreams,
      {
        videoStreamId,
        streamUsage: request.streamUsage,
        videoCodec: request.videoCodec,
        minFrameRate: request.minFrameRate,
        maxFrameRate: request.maxFrameRate,
        minResolution: request.minResolution,
        maxResolution: request.maxResolution,
        minBitRate: request.minBitRate,
        maxBitRate: request.maxBitRate,
        keyFrameInterval: request.keyFrameInterval,
        watermarkEnabled: request.watermarkEnabled,
        osdEnabled: request.osdEnabled,
        referenceCount: 0,
      },
    ];
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: allocated video stream ${videoStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvStreamManagement, 'videoStreamAllocate', request, this.context);
    return { videoStreamId };
  }

  /**
   * Handles the VideoStreamDeallocate command.
   * Deallocates the video stream on the camera corresponding to the given video stream identifier.
   *
   * @param {CameraAvStreamManagement.VideoStreamDeallocateRequest} request - VideoStreamDeallocate request payload.
   * @throws {StatusResponseError} With status NotFound if the requested videoStreamId is not present in allocatedVideoStreams.
   */
  override videoStreamDeallocate(request: CameraAvStreamManagement.VideoStreamDeallocateRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.2.8.7.2: Fail VideoStreamDeallocate with NOT_FOUND if VideoStreamID does not match an entry in AllocatedVideoStreams.
    if (!this.state.allocatedVideoStreams.some((stream) => stream.videoStreamId === request.videoStreamId)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: video stream ${request.videoStreamId} is not present in allocatedVideoStreams (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    // Matter 1.6.0 § 11.2.8.7.2: Deallocate the stream and remove its VideoStreamID entry from AllocatedVideoStreams.
    this.state.allocatedVideoStreams = this.state.allocatedVideoStreams.filter((stream) => stream.videoStreamId !== request.videoStreamId);
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: deallocated video stream ${request.videoStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvStreamManagement, 'videoStreamDeallocate', request, this.context);
  }

  /**
   * Handles the AudioStreamAllocate command.
   * Allocates an audio stream on the camera and returns the newly allocated audio stream identifier, reusing an
   * already allocated stream's identifier when one matches the request.
   *
   * @param {CameraAvStreamManagement.AudioStreamAllocateRequest} request - AudioStreamAllocate request payload.
   * @returns {CameraAvStreamManagement.AudioStreamAllocateResponse} The newly allocated or reused audio stream identifier.
   * @throws {StatusResponseError} With status ConstraintError if the requested stream usage is Internal.
   * @throws {StatusResponseError} With status InvalidInState if the requested stream usage is not present in streamUsagePriorities.
   * @throws {StatusResponseError} With status ConstraintError if the requested audioCodec is not a valid AudioCodecEnum value, or bitDepth is not one of 8, 16, 24, or 32.
   * @throws {StatusResponseError} With status DynamicConstraintError if the requested audioCodec, channelCount, sampleRate or bitDepth is not supported by microphoneCapabilities.
   */
  override audioStreamAllocate(request: CameraAvStreamManagement.AudioStreamAllocateRequest): CameraAvStreamManagement.AudioStreamAllocateResponse {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.2.8.1: Reject with CONSTRAINT_ERROR; the AudioStreamAllocate StreamUsage field is constrained to Recording, Analysis and LiveView, so Internal is out of range.
    if (request.streamUsage === StreamUsage.Internal) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: stream usage Internal is not allowed for AudioStreamAllocate (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.2.8.1.7: Fail AudioStreamAllocate with INVALID_IN_STATE if the requested StreamUsage is not found in StreamUsagePriorities.
    if (!this.state.streamUsagePriorities.includes(request.streamUsage)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: stream usage ${request.streamUsage} is not present in streamUsagePriorities (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidInState,
      );
    }
    // Matter 1.6.0 § 11.2.8.1: Reject with CONSTRAINT_ERROR; the AudioCodec field is constrained to the AudioCodecEnum values.
    if (!AUDIO_CODECS.includes(request.audioCodec)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: audioCodec ${request.audioCodec} is not a valid AudioCodecEnum value (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.2.8.1.6: Reject with CONSTRAINT_ERROR; BitDepth SHALL be one of 8, 16, 24 or 32 bits.
    if (!AUDIO_STREAM_BIT_DEPTHS.includes(request.bitDepth)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: bitDepth ${request.bitDepth} is not one of ${AUDIO_STREAM_BIT_DEPTHS.join(', ')} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    const { microphoneCapabilities } = this.state;
    if (
      !microphoneCapabilities.supportedCodecs.includes(request.audioCodec) ||
      request.channelCount < 1 ||
      request.channelCount > microphoneCapabilities.maxNumberOfChannels ||
      !microphoneCapabilities.supportedSampleRates.includes(request.sampleRate) ||
      !microphoneCapabilities.supportedBitDepths.includes(request.bitDepth)
    ) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: audioStreamAllocate requested audioCodec, channelCount, sampleRate or bitDepth is not supported by microphoneCapabilities (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }

    const existingStream = this.state.allocatedAudioStreams.find(
      (stream) =>
        stream.streamUsage === request.streamUsage &&
        stream.audioCodec === request.audioCodec &&
        stream.channelCount === request.channelCount &&
        stream.sampleRate === request.sampleRate &&
        stream.bitRate === request.bitRate &&
        stream.bitDepth === request.bitDepth,
    );
    // Matter 1.6.0 § 11.2.8.1.7: Return the existing AudioStreamID when an entry in AllocatedAudioStreams matches the request, with no other side effects.
    if (existingStream) {
      device.log.info(
        `MatterbridgeCameraAvStreamManagementServer: reused audio stream ${existingStream.audioStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      this.endpoint.emitCommand(CameraAvStreamManagement, 'audioStreamAllocate', request, this.context);
      return { audioStreamId: existingStream.audioStreamId };
    }

    let audioStreamId = 0;
    for (const stream of this.state.allocatedAudioStreams) {
      audioStreamId = Math.max(audioStreamId, stream.audioStreamId + 1);
    }
    // Matter 1.6.0 § 11.2.8.1.7: Allocate a new AudioStreamID and append its AudioStreamStruct to AllocatedAudioStreams.
    this.state.allocatedAudioStreams = [
      ...this.state.allocatedAudioStreams,
      {
        audioStreamId,
        streamUsage: request.streamUsage,
        audioCodec: request.audioCodec,
        channelCount: request.channelCount,
        sampleRate: request.sampleRate,
        bitRate: request.bitRate,
        bitDepth: request.bitDepth,
        referenceCount: 0,
      },
    ];
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: allocated audio stream ${audioStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvStreamManagement, 'audioStreamAllocate', request, this.context);
    return { audioStreamId };
  }

  /**
   * Handles the AudioStreamDeallocate command.
   * Deallocates the audio stream on the camera corresponding to the given audio stream identifier.
   *
   * @param {CameraAvStreamManagement.AudioStreamDeallocateRequest} request - AudioStreamDeallocate request payload.
   * @throws {StatusResponseError} With status NotFound if the requested audioStreamId is not present in allocatedAudioStreams.
   */
  override audioStreamDeallocate(request: CameraAvStreamManagement.AudioStreamDeallocateRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.2.8.3.2: Fail AudioStreamDeallocate with NOT_FOUND if AudioStreamID does not match an entry in AllocatedAudioStreams.
    if (!this.state.allocatedAudioStreams.some((stream) => stream.audioStreamId === request.audioStreamId)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: audio stream ${request.audioStreamId} is not present in allocatedAudioStreams (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    // Matter 1.6.0 § 11.2.8.3.2: Deallocate the stream and remove its AudioStreamID entry from AllocatedAudioStreams.
    this.state.allocatedAudioStreams = this.state.allocatedAudioStreams.filter((stream) => stream.audioStreamId !== request.audioStreamId);
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: deallocated audio stream ${request.audioStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvStreamManagement, 'audioStreamDeallocate', request, this.context);
  }

  /**
   * Handles the SnapshotStreamAllocate command (SNP).
   * Allocates a new snapshot stream from the parameters passed in the request and returns its generated identifier.
   *
   * @param {CameraAvStreamManagement.SnapshotStreamAllocateRequest} request - SnapshotStreamAllocate request payload.
   * @returns {Promise<CameraAvStreamManagement.SnapshotStreamAllocateResponse>} The newly allocated snapshot stream identifier.
   * @throws {StatusResponseError} With status DynamicConstraintError if no entry in snapshotCapabilities has a resolution within the requested minResolution/maxResolution range.
   */
  // oxlint-disable-next-line typescript/require-await
  override async snapshotStreamAllocate(request: CameraAvStreamManagement.SnapshotStreamAllocateRequest): Promise<CameraAvStreamManagement.SnapshotStreamAllocateResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { minResolution, maxResolution } = request;
    const matchesCapability = this.state.snapshotCapabilities.some(
      (capability) =>
        capability.resolution.width >= minResolution.width &&
        capability.resolution.width <= maxResolution.width &&
        capability.resolution.height >= minResolution.height &&
        capability.resolution.height <= maxResolution.height,
    );
    // Matter 1.6.0 § 11.2.8.8.8: Fail SnapshotStreamAllocate with DYNAMIC_CONSTRAINT_ERROR if an unsupported ImageCodec, MaxFrameRate, MinResolution, MaxResolution or Quality is requested.
    if (!matchesCapability) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: snapshotStreamAllocate requested minResolution/maxResolution range does not match any entry in snapshotCapabilities (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.DynamicConstraintError,
      );
    }
    // A request "matches" an existing stream (Matter 1.6 §11.2.8.8.8) when its non-resolution parameters are identical and its
    // requested resolution range overlaps the existing stream's range; the existing entry is narrowed to the new range on reuse.
    const existingStream = this.state.allocatedSnapshotStreams.find(
      (stream) =>
        stream.imageCodec === request.imageCodec &&
        stream.frameRate === request.maxFrameRate &&
        stream.quality === request.quality &&
        stream.watermarkEnabled === request.watermarkEnabled &&
        stream.osdEnabled === request.osdEnabled &&
        stream.minResolution.width <= request.maxResolution.width &&
        stream.maxResolution.width >= request.minResolution.width &&
        stream.minResolution.height <= request.maxResolution.height &&
        stream.maxResolution.height >= request.minResolution.height,
    );
    // Matter 1.6.0 § 11.2.8.8.8: Return the existing SnapshotStreamID when an entry in AllocatedSnapshotStreams matches the request, with no other side effects.
    if (existingStream) {
      this.state.allocatedSnapshotStreams = this.state.allocatedSnapshotStreams.map((stream) =>
        stream.snapshotStreamId === existingStream.snapshotStreamId
          ? {
              snapshotStreamId: stream.snapshotStreamId,
              imageCodec: stream.imageCodec,
              frameRate: stream.frameRate,
              minResolution: request.minResolution,
              maxResolution: request.maxResolution,
              quality: stream.quality,
              referenceCount: stream.referenceCount,
              encodedPixels: stream.encodedPixels,
              hardwareEncoder: stream.hardwareEncoder,
              watermarkEnabled: stream.watermarkEnabled,
              osdEnabled: stream.osdEnabled,
            }
          : stream,
      );
      device.log.info(
        `MatterbridgeCameraAvStreamManagementServer: reused snapshot stream ${existingStream.snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      this.endpoint.emitCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', request, this.context);
      return { snapshotStreamId: existingStream.snapshotStreamId };
    }
    let snapshotStreamId = 0;
    for (const stream of this.state.allocatedSnapshotStreams) {
      snapshotStreamId = Math.max(snapshotStreamId, stream.snapshotStreamId + 1);
    }
    // Matter 1.6.0 § 11.2.8.8.8: Allocate a new SnapshotStreamID and append its SnapshotStreamStruct to AllocatedSnapshotStreams.
    this.state.allocatedSnapshotStreams = [
      ...this.state.allocatedSnapshotStreams,
      {
        snapshotStreamId,
        imageCodec: request.imageCodec,
        frameRate: request.maxFrameRate,
        minResolution: request.minResolution,
        maxResolution: request.maxResolution,
        quality: request.quality,
        referenceCount: 0,
        encodedPixels: false,
        hardwareEncoder: false,
        watermarkEnabled: request.watermarkEnabled,
        osdEnabled: request.osdEnabled,
      },
    ];
    device.log.info(`MatterbridgeCameraAvStreamManagementServer: allocated snapshot stream ${snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.endpoint.emitCommand(CameraAvStreamManagement, 'snapshotStreamAllocate', request, this.context);
    return { snapshotStreamId };
  }

  /**
   * Handles the SnapshotStreamDeallocate command (SNP).
   * Removes the snapshot stream identified in the request from the allocated snapshot streams.
   *
   * @param {CameraAvStreamManagement.SnapshotStreamDeallocateRequest} request - SnapshotStreamDeallocate request payload.
   * @throws {StatusResponseError} With status NotFound if the requested snapshotStreamId is not present in allocatedSnapshotStreams.
   */
  // oxlint-disable-next-line typescript/require-await
  override async snapshotStreamDeallocate(request: CameraAvStreamManagement.SnapshotStreamDeallocateRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.2.8.10.2: Fail SnapshotStreamDeallocate with NOT_FOUND if SnapshotStreamID does not match an entry in AllocatedSnapshotStreams.
    if (!this.state.allocatedSnapshotStreams.some((stream) => stream.snapshotStreamId === request.snapshotStreamId)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: snapshot stream ${request.snapshotStreamId} is not present in allocatedSnapshotStreams (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    // Matter 1.6.0 § 11.2.8.10.2: Deallocate the stream and remove its SnapshotStreamID entry from AllocatedSnapshotStreams.
    this.state.allocatedSnapshotStreams = this.state.allocatedSnapshotStreams.filter((stream) => stream.snapshotStreamId !== request.snapshotStreamId);
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: deallocated snapshot stream ${request.snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvStreamManagement, 'snapshotStreamDeallocate', request, this.context);
  }

  /**
   * Handles the CaptureSnapshot command.
   * Returns a snapshot from the camera for the requested (or automatically selected) snapshot stream.
   * The image data is a static JPEG television calibration card, picked from {@link cameraColorTestJpegs} to match
   * the requested resolution, until a real capture pipeline is wired in.
   *
   * @param {CameraAvStreamManagement.CaptureSnapshotRequest} request - CaptureSnapshot request payload.
   * @returns {CameraAvStreamManagement.CaptureSnapshotResponse} The captured snapshot.
   * @throws {StatusResponseError} NotFound if snapshotStreamId does not match an entry in allocatedSnapshotStreams, or if snapshotStreamId is null (automatic selection) and no snapshot stream is allocated.
   */
  override captureSnapshot(request: CameraAvStreamManagement.CaptureSnapshotRequest): CameraAvStreamManagement.CaptureSnapshotResponse {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { snapshotStreamId } = request;
    const stream = this.state.allocatedSnapshotStreams.find((s) => snapshotStreamId === null || s.snapshotStreamId === snapshotStreamId);
    // Matter 1.6.0 § 11.2.8.13.3: Fail CaptureSnapshot with NOT_FOUND if AllocatedSnapshotStreams is empty, or if a non-null SnapshotStreamID does not match an entry in it.
    if (!stream) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvStreamManagementServer: snapshot stream ${snapshotStreamId ?? 'auto'} is not present in allocatedSnapshotStreams (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    device.log.info(
      `MatterbridgeCameraAvStreamManagementServer: capturing snapshot ${snapshotStreamId ?? 'auto'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // TODO: Replace the static calibration card with a real capture once CameraAvStreamManagement.captureSnapshot is wired into matterbridge
    /*
    await device.commandHandler.executeHandler('CameraAvStreamManagement.captureSnapshot', {
      command: 'captureSnapshot',
      request,
      cluster: CameraAvStreamManagementServer.id,
      attributes: this.state,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    */
    device.log.debug(
      `MatterbridgeCameraAvStreamManagementServer: captureSnapshot called with snapshotStreamId ${request.snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    const { data, resolution } = cameraColorTestJpegForResolution(request.requestedResolution);
    this.endpoint.emitCommand(CameraAvStreamManagement, 'captureSnapshot', request, this.context);
    return {
      data,
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      resolution,
    };
  }
}

/**
 * Initial state accepted by {@link createDefaultCameraAvStreamManagementClusterServer}.
 */
export interface CameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the camera */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the maximum number of concurrent encoders supported by the camera */
  maxConcurrentEncoders: number;
  /** Indicates the maximum data rate, in encoded pixels per second, that the camera can produce */
  maxEncodedPixelRate: number;
  /** Indicates the video sensor parameters for the camera */
  videoSensorParams: CameraAvStreamManagement.VideoSensorParams;
  /** Indicates the minimum resolution, in pixels, that the camera allows for its viewport */
  minViewportResolution: CameraAvStreamManagement.VideoResolution;
  /** Indicates the rate distortion trade-off points between resolution, frame rate and bitrate for each supported hardware encoder */
  rateDistortionTradeOffPoints: CameraAvStreamManagement.RateDistortionTradeOffPoints[];
  /** Indicates the current logical frame rate of the sensor in frames per second */
  currentFrameRate: number;
  /** Indicates the viewport to apply to all streams */
  viewport: Viewport;
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the list of supported snapshot capabilities */
  snapshotCapabilities: CameraAvStreamManagement.SnapshotCapabilities[];
}

/**
 * Creates a default CameraAvStreamManagement cluster server, with the Video, Audio, Snapshot and ImageControl features
 * enabled, on the given endpoint.
 *
 * The ImageControl feature is required here (even though it doesn't implement any real image-processing logic) so
 * that this endpoint's registered behavior matches {@link MatterbridgeCameraAvStreamManagementServer}'s own declared
 * feature set (Video, Audio, Snapshot, ImageControl): `webRtcTransportProviderServer.ts`'s automatic stream
 * assignment gates on `endpoint.behaviors.has(MatterbridgeCameraAvStreamManagementServer)`, which requires an exact
 * match against that base class, not just a compatible subset. Removing ImageControl here would make that check
 * fail and break WebRTC SolicitOffer/ProvideOffer automatic stream selection for this device.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {CameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultCameraAvStreamManagementClusterServer(endpoint: MatterbridgeEndpoint, options: CameraAvStreamManagementClusterOptions): MatterbridgeEndpoint {
  endpoint.behaviors.require(
    MatterbridgeCameraAvStreamManagementServer.with(
      CameraAvStreamManagement.Feature.Video,
      CameraAvStreamManagement.Feature.Audio,
      CameraAvStreamManagement.Feature.Snapshot,
      CameraAvStreamManagement.Feature.ImageControl,
    ),
    {
      ...options,
      hardPrivacyModeOn: false,
      statusLightEnabled: false,
      statusLightBrightness: ThreeLevelAuto.Auto,
      allocatedVideoStreams: [],
      allocatedAudioStreams: [],
      allocatedSnapshotStreams: [],
      microphoneMuted: false,
      microphoneVolumeLevel: 128,
      microphoneMaxLevel: 254,
      microphoneMinLevel: 0,
      microphoneAgcEnabled: false,
      imageRotation: 0,
      imageFlipVertical: false,
      imageFlipHorizontal: false,
    },
  );
  return endpoint;
}

/**
 * Initial state accepted by {@link createDefaultAudioCameraAvStreamManagementClusterServer}.
 */
export interface AudioCameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the device */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
}

/**
 * Creates a default CameraAvStreamManagement cluster server, specialized for the Audio feature only, on the given
 * endpoint. The Video, Snapshot and ImageControl features are not enabled, as required by the Matter specification
 * for the Audio Doorbell device type.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {AudioCameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultAudioCameraAvStreamManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: AudioCameraAvStreamManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Audio), {
    ...options,
    hardPrivacyModeOn: false,
    statusLightEnabled: false,
    allocatedAudioStreams: [],
    microphoneMuted: false,
    microphoneVolumeLevel: 128,
    microphoneMaxLevel: 254,
    microphoneMinLevel: 0,
    microphoneAgcEnabled: false,
  });
  return endpoint;
}

/**
 * Initial state accepted by {@link createDefaultIntercomCameraAvStreamManagementClusterServer}.
 */
export interface IntercomCameraAvStreamManagementClusterOptions {
  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth: number;
  /** Indicates the list of stream usages that are supported by the device */
  supportedStreamUsages: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the audio capabilities of the speaker in terms of the codec used, supported sample rates and the number of channels */
  speakerCapabilities: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the type of two-way talk support the device has */
  twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType;
}

/**
 * Creates a default CameraAvStreamManagement cluster server, specialized for the Audio and Speaker features, on the
 * given endpoint. The Video, Snapshot and ImageControl features are not enabled, as required by the Matter
 * specification for the Intercom device type. Unlike {@link createDefaultAudioCameraAvStreamManagementClusterServer}
 * (Audio only, one-way from the visitor to the resident), the Intercom needs the Speaker feature too so it can both
 * capture and play back audio for genuine two-way communication.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {IntercomCameraAvStreamManagementClusterOptions} options - The initial state of the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultIntercomCameraAvStreamManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: IntercomCameraAvStreamManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Audio, CameraAvStreamManagement.Feature.Speaker), {
    ...options,
    hardPrivacyModeOn: false,
    statusLightEnabled: false,
    allocatedAudioStreams: [],
    microphoneMuted: false,
    microphoneVolumeLevel: 128,
    microphoneMaxLevel: 254,
    microphoneMinLevel: 0,
    microphoneAgcEnabled: false,
    speakerMuted: false,
    speakerVolumeLevel: 128,
    speakerMaxLevel: 254,
    speakerMinLevel: 0,
  });
  return endpoint;
}

export interface SnapshotCameraAvStreamManagementClusterOptions {
  maxConcurrentEncoders: number;
  maxEncodedPixelRate: number;
  maxContentBufferSize: number;
  snapshotCapabilities: CameraAvStreamManagement.SnapshotCapabilities[];
  maxNetworkBandwidth: number;
  supportedStreamUsages: StreamUsage[];
  streamUsagePriorities: StreamUsage[];
}

/**
 *  Creates a default CameraAvStreamManagement cluster server, specialized for the Snapshot feature, on the given endpoint.
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvStreamManagement cluster server on.
 * @param {SnapshotCameraAvStreamManagementClusterOptions} options - The options for configuring the CameraAvStreamManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvStreamManagement cluster server created.
 */
export function createDefaultSnapshotCameraAvStreamManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: SnapshotCameraAvStreamManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(MatterbridgeCameraAvStreamManagementServer.with(CameraAvStreamManagement.Feature.Snapshot), {
    // mandatory attributes
    maxContentBufferSize: options.maxContentBufferSize, // M
    maxNetworkBandwidth: options.maxNetworkBandwidth, // M
    supportedStreamUsages: options.supportedStreamUsages, // M
    streamUsagePriorities: options.streamUsagePriorities, // M
    // CameraAvStreamManagement.Feature.Snapshot
    maxConcurrentEncoders: options.maxConcurrentEncoders, // VDO | SNP
    maxEncodedPixelRate: options.maxEncodedPixelRate, // VDO | SNP
    snapshotCapabilities: options.snapshotCapabilities, // SNP
    allocatedSnapshotStreams: [], // SNP, persisted by matter.js — never seeded from options
  });
  return endpoint;
}
