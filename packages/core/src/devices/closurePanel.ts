/**
 * @file packages/core/src/devices/closurePanel.ts
 * @description Closure Panel device class exposing the Matter 1.5 ClosureDimension cluster.
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
/* oxlint-disable typescript/no-namespace */

// @matter
import type { MaybePromise } from '@matter/general';
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
    device.log.info(`SetTarget (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Always forward the command to the Matterbridge command handler without validation to allow for external control of the closure.
    await device.commandHandler.executeHandler('ClosureDimension.setTarget', {
      command: 'setTarget',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    // 5.5.8.1. SetTarget Command
    // The Position, Latch, and Speed fields are all O.a+ (choice group 'a', at least one required): a SetTarget with
    // none of them present violates that choice conformance, so a status code of INVALID_COMMAND SHALL be returned.
    if (request.position === undefined && request.latch === undefined && request.speed === undefined) {
      throw new StatusResponse.InvalidCommandError('ClosureDimension.setTarget requires at least one of position, latch, or speed to be present');
    }
    // 5.5.8.1.1. Position Field
    // percent100ths is constrained to the range 0-10000: a Position field outside that range SHALL return CONSTRAINT_ERROR.
    if (request.position !== undefined && (request.position < 0 || request.position > 10000)) {
      throw new StatusResponse.ConstraintErrorError('ClosureDimension.setTarget position must be between 0 and 10000');
    }
    const hasSupportedField =
      request.position !== undefined || (this.features.motionLatching && request.latch !== undefined) || (this.features.speed && request.speed !== undefined);
    if (!hasSupportedField) return;

    // 5.5.8.1.2. Latch Field
    // The Latch field is a bool, so every decoded value is within constraints: no CONSTRAINT_ERROR is possible for this field.
    // If the server supports the MotionLatching (LT) feature, it SHALL either fulfill the latch request and update
    // TargetState.Latch, or - if the LatchControlModes attribute specifies that manual intervention is required to
    // latch - respond with INVALID_IN_STATE and remain in its current state.
    const latchControlModes = this.state.latchControlModes;
    if (
      this.features.motionLatching &&
      request.latch !== undefined &&
      ((request.latch && !latchControlModes?.remoteLatching) || (!request.latch && !latchControlModes?.remoteUnlatching))
    ) {
      throw new StatusResponse.InvalidInStateError('ClosureDimension.setTarget latch change requires manual intervention per LatchControlModes');
    }

    // 5.5.8.1.3. Speed Field
    // ThreeLevelAutoEnum only defines Auto, Low, Medium and High: a Speed field outside that range SHALL return CONSTRAINT_ERROR.
    if (this.features.speed && request.speed !== undefined && (request.speed < ThreeLevelAuto.Auto || request.speed > ThreeLevelAuto.High)) {
      throw new StatusResponse.ConstraintErrorError('ClosureDimension.setTarget speed must be a valid ThreeLevelAutoEnum value');
    }

    // 5.5.8.1.4. Effect on Receipt
    // If this command is received while the MainState attribute of the Closure Control Cluster that is associated
    // with this cluster (the ClosureControl cluster on the parent Closure endpoint) has any of the following
    // values: Disengaged, Protected, Calibrating, SetupRequired, or Error, then a status code of INVALID_IN_STATE
    // SHALL be returned.
    const associatedMainState = this.endpoint.owner?.maybeStateOf(ClosureControlServer)?.mainState;
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
        'ClosureDimension.setTarget is not allowed while the associated ClosureControl is Disengaged, Protected, Calibrating, SetupRequired, or Error',
      );
    }

    // If the Positioning (PS) feature and the MotionLatching (LT) feature are supported, and the command requests a
    // position change, then if the Latch field of the CurrentState attribute is True (Latched) and the Latch field
    // in this command is either not present or not explicitly set to False (Unlatched), a status code of
    // INVALID_IN_STATE SHALL be returned.
    const currentState = this.state.currentState;
    if (this.features.motionLatching && request.position !== undefined && currentState?.latch === true && request.latch !== false) {
      throw new StatusResponse.InvalidInStateError('ClosureDimension.setTarget position changes require latch false while the closure is latched');
    }

    const previousTarget = this.state.targetState ?? {};
    const resolution: number = this.state.resolution;
    const nextTarget = {
      ...previousTarget,
      // If a new position value is requested, the closure SHALL set the Position field of the TargetState attribute
      // to the nearest valid position, i.e. an integer multiple of the Resolution attribute.
      ...(request?.position !== undefined ? { position: Math.round(request.position / resolution) * resolution } : null),
      ...(this.features.motionLatching && request?.latch !== undefined ? { latch: request.latch } : null),
      ...(this.features.speed ? { speed: request?.speed ?? ThreeLevelAuto.Auto } : null),
    };

    // If all field values in the command match the corresponding field values in CurrentState, the command SHALL
    // have no effect.
    const matchesCurrentState =
      currentState !== null &&
      (nextTarget.position === undefined || nextTarget.position === currentState.position) &&
      (!this.features.motionLatching || nextTarget.latch === undefined || nextTarget.latch === currentState.latch) &&
      (!this.features.speed || nextTarget.speed === currentState.speed);
    if (matchesCurrentState) return;

    this.state.targetState = nextTarget;
    this.scheduleMovement(nextTarget, currentState);
  };

  override step = async (request: ClosureDimension.StepRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Step (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Always forward the command to the Matterbridge command handler without validation to allow for external control of the closure.
    await device.commandHandler.executeHandler('ClosureDimension.step', {
      command: 'step',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    // 5.5.8.2.1. Direction Field
    // StepDirectionEnum only defines Decrease and Increase: a Direction field outside that range SHALL return CONSTRAINT_ERROR.
    if (request.direction < ClosureDimension.StepDirection.Decrease || request.direction > ClosureDimension.StepDirection.Increase) {
      throw new StatusResponse.ConstraintErrorError('ClosureDimension.step direction must be a valid StepDirectionEnum value');
    }

    // 5.5.8.2.2. NumberOfSteps Field
    // NumberOfSteps is constrained to be at least 1: a NumberOfSteps of 0 SHALL return CONSTRAINT_ERROR.
    if (request.numberOfSteps < 1) {
      throw new StatusResponse.ConstraintErrorError('ClosureDimension.step numberOfSteps must be at least 1');
    }

    // 5.5.8.2.3. Speed Field
    // ThreeLevelAutoEnum only defines Auto, Low, Medium and High: a Speed field outside that range SHALL return CONSTRAINT_ERROR.
    if (this.features.speed && request.speed !== undefined && (request.speed < ThreeLevelAuto.Auto || request.speed > ThreeLevelAuto.High)) {
      throw new StatusResponse.ConstraintErrorError('ClosureDimension.step speed must be a valid ThreeLevelAutoEnum value');
    }

    // 5.5.8.2.4. Effect on Receipt
    // If this command is received while the Latch field of the CurrentState attribute is True (Latched), a status
    // code of INVALID_IN_STATE SHALL be returned.
    const currentState = this.state.currentState;
    if (this.features.motionLatching && currentState?.latch === true) {
      throw new StatusResponse.InvalidInStateError('ClosureDimension.step is not allowed while the closure is latched');
    }

    // If this command is received while the MainState attribute of the Closure Control Cluster that is associated
    // with this cluster (the ClosureControl cluster on the parent Closure endpoint) has any of the following
    // values: Disengaged, Protected, Calibrating, SetupRequired, or Error, then a status code of INVALID_IN_STATE
    // SHALL be returned.
    const associatedMainState = this.endpoint.owner?.maybeStateOf(ClosureControlServer)?.mainState;
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
        'ClosureDimension.step is not allowed while the associated ClosureControl is Disengaged, Protected, Calibrating, SetupRequired, or Error',
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
    nextPosition = Math.max(0, Math.min(10000, nextPosition));

    const previousTarget = this.state.targetState ?? {};
    const nextTarget = {
      ...previousTarget,
      position: nextPosition,
      ...(this.features.speed && request.speed !== undefined ? { speed: request.speed } : null),
    };
    this.state.targetState = nextTarget;
    this.scheduleMovement(nextTarget, currentState);
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
  private scheduleMovement(targetState: ClosureDimension.DimensionState, currentState: ClosureDimension.DimensionState | null): void {
    // Cancel any movement still in flight from a previous command before (re)scheduling.
    clearTimeout(this.internal.movementTimer);
    if (currentState === null || this.state.movementDuration <= 0) {
      this.internal.movementTimer = undefined;
      return;
    }
    // Captured now because `this.state` can no longer be read once this command's transaction context has exited.
    const previousState = currentState;
    this.internal.movementTimer = setTimeout(() => {
      this.internal.movementTimer = undefined;
      void this.completeMovement(targetState, previousState);
    }, this.state.movementDuration);
  }

  /**
   * Simulates a SetTarget/Step movement completing: updates the `currentState` attribute to match `targetState`.
   *
   * @param {ClosureDimension.DimensionState} targetState - The target state the movement was simulating reaching.
   * @param {ClosureDimension.DimensionState} previousState - The `currentState` captured when the movement was scheduled.
   * @returns {Promise<void>} Resolves once the resulting attribute has been updated.
   */
  private completeMovement = async (targetState: ClosureDimension.DimensionState, previousState: ClosureDimension.DimensionState): Promise<void> => {
    const endpoint = this.endpoint as MatterbridgeEndpoint;
    // setTarget()/step() always carry Position/Latch/Speed through to targetState explicitly (each inherited
    // from the constructor's own non-null defaults when a command omits it), so the `?? previousState.*`
    // fallbacks below are unreachable through the public command surface — kept only as a defensive guard
    // against a manually-cleared state.
    /* v8 ignore next 3 */
    const position = targetState.position ?? previousState.position;
    const latch = targetState.latch ?? previousState.latch;
    const speed = targetState.speed ?? previousState.speed;
    await endpoint.setAttribute(ClosureDimensionServer, 'currentState', {
      position,
      ...(this.features.motionLatching ? { latch } : null),
      ...(this.features.speed ? { speed } : null),
    });
  };
}

/* v8 ignore start */
export namespace MatterbridgeClosureDimensionServer {
  export class Internal extends MatterbridgeClosureDimensionServerBase.Internal {
    /** Pending timer that simulates completion of an in-progress SetTarget/Step; cancelled by Stop or a new SetTarget/Step. */
    movementTimer?: NodeJS.Timeout;
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
