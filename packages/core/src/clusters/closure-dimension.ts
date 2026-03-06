/**
 * @description Closure Dimension Cluster Matter 1.5.0 - 5.5. Closure Dimension Cluster
 * @file src/clusters/closure-dimension.ts
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-namespace */

import { Identity } from '@matter/general';
import { Attribute, ClusterRegistry, Command, FixedAttribute, MutableCluster, TlvNoResponse } from '@matter/types/cluster';
import { ThreeLevelAuto } from '@matter/types/globals';
import { BitFlag } from '@matter/types/schema';
import {
  TlvBitmap,
  TlvBoolean,
  TlvEnum,
  TlvField,
  TlvInt16,
  TlvNullable,
  TlvObject,
  TlvOptionalField,
  TlvPercent100ths,
  TlvUInt8,
  TlvUInt16,
  TypeFromSchema,
} from '@matter/types/tlv';

export namespace ClosureDimension {
  /**
   * These are optional features supported by ClosureDimensionCluster.
   */
  export enum Feature {
    Positioning = 'Positioning',
    MotionLatching = 'MotionLatching',
    Unit = 'Unit',
    Limitation = 'Limitation',
    Speed = 'Speed',
    Translation = 'Translation',
    Rotation = 'Rotation',
    Modulation = 'Modulation',
  }

  export enum ClosureUnit {
    Millimeter = 0,
    Degree = 1,
  }

  export enum ModulationType {
    SlatsOrientation = 0,
    SlatsOpenwork = 1,
    StripesAlignment = 2,
    Opacity = 3,
    Ventilation = 4,
  }

  export enum Overflow {
    NoOverflow = 0,
    Inside = 1,
    Outside = 2,
    TopInside = 3,
    TopOutside = 4,
    BottomInside = 5,
    BottomOutside = 6,
    LeftInside = 7,
    LeftOutside = 8,
    RightInside = 9,
    RightOutside = 10,
  }

  export enum RotationAxis {
    Left = 0,
    CenteredVertical = 1,
    LeftAndRight = 2,
    Right = 3,
    Top = 4,
    CenteredHorizontal = 5,
    TopAndBottom = 6,
    Bottom = 7,
    LeftBarrier = 8,
    LeftAndRightBarriers = 9,
    RightBarrier = 10,
  }

  export enum StepDirection {
    Decrease = 0,
    Increase = 1,
  }

  export enum TranslationDirection {
    Downward = 0,
    Upward = 1,
    VerticalMask = 2,
    VerticalSymmetry = 3,
    Leftward = 4,
    Rightward = 5,
    HorizontalMask = 6,
    HorizontalSymmetry = 7,
    Forward = 8,
    Backward = 9,
    DepthMask = 10,
    DepthSymmetry = 11,
  }

  export const LatchControlModes = {
    remoteLatching: BitFlag(0),
    remoteUnlatching: BitFlag(1),
  };

  export const TlvDimensionState = TlvObject({
    position: TlvOptionalField(0, TlvNullable(TlvPercent100ths)),
    latch: TlvOptionalField(1, TlvNullable(TlvBoolean)),
    speed: TlvOptionalField(2, TlvEnum<ThreeLevelAuto>()),
  });

  export interface DimensionState extends TypeFromSchema<typeof TlvDimensionState> {}

  export const TlvRangePercent100ths = TlvObject({
    min: TlvField(0, TlvPercent100ths),
    max: TlvField(1, TlvPercent100ths),
  });

  export const TlvUnitRange = TlvObject({
    min: TlvField(0, TlvInt16),
    max: TlvField(1, TlvInt16),
  });

  export const TlvSetTargetRequest = TlvObject({
    position: TlvOptionalField(0, TlvPercent100ths),
    latch: TlvOptionalField(1, TlvBoolean),
    speed: TlvOptionalField(2, TlvEnum<ThreeLevelAuto>()),
  });

  export interface SetTargetRequest extends TypeFromSchema<typeof TlvSetTargetRequest> {}

  export const TlvStepRequest = TlvObject({
    direction: TlvField(0, TlvEnum<StepDirection>()),
    numberOfSteps: TlvField(1, TlvUInt16.bound({ min: 1 })),
    speed: TlvOptionalField(2, TlvEnum<ThreeLevelAuto>()),
  });

  export interface StepRequest extends TypeFromSchema<typeof TlvStepRequest> {}

  export const PositioningComponent = MutableCluster.Component({
    attributes: {
      resolution: FixedAttribute(0x2, TlvPercent100ths, { default: 1 }),
      stepValue: FixedAttribute(0x3, TlvPercent100ths, { default: 1 }),
    },

    commands: {
      step: Command(0x1, TlvStepRequest, 0x1, TlvNoResponse, { timed: true }),
    },
  });

  export const MotionLatchingComponent = MutableCluster.Component({
    attributes: {
      latchControlModes: FixedAttribute(0xb, TlvBitmap(TlvUInt8, LatchControlModes)),
    },
  });

  export const UnitComponent = MutableCluster.Component({
    attributes: {
      unit: FixedAttribute(0x4, TlvEnum<ClosureUnit>()),
      unitRange: Attribute(0x5, TlvNullable(TlvUnitRange), { default: null }),
    },
  });

  export const LimitationComponent = MutableCluster.Component({
    attributes: {
      limitRange: Attribute(0x6, TlvRangePercent100ths),
    },
  });

  export const TranslationComponent = MutableCluster.Component({
    attributes: {
      translationDirection: FixedAttribute(0x7, TlvEnum<TranslationDirection>()),
    },
  });

  export const RotationComponent = MutableCluster.Component({
    attributes: {
      rotationAxis: FixedAttribute(0x8, TlvEnum<RotationAxis>()),
      overflow: FixedAttribute(0x9, TlvEnum<Overflow>()),
    },
  });

  export const ModulationComponent = MutableCluster.Component({
    attributes: {
      modulationType: FixedAttribute(0xa, TlvEnum<ModulationType>()),
    },
  });

  /**
   * These elements and properties are present in all ClosureDimension clusters.
   */
  export const Base = MutableCluster.Component({
    id: 0x0105,
    name: 'ClosureDimension',
    revision: 1,

    features: {
      positioning: BitFlag(0),
      motionLatching: BitFlag(1),
      unit: BitFlag(2),
      limitation: BitFlag(3),
      speed: BitFlag(4),
      translation: BitFlag(5),
      rotation: BitFlag(6),
      modulation: BitFlag(7),
    },

    attributes: {
      currentState: Attribute(0x0, TlvNullable(TlvDimensionState), { default: null }),
      targetState: Attribute(0x1, TlvNullable(TlvDimensionState), { default: null }),
    },

    commands: {
      setTarget: Command(0x0, TlvSetTargetRequest, 0x0, TlvNoResponse, { timed: true }),
    },

    /**
     * This metadata controls which ClosureDimensionCluster elements matter.js activates for specific feature
     * combinations.
     */
    extensions: MutableCluster.Extensions(
      { flags: { positioning: true }, component: PositioningComponent },
      { flags: { motionLatching: true }, component: MotionLatchingComponent },
      { flags: { unit: true }, component: UnitComponent },
      { flags: { limitation: true }, component: LimitationComponent },
      { flags: { translation: true }, component: TranslationComponent },
      { flags: { rotation: true }, component: RotationComponent },
      { flags: { modulation: true }, component: ModulationComponent },

      // Feature legality constraints from conformance rules
      { flags: { positioning: false, motionLatching: false }, component: false },
      { flags: { unit: true, positioning: false }, component: false },
      { flags: { limitation: true, positioning: false }, component: false },
      { flags: { speed: true, positioning: false }, component: false },
      { flags: { translation: true, positioning: false }, component: false },
      { flags: { rotation: true, positioning: false }, component: false },
      { flags: { modulation: true, positioning: false }, component: false },

      // Choice group "b": Translation/Rotation/Modulation are mutually exclusive.
      { flags: { translation: true, rotation: true }, component: false },
      { flags: { translation: true, modulation: true }, component: false },
      { flags: { rotation: true, modulation: true }, component: false },
    ),
  });

  /**
   * @see {@link Cluster}
   */
  export const Cluster = MutableCluster.ExtensibleOnly(Base);

  export interface Cluster extends Identity<typeof Cluster> {}

  const PS = { positioning: true };
  const LT = { motionLatching: true };
  const UT = { unit: true };
  const LM = { limitation: true };
  const TR = { translation: true };
  const RO = { rotation: true };
  const MD = { modulation: true };

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
      resolution: MutableCluster.AsConditional(PositioningComponent.attributes.resolution, { mandatoryIf: [PS] }),
      stepValue: MutableCluster.AsConditional(PositioningComponent.attributes.stepValue, { mandatoryIf: [PS] }),
      unit: MutableCluster.AsConditional(UnitComponent.attributes.unit, { mandatoryIf: [UT] }),
      unitRange: MutableCluster.AsConditional(UnitComponent.attributes.unitRange, { mandatoryIf: [UT] }),
      limitRange: MutableCluster.AsConditional(LimitationComponent.attributes.limitRange, { mandatoryIf: [LM] }),
      translationDirection: MutableCluster.AsConditional(TranslationComponent.attributes.translationDirection, { mandatoryIf: [TR] }),
      rotationAxis: MutableCluster.AsConditional(RotationComponent.attributes.rotationAxis, { mandatoryIf: [RO] }),
      overflow: MutableCluster.AsConditional(RotationComponent.attributes.overflow, { mandatoryIf: [RO] }),
      modulationType: MutableCluster.AsConditional(ModulationComponent.attributes.modulationType, { mandatoryIf: [MD] }),
      latchControlModes: MutableCluster.AsConditional(MotionLatchingComponent.attributes.latchControlModes, { mandatoryIf: [LT] }),
    },

    commands: {
      ...Base.commands,
      step: MutableCluster.AsConditional(PositioningComponent.commands.step, { mandatoryIf: [PS] }),
    },
  });

  /**
   * This cluster supports all ClosureDimension features. It may support illegal feature combinations.
   *
   * If you use this cluster you must manually specify which features are active and ensure the set of active features
   * is legal per the Matter specification.
   */
  export interface Complete extends Identity<typeof Complete> {}
}

export type ClosureDimensionCluster = ClosureDimension.Cluster;
export const ClosureDimensionCluster = ClosureDimension.Cluster;

ClusterRegistry.register(ClosureDimension.Complete);
