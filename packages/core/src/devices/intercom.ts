/**
 * @file packages/core/src/devices/intercom.ts
 * @description This file contains the Intercom class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-20
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

import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import type { EndpointNumber } from '@matter/types/datatype';
import { type Semtag, StreamUsage } from '@matter/types/globals';

import { createDefaultIntercomCameraAvStreamManagementClusterServer } from '../behaviors/cameraAvStreamManagementServer.js';
import { addChimeClient, addWebRtcTransportProviderClient, addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
import { createDefaultWebRtcTransportProviderClusterServer } from '../behaviors/webRtcTransportProviderServer.js';
import { createDefaultWebRtcTransportRequestorClusterServer } from '../behaviors/webRtcTransportRequestorServer.js';
import type { WeriftOfferOptions } from '../behaviors/weriftSession.js';
// Matterbridge
import { genericSwitch, intercom, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';

/**
 * Options for the mandatory Generic Switch child endpoint created by {@link Intercom}.
 */
export interface IntercomSwitchOptions {
  /** The name of the switch. Default: 'Switch' */
  name?: string;

  /** The tagList associated with the switch, for disambiguation when more switches are added with {@link Intercom.addSwitch}. Default: no tags */
  tagList?: Semtag[];

  /** The endpoint number of the switch child endpoint. Default: the next available endpoint number */
  number?: EndpointNumber;

  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. The Identify cluster is always created because it is a required server cluster for the Generic Switch device type. Default: Identify.IdentifyType.None */
  identifyType?: Identify.IdentifyType;
}

/**
 * Options for configuring an {@link Intercom} instance.
 */
export interface IntercomOptions extends MatterbridgeEndpointOptions {
  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. Default: Identify.IdentifyType.None (the Identify cluster will not be created) */
  identifyType?: Identify.IdentifyType;

  /** Power source type. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Indicates the maximum size, in bytes, of the content buffer used for pre-roll, queued transmissions and metadata */
  maxContentBufferSize?: number;
  /** Indicates the maximum network bandwidth, in bits per second, that the device would consume for the transmission of its media streams */
  maxNetworkBandwidth?: number;
  /** Indicates the list of stream usages that are supported by the intercom */
  supportedStreamUsages?: StreamUsage[];
  /** Indicates the ranked stream usage priorities; only usages found in supportedStreamUsages can be included */
  streamUsagePriorities?: StreamUsage[];
  /** Indicates the audio capabilities of the microphone in terms of the codec used, supported sample rates and the number of channels */
  microphoneCapabilities?: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the audio capabilities of the speaker in terms of the codec used, supported sample rates and the number of channels */
  speakerCapabilities?: CameraAvStreamManagement.AudioCapabilities;
  /** Indicates the type of two-way talk support the device has. Default: FullDuplex */
  twoWayTalkSupport?: CameraAvStreamManagement.TwoWayTalkSupportType;

  /** Options for the werift WebRTC peer connection used by the WebRtcTransportProvider cluster. Default: both media kinds enabled with source injection disabled */
  weriftOfferOptions?: WeriftOfferOptions;

  /** Options for the mandatory Generic Switch child endpoint. See {@link IntercomSwitchOptions} for the defaults */
  switchOptions?: IntercomSwitchOptions;
}

/**
 * Matterbridge endpoint representing an intercom device.
 * Matter specs 1.6.1 chapter 16.4.
 */
export class Intercom extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the Intercom class.
   *
   * An Intercom device provides two-way on demand communication facilities between devices (e.g. room to room
   * systems, or an entry door to individual units in a multi-tenant building). The CameraAvStreamManagement cluster
   * is created with the Audio and Speaker features, as required for genuine two-way audio (the Video and Snapshot
   * features are not present; see Camera for a device implementing those). Unlike Camera and Audio Doorbell, an
   * Intercom both hosts and invokes WebRtcTransportProvider and WebRtcTransportRequestor: the required
   * WebRtcTransportProvider and WebRtcTransportRequestor server clusters are created on this endpoint, and the
   * required WebRtcTransportProvider and WebRtcTransportRequestor client clusters are added automatically by
   * {@link addWebRtcTransportProviderClient}/{@link addWebRtcTransportRequestorClient}, so this endpoint can both
   * receive and solicit WebRTC offers to/from a peer intercom. The optional Chime client cluster is added
   * automatically by {@link addChimeClient}, so a bound Chime device can be triggered. The mandatory Generic Switch
   * child endpoint, used by the Intercom to trigger an alert of the desired connected party, is created with the
   * MomentarySwitch feature (see {@link Intercom.addSwitch}).
   *
   * @param {string} name - The name of the intercom.
   * @param {string} serial - The serial number of the intercom.
   * @param {IntercomOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - identifyTime: 0
   *  - identifyType: Identify.IdentifyType.None (the Identify cluster will not be created)
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *
   *  - maxContentBufferSize: 65536 (64 KB)
   *  - maxNetworkBandwidth: 128000 (128 kbps)
   *  - supportedStreamUsages: [StreamUsage.LiveView]
   *  - streamUsagePriorities: same as supportedStreamUsages
   *  - microphoneCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - speakerCapabilities: { maxNumberOfChannels: 1, supportedCodecs: [AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] }
   *  - twoWayTalkSupport: CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex
   *  - weriftOfferOptions: { offerVideo: true, offerAudio: true, videoSource: 'none', audioSource: 'none' }
   *  - switchOptions: see {@link IntercomSwitchOptions} for the full list of defaults
   *
   * @returns {Intercom} The Intercom instance.
   */
  constructor(name: string, serial: string, options: IntercomOptions = {}) {
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
      powerSourceType = 'Wired',
      maxContentBufferSize = 65_536,
      maxNetworkBandwidth = 128_000,
      supportedStreamUsages = [StreamUsage.LiveView],
      streamUsagePriorities = supportedStreamUsages,
      microphoneCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      speakerCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      twoWayTalkSupport = CameraAvStreamManagement.TwoWayTalkSupportType.FullDuplex,
      weriftOfferOptions,
      switchOptions = {},
      id,
      number,
      tagList,
      mode,
    } = options;
    super(powerSourceType === 'None' ? [intercom] : [intercom, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    if (identifyType !== Identify.IdentifyType.None) {
      this.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    }
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Intercom');
    switch (powerSourceType) {
      case 'Rechargeable':
        this.createDefaultPowerSourceRechargeableBatteryClusterServer();
        break;
      case 'Replaceable':
        this.createDefaultPowerSourceReplaceableBatteryClusterServer();
        break;
      case 'Battery':
        this.createDefaultPowerSourceBatteryClusterServer();
        break;
      case 'Wired':
        this.createDefaultPowerSourceWiredClusterServer();
        break;
      case 'None':
        break;
      // No default
    }
    createDefaultIntercomCameraAvStreamManagementClusterServer(this, {
      maxContentBufferSize,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
      microphoneCapabilities,
      speakerCapabilities,
      twoWayTalkSupport,
    });
    createDefaultWebRtcTransportProviderClusterServer(this, weriftOfferOptions);
    createDefaultWebRtcTransportRequestorClusterServer(this);
    addWebRtcTransportProviderClient(this);
    addWebRtcTransportRequestorClient(this);
    addChimeClient(this);
    this.addRequiredClusters();

    /** First mandatory Generic Switch child endpoint */
    const {
      name: switchName = 'Switch',
      tagList: switchTagList = [],
      number: switchNumber,
      identifyTime: switchIdentifyTime = 0,
      identifyType: switchIdentifyType = Identify.IdentifyType.None,
    } = switchOptions;
    this.addSwitch(switchName, { tagList: switchTagList, number: switchNumber, identifyTime: switchIdentifyTime, identifyType: switchIdentifyType });
  }

  /**
   * Adds a Generic Switch child endpoint to the intercom.
   *
   * @param {string} name - The name of the switch.
   * @param {IntercomSwitchOptions} [options] - Optional configuration values. Missing fields use the defaults documented on {@link IntercomSwitchOptions}.
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the switch.
   *
   * @remarks
   * 16.4.4 An Intercom SHALL be composed of at least one endpoint with the Generic Switch (0x000F) device type. The
   * Generic Switch SHALL model the mechanism used by the Intercom to trigger an alert of the desired connected party.
   * 16.4.8 The Switch cluster of the Generic Switch SHALL have the MomentarySwitch feature.
   * Generic Switch is a Simple device type, so it needs its own child endpoint (Core 9.2.1). The constructor already
   * creates that mandatory switch; call this method to add further switches, for example to disambiguate multiple
   * switches with a tagList.
   */
  addSwitch(name: string, options: IntercomSwitchOptions = {}): MatterbridgeEndpoint {
    const { tagList = [], number, identifyTime = 0, identifyType = Identify.IdentifyType.None } = options;
    const switchChild = this.addChildDeviceType(name, genericSwitch, { number, ...(tagList.length > 0 ? { tagList } : {}) });
    switchChild.log.logName = name;
    switchChild.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    switchChild.createDefaultMomentarySwitchClusterServer();
    switchChild.addRequiredClusters();
    return switchChild;
  }
}
