/**
 * @file packages/core/src/behaviors/levelControlServer.ts
 * @description This file contains the MatterbridgeLevelControlServer class of Matterbridge.
 * @author Luca Liguori
 * @created 2026-03-28
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

import type { MaybePromise } from '@matter/general';
import { LevelControlServer } from '@matter/node/behaviors/level-control';
import type { LevelControl } from '@matter/types/clusters/level-control';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * LevelControl server that forwards level commands to the Matterbridge command handler.
 */
export class MatterbridgeLevelControlServer extends LevelControlServer {
  /**
   * Enables managed transition-time handling under MATTERBRIDGE_CHIP_TEST only, so Move/MoveTo/Step
   * transitions actually animate CurrentLevel/RemainingTime over TransitionTime/Rate during CHIP
   * certification testing instead of jumping straight to the target value (see chipTests.md Known Issues).
   * Production behavior (matter.js's own default: immediate jump, no simulated transition) is unchanged.
   *
   * @returns {MaybePromise} The result of the base class initialization.
   */
  override initialize(): MaybePromise {
    // v8 ignore next - only enabled under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) this.state.managedTransitionTimeHandling = true;
    return super.initialize();
  }

  /**
   * Forwards MoveToLevel requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevel(request: LevelControl.MoveToLevelRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.moveToLevel(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.moveToLevel', {
      command: 'moveToLevel',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called`);
    await super.moveToLevel(request);
  }

  /**
   * Forwards MoveToLevelWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevelWithOnOff(request: LevelControl.MoveToLevelRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.moveToLevelWithOnOff(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.moveToLevelWithOnOff', {
      command: 'moveToLevelWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevelWithOnOff called`);
    await super.moveToLevelWithOnOff(request);
  }

  /**
   * Forwards Move requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveRequest} request - Move request payload.
   */
  override async move(request: LevelControl.MoveRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving level with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.move(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.move', {
      command: 'move',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: move called`);
    await super.move(request);
  }

  /**
   * Forwards MoveWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveRequest} request - Move request payload.
   */
  override async moveWithOnOff(request: LevelControl.MoveRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving level with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.moveWithOnOff(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.moveWithOnOff', {
      command: 'moveWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveWithOnOff called`);
    await super.moveWithOnOff(request);
  }

  /**
   * Forwards Step requests to the Matterbridge command handler.
   *
   * @param {LevelControl.StepRequest} request - Step request payload.
   */
  override async step(request: LevelControl.StepRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping level with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.step(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.step', {
      command: 'step',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: step called`);
    await super.step(request);
  }

  /**
   * Forwards StepWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.StepRequest} request - Step request payload.
   */
  override async stepWithOnOff(request: LevelControl.StepRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping level with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.stepWithOnOff(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.stepWithOnOff', {
      command: 'stepWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: stepWithOnOff called`);
    await super.stepWithOnOff(request);
  }

  /**
   * Forwards Stop requests to the Matterbridge command handler.
   *
   * @param {LevelControl.StopRequest} request - Stop request payload.
   */
  override async stop(request: LevelControl.StopRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping level change (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.stop(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.stop', {
      command: 'stop',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: stop called`);
    await super.stop(request);
  }

  /**
   * Forwards StopWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.StopRequest} request - Stop request payload.
   */
  override async stopWithOnOff(request: LevelControl.StopRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping level change (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      await super.stopWithOnOff(request);
      return;
    }
    await device.commandHandler.executeHandler('LevelControl.stopWithOnOff', {
      command: 'stopWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: stopWithOnOff called`);
    await super.stopWithOnOff(request);
  }
}
