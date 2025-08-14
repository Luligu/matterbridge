/**
 * @description This file contains the Oven class.
 * @file src/devices/oven.ts
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.1.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// Imports from @matter
import { MaybePromise } from '@matter/main';
import { Semtag } from '@matter/types';
import { ModeBase } from '@matter/main/clusters/mode-base';
import { OvenMode } from '@matter/main/clusters/oven-mode';
import { OperationalState } from '@matter/main/clusters/operational-state';
import { OvenModeServer } from '@matter/main/behaviors/oven-mode';
import { OvenCavityOperationalStateServer } from '@matter/main/behaviors/oven-cavity-operational-state';

// Matterbridge
import { oven, powerSource, temperatureControlledCabinetHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';

import { createLevelTemperatureControlClusterServer } from './temperatureControl.js';

export class Oven extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Oven class.
   *
   * @param {string} name - The name of the oven.
   * @param {string} serial - The serial number of the oven.
   *
   * @remarks
   * 13.9 An oven represents a device that contains one or more cabinets, and optionally a single cooktop,
   * that are all capable of heating food. Examples of consumer products implementing this device type
   * include ovens, wall ovens, convection ovens, etc.
   * An oven is always defined via endpoint composition.
   * - Use `addCabinet` to add one or more cabinets to the oven.
   */
  constructor(name: string, serial: string) {
    super([oven, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Oven');
    this.createDefaultPowerSourceWiredClusterServer();
    this.addFixedLabel('composed', 'Oven');
  }

  /**
   * Adds a Temperature Controlled Cabinet Heater to the oven.
   *
   * @param {string} name - The name of the cabinet.
   * @param {Semtag[]} tagList - The tagList associated with the cabinet.
   * @param {number} currentMode - The current mode of the cabinet. Defaults to 2 (which corresponds to 'Convection').
   * @param {OvenMode.ModeOption[]} supportedModes - The supported modes of the cabinet. Defaults to a set of common oven modes.
   * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 1 (which corresponds to 'Warm').
   * @param {string[]} supportedTemperatureLevels - The list of supported temperature levels for the cabinet. Defaults to ['Defrost', '180°', '190°', '200°', '250°', '300°'].
   * @param {OperationalState.OperationalStateEnum} operationalState - The initial operational state of the cabinet. Defaults to Stopped.
   * @param {number} [currentPhase] - Optional: the current phase of the cabinet.
   * @param {string[]} [phaseList] - Optional: the list of phases for the cabinet.
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the cabinet.
   *
   * @remarks
   * 13.4.1 A Temperature Controlled Cabinet Heater is a device that provides a heated space for warming food.
   * It is typically installed within an oven and can be used in conjunction with other heating elements.
   */
  addCabinet(
    name: string,
    tagList: Semtag[],
    currentMode: number = 2,
    supportedModes: OvenMode.ModeOption[] = [
      { label: 'Bake', mode: 1, modeTags: [{ value: OvenMode.ModeTag.Bake }] },
      { label: 'Convection', mode: 2, modeTags: [{ value: OvenMode.ModeTag.Convection }] },
      { label: 'Grill', mode: 3, modeTags: [{ value: OvenMode.ModeTag.Grill }] },
      { label: 'Roast', mode: 4, modeTags: [{ value: OvenMode.ModeTag.Roast }] },
      { label: 'Clean', mode: 5, modeTags: [{ value: OvenMode.ModeTag.Clean }] },
      { label: 'Convection Bake', mode: 6, modeTags: [{ value: OvenMode.ModeTag.ConvectionBake }] },
      { label: 'Convection Roast', mode: 7, modeTags: [{ value: OvenMode.ModeTag.ConvectionRoast }] },
      { label: 'Warming', mode: 8, modeTags: [{ value: OvenMode.ModeTag.Warming }] },
      { label: 'Proofing', mode: 9, modeTags: [{ value: OvenMode.ModeTag.Proofing }] },
      { label: 'Steam', mode: 10, modeTags: [{ value: OvenMode.ModeTag.Steam }] },
    ],
    selectedTemperatureLevel: number = 1,
    supportedTemperatureLevels: string[] = ['Defrost', '180°', '190°', '200°', '250°', '300°'],
    operationalState: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Stopped,
    currentPhase?: number,
    phaseList?: string[],
  ): MatterbridgeEndpoint {
    const cabinet = this.addChildDeviceType(name, temperatureControlledCabinetHeater, { tagList }, true);
    cabinet.log.logName = name;
    cabinet.createDefaultIdentifyClusterServer();
    createLevelTemperatureControlClusterServer(cabinet, selectedTemperatureLevel, supportedTemperatureLevels);
    cabinet.createDefaultTemperatureMeasurementClusterServer(2000);
    this.createDefaultOvenModeClusterServer(cabinet, currentMode, supportedModes);
    this.createDefaultOvenCavityOperationalStateClusterServer(cabinet, operationalState, currentPhase, phaseList);
    return cabinet;
  }

  /**
   * Creates a default OvenMode Cluster Server.
   *
   * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
   * @param {number} currentMode - The current mode of the oven.
   * @param {OvenMode.ModeOption[]} supportedModes - The supported modes of the oven.
   *
   * @returns {MatterbridgeEndpoint} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - supportedModes is a fixed attribute. It cannot be changed at runtime.
   * - currentMode persists across reboots.
   */
  createDefaultOvenModeClusterServer(endpoint: MatterbridgeEndpoint, currentMode: number, supportedModes: OvenMode.ModeOption[]): MatterbridgeEndpoint {
    endpoint.behaviors.require(MatterbridgeOvenModeServer, {
      supportedModes,
      currentMode,
    });
    return endpoint;
  }

  /**
   * Creates a default Oven Cavity Operational State Cluster Server.
   *
   * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
   * @param {OperationalState.OperationalStateEnum} operationalState - The initial operational state.
   * @param {number} [currentPhase] - The current phase of the oven cavity.
   * @param {string[]} [phaseList] - The list of phases for the oven cavity.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * For this derived cluster, only these pre-defined strings may be used in the PhaseList attribute:
   * "pre-heating", "pre-heated", and "cooling down".
   */
  createDefaultOvenCavityOperationalStateClusterServer(
    endpoint: MatterbridgeEndpoint,
    operationalState: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Stopped,
    currentPhase?: number,
    phaseList?: string[],
  ): MatterbridgeEndpoint {
    endpoint.behaviors.require(MatterbridgeOvenCavityOperationalStateServer, {
      phaseList: phaseList || null,
      currentPhase: currentPhase || null,
      operationalStateList: [
        { operationalStateId: OperationalState.OperationalStateEnum.Stopped, operationalStateLabel: 'Stopped' },
        { operationalStateId: OperationalState.OperationalStateEnum.Running, operationalStateLabel: 'Running' },
        { operationalStateId: OperationalState.OperationalStateEnum.Error, operationalStateLabel: 'Error' },
      ],
      operationalState,
      operationalError: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    });
    return endpoint;
  }
}

// Server for OvenMode
export class MatterbridgeOvenModeServer extends OvenModeServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeOvenModeServer initialized');
  }
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (supportedMode) {
      device.log.info(`MatterbridgeOvenModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with mode ${supportedMode.mode} = ${supportedMode.label}`);
      this.state.currentMode = request.newMode;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
    } else {
      device.log.error(`MatterbridgeOvenModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with invalid mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Invalid mode' };
    }
  }
}

// Server for OvenCavityOperationalState
export class MatterbridgeOvenCavityOperationalStateServer extends OvenCavityOperationalStateServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeOvenCavityOperationalStateServer initialized: setting operational state to Stopped and operational error to No error');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
  }

  override stop(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOvenCavityOperationalStateServer: stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called setting operational state to Stopped and operational error to No error`);
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override start(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeOvenCavityOperationalStateServer: start (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called setting operational state to Running and operational error to No error`);
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }
}
