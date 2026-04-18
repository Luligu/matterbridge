/**
 * @description Soil Sensor device class exposing the Matter 1.5 SoilMeasurement custom cluster.
 * @file src/devices/soilSensor.ts
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-namespace */

import { ClusterBehavior } from '@matter/node';
import { type MeasurementAccuracy, MeasurementType } from '@matter/types/globals';

import { SoilMeasurement } from '../clusters/soil-measurement.js';
import { powerSource, soilSensor } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

const SoilMeasurementBehavior = ClusterBehavior.for(SoilMeasurement, SoilMeasurement.schema);

export namespace SoilMeasurementServer {
  export interface State {
    soilMoistureMeasurementLimits: MeasurementAccuracy;
    soilMoistureMeasuredValue: number | null;
  }
}

/**
 * Behavior server for the custom SoilMeasurement cluster.
 */
export class SoilMeasurementServer extends SoilMeasurementBehavior {
  declare state: SoilMeasurementServer.State;
}

export interface SoilSensorOptions {
  /** Measurement limits and accuracy for the soil moisture measurement. */
  soilMoistureMeasurementLimits?: MeasurementAccuracy;
  /** Soil moisture in percent (0..100). Use null when unknown/not available. */
  soilMoistureMeasuredValue?: number | null;
  /** Measured temperature in hundredths of a degree Celsius (°C × 100). This is an optional attribute that may be included if the soil sensor also has a temperature measurement capability. */
  temperatureMeasuredValue?: number | null;
  /** Whether the device is battery powered. Defaults to false (wired). */
  batteryPowered?: boolean;
}

/**
 * Matterbridge endpoint representing a soil sensor.
 */
export class SoilSensor extends MatterbridgeEndpoint {
  /**
   * Creates a SoilSensor endpoint and configures the SoilMeasurement cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {SoilSensorOptions} [options] - Optional initial SoilMeasurement attribute values.
   */
  constructor(name: string, serial: string, options: SoilSensorOptions = {}) {
    super([soilSensor, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Soil Sensor');
    if (options.batteryPowered) {
      this.createDefaultPowerSourceBatteryClusterServer();
    } else {
      this.createDefaultPowerSourceWiredClusterServer();
    }

    this.behaviors.require(SoilMeasurementServer, {
      soilMoistureMeasurementLimits: options.soilMoistureMeasurementLimits ?? {
        measurementType: MeasurementType.SoilMoisture,
        measured: true,
        minMeasuredValue: 0,
        maxMeasuredValue: 100,
        accuracyRanges: [{ rangeMin: 0, rangeMax: 100, fixedMax: 1 }],
      },
      soilMoistureMeasuredValue: options.soilMoistureMeasuredValue ?? null,
    });
    if (options.temperatureMeasuredValue !== undefined) this.createDefaultTemperatureMeasurementClusterServer(options.temperatureMeasuredValue);
  }

  /**
   * Sets the SoilMeasurement `soilMoistureMeasuredValue` attribute.
   *
   * @param {number | null} value - Soil moisture in percent (0..100), or null when unknown.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setSoilMoistureMeasuredValue(value: number | null): Promise<void> {
    await this.setAttribute(SoilMeasurement.Cluster.id, 'soilMoistureMeasuredValue', value);
  }

  /**
   * Gets the SoilMeasurement `soilMoistureMeasuredValue` attribute.
   *
   * @returns {number | null | undefined} Soil moisture in percent (0..100), or null when unknown.
   */
  getSoilMoistureMeasuredValue(): number | null | undefined {
    return this.getAttribute(SoilMeasurement.Cluster, 'soilMoistureMeasuredValue');
  }
}
