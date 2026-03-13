/**
 * @description This file contains the Evse class.
 * @file src/devices/energy-evse.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-05-27
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
import { MaybePromise } from '@matter/general';
import { EnergyEvseServer } from '@matter/node/behaviors/energy-evse';
import { EnergyEvseModeServer } from '@matter/node/behaviors/energy-evse-mode';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { ModeBase } from '@matter/types/clusters/mode-base';

// Matterbridge
import { MatterbridgeServer } from '../matterbridgeBehaviorsServer.js';
import { deviceEnergyManagement, electricalSensor, evse, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Matterbridge endpoint representing an EVSE (electric vehicle supply equipment).
 */
export class Evse extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the EVSE class.
   *
   * @param {string} name - The name of the EVSE.
   * @param {string} serial - The serial number of the EVSE.
   * @param {number} [currentMode] - The current mode of the EnergyEvseMode cluster. Defaults to mode 1 (EnergyEvseMode.ModeTag.Manual).
   * @param {EnergyEvseMode.ModeOption[]} [supportedModes] - The supported modes for the EnergyEvseMode cluster. This is a fixed attribute that defaults to a predefined set of EnergyEvseMode cluster modes.
   * @param {EnergyEvse.State} [state] - The current state of the EVSE. Defaults to NotPluggedIn.
   * @param {EnergyEvse.SupplyState} [supplyState] - The supply state of the EVSE. Defaults to Disabled.
   * @param {EnergyEvse.FaultState} [faultState] - The fault state of the EVSE. Defaults to NoError.
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
    currentMode?: number,
    supportedModes?: EnergyEvseMode.ModeOption[],
    state?: EnergyEvse.State,
    supplyState?: EnergyEvse.SupplyState,
    faultState?: EnergyEvse.FaultState,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energy: number | bigint | null = null,
    absMinPower?: number,
    absMaxPower?: number,
  ) {
    super([evse], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Evse')
      .createDefaultEnergyEvseClusterServer(state, supplyState, faultState)
      .createDefaultEnergyEvseModeClusterServer(currentMode, supportedModes)
      .createDefaultTemperatureMeasurementClusterServer(24_00) // Internal temperature 24°C in centi-degrees
      .addRequiredClusterServers();
    this.addFixedLabel('composed', 'EVSE');
    this.addChildDeviceType('PowerSource', powerSource).createDefaultPowerSourceWiredClusterServer().addRequiredClusterServers();
    this.addChildDeviceType('ElectricalSensor', electricalSensor)
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energy, 0)
      .addRequiredClusterServers();
    this.addChildDeviceType('DeviceEnergyManagement', deviceEnergyManagement)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Evse, false, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
  }

  /**
   * Creates a default EnergyEvseServer Cluster Server.
   *
   * @param {EnergyEvse.State} [state] - The initial state of the EnergyEvse cluster. Defaults to EnergyEvse.State.NotPluggedIn.
   * @param {EnergyEvse.SupplyState} [supplyState] - The initial supply state of the EnergyEvse cluster. Defaults to EnergyEvse.SupplyState.ChargingEnabled.
   * @param {EnergyEvse.FaultState} [faultState] - The initial fault state of the EnergyEvse cluster. Defaults to EnergyEvse.FaultState.NoError.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultEnergyEvseClusterServer(state?: EnergyEvse.State, supplyState?: EnergyEvse.SupplyState, faultState?: EnergyEvse.FaultState): this {
    this.behaviors.require(MatterbridgeEnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences), {
      state: state !== undefined ? state : EnergyEvse.State.NotPluggedIn,
      supplyState: supplyState !== undefined ? supplyState : EnergyEvse.SupplyState.ChargingEnabled,
      faultState: faultState !== undefined ? faultState : EnergyEvse.FaultState.NoError,
      chargingEnabledUntil: null, // Persistent attribute. A null value indicates the EVSE is always enabled for charging.
      circuitCapacity: 32_000, // Persistent attribute in mA. 32A in mA.
      minimumChargeCurrent: 6_000, // Persistent attribute in mA. 6A in mA.
      maximumChargeCurrent: 32_000, // Persistent attribute in mA. 32A in mA.
      userMaximumChargeCurrent: 32_000, // Persistent attribute in mA. 32A in mA.
      sessionId: null, // Persistent attribute
      sessionDuration: null, // Persistent attribute
      sessionEnergyCharged: null, // Persistent attribute
    });
    return this;
  }

  /**
   * Creates a default EnergyEvseMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the EnergyEvseMode cluster. Defaults to mode 1 (EnergyEvseMode.ModeTag.Manual).
   * @param {EnergyEvseMode.ModeOption[]} [supportedModes] - The supported modes for the EnergyEvseMode cluster. Defaults all EnergyEvseMode cluster modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultEnergyEvseModeClusterServer(currentMode?: number, supportedModes?: EnergyEvseMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeEnergyEvseModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'On demand', mode: 1, modeTags: [{ value: EnergyEvseMode.ModeTag.Manual }] },
        { label: 'Scheduled', mode: 2, modeTags: [{ value: EnergyEvseMode.ModeTag.TimeOfUse }] },
        { label: 'Solar charging', mode: 3, modeTags: [{ value: EnergyEvseMode.ModeTag.SolarCharging }] },
        // { label: 'Home to vehicle and Vehicle to home', mode: 4, modeTags: [{ value: EnergyEvseMode.ModeTag.V2X }] }, // This mode is not valid in charging only EVSEs
      ], // FixedAttribute
      currentMode: currentMode ?? 1, // Persistent attribute
    });
    return this;
  }
}

/**
 * Energy EVSE server that forwards charging commands and updates supply/state attributes.
 */
export class MatterbridgeEnergyEvseServer extends EnergyEvseServer.with(EnergyEvse.Feature.ChargingPreferences) {
  /**
   * Disables charging and updates EVSE state.
   */
  override disable(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Disable charging (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('disable', { request: {}, cluster: EnergyEvseServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeEnergyEvseServer disable called`);
    this.state.supplyState = EnergyEvse.SupplyState.Disabled;
    if (this.state.state === EnergyEvse.State.PluggedInCharging) {
      this.state.state = EnergyEvse.State.PluggedInDemand;
    }
    // super.disable();
    // disable is not implemented in matter.js
  }
  /**
   * Handles the EnergyEvse `EnableCharging` command.
   *
   * @param {EnergyEvse.EnableChargingRequest} request - Charging enable request payload.
   */
  override enableCharging(request: EnergyEvse.EnableChargingRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`EnableCharging (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('enableCharging', { request, cluster: EnergyEvseServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeEnergyEvseServer enableCharging called`);
    this.state.supplyState = EnergyEvse.SupplyState.ChargingEnabled;
    if (this.state.state === EnergyEvse.State.PluggedInDemand) {
      this.state.state = EnergyEvse.State.PluggedInCharging;
    }
    this.state.chargingEnabledUntil = request.chargingEnabledUntil;
    this.state.minimumChargeCurrent = request.minimumChargeCurrent;
    this.state.maximumChargeCurrent = request.maximumChargeCurrent;
    // The implementation should also stop the charging session at the required time and update the sessionId, sessionDuration, and sessionEnergyCharged attributes if needed.
    // super.enableCharging();
    // enableCharging is not implemented in matter.js
  }
  /**
   * Handles the EnergyEvse `SetTargets` command.
   *
   * @param {EnergyEvse.SetTargetsRequest} request - Charging target schedules request payload.
   */
  override setTargets(request: EnergyEvse.SetTargetsRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTargets request ${request.chargingTargetSchedules} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The implementation should store the provided charging targets and use them to manage the charging process according to the user's preferences.
    // super.setTargets();
    // setTargets is not implemented in matter.js
    return;
  }
  /**
   * Handles the EnergyEvse `GetTargets` command.
   *
   * @returns {EnergyEvse.GetTargetsResponse} Stored charging target schedules.
   */
  override getTargets(): MaybePromise<EnergyEvse.GetTargetsResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`GetTargets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The implementation should retrieve the currently stored charging targets and return them in the response.
    // return super.getTargets();
    // getTargets is not implemented in matter.js
    return { chargingTargetSchedules: [] };
  }
  /**
   * Handles the EnergyEvse `ClearTargets` command.
   *
   * @returns {void} No return value.
   */
  override clearTargets(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`ClearTargets (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // The implementation should clear all stored charging targets and stop any ongoing charging sessions that were scheduled based on those targets.
    // super.clearTargets();
    // clearTargets is not implemented in matter.js
    return;
  }
}

/**
 * Energy EVSE mode server that validates and applies mode changes.
 */
export class MatterbridgeEnergyEvseModeServer extends EnergyEvseModeServer {
  /**
   * Handles the EnergyEvseMode `ChangeToMode` command.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: EnergyEvseModeServer.id, attributes: this.state, endpoint: this.endpoint });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    if (!supported) {
      device.log.error(`MatterbridgeEnergyEvseModeServer changeToMode called with unsupported newMode: ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    this.state.currentMode = request.newMode;
    device.log.debug(`MatterbridgeEnergyEvseModeServer changeToMode called with newMode ${request.newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
