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

// @matter
import { ClosureControlServer } from '@matter/node/behaviors/closure-control';
import { ClosureDimensionServer } from '@matter/node/behaviors/closure-dimension';
import { StatusResponse } from '@matter/types';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
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
 * A lift panel (e.g. a blind sliding up/down) uses `'lift'`, a tilt panel (e.g. slats rotating) uses `'tilt'`,
 * and any other panel that modulates a flow level without translating or rotating (e.g. an opacity or
 * ventilation panel) uses `'modulation'`.
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
 * Declares Positioning, MotionLatching and Speed at the class level so the command handlers below get typed
 * access to the MotionLatching-only LatchControlModes attribute and the Speed-only fields of DimensionState,
 * mirroring how {@link MatterbridgeClosureControlServer} always declares Calibration. MotionLatching and Speed
 * are `optionalConform` in the Matter 1.5 data model (not implied by Positioning), so {@link createClosureDimensionClusterServer}
 * requires this server with a narrower `.with(...)` feature set per panel when a panel opts out of one or both -
 * the class itself is not what gates a feature off, `require()` is. Code below that touches a MotionLatching- or
 * Speed-only element still guards on `this.features.motionLatching` / `this.features.speed` because those
 * elements are absent from `this.state` at runtime when the panel was required without the feature, even though
 * this class's declared type always knows about them.
 */
export class MatterbridgeClosureDimensionServer extends MatterbridgeClosureDimensionServerBase {
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

    // 5.5.8.1.2. Latch Field
    // The Latch field is a bool, so every decoded value is within constraints: no CONSTRAINT_ERROR is possible for this field.
    // If the server supports the MotionLatching (LT) feature, it SHALL either fulfill the latch request and update
    // TargetState.Latch, or - if the LatchControlModes attribute specifies that manual intervention is required to
    // latch - respond with INVALID_IN_STATE and remain in its current state. If MotionLatching is not supported,
    // latchControlModes is undefined and a Latch field in the request (which conformant peers won't send without
    // the feature) falls through to the same INVALID_IN_STATE response below.
    // The LatchControlModes attribute only exists on the actual cluster when the panel was required with the
    // MotionLatching feature (see the class doc comment), so this still guards on `this.features.motionLatching`
    // even though `this.state.latchControlModes` is typed as always present.
    const latchControlModes = this.features.motionLatching ? this.state.latchControlModes : undefined;
    if (request.latch !== undefined && ((request.latch && !latchControlModes?.remoteLatching) || (!request.latch && !latchControlModes?.remoteUnlatching))) {
      throw new StatusResponse.InvalidInStateError('ClosureDimension.setTarget latch change requires manual intervention per LatchControlModes');
    }

    // 5.5.8.1.3. Speed Field
    // ThreeLevelAutoEnum only defines Auto, Low, Medium and High: a Speed field outside that range SHALL return CONSTRAINT_ERROR.
    if (request.speed !== undefined && (request.speed < ThreeLevelAuto.Auto || request.speed > ThreeLevelAuto.High)) {
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
    if (request.position !== undefined && currentState?.latch === true && request.latch !== false) {
      throw new StatusResponse.InvalidInStateError('ClosureDimension.setTarget position changes require latch false while the closure is latched');
    }

    const previousTarget = this.state.targetState ?? {};
    const resolution: number = this.state.resolution;
    const nextTarget = {
      ...previousTarget,
      // If a new position value is requested, the closure SHALL set the Position field of the TargetState attribute
      // to the nearest valid position, i.e. an integer multiple of the Resolution attribute.
      ...(request?.position !== undefined ? { position: Math.round(request.position / resolution) * resolution } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      // The Speed field of DimensionState is mandatoryConform SP: only set it when the Speed feature is supported,
      // otherwise the runtime conformance validator rejects the write.
      ...(this.features.speed ? { speed: request?.speed ?? ThreeLevelAuto.Auto } : null),
    };

    // If all field values in the command match the corresponding field values in CurrentState, the command SHALL
    // have no effect.
    const matchesCurrentState =
      currentState !== null &&
      (nextTarget.position === undefined || nextTarget.position === currentState.position) &&
      (nextTarget.latch === undefined || nextTarget.latch === currentState.latch) &&
      nextTarget.speed === currentState.speed;
    if (matchesCurrentState) return;

    this.state.targetState = nextTarget;
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
    if (request.speed !== undefined && (request.speed < ThreeLevelAuto.Auto || request.speed > ThreeLevelAuto.High)) {
      throw new StatusResponse.ConstraintErrorError('ClosureDimension.step speed must be a valid ThreeLevelAutoEnum value');
    }

    // 5.5.8.2.4. Effect on Receipt
    // If this command is received while the Latch field of the CurrentState attribute is True (Latched), a status
    // code of INVALID_IN_STATE SHALL be returned.
    const currentState = this.state.currentState;
    if (currentState?.latch === true) {
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
    this.state.targetState = {
      ...previousTarget,
      position: nextPosition,
      ...(request.speed !== undefined ? { speed: request.speed } : null),
    };
  };
}

export interface ClosurePanelOptions {
  /** Initial current state. Defaults to latched and fully closed. */
  currentState?: ClosureDimension.DimensionState;
  /** Initial target state. Defaults to latched and fully closed. */
  targetState?: ClosureDimension.DimensionState;
  /** Position resolution of the ClosureDimension cluster. Constrained by the specs to a minimum of 1 (0.01%). Defaults to 1. */
  resolution?: number;
  /** Number of units moved for each Step command. Constrained by the specs to a minimum of 1 (0.01%). Defaults to 1. */
  stepValue?: number;
  /** Enable the ClosureDimension MotionLatching (LT) feature, so the panel can be secured to a position/state via a latch. Defaults to true. */
  motionLatching?: boolean;
  /** Supported remote latch control modes. Only used when `motionLatching` is true. Defaults to latching and unlatching enabled. */
  latchControlModes?: ClosureDimension.LatchControlModes;
  /** Enable the ClosureDimension Speed (SP) feature, so the panel's motion speed can be throttled. Defaults to true. */
  speed?: boolean;
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
  const motionLatching = options.motionLatching ?? true;
  const speed = options.speed ?? true;

  // The Latch and Speed fields of DimensionState are each mandatoryConform on their own feature (Matter 1.5 data
  // model): matter.js's runtime conformance validator rejects a currentState/targetState carrying either field
  // when the corresponding feature is disabled, so the defaults below only include the fields the enabled
  // features actually support. Built as two separate object literals (rather than one shared default reused for
  // both attributes) so currentState and targetState never end up aliasing the same object.
  const commonOptions = {
    currentState: options.currentState ?? { position: 0, ...(motionLatching ? { latch: true } : {}), ...(speed ? { speed: ThreeLevelAuto.Auto } : {}) },
    targetState: options.targetState ?? { position: 0, ...(motionLatching ? { latch: true } : {}), ...(speed ? { speed: ThreeLevelAuto.Auto } : {}) },
    // Resolution and StepValue are percent100ths with a specs constraint of "min 0.01%" (i.e. a minimum value of 1).
    resolution: Math.max(1, options.resolution ?? 1),
    stepValue: Math.max(1, options.stepValue ?? 1),
  };

  // The LatchControlModes attribute only exists on the cluster when MotionLatching is supported, so it's only
  // added to the initial state passed to `behaviors.require()` in that case: including it unconditionally in
  // `commonOptions` above would pass an initial-state property the `motionLatching: false` branches' server class
  // below does not declare.
  if (motionLatching) {
    const motionLatchingOptions = { ...commonOptions, latchControlModes: options.latchControlModes ?? { remoteLatching: true, remoteUnlatching: true } };
    if (dimensionType === 'lift') {
      endpoint.behaviors.require(
        MatterbridgeClosureDimensionServer.with(
          ClosureDimension.Feature.Positioning,
          ClosureDimension.Feature.MotionLatching,
          ClosureDimension.Feature.Translation,
          ...(speed ? [ClosureDimension.Feature.Speed] : []),
        ),
        { ...motionLatchingOptions, translationDirection: options.translationDirection ?? ClosureDimension.TranslationDirection.Downward },
      );
    } else if (dimensionType === 'tilt') {
      endpoint.behaviors.require(
        MatterbridgeClosureDimensionServer.with(
          ClosureDimension.Feature.Positioning,
          ClosureDimension.Feature.MotionLatching,
          ClosureDimension.Feature.Rotation,
          ...(speed ? [ClosureDimension.Feature.Speed] : []),
        ),
        {
          ...motionLatchingOptions,
          rotationAxis: options.rotationAxis ?? ClosureDimension.RotationAxis.CenteredHorizontal,
          overflow: options.overflow ?? ClosureDimension.Overflow.NoOverflow,
        },
      );
    } else {
      endpoint.behaviors.require(
        MatterbridgeClosureDimensionServer.with(
          ClosureDimension.Feature.Positioning,
          ClosureDimension.Feature.MotionLatching,
          ClosureDimension.Feature.Modulation,
          ...(speed ? [ClosureDimension.Feature.Speed] : []),
        ),
        { ...motionLatchingOptions, modulationType: options.modulationType ?? ClosureDimension.ModulationType.SlatsOrientation },
      );
    }
  } else {
    if (dimensionType === 'lift') {
      endpoint.behaviors.require(
        MatterbridgeClosureDimensionServer.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Translation, ...(speed ? [ClosureDimension.Feature.Speed] : [])),
        { ...commonOptions, translationDirection: options.translationDirection ?? ClosureDimension.TranslationDirection.Downward },
      );
    } else if (dimensionType === 'tilt') {
      endpoint.behaviors.require(
        MatterbridgeClosureDimensionServer.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Rotation, ...(speed ? [ClosureDimension.Feature.Speed] : [])),
        {
          ...commonOptions,
          rotationAxis: options.rotationAxis ?? ClosureDimension.RotationAxis.CenteredHorizontal,
          overflow: options.overflow ?? ClosureDimension.Overflow.NoOverflow,
        },
      );
    } else {
      endpoint.behaviors.require(
        MatterbridgeClosureDimensionServer.with(ClosureDimension.Feature.Positioning, ClosureDimension.Feature.Modulation, ...(speed ? [ClosureDimension.Feature.Speed] : [])),
        { ...commonOptions, modulationType: options.modulationType ?? ClosureDimension.ModulationType.SlatsOrientation },
      );
    }
  }

  return endpoint;
}
