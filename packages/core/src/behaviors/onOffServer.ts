/**
 * @file packages/core/src/behaviors/onOffServer.ts
 * @description This file contains the MatterbridgeOnOffServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-03-28
 * @version 1.1.0
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

import { OnOffServer } from '@matter/node/behaviors/on-off';
import { OnOff } from '@matter/types/clusters/on-off';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * OnOff server that forwards On/Off commands to the Matterbridge command handler.
 *
 * Extends `OnOffServer.with(OnOff.Feature.Lighting)` so the Lighting-feature commands (offWithEffect,
 * onWithRecallGlobalScene, onWithTimedOff) are visible for overriding.
 */
export class MatterbridgeOnOffServer extends OnOffServer.with(OnOff.Feature.Lighting) {
  /**
   * Forwards On requests to the Matterbridge command handler.
   */
  override async on(): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.5.7.2.1: On receipt of the On command the server SHALL set the OnOff attribute to TRUE, and when OnTime and OffWaitTime are both supported SHALL set OffWaitTime to 0.
      await super.on();
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOnOffServer: switching device on (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.on', {
      command: 'on',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: on called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.2.1: On receipt of the On command the server SHALL set the OnOff attribute to TRUE, and when OnTime and OffWaitTime are both supported SHALL set OffWaitTime to 0.
    await super.on();
  }

  /**
   * Forwards Off requests to the Matterbridge command handler.
   */
  override async off(): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.5.7.1.1: On receipt of the Off command the server SHALL set the OnOff attribute to FALSE, and when OnTime is supported SHALL set OnTime to 0.
      await super.off();
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOnOffServer: switching device off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.off', {
      command: 'off',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: off called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.1.1: On receipt of the Off command the server SHALL set the OnOff attribute to FALSE, and when OnTime is supported SHALL set OnTime to 0.
    await super.off();
  }

  /**
   * Forwards Toggle requests to the Matterbridge command handler.
   */
  override async toggle(): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.5.7.3.1: On receipt of the Toggle command the server SHALL set the OnOff attribute to the inverse of its current value.
      await super.toggle();
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOnOffServer: toggling device on/off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.toggle', {
      command: 'toggle',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: toggle called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.3.1: On receipt of the Toggle command the server SHALL set the OnOff attribute to the inverse of its current value.
    await super.toggle();
  }

  /**
   * Forwards OffWithEffect requests to the Matterbridge command handler.
   *
   * @param {OnOff.OffWithEffectRequest} request - Off-with-effect request payload.
   */
  override async offWithEffect(request: OnOff.OffWithEffectRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.5.7.4.3: On receipt of OffWithEffect, when GlobalSceneControl is TRUE the server SHALL store its settings in the global scene, set GlobalSceneControl to FALSE, set OnOff to FALSE and OnTime to 0; otherwise it SHALL only set OnOff to FALSE.
      await super.offWithEffect(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeOnOffServer: switching device off with effect ${request.effectIdentifier} and variant ${request.effectVariant} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('OnOff.offWithEffect', {
      command: 'offWithEffect',
      request,
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: offWithEffect called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.4.3: On receipt of OffWithEffect, when GlobalSceneControl is TRUE the server SHALL store its settings in the global scene, set GlobalSceneControl to FALSE, set OnOff to FALSE and OnTime to 0; otherwise it SHALL only set OnOff to FALSE.
    await super.offWithEffect(request);
  }

  /**
   * Forwards OnWithRecallGlobalScene requests to the Matterbridge command handler.
   */
  override async onWithRecallGlobalScene(): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.5.7.5.1: On receipt of OnWithRecallGlobalScene the server SHALL discard the command when GlobalSceneControl is TRUE, otherwise recall the global scene and set GlobalSceneControl to TRUE.
      await super.onWithRecallGlobalScene();
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOnOffServer: switching device on with recall global scene (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.onWithRecallGlobalScene', {
      command: 'onWithRecallGlobalScene',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: onWithRecallGlobalScene called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.5.1: On receipt of OnWithRecallGlobalScene the server SHALL discard the command when GlobalSceneControl is TRUE, otherwise recall the global scene and set GlobalSceneControl to TRUE.
    await super.onWithRecallGlobalScene();
  }

  /**
   * Forwards OnWithTimedOff requests to the Matterbridge command handler.
   *
   * @param {OnOff.OnWithTimedOffRequest} request - On-with-timed-off request payload.
   */
  override async onWithTimedOff(request: OnOff.OnWithTimedOffRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.5.7.6.4: On receipt of OnWithTimedOff the server SHALL discard the command when AcceptOnlyWhenOn is set and OnOff is FALSE, otherwise adjust OnTime and OffWaitTime as specified and set OnOff to TRUE.
      await super.onWithTimedOff(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeOnOffServer: switching device on with timed off control ${JSON.stringify(request.onOffControl)}, offWaitTime ${request.offWaitTime} and onTime ${request.onTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('OnOff.onWithTimedOff', {
      command: 'onWithTimedOff',
      request,
      cluster: OnOffServer.id,
      attributes: this.state,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeOnOffServer: onWithTimedOff called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.5.7.6.4: On receipt of OnWithTimedOff the server SHALL discard the command when AcceptOnlyWhenOn is set and OnOff is FALSE, otherwise adjust OnTime and OffWaitTime as specified and set OnOff to TRUE.
    await super.onWithTimedOff(request);
  }
}
