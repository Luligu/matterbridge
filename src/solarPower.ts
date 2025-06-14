/**
 * This file contains the SolarPower class.
 *
 * @file solarPower.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @date 2025-06-13
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
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { deviceEnergyManagement, electricalSensor, solarPower, powerSource } from './matterbridgeDeviceTypes.js';

export class SolarPower extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the SolarPower class.
   *
   * @param {string} name - The name of the SolarPower.
   * @param {string} serial - The serial number of the SolarPower.
   * @param {number} voltage - The voltage value in millivolts.
   * @param {number} current - The current value in milliamperes.
   * @param {number} power - The power value in milliwatts.
   * @param {number} energyExported - The total production value in mW/h.
   * @param {number} [absMinPower=0] - Indicate the minimum electrical power that the ESA can produce when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower=0] - Indicate the maximum electrical power that the ESA can produce when switched on. Defaults to `0` if not provided.
   */
  constructor(name: string, serial: string, voltage: number | bigint | null = null, current: number | bigint | null = null, power: number | bigint | null = null, energyExported: number | bigint | null = null, absMinPower?: number, absMaxPower?: number) {
    super([solarPower, powerSource, electricalSensor, deviceEnergyManagement], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Solar Power')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(0, energyExported)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.SolarPv, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .addRequiredClusterServers();
  }
}
