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

import { CameraAvSettingsUserLevelManagementServer } from '@matter/node/behaviors/camera-av-settings-user-level-management';
import { Status, StatusResponseError } from '@matter/types';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { emitCommand } from '../matterbridgeEndpointHelpers.js';
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
 * CameraAvSettingsUserLevelManagement server, specialized for the MechanicalPan, MechanicalTilt and MechanicalZoom
 * features, that implements the mechanical pan/tilt/zoom absolute-position and relative-move commands required by a
 * PTZ Camera device.
 */
export class MatterbridgeCameraAvSettingsUserLevelManagementServer extends CameraAvSettingsUserLevelManagementServer.with(
  CameraAvSettingsUserLevelManagement.Feature.MechanicalPan,
  CameraAvSettingsUserLevelManagement.Feature.MechanicalTilt,
  CameraAvSettingsUserLevelManagement.Feature.MechanicalZoom,
) {
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
    emitCommand(this.endpoint, CameraAvSettingsUserLevelManagementServer.id, 'mptzSetPosition', request, this.context);
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
    emitCommand(this.endpoint, CameraAvSettingsUserLevelManagementServer.id, 'mptzRelativeMove', request, this.context);
  }
}

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
}

/**
 * Creates a default CameraAvSettingsUserLevelManagement cluster server, with the MechanicalPan, MechanicalTilt and
 * MechanicalZoom features enabled, on the given endpoint.
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
    ),
    {
      ...options,
      movementState: CameraAvSettingsUserLevelManagement.PhysicalMovement.Idle,
    },
  );
  return endpoint;
}
