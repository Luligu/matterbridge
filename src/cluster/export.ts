// Nothing to export right now

/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */

import { Identity } from '@matter/main';
import { ModeBase } from '@matter/main/clusters/mode-base';
import {
  Attribute,
  BitFlag,
  ClusterRegistry,
  Command,
  Event,
  EventPriority,
  FixedAttribute,
  MutableCluster,
  OptionalAttribute,
  OptionalCommand,
  OptionalEvent,
  TlvArray,
  TlvEnum,
  TlvField,
  TlvNoArguments,
  TlvNullable,
  TlvObject,
  TlvOptionalField,
  TlvString,
  TlvUInt32,
  TlvUInt8,
  TlvVendorId,
  TypeFromSchema,
  WritableAttribute,
} from '@matter/main/types';

import { OperationalState as OperationalStateNamespace } from '@matter/main/clusters/operational-state';

export namespace RvcRunMode {
  /**
   * These are optional features supported by RvcRunModeCluster.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.2.4
   */
  export enum Feature {
    /**
     * OnOff (DEPONOFF)
     *
     * Dependency with the OnOff cluster
     */
    OnOff = 'OnOff',
  }

  export enum ModeTag {
    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Auto = 0,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Quick = 1,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Quiet = 2,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    LowNoise = 3,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    LowEnergy = 4,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Vacation = 5,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Min = 6,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Max = 7,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Night = 8,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2
     */
    Day = 9,

    /**
     * The device is not performing any of the main operations of the other modes. However, auxiliary actions, such
     * as seeking the charger or charging, may occur.
     *
     * For example, the device has completed cleaning, successfully or not, on its own or due to a command, or has
     * not been asked to clean after a restart.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2.1
     */
    Idle = 16384,

    /**
     * The device was asked to clean so it may be actively running, or paused due to an error, due to a pause
     * command, or for recharging etc. If currently paused and the device can resume it will continue to clean.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2.2
     */
    Cleaning = 16385,

    /**
     * The device was asked to create a map of the space it is located in, so it may be actively running, or paused
     * due to an error, due to a pause command, or for recharging etc. If currently paused and the device can
     * resume, it will continue to map.
     *
     * NOTE
     *
     * this mode is intended to be used so the current space can be mapped by the device if the robot has not
     * previously done that, or if the layout has substantially changed, for an optimal subsequent cleaning
     * experience.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.2.3
     */
    Mapping = 16386,
  }

  /**
   * A Mode Tag is meant to be interpreted by the client for the purpose the cluster serves.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1
   */
  export const TlvModeTagStruct = TlvObject({
    /**
     * If the MfgCode field exists, the Value field shall be in the manufacturer-specific value range (see Section
     * 1.10.8, “Mode Namespace”).
     *
     * This field shall indicate the manufacturer’s VendorID and it shall determine the meaning of the Value field.
     *
     * The same manufacturer code and mode tag value in separate cluster instances are part of the same namespace
     * and have the same meaning. For example: a manufacturer tag meaning "pinch" can be used both in a cluster
     * whose purpose is to choose the amount of sugar, or in a cluster whose purpose is to choose the amount of
     * salt.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1.1
     */
    mfgCode: TlvOptionalField(0, TlvVendorId),

    /**
     * This field shall indicate the mode tag within a mode tag namespace which is either manufacturer specific or
     * standard.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1.2
     */
    value: TlvField(1, TlvEnum<ModeTag | ModeBase.ModeTag>()),
  });

  /**
   * A Mode Tag is meant to be interpreted by the client for the purpose the cluster serves.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1
   */
  export interface ModeTagStruct extends TypeFromSchema<typeof TlvModeTagStruct> {}

  /**
   * The table below lists the changes relative to the Mode Base cluster for the fields of the ModeOptionStruct type.
   * A blank field indicates no change.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.2.5.1
   */
  export const TlvModeOption = TlvObject({
    /**
     * This field shall indicate readable text that describes the mode option, so that a client can provide it to
     * the user to indicate what this option means. This field is meant to be readable and understandable by the
     * user.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.2.1
     */
    label: TlvField(0, TlvString.bound({ maxLength: 64 })),

    /**
     * This field is used to identify the mode option.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.2.2
     */
    mode: TlvField(1, TlvUInt8),

    /**
     * This field shall contain a list of tags that are associated with the mode option. This may be used by clients
     * to determine the full or the partial semantics of a certain mode, depending on which tags they understand,
     * using standard definitions and/or manufacturer specific namespace definitions.
     *
     * The standard mode tags are defined in this cluster specification. For the derived cluster instances, if the
     * specification of the derived cluster defines a namespace, the set of standard mode tags also includes the
     * mode tag values from that namespace.
     *
     * Mode tags can help clients look for options that meet certain criteria, render the user interface, use
     *
     * the mode in an automation, or to craft help text their voice-driven interfaces. A mode tag shall be either a
     * standard tag or a manufacturer specific tag, as defined in each ModeTagStruct list entry.
     *
     * A mode option may have more than one mode tag. A mode option may be associated with a mixture of standard and
     * manufacturer specific mode tags. A mode option shall be associated with at least one standard mode tag.
     *
     * A few examples are provided below.
     *
     *   • A mode named "100%" can have both the High (manufacturer specific) and Max (standard) mode tag. Clients
     *     seeking the mode for either High or Max will find the same mode in this case.
     *
     *   • A mode that includes a LowEnergy tag can be displayed by the client using a widget icon that shows a
     *     green leaf.
     *
     *   • A mode that includes a LowNoise tag may be used by the client when the user wishes for a lower level of
     *     audible sound, less likely to disturb the household’s activities.
     *
     *   • A mode that includes a LowEnergy tag (standard, defined in this cluster specification) and also a
     *     Delicate tag (standard, defined in the namespace of a Laundry Mode derived cluster).
     *
     *   • A mode that includes both a generic Quick tag (defined here), and Vacuum and Mop tags, (defined in the
     *     RVC Clean cluster that is a derivation of this cluster).
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.2.3
     */
    modeTags: TlvField(2, TlvArray(TlvModeTagStruct, { maxLength: 8 })),
  });

  /**
   * The table below lists the changes relative to the Mode Base cluster for the fields of the ModeOptionStruct type.
   * A blank field indicates no change.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.2.5.1
   */
  export interface ModeOption extends TypeFromSchema<typeof TlvModeOption> {}

  export enum ModeChangeStatus {
    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    Stuck = 65,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    DustBinMissing = 66,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    DustBinFull = 67,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    WaterTankEmpty = 68,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    WaterTankMissing = 69,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    WaterTankLidOpen = 70,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    MopCleaningPadMissing = 71,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.2.7.1
     */
    BatteryLow = 72,
  }

  export const OnOffComponent = MutableCluster.Component({
    attributes: {
      startUpMode: WritableAttribute(0x2, TlvNullable(TlvUInt8), { persistent: true }),
      onMode: WritableAttribute(0x3, TlvNullable(TlvUInt8), { persistent: true, default: null }),
    },
  });

  /**
   * These elements and properties are present in all RvcRunMode clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x54,
    name: 'RvcRunMode',
    revision: 3,

    features: {
      /**
       * OnOff
       *
       * Dependency with the OnOff cluster
       */
      onOff: BitFlag(0),
    },

    attributes: {
      /**
       * At least one entry in the SupportedModes attribute shall include the Idle mode tag in the ModeTags field.
       *
       * At least one entry in the SupportedModes attribute (different from the one above) shall include the
       * Cleaning mode tag in the ModeTags field.
       *
       * The Mapping, Cleaning, and Idle mode tags are mutually exclusive and shall NOT be used together in a
       * mode’s ModeTags.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 7.2.6.1
       */
      supportedModes: FixedAttribute(0x0, TlvArray(TlvModeOption, { minLength: 2, maxLength: 255 }), { default: [] }),

      /**
       * @see {@link MatterSpecification.v14.Cluster} § 7.2.6
       */
      currentMode: Attribute(0x1, TlvUInt8, { persistent: true }),
    },

    commands: {
      /**
       * This command is used to change device modes.
       *
       * On receipt of this command the device shall respond with a ChangeToModeResponse command.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.10.7.1
       */
      changeToMode: Command(0x0, ModeBase.TlvChangeToModeRequest, 0x1, ModeBase.TlvChangeToModeResponse),
    },

    /**
     * This metadata controls which RvcRunModeCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions({ flags: { onOff: true }, component: OnOffComponent }),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster(Base);

  /**
   * This cluster is derived from the Mode Base cluster and defines additional mode tags and namespaced enumerated
   * values for the running modes of robotic vacuum cleaner devices.
   *
   * RvcRunModeCluster supports optional features that you can enable with the RvcRunModeCluster.with() factory
   * method.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.2
   */
  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type RvcRunModeCluster = RvcRunMode.Cluster;
export const RvcRunModeCluster = RvcRunMode.Cluster;
ClusterRegistry.register(RvcRunMode.Complete);

export namespace RvcCleanMode {
  /**
   * These are optional features supported by RvcCleanModeCluster.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.3.4
   */
  export enum Feature {
    /**
     * OnOff (DEPONOFF)
     *
     * Dependency with the OnOff cluster
     */
    OnOff = 'OnOff',
  }

  export enum ModeTag {
    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Auto = 0,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Quick = 1,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Quiet = 2,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    LowNoise = 3,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    LowEnergy = 4,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Vacation = 5,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Min = 6,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Max = 7,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Night = 8,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    Day = 9,

    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2
     */
    DeepClean = 16384,

    /**
     * The device’s vacuuming feature is enabled in this mode.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2.2
     */
    Vacuum = 16385,

    /**
     * The device’s mopping feature is enabled in this mode.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.2.3
     */
    Mop = 16386,
  }

  /**
   * A Mode Tag is meant to be interpreted by the client for the purpose the cluster serves.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1
   */
  export const TlvModeTagStruct = TlvObject({
    /**
     * If the MfgCode field exists, the Value field shall be in the manufacturer-specific value range (see Section
     * 1.10.8, “Mode Namespace”).
     *
     * This field shall indicate the manufacturer’s VendorID and it shall determine the meaning of the Value field.
     *
     * The same manufacturer code and mode tag value in separate cluster instances are part of the same namespace
     * and have the same meaning. For example: a manufacturer tag meaning "pinch" can be used both in a cluster
     * whose purpose is to choose the amount of sugar, or in a cluster whose purpose is to choose the amount of
     * salt.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1.1
     */
    mfgCode: TlvOptionalField(0, TlvVendorId),

    /**
     * This field shall indicate the mode tag within a mode tag namespace which is either manufacturer specific or
     * standard.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1.2
     */
    value: TlvField(1, TlvEnum<ModeTag | ModeBase.ModeTag>()),
  });

  /**
   * A Mode Tag is meant to be interpreted by the client for the purpose the cluster serves.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.1
   */
  export interface ModeTagStruct extends TypeFromSchema<typeof TlvModeTagStruct> {}

  /**
   * The table below lists the changes relative to the Mode Base cluster for the fields of the ModeOptionStruct type.
   * A blank field indicates no change.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.3.5.1
   */
  export const TlvModeOption = TlvObject({
    /**
     * This field shall indicate readable text that describes the mode option, so that a client can provide it to
     * the user to indicate what this option means. This field is meant to be readable and understandable by the
     * user.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.2.1
     */
    label: TlvField(0, TlvString.bound({ maxLength: 64 })),

    /**
     * This field is used to identify the mode option.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.2.2
     */
    mode: TlvField(1, TlvUInt8),

    /**
     * This field shall contain a list of tags that are associated with the mode option. This may be used by clients
     * to determine the full or the partial semantics of a certain mode, depending on which tags they understand,
     * using standard definitions and/or manufacturer specific namespace definitions.
     *
     * The standard mode tags are defined in this cluster specification. For the derived cluster instances, if the
     * specification of the derived cluster defines a namespace, the set of standard mode tags also includes the
     * mode tag values from that namespace.
     *
     * Mode tags can help clients look for options that meet certain criteria, render the user interface, use
     *
     * the mode in an automation, or to craft help text their voice-driven interfaces. A mode tag shall be either a
     * standard tag or a manufacturer specific tag, as defined in each ModeTagStruct list entry.
     *
     * A mode option may have more than one mode tag. A mode option may be associated with a mixture of standard and
     * manufacturer specific mode tags. A mode option shall be associated with at least one standard mode tag.
     *
     * A few examples are provided below.
     *
     *   • A mode named "100%" can have both the High (manufacturer specific) and Max (standard) mode tag. Clients
     *     seeking the mode for either High or Max will find the same mode in this case.
     *
     *   • A mode that includes a LowEnergy tag can be displayed by the client using a widget icon that shows a
     *     green leaf.
     *
     *   • A mode that includes a LowNoise tag may be used by the client when the user wishes for a lower level of
     *     audible sound, less likely to disturb the household’s activities.
     *
     *   • A mode that includes a LowEnergy tag (standard, defined in this cluster specification) and also a
     *     Delicate tag (standard, defined in the namespace of a Laundry Mode derived cluster).
     *
     *   • A mode that includes both a generic Quick tag (defined here), and Vacuum and Mop tags, (defined in the
     *     RVC Clean cluster that is a derivation of this cluster).
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.10.5.2.3
     */
    modeTags: TlvField(2, TlvArray(TlvModeTagStruct, { maxLength: 8 })),
  });

  /**
   * The table below lists the changes relative to the Mode Base cluster for the fields of the ModeOptionStruct type.
   * A blank field indicates no change.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.3.5.1
   */
  export interface ModeOption extends TypeFromSchema<typeof TlvModeOption> {}

  export enum ModeChangeStatus {
    /**
     * @see {@link MatterSpecification.v14.Cluster} § 7.3.7.1
     */
    CleaningInProgress = 64,
  }

  export const OnOffComponent = MutableCluster.Component({
    attributes: {
      startUpMode: WritableAttribute(0x2, TlvNullable(TlvUInt8), { persistent: true }),
      onMode: WritableAttribute(0x3, TlvNullable(TlvUInt8), { persistent: true, default: null }),
    },
  });

  /**
   * These elements and properties are present in all RvcCleanMode clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x55,
    name: 'RvcCleanMode',
    revision: 3,

    features: {
      /**
       * OnOff
       *
       * Dependency with the OnOff cluster
       */
      onOff: BitFlag(0),
    },

    attributes: {
      /**
       * At least one entry in the SupportedModes attribute shall include the Vacuum and/or the Mop mode tag in
       * the ModeTags field list.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 7.3.6.1
       */
      supportedModes: FixedAttribute(0x0, TlvArray(TlvModeOption, { minLength: 2, maxLength: 255 }), { default: [] }),

      /**
       * @see {@link MatterSpecification.v14.Cluster} § 7.3.6
       */
      currentMode: Attribute(0x1, TlvUInt8, { persistent: true }),
    },

    commands: {
      /**
       * This command is used to change device modes.
       *
       * On receipt of this command the device shall respond with a ChangeToModeResponse command.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.10.7.1
       */
      changeToMode: Command(0x0, ModeBase.TlvChangeToModeRequest, 0x1, ModeBase.TlvChangeToModeResponse),
    },

    /**
     * This metadata controls which RvcCleanModeCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions({ flags: { onOff: true }, component: OnOffComponent }),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster(Base);

  /**
   * This cluster is derived from the Mode Base cluster and defines additional mode tags and namespaced enumerated
   * values for the cleaning type of robotic vacuum cleaner devices.
   *
   * RvcCleanModeCluster supports optional features that you can enable with the RvcCleanModeCluster.with() factory
   * method.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.3
   */
  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type RvcCleanModeCluster = RvcCleanMode.Cluster;
export const RvcCleanModeCluster = RvcCleanMode.Cluster;
ClusterRegistry.register(RvcCleanMode.Complete);

export namespace RvcOperationalState {
  /**
   * The values defined herein are applicable to this derived cluster of Operational State only and are additional to
   * the set of values defined in Operational State itself.
   *
   * RVC Pause Compatibility defines the compatibility of the states this cluster defines with the Pause command.
   *
   * ### Table 13. RVC Pause Compatibility
   *
   * RVC Resume Compatibility defines the compatibility of the states this cluster defines with the Resume command.
   *
   * ### Table 14. RVC Resume Compatibility
   *
   * While in the Charging or Docked states, the device shall NOT attempt to resume unless it transitioned to those
   * states while operating and can resume, such as, for example, if it is recharging while in a cleaning cycle. Else,
   * if the operational state is Charging or Docked but there’s no operation to resume or the operation can’t be
   * resumed, the device shall respond with an OperationalCommandResponse command with an ErrorStateID of
   * CommandInvalidInState but take no further action.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.4.4.1
   */
  export enum OperationalState {
    /**
     * The device is stopped
     */
    Stopped = 0,

    /**
     * The device is operating
     */
    Running = 1,

    /**
     * The device is paused during an operation
     */
    Paused = 2,

    /**
     * The device is in an error state
     */
    Error = 3,

    /**
     * The device is en route to the charging dock
     */
    SeekingCharger = 64,

    /**
     * The device is charging
     */
    Charging = 65,

    /**
     * The device is on the dock, not charging
     */
    Docked = 66,
  }

  /**
   * The OperationalStateStruct is used to indicate a possible state of the device.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.2
   */
  export const TlvOperationalStateStruct = TlvObject({
    /**
     * This shall be populated with a value from the OperationalStateEnum.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.2.1
     */
    operationalStateId: TlvField(0, TlvEnum<OperationalState | OperationalStateNamespace.OperationalStateEnum>()),

    /**
     * This field shall be present if the OperationalStateID is from the set reserved for Manufacturer Specific
     * States, otherwise it shall NOT be present. If present, this shall contain a human-readable description of the
     * operational state.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.2.2
     */
    operationalStateLabel: TlvOptionalField(1, TlvString.bound({ maxLength: 64 })),
  });

  /**
   * The OperationalStateStruct is used to indicate a possible state of the device.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.2
   */
  export interface OperationalStateStruct extends TypeFromSchema<typeof TlvOperationalStateStruct> {}

  /**
   * The values defined herein are applicable to this derived cluster of Operational State only and are additional to
   * the set of values defined in Operational State itself.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.4.4.2
   */
  export enum ErrorState {
    /**
     * The device is not in an error state
     */
    NoError = 0,

    /**
     * The device is unable to start or resume operation
     */
    UnableToStartOrResume = 1,

    /**
     * The device was unable to complete the current operation
     */
    UnableToCompleteOperation = 2,

    /**
     * The device cannot process the command in its current state
     */
    CommandInvalidInState = 3,

    /**
     * The device has failed to find or reach the charging dock
     */
    FailedToFindChargingDock = 64,

    /**
     * The device is stuck and requires manual intervention
     */
    Stuck = 65,

    /**
     * The device has detected that its dust bin is missing
     */
    DustBinMissing = 66,

    /**
     * The device has detected that its dust bin is full
     */
    DustBinFull = 67,

    /**
     * The device has detected that its water tank is empty
     */
    WaterTankEmpty = 68,

    /**
     * The device has detected that its water tank is missing
     */
    WaterTankMissing = 69,

    /**
     * The device has detected that its water tank lid is open
     */
    WaterTankLidOpen = 70,

    /**
     * The device has detected that its cleaning pad is missing
     */
    MopCleaningPadMissing = 71,
  }

  /**
   * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.4
   */
  export const TlvErrorStateStruct = TlvObject({
    /**
     * This shall be populated with a value from the ErrorStateEnum.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.4.1
     */
    errorStateId: TlvField(0, TlvEnum<ErrorState | OperationalStateNamespace.ErrorState>()),

    /**
     * This field shall be present if the ErrorStateID is from the set reserved for Manufacturer Specific Errors,
     * otherwise it shall NOT be present. If present, this shall contain a human-readable description of the
     * ErrorStateID; e.g. for a manufacturer specific ErrorStateID of "0x80" the ErrorStateLabel may contain "My
     * special error".
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.4.2
     */
    errorStateLabel: TlvOptionalField(1, TlvString.bound({ maxLength: 64 })),

    /**
     * This shall be a human-readable string that provides details about the error condition. As an example, if the
     * ErrorStateID indicates that the device is a Robotic Vacuum that is stuck, the ErrorStateDetails contains
     * "left wheel blocked".
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.4.3
     */
    errorStateDetails: TlvOptionalField(2, TlvString.bound({ maxLength: 64 })),
  });

  /**
   * @see {@link MatterSpecification.v14.Cluster} § 1.14.4.4
   */
  export interface ErrorStateStruct extends TypeFromSchema<typeof TlvErrorStateStruct> {}

  /**
   * Input to the RvcOperationalState operationalCommandResponse command
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.4.5
   */
  export const TlvOperationalCommandResponse = TlvObject({
    /**
     * This shall indicate the success or otherwise of the attempted command invocation. On a successful invocation
     * of the attempted command, the ErrorStateID shall be populated with NoError. Please see the individual command
     * sections for additional specific requirements on population.
     *
     * @see {@link MatterSpecification.v14.Cluster} § 1.14.6.5.1
     */
    commandResponseState: TlvField(0, TlvErrorStateStruct),
  });

  /**
   * Input to the RvcOperationalState operationalCommandResponse command
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.4.5
   */
  export interface OperationalCommandResponse extends TypeFromSchema<typeof TlvOperationalCommandResponse> {}

  /**
   * Body of the RvcOperationalState operationalError event
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.14.7.1
   */
  export const TlvOperationalErrorEvent = TlvObject({ errorState: TlvField(0, TlvErrorStateStruct) });

  /**
   * Body of the RvcOperationalState operationalError event
   *
   * @see {@link MatterSpecification.v14.Cluster} § 1.14.7.1
   */
  export interface OperationalErrorEvent extends TypeFromSchema<typeof TlvOperationalErrorEvent> {}

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster({
    id: 0x61,
    name: 'RvcOperationalState',
    revision: 2,

    attributes: {
      /**
       * Indicates a list of names of different phases that the device can go through for the selected function or
       * mode. The list may not be in sequence order. For example in a washing machine this could include items
       * such as "pre-soak", "rinse", and "spin". These phases are manufacturer specific and may change when a
       * different function or mode is selected.
       *
       * A null value indicates that the device does not present phases during its operation. When this
       * attribute’s value is null, the CurrentPhase attribute shall also be set to null.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.5.1
       */
      phaseList: Attribute(0x0, TlvNullable(TlvArray(TlvString, { maxLength: 32 }))),

      /**
       * This attribute represents the current phase of operation being performed by the server. This shall be the
       * positional index representing the value from the set provided in the PhaseList Attribute,
       *
       * where the first item in that list is an index of 0. Thus, this attribute shall have a maximum value that
       * is "length(PhaseList) - 1".
       *
       * Null if the PhaseList attribute is null or if the PhaseList attribute is an empty list.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.5.2
       */
      currentPhase: Attribute(0x1, TlvNullable(TlvUInt8)),

      /**
       * Indicates the estimated time left before the operation is completed, in seconds.
       *
       * A value of 0 (zero) means that the operation has completed.
       *
       * A value of null represents that there is no time currently defined until operation completion. This may
       * happen, for example, because no operation is in progress or because the completion time is unknown.
       *
       * Changes to this attribute shall only be marked as reportable in the following cases:
       *
       *   • If it has changed due to a change in the CurrentPhase or OperationalState attributes, or
       *
       *   • When it changes from 0 to any other value and vice versa, or
       *
       *   • When it changes from null to any other value and vice versa, or
       *
       *   • When it increases, or
       *
       *   • When there is any increase or decrease in the estimated time remaining that was due to progressing
       *     insight of the server’s control logic, or
       *
       *   • When it changes at a rate significantly different from one unit per second.
       *
       * Changes to this attribute merely due to the normal passage of time with no other dynamic change of device
       * state shall NOT be reported.
       *
       * As this attribute is not being reported during a regular countdown, clients SHOULD NOT rely on the
       * reporting of this attribute in order to keep track of the remaining duration.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.5.3
       */
      countdownTime: OptionalAttribute(0x2, TlvNullable(TlvUInt32.bound({ max: 259200 })), { default: null }),

      /**
       * This attribute describes the set of possible operational states that the device exposes. An operational
       * state is a fundamental device state such as Running or Error. Details of the phase of a device when, for
       * example, in a state of Running are provided by the CurrentPhase attribute.
       *
       * All devices shall, at a minimum, expose the set of states matching the commands that are also supported
       * by the cluster instance, in addition to Error. The set of possible device states are defined in the
       * OperationalStateEnum. A device type requiring implementation of this cluster shall define the set of
       * states that are applicable to that specific device type.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.5.4
       */
      operationalStateList: Attribute(0x3, TlvArray(TlvOperationalStateStruct), { default: [] }),

      /**
       * This attribute specifies the current operational state of a device. This shall be populated with a valid
       * OperationalStateID from the set of values in the OperationalStateList Attribute.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.5.5
       */
      operationalState: Attribute(0x4, TlvEnum<OperationalState | OperationalStateNamespace.OperationalStateEnum>()),

      /**
       * This attribute shall specify the details of any current error condition being experienced on the device
       * when the OperationalState attribute is populated with Error. Please see ErrorStateStruct for general
       * requirements on the population of this attribute.
       *
       * When there is no error detected, this shall have an ErrorStateID of NoError.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.5.6
       */
      operationalError: Attribute(0x5, TlvErrorStateStruct),
    },

    commands: {
      pause: OptionalCommand(0x0, TlvNoArguments, 0x4, TlvOperationalCommandResponse),

      /**
       * This command shall be supported if the device supports remotely stopping the operation.
       *
       * On receipt of this command, the device shall stop its operation if it is at a position where it is safe
       * to do so and/or permitted. Restart of the device following the receipt of the Stop command shall require
       * attended operation unless remote start is allowed by the device type and any jurisdiction governing
       * remote operation of the device.
       *
       * If this command is received when already in the Stopped state the device shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of NoError but take no further action.
       *
       * A device that is unable to honor the Stop command for whatever reason shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of CommandInvalidInState but take no further
       * action.
       *
       * Otherwise, on success:
       *
       *   • The OperationalState attribute shall be set to Stopped.
       *
       *   • The device shall respond with an OperationalCommandResponse command with an ErrorStateID of NoError.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.6.2
       */
      stop: OptionalCommand(0x1, TlvNoArguments, 0x4, TlvOperationalCommandResponse),

      /**
       * This command shall be supported if the device supports remotely starting the operation. If this command
       * is supported, the 'Stop command shall also be supported.
       *
       * On receipt of this command, the device shall start its operation if it is safe to do so and the device is
       * in an operational state from which it can be started. There may be either regulatory or
       * manufacturer-imposed safety and security requirements that first necessitate some specific action at the
       * device before a Start command can be honored. In such instances, a device shall respond with a status
       * code of CommandInvalidInState if a Start command is received prior to the required on- device action.
       *
       * If this command is received when already in the Running state the device shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of NoError but take no further action.
       *
       * A device that is unable to honor the Start command for whatever reason shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of UnableToStartOrResume but take no further
       * action.
       *
       * Otherwise, on success:
       *
       *   • The OperationalState attribute shall be set to Running.
       *
       *   • The device shall respond with an OperationalCommandResponse command with an ErrorStateID of NoError.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.6.3
       */
      start: OptionalCommand(0x2, TlvNoArguments, 0x4, TlvOperationalCommandResponse),

      /**
       * This command shall be supported if the device supports remotely resuming the operation. If this command
       * is supported, the Pause command shall also be supported.
       *
       * On receipt of this command, the device shall resume its operation from the point it was at when it
       * received the Pause command, or from the point when it was paused by means outside of this cluster (for
       * example by manual button press).
       *
       * If this command is received when already in the Running state the device shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of NoError but take no further action.
       *
       * A device that receives this command in any state which is not Resume-compatible shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of CommandInvalidInState and shall take no
       * further action.
       *
       * States are defined as Resume-compatible as follows:
       *
       *   • For states defined in this cluster specification, in Table 4, “Resume Compatibility”.
       *
       *   • For states defined by derived cluster specifications, in the corresponding specifications.
       *
       *   • For manufacturer-specific states, by the manufacturer.
       *
       * The following table defines the compatibility of this cluster’s states with the Resume command.
       *
       * ### Table 4. Resume Compatibility
       *
       * A device that is unable to honor the Resume command for any other reason shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of UnableToStartOrResume but take no further
       * action.
       *
       * Otherwise, on success:
       *
       *   • The OperationalState attribute shall be set to the most recent non-Error operational state prior to
       *     entering the Paused state.
       *
       *   • The device shall respond with an OperationalCommandResponse command with an ErrorStateID of NoError.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.6.4
       */
      resume: OptionalCommand(0x3, TlvNoArguments, 0x4, TlvOperationalCommandResponse),
      /**
       * On receipt of this command, the device shall start seeking the charging dock, if possible in the current
       * state of the device.
       *
       * If this command is received when already in the SeekingCharger state the device shall respond with an
       * OperationalCommandResponse command with an ErrorStateID of NoError but the command shall have no other
       * effect.
       *
       * A device that receives this command in any state which does not allow seeking the charger, such as
       * Charging or Docked, shall respond with an OperationalCommandResponse command with an ErrorStateID of
       * CommandInvalidInState and shall have no other effect.
       *
       * Otherwise, on success:
       *
       *   • The OperationalState attribute shall be set to SeekingCharger.
       *
       *   • The device shall respond with an OperationalCommandResponse command with an ErrorStateID of NoError.
       *
       * @see {@link MatterSpecification.v14.Cluster} § 7.4.5.1
       */
      goHome: OptionalCommand(0x80, TlvNoArguments, 0x4, TlvOperationalCommandResponse),
    },

    events: {
      /**
       * This event is generated when a reportable error condition is detected. A device that generates this event
       * shall also set the OperationalState attribute to Error, indicating an error condition.
       *
       * This event shall contain the following fields:
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.7.1
       */
      operationalError: Event(0x0, EventPriority.Critical, TlvOperationalErrorEvent),

      /**
       * This event SHOULD be generated when the overall operation ends, successfully or otherwise. For example,
       * the completion of a cleaning operation in a Robot Vacuum Cleaner, or the completion of a wash cycle in a
       * Washing Machine.
       *
       * It is highly recommended that appliances device types employing the Operational State cluster support
       * this event, even if it is optional. This assists clients in executing automations or issuing
       * notifications at critical points in the device operation cycles.
       *
       * This event shall contain the following fields:
       *
       * @see {@link MatterSpecification.v14.Cluster} § 1.14.7.2
       */
      operationCompletion: OptionalEvent(0x1, EventPriority.Info, OperationalStateNamespace.TlvOperationCompletionEvent),
    },
  });

  /**
   * This cluster is derived from the Operational State cluster and provides an interface for monitoring the
   * operational state of a robotic vacuum cleaner.
   *
   * @see {@link MatterSpecification.v14.Cluster} § 7.4
   */
  export interface Cluster extends Identity<typeof ClusterInstance> {}

  export const Cluster: Cluster = ClusterInstance;
  export const Complete = Cluster;
}

export type RvcOperationalStateCluster = RvcOperationalState.Cluster;
export const RvcOperationalStateCluster = RvcOperationalState.Cluster;
ClusterRegistry.register(RvcOperationalState.Complete);
