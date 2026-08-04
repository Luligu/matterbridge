/**
 * @file packages/vitest-utils/src/matterRequest.ts
 * @description This file contains the Matter Request utilities.
 * @author Luca Liguori
 * @created 2026-04-19
 * @version 1.0.1
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

import { ColorControl } from '@matter/types/clusters/color-control';
import type { LevelControl } from '@matter/types/clusters/level-control';
import type { OnOff } from '@matter/types/clusters/on-off';

/**
 * Build a Matter OnOff `OffWithEffectRequest` payload.
 *
 * @param {OnOff.EffectIdentifier} effectIdentifier Effect to use when turning the device off.
 * @param {number} effectVariant Variant of the effect.
 * @returns {OnOff.OffWithEffectRequest} The request payload.
 */
export function getOffWithEffectRequest(effectIdentifier: OnOff.EffectIdentifier, effectVariant: number): OnOff.OffWithEffectRequest {
  const request: OnOff.OffWithEffectRequest = {
    effectIdentifier,
    effectVariant,
  };
  return request;
}

/**
 * Build a Matter OnOff `OnWithTimedOffRequest` payload.
 *
 * @param {boolean} acceptOnlyWhenOn Whether the command should be accepted only when the device is on.
 * @param {number} onTime Length of time (in 1/10ths second) that the device is to remain on.
 * @param {number} offWaitTime Length of time (in 1/10ths second) that the device is guarded from being turned back on.
 * @returns {OnOff.OnWithTimedOffRequest} The request payload.
 */
export function getOnWithTimedOffRequest(acceptOnlyWhenOn: boolean, onTime: number, offWaitTime: number): OnOff.OnWithTimedOffRequest {
  const request: OnOff.OnWithTimedOffRequest = {
    onOffControl: { acceptOnlyWhenOn },
    onTime,
    offWaitTime,
  };
  return request;
}

/**
 * Build a Matter LevelControl `MoveToLevelRequest` payload.
 *
 * Helper used in tests to create a correctly shaped request object, including
 * `optionsMask` and `optionsOverride`.
 *
 * @param {number} level Target level (Matter `uint8`; commonly 0–254).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {LevelControl.MoveToLevelRequest} The request payload.
 */
export function getMoveToLevelRequest(level: number, transitionTime: number, executeIfOff: boolean): LevelControl.MoveToLevelRequest {
  const request: LevelControl.MoveToLevelRequest = {
    level,
    transitionTime,
    optionsMask: { executeIfOff, coupleColorTempToLevel: false },
    optionsOverride: { executeIfOff, coupleColorTempToLevel: false },
  };
  return request;
}

/**
 * Build a Matter LevelControl `MoveRequest` payload.
 *
 * @param {LevelControl.MoveMode} moveMode Direction of movement.
 * @param {number | null} rate Rate of movement in units per second.
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {LevelControl.MoveRequest} The request payload.
 */
export function getMoveRequest(moveMode: LevelControl.MoveMode, rate: number | null, executeIfOff: boolean): LevelControl.MoveRequest {
  const request: LevelControl.MoveRequest = {
    moveMode,
    rate,
    optionsMask: { executeIfOff, coupleColorTempToLevel: false },
    optionsOverride: { executeIfOff, coupleColorTempToLevel: false },
  };
  return request;
}

/**
 * Build a Matter LevelControl `StepRequest` payload.
 *
 * @param {LevelControl.StepMode} stepMode Direction of the step change.
 * @param {number} stepSize Change to CurrentLevel.
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {LevelControl.StepRequest} The request payload.
 */
export function getStepRequest(stepMode: LevelControl.StepMode, stepSize: number, transitionTime: number | null, executeIfOff: boolean): LevelControl.StepRequest {
  const request: LevelControl.StepRequest = {
    stepMode,
    stepSize,
    transitionTime,
    optionsMask: { executeIfOff, coupleColorTempToLevel: false },
    optionsOverride: { executeIfOff, coupleColorTempToLevel: false },
  };
  return request;
}

/**
 * Build a Matter LevelControl `StopRequest` payload.
 *
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {LevelControl.StopRequest} The request payload.
 */
export function getStopRequest(executeIfOff: boolean): LevelControl.StopRequest {
  const request: LevelControl.StopRequest = {
    optionsMask: { executeIfOff, coupleColorTempToLevel: false },
    optionsOverride: { executeIfOff, coupleColorTempToLevel: false },
  };
  return request;
}

/**
 * Build a Matter ColorControl `MoveToColorTemperatureRequest` payload.
 *
 * @param {number} colorTemperatureMireds Target color temperature in mireds (micro reciprocal degrees).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.MoveToColorTemperatureRequest} The request payload.
 */
export function getMoveToColorTemperatureRequest(colorTemperatureMireds: number, transitionTime: number, executeIfOff: boolean): ColorControl.MoveToColorTemperatureRequest {
  const request: ColorControl.MoveToColorTemperatureRequest = {
    colorTemperatureMireds,
    transitionTime,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}

/**
 * Build a Matter ColorControl `MoveToHueRequest` payload.
 *
 * Uses `ColorControl.Direction.Shortest` by default.
 *
 * @param {number} hue Target hue (Matter `uint8`; commonly 0–254).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.MoveToHueRequest} The request payload.
 */
export function getMoveToHueRequest(hue: number, transitionTime: number, executeIfOff: boolean): ColorControl.MoveToHueRequest {
  const request: ColorControl.MoveToHueRequest = {
    hue,
    transitionTime,
    direction: ColorControl.Direction.Shortest,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}

/**
 * Build a Matter ColorControl `EnhancedMoveToHueRequest` payload.
 *
 * Uses `ColorControl.Direction.Shortest` by default.
 *
 * @param {number} enhancedHue Target enhanced hue (Matter `uint16`; commonly 0–65535).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.EnhancedMoveToHueRequest} The request payload.
 */
export function getEnhancedMoveToHueRequest(enhancedHue: number, transitionTime: number, executeIfOff: boolean): ColorControl.EnhancedMoveToHueRequest {
  const request: ColorControl.EnhancedMoveToHueRequest = {
    enhancedHue,
    transitionTime,
    direction: ColorControl.Direction.Shortest,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}

/**
 * Build a Matter ColorControl `MoveToSaturationRequest` payload.
 *
 * @param {number} saturation Target saturation (Matter `uint8`; commonly 0–254).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.MoveToSaturationRequest} The request payload.
 */
export function getMoveToSaturationRequest(saturation: number, transitionTime: number, executeIfOff: boolean): ColorControl.MoveToSaturationRequest {
  const request: ColorControl.MoveToSaturationRequest = {
    saturation,
    transitionTime,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}

/**
 * Build a Matter ColorControl `MoveToHueAndSaturationRequest` payload.
 *
 * @param {number} hue Target hue (Matter `uint8`; commonly 0–254).
 * @param {number} saturation Target saturation (Matter `uint8`; commonly 0–254).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.MoveToHueAndSaturationRequest} The request payload.
 */
export function getMoveToHueAndSaturationRequest(hue: number, saturation: number, transitionTime: number, executeIfOff: boolean): ColorControl.MoveToHueAndSaturationRequest {
  const request: ColorControl.MoveToHueAndSaturationRequest = {
    hue,
    saturation,
    transitionTime,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}

/**
 * Build a Matter ColorControl `EnhancedMoveToHueAndSaturationRequest` payload.
 *
 * @param {number} enhancedHue Target enhanced hue (Matter `uint16`; commonly 0–65535).
 * @param {number} saturation Target saturation (Matter `uint8`; commonly 0–254).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.EnhancedMoveToHueAndSaturationRequest} The request payload.
 */
export function getEnhancedMoveToHueAndSaturationRequest(
  enhancedHue: number,
  saturation: number,
  transitionTime: number,
  executeIfOff: boolean,
): ColorControl.EnhancedMoveToHueAndSaturationRequest {
  const request: ColorControl.EnhancedMoveToHueAndSaturationRequest = {
    enhancedHue,
    saturation,
    transitionTime,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}

/**
 * Build a Matter ColorControl `MoveToColorRequest` payload.
 *
 * @param {number} colorX Target X coordinate in CIE 1931 XY color space (Matter `uint16`).
 * @param {number} colorY Target Y coordinate in CIE 1931 XY color space (Matter `uint16`).
 * @param {number} transitionTime Transition time (Matter `uint16`; commonly in 1/10s units).
 * @param {boolean} executeIfOff Whether the command should be executed even when the device is off.
 * @returns {ColorControl.MoveToColorRequest} The request payload.
 */
export function getMoveToColorRequest(colorX: number, colorY: number, transitionTime: number, executeIfOff: boolean): ColorControl.MoveToColorRequest {
  const request: ColorControl.MoveToColorRequest = {
    colorX,
    colorY,
    transitionTime,
    optionsMask: { executeIfOff },
    optionsOverride: { executeIfOff },
  };
  return request;
}
