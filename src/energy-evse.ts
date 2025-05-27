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

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { evse } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEnergyEvseServer, MatterbridgeEnergyEvseModeServer } from './matterbridgeBehaviors.js';

// Matter.js
import { EnergyEvse, EnergyEvseMode } from '@matter/main/clusters';

export class Evse extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the EVSE class.
   *
   * @param {string} name - The name of the EVSE.
   * @param {string} serial - The serial number of the EVSE.
   * @param {number} [circuitCapacity=0] - The capacity that the circuit that the EVSE is connected to can provide.. Defaults to 0.
   * @param {number} [minimumChargeCurrent=6000] - Minimum current that can be delivered by the EVSE to the EV. Defaults to 6000mA.
   * @param {number} [maximumChargeCurrent=] - Maximum current that can be delivered by the EVSE to the EV. Defaults to 0mA.
   */
  constructor(name: string, serial: string, circuitCapacity = 0, minimumChargeCurrent = 6000, maximumChargeCurrent = 0) {
    super(evse, { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge EVSE')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultEnergyEvseClusterServer(circuitCapacity, minimumChargeCurrent, maximumChargeCurrent)
      .createDefaultEnergyEvseModeClusterServer();
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
    sessionId?: null,
  ): this {
    this.behaviors.require(MatterbridgeEnergyEvseServer, {
      state: state ?? EnergyEvse.State.NotPluggedIn,
      supplyState: supplyState ?? EnergyEvse.SupplyState.ChargingEnabled,
      faultState: faultState ?? EnergyEvse.FaultState.NoError,
      chargingEnabledUntil: chargingEnabledUntil ?? 0,
      circuitCapacity: circuitCapacity ?? 0,
      minimumChargeCurrent: minimumChargeCurrent ?? 6000,
      maximumChargeCurrent: maximumChargeCurrent ?? 0,
      sessionId: null,
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
