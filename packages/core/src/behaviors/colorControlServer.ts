/**
 * This file contains the MatterbridgeColorControlServer and MatterbridgeEnhancedColorControlServer classes of Matterbridge.
 *
 * @file colorControlServer.ts
 * @author Luca Liguori
 * @created 2026-03-28
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

import { ColorControlServer } from '@matter/node/behaviors/color-control';
import { ColorControl } from '@matter/types/clusters/color-control';

import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from '../matterbridgeEndpointCommandHandler.js';
import { MatterbridgeServer } from './matterbridgeServer.js';

/**
 * ColorControl server (hue/saturation/xy/color temperature) forwarding commands to the Matterbridge command handler.
 */
export class MatterbridgeColorControlServer extends ColorControlServer.with(
  ColorControl.Feature.HueSaturation,
  ColorControl.Feature.Xy,
  ColorControl.Feature.ColorTemperature,
  ColorControl.Feature.EnhancedHue,
) {
  /**
   * Forwards MoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueRequest} request - Move-to-hue request payload.
   */
  override async moveToHue(request: ColorControl.MoveToHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting hue to ${request.hue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveToHue', {
      command: 'moveToHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    await super.moveToHue(request);
  }

  /**
   * Forwards EnhancedMoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveToHueRequest} request - Enhanced-move-to-hue request payload.
   */
  override async enhancedMoveToHue(request: ColorControl.EnhancedMoveToHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting enhanced hue to ${request.enhancedHue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.enhancedMoveToHue', {
      command: 'enhancedMoveToHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHue called`);
    await super.enhancedMoveToHue(request);
  }

  /**
   * Forwards MoveToSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToSaturationRequest} request - Move-to-saturation request payload.
   */
  override async moveToSaturation(request: ColorControl.MoveToSaturationRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveToSaturation', {
      command: 'moveToSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    await super.moveToSaturation(request);
  }

  /**
   * Forwards MoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueAndSaturationRequest} request - Move-to-hue-and-saturation request payload.
   */
  override async moveToHueAndSaturation(request: ColorControl.MoveToHueAndSaturationRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting hue to ${request.hue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToHueAndSaturation', {
      command: 'moveToHueAndSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called`);
    await super.moveToHueAndSaturation(request);
  }

  /**
   * Forwards EnhancedMoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveToHueAndSaturationRequest} request - Enhanced-move-to-hue-and-saturation request payload.
   */
  override async enhancedMoveToHueAndSaturation(request: ColorControl.EnhancedMoveToHueAndSaturationRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting enhanced hue to ${request.enhancedHue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.enhancedMoveToHueAndSaturation', {
      command: 'enhancedMoveToHueAndSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHueAndSaturation called`);
    await super.enhancedMoveToHueAndSaturation(request);
  }

  /**
   * Forwards MoveToColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorRequest} request - Move-to-color request payload.
   */
  override async moveToColor(request: ColorControl.MoveToColorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting color to ${request.colorX}, ${request.colorY} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToColor', {
      command: 'moveToColor',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    await super.moveToColor(request);
  }

  /**
   * Forwards MoveToColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorTemperatureRequest} request - Move-to-color-temperature request payload.
   */
  override async moveToColorTemperature(request: ColorControl.MoveToColorTemperatureRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting color temperature to ${request.colorTemperatureMireds} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToColorTemperature', {
      command: 'moveToColorTemperature',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColorTemperature called`);
    await super.moveToColorTemperature(request);
  }
}

/**
 * Enhanced ColorControl server forwarding enhanced hue commands to the Matterbridge command handler.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeColorControlServer with the EnhancedHue feature.
 */
export class MatterbridgeEnhancedColorControlServer extends MatterbridgeColorControlServer.with(
  ColorControl.Feature.HueSaturation,
  ColorControl.Feature.EnhancedHue,
  ColorControl.Feature.Xy,
  ColorControl.Feature.ColorTemperature,
) {}
