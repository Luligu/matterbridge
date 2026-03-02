/**
 * @description This file contains the SolarPower class.
 * @file src/devices/solarPower.ts
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

// Imports from @matter
import { NumberTag, PowerSourceTag } from '@matter/node';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';

// Matterbridge
import { deviceEnergyManagement, electricalSensor, powerSource, solarPower } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

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
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   */
  constructor(
    name: string,
    serial: string,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energyExported: number | bigint = 0,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ) {
    super([solarPower, powerSource, electricalSensor, deviceEnergyManagement], {
      tagList: [{ mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Solar.tag, label: null }],
      id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
    });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Solar Power')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(0, energyExported)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.SolarPv, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
  }

  /**
   * Helper method to add a solar panel as child device with the appropriate clusters and tags.
   * The tag parameter is used to disambiguate the panels and should be unique for each panel (e.g. 1, 2, 3, 4).
   *
   * @param {string} name - The name of the solar panel.
   * @param {number} tag - The unique tag for the solar panel.
   * @param {number | bigint | null} [voltage] - The voltage value in millivolts. Defaults to null if not provided.
   * @param {number | bigint | null} [current] - The current value in milliamps. Defaults to null if not provided.
   * @param {number | bigint | null} [power] - The power value in milliwatts. Defaults to null if not provided.
   * @param {number | bigint | null} [energyExported] - The total energy exported in mWh. Defaults to null if not provided.
   * @returns {MatterbridgeEndpoint} The created solar panel endpoint.
   */
  addPanel(
    name: string,
    tag: number,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energyExported: number | bigint | null = null,
  ): MatterbridgeEndpoint {
    const panel = this.addChildDeviceType(name, electricalSensor, {
      tagList: [
        { mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Solar.tag, label: null },
        { mfgCode: null, namespaceId: NumberTag.One.namespaceId, tag, label: null },
      ],
    })
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(0, energyExported)
      .addRequiredClusterServers();
    panel.addUserLabel('panel', name.slice(0, 16)); // UserLabel has a max length of 16 characters
    return panel;
  }
}
