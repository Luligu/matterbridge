/**
 * @file packages/core/src/devices/mountedOnOffControl.ts
 * @description Mounted On/Off Control device class exposing OnOff and optional LevelControl (Matter 1.6.1 § 5.3).
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
import { mountedOnOffControl, onOffPlugInUnit, powerSource } from '../matterbridgeDeviceTypes.js';
import { LoadControlBase, type LoadControlOptions } from './loadControlBase.js';

/**
 * Options for configuring a {@link MountedOnOffControl} instance.
 */
export interface MountedOnOffControlOptions extends LoadControlOptions {
  /** Whether to add the optional Level Control cluster (recommended by Matter 1.6.1 § 5.3.5 for grouping with dimmable lights). Defaults to `false`. */
  levelControl?: boolean;
  /** Whether to add the subset device type On/Off Plug-in Unit to the Descriptor DeviceTypeList for backward compatibility with older clients (RECOMMENDED by Matter 1.6.1 § 5.3). Defaults to `true`. */
  plugInUnitDeviceType?: boolean;
}

/**
 * Matterbridge endpoint representing a Mounted On/Off Control (Device Type 0x010F).
 *
 * A fixed device that provides power to another device or power circuit that is connected to it, and is capable of switching that
 * provided power on or off (Matter 1.6.1 § 5.3). It is intended for any wall-mounted or hardwired load controller.
 *
 * When the optional Level Control cluster is added, it SHALL NOT have any effect on the actual output except for the "with on/off"
 * commands that change the OnOff state (Matter 1.6.1 § 5.3.5).
 */
export class MountedOnOffControl extends LoadControlBase {
  /**
   * Creates a MountedOnOffControl endpoint and configures its default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {MountedOnOffControlOptions} [options] - Optional configuration values. Missing fields use defaults.
   */
  constructor(name: string, serial: string, options: MountedOnOffControlOptions = {}) {
    super(
      options.plugInUnitDeviceType === false ? [mountedOnOffControl, powerSource] : [mountedOnOffControl, onOffPlugInUnit, powerSource],
      name,
      serial,
      'Matterbridge Mounted On/Off Control',
      options.levelControl === true,
      options,
    );
  }
}
