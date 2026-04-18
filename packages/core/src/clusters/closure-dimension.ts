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

import { type MaybePromise } from '@matter/general';
import { AttributeElement, ClusterElement, ClusterModel, CommandElement, DatatypeElement, FieldElement, Matter, MatterDefinition } from '@matter/main/model';
import { ClusterType, type ClusterTyping } from '@matter/types/cluster';
import { type ClusterId } from '@matter/types/datatype';
import { type ThreeLevelAuto } from '@matter/types/globals';

// Create the cluster definition and model for the ClosureDimension cluster.
export const ClosureDimensionDefinition = ClusterElement(
  {
    name: 'ClosureDimension',
    id: 0x0105,
    classification: 'application',
  },
  AttributeElement({ name: 'ClusterRevision', id: 0xfffd, type: 'ClusterRevision', default: 1 }),
  AttributeElement(
    { name: 'FeatureMap', id: 0xfffc, type: 'FeatureMap' },
    FieldElement({ name: 'POS', conformance: 'O', constraint: '0', title: 'Positioning' }),
    FieldElement({ name: 'ML', conformance: 'O', constraint: '1', title: 'MotionLatching' }),
    FieldElement({ name: 'UNI', conformance: '[POS]', constraint: '2', title: 'Unit' }),
    FieldElement({ name: 'LIM', conformance: '[POS]', constraint: '3', title: 'Limitation' }),
    FieldElement({ name: 'SPD', conformance: '[POS]', constraint: '4', title: 'Speed' }),
    FieldElement({ name: 'TRN', conformance: '[POS]', constraint: '5', title: 'Translation' }),
    FieldElement({ name: 'ROT', conformance: '[POS]', constraint: '6', title: 'Rotation' }),
    FieldElement({ name: 'MOD', conformance: '[POS]', constraint: '7', title: 'Modulation' }),
  ),
  AttributeElement({ name: 'CurrentState', id: 0x0000, type: 'DimensionStateStruct', access: 'R V', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'TargetState', id: 0x0001, type: 'DimensionStateStruct', access: 'R V', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'Resolution', id: 0x0002, type: 'percent100ths', access: 'R V', conformance: 'POS', default: 1, quality: 'F' }),
  AttributeElement({ name: 'StepValue', id: 0x0003, type: 'percent100ths', access: 'R V', conformance: 'POS', default: 1, quality: 'F' }),
  AttributeElement({ name: 'Unit', id: 0x0004, type: 'ClosureUnitEnum', access: 'R V', conformance: 'UNI', quality: 'F' }),
  AttributeElement({ name: 'UnitRange', id: 0x0005, type: 'UnitRangeStruct', access: 'R V', conformance: 'UNI', default: null, quality: 'X' }),
  AttributeElement({ name: 'LimitRange', id: 0x0006, type: 'RangePercent100thsStruct', access: 'R V', conformance: 'LIM' }),
  AttributeElement({ name: 'TranslationDirection', id: 0x0007, type: 'TranslationDirectionEnum', access: 'R V', conformance: 'TRN', quality: 'F' }),
  AttributeElement({ name: 'RotationAxis', id: 0x0008, type: 'RotationAxisEnum', access: 'R V', conformance: 'ROT', quality: 'F' }),
  AttributeElement({ name: 'Overflow', id: 0x0009, type: 'OverflowEnum', access: 'R V', conformance: 'ROT', quality: 'F' }),
  AttributeElement({ name: 'ModulationType', id: 0x000a, type: 'ModulationTypeEnum', access: 'R V', conformance: 'MOD', quality: 'F' }),
  AttributeElement({ name: 'LatchControlModes', id: 0x000b, type: 'LatchControlModesAttribute', access: 'R V', conformance: 'ML', quality: 'F' }),
  CommandElement(
    { name: 'SetTarget', id: 0x0000, access: 'O T', conformance: 'M', direction: 'request', response: 'status' },
    FieldElement({ name: 'Position', id: 0x0, type: 'percent100ths', conformance: 'O' }),
    FieldElement({ name: 'Latch', id: 0x1, type: 'bool', conformance: 'O' }),
    FieldElement({ name: 'Speed', id: 0x2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
  CommandElement(
    { name: 'Step', id: 0x0001, access: 'O T', conformance: 'POS', direction: 'request', response: 'status' },
    FieldElement({ name: 'Direction', id: 0x0, type: 'StepDirectionEnum', conformance: 'M' }),
    FieldElement({ name: 'NumberOfSteps', id: 0x1, type: 'uint16', conformance: 'M', constraint: 'min 1' }),
    FieldElement({ name: 'Speed', id: 0x2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
  DatatypeElement(
    { name: 'ClosureUnitEnum', type: 'enum8' },
    FieldElement({ name: 'Millimeter', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'Degree', id: 0x1, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'ModulationTypeEnum', type: 'enum8' },
    FieldElement({ name: 'SlatsOrientation', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'SlatsOpenwork', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'StripesAlignment', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'Opacity', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'Ventilation', id: 0x4, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'OverflowEnum', type: 'enum8' },
    FieldElement({ name: 'NoOverflow', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'Inside', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'Outside', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'TopInside', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'TopOutside', id: 0x4, conformance: 'M' }),
    FieldElement({ name: 'BottomInside', id: 0x5, conformance: 'M' }),
    FieldElement({ name: 'BottomOutside', id: 0x6, conformance: 'M' }),
    FieldElement({ name: 'LeftInside', id: 0x7, conformance: 'M' }),
    FieldElement({ name: 'LeftOutside', id: 0x8, conformance: 'M' }),
    FieldElement({ name: 'RightInside', id: 0x9, conformance: 'M' }),
    FieldElement({ name: 'RightOutside', id: 0x0a, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'RotationAxisEnum', type: 'enum8' },
    FieldElement({ name: 'Left', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'CenteredVertical', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'LeftAndRight', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'Right', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'Top', id: 0x4, conformance: 'M' }),
    FieldElement({ name: 'CenteredHorizontal', id: 0x5, conformance: 'M' }),
    FieldElement({ name: 'TopAndBottom', id: 0x6, conformance: 'M' }),
    FieldElement({ name: 'Bottom', id: 0x7, conformance: 'M' }),
    FieldElement({ name: 'LeftBarrier', id: 0x8, conformance: 'M' }),
    FieldElement({ name: 'LeftAndRightBarriers', id: 0x9, conformance: 'M' }),
    FieldElement({ name: 'RightBarrier', id: 0x0a, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'StepDirectionEnum', type: 'enum8' },
    FieldElement({ name: 'Decrease', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'Increase', id: 0x1, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'TranslationDirectionEnum', type: 'enum8' },
    FieldElement({ name: 'Downward', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'Upward', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'VerticalMask', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'VerticalSymmetry', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'Leftward', id: 0x4, conformance: 'M' }),
    FieldElement({ name: 'Rightward', id: 0x5, conformance: 'M' }),
    FieldElement({ name: 'HorizontalMask', id: 0x6, conformance: 'M' }),
    FieldElement({ name: 'HorizontalSymmetry', id: 0x7, conformance: 'M' }),
    FieldElement({ name: 'Forward', id: 0x8, conformance: 'M' }),
    FieldElement({ name: 'Backward', id: 0x9, conformance: 'M' }),
    FieldElement({ name: 'DepthMask', id: 0x0a, conformance: 'M' }),
    FieldElement({ name: 'DepthSymmetry', id: 0x0b, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'LatchControlModesAttribute', type: 'map8' },
    FieldElement({ name: 'RemoteLatching', constraint: '0' }),
    FieldElement({ name: 'RemoteUnlatching', constraint: '1' }),
  ),
  DatatypeElement(
    { name: 'DimensionStateStruct', type: 'struct' },
    FieldElement({ name: 'Position', id: 0x0, type: 'percent100ths', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Latch', id: 0x1, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Speed', id: 0x2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
  DatatypeElement(
    { name: 'RangePercent100thsStruct', type: 'struct' },
    FieldElement({ name: 'Min', id: 0x0, type: 'percent100ths', conformance: 'M' }),
    FieldElement({ name: 'Max', id: 0x1, type: 'percent100ths', conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'UnitRangeStruct', type: 'struct' },
    FieldElement({ name: 'Min', id: 0x0, type: 'int16', conformance: 'M' }),
    FieldElement({ name: 'Max', id: 0x1, type: 'int16', conformance: 'M' }),
  ),
);

export const ClosureDimensionModel = new ClusterModel(ClosureDimensionDefinition);

// Register the cluster definition with the Matter definition so it can be referenced by devices and endpoints.
MatterDefinition.children.push(ClosureDimensionDefinition);

// Register the cluster model with the canonical Matter model so helper utilities like `getClusterNameById()` can resolve the name for this custom cluster ID.
if (Matter.clusters(ClosureDimensionModel.id) === undefined) {
  Matter.children.push(ClosureDimensionModel);
}

export declare namespace ClosureDimension {
  interface FeatureEnum {
    readonly Positioning: 'Positioning';
    readonly MotionLatching: 'MotionLatching';
    readonly Unit: 'Unit';
    readonly Limitation: 'Limitation';
    readonly Speed: 'Speed';
    readonly Translation: 'Translation';
    readonly Rotation: 'Rotation';
    readonly Modulation: 'Modulation';
  }

  interface ClosureUnitEnum {
    readonly Millimeter: 0;
    readonly Degree: 1;
  }

  interface ModulationTypeEnum {
    readonly SlatsOrientation: 0;
    readonly SlatsOpenwork: 1;
    readonly StripesAlignment: 2;
    readonly Opacity: 3;
    readonly Ventilation: 4;
  }

  interface OverflowEnum {
    readonly NoOverflow: 0;
    readonly Inside: 1;
    readonly Outside: 2;
    readonly TopInside: 3;
    readonly TopOutside: 4;
    readonly BottomInside: 5;
    readonly BottomOutside: 6;
    readonly LeftInside: 7;
    readonly LeftOutside: 8;
    readonly RightInside: 9;
    readonly RightOutside: 10;
  }

  interface RotationAxisEnum {
    readonly Left: 0;
    readonly CenteredVertical: 1;
    readonly LeftAndRight: 2;
    readonly Right: 3;
    readonly Top: 4;
    readonly CenteredHorizontal: 5;
    readonly TopAndBottom: 6;
    readonly Bottom: 7;
    readonly LeftBarrier: 8;
    readonly LeftAndRightBarriers: 9;
    readonly RightBarrier: 10;
  }

  interface StepDirectionEnum {
    readonly Decrease: 0;
    readonly Increase: 1;
  }

  interface TranslationDirectionEnum {
    readonly Downward: 0;
    readonly Upward: 1;
    readonly VerticalMask: 2;
    readonly VerticalSymmetry: 3;
    readonly Leftward: 4;
    readonly Rightward: 5;
    readonly HorizontalMask: 6;
    readonly HorizontalSymmetry: 7;
    readonly Forward: 8;
    readonly Backward: 9;
    readonly DepthMask: 10;
    readonly DepthSymmetry: 11;
  }

  type Feature = FeatureEnum[keyof FeatureEnum];
  type Features = Feature;
  type ClosureUnit = ClosureUnitEnum[keyof ClosureUnitEnum];
  type ModulationType = ModulationTypeEnum[keyof ModulationTypeEnum];
  type Overflow = OverflowEnum[keyof OverflowEnum];
  type RotationAxis = RotationAxisEnum[keyof RotationAxisEnum];
  type StepDirection = StepDirectionEnum[keyof StepDirectionEnum];
  type TranslationDirection = TranslationDirectionEnum[keyof TranslationDirectionEnum];

  interface LatchControlModesAttribute {
    remoteLatching?: boolean;
    remoteUnlatching?: boolean;
  }

  interface DimensionState {
    position?: number | null;
    latch?: boolean | null;
    speed?: ThreeLevelAuto;
  }

  interface RangePercent100ths {
    min: number;
    max: number;
  }

  interface UnitRange {
    min: number;
    max: number;
  }

  interface SetTargetRequest {
    position?: number;
    latch?: boolean;
    speed?: ThreeLevelAuto;
  }

  interface StepRequest {
    direction: StepDirection;
    numberOfSteps: number;
    speed?: ThreeLevelAuto;
  }

  interface Attributes {
    currentState: DimensionState | null;
    targetState: DimensionState | null;
    resolution?: number;
    stepValue?: number;
    unit?: ClosureUnit;
    unitRange?: UnitRange | null;
    limitRange?: RangePercent100ths;
    translationDirection?: TranslationDirection;
    rotationAxis?: RotationAxis;
    overflow?: Overflow;
    modulationType?: ModulationType;
    latchControlModes?: LatchControlModesAttribute;
  }

  interface Commands {
    setTarget(request: SetTargetRequest): MaybePromise;
    step?(request: StepRequest): MaybePromise;
  }

  type Components = [{ flags: {}; attributes: Attributes; commands: Commands }];

  interface Typing extends ClusterTyping {
    Attributes: ClosureDimension.Attributes;
    Commands: ClosureDimension.Commands;
    Features: ClosureDimension.Features;
    Components: ClosureDimension.Components;
  }
}

export const ClosureDimension = ClusterType(ClosureDimensionModel) as ClusterType.Concrete & {
  readonly id: ClusterId & 0x0105;
  readonly name: 'ClosureDimension';
  readonly revision: 1;
  readonly schema: ClusterModel;
  readonly attributes: ClusterType.AttributeObjects<ClosureDimension.Attributes>;
  readonly commands: ClusterType.CommandObjects<ClosureDimension.Commands>;
  readonly Feature: ClosureDimension.FeatureEnum;
  readonly ClosureUnit: ClosureDimension.ClosureUnitEnum;
  readonly ModulationType: ClosureDimension.ModulationTypeEnum;
  readonly Overflow: ClosureDimension.OverflowEnum;
  readonly RotationAxis: ClosureDimension.RotationAxisEnum;
  readonly StepDirection: ClosureDimension.StepDirectionEnum;
  readonly TranslationDirection: ClosureDimension.TranslationDirectionEnum;
  readonly Typing: ClosureDimension.Typing;
  /** @deprecated Use {@link ClosureDimension}. */
  readonly Cluster: typeof ClosureDimension;
  /** @deprecated Use {@link ClosureDimension}. */
  readonly Complete: typeof ClosureDimension;
  /** @deprecated */
  with(...features: ClosureDimension.Feature[]): typeof ClosureDimension;
};
