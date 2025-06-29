/**
 * @description This file contains the HeatPump class.
 * @file heatPump.ts
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-06-14
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

// @matter
import { PowerSourceTag } from '@matter/main';
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { deviceEnergyManagement, electricalSensor, powerSource, heatPump } from './matterbridgeDeviceTypes.js';

export class HeatPump extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the HeatPump class.
   *
   * @param {string} name - The name of the HeatPump.
   * @param {string} serial - The serial number of the HeatPump.
   * @param {number} voltage - The voltage value in millivolts.
   * @param {number} current - The current value in milliamperes.
   * @param {number} power - The power value in milliwatts.
   * @param {number} energyImported - The total production value in mW/h.
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can produce when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can produce when switched on. Defaults to `0` if not provided.
   */
  constructor(
    name: string,
    serial: string,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energyImported: number | bigint | null = null,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ) {
    super(
      [heatPump, powerSource, electricalSensor, deviceEnergyManagement],
      {
        tagList: [{ mfgCode: null, namespaceId: PowerSourceTag.Grid.namespaceId, tag: PowerSourceTag.Grid.tag, label: null }],
        id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      },
      true,
    );
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Heat Pump')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energyImported)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.SpaceHeating, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
  }
}
