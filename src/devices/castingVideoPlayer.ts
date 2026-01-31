/**
 * @description This file contains the CastingVideoPlayer class.
 * @file src/devices/castingVideoPlayer.ts
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

// Imports from @matter
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { ContentLauncherServer } from '@matter/node/behaviors/content-launcher';

// Matterbridge
import { castingVideoPlayer, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServer } from '../matterbridgeBehaviors.js';

import { MatterbridgeKeypadInputServer, MatterbridgeMediaPlaybackServer } from './basicVideoPlayer.js';

/**
 * Options for configuring an {@link AirConditioner} instance.
 *
 * All temperatures in °C. Typical valid range 0–50 unless otherwise noted.
 */
export interface CastingVideoPlayerOptions {
  /** Device state */
  onOff?: boolean;
  playbackState?: MediaPlayback.PlaybackState;
}

export class CastingVideoPlayer extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the CastingVideoPlayer class.
   *
   * A Video Player (either Basic or Casting) represents a device that is able to play media to a physical
   * output or to a display screen which is part of the device.
   *
   * @param {string} name - The name of the video player.
   * @param {string} serial - The serial number of the video player.
   * @param {CastingVideoPlayerOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - onOff: false
   *  - playbackState: NotPlaying
   *
   * @returns {CastingVideoPlayer} The CastingVideoPlayer instance.
   *
   * @remarks Not supported by Google Home.
   */
  constructor(name: string, serial: string, options: CastingVideoPlayerOptions = {}) {
    const { onOff = false, playbackState = MediaPlayback.PlaybackState.NotPlaying } = options;
    super([castingVideoPlayer, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Casting Video Player');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createOnOffClusterServer(onOff);
    this.createDefaultMediaPlaybackClusterServer(playbackState);
    this.createDefaultKeypadInputClusterServer();
    this.createDefaultContentLauncherClusterServer();
  }

  /**
   * Creates a default Media Playback Cluster Server.
   *
   * @param {MediaPlayback.PlaybackState} currentState - The current state of the video player.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultMediaPlaybackClusterServer(currentState: MediaPlayback.PlaybackState): this {
    this.behaviors.require(MatterbridgeMediaPlaybackServer, {
      currentState,
    });
    return this;
  }

  /**
   * Creates a default Keypad Input Cluster Server.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultKeypadInputClusterServer(): this {
    this.behaviors.require(MatterbridgeKeypadInputServer, {
      // No attributes to initialize
    });
    return this;
  }

  /**
   * Creates a default Keypad Input Cluster Server.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultContentLauncherClusterServer(): this {
    this.behaviors.require(MatterbridgeContentLauncherServer, {
      // No attributes to initialize
    });
    return this;
  }
}

export class MatterbridgeContentLauncherServer extends ContentLauncherServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeContentLauncherServer initialized`);
  }
}
