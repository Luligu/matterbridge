/**
 * @file packages/core/src/devices/mountedDimmableLoadControl.ts
 * @description Mounted Dimmable Load Control device class exposing OnOff and LevelControl (Matter 1.6.1 § 5.4).
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
import { dimmablePlugInUnit, mountedDimmableLoadControl, powerSource } from '../matterbridgeDeviceTypes.js';
import { LoadControlBase, type LoadControlOptions } from './loadControlBase.js';

/**
 * Options for configuring a {@link MountedDimmableLoadControl} instance.
 */
export interface MountedDimmableLoadControlOptions extends LoadControlOptions {
  /** Whether to add the subset device type Dimmable Plug-in Unit to the Descriptor DeviceTypeList for backward compatibility with older clients (RECOMMENDED by Matter 1.6.1 § 5.4). Defaults to `true`. */
  plugInUnitDeviceType?: boolean;
}

/**
 * Matterbridge endpoint representing a Mounted Dimmable Load Control (Device Type 0x0110).
 *
 * A fixed device that provides power to a load connected to it, and is capable of being switched on or off and have its level
 * adjusted (Matter 1.6.1 § 5.4). It is intended for any wall-mounted or hardwired dimmer-capable load controller.
 */
export class MountedDimmableLoadControl extends LoadControlBase {
  /**
   * Creates a MountedDimmableLoadControl endpoint and configures its default clusters.
   *
   * @param {string} name - Human-readable device name.
   * @param {string} serial - Device serial number.
   * @param {MountedDimmableLoadControlOptions} [options] - Optional configuration values. Missing fields use defaults.
   */
  constructor(name: string, serial: string, options: MountedDimmableLoadControlOptions = {}) {
    // Matter 1.6.1 § 5.4.5: Level Control is mandatory.
    super(
      options.plugInUnitDeviceType === false ? [mountedDimmableLoadControl, powerSource] : [mountedDimmableLoadControl, dimmablePlugInUnit, powerSource],
      name,
      serial,
      'Matterbridge Mounted Dimmable Load Control',
      true,
      options,
    );
  }
}
