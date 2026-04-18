/**
 * @description Closure Control Cluster Matter 1.5.0 - 5.4. Closure Control Cluster.
 * @file src/clusters/closure-control.ts
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
import { AttributeElement, ClusterElement, ClusterModel, CommandElement, DatatypeElement, EventElement, FieldElement, Matter, MatterDefinition } from '@matter/main/model';
import { ClusterType, type ClusterTyping } from '@matter/types/cluster';
import { type ClusterId } from '@matter/types/datatype';
import { type ThreeLevelAuto } from '@matter/types/globals';

// Create the cluster definition and model for the ClosureControl cluster.
export const ClosureControlDefinition = ClusterElement(
  {
    name: 'ClosureControl',
    id: 0x0104,
    classification: 'application',
  },
  AttributeElement({ name: 'ClusterRevision', id: 0xfffd, type: 'ClusterRevision', default: 1 }),
  AttributeElement(
    { name: 'FeatureMap', id: 0xfffc, type: 'FeatureMap' },
    FieldElement({ name: 'POS', conformance: 'O', constraint: '0', title: 'Positioning' }),
    FieldElement({ name: 'ML', conformance: 'O', constraint: '1', title: 'MotionLatching' }),
    FieldElement({ name: 'INS', conformance: 'O', constraint: '2', title: 'Instantaneous' }),
    FieldElement({ name: 'SPD', conformance: '[POS & !INS]', constraint: '3', title: 'Speed' }),
    FieldElement({ name: 'VNT', conformance: '[POS]', constraint: '4', title: 'Ventilation' }),
    FieldElement({ name: 'PED', conformance: '[POS]', constraint: '5', title: 'Pedestrian' }),
    FieldElement({ name: 'CAL', conformance: '[POS]', constraint: '6', title: 'Calibration' }),
    FieldElement({ name: 'PRT', conformance: 'O', constraint: '7', title: 'Protection' }),
    FieldElement({ name: 'MAN', conformance: 'O', constraint: '8', title: 'ManuallyOperable' }),
  ),
  AttributeElement({ name: 'CountdownTime', id: 0x0000, type: 'uint32', access: 'R V', conformance: '[POS & !INS]', constraint: 'max 259200', default: null, quality: 'X' }),
  AttributeElement({ name: 'MainState', id: 0x0001, type: 'MainStateEnum', access: 'R V', conformance: 'M', constraint: 'desc' }),
  AttributeElement(
    { name: 'CurrentErrorList', id: 0x0002, type: 'list', access: 'R V', conformance: 'M', constraint: 'max 10', default: [] },
    FieldElement({ name: 'entry', type: 'ClosureErrorEnum' }),
  ),
  AttributeElement({ name: 'OverallCurrentState', id: 0x0003, type: 'OverallCurrentStateStruct', access: 'R V', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'OverallTargetState', id: 0x0004, type: 'OverallTargetStateStruct', access: 'R V', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'LatchControlModes', id: 0x0005, type: 'LatchControlModesAttribute', access: 'R V', conformance: 'ML', quality: 'F' }),
  CommandElement({ name: 'Stop', id: 0x0000, access: 'O', conformance: '!INS', direction: 'request', response: 'status' }),
  CommandElement(
    { name: 'MoveTo', id: 0x0001, access: 'O T', conformance: 'M', direction: 'request', response: 'status' },
    FieldElement({ name: 'Position', id: 0x0, type: 'TargetPositionEnum', conformance: 'O' }),
    FieldElement({ name: 'Latch', id: 0x1, type: 'bool', conformance: 'O' }),
    FieldElement({ name: 'Speed', id: 0x2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
  CommandElement({ name: 'Calibrate', id: 0x0002, access: 'O T', conformance: 'CAL', direction: 'request', response: 'status' }),
  EventElement(
    { name: 'OperationalError', id: 0x0000, access: 'V', conformance: 'M', priority: 'critical' },
    FieldElement({ name: 'ErrorState', id: 0x0, type: 'list', conformance: 'M', constraint: 'max 10' }, FieldElement({ name: 'entry', type: 'ClosureErrorEnum' })),
  ),
  EventElement({ name: 'MovementCompleted', id: 0x0001, access: 'V', conformance: '!INS', priority: 'info' }),
  EventElement(
    { name: 'EngageStateChanged', id: 0x0002, access: 'V', conformance: 'MAN', priority: 'info' },
    FieldElement({ name: 'EngageValue', id: 0x0, type: 'bool', conformance: 'M' }),
  ),
  EventElement(
    { name: 'SecureStateChanged', id: 0x0003, access: 'V', conformance: 'M', priority: 'info' },
    FieldElement({ name: 'SecureValue', id: 0x0, type: 'bool', conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'ClosureErrorEnum', type: 'enum8' },
    FieldElement({ name: 'PhysicallyBlocked', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'BlockedBySensor', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'TemperatureLimited', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'MaintenanceRequired', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'InternalInterference', id: 0x4, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'CurrentPositionEnum', type: 'enum8' },
    FieldElement({ name: 'FullyClosed', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'FullyOpened', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'PartiallyOpened', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'OpenedForPedestrian', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'OpenedForVentilation', id: 0x4, conformance: 'M' }),
    FieldElement({ name: 'OpenedAtSignature', id: 0x5, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'MainStateEnum', type: 'enum8' },
    FieldElement({ name: 'Stopped', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'Moving', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'WaitingForMotion', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'Error', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'Calibrating', id: 0x4, conformance: 'M' }),
    FieldElement({ name: 'Protected', id: 0x5, conformance: 'M' }),
    FieldElement({ name: 'Disengaged', id: 0x6, conformance: 'M' }),
    FieldElement({ name: 'SetupRequired', id: 0x7, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'TargetPositionEnum', type: 'enum8' },
    FieldElement({ name: 'MoveToFullyClosed', id: 0x0, conformance: 'M' }),
    FieldElement({ name: 'MoveToFullyOpen', id: 0x1, conformance: 'M' }),
    FieldElement({ name: 'MoveToPedestrianPosition', id: 0x2, conformance: 'M' }),
    FieldElement({ name: 'MoveToVentilationPosition', id: 0x3, conformance: 'M' }),
    FieldElement({ name: 'MoveToSignaturePosition', id: 0x4, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'LatchControlModesAttribute', type: 'map8' },
    FieldElement({ name: 'RemoteLatching', constraint: '0' }),
    FieldElement({ name: 'RemoteUnlatching', constraint: '1' }),
  ),
  DatatypeElement(
    { name: 'OverallCurrentStateStruct', type: 'struct' },
    FieldElement({ name: 'Position', id: 0x0, type: 'CurrentPositionEnum', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Latch', id: 0x1, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Speed', id: 0x2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
    FieldElement({ name: 'SecureState', id: 0x3, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
  ),
  DatatypeElement(
    { name: 'OverallTargetStateStruct', type: 'struct' },
    FieldElement({ name: 'Position', id: 0x0, type: 'TargetPositionEnum', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Latch', id: 0x1, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Speed', id: 0x2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
);

export const ClosureControlModel = new ClusterModel(ClosureControlDefinition);

// Register the cluster definition with the Matter definition so it can be referenced by devices and endpoints.
MatterDefinition.children.push(ClosureControlDefinition);

// Register the cluster model with the canonical Matter model so helper utilities like `getClusterNameById()` can resolve the name for this custom cluster ID.
if (Matter.clusters(ClosureControlModel.id) === undefined) {
  Matter.children.push(ClosureControlModel);
}

export declare namespace ClosureControl {
  interface FeatureEnum {
    readonly Positioning: 'Positioning';
    readonly MotionLatching: 'MotionLatching';
    readonly Instantaneous: 'Instantaneous';
    readonly Speed: 'Speed';
    readonly Ventilation: 'Ventilation';
    readonly Pedestrian: 'Pedestrian';
    readonly Calibration: 'Calibration';
    readonly Protection: 'Protection';
    readonly ManuallyOperable: 'ManuallyOperable';
  }

  interface ClosureErrorEnum {
    readonly PhysicallyBlocked: 0;
    readonly BlockedBySensor: 1;
    readonly TemperatureLimited: 2;
    readonly MaintenanceRequired: 3;
    readonly InternalInterference: 4;
  }

  interface CurrentPositionEnum {
    readonly FullyClosed: 0;
    readonly FullyOpened: 1;
    readonly PartiallyOpened: 2;
    readonly OpenedForPedestrian: 3;
    readonly OpenedForVentilation: 4;
    readonly OpenedAtSignature: 5;
  }

  interface MainStateEnum {
    readonly Stopped: 0;
    readonly Moving: 1;
    readonly WaitingForMotion: 2;
    readonly Error: 3;
    readonly Calibrating: 4;
    readonly Protected: 5;
    readonly Disengaged: 6;
    readonly SetupRequired: 7;
  }

  interface TargetPositionEnum {
    readonly MoveToFullyClosed: 0;
    readonly MoveToFullyOpen: 1;
    readonly MoveToPedestrianPosition: 2;
    readonly MoveToVentilationPosition: 3;
    readonly MoveToSignaturePosition: 4;
  }

  type Feature = FeatureEnum[keyof FeatureEnum];
  type Features = Feature;
  type ClosureError = ClosureErrorEnum[keyof ClosureErrorEnum];
  type CurrentPosition = CurrentPositionEnum[keyof CurrentPositionEnum];
  type MainState = MainStateEnum[keyof MainStateEnum];
  type TargetPosition = TargetPositionEnum[keyof TargetPositionEnum];

  interface LatchControlModesAttribute {
    remoteLatching?: boolean;
    remoteUnlatching?: boolean;
  }

  interface OverallCurrentState {
    position?: CurrentPosition | null;
    latch?: boolean | null;
    speed?: ThreeLevelAuto;
    secureState?: boolean | null;
  }

  interface OverallTargetState {
    position?: TargetPosition | null;
    latch?: boolean | null;
    speed?: ThreeLevelAuto;
  }

  interface MoveToRequest {
    position?: TargetPosition;
    latch?: boolean;
    speed?: ThreeLevelAuto;
  }

  interface OperationalErrorEvent {
    errorState: ClosureError[];
  }

  interface EngageStateChangedEvent {
    engageValue: boolean;
  }

  interface SecureStateChangedEvent {
    secureValue: boolean;
  }

  interface Attributes {
    countdownTime?: number | null;
    mainState: MainState;
    currentErrorList: ClosureError[];
    overallCurrentState: OverallCurrentState | null;
    overallTargetState: OverallTargetState | null;
    latchControlModes?: LatchControlModesAttribute;
  }

  interface Commands {
    moveTo(request: MoveToRequest): MaybePromise;
    stop?(): MaybePromise;
    calibrate?(): MaybePromise;
  }

  interface Events {
    operationalError: OperationalErrorEvent;
    movementCompleted?: Record<string, never>;
    engageStateChanged?: EngageStateChangedEvent;
    secureStateChanged: SecureStateChangedEvent;
  }

  type Components = [{ flags: {}; attributes: Attributes; commands: Commands; events: Events }];

  interface Typing extends ClusterTyping {
    Attributes: ClosureControl.Attributes;
    Commands: ClosureControl.Commands;
    Events: ClosureControl.Events;
    Features: ClosureControl.Features;
    Components: ClosureControl.Components;
  }
}

export const ClosureControl = ClusterType(ClosureControlModel) as ClusterType.Concrete & {
  readonly id: ClusterId & 0x0104;
  readonly name: 'ClosureControl';
  readonly revision: 1;
  readonly schema: ClusterModel;
  readonly attributes: ClusterType.AttributeObjects<ClosureControl.Attributes>;
  readonly commands: ClusterType.CommandObjects<ClosureControl.Commands>;
  readonly events: ClusterType.EventObjects<ClosureControl.Events>;
  readonly Feature: ClosureControl.FeatureEnum;
  readonly ClosureError: ClosureControl.ClosureErrorEnum;
  readonly CurrentPosition: ClosureControl.CurrentPositionEnum;
  readonly MainState: ClosureControl.MainStateEnum;
  readonly TargetPosition: ClosureControl.TargetPositionEnum;
  readonly Typing: ClosureControl.Typing;
  /** @deprecated Use {@link ClosureControl}. */
  readonly Cluster: typeof ClosureControl;
  /** @deprecated Use {@link ClosureControl}. */
  readonly Complete: typeof ClosureControl;
  /** @deprecated */
  with(...features: ClosureControl.Feature[]): typeof ClosureControl;
};
