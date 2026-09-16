/**
 * @file src/behaviors/cameraAvSettingsUserLevelManagementServer.ts
 * @description This file contains the MatterbridgeCameraAvSettingsUserLevelManagementServer class of Matterbridge.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-23
 * @version 1.0.0
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

/* oxlint-disable typescript/no-namespace */

import { CameraAvSettingsUserLevelManagementServer } from '@matter/node/behaviors/camera-av-settings-user-level-management';
import { Status, StatusResponseError, type Viewport } from '@matter/types';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import type { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeCameraAvStreamManagementServer } from './cameraAvStreamManagementServer.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * Clamps a value between a minimum and a maximum.
 *
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum allowed value.
 * @param {number} max - The maximum allowed value.
 * @returns {number} The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Returns the width of a viewport bounding rectangle.
 *
 * @param {Viewport} viewport - The viewport bounding rectangle.
 * @returns {number} The width, in sensor pixels.
 */
function viewportWidth(viewport: Viewport): number {
  return viewport.x2 - viewport.x1;
}

/**
 * Returns the height of a viewport bounding rectangle.
 *
 * @param {Viewport} viewport - The viewport bounding rectangle.
 * @returns {number} The height, in sensor pixels.
 */
function viewportHeight(viewport: Viewport): number {
  return viewport.y2 - viewport.y1;
}

/**
 * Compares two aspect ratios by cross-multiplication, so that no floating point rounding can make two ratios that are
 * equal as rationals compare as different.
 *
 * @param {number} width - The width of the first rectangle.
 * @param {number} height - The height of the first rectangle.
 * @param {number} referenceWidth - The width of the rectangle to compare against.
 * @param {number} referenceHeight - The height of the rectangle to compare against.
 * @returns {boolean} True when both rectangles have the same aspect ratio.
 */
function sameAspectRatio(width: number, height: number, referenceWidth: number, referenceHeight: number): boolean {
  return width * referenceHeight === referenceWidth * height;
}

/**
 * Builds a viewport of the given size anchored at the given upper left corner, shifting the corner back inside the
 * sensor Cartesian plane when the rectangle would otherwise fall partly outside it.
 * Matter 1.6.0 § 11.3.7.7.5: "If any portion of requested viewport falls outside the sensor Cartesian plane: Change
 * the upper left of the requested viewport to the nearest point allowing the viewport to be within the sensor
 * Cartesian plane."
 *
 * @param {number} x1 - The requested upper left corner position on the horizontal axis.
 * @param {number} y1 - The requested upper left corner position on the vertical axis.
 * @param {number} width - The width of the viewport, already clipped to the sensor width.
 * @param {number} height - The height of the viewport, already clipped to the sensor height.
 * @param {number} sensorWidth - The width of the sensor Cartesian plane.
 * @param {number} sensorHeight - The height of the sensor Cartesian plane.
 * @returns {Viewport} The viewport bounding rectangle, wholly inside the sensor Cartesian plane.
 */
function viewportAt(x1: number, y1: number, width: number, height: number, sensorWidth: number, sensorHeight: number): Viewport {
  const left = clamp(x1, 0, sensorWidth - width);
  const top = clamp(y1, 0, sensorHeight - height);
  return { x1: left, y1: top, x2: left + width, y2: top + height };
}

/**
 * CameraAvSettingsUserLevelManagement server, specialized for the MechanicalPan, MechanicalTilt, MechanicalZoom,
 * MechanicalPresets and DigitalPTZ features, that implements the mechanical pan/tilt/zoom absolute-position,
 * relative-move and saved-preset commands, and the per-stream digital viewport commands, required by a PTZ Camera
 * device.
 *
 * Matter 1.6.0 § 11.3.7.1.4, § 11.3.7.2.4 and § 11.3.7.3.2 model a physical camera: each move command sets
 * MovementState to Moving, responds, and only sets it back to Idle and updates MPTZPosition once the physical
 * movement completes, rejecting a move that arrives while another is in flight with BUSY. A bridged camera has no
 * mechanics to wait for, so every move here completes synchronously within the command: MPTZPosition is updated
 * before the response, MovementState is never observably anything but Idle, and BUSY can therefore never arise.
 */
export class MatterbridgeCameraAvSettingsUserLevelManagementServer extends CameraAvSettingsUserLevelManagementServer.with(
  CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
  CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
  CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
  CameraAvSettingsUserLevelManagement.Feature.MechanicalPresets,
  CameraAvSettingsUserLevelManagement.Feature.DigitalPtz,
) {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /** Internal state of this behavior. Holds the monotonic preset id counter used by mptzSavePreset. */
  declare protected internal: MatterbridgeCameraAvSettingsUserLevelManagementServer.Internal;

  /**
   * Initializes the server and keeps DPTZStreams in step with the CameraAvStreamManagement cluster of this endpoint.
   * Matter 1.6.0 § 11.3.6.4: a video stream listed in DPTZStreams is one that supports digital movement, and each
   * entry's Viewport starts from the global Viewport. Matter 1.6.0 § 11.2.7.25: when the global Viewport changes, all
   * Viewport values in DPTZStreams SHALL be updated to the new value.
   *
   * The two reactors watch AllocatedVideoStreams and Viewport rather than hooking VideoStreamAllocate and
   * VideoStreamDeallocate, so that every writer of those attributes is covered, including
   * MatterbridgeWebRtcTransportProviderServer, which allocates a video stream of its own when a WebRTC session
   * provides one.
   */
  override initialize(): void {
    const streamManagement = this.agent.get(MatterbridgeCameraAvStreamManagementServer);
    // Seed the entries for streams already allocated before this behavior came up: MatterbridgeCameraAvStreamManagementServer
    // self-allocates a default video stream in its own initialize(), which runs without ever notifying the reactors below.
    this.syncDptzStreams(streamManagement.state.allocatedVideoStreams);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(streamManagement.events.allocatedVideoStreams$Changed, this.syncDptzStreams);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(streamManagement.events.viewport$Changed, this.syncDptzViewport);
  }

  /**
   * Adds a DPTZStreams entry for every newly allocated video stream and drops the entries of the streams that are no
   * longer allocated, leaving the viewport of the entries that survive untouched.
   *
   * @param {CameraAvStreamManagement.VideoStream[]} allocatedVideoStreams - The current AllocatedVideoStreams attribute.
   */
  protected syncDptzStreams(allocatedVideoStreams: CameraAvStreamManagement.VideoStream[]): void {
    const allocatedIds = allocatedVideoStreams.map((stream) => stream.videoStreamId);
    const currentIds = this.state.dptzStreams.map((entry) => entry.videoStreamId);
    if (allocatedIds.length === currentIds.length && allocatedIds.every((id, index) => id === currentIds[index])) return;
    // Matter 1.6.0 § 11.3.6.4: The initial values for each Viewport entry SHALL be the values found in the global Viewport.
    const viewport = this.agent.get(MatterbridgeCameraAvStreamManagementServer).state.viewport;
    this.state.dptzStreams = allocatedIds.map((videoStreamId) => this.state.dptzStreams.find((entry) => entry.videoStreamId === videoStreamId) ?? { videoStreamId, viewport });
  }

  /**
   * Applies a change of the global Viewport to every DPTZStreams entry.
   * Matter 1.6.0 § 11.2.7.25: when the Viewport attribute is changed, all Viewport values found in DPTZStreams SHALL
   * be updated to the new values set there.
   *
   * @param {Viewport} viewport - The new value of the global Viewport attribute.
   */
  protected syncDptzViewport(viewport: Viewport): void {
    if (this.state.dptzStreams.length === 0) return;
    this.state.dptzStreams = this.state.dptzStreams.map((entry) => ({ videoStreamId: entry.videoStreamId, viewport }));
  }

  /**
   * Handles the MPTZSetPosition command.
   * Moves the camera to the provided absolute values for pan, tilt and zoom. Fields omitted from the request leave
   * the corresponding value unchanged.
   *
   * @param {CameraAvSettingsUserLevelManagement.MptzSetPositionRequest} request - MPTZSetPosition request payload.
   * @throws {StatusResponseError} With status InvalidCommand if pan, tilt and zoom are all omitted.
   * @throws {StatusResponseError} With status ConstraintError if pan, tilt or zoom is outside of the supported range.
   */
  override mptzSetPosition(request: CameraAvSettingsUserLevelManagement.MptzSetPositionRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { pan, tilt, zoom } = request;
    // Matter 1.6.0 § 11.3.7.1: Reject with INVALID_COMMAND; the Pan, Tilt and Zoom fields carry a choice conformance, so at least one of them SHALL be present.
    if (pan === undefined && tilt === undefined && zoom === undefined) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: mptzSetPosition requires at least one of pan, tilt or zoom to be present (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidCommand,
      );
    }
    // Matter 1.6.0 § 11.3.7.1: Reject with CONSTRAINT_ERROR; the Pan field is constrained to "PanMin to PanMax".
    if (pan !== undefined && (pan < this.state.panMin || pan > this.state.panMax)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: pan ${pan} is outside of the supported range [${this.state.panMin}, ${this.state.panMax}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.1: Reject with CONSTRAINT_ERROR; the Tilt field is constrained to "TiltMin to TiltMax".
    if (tilt !== undefined && (tilt < this.state.tiltMin || tilt > this.state.tiltMax)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: tilt ${tilt} is outside of the supported range [${this.state.tiltMin}, ${this.state.tiltMax}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.1: Reject with CONSTRAINT_ERROR; the Zoom field is constrained to "1 to ZoomMax".
    if (zoom !== undefined && (zoom < 1 || zoom > this.state.zoomMax)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: zoom ${zoom} is outside of the supported range [1, ${this.state.zoomMax}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.1.4: Update MPTZPosition with the received values; any field not present in the command SHALL NOT be modified.
    this.state.mptzPosition = {
      pan: pan ?? this.state.mptzPosition.pan,
      tilt: tilt ?? this.state.mptzPosition.tilt,
      zoom: zoom ?? this.state.mptzPosition.zoom,
    };
    device.log.info(
      `MatterbridgeCameraAvSettingsUserLevelManagementServer: set mechanical PTZ position to pan ${this.state.mptzPosition.pan}°, tilt ${this.state.mptzPosition.tilt}°, zoom ${this.state.mptzPosition.zoom} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'mptzSetPosition', request, this.context);
  }

  /**
   * Handles the MPTZRelativeMove command.
   * Moves the camera by the delta values relative to the currently defined position. Pan, tilt and zoom deltas are
   * all added directly to the corresponding current value. The resulting values are clamped to the supported pan,
   * tilt and zoom ranges.
   *
   * @param {CameraAvSettingsUserLevelManagement.MptzRelativeMoveRequest} request - MPTZRelativeMove request payload.
   * @throws {StatusResponseError} With status InvalidCommand if panDelta, tiltDelta and zoomDelta are all omitted.
   */
  override mptzRelativeMove(request: CameraAvSettingsUserLevelManagement.MptzRelativeMoveRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    // Matter 1.6.0 § 11.3.7.2: Reject with INVALID_COMMAND; the PanDelta, TiltDelta and ZoomDelta fields carry a choice conformance, so at least one of them SHALL be present.
    if (request.panDelta === undefined && request.tiltDelta === undefined && request.zoomDelta === undefined) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: mptzRelativeMove requires at least one of panDelta, tiltDelta or zoomDelta to be present (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.InvalidCommand,
      );
    }
    const current = this.state.mptzPosition;
    // Matter 1.6.0 § 11.3.7.2.4: Add PanDelta to the Pan value in MPTZPosition and clip the result to PanMin..PanMax inclusive.
    /* v8 ignore next -- pan/tilt/zoom are conformance-mandatory once MechanicalPan/MechanicalTilt/MechanicalZoom are
     * enabled, which this class's fixed feature set always does (see the class declaration), so mptzPosition always
     * has all three fields defined and the `?? 0`/`?? 1` fallbacks can never trigger through the public API. */
    const pan = request.panDelta === undefined ? current.pan : clamp((current.pan ?? 0) + request.panDelta, this.state.panMin, this.state.panMax);
    // Matter 1.6.0 § 11.3.7.2.4: Add TiltDelta to the Tilt value in MPTZPosition and clip the result to TiltMin..TiltMax inclusive.
    // v8 ignore next -- same as above, for tilt.
    const tilt = request.tiltDelta === undefined ? current.tilt : clamp((current.tilt ?? 0) + request.tiltDelta, this.state.tiltMin, this.state.tiltMax);
    // Matter 1.6.0 § 11.3.7.2.4: Add ZoomDelta to the Zoom value in MPTZPosition and clip the result to 1..ZoomMax inclusive.
    // v8 ignore next -- same as above, for zoom.
    const zoom = request.zoomDelta === undefined ? current.zoom : clamp((current.zoom ?? 1) + request.zoomDelta, 1, this.state.zoomMax);
    // Matter 1.6.0 § 11.3.7.2.4: Update MPTZPosition with the clipped pan, tilt and zoom values once the movement completes.
    this.state.mptzPosition = { pan, tilt, zoom };
    device.log.info(
      `MatterbridgeCameraAvSettingsUserLevelManagementServer: moved mechanical PTZ position by pan ${request.panDelta ?? 0}°, tilt ${request.tiltDelta ?? 0}°, zoom ${request.zoomDelta ?? 0} to pan ${pan}°, tilt ${tilt}°, zoom ${zoom} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'mptzRelativeMove', request, this.context);
  }

  /**
   * Handles the MPTZMoveToPreset command.
   * Moves the camera to the pan, tilt and zoom values stored in the preset identified by the given preset id.
   *
   * @param {CameraAvSettingsUserLevelManagement.MptzMoveToPresetRequest} request - MPTZMoveToPreset request payload.
   * @throws {StatusResponseError} With status ConstraintError if presetId is outside of the range 1 to MaxPresets.
   * @throws {StatusResponseError} With status NotFound if presetId does not match an entry in MPTZPresets.
   */
  override mptzMoveToPreset(request: CameraAvSettingsUserLevelManagement.MptzMoveToPresetRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { presetId } = request;
    // Matter 1.6.0 § 11.3.7.3: Reject with CONSTRAINT_ERROR; the PresetID field is constrained to "1 to MaxPresets".
    if (presetId < 1 || presetId > this.state.maxPresets) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: presetId ${presetId} is outside of the supported range [1, ${this.state.maxPresets}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.3.2: Reject with NOT_FOUND; the provided PresetID SHALL match an entry in MPTZPresets.
    const preset = this.state.mptzPresets.find((entry) => entry.presetId === presetId);
    if (preset === undefined) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: presetId ${presetId} is not present in mptzPresets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    // Matter 1.6.0 § 11.3.7.3.2: Initiate movement to the Pan, Tilt and Zoom values found in the identified entry, then update MPTZPosition once the movement completes.
    this.state.mptzPosition = preset.settings;
    device.log.info(
      `MatterbridgeCameraAvSettingsUserLevelManagementServer: moved mechanical PTZ position to preset ${presetId} "${preset.name}": pan ${preset.settings.pan}°, tilt ${preset.settings.tilt}°, zoom ${preset.settings.zoom} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'mptzMoveToPreset', request, this.context);
  }

  /**
   * Handles the MPTZSavePreset command.
   * Saves the current mechanical pan, tilt and zoom position as a preset, either creating a new entry or updating an
   * existing one. When presetId is omitted a new id is generated.
   *
   * @param {CameraAvSettingsUserLevelManagement.MptzSavePresetRequest} request - MPTZSavePreset request payload.
   * @throws {StatusResponseError} With status ConstraintError if presetId is outside of the range 1 to MaxPresets, or name is longer than 32 characters.
   * @throws {StatusResponseError} With status ResourceExhausted if a new entry is required and MPTZPresets already holds MaxPresets entries.
   */
  override mptzSavePreset(request: CameraAvSettingsUserLevelManagement.MptzSavePresetRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { presetId, name } = request;
    // Matter 1.6.0 § 11.3.7.4: Reject with CONSTRAINT_ERROR; the Name field is constrained to "max 32".
    if (name.length > 32) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: name "${name}" exceeds the maximum length of 32 characters (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.4: Reject with CONSTRAINT_ERROR; the PresetID field is constrained to "1 to MaxPresets".
    if (presetId !== undefined && (presetId < 1 || presetId > this.state.maxPresets)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: presetId ${presetId} is outside of the supported range [1, ${this.state.maxPresets}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.4.2: When the PresetID field is present and matches an existing entry, update that entry with the provided Name and the current values of MPTZPosition.
    if (presetId !== undefined && this.state.mptzPresets.some((entry) => entry.presetId === presetId)) {
      this.state.mptzPresets = this.state.mptzPresets.map((entry) => (entry.presetId === presetId ? { presetId, name, settings: this.state.mptzPosition } : entry));
      device.log.info(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: updated preset ${presetId} "${name}" with the current mechanical PTZ position (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', request, this.context);
      return;
    }
    // Matter 1.6.0 § 11.3.7.4.2: Reject with RESOURCE_EXHAUSTED; a new entry is required but the size of MPTZPresets is greater than or equal to MaxPresets.
    if (this.state.mptzPresets.length >= this.state.maxPresets) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: mptzPresets already holds the maximum of ${this.state.maxPresets} presets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ResourceExhausted,
      );
    }
    // Matter 1.6.0 § 11.3.7.4.2: Create a new entry using the provided PresetID, or a generated one when the field is absent, the provided Name and the current values of MPTZPosition.
    const newPresetId = presetId ?? this.generatePresetId();
    this.state.mptzPresets = [...this.state.mptzPresets, { presetId: newPresetId, name, settings: this.state.mptzPosition }];
    device.log.info(
      `MatterbridgeCameraAvSettingsUserLevelManagementServer: saved preset ${newPresetId} "${name}" with the current mechanical PTZ position (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'mptzSavePreset', request, this.context);
  }

  /**
   * Handles the MPTZRemovePreset command.
   * Removes the preset identified by the given preset id from MPTZPresets.
   *
   * @param {CameraAvSettingsUserLevelManagement.MptzRemovePresetRequest} request - MPTZRemovePreset request payload.
   * @throws {StatusResponseError} With status ConstraintError if presetId is outside of the range 1 to MaxPresets.
   * @throws {StatusResponseError} With status NotFound if presetId does not exist in MPTZPresets.
   */
  override mptzRemovePreset(request: CameraAvSettingsUserLevelManagement.MptzRemovePresetRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { presetId } = request;
    // Matter 1.6.0 § 11.3.7.5: Reject with CONSTRAINT_ERROR; the PresetID field is constrained to "1 to MaxPresets".
    if (presetId < 1 || presetId > this.state.maxPresets) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: presetId ${presetId} is outside of the supported range [1, ${this.state.maxPresets}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.5.2: Reject with NOT_FOUND; the provided PresetID SHALL exist in MPTZPresets.
    if (!this.state.mptzPresets.some((entry) => entry.presetId === presetId)) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: presetId ${presetId} is not present in mptzPresets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    // Matter 1.6.0 § 11.3.7.5.2: Remove the entry for the provided PresetID from MPTZPresets.
    this.state.mptzPresets = this.state.mptzPresets.filter((entry) => entry.presetId !== presetId);
    device.log.info(`MatterbridgeCameraAvSettingsUserLevelManagementServer: removed preset ${presetId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'mptzRemovePreset', request, this.context);
  }

  /**
   * Generates the preset id used when MPTZSavePreset is invoked without a PresetID field.
   * Matter 1.6.0 § 11.3.7.4.2: the value starts at 1 and monotonically increases by 1 with each new saved preset,
   * wrapping to 1 once it is incremented past MaxPresets, and is incremented further whenever it collides with an
   * id already present in MPTZPresets. Only called once the caller has established that MPTZPresets holds fewer
   * than MaxPresets entries, so a free id always exists and the collision loop always terminates.
   *
   * @returns {number} The generated preset id.
   */
  private generatePresetId(): number {
    let presetId = (this.internal.lastGeneratedPresetId % this.state.maxPresets) + 1;
    while (this.state.mptzPresets.some((entry) => entry.presetId === presetId)) {
      presetId = (presetId % this.state.maxPresets) + 1;
    }
    this.internal.lastGeneratedPresetId = presetId;
    return presetId;
  }

  /**
   * Returns the DPTZStreams entry for the given video stream id.
   * Matter 1.6.0 § 11.3.7.6.3 and § 11.3.7.7.5: both digital commands SHALL fail with NOT_FOUND when a VideoStreamID
   * entry does not exist in DPTZStreams.
   *
   * @param {number} videoStreamId - The video stream id carried by the command.
   * @returns {CameraAvSettingsUserLevelManagement.Dptz} The matching DPTZStreams entry.
   * @throws {StatusResponseError} With status NotFound if no entry exists for the given video stream id.
   */
  private dptzStreamEntry(videoStreamId: number): CameraAvSettingsUserLevelManagement.Dptz {
    const entry = this.state.dptzStreams.find((stream) => stream.videoStreamId === videoStreamId);
    if (entry === undefined) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: video stream ${videoStreamId} is not present in dptzStreams (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.NotFound,
      );
    }
    return entry;
  }

  /**
   * Stores the given viewport on the DPTZStreams entry of the given video stream id.
   *
   * @param {number} videoStreamId - The video stream id whose entry is updated.
   * @param {Viewport} viewport - The viewport to apply to that stream.
   */
  private applyDptzViewport(videoStreamId: number, viewport: Viewport): void {
    this.state.dptzStreams = this.state.dptzStreams.map((entry) => (entry.videoStreamId === videoStreamId ? { videoStreamId, viewport } : entry));
  }

  /**
   * Handles the DPTZSetViewport command.
   * Sets the digital viewport of a single allocated video stream.
   *
   * @param {CameraAvSettingsUserLevelManagement.DptzSetViewportRequest} request - DPTZSetViewport request payload.
   * @throws {StatusResponseError} With status NotFound if videoStreamId is not present in DPTZStreams.
   * @throws {StatusResponseError} With status ConstraintError if the viewport is smaller than MinViewportResolution, larger than the sensor, or does not match the aspect ratio of the stream.
   */
  override dptzSetViewport(request: CameraAvSettingsUserLevelManagement.DptzSetViewportRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { videoStreamId, viewport } = request;
    const entry = this.dptzStreamEntry(videoStreamId);
    const { videoSensorParams, minViewportResolution } = this.agent.get(MatterbridgeCameraAvStreamManagementServer).state;
    const width = viewportWidth(viewport);
    const height = viewportHeight(viewport);
    // Matter 1.6.0 § 11.3.7.6.3: Reject with an error when the requested viewport is outside of the defined allowed range, the lower bound of which is MinViewportResolution.
    if (width < minViewportResolution.width || height < minViewportResolution.height) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: viewport ${width}x${height} is smaller than the minimum viewport resolution ${minViewportResolution.width}x${minViewportResolution.height} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.6.3: The upper bound of the allowed range is the sensor Cartesian plane, of size SensorWidth by SensorHeight.
    if (
      viewport.x2 > videoSensorParams.sensorWidth ||
      viewport.y2 > videoSensorParams.sensorHeight ||
      width > videoSensorParams.sensorWidth ||
      height > videoSensorParams.sensorHeight
    ) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: viewport ${width}x${height} at (${viewport.x1}, ${viewport.y1}) does not fit the sensor ${videoSensorParams.sensorWidth}x${videoSensorParams.sensorHeight} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.6.2: The aspect ratio of the viewport SHALL match the aspect ratio of the stream requested.
    if (!sameAspectRatio(width, height, viewportWidth(entry.viewport), viewportHeight(entry.viewport))) {
      throw new StatusResponseError(
        `MatterbridgeCameraAvSettingsUserLevelManagementServer: viewport ${width}x${height} does not match the aspect ratio of video stream ${videoStreamId} (${viewportWidth(entry.viewport)}x${viewportHeight(entry.viewport)}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
        Status.ConstraintError,
      );
    }
    // Matter 1.6.0 § 11.3.7.6.3: Update the entry in DPTZStreams with the requested Viewport and apply it to the requested video stream.
    this.applyDptzViewport(videoStreamId, viewport);
    device.log.info(
      `MatterbridgeCameraAvSettingsUserLevelManagementServer: set the viewport of video stream ${videoStreamId} to (${viewport.x1}, ${viewport.y1})-(${viewport.x2}, ${viewport.y2}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'dptzSetViewport', request, this.context);
  }

  /**
   * Handles the DPTZRelativeMove command.
   * Pans, tilts and zooms the digital viewport of a single allocated video stream by the given deltas. The result is
   * clipped to the aspect ratio of the stream, to MinViewportResolution, to the sensor size and to the sensor
   * Cartesian plane, in that order, so the command never fails on an out-of-range result.
   *
   * @param {CameraAvSettingsUserLevelManagement.DptzRelativeMoveRequest} request - DPTZRelativeMove request payload.
   * @throws {StatusResponseError} With status NotFound if videoStreamId is not present in DPTZStreams.
   */
  override dptzRelativeMove(request: CameraAvSettingsUserLevelManagement.DptzRelativeMoveRequest): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const { videoStreamId, deltaX, deltaY, zoomDelta } = request;
    const entry = this.dptzStreamEntry(videoStreamId);
    const { videoSensorParams, minViewportResolution } = this.agent.get(MatterbridgeCameraAvStreamManagementServer).state;
    const { sensorWidth, sensorHeight } = videoSensorParams;
    const current = entry.viewport;
    // Matter 1.6.0 § 11.3.7.7.5: Add DeltaX to the X1 and X2 fields, and DeltaY to the Y1 and Y2 fields, of the viewport bounding rectangle.
    let x1 = current.x1 + (deltaX ?? 0);
    let y1 = current.y1 + (deltaY ?? 0);
    let width = viewportWidth(current);
    let height = viewportHeight(current);
    // Matter 1.6.0 § 11.3.7.7.5: Scale the viewport bounding rectangle by the percentage value, anchoring the re-scaled rectangle at the center point of the existing viewport. A positive value makes the viewport smaller, a negative one larger.
    if (zoomDelta !== undefined && zoomDelta !== 0) {
      const scaledWidth = Math.round((width * (100 - zoomDelta)) / 100);
      const scaledHeight = Math.round((height * (100 - zoomDelta)) / 100);
      x1 += Math.round((width - scaledWidth) / 2);
      y1 += Math.round((height - scaledHeight) / 2);
      width = scaledWidth;
      height = scaledHeight;
    }
    // Matter 1.6.0 § 11.3.7.7.5: If the aspect ratio following application of the delta values does not match the aspect ratio of the video stream, clip the viewport to the aspect ratio of the video stream while maintaining the upper left location.
    const streamWidth = viewportWidth(current);
    const streamHeight = viewportHeight(current);
    if (!sameAspectRatio(width, height, streamWidth, streamHeight)) {
      const clippedHeight = Math.round((width * streamHeight) / streamWidth);
      if (clippedHeight <= height) height = clippedHeight;
      else width = Math.round((height * streamWidth) / streamHeight);
    }
    // Matter 1.6.0 § 11.3.7.7.5: If the resultant requested viewport is smaller than the MinViewportResolution, use the size in MinViewportResolution while preserving the upper left location if possible.
    width = Math.max(width, minViewportResolution.width);
    height = Math.max(height, minViewportResolution.height);
    // Matter 1.6.0 § 11.3.7.7.5: If the requested viewport is larger than SensorWidth or SensorHeight in the VideoSensorParams, use the sensor size values.
    width = Math.min(width, sensorWidth);
    height = Math.min(height, sensorHeight);
    // Matter 1.6.0 § 11.3.7.7.5: If any portion of the requested viewport falls outside the sensor Cartesian plane, change the upper left of the requested viewport to the nearest point allowing the viewport to be within the sensor Cartesian plane.
    const viewport = viewportAt(x1, y1, width, height, sensorWidth, sensorHeight);
    // Matter 1.6.0 § 11.3.7.7.5: Apply the new viewport values to the video stream and update the entry in DPTZStreams.
    this.applyDptzViewport(videoStreamId, viewport);
    device.log.info(
      `MatterbridgeCameraAvSettingsUserLevelManagementServer: moved the viewport of video stream ${videoStreamId} by deltaX ${deltaX ?? 0}, deltaY ${deltaY ?? 0}, zoomDelta ${zoomDelta ?? 0} to (${viewport.x1}, ${viewport.y1})-(${viewport.x2}, ${viewport.y2}) (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(CameraAvSettingsUserLevelManagement, 'dptzRelativeMove', request, this.context);
  }
}

/* v8 ignore start */
export namespace MatterbridgeCameraAvSettingsUserLevelManagementServer {
  /**
   * Internal state for MatterbridgeCameraAvSettingsUserLevelManagementServer.
   */
  export class Internal {
    /**
     * The preset id most recently generated by mptzSavePreset, used to keep generated ids monotonic.
     */
    lastGeneratedPresetId = 0;
  }
}
/* v8 ignore stop */

/**
 * Initial state accepted by {@link createDefaultCameraAvSettingsUserLevelManagementClusterServer}.
 */
export interface CameraAvSettingsUserLevelManagementClusterOptions {
  /** Indicates the minimum value for the mechanical pan, in angular degrees */
  panMin: number;
  /** Indicates the maximum value for the mechanical pan, in angular degrees */
  panMax: number;
  /** Indicates the minimum value for the mechanical tilt, in angular degrees */
  tiltMin: number;
  /** Indicates the maximum value for the mechanical tilt, in angular degrees */
  tiltMax: number;
  /** Indicates the maximum value for the mechanical zoom */
  zoomMax: number;
  /** Indicates the initial mechanical pan, tilt and zoom position */
  mptzPosition: CameraAvSettingsUserLevelManagement.Mptz;
  /** Indicates the maximum number of presets for the mechanical pan, tilt and zoom */
  maxPresets: number;
}

/**
 * Creates a default CameraAvSettingsUserLevelManagement cluster server, with the MechanicalPan, MechanicalTilt,
 * MechanicalZoom, MechanicalPresets and DigitalPTZ features enabled, on the given endpoint.
 * Requires the CameraAvStreamManagement cluster server on the same endpoint: the DigitalPTZ feature tracks its
 * AllocatedVideoStreams and Viewport attributes.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to create the CameraAvSettingsUserLevelManagement cluster server on.
 * @param {CameraAvSettingsUserLevelManagementClusterOptions} options - The initial state of the CameraAvSettingsUserLevelManagement cluster server.
 * @returns {MatterbridgeEndpoint} The endpoint with the CameraAvSettingsUserLevelManagement cluster server created.
 */
export function createDefaultCameraAvSettingsUserLevelManagementClusterServer(
  endpoint: MatterbridgeEndpoint,
  options: CameraAvSettingsUserLevelManagementClusterOptions,
): MatterbridgeEndpoint {
  endpoint.behaviors.require(
    MatterbridgeCameraAvSettingsUserLevelManagementServer.with(
      CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
      CameraAvSettingsUserLevelManagement.Feature.MechanicalPresets,
      CameraAvSettingsUserLevelManagement.Feature.DigitalPtz,
    ),
    {
      ...options,
      movementState: CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle,
      // Matter 1.6.0 § 11.3.6.3: MPTZPresets is a nonVolatile list, so it starts empty and is populated by MPTZSavePreset.
      mptzPresets: [],
      // Matter 1.6.0 § 11.3.6.4: DPTZStreams lists the allocated video streams, so it starts empty and is kept in step with AllocatedVideoStreams by initialize().
      dptzStreams: [],
    },
  );
  return endpoint;
}
