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
import { KeypadInputServer } from '@matter/node/behaviors/keypad-input';
import { MediaPlaybackServer } from '@matter/node/behaviors/media-playback';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';

// Matterbridge
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeOnOffServer } from '../behaviors/onOffServer.js';
import { basicVideoPlayer, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';

/**
 * Options for configuring an {@link BasicVideoPlayer} instance.
 *
 * All temperatures in °C. Typical valid range 0–50 unless otherwise noted.
 */
export interface BasicVideoPlayerOptions {
  /** Device state */
  onOff?: boolean;
  playbackState?: MediaPlayback.PlaybackState;
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
    this.behaviors.require(
      MatterbridgeMediaPlaybackServer.enable({
        commands: { next: true, previous: true, skipForward: true, skipBackward: true },
      }),
      {
        currentState,
      },
    );
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

/**
 * MediaPlayback server that forwards playback commands and tracks state.
 */
export class MatterbridgeMediaPlaybackServer extends MediaPlaybackServer {
  /**
   * Initializes the server and hooks on/off changes.
   */
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMediaPlaybackServer initialized: currentState is ${this.state.currentState}`);
    this.reactTo(this.agent.get(MatterbridgeOnOffServer).events.onOff$Changed, this.handleOnOffChange);
  }

  protected handleOnOffChange(_onOff: boolean) {
    this.state.currentState = MediaPlayback.PlaybackState.NotPlaying;
  }

  /**
   * Handles the MediaPlayback `Play` command.
   *
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async play(): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Play (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.play', {
      command: 'play',
      request: {},
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (this.endpoint.stateOf(MatterbridgeOnOffServer).onOff === true) this.state.currentState = MediaPlayback.PlaybackState.Playing;
    return { status: MediaPlayback.Status.Success };
  }

  /**
   * Handles the MediaPlayback `Pause` command.
   *
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async pause(): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.pause', {
      command: 'pause',
      request: {},
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (this.endpoint.stateOf(MatterbridgeOnOffServer).onOff === true) this.state.currentState = MediaPlayback.PlaybackState.Paused;
    return { status: MediaPlayback.Status.Success };
  }

  /**
   * Handles the MediaPlayback `Stop` command.
   *
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async stop(): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.stop', {
      command: 'stop',
      request: {},
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (this.endpoint.stateOf(MatterbridgeOnOffServer).onOff === true) this.state.currentState = MediaPlayback.PlaybackState.NotPlaying;
    return { status: MediaPlayback.Status.Success };
  }

  /**
   * Handles the MediaPlayback `Previous` command.
   *
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async previous(): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Previous (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.previous', {
      command: 'previous',
      request: {},
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: MediaPlayback.Status.Success };
  }

  /**
   * Handles the MediaPlayback `Next` command.
   *
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async next(): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Next (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.next', {
      command: 'next',
      request: {},
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: MediaPlayback.Status.Success };
  }

  /**
   * Handles the MediaPlayback `SkipForward` command.
   *
   * @param {MediaPlayback.SkipForwardRequest} request - Skip forward request payload.
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async skipForward(request: MediaPlayback.SkipForwardRequest): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SkipForward (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.skipForward', {
      command: 'skipForward',
      request,
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: MediaPlayback.Status.Success };
  }

  /**
   * Handles the MediaPlayback `SkipBackward` command.
   *
   * @param {MediaPlayback.SkipBackwardRequest} request - Skip backward request payload.
   * @returns {MediaPlayback.PlaybackResponse} Command response with status.
   */
  override async skipBackward(request: MediaPlayback.SkipBackwardRequest): Promise<MediaPlayback.PlaybackResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SkipBackward (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('MediaPlayback.skipBackward', {
      command: 'skipBackward',
      request,
      cluster: MediaPlaybackServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: MediaPlayback.Status.Success };
  }
}

/**
 * KeypadInput server that forwards key events to the Matterbridge command handler.
 */
export class MatterbridgeKeypadInputServer extends KeypadInputServer {
  /**
   * Initializes the server.
   */
  override initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeKeypadInputServer initialized`);
  }

  /**
   * Handles the KeypadInput `SendKey` command.
   *
   * @param {KeypadInput.SendKeyRequest} request - Key request payload.
   * @returns {KeypadInput.SendKeyResponse} Command response with status.
   */
  override async sendKey(request: KeypadInput.SendKeyRequest): Promise<KeypadInput.SendKeyResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`SendKey keyCode ${request.keyCode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('KeypadInput.sendKey', {
      command: 'sendKey',
      request,
      cluster: KeypadInputServer.id,
      attributes: {},
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: KeypadInput.Status.Success };
  }
}
