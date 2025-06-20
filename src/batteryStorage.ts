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
    batVoltage: number | bigint | null = null,
  ) {
    super(
      [batteryStorage, powerSource, electricalSensor, deviceEnergyManagement],
      {
        tagList: [
          { mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Battery.tag, label: PowerSourceTag.Battery.label },
          { mfgCode: null, namespaceId: PowerSourceTag.Solar.namespaceId, tag: PowerSourceTag.Grid.tag, label: PowerSourceTag.Grid.label }
        ],
        uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      },
      true,
    );
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Solar Power')
      .createDefaultPowerSourceWiredRechargeableBatteryClusterServer(180)
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(energyImpported, energyExported)
      .createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.BatteryStorage, true, DeviceEnergyManagement.EsaState.Online, absMinPower, absMaxPower)
      .addRequiredClusterServers();
  }
}


/**
 * A Battery Storage device is a device that allows a DC battery, which can optionally be comprised of
 * a set parallel strings of battery packs and associated controller, and an AC inverter, to be monitored
 * and controlled by an Energy Management System in order to manage the peaks and troughs of supply
 * and demand, and/or to optimize cost of the energy consumed in premises. It is not intended to
 * be used for a UPS directly supplying a set of appliances, nor for portable battery storage devices.
 *
 * 14.4.5. Device Type Requirements
 * A Battery Storage device SHALL be composed of at least one endpoint with device types as defined by
 * the conformance below. There MAY be more endpoints with additional instances of these device
 * types or additional device types existing in the Battery Storage device.
 * ID     Name                        Constraint    Conformance
 * 0x0011 Power Source                min 1         M
 * 0x0510 Electrical Sensor           min 1         M
 * 0x050D Device Energy Management                  M
 * 0x0302 Temperature Sensor                        O
 * 0x0017 Solar Power                               O
 *
 * See 14.4.5.1. Cluster Requirements on Composing Device Types
 */
 

/**
 * 
0x0011 PowerSource  0x002F PowerSource  Feature   Wired                 M
0x0011 PowerSource  0x002F PowerSource  Feature   Battery               M
0x0011 PowerSource  0x002F PowerSource  Attribute BatVoltage            M
0x0011 PowerSource  0x002F PowerSource  Attribute BatPercentRemaining   M
0x0011 PowerSource  0x002F PowerSource  Attribute BatTimeRemaining      M
0x0011 PowerSource  0x002F PowerSource  Attribute ActiveBatFaults       M
0x0011 PowerSource  0x002F PowerSource  Attribute BatCapacity           M
0x0011 PowerSource  0x002F PowerSource  Attribute BatTimeToFullCharge   M
0x0011 PowerSource  0x002F PowerSource  Attribute BatChargingCurrent    M
0x0011 PowerSource  0x002F PowerSource  Attribute ActiveBatChargeFaults M
0x0011 PowerSource  0x002F PowerSource  Feature   TagList               M



https://github.com/project-chip/matter.js/blob/main/packages/model/src/standard/resources/device-energy-management-cluster.resource.ts
https://github.com/project-chip/matter.js/blob/6d9b2724909dcb84e983f29d2bd41708830bcfb6/packages/model/src/standard/elements/power-source-cluster.element.ts#L69
*/