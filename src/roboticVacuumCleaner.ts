/**
 * This file contains the RoboticVacuumCleaner class.
 *
 * @file roboticVacuumCleaner.ts
 * @author Luca Liguori
 * @date 2025-05-01
 * @version 1.0.1
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
 * limitations under the License. *
 */

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { roboticVacuumCleaner } from './matterbridgeDeviceTypes.js';
import { MatterbridgeServer, MatterbridgeServiceAreaServer } from './matterbridgeBehaviors.js';

// Matter.js
import { MaybePromise } from '@matter/main';
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

export class RoboticVacuumCleaner extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the RoboticVacuumCleaner class.
   *
   * @param {string} name - The name of the robotic vacuum cleaner.
   * @param {string} serial - The serial number of the robotic vacuum cleaner.
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
   */
  constructor(
    name: string,
    serial: string,
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
  ) {
    super(roboticVacuumCleaner, { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Robot Vacuum Cleaner')
      .createDefaultPowerSourceRechargeableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 5900)
      .createDefaultRvcRunModeClusterServer(currentRunMode, supportedRunModes)
      .createDefaultRvcCleanModeClusterServer(currentCleanMode, supportedCleanModes)
      .createDefaultRvcOperationalStateClusterServer(phaseList, currentPhase, operationalStateList, operationalState)
      .createDefaultServiceAreaClusterServer(supportedAreas, selectedAreas, currentArea);
  }

  /**
   * Creates a default RvcRunMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the RvcRunMode cluster. Defaults to 1 (Idle).
   * @param {RvcRunMode.ModeOption[]} [supportedModes] - The supported modes for the RvcRunMode cluster. Defaults to a predefined set of modes.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
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
   */
  createDefaultRvcCleanModeClusterServer(currentMode?: number, supportedModes?: RvcCleanMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeRvcCleanModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'Vacuum', mode: 1, modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }] },
        { label: 'Mop', mode: 2, modeTags: [{ value: RvcCleanMode.ModeTag.Mop }] },
        { label: 'Clean', mode: 3, modeTags: [{ value: RvcCleanMode.ModeTag.DeepClean }] },
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
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultServiceAreaClusterServer(supportedAreas?: ServiceArea.Area[], selectedAreas?: number[], currentArea?: number): this {
    this.behaviors.require(MatterbridgeServiceAreaServer, {
      supportedAreas: supportedAreas ?? [
        {
          areaId: 1,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Living', floorNumber: null, areaType: null }, landmarkInfo: null },
        },
        {
          areaId: 2,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: null, areaType: null }, landmarkInfo: null },
        },
        {
          areaId: 3,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: null, areaType: null }, landmarkInfo: null },
        },
        {
          areaId: 4,
          mapId: null,
          areaInfo: { locationInfo: { locationName: 'Bathroom', floorNumber: null, areaType: null }, landmarkInfo: null },
        },
      ],
      selectedAreas: selectedAreas ?? [],
      currentArea: currentArea ?? 1,
      estimatedEndTime: null,
    });
    return this;
  }

  /**
   * Creates a default RvcOperationalState Cluster Server.
   *
   * @param {string[] | null} [phaseList] - The list of phases for the RvcOperationalState cluster. Defaults to null.
   * @param {number | null} [currentPhase] - The current phase of the RvcOperationalState cluster. Defaults to null.
   * @param {RvcOperationalState.OperationalStateStruct[]} [operationalStateList] - The list of operational states for the RvcOperationalState cluster. Defaults to a predefined set of states.
   * @param {RvcOperationalState.OperationalState} [operationalState] - The current operational state of the RvcOperationalState cluster. Defaults to Docked.
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
  override changeToMode({ newMode }: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const supported = this.state.supportedModes.find((mode) => mode.mode === newMode);
    if (!supported) {
      device.log.error(`MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: ${newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    device.changeToMode({ newMode });
    this.state.currentMode = newMode;
    if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Cleaning)) {
      device.log.info('MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running');
      this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Running' };
    } else if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Idle)) {
      device.log.info('MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked');
      this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Docked;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Docked' };
    }
    device.log.info(`MatterbridgeRvcRunModeServer changeToMode called with newMode ${newMode} => ${supported.label}`);
    this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

export class MatterbridgeRvcCleanModeServer extends RvcCleanModeServer {
  override changeToMode({ newMode }: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const supported = this.state.supportedModes.find((mode) => mode.mode === newMode);
    if (!supported) {
      device.log.error(`MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: ${newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    device.changeToMode({ newMode });
    this.state.currentMode = newMode;
    device.log.info(`MatterbridgeRvcCleanModeServer changeToMode called with newMode ${newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

export class MatterbridgeRvcOperationalStateServer extends RvcOperationalStateServer {
  override pause(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.info('MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle');
    device.pause();
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Paused;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override resume(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.info('MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning');
    device.resume();
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 2; // RvcRunMode.ModeTag.Cleaning
    this.state.operationalState = RvcOperationalState.OperationalState.Running;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override goHome(): MaybePromise<OperationalState.OperationalCommandResponse> {
    // const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.info('MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle');
    device.goHome();
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Docked;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }
}
