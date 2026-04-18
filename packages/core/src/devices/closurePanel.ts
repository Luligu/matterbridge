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

import { ClusterBehavior } from '@matter/node';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { ClosureDimension } from '../clusters/closure-dimension.js';
import { closurePanel } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

const ClosureDimensionBehavior = ClusterBehavior.for(ClosureDimension, ClosureDimension.schema);

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

  override setTarget = async (request: ClosureDimension.SetTargetRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTarget (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureDimension.setTarget', {
      command: 'setTarget',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    const previousTarget = this.state.targetState ?? {};
    const nextTarget = {
      ...previousTarget,
      ...(request?.position !== undefined ? { position: request.position } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      ...(request?.speed !== undefined ? { speed: request.speed } : null),
    };

    this.state.targetState = nextTarget;
  };

  override step = async (request: ClosureDimension.StepRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Step (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureDimension.step', {
      command: 'step',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

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
