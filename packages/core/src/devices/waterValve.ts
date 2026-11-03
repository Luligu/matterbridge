/**
 * @file packages/core/src/devices/waterValve.ts
 * @description Water Valve device class exposing ValveConfigurationAndControl and optional FlowMeasurement (Matter 1.6.1 § 5.6).
 * @author Luca Liguori
 * @created 2026-11-03
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

// @matter
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import type { EndpointNumber } from '@matter/types/datatype';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeValveConfigurationAndControlServer } from '../behaviors/valveConfigurationAndControlServer.js';
import { powerSource, waterValve } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Options for configuring a {@link WaterValve} instance.
 */
export interface WaterValveOptions {
  /** Initial valve state (CurrentState and TargetState). Defaults to `ValveConfigurationAndControl.ValveState.Closed`. */
  valveState?: ValveConfigurationAndControl.ValveState;
  /** Whether to enable the Level feature of the ValveConfigurationAndControl cluster (proportional valve). Defaults to `true`. Use `false` for a binary (on/off) valve. */
  level?: boolean;
  /** Initial valve level in percent (CurrentLevel and TargetLevel, 100 = fully open). Defaults to 0. Ignored when `level` is `false`. */
  valveLevel?: number;
  /** Simulated duration, in milliseconds, that an Open/Close movement takes to complete. A non-positive value disables the built-in simulation, leaving completion to the real device implementation. Defaults to 0 (disabled). */
  movementDuration?: number;
  /** Whether the RemainingDuration countdown timer auto-closes the valve once it reaches 0. Defaults to `false` (disabled), leaving auto-close to the real device implementation. */
  autoClose?: boolean;
  /** Measured flow in m3/h x 10. When provided (also `null`), the optional Flow Measurement cluster is added. */
  flowMeasuredValue?: number | null;
  /** Whether the device is battery powered. Defaults to `false` (wired). */
  batteryPowered?: boolean;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Matterbridge endpoint representing a Water Valve (Device Type 0x0042).
 *
 * The ValveConfigurationAndControl cluster is created with the Level feature by default (proportional valve),
 * or without features when `level` is `false` (binary valve, e.g. a solenoid valve or a relay).
 */
export class WaterValve extends MatterbridgeEndpoint {
  /**
   * Creates a WaterValve endpoint and configures its default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {WaterValveOptions} [options] - Optional configuration values. Missing fields use defaults.
   */
  constructor(name: string, serial: string, options: WaterValveOptions = {}) {
    super([waterValve, powerSource], { id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number: options.number, tagList: options.tagList });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Water Valve');
    if (options.batteryPowered) {
      this.createDefaultPowerSourceBatteryClusterServer();
    } else {
      this.createDefaultPowerSourceWiredClusterServer();
    }
    // Matter 1.6.1 § 5.6.4: Valve Configuration and Control is mandatory.
    if (options.level === false) {
      this.createOnOffValveConfigurationAndControlClusterServer(options.valveState, options.movementDuration, options.autoClose);
    } else {
      this.createDefaultValveConfigurationAndControlClusterServer(options.valveState, options.valveLevel, options.movementDuration, options.autoClose);
    }
    // Matter 1.6.1 § 5.6.4.3: The optional Flow Measurement cluster server reports the measured flow through the valve.
    if (options.flowMeasuredValue !== undefined) this.createDefaultFlowMeasurementClusterServer(options.flowMeasuredValue);
  }

  /**
   * Opens the valve, running the same Open command logic as a controller request.
   *
   * @param {ValveConfigurationAndControl.OpenRequest} [request] - Optional Open request: `openDuration` in seconds (`null` keeps the valve open until closed, defaults to the DefaultOpenDuration attribute) and `targetLevel` in percent (ignored without the Level feature, defaults to the DefaultOpenLevel attribute).
   * @returns {Promise<void>} Resolves when the Open command has been processed.
   */
  async openValve(request: ValveConfigurationAndControl.OpenRequest = {}): Promise<void> {
    await this.act(async (agent) => agent.get(MatterbridgeValveConfigurationAndControlServer).open(request));
  }

  /**
   * Closes the valve, running the same Close command logic as a controller request.
   * Named `closeValve()` since `close()` is the Endpoint lifecycle teardown.
   *
   * @returns {Promise<void>} Resolves when the Close command has been processed.
   */
  async closeValve(): Promise<void> {
    await this.act(async (agent) => agent.get(MatterbridgeValveConfigurationAndControlServer).close());
  }

  /**
   * Sets the ValveConfigurationAndControl `currentState` attribute, e.g. to report the physical valve state.
   *
   * @param {ValveConfigurationAndControl.ValveState} state - The current valve state.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setCurrentState(state: ValveConfigurationAndControl.ValveState): Promise<void> {
    await this.setAttribute(ValveConfigurationAndControl, 'currentState', state);
  }

  /**
   * Gets the ValveConfigurationAndControl `currentState` attribute.
   *
   * @returns {ValveConfigurationAndControl.ValveState | null | undefined} The current valve state.
   */
  getCurrentState(): ValveConfigurationAndControl.ValveState | null | undefined {
    return this.getAttribute(ValveConfigurationAndControl, 'currentState');
  }

  /**
   * Sets the ValveConfigurationAndControl `currentLevel` attribute, e.g. to report the physical valve level. Ignored without the Level feature or when the value is not finite.
   *
   * @param {number | null} level - The current valve level in percent (coerced to 0..100), or null when unknown.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setCurrentLevel(level: number | null): Promise<void> {
    if (!this.hasAttributeServer(ValveConfigurationAndControl, 'currentLevel')) return;
    if (level !== null && !Number.isFinite(level)) return;
    await this.setAttribute(ValveConfigurationAndControl, 'currentLevel', level === null ? null : Math.min(100, Math.max(0, Math.round(level))));
  }

  /**
   * Gets the ValveConfigurationAndControl `currentLevel` attribute.
   *
   * @returns {number | null | undefined} The current valve level in percent, or undefined without the Level feature.
   */
  getCurrentLevel(): number | null | undefined {
    if (!this.hasAttributeServer(ValveConfigurationAndControl, 'currentLevel')) return undefined;
    const currentLevel: unknown = this.getAttribute(ValveConfigurationAndControl.id, 'currentLevel');
    return typeof currentLevel === 'number' || currentLevel === null ? currentLevel : undefined;
  }

  /**
   * Sets the FlowMeasurement `measuredValue` attribute. Ignored when the Flow Measurement cluster is not present.
   *
   * @param {number | null} value - Measured flow in m3/h x 10, or null when unknown.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setFlowMeasuredValue(value: number | null): Promise<void> {
    if (!this.hasClusterServer(FlowMeasurement)) return;
    await this.setAttribute(FlowMeasurement, 'measuredValue', value);
  }
}
