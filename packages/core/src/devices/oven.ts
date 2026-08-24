/**
 * @file packages/core/src/devices/oven.ts
 * @description This file contains the Oven class.
 * @author Luca Liguori
 * @created 2025-05-25
 * @version 1.3.0
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

// @matter
import type { MaybePromise } from '@matter/general';
import { OvenCavityOperationalStateServer } from '@matter/node/behaviors/oven-cavity-operational-state';
import { OvenModeServer } from '@matter/node/behaviors/oven-mode';
import type { EndpointNumber, Semtag } from '@matter/types';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { OvenMode } from '@matter/types/clusters/oven-mode';
// @matterbridge
import { fireAndForget } from '@matterbridge/utils/wait';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { oven, powerSource, temperatureControlledCabinetHeater } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { createNumberTemperatureControlClusterServer } from './temperatureControl.js';

/**
 * Options for configuring an {@link Oven} endpoint.
 */
export interface OvenOptions {
  /** Endpoint operating mode. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
}

/**
 * Options for configuring a heated Temperature Controlled Cabinet child endpoint.
 */
export interface OvenCabinetOptions {
  /** Stable storage key for the endpoint. Defaults to the cabinet name. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList: Semtag[];
  /** Initial oven mode. Defaults to 2 (Convection). */
  currentMode?: number;
  /** Supported oven modes. Defaults to the standard oven mode set. */
  supportedModes?: OvenMode.ModeOption[];
  /** Target temperature in hundredths of a degree Celsius. Defaults to 18000 (180°C). */
  targetTemperature?: number;
  /** Minimum temperature in hundredths of a degree Celsius. Defaults to 3000 (30°C). */
  minTemperature?: number;
  /** Maximum temperature in hundredths of a degree Celsius. Defaults to 30000 (300°C). */
  maxTemperature?: number;
  /** Temperature step in hundredths of a degree Celsius. Defaults to 1000 (10°C). */
  step?: number;
  /** Current temperature in hundredths of a degree Celsius. Defaults to 2000 (20°C). */
  currentTemperature?: number;
  /** Initial operational state. Defaults to Stopped. */
  operationalState?: OperationalState.OperationalStateEnum;
  /** Initial operational phase index. */
  currentPhase?: number;
  /** Supported operational phase names. */
  phaseList?: string[];
}

/**
 * Matterbridge endpoint representing an oven device.
 */
export class Oven extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Oven class.
   *
   * @param {string} name - The name of the oven.
   * @param {string} serial - The serial number of the oven.
   * @param {OvenOptions} [options] - Endpoint configuration.
   *
   * @remarks
   * 13.9 An oven represents a device that contains one or more cabinets, and optionally a single cooktop,
   * that are all capable of heating food. Examples of consumer products implementing this device type
   * include ovens, wall ovens, convection ovens, etc.
   * An oven is always defined via endpoint composition.
   * - Use `addCabinet` to add one or more cabinets to the oven.
   */
  constructor(name: string, serial: string, options: OvenOptions = {}) {
    super([oven, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Oven');
    this.createDefaultPowerSourceWiredClusterServer();
    fireAndForget(this.addFixedLabel('composed', 'Oven'), this.log, 'Oven addFixedLabel');
  }

  /**
   * Adds a Temperature Controlled Cabinet Heater to the oven.
   *
   * @param {string} name - The name of the cabinet.
   * @param {OvenCabinetOptions} options - Endpoint, mode, temperature, and operational-state configuration.
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the cabinet.
   *
   * @remarks
   * 13.4.1 A Temperature Controlled Cabinet Heater is a device that provides a heated space for warming food.
   * It is typically installed within an oven and can be used in conjunction with other heating elements.
   */
  addCabinet(name: string, options: OvenCabinetOptions): MatterbridgeEndpoint;

  /**
   * Adds a cabinet using the legacy positional configuration.
   *
   * @deprecated Pass an {@link OvenCabinetOptions} object as the second argument instead.
   */
  // oxfmt-ignore
  addCabinet(name: string, tagList: Semtag[], currentMode?: number, supportedModes?: OvenMode.ModeOption[], targetTemperature?: number, minTemperature?: number, maxTemperature?: number, step?: number, currentTemperature?: number, operationalState?: OperationalState.OperationalStateEnum, currentPhase?: number, phaseList?: string[]): MatterbridgeEndpoint;

  addCabinet(
    name: string,
    optionsOrTagList: OvenCabinetOptions | Semtag[],
    currentMode?: number,
    supportedModes?: OvenMode.ModeOption[],
    targetTemperature?: number,
    minTemperature?: number,
    maxTemperature?: number,
    step?: number,
    currentTemperature?: number,
    operationalState?: OperationalState.OperationalStateEnum,
    currentPhase?: number,
    phaseList?: string[],
  ): MatterbridgeEndpoint {
    const options: OvenCabinetOptions = Array.isArray(optionsOrTagList)
      ? {
          tagList: optionsOrTagList,
          currentMode,
          supportedModes,
          targetTemperature,
          minTemperature,
          maxTemperature,
          step,
          currentTemperature,
          operationalState,
          currentPhase,
          phaseList,
        }
      : optionsOrTagList;
    const configuredSupportedModes = options.supportedModes ?? [
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
    ];
    const cabinet = this.addChildDeviceType(options.id ?? name, temperatureControlledCabinetHeater, { number: options.number, tagList: options.tagList });
    cabinet.log.logName = name;
    createNumberTemperatureControlClusterServer(
      cabinet,
      options.targetTemperature ?? 180 * 100,
      options.minTemperature ?? 30 * 100,
      options.maxTemperature ?? 300 * 100,
      options.step ?? 10 * 100,
    );
    cabinet.createDefaultTemperatureMeasurementClusterServer(options.currentTemperature ?? 20 * 100);
    this.createDefaultOvenModeClusterServer(cabinet, options.currentMode ?? 2, configuredSupportedModes);
    this.createDefaultOvenCavityOperationalStateClusterServer(
      cabinet,
      options.operationalState ?? OperationalState.OperationalStateEnum.Stopped,
      options.currentPhase,
      options.phaseList,
    );
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
  // oxfmt-ignore
  createDefaultOvenCavityOperationalStateClusterServer(endpoint: MatterbridgeEndpoint, operationalState: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Stopped, currentPhase?: number, phaseList?: string[]): MatterbridgeEndpoint {
    endpoint.behaviors.require(MatterbridgeOvenCavityOperationalStateServer, {
      phaseList: phaseList ?? null,
      currentPhase: currentPhase ?? null,
      operationalStateList: [
        { operationalStateId: OperationalState.OperationalStateEnum.Stopped },
        { operationalStateId: OperationalState.OperationalStateEnum.Running },
        { operationalStateId: OperationalState.OperationalStateEnum.Error },
      ],
      operationalState,
      operationalError: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    });
    return endpoint;
  }
}

// Server for OvenMode
/**
 * OvenMode server that forwards mode changes to the device implementation.
 */
export class MatterbridgeOvenModeServer extends OvenModeServer {
  /**
   * Initializes the server.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeOvenModeServer initialized');
  }
  /**
   * Handles the OvenMode `ChangeToMode` command.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (supportedMode) {
      device.log.info(
        `MatterbridgeOvenModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with mode ${supportedMode.mode} = ${supportedMode.label}`,
      );
      this.state.currentMode = request.newMode;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
    } else {
      device.log.error(`MatterbridgeOvenModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with invalid mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Invalid mode' };
    }
  }
}

// Server for OvenCavityOperationalState
/**
 * Oven cavity operational state server that initializes and updates operational state.
 */
export class MatterbridgeOvenCavityOperationalStateServer extends OvenCavityOperationalStateServer {
  /**
   * Initializes operational state defaults.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeOvenCavityOperationalStateServer initialized: setting operational state to Stopped and operational error to No error');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
  }

  /**
   * Handles the OvenCavityOperationalState `Stop` command.
   *
   * @returns {OperationalState.OperationalCommandResponse} Command response with state and error details.
   */
  override stop(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeOvenCavityOperationalStateServer: stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called setting operational state to Stopped and operational error to No error`,
    );
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the OvenCavityOperationalState `Start` command.
   *
   * @returns {OperationalState.OperationalCommandResponse} Command response with state and error details.
   */
  override start(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeOvenCavityOperationalStateServer: start (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called setting operational state to Running and operational error to No error`,
    );
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }
}
