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
import { ClosureDimensionServer } from '@matter/node/behaviors/closure-dimension';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import type { Semtag } from '@matter/types/globals';
import { ThreeLevelAuto } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { closurePanel } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
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

/**
 * ClosureDimension server that forwards SetTarget/Step commands to the Matterbridge command handler. Supports
 * Positioning, MotionLatching and Speed.
 */
export class MatterbridgeClosureDimensionServer extends ClosureDimensionServer.with(
  ClosureDimension.Feature.Positioning,
  ClosureDimension.Feature.MotionLatching,
  ClosureDimension.Feature.Speed,
) {
  override setTarget = async (request: ClosureDimension.SetTargetRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SetTarget (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureDimension.setTarget', {
      command: 'setTarget',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    const previousTarget = this.state.targetState ?? {};
    const nextTarget = {
      ...previousTarget,
      ...(request?.position !== undefined ? { position: request.position } : null),
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      speed: request?.speed ?? ThreeLevelAuto.Auto,
    };
    this.state.targetState = nextTarget;
  };

  override step = async (request: ClosureDimension.StepRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Step (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ClosureDimension.step', {
      command: 'step',
      request,
      cluster: ClosureDimensionServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureDimension)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    const stepValue: number = this.state.stepValue;
    const numberOfSteps: number = request.numberOfSteps;
    const delta = stepValue * numberOfSteps;
    const isIncrease = request.direction === ClosureDimension.StepDirection.Increase;

    const previousCurrent = this.state.currentState ?? {};
    const previousTarget = this.state.targetState ?? {};
    const currentPosition: number =
      typeof previousCurrent.position === 'number' ? previousCurrent.position : typeof previousTarget.position === 'number' ? previousTarget.position : 0;

    let nextPosition = isIncrease ? currentPosition + delta : currentPosition - delta;
    nextPosition = Math.max(0, Math.min(10000, nextPosition));

    const speed: ThreeLevelAuto = request?.speed ?? previousCurrent.speed ?? previousTarget.speed ?? ThreeLevelAuto.Auto;

    this.state.currentState = {
      ...previousCurrent,
      position: nextPosition,
      speed,
    };

    this.state.targetState = { ...previousTarget, position: nextPosition, speed };
  };
}

export interface ClosurePanelOptions {
  /** Initial current state. Defaults to latched and fully closed. */
  currentState?: ClosureDimension.DimensionState;
  /** Initial target state. Defaults to latched and fully closed. */
  targetState?: ClosureDimension.DimensionState;
  /** Position resolution of the ClosureDimension cluster. Defaults to 1. */
  resolution?: number;
  /** Number of units moved for each Step command. Defaults to 1. */
  stepValue?: number;
  /** Supported remote latch control modes. Defaults to latching and unlatching enabled. */
  latchControlModes?: ClosureDimension.LatchControlModes;
  /** Direction of the translation. Only used when `dimensionType` is `'lift'`. Defaults to Downward. */
  translationDirection?: ClosureDimension.TranslationDirection;
  /** Axis of the rotation. Only used when `dimensionType` is `'tilt'`. Defaults to CenteredHorizontal. */
  rotationAxis?: ClosureDimension.RotationAxis;
  /** Overflow of the rotation. Only used when `dimensionType` is `'tilt'`. Defaults to NoOverflow. */
  overflow?: ClosureDimension.Overflow;
  /** Type of modulation. Only used when `dimensionType` is `'modulation'`. Defaults to SlatsOrientation. */
  modulationType?: ClosureDimension.ModulationType;
  /** Semantic tags used to disambiguate sibling closure panels. */
  tagList?: Semtag[];
}

/**
 * Matterbridge endpoint representing a closure panel device.
 */
export class ClosurePanel extends MatterbridgeEndpoint {
  /**
   * Creates a ClosurePanel endpoint and configures the ClosureDimension cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {ClosureDimensionType} dimensionType - Which mutually exclusive motion feature the panel supports: `'lift'` (Translation), `'tilt'` (Rotation) or `'modulation'`.
   * @param {ClosurePanelOptions} [options] - Optional initial configuration values, including the tagList used to disambiguate sibling panels (e.g. `ClosurePanelTag.Lift` and `ClosurePanelTag.Tilt`).
   */
  constructor(name: string, serial: string, dimensionType: ClosureDimensionType, options: ClosurePanelOptions = {}) {
    super([closurePanel], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, tagList: options.tagList });

    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure Panel');

    createClosureDimensionClusterServer(this, dimensionType, options);
  }
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
  const commonOptions = {
    currentState: options.currentState ?? { position: 0, latch: true, speed: ThreeLevelAuto.Auto },
    targetState: options.targetState ?? { position: 0, latch: true, speed: ThreeLevelAuto.Auto },
    resolution: options.resolution ?? 1,
    stepValue: options.stepValue ?? 1,
    latchControlModes: options.latchControlModes ?? { remoteLatching: true, remoteUnlatching: true },
  };

  if (dimensionType === 'lift') {
    endpoint.behaviors.require(
      MatterbridgeClosureDimensionServer.with(
        ClosureDimension.Feature.Positioning,
        ClosureDimension.Feature.MotionLatching,
        ClosureDimension.Feature.Speed,
        ClosureDimension.Feature.Translation,
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
        ClosureDimension.Feature.MotionLatching,
        ClosureDimension.Feature.Speed,
        ClosureDimension.Feature.Rotation,
      ),
      {
        ...commonOptions,
        rotationAxis: options.rotationAxis ?? ClosureDimension.RotationAxis.CenteredHorizontal,
        overflow: options.overflow ?? ClosureDimension.Overflow.NoOverflow,
      },
    );
  } else {
    endpoint.behaviors.require(
      MatterbridgeClosureDimensionServer.with(
        ClosureDimension.Feature.Positioning,
        ClosureDimension.Feature.MotionLatching,
        ClosureDimension.Feature.Speed,
        ClosureDimension.Feature.Modulation,
      ),
      {
        ...commonOptions,
        modulationType: options.modulationType ?? ClosureDimension.ModulationType.SlatsOrientation,
      },
    );
  }

  return endpoint;
}
