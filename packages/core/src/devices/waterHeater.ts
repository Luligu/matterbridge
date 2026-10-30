/**
 * @file packages/core/src/devices/waterHeater.ts
 * @description This file contains the WaterHeater class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-05-18
 * @version 1.3.0
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

/* oxlint-disable typescript/no-namespace */
/* oxlint-disable typescript/no-unsafe-type-assertion */

// @matter
import { Seconds, Time, type Timer } from '@matter/general';
import { WaterHeaterManagementServer } from '@matter/node/behaviors/water-heater-management';
import { WaterHeaterModeServer } from '@matter/node/behaviors/water-heater-mode';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/types/clusters/water-heater-mode';
import type { EndpointNumber } from '@matter/types/datatype';
import type { Semtag } from '@matter/types/globals';
// @matterbridge
import { fireAndForget } from '@matterbridge/utils/wait';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeThermostatServer } from '../behaviors/thermostatServer.js';
import { deviceEnergyManagement, electricalSensor, powerSource, waterHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/** Available heating sources for a water heater. */
export interface WaterHeaterTypes {
  /** Indicates if the water heater has an immersion element 1. */
  immersionElement1?: boolean;
  /** Indicates if the water heater has an immersion element 2. */
  immersionElement2?: boolean;
  /** Indicates if the water heater has a heat pump. */
  heatPump?: boolean;
  /** Indicates if the water heater has a boiler. */
  boiler?: boolean;
  /** Indicates if the water heater has other types of heating sources. */
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
  /** Current water temperature in degrees Celsius. Defaults to `50`. */
  waterTemperature?: number;
  /** Target water temperature in degrees Celsius. Defaults to `55`. */
  targetWaterTemperature?: number;
  /** Minimum heat setpoint limit in degrees Celsius. Defaults to `20`. */
  minHeatSetpointLimit?: number;
  /** Maximum heat setpoint limit in degrees Celsius. Defaults to `80`. */
  maxHeatSetpointLimit?: number;
  /** Available heating sources for the water heater. Defaults to `{ immersionElement1: true }`. */
  heaterTypes?: WaterHeaterTypes;
  /** Current tank percentage of the WaterHeaterManagement cluster (0-100%). Defaults to `90`. */
  tankPercentage?: number;
  /** Volume of the hot water tank in litres (Matter 1.6.1 § 9.5.7.3). Defaults to `100`. */
  tankVolume?: number;
  /** Estimated heat energy needed to raise the water temperature to the target setpoint in mWh (Matter 1.6.1 § 9.5.7.4). Defaults to `0`. */
  estimatedHeatRequired?: number | bigint;
  /** Voltage in millivolts. Defaults to `null`. */
  voltage?: number | bigint | null;
  /** Current in milliamperes. Defaults to `null`. */
  current?: number | bigint | null;
  /** Power in milliwatts. Defaults to `null`. */
  power?: number | bigint | null;
  /** Imported energy in mWh. Defaults to `null`. */
  energy?: number | bigint | null;
  /** Minimum electrical power in milliwatts that the ESA can consume when switched on. Defaults to `0`. */
  absMinPower?: number;
  /** Maximum electrical power in milliwatts that the ESA can consume when switched on. Defaults to `0`. */
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
   * @param {WaterHeaterOptions} [options] - Endpoint and initial water heater configuration.
   */
  constructor(name: string, serial: string, options?: WaterHeaterOptions);

  /**
   * Creates an instance using the legacy positional configuration.
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
   * @param {number | bigint | null} [voltage] - The voltage value in millivolts. Defaults to null if not provided.
   * @param {number | bigint | null} [current] - The current value in milliamperes. Defaults to null if not provided.
   * @param {number | bigint | null} [power] - The power value in milliwatts. Defaults to null if not provided.
   * @param {number | bigint | null} [energy] - The total consumption value in mW/h. Defaults to null if not provided.
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @deprecated Pass a {@link WaterHeaterOptions} object as the third argument instead.
   */
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
      .createDefaultWaterHeaterManagementClusterServer(
        options.heaterTypes ?? { immersionElement1: true },
        {},
        options.tankPercentage ?? 90,
        undefined,
        options.tankVolume ?? 100,
        options.estimatedHeatRequired ?? 0,
      )
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
   * @param {number} [tankVolume] - The volume of the hot water tank in litres (Matter 1.6.1 § 9.5.7.3). Defaults to `100` if not provided.
   * @param {number | bigint} [estimatedHeatRequired] - The estimated heat energy needed to raise the water temperature to the target setpoint, in mWh (Matter 1.6.1 § 9.5.7.4). Defaults to `0` if not provided.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultWaterHeaterManagementClusterServer(
    heaterTypes?: { immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean },
    heatDemand?: { immersionElement1?: boolean; immersionElement2?: boolean; heatPump?: boolean; boiler?: boolean; other?: boolean },
    tankPercentage?: number,
    boostState?: WaterHeaterManagement.BoostState,
    tankVolume?: number,
    estimatedHeatRequired?: number | bigint,
  ): this {
    // Matter 1.6.1 Device Library § 14.2.6: EnergyManagement is mandatory when the DeviceEnergyManagement device type is included.
    this.behaviors.require(MatterbridgeWaterHeaterManagementServer.with(WaterHeaterManagement.Feature.TankPercent, WaterHeaterManagement.Feature.EnergyManagement), {
      heaterTypes: heaterTypes ?? { immersionElement1: true }, // Fixed attribute
      heatDemand: heatDemand ?? {},
      tankPercentage: tankPercentage ?? 100,
      boostState: boostState ?? WaterHeaterManagement.BoostState.Inactive,
      tankVolume: tankVolume ?? 100,
      estimatedHeatRequired: estimatedHeatRequired ?? 0,
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
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  declare protected internal: MatterbridgeWaterHeaterManagementServer.Internal;

  /**
   * Handles the WaterHeaterManagement `Boost` command.
   *
   * @param {WaterHeaterManagement.BoostRequest} request - Boost request payload.
   * @returns {Promise<void>} Resolves after forwarding the command and updating the boost state.
   */
  override async boost(request: WaterHeaterManagement.BoostRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterHeaterManagementServer: boost (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterHeaterManagement.boost', {
      command: 'boost',
      request,
      cluster: WaterHeaterManagementServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WaterHeaterManagement)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWaterHeaterManagementServer: boost called with: ${JSON.stringify(request)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.internal.boostExpiryTimer?.stop();
    // WaterHeaterBoostInfoStruct's OneShot and EmergencyBoost fields declare a model-level `default: false`
    // (@matter/model's water-heater-management.element.ts), and ClassForValueModel.initialize() applies those
    // defaults before overlaying caller-provided keys. Explicitly normalize false/omitted to `undefined` so the
    // BoostStarted event only carries OneShot/EmergencyBoost when set to true (matching TC_EWATERHTR_2_2/2_3).
    const boostInfo: WaterHeaterManagement.WaterHeaterBoostInfo = {
      duration: request.boostInfo.duration,
      oneShot: request.boostInfo.oneShot === true ? true : undefined,
      emergencyBoost: request.boostInfo.emergencyBoost === true ? true : undefined,
      temporarySetpoint: request.boostInfo.temporarySetpoint,
      targetPercentage: request.boostInfo.targetPercentage,
      targetReheat: request.boostInfo.targetReheat,
    };
    this.internal.activeBoostInfo = boostInfo;
    this.internal.boostTargetReached = false;
    // Matter 1.6.0 § 9.5.8.1.1: Transition BoostState to Active when the Boost command succeeds.
    this.state.boostState = WaterHeaterManagement.BoostState.Active;
    // Matter 1.6.0 § 9.5.8.1.1: Heat the water in the tank while the boost condition is not yet met.
    this.#updateHeatDemand();
    // Matter 1.6.0 § 9.5.8.1.1 and § 9.5.9.1: Generate BoostStarted with the field values received in the Boost command.
    this.events.boostStarted.emit({ boostInfo }, this.context);
    // Matter 1.6.0 § 9.5.8.1.1: Transition BoostState to Inactive and generate BoostEnded when the boost duration expires.
    this.internal.boostExpiryTimer = Time.getTimer(
      'WaterHeaterManagement boost expiry',
      Seconds(request.boostInfo.duration),
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#expireBoost, { lock: true }),
    ).start();
    this.endpoint.emitCommand(WaterHeaterManagement, 'boost', request, this.context);
  }

  /**
   * Cancels an active boost.
   *
   * @returns {Promise<void>} Resolves after forwarding the command and updating the boost state.
   */
  override async cancelBoost(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterHeaterManagementServer: cancel boost (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterHeaterManagement.cancelBoost', {
      command: 'cancelBoost',
      request: {},
      cluster: WaterHeaterManagementServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WaterHeaterManagement)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWaterHeaterManagementServer: cancelBoost called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.internal.boostExpiryTimer?.stop();
    this.internal.boostExpiryTimer = undefined;
    this.internal.activeBoostInfo = undefined;
    this.internal.boostTargetReached = false;
    // Matter 1.6.0 § 9.5.8.2.1: If BoostState was Active, transition BoostState to Inactive, generate BoostEnded, and revert heating to the current Water Heater Mode.
    if (this.state.boostState === WaterHeaterManagement.BoostState.Active) {
      // Matter 1.6.0 § 9.5.8.2.1: Transition BoostState to Inactive when CancelBoost cancels an active boost.
      this.state.boostState = WaterHeaterManagement.BoostState.Inactive;
      // Matter 1.6.0 § 9.5.8.2.1: Revert water heating to the current Water Heater Mode when the boost ends.
      this.#updateHeatDemand();
      // Matter 1.6.0 § 9.5.8.2.1 and § 9.5.9.2: Generate BoostEnded when BoostState transitions from Active to Inactive.
      this.events.boostEnded.emit(undefined, this.context);
    }
    this.endpoint.emitCommand(WaterHeaterManagement, 'cancelBoost', {}, this.context);
  }

  /**
   * Re-evaluates boost completion and heat demand after a water temperature, tank percentage, or mode change.
   */
  evaluateWaterHeaterState(): void {
    const boostInfo = this.internal.activeBoostInfo;
    if (this.state.boostState === WaterHeaterManagement.BoostState.Active && boostInfo && this.#isBoostTargetMet(boostInfo)) {
      this.internal.boostTargetReached = true;
      // Matter 1.6.0 § 9.5.6.3.2 and § 9.5.8.1.1: Automatically cancel the boost once the target is reached when OneShot is true.
      if (boostInfo.oneShot) {
        this.#expireBoost();
        return;
      }
    }
    this.#updateHeatDemand();
  }

  #expireBoost(): void {
    this.internal.boostExpiryTimer?.stop();
    this.internal.boostExpiryTimer = undefined;
    this.internal.activeBoostInfo = undefined;
    this.internal.boostTargetReached = false;
    // Matter 1.6.0 § 9.5.8.1.1: Transition BoostState to Inactive when the boost duration expires or OneShot completes.
    this.state.boostState = WaterHeaterManagement.BoostState.Inactive;
    // Matter 1.6.0 § 9.5.8.1.1: Revert water heating to the current Water Heater Mode when the boost ends.
    this.#updateHeatDemand();
    // Matter 1.6.0 § 9.5.9.2: Generate BoostEnded when BoostState transitions from Active to Inactive.
    this.events.boostEnded.emit(undefined, this.context);
  }

  #isBoostTargetMet(boostInfo: WaterHeaterManagement.WaterHeaterBoostInfo): boolean {
    const state = this.state as Partial<WaterHeaterManagement.Attributes>;
    if (boostInfo.targetPercentage !== undefined && state.tankPercentage !== undefined) {
      return state.tankPercentage >= boostInfo.targetPercentage;
    }
    const thermostatState = this.endpoint.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating));
    /* v8 ignore next */
    const localTemperature = thermostatState.localTemperature ?? 0;
    const targetSetpoint = boostInfo.temporarySetpoint ?? thermostatState.occupiedHeatingSetpoint;
    return localTemperature >= targetSetpoint;
  }

  #updateHeatDemand(): void {
    const state = this.state as Partial<WaterHeaterManagement.Attributes>;
    const thermostatState = this.endpoint.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating));
    /* v8 ignore next */
    const localTemperature = thermostatState.localTemperature ?? 0;
    const modeState = this.endpoint.stateOf(MatterbridgeWaterHeaterModeServer);
    const isManualMode = modeState.supportedModes.some(
      (mode) => mode.mode === modeState.currentMode && mode.modeTags.some((tag) => tag.value === (WaterHeaterMode.ModeTag.Manual as number)),
    );
    let heatingRequired = isManualMode && localTemperature < thermostatState.occupiedHeatingSetpoint;
    const boostInfo = this.internal.activeBoostInfo;
    if (this.state.boostState === WaterHeaterManagement.BoostState.Active && boostInfo) {
      if (boostInfo.targetPercentage !== undefined && state.tankPercentage !== undefined) {
        const reheatThreshold = this.internal.boostTargetReached && boostInfo.targetReheat !== undefined ? boostInfo.targetReheat : boostInfo.targetPercentage;
        heatingRequired = heatingRequired || state.tankPercentage < reheatThreshold;
      } else {
        const targetSetpoint = boostInfo.temporarySetpoint ?? thermostatState.occupiedHeatingSetpoint;
        heatingRequired = heatingRequired || localTemperature < targetSetpoint;
      }
    }
    // Matter 1.6.0 § 9.5.7.2: Set HeatDemand to the active heat sources when heating water, or clear all bits when idle.
    this.state.heatDemand = heatingRequired
      ? {
          immersionElement1: this.state.heaterTypes.immersionElement1,
          immersionElement2: this.state.heaterTypes.immersionElement2,
          heatPump: this.state.heaterTypes.heatPump,
          boiler: this.state.heaterTypes.boiler,
          other: this.state.heaterTypes.other,
        }
      : {};
  }
}

/* v8 ignore start */
export namespace MatterbridgeWaterHeaterManagementServer {
  /**
   * Internal state for MatterbridgeWaterHeaterManagementServer.
   */
  export class Internal {
    activeBoostInfo: WaterHeaterManagement.WaterHeaterBoostInfo | undefined;
    boostTargetReached = false;
    boostExpiryTimer: Timer | undefined;
  }
}
/* v8 ignore stop */

/**
 * WaterHeaterMode server that validates and applies mode changes.
 */
export class MatterbridgeWaterHeaterModeServer extends WaterHeaterModeServer {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Handles the WaterHeaterMode `ChangeToMode` command.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {Promise<ModeBase.ChangeToModeResponse>} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWaterHeaterModeServer: changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WaterHeaterMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: WaterHeaterModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
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
    this.endpoint.emitCommand(WaterHeaterMode, 'changeToMode', request, this.context);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
