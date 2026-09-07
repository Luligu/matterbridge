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
import { Status, StatusResponseError, StreamUsage } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';

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
      (this.features.snapshot && this.state.allocatedSnapshotStreams.length > 0) ||
      (this.features.video && this.state.allocatedVideoStreams.length > 0) ||
      (this.features.audio && this.state.allocatedAudioStreams.length > 0)
    ) {
      throw new StatusResponseError('setStreamPriorities cannot be invoked while snapshot, video or audio streams are allocated', Status.InvalidInState);
    }
    if (!request.streamPriorities.every((usage) => this.state.supportedStreamUsages.includes(usage))) {
      throw new StatusResponseError('streamPriorities shall only contain entries found in supportedStreamUsages', Status.DynamicConstraintError);
    }
    if (new Set(request.streamPriorities).size !== request.streamPriorities.length) {
      throw new StatusResponseError('streamPriorities shall not contain duplicate values', Status.AlreadyExists);
    }
    device.log.info(`Setting stream priorities to [${request.streamPriorities.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.state.streamUsagePriorities = request.streamPriorities;
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
    if (request.streamUsage === StreamUsage.Internal) {
      throw new StatusResponseError('Stream usage Internal is not allowed for VideoStreamAllocate', Status.ConstraintError);
    }
    if (!this.state.streamUsagePriorities.includes(request.streamUsage)) {
      throw new StatusResponseError(`Stream usage ${request.streamUsage} is not present in streamUsagePriorities`, Status.InvalidInState);
    }
    if (!VIDEO_CODECS.includes(request.videoCodec)) {
      throw new StatusResponseError(`VideoCodec ${request.videoCodec} is not a valid VideoCodecEnum value`, Status.ConstraintError);
    }
    // MinFrameRate's and MinBitRate's spec constraints are "1 to MaxFrameRate"/"1 to MaxBitRate" (Matter 1.6 §11.2.8.4), cross-field bounds matter.js does not auto-enforce.
    if (request.minFrameRate > request.maxFrameRate) {
      throw new StatusResponseError(`MinFrameRate ${request.minFrameRate} must not be greater than MaxFrameRate ${request.maxFrameRate}`, Status.ConstraintError);
    }
    if (request.minBitRate > request.maxBitRate) {
      throw new StatusResponseError(`MinBitRate ${request.minBitRate} must not be greater than MaxBitRate ${request.maxBitRate}`, Status.ConstraintError);
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
    if (!matchesTradeOffPoint || request.maxFrameRate > this.state.videoSensorParams.maxFps) {
      throw new StatusResponseError(
        'VideoStreamAllocate requested parameters do not match any entry in rateDistortionTradeOffPoints or exceed videoSensorParams',
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
    if (existingStream) {
      device.log.info(`Reused video stream ${existingStream.videoStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return { videoStreamId: existingStream.videoStreamId };
    }
    if (this.state.allocatedVideoStreams.length >= this.state.maxConcurrentEncoders) {
      throw new StatusResponseError(`VideoStreamAllocate would exceed maxConcurrentEncoders (${this.state.maxConcurrentEncoders})`, Status.ResourceExhausted);
    }

    let videoStreamId = 0;
    for (const stream of this.state.allocatedVideoStreams) {
      videoStreamId = Math.max(videoStreamId, stream.videoStreamId + 1);
    }
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
    device.log.info(`Allocated video stream ${videoStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    if (!this.state.allocatedVideoStreams.some((stream) => stream.videoStreamId === request.videoStreamId)) {
      throw new StatusResponseError(`Video stream ${request.videoStreamId} is not present in allocatedVideoStreams`, Status.NotFound);
    }
    this.state.allocatedVideoStreams = this.state.allocatedVideoStreams.filter((stream) => stream.videoStreamId !== request.videoStreamId);
    device.log.info(`Deallocated video stream ${request.videoStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    if (request.streamUsage === StreamUsage.Internal) {
      throw new StatusResponseError('Stream usage Internal is not allowed for AudioStreamAllocate', Status.ConstraintError);
    }
    if (!this.state.streamUsagePriorities.includes(request.streamUsage)) {
      throw new StatusResponseError(`Stream usage ${request.streamUsage} is not present in streamUsagePriorities`, Status.InvalidInState);
    }
    if (!AUDIO_CODECS.includes(request.audioCodec)) {
      throw new StatusResponseError(`AudioCodec ${request.audioCodec} is not a valid AudioCodecEnum value`, Status.ConstraintError);
    }
    if (!AUDIO_STREAM_BIT_DEPTHS.includes(request.bitDepth)) {
      throw new StatusResponseError(`BitDepth ${request.bitDepth} is not one of ${AUDIO_STREAM_BIT_DEPTHS.join(', ')}`, Status.ConstraintError);
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
        'AudioStreamAllocate requested audioCodec, channelCount, sampleRate or bitDepth is not supported by microphoneCapabilities',
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
    if (existingStream) {
      device.log.info(`Reused audio stream ${existingStream.audioStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return { audioStreamId: existingStream.audioStreamId };
    }

    let audioStreamId = 0;
    for (const stream of this.state.allocatedAudioStreams) {
      audioStreamId = Math.max(audioStreamId, stream.audioStreamId + 1);
    }
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
    device.log.info(`Allocated audio stream ${audioStreamId} for usage ${request.streamUsage} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    if (!this.state.allocatedAudioStreams.some((stream) => stream.audioStreamId === request.audioStreamId)) {
      throw new StatusResponseError(`Audio stream ${request.audioStreamId} is not present in allocatedAudioStreams`, Status.NotFound);
    }
    this.state.allocatedAudioStreams = this.state.allocatedAudioStreams.filter((stream) => stream.audioStreamId !== request.audioStreamId);
    device.log.info(`Deallocated audio stream ${request.audioStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    if (!matchesCapability) {
      throw new StatusResponseError(
        'SnapshotStreamAllocate requested minResolution/maxResolution range does not match any entry in snapshotCapabilities',
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
      device.log.info(`Reused snapshot stream ${existingStream.snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      return { snapshotStreamId: existingStream.snapshotStreamId };
    }
    let snapshotStreamId = 0;
    for (const stream of this.state.allocatedSnapshotStreams) {
      snapshotStreamId = Math.max(snapshotStreamId, stream.snapshotStreamId + 1);
    }
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
    device.log.info(`Allocated snapshot stream ${snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    if (!this.state.allocatedSnapshotStreams.some((stream) => stream.snapshotStreamId === request.snapshotStreamId)) {
      throw new StatusResponseError(`Snapshot stream ${request.snapshotStreamId} is not present in allocatedSnapshotStreams`, Status.NotFound);
    }
    this.state.allocatedSnapshotStreams = this.state.allocatedSnapshotStreams.filter((stream) => stream.snapshotStreamId !== request.snapshotStreamId);
    device.log.info(`Deallocated snapshot stream ${request.snapshotStreamId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    if (!stream) {
      throw new StatusResponseError(`Snapshot stream ${snapshotStreamId ?? 'auto'} is not present in allocatedSnapshotStreams`, Status.NotFound);
    }
    device.log.info(`Capturing snapshot ${snapshotStreamId ?? 'auto'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
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
    device.log.debug(`MatterbridgeCameraAvStreamManagementServer: captureSnapshot called with snapshotStreamId ${request.snapshotStreamId}`);
    const { data, resolution } = cameraColorTestJpegForResolution(request.requestedResolution);
    return {
      data,
      imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg,
      resolution,
    };
  }
}
