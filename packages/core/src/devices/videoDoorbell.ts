/**
 * @file src/devices/videoDoorbell.ts
 * @description This file contains the VideoDoorbell class.
 * @author Luca Liguori
 * @contributor Ludovic BOUÉ
 * @created 2026-07-23
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

import { StreamUsage } from '@matter/types';
import type { Semtag } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import { fireAndForget } from '@matterbridge/utils';

import { addChimeClient, addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
// Matterbridge
import { camera, doorbell, powerSource, videoDoorbell } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { type MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';
import { type CameraOptions, createDefaultCameraAvStreamManagementClusterServer, createDefaultWebRtcTransportProviderClusterServer } from './camera.js';

/**
 * Options for the mandatory Camera child endpoint created by {@link VideoDoorbell}. Same fields as
 * {@link CameraOptions}, minus the endpoint-identity and power-source options that only apply to the composed
 * root endpoint.
 */
export type VideoDoorbellCameraOptions = Omit<CameraOptions, 'id' | 'number' | 'tagList' | 'mode' | 'powerSourceType'>;

/**
 * Options for the mandatory Doorbell child endpoint created by {@link VideoDoorbell}.
 */
export interface VideoDoorbellDoorbellOptions {
  /** The name of the doorbell. Default: 'Doorbell' */
  name?: string;

  /** The tagList associated with the doorbell, for disambiguation when more doorbells are added with {@link VideoDoorbell.addDoorbell}. Default: no tags */
  tagList?: Semtag[];

  /** Identify time in seconds. Default: 0 */
  identifyTime?: number;
  /** Identify type. The Identify cluster is always created because it is a required server cluster for the Doorbell device type. Default: Identify.IdentifyType.None */
  identifyType?: Identify.IdentifyType;
}

/**
 * Options for configuring a {@link VideoDoorbell} instance.
 */
export interface VideoDoorbellOptions extends MatterbridgeEndpointOptions {
  /** Power source type for the composed video doorbell. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Options for the mandatory Camera child endpoint. Missing fields use the same defaults as {@link Camera}. */
  cameraOptions?: VideoDoorbellCameraOptions;

  /** Options for the mandatory Doorbell child endpoint. Missing fields use the defaults documented on {@link VideoDoorbellDoorbellOptions}. */
  doorbellOptions?: VideoDoorbellDoorbellOptions;
}

/**
 * Matterbridge endpoint representing a video doorbell device.
 * Matter specs 1.6.0 chapter 16.3.
 */
export class VideoDoorbell extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the VideoDoorbell class.
   *
   * A Video Doorbell device is a composite device which combines a camera and a switch to provide a doorbell with
   * Video and Audio streaming. It is always defined via endpoint composition: the constructor creates the composed
   * root endpoint (Basic Information and, unless disabled, Power Source only), the single mandatory Camera child
   * endpoint, wired the same way as the standalone {@link Camera} device, and the mandatory Doorbell child endpoint
   * required by the Matter specification for this device type. Use {@link addDoorbell} to add further Doorbell
   * child endpoints, if needed.
   *
   * @param {string} name - The name of the video doorbell.
   * @param {string} serial - The serial number of the video doorbell.
   * @param {VideoDoorbellOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *  - cameraOptions: see {@link Camera} for the full list of defaults
   *  - doorbellOptions: see {@link VideoDoorbellDoorbellOptions} for the full list of defaults
   *
   * @returns {VideoDoorbell} The VideoDoorbell instance.
   */
  constructor(name: string, serial: string, options: VideoDoorbellOptions = {}) {
    const { powerSourceType = 'Wired', cameraOptions = {}, doorbellOptions = {}, id, number, tagList, mode } = options;
    super(powerSourceType === 'None' ? [videoDoorbell] : [videoDoorbell, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Video Doorbell');
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
    fireAndForget(this.addFixedLabel('composed', 'VideoDoorbell'), this.log, 'Error adding composed label to video doorbell');
    this.addRequiredClusters();

    /** Camera child endpoint */
    const {
      identifyTime: cameraIdentifyTime = 0,
      identifyType: cameraIdentifyType = Identify.IdentifyType.None,
      maxContentBufferSize = 4_194_304,
      maxNetworkBandwidth = 10_000_000,
      supportedStreamUsages = [StreamUsage.LiveView, StreamUsage.Recording],
      streamUsagePriorities = supportedStreamUsages,
      maxConcurrentEncoders = 1,
      maxEncodedPixelRate = 1920 * 1080 * 60,
      videoSensorParams = { sensorWidth: 1920, sensorHeight: 1080, maxFps: 60 },
      minViewportResolution = { width: 640, height: 360 },
      rateDistortionTradeOffPoints = [
        { codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 640, height: 480 }, minBitRate: 250_000 },
        { codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1280, height: 720 }, minBitRate: 500_000 },
        { codec: CameraAvStreamManagement.VideoCodec.H264, resolution: { width: 1920, height: 1080 }, minBitRate: 1_000_000 },
      ],
      currentFrameRate = 30,
      viewport = { x1: 0, y1: 0, x2: videoSensorParams.sensorWidth, y2: videoSensorParams.sensorHeight },
      microphoneCapabilities = { maxNumberOfChannels: 1, supportedCodecs: [CameraAvStreamManagement.AudioCodec.Opus], supportedSampleRates: [48000], supportedBitDepths: [16] },
      snapshotCapabilities = [
        { resolution: { width: 640, height: 480 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1280, height: 720 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
        { resolution: { width: 1920, height: 1080 }, maxFrameRate: 10, imageCodec: CameraAvStreamManagement.ImageCodec.Jpeg, requiresEncodedPixels: false },
      ],
    } = cameraOptions;

    const cameraChild = this.addChildDeviceType('Camera', camera, {});
    cameraChild.log.logName = 'Camera';
    if (cameraIdentifyType !== Identify.IdentifyType.None) {
      cameraChild.createDefaultIdentifyClusterServer(cameraIdentifyTime, cameraIdentifyType);
    }
    createDefaultCameraAvStreamManagementClusterServer(cameraChild, {
      maxContentBufferSize,
      maxNetworkBandwidth,
      supportedStreamUsages,
      streamUsagePriorities,
      maxConcurrentEncoders,
      maxEncodedPixelRate,
      videoSensorParams,
      minViewportResolution,
      rateDistortionTradeOffPoints,
      currentFrameRate,
      viewport,
      microphoneCapabilities,
      snapshotCapabilities,
    });
    createDefaultWebRtcTransportProviderClusterServer(cameraChild);
    addWebRtcTransportRequestorClient(cameraChild);
    cameraChild.addRequiredClusters();

    /** First mandatory Doorbell child endpoint */
    const { name: doorbellName = 'Doorbell', tagList: doorbellTagList = [], identifyTime = 0, identifyType = Identify.IdentifyType.None } = doorbellOptions;
    this.addDoorbell(doorbellName, doorbellTagList, identifyTime, identifyType);
  }

  /**
   * Adds a Doorbell child endpoint to the video doorbell.
   *
   * @param {string} name - The name of the doorbell.
   * @param {Semtag[]} [tagList] - The tagList associated with the doorbell, for disambiguation when the video doorbell has more than one doorbell. Defaults to no tags.
   * @param {number} [identifyTime] - Identify time in seconds. Defaults to 0.
   * @param {Identify.IdentifyType} [identifyType] - Identify type. Defaults to Identify.IdentifyType.None.
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the doorbell.
   *
   * @remarks
   * 16.3.3 A Video Doorbell SHALL be composed of at least one endpoint with the Doorbell (0x0148) device type. The
   * constructor already creates that mandatory doorbell; call this method to add further doorbells, for example to
   * disambiguate multiple doorbells with a tagList.
   */
  addDoorbell(name: string, tagList: Semtag[] = [], identifyTime: number = 0, identifyType: Identify.IdentifyType = Identify.IdentifyType.None): MatterbridgeEndpoint {
    const doorbellChild = this.addChildDeviceType(name, doorbell, tagList.length > 0 ? { tagList } : {});
    doorbellChild.log.logName = name;
    doorbellChild.createDefaultIdentifyClusterServer(identifyTime, identifyType);
    doorbellChild.createDefaultMomentarySwitchClusterServer();
    addChimeClient(doorbellChild);
    doorbellChild.addRequiredClusters();
    return doorbellChild;
  }
}
