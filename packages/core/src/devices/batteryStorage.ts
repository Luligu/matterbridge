/**
 * @description This file contains the BatteryStorage class.
 * @file src/devices/batteryStorage.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-06-20
 * @version 1.0.0
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
import { ElectricalPowerMeasurementServer } from '@matter/main/behaviors/electrical-power-measurement';
import { ElectricalPowerMeasurement } from '@matter/main/clusters/electrical-power-measurement';
import { PowerSourceTag } from '@matter/node';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { PowerSource } from '@matter/types/clusters/power-source';

// Matterbridge
import { batteryStorage, deviceEnergyManagement, electricalSensor, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { getDefaultElectricalPowerMeasurementClusterServer, getSemtag } from '../matterbridgeEndpointHelpers.js';

/**
 * Matterbridge endpoint representing a battery storage device.
 */
export class BatteryStorage extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the BatteryStorage class.
   *
   * @param {string} name - The name of the BatteryStorage.
   * @param {string} serial - The serial number of the BatteryStorage.
   * @param {number} [batPercentRemaining] - The percentage of battery remaining, defaults to `100` if not provided.
   * @param {PowerSource.BatChargeLevel} [batChargeLevel] - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param {number} voltage - The voltage value in millivolts.
   * @param {number} current - The current value in milliamperes.
   * @param {number} power - The power value in milliwatts.
   * @param {number} energyImported - The total production value in mW/h.
   * @param {number} energyExported - The total production value in mW/h.
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   *
   * @remarks
   * - A battery storage inverter that can charge its battery at a maximum power of 2000W and can
   * discharge the battery at a maximum power of 3000W, would have a absMinPower: -3000W, absMaxPower: 2000W.
   */
  constructor(
    name: string,
    serial: string,
    batPercentRemaining: number = 100,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energyImported: number | bigint | null = null,
    energyExported: number | bigint | null = null,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ) {
    super([batteryStorage, powerSource, electricalSensor, deviceEnergyManagement], {
      id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      tagList: [getSemtag(PowerSourceTag.Grid)],
    });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Battery Storage')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energyImported, energyExported)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.BatteryStorage, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
    this.addFixedLabel('composed', 'Battery Storage');

    const battery = this.addChildDeviceType('Battery', [powerSource, electricalSensor], {
      tagList: [getSemtag(PowerSourceTag.Battery)],
    })
      .createDefaultPowerSourceRechargeableBatteryClusterServer(batPercentRemaining, batChargeLevel, 24_000) // Battery voltage in mV (24V).
      .createDefaultPowerTopologyClusterServer()
      // .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energyImported, energyExported);
    battery.behaviors.require(
      ElectricalPowerMeasurementServer.with(ElectricalPowerMeasurement.Feature.DirectCurrent),
      getDefaultElectricalPowerMeasurementClusterServer(voltage, current, power),
    );
  }
}
