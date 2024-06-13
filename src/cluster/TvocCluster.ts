/**
 * This file contains the TvocMeasurement cluster.
 *
 * @file TvocCluster.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.1
 *
 * Copyright 2024 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-namespace */
import { ClusterRegistry, MutableCluster, OptionalAttribute } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvEnum, TlvNullable, TlvUInt16 } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace TvocMeasurement {
  export enum MeasurementUnitType {
    PPM = 0,
    PPB = 1,
    PPT = 2,
    MGM3 = 3,
    UGM3 = 4,
    NGM3 = 5,
    PM3 = 6,
    BQM3 = 7,
  }

  export enum MeasurementMediumType {
    Air = 0,
    Water = 1,
    Soil = 2,
  }

  export enum LevelValueType {
    Unknown = 0,
    Low = 1,
    Medium = 2,
    High = 3,
    Critical = 4,
  }

  export const NumericMeasurementComponent = MutableCluster.Component({
    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },
  });

  export const LevelIndicationComponent = MutableCluster.Component({
    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },
  });

  export const MediumLevelComponent = MutableCluster.Component({
    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },
  });

  export const CriticalLevelComponent = MutableCluster.Component({
    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },
  });

  export const PeakMeasurementComponent = MutableCluster.Component({
    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },
  });

  export const AverageMeasurementComponent = MutableCluster.Component({
    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },
  });

  export enum Feature {
    NumericMeasurement = 'NumericMeasurement',
    LevelIndication = 'LevelIndication',
    MediumLevel = 'MediumLevel',
    CriticalLevel = 'CriticalLevel',
    PeakMeasurement = 'PeakMeasurement',
    AverageMeasurement = 'AverageMeasurement',
  }

  export const Base = MutableCluster.Component({
    id: 0x042e,
    name: 'TvocMeasurement',
    revision: 3,

    features: {
      numericMeasurement: BitFlag(0),
      levelIndication: BitFlag(1),
      mediumLevel: BitFlag(2),
      criticalLevel: BitFlag(3),
      peakMeasurement: BitFlag(4),
      averageMeasurement: BitFlag(5),
    },

    attributes: {
      measuredValue: Attribute(0x0, TlvNullable(TlvUInt16), { default: 0 }),
      minMeasuredValue: Attribute(0x1, TlvNullable(TlvUInt16), { default: 0 }),
      maxMeasuredValue: Attribute(0x2, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValue: OptionalAttribute(0x3, TlvNullable(TlvUInt16), { default: 0 }),
      peakMeasuredValueWindow: OptionalAttribute(0x4, TlvUInt16, { default: 1 }),
      averageMeasuredValue: OptionalAttribute(0x5, TlvNullable(TlvUInt16), { default: 0 }),
      averageMeasuredValueWindow: OptionalAttribute(0x6, TlvUInt16, { default: 1 }),
      uncertainty: OptionalAttribute(0x7, TlvUInt16),
      measurementUnit: OptionalAttribute(0x8, TlvEnum<MeasurementUnitType>()),
      measurementMedium: OptionalAttribute(0x9, TlvEnum<MeasurementMediumType>()),
      levelValue: OptionalAttribute(0xa, TlvEnum<LevelValueType>()),
    },

    extensions: MutableCluster.Extensions(
      { flags: { numericMeasurement: true }, component: NumericMeasurementComponent },
      { flags: { levelIndication: true }, component: LevelIndicationComponent },
      { flags: { mediumLevel: true }, component: MediumLevelComponent },
      { flags: { criticalLevel: true }, component: CriticalLevelComponent },
      { flags: { peakMeasurement: true }, component: PeakMeasurementComponent },
      { flags: { averageMeasurement: true }, component: AverageMeasurementComponent },
    ),
  });

  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;

  export const CompleteInstance = MutableCluster({
    id: Base.id,
    name: Base.name,
    revision: Base.revision,
    features: Base.features,

    attributes: {
      ...Base.attributes,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface Complete extends Identity<typeof CompleteInstance> {}

  export const Complete: Complete = CompleteInstance;
}

export type TvocMeasurementCluster = TvocMeasurement.Cluster;
export const TvocMeasurementCluster = TvocMeasurement.Cluster;
ClusterRegistry.register(TvocMeasurement.Complete);
