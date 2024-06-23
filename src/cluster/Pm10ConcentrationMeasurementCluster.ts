/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ClusterRegistry, MutableCluster } from '@project-chip/matter-node.js/cluster';
import { Identity } from '@project-chip/matter-node.js/util';
import { ConcentrationMeasurement } from './ConcentrationMeasurementCluster.js';

export namespace Pm10ConcentrationMeasurement {
  export const Base = { ...ConcentrationMeasurement.Base, id: 0x42d, name: 'Pm10ConcentrationMeasurement' };

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  /**
   * This alias specializes the semantics of {@link ConcentrationMeasurement.Cluster}.
   *
   * Per the Matter specification you cannot use {@link Pm10ConcentrationMeasurementCluster} without enabling certain
   * feature combinations. You must use the {@link with} factory method to obtain a working cluster.
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;

  /**
   * This cluster supports all Pm10ConcentrationMeasurement features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export const CompleteInstance = MutableCluster({ ...ConcentrationMeasurement.Complete, id: 0x42d, name: 'Pm10ConcentrationMeasurement' });

  export type Complete = Identity<typeof CompleteInstance>;
  export const Complete: Complete = CompleteInstance;
}

export type Pm10ConcentrationMeasurementCluster = Pm10ConcentrationMeasurement.Cluster;
export const Pm10ConcentrationMeasurementCluster = Pm10ConcentrationMeasurement.Cluster;
ClusterRegistry.register(Pm10ConcentrationMeasurement.Complete);
