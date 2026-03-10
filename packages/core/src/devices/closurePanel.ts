/**
 * @description Closure Panel device class exposing the Matter 1.5 ClosureDimension cluster.
 * @file src/devices/closurePanel.ts
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-namespace */

import { MaybePromise } from '@matter/general';
import { AttributeElement, ClusterElement, ClusterModel, CommandElement, DatatypeElement, FieldElement } from '@matter/main/model';
import { ClusterBehavior } from '@matter/node';
import { ClusterType } from '@matter/types';

import { ClosureDimension } from '../clusters/closure-dimension.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';
import { closurePanel } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * ClosureDimension schema.
 */
const ClosureDimensionSchema = ClusterElement(
  {
    id: ClosureDimension.Cluster.id,
    name: ClosureDimension.Cluster.name,
    classification: 'application',
  },
  // Matter global attributes.
  AttributeElement({ id: 0xfffd, name: 'ClusterRevision', type: 'ClusterRevision', conformance: 'M', default: ClosureDimension.Base.revision }),
  AttributeElement(
    { id: 0xfffc, name: 'FeatureMap', type: 'FeatureMap', conformance: 'M' },
    FieldElement({ name: 'POS', constraint: '0', title: 'Positioning' }),
    FieldElement({ name: 'ML', constraint: '1', title: 'MotionLatching' }),
    FieldElement({ name: 'UNI', constraint: '2', title: 'Unit' }),
    FieldElement({ name: 'LIM', constraint: '3', title: 'Limitation' }),
    FieldElement({ name: 'SPD', constraint: '4', title: 'Speed' }),
    FieldElement({ name: 'TRN', constraint: '5', title: 'Translation' }),
    FieldElement({ name: 'ROT', constraint: '6', title: 'Rotation' }),
    FieldElement({ name: 'MOD', constraint: '7', title: 'Modulation' }),
  ),

  // Attributes (base + Positioning extension).
  AttributeElement({ name: 'CurrentState', id: 0x0000, type: 'DimensionStateStruct', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'TargetState', id: 0x0001, type: 'DimensionStateStruct', conformance: 'M', default: null, quality: 'X' }),
  AttributeElement({ name: 'Resolution', id: 0x0002, type: 'percent100ths', conformance: 'POS', default: 1 }),
  AttributeElement({ name: 'StepValue', id: 0x0003, type: 'percent100ths', conformance: 'POS', default: 1 }),

  // Commands.
  CommandElement(
    { name: 'SetTarget', id: 0x0000, conformance: 'M', direction: 'request', response: 'status' },
    FieldElement({ name: 'Position', id: 0, type: 'percent100ths', conformance: 'O' }),
    FieldElement({ name: 'Latch', id: 1, type: 'bool', conformance: 'O' }),
    FieldElement({ name: 'Speed', id: 2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
  CommandElement(
    { name: 'Step', id: 0x0001, conformance: 'POS', direction: 'request', response: 'status' },
    FieldElement({ name: 'Direction', id: 0, type: 'StepDirectionEnum', conformance: 'M' }),
    FieldElement({ name: 'NumberOfSteps', id: 1, type: 'uint16', conformance: 'M', constraint: { min: 1 } }),
    FieldElement({ name: 'Speed', id: 2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),

  // Datatypes.
  DatatypeElement(
    { name: 'StepDirectionEnum', type: 'enum8' },
    FieldElement({ name: 'Decrease', id: 0, conformance: 'M' }),
    FieldElement({ name: 'Increase', id: 1, conformance: 'M' }),
  ),
  DatatypeElement(
    { name: 'DimensionStateStruct', type: 'struct' },
    FieldElement({ name: 'Position', id: 0, type: 'percent100ths', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Latch', id: 1, type: 'bool', conformance: 'O', default: null, quality: 'X' }),
    FieldElement({ name: 'Speed', id: 2, type: 'ThreeLevelAutoEnum', conformance: 'O' }),
  ),
);

const ClosureDimensionBehavior = ClusterBehavior.for(ClusterType(ClosureDimension.Base), new ClusterModel(ClosureDimensionSchema));

export namespace ClosureDimensionServer {
  export interface State {
    currentState: ClosureDimension.DimensionState | null;
    targetState: ClosureDimension.DimensionState | null;
    resolution: number;
    stepValue: number;
  }
}

/**
 * ClosureDimension server that forwards SetTarget/Step commands to the Matterbridge command handler.
 */
export class ClosureDimensionServer extends ClosureDimensionBehavior.with(ClosureDimension.Feature.Positioning) {
  declare state: ClosureDimensionServer.State;

  override setTarget = (request: ClosureDimension.SetTargetRequest): MaybePromise => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTarget (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setTarget', { request, cluster: ClosureDimension.Cluster.id, attributes: this.state, endpoint: this.endpoint });

    const previousTarget = this.state.targetState ?? {};
    const nextTarget = {
      ...previousTarget,
      ...(request?.position !== undefined ? { position: request.position } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      ...(request?.speed !== undefined ? { speed: request.speed } : null),
    };

    this.state.targetState = nextTarget;
  };

  override step = (request: ClosureDimension.StepRequest): MaybePromise => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Step (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('step', { request, cluster: ClosureDimension.Cluster.id, attributes: this.state, endpoint: this.endpoint });

    const stepValue: number = this.state.stepValue;
    const numberOfSteps: number = request.numberOfSteps;
    const delta = stepValue * numberOfSteps;
    const isIncrease = request.direction === ClosureDimension.StepDirection.Increase;

    const previousCurrent = this.state.currentState ?? {};
    const previousTarget = this.state.targetState ?? {};
    const currentPosition: number =
      typeof previousCurrent.position === 'number' ? previousCurrent.position : typeof previousTarget.position === 'number' ? previousTarget.position : 0;

    let nextPosition = isIncrease ? currentPosition + delta : currentPosition - delta;
    nextPosition = Math.max(0, Math.min(10000, nextPosition));

    this.state.currentState = {
      ...previousCurrent,
      position: nextPosition,
      ...(request?.speed !== undefined ? { speed: request.speed } : null),
    };

    this.state.targetState = { ...previousTarget, position: nextPosition };
  };
}

export interface ClosurePanelOptions {
  resolution?: number;
  stepValue?: number;
}

/**
 * Matterbridge endpoint representing a closure panel device.
 */
export class ClosurePanel extends MatterbridgeEndpoint {
  /**
   * Creates a ClosurePanel endpoint and configures the ClosureDimension cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {ClosurePanelOptions} [options] - Optional initial configuration values.
   */
  constructor(name: string, serial: string, options: ClosurePanelOptions = {}) {
    super([closurePanel], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure Panel');

    this.behaviors.require(ClosureDimensionServer, {
      currentState: null,
      targetState: null,
      resolution: options.resolution ?? 1,
      stepValue: options.stepValue ?? 1,
    });
  }
}
