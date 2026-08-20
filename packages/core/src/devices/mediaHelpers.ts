/**
 * @file packages/core/src/devices/mediaHelpers.ts
 * @description This file contains the Matterbridge server behaviors shared by Chapter 10 Media Device Types.
 * @author Luca Liguori
 * @created 2026-08-20
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

/* oxlint-disable typescript/no-unsafe-type-assertion */

// @matter
import type { Behavior } from '@matter/node';
import { AccountLoginClient } from '@matter/node/behaviors/account-login';
import { ApplicationBasicClient, ApplicationBasicServer } from '@matter/node/behaviors/application-basic';
import { ApplicationLauncherClient, ApplicationLauncherServer } from '@matter/node/behaviors/application-launcher';
import { AudioOutputClient } from '@matter/node/behaviors/audio-output';
import { ChannelClient } from '@matter/node/behaviors/channel';
import { ContentAppObserverClient } from '@matter/node/behaviors/content-app-observer';
import { ContentControlClient } from '@matter/node/behaviors/content-control';
import { ContentLauncherClient, ContentLauncherServer } from '@matter/node/behaviors/content-launcher';
import { KeypadInputClient, KeypadInputServer } from '@matter/node/behaviors/keypad-input';
import { LevelControlClient } from '@matter/node/behaviors/level-control';
import { LowPowerClient } from '@matter/node/behaviors/low-power';
import { MediaInputClient } from '@matter/node/behaviors/media-input';
import { MediaPlaybackClient, MediaPlaybackServer } from '@matter/node/behaviors/media-playback';
import { MessagesClient } from '@matter/node/behaviors/messages';
import { OnOffClient } from '@matter/node/behaviors/on-off';
import { TargetNavigatorClient } from '@matter/node/behaviors/target-navigator';
import { WakeOnLanClient } from '@matter/node/behaviors/wake-on-lan';
import { getClusterNameById } from '@matter/types/cluster';
import { AccountLogin } from '@matter/types/clusters/account-login';
import { ApplicationBasic } from '@matter/types/clusters/application-basic';
import { ApplicationLauncher } from '@matter/types/clusters/application-launcher';
import { AudioOutput } from '@matter/types/clusters/audio-output';
import { Channel } from '@matter/types/clusters/channel';
import { ContentAppObserver } from '@matter/types/clusters/content-app-observer';
import { ContentControl } from '@matter/types/clusters/content-control';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { LevelControl } from '@matter/types/clusters/level-control';
import { LowPower } from '@matter/types/clusters/low-power';
import { MediaInput } from '@matter/types/clusters/media-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { Messages } from '@matter/types/clusters/messages';
import { OnOff } from '@matter/types/clusters/on-off';
import { TargetNavigator } from '@matter/types/clusters/target-navigator';
import { WakeOnLan } from '@matter/types/clusters/wake-on-lan';
import type { ClusterId, VendorId } from '@matter/types/datatype';

// Matterbridge
import { MatterbridgeBindingServer } from '../behaviors/bindingServer.js';
import { MatterbridgeServer } from '../behaviors/matterbridgeServer.js';
import { MatterbridgeOnOffServer } from '../behaviors/onOffServer.js';
import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { lowercaseFirstLetter } from '../matterbridgeEndpointHelpers.js';

/**
 * MediaPlayback server that forwards playback commands to the Matterbridge command handler and tracks state.
 *
 * @remarks Used by BasicVideoPlayer and CastingVideoPlayer.
 */
export class MatterbridgeMediaPlaybackServer extends MediaPlaybackServer {
  /**
   * Initializes the server and hooks on/off changes.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeMediaPlaybackServer initialized: currentState is ${this.state.currentState}`);
    // oxlint-disable-next-line typescript/unbound-method
    this.reactTo(this.agent.get(MatterbridgeOnOffServer.with()).events.onOff$Changed, this.handleOnOffChange);
  }

  protected handleOnOffChange(_onOff: boolean): void {
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (this.endpoint.stateOf(MatterbridgeOnOffServer.with()).onOff) this.state.currentState = MediaPlayback.PlaybackState.Playing;
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (this.endpoint.stateOf(MatterbridgeOnOffServer.with()).onOff) this.state.currentState = MediaPlayback.PlaybackState.Paused;
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    if (this.endpoint.stateOf(MatterbridgeOnOffServer.with()).onOff) this.state.currentState = MediaPlayback.PlaybackState.NotPlaying;
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof MediaPlayback)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: MediaPlayback.Status.Success };
  }
}

/**
 * KeypadInput server that forwards key events to the Matterbridge command handler.
 *
 * @remarks Used by BasicVideoPlayer, CastingVideoPlayer and ContentApp.
 */
export class MatterbridgeKeypadInputServer extends KeypadInputServer {
  /**
   * Initializes the server.
   */
  override initialize(): void {
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

/**
 * ContentLauncher server used to launch content on a Casting Video Player.
 *
 * @remarks The `launchContentApp` and `launchUrl` commands are not forwarded to the Matterbridge command handler:
 * this server only logs on initialization. Used by CastingVideoPlayer.
 */
export class MatterbridgeContentLauncherServer extends ContentLauncherServer {
  /**
   * Initializes the server.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeContentLauncherServer initialized`);
  }
}

/**
 * ApplicationBasic server exposing Content App identification attributes.
 *
 * @remarks The ApplicationBasic cluster has no commands, so this server only logs on initialization. Used by
 * ContentApp.
 */
export class MatterbridgeApplicationBasicServer extends ApplicationBasicServer {
  /**
   * Initializes the server.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeApplicationBasicServer initialized`);
  }
}

/**
 * ApplicationLauncher server that forwards launch/stop/hide commands to the Matterbridge command handler. Used by
 * ContentApp.
 */
export class MatterbridgeApplicationLauncherServer extends ApplicationLauncherServer {
  /**
   * Initializes the server.
   */
  override initialize(): void {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeApplicationLauncherServer initialized`);
  }

  /**
   * Handles the ApplicationLauncher `LaunchApp` command.
   *
   * @param {ApplicationLauncher.LaunchAppRequest} request - Launch request payload.
   * @returns {ApplicationLauncher.LauncherResponse} Command response with status.
   */
  override async launchApp(request: ApplicationLauncher.LaunchAppRequest): Promise<ApplicationLauncher.LauncherResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`LaunchApp (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ApplicationLauncher.launchApp', {
      command: 'launchApp',
      request,
      cluster: ApplicationLauncherServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ApplicationLauncher)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: ApplicationLauncher.Status.Success };
  }

  /**
   * Handles the ApplicationLauncher `StopApp` command.
   *
   * @param {ApplicationLauncher.StopAppRequest} request - Stop request payload.
   * @returns {ApplicationLauncher.LauncherResponse} Command response with status.
   */
  override async stopApp(request: ApplicationLauncher.StopAppRequest): Promise<ApplicationLauncher.LauncherResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`StopApp (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ApplicationLauncher.stopApp', {
      command: 'stopApp',
      request,
      cluster: ApplicationLauncherServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ApplicationLauncher)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: ApplicationLauncher.Status.Success };
  }

  /**
   * Handles the ApplicationLauncher `HideApp` command.
   *
   * @param {ApplicationLauncher.HideAppRequest} request - Hide request payload.
   * @returns {ApplicationLauncher.LauncherResponse} Command response with status.
   */
  override async hideApp(request: ApplicationLauncher.HideAppRequest): Promise<ApplicationLauncher.LauncherResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`HideApp (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ApplicationLauncher.hideApp', {
      command: 'hideApp',
      request,
      cluster: ApplicationLauncherServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ApplicationLauncher)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return { status: ApplicationLauncher.Status.Success };
  }
}

/**
 * Creates a default Media Playback Cluster Server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 * @param {MediaPlayback.PlaybackState} currentState - The current state of the video player.
 * @param {boolean} [extendedCommands] - Whether to also enable the Next, Previous, SkipForward and SkipBackward
 * commands (used by BasicVideoPlayer but not by CastingVideoPlayer).
 */
export function createDefaultMediaPlaybackClusterServer(endpoint: MatterbridgeEndpoint, currentState: MediaPlayback.PlaybackState, extendedCommands = false): void {
  endpoint.behaviors.require(
    extendedCommands
      ? MatterbridgeMediaPlaybackServer.enable({ commands: { next: true, previous: true, skipForward: true, skipBackward: true } })
      : MatterbridgeMediaPlaybackServer,
    { currentState },
  );
}

/**
 * Creates a default Keypad Input Cluster Server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 */
export function createDefaultKeypadInputClusterServer(endpoint: MatterbridgeEndpoint): void {
  endpoint.behaviors.require(MatterbridgeKeypadInputServer, {
    // No attributes to initialize
  });
}

/**
 * Creates a default Content Launcher Cluster Server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 */
export function createDefaultContentLauncherClusterServer(endpoint: MatterbridgeEndpoint): void {
  endpoint.behaviors.require(MatterbridgeContentLauncherServer, {
    // No attributes to initialize
  });
}

/**
 * Creates a default Application Launcher Cluster Server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 */
export function createDefaultApplicationLauncherClusterServer(endpoint: MatterbridgeEndpoint): void {
  endpoint.behaviors.require(MatterbridgeApplicationLauncherServer, {
    currentApp: null,
  });
}

/**
 * Creates a default Application Basic Cluster Server on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 * @param {string} applicationName - Human readable name of the Content App assigned by the vendor.
 * @param {number} catalogVendorId - Connectivity Standards Alliance issued vendor ID for the catalog.
 * @param {string} applicationId - Application identifier, unique within the catalog.
 * @param {ApplicationBasic.ApplicationStatus} status - Current running status of the application.
 * @param {string} applicationVersion - Human readable version of the Content App assigned by the vendor.
 * @param {VendorId[]} allowedVendorList - List of vendor IDs allowed to interact with the Content App.
 */
export function createDefaultApplicationBasicClusterServer(
  endpoint: MatterbridgeEndpoint,
  applicationName: string,
  catalogVendorId: number,
  applicationId: string,
  status: ApplicationBasic.ApplicationStatus,
  applicationVersion: string,
  allowedVendorList: VendorId[],
): void {
  endpoint.behaviors.require(MatterbridgeApplicationBasicServer, {
    applicationName,
    application: new ApplicationBasic.Application({ catalogVendorId, applicationId }),
    status,
    applicationVersion,
    allowedVendorList,
  });
}

/**
 * Client Behavior.Type for every Chapter 10 cluster that can appear as a required or optional client cluster on
 * CastingVideoClient, VideoRemoteControl or ContentApp: OnOff, KeypadInput, MediaPlayback, ContentLauncher,
 * ApplicationBasic, LevelControl, Messages, WakeOnLan, Channel, TargetNavigator, MediaInput, LowPower, AudioOutput,
 * ApplicationLauncher, AccountLogin, ContentControl and ContentAppObserver.
 *
 * @remarks matterbridgeEndpointHelpers.ts's `getBehaviourTypeFromClusterClientId` only maps chapters 4-9 (chapters
 * 10-16 are covered through single-class device implementations), so `addRequiredClusterClients()` /
 * `createDefaultBindingClusterServer()` cannot resolve these client behaviors on their own. This map, together
 * with {@link createDefaultMediaBindingClusterServer}, follows the same pattern used by the
 * matterbridge-example-camera plugin (Doorbell's Chime client cluster): require MatterbridgeBindingServer directly
 * and populate `endpoint.type.clientClusters` by hand. Keep this map in sync whenever a Chapter 10 device type's
 * client cluster list changes.
 */
const mediaClientBehaviors = new Map<ClusterId, Behavior.Type>([
  [OnOff.id, OnOffClient],
  [KeypadInput.id, KeypadInputClient],
  [MediaPlayback.id, MediaPlaybackClient],
  [ContentLauncher.id, ContentLauncherClient],
  [ApplicationBasic.id, ApplicationBasicClient],
  [LevelControl.id, LevelControlClient],
  [Messages.id, MessagesClient],
  [WakeOnLan.id, WakeOnLanClient],
  [Channel.id, ChannelClient],
  [TargetNavigator.id, TargetNavigatorClient],
  [MediaInput.id, MediaInputClient],
  [LowPower.id, LowPowerClient],
  [AudioOutput.id, AudioOutputClient],
  [ApplicationLauncher.id, ApplicationLauncherClient],
  [AccountLogin.id, AccountLoginClient],
  [ContentControl.id, ContentControlClient],
  [ContentAppObserver.id, ContentAppObserverClient],
]);

/**
 * Creates a default Binding Cluster Server on the given endpoint for Chapter 10 client-only devices
 * (CastingVideoClient, VideoRemoteControl) and populates `endpoint.type.clientClusters` for each cluster ID with
 * a known client Behavior.Type.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 * @param {ClusterId[]} clientList - The list of client cluster IDs to advertise (must be a subset of the clusters
 * mapped in {@link mediaClientBehaviors}).
 */
export function createDefaultMediaBindingClusterServer(endpoint: MatterbridgeEndpoint, clientList: ClusterId[]): void {
  endpoint.behaviors.require(MatterbridgeBindingServer, { clientList });
  for (const clusterId of clientList) {
    const client = mediaClientBehaviors.get(clusterId);
    if (client) endpoint.type.clientClusters[lowercaseFirstLetter(getClusterNameById(clusterId))] ??= client;
  }
}

/**
 * Power source type for a Chapter 10 media device. `'None'` skips the Power Source cluster (and the `powerSource`
 * device type) entirely.
 */
export type MediaPowerSourceType = 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

/**
 * Creates the default Power Source Cluster Server matching `powerSourceType` on the given endpoint.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to configure.
 * @param {MediaPowerSourceType} powerSourceType - The power source type to create. `'None'` is a no-op: pair the
 * endpoint with just the device type (no `powerSource`) when using it.
 */
export function createDefaultMediaPowerSourceClusterServer(endpoint: MatterbridgeEndpoint, powerSourceType: MediaPowerSourceType): void {
  switch (powerSourceType) {
    case 'Rechargeable':
      endpoint.createDefaultPowerSourceRechargeableBatteryClusterServer();
      break;
    case 'Replaceable':
      endpoint.createDefaultPowerSourceReplaceableBatteryClusterServer();
      break;
    case 'Battery':
      endpoint.createDefaultPowerSourceBatteryClusterServer();
      break;
    case 'Wired':
      endpoint.createDefaultPowerSourceWiredClusterServer();
      break;
    case 'None':
      break;
    // No default
  }
}
