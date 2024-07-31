/* eslint-disable @typescript-eslint/no-empty-object-type */

/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { ClusterRegistry, MutableCluster } from '@project-chip/matter-node.js/cluster';
import { FixedAttribute, Attribute } from '@project-chip/matter-node.js/cluster';
import { TlvEndpointNumber } from '@project-chip/matter-node.js/datatype';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvArray } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace PowerTopology {
  /**
   * A PowerTopologyCluster supports these elements if it supports feature SetTopology.
   */
  export const SetTopologyComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the list of endpoints capable of providing power to and/or consuming power from the endpoint
       * hosting this server.
       *
       * @see {@link MatterSpecification.v13.Core} § 11.8.5.1
       */
      availableEndpoints: FixedAttribute(0x0, TlvArray(TlvEndpointNumber, { maxLength: 20 }), { default: [] }),
    },
  });

  /**
   * A PowerTopologyCluster supports these elements if it supports feature DynamicPowerFlow.
   */
  export const DynamicPowerFlowComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the current list of endpoints currently providing or consuming power to or from the endpoint
       * hosting this server. This list shall be a subset of the value of the AvailableEndpoints attribute.
       *
       * @see {@link MatterSpecification.v13.Core} § 11.8.5.2
       */
      activeEndpoints: Attribute(0x1, TlvArray(TlvEndpointNumber, { maxLength: 20 }), { persistent: true, default: [] }),
    },
  });

  /**
   * These are optional features supported by PowerTopologyCluster.
   *
   * @see {@link MatterSpecification.v13.Core} § 11.8.4
   */
  export enum Feature {
    /**
     * NodeTopology
     *
     * This endpoint provides or consumes power to/from the entire node
     */
    NodeTopology = 'NodeTopology',

    /**
     * TreeTopology
     *
     * This endpoint provides or consumes power to/from itself and its child endpoints
     */
    TreeTopology = 'TreeTopology',

    /**
     * SetTopology
     *
     * This endpoint provides or consumes power to/from a specified set of endpoints
     */
    SetTopology = 'SetTopology',

    /**
     * DynamicPowerFlow
     *
     * The specified set of endpoints may change
     */
    DynamicPowerFlow = 'DynamicPowerFlow',
  }

  /**
   * These elements and properties are present in all PowerTopology clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x9c,
    name: 'PowerTopology',
    revision: 1,

    features: {
      /**
       * NodeTopology
       *
       * This endpoint provides or consumes power to/from the entire node
       */
      nodeTopology: BitFlag(0),

      /**
       * TreeTopology
       *
       * This endpoint provides or consumes power to/from itself and its child endpoints
       */
      treeTopology: BitFlag(1),

      /**
       * SetTopology
       *
       * This endpoint provides or consumes power to/from a specified set of endpoints
       */
      setTopology: BitFlag(2),

      /**
       * DynamicPowerFlow
       *
       * The specified set of endpoints may change
       */
      dynamicPowerFlow: BitFlag(3),
    },

    /**
     * This metadata controls which PowerTopologyCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { setTopology: true }, component: SetTopologyComponent },
      { flags: { dynamicPowerFlow: true }, component: DynamicPowerFlowComponent },
      { flags: { dynamicPowerFlow: true, setTopology: false }, component: false },
      { flags: { nodeTopology: true, treeTopology: true }, component: false },
      { flags: { nodeTopology: true, setTopology: true }, component: false },
      { flags: { treeTopology: true, setTopology: true }, component: false },
      { flags: { nodeTopology: false, treeTopology: false, setTopology: false }, component: false },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  /**
   * The Power Topology Cluster provides a mechanism for expressing how power is flowing between endpoints.
   *
   * Per the Matter specification you cannot use {@link PowerTopologyCluster} without enabling certain feature
   * combinations. You must use the {@link with} factory method to obtain a working cluster.
   *
   * @see {@link MatterSpecification.v13.Core} § 11.8
   */
  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  const SET = { setTopology: true };
  const DYPF = { dynamicPowerFlow: true };

  /**
   * @see {@link Complete}
   */
  export const CompleteInstance = MutableCluster({
    id: Base.id,
    name: Base.name,
    revision: Base.revision,
    features: Base.features,

    attributes: {
      availableEndpoints: MutableCluster.AsConditional(SetTopologyComponent.attributes.availableEndpoints, { mandatoryIf: [SET] }),
      activeEndpoints: MutableCluster.AsConditional(DynamicPowerFlowComponent.attributes.activeEndpoints, { mandatoryIf: [DYPF] }),
    },
  });

  /**
   * This cluster supports all PowerTopology features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export interface Complete extends Identity<typeof CompleteInstance> {}

  export const Complete: Complete = CompleteInstance;
}

export type PowerTopologyCluster = PowerTopology.Cluster;
export const PowerTopologyCluster = PowerTopology.Cluster;
ClusterRegistry.register(PowerTopology.Complete);
