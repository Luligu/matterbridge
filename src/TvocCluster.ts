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

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-namespace */
import { ClusterFactory, OptionalAttribute } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag, BitFlags, TypeFromPartialBitSchema } from '@project-chip/matter-node.js/schema';
import { TlvEnum, TlvInt16, TlvNullable, TlvUInt16 } from '@project-chip/matter-node.js/tlv';

export namespace TvocMeasurement {
  export enum Feature {
    NumericMeasurement = 'NumericMeasurement',
    LevelIndication = 'LevelIndication',
    MediumLevel = 'MediumLevel',
    CriticalLevel = 'CriticalLevel',
    PeakMeasurement = 'PeakMeasurement',
    AverageMeasurement = 'AverageMeasurement',
  }

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

  export const Base = ClusterFactory.Definition({
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
  });

  export const NumericMeasurement = ClusterFactory.Component({});
  export const LevelIndication = ClusterFactory.Component({});
  export const MediumLevel = ClusterFactory.Component({});
  export const CriticalLevel = ClusterFactory.Component({});
  export const PeakMeasurement = ClusterFactory.Component({});
  export const AverageMeasurement = ClusterFactory.Component({});

  export const Cluster = ClusterFactory.Extensible(
    Base,

    <T extends `${Feature}`[]>(...features: [...T]) => {
      ClusterFactory.validateFeatureSelection(features, Feature);
      const cluster = ClusterFactory.Definition({
        ...Base,
        supportedFeatures: BitFlags(Base.features, ...features),
      });
      ClusterFactory.extend(cluster, NumericMeasurement, { numericMeasurement: true });
      ClusterFactory.extend(cluster, LevelIndication, { levelIndication: true });
      ClusterFactory.extend(cluster, MediumLevel, { mediumLevel: true });
      ClusterFactory.extend(cluster, CriticalLevel, { criticalLevel: true });
      ClusterFactory.extend(cluster, PeakMeasurement, { peakMeasurement: true });
      ClusterFactory.extend(cluster, AverageMeasurement, { averageMeasurement: true });
      return cluster as unknown as Extension<BitFlags<typeof Base.features, T>>;
    },
  );

  export type Extension<SF extends TypeFromPartialBitSchema<typeof Base.features>> = Omit<typeof Base, 'supportedFeatures'> & { supportedFeatures: SF } & (SF extends { numericMeasurement: true }
      ? typeof NumericMeasurement
      : {}) &
    (SF extends { levelIndication: true } ? typeof LevelIndication : {}) &
    (SF extends { mediumLevel: true } ? typeof MediumLevel : {}) &
    (SF extends { criticalLevel: true } ? typeof CriticalLevel : {}) &
    (SF extends { peakMeasurement: true } ? typeof PeakMeasurement : {}) &
    (SF extends { averageMeasurement: true } ? typeof AverageMeasurement : {});
}

export type TvocMeasurementCluster = typeof TvocMeasurement.Cluster;
export const TvocMeasurementCluster = TvocMeasurement.Cluster;
