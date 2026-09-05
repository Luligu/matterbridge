/**
 * @file packages/core/src/behaviors/valveConfigurationAndControlServer.ts
 * @description This file contains the MatterbridgeValveConfigurationAndControlServer class of Matterbridge.
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
/* oxlint-disable typescript/no-namespace */

import { Millis, Seconds, Time, type MaybePromise, type Timer } from '@matter/general';
import { ValveConfigurationAndControlServer } from '@matter/node/behaviors/valve-configuration-and-control';
import { Status, StatusResponseError } from '@matter/types';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

const MatterbridgeValveConfigurationAndControlServerBase = ValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level);

/**
 * ValveConfigurationAndControl server that forwards valve commands to the Matterbridge command handler.
 *
 * @remarks
 * There is no real valve actuator to wait on in the base implementation, so `open()`/`close()` always set the
 * attributes required by the Matter spec's Effect on Receipt synchronously (TargetState/TargetLevel/OpenDuration/
 * RemainingDuration, CurrentState set to Transitioning), but the two built-in simulation timers that would drive
 * completion are each gated on their own `state` knob, both disabled (0 / `false`) by default:
 * - `state.movementDuration` (milliseconds): when `> 0`, CurrentState/CurrentLevel converge on TargetState/
 *   TargetLevel (which then revert to `null`) after this many milliseconds. When `0` (the default), completion
 *   is left entirely to the real device implementation, e.g. via `setAttribute()`/`updateAttribute()` from the
 *   command handler forwarded at the top of `open()`/`close()`.
 * - `state.autoClose` (boolean): when `true`, RemainingDuration counts down once per second and the valve calls
 *   `close()` on its own once it reaches 0. When `false` (the default), RemainingDuration is still set on Open
 *   but never ticks down or triggers an internal Close — auto-close is left entirely to the real device
 *   implementation.
 *
 * `initialize()` sets both knobs to CHIP-test-friendly values (`movementDuration = 2000`, `autoClose = true`)
 * under `MATTERBRIDGE_CHIP_TEST` only; production behavior (both disabled) is otherwise unaffected. A real
 * device implementation may also opt into either simulation directly by setting the same `state` values.
 */
export class MatterbridgeValveConfigurationAndControlServer extends MatterbridgeValveConfigurationAndControlServerBase {
  declare readonly state: MatterbridgeValveConfigurationAndControlServer.State;
  declare protected internal: MatterbridgeValveConfigurationAndControlServer.Internal;

  /**
   * Enables the built-in movement and auto-close simulation under MATTERBRIDGE_CHIP_TEST only; production
   * behavior is unaffected (`movementDuration` stays 0 and `autoClose` stays `false`, i.e. both disabled,
   * unless overridden by the real device implementation).
   *
   * @returns {MaybePromise} The result of the superclass initializer.
   */
  override initialize(): MaybePromise {
    // v8 ignore next 2 - only enabled under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      this.state.movementDuration = 2000;
      this.state.autoClose = true;
    }
    return super.initialize();
  }

  /**
   * Forwards Open requests to the Matterbridge command handler and updates valve state.
   *
   * @param {ValveConfigurationAndControl.OpenRequest} request - Open request payload.
   */
  override async open(request: ValveConfigurationAndControl.OpenRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeValveConfigurationAndControlServer: opening valve to ${request.targetLevel ? request.targetLevel + '%' : 'fully opened'} ${request.openDuration ? 'for ' + request.openDuration + 's' : 'until closed'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ValveConfigurationAndControl.open', {
      command: 'open',
      request,
      cluster: ValveConfigurationAndControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ValveConfigurationAndControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(
      `MatterbridgeValveConfigurationAndControlServer: open called with openDuration: ${request.openDuration} targetLevel: ${request.targetLevel} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );

    // Matter 1.6.0 § 4.6.8.1.3: Ignore the command and return FailureDueToFault when the device has registered a fault that prevents the requested action.
    if (this.#hasFault()) {
      throw new ValveConfigurationAndControl.FailureDueToFaultError(
        `MatterbridgeValveConfigurationAndControlServer: open ignored, the valve has a registered fault (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // A new Open supersedes any movement/countdown still in flight from a previous Open/Close.
    this.#stopMovementTimer();
    this.#stopAutoCloseTimer();

    // Matter 1.6.0 § 4.6.8.1.3: Set the TargetState attribute to Open and the CurrentState attribute to Transitioning.
    this.state.targetState = ValveConfigurationAndControl.ValveState.Open;
    this.state.currentState = ValveConfigurationAndControl.ValveState.Transitioning;

    // Matter 1.6.0 § 4.6.8.1.3: Set the OpenDuration attribute to the OpenDuration field when present, otherwise to the DefaultOpenDuration attribute.
    this.state.openDuration = request.openDuration === undefined ? this.state.defaultOpenDuration : request.openDuration;
    // Matter 1.6.0 § 4.6.8.1.3: Set RemainingDuration to null when OpenDuration is null (no auto close defined), otherwise to the value of OpenDuration. The TimeSync feature is not supported, so AutoCloseTime never applies.
    this.state.remainingDuration = this.state.openDuration;

    if (this.features.level) {
      // Matter 1.6.0 § 4.6.8.1.3: Return CONSTRAINT_ERROR when LevelStep and the TargetLevel field are both present, TargetLevel is not 100, and (TargetLevel % LevelStep) is not 0.
      if (request.targetLevel !== undefined && request.targetLevel !== 100 && this.state.levelStep !== undefined && request.targetLevel % this.state.levelStep !== 0) {
        throw new StatusResponseError(
          `MatterbridgeValveConfigurationAndControlServer: open targetLevel ${request.targetLevel} is not a multiple of levelStep ${this.state.levelStep} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
          Status.ConstraintError,
        );
      }
      // Matter 1.6.0 § 4.6.8.1.3: With the Level feature, set the TargetLevel attribute to the TargetLevel field when present, otherwise to DefaultOpenLevel when implemented, otherwise to 100.
      // v8 ignore next - defensive fallback: DefaultOpenLevel's own schema default is already 100
      this.state.targetLevel = request.targetLevel ?? this.state.defaultOpenLevel ?? 100;
    }

    // A non-positive movementDuration disables the built-in movement simulation, leaving completion to the real
    // device implementation. If autoClose is false, Close is likewise left entirely to the real device
    // implementation: no countdown timer is started, so RemainingDuration is set (above) but never ticks down.
    // Matter 1.6.0 § 4.6.8.1.3: Once the target and duration attributes are set, start the movement towards the target value, setting CurrentState to Open when the movement completes.
    if (this.state.movementDuration > 0) this.#scheduleMovementComplete(ValveConfigurationAndControl.ValveState.Open, this.state.targetLevel ?? 100);
    // Matter 1.6.0 § 4.6.8.1.3: Once the target and duration attributes are set, start the countdown of the RemainingDuration attribute.
    if (this.state.autoClose && this.state.remainingDuration !== null) this.#scheduleAutoClose();
  }

  /**
   * Handles the Close command.
   */
  override async close(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeValveConfigurationAndControlServer: closing valve (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ValveConfigurationAndControl.close', {
      command: 'close',
      request: {},
      cluster: ValveConfigurationAndControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ValveConfigurationAndControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: close called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);

    // Matter 1.6.0 § 4.6.8.2.1: Ignore the command and return FailureDueToFault when the device has registered a fault that prevents the requested action.
    if (this.#hasFault()) {
      throw new ValveConfigurationAndControl.FailureDueToFaultError(
        `MatterbridgeValveConfigurationAndControlServer: close ignored, the valve has a registered fault (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // A Close cancels any movement/countdown still in flight, including an auto-close already counting down.
    this.#stopMovementTimer();
    this.#stopAutoCloseTimer();

    // Matter 1.6.0 § 4.6.8.2.1: Set the OpenDuration and RemainingDuration attributes to null.
    this.state.openDuration = null;
    this.state.remainingDuration = null;
    // Matter 1.6.0 § 4.6.8.2.1: Set the TargetState attribute to Closed and the CurrentState attribute to Transitioning.
    this.state.targetState = ValveConfigurationAndControl.ValveState.Closed;
    this.state.currentState = ValveConfigurationAndControl.ValveState.Transitioning;
    // Matter 1.6.0 § 4.6.8.2.1: With the Level feature, set the TargetLevel attribute to 0.
    if (this.features.level) this.state.targetLevel = 0;

    // A non-positive movementDuration disables the built-in movement simulation, leaving completion to the real
    // device implementation.
    // Matter 1.6.0 § 4.6.8.2.1: Once the target attributes are set, start the movement towards the target value, setting CurrentState to Closed when the movement completes.
    if (this.state.movementDuration > 0) this.#scheduleMovementComplete(ValveConfigurationAndControl.ValveState.Closed, 0);
  }

  /**
   * Returns whether the valve currently has any fault bit set in the ValveFault attribute.
   *
   * @returns {boolean} `true` if at least one fault bit is set.
   */
  #hasFault(): boolean {
    const fault = this.state.valveFault;
    return fault !== undefined && Object.values(fault).some((bit) => bit === true);
  }

  /**
   * Stops the pending movement-completion timer, if any.
   */
  #stopMovementTimer(): void {
    this.internal.movementTimer?.stop();
    this.internal.movementTimer = undefined;
  }

  /**
   * Stops the pending RemainingDuration countdown/auto-close timer, if any.
   */
  #stopAutoCloseTimer(): void {
    this.internal.autoCloseTimer?.stop();
    this.internal.autoCloseTimer = undefined;
  }

  /**
   * Schedules completion of a simulated Open/Close movement using the Matter timer abstraction. Once
   * `movementDuration` has elapsed: CurrentState is set to `finalState`, CurrentLevel (if the Level feature is
   * supported) is set to `finalLevel`, and TargetState/TargetLevel revert to null.
   *
   * Matter 1.6 Application Cluster Specification, 4.6.7.6 TargetState Attribute / 4.6.7.8 TargetLevel Attribute:
   * a value of null indicates that no target is set, since the change in state/level is done (or failed).
   * 4.6.8.1.3/4.6.8.2.1: when the movement is complete, the device SHALL set the CurrentState attribute to the
   * Open/Closed value.
   *
   * @param {ValveConfigurationAndControl.ValveState} finalState - The CurrentState value to reach (Open or Closed).
   * @param {number} finalLevel - The CurrentLevel value to reach, used only when the Level feature is supported.
   */
  #scheduleMovementComplete(finalState: ValveConfigurationAndControl.ValveState, finalLevel: number): void {
    this.internal.movementFinalState = finalState;
    this.internal.movementFinalLevel = finalLevel;
    this.internal.movementTimer = Time.getTimer(
      'ValveConfigurationAndControl movement complete',
      Millis(this.state.movementDuration),
      // The reactor must be a real method, not an arrow function, so the framework can rebind `this` to a fresh,
      // still-valid Behavior context when the timer fires well after the originating command's own context exited.
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#completeMovement, { lock: true }),
    ).start();
  }

  /**
   * Reactor for {@link #scheduleMovementComplete}; reads its target from `internal.movementFinalState`/
   * `internal.movementFinalLevel` since a timer callback takes no custom arguments.
   */
  #completeMovement(): void {
    this.internal.movementTimer = undefined;
    // Matter 1.6.0 § 4.6.8.1.3 and § 4.6.8.2.1: When the movement is complete, set the CurrentState attribute to the Open or Closed value reached.
    this.state.currentState = this.internal.movementFinalState;
    // Matter 1.6.0 § 4.6.7.7: With the Level feature, CurrentLevel indicates the level of the valve reached at the end of the movement.
    if (this.features.level) this.state.currentLevel = this.internal.movementFinalLevel;
    // Matter 1.6.0 § 4.6.7.6: A null TargetState indicates that no target position is set, since the change in state is done.
    this.state.targetState = null;
    // Matter 1.6.0 § 4.6.7.8: A null TargetLevel indicates that no target position is set, since the change of level is done.
    if (this.features.level) this.state.targetLevel = null;
  }

  /**
   * Schedules the RemainingDuration countdown for the OpenDuration set by the current Open command, ticking once
   * per second. When it reaches 0, closes the valve exactly as if a Close command had been received.
   *
   * Matter 1.6 Application Cluster Specification, 4.6.7.4 RemainingDuration Attribute: when the value of this
   * attribute counts down to 0, the valve SHALL automatically transition to its closed position, and the
   * behavior of transitioning to the closed position SHALL match the behavior described in the Close command.
   */
  #scheduleAutoClose(): void {
    this.internal.autoCloseTimer = Time.getPeriodicTimer(
      'ValveConfigurationAndControl auto close',
      Seconds(1),
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#tickAutoClose, { lock: true }),
    ).start();
  }

  /**
   * Reactor for {@link #scheduleAutoClose}: decrements RemainingDuration by 1 every second, closing the valve
   * once it reaches 0.
   */
  #tickAutoClose(): void {
    if (this.state.remainingDuration === null) return;
    const remaining = Math.max(0, this.state.remainingDuration - 1);
    // Matter 1.6.0 § 4.6.7.4: RemainingDuration indicates the remaining duration, in seconds, until the valve closes.
    this.state.remainingDuration = remaining;
    // Matter 1.6.0 § 4.6.7.4: When RemainingDuration counts down to 0, the valve automatically transitions to its closed position, matching the behavior of the Close command.
    if (remaining === 0) {
      this.#stopAutoCloseTimer();
      void this.close();
    }
  }

  /**
   * Stops timers when the server is disposed.
   */
  override async [Symbol.asyncDispose](): Promise<void> {
    this.#stopMovementTimer();
    this.#stopAutoCloseTimer();
    await super[Symbol.asyncDispose]?.();
  }
}

/* v8 ignore start */
export namespace MatterbridgeValveConfigurationAndControlServer {
  /**
   * Internal state for MatterbridgeValveConfigurationAndControlServer.
   */
  export class Internal extends MatterbridgeValveConfigurationAndControlServerBase.Internal {
    /** Timer used to simulate completion of an in-progress Open/Close movement (MATTERBRIDGE_CHIP_TEST only). */
    movementTimer?: Timer;
    /** CurrentState value the pending movement timer will apply on completion. */
    movementFinalState: ValveConfigurationAndControl.ValveState = ValveConfigurationAndControl.ValveState.Closed;
    /** CurrentLevel value the pending movement timer will apply on completion (Level feature only). */
    movementFinalLevel = 0;
    /** Timer used to simulate the RemainingDuration countdown towards an auto-close (MATTERBRIDGE_CHIP_TEST only). */
    autoCloseTimer?: Timer;
  }

  /**
   * Simulated timing knobs for `open()`/`close()`, in addition to the standard ValveConfigurationAndControl
   * attributes.
   */
  export class State extends MatterbridgeValveConfigurationAndControlServerBase.State {
    /** Simulated duration, in milliseconds, that an Open/Close movement takes to complete. A non-positive value disables the built-in simulation, leaving completion to the real device implementation. Default: 0 (disabled); set to 2000 (2 seconds) under MATTERBRIDGE_CHIP_TEST by `initialize()`. */
    movementDuration = 0;
    /** Whether the RemainingDuration countdown timer auto-closes the valve once it reaches 0. When `false`, RemainingDuration is still set on Open but never ticks down, and Close is left entirely to the real device implementation. Default: `false` (disabled); set to `true` under MATTERBRIDGE_CHIP_TEST by `initialize()`. */
    autoClose = false;
  }
}
/* v8 ignore stop */
