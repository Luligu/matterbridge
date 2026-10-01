/**
 * @file packages/core/src/devices/closurePanel.ts
 * @description Closure Panel device class exposing the Matter 1.5 ClosureDimension cluster.
 * @author Luca Liguori
 * @created 2026-03-02
 * @version 1.0.1
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
/* oxlint-disable typescript/no-namespace */

// @matter
import { Millis, Time, type MaybePromise, type Timer } from '@matter/general';
import { ClosureControlServer } from '@matter/node/behaviors/closure-control';
import { ClosureDimensionServer } from '@matter/node/behaviors/closure-dimension';
import { StatusResponse } from '@matter/types';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import type { EndpointNumber } from '@matter/types/datatype';
import { ThreeLevelAuto } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Which mutually exclusive ClosureDimension motion feature (Translation, Rotation or Modulation) a panel supports.
 *
 * @remarks
 * The Matter ClosureDimension cluster requires exactly one of these features when Positioning is supported
 * (Application Cluster Specification § 5.5.5, conformance group `[PS].b` on Translation/Rotation/Modulation).
 *
 * A lift panel translates along a path, for example a roller blind, curtain, sliding shutter or garage door
 * moving up/down or left/right.
 *
 * A tilt panel rotates around an axis, for example venetian blind slats, louver blades or a tilt-only shutter.
 *
 * A modulation panel is controlled as a 0-100% effect/opening level without exposing a linear travel distance
 * or rotation angle, for example an air damper, ventilation grille, electrochromic smart-glass tint/privacy
 * panel, or similar flow/opacity panel.
 */
export type ClosureDimensionType = 'lift' | 'tilt' | 'modulation';

const MatterbridgeClosureDimensionServerBase = ClosureDimensionServer.with(
  ClosureDimension.Feature.Positioning,
  ClosureDimension.Feature.MotionLatching,
  ClosureDimension.Feature.Speed,
);

/**
 * ClosureDimension server that forwards SetTarget/Step commands to the Matterbridge command handler.
 *
 * @remarks
 * There is no real motor to wait on in the base implementation, so the built-in simulation timer that drives
 * SetTarget/Step completion (`state.movementDuration`, in milliseconds) is disabled (`0`) by default — see the
 * `MatterbridgeClosureDimensionServer.State` remarks.
 *
 * `initialize()` sets this knob to a CHIP-test-friendly value (`movementDuration = 2000`) under
 * `MATTERBRIDGE_CHIP_TEST` only; production behavior (disabled) is otherwise unaffected. A real device
 * implementation may also opt into the simulation directly by setting the same `state` value.
 */
export class MatterbridgeClosureDimensionServer extends MatterbridgeClosureDimensionServerBase {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  declare readonly state: MatterbridgeClosureDimensionServer.State;
  declare protected internal: MatterbridgeClosureDimensionServer.Internal;

  /**
   * Enables the built-in SetTarget/Step movement simulation under MATTERBRIDGE_CHIP_TEST only; production
   * behavior is unaffected (`movementDuration` stays 0, i.e. disabled, unless overridden by the real device
   * implementation).
   *
   * @returns {MaybePromise} The result of the superclass initializer.
   */
  override initialize(): MaybePromise {
    // v8 ignore next 2 - only enabled under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      this.state.movementDuration = 2000;
    }
    return super.initialize();
  }

  override setTarget = async (request: ClosureDimension.SetTargetRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeClosureDimensionServer.setTarget: received (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Always forward the command to the Matterbridge command handler without validation to allow for external control of the closure.
    await device.commandHandler.executeHandler('ClosureDimension.setTarget', {
      command: 'setTarget',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 5.5.8.1: Reject commands without any choice field with INVALID_COMMAND.
    if (request.position === undefined && request.latch === undefined && request.speed === undefined) {
      throw new StatusResponse.InvalidCommandError(
        `MatterbridgeClosureDimensionServer.setTarget: requires at least one of position, latch, or speed to be present (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    // Matter 1.6.0 § 5.5.8.1.1: percent100ths is constrained to the range 0-10000: a Position field outside that range SHALL return CONSTRAINT_ERROR.
    if (request.position !== undefined && (request.position < 0 || request.position > 10000)) {
      throw new StatusResponse.ConstraintErrorError(
        `MatterbridgeClosureDimensionServer.setTarget: position must be between 0 and 10000 (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }
    const hasSupportedField =
      request.position !== undefined || (this.features.motionLatching && request.latch !== undefined) || (this.features.speed && request.speed !== undefined);
    // Matter 1.6.0 § 5.5.8.1.4: Ignore unsupported fields without changing state.
    if (!hasSupportedField) return;

    const latchControlModes = this.state.latchControlModes;
    // Matter 1.6.0 § 5.5.8.1.2: Reject latch requests requiring manual intervention with INVALID_IN_STATE.
    if (
      this.features.motionLatching &&
      request.latch !== undefined &&
      ((request.latch && !latchControlModes?.remoteLatching) || (!request.latch && !latchControlModes?.remoteUnlatching))
    ) {
      throw new StatusResponse.InvalidInStateError(
        `MatterbridgeClosureDimensionServer.setTarget: latch change requires manual intervention per LatchControlModes (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Matter 1.6.0 § 5.5.8.1.3: ThreeLevelAutoEnum only defines Auto, Low, Medium and High: a Speed field outside that range SHALL return CONSTRAINT_ERROR.
    if (this.features.speed && request.speed !== undefined && (request.speed < ThreeLevelAuto.Auto || request.speed > ThreeLevelAuto.High)) {
      throw new StatusResponse.ConstraintErrorError(
        `MatterbridgeClosureDimensionServer.setTarget: speed must be a valid ThreeLevelAutoEnum value (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    const associatedMainState = this.endpoint.owner?.maybeStateOf(ClosureControlServer)?.mainState;
    // Matter 1.6.0 § 5.5.8.1.4: Reject commands while the associated closure is Disengaged, Protected, Calibrating, SetupRequired or Error with INVALID_IN_STATE.
    if (
      associatedMainState !== undefined &&
      (
        [
          ClosureControl.MainState.Disengaged,
          ClosureControl.MainState.Protected,
          ClosureControl.MainState.Calibrating,
          ClosureControl.MainState.SetupRequired,
          ClosureControl.MainState.Error,
        ] as ClosureControl.MainState[]
      ).includes(associatedMainState)
    ) {
      throw new StatusResponse.InvalidInStateError(
        `MatterbridgeClosureDimensionServer.setTarget: is not allowed while the associated ClosureControl is Disengaged, Protected, Calibrating, SetupRequired, or Error (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    const currentState = this.state.currentState;
    // Matter 1.6.0 § 5.5.8.1.4: Reject position changes while latched unless unlatching is requested with INVALID_IN_STATE.
    if (this.features.motionLatching && request.position !== undefined && currentState?.latch === true && request.latch !== false) {
      throw new StatusResponse.InvalidInStateError(
        `MatterbridgeClosureDimensionServer.setTarget: position changes require latch false while the closure is latched (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    const previousTarget = this.state.targetState ?? {};
    const resolution: number = this.state.resolution;
    const nextTarget = {
      ...previousTarget,
      // Matter 1.6.0 § 5.5.8.1.1: Round the requested position to the nearest multiple of Resolution.
      ...(request?.position !== undefined ? { position: Math.round(request.position / resolution) * resolution } : null),
      // Matter 1.6.0 § 5.5.8.1.2: Apply the requested latch, retaining the prior target when omitted.
      ...(this.features.motionLatching && request?.latch !== undefined ? { latch: request.latch } : null),
      // Matter 1.6.0 § 5.5.8.1.3: Apply the requested speed with the command fallback Auto.
      ...(this.features.speed ? { speed: request?.speed ?? ThreeLevelAuto.Auto } : null),
    };

    const matchesCurrentState =
      currentState !== null &&
      (nextTarget.position === undefined || nextTarget.position === currentState.position) &&
      (!this.features.motionLatching || nextTarget.latch === undefined || nextTarget.latch === currentState.latch) &&
      (!this.features.speed || nextTarget.speed === currentState.speed);
    // Matter 1.6.0 § 5.5.8.1.4: Take no action when all requested fields match CurrentState.
    if (matchesCurrentState) return;

    // Matter 1.6.0 § 5.5.8.1.4: Update TargetState with the accepted position, latch and speed values.
    this.state.targetState = nextTarget;
    // Matter 1.6.0 § 5.5.8.1.4: Initiate the requested movement toward TargetState.
    this.#scheduleMovement(nextTarget, currentState);
    this.endpoint.emitCommand(ClosureDimension, 'setTarget', request, this.context);
  };

  override step = async (request: ClosureDimension.StepRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeClosureDimensionServer.step: received (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Always forward the command to the Matterbridge command handler without validation to allow for external control of the closure.
    await device.commandHandler.executeHandler('ClosureDimension.step', {
      command: 'step',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension)['attributes']>,
      endpoint: this.endpoint,
      context: this.context,
    });

    // Matter 1.6.0 § 5.5.8.2.1: StepDirectionEnum only defines Decrease and Increase: a Direction field outside that range SHALL return CONSTRAINT_ERROR.
    if (request.direction < ClosureDimension.StepDirection.Decrease || request.direction > ClosureDimension.StepDirection.Increase) {
      throw new StatusResponse.ConstraintErrorError(
        `MatterbridgeClosureDimensionServer.step: direction must be a valid StepDirectionEnum value (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Matter 1.6.0 § 5.5.8.2.2: NumberOfSteps is constrained to be at least 1: a NumberOfSteps of 0 SHALL return CONSTRAINT_ERROR.
    if (request.numberOfSteps < 1) {
      throw new StatusResponse.ConstraintErrorError(
        `MatterbridgeClosureDimensionServer.step: numberOfSteps must be at least 1 (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Matter 1.6.0 § 5.5.8.2.3: ThreeLevelAutoEnum only defines Auto, Low, Medium and High: a Speed field outside that range SHALL return CONSTRAINT_ERROR.
    if (this.features.speed && request.speed !== undefined && (request.speed < ThreeLevelAuto.Auto || request.speed > ThreeLevelAuto.High)) {
      throw new StatusResponse.ConstraintErrorError(
        `MatterbridgeClosureDimensionServer.step: speed must be a valid ThreeLevelAutoEnum value (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    const currentState = this.state.currentState;
    // Matter 1.6.0 § 5.5.8.2.4: Reject Step while latched with INVALID_IN_STATE.
    if (this.features.motionLatching && currentState?.latch === true) {
      throw new StatusResponse.InvalidInStateError(
        `MatterbridgeClosureDimensionServer.step: is not allowed while the closure is latched (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    const associatedMainState = this.endpoint.owner?.maybeStateOf(ClosureControlServer)?.mainState;
    // Matter 1.6.0 § 5.5.8.2.4: Reject commands while the associated closure is Disengaged, Protected, Calibrating, SetupRequired or Error with INVALID_IN_STATE.
    if (
      associatedMainState !== undefined &&
      (
        [
          ClosureControl.MainState.Disengaged,
          ClosureControl.MainState.Protected,
          ClosureControl.MainState.Calibrating,
          ClosureControl.MainState.SetupRequired,
          ClosureControl.MainState.Error,
        ] as ClosureControl.MainState[]
      ).includes(associatedMainState)
    ) {
      throw new StatusResponse.InvalidInStateError(
        `MatterbridgeClosureDimensionServer.step: is not allowed while the associated ClosureControl is Disengaged, Protected, Calibrating, SetupRequired, or Error (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
    }

    // Otherwise, the server SHALL respond with a status code of SUCCESS and the TargetState attribute value SHALL
    // be changed as follows: TargetState.Position = CurrentState.Position -/+ NumberOfSteps * StepValue, clamped to
    // 0.00%/100.00% (this class does not support the Limitation feature). If the Speed field of the command is
    // present, the Speed field of the TargetState attribute SHALL be set to the Speed field of the command,
    // otherwise the Speed field of the TargetState attribute SHALL remain unchanged.
    const stepValue: number = this.state.stepValue;
    const numberOfSteps: number = request.numberOfSteps;
    const delta = stepValue * numberOfSteps;
    const isIncrease = request.direction === ClosureDimension.StepDirection.Increase;
    const currentPosition = typeof currentState?.position === 'number' ? currentState.position : 0;

    let nextPosition = isIncrease ? currentPosition + delta : currentPosition - delta;
    // Matter 1.6.0 § 5.5.8.2.4: Clamp the requested step position to zero through 100 percent without Limitation.
    nextPosition = Math.max(0, Math.min(10000, nextPosition));

    const previousTarget = this.state.targetState ?? {};
    const nextTarget = {
      ...previousTarget,
      // Matter 1.6.0 § 5.5.8.2.4: Set the target position to the clamped step from CurrentState.Position.
      position: nextPosition,
      // Matter 1.6.0 § 5.5.8.2.4: Change target speed only when Speed is present.
      ...(this.features.speed && request.speed !== undefined ? { speed: request.speed } : null),
    };
    // Matter 1.6.0 § 5.5.8.2.4: Update TargetState with the accepted position, latch and speed values.
    this.state.targetState = nextTarget;
    // Matter 1.6.0 § 5.5.8.2.4: Initiate the requested movement toward TargetState.
    this.#scheduleMovement(nextTarget, currentState);
    this.endpoint.emitCommand(ClosureDimension, 'step', request, this.context);
  };

  /**
   * Schedules (or cancels a pending, then schedules) the simulated convergence of `currentState` to
   * `targetState`, per `movementDuration`.
   *
   * @remarks
   * There is no real motor to wait on, so completion of a SetTarget/Step movement can optionally be simulated
   * by `movementDuration`: `TargetState` is set synchronously on command receipt (by the caller), and
   * `CurrentState` is updated this many milliseconds later, as if the panel had finished moving. A
   * non-positive `movementDuration`, or no `currentState` to converge from, gates this off entirely — the
   * server does nothing further, leaving completion (`CurrentState`) to whatever real device integration is
   * wired up through the command handler forwarded at the top of `setTarget()`/`step()`.
   *
   * @param {ClosureDimension.DimensionState} targetState - The target state to converge `currentState` to.
   * @param {ClosureDimension.DimensionState | null} currentState - The `currentState` read when the command was received.
   * @returns {void}
   */
  #scheduleMovement(targetState: ClosureDimension.DimensionState, currentState: ClosureDimension.DimensionState | null): void {
    // Cancel any movement still in flight from a previous command before (re)scheduling.
    // Matter 1.6.0 § 5.5.8.1.1 and § 5.5.8.2.4: Replace the simulated movement with movement toward the latest requested target.
    this.internal.movementTimer?.stop();
    this.internal.movementTimer = undefined;
    if (currentState === null || this.state.movementDuration <= 0) return;
    this.internal.movementTargetState = targetState;
    this.internal.movementPreviousState = currentState;
    this.internal.movementTimer = Time.getTimer(
      'ClosureDimension movement complete',
      Millis(this.state.movementDuration),
      // The reactor must be a real method, not an arrow function, so the framework can rebind `this` to a
      // fresh, still-valid Behavior context when the timer fires well after the originating command's own
      // context exited.
      // oxlint-disable-next-line typescript/unbound-method
      this.callback(this.#completeMovement, { lock: true }),
    ).start();
  }

  /**
   * Reactor for {@link #scheduleMovement}: updates the `currentState` attribute to match
   * `internal.movementTargetState` (the target that was being approached; a timer reactor takes no custom
   * arguments). Runs under a fresh, locked Behavior context (see {@link #scheduleMovement}), so `this.state` can
   * be written directly within the same transaction.
   */
  #completeMovement(): void {
    this.internal.movementTimer = undefined;
    const targetState = this.internal.movementTargetState;
    const previousState = this.internal.movementPreviousState;
    // setTarget()/step() always carry Position/Latch/Speed through to targetState explicitly (each inherited
    // from the constructor's own non-null defaults when a command omits it), so the `?? previousState.*`
    // fallbacks below are unreachable through the public command surface — kept only as a defensive guard
    // against a manually-cleared state.
    /* v8 ignore next 3 */
    const position = targetState.position ?? previousState.position;
    const latch = targetState.latch ?? previousState.latch;
    const speed = targetState.speed ?? previousState.speed;
    // Matter 1.6.0 § 5.5.7.1: Report the current position, latch and speed after simulated movement completes.
    this.state.currentState = {
      position,
      ...(this.features.motionLatching ? { latch } : null),
      ...(this.features.speed ? { speed } : null),
    };
  }

  /**
   * Stops timers when the server is disposed.
   */
  override async [Symbol.asyncDispose](): Promise<void> {
    this.internal.movementTimer?.stop();
    this.internal.movementTimer = undefined;
    await super[Symbol.asyncDispose]?.();
  }
}

/* v8 ignore start */
export namespace MatterbridgeClosureDimensionServer {
  export class Internal extends MatterbridgeClosureDimensionServerBase.Internal {
    /** Pending timer that simulates completion of an in-progress SetTarget/Step; cancelled by Stop or a new SetTarget/Step. */
    movementTimer?: Timer;
    /** Target state the pending movement timer will apply on completion. */
    movementTargetState: ClosureDimension.DimensionState = {};
    /** `currentState` captured when the pending movement was scheduled. */
    movementPreviousState: ClosureDimension.DimensionState = {};
  }

  /**
   * Simulated timing knob for `setTarget()`/`step()`, in addition to the standard ClosureDimension attributes.
   *
   * @remarks
   * There is no real motor to wait on, so completion of a movement can optionally be simulated by this fixed
   * delay: `TargetState` is set synchronously on command receipt, and `CurrentState` is updated this many
   * milliseconds later, as if the panel had finished moving. A non-positive value (the default) gates the
   * handler off entirely — the server does nothing further after setting TargetState, leaving completion
   * (`CurrentState`) to whatever real device integration is wired up through the command handler forwarded at
   * the top of `setTarget()`/`step()`.
   */
  export class State extends MatterbridgeClosureDimensionServerBase.State {
    /** Simulated duration, in milliseconds, that a SetTarget/Step operation takes to complete. A non-positive value disables the built-in simulation. Default: 0 (disabled). */
    movementDuration = 0;
  }
}
/* v8 ignore stop */

export interface ClosurePanelOptions {
  /** Child endpoint number. */
  number?: EndpointNumber;
  /** Initial current state. Defaults to latched and fully closed. */
  currentState?: ClosureDimension.DimensionState;
  /** Initial target state. Defaults to latched and fully closed. */
  targetState?: ClosureDimension.DimensionState;
  /** Position resolution of the ClosureDimension cluster, expressed in percent100ths. Defaults to 100 (1%). */
  resolution?: number;
  /** Number of units moved for each Step command, expressed in percent100ths. Defaults to 100 (1%). */
  stepValue?: number;
  /** Enable the ClosureDimension MotionLatching feature. Defaults to false. */
  motionLatching?: boolean;
  /** Enable the ClosureDimension Speed feature. Defaults to false. */
  speed?: boolean;
  /** Supported remote latch control modes. Defaults to latching and unlatching enabled. */
  latchControlModes?: ClosureDimension.LatchControlModes;
  /** Simulated duration, in milliseconds, that a SetTarget/Step operation takes to complete. A non-positive value disables the built-in simulation, leaving completion to the real device implementation. Defaults to 0 (disabled). */
  movementDuration?: number;
  /** Direction of the translation. Only used when `dimensionType` is `'lift'`. Defaults to Downward. */
  translationDirection?: ClosureDimension.TranslationDirection;
  /** Axis of the rotation. Only used when `dimensionType` is `'tilt'`. Defaults to CenteredHorizontal. */
  rotationAxis?: ClosureDimension.RotationAxis;
  /** Overflow of the rotation. Only used when `dimensionType` is `'tilt'`. Defaults to NoOverflow. */
  overflow?: ClosureDimension.Overflow;
  /** Type of modulation. Only used when `dimensionType` is `'modulation'`. Defaults to SlatsOrientation. */
  modulationType?: ClosureDimension.ModulationType;
}

/**
 * Creates the ClosureDimension Cluster Server matching `dimensionType`, with its motion-specific attributes.
 *
 * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
 * @param {ClosureDimensionType} dimensionType - Which mutually exclusive motion feature the panel supports.
 * @param {ClosurePanelOptions} options - Initial ClosureDimension cluster state values.
 *
 * @returns {MatterbridgeEndpoint} The current MatterbridgeEndpoint instance for chaining.
 */
export function createClosureDimensionClusterServer(endpoint: MatterbridgeEndpoint, dimensionType: ClosureDimensionType, options: ClosurePanelOptions): MatterbridgeEndpoint {
  const motionLatching = options.motionLatching ?? false;
  const speed = options.speed ?? false;
  const commonOptions = {
    currentState: {
      position: options.currentState?.position ?? 0,
      ...(motionLatching ? { latch: options.currentState?.latch ?? true } : null),
      ...(speed ? { speed: options.currentState?.speed ?? ThreeLevelAuto.Auto } : null),
    },
    targetState: {
      position: options.targetState?.position ?? 0,
      ...(motionLatching ? { latch: options.targetState?.latch ?? true } : null),
      ...(speed ? { speed: options.targetState?.speed ?? ThreeLevelAuto.Auto } : null),
    },
    // Resolution and StepValue are percent100ths with a specs constraint of "min 0.01%" (i.e. a minimum value of 1).
    // Default to whole-percent granularity to match the 0%-100% precision exposed by most real closure APIs.
    resolution: Math.max(1, options.resolution ?? 100),
    stepValue: Math.max(1, options.stepValue ?? 100),
    ...(motionLatching ? { latchControlModes: options.latchControlModes ?? { remoteLatching: true, remoteUnlatching: true } } : null),
    movementDuration: options.movementDuration ?? 0,
  };
  if (dimensionType === 'lift') {
    endpoint.behaviors.require(
      MatterbridgeClosureDimensionServer.with(
        ClosureDimension.Feature.Positioning,
        ClosureDimension.Feature.Translation,
        ...(motionLatching ? [ClosureDimension.Feature.MotionLatching] : []),
        ...(speed ? [ClosureDimension.Feature.Speed] : []),
      ),
      {
        ...commonOptions,
        translationDirection: options.translationDirection ?? ClosureDimension.TranslationDirection.Downward,
      },
    );
  } else if (dimensionType === 'tilt') {
    endpoint.behaviors.require(
      MatterbridgeClosureDimensionServer.with(
        ClosureDimension.Feature.Positioning,
        ClosureDimension.Feature.Rotation,
        ...(motionLatching ? [ClosureDimension.Feature.MotionLatching] : []),
        ...(speed ? [ClosureDimension.Feature.Speed] : []),
      ),
      {
        ...commonOptions,
        rotationAxis: options.rotationAxis ?? ClosureDimension.RotationAxis.CenteredHorizontal,
        overflow: options.overflow ?? ClosureDimension.Overflow.NoOverflow,
      },
    );
  } else {
    // this branch handles modulation
    endpoint.behaviors.require(
      MatterbridgeClosureDimensionServer.with(
        ClosureDimension.Feature.Positioning,
        ClosureDimension.Feature.Modulation,
        ...(motionLatching ? [ClosureDimension.Feature.MotionLatching] : []),
        ...(speed ? [ClosureDimension.Feature.Speed] : []),
      ),
      {
        ...commonOptions,
        modulationType: options.modulationType ?? ClosureDimension.ModulationType.SlatsOrientation,
      },
    );
  }

  return endpoint;
}
