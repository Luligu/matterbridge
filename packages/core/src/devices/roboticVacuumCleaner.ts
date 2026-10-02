/**
 * @file packages/core/src/devices/roboticVacuumCleaner.ts
 * @description This file contains the RoboticVacuumCleaner class.
 * @author Luca Liguori
 * @created 2025-05-01
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

/* oxlint-disable unicorn/no-negated-condition */
/* oxlint-disable typescript/no-namespace */

// @matter
import { CommonAreaNamespaceTag } from '@matter/node';
import { RvcCleanModeServer } from '@matter/node/behaviors/rvc-clean-mode';
import { RvcOperationalStateServer } from '@matter/node/behaviors/rvc-operational-state';
import { RvcRunModeServer } from '@matter/node/behaviors/rvc-run-mode';
import type { EndpointNumber } from '@matter/types';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { ServiceArea } from '@matter/types/clusters/service-area';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeServiceAreaServer } from '../behaviors/serviceAreaServer.js';
import { powerSource, roboticVacuumCleaner } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

const MatterbridgeRvcOperationalStateServerBase = RvcOperationalStateServer.enable({
  attributes: { countdownTime: true },
  events: { operationCompletion: true },
});

/**
 * Options for configuring a {@link RoboticVacuumCleaner} endpoint.
 */
export interface RoboticVacuumCleanerOptions {
  /** Endpoint operating mode. Use `server` or `matter` for Apple Home compatibility. */
  mode?: 'server' | 'matter';
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Initial RVC run mode. Defaults to 1 (Idle). */
  currentRunMode?: number;
  /** Supported RVC run modes. Defaults to Idle, Cleaning, Mapping, and SpotCleaning. */
  supportedRunModes?: RvcRunMode.ModeOption[];
  /** Initial RVC clean mode. Defaults to 1 (Vacuum). */
  currentCleanMode?: number;
  /** Supported RVC clean modes. Defaults to Vacuum, Mop, and DeepClean. */
  supportedCleanModes?: RvcCleanMode.ModeOption[];
  /** Initial phase index. Defaults to null. */
  currentPhase?: number | null;
  /** Operational phase names. Defaults to null. */
  phaseList?: string[] | null;
  /** Initial operational state. Defaults to Docked. */
  operationalState?: RvcOperationalState.OperationalState;
  /** Supported operational states. Defaults to the standard RVC operational states. */
  operationalStateList?: RvcOperationalState.OperationalStateStruct[];
  /** Supported service areas. Defaults to Living, Kitchen, Bedroom, and Bathroom. */
  supportedAreas?: ServiceArea.Area[];
  /** Initially selected service areas. Defaults to an empty array (all areas allowed). */
  selectedAreas?: number[];
  /** Initial service area ID. Defaults to 1 (Living). */
  currentArea?: number | null;
  /** Supported service-area maps. Defaults to an empty array. */
  supportedMaps?: ServiceArea.Map[];
  /** Initial per-area progress. When defined (even as an empty list), the ProgressReporting (PROG) feature is enabled. Defaults to undefined (PROG disabled). */
  progress?: ServiceArea.Progress[];
}

/**
 * Matterbridge endpoint representing a robotic vacuum cleaner device.
 */
export class RoboticVacuumCleaner extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the RoboticVacuumCleaner class.
   *
   * @param {string} name - The name of the robotic vacuum cleaner.
   * @param {string} serial - The serial number of the robotic vacuum cleaner.
   * @param {RoboticVacuumCleanerOptions} [options] - Endpoint and initial cluster configuration.
   */
  constructor(name: string, serial: string, options?: RoboticVacuumCleanerOptions);

  /**
   * Creates an instance using the legacy positional configuration.
   *
   * @deprecated Pass a {@link RoboticVacuumCleanerOptions} object as the third argument instead.
   */
  // oxfmt-ignore
  constructor(name: string, serial: string, mode?: 'server' | 'matter', currentRunMode?: number, supportedRunModes?: RvcRunMode.ModeOption[], currentCleanMode?: number, supportedCleanModes?: RvcCleanMode.ModeOption[], currentPhase?: number | null, phaseList?: string[] | null, operationalState?: RvcOperationalState.OperationalState, operationalStateList?: RvcOperationalState.OperationalStateStruct[], supportedAreas?: ServiceArea.Area[], selectedAreas?: number[], currentArea?: number | null, supportedMaps?: ServiceArea.Map[]);

  constructor(
    name: string,
    serial: string,
    modeOrOptions?: 'server' | 'matter' | RoboticVacuumCleanerOptions,
    currentRunMode?: number,
    supportedRunModes?: RvcRunMode.ModeOption[],
    currentCleanMode?: number,
    supportedCleanModes?: RvcCleanMode.ModeOption[],
    currentPhase: number | null = null,
    phaseList: string[] | null = null,
    operationalState?: RvcOperationalState.OperationalState,
    operationalStateList?: RvcOperationalState.OperationalStateStruct[],
    supportedAreas?: ServiceArea.Area[],
    selectedAreas?: number[],
    currentArea?: number | null,
    supportedMaps?: ServiceArea.Map[],
  ) {
    const options: RoboticVacuumCleanerOptions =
      typeof modeOrOptions === 'object'
        ? modeOrOptions
        : {
            mode: modeOrOptions,
            currentRunMode,
            supportedRunModes,
            currentCleanMode,
            supportedCleanModes,
            currentPhase,
            phaseList,
            operationalState,
            operationalStateList,
            supportedAreas,
            selectedAreas,
            currentArea,
            supportedMaps,
          };
    super([roboticVacuumCleaner, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
      tagList: options.tagList,
      mode: options.mode,
    });
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Robot Vacuum Cleaner')
      .createDefaultPowerSourceRechargeableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 5900)
      .createDefaultRvcRunModeClusterServer(options.currentRunMode, options.supportedRunModes)
      .createDefaultRvcCleanModeClusterServer(options.currentCleanMode, options.supportedCleanModes)
      .createDefaultRvcOperationalStateClusterServer(options.phaseList, options.currentPhase, options.operationalStateList, options.operationalState)
      .createDefaultServiceAreaClusterServer(options.supportedAreas, options.selectedAreas, options.currentArea, options.supportedMaps, options.progress);
  }

  /**
   * Creates a default RvcRunMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the RvcRunMode cluster. Defaults to 1 (Idle).
   * @param {RvcRunMode.ModeOption[]} [supportedModes] - The supported modes for the RvcRunMode cluster. Defaults to a predefined set of modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - supportedModes is a fixed attribute that defines the run modes available for the robotic vacuum cleaner.
   */
  createDefaultRvcRunModeClusterServer(currentMode?: number, supportedModes?: RvcRunMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeRvcRunModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Idle', mode: 1, modeTags: [{ value: RvcRunMode.ModeTag.Idle }] },
        { label: 'Cleaning', mode: 2, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }] },
        { label: 'Mapping', mode: 3, modeTags: [{ value: RvcRunMode.ModeTag.Mapping }] },
        { label: 'SpotCleaning', mode: 4, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }, { value: RvcRunMode.ModeTag.Max }] },
      ],
      currentMode: currentMode ?? 1,
    });
    return this;
  }

  /**
   * Creates a default RvcCleanMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the RvcCleanMode cluster. Defaults to 1 (Vacuum).
   * @param {RvcCleanMode.ModeOption[]} [supportedModes] - The supported modes for the RvcCleanMode cluster. Defaults to a predefined set of modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - supportedModes is a fixed attribute that defines the clean modes available for the robotic vacuum cleaner.
   */
  createDefaultRvcCleanModeClusterServer(currentMode?: number, supportedModes?: RvcCleanMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeRvcCleanModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Vacuum', mode: 1, modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }] },
        { label: 'Mop', mode: 2, modeTags: [{ value: RvcCleanMode.ModeTag.Mop }] },
        { label: 'DeepClean', mode: 3, modeTags: [{ value: RvcCleanMode.ModeTag.DeepClean }] },
      ],
      currentMode: currentMode ?? 1,
    });
    return this;
  }

  /**
   * Creates a default ServiceArea Cluster Server.
   *
   * @param {ServiceArea.Area[]} [supportedAreas] - The supported areas for the ServiceArea cluster. Defaults to a predefined set of areas.
   * @param {number[]} [selectedAreas] - The selected areas for the ServiceArea cluster. Defaults to an empty array (all areas allowed).
   * @param {number | null} [currentArea] - The current areaId (not the index in the array!) of the ServiceArea cluster. Defaults to 1 (Living).
   * @param {ServiceArea.Map[]} [supportedMaps] - The supported maps for the robotic vacuum cleaner. Defaults empty list.
   * @param {ServiceArea.Progress[]} [progress] - The initial per-area progress for the robotic vacuum cleaner. When defined (even as an empty list), the ProgressReporting (PROG) feature is enabled. Defaults to undefined (PROG disabled).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultServiceAreaClusterServer(
    supportedAreas?: ServiceArea.Area[],
    selectedAreas?: number[],
    currentArea?: number | null,
    supportedMaps?: ServiceArea.Map[],
    progress?: ServiceArea.Progress[],
  ): this {
    this.behaviors.require(MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps, ...(progress !== undefined ? [ServiceArea.Feature.ProgressReporting] : [])), {
      supportedAreas: supportedAreas ?? [
        {
          areaId: 1,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Living', floorNumber: 0, areaType: CommonAreaNamespaceTag.LivingRoom.tag }, landmarkInfo: null },
        },
        {
          areaId: 2,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: CommonAreaNamespaceTag.Kitchen.tag }, landmarkInfo: null },
        },
        {
          areaId: 3,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 1, areaType: CommonAreaNamespaceTag.Bedroom.tag }, landmarkInfo: null },
        },
        {
          areaId: 4,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Bathroom', floorNumber: 1, areaType: CommonAreaNamespaceTag.Bathroom.tag }, landmarkInfo: null },
        },
      ],
      selectedAreas: selectedAreas ?? [], // Indicates the set of areas where the device SHOULD attempt to operate. If this attribute is empty, the device is not constrained to operate in any specific areas.
      currentArea: currentArea !== undefined ? currentArea : 1, // If not null, the value of this attribute shall match the AreaID field of an entry on the SupportedAreas attribute’s list. A null value indicates that the device is currently unable to provide this information.
      supportedMaps: supportedMaps ?? [], // If empty, that indicates that the device is currently unable to provide this information
      /**
       * Indicates the estimated Epoch time for completing operating at the area indicated by the CurrentArea attribute, in seconds. A value of 0 means that the operation has completed.
       * When this attribute is null, that represents that there is no time currently defined until operation completion.
       * This attribute SHALL be null if the CurrentArea attribute is null.
       */
      estimatedEndTime: null,
      progress, // The progress of the device in each area, if ProgressReporting is enabled.
    });
    return this;
  }

  /**
   * Creates a default RvcOperationalState Cluster Server.
   *
   * @param {string[] | null} [phaseList] - The list of phases for the RvcOperationalState cluster. Defaults to null.
   * @param {number | null} [currentPhase] - The current phase (the index of the phaseList) of the RvcOperationalState cluster. Defaults to null.
   * @param {RvcOperationalState.OperationalStateStruct[]} [operationalStateList] - The list of operational states for the RvcOperationalState cluster. Defaults to a predefined set of states.
   * @param {RvcOperationalState.OperationalState} [operationalState] - The current operationalStateId of the RvcOperationalState cluster. Defaults to Docked.
   * @param {RvcOperationalState.ErrorStateStruct} [operationalError] - The current operational error of the RvcOperationalState cluster. Defaults to NoError.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  // oxfmt-ignore
  createDefaultRvcOperationalStateClusterServer(phaseList: string[] | null = null, currentPhase: number | null = null, operationalStateList?: RvcOperationalState.OperationalStateStruct[], operationalState?: RvcOperationalState.OperationalState, operationalError?: RvcOperationalState.ErrorStateStruct): this {
    this.behaviors.require(MatterbridgeRvcOperationalStateServer, {
      phaseList,
      currentPhase,
      countdownTime: null,
      operationalStateList: operationalStateList ?? [
        { operationalStateId: RvcOperationalState.OperationalState.Stopped },
        { operationalStateId: RvcOperationalState.OperationalState.Running },
        { operationalStateId: RvcOperationalState.OperationalState.Paused },
        { operationalStateId: RvcOperationalState.OperationalState.Error },
        { operationalStateId: RvcOperationalState.OperationalState.SeekingCharger }, // Y RVC Pause Compatibility N RVC Resume Compatibility
        { operationalStateId: RvcOperationalState.OperationalState.Charging }, // N RVC Pause Compatibility Y RVC Resume Compatibility
        { operationalStateId: RvcOperationalState.OperationalState.Docked }, // N RVC Pause Compatibility Y RVC Resume Compatibility
      ],
      operationalState: operationalState ?? RvcOperationalState.OperationalState.Docked,
      operationalError: operationalError ?? { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    });
    return this;
  }
}

/**
 * RVC run mode server that validates and applies run mode changes.
 */
export class MatterbridgeRvcRunModeServer extends RvcRunModeServer {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Handles the RvcRunMode `ChangeToMode` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster spec §7.2.4.1 (DIRECTMODECH): while CurrentMode has no Idle mode tag,
   * changing directly to another non-Idle mode SHALL return InvalidInMode unless DirectModeChange is enabled.
   * Changing to an Idle-tagged mode remains allowed because that is how the RVC device type stops an operation
   * (Matter 1.6 Device Library spec §12.1.6.4.2).
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeRvcRunModeServer: changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('RvcRunMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: RvcRunModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
    });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    // Matter 1.6.0 § 1.10.7.1.1: Respond with UnsupportedMode when NewMode matches no SupportedModes entry.
    if (!supported) {
      device.log.error(
        `MatterbridgeRvcRunModeServer: changeToMode called with unsupported newMode ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    const currentIsIdle = this.state.supportedModes.some((mode) => mode.mode === this.state.currentMode && mode.modeTags.some((tag) => tag.value === RvcRunMode.ModeTag.Idle));
    const requestedIsIdle = supported.modeTags.some((tag) => tag.value === RvcRunMode.ModeTag.Idle);
    // Matter 1.6.0 § 7.2.4.1: Without DirectModeChange, respond with InvalidInMode to a change from a non-Idle mode to another non-Idle mode.
    if (request.newMode !== this.state.currentMode && !this.features.directModeChange && !currentIsIdle && !requestedIsIdle) {
      device.log.debug(
        `MatterbridgeRvcRunModeServer: changeToMode rejected direct non-Idle mode change from ${this.state.currentMode} to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Direct mode change is not supported while operating' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: Respond with Success when NewMode is already the CurrentMode.
    if (request.newMode === this.state.currentMode) {
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Already in requested mode' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: On a successful transition set CurrentMode to NewMode.
    this.state.currentMode = request.newMode;
    const operationalState = this.agent.get(MatterbridgeRvcOperationalStateServer);
    if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Cleaning)) {
      device.log.debug(`MatterbridgeRvcRunModeServer: changeToMode called with newMode Cleaning => Running (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      // Matter 1.6.0 § 1.14.7.2.2: A new operation starts, so start timing TotalOperationalTime for the OperationCompletion event.
      operationalState.beginOperation();
      // Matter 1.6.0 § 7.2.7.2.2: A Cleaning mode means the device was asked to clean, so it is actively Running.
      operationalState.state.operationalState = RvcOperationalState.OperationalState.Running;
      this.endpoint.emitCommand(RvcRunMode, 'changeToMode', request, this.context);
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Running' };
    } else if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Idle)) {
      device.log.debug(`MatterbridgeRvcRunModeServer: changeToMode called with newMode Idle => SeekingCharger (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      // Matter 1.6.0 § 1.14.7.2: The overall operation ends, so generate the OperationCompletion event.
      operationalState.completeOperation();
      // Matter 1.6.0 § 7.2.7.2.1: In an Idle mode the device performs auxiliary actions such as seeking the charger.
      operationalState.state.operationalState = RvcOperationalState.OperationalState.SeekingCharger;
      this.endpoint.emitCommand(RvcRunMode, 'changeToMode', request, this.context);
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Seeking charger' };
    }
    device.log.debug(
      `MatterbridgeRvcRunModeServer: changeToMode called with newMode ${request.newMode} => ${supported.label} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 1.14.7.2.2: A new operation starts, so start timing TotalOperationalTime for the OperationCompletion event.
    operationalState.beginOperation();
    // Matter 1.6.0 § 7.2.7.2: A non-Idle mode is a main operation of the device, so it is Running.
    operationalState.state.operationalState = RvcOperationalState.OperationalState.Running;
    this.endpoint.emitCommand(RvcRunMode, 'changeToMode', request, this.context);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

/**
 * RVC clean mode server that validates and applies clean mode changes.
 */
export class MatterbridgeRvcCleanModeServer extends RvcCleanModeServer {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  /**
   * Handles the RvcCleanMode `ChangeToMode` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster spec §7.3.4.1 (DIRECTMODECH): if RVC Run Mode CurrentMode has no Idle
   * mode tag, a clean-mode change SHALL return InvalidInMode unless DirectModeChange is enabled.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Mode change request payload.
   * @returns {ModeBase.ChangeToModeResponse} Command response with change status.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeRvcCleanModeServer: changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('RvcCleanMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: RvcCleanModeServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
    });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    // Matter 1.6.0 § 1.10.7.1.1: Respond with UnsupportedMode when NewMode matches no SupportedModes entry.
    if (!supported) {
      device.log.error(
        `MatterbridgeRvcCleanModeServer: changeToMode called with unsupported newMode ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: Respond with Success when NewMode is already the CurrentMode.
    if (request.newMode === this.state.currentMode) {
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Already in requested mode' };
    }
    const runModeState = this.agent.get(MatterbridgeRvcRunModeServer).state;
    const runModeIsIdle = runModeState.supportedModes.some((mode) => mode.mode === runModeState.currentMode && mode.modeTags.some((tag) => tag.value === RvcRunMode.ModeTag.Idle));
    // Matter 1.6.0 § 7.3.4.1: Without DirectModeChange, respond with InvalidInMode to a clean mode change while the RVC Run Mode CurrentMode is not Idle.
    if (!this.features.directModeChange && !runModeIsIdle) {
      device.log.debug(
        `MatterbridgeRvcCleanModeServer: changeToMode rejected while RVC Run Mode ${runModeState.currentMode} is non-Idle (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
      );
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Clean mode cannot change while operating' };
    }
    // Matter 1.6.0 § 1.10.7.1.1: On a successful transition set CurrentMode to NewMode.
    this.state.currentMode = request.newMode;
    device.log.debug(
      `MatterbridgeRvcCleanModeServer: changeToMode called with newMode ${request.newMode} => ${supported.label} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.endpoint.emitCommand(RvcCleanMode, 'changeToMode', request, this.context);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

/**
 * RVC operational state server that forwards operational commands and updates state.
 */
export class MatterbridgeRvcOperationalStateServer extends MatterbridgeRvcOperationalStateServerBase {
  /** The endpoint that owns this behavior. Narrowed to MatterbridgeEndpoint: this server is only ever added to a Matterbridge endpoint. */
  declare readonly endpoint: MatterbridgeEndpoint;

  declare protected internal: MatterbridgeRvcOperationalStateServer.Internal;

  /** Records the beginning of an RVC operation for the mandatory OperationCompletion event. */
  beginOperation(): void {
    if (this.internal.operationStartedAt === undefined) {
      this.internal.operationStartedAt = Date.now();
      this.internal.pausedAccumulatedMs = 0;
    }
  }

  /**
   * Emits the mandatory RVC OperationCompletion event when an active operation ends.
   *
   * @remarks
   * Matter 1.6 Device Library spec §12.1.4 requires the RVC Operational State OperationCompletion event.
   * Matter 1.6 Application Cluster spec §1.14.7.2 defines TotalOperationalTime and PausedTime.
   */
  completeOperation(): void {
    if (this.internal.operationStartedAt === undefined) return;
    if (this.internal.pausedSinceMs !== undefined) {
      this.internal.pausedAccumulatedMs += Date.now() - this.internal.pausedSinceMs;
      this.internal.pausedSinceMs = undefined;
    }
    const totalOperationalTime = Math.round((Date.now() - this.internal.operationStartedAt) / 1000);
    const pausedTime = Math.round(this.internal.pausedAccumulatedMs / 1000);
    this.events.operationCompletion.emit({ completionErrorCode: OperationalState.ErrorState.NoError, totalOperationalTime, pausedTime }, this.context);
    this.internal.operationStartedAt = undefined;
    this.internal.pausedAccumulatedMs = 0;
  }

  /**
   * Handles the RvcOperationalState `Pause` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster spec §1.14.6.1 requires Paused to be an idempotent success, incompatible
   * states to return CommandInvalidInState without side effects, and successful requests to set Paused.
   * The RVC state compatibility table additionally makes SeekingCharger Pause-compatible.
   *
   * @returns {OperationalState.OperationalCommandResponse} Command response with state and error details.
   */
  override async pause(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeRvcOperationalStateServer: pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('RvcOperationalState.pause', {
      command: 'pause',
      request: {},
      cluster: RvcOperationalStateServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.14.6.1: Respond with ErrorStateID NoError and take no further action if Pause is received while already Paused.
    if (this.state.operationalState === RvcOperationalState.OperationalState.Paused) {
      return { commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already paused' } };
    }
    // Matter 1.6.0 § 1.14.6.1 and § 7.4.4.1: Respond with CommandInvalidInState when the current state is not Pause-compatible (only Running and SeekingCharger are).
    if (this.state.operationalState !== RvcOperationalState.OperationalState.Running && this.state.operationalState !== RvcOperationalState.OperationalState.SeekingCharger) {
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Pause-compatible in the current operational state' },
      };
    }
    device.log.debug(`MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 1.14.6.4: Remember the state before Paused, so Resume can restore it.
    this.internal.operationalStateBeforePause = this.state.operationalState;
    // Matter 1.6.0 § 1.14.7.2.3: Start timing the paused interval reported as PausedTime in OperationCompletion.
    this.internal.pausedSinceMs = Date.now();
    // Matter 1.6.0 § 1.14.6.1: On success, set OperationalState to Paused.
    this.state.operationalState = RvcOperationalState.OperationalState.Paused;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    this.endpoint.emitCommand(RvcOperationalState, 'pause', {}, this.context);
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the RvcOperationalState `Resume` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster spec §1.14.6.4 requires Running to be an idempotent success, incompatible
   * states to return CommandInvalidInState without side effects, and a successful Resume to restore the most
   * recent non-Error operational state that preceded Paused.
   *
   * @returns {OperationalState.OperationalCommandResponse} Command response with state and error details.
   */
  override async resume(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeRvcOperationalStateServer: resume (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('RvcOperationalState.resume', {
      command: 'resume',
      request: {},
      cluster: RvcOperationalStateServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 1.14.6.4: Respond with ErrorStateID NoError and take no further action if Resume is received while already Running.
    if (this.state.operationalState === RvcOperationalState.OperationalState.Running) {
      return { commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already running' } };
    }
    // Matter 1.6.0 § 1.14.6.4: Respond with CommandInvalidInState when the current state is not Resume-compatible (only Paused is).
    if (this.state.operationalState !== RvcOperationalState.OperationalState.Paused) {
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Not Resume-compatible in the current operational state' },
      };
    }
    device.log.debug(
      `MatterbridgeRvcOperationalStateServer: resume called restoring operational state to ${this.internal.operationalStateBeforePause} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 1.14.7.2.3: Close the paused interval, so it counts toward PausedTime in OperationCompletion.
    if (this.internal.pausedSinceMs !== undefined) {
      this.internal.pausedAccumulatedMs += Date.now() - this.internal.pausedSinceMs;
      this.internal.pausedSinceMs = undefined;
    }
    // Matter 1.6.0 § 1.14.6.4: On success, restore the most recent non-Error OperationalState that preceded Paused.
    this.state.operationalState = this.internal.operationalStateBeforePause;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    this.endpoint.emitCommand(RvcOperationalState, 'resume', {}, this.context);
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the RvcOperationalState `GoHome` command.
   *
   * @remarks
   * Matter 1.6 Application Cluster spec §7.4.5.1 requires SeekingCharger to be an idempotent success; states
   * that cannot seek the charger, including Charging and Docked, return CommandInvalidInState without side
   * effects; and every successful request sets OperationalState to SeekingCharger. Run Mode changes to Idle
   * only after docking completes, not when GoHome is accepted.
   *
   * @returns {OperationalState.OperationalCommandResponse} Command response with state and error details.
   */
  override async goHome(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeRvcOperationalStateServer: goHome (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('RvcOperationalState.goHome', {
      command: 'goHome',
      request: {},
      cluster: RvcOperationalStateServer.id,
      attributes: this.state,
      endpoint: this.endpoint,
      context: this.context,
    });
    // Matter 1.6.0 § 7.4.5.1: Respond with ErrorStateID NoError and take no further action if GoHome is received while already SeekingCharger.
    if (this.state.operationalState === RvcOperationalState.OperationalState.SeekingCharger) {
      return { commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Already seeking charger' } };
    }
    // Matter 1.6.0 § 7.4.5.1: Respond with CommandInvalidInState when the device cannot seek the charger in the current state.
    if (
      this.state.operationalState === RvcOperationalState.OperationalState.Error ||
      this.state.operationalState === RvcOperationalState.OperationalState.Charging ||
      this.state.operationalState === RvcOperationalState.OperationalState.Docked ||
      this.state.operationalState === RvcOperationalState.OperationalState.EmptyingDustBin ||
      this.state.operationalState === RvcOperationalState.OperationalState.CleaningMop ||
      this.state.operationalState === RvcOperationalState.OperationalState.FillingWaterTank ||
      this.state.operationalState === RvcOperationalState.OperationalState.UpdatingMaps
    ) {
      return {
        commandResponseState: { errorStateId: OperationalState.ErrorState.CommandInvalidInState, errorStateDetails: 'Cannot seek the charger in the current operational state' },
      };
    }
    device.log.debug(
      `MatterbridgeRvcOperationalStateServer: goHome called setting operational state to SeekingCharger (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    // Matter 1.6.0 § 7.4.5.1: On success, set OperationalState to SeekingCharger.
    this.state.operationalState = RvcOperationalState.OperationalState.SeekingCharger;
    // Matter 1.6.0 § 1.14.5.6: OperationalError shall report NoError when no error condition exists.
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    this.endpoint.emitCommand(RvcOperationalState, 'goHome', {}, this.context);
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }
}

/* v8 ignore start */
export namespace MatterbridgeRvcOperationalStateServer {
  /** Internal state retained across RVC operational commands. */
  export class Internal extends MatterbridgeRvcOperationalStateServerBase.Internal {
    /** Most recent non-Error operational state before entering Paused (§1.14.6.4). */
    operationalStateBeforePause: RvcOperationalState.OperationalState | OperationalState.OperationalStateEnum = RvcOperationalState.OperationalState.Running;
    /** Start time used for OperationCompletion.TotalOperationalTime (§1.14.7.2.2). */
    operationStartedAt: number | undefined;
    /** Accumulated paused duration used for OperationCompletion.PausedTime (§1.14.7.2.3). */
    pausedAccumulatedMs = 0;
    /** Start of the current paused interval. */
    pausedSinceMs: number | undefined;
  }
}
/* v8 ignore stop */
