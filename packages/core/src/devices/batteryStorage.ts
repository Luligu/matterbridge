/**
 * @file packages/core/src/devices/batteryStorage.ts
 * @description This file contains the BatteryStorage class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2025-06-20
 * @version 1.1.0
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
import { PowerSourceTag } from '@matter/node';
import { ElectricalPowerMeasurementServer } from '@matter/node/behaviors/electrical-power-measurement';
import type { EndpointNumber } from '@matter/types';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { PowerSource } from '@matter/types/clusters/power-source';
import type { Semtag } from '@matter/types/globals';
// @matterbridge
import { fireAndForget } from '@matterbridge/utils/wait';

// Matterbridge
import { batteryStorage, deviceEnergyManagement, electricalSensor, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { getDefaultElectricalPowerMeasurementClusterServer, getSemtag } from '../matterbridgeEndpointHelpers.js';

/** Options for configuring a {@link BatteryStorage} endpoint. */
export interface BatteryStorageOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Remaining battery percentage. */
  batPercentRemaining?: number;
  /** Battery charge level. */
  batChargeLevel?: PowerSource.BatChargeLevel;
  /** Voltage in millivolts. */
  voltage?: number | bigint | null;
  /** Current in milliamperes. */
  current?: number | bigint | null;
  /** Power in milliwatts. */
  power?: number | bigint | null;
  /** Imported energy in mWh. */
  energyImported?: number | bigint | null;
  /** Exported energy in mWh. */
  energyExported?: number | bigint | null;
  /** Minimum electrical power in milliwatts. */
  absMinPower?: number;
  /** Maximum electrical power in milliwatts. */
  absMaxPower?: number;
}

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
  constructor(name: string, serial: string, options?: BatteryStorageOptions);

  /** @deprecated Pass a {@link BatteryStorageOptions} object as the third argument instead. */
  constructor(
    name: string,
    serial: string,
    batPercentRemaining?: number,
    batChargeLevel?: PowerSource.BatChargeLevel,
    voltage?: number | bigint | null,
    current?: number | bigint | null,
    power?: number | bigint | null,
    energyImported?: number | bigint | null,
    energyExported?: number | bigint | null,
    absMinPower?: number,
    absMaxPower?: number,
  );

  constructor(
    name: string,
    serial: string,
    optionsOrBatPercentRemaining?: BatteryStorageOptions | number,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    voltage: number | bigint | null = null,
    current: number | bigint | null = null,
    power: number | bigint | null = null,
    energyImported: number | bigint | null = null,
    energyExported: number | bigint | null = null,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ) {
    const options: BatteryStorageOptions =
      typeof optionsOrBatPercentRemaining === 'object'
        ? optionsOrBatPercentRemaining
        : { batPercentRemaining: optionsOrBatPercentRemaining, batChargeLevel, voltage, current, power, energyImported, energyExported, absMinPower, absMaxPower };
    super([batteryStorage, powerSource, electricalSensor, deviceEnergyManagement], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList ?? [getSemtag(PowerSourceTag.Grid)],
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Battery Storage')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultPowerTopologyClusterServer()
      .createDefaultElectricalPowerMeasurementClusterServer(options.voltage ?? null, options.current ?? null, options.power ?? null)
      .createDefaultElectricalEnergyMeasurementClusterServer(options.energyImported ?? null, options.energyExported ?? null)
      .createDefaultDeviceEnergyManagementClusterServer(
        DeviceEnergyManagement.EsaType.BatteryStorage,
        true,
        DeviceEnergyManagement.EsaState.Online,
        options.absMinPower ?? 0,
        options.absMaxPower ?? 0,
      )
      .createDefaultDeviceEnergyManagementModeClusterServer()
      .addRequiredClusterServers();
    fireAndForget(this.addFixedLabel('composed', 'Battery Storage'), this.log, 'BatteryStorage addFixedLabel');

    const battery = this.addChildDeviceType('Battery', [powerSource, electricalSensor], {
      tagList: [getSemtag(PowerSourceTag.Battery)],
    })
      .createDefaultPowerSourceRechargeableBatteryClusterServer(options.batPercentRemaining ?? 100, options.batChargeLevel ?? PowerSource.BatChargeLevel.Ok, 24_000) // Battery voltage in mV (24V).
      .createDefaultPowerTopologyClusterServer()
      // .createDefaultElectricalPowerMeasurementClusterServer(voltage, current, power)
      .createDefaultElectricalEnergyMeasurementClusterServer(options.energyImported ?? null, options.energyExported ?? null);
    battery.behaviors.require(
      ElectricalPowerMeasurementServer.with(ElectricalPowerMeasurement.Feature.DirectCurrent),
      getDefaultElectricalPowerMeasurementClusterServer(options.voltage ?? null, options.current ?? null, options.power ?? null),
    );
  }
}
