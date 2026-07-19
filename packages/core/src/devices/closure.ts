/**
 * @file packages/core/src/devices/closure.ts
 * @description Closure device class exposing the Matter 1.5 ClosureControl cluster.
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

/* oxlint-disable typescript/no-unsafe-type-assertion */
/* oxlint-disable unicorn/no-negated-condition */
/* oxlint-disable typescript/no-misused-spread */

// @matter
import { ClosureControlServer } from '@matter/node/behaviors/closure-control';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import type { Semtag } from '@matter/types/globals';
import { ThreeLevelAuto } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { closure, closurePanel } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeClosureDimensionServer, type ClosurePanelOptions } from './closurePanel.js';

/**
 * ClosureControl server that forwards MoveTo/Stop commands to the Matterbridge command handler.
 */
export class MatterbridgeClosureControlServer extends ClosureControlServer.with(
  ClosureControl.Feature.Positioning,
  ClosureControl.Feature.MotionLatching,
  ClosureControl.Feature.Speed,
) {
  override moveTo = async (request: ClosureControl.MoveToRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MoveTo (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureControl.moveTo', {
      command: 'moveTo',
      request,
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    /* v8 ignore next -- Defensive fallback for direct behavior calls; controller commands receive a normalized target state. */
    const previousTarget = this.state.overallTargetState ?? {};
    const nextTarget = {
      ...previousTarget,
      ...(request?.position !== undefined ? { position: request.position } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      /* v8 ignore next -- Defensive fallback; Matter command validation supplies a speed when controllers omit it. */
      speed: request?.speed ?? previousTarget.speed ?? ThreeLevelAuto.Auto,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    this.state.mainState = ClosureControl.MainState.Stopped;
  };
}

export interface ClosureOptions {
  /** Initial ClosureControl countdown time, in seconds. Defaults to 0 for a completed safe state. */
  countdownTime?: number;
  /** Initial ClosureControl main state. Defaults to stopped. */
  mainState?: ClosureControl.MainState;
  /** Initial ClosureControl error list. Defaults to an empty list. */
  currentErrorList?: ClosureControl.ClosureError[];
  /** Initial current state. Defaults to secure, latched, and fully closed. */
  overallCurrentState?: ClosureControl.OverallCurrentState;
  /** Initial target state. Defaults to latched and fully closed. */
  overallTargetState?: ClosureControl.OverallTargetState;
  /** Supported remote latch control modes. Defaults to latching and unlatching enabled. */
  latchControlModes?: ClosureControl.LatchControlModes;
  /** Optional semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
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
   * @param {ClosureOptions} [options] - Optional endpoint options and initial cluster state values.
   */
  constructor(name: string, serial: string, options: ClosureOptions = {}) {
    super([closure], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, tagList: options.tagList });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure');

    this.behaviors.require(MatterbridgeClosureControlServer, {
      countdownTime: options.countdownTime ?? 0,
      mainState: options.mainState ?? ClosureControl.MainState.Stopped,
      currentErrorList: [],
      overallCurrentState: options.overallCurrentState ?? {
        position: ClosureControl.CurrentPosition.FullyClosed,
        latch: true,
        speed: ThreeLevelAuto.Auto,
        secureState: true,
      },
      overallTargetState: options.overallTargetState ?? {
        position: ClosureControl.TargetPosition.MoveToFullyClosed,
        latch: true,
        speed: ThreeLevelAuto.Auto,
      },
      latchControlModes: options.latchControlModes ?? { remoteLatching: true, remoteUnlatching: true },
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

  /**
   * Adds a closure panel as a child endpoint of this closure and configures its ClosureDimension cluster.
   *
   * @remarks
   * Use this to compose a closure out of one or more independently controlled panels, for example a venetian
   * blind with a `ClosurePanelTag.Lift` panel and a `ClosurePanelTag.Tilt` panel.
   *
   * @param {string} name - Human-readable name of the panel endpoint.
   * @param {Semtag[]} tagList - The tagList used to disambiguate the panel (e.g. `ClosurePanelTag.Lift`, `ClosurePanelTag.Tilt`).
   * @param {ClosurePanelOptions} [options] - Optional initial configuration values for the ClosureDimension cluster.
   * @returns {MatterbridgeEndpoint} The created closure panel endpoint.
   */
  addPanel(name: string, tagList: Semtag[], options: Pick<ClosurePanelOptions, 'resolution' | 'stepValue'> = {}): MatterbridgeEndpoint {
    const panel = this.addChildDeviceType(name, closurePanel, { tagList });

    panel.behaviors.require(MatterbridgeClosureDimensionServer, {
      currentState: null,
      targetState: null,
      resolution: options.resolution ?? 1,
      stepValue: options.stepValue ?? 1,
    });

    return panel;
  }
}
