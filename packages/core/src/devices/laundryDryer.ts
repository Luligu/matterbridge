/**
 * @file packages/core/src/devices/laundryDryer.ts
 * @description This file contains the LaundryDryer class.
 * @author Luca Liguori
 * @created 2025-06-29
 * @version 1.2.0
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

// @matter
import { LaundryDryerControlsServer } from '@matter/node/behaviors/laundry-dryer-controls';
import type { EndpointNumber } from '@matter/types';
import { LaundryDryerControls } from '@matter/types/clusters/laundry-dryer-controls';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import type { OperationalState } from '@matter/types/clusters/operational-state';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import { laundryDryer, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeLaundryWasherModeServer } from './laundryWasher.js';
import { createLevelTemperatureControlClusterServer, createNumberTemperatureControlClusterServer } from './temperatureControl.js';

/**
 * Options for configuring a {@link LaundryDryer} endpoint.
 */
export interface LaundryDryerOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial dryer mode. */
  currentMode?: number;
  /** Supported dryer modes. */
  supportedModes?: LaundryWasherMode.ModeOption[];
  /** Selected temperature-level index. */
  selectedTemperatureLevel?: number;
  /** Supported temperature-level labels. */
  supportedTemperatureLevels?: string[];
  /** Numeric temperature setpoint in hundredths of a degree Celsius. */
  temperatureSetpoint?: number;
  /** Minimum temperature in hundredths of a degree Celsius. */
  minTemperature?: number;
  /** Maximum temperature in hundredths of a degree Celsius. */
  maxTemperature?: number;
  /** Temperature step in hundredths of a degree Celsius. */
  step?: number;
  /** Initial operational state. */
  operationalState?: OperationalState.OperationalStateEnum;
}

/**
 * Matterbridge endpoint representing a laundry dryer device.
 */
export class LaundryDryer extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the LaundryDryer class.
   *
   * @param {string} name - The name of the laundry dryer.
   * @param {string} serial - The serial number of the laundry dryer.
   * @param {LaundryDryerOptions} [options] - Endpoint and initial cluster configuration.
   *
   * Remarks:
   * - If `temperatureSetpoint` is provided, the `createNumberTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   * - If `temperatureSetpoint` is not provided, the `createLevelTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with feature TemperatureLevel.
   */
  constructor(name: string, serial: string, options?: LaundryDryerOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass an {@link LaundryDryerOptions} object as the third argument instead.
   */
  // oxfmt-ignore
  constructor(name: string, serial: string, currentMode?: number, supportedModes?: LaundryWasherMode.ModeOption[], selectedTemperatureLevel?: number, supportedTemperatureLevels?: string[], temperatureSetpoint?: number, minTemperature?: number, maxTemperature?: number, step?: number, operationalState?: OperationalState.OperationalStateEnum);

  constructor(
    name: string,
    serial: string,
    optionsOrCurrentMode?: LaundryDryerOptions | number,
    supportedModes?: LaundryWasherMode.ModeOption[],
    selectedTemperatureLevel?: number,
    supportedTemperatureLevels?: string[],
    temperatureSetpoint?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    operationalState?: OperationalState.OperationalStateEnum,
  ) {
    const options: LaundryDryerOptions =
      typeof optionsOrCurrentMode === 'object'
        ? optionsOrCurrentMode
        : {
            currentMode: optionsOrCurrentMode,
            supportedModes,
            selectedTemperatureLevel,
            supportedTemperatureLevels,
            temperatureSetpoint,
            minTemperature,
            maxTemperature,
            step,
            operationalState,
          };
    super([laundryDryer, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Laundry Dryer');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultLaundryWasherModeClusterServer(options.currentMode, options.supportedModes);
    this.createDefaultLaundryDryerControlsClusterServer(1);
    if (options.temperatureSetpoint) createNumberTemperatureControlClusterServer(this, options.temperatureSetpoint, options.minTemperature, options.maxTemperature, options.step);
    else createLevelTemperatureControlClusterServer(this, options.selectedTemperatureLevel, options.supportedTemperatureLevels);
    this.createDefaultOperationalStateClusterServer(options.operationalState);
  }

  /**
   * Creates a default Laundry Washer Mode Cluster Server.
   *
   * @param {number} currentMode - The current mode of the laundry washer. Defaults to 2 (Normal mode). Dead Front OnOff Cluster will set this to 2 when turned off. Persistent attribute.
   * @param {LaundryWasherMode.ModeOption[]} supportedModes - The supported modes of the laundry washer. Defaults to a set of common modes (which include Delicate, Normal, Heavy, and Whites). Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLaundryWasherModeClusterServer(
    currentMode: number = 2,
    supportedModes: LaundryWasherMode.ModeOption[] = [
      { label: 'Delicate', mode: 1, modeTags: [{ value: LaundryWasherMode.ModeTag.Delicate }] },
      { label: 'Normal', mode: 2, modeTags: [{ value: LaundryWasherMode.ModeTag.Normal }] },
      { label: 'Heavy', mode: 3, modeTags: [{ value: LaundryWasherMode.ModeTag.Heavy }] },
      { label: 'Whites', mode: 4, modeTags: [{ value: LaundryWasherMode.ModeTag.Whites }] },
    ],
  ): this {
    this.behaviors.require(MatterbridgeLaundryWasherModeServer, {
      supportedModes, // Fixed attribute.
      currentMode, // Persistent attribute.
    });
    return this;
  }

  /**
   * Creates a default Laundry Dryer Controls Cluster Server.
   *
   * @param {LaundryDryerControls.DrynessLevel} selectedDrynessLevel - The selected dryness level. Default is undefined.
   * @param {LaundryDryerControls.DrynessLevel[]} supportedDrynessLevels - The supported dryness levels. Default is [Low, Normal, Extra, Max].
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLaundryDryerControlsClusterServer(selectedDrynessLevel?: LaundryDryerControls.DrynessLevel, supportedDrynessLevels?: LaundryDryerControls.DrynessLevel[]): this {
    this.behaviors.require(LaundryDryerControlsServer, {
      supportedDrynessLevels: supportedDrynessLevels ?? [
        LaundryDryerControls.DrynessLevel.Low,
        LaundryDryerControls.DrynessLevel.Normal,
        LaundryDryerControls.DrynessLevel.Extra,
        LaundryDryerControls.DrynessLevel.Max,
      ],
      selectedDrynessLevel, // Writable
    });
    return this;
  }
}
