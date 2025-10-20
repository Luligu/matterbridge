/**
 * @description This file contains the Refrigerator class.
 * @file src/devices/refrigerator.ts
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
import { MaybePromise } from '@matter/general';
import { Semtag } from '@matter/types';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/types/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { RefrigeratorAndTemperatureControlledCabinetModeServer } from '@matter/node/behaviors/refrigerator-and-temperature-controlled-cabinet-mode';
import { RefrigeratorAlarmServer } from '@matter/node/behaviors/refrigerator-alarm';

// Matterbridge
import { powerSource, refrigerator, temperatureControlledCabinetCooler } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';

import { createLevelTemperatureControlClusterServer } from './temperatureControl.js';

export class Refrigerator extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Refrigerator class.
   *
   * @param {string} name - The name of the refrigerator.
   * @param {string} serial - The serial number of the refrigerator.
   *
   * @remarks
   * 13.2 A refrigerator represents a device that contains one or more cabinets that are capable of chilling or
   * freezing food. Examples of consumer products that MAY make use of this device type include refrigerators,
   * freezers, and wine coolers.
   * A refrigerator is always defined via endpoint composition.
   * - Use `addCabinet` to add one or more cabinets to the refrigerator.
   */
  constructor(name: string, serial: string) {
    super([refrigerator, powerSource], { uniqueStorageKey: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Refrigerator');
    this.createDefaultPowerSourceWiredClusterServer();
    this.addFixedLabel('composed', 'Refrigerator');
  }

  /**
   * Adds a Level Temperature Controlled Cabinet Cooler to the refrigerator.
   *
   * @param {string} name - The name of the cabinet.
   * @param {Semtag[]} tagList - The tagList associated with the cabinet.
   * @param {number} currentMode - The current mode of the cabinet. Defaults to 1 (which corresponds to 'Auto').
   * @param {RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[]} supportedModes - The supported modes for the cabinet. Defaults to 'Auto', 'RapidCool', and 'RapidFreeze'.
   * @param {number} selectedTemperatureLevel - The selected temperature level as an index of the supportedTemperatureLevels array. Defaults to 2 (which corresponds to 'Level 3').
   * @param {string[]} supportedTemperatureLevels - The list of supported temperature levels for the cabinet. Defaults to ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'].
   * @param {number} currentTemperature - The current temperature of the cabinet in degrees Celsius. Defaults to 1000 (which corresponds to 10.00 degrees Celsius).
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the cabinet.
   *
   * @remarks
   * 13.4.1 A Temperature Controlled Cabinet Cooler is a device that provides a cooled space for chilling food.
   * It is typically installed within a refrigerator.
   *
   * Example usage with specific namespace tags:
   * ```
   *  refrigerator.addCabinet('Refrigerator Top', [
   *    { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: 'Refrigerator Top' },
   *    { mfgCode: null, namespaceId: RefrigeratorTag.Refrigerator.namespaceId, tag: RefrigeratorTag.Refrigerator.tag, label: RefrigeratorTag.Refrigerator.label },
   *  ]);
   *  refrigerator.addCabinet('Freezer Bottom', [
   *    { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: 'Freezer Bottom' },
   *    { mfgCode: null, namespaceId: RefrigeratorTag.Freezer.namespaceId, tag: RefrigeratorTag.Freezer.tag, label: RefrigeratorTag.Freezer.label },
   *  ]);
   * ```
   */
  addCabinet(
    name: string,
    tagList: Semtag[],
    currentMode: number = 1,
    supportedModes: RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[] = [
      { label: 'Auto', mode: 1, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.Auto }] },
      { label: 'RapidCool', mode: 2, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.RapidCool }] },
      { label: 'RapidFreeze', mode: 3, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.RapidFreeze }] },
    ],
    selectedTemperatureLevel: number = 2,
    supportedTemperatureLevels: string[] = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'],
    currentTemperature: number = 1000, // Default to 10.00 degrees Celsius
  ): MatterbridgeEndpoint {
    const cabinet = this.addChildDeviceType(name, temperatureControlledCabinetCooler, { tagList }, true);
    cabinet.log.logName = name;
    cabinet.createDefaultIdentifyClusterServer();
    createLevelTemperatureControlClusterServer(cabinet, selectedTemperatureLevel, supportedTemperatureLevels);
    this.createDefaultRefrigeratorAndTemperatureControlledCabinetModeClusterServer(cabinet, currentMode, supportedModes);
    this.createDefaultRefrigeratorAlarmClusterServer(cabinet, false);
    cabinet.createDefaultTemperatureMeasurementClusterServer(currentTemperature);
    return cabinet;
  }

  /**
   * Creates a default RefrigeratorAndTemperatureControlledCabinetMode Cluster Server.
   *
   * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
   * @param {number} currentMode - The current mode of the oven.
   * @param {RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[]} supportedModes - The supported modes for the refrigerator and temperature controlled cabinet.
   *
   * @returns {MatterbridgeEndpoint} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - supportedModes is a fixed attribute. It cannot be changed at runtime.
   * - currentMode persists across reboots.
   */
  createDefaultRefrigeratorAndTemperatureControlledCabinetModeClusterServer(endpoint: MatterbridgeEndpoint, currentMode: number, supportedModes: RefrigeratorAndTemperatureControlledCabinetMode.ModeOption[]): MatterbridgeEndpoint {
    endpoint.behaviors.require(MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer, {
      supportedModes,
      currentMode,
    });
    return endpoint;
  }

  /**
   * Creates a default RefrigeratorAlarm Cluster Server.
   *
   * @param {MatterbridgeEndpoint} endpoint - The Matterbridge endpoint instance.
   * @param {boolean} doorOpen - Indicates if the refrigerator door is open.
   *
   * @returns {MatterbridgeEndpoint} The updated MatterbridgeEndpoint instance.
   */
  createDefaultRefrigeratorAlarmClusterServer(endpoint: MatterbridgeEndpoint, doorOpen: boolean = false): MatterbridgeEndpoint {
    endpoint.behaviors.require(RefrigeratorAlarmServer, {
      mask: { doorOpen: true },
      supported: { doorOpen: true },
      state: { doorOpen },
    });
    return endpoint;
  }

  /**
   * Sets the door open state for a specific cabinet.
   *
   * @param {string} cabinetName - The name of the cabinet.
   * @param {boolean} doorOpen - Indicates if the door is open.
   * @returns {MatterbridgeEndpoint | undefined} The updated MatterbridgeEndpoint instance or undefined if not found.
   */
  async setDoorOpenState(cabinetName: string, doorOpen: boolean): Promise<MatterbridgeEndpoint | undefined> {
    const endpoint = this.getChildEndpointByName(cabinetName);
    if (endpoint) {
      await endpoint.setAttribute('RefrigeratorAlarm', 'state', { doorOpen }, endpoint.log);
      return endpoint;
    }
  }

  /**
   * Triggers the notify event for door open state on a specific cabinet.
   *
   * @param {string} cabinetName - The name of the cabinet.
   * @param {boolean} doorOpen - Indicates if the door is open.
   * @returns {MatterbridgeEndpoint | undefined} The updated MatterbridgeEndpoint instance or undefined if not found.
   */
  async triggerDoorOpenState(cabinetName: string, doorOpen: boolean): Promise<MatterbridgeEndpoint | undefined> {
    const endpoint = this.getChildEndpointByName(cabinetName);
    if (endpoint) {
      if (doorOpen) {
        await endpoint.triggerEvent('RefrigeratorAlarm', 'notify', { active: { doorOpen: true }, inactive: { doorOpen: false }, state: { doorOpen: true }, mask: { doorOpen: true } }, endpoint.log);
      } else {
        await endpoint.triggerEvent('RefrigeratorAlarm', 'notify', { active: { doorOpen: false }, inactive: { doorOpen: true }, state: { doorOpen: false }, mask: { doorOpen: true } }, endpoint.log);
      }
      return endpoint;
    }
  }
}

// Server for RefrigeratorAndTemperatureControlledCabinetMode
export class MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer extends RefrigeratorAndTemperatureControlledCabinetModeServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info('MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer initialized');
  }
  override changeToMode(request: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const supportedMode = this.state.supportedModes.find((supportedMode) => supportedMode.mode === request.newMode);
    if (supportedMode) {
      device.log.info(`MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with mode ${supportedMode.mode} = ${supportedMode.label}`);
      this.state.currentMode = request.newMode;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
    } else {
      device.log.error(`MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber}) called with invalid mode ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.InvalidInMode, statusText: 'Invalid mode' };
    }
  }
}
