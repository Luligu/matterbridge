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
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device on (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Forwarder gated off under MATTERBRIDGE_CHIP_TEST: matter.js can invoke on()/off()/toggle() from an
    // unlocked timer callback (e.g. ScenesManagement's delayed scene-apply timer for a non-zero
    // transitionTime), whose implicit transaction context only lives for the synchronous portion of the
    // callback. Awaiting the forwarder first outlives that context, so the later super.on() call throws
    // "expired-reference" and the real state mutation never happens. Skipping the forwarder in test mode
    // avoids that await entirely until a proper fix (reordering or locking) lands.
    // v8 ignore else
    if (!process.env.MATTERBRIDGE_CHIP_TEST) {
      await device.commandHandler.executeHandler('OnOff.on', {
        command: 'on',
        request: {},
        cluster: OnOffServer.id,
        attributes: this.state,
        endpoint: this.endpoint as MatterbridgeEndpoint,
        context: this.context,
      });
    }
    device.log.debug(`MatterbridgeOnOffServer: on called`);
    await super.on();
  }

  /**
   * Forwards Off requests to the Matterbridge command handler.
   */
  override async off(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // See on()'s comment: forwarder gated off under MATTERBRIDGE_CHIP_TEST to avoid the
    // "expired-reference" failure when this is invoked from an unlocked scene-apply timer callback.
    // v8 ignore else
    if (!process.env.MATTERBRIDGE_CHIP_TEST) {
      await device.commandHandler.executeHandler('OnOff.off', {
        command: 'off',
        request: {},
        cluster: OnOffServer.id,
        attributes: this.state,
        endpoint: this.endpoint as MatterbridgeEndpoint,
        context: this.context,
      });
    }
    device.log.debug(`MatterbridgeOnOffServer: off called`);
    await super.off();
  }

  /**
   * Forwards Toggle requests to the Matterbridge command handler.
   */
  override async toggle(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Toggle device on/off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // See on()'s comment: forwarder gated off under MATTERBRIDGE_CHIP_TEST to avoid the
    // "expired-reference" failure when this is invoked from an unlocked scene-apply timer callback.
    // v8 ignore else
    if (!process.env.MATTERBRIDGE_CHIP_TEST) {
      await device.commandHandler.executeHandler('OnOff.toggle', {
        command: 'toggle',
        request: {},
        cluster: OnOffServer.id,
        attributes: this.state,
        endpoint: this.endpoint as MatterbridgeEndpoint,
        context: this.context,
      });
    }
    device.log.debug(`MatterbridgeOnOffServer: toggle called`);
    await super.toggle();
  }

  /**
   * Forwards OffWithEffect requests to the Matterbridge command handler.
   *
   * @param {OnOff.OffWithEffectRequest} request - Off-with-effect request payload.
   */
  override async offWithEffect(request: OnOff.OffWithEffectRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Switching device off with effect ${request.effectIdentifier} and variant ${request.effectVariant} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // See on()'s comment: forwarder gated off under MATTERBRIDGE_CHIP_TEST to avoid the
    // "expired-reference" failure when this is invoked from an unlocked scene-apply timer callback.
    // v8 ignore else
    if (!process.env.MATTERBRIDGE_CHIP_TEST) {
      await device.commandHandler.executeHandler('OnOff.offWithEffect', {
        command: 'offWithEffect',
        request,
        cluster: OnOffServer.id,
        attributes: this.state,
        endpoint: this.endpoint as MatterbridgeEndpoint,
        context: this.context,
      });
    }
    device.log.debug(`MatterbridgeOnOffServer: offWithEffect called`);
    await super.offWithEffect(request);
  }

  /**
   * Forwards OnWithRecallGlobalScene requests to the Matterbridge command handler.
   */
  override async onWithRecallGlobalScene(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device on with recall global scene (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // See on()'s comment: forwarder gated off under MATTERBRIDGE_CHIP_TEST to avoid the
    // "expired-reference" failure when this is invoked from an unlocked scene-apply timer callback.
    // v8 ignore else
    if (!process.env.MATTERBRIDGE_CHIP_TEST) {
      await device.commandHandler.executeHandler('OnOff.onWithRecallGlobalScene', {
        command: 'onWithRecallGlobalScene',
        request: {},
        cluster: OnOffServer.id,
        attributes: this.state,
        endpoint: this.endpoint as MatterbridgeEndpoint,
        context: this.context,
      });
    }
    device.log.debug(`MatterbridgeOnOffServer: onWithRecallGlobalScene called`);
    await super.onWithRecallGlobalScene();
  }

  /**
   * Forwards OnWithTimedOff requests to the Matterbridge command handler.
   *
   * @param {OnOff.OnWithTimedOffRequest} request - On-with-timed-off request payload.
   */
  override async onWithTimedOff(request: OnOff.OnWithTimedOffRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Switching device on with timed off control ${JSON.stringify(request.onOffControl)}, offWaitTime ${request.offWaitTime} and onTime ${request.onTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // See on()'s comment: forwarder gated off under MATTERBRIDGE_CHIP_TEST to avoid the
    // "expired-reference" failure when this is invoked from an unlocked scene-apply timer callback.
    // v8 ignore else
    if (!process.env.MATTERBRIDGE_CHIP_TEST) {
      await device.commandHandler.executeHandler('OnOff.onWithTimedOff', {
        command: 'onWithTimedOff',
        request,
        cluster: OnOffServer.id,
        attributes: this.state,
        endpoint: this.endpoint as MatterbridgeEndpoint,
        context: this.context,
      });
    }
    device.log.debug(`MatterbridgeOnOffServer: onWithTimedOff called`);
    await super.onWithTimedOff(request);
  }
}
