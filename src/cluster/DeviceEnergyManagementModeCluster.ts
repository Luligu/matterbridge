/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ClusterRegistry, MutableCluster } from '@project-chip/matter-node.js/cluster';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace DeviceEnergyManagementMode {
  export enum ModeTag {
    /**
     * The device prohibits optimization of energy usage management: its energy usage is determined only by the
     * user configuration and internal device needs. This tag cannot be included with any of the other tags defined
     * below in a mode.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.6.5.1.1
     */
    NoOptimization = 16384,

    /**
     * The device is permitted to manage its own energy usage. For example, using tariff information it may obtain.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.6.5.1.2
     */
    DeviceOptimization = 16385,

    /**
     * The device permits management of energy usage by an energy manager to optimize the local energy usage.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.6.5.1.3
     */
    LocalOptimization = 16386,

    /**
     * The device permits management of energy usage by an energy manager to optimize the grid energy usage.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 9.6.5.1.4
     */
    GridOptimization = 16387,
  }

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster({ id: 0x9f, name: 'DeviceEnergyManagementMode', revision: 1 });

  /**
   * This cluster is derived from the Mode Base cluster, defining additional mode tags and namespaced enumerated
   * values for Device Energy Management devices.
   *
   * NOTE Support for Device Energy Management Mode cluster is provisional.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 9.6
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type DeviceEnergyManagementModeCluster = DeviceEnergyManagementMode.Cluster;
export const DeviceEnergyManagementModeCluster = DeviceEnergyManagementMode.Cluster;
ClusterRegistry.register(DeviceEnergyManagementMode.Complete);
