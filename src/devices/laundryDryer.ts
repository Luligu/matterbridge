/**
 * @description This file contains the LaundryDryer class.
 * @file src/devices/laundryDryer.ts
 * @author Luca Liguori
 * @created 2025-06-29
 * @version 1.1.0
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

// Imports from @matter
import { OperationalState } from '@matter/main/clusters/operational-state';
import { LaundryWasherMode } from '@matter/main/clusters/laundry-washer-mode';
import { TemperatureControl } from '@matter/main/clusters/temperature-control';
import { LaundryDryerControls } from '@matter/main/clusters/laundry-dryer-controls';
import { LaundryDryerControlsServer } from '@matter/main/behaviors/laundry-dryer-controls';

// Matterbridge
import { laundryDryer, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

import { MatterbridgeLaundryWasherModeServer, MatterbridgeLevelTemperatureControlServer, MatterbridgeNumberTemperatureControlServer } from './laundryWasher.js';

export class LaundryDryer extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the LaundryDryer class.
   *
   * @param {string} name - The name of the laundry dryer.
   * @param {string} serial - The serial number of the laundry dryer.
   * @param {number} [currentMode] - The current mode of the laundry dryer. Defaults to 2 (Normal mode). Dead Front OnOff Cluster will set this to 2 when turned off. Persistent attribute.
   * @param {LaundryWasherMode.ModeOption[]} [supportedModes] - The supported modes of the laundry dryer. Defaults to a set of common modes (which include Delicate, Normal, Heavy, and Whites). Fixed attribute.
   * @param {number} [selectedTemperatureLevel] - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} [supportedTemperatureLevels] - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']. Fixed attribute.
   * @param {number} [temperatureSetpoint] - The temperature setpoint * 100. Defaults to 40 * 100 (which corresponds to 40°C).
   * @param {number} [minTemperature] - The minimum temperature * 100. Defaults to 30 * 100 (which corresponds to 30°C). Fixed attribute.
   * @param {number} [maxTemperature] - The maximum temperature * 100. Defaults to 60 * 100 (which corresponds to 60°C). Fixed attribute.
   * @param {number} [step] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
   * @param {OperationalState.OperationalStateEnum} [operationalState] - The operational state of the laundry washer. Defaults to OperationalState.OperationalStateEnum.Off.
   *
   * Remarks:
   * - If `temperatureSetpoint` is provided, the `createNumberTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   * - If `temperatureSetpoint` is not provided, the `createLevelTemperatureControlClusterServer` method will be used to create the TemperatureControl Cluster Server with feature TemperatureLevel.
   */
  constructor(
    name: string,
    serial: string,
    currentMode?: number,
    supportedModes?: LaundryWasherMode.ModeOption[],
    selectedTemperatureLevel?: number,
    supportedTemperatureLevels?: string[],
    temperatureSetpoint?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    operationalState?: OperationalState.OperationalStateEnum,
  ) {
    super([laundryDryer, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Laundry Dryer');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultLaundryWasherModeClusterServer(currentMode, supportedModes);
    this.createDefaultLaundryDryerControlsClusterServer(1);
    if (temperatureSetpoint) this.createNumberTemperatureControlClusterServer(temperatureSetpoint, minTemperature, maxTemperature, step);
    else this.createLevelTemperatureControlClusterServer(selectedTemperatureLevel, supportedTemperatureLevels);
    this.createDefaultOperationalStateClusterServer(operationalState);
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
      supportedDrynessLevels: supportedDrynessLevels ?? [LaundryDryerControls.DrynessLevel.Low, LaundryDryerControls.DrynessLevel.Normal, LaundryDryerControls.DrynessLevel.Extra, LaundryDryerControls.DrynessLevel.Max],
      selectedDrynessLevel, // Writable
    });
    return this;
  }

  /**
   * Creates a TemperatureControl Cluster Server with feature TemperatureLevel.
   *
   * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} supportedTemperatureLevels - The supported temperature levels. Defaults to ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']. Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createLevelTemperatureControlClusterServer(selectedTemperatureLevel: number = 1, supportedTemperatureLevels: string[] = ['Cold', 'Warm', 'Hot', '30°', '40°', '60°', '80°']): this {
    this.behaviors.require(MatterbridgeLevelTemperatureControlServer.with(TemperatureControl.Feature.TemperatureLevel), {
      selectedTemperatureLevel,
      supportedTemperatureLevels,
    });
    return this;
  }

  /**
   * Creates a TemperatureControl Cluster Server with features TemperatureNumber and TemperatureStep.
   *
   * @param {number} temperatureSetpoint - The temperature setpoint * 100. Defaults to 40 * 100 (which corresponds to 40°C).
   * @param {number} minTemperature - The minimum temperature * 100. Defaults to 30 * 100 (which corresponds to 30°C). Fixed attribute.
   * @param {number} maxTemperature - The maximum temperature * 100. Defaults to 60 * 100 (which corresponds to 60°C). Fixed attribute.
   * @param {number} [step] - The step size for temperature changes. Defaults to 10 * 100 (which corresponds to 10°C). Fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createNumberTemperatureControlClusterServer(temperatureSetpoint: number = 40 * 100, minTemperature: number = 30 * 100, maxTemperature: number = 60 * 100, step: number = 10 * 100): this {
    this.behaviors.require(MatterbridgeNumberTemperatureControlServer.with(TemperatureControl.Feature.TemperatureNumber, TemperatureControl.Feature.TemperatureStep), {
      temperatureSetpoint,
      minTemperature, // Fixed attribute
      maxTemperature, // Fixed attribute
      step, // Fixed attribute
    });
    return this;
  }
}
