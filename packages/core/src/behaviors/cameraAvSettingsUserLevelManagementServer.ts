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
    if (pan === undefined && tilt === undefined && zoom === undefined) {
      throw new StatusResponseError('MPTZSetPosition requires at least one of pan, tilt or zoom to be present', Status.InvalidCommand);
    }
    if (pan !== undefined && (pan < this.state.panMin || pan > this.state.panMax)) {
      throw new StatusResponseError(`Pan ${pan} is outside of the supported range [${this.state.panMin}, ${this.state.panMax}]`, Status.ConstraintError);
    }
    if (tilt !== undefined && (tilt < this.state.tiltMin || tilt > this.state.tiltMax)) {
      throw new StatusResponseError(`Tilt ${tilt} is outside of the supported range [${this.state.tiltMin}, ${this.state.tiltMax}]`, Status.ConstraintError);
    }
    if (zoom !== undefined && (zoom < 1 || zoom > this.state.zoomMax)) {
      throw new StatusResponseError(`Zoom ${zoom} is outside of the supported range [1, ${this.state.zoomMax}]`, Status.ConstraintError);
    }
    this.state.mptzPosition = {
      pan: pan ?? this.state.mptzPosition.pan,
      tilt: tilt ?? this.state.mptzPosition.tilt,
      zoom: zoom ?? this.state.mptzPosition.zoom,
    };
    device.log.info(
      `Set mechanical PTZ position to pan ${this.state.mptzPosition.pan}°, tilt ${this.state.mptzPosition.tilt}°, zoom ${this.state.mptzPosition.zoom} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
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
    if (request.panDelta === undefined && request.tiltDelta === undefined && request.zoomDelta === undefined) {
      throw new StatusResponseError('MPTZRelativeMove requires at least one of panDelta, tiltDelta or zoomDelta to be present', Status.InvalidCommand);
    }
    const current = this.state.mptzPosition;
    /* v8 ignore next -- pan/tilt/zoom are conformance-mandatory once MechanicalPan/MechanicalTilt/MechanicalZoom are
     * enabled, which this class's fixed feature set always does (see the class declaration), so mptzPosition always
     * has all three fields defined and the `?? 0`/`?? 1` fallbacks can never trigger through the public API. */
    const pan = request.panDelta === undefined ? current.pan : clamp((current.pan ?? 0) + request.panDelta, this.state.panMin, this.state.panMax);
    // v8 ignore next -- same as above, for tilt.
    const tilt = request.tiltDelta === undefined ? current.tilt : clamp((current.tilt ?? 0) + request.tiltDelta, this.state.tiltMin, this.state.tiltMax);
    // v8 ignore next -- same as above, for zoom.
    const zoom = request.zoomDelta === undefined ? current.zoom : clamp((current.zoom ?? 1) + request.zoomDelta, 1, this.state.zoomMax);
    this.state.mptzPosition = { pan, tilt, zoom };
    device.log.info(
      `Moved mechanical PTZ position by pan ${request.panDelta ?? 0}°, tilt ${request.tiltDelta ?? 0}°, zoom ${request.zoomDelta ?? 0} to pan ${pan}°, tilt ${tilt}°, zoom ${zoom} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }
}
