/**
 * @file src/devices/floodlightCamera.ts
 * @description This file contains the FloodlightCamera class.
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

import { StreamUsage } from '@matter/types';
import type { Semtag } from '@matter/types';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { Identify } from '@matter/types/clusters/identify';
import { fireAndForget } from '@matterbridge/utils';

import { addWebRtcTransportRequestorClient } from '../behaviors/clients.js';
import { createDefaultWebRtcTransportProviderClusterServer } from '../behaviors/webRtcTransportProviderServer.js';
// Matterbridge
import { camera, floodlightCamera, onOffLight, powerSource } from '../matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { type MatterbridgeEndpointOptions } from '../matterbridgeEndpointTypes.js';
import { type CameraOptions, createDefaultCameraAvStreamManagementClusterServer } from './camera.js';

/**
 * Options for the mandatory Camera child endpoint created by {@link FloodlightCamera}. Same fields as
 * {@link CameraOptions}, minus the endpoint-identity and power-source options that only apply to the composed
 * root endpoint.
 */
export type FloodlightCameraCameraOptions = Omit<CameraOptions, 'id' | 'number' | 'tagList' | 'mode' | 'powerSourceType'>;

/**
 * Options for the mandatory On/Off Light child endpoint created by {@link FloodlightCamera}.
 */
export interface FloodlightCameraLightOptions {
  /** The name of the light. Default: 'Light' */
  name?: string;

  /** The tagList associated with the light, for disambiguation when more lights are added with {@link FloodlightCamera.addLight}. Default: no tags */
  tagList?: Semtag[];

  /** The initial state of the light. Default: false */
  onOff?: boolean;
}

/**
 * Options for configuring a {@link FloodlightCamera} instance.
 */
export interface FloodlightCameraOptions extends MatterbridgeEndpointOptions {
  /** Power source type for the composed floodlight camera. Default: Wired (with None, the Power Source cluster will not be created) */
  powerSourceType?: 'Rechargeable' | 'Replaceable' | 'Battery' | 'Wired' | 'None';

  /** Options for the mandatory Camera child endpoint. Missing fields use the same defaults as {@link Camera}. */
  cameraOptions?: FloodlightCameraCameraOptions;

  /** Options for the mandatory On/Off Light child endpoint. Missing fields use the defaults documented on {@link FloodlightCameraLightOptions}. */
  lightOptions?: FloodlightCameraLightOptions;
}

/**
 * Matterbridge endpoint representing a floodlight camera device.
 * Matter specs 1.6.0 chapter 16.2.
 */
export class FloodlightCamera extends MatterbridgeEndpoint {
  /**
   * Creates an instance of the FloodlightCamera class.
   *
   * A Floodlight Camera device is a composite device which combines a camera and a light, primarily used in
   * security use cases. It is always defined via endpoint composition: the constructor creates the composed root
   * endpoint (Basic Information and, unless disabled, Power Source only), the single mandatory Camera child
   * endpoint, wired the same way as the standalone {@link Camera} device, and the mandatory On/Off Light child
   * endpoint required by the Matter specification for this device type. Use {@link addLight} to add further
   * On/Off Light child endpoints, if needed.
   *
   * @param {string} name - The name of the floodlight camera.
   * @param {string} serial - The serial number of the floodlight camera.
   * @param {FloodlightCameraOptions} [options] - Optional configuration values. Missing fields use defaults.
   *
   * Options defaults:
   *  - powerSourceType: Wired (with None, the Power Source cluster will not be created)
   *  - cameraOptions: see {@link Camera} for the full list of defaults
   *  - lightOptions: see {@link FloodlightCameraLightOptions} for the full list of defaults
   *
   * @returns {FloodlightCamera} The FloodlightCamera instance.
   */
  constructor(name: string, serial: string, options: FloodlightCameraOptions = {}) {
    const { powerSourceType = 'Wired', cameraOptions = {}, lightOptions = {}, id, number, tagList, mode } = options;
    super(powerSourceType === 'None' ? [floodlightCamera] : [floodlightCamera, powerSource], {
      id: id ?? `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}`,
      number,
      tagList,
      mode,
    });
    this.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Floodlight Camera');
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
    fireAndForget(this.addFixedLabel('composed', 'FloodlightCamera'), this.log, 'Error adding composed label to floodlight camera');
    this.addRequiredClusters();

    /** Camera child endpoint */
    const {
      identifyTime = 0,
      identifyType = Identify.IdentifyType.None,
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
    if (identifyType !== Identify.IdentifyType.None) {
      cameraChild.createDefaultIdentifyClusterServer(identifyTime, identifyType);
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

    /** First mandatory Light child endpoint */
    const { name: lightName = 'Light', tagList: lightTagList = [], onOff: lightOnOff = false } = lightOptions;
    this.addLight(lightName, lightTagList, lightOnOff);
  }

  /**
   * Adds an On/Off Light child endpoint to the floodlight camera.
   *
   * @param {string} name - The name of the light.
   * @param {Semtag[]} [tagList] - The tagList associated with the light, for disambiguation when the floodlight camera has more than one light. Defaults to no tags.
   * @param {boolean} [onOff] - The initial state of the light. Defaults to false.
   *
   * @returns {MatterbridgeEndpoint} The MatterbridgeEndpoint instance representing the light.
   *
   * @remarks
   * 16.2.4 A Floodlight Camera SHALL be composed of at least one endpoint with the On/Off Light (0x0100) device
   * type. The constructor already creates that mandatory light; call this method to add further lights, for
   * example to disambiguate multiple floodlights with a tagList.
   */
  addLight(name: string, tagList: Semtag[] = [], onOff: boolean = false): MatterbridgeEndpoint {
    const light = this.addChildDeviceType(name, onOffLight, tagList.length > 0 ? { tagList } : {});
    light.log.logName = name;
    light.createDefaultIdentifyClusterServer();
    light.createDefaultOnOffClusterServer(onOff);
    light.addRequiredClusters();
    return light;
  }
}
