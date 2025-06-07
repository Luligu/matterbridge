/**
 * This file contains the Evse class.
 *
 * @file energy-evse.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @date 2025-05-27
 * @version 1.0.0
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
 * limitations under the License. *
 */

// @matter
import { MaybePromise } from '@matter/main';
import { EnergyEvseServer } from '@matter/main/behaviors/energy-evse';
import { EnergyEvseModeServer } from '@matter/main/behaviors/energy-evse-mode';
import { EnergyEvse, EnergyEvseMode } from '@matter/main/clusters';
import { ModeBase } from '@matter/main/clusters/mode-base';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { MatterbridgeServer } from './matterbridgeBehaviors.js';
import { deviceEnergyManagement, electricalSensor, evse, powerSource } from './matterbridgeDeviceTypes.js';

export class Evse extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the EVSE class.
   *
   * @param {string} name - The name of the EVSE.
   * @param {string} serial - The serial number of the EVSE.
   * @param {EnergyEvse.State} [state] - The current state of the EVSE. Defaults to NotPluggedIn.
   * @param {EnergyEvse.SupplyState} [supplyState] - The supply state of the EVSE. Defaults to Disabled.
   * @param {EnergyEvse.FaultState} [faultState] - The fault state of the EVSE. Defaults to NoError.
   */
  constructor(name: string, serial: string, state?: EnergyEvse.State, supplyState?: EnergyEvse.SupplyState, faultState?: EnergyEvse.FaultState) {
    super([evse, powerSource, electricalSensor, deviceEnergyManagement], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge EVSE')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer()
      .createDefaultElectricalEnergyMeasurementClusterServer()
      .createDefaultDeviceEnergyManagementCluster()
      .createDefaultEnergyEvseClusterServer(state, supplyState, faultState)
      .createDefaultEnergyEvseModeClusterServer()
      .addRequiredClusterServers();
  }

  /**
   * Creates a default EnergyEvseServer Cluster Server.
   *
   */
  createDefaultEnergyEvseClusterServer(state?: EnergyEvse.State, supplyState?: EnergyEvse.SupplyState, faultState?: EnergyEvse.FaultState): this {
    this.behaviors.require(MatterbridgeEnergyEvseServer, {
      state: state ?? EnergyEvse.State.NotPluggedIn,
      supplyState: supplyState ?? EnergyEvse.SupplyState.Disabled,
      faultState: faultState ?? EnergyEvse.FaultState.NoError,
      chargingEnabledUntil: 0, // Persistent attribute
      circuitCapacity: 0, // Persistent attribute
      minimumChargeCurrent: 6000, // Persistent attribute
      maximumChargeCurrent: 0, // Persistent attribute
      sessionId: null, // Persistent attribute
      sessionDuration: 0, // Persistent attribute
      sessionEnergyCharged: 0, // Persistent attribute
    });
    return this;
  }

  /**
   * Creates a default EnergyEvseMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the EnergyEvseMode cluster. Defaults to mode 1 (EnergyEvseMode.ModeTag.Auto).
   * @param {EnergyEvseMode.ModeOption[]} [supportedModes] - The supported modes for the EnergyEvseMode cluster. Defaults all cluster modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultEnergyEvseModeClusterServer(currentMode?: number, supportedModes?: EnergyEvseMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeEnergyEvseModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Auto', mode: 1, modeTags: [{ value: EnergyEvseMode.ModeTag.Auto }] },
        { label: 'Quick', mode: 2, modeTags: [{ value: EnergyEvseMode.ModeTag.Quick }] },
        { label: 'Quiet', mode: 3, modeTags: [{ value: EnergyEvseMode.ModeTag.Quiet }] },
        { label: 'LowNoise', mode: 4, modeTags: [{ value: EnergyEvseMode.ModeTag.LowNoise }] },
        { label: 'LowEnergy', mode: 5, modeTags: [{ value: EnergyEvseMode.ModeTag.LowEnergy }] },
        { label: 'Vacation', mode: 6, modeTags: [{ value: EnergyEvseMode.ModeTag.Vacation }] },
        { label: 'Min', mode: 7, modeTags: [{ value: EnergyEvseMode.ModeTag.Min }] },
        { label: 'Max', mode: 8, modeTags: [{ value: EnergyEvseMode.ModeTag.Max }] },
        { label: 'Night', mode: 9, modeTags: [{ value: EnergyEvseMode.ModeTag.Night }] },
        { label: 'Day', mode: 10, modeTags: [{ value: EnergyEvseMode.ModeTag.Day }] },
        { label: 'Manual', mode: 11, modeTags: [{ value: EnergyEvseMode.ModeTag.Manual }] },
        { label: 'TimeOfUse', mode: 12, modeTags: [{ value: EnergyEvseMode.ModeTag.TimeOfUse }] },
        { label: 'SolarCharging', mode: 13, modeTags: [{ value: EnergyEvseMode.ModeTag.SolarCharging }] },
        { label: 'V2X', mode: 14, modeTags: [{ value: EnergyEvseMode.ModeTag.V2X }] },
      ],
      currentMode: currentMode ?? 1,
    });
    return this;
  }
}

export class MatterbridgeEnergyEvseServer extends EnergyEvseServer {
  override disable(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.disable();
    device.log.info(`MatterbridgeEnergyEvseServer disable called`);
  }
  override enableCharging(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.enableCharging();
    device.log.info(`MatterbridgeEnergyEvseServer enableCharging called`);
  }
}

export class MatterbridgeEnergyEvseModeServer extends EnergyEvseModeServer {
  override changeToMode({ newMode }: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const supported = this.state.supportedModes.find((mode) => mode.mode === newMode);
    if (!supported) {
      device.log.error(`MatterbridgeEnergyEvseModeServer changeToMode called with unsupported newMode: ${newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    device.changeToMode({ newMode });
    this.state.currentMode = newMode;
    device.log.info(`MatterbridgeEnergyEvseModeServer changeToMode called with newMode ${newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
