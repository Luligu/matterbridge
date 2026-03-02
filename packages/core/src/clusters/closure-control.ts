/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */
/**
 * Closure Control Cluster Matter 1.5.0 - 5.4. Closure Control Cluster
 */

import { Identity } from '@matter/general';
import { Attribute, ClusterRegistry, Command, Event, EventPriority, FixedAttribute, MutableCluster, TlvNoResponse } from '@matter/types/cluster';
import { ThreeLevelAuto } from '@matter/types/globals';
import { BitFlag } from '@matter/types/schema';
import {
  TlvArray,
  TlvBitmap,
  TlvBoolean,
  TlvEnum,
  TlvField,
  TlvNoArguments,
  TlvNullable,
  TlvObject,
  TlvOptionalField,
  TlvUInt8,
  TlvUInt32,
  TypeFromSchema,
} from '@matter/types/tlv';

export namespace ClosureControl {
  /**
   * These are optional features supported by ClosureControlCluster.
   */
  export enum Feature {
    Positioning = 'Positioning',
    MotionLatching = 'MotionLatching',
    Instantaneous = 'Instantaneous',
    Speed = 'Speed',
    Ventilation = 'Ventilation',
    Pedestrian = 'Pedestrian',
    Calibration = 'Calibration',
    Protection = 'Protection',
    ManuallyOperable = 'ManuallyOperable',
  }

  export enum ClosureError {
    PhysicallyBlocked = 0,
    BlockedBySensor = 1,
    TemperatureLimited = 2,
    MaintenanceRequired = 3,
    InternalInterference = 4,
  }

  export enum CurrentPosition {
    FullyClosed = 0,
    FullyOpened = 1,
    PartiallyOpened = 2,
    OpenedForPedestrian = 3,
    OpenedForVentilation = 4,
    OpenedAtSignature = 5,
  }

  export enum MainState {
    Stopped = 0,
    Moving = 1,
    WaitingForMotion = 2,
    Error = 3,
    Calibrating = 4,
    Protected = 5,
    Disengaged = 6,
    SetupRequired = 7,
  }

  export enum TargetPosition {
    MoveToFullyClosed = 0,
    MoveToFullyOpen = 1,
    MoveToPedestrianPosition = 2,
    MoveToVentilationPosition = 3,
    MoveToSignaturePosition = 4,
  }

  export const LatchControlModes = {
    remoteLatching: BitFlag(0),
    remoteUnlatching: BitFlag(1),
  };

  export const TlvOverallCurrentState = TlvObject({
    position: TlvOptionalField(0, TlvNullable(TlvEnum<CurrentPosition>())),
    latch: TlvOptionalField(1, TlvNullable(TlvBoolean)),
    speed: TlvOptionalField(2, TlvEnum<ThreeLevelAuto>()),
    secureState: TlvOptionalField(3, TlvNullable(TlvBoolean)),
  });

  export interface OverallCurrentState extends TypeFromSchema<typeof TlvOverallCurrentState> {}

  export const TlvOverallTargetState = TlvObject({
    position: TlvOptionalField(0, TlvNullable(TlvEnum<TargetPosition>())),
    latch: TlvOptionalField(1, TlvNullable(TlvBoolean)),
    speed: TlvOptionalField(2, TlvEnum<ThreeLevelAuto>()),
  });

  export interface OverallTargetState extends TypeFromSchema<typeof TlvOverallTargetState> {}

  export const TlvMoveToRequest = TlvObject({
    position: TlvOptionalField(0, TlvEnum<TargetPosition>()),
    latch: TlvOptionalField(1, TlvBoolean),
    speed: TlvOptionalField(2, TlvEnum<ThreeLevelAuto>()),
  });

  export interface MoveToRequest extends TypeFromSchema<typeof TlvMoveToRequest> {}

  export const TlvOperationalErrorEvent = TlvObject({
    errorState: TlvField(0, TlvArray(TlvEnum<ClosureError>(), { minLength: 1, maxLength: 10 })),
  });

  export const TlvEngageStateChangedEvent = TlvObject({
    engageValue: TlvField(0, TlvBoolean),
  });

  export const TlvSecureStateChangedEvent = TlvObject({
    secureValue: TlvField(0, TlvBoolean),
  });

  export const CountdownTimeComponent = MutableCluster.Component({
    attributes: {
      countdownTime: Attribute(0x0, TlvNullable(TlvUInt32.bound({ max: 259200 })), { default: null }),
    },
  });

  export const MotionLatchingComponent = MutableCluster.Component({
    attributes: {
      latchControlModes: FixedAttribute(0x5, TlvBitmap(TlvUInt8, LatchControlModes)),
    },
  });

  export const CalibrationComponent = MutableCluster.Component({
    commands: {
      calibrate: Command(0x2, TlvNoArguments, 0x2, TlvNoResponse, { timed: true }),
    },
  });

  export const ManuallyOperableComponent = MutableCluster.Component({
    events: {
      engageStateChanged: Event(0x2, EventPriority.Info, TlvEngageStateChangedEvent),
    },
  });

  export const NonInstantaneousComponent = MutableCluster.Component({
    commands: {
      stop: Command(0x0, TlvNoArguments, 0x0, TlvNoResponse),
    },

    events: {
      movementCompleted: Event(0x1, EventPriority.Info, TlvNoArguments),
    },
  });

  /**
   * These elements and properties are present in all ClosureControl clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x0104,
    name: 'ClosureControl',
    revision: 1,

    features: {
      positioning: BitFlag(0),
      motionLatching: BitFlag(1),
      instantaneous: BitFlag(2),
      speed: BitFlag(3),
      ventilation: BitFlag(4),
      pedestrian: BitFlag(5),
      calibration: BitFlag(6),
      protection: BitFlag(7),
      manuallyOperable: BitFlag(8),
    },

    attributes: {
      mainState: Attribute(0x1, TlvEnum<MainState>()),
      currentErrorList: Attribute(0x2, TlvArray(TlvEnum<ClosureError>(), { maxLength: 10 }), { default: [] }),
      overallCurrentState: Attribute(0x3, TlvNullable(TlvOverallCurrentState), { default: null }),
      overallTargetState: Attribute(0x4, TlvNullable(TlvOverallTargetState), { default: null }),
    },

    commands: {
      moveTo: Command(0x1, TlvMoveToRequest, 0x1, TlvNoResponse, { timed: true }),
    },

    events: {
      operationalError: Event(0x0, EventPriority.Critical, TlvOperationalErrorEvent),
      secureStateChanged: Event(0x3, EventPriority.Info, TlvSecureStateChangedEvent),
    },

    /**
     * This metadata controls which ClosureControlCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { instantaneous: false }, component: NonInstantaneousComponent },
      { flags: { motionLatching: true }, component: MotionLatchingComponent },
      { flags: { calibration: true }, component: CalibrationComponent },
      { flags: { manuallyOperable: true }, component: ManuallyOperableComponent },
      { flags: { positioning: true, instantaneous: false }, component: CountdownTimeComponent },

      // Feature legality constraints from conformance rules
      { flags: { positioning: false, motionLatching: false }, component: false },
      { flags: { speed: true, positioning: false }, component: false },
      { flags: { speed: true, instantaneous: true }, component: false },
      { flags: { ventilation: true, positioning: false }, component: false },
      { flags: { pedestrian: true, positioning: false }, component: false },
      { flags: { calibration: true, positioning: false }, component: false },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const Cluster = MutableCluster.ExtensibleOnly(Base);

  export interface Cluster extends Identity<typeof Cluster> {}
  const LT = { motionLatching: true };
  const CL = { calibration: true };
  const MO = { manuallyOperable: true };
  const PS_NOT_IS = { positioning: true, instantaneous: false };
  const NOT_IS = { instantaneous: false };

  /**
   * @see {@link Complete}
   */
  export const Complete = MutableCluster({
    id: Base.id,
    name: Base.name,
    revision: Base.revision,
    features: Base.features,

    attributes: {
      ...Base.attributes,
      countdownTime: MutableCluster.AsConditional(CountdownTimeComponent.attributes.countdownTime, { optionalIf: [PS_NOT_IS] }),
      latchControlModes: MutableCluster.AsConditional(MotionLatchingComponent.attributes.latchControlModes, { mandatoryIf: [LT] }),
    },

    commands: {
      ...Base.commands,
      stop: MutableCluster.AsConditional(NonInstantaneousComponent.commands.stop, { mandatoryIf: [NOT_IS] }),
      calibrate: MutableCluster.AsConditional(CalibrationComponent.commands.calibrate, { mandatoryIf: [CL] }),
    },

    events: {
      ...Base.events,
      movementCompleted: MutableCluster.AsConditional(NonInstantaneousComponent.events.movementCompleted, { mandatoryIf: [NOT_IS] }),
      engageStateChanged: MutableCluster.AsConditional(ManuallyOperableComponent.events.engageStateChanged, { mandatoryIf: [MO] }),
    },
  });

  /**
   * This cluster supports all ClosureControl features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active features
   * is legal per the Matter specification.
   */
  export interface Complete extends Identity<typeof Complete> {}
}

export type ClosureControlCluster = ClosureControl.Cluster;
export const ClosureControlCluster = ClosureControl.Cluster;

ClusterRegistry.register(ClosureControl.Complete);
