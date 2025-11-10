/**
 * @description Speaker device class controlling mute (On/Off) and volume level (Level Control).
 * @file src/devices/speaker.ts
 * @author Luca Liguori
 * @created 2025-09-04
 * @version 1.0.0
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

// matter clusters
import { OnOff } from '@matter/types/clusters/on-off';
import { LevelControl } from '@matter/types/clusters/level-control';

// matterbridge
import { speakerDevice } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';

/**
 * Represents a Speaker endpoint (Device Type 0x0022) exposing mute (OnOff) and volume (LevelControl).
 *
 * Mapping:
 *  - OnOff TRUE  => audio unmuted
 *  - OnOff FALSE => audio muted
 *  - LevelControl.currentLevel (1..254) => volume (linear map to 0..100%)
 *
 * Edge cases:
 *  - Volume < 1 coerced to 1.
 *  - Volume > 254 coerced to 254.
 *  - Non‑finite volume falls back to 128 (≈ mid level).
 */
export class Speaker extends MatterbridgeEndpoint {
  /**
   * Create Speaker endpoint.
   *
   * @param {string} name   Human readable device name.
   * @param {string} serial Unique serial (used to derive storage key).
   * @param {boolean} muted Initial muted state (true => unmuted, default true if omitted).
   * @param {number} volume Initial volume (1..254, coerced; default 128 ≈ 50% if omitted).
   * @returns {Speaker} New speaker instance.
   *
   * @remarks Supported by:
   * - SmartThings (OnOff mute, LevelControl volume)
   * - Google Home (OnOff mute, LevelControl volume)
   */
  constructor(name: string, serial: string, muted: boolean = false, volume: number = 128) {
    // sanitize volume
    if (!Number.isFinite(volume)) volume = 128;
    if (volume < 1) volume = 1;
    if (volume > 254) volume = 254;

    super([speakerDevice], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` }, true);
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Speaker');
    // On/Off used for mute state (TRUE => unmuted) - using no features
    this.createOnOffClusterServer(!muted);
    // LevelControl for volume - using no features
    this.createLevelControlClusterServer(volume);
  }

  /**
   * Set mute state (true => muted / audio off).
   *
   * Edge cases:
   *  - Strict boolean; caller must pass boolean (TS enforces).
   *
   * @param {boolean} muted Desired mute state (true => muted, false => unmuted).
   * @returns {Promise<void>} Resolves when attribute is updated.
   */
  async setMuted(muted: boolean): Promise<void> {
    await this.setAttribute(OnOff.Cluster.id, 'onOff', !muted);
  }

  /**
   * Get mute state.
   *
   * @returns {boolean} TRUE when muted, FALSE when unmuted.
   */
  isMuted(): boolean {
    return !this.getAttribute(OnOff.Cluster.id, 'onOff');
  }

  /**
   * Set volume level (1..254).
   *
   * Edge cases:
   *  - Non‑finite input ignored.
   *  - <1 coerced to 1.
   *  - >254 coerced to 254.
   *
   * @param {number} level Raw level (1..254 recommended, coerced if outside range).
   * @returns {Promise<void>} Resolves when attribute is updated.
   */
  async setVolume(level: number): Promise<void> {
    if (!Number.isFinite(level)) return;
    if (level < 1) level = 1;
    if (level > 254) level = 254;
    await this.setAttribute(LevelControl.Cluster.id, 'currentLevel', level);
  }

  /**
   * Get current volume.
   *
   * @returns {number} Current level (1..254).
   */
  getVolume(): number {
    return this.getAttribute(LevelControl.Cluster.id, 'currentLevel');
  }
}
