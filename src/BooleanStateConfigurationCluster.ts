/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { ClusterRegistry, Command, Event, EventPriority, FixedAttribute, MutableCluster, OptionalAttribute, OptionalEvent, OptionalFixedAttribute, TlvNoResponse, WritableAttribute } from '@project-chip/matter-node.js/cluster';
import { Attribute } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvObject, TlvField, TlvBitmap, TlvUInt8, TypeFromSchema, TlvOptionalField, TlvUInt16 } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace BooleanStateConfiguration {
  /**
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.5.1
   */
  export const AlarmMode = {
    /**
     * Visual alarming
     */
    visual: BitFlag(0),

    /**
     * Audible alarming
     */
    audible: BitFlag(1),
  };

  /**
   * Input to the BooleanStateConfiguration enableDisableAlarm command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.2
   */
  export const TlvEnableDisableAlarmRequest = TlvObject({
    /**
     * This field shall indicate the alarm modes to either enable or disable depending on the bit status, as
     * specified for the AlarmsEnabled attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.2.1
     */
    alarmsToEnableDisable: TlvField(0, TlvBitmap(TlvUInt8, AlarmMode)),
  });

  /**
   * Input to the BooleanStateConfiguration enableDisableAlarm command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.2
   */
  export type EnableDisableAlarmRequest = TypeFromSchema<typeof TlvEnableDisableAlarmRequest>;

  /**
   * Body of the BooleanStateConfiguration alarmsStateChanged event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.1
   */
  export const TlvAlarmsStateChangedEvent = TlvObject({
    /**
     * This field shall indicate the state of active alarm modes, as indicated by the AlarmsActive attribute, at
     * the time the event was generated.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.1.1
     */
    alarmsActive: TlvField(0, TlvBitmap(TlvUInt8, AlarmMode)),

    /**
     * This field shall indicate the state of suppressed alarm modes, as indicated by the AlarmsSuppressed
     * attribute, at the time the event was generated.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.1.2
     */
    alarmsSuppressed: TlvOptionalField(1, TlvBitmap(TlvUInt8, AlarmMode)),
  });

  /**
   * Body of the BooleanStateConfiguration alarmsStateChanged event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.1
   */
  export type AlarmsStateChangedEvent = TypeFromSchema<typeof TlvAlarmsStateChangedEvent>;

  /**
   * Input to the BooleanStateConfiguration suppressAlarm command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.1
   */
  export const TlvSuppressAlarmRequest = TlvObject({
    /**
     * This field shall indicate the alarm modes to suppress.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.1.1
     */
    alarmsToSuppress: TlvField(0, TlvBitmap(TlvUInt8, AlarmMode)),
  });

  /**
   * Input to the BooleanStateConfiguration suppressAlarm command
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.1
   */
  export type SuppressAlarmRequest = TypeFromSchema<typeof TlvSuppressAlarmRequest>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.5.2
   */
  export const SensorFault = {
    /**
     * Unspecified fault detected
     */
    generalFault: BitFlag(0),
  };

  /**
   * Body of the BooleanStateConfiguration sensorFault event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.2
   */
  export const TlvSensorFaultEvent = TlvObject({
    /**
     * This field shall indicate the value of the SensorFault attribute, at the time this event is generated.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.2.1
     */
    sensorFault: TlvField(0, TlvBitmap(TlvUInt16, SensorFault)),
  });

  /**
   * Body of the BooleanStateConfiguration sensorFault event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.2
   */
  export type SensorFaultEvent = TypeFromSchema<typeof TlvSensorFaultEvent>;

  /**
   * A BooleanStateConfigurationCluster supports these elements if it supports feature SensitivityLevel.
   */
  export const SensitivityLevelComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates the currently selected sensitivity level.
       *
       * If a write interaction to this attribute contains an unsupported sensitivity value, a CONSTRAINT_ERROR
       * status shall be returned.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.1
       */
      currentSensitivityLevel: WritableAttribute(0x0, TlvUInt8, { persistent: true }),

      /**
       * Indicates the number of supported sensitivity levels by the device.
       *
       * These supported sensitivity levels shall be ordered by sensitivity, where a value of 0 shall be
       * considered the lowest sensitivity level (least sensitive) and the highest supported value shall be
       * considered the highest sensitivity level.
       *
       * The number of supported sensitivity levels SHOULD represent unique sensitivity levels supported by the
       * device.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.2
       */
      supportedSensitivityLevels: FixedAttribute(0x1, TlvUInt8.bound({ min: 2, max: 10 })),

      /**
       * Indicates the default sensitivity level selected by the manufacturer.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.3
       */
      defaultSensitivityLevel: OptionalFixedAttribute(0x2, TlvUInt8),
    },
  });

  /**
   * A BooleanStateConfigurationCluster supports these elements if it supports features Visual or Audible.
   */
  export const VisualOrAudibleComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates which specific alarm modes on the server are currently active. When the sensor is no longer
       * triggered, this attribute shall be set to the inactive state, by setting the bit to 0, for all supported
       * alarm modes.
       *
       * If an alarm mode is not supported, the bit indicating this alarm mode shall always be 0. A bit shall
       * indicate whether the alarm mode inactive or not:
       *
       *   • 0 = Inactive
       *
       *   • 1 = Active
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.4
       */
      alarmsActive: Attribute(0x3, TlvBitmap(TlvUInt8, AlarmMode)),

      /**
       * Indicates the alarm modes that will be emitted if the sensor is triggered. If an alarm mode is not
       * supported, the bit indicating this alarm mode shall always be 0.
       *
       * A bit shall indicate whether the alarm mode is enabled or disabled:
       *
       *   • 0 = Disabled
       *
       *   • 1 = Enabled
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.6
       */
      alarmsEnabled: OptionalAttribute(0x5, TlvBitmap(TlvUInt8, AlarmMode), { persistent: true }),

      /**
       * Indicates the alarms supported by the sensor. A bit shall indicate whether the alarm mode is supported:
       *
       *   • 0 = Not supported
       *
       *   • 1 = Supported
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.7
       */
      alarmsSupported: FixedAttribute(0x6, TlvBitmap(TlvUInt8, AlarmMode)),
    },

    commands: {
      /**
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.2
       */
      enableDisableAlarm: Command(0x1, TlvEnableDisableAlarmRequest, 0x1, TlvNoResponse),
    },

    events: {
      /**
       * This event shall be generated after any bits in the AlarmsActive and/or AlarmsSuppressed attributes
       * change. This may occur in situations such as when internal processing by the server determines that an
       * alarm mode becomes active or inactive, or when the SuppressAlarm or EnableDisableAlarm commands are
       * processed in a way that some alarm modes becomes suppressed, active or inactive.
       *
       * If several alarm modes change state at the same time, a single event combining multiple changes may be
       * emitted instead of multiple events each representing a single change.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.1
       */
      alarmsStateChanged: Event(0x0, EventPriority.Info, TlvAlarmsStateChangedEvent),
    },
  });

  /**
   * A BooleanStateConfigurationCluster supports these elements if it supports feature AlarmSuppress.
   */
  export const AlarmSuppressComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates which specific alarm modes on the server are currently suppressed. When the sensor is no
       * longer triggered, this attribute shall be set to the unsuppressed state, by setting the bit to 0, for
       * all supported alarm modes.
       *
       * If an alarm mode is not supported, the bit indicating this alarm mode shall always be 0. A bit shall
       * indicate whether the alarm mode is suppressed or not:
       *
       *   • 0 = Not suppressed
       *
       *   • 1 = Suppressed
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.5
       */
      alarmsSuppressed: Attribute(0x4, TlvBitmap(TlvUInt8, AlarmMode)),
    },

    commands: {
      /**
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.7.1
       */
      suppressAlarm: Command(0x0, TlvSuppressAlarmRequest, 0x0, TlvNoResponse),
    },
  });

  /**
   * These are optional features supported by BooleanStateConfigurationCluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8.4
   */
  export enum Feature {
    /**
     * Visual (VIS)
     *
     * Supports visual alarms
     */
    Visual = 'Visual',

    /**
     * Audible (AUD)
     *
     * Supports audible alarms
     */
    Audible = 'Audible',

    /**
     * AlarmSuppress (SPRS)
     *
     * This feature shall indicate that the device is able to suppress the supported alarm modes, when the user
     * acknowledges the alarm. This is intended to stop visual and/or audible alarms, when the user has become
     * aware that the sensor is triggered, but it is no longer desired to have the alarm modes active on the
     * device, e.g.:
     *
     *   • The triggering cause have been resolved by the user, but the sensor has not yet stopped detecting the
     *     triggering cause.
     *
     *   • The user is not able to address the triggering cause, but is aware of the alarm and suppress/acknowledge
     *     it be addressed at a later point.
     *
     * Acknowledge of alarms will for the remainder of this cluster be referred to as suppress.
     *
     * A suppressed alarm is still considered active and will remain so unless it is actively disabled or the
     * triggering condition is not longer present. The action of suppressing an alarm mode is only applicable to
     * and is intended to stop the physical alarming, e.g. emitting a sound or blinking a light; it does not impact
     * alarm reporting in AlarmsActive.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 1.8.4.1
     */
    AlarmSuppress = 'AlarmSuppress',

    /**
     * SensitivityLevel (SENSLVL)
     *
     * Supports ability to set sensor sensitivity
     */
    SensitivityLevel = 'SensitivityLevel',
  }

  /**
   * These elements and properties are present in all BooleanStateConfiguration clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x80,
    name: 'BooleanStateConfiguration',
    revision: 1,

    features: {
      /**
       * Visual
       *
       * Supports visual alarms
       */
      visual: BitFlag(0),

      /**
       * Audible
       *
       * Supports audible alarms
       */
      audible: BitFlag(1),

      /**
       * AlarmSuppress
       *
       * This feature shall indicate that the device is able to suppress the supported alarm modes, when the user
       * acknowledges the alarm. This is intended to stop visual and/or audible alarms, when the user has become
       * aware that the sensor is triggered, but it is no longer desired to have the alarm modes active on the
       * device, e.g.:
       *
       *   • The triggering cause have been resolved by the user, but the sensor has not yet stopped detecting
       *     the triggering cause.
       *
       *   • The user is not able to address the triggering cause, but is aware of the alarm and
       *     suppress/acknowledge it be addressed at a later point.
       *
       * Acknowledge of alarms will for the remainder of this cluster be referred to as suppress.
       *
       * A suppressed alarm is still considered active and will remain so unless it is actively disabled or the
       * triggering condition is not longer present. The action of suppressing an alarm mode is only applicable
       * to and is intended to stop the physical alarming, e.g. emitting a sound or blinking a light; it does not
       * impact alarm reporting in AlarmsActive.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.4.1
       */
      alarmSuppress: BitFlag(2),

      /**
       * SensitivityLevel
       *
       * Supports ability to set sensor sensitivity
       */
      sensitivityLevel: BitFlag(3),
    },

    attributes: {
      /**
       * Indicates any faults registered by the device.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.6.8
       */
      sensorFault: OptionalAttribute(0x7, TlvBitmap(TlvUInt16, SensorFault)),
    },

    events: {
      /**
       * This event shall be generated when the device registers or clears a fault.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 1.8.8.2
       */
      sensorFault: OptionalEvent(0x1, EventPriority.Info, TlvSensorFaultEvent),
    },

    /**
     * This metadata controls which BooleanStateConfigurationCluster elements matter.js activates for specific
     * feature combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { sensitivityLevel: true }, component: SensitivityLevelComponent },
      { flags: { visual: true }, component: VisualOrAudibleComponent },
      { flags: { audible: true }, component: VisualOrAudibleComponent },
      { flags: { alarmSuppress: true }, component: AlarmSuppressComponent },
      { flags: { alarmSuppress: true, visual: true, audible: true }, component: false },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster(Base);

  /**
   * This cluster is used to configure a boolean sensor, including optional state change alarm features and
   * configuration of the sensitivity level associated with the sensor.
   *
   * BooleanStateConfigurationCluster supports optional features that you can enable with the
   * BooleanStateConfigurationCluster.with() factory method.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 1.8
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;
  const SENSLVL = { sensitivityLevel: true };
  const VIS = { visual: true };
  const AUD = { audible: true };
  const SPRS = { alarmSuppress: true };

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
      currentSensitivityLevel: MutableCluster.AsConditional(SensitivityLevelComponent.attributes.currentSensitivityLevel, { mandatoryIf: [SENSLVL] }),
      supportedSensitivityLevels: MutableCluster.AsConditional(SensitivityLevelComponent.attributes.supportedSensitivityLevels, { mandatoryIf: [SENSLVL] }),
      defaultSensitivityLevel: MutableCluster.AsConditional(SensitivityLevelComponent.attributes.defaultSensitivityLevel, { optionalIf: [SENSLVL] }),
      alarmsActive: MutableCluster.AsConditional(VisualOrAudibleComponent.attributes.alarmsActive, { mandatoryIf: [VIS, AUD] }),
      alarmsSuppressed: MutableCluster.AsConditional(AlarmSuppressComponent.attributes.alarmsSuppressed, { mandatoryIf: [SPRS] }),
      alarmsEnabled: MutableCluster.AsConditional(VisualOrAudibleComponent.attributes.alarmsEnabled, { optionalIf: [VIS, AUD] }),
      alarmsSupported: MutableCluster.AsConditional(VisualOrAudibleComponent.attributes.alarmsSupported, { mandatoryIf: [VIS, AUD] }),
    },

    commands: {
      suppressAlarm: MutableCluster.AsConditional(AlarmSuppressComponent.commands.suppressAlarm, { mandatoryIf: [SPRS] }),
      enableDisableAlarm: MutableCluster.AsConditional(VisualOrAudibleComponent.commands.enableDisableAlarm, { mandatoryIf: [VIS, AUD] }),
    },

    events: {
      ...Cluster.events,
      alarmsStateChanged: MutableCluster.AsConditional(VisualOrAudibleComponent.events.alarmsStateChanged, { mandatoryIf: [VIS, AUD] }),
    },
  });

  /**
   * This cluster supports all BooleanStateConfiguration features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export type Complete = Identity<typeof CompleteInstance>;

  export const Complete: Complete = CompleteInstance;
}

export type BooleanStateConfigurationCluster = BooleanStateConfiguration.Cluster;
export const BooleanStateConfigurationCluster = BooleanStateConfiguration.Cluster;
ClusterRegistry.register(BooleanStateConfiguration.Complete);
