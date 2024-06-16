/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ClusterRegistry, Command, FixedAttribute, MutableCluster, TlvNoResponse, WritableAttribute } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvObject, TlvField, TypeFromSchema, TlvEnum, TlvBoolean, TlvOptionalField, TlvUInt8, TlvNullable, TlvBitmap, TlvPercent } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace FanControl {
  /**
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.1
   */
  export const Rock = {
    /**
     * Indicate rock left to right
     */
    rockLeftRight: BitFlag(0),

    /**
     * Indicate rock up and down
     */
    rockUpDown: BitFlag(1),

    /**
     * Indicate rock around
     */
    rockRound: BitFlag(2),
  };

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.2
   */
  export const Wind = {
    /**
     * Indicate sleep wind
     */
    sleepWind: BitFlag(0),

    /**
     * Indicate natural wind
     */
    naturalWind: BitFlag(1),
  };

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.4
   */
  export enum AirflowDirection {
    /**
     * Airflow is in the forward direction
     */
    Forward = 0,

    /**
     * Airflow is in the reverse direction
     */
    Reverse = 1,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.3
   */
  export enum StepDirection {
    /**
     * Step moves in increasing direction
     */
    Increase = 0,

    /**
     * Step moves in decreasing direction
     */
    Decrease = 1,
  }

  /**
   * Input to the FanControl step command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.7.1
   */
  export const TlvStepRequest = TlvObject({
    /**
     * This field shall indicate whether the fan speed increases or decreases to the next step value.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 4.4.7.1.1
     */
    direction: TlvField(0, TlvEnum<StepDirection>()),

    /**
     * This field shall indicate if the fan speed wraps between highest and lowest step value.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 4.4.7.1.2
     */
    wrap: TlvOptionalField(1, TlvBoolean),

    /**
     * This field shall indicate that the fan being off (speed value 0) is included as a step value.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 4.4.7.1.3
     */
    lowestOff: TlvOptionalField(2, TlvBoolean),
  });

  /**
   * Input to the FanControl step command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.7.1
   */
  export type StepRequest = TypeFromSchema<typeof TlvStepRequest>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.5
   */
  export enum FanMode {
    /**
     * Fan is off
     */
    Off = 0,

    /**
     * Fan using low speed
     *
     * If the fan supports 2 or more speeds, the Low value shall be supported.
     *
     * The Low value shall be supported if and only if the FanModeSequence attribute value is less than 4.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.5.1
     */
    Low = 1,

    /**
     * Fan using medium speed
     *
     * If the fan supports 3 or more speeds, the Medium value shall be supported.
     *
     * The Medium value shall be supported if and only if the FanModeSequence attribute value is 0 or 2.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.5.2
     */
    Medium = 2,

    /**
     * Fan using high speed
     */
    High = 3,

    On = 4,

    /**
     * Fan is using auto mode
     */
    Auto = 5,

    /**
     * Fan is using smart mode
     */
    Smart = 6,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.5.6
   */
  export enum FanModeSequence {
    /**
     * Fan is capable of off, low, medium and high modes
     */
    OffLowMedHigh = 0,

    /**
     * Fan is capable of off, low and high modes
     */
    OffLowHigh = 1,

    /**
     * Fan is capable of off, low, medium, high and auto modes
     */
    OffLowMedHighAuto = 2,

    /**
     * Fan is capable of off, low, high and auto modes
     */
    OffLowHighAuto = 3,

    /**
     * Fan is capable of off, high and auto modes
     */
    OffHighAuto = 4,

    /**
     * Fan is capable of off and high modes
     */
    OffHigh = 5,
  }

  /**
   * A FanControlCluster supports these elements if it supports feature MultiSpeed.
   */
  export const MultiSpeedComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates that the fan has one speed (value of 1) or the maximum speed, if the fan is capable of
       * multiple speeds.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.5
       */
      speedMax: FixedAttribute(0x4, TlvUInt8.bound({ min: 1, max: 100 })),

      /**
       * Indicates the speed setting for the fan. This attribute may be written by the client to indicate a new
       * fan speed. If the client writes null to this attribute, the attribute value shall NOT change. A server
       * shall return INVALID_IN_STATE to indicate that the fan is not in a state where the SpeedSetting can be
       * changed to the requested value.
       *
       * If this is successfully written to 0, the server shall set the FanMode attribute value to Off. Please
       * see the Speed Rules for details on other values.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.6
       */
      speedSetting: WritableAttribute(0x5, TlvNullable(TlvUInt8), { default: 0 }),

      /**
       * Indicates the actual currently operating fan speed, or zero to indicate that the fan is off. There may
       * be a temporary mismatch between the value of this attribute and the value of the SpeedSetting attribute
       * due to other system requirements that would not allow the fan to operate at the requested setting.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.7
       */
      speedCurrent: Attribute(0x6, TlvUInt8),
    },
  });

  /**
   * A FanControlCluster supports these elements if it supports feature Rocking.
   */
  export const RockingComponent = MutableCluster.Component({
    attributes: {
      /**
       * This attribute is a bitmap that indicates what rocking motions the server supports.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.8
       */
      rockSupport: FixedAttribute(0x7, TlvBitmap(TlvUInt8, Rock)),

      /**
       * This attribute is a bitmap that indicates the current active fan rocking motion settings. Each bit shall
       * only be set to 1, if the corresponding bit in the RockSupport attribute is set to 1, otherwise a status
       * code of CONSTRAINT_ERROR shall be returned.
       *
       * If a combination of supported bits is set by the client, and the server does not support the
       * combination, the lowest supported single bit in the combination shall be set and active, and all other
       * bits shall indicate zero.
       *
       * For example: If RockUpDown and RockRound are both set, but this combination is not possible, then only
       * RockUpDown becomes active.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.9
       */
      rockSetting: WritableAttribute(0x8, TlvBitmap(TlvUInt8, Rock)),
    },
  });

  /**
   * A FanControlCluster supports these elements if it supports feature Wind.
   */
  export const WindComponent = MutableCluster.Component({
    attributes: {
      /**
       * This attribute is a bitmap that indicates what wind modes the server supports. At least one wind mode
       * bit shall be set.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.10
       */
      windSupport: FixedAttribute(0x9, TlvBitmap(TlvUInt8, Wind)),

      /**
       * This attribute is a bitmap that indicates the current active fan wind feature settings. Each bit shall
       * only be set to 1, if the corresponding bit in the WindSupport attribute is set to 1, otherwise a status
       * code of CONSTRAINT_ERROR shall be returned.
       *
       * If a combination of supported bits is set by the client, and the server does not support the
       * combination, the lowest supported single bit in the combination shall be set and active, and all other
       * bits shall indicate zero.
       *
       * For example: If Sleep Wind and Natural Wind are set, but this combination is not possible, then only
       * Sleep Wind becomes active.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.11
       */
      windSetting: WritableAttribute(0xa, TlvBitmap(TlvUInt8, Wind)),
    },
  });

  /**
   * A FanControlCluster supports these elements if it supports feature AirflowDirection.
   */
  export const AirflowDirectionComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the current airflow direction of the fan. This attribute may be written by the client to
       * indicate a new airflow direction for the fan. This attribute shall be set to one of the values in the
       * AirflowDirectionEnum table.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.12
       */
      airflowDirection: WritableAttribute(0xb, TlvEnum<AirflowDirection>(), { default: AirflowDirection.Forward }),
    },
  });

  /**
   * A FanControlCluster supports these elements if it supports feature Step.
   */
  export const StepComponent = MutableCluster.Component({
    commands: {
      /**
       * This command speeds up or slows down the fan, in steps, without the client having to know the fan speed.
       * This command supports, for example, a user operated wall switch, where the user provides the feedback or
       * control to stop sending this command when the proper speed is reached. The step speed values are
       * implementation specific. How many step speeds are implemented is implementation specific.
       *
       * This command supports these fields:
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.7.1
       */
      step: Command(0x0, TlvStepRequest, 0x0, TlvNoResponse),
    },
  });

  /**
   * These are optional features supported by FanControlCluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 4.4.4
   */
  export enum Feature {
    /**
     * MultiSpeed (SPD)
     *
     * Legacy Fan Control cluster revision 0-1 defined 3 speeds (low, medium and high) plus automatic speed control
     * but left it up to the implementer to decide what was supported. Therefore, it is assumed that legacy client
     * implementations are capable of determining, from the server, the number of speeds supported between 1, 2, or
     * 3, and whether automatic speed control is supported.
     *
     * The MultiSpeed feature includes new attributes that support a running fan speed value from 0 to SpeedMax,
     * which has a maximum of 100.
     *
     * See Speed Rules for more details.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 4.4.4.1
     */
    MultiSpeed = 'MultiSpeed',

    /**
     * Auto (AUT)
     *
     * Automatic mode supported for fan speed
     */
    Auto = 'Auto',

    /**
     * Rocking (RCK)
     *
     * Rocking movement supported
     */
    Rocking = 'Rocking',

    /**
     * Wind (WND)
     *
     * Wind emulation supported
     */
    Wind = 'Wind',

    /**
     * Step (STEP)
     *
     * Step command supported
     */
    Step = 'Step',

    /**
     * AirflowDirection (DIR)
     *
     * Airflow Direction attribute is supported
     */
    AirflowDirection = 'AirflowDirection',
  }

  /**
   * These elements and properties are present in all FanControl clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x202,
    name: 'FanControl',
    revision: 4,

    features: {
      /**
       * MultiSpeed
       *
       * Legacy Fan Control cluster revision 0-1 defined 3 speeds (low, medium and high) plus automatic speed
       * control but left it up to the implementer to decide what was supported. Therefore, it is assumed that
       * legacy client implementations are capable of determining, from the server, the number of speeds
       * supported between 1, 2, or 3, and whether automatic speed control is supported.
       *
       * The MultiSpeed feature includes new attributes that support a running fan speed value from 0 to
       * SpeedMax, which has a maximum of 100.
       *
       * See Speed Rules for more details.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.4.1
       */
      multiSpeed: BitFlag(0),

      /**
       * Auto
       *
       * Automatic mode supported for fan speed
       */
      auto: BitFlag(1),

      /**
       * Rocking
       *
       * Rocking movement supported
       */
      rocking: BitFlag(2),

      /**
       * Wind
       *
       * Wind emulation supported
       */
      wind: BitFlag(3),

      /**
       * Step
       *
       * Step command supported
       */
      step: BitFlag(4),

      /**
       * AirflowDirection
       *
       * Airflow Direction attribute is supported
       */
      airflowDirection: BitFlag(5),
    },

    attributes: {
      /**
       * Indicates the current speed mode of the fan. This attribute may be written by the client to request a
       * different fan mode. A server shall return INVALID_IN_STATE to indicate that the fan is not in a state
       * where the FanMode can be changed to the requested value. A server may have FanMode values that it can
       * never be set to. For example, where this cluster appears on the same or another endpoint as other
       * clusters with a system dependency, for example the Thermostat cluster, attempting to set the FanMode
       * attribute of this cluster to Off may not be allowed by the system.
       *
       * This attribute shall be set to one of the values in FanModeEnum.
       *
       * When the FanMode attribute is successfully written to, the PercentSetting and SpeedSetting (if present)
       * attributes shall be set to appropriate values, as defined by the Percent Rules and Speed Rules
       * respectively, unless otherwise specified below.
       *
       * When the FanMode attribute is set to any given mode, the PercentCurrent and SpeedCurrent (if present)
       * shall indicate the actual currently operating fan speed, unless otherwise specified below.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.1
       */
      fanMode: WritableAttribute(0x0, TlvEnum<FanMode>(), { persistent: true, default: FanMode.Off }),

      /**
       * This attribute indicates the fan speed ranges that shall be supported.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.2
       */
      fanModeSequence: FixedAttribute(0x1, TlvEnum<FanModeSequence>()),

      /**
       * Indicates the speed setting for the fan. This attribute may be written by the client to indicate a new
       * fan speed. If the client writes null to this attribute, the attribute value shall NOT change. A server
       * shall return INVALID_IN_STATE to indicate that the fan is not in a state where the PercentSetting can be
       * changed to the requested value.
       *
       * If this is successfully written to 0, the server shall set the FanMode attribute value to Off.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.3
       */
      percentSetting: WritableAttribute(0x2, TlvNullable(TlvPercent), { default: 0 }),

      /**
       * Indicates the actual currently operating fan speed, or zero to indicate that the fan is off. There may
       * be a temporary mismatch between the value of this attribute and the value of the PercentSetting
       * attribute due to other system requirements that would not allow the fan to operate at the requested
       * setting. See Percent Rules for more details.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 4.4.6.4
       */
      percentCurrent: Attribute(0x3, TlvPercent),
    },

    /**
     * This metadata controls which FanControlCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { multiSpeed: true }, component: MultiSpeedComponent },
      { flags: { rocking: true }, component: RockingComponent },
      { flags: { wind: true }, component: WindComponent },
      { flags: { airflowDirection: true }, component: AirflowDirectionComponent },
      { flags: { step: true }, component: StepComponent },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster(Base);

  /**
   * This cluster specifies an interface to control the speed of a fan.
   *
   * FanControlCluster supports optional features that you can enable with the FanControlCluster.with() factory
   * method.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 4.4
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;
  const SPD = { multiSpeed: true };
  const RCK = { rocking: true };
  const WND = { wind: true };
  const DIR = { airflowDirection: true };
  const STEP = { step: true };

  /**
   * @see {@link Complete}
   */
  export const CompleteInstance = MutableCluster({
    id: Cluster.id,
    name: Cluster.name,
    revision: Cluster.revision,
    features: Cluster.features,

    attributes: {
      ...Cluster.attributes,
      speedMax: MutableCluster.AsConditional(MultiSpeedComponent.attributes.speedMax, { mandatoryIf: [SPD] }),
      speedSetting: MutableCluster.AsConditional(MultiSpeedComponent.attributes.speedSetting, { mandatoryIf: [SPD] }),
      speedCurrent: MutableCluster.AsConditional(MultiSpeedComponent.attributes.speedCurrent, { mandatoryIf: [SPD] }),
      rockSupport: MutableCluster.AsConditional(RockingComponent.attributes.rockSupport, { mandatoryIf: [RCK] }),
      rockSetting: MutableCluster.AsConditional(RockingComponent.attributes.rockSetting, { mandatoryIf: [RCK] }),
      windSupport: MutableCluster.AsConditional(WindComponent.attributes.windSupport, { mandatoryIf: [WND] }),
      windSetting: MutableCluster.AsConditional(WindComponent.attributes.windSetting, { mandatoryIf: [WND] }),
      airflowDirection: MutableCluster.AsConditional(AirflowDirectionComponent.attributes.airflowDirection, { mandatoryIf: [DIR] }),
    },

    commands: { step: MutableCluster.AsConditional(StepComponent.commands.step, { mandatoryIf: [STEP] }) },
  });

  /**
   * This cluster supports all FanControl features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export type Complete = Identity<typeof CompleteInstance>;

  export const Complete: Complete = CompleteInstance;
}

export type FanControlCluster = FanControl.Cluster;
export const FanControlCluster = FanControl.Cluster;
ClusterRegistry.register(FanControl.Complete);
