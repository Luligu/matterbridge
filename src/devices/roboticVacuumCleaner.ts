/**
 * @description This file contains the RoboticVacuumCleaner class.
 * @file src/devices/roboticVacuumCleaner.ts
 * @author Luca Liguori
 * @created 2025-05-01
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

// Matter.js
import { AreaNamespaceTag, MaybePromise } from '@matter/main';
import { RvcRunModeServer } from '@matter/main/behaviors/rvc-run-mode';
import { RvcOperationalStateServer } from '@matter/main/behaviors/rvc-operational-state';
import { RvcCleanModeServer } from '@matter/main/behaviors/rvc-clean-mode';
import { PowerSource } from '@matter/main/clusters/power-source';
import { RvcRunMode } from '@matter/main/clusters/rvc-run-mode';
import { RvcCleanMode } from '@matter/main/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/main/clusters/rvc-operational-state';
import { ServiceArea } from '@matter/main/clusters/service-area';
import { ModeBase } from '@matter/main/clusters/mode-base';
import { OperationalState } from '@matter/main/clusters/operational-state';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { powerSource, roboticVacuumCleaner } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeServer, MatterbridgeServiceAreaServer } from '../matterbridgeBehaviors.js';

export class RoboticVacuumCleaner extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the RoboticVacuumCleaner class.
   *
   * @param {string} name - The name of the robotic vacuum cleaner.
   * @param {string} serial - The serial number of the robotic vacuum cleaner.
   * @param {'server' | 'matter' | undefined} [mode] - The mode of the robotic vacuum cleaner. Defaults to undefined. Use 'server' or 'matter' if you want Apple Home compatibility.
   * @param {number} [currentRunMode] - The current run mode of the robotic vacuum cleaner. Defaults to 1 (Idle).
   * @param {RvcRunMode.ModeOption[]} [supportedRunModes] - The supported run modes for the robotic vacuum cleaner. Defaults to a predefined set of modes.
   * @param {number} [currentCleanMode] - The current clean mode of the robotic vacuum cleaner. Defaults to 1 (Vacuum).
   * @param {RvcCleanMode.ModeOption[]} [supportedCleanModes] - The supported clean modes for the robotic vacuum cleaner. Defaults to a predefined set of modes.
   * @param {number | null} [currentPhase] - The current phase of the robotic vacuum cleaner. Defaults to null.
   * @param {string[] | null} [phaseList] - The list of phases for the robotic vacuum cleaner. Defaults to null.
   * @param {RvcOperationalState.OperationalState} [operationalState] - The current operational state of the robotic vacuum cleaner. Defaults to Docked.
   * @param {RvcOperationalState.OperationalStateStruct[]} [operationalStateList] - The list of operational states for the robotic vacuum cleaner. Defaults to a predefined set of states.
   * @param {ServiceArea.Area[]} [supportedAreas] - The supported areas for the robotic vacuum cleaner. Defaults to a predefined set of areas.
   * @param {number[]} [selectedAreas] - The selected areas for the robotic vacuum cleaner. Defaults to an empty array (all areas allowed).
   * @param {number} [currentArea] - The current area of the robotic vacuum cleaner. Defaults to 1 (Living).
   * @param {ServiceArea.Map[]} [supportedMaps] - The supported maps for the robotic vacuum cleaner. Defaults to empty list.
   */
  constructor(
    name: string,
    serial: string,
    mode: 'server' | 'matter' | undefined = undefined,
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
    currentArea?: number,
    supportedMaps?: ServiceArea.Map[],
  ) {
    super([roboticVacuumCleaner, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, mode }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Robot Vacuum Cleaner')
      .createDefaultPowerSourceRechargeableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 5900)
      .createDefaultRvcRunModeClusterServer(currentRunMode, supportedRunModes)
      .createDefaultRvcCleanModeClusterServer(currentCleanMode, supportedCleanModes)
      .createDefaultRvcOperationalStateClusterServer(phaseList, currentPhase, operationalStateList, operationalState)
      .createDefaultServiceAreaClusterServer(supportedAreas, selectedAreas, currentArea, supportedMaps);
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
   * @param {number} [currentArea] - The current areaId (not the index in the array!) of the ServiceArea cluster. Defaults to 1 (Living).
   * @param {ServiceArea.Map[]} [supportedMaps] - The supported maps for the robotic vacuum cleaner. Defaults empty list.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultServiceAreaClusterServer(supportedAreas?: ServiceArea.Area[], selectedAreas?: number[], currentArea?: number, supportedMaps?: ServiceArea.Map[]): this {
    this.behaviors.require(MatterbridgeServiceAreaServer.with(ServiceArea.Feature.Maps), {
      supportedAreas: supportedAreas ?? [
        {
          areaId: 1,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Living', floorNumber: 0, areaType: AreaNamespaceTag.LivingRoom.tag }, landmarkInfo: null },
        },
        {
          areaId: 2,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: AreaNamespaceTag.Kitchen.tag }, landmarkInfo: null },
        },
        {
          areaId: 3,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 1, areaType: AreaNamespaceTag.Bedroom.tag }, landmarkInfo: null },
        },
        {
          areaId: 4,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Bathroom', floorNumber: 1, areaType: AreaNamespaceTag.Bathroom.tag }, landmarkInfo: null },
        },
      ],
      selectedAreas: selectedAreas ?? [], // Indicates the set of areas where the device SHOULD attempt to operate. If this attribute is empty, the device is not constrained to operate in any specific areas.
      currentArea: currentArea ?? 1, // If not null, the value of this attribute shall match the AreaID field of an entry on the SupportedAreas attribute’s list. A null value indicates that the device is currently unable to provide this information.
      supportedMaps: supportedMaps ?? [], // If empty, that indicates that the device is currently unable to provide this information
      estimatedEndTime: null, // Indicates the estimated Epoch time for completing operating at the area indicated by the CurrentArea attribute, in seconds.
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
  createDefaultRvcOperationalStateClusterServer(
    phaseList: string[] | null = null,
    currentPhase: number | null = null,
    operationalStateList?: RvcOperationalState.OperationalStateStruct[],
    operationalState?: RvcOperationalState.OperationalState,
    operationalError?: RvcOperationalState.ErrorStateStruct,
  ): this {
    this.behaviors.require(MatterbridgeRvcOperationalStateServer, {
      phaseList,
      currentPhase,
      operationalStateList: operationalStateList ?? [
        { operationalStateId: RvcOperationalState.OperationalState.Stopped, operationalStateLabel: 'Stopped' },
        { operationalStateId: RvcOperationalState.OperationalState.Running, operationalStateLabel: 'Running' },
        { operationalStateId: RvcOperationalState.OperationalState.Paused, operationalStateLabel: 'Paused' },
        { operationalStateId: RvcOperationalState.OperationalState.Error, operationalStateLabel: 'Error' },
        { operationalStateId: RvcOperationalState.OperationalState.SeekingCharger, operationalStateLabel: 'SeekingCharger' }, // Y RVC Pause Compatibility N RVC Resume Compatibility
        { operationalStateId: RvcOperationalState.OperationalState.Charging, operationalStateLabel: 'Charging' }, // N RVC Pause Compatibility Y RVC Resume Compatibility
        { operationalStateId: RvcOperationalState.OperationalState.Docked, operationalStateLabel: 'Docked' }, // N RVC Pause Compatibility Y RVC Resume Compatibility
      ],
      operationalState: operationalState ?? RvcOperationalState.OperationalState.Docked,
      operationalError: operationalError ?? { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' },
    });
    return this;
  }
}

export class MatterbridgeRvcRunModeServer extends RvcRunModeServer {
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: RvcRunModeServer.id, attributes: this.state, endpoint: this.endpoint });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    if (!supported) {
      device.log.error(`MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    this.state.currentMode = request.newMode;
    if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Cleaning)) {
      device.log.debug('MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running');
      this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Running' };
    } else if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Idle)) {
      device.log.debug('MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked');
      this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Docked;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Docked' };
    }
    device.log.debug(`MatterbridgeRvcRunModeServer changeToMode called with newMode ${request.newMode} => ${supported.label}`);
    this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

export class MatterbridgeRvcCleanModeServer extends RvcCleanModeServer {
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: RvcCleanModeServer.id, attributes: this.state, endpoint: this.endpoint });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    if (!supported) {
      device.log.error(`MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    this.state.currentMode = request.newMode;
    device.log.debug(`MatterbridgeRvcCleanModeServer changeToMode called with newMode ${request.newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

export class MatterbridgeRvcOperationalStateServer extends RvcOperationalStateServer {
  override pause(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('pause', { request: {}, cluster: RvcOperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle');
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Paused;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override resume(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resume (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('resume', { request: {}, cluster: RvcOperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning');
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 2; // RvcRunMode.ModeTag.Cleaning
    this.state.operationalState = RvcOperationalState.OperationalState.Running;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override goHome(): MaybePromise<OperationalState.OperationalCommandResponse> {
    // const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`GoHome (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('goHome', { request: {}, cluster: RvcOperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle');
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Docked;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }
}
