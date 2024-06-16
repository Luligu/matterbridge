/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @license
 * Copyright 2022-2024 Matter.js Authors
 * SPDX-License-Identifier: Apache-2.0
 */

/** * THIS FILE IS GENERATED, DO NOT EDIT ***/

import { AccessLevel, ClusterRegistry, EventPriority, MutableCluster, OptionalAttribute, OptionalCommand, OptionalEvent, OptionalFixedAttribute, OptionalWritableAttribute, TlvNoResponse } from '@project-chip/matter-node.js/cluster';
import { Attribute, Event } from '@project-chip/matter-node.js/cluster';
import { BitFlag } from '@project-chip/matter-node.js/schema';
import { TlvObject, TlvField, TlvEpochS, TypeFromSchema, TlvEnum, TlvBoolean, TlvNoArguments } from '@project-chip/matter-node.js/tlv';
import { Identity } from '@project-chip/matter-node.js/util';

export namespace SmokeCoAlarm {
  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.1
   */
  export enum AlarmState {
    /**
     * Nominal state, the device is not alarming
     *
     * This value shall indicate that this alarm is not alarming.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.1.1
     */
    Normal = 0,

    /**
     * Warning state
     *
     * This value shall indicate that this alarm is in a warning state. Alarms in this state SHOULD be subject to
     * being muted via physical interaction.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.1.2
     */
    Warning = 1,

    /**
     * Critical state
     *
     * This value shall indicate that this alarm is in a critical state. Alarms in this state shall NOT be subject
     * to being muted via physical interaction.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.1.3
     */
    Critical = 2,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.6
   */
  export enum ContaminationState {
    /**
     * Nominal state, the sensor is not contaminated
     *
     * This value shall indicate that the smoke sensor has nominal contamination levels, no customer action is
     * required.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.6.1
     */
    Normal = 0,

    /**
     * Low contamination
     *
     * This value shall indicate that the smoke sensor has detectable contamination levels, but the contamination
     * is too low to cause a visible or audible alarm.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.6.2
     */
    Low = 1,

    /**
     * Warning state
     *
     * This value shall indicate that the smoke sensor has contamination levels in a warning state. At this level,
     * the contamination may cause a visible or audible alarm. User intervention is suggested.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.6.3
     */
    Warning = 2,

    /**
     * Critical state, will cause nuisance alarms
     *
     * This value shall indicate that the smoke sensor has contamination levels in a critical state. At this level,
     * the contamination should cause a visible or audible alarm. User intervention is required. Critical
     * contamination of the sensor shall also be reflected as a HardwareFault.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.6.4
     */
    Critical = 3,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.2
   */
  export enum Sensitivity {
    /**
     * High sensitivity
     */
    High = 0,

    /**
     * Standard Sensitivity
     */
    Standard = 1,

    /**
     * Low sensitivity
     */
    Low = 2,
  }

  /**
   * Body of the SmokeCoAlarm smokeAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.1
   */
  export const TlvSmokeAlarmEvent = TlvObject({
    /**
     * This field shall indicate the current value of the SmokeState attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.1.1
     */
    alarmSeverityLevel: TlvField(0, TlvEnum<AlarmState>()),
  });

  /**
   * Body of the SmokeCoAlarm smokeAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.1
   */
  export type SmokeAlarmEvent = TypeFromSchema<typeof TlvSmokeAlarmEvent>;

  /**
   * Body of the SmokeCoAlarm interconnectSmokeAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.9
   */
  export const TlvInterconnectSmokeAlarmEvent = TlvObject({
    /**
     * This field shall indicate the current value of the InterconnectSmokeAlarm attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.9.1
     */
    alarmSeverityLevel: TlvField(0, TlvEnum<AlarmState>()),
  });

  /**
   * Body of the SmokeCoAlarm interconnectSmokeAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.9
   */
  export type InterconnectSmokeAlarmEvent = TypeFromSchema<typeof TlvInterconnectSmokeAlarmEvent>;

  /**
   * Body of the SmokeCoAlarm coAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.2
   */
  export const TlvCoAlarmEvent = TlvObject({
    /**
     * This field shall indicate the current value of the COState attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.2.1
     */
    alarmSeverityLevel: TlvField(0, TlvEnum<AlarmState>()),
  });

  /**
   * Body of the SmokeCoAlarm coAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.2
   */
  export type CoAlarmEvent = TypeFromSchema<typeof TlvCoAlarmEvent>;

  /**
   * Body of the SmokeCoAlarm interconnectCoAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.10
   */
  export const TlvInterconnectCoAlarmEvent = TlvObject({
    /**
     * This field shall indicate the current value of the InterconnectCOAlarm attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.10.1
     */
    alarmSeverityLevel: TlvField(0, TlvEnum<AlarmState>()),
  });

  /**
   * Body of the SmokeCoAlarm interconnectCoAlarm event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.10
   */
  export type InterconnectCoAlarmEvent = TypeFromSchema<typeof TlvInterconnectCoAlarmEvent>;

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3
   */
  export enum ExpressedState {
    /**
     * Nominal state, the device is not alarming
     *
     * This value shall indicate that this alarm is not alarming.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.1
     */
    Normal = 0,

    /**
     * Smoke Alarm state
     *
     * This value shall indicate that this alarm is currently expressing visual indication of Smoke Alarm. This
     * value shall indicate that the alarm is currently expressing audible indication of Smoke Alarm unless the
     * DeviceMuted attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.2
     */
    SmokeAlarm = 1,

    /**
     * CO Alarm state
     *
     * This value shall indicate that this alarm is currently expressing visual indication of CO Alarm. This value
     * shall indicate that the alarm is currently expressing audible indication of CO Alarm unless the DeviceMuted
     * attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.3
     */
    CoAlarm = 2,

    /**
     * Battery Alert State
     *
     * This value shall indicate that this alarm is currently expressing visual indication of Critical Low Battery.
     * This value shall indicate that the alarm is currently expressing audible indication of Critical Low Battery
     * unless the DeviceMuted attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.4
     */
    BatteryAlert = 3,

    /**
     * Test in Progress
     *
     * This value shall indicate that this alarm is currently expressing visual and audible indication of SelfTest.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.5
     */
    Testing = 4,

    /**
     * Hardware Fault Alert State
     *
     * This value shall indicate that this alarm is currently expressing visual indication of Hardware Fault. This
     * value shall indicate that the alarm is currently expressing audible indication of Hardware Fault unless the
     * DeviceMuted attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.6
     */
    HardwareFault = 5,

    /**
     * End of Service Alert State
     *
     * This value shall indicate that this alarm is currently expressing visual indication of End Of Service. This
     * value shall indicate that the alarm is currently expressing audible indication of End of Service unless the
     * DeviceMuted attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.7
     */
    EndOfService = 6,

    /**
     * Interconnected Smoke Alarm State
     *
     * This value shall indicate that this alarm is currently expressing visual indication of Smoke Alarm caused by
     * Interconnect. This value shall indicate that the alarm is currently expressing audible indication of Smoke
     * Alarm caused by Interconnect unless the DeviceMuted attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.8
     */
    InterconnectSmoke = 7,

    /**
     * Interconnected CO Alarm State
     *
     * This value shall indicate that this alarm is currently expressing visual indication of CO Alarm caused by
     * Interconnect. This value shall indicate that the alarm is currently expressing audible indication of CO
     * Alarm caused by Interconnect unless the DeviceMuted attribute is supported and set to Muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.3.9
     */
    InterconnectCo = 8,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.4
   */
  export enum MuteState {
    /**
     * Not Muted
     *
     * This value shall indicate that the device is not muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.4.1
     */
    NotMuted = 0,

    /**
     * Muted
     *
     * This value shall indicate that the device is muted.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.4.2
     */
    Muted = 1,
  }

  /**
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.5
   */
  export enum EndOfService {
    /**
     * Device has not expired
     *
     * This value shall indicate that the device has not yet reached its end of service, and does not need to be
     * imminently replaced.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.5.2
     */
    Normal = 0,

    /**
     * Device has reached its end of service
     *
     * This value shall indicate that the device has reached its end of service, and needs to be replaced.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.5.5.1
     */
    Expired = 1,
  }

  /**
   * Body of the SmokeCoAlarm lowBattery event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.3
   */
  export const TlvLowBatteryEvent = TlvObject({
    /**
     * This field shall indicate the current value of the BatteryAlert attribute.
     *
     * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.3.1
     */
    alarmSeverityLevel: TlvField(0, TlvEnum<AlarmState>()),
  });

  /**
   * Body of the SmokeCoAlarm lowBattery event
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.3
   */
  export type LowBatteryEvent = TypeFromSchema<typeof TlvLowBatteryEvent>;

  /**
   * A SmokeCoAlarmCluster supports these elements if it supports feature SmokeAlarm.
   */
  export const SmokeAlarmComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates whether the device’s smoke sensor is currently triggering a smoke alarm.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.2
       */
      smokeState: Attribute(0x1, TlvEnum<AlarmState>(), { persistent: true }),

      /**
       * Indicates the contamination level of the smoke sensor.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.11
       */
      contaminationState: OptionalAttribute(0xa, TlvEnum<ContaminationState>()),

      /**
       * Indicates the sensitivity level of the smoke sensor configured on the device.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.12
       */
      smokeSensitivityLevel: OptionalWritableAttribute(0xb, TlvEnum<Sensitivity>(), { writeAcl: AccessLevel.Manage }),
    },

    events: {
      /**
       * This event shall be generated when SmokeState attribute changes to either Warning or Critical state.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.1
       */
      smokeAlarm: Event(0x0, EventPriority.Critical, TlvSmokeAlarmEvent),

      /**
       * This event shall be generated when the device hosting the server receives a smoke alarm from an
       * interconnected sensor.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.9
       */
      interconnectSmokeAlarm: OptionalEvent(0x8, EventPriority.Critical, TlvInterconnectSmokeAlarmEvent),
    },
  });

  /**
   * A SmokeCoAlarmCluster supports these elements if it supports feature CoAlarm.
   */
  export const CoAlarmComponent = MutableCluster.Component({
    attributes: {
      /**
       * Indicates whether the device’s CO sensor is currently triggering a CO alarm.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.3
       */
      coState: Attribute(0x2, TlvEnum<AlarmState>(), { persistent: true }),
    },

    events: {
      /**
       * This event shall be generated when COState attribute changes to either Warning or Critical state.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.2
       */
      coAlarm: Event(0x1, EventPriority.Critical, TlvCoAlarmEvent),

      /**
       * This event shall be generated when the device hosting the server receives a CO alarm from an
       * interconnected sensor.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.10
       */
      interconnectCoAlarm: OptionalEvent(0x9, EventPriority.Critical, TlvInterconnectCoAlarmEvent),
    },
  });

  /**
   * These are optional features supported by SmokeCoAlarmCluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11.4
   */
  export enum Feature {
    /**
     * SmokeAlarm (SMOKE)
     *
     * Supports Smoke alarm
     */
    SmokeAlarm = 'SmokeAlarm',

    /**
     * CoAlarm (CO)
     *
     * Supports CO alarm
     */
    CoAlarm = 'CoAlarm',
  }

  /**
   * These elements and properties are present in all SmokeCoAlarm clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x5c,
    name: 'SmokeCoAlarm',
    revision: 1,

    features: {
      /**
       * SmokeAlarm
       *
       * Supports Smoke alarm
       */
      smokeAlarm: BitFlag(0),

      /**
       * CoAlarm
       *
       * Supports CO alarm
       */
      coAlarm: BitFlag(1),
    },

    attributes: {
      /**
       * Indicates the visibly- and audibly-expressed state of the alarm. When multiple alarm conditions are
       * being reflected in the server, this attribute shall indicate the condition with the highest priority.
       * Priority order of conditions is determined by the manufacturer and shall be supplied as a part of
       * certification procedure. If the value of ExpressedState is not Normal, the attribute corresponding to
       * the value shall NOT be Normal. For example, if the ExpressedState is set to SmokeAlarm, the value of the
       * SmokeState will indicate the severity of the alarm (Warning or Critical). Clients SHOULD also read the
       * other attributes to be aware of further alarm conditions beyond the one indicated in ExpressedState.
       *
       * Visible expression is typically a LED light pattern. Audible expression is a horn or speaker pattern.
       * Audible expression shall BE suppressed if the DeviceMuted attribute is supported and set to Muted.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.1
       */
      expressedState: Attribute(0x0, TlvEnum<ExpressedState>(), { persistent: true }),

      /**
       * Indicates whether the power resource fault detection mechanism is currently triggered at the device. If
       * the detection mechanism is triggered, this attribute shall be set to Warning or Critical, otherwise it
       * shall be set to Normal. The battery state shall also be reflected in the Power Source cluster
       * representing the device’s battery using the appropriate supported attributes and events.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.4
       */
      batteryAlert: Attribute(0x3, TlvEnum<AlarmState>(), { persistent: true }),

      /**
       * Indicates the whether the audible expression of the device is currently muted. Audible expression is
       * typically a horn or speaker pattern.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.5
       */
      deviceMuted: OptionalAttribute(0x4, TlvEnum<MuteState>(), { persistent: true }),

      /**
       * Indicates whether the device self-test is currently activated. If the device self- test is activated,
       * this attribute shall be set to True, otherwise it shall be set to False.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.6
       */
      testInProgress: Attribute(0x5, TlvBoolean),

      /**
       * Indicates whether the hardware fault detection mechanism is currently triggered. If the detection
       * mechanism is triggered, this attribute shall be set to True, otherwise it shall be set to False.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.7
       */
      hardwareFaultAlert: Attribute(0x6, TlvBoolean, { persistent: true }),

      /**
       * Indicates whether the end-of-service has been triggered at the device. This attribute shall be set to
       * Expired when the device reaches the end-of-service.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.8
       */
      endOfServiceAlert: Attribute(0x7, TlvEnum<EndOfService>(), { persistent: true }),

      /**
       * Indicates whether the interconnected smoke alarm is currently triggering by branching devices. When the
       * interconnected smoke alarm is being triggered, this attribute shall be set to Warning or Critical,
       * otherwise it shall be set to Normal.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.9
       */
      interconnectSmokeAlarm: OptionalAttribute(0x8, TlvEnum<AlarmState>()),

      /**
       * Indicates whether the interconnected CO alarm is currently triggering by branching devices. When the
       * interconnected CO alarm is being triggered, this attribute shall be set to Warning or Critical,
       * otherwise it shall be set to Normal.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.10
       */
      interconnectCoAlarm: OptionalAttribute(0x9, TlvEnum<AlarmState>()),

      /**
       * Indicates the date when the device reaches its stated expiry date. After the ExpiryDate has been
       * reached, the EndOfServiceAlert shall start to be triggered. To account for better customer experience
       * across time zones, the EndOfServiceAlert may be delayed by up to 24 hours after the ExpiryDate.
       * Similarly, clients may delay any actions based on the ExpiryDate by up to 24 hours to best align with
       * the local time zone.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.6.13
       */
      expiryDate: OptionalFixedAttribute(0xc, TlvEpochS),
    },

    commands: {
      /**
       * This command shall initiate a device self-test. The return status shall indicate whether the test was
       * successfully initiated. Only one SelfTestRequest may be processed at a time. When the value of the
       * ExpressedState attribute is any of SmokeAlarm, COAlarm, Testing, InterconnectSmoke, Inter
       *
       * connectCO, the device shall NOT execute the self-test, and shall return status code BUSY.
       *
       * Upon successful acceptance of SelfTestRequest, the TestInProgress attribute shall be set to True and
       * ExpressedState attribute shall be set to Testing. Any faults identified during the test shall be
       * reflected in the appropriate attributes and events. Upon completion of the self test procedure, the
       * SelfTestComplete event shall be generated, the TestInProgress attribute shall be set to False and
       * ExpressedState attribute shall be updated to reflect the current state of the server.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.7.1
       */
      selfTestRequest: OptionalCommand(0x0, TlvNoArguments, 0x0, TlvNoResponse),
    },

    events: {
      /**
       * This event shall be generated when BatteryAlert attribute changes to either Warning or Critical state.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.3
       */
      lowBattery: Event(0x2, EventPriority.Info, TlvLowBatteryEvent),

      /**
       * This event shall be generated when the device detects a hardware fault that leads to setting
       * HardwareFaultAlert to True.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.4
       */
      hardwareFault: Event(0x3, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when the EndOfServiceAlert is set to Expired.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.5
       */
      endOfService: Event(0x4, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when the SelfTest completes, and the attribute TestInProgress changes to
       * False.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.6
       */
      selfTestComplete: Event(0x5, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when the DeviceMuted attribute changes to Muted.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.7
       */
      alarmMuted: OptionalEvent(0x6, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when DeviceMuted attribute changes to NotMuted.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.8
       */
      muteEnded: OptionalEvent(0x7, EventPriority.Info, TlvNoArguments),

      /**
       * This event shall be generated when ExpressedState attribute returns to Normal state.
       *
       * @see {@link MatterSpecification.v13.Cluster} § 2.11.8.11
       */
      allClear: Event(0xa, EventPriority.Info, TlvNoArguments),
    },

    /**
     * This metadata controls which SmokeCoAlarmCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions({ flags: { smokeAlarm: true }, component: SmokeAlarmComponent }, { flags: { coAlarm: true }, component: CoAlarmComponent }, { flags: { smokeAlarm: false, coAlarm: false }, component: false }),
  });

  /**
   * @see {@link Cluster}
   */
  export const ClusterInstance = MutableCluster.ExtensibleOnly(Base);

  /**
   * This cluster provides an interface for observing and managing the state of smoke and CO alarms.
   *
   * Per the Matter specification you cannot use {@link SmokeCoAlarmCluster} without enabling certain feature
   * combinations. You must use the {@link with} factory method to obtain a working cluster.
   *
   * @see {@link MatterSpecification.v13.Cluster} § 2.11
   */
  export type Cluster = Identity<typeof ClusterInstance>;

  export const Cluster: Cluster = ClusterInstance;
  const SMOKE = { smokeAlarm: true };
  const CO = { coAlarm: true };

  /**
   * @see {@link Complete}
   */
  export const CompleteInstance = MutableCluster({
    id: Base.id,
    name: Base.name,
    revision: Base.revision,
    features: Base.features,

    attributes: {
      ...Base.attributes,
      smokeState: MutableCluster.AsConditional(SmokeAlarmComponent.attributes.smokeState, { mandatoryIf: [SMOKE] }),
      coState: MutableCluster.AsConditional(CoAlarmComponent.attributes.coState, { mandatoryIf: [CO] }),
      contaminationState: MutableCluster.AsConditional(SmokeAlarmComponent.attributes.contaminationState, { optionalIf: [SMOKE] }),
      smokeSensitivityLevel: MutableCluster.AsConditional(SmokeAlarmComponent.attributes.smokeSensitivityLevel, { optionalIf: [SMOKE] }),
    },

    commands: Base.commands,

    events: {
      ...Base.events,
      smokeAlarm: MutableCluster.AsConditional(SmokeAlarmComponent.events.smokeAlarm, { mandatoryIf: [SMOKE] }),
      coAlarm: MutableCluster.AsConditional(CoAlarmComponent.events.coAlarm, { mandatoryIf: [CO] }),
      interconnectSmokeAlarm: MutableCluster.AsConditional(SmokeAlarmComponent.events.interconnectSmokeAlarm, { optionalIf: [SMOKE] }),
      interconnectCoAlarm: MutableCluster.AsConditional(CoAlarmComponent.events.interconnectCoAlarm, { optionalIf: [CO] }),
    },
  });

  /**
   * This cluster supports all SmokeCoAlarm features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active
   * features is legal per the Matter specification.
   */
  export type Complete = Identity<typeof CompleteInstance>;

  export const Complete: Complete = CompleteInstance;
}

export type SmokeCoAlarmCluster = SmokeCoAlarm.Cluster;
export const SmokeCoAlarmCluster = SmokeCoAlarm.Cluster;
ClusterRegistry.register(SmokeCoAlarm.Complete);
