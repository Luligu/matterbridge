/**
 * @file packages/core/src/devices/dimmablePlugInUnit.ts
 * @description Dimmable Plug-in Unit device class exposing OnOff and LevelControl (Matter 1.6.1 § 5.2).
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
import { dimmablePlugInUnit, powerSource } from '../matterbridgeDeviceTypes.js';
import { LoadControlBase, type LoadControlOptions } from './loadControlBase.js';

/**
 * Options for configuring a {@link DimmablePlugInUnit} instance.
 */
export type DimmablePlugInUnitOptions = LoadControlOptions;

/**
 * Matterbridge endpoint representing a Dimmable Plug-in Unit (Device Type 0x010B).
 *
 * A device that provides power to another device that is plugged into it, and is capable of being switched on or off and have its
 * level adjusted (Matter 1.6.1 § 5.2). For devices mounted permanently use `MountedDimmableLoadControl`.
 */
export class DimmablePlugInUnit extends LoadControlBase {
  /**
   * Creates a DimmablePlugInUnit endpoint and configures its default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {DimmablePlugInUnitOptions} [options] - Optional configuration values. Missing fields use defaults.
   */
  constructor(name: string, serial: string, options: DimmablePlugInUnitOptions = {}) {
    // Matter 1.6.1 § 5.2.5: Level Control is mandatory.
    super([dimmablePlugInUnit, powerSource], name, serial, 'Matterbridge Dimmable Plug-in Unit', true, options);
  }
}
