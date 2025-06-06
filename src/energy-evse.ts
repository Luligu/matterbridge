/**
 * This file contains the EVSE class.
 *
 * @file energy-evse.ts
 * @author Luca Liguori
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

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { MatterbridgeServer } from './matterbridgeBehaviors.js';
import { evse } from './matterbridgeDeviceTypes.js';
import { EnergyEvseServer } from '@matter/main/behaviors/energy-evse';
import { EnergyEvseModeServer } from '@matter/main/behaviors/energy-evse-mode';

// Matter.js
import { EnergyEvse, EnergyEvseMode } from '@matter/main/clusters';
import { ModeBase } from '@matter/main/clusters/mode-base';

export class Evse extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the EVSE class.
   *
   * @param {string} name - The name of the EVSE.
   * @param {string} serial - The serial number of the EVSE.
   * @param {number} [circuitCapacity=0] - The capacity that the circuit that the EVSE is connected to can provide.. Defaults to 0.
   * @param {number} [minimumChargeCurrent=6000] - Minimum current that can be delivered by the EVSE to the EV. Defaults to 6000mA.
   * @param {number} [maximumChargeCurrent=6000] - Maximum current that can be delivered by the EVSE to the EV. Defaults to 0mA.
   * @param {number} [sessionId=undefined] - Unique identifier for the current or last session. Defaut to null.
   */
  constructor(name: string, serial: string, circuitCapacity = 0, minimumChargeCurrent = 6000, maximumChargeCurrent = 0, sessionId = undefined) {
    super(evse, { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge EVSE')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultEnergyEvseClusterServer(circuitCapacity, minimumChargeCurrent, maximumChargeCurrent, sessionId)
      .createDefaultEnergyEvseModeClusterServer()
      .createDefaultDeviceEnergyManagementCluster();
  }

  /**
   * Creates a default EnergyEvseServer Cluster Server.
   *
   */
  createDefaultEnergyEvseClusterServer(
    state?: EnergyEvse.State,
    supplyState?: EnergyEvse.SupplyState,
    faultState?: EnergyEvse.FaultState.NoError,
    chargingEnabledUntil?: 0,
    circuitCapacity?: 0,
    minimumChargeCurrent?: 6000,
    maximumChargeCurrent?: 0,
    sessionId?: undefined,
  ): this {
    this.behaviors.require(MatterbridgeEnergyEvseServer, {
      state: state ?? EnergyEvse.State.NotPluggedIn,
      supplyState: supplyState ?? EnergyEvse.SupplyState.ChargingEnabled,
      faultState: faultState ?? EnergyEvse.FaultState.NoError,
      chargingEnabledUntil: chargingEnabledUntil ?? 0,
      circuitCapacity: circuitCapacity ?? 0,
      minimumChargeCurrent: minimumChargeCurrent ?? 6000,
      maximumChargeCurrent: maximumChargeCurrent ?? 0,
      sessionId: sessionId ?? undefined,
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
        { label: 'V2X', mode: 13, modeTags: [{ value: EnergyEvseMode.ModeTag.V2X }] },
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
