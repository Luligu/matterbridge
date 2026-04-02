/**
 * This file contains the MatterbridgeWindowCoveringServer, MatterbridgeLiftWindowCoveringServer, and MatterbridgeLiftTiltWindowCoveringServer classes of Matterbridge.
 *
 * @file windowCoveringServer.ts
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

import { WindowCoveringBaseServer, WindowCoveringServer } from '@matter/node/behaviors/window-covering';
import { WindowCovering } from '@matter/types/clusters/window-covering';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * WindowCovering server (lift + tilt) that forwards covering commands to the Matterbridge command handler.
 */
export class MatterbridgeWindowCoveringServer extends WindowCoveringServer.with(
  WindowCovering.Feature.Lift,
  WindowCovering.Feature.PositionAwareLift,
  WindowCovering.Feature.Tilt,
  WindowCovering.Feature.PositionAwareTilt,
) {
  declare protected internal: WindowCoveringBaseServer.Internal;
  lookupMovementStatus = ['Stopped', 'Opening', 'Closing', 'Unknown'];

  // istanbul ignore next
  private getMovementStatusLabel(status?: number | null): string {
    return this.lookupMovementStatus[status ?? 3];
  }

  /**
   * Will set the initial movement status to Stopped and target = current, which is a safe default until we get the real status from the device.
   * Disable automatic operational mode handling to let the device manage it.
   */
  override async initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgeWindowCoveringServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.internal.disableOperationalModeHandling = true;
    await super.initialize();
  }

  /**
   * Handles UpOrOpen for lift/tilt window coverings.
   * Will set target position to 0.
   */
  override async upOrOpen(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.upOrOpen', {
      command: 'upOrOpen',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: upOrOpen called`);
    await super.upOrOpen();
    device.log.debug(
      `MatterbridgeWindowCoveringServer: upOrOpen result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)}`,
    );
  }

  /**
   * Handles DownOrClose for lift/tilt window coverings.
   * Will set target position to 10000.
   */
  override async downOrClose(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.downOrClose', {
      command: 'downOrClose',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: downOrClose called`);
    await super.downOrClose();
    device.log.debug(
      `MatterbridgeWindowCoveringServer: downOrClose result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)}`,
    );
  }

  /**
   * Handles StopMotion for lift/tilt window coverings.
   * Will set target position to current position.
   */
  override async stopMotion(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.stopMotion', {
      command: 'stopMotion',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: stopMotion called`);
    await super.stopMotion();
    device.log.debug(
      `MatterbridgeWindowCoveringServer: stopMotion result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)}`,
    );
  }

  /**
   * Forwards GoToLiftPercentage requests to the Matterbridge command handler.
   * Will set target position to the requested value.
   *
   * @param {WindowCovering.GoToLiftPercentageRequest} request - Go-to-lift-percentage request payload.
   */
  override async goToLiftPercentage(request: WindowCovering.GoToLiftPercentageRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover lift percentage to ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.goToLiftPercentage', {
      command: 'goToLiftPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: goToLiftPercentage with ${request.liftPercent100thsValue}`);
    await super.goToLiftPercentage(request);
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToLiftPercentage result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)}`,
    );
  }

  /**
   * Forwards GoToTiltPercentage requests to the Matterbridge command handler.
   * Will set target position to the requested value.
   *
   * @param {WindowCovering.GoToTiltPercentageRequest} request - Go-to-tilt-percentage request payload.
   */
  override async goToTiltPercentage(request: WindowCovering.GoToTiltPercentageRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover tilt percentage to ${request.tiltPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.goToTiltPercentage', {
      command: 'goToTiltPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: goToTiltPercentage with ${request.tiltPercent100thsValue}`);
    await super.goToTiltPercentage(request);
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToTiltPercentage result target ${this.state.targetPositionTiltPercent100ths} current ${this.state.currentPositionTiltPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)}`,
    );
  }

  /**
   * No-op: movement is handled by the device implementation.
   */
  // istanbul ignore next
  override async handleMovement() {
    // Do nothing here, as the device will handle the movement
  }
}

/**
 * WindowCovering server (lift) that forwards covering commands to the Matterbridge command handler.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeWindowCoveringServer with only the Lift and PositionAwareLift features.
 */
export class MatterbridgeLiftWindowCoveringServer extends MatterbridgeWindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift) {}

/**
 * WindowCovering server (lift + tilt) that forwards covering commands to the Matterbridge command handler.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeWindowCoveringServer with the Lift, PositionAwareLift, Tilt and PositionAwareTilt features.
 */
export class MatterbridgeLiftTiltWindowCoveringServer extends MatterbridgeWindowCoveringServer.with(
  WindowCovering.Feature.Lift,
  WindowCovering.Feature.PositionAwareLift,
  WindowCovering.Feature.Tilt,
  WindowCovering.Feature.PositionAwareTilt,
) {}
