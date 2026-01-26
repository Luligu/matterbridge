/**
 * @description This file contains the BasicVideoPlayer class.
 * @file src/devices/basicVideoPlayer.ts
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
import { MaybePromise } from '@matter/general';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { MediaPlaybackServer } from '@matter/node/behaviors/media-playback';
import { KeypadInputServer } from '@matter/node/behaviors/keypad-input';

// Matterbridge
import { basicVideoPlayer, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeOnOffServer, MatterbridgeServer } from '../matterbridgeBehaviors.js';

/**
 * Options for configuring an {@link AirConditioner} instance.
 *
 * All temperatures in °C. Typical valid range 0–50 unless otherwise noted.
 */
export interface BasicVideoPlayerOptions {
  /** Device state */
  onOff?: boolean;
  playbackState?: MediaPlayback.PlaybackState;
}

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
   *
   * @returns {BasicVideoPlayer} The BasicVideoPlayer instance.
   *
   * @remarks Not supported by Google Home.
   */
  constructor(name: string, serial: string, options: BasicVideoPlayerOptions = {}) {
    const { onOff = false, playbackState = MediaPlayback.PlaybackState.NotPlaying } = options;
    super([basicVideoPlayer, powerSource], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Basic Video Player');
    this.createDefaultPowerSourceWiredClusterServer();
    this.createOnOffClusterServer(onOff);
    this.createDefaultMediaPlaybackClusterServer(playbackState);
    this.createDefaultKeypadInputClusterServer();
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
}

export class MatterbridgeMediaPlaybackServer extends MediaPlaybackServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMediaPlaybackServer initialized: currentState is ${this.state.currentState}`);
    this.reactTo(this.agent.get(MatterbridgeOnOffServer).events.onOff$Changed, this.handleOnOffChange);
  }

  protected handleOnOffChange(_onOff: boolean) {
    this.state.currentState = MediaPlayback.PlaybackState.NotPlaying;
  }

  override play(): MaybePromise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Play (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    if (this.endpoint.stateOf(MatterbridgeOnOffServer).onOff === true) this.state.currentState = MediaPlayback.PlaybackState.Playing;
    return { status: MediaPlayback.Status.Success };
  }

  override pause(): MaybePromise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    if (this.endpoint.stateOf(MatterbridgeOnOffServer).onOff === true) this.state.currentState = MediaPlayback.PlaybackState.Paused;
    return { status: MediaPlayback.Status.Success };
  }

  override stop(): MaybePromise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    if (this.endpoint.stateOf(MatterbridgeOnOffServer).onOff === true) this.state.currentState = MediaPlayback.PlaybackState.NotPlaying;
    return { status: MediaPlayback.Status.Success };
  }
}

export class MatterbridgeKeypadInputServer extends KeypadInputServer {
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeKeypadInputServer initialized`);
  }

  override sendKey(request: KeypadInput.SendKeyRequest): MaybePromise<KeypadInput.SendKeyResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SendKey keyCode ${request.keyCode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    return { status: KeypadInput.Status.Success };
  }
}
