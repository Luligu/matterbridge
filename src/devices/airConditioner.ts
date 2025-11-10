/**
 * @description This file contains the AirConditioner class.
 * @file src/devices/airConditioner.ts
 * @author Luca Liguori
 * @created 2025-09-04
 * @version 1.0.0
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
import { ThermostatUserInterfaceConfiguration } from '@matter/types/clusters/thermostat-user-interface-configuration';
import { FanControl } from '@matter/types/clusters/fan-control';

// Matterbridge
import { airConditioner, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Options for configuring an {@link AirConditioner} instance.
 *
 * All temperatures in °C. Typical valid range 0–50 unless otherwise noted.
 */
export interface AirConditionerOptions {
  /** Local ambient temperature (°C). Default 23. */
  localTemperature?: number;
  /** Occupied heating setpoint (°C). Default 21. */
  occupiedHeatingSetpoint?: number;
  /** Occupied cooling setpoint (°C). Default 25. */
  occupiedCoolingSetpoint?: number;
  /** Minimum setpoint dead band (°C). Default 1. */
  minSetpointDeadBand?: number;
  /** Minimum heat setpoint limit (°C). Default 0. */
  minHeatSetpointLimit?: number;
  /** Maximum heat setpoint limit (°C). Default 50. */
  maxHeatSetpointLimit?: number;
  /** Minimum cool setpoint limit (°C). Default 0. */
  minCoolSetpointLimit?: number;
  /** Maximum cool setpoint limit (°C). Default 50. */
  maxCoolSetpointLimit?: number;
  /** Temperature display mode. Default Celsius. */
  temperatureDisplayMode?: ThermostatUserInterfaceConfiguration.TemperatureDisplayMode;
  /** Keypad lockout mode. Default NoLockout. */
  keypadLockout?: ThermostatUserInterfaceConfiguration.KeypadLockout;
  /** Schedule programming visibility. Default ScheduleProgrammingPermitted. */
  scheduleProgrammingVisibility?: ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility;
  /** Fan mode. Default Off. */
  fanMode?: FanControl.FanMode;
  /** Fan mode sequence. Default OffLowMedHighAuto. */
  fanModeSequence?: FanControl.FanModeSequence;
  /** Target fan percent setting (0–100). Default 0. */
  percentSetting?: number;
  /** Current fan percent (0–100). Default 0. */
  percentCurrent?: number;
}

export class AirConditioner extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the AirConditioner class.
   *
   * A Room Air Conditioner is a device which at a minimum is capable of being turned on and off and of controlling the temperature in the living space.
   * A Room Air Conditioner MAY also support additional capabilities via endpoint composition.
   * The DF (Dead Front) feature is required for the On/Off cluster in this device type.
   *
   * @param {string} name - The name of the air conditioner.
   * @param {string} serial - The serial number of the air conditioner.
   * @param {AirConditionerOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - localTemperature: 23
   *  - occupiedHeatingSetpoint: 21
   *  - occupiedCoolingSetpoint: 25
   *  - minSetpointDeadBand: 1
   *  - minHeatSetpointLimit: 0
   *  - maxHeatSetpointLimit: 50
   *  - minCoolSetpointLimit: 0
   *  - maxCoolSetpointLimit: 50
   *  - temperatureDisplayMode: Celsius
   *  - keypadLockout: NoLockout
   *  - scheduleProgrammingVisibility: ScheduleProgrammingPermitted
   *  - fanMode: Off
   *  - fanModeSequence: OffLowMedHighAuto
   *  - percentSetting: 0
   *  - percentCurrent: 0
   *
   * @returns {AirConditioner} The AirConditioner instance.
   *
   * @remarks Not supported by Google Home.
   */
  constructor(name: string, serial: string, options: AirConditionerOptions = {}) {
    const {
      localTemperature = 23,
      occupiedHeatingSetpoint = 21,
      occupiedCoolingSetpoint = 25,
      minSetpointDeadBand = 1,
      minHeatSetpointLimit = 0,
      maxHeatSetpointLimit = 50,
      minCoolSetpointLimit = 0,
      maxCoolSetpointLimit = 50,
      temperatureDisplayMode = ThermostatUserInterfaceConfiguration.TemperatureDisplayMode.Celsius,
      keypadLockout = ThermostatUserInterfaceConfiguration.KeypadLockout.NoLockout,
      scheduleProgrammingVisibility = ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility.ScheduleProgrammingPermitted,
      fanMode = FanControl.FanMode.Off,
      fanModeSequence = FanControl.FanModeSequence.OffLowMedHighAuto,
      percentSetting = 0,
      percentCurrent = 0,
    } = options;
    super([airConditioner, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Air Conditioner');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createDeadFrontOnOffClusterServer(true);
    this.createDefaultThermostatClusterServer(localTemperature, occupiedHeatingSetpoint, occupiedCoolingSetpoint, minSetpointDeadBand, minHeatSetpointLimit, maxHeatSetpointLimit, minCoolSetpointLimit, maxCoolSetpointLimit);
    this.createDefaultThermostatUserInterfaceConfigurationClusterServer(temperatureDisplayMode, keypadLockout, scheduleProgrammingVisibility);
    this.createDefaultFanControlClusterServer(fanMode, fanModeSequence, percentSetting, percentCurrent);
  }
}
