/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @description Closure Panel device class exposing the Matter 1.5 ClosureDimension cluster.
 * @file src/devices/closurePanel.ts
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

import { MaybePromise } from '@matter/general';
import { ClusterBehavior } from '@matter/node';

import { ClosureDimension } from '../clusters/closure-dimension.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';
import { closurePanel } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createClusterSchema } from './customClusterSchema.js';

export interface ClosurePanelOptions {
  resolution?: number;
  stepValue?: number;
}

/**
 * ClosureDimension server behavior.
 *
 * This cluster requires at least one feature; this device uses Positioning.
 */
const ClosureDimensionCluster = ClosureDimension.Cluster.with(ClosureDimension.Feature.Positioning);

const ClosureDimensionServerBase = ClusterBehavior.for(ClosureDimensionCluster, createClusterSchema(ClosureDimensionCluster));

export namespace ClosureDimensionServer {
  export interface State {
    currentState: ClosureDimension.DimensionState | null;
    targetState: ClosureDimension.DimensionState | null;
    resolution: number;
    stepValue: number;
  }
}

export class ClosureDimensionServer extends ClosureDimensionServerBase {
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

export class ClosurePanel extends MatterbridgeEndpoint {
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
