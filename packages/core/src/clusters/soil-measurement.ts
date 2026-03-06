/**
 * @description Soil Measurement Cluster Matter 1.5.0 - 2.15. Soil Measurement Cluster.
 * @file src/clusters/soil-measurement.ts
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

/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */

import { Identity } from '@matter/general';
import { Attribute, ClusterRegistry, FixedAttribute, MutableCluster } from '@matter/types/cluster';
import { TlvMeasurementAccuracy } from '@matter/types/globals';
import { TlvNullable, TlvPercent } from '@matter/types/tlv';

export namespace SoilMeasurement {
  export const ClusterInstance = MutableCluster({
    id: 0x0430,
    name: 'SoilMeasurement',
    revision: 1,

    attributes: {
      soilMoistureMeasurementLimits: FixedAttribute(0x0, TlvMeasurementAccuracy),
      soilMoistureMeasuredValue: Attribute(0x1, TlvNullable(TlvPercent)),
    },
  });

  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type SoilMeasurementCluster = SoilMeasurement.Cluster;
export const SoilMeasurementCluster = SoilMeasurement.Cluster;

ClusterRegistry.register(SoilMeasurement.Complete);
