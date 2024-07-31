/* eslint-disable @typescript-eslint/no-empty-object-type */
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
import { ClusterRegistry, MutableCluster } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvEnum } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace AirQuality {
  export enum AirQualityType {
    Unknown = 0,
    Good = 1,
    Fair = 2,
    Moderate = 3,
    Poor = 4,
    VeryPoor = 5,
    ExtremelyPoor = 6,
  }

  export const FairAirQualityComponent = MutableCluster.Component({
    attributes: {
      airQuality: Attribute(0x0, TlvEnum<AirQualityType>()),
    },
  });
  export const ModerateAirQualityComponent = MutableCluster.Component({
    attributes: {
      airQuality: Attribute(0x0, TlvEnum<AirQualityType>()),
    },
  });
  export const VeryPoorAirQualityComponent = MutableCluster.Component({
    attributes: {
      airQuality: Attribute(0x0, TlvEnum<AirQualityType>()),
    },
  });
  export const ExtremelyPoorAirQualityComponent = MutableCluster.Component({
    attributes: {
      airQuality: Attribute(0x0, TlvEnum<AirQualityType>()),
    },
  });

  export enum Feature {
    FairAirQuality = 'FairAirQuality',
    ModerateAirQuality = 'ModerateAirQuality',
    VeryPoorAirQuality = 'VeryPoorAirQuality',
    ExtremelyPoorAirQuality = 'ExtremelyPoorAirQuality',
  }

  export const Base = MutableCluster.Component({
    id: 0x005b,
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

    extensions: MutableCluster.Extensions(
      { flags: { fairAirQuality: true }, component: FairAirQualityComponent },
      { flags: { ModerateAirQuality: true }, component: ModerateAirQualityComponent },
      { flags: { VeryPoorAirQuality: true }, component: VeryPoorAirQualityComponent },
      { flags: { ExtremelyPoorAirQuality: true }, component: ExtremelyPoorAirQualityComponent },
    ),
  });

  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

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

  export interface Complete extends Identity<typeof CompleteInstance> {}

  export const Complete: Complete = CompleteInstance;
}

export type AirQualityCluster = AirQuality.Cluster;
export const AirQualityCluster = AirQuality.Cluster;
ClusterRegistry.register(AirQuality.Complete);
