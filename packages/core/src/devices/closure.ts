/**
 * @description Closure device class exposing the Matter 1.5 ClosureControl cluster.
 * @file src/devices/closure.ts
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
import { ClosureControl } from '../clusters/closure-control.js';
import { closure } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

const ClosureControlBehavior = ClusterBehavior.for(ClosureControl, ClosureControl.schema);

export namespace ClosureControlServer {
  export interface State {
    mainState: ClosureControl.MainState;
    currentErrorList: ClosureControl.ClosureError[];
    overallCurrentState: ClosureControl.OverallCurrentState | null;
    overallTargetState: ClosureControl.OverallTargetState | null;
    countdownTime: number | null;
  }
}

/**
 * ClosureControl server that forwards MoveTo/Stop commands to the Matterbridge command handler.
 */
export class ClosureControlServer extends ClosureControlBehavior.with(ClosureControl.Feature.Positioning) {
  declare state: ClosureControlServer.State;

  override moveTo = async (request: ClosureControl.MoveToRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MoveTo (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureControl.moveTo', {
      command: 'moveTo',
      request,
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

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

  override stop = async (): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureControl.stop', {
      command: 'stop',
      request: {},
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    this.state.mainState = ClosureControl.MainState.Stopped;
  };
}

export interface ClosureOptions {
  mainState?: ClosureControl.MainState;
}

/**
 * Matterbridge endpoint representing a closure device.
 */
export class Closure extends MatterbridgeEndpoint {
  /**
   * Creates a Closure endpoint and configures the ClosureControl cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {ClosureOptions} [options] - Optional initial cluster state values.
   */
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

  /**
   * Gets the ClosureControl `mainState` attribute.
   *
   * @returns {ClosureControl.MainState | undefined} Current main state.
   */
  getMainState(): ClosureControl.MainState | undefined {
    return this.getAttribute(ClosureControlServer, 'mainState');
  }
}
