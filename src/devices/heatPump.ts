/**
 * @description This file contains the HeatPump class.
 * @file src/devices/heatPump.ts
 * @author Luca Liguori
 * @created 2025-06-29
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
import { NumberTag, PowerSourceTag } from '@matter/main';
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { deviceEnergyManagement, electricalSensor, powerSource, heatPump, temperatureSensor, thermostatDevice } from '../matterbridgeDeviceTypes.js';

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
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   *
   * @remarks
   * - The HeatPump includes clusters for power source, electrical power measurement, electrical energy measurement, and device energy management.
   * - It also includes child devices for flow temperature, return temperature, and a thermostat.
   * - The flow and return temperature sensors are set to default values of 45.00°C and 35.00°C respectively.
   * - The heating only thermostat is set up with a default temperature setpoint of 21.00°C.
   * - The device energy management cluster is set to `esaType` as `SpaceHeating`, `esaCanGenerate` as `false`, and `esaState` as `Online`.
   * - The absolute minimum and maximum power values can be set to indicate the range of power consumption for the heat pump.
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
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.SpaceHeating, false, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();

    // Add the flow temperature sensor for the heat pump.
    this.addChildDeviceType('FlowTemperature', temperatureSensor, {
      tagList: [{ mfgCode: null, namespaceId: NumberTag.One.namespaceId, tag: NumberTag.One.tag, label: 'Flow' }],
    })
      .createDefaultTemperatureMeasurementClusterServer(4500) // Default flow temperature setpoint in hundredths of degrees Celsius (45.00°C).
      .addRequiredClusterServers();

    // Add the return temperature sensor for the heat pump.
    this.addChildDeviceType('ReturnTemperature', temperatureSensor, {
      tagList: [{ mfgCode: null, namespaceId: NumberTag.Two.namespaceId, tag: NumberTag.Two.tag, label: 'Return' }],
    })
      .createDefaultTemperatureMeasurementClusterServer(3500) // Default return temperature setpoint in hundredths of degrees Celsius (35.00°C).
      .addRequiredClusterServers();

    // Add the global thermostat for the heat pump.
    this.addChildDeviceType('Thermostat', thermostatDevice, {
      tagList: [{ mfgCode: null, namespaceId: NumberTag.One.namespaceId, tag: NumberTag.One.tag, label: 'Main Thermostat' }],
    })
      .createDefaultHeatingThermostatClusterServer()
      .addRequiredClusterServers();
  }
}
