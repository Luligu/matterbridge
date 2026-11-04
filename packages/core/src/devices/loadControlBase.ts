/**
 * @file packages/core/src/devices/loadControlBase.ts
 * @description Shared base class of the On/Off and Dimmable Plug-in Unit and Mounted Load Control device classes (Matter 1.6.1 § 5.1 - 5.4).
 * @author Luca Liguori
 * @created 2026-11-03
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

// @matter
import type { AtLeastOne } from '@matter/general';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import type { EndpointNumber } from '@matter/types/datatype';
import type { Semtag } from '@matter/types/globals';

// Matterbridge
import type { DeviceTypeDefinition } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Options shared by the On/Off and Dimmable Plug-in Unit and Mounted Load Control device classes.
 */
export interface LoadControlOptions {
  /** Initial OnOff state (true => load powered on). Defaults to `false`. */
  onOff?: boolean;
  /** OnOff StartUpOnOff attribute. Defaults to `null` (restore the previous state). */
  startUpOnOff?: OnOff.StartUpOnOff | null;
  /** Initial Level Control CurrentLevel (coerced to 1..254, Matter 1.6.1 § 5.1.6). Defaults to 254. Ignored without the Level Control cluster. */
  currentLevel?: number;
  /** Level Control OnLevel attribute (1..254, or `null` to use the previous level). Defaults to `null`. Ignored without the Level Control cluster. */
  onLevel?: number | null;
  /** Level Control StartUpCurrentLevel attribute (or `null` to restore the previous level). Defaults to `null`. Ignored without the Level Control cluster. */
  startUpCurrentLevel?: number | null;
  /** Semantic tags for endpoint disambiguation. */
  tagList?: Semtag[];
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Coerces a level to the 1..254 range required by Matter 1.6.1 § 5.1.6 (CurrentLevel 1 to 254, MinLevel 1, MaxLevel 254).
 *
 * @param {number} level - The level to coerce.
 * @returns {number} The rounded level clamped to 1..254.
 */
function coerceLevel(level: number): number {
  return Math.min(254, Math.max(1, Math.round(level)));
}

/**
 * Shared base class of the On/Off and Dimmable Plug-in Unit and Mounted Load Control device classes.
 *
 * Matter 1.6.1 § 5.1.5 - 5.4.5: Identify (with TriggerEffect), Groups, On/Off (feature Lighting) and Scenes Management
 * (with CopyScene) are mandatory. Level Control (features OnOff and Lighting, MinLevel 1, MaxLevel 254) is optional for the
 * On/Off device types and mandatory for the Dimmable device types. The load is always mains powered (wired Power Source).
 */
export abstract class LoadControlBase extends MatterbridgeEndpoint {
  /**
   * Creates the endpoint and configures the clusters required by the device type.
   *
   * @param {AtLeastOne<DeviceTypeDefinition>} definitions - The device types of the endpoint, the first being the main device type.
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {string} productName - BasicInformation product name.
   * @param {boolean} levelControl - Whether to add the Level Control cluster.
   * @param {LoadControlOptions} options - Optional configuration values. Missing fields use defaults.
   */
  protected constructor(definitions: AtLeastOne<DeviceTypeDefinition>, name: string, serial: string, productName: string, levelControl: boolean, options: LoadControlOptions) {
    super(definitions, { id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`, number: options.number, tagList: options.tagList });

    this.createDefaultIdentifyClusterServer();
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, productName);
    this.createDefaultPowerSourceWiredClusterServer();
    // Matter 1.6.1 § 5.1.5: Groups and Scenes Management are mandatory.
    this.createDefaultGroupsClusterServer();
    this.createDefaultScenesManagementClusterServer();
    // Matter 1.6.1 § 5.1.6: On/Off is mandatory with the Lighting feature.
    this.createDefaultOnOffClusterServer(options.onOff ?? false, false, 0, 0, options.startUpOnOff ?? null);
    // Matter 1.6.1 § 5.1.6: Level Control has the OnOff and Lighting features, CurrentLevel 1 to 254, MinLevel 1 and MaxLevel 254.
    if (levelControl) {
      this.createDefaultLevelControlClusterServer(coerceLevel(options.currentLevel ?? 254), 1, 254, options.onLevel ?? null, options.startUpCurrentLevel ?? null);
    }
  }

  /**
   * Sets the OnOff `onOff` attribute (true => load powered on, false => load powered off).
   *
   * @param {boolean} onOff - Desired OnOff state.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setOnOff(onOff: boolean): Promise<void> {
    await this.setAttribute(OnOff, 'onOff', onOff);
  }

  /**
   * Gets the OnOff `onOff` attribute.
   *
   * @returns {boolean | undefined} TRUE when the load is powered on, FALSE when it is powered off.
   */
  getOnOff(): boolean | undefined {
    return this.getAttribute(OnOff, 'onOff');
  }

  /**
   * Sets the LevelControl `currentLevel` attribute. Ignored when the Level Control cluster is not present or the value is not finite.
   *
   * @param {number} level - Level, coerced to 1..254.
   * @returns {Promise<void>} Resolves when the attribute has been updated.
   */
  async setLevel(level: number): Promise<void> {
    if (!this.hasClusterServer(LevelControl) || !Number.isFinite(level)) return;
    await this.setAttribute(LevelControl, 'currentLevel', coerceLevel(level));
  }

  /**
   * Gets the LevelControl `currentLevel` attribute.
   *
   * @returns {number | null | undefined} The current level, or undefined when the Level Control cluster is not present.
   */
  getLevel(): number | null | undefined {
    if (!this.hasClusterServer(LevelControl)) return undefined;
    return this.getAttribute(LevelControl, 'currentLevel');
  }
}
