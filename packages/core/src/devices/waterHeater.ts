/**
 * @file packages/core/src/devices/waterHeater.ts
 * @description This file contains the WaterHeater class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-05-18
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

/* oxlint-disable typescript/no-unsafe-type-assertion */

// @matter
import { WaterHeaterManagementServer } from '@matter/node/behaviors/water-heater-management';
import { WaterHeaterModeServer } from '@matter/node/behaviors/water-heater-mode';
import type { EndpointNumber } from '@matter/types';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/types/clusters/water-heater-mode';
import type { Semtag } from '@matter/types/globals';
// Utils
import { fireAndForget } from '@matterbridge/utils/wait';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { deviceEnergyManagement, electricalSensor, powerSource, waterHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/** Available heating sources for a water heater. */
export interface WaterHeaterTypes {
  immersionElement1?: boolean;
  immersionElement2?: boolean;
  heatPump?: boolean;
  boiler?: boolean;
  other?: boolean;
}

/** Options for configuring a {@link WaterHeater} endpoint. */
export interface WaterHeaterOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  waterTemperature?: number;
  targetWaterTemperature?: number;
  minHeatSetpointLimit?: number;
  maxHeatSetpointLimit?: number;
  heaterTypes?: WaterHeaterTypes;
  tankPercentage?: number;
  voltage?: number | bigint | null;
  current?: number | bigint | null;
  power?: number | bigint | null;
  energy?: number | bigint | null;
  absMinPower?: number;
  absMaxPower?: number;
}

/**
 * Matterbridge endpoint representing a water heater device.
 */
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
  constructor(name: string, serial: string, options?: WaterHeaterOptions);

  /** @deprecated Pass a {@link WaterHeaterOptions} object as the third argument instead. */
  constructor(
    name: string,
    serial: string,
    waterTemperature?: number,
    targetWaterTemperature?: number,
    minHeatSetpointLimit?: number,
    maxHeatSetpointLimit?: number,
    heaterTypes?: WaterHeaterTypes,
    tankPercentage?: number,
    voltage?: number | bigint | null,
    current?: number | bigint | null,
    power?: number | bigint | null,
    energy?: number | bigint | null,
    absMinPower?: number,
    absMaxPower?: number,
  );

  constructor(
    name: string,
    serial: string,
    optionsOrWaterTemperature?: WaterHeaterOptions | number,
    targetWaterTemperature = 55,
    minHeatSetpointLimit = 20,
    maxHeatSetpointLimit = 80,
    heaterTypes: WaterHeaterTypes = { immersionElement1: true },
    tankPercentage = 90,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energy: number | bigint | null = null,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ) {
    const options: WaterHeaterOptions =
      typeof optionsOrWaterTemperature === 'object'
        ? optionsOrWaterTemperature
        : {
            waterTemperature: optionsOrWaterTemperature,
            targetWaterTemperature,
            minHeatSetpointLimit,
            maxHeatSetpointLimit,
            heaterTypes,
            tankPercentage,
            voltage,
            current,
            power,
            energy,
            absMinPower,
            absMaxPower,
          };
    super([waterHeater], { id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number: options.number, tagList: options.tagList, mode: options.mode });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Water Heater')
      .createDefaultHeatingThermostatClusterServer(
        options.waterTemperature ?? 50,
        options.targetWaterTemperature ?? 55,
        options.minHeatSetpointLimit ?? 20,
        options.maxHeatSetpointLimit ?? 80,
      )
      .createDefaultWaterHeaterManagementClusterServer(options.heaterTypes ?? { immersionElement1: true }, {}, options.tankPercentage ?? 90)
      .createDefaultWaterHeaterModeClusterServer();
    fireAndForget(this.addFixedLabel('composed', 'Water Heater'), this.log, 'WaterHeater addFixedLabel');
    this.addChildDeviceType('PowerSource', powerSource).createDefaultPowerSourceWiredClusterServer().addRequiredClusterServers();
    this.addChildDeviceType('ElectricalSensor', electricalSensor)
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(options.voltage ?? null, options.current ?? null, options.power ?? null)
      .createImportedElectricalEnergyMeasurementClusterServer(options.energy ?? null)
      .addRequiredClusterServers();
    this.addChildDeviceType('DeviceEnergyManagement', deviceEnergyManagement)
      .createDefaultDeviceEnergyManagementClusterServer(
        DeviceEnergyManagement.EsaType.WaterHeating,
        false,
        DeviceEnergyManagement.EsaState.Online,
        options.absMinPower ?? 0,
        options.absMaxPower ?? 0,
      )
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
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

/**
 * WaterHeaterManagement server that forwards boost commands and updates boost state.
 */
export class MatterbridgeWaterHeaterManagementServer extends WaterHeaterManagementServer {
  /**
   * Handles the WaterHeaterManagement `Boost` command.
   *
   * @param {WaterHeaterManagement.BoostRequest} request - Boost request payload.
   */
  override async boost(request: WaterHeaterManagement.BoostRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterHeaterManagementServer: boost (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterHeaterManagement.boost', {
      command: 'boost',
      request,
      cluster: WaterHeaterManagementServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WaterHeaterManagement)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWaterHeaterManagementServer: boost called with: ${JSON.stringify(request)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 9.5.8.1.1: Transition BoostState to Active when the Boost command succeeds.
    this.state.boostState = WaterHeaterManagement.BoostState.Active;
  }

  /**
   * Cancels an active boost.
   */
  override async cancelBoost(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterHeaterManagementServer: cancel boost (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterHeaterManagement.cancelBoost', {
      command: 'cancelBoost',
      request: {},
      cluster: WaterHeaterManagementServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WaterHeaterManagement)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWaterHeaterManagementServer: cancelBoost called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 9.5.8.2.1: Transition BoostState to Inactive when CancelBoost is received.
    this.state.boostState = WaterHeaterManagement.BoostState.Inactive;
  }
}

/**
 * WaterHeaterMode server that validates and applies mode changes.
 */
export class MatterbridgeWaterHeaterModeServer extends WaterHeaterModeServer {
  /**
   * Handles the WaterHeaterMode `ChangeToMode` command.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterHeaterModeServer: changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterHeaterMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: WaterHeaterModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    // Matter 1.6.0 § 1.10.7.1.1: Reject ChangeToMode with UnsupportedMode if NewMode matches no SupportedModes entry.
    if (!supported) {
      device.log.error(
        `MatterbridgeWaterHeaterModeServer: changeToMode called with unsupported newMode: ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: Set CurrentMode to NewMode when the transition succeeds.
    this.state.currentMode = request.newMode;
    device.log.debug(
      `MatterbridgeWaterHeaterModeServer: changeToMode called with newMode ${request.newMode} => ${supported.label} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
