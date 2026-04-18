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

import { AttributeElement, ClusterElement, ClusterModel, Matter, MatterDefinition } from '@matter/main/model';
import { ClusterType, type ClusterTyping } from '@matter/types/cluster';
import { type ClusterId } from '@matter/types/datatype';
import { type MeasurementAccuracy } from '@matter/types/globals';

// Create the cluster definition and model for the SoilMeasurement cluster.
export const SoilMeasurementDefinition = ClusterElement(
  {
    name: 'SoilMeasurement',
    id: 0x0430,
    classification: 'application',
  },
  AttributeElement({ name: 'ClusterRevision', id: 0xfffd, type: 'ClusterRevision', default: 1 }),
  AttributeElement({ name: 'FeatureMap', id: 0xfffc, type: 'FeatureMap' }),
  AttributeElement({
    name: 'SoilMoistureMeasurementLimits',
    id: 0x0000,
    type: 'MeasurementAccuracyStruct',
    access: 'R V',
    conformance: 'M',
  }),
  AttributeElement({
    name: 'SoilMoistureMeasuredValue',
    id: 0x0001,
    type: 'percent',
    access: 'R V',
    conformance: 'M',
    quality: 'X',
    default: null,
  }),
);

export const SoilMeasurementModel = new ClusterModel(SoilMeasurementDefinition);

// Register the cluster definition with the Matter definition so it can be referenced by devices and endpoints.
MatterDefinition.children.push(SoilMeasurementDefinition);

// Register the cluster model with the canonical Matter model so helper utilities like `getClusterNameById()` can resolve the name for this custom cluster ID.
if (Matter.clusters(SoilMeasurementModel.id) === undefined) {
  Matter.children.push(SoilMeasurementModel);
}

export declare namespace SoilMeasurement {
  interface BaseAttributes {
    soilMoistureMeasurementLimits: MeasurementAccuracy;
    soilMoistureMeasuredValue: number | null;
  }

  interface Attributes {
    soilMoistureMeasurementLimits: MeasurementAccuracy;
    soilMoistureMeasuredValue: number | null;
  }

  type Components = [{ flags: {}; attributes: BaseAttributes }];

  interface Typing extends ClusterTyping {
    Attributes: Attributes;
    Components: Components;
  }
}

export const SoilMeasurement = ClusterType(SoilMeasurementModel) as ClusterType.Concrete & {
  readonly id: ClusterId & 0x0430;
  readonly name: 'SoilMeasurement';
  readonly revision: 1;
  readonly schema: ClusterModel;
  readonly attributes: ClusterType.AttributeObjects<SoilMeasurement.Attributes>;
  readonly Typing: SoilMeasurement.Typing;
  /** @deprecated Use {@link SoilMeasurement}. */
  readonly Cluster: typeof SoilMeasurement;
  /** @deprecated Use {@link SoilMeasurement}. */
  readonly Complete: typeof SoilMeasurement;
  /** @deprecated */
};
