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

// @matter
import { MaybePromise } from '@matter/general';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { EnergyEvseServer } from '@matter/node/behaviors/energy-evse';
import { EnergyEvseModeServer } from '@matter/node/behaviors/energy-evse-mode';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';
import { deviceEnergyManagement, electricalSensor, evse, powerSource } from '../matterbridgeDeviceTypes.js';

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
    super([evse, powerSource, electricalSensor, deviceEnergyManagement], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Evse')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energy, 0)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Evse, false, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .createDefaultEnergyEvseClusterServer(state, supplyState, faultState)
      .createDefaultEnergyEvseModeClusterServer(currentMode, supportedModes)
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
    this.behaviors.require(MatterbridgeEnergyEvseServer, {
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

export class MatterbridgeEnergyEvseServer extends EnergyEvseServer {
  override disable(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Disable charging (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('disable', { request: {}, cluster: EnergyEvseServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeEnergyEvseServer disable called`);
    this.state.supplyState = EnergyEvse.SupplyState.Disabled;
    if (this.state.state === EnergyEvse.State.PluggedInCharging) {
      this.state.state = EnergyEvse.State.PluggedInDemand;
    }
    this.state.chargingEnabledUntil = 0;
    // super.disable();
    // disable is not implemented in matter.js
  }
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
}

export class MatterbridgeEnergyEvseModeServer extends EnergyEvseModeServer {
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
