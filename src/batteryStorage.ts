/**
 * This file contains the BatteryStorage class.
 *
 * @file batteryStorage.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @date 2025-06-20
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
import { PowerSourceTag } from 'matterbridge/matter';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { deviceEnergyManagement, electricalSensor, batteryStorage, powerSource } from './matterbridgeDeviceTypes.js';

export class BatteryStorage extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the BatteryStorage class.
   *
   * @param {string} name - The name of the BatteryStorage.
   * @param {string} serial - The serial number of the BatteryStorage.
   * @param {number} voltage - The voltage value in millivolts.
   * @param {number} current - The current value in milliamperes.
   * @param {number} power - The power value in milliwatts.
   * @param {number} energyImpported - The total production value in mW/h.
   * @param {number} energyExported - The total production value in mW/h.
   * @param {number} [absMinPower=0] - Indicate the minimum electrical power that the ESA can produce when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower=0] - Indicate the maximum electrical power that the ESA can produce when switched on. Defaults to `0` if not provided.
   * @param {number} [batPercentRemaining=100] - The percentage of battery remaining, defaults to `100` if not provided.
   * @param {number} [batVoltage=48000] - The battery voltage in millivolts, defaults to `48000` (48V) if not provided.
   * @param {PowerSource.BatChargeLevel} [batChargeLevel=] - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   */
  constructor(
    name: string,
    serial: string,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energyImpported: number | bigint | null = null,
    energyExported: number | bigint | null = null,
    absMinPower?: number,
    absMaxPower?: number,
    batPercentRemaining?: number,
    // batVoltage: number | bigint | null = null,
    // batChargeLevel: number | bigint | null = null,
  ) {
    super(
      [batteryStorage, powerSource, electricalSensor, deviceEnergyManagement],
      {
        tagList: [
          { mfgCode: null, namespaceId: PowerSourceTag.Battery.namespaceId, tag: PowerSourceTag.Battery.tag, label: PowerSourceTag.Battery.label },
          { mfgCode: null, namespaceId: PowerSourceTag.Grid.namespaceId, tag: PowerSourceTag.Grid.tag, label: PowerSourceTag.Grid.label },
        ],
        uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      },
      true,
    );
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Solar Power')
      .createDefaultPowerSourceWiredRechargeableBatteryClusterServer(batPercentRemaining, 1, 48000, null, null, undefined)
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energyImpported, energyExported)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.BatteryStorage, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .addRequiredClusterServers();
  }
}
