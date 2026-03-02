/* eslint-disable @typescript-eslint/no-namespace */
/**
 * @description Closure device class exposing the Matter 1.5 ClosureControl cluster.
 * @file src/devices/closure.ts
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

import { ClosureControl } from '../clusters/closure-control.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';
import { closure } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createClusterSchema } from './customClusterSchema.js';

export interface ClosureOptions {
  mainState?: ClosureControl.MainState;
}

/**
 * ClosureControl server behavior.
 *
 * Default features for this device: Positioning (non-instantaneous).
 */
const ClosureControlCluster = ClosureControl.Cluster.with(ClosureControl.Feature.Positioning);

const ClosureControlServerBase = ClusterBehavior.for(ClosureControlCluster, createClusterSchema(ClosureControlCluster));

export namespace ClosureControlServer {
  export interface State {
    mainState: ClosureControl.MainState;
    currentErrorList: ClosureControl.ClosureError[];
    overallCurrentState: ClosureControl.OverallCurrentState | null;
    overallTargetState: ClosureControl.OverallTargetState | null;
    countdownTime: number | null;
  }
}

export class ClosureControlServer extends ClosureControlServerBase {
  declare state: ClosureControlServer.State;

  override moveTo = (request: ClosureControl.MoveToRequest): MaybePromise => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MoveTo (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveTo', { request, cluster: ClosureControl.Cluster.id, attributes: this.state, endpoint: this.endpoint });

    const previousTarget = this.state.overallTargetState ?? {};
    const nextTarget = {
      ...previousTarget,
      ...(request?.position !== undefined ? { position: request.position } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      ...(request?.speed !== undefined ? { speed: request.speed } : null),
    };

    this.state.overallTargetState = nextTarget;
    this.state.mainState = ClosureControl.MainState.Moving;
  };

  override stop = (): MaybePromise => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('stop', { request: {}, cluster: ClosureControl.Cluster.id, attributes: this.state, endpoint: this.endpoint });

    this.state.mainState = ClosureControl.MainState.Stopped;
  };
}

export class Closure extends MatterbridgeEndpoint {
  constructor(name: string, serial: string, options: ClosureOptions = {}) {
    super([closure], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure');

    this.behaviors.require(ClosureControlServer, {
      mainState: options.mainState ?? ClosureControl.MainState.Stopped,
      currentErrorList: [],
      overallCurrentState: null,
      overallTargetState: null,
      countdownTime: null,
    });
  }

  getMainState(): ClosureControl.MainState {
    return this.getAttribute(ClosureControl.Cluster.id, 'mainState');
  }
}
