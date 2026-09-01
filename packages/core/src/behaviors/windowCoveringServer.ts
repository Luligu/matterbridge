/**
 * @file packages/core/src/behaviors/windowCoveringServer.ts
 * @description This file contains the MatterbridgeWindowCoveringServer, MatterbridgeLiftWindowCoveringServer, and MatterbridgeLiftTiltWindowCoveringServer classes of Matterbridge.
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
/* oxlint-disable typescript/no-namespace */

import { Millis, Time, type Timer } from '@matter/general';
import { WindowCoveringBaseServer, WindowCoveringServer } from '@matter/node/behaviors/window-covering';
import { WindowCovering } from '@matter/types/clusters/window-covering';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * WindowCovering server (lift + tilt) that forwards covering commands to the Matterbridge command handler.
 *
 * @remarks
 * There is no real motor to wait on in the base implementation, so the built-in movement simulation timer that
 * drives lift/tilt completion (`state.movementDuration`, in milliseconds) is disabled (`0`) by default — see the
 * `MatterbridgeWindowCoveringServer.State` remarks.
 *
 * `initialize()` sets `movementDuration` to a CHIP-test-friendly value (`3000`) under `MATTERBRIDGE_CHIP_TEST`
 * only; production behavior (disabled) is otherwise unaffected. A real device implementation may also opt into
 * the simulation directly by setting the same `state` value.
 *
 * `3000` (rather than an even `2000`/`2500`) is deliberate: `Test_TC_WNCV_3_3` waits a fixed 2000ms after
 * UpOrOpen/DownOrClose and then asserts the covering is still mid-motion, so `movementDuration` must clear
 * that checkpoint with margin rather than race it.
 */
export class MatterbridgeWindowCoveringServer extends WindowCoveringServer.with(
  WindowCovering.Feature.Lift,
  WindowCovering.Feature.PositionAwareLift,
  WindowCovering.Feature.Tilt,
  WindowCovering.Feature.PositionAwareTilt,
) {
  declare readonly state: MatterbridgeWindowCoveringServer.State;
  declare protected internal: MatterbridgeWindowCoveringServer.Internal;
  lookupMovementStatus = ['Stopped', 'Opening', 'Closing', 'Unknown'];

  /* v8 ignore next */
  private getMovementStatusLabel(status?: number | null): string {
    return this.lookupMovementStatus[status ?? 3];
  }

  /**
   * Will set the initial movement status to Stopped and target = current, which is a safe default until we get the real status from the device.
   * Disable automatic operational mode handling to let the device manage it.
   * Enables the built-in movement simulation under MATTERBRIDGE_CHIP_TEST only.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWindowCoveringServer: initializing (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    /* The device handles movement and stop on its own */
    this.internal.disableOperationalModeHandling = true;
    // v8 ignore next 3 - only enabled under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      this.state.movementDuration = 3000;
    }
    super.initialize();
    // oxlint-disable-next-line typescript/unbound-method
    if (this.features.positionAwareLift) this.reactTo(this.events.currentPositionLiftPercent100ths$Changing, this.#syncLiftCurrentPositionPercentage);
    // oxlint-disable-next-line typescript/unbound-method
    if (this.features.positionAwareTilt) this.reactTo(this.events.currentPositionTiltPercent100ths$Changing, this.#syncTiltCurrentPositionPercentage);
  }

  /**
   * Keeps `currentPositionLiftPercentage` equal to `currentPositionLiftPercent100ths / 100`.
   *
   * @param {number | null} percent100ths - The new lift position, in percent hundredths (0-10000), or null.
   */
  #syncLiftCurrentPositionPercentage(percent100ths: number | null): void {
    this.state.currentPositionLiftPercentage = percent100ths === null ? percent100ths : Math.floor(percent100ths / 100);
  }

  /**
   * Keeps `currentPositionTiltPercentage` equal to `currentPositionTiltPercent100ths / 100`.
   *
   * @param {number | null} percent100ths - The new tilt position, in percent hundredths (0-10000), or null.
   */
  #syncTiltCurrentPositionPercentage(percent100ths: number | null): void {
    this.state.currentPositionTiltPercentage = percent100ths === null ? percent100ths : Math.floor(percent100ths / 100);
  }

  /**
   * Mirrors the base server's operational-state derivation (disabled here by `disableOperationalModeHandling`):
   * Stopped when either value is null or they're equal, Closing when moving from a lower to a higher
   * percent100ths value, Opening otherwise.
   *
   * @param {number | null} target - Target position, in percent hundredths (0-10000).
   * @param {number | null} current - Current position, in percent hundredths (0-10000).
   * @returns {WindowCovering.MovementStatus} The derived movement status.
   */
  #computeMovementStatus(target: number | null, current: number | null): WindowCovering.MovementStatus {
    if (current === null || target === null || current === target) return WindowCovering.MovementStatus.Stopped;
    return current < target ? WindowCovering.MovementStatus.Closing : WindowCovering.MovementStatus.Opening;
  }

  /**
   * Recomputes `operationalStatus.global` from `operationalStatus.lift`/`tilt`: global tracks lift while it's
   * moving, otherwise it follows tilt — mirrors the base server's own operational-status sync, which this server
   * does not receive because `disableOperationalModeHandling` is set.
   */
  #updateGlobalOperationalStatus(): void {
    const { lift, tilt } = this.state.operationalStatus;
    this.state.operationalStatus.global = lift === WindowCovering.MovementStatus.Stopped ? tilt : lift;
  }

  /**
   * If `movementDuration` is positive, synchronously reflects the new lift movement direction in
   * `operationalStatus` and schedules a timer that simulates the lift reaching `targetPercent100ths`. A
   * non-positive `movementDuration` (the default) does nothing at all here, leaving `operationalStatus` and
   * completion entirely to the real device implementation, reported via the command handler forwarded by the caller.
   *
   * @param {number} targetPercent100ths - The lift target position, in percent hundredths (0-10000), to simulate reaching.
   */
  #startLiftMovement(targetPercent100ths: number): void {
    this.internal.liftMovementTimer?.stop();
    this.internal.liftMovementTimer = undefined;
    if (this.state.movementDuration <= 0) return;
    const status = this.#computeMovementStatus(targetPercent100ths, this.state.currentPositionLiftPercent100ths);
    this.state.operationalStatus.lift = status;
    this.#updateGlobalOperationalStatus();
    if (status === WindowCovering.MovementStatus.Stopped) return;
    this.internal.liftMovementTarget = targetPercent100ths;
    this.internal.liftMovementTimer = Time.getTimer(
      'WindowCovering lift movement complete',
      Millis(this.state.movementDuration),
      // The reactor must be a real method, not an arrow function, so the framework can rebind `this` to a fresh,
      // still-valid Behavior context when the timer fires well after the originating command's own context exited.
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#completeLiftMovement, { lock: true }),
    ).start();
  }

  /**
   * Reactor for {@link #startLiftMovement}: sets `currentPositionLiftPercent100ths` to `internal.liftMovementTarget`
   * (the target that was being approached; a timer reactor takes no custom arguments), then sets
   * `operationalStatus.lift` back to Stopped and recomputes `operationalStatus.global`. Runs under a fresh, locked
   * Behavior context (see {@link #startLiftMovement}), so `this.state` can be read and written directly and both
   * attributes settle within the same transaction.
   */
  #completeLiftMovement(): void {
    this.internal.liftMovementTimer = undefined;
    this.state.currentPositionLiftPercent100ths = this.internal.liftMovementTarget;
    this.state.operationalStatus.lift = WindowCovering.MovementStatus.Stopped;
    this.#updateGlobalOperationalStatus();
  }

  /**
   * If `movementDuration` is positive, synchronously reflects the new tilt movement direction in
   * `operationalStatus` and schedules a timer that simulates the tilt reaching `targetPercent100ths`. A
   * non-positive `movementDuration` (the default) does nothing at all here, leaving `operationalStatus` and
   * completion entirely to the real device implementation, reported via the command handler forwarded by the caller.
   *
   * @param {number} targetPercent100ths - The tilt target position, in percent hundredths (0-10000), to simulate reaching.
   */
  #startTiltMovement(targetPercent100ths: number): void {
    this.internal.tiltMovementTimer?.stop();
    this.internal.tiltMovementTimer = undefined;
    if (this.state.movementDuration <= 0) return;
    const status = this.#computeMovementStatus(targetPercent100ths, this.state.currentPositionTiltPercent100ths);
    this.state.operationalStatus.tilt = status;
    this.#updateGlobalOperationalStatus();
    if (status === WindowCovering.MovementStatus.Stopped) return;
    this.internal.tiltMovementTarget = targetPercent100ths;
    this.internal.tiltMovementTimer = Time.getTimer(
      'WindowCovering tilt movement complete',
      Millis(this.state.movementDuration),
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#completeTiltMovement, { lock: true }),
    ).start();
  }

  /**
   * Reactor for {@link #startTiltMovement}: sets `currentPositionTiltPercent100ths` to `internal.tiltMovementTarget`
   * (the target that was being approached; a timer reactor takes no custom arguments), then sets
   * `operationalStatus.tilt` back to Stopped and recomputes `operationalStatus.global`. Runs under a fresh, locked
   * Behavior context (see {@link #startLiftMovement}), so `this.state` can be read and written directly and both
   * attributes settle within the same transaction.
   */
  #completeTiltMovement(): void {
    this.internal.tiltMovementTimer = undefined;
    this.state.currentPositionTiltPercent100ths = this.internal.tiltMovementTarget;
    this.state.operationalStatus.tilt = WindowCovering.MovementStatus.Stopped;
    this.#updateGlobalOperationalStatus();
  }

  /**
   * Handles UpOrOpen for lift/tilt window coverings.
   * Will set target position to 0.
   */
  override async upOrOpen(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWindowCoveringServer: opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.upOrOpen', {
      command: 'upOrOpen',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: upOrOpen called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await super.upOrOpen();
    if (this.features.positionAwareLift && this.state.targetPositionLiftPercent100ths !== null) this.#startLiftMovement(this.state.targetPositionLiftPercent100ths);
    if (this.features.positionAwareTilt && this.state.targetPositionTiltPercent100ths !== null) this.#startTiltMovement(this.state.targetPositionTiltPercent100ths);
    device.log.debug(
      `MatterbridgeWindowCoveringServer: upOrOpen result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles DownOrClose for lift/tilt window coverings.
   * Will set target position to 10000.
   */
  override async downOrClose(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWindowCoveringServer: closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.downOrClose', {
      command: 'downOrClose',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: downOrClose called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await super.downOrClose();
    if (this.features.positionAwareLift && this.state.targetPositionLiftPercent100ths !== null) this.#startLiftMovement(this.state.targetPositionLiftPercent100ths);
    if (this.features.positionAwareTilt && this.state.targetPositionTiltPercent100ths !== null) this.#startTiltMovement(this.state.targetPositionTiltPercent100ths);
    device.log.debug(
      `MatterbridgeWindowCoveringServer: downOrClose result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Handles StopMotion for lift/tilt window coverings.
   * Will set target position to current position.
   */
  override async stopMotion(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeWindowCoveringServer: stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.stopMotion', {
      command: 'stopMotion',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: stopMotion called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await super.stopMotion();
    // Cancel any lift/tilt movement simulation still in flight from a previous command, and settle target = current.
    // Gated on movementDuration, like #startLiftMovement/#startTiltMovement: with the simulation disabled (the
    // default), this does nothing, leaving target/operationalStatus entirely to the real device implementation.
    this.internal.liftMovementTimer?.stop();
    this.internal.liftMovementTimer = undefined;
    this.internal.tiltMovementTimer?.stop();
    this.internal.tiltMovementTimer = undefined;
    if (this.state.movementDuration > 0) {
      if (this.features.positionAwareLift) this.state.targetPositionLiftPercent100ths = this.state.currentPositionLiftPercent100ths;
      if (this.features.positionAwareTilt) this.state.targetPositionTiltPercent100ths = this.state.currentPositionTiltPercent100ths;
      this.state.operationalStatus = { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped };
    }
    device.log.debug(
      `MatterbridgeWindowCoveringServer: stopMotion result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
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
    device.log.info(
      `MatterbridgeWindowCoveringServer: setting cover lift percentage to ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('WindowCovering.goToLiftPercentage', {
      command: 'goToLiftPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToLiftPercentage with ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await super.goToLiftPercentage(request);
    if (this.state.targetPositionLiftPercent100ths !== null) this.#startLiftMovement(this.state.targetPositionLiftPercent100ths);
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToLiftPercentage result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
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
    device.log.info(
      `MatterbridgeWindowCoveringServer: setting cover tilt percentage to ${request.tiltPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('WindowCovering.goToTiltPercentage', {
      command: 'goToTiltPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToTiltPercentage with ${request.tiltPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await super.goToTiltPercentage(request);
    if (this.state.targetPositionTiltPercent100ths !== null) this.#startTiltMovement(this.state.targetPositionTiltPercent100ths);
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToTiltPercentage result target ${this.state.targetPositionTiltPercent100ths} current ${this.state.currentPositionTiltPercent100ths} status global ${this.getMovementStatusLabel(this.state.operationalStatus.global)} lift ${this.getMovementStatusLabel(this.state.operationalStatus.lift)} tilt ${this.getMovementStatusLabel(this.state.operationalStatus.tilt)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
  }

  /**
   * Stops timers when the server is disposed.
   */
  override async [Symbol.asyncDispose](): Promise<void> {
    this.internal.liftMovementTimer?.stop();
    this.internal.liftMovementTimer = undefined;
    this.internal.tiltMovementTimer?.stop();
    this.internal.tiltMovementTimer = undefined;
    await super[Symbol.asyncDispose]?.();
  }
}

/* v8 ignore start */
export namespace MatterbridgeWindowCoveringServer {
  export class Internal extends WindowCoveringBaseServer.Internal {
    /** Pending timer that simulates completion of an in-progress lift movement; cancelled by StopMotion or a new lift movement. */
    liftMovementTimer?: Timer;
    /** Lift target, in percent hundredths (0-10000), the pending lift movement timer will apply on completion. */
    liftMovementTarget = 0;
    /** Pending timer that simulates completion of an in-progress tilt movement; cancelled by StopMotion or a new tilt movement. */
    tiltMovementTimer?: Timer;
    /** Tilt target, in percent hundredths (0-10000), the pending tilt movement timer will apply on completion. */
    tiltMovementTarget = 0;
  }

  /**
   * Simulated timing knob for lift/tilt movement, in addition to the standard WindowCovering attributes.
   *
   * @remarks
   * There is no real motor to wait on, so completion of a lift or tilt movement can optionally be simulated by
   * this fixed delay: `operationalStatus` is set synchronously on command receipt (Opening/Closing), and
   * `currentPosition*Percent100ths`/`operationalStatus` are updated this many milliseconds later, as if the
   * covering had finished moving. A non-positive value (the default) gates the timer off entirely — the server
   * does nothing further after setting `operationalStatus`, leaving completion (`currentPosition*Percent100ths`/
   * `operationalStatus`) to whatever real device integration is wired up through the command handler forwarded
   * at the top of each command.
   */
  export class State extends WindowCoveringBaseServer.State {
    /** Simulated duration, in milliseconds, that a lift or tilt movement takes to complete. A non-positive value disables the built-in simulation. Default: 0 (disabled). */
    movementDuration = 0;
  }
}
/* v8 ignore stop */
