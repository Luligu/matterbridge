/**
 * @file packages/core/src/behaviors/colorControlServer.ts
 * @description This file contains the MatterbridgeColorControlServer and MatterbridgeEnhancedColorControlServer classes of Matterbridge.
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

/* oxlint-disable typescript/no-unsafe-type-assertion */

import { ColorControlServer } from '@matter/node/behaviors/color-control';
import { ColorControl } from '@matter/types/clusters/color-control';

import type { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    await super.moveToHue(request);
  }

  /**
   * Forwards MoveHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveHueRequest} request - Move-hue request payload.
   */
  override async moveHue(request: ColorControl.MoveHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving hue with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveHue', {
      command: 'moveHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveHue called`);
    await super.moveHue(request);
  }

  /**
   * Forwards StepHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepHueRequest} request - Step-hue request payload.
   */
  override async stepHue(request: ColorControl.StepHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping hue with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.stepHue', {
      command: 'stepHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepHue called`);
    await super.stepHue(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHue called`);
    await super.enhancedMoveToHue(request);
  }

  /**
   * Forwards EnhancedMoveHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveHueRequest} request - Enhanced-move-hue request payload.
   */
  override async enhancedMoveHue(request: ColorControl.EnhancedMoveHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving enhanced hue with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.enhancedMoveHue', {
      command: 'enhancedMoveHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveHue called`);
    await super.enhancedMoveHue(request);
  }

  /**
   * Forwards EnhancedStepHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedStepHueRequest} request - Enhanced-step-hue request payload.
   */
  override async enhancedStepHue(request: ColorControl.EnhancedStepHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping enhanced hue with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.enhancedStepHue', {
      command: 'enhancedStepHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedStepHue called`);
    await super.enhancedStepHue(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    await super.moveToSaturation(request);
  }

  /**
   * Forwards MoveSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveSaturationRequest} request - Move-saturation request payload.
   */
  override async moveSaturation(request: ColorControl.MoveSaturationRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving saturation with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveSaturation', {
      command: 'moveSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveSaturation called`);
    await super.moveSaturation(request);
  }

  /**
   * Forwards StepSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepSaturationRequest} request - Step-saturation request payload.
   */
  override async stepSaturation(request: ColorControl.StepSaturationRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping saturation with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.stepSaturation', {
      command: 'stepSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepSaturation called`);
    await super.stepSaturation(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    await super.moveToColor(request);
  }

  /**
   * Forwards MoveColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveColorRequest} request - Move-color request payload.
   */
  override async moveColor(request: ColorControl.MoveColorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving color with rateX ${request.rateX} and rateY ${request.rateY} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveColor', {
      command: 'moveColor',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveColor called`);
    await super.moveColor(request);
  }

  /**
   * Forwards StepColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepColorRequest} request - Step-color request payload.
   */
  override async stepColor(request: ColorControl.StepColorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping color with stepX ${request.stepX} and stepY ${request.stepY} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.stepColor', {
      command: 'stepColor',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepColor called`);
    await super.stepColor(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColorTemperature called`);
    await super.moveToColorTemperature(request);
  }

  /**
   * Forwards MoveColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveColorTemperatureRequest} request - Move-color-temperature request payload.
   */
  override async moveColorTemperature(request: ColorControl.MoveColorTemperatureRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Moving color temperature with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveColorTemperature', {
      command: 'moveColorTemperature',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveColorTemperature called`);
    await super.moveColorTemperature(request);
  }

  /**
   * Forwards StepColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepColorTemperatureRequest} request - Step-color-temperature request payload.
   */
  override async stepColorTemperature(request: ColorControl.StepColorTemperatureRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping color temperature with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.stepColorTemperature', {
      command: 'stepColorTemperature',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepColorTemperature called`);
    await super.stepColorTemperature(request);
  }

  /**
   * Forwards StopMoveStep requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StopMoveStepRequest} request - Stop-move-step request payload.
   */
  override async stopMoveStep(request: ColorControl.StopMoveStepRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping color move/step (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.stopMoveStep', {
      command: 'stopMoveStep',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stopMoveStep called`);
    await super.stopMoveStep(request);
  }
}
