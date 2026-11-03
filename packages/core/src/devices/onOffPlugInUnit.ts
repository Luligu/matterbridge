/**
 * @file packages/core/src/devices/onOffPlugInUnit.ts
 * @description On/Off Plug-in Unit device class exposing OnOff and optional LevelControl (Matter 1.6.1 § 5.1).
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

// Matterbridge
import { onOffPlugInUnit, powerSource } from '../matterbridgeDeviceTypes.js';
import { LoadControlBase, type LoadControlOptions } from './loadControlBase.js';

/**
 * Options for configuring an {@link OnOffPlugInUnit} instance.
 */
export interface OnOffPlugInUnitOptions extends LoadControlOptions {
  /** Whether to add the optional Level Control cluster (recommended by Matter 1.6.1 § 5.1.5 for grouping with dimmable lights). Defaults to `false`. */
  levelControl?: boolean;
}

/**
 * Matterbridge endpoint representing an On/Off Plug-in Unit (Device Type 0x010A).
 *
 * A device that provides power to another device that is plugged into it, and is capable of switching that provided power on or off
 * (Matter 1.6.1 § 5.1). For devices mounted permanently use `MountedOnOffControl`.
 *
 * When the optional Level Control cluster is added, it SHALL NOT have any effect on the actual output except for the "with on/off"
 * commands that change the OnOff state (Matter 1.6.1 § 5.1.5).
 */
export class OnOffPlugInUnit extends LoadControlBase {
  /**
   * Creates an OnOffPlugInUnit endpoint and configures its default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {OnOffPlugInUnitOptions} [options] - Optional configuration values. Missing fields use defaults.
   */
  constructor(name: string, serial: string, options: OnOffPlugInUnitOptions = {}) {
    super([onOffPlugInUnit, powerSource], name, serial, 'Matterbridge On/Off Plug-in Unit', options.levelControl === true, options);
  }
}
