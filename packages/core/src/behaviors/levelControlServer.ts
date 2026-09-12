/**
 * @file packages/core/src/behaviors/levelControlServer.ts
 * @description This file contains the MatterbridgeLevelControlServer class of Matterbridge.
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

import type { MaybePromise } from '@matter/general';
import { LevelControlServer } from '@matter/node/behaviors/level-control';
import { LevelControl } from '@matter/types/clusters/level-control';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * LevelControl server that forwards level commands to the Matterbridge command handler.
 */
export class MatterbridgeLevelControlServer extends LevelControlServer {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

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
   * The moveToLevel command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevel(request: LevelControl.MoveToLevelRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.1.1: Process the temporary Options bitmap, then move CurrentLevel to the Level field over TransitionTime, updating RemainingTime while the transition is in progress.
      await super.moveToLevel(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelControlServer: setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('LevelControl.moveToLevel', {
      command: 'moveToLevel',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.1.1: Process the temporary Options bitmap, then move CurrentLevel to the Level field over TransitionTime, updating RemainingTime while the transition is in progress.
    await super.moveToLevel(request);
    this.endpoint.emitCommand(LevelControl, 'moveToLevel', request, this.context);
  }

  /**
   * Forwards MoveToLevelWithOnOff requests to the Matterbridge command handler.
   *
   * The moveToLevelWithOnOff command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevelWithOnOff(request: LevelControl.MoveToLevelRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.1.1: Process the temporary Options bitmap, then move CurrentLevel to the Level field over TransitionTime, updating RemainingTime while the transition is in progress. With the 'with On/Off' variant the OnOff attribute is also affected (Matter 1.6.0 § 1.6.4.1.2).
      await super.moveToLevelWithOnOff(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelControlServer: setting level with on/off to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('LevelControl.moveToLevelWithOnOff', {
      command: 'moveToLevelWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevelWithOnOff called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.1.1: Process the temporary Options bitmap, then move CurrentLevel to the Level field over TransitionTime, updating RemainingTime while the transition is in progress. With the 'with On/Off' variant the OnOff attribute is also affected (Matter 1.6.0 § 1.6.4.1.2).
    await super.moveToLevelWithOnOff(request);
    this.endpoint.emitCommand(LevelControl, 'moveToLevelWithOnOff', request, this.context);
  }

  /**
   * Forwards Move requests to the Matterbridge command handler.
   *
   * The move command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.MoveRequest} request - Move request payload.
   */
  override async move(request: LevelControl.MoveRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.2.3: Reject a Rate of zero with INVALID_COMMAND, then move CurrentLevel continuously up or down at the given rate until the allowed maximum or minimum is reached.
      await super.move(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelControlServer: moving level with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('LevelControl.move', {
      command: 'move',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: move called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.2.3: Reject a Rate of zero with INVALID_COMMAND, then move CurrentLevel continuously up or down at the given rate until the allowed maximum or minimum is reached.
    await super.move(request);
    this.endpoint.emitCommand(LevelControl, 'move', request, this.context);
  }

  /**
   * Forwards MoveWithOnOff requests to the Matterbridge command handler.
   *
   * The moveWithOnOff command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.MoveRequest} request - Move request payload.
   */
  override async moveWithOnOff(request: LevelControl.MoveRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.2.3: Reject a Rate of zero with INVALID_COMMAND, then move CurrentLevel continuously up or down at the given rate until the allowed maximum or minimum is reached. With the 'with On/Off' variant the OnOff attribute is also affected (Matter 1.6.0 § 1.6.4.1.2).
      await super.moveWithOnOff(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelControlServer: moving level with on/off with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('LevelControl.moveWithOnOff', {
      command: 'moveWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveWithOnOff called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.2.3: Reject a Rate of zero with INVALID_COMMAND, then move CurrentLevel continuously up or down at the given rate until the allowed maximum or minimum is reached. With the 'with On/Off' variant the OnOff attribute is also affected (Matter 1.6.0 § 1.6.4.1.2).
    await super.moveWithOnOff(request);
    this.endpoint.emitCommand(LevelControl, 'moveWithOnOff', request, this.context);
  }

  /**
   * Forwards Step requests to the Matterbridge command handler.
   *
   * The step command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.StepRequest} request - Step request payload.
   */
  override async step(request: LevelControl.StepRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.3.4: Reject a StepSize of zero with INVALID_COMMAND, then change CurrentLevel by StepSize in the given direction, clamping at the maximum or minimum level allowed for the device.
      await super.step(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelControlServer: stepping level with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('LevelControl.step', {
      command: 'step',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: step called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.3.4: Reject a StepSize of zero with INVALID_COMMAND, then change CurrentLevel by StepSize in the given direction, clamping at the maximum or minimum level allowed for the device.
    await super.step(request);
    this.endpoint.emitCommand(LevelControl, 'step', request, this.context);
  }

  /**
   * Forwards StepWithOnOff requests to the Matterbridge command handler.
   *
   * The stepWithOnOff command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.StepRequest} request - Step request payload.
   */
  override async stepWithOnOff(request: LevelControl.StepRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.3.4: Reject a StepSize of zero with INVALID_COMMAND, then change CurrentLevel by StepSize in the given direction, clamping at the maximum or minimum level allowed for the device. With the 'with On/Off' variant the OnOff attribute is also affected (Matter 1.6.0 § 1.6.4.1.2).
      await super.stepWithOnOff(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeLevelControlServer: stepping level with on/off with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('LevelControl.stepWithOnOff', {
      command: 'stepWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: stepWithOnOff called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.3.4: Reject a StepSize of zero with INVALID_COMMAND, then change CurrentLevel by StepSize in the given direction, clamping at the maximum or minimum level allowed for the device. With the 'with On/Off' variant the OnOff attribute is also affected (Matter 1.6.0 § 1.6.4.1.2).
    await super.stepWithOnOff(request);
    this.endpoint.emitCommand(LevelControl, 'stepWithOnOff', request, this.context);
  }

  /**
   * Forwards Stop requests to the Matterbridge command handler.
   *
   * The stop command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.StopRequest} request - Stop request payload.
   */
  override async stop(request: LevelControl.StopRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.4.1: Terminate any MoveToLevel, Move or Step in progress, leaving CurrentLevel at its value on receipt and setting RemainingTime to 0.
      await super.stop(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeLevelControlServer: stopping level change (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LevelControl.stop', {
      command: 'stop',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: stop called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.4.1: Terminate any MoveToLevel, Move or Step in progress, leaving CurrentLevel at its value on receipt and setting RemainingTime to 0.
    await super.stop(request);
    this.endpoint.emitCommand(LevelControl, 'stop', request, this.context);
  }

  /**
   * Forwards StopWithOnOff requests to the Matterbridge command handler.
   *
   * The stopWithOnOff command observable added by `subscribeCommand()` is emitted last, after the command handler and the state update.
   *
   * @param {LevelControl.StopRequest} request - Stop request payload.
   */
  override async stopWithOnOff(request: LevelControl.StopRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 1.6.7.4.1: Terminate any MoveToLevel, Move or Step in progress, leaving CurrentLevel at its value on receipt and setting RemainingTime to 0.
      await super.stopWithOnOff(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeLevelControlServer: stopping level change with on/off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LevelControl.stopWithOnOff', {
      command: 'stopWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeLevelControlServer: stopWithOnOff called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.6.7.4.1: Terminate any MoveToLevel, Move or Step in progress, leaving CurrentLevel at its value on receipt and setting RemainingTime to 0.
    await super.stopWithOnOff(request);
    this.endpoint.emitCommand(LevelControl, 'stopWithOnOff', request, this.context);
  }
}
