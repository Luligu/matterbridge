/**
 * @description This file contains the WaterHeater class.
 * @file src/devices/waterHeater.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-05-18
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

// Matterbridge

// Matter.js
import { MaybePromise } from '@matter/main';
import { ModeBase } from '@matter/main/clusters/mode-base';
import { WaterHeaterManagement } from '@matter/main/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/main/clusters/water-heater-mode';
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';
import { WaterHeaterManagementServer } from '@matter/main/behaviors/water-heater-management';
import { WaterHeaterModeServer } from '@matter/main/behaviors/water-heater-mode';

import { MatterbridgeServer } from '../matterbridgeBehaviors.js';
import { electricalSensor, powerSource, waterHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

export class WaterHeater extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the WaterHeater class.
   *
   * @param {string} name - The name of the water heater.
   * @param {string} serial - The serial number of the water heater.
   * @param {number} [waterTemperature] - The current water temperature. Defaults to 50.
   * @param {number} [targetWaterTemperature] - The target water temperature. Defaults to 55.
   * @param {number} [minHeatSetpointLimit] - The minimum heat setpoint limit. Defaults to 20.
   * @param {number} [maxHeatSetpointLimit] - The maximum heat setpoint limit. Defaults to 80.
   * @param {{ immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean }} [heaterTypes] - Indicates the heat sources that the water heater can call on for heating. Defaults to { immersionElement1: true }.
   * @param {boolean} heaterTypes.immersionElement1 - Indicates if the water heater has an immersion element 1. Defaults to true.
   * @param {boolean} heaterTypes.immersionElement2 - Indicates if the water heater has an immersion element 2.
   * @param {boolean} heaterTypes.heatPump - Indicates if the water heater has a heat pump.
   * @param {boolean} heaterTypes.boiler - Indicates if the water heater has a boiler.
   * @param {boolean} heaterTypes.other - Indicates if the water heater has other types of heating sources.
   * @param {number} [tankPercentage] - The current tank percentage of the WaterHeaterManagement cluster. Defaults to 90.
   * @param {number} [voltage] - The voltage value in millivolts. Defaults to null if not provided.
   * @param {number} [current] - The current value in milliamperes. Defaults to null if not provided.
   * @param {number} [power] - The power value in milliwatts. Defaults to null if not provided.
   * @param {number} [energy] - The total consumption value in mW/h. Defaults to null if not provided.
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   */
  constructor(
    name: string,
    serial: string,
    waterTemperature = 50,
    targetWaterTemperature = 55,
    minHeatSetpointLimit = 20,
    maxHeatSetpointLimit = 80,
    heaterTypes: { immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean } = { immersionElement1: true },
    tankPercentage = 90,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energy: number | bigint | null = null,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ) {
    super([waterHeater, powerSource, electricalSensor], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Water Heater')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultHeatingThermostatClusterServer(waterTemperature, targetWaterTemperature, minHeatSetpointLimit, maxHeatSetpointLimit)
      .createDefaultWaterHeaterManagementClusterServer(heaterTypes, {}, tankPercentage)
      .createDefaultWaterHeaterModeClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energy)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.WaterHeating, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer();
  }

  /**
   * Creates a default WaterHeaterManagement Cluster Server.
   *
   * @param {{ immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean }} [heaterTypes] - Indicates the heat sources that the water heater can call on for heating. Defaults to { immersionElement1: true }.
   * @param {boolean} heaterTypes.immersionElement1 - Indicates if the water heater has an immersion element 1. Defaults to true.
   * @param {boolean} heaterTypes.immersionElement2 - Indicates if the water heater has an immersion element 2.
   * @param {boolean} heaterTypes.heatPump - Indicates if the water heater has a heat pump.
   * @param {boolean} heaterTypes.boiler - Indicates if the water heater has a boiler.
   * @param {boolean} heaterTypes.other - Indicates if the water heater has other types of heating sources.
   * @param {{ immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean }} [heatDemand] - Indicates if the water heater is heating water. Defaults to all heat sources unset.
   * @param {boolean} heatDemand.immersionElement1 - Indicates if the water heater is heating water with immersion element 1. Defaults to false.
   * @param {boolean} heatDemand.immersionElement2 - Indicates if the water heater is heating water with immersion element 2.
   * @param {boolean} heatDemand.heatPump - Indicates if the water heater is heating water with a heat pump.
   * @param {boolean} heatDemand.boiler - Indicates if the water heater is heating water with a boiler.
   * @param {boolean} heatDemand.other - Indicates if the water heater is heating water with other types of heating sources.
   * @param {number} [tankPercentage] - The current tank percentage of the WaterHeaterManagement cluster. Defaults to 100.
   * @param {WaterHeaterManagement.BoostState} [boostState] - The current boost state of the WaterHeaterManagement cluster. Defaults to Inactive.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultWaterHeaterManagementClusterServer(
    heaterTypes?: { immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean },
    heatDemand?: { immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean },
    tankPercentage?: number,
    boostState?: WaterHeaterManagement.BoostState,
  ): this {
    this.behaviors.require(MatterbridgeWaterHeaterManagementServer.with(WaterHeaterManagement.Feature.TankPercent), {
      heaterTypes: heaterTypes ?? { immersionElement1: true }, // Fixed attribute
      heatDemand: heatDemand ?? {},
      tankPercentage: tankPercentage ?? 100,
      boostState: boostState ?? WaterHeaterManagement.BoostState.Inactive,
    });
    return this;
  }

  /**
   * Creates a default WaterHeaterMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the WaterHeaterMode cluster. Defaults to mode 1 (WaterHeaterMode.ModeTag.Auto).
   * @param {WaterHeaterMode.ModeOption[]} [supportedModes] - The supported modes for the WaterHeaterMode cluster. Defaults all cluster modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultWaterHeaterModeClusterServer(currentMode?: number, supportedModes?: WaterHeaterMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeWaterHeaterModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Auto', mode: 1, modeTags: [{ value: WaterHeaterMode.ModeTag.Auto }] },
        { label: 'Quick', mode: 2, modeTags: [{ value: WaterHeaterMode.ModeTag.Quick }] },
        { label: 'Quiet', mode: 3, modeTags: [{ value: WaterHeaterMode.ModeTag.Quiet }] },
        { label: 'LowNoise', mode: 4, modeTags: [{ value: WaterHeaterMode.ModeTag.LowNoise }] },
        { label: 'LowEnergy', mode: 5, modeTags: [{ value: WaterHeaterMode.ModeTag.LowEnergy }] },
        { label: 'Vacation', mode: 6, modeTags: [{ value: WaterHeaterMode.ModeTag.Vacation }] },
        { label: 'Min', mode: 7, modeTags: [{ value: WaterHeaterMode.ModeTag.Min }] },
        { label: 'Max', mode: 8, modeTags: [{ value: WaterHeaterMode.ModeTag.Max }] },
        { label: 'Night', mode: 9, modeTags: [{ value: WaterHeaterMode.ModeTag.Night }] },
        { label: 'Day', mode: 10, modeTags: [{ value: WaterHeaterMode.ModeTag.Day }] },
        { label: 'Off', mode: 11, modeTags: [{ value: WaterHeaterMode.ModeTag.Off }] },
        { label: 'Manual', mode: 12, modeTags: [{ value: WaterHeaterMode.ModeTag.Manual }] },
        { label: 'Timed', mode: 13, modeTags: [{ value: WaterHeaterMode.ModeTag.Timed }] },
      ], // Fixed attribute
      currentMode: currentMode ?? 1,
    });
    return this;
  }
}

export class MatterbridgeWaterHeaterManagementServer extends WaterHeaterManagementServer {
  override boost(request: WaterHeaterManagement.BoostRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Boost (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('boost', { request, cluster: WaterHeaterManagementServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeWaterHeaterManagementServer boost called with: ${JSON.stringify(request)}`);
    this.state.boostState = WaterHeaterManagement.BoostState.Active;
    // The implementation is responsible for setting the device accordingly with the boostInfo of the boost command
    // super.boost({ boostInfo });
    // boost is not implemented in matter.js
  }

  override cancelBoost(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Cancel boost (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('cancelBoost', { request: {}, cluster: WaterHeaterManagementServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeWaterHeaterManagementServer cancelBoost called`);
    this.state.boostState = WaterHeaterManagement.BoostState.Inactive;
    // The implementation is responsible for setting the device accordingly with the cancelBoost command
    // super.cancelBoost();
    // cancelBoost is not implemented in matter.js
  }
}

export class MatterbridgeWaterHeaterModeServer extends WaterHeaterModeServer {
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: WaterHeaterModeServer.id, attributes: this.state, endpoint: this.endpoint });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    if (!supported) {
      device.log.error(`MatterbridgeWaterHeaterModeServer changeToMode called with unsupported newMode: ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    this.state.currentMode = request.newMode;
    device.log.debug(`MatterbridgeWaterHeaterModeServer changeToMode called with newMode ${request.newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
