/**
 * @file packages/core/src/devices/pump.ts
 * @description Pump device class exposing OnOff, LevelControl and PumpConfigurationAndControl (Matter 1.6.1 § 5.5).
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
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { PressureMeasurement } from '@matter/types/clusters/pressure-measurement';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import type { EndpointNumber } from '@matter/types/datatype';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import { powerSource, pump } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Options for configuring a {@link Pump} instance.
 */
export interface PumpOptions {
  /** Initial OnOff state (true => pump powered on). Defaults to `false`. */
  onOff?: boolean;
  /** Whether to add the optional Level Control cluster to control the pump setpoint. Defaults to `true`. */
  levelControl?: boolean;
  /** Initial Level Control CurrentLevel (0 => stopped, 1..200 => Level / 2 percent, 201..254 => 100%). Defaults to 254. Ignored when `levelControl` is `false`. */
  currentLevel?: number;
  /** Initial pump OperationMode. Defaults to `PumpConfigurationAndControl.OperationMode.Normal`. */
  operationMode?: PumpConfigurationAndControl.OperationMode;
  /** Maximum pressure the pump can achieve, in kPa x 10. Defaults to `null` (the cluster server then uses 6000). */
  maxPressure?: number | null;
  /** Maximum speed the pump can achieve, in RPM. Defaults to `null` (the cluster server then uses 3000). */
  maxSpeed?: number | null;
  /** Maximum flow the pump can achieve, in m3/h x 10. Defaults to `null` (the cluster server then uses 100). */
  maxFlow?: number | null;
  /** Minimum speed the pump can achieve in ConstantSpeed control mode, in RPM. Defaults to `null` (the cluster server then uses 600). */
  minConstSpeed?: number | null;
  /** Maximum speed the pump can achieve in ConstantSpeed control mode, in RPM. Defaults to `null` (the cluster server then uses 3000). */
  maxConstSpeed?: number | null;
  /** Measured temperature in °C x 100. When provided (also `null`), the optional Temperature Measurement cluster is added. */
  temperatureMeasuredValue?: number | null;
  /** Measured pressure in kPa x 10. When provided (also `null`), the optional Pressure Measurement cluster is added. */
  pressureMeasuredValue?: number | null;
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
 * Matterbridge endpoint representing a Pump (Device Type 0x0303).
 *
 * Mapping (Matter 1.6.1 § 5.5.6):
 *  - OnOff FALSE => pump stopped, OnOff TRUE => pump running at the stored level (or at the maximum level when none was stored).
 *  - LevelControl CurrentLevel => pump setpoint: 0 stopped, 1..200 Level / 2 percent, 201..254 100%.
 *
 * The PumpConfigurationAndControl cluster (feature ConstantSpeed) keeps Speed, Capacity and the PumpStatus Running bit
 * in sync with OnOff, LevelControl and OperationMode.
 */
export class Pump extends MatterbridgeEndpoint {
  /**
   * Creates a Pump endpoint and configures its default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {PumpOptions} [options] - Optional configuration values. Missing fields use defaults.
   */
  constructor(name: string, serial: string, options: PumpOptions = {}) {
    super([pump, powerSource], { id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number: options.number, tagList: options.tagList });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Pump');
    if (options.batteryPowered) {
      this.createDefaultPowerSourceBatteryClusterServer();
    } else {
      this.createDefaultPowerSourceWiredClusterServer();
    }
    // Matter 1.6.1 § 5.5.5: On/Off is mandatory, Level Control is optional.
    this.createOnOffClusterServer(options.onOff ?? false);
    if (options.levelControl !== false) this.createLevelControlClusterServer(options.currentLevel ?? 254);
    // Matter 1.6.1 § 5.5.5: Pump Configuration and Control is mandatory.
    this.createDefaultPumpConfigurationAndControlClusterServer(
      options.operationMode,
      options.maxPressure ?? null,
      options.maxSpeed ?? null,
      options.maxFlow ?? null,
      options.minConstSpeed ?? null,
      options.maxConstSpeed ?? null,
    );
    // Matter 1.6.1 § 5.5.5: Temperature, Pressure and Flow Measurement are optional.
    if (options.temperatureMeasuredValue !== undefined) this.createDefaultTemperatureMeasurementClusterServer(options.temperatureMeasuredValue);
    if (options.pressureMeasuredValue !== undefined) this.createDefaultPressureMeasurementClusterServer(options.pressureMeasuredValue);
    if (options.flowMeasuredValue !== undefined) this.createDefaultFlowMeasurementClusterServer(options.flowMeasuredValue);
  }

  /**
   * Sets the OnOff `onOff` attribute (true => pump powered on, false => pump stopped).
   *
   * @param {boolean} onOff - Desired OnOff state.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setOnOff(onOff: boolean): Promise<void> {
    await this.setAttribute(OnOff, 'onOff', onOff);
  }

  /**
   * Gets the OnOff `onOff` attribute.
   *
   * @returns {boolean | undefined} TRUE when the pump is powered on, FALSE when it is stopped.
   */
  getOnOff(): boolean | undefined {
    return this.getAttribute(OnOff, 'onOff');
  }

  /**
   * Sets the LevelControl `currentLevel` attribute (the pump setpoint). Ignored when the Level Control cluster is not present or the value is not finite.
   *
   * @param {number} level - Level (0 => stopped, 1..200 => Level / 2 percent, 201..254 => 100%). Coerced to 0..254.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setLevel(level: number): Promise<void> {
    if (!this.hasClusterServer(LevelControl) || !Number.isFinite(level)) return;
    await this.setAttribute(LevelControl, 'currentLevel', Math.min(254, Math.max(0, Math.round(level))));
  }

  /**
   * Gets the LevelControl `currentLevel` attribute.
   *
   * @returns {number | null | undefined} The current level, or undefined when the Level Control cluster is not present.
   */
  getLevel(): number | null | undefined {
    if (!this.hasClusterServer(LevelControl)) return undefined;
    return this.getAttribute(LevelControl, 'currentLevel');
  }

  /**
   * Sets the PumpConfigurationAndControl `operationMode` attribute.
   *
   * @param {PumpConfigurationAndControl.OperationMode} operationMode - Desired operation mode.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setOperationMode(operationMode: PumpConfigurationAndControl.OperationMode): Promise<void> {
    await this.setAttribute(PumpConfigurationAndControl, 'operationMode', operationMode);
  }

  /**
   * Gets the PumpConfigurationAndControl `operationMode` attribute.
   *
   * @returns {PumpConfigurationAndControl.OperationMode | undefined} The current operation mode.
   */
  getOperationMode(): PumpConfigurationAndControl.OperationMode | undefined {
    return this.getAttribute(PumpConfigurationAndControl, 'operationMode');
  }

  /**
   * Gets the PumpConfigurationAndControl `speed` attribute.
   *
   * @returns {number | null | undefined} The actual pump speed in RPM.
   */
  getSpeed(): number | null | undefined {
    return this.getAttribute(PumpConfigurationAndControl, 'speed');
  }

  /**
   * Gets the PumpConfigurationAndControl `capacity` attribute.
   *
   * @returns {number | null | undefined} The actual pump capacity, in units of 0.005% of the effective maximum setpoint.
   */
  getCapacity(): number | null | undefined {
    return this.getAttribute(PumpConfigurationAndControl, 'capacity');
  }

  /**
   * Sets the TemperatureMeasurement `measuredValue` attribute. Ignored when the Temperature Measurement cluster is not present.
   *
   * @param {number | null} value - Measured temperature in °C x 100, or null when unknown.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setTemperatureMeasuredValue(value: number | null): Promise<void> {
    if (!this.hasClusterServer(TemperatureMeasurement)) return;
    await this.setAttribute(TemperatureMeasurement, 'measuredValue', value);
  }

  /**
   * Sets the PressureMeasurement `measuredValue` attribute. Ignored when the Pressure Measurement cluster is not present.
   *
   * @param {number | null} value - Measured pressure in kPa x 10, or null when unknown.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setPressureMeasuredValue(value: number | null): Promise<void> {
    if (!this.hasClusterServer(PressureMeasurement)) return;
    await this.setAttribute(PressureMeasurement, 'measuredValue', value);
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
