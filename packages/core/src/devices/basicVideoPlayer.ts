/**
 * @file packages/core/src/devices/basicVideoPlayer.ts
 * @description This file contains the BasicVideoPlayer class.
 * @author Luca Liguori
 * @created 2026-01-25
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

// @matter
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import type { EndpointNumber } from '@matter/types/datatype';

// Matterbridge
import { basicVideoPlayer, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import {
  createDefaultKeypadInputClusterServer,
  createDefaultMediaPlaybackClusterServer,
  createDefaultMediaPowerSourceClusterServer,
  type MediaPowerSourceType,
} from './mediaHelpers.js';

/**
 * Options for configuring an {@link BasicVideoPlayer} instance.
 */
export interface BasicVideoPlayerOptions {
  /** Initial On/Off state. */
  onOff?: boolean;
  /** Initial media playback state. */
  playbackState?: MediaPlayback.PlaybackState;
  /** Power source type. `'None'` omits the Power Source cluster entirely. */
  powerSourceType?: MediaPowerSourceType;
  /** Stable storage key for the endpoint. Defaults to `${name}-${serial}` with spaces removed. */
  id?: string;
  /** Explicit endpoint number. */
  number?: EndpointNumber;
}

/**
 * Matterbridge endpoint representing a basic video player device.
 */
export class BasicVideoPlayer extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the BasicVideoPlayer class.
   *
   * A Video Player (either Basic or Casting) represents a device that is able to play media to a physical
   * output or to a display screen which is part of the device.
   *
   * @param {string} name - The name of the video player.
   * @param {string} serial - The serial number of the video player.
   * @param {BasicVideoPlayerOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - onOff: false
   *  - playbackState: NotPlaying
   *  - powerSourceType: 'Wired'
   *
   * @returns {BasicVideoPlayer} The BasicVideoPlayer instance.
   *
   * @remarks Not supported by Google Home.
   */
  constructor(name: string, serial: string, options: BasicVideoPlayerOptions = {}) {
    const { onOff = false, playbackState = MediaPlayback.PlaybackState.NotPlaying, powerSourceType = 'Wired' } = options;
    super(powerSourceType === 'None' ? [basicVideoPlayer] : [basicVideoPlayer, powerSource], {
      id: options.id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number: options.number,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Basic Video Player');
    createDefaultMediaPowerSourceClusterServer(this, powerSourceType);
    this.createOnOffClusterServer(onOff);
    createDefaultMediaPlaybackClusterServer(this, playbackState, true);
    createDefaultKeypadInputClusterServer(this);
  }
}
