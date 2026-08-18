/**
 * @file packages/core/src/devices/closure.ts
 * @description Closure device class exposing the Matter 1.5 ClosureControl cluster.
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
import { ClosureTag } from '@matter/node';
import { ClosureControlServer } from '@matter/node/behaviors/closure-control';
import { type EndpointNumber, StatusResponse } from '@matter/types';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { Identify } from '@matter/types/clusters/identify';
import type { Semtag } from '@matter/types/globals';
import { ThreeLevelAuto } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { closure, closurePanel, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { getSemtag } from '../matterbridgeEndpointHelpers.js';
import { createClosureDimensionClusterServer, type ClosureDimensionType, type ClosurePanelOptions } from './closurePanel.js';

/**
 * ClosureControl server that forwards MoveTo/Stop commands to the Matterbridge command handler.
 */
export class MatterbridgeClosureControlServer extends ClosureControlServer.with(
  ClosureControl.Feature.Positioning,
  ClosureControl.Feature.MotionLatching,
  ClosureControl.Feature.Speed,
) {
  override moveTo = async (request: ClosureControl.MoveToRequest): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MoveTo (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Always forward the command to the Matterbridge command handler without validation to allow for external control of the closure.
    await device.commandHandler.executeHandler('ClosureControl.moveTo', {
      command: 'moveTo',
      request,
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    // 5.4.8.2. MoveTo Command
    // The Position, Latch, and Speed fields are all O.a+ (choice group 'a', at least one required): a MoveTo with
    // none of them present violates that choice conformance, so a status code of INVALID_COMMAND SHALL be returned.
    if (request.position === undefined && request.latch === undefined && request.speed === undefined) {
      throw new StatusResponse.InvalidCommandError('ClosureControl.moveTo requires at least one of position, latch, or speed to be present');
    }
    // 5.4.8.2.4. Effect on Receipt
    // If this command is received in any state other than Moving, WaitingForMotion, or Stopped, a status code of INVALID_IN_STATE SHALL be returned.
    if (![ClosureControl.MainState.Moving, ClosureControl.MainState.WaitingForMotion, ClosureControl.MainState.Stopped].includes(this.state.mainState)) {
      throw new StatusResponse.InvalidInStateError('ClosureControl.moveTo is only allowed while Moving, WaitingForMotion, or Stopped');
    }
    // 5.4.8.2.4. Effect on Receipt
    // If this command requests a position change while the Latch field of the OverallCurrentState attribute is True (Latched),
    // and the Latch field of this command is not set to False (Unlatched), a status code of INVALID_IN_STATE SHALL be returned.
    let currentState = this.state.overallCurrentState;
    if (currentState?.latch === true && request.position !== undefined && request.latch !== false) {
      throw new StatusResponse.InvalidInStateError('ClosureControl.moveTo position changes require latch false while the closure is latched');
    }

    const previousTarget = this.state.overallTargetState ?? {};
    const nextTarget = {
      ...previousTarget,
      // 5.4.8.2.1. Position Field
      ...(request?.position !== undefined ? { position: request.position } : null),
      // 5.4.8.2.2. Latch Field
      ...(request?.latch !== undefined ? { latch: request.latch } : null),
      // 5.4.8.2.3. Speed Field
      speed: request?.speed ?? ThreeLevelAuto.Auto,
    };
    this.state.overallTargetState = nextTarget;

    // If the closure supports the Speed(SP) feature, it SHALL set the Speed field of the OverallCurrentState attribute to the new speed.
    if (currentState !== null) {
      currentState = { ...currentState, speed: nextTarget.speed };
      this.state.overallCurrentState = currentState;
    }

    // If all field values in the command match the corresponding field values in OverallCurrentState Attribute,
    // the MainState Attribute SHALL be set to Stopped, and no further action SHALL be taken.
    // If the closure is not able to move e.g. due to power limitation, the MainState attribute SHALL be
    // set to WaitingForMotion, else the MainState Attribute SHALL be set to Moving.
    const isAtTarget =
      currentState !== null &&
      (nextTarget.position === undefined || nextTarget.position === currentState.position) &&
      (nextTarget.latch === undefined || nextTarget.latch === currentState.latch) &&
      nextTarget.speed === currentState.speed;
    this.state.mainState = isAtTarget ? ClosureControl.MainState.Stopped : ClosureControl.MainState.Moving;
  };

  override stop = async (): Promise<void> => {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Always forward the command to the Matterbridge command handler without validation to allow for external control of the closure.
    await device.commandHandler.executeHandler('ClosureControl.stop', {
      command: 'stop',
      request: {},
      cluster: ClosureControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ClosureControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

    // 5.4.8.1. Stop Command
    // If MainState has one of Moving, WaitingForMotion, or Calibrating, any motions SHALL be stopped and MainState
    // SHALL be set to Stopped. A status code of SUCCESS SHALL always be returned, regardless of MainState.
    if ([ClosureControl.MainState.Moving, ClosureControl.MainState.WaitingForMotion, ClosureControl.MainState.Calibrating].includes(this.state.mainState)) {
      this.state.mainState = ClosureControl.MainState.Stopped;
    }
  };
}

export interface ClosureOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Initial ClosureControl countdown time, in seconds. Defaults to 0 for a completed safe state. */
  countdownTime?: number;
  /** Initial ClosureControl main state. Defaults to stopped. */
  mainState?: ClosureControl.MainState;
  /** Initial ClosureControl error list. Defaults to an empty list. */
  currentErrorList?: ClosureControl.ClosureError[];
  /** Initial current state. Defaults to secure, latched, and fully closed. */
  overallCurrentState?: ClosureControl.OverallCurrentState;
  /** Initial target state. Defaults to latched and fully closed. */
  overallTargetState?: ClosureControl.OverallTargetState;
  /** Supported remote latch control modes. Defaults to latching and unlatching enabled. */
  latchControlModes?: ClosureControl.LatchControlModes;
  /**
   * The unique storage key for the endpoint.
   * If not provided, a default key will be used.
   */
  id?: string;
  /**
   * The endpoint number for the endpoint.
   * If not provided, the endpoint will be created with the next available endpoint number.
   * If provided, the endpoint will be created with the specified endpoint number.
   */
  number?: EndpointNumber;
  /**
   * Semantic tags for endpoint disambiguation. Defaults to the Closure Covering tag.
   *
   * A Closure SHALL use exactly one semantic tag from the Closure namespace (0x44) in the TagList attribute
   * of the Descriptor cluster to describe the primary function of the device (e.g. "Covering", "Window", "Barrier", "Cabinet", "Gate", "GarageDoor", "Door").
   * Semantic tags from the Closure Covering (0x46), Closure Window (0x47) and Closure Cabinet (0x48) namespaces,
   * in addition to the Common namespaces, MAY be used to convey additional configuration information.
   */
  tagList?: Semtag[];
}

/**
 * Matterbridge endpoint representing a closure device.
 */
export class Closure extends MatterbridgeEndpoint {
  /**
   * Creates a Closure endpoint and configures the ClosureControl cluster.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {ClosureOptions} options - Endpoint options and initial cluster state values. Defaults to a fully closed, latched, and secure state with no errors.
   */
  constructor(name: string, serial: string, options: ClosureOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
      countdownTime = 0,
      mainState = ClosureControl.MainState.Stopped,
      currentErrorList = [],
      overallCurrentState = {
        position: ClosureControl.CurrentPosition.FullyClosed,
        latch: true,
        speed: ThreeLevelAuto.Auto,
        secureState: true,
      },
      overallTargetState = {
        position: ClosureControl.TargetPosition.MoveToFullyClosed,
        latch: true,
        speed: ThreeLevelAuto.Auto,
      },
      latchControlModes = { remoteLatching: true, remoteUnlatching: true },
      id,
      number,
      tagList = [getSemtag(ClosureTag.Covering)],
    } = options;
    super(powerSourceType === 'None' ? [closure] : [closure, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
    });

    this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure');
    switch (powerSourceType) {
      case 'Rechargeable':
        this.createDefaultPowerSourceRechargeableBatteryClusterServer();
        break;
      case 'Replaceable':
        this.createDefaultPowerSourceReplaceableBatteryClusterServer();
        break;
      case 'Battery':
        this.createDefaultPowerSourceBatteryClusterServer();
        break;
      case 'Wired':
        this.createDefaultPowerSourceWiredClusterServer();
        break;
      case 'None':
        break;
      // No default
    }

    this.behaviors.require(MatterbridgeClosureControlServer, {
      countdownTime,
      mainState,
      currentErrorList,
      overallCurrentState,
      overallTargetState,
      latchControlModes,
    });
  }

  /**
   * Gets the ClosureControl `mainState` attribute.
   *
   * @returns {ClosureControl.MainState | undefined} Current main state.
   */
  getMainState(): ClosureControl.MainState | undefined {
    return this.getAttribute(ClosureControlServer, 'mainState');
  }

  /**
   * Sets the ClosureControl state attributes with the supplied current and target states.
   *
   * @param {ClosureControl.OverallCurrentState} currentState - Current closure state to expose.
   * @param {ClosureControl.OverallTargetState} targetState - Target closure state to expose.
   * @param {ClosureControl.MainState} [mainState] - Main state to expose. Defaults to Stopped.
   * @param {number} [countdownTime] - Countdown time in seconds. Defaults to 0.
   * @param {ClosureControl.ClosureError[]} [currentErrorList] - Current error list to expose. Defaults to an empty list.
   * @returns {Promise<void>} Resolves when all required ClosureControl state attributes have been updated.
   */
  async setState(
    currentState: ClosureControl.OverallCurrentState,
    targetState: ClosureControl.OverallTargetState,
    mainState: ClosureControl.MainState = ClosureControl.MainState.Stopped,
    countdownTime = 0,
    currentErrorList: ClosureControl.ClosureError[] = [],
  ): Promise<void> {
    await this.setAttribute(ClosureControl, 'countdownTime', countdownTime);
    await this.setAttribute(ClosureControl, 'mainState', mainState);
    await this.setAttribute(ClosureControl, 'currentErrorList', currentErrorList);
    await this.setAttribute(ClosureControl, 'overallCurrentState', currentState);
    await this.setAttribute(ClosureControl, 'overallTargetState', targetState);
  }

  /**
   * Sets the ClosureControl attributes to a fully closed, latched, and secure state.
   *
   * @returns {Promise<void>} Resolves when all required ClosureControl attributes have been updated.
   */
  async setFullyClosed(): Promise<void> {
    await this.setState(
      {
        position: ClosureControl.CurrentPosition.FullyClosed,
        latch: true,
        speed: ThreeLevelAuto.Auto,
        secureState: true,
      },
      {
        position: ClosureControl.TargetPosition.MoveToFullyClosed,
        latch: true,
        speed: ThreeLevelAuto.Auto,
      },
    );
  }

  /**
   * Sets the ClosureControl attributes to a fully opened, unlatched, and unsecured state.
   *
   * @returns {Promise<void>} Resolves when all required ClosureControl attributes have been updated.
   */
  async setFullOpened(): Promise<void> {
    await this.setState(
      {
        position: ClosureControl.CurrentPosition.FullyOpened,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      },
      {
        position: ClosureControl.TargetPosition.MoveToFullyOpen,
        latch: false,
        speed: ThreeLevelAuto.Auto,
      },
    );
  }

  /**
   * Sets the ClosureControl attributes to a partially opened, unlatched, and unsecured state.
   *
   * @returns {Promise<void>} Resolves when all required ClosureControl attributes have been updated.
   */
  async setPartiallyOpened(): Promise<void> {
    await this.setState(
      {
        position: ClosureControl.CurrentPosition.PartiallyOpened,
        latch: false,
        speed: ThreeLevelAuto.Auto,
        secureState: false,
      },
      {
        position: null,
        latch: false,
        speed: ThreeLevelAuto.Auto,
      },
    );
  }

  /**
   * Sets the `mainState`/`currentErrorList` attributes to Error and emits a ClosureControl OperationalError event.
   *
   * @remarks
   * Per Matter spec §5.4.9.1, a closure that generates this event SHALL also set the `MainState` attribute to
   * Error, indicating an error condition.
   *
   * @param {ClosureControl.ClosureError[]} [errorState] - The list of active closure errors to report. Defaults to an empty list.
   * @returns {Promise<void>} Resolves when the attributes have been updated and the event has been emitted.
   */
  async triggerOperationalError(errorState: ClosureControl.ClosureError[] = []): Promise<void> {
    await this.setAttribute(ClosureControl, 'mainState', ClosureControl.MainState.Error);
    await this.setAttribute(ClosureControl, 'currentErrorList', errorState);
    await this.triggerEvent(ClosureControl, 'operationalError', { errorState });
  }

  /**
   * Emits a ClosureControl MovementCompleted event.
   *
   * @remarks
   * Per Matter spec §5.4.9.2, this event SHALL be generated when the overall operation ends, either successfully or
   * otherwise, for example upon completion of a movement operation.
   *
   * @returns {Promise<void>} Resolves when the event has been emitted.
   */
  async triggerMovementCompleted(): Promise<void> {
    // oxlint-disable-next-line unicorn/no-useless-undefined
    await this.triggerEvent(ClosureControl, 'movementCompleted', undefined);
  }

  /**
   * Emits a ClosureControl SecureStateChanged event.
   *
   * @remarks
   * Per Matter spec §5.4.9.4, this event SHALL be generated when the SecureState field in the
   * `overallCurrentState` attribute changes.
   *
   * @param {boolean} secureValue - True when the closure is in a secure state (unauthorized access not possible), false when it is insecure.
   * @returns {Promise<void>} Resolves when the event has been emitted.
   */
  async triggerSecureStateChanged(secureValue: boolean): Promise<void> {
    await this.triggerEvent(ClosureControl, 'secureStateChanged', { secureValue });
  }

  /**
   * Adds a closure panel as a child endpoint of this closure and configures its ClosureDimension cluster.
   *
   * @remarks
   * Use this to compose a closure out of one or more independently controlled panels, for example a venetian
   * blind with a `ClosurePanelTag.Lift` panel and a `ClosurePanelTag.Tilt` panel.
   *
   * A Closure Panel SHALL use exactly one semantic tag from the ClosurePanel namespace (0x45) in
   * the TagList attribute of the Descriptor cluster to describe the spatial aspect of the dimension, e.g.,
   * "Lift", "Tilt", etc.
   *
   * The TagList in the Descriptor cluster of an endpoint with this device type SHALL meet the following constraints:
   * • There SHALL be exactly one tag from the ClosurePanel namespace (namespace 0x45).
   * • There SHALL NOT be any tag from the Closure namespace (namespace 0x44).
   *
   * @param {string} name - Human-readable name of the panel endpoint.
   * @param {Semtag[]} tagList - The Closure Panel tagList (0x45) used to disambiguate the panel (e.g. `ClosurePanelTag.Lift`, `ClosurePanelTag.Tilt`, `ClosurePanelTag.Sliding`, `ClosurePanelTag.Rotate`).
   * @param {ClosureDimensionType} dimensionType - Which mutually exclusive motion feature the panel supports: `lift` (ClosureDimension.Feature.Translation), `tilt` (ClosureDimension.Feature.Rotation) or `modulation` (ClosureDimension.Feature.Modulation).
   * @param {ClosurePanelOptions} [options] - Optional initial ClosureDimension cluster state values.
   * @returns {MatterbridgeEndpoint} The created closure panel endpoint.
   */
  addPanel(name: string, tagList: Semtag[], dimensionType: ClosureDimensionType, options: ClosurePanelOptions = {}): MatterbridgeEndpoint {
    const panel = this.addChildDeviceType(name, closurePanel, { tagList });

    createClosureDimensionClusterServer(panel, dimensionType, options);

    return panel;
  }
}
