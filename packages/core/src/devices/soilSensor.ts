/**
 * @description Soil Sensor device class exposing the Matter 1.5 SoilMeasurement custom cluster.
 * @file src/devices/soilSensor.ts
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
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

import { ClusterBehavior } from '@matter/node';
import { MeasurementType } from '@matter/types/globals';

import { SoilMeasurement } from '../clusters/soil-measurement.js';
import { soilSensor } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createClusterSchema } from './customClusterSchema.js';

export interface SoilSensorOptions {
  /** Soil moisture in percent (0..100). Use null when unknown/not available. */
  soilMoistureMeasuredValue?: number | null;
}

/**
 * SoilMeasurement server behavior.
 *
 * This stays in the device file on purpose.
 */
export const SoilMeasurementServer = ClusterBehavior.for(SoilMeasurement.Cluster, createClusterSchema(SoilMeasurement.Cluster));

export class SoilSensor extends MatterbridgeEndpoint {
  constructor(name: string, serial: string, options: SoilSensorOptions = {}) {
    super([soilSensor], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Soil Sensor');

    this.behaviors.require(SoilMeasurementServer, {
      soilMoistureMeasurementLimits: {
        measurementType: MeasurementType.SoilMoisture,
        measured: true,
        minMeasuredValue: 0,
        maxMeasuredValue: 100,
        accuracyRanges: [{ rangeMin: 0, rangeMax: 100, fixedMax: 1 }],
      },
      soilMoistureMeasuredValue: options.soilMoistureMeasuredValue ?? null,
    });
  }

  async setSoilMoistureMeasuredValue(value: number | null): Promise<void> {
    await this.setAttribute(SoilMeasurement.Cluster.id, 'soilMoistureMeasuredValue', value);
  }

  getSoilMoistureMeasuredValue(): number | null {
    return this.getAttribute(SoilMeasurement.Cluster.id, 'soilMoistureMeasuredValue');
  }
}
