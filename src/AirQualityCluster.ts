/**
 * This file contains the AirQuality cluster.
 *
 * @file AirQualityCluster.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.0.1
 *
 * Copyright 2023, 2024 Luca Liguori.
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
/* eslint-disable @typescript-eslint/ban-types */
import { ClusterFactory } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag, BitFlags, TypeFromPartialBitSchema } from '@project-chip/matter-node.js/schema';
import { TlvEnum } from '@project-chip/matter-node.js/tlv';

export namespace AirQuality {
  export enum Feature {
    FairAirQuality = 'FairAirQuality',
    ModerateAirQuality = 'ModerateAirQuality',
    VeryPoorAirQuality = 'VeryPoorAirQuality',
    ExtremelyPoorAirQuality = 'ExtremelyPoorAirQuality',
  }

  export enum AirQualityType {
    Unknown = 0,
    Good = 1,
    Fair = 2,
    Moderate = 3,
    Poor = 4,
    VeryPoor = 5,
    ExtremelyPoor = 6,
  }

  export const Base = ClusterFactory.Definition({
    id: 0x5b,
    name: 'AirQuality',
    revision: 1,

    features: {
      fairAirQuality: BitFlag(0),
      moderateAirQuality: BitFlag(1),
      veryPoorAirQuality: BitFlag(2),
      extremelyPoorAirQuality: BitFlag(3),
    },

    attributes: {
      airQuality: Attribute(0x0, TlvEnum<AirQualityType>()),
    },
  });

  export const FairAirQualityComponent = ClusterFactory.Component({});
  export const ModerateAirQualityComponent = ClusterFactory.Component({});
  export const VeryPoorAirQualityComponent = ClusterFactory.Component({});
  export const ExtremelyPoorAirQualityComponent = ClusterFactory.Component({});

  export const Cluster = ClusterFactory.Extensible(
    Base,

    /**
     * Use this factory method to create a Switch cluster with support for optional features. Include each
     * {@link Feature} you wish to support.
     *
     * @param features the optional features to support
     * @returns a Switch cluster with specified features enabled
     * @throws {IllegalClusterError} if the feature combination is disallowed by the Matter specification
     */
    <T extends `${Feature}`[]>(...features: [...T]) => {
      ClusterFactory.validateFeatureSelection(features, Feature);
      const cluster = ClusterFactory.Definition({
        ...Base,
        supportedFeatures: BitFlags(Base.features, ...features),
      });
      ClusterFactory.extend(cluster, FairAirQualityComponent, { fairAirQuality: true });
      ClusterFactory.extend(cluster, ModerateAirQualityComponent, { moderateAirQuality: true });
      ClusterFactory.extend(cluster, VeryPoorAirQualityComponent, { veryPoorAirQuality: true });
      ClusterFactory.extend(cluster, ExtremelyPoorAirQualityComponent, { extremelyPoorAirQuality: true });
      return cluster as unknown as Extension<BitFlags<typeof Base.features, T>>;
    },
  );

  export type Extension<SF extends TypeFromPartialBitSchema<typeof Base.features>> = Omit<typeof Base, 'supportedFeatures'> & { supportedFeatures: SF } & (SF extends {
      fairAirQuality: true;
    }
      ? typeof FairAirQualityComponent
      : {}) &
    (SF extends { moderateAirQuality: true } ? typeof ModerateAirQualityComponent : {}) &
    (SF extends { veryPoorAirQuality: true } ? typeof VeryPoorAirQualityComponent : {}) &
    (SF extends { extremelyPoorAirQuality: true } ? typeof ExtremelyPoorAirQualityComponent : {});
}

export type AirQualityCluster = typeof AirQuality.Cluster;
export const AirQualityCluster = AirQuality.Cluster;
