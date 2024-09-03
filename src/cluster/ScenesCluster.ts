/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { AccessLevel, ClusterRegistry, Command, MutableCluster, OptionalAttribute, OptionalCommand, TlvNoResponse } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { GroupId, TlvAttributeId, TlvClusterId, TlvGroupId, TlvNodeId } from '@project-chip/matter-node.js/datatype';
import { StatusCode } from '@project-chip/matter-node.js/interaction';
import { BitField, BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvObject, TlvField, TypeFromSchema, TlvEnum, TlvBoolean, TlvOptionalField, TlvUInt8, TlvNullable, TlvBitmap, TlvAny, TlvUInt16, TlvString, TlvArray } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace Scenes {
  /**
   * The value of the Scenes nameSupport attribute
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.5
   */
  export const NameSupport = {
    /**
     * The ability to store a name for a scene.
     */
    nameSupport: BitFlag(7),
  };

  /**
   * This data type indicates a combination of an identifier and the value of an attribute.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.6.1
   */
  export const TlvAttributeValuePair = TlvObject({
    /**
     * This field shall be present or not present, for all instances in the Scenes cluster. If this field is not
     * present, then the data type of AttributeValue shall be determined by the order and data type defined in the
     * cluster specification. Otherwise the data type of AttributeValue shall be the data type of the attribute
     * indicated by AttributeID.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.6.1.1
     */
    attributeId: TlvOptionalField(0, TlvAttributeId),

    /**
     * This is the attribute value as part of an extension field set. See AttributeID to determine the data type
     * for this field.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.6.1.2
     */
    attributeValue: TlvField(1, TlvAny),
  });

  /**
   * This data type indicates a combination of an identifier and the value of an attribute.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.6.1
   */
  export interface AttributeValuePair extends TypeFromSchema<typeof TlvAttributeValuePair> {}

  /**
   * This data type indicates for a given cluster a set of attributes and their values. Only attributes which have
   * the "S" designation in the Quality column of the cluster specification shall be used in the AttributeValueList
   * field.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.6.2
   */
  export const TlvExtensionFieldSet = TlvObject({
    clusterId: TlvField(0, TlvClusterId),
    attributeValueList: TlvField(1, TlvArray(TlvAttributeValuePair)),
  });

  /**
   * This data type indicates for a given cluster a set of attributes and their values. Only attributes which have
   * the "S" designation in the Quality column of the cluster specification shall be used in the AttributeValueList
   * field.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.6.2
   */
  export interface ExtensionFieldSet extends TypeFromSchema<typeof TlvExtensionFieldSet> {}

  /**
   * Input to the Scenes addScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.2
   */
  export const TlvAddSceneRequest = TlvObject({
    groupId: TlvField(0, TlvGroupId),
    sceneId: TlvField(1, TlvUInt8),
    transitionTime: TlvField(2, TlvUInt16),
    sceneName: TlvField(3, TlvString.bound({ maxLength: 16 })),
    extensionFieldSets: TlvField(4, TlvArray(TlvExtensionFieldSet)),
  });

  /**
   * Input to the Scenes addScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.2
   */
  export interface AddSceneRequest extends TypeFromSchema<typeof TlvAddSceneRequest> {}

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.12
   */
  export const TlvAddSceneResponse = TlvObject({
    status: TlvField(0, TlvEnum<StatusCode>()),
    groupId: TlvField(1, TlvGroupId),
    sceneId: TlvField(2, TlvUInt8),
  });

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.12
   */
  export interface AddSceneResponse extends TypeFromSchema<typeof TlvAddSceneResponse> {}

  /**
   * Input to the Scenes viewScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.3
   */
  export const TlvViewSceneRequest = TlvObject({ groupId: TlvField(0, TlvGroupId), sceneId: TlvField(1, TlvUInt8) });

  /**
   * Input to the Scenes viewScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.3
   */
  export interface ViewSceneRequest extends TypeFromSchema<typeof TlvViewSceneRequest> {}

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.13
   */
  export const TlvViewSceneResponse = TlvObject({
    status: TlvField(0, TlvEnum<StatusCode>()),
    groupId: TlvField(1, TlvGroupId),
    sceneId: TlvField(2, TlvUInt8),
    transitionTime: TlvOptionalField(3, TlvUInt16),
    sceneName: TlvOptionalField(4, TlvString.bound({ maxLength: 16 })),
    extensionFieldSets: TlvOptionalField(5, TlvArray(TlvExtensionFieldSet)),
  });

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.13
   */
  export interface ViewSceneResponse extends TypeFromSchema<typeof TlvViewSceneResponse> {}

  /**
   * Input to the Scenes removeScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.4
   */
  export const TlvRemoveSceneRequest = TlvObject({
    groupId: TlvField(0, TlvGroupId),
    sceneId: TlvField(1, TlvUInt8),
  });

  /**
   * Input to the Scenes removeScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.4
   */
  export interface RemoveSceneRequest extends TypeFromSchema<typeof TlvRemoveSceneRequest> {}

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.14
   */
  export const TlvRemoveSceneResponse = TlvObject({
    status: TlvField(0, TlvEnum<StatusCode>()),
    groupId: TlvField(1, TlvGroupId),
    sceneId: TlvField(2, TlvUInt8),
  });

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.14
   */
  export interface RemoveSceneResponse extends TypeFromSchema<typeof TlvRemoveSceneResponse> {}

  /**
   * Input to the Scenes removeAllScenes command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.5
   */
  export const TlvRemoveAllScenesRequest = TlvObject({ groupId: TlvField(0, TlvGroupId) });

  /**
   * Input to the Scenes removeAllScenes command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.5
   */
  export interface RemoveAllScenesRequest extends TypeFromSchema<typeof TlvRemoveAllScenesRequest> {}

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.15
   */
  export const TlvRemoveAllScenesResponse = TlvObject({
    status: TlvField(0, TlvEnum<StatusCode>()),
    groupId: TlvField(1, TlvGroupId),
  });

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.15
   */
  export interface RemoveAllScenesResponse extends TypeFromSchema<typeof TlvRemoveAllScenesResponse> {}

  /**
   * Input to the Scenes storeScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.6
   */
  export const TlvStoreSceneRequest = TlvObject({ groupId: TlvField(0, TlvGroupId), sceneId: TlvField(1, TlvUInt8) });

  /**
   * Input to the Scenes storeScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.6
   */
  export interface StoreSceneRequest extends TypeFromSchema<typeof TlvStoreSceneRequest> {}

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.16
   */
  export const TlvStoreSceneResponse = TlvObject({
    status: TlvField(0, TlvEnum<StatusCode>()),
    groupId: TlvField(1, TlvGroupId),
    sceneId: TlvField(2, TlvUInt8),
  });

  /**
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.16
   */
  export interface StoreSceneResponse extends TypeFromSchema<typeof TlvStoreSceneResponse> {}

  /**
   * Input to the Scenes recallScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.7
   */
  export const TlvRecallSceneRequest = TlvObject({
    groupId: TlvField(0, TlvGroupId),
    sceneId: TlvField(1, TlvUInt8),
    transitionTime: TlvOptionalField(2, TlvNullable(TlvUInt16)),
  });

  /**
   * Input to the Scenes recallScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.7
   */
  export interface RecallSceneRequest extends TypeFromSchema<typeof TlvRecallSceneRequest> {}

  /**
   * Input to the Scenes getSceneMembership command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.8
   */
  export const TlvGetSceneMembershipRequest = TlvObject({ groupId: TlvField(0, TlvGroupId) });

  /**
   * Input to the Scenes getSceneMembership command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.8
   */
  export interface GetSceneMembershipRequest extends TypeFromSchema<typeof TlvGetSceneMembershipRequest> {}

  /**
   * The fields of the get scene membership response command have the following semantics:
   *
   * The Capacity field shall contain the remaining capacity of the Scene Table of the server (for all groups). The
   * following values apply:
   *
   *   • 0 - No further scenes may be added.
   *
   *   • 0 < Capacity < 0xfe - Capacity holds the number of scenes that may be added.
   *
   *   • 0xfe - At least 1 further scene may be added (exact number is unknown).
   *
   *   • null - It is unknown if any further scenes may be added.
   *
   * The Status field shall contain SUCCESS or ILLEGAL_COMMAND (the endpoint is not a member of the group) as
   * appropriate.
   *
   * The GroupID field shall be set to the corresponding field of the received GetSceneMembership command.
   *
   * If the status is not SUCCESS then the SceneList field shall be omitted, else the SceneList field shall contain
   * the identifiers of all the scenes in the Scene Table with the corresponding Group ID.
   *
   * Zigbee: If the total number of scenes associated with this Group ID will cause the maximum payload length of a
   * frame to be exceeded, then the SceneList field shall contain only as many scenes as will fit.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.17
   */
  export const TlvGetSceneMembershipResponse = TlvObject({
    status: TlvField(0, TlvEnum<StatusCode>()),
    capacity: TlvField(1, TlvNullable(TlvUInt8)),
    groupId: TlvField(2, TlvGroupId),
    sceneList: TlvOptionalField(3, TlvArray(TlvUInt8)),
  });

  /**
   * The fields of the get scene membership response command have the following semantics:
   *
   * The Capacity field shall contain the remaining capacity of the Scene Table of the server (for all groups). The
   * following values apply:
   *
   *   • 0 - No further scenes may be added.
   *
   *   • 0 < Capacity < 0xfe - Capacity holds the number of scenes that may be added.
   *
   *   • 0xfe - At least 1 further scene may be added (exact number is unknown).
   *
   *   • null - It is unknown if any further scenes may be added.
   *
   * The Status field shall contain SUCCESS or ILLEGAL_COMMAND (the endpoint is not a member of the group) as
   * appropriate.
   *
   * The GroupID field shall be set to the corresponding field of the received GetSceneMembership command.
   *
   * If the status is not SUCCESS then the SceneList field shall be omitted, else the SceneList field shall contain
   * the identifiers of all the scenes in the Scene Table with the corresponding Group ID.
   *
   * Zigbee: If the total number of scenes associated with this Group ID will cause the maximum payload length of a
   * frame to be exceeded, then the SceneList field shall contain only as many scenes as will fit.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.17
   */
  export interface GetSceneMembershipResponse extends TypeFromSchema<typeof TlvGetSceneMembershipResponse> {}

  /**
   * The value of Scenes.mode
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11.1
   */
  export const Mode = { copyAllScenes: BitFlag(0), reserved: BitField(1, 7) };

  /**
   * Input to the Scenes copyScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11
   */
  export const TlvCopySceneRequest = TlvObject({
    /**
     * The Mode field contains information of how the scene copy is to proceed. This field shall be formatted as
     * illustrated in Format of the Mode Field of the CopyScene Command.
     *
     * The CopyAllScenes subfield is 1-bit in length and indicates whether all scenes are to be copied. If this
     * value is set to 1, all scenes are to be copied and the SceneIdentifierFrom and SceneIdentifierTo fields
     * shall be ignored. Otherwise this field is set to 0.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11.1
     */
    mode: TlvField(0, TlvBitmap(TlvUInt8, Mode)),

    /**
     * The GroupIdentifierFrom field specifies the identifier of the group from which the scene is to be copied.
     * Together with the SceneIdentifierFrom field, this field uniquely identifies the scene to copy from the Scene
     * Table.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11.2
     */
    groupIdentifierFrom: TlvField(1, TlvGroupId),

    /**
     * The SceneIdentifierFrom field specifies the identifier of the scene from which the scene is to be copied.
     * Together with the GroupIdentifierFrom field, this field uniquely identifies the scene to copy from the Scene
     * Table.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11.3
     */
    sceneIdentifierFrom: TlvField(2, TlvUInt8),

    /**
     * The GroupIdentifierTo field specifies the identifier of the group to which the scene is to be copied.
     * Together with the SceneIdentifierTo field, this field uniquely identifies the scene to copy to the Scene
     * Table.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11.4
     */
    groupIdentifierTo: TlvField(3, TlvGroupId),

    /**
     * The SceneIdentifierTo field specifies the identifier of the scene to which the scene is to be copied.
     * Together with the GroupIdentifierTo field, this field uniquely identifies the scene to copy to the Scene
     * Table.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11.5
     */
    sceneIdentifierTo: TlvField(4, TlvUInt8),
  });

  /**
   * Input to the Scenes copyScene command
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11
   */
  export interface CopySceneRequest extends TypeFromSchema<typeof TlvCopySceneRequest> {}

  /**
   * The CopySceneResponse command allows a server to respond to a CopyScene command.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.20
   */
  export const TlvCopySceneResponse = TlvObject({
    /**
     * The Status field contains the status of the copy scene attempt. This field shall be set to one of the
     * non-reserved values listed in Values of the Status Field of the CopySceneResponse Command.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.20.1
     */
    status: TlvField(0, TlvEnum<StatusCode>()),

    /**
     * The GroupIdentifierFrom field specifies the identifier of the group from which the scene was copied, as
     * specified in the CopyScene command. Together with the SceneIdentifierFrom field, this field uniquely
     * identifies the scene that was copied from the Scene Table.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.20.2
     */
    groupIdentifierFrom: TlvField(1, TlvGroupId),

    /**
     * The SceneIdentifierFrom field is specifies the identifier of the scene from which the scene was copied, as
     * specified in the CopyScene command. Together with the GroupIdentifierFrom field, this field uniquely
     * identifies the scene that was copied from the Scene Table.
     *
     * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.20.3
     */
    sceneIdentifierFrom: TlvField(2, TlvUInt8),
  });

  /**
   * The CopySceneResponse command allows a server to respond to a CopyScene command.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.20
   */
  export interface CopySceneResponse extends TypeFromSchema<typeof TlvCopySceneResponse> {}

  /**
   * These are optional features supported by ScenesCluster.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4.4
   */
  export enum Feature {
    /**
     * SceneNames
     *
     * The ability to store a name for a scene.
     */
    SceneNames = 'SceneNames',
  }

  /**
   * These elements and properties are present in all Scenes clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x5,
    name: 'Scenes',
    revision: 4,

    features: {
      /**
       * SceneNames
       *
       * The ability to store a name for a scene.
       */
      sceneNames: BitFlag(0),
    },

    attributes: {
      /**
       * The SceneCount attribute specifies the number of scenes currently in the server’s Scene Table.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.1
       */
      sceneCount: Attribute(0x0, TlvUInt8, { default: 0 }),

      /**
       * The CurrentScene attribute holds the scene identifier of the scene last invoked.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.2
       */
      currentScene: Attribute(0x1, TlvUInt8, { default: 0 }),

      /**
       * The CurrentGroup attribute holds the group identifier of the scene last invoked, or 0 if the scene last
       * invoked is not associated with a group.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.3
       */
      currentGroup: Attribute(0x2, TlvGroupId, { default: GroupId(0) }),

      /**
       * The SceneValid attribute indicates whether the state of the server corresponds to that associated with
       * the CurrentScene and CurrentGroup attributes. TRUE indicates that these attributes are valid, FALSE
       * indicates that they are not valid.
       *
       * Before a scene has been stored or recalled, this attribute is set to FALSE. After a successful
       * StoreScene or RecallScene command it is set to TRUE. If, after a scene is stored or recalled, the state
       * of the server is modified, this attribute is set to FALSE.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.4
       */
      sceneValid: Attribute(0x3, TlvBoolean, { default: true }),

      /**
       * This attribute provides legacy, read-only access to whether the Scene Names feature is supported. The
       * most significant bit, bit 7, shall be equal to bit 0 of the FeatureMap attribute. All other bits shall
       * be 0.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.5
       */
      nameSupport: Attribute(0x4, TlvBitmap(TlvUInt8, NameSupport)),

      /**
       * The LastConfiguredBy attribute holds the Node ID (the IEEE address in case of Zigbee) of the node that
       * last configured the Scene Table.
       *
       * The null value indicates that the server has not been configured, or that the identifier of the node
       * that last configured the Scenes cluster is not known.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.7.6
       */
      lastConfiguredBy: OptionalAttribute(0x5, TlvNullable(TlvNodeId), { default: null }),
    },

    commands: {
      /**
       * It is not mandatory for an extension field set to be included in the command for every cluster on that
       * endpoint that has a defined extension field set. Extension field sets may be omitted, including the case
       * of no extension field sets at all.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.2
       */
      addScene: Command(0x0, TlvAddSceneRequest, 0x0, TlvAddSceneResponse, { invokeAcl: AccessLevel.Manage }),

      /**
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.3
       */
      viewScene: Command(0x1, TlvViewSceneRequest, 0x1, TlvViewSceneResponse),

      /**
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.4
       */
      removeScene: Command(0x2, TlvRemoveSceneRequest, 0x2, TlvRemoveSceneResponse, { invokeAcl: AccessLevel.Manage }),

      /**
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.5
       */
      removeAllScenes: Command(0x3, TlvRemoveAllScenesRequest, 0x3, TlvRemoveAllScenesResponse, { invokeAcl: AccessLevel.Manage }),

      /**
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.6
       */
      storeScene: Command(0x4, TlvStoreSceneRequest, 0x4, TlvStoreSceneResponse, { invokeAcl: AccessLevel.Manage }),

      /**
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.7
       */
      recallScene: Command(0x5, TlvRecallSceneRequest, 0x5, TlvNoResponse),

      /**
       * The GetSceneMembership command can be used to find an unused scene identifier within a certain group
       * when no commissioning tool is in the network, or for a commissioning tool to get the used scene
       * identifiers within a certain group, for the endpoint that implements this cluster.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.8
       */
      getSceneMembership: Command(0x6, TlvGetSceneMembershipRequest, 0x6, TlvGetSceneMembershipResponse),

      /**
       * The EnhancedAddScene command allows a scene to be added using a finer scene transition time than the
       * AddScene command.
       *
       * This command shall have the same data fields as the AddScene command, with the following difference:
       *
       * The TransitionTime data field shall be measured in tenths of a second rather than in seconds.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.9
       */
      enhancedAddScene: OptionalCommand(0x40, TlvAddSceneRequest, 0x40, TlvAddSceneResponse, { invokeAcl: AccessLevel.Manage }),

      /**
       * The EnhancedViewScene command allows a scene to be retrieved using a finer scene transition time than
       * the ViewScene command.
       *
       * This command shall have the same data fields as the ViewScene command.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.10
       */
      enhancedViewScene: OptionalCommand(0x41, TlvViewSceneRequest, 0x41, TlvViewSceneResponse),

      /**
       * The CopyScene command allows a client to efficiently copy scenes from one group/scene identifier pair to
       * another group/scene identifier pair.
       *
       * @see {@link MatterSpecification.v11.Cluster} § 1.4.9.11
       */
      copyScene: OptionalCommand(0x42, TlvCopySceneRequest, 0x42, TlvCopySceneResponse, { invokeAcl: AccessLevel.Manage }),
    },

    /**
     * This metadata controls which ScenesCluster elements matter.js activates for specific feature combinations.
     */
    extensions: MutableCluster.Extensions(),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster({ ...Base, supportedFeatures: { sceneNames: true } });

  /**
   * Scenes
   *
   * The Scenes cluster provides attributes and commands for setting up and recalling scenes. Each scene corresponds
   * to a set of stored values of specified attributes for one or more clusters on the same end point as the Scenes
   * cluster.
   *
   * In most cases scenes are associated with a particular group identifier. Scenes may also exist without a group,
   * in which case the value 0 replaces the group identifier. Note that extra care is required in these cases to
   * avoid a scene identifier collision, and that commands related to scenes without a group may only be unicast,
   * i.e., they may not be multicast or broadcast.
   *
   * In a network supporting fabrics, scenes are scoped to the accessing fabric. When storing scene information,
   * implementations need to take care of this.
   *
   * NOTE Support for Scenes cluster is provisional.
   *
   * ScenesCluster supports optional features that you can enable with the ScenesCluster.with() factory method.
   *
   * @see {@link MatterSpecification.v11.Cluster} § 1.4
   */
  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type ScenesCluster = Scenes.Cluster;
export const ScenesCluster = Scenes.Cluster;
ClusterRegistry.register(Scenes.Complete);
