/* eslint-disable @typescript-eslint/no-empty-object-type */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/
/* eslint-disable @typescript-eslint/no-namespace */

import { MutableCluster } from '@project-chip/matter-node.js/cluster';
import { OptionalFixedAttribute, OptionalWritableAttribute, AccessLevel, Attribute, OptionalEvent, EventPriority, Event } from '@project-chip/matter-node.js/cluster';
import { TlvString } from '@project-chip/matter-node.js/tlv';
import { TlvVendorId } from '@project-chip/matter-node.js/datatype';
import { TlvUInt16, TlvUInt32, TlvEnum } from '@project-chip/matter-node.js/tlv';
import { TlvBoolean } from '@project-chip/matter-node.js/tlv';
import { TlvObject, TlvField } from '@project-chip/matter-node.js/tlv';
import { TlvNullable } from '@project-chip/matter-node.js/tlv';
import { TypeFromSchema } from '@project-chip/matter-node.js/tlv';
import { TlvNoArguments } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';
import { ClusterRegistry } from '@project-chip/matter-node.js/cluster';

export namespace BridgedDeviceBasicInformation {
  export enum ProductFinish {
    Other = 0,
    Matte = 1,
    Satin = 2,
    Polished = 3,
    Rugged = 4,
    Fabric = 5,
  }

  export enum Color {
    Black = 0,
    Navy = 1,
    Green = 2,
    Teal = 3,
    Maroon = 4,
    Purple = 5,
    Olive = 6,
    Gray = 7,
    Blue = 8,
    Lime = 9,
    Aqua = 10,
    Red = 11,
    Fuchsia = 12,
    Yellow = 13,
    White = 14,
    Nickel = 15,
    Chrome = 16,
    Brass = 17,
    Copper = 18,
    Silver = 19,
    Gold = 20,
  }

  export const TlvProductAppearanceStruct = TlvObject({
    finish: TlvField(0, TlvEnum<ProductFinish>()),
    primaryColor: TlvField(1, TlvNullable(TlvEnum<Color>())),
  });

  export interface ProductAppearanceStruct extends TypeFromSchema<typeof TlvProductAppearanceStruct> {}

  /**
   * Body of the BridgedDeviceBasicInformation startUp event
   *
   * @see {@link MatterSpecification.v11.Core} § 9.13.5
   */
  export const TlvStartUpEvent = TlvObject({ softwareVersion: TlvField(0, TlvUInt32) });

  /**
   * Body of the BridgedDeviceBasicInformation startUp event
   *
   * @see {@link MatterSpecification.v11.Core} § 9.13.5
   */

  export interface StartUpEvent extends TypeFromSchema<typeof TlvStartUpEvent> {}

  /**
   * Body of the BridgedDeviceBasicInformation reachableChanged event
   *
   * @see {@link MatterSpecification.v11.Core} § 9.13.5.1
   */
  export const TlvReachableChangedEvent = TlvObject({ reachableNewValue: TlvField(0, TlvBoolean) });

  /**
   * Body of the BridgedDeviceBasicInformation reachableChanged event
   *
   * @see {@link MatterSpecification.v11.Core} § 9.13.5.1
   */

  export interface ReachableChangedEvent extends TypeFromSchema<typeof TlvReachableChangedEvent> {}

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster({
    id: 0x39,
    name: 'BridgedDeviceBasicInformation',
    revision: 2,

    attributes: {
      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      vendorName: OptionalFixedAttribute(0x1, TlvString.bound({ maxLength: 32 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      vendorId: OptionalFixedAttribute(0x2, TlvVendorId),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      productName: OptionalFixedAttribute(0x3, TlvString.bound({ maxLength: 32 })),

      /**
       * This attribute shall specify the Product ID assigned by the vendor that is unique to the specific
       * product of the Node.
       *
       * @see {@link MatterSpecification.v11.Core} § 11.1.5.5
       */
      productId: OptionalFixedAttribute(0x4, TlvUInt16),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      nodeLabel: OptionalWritableAttribute(0x5, TlvString.bound({ maxLength: 32 }), { persistent: true, default: '', writeAcl: AccessLevel.Manage }),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      hardwareVersion: OptionalFixedAttribute(0x7, TlvUInt16, { default: 0 }),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      hardwareVersionString: OptionalFixedAttribute(0x8, TlvString.bound({ minLength: 1, maxLength: 64 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      softwareVersion: OptionalFixedAttribute(0x9, TlvUInt32, { default: 0 }),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      softwareVersionString: OptionalFixedAttribute(0xa, TlvString.bound({ minLength: 1, maxLength: 64 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      manufacturingDate: OptionalFixedAttribute(0xb, TlvString.bound({ minLength: 8, maxLength: 16 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      partNumber: OptionalFixedAttribute(0xc, TlvString.bound({ maxLength: 32 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      productUrl: OptionalFixedAttribute(0xd, TlvString.bound({ maxLength: 256 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      productLabel: OptionalFixedAttribute(0xe, TlvString.bound({ maxLength: 64 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      serialNumber: OptionalFixedAttribute(0xf, TlvString.bound({ maxLength: 32 })),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      reachable: Attribute(0x11, TlvBoolean, { default: true }),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.4
       */
      uniqueId: OptionalFixedAttribute(0x12, TlvString.bound({ maxLength: 32 })),

      productAppearance: OptionalFixedAttribute(0x14, TlvProductAppearanceStruct),
    },

    events: {
      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.5
       */
      startUp: OptionalEvent(0x0, EventPriority.Critical, TlvStartUpEvent),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.5
       */
      shutDown: OptionalEvent(0x1, EventPriority.Critical, TlvNoArguments),

      /**
       * @see {@link MatterSpecification.v11.Core} § 9.13.5
       */
      leave: OptionalEvent(0x2, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when there is a change in the Reachable attribute. Its purpose is to
       * provide an indication towards interested parties that the reachability of a bridged device (over the
       * non-Matter network) has changed, so they may take appropriate action.
       *
       * After (re)start of a bridge this event may be generated.
       *
       * @see {@link MatterSpecification.v11.Core} § 9.13.5.1
       */
      reachableChanged: Event(0x3, EventPriority.Info, TlvReachableChangedEvent),
    },
  });

  /**
   * Bridged Device Basic Information
   *
   * This Cluster serves two purposes towards a Node communicating with a Bridge:
   *
   *   • Indicate that the functionality on the Endpoint where it is placed (and its Parts) is bridged from a
   *     non-Matter technology, and
   *
   *   • Provide a centralized collection of attributes that the Node may collect to aid in conveying information
   *     regarding the Bridged Device to a user, such as the vendor name, the model name, or user-assigned name.
   *
   * This cluster shall be exposed by a Bridge on the Endpoint representing each Bridged Device. When the
   * functionality of a Bridged Device is represented using a set of Endpoints, this cluster shall only be exposed on
   * the Endpoint which is at the top of the hierarchy for the functionality of that Bridged Device.
   *
   * This cluster shall NOT be used on an endpoint that is not in the Descriptor cluster PartsList of an endpoint
   * with an Aggregator device type.
   *
   * This cluster has been derived from the Basic Information Cluster, and provides generic information about the
   * Bridged Device. Not all of the attributes in the Basic Information Cluster are relevant for a Bridged Device
   * (e.g. ProductID since it is not a Matter device). For other attributes, the information which is listed as
   * Mandatory for the Basic Information Cluster, may not be available when the Bridged Device does not provide it to
   * the Bridge, and the Bridge has no other means to determine it. For such cases where the information for a
   * particular attribute is not available, the Bridge SHOULD NOT include the attribute in the cluster for this
   * Bridged Device. See below for Conformance details.
   *
   * @see {@link MatterSpecification.v11.Core} § 9.13
   */

  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type BridgedDeviceBasicInformationCluster = BridgedDeviceBasicInformation.Cluster;
export const BridgedDeviceBasicInformationCluster = BridgedDeviceBasicInformation.Cluster;
ClusterRegistry.register(BridgedDeviceBasicInformation.Complete);
