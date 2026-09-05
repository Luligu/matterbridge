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

import type { MaybePromise } from '@matter/general';
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
   * Enables managed transition-time handling under MATTERBRIDGE_CHIP_TEST only, so Hue/Saturation/XY/
   * ColorTemperature MoveTo/Move/Step transitions actually animate over TransitionTime/Rate during CHIP
   * certification testing instead of jumping straight to the target value (see chipTests.md Known Issues).
   * Production behavior (matter.js's own default: immediate jump, no simulated transition) is unchanged.
   *
   * @returns {MaybePromise} The result of the base class initialization.
   */
  override initialize(): MaybePromise {
    // v8 ignore next - only enabled under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) this.state.managedTransitionTimeHandling = true;
    return super.initialize();
  }

  /**
   * Forwards MoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueRequest} request - Move-to-hue request payload.
   */
  override async moveToHue(request: ColorControl.MoveToHueRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.4.5: Set ColorMode to CurrentHueAndCurrentSaturation, then move CurrentHue continuously to the Hue field over TransitionTime.
      await super.moveToHue(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting hue to ${request.hue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToHue', {
      command: 'moveToHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.4.5: Set ColorMode to CurrentHueAndCurrentSaturation, then move CurrentHue continuously to the Hue field over TransitionTime.
    await super.moveToHue(request);
  }

  /**
   * Forwards MoveHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveHueRequest} request - Move-hue request payload.
   */
  override async moveHue(request: ColorControl.MoveHueRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.5.4: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentHue continuously at the given rate.
      await super.moveHue(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: moving hue with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveHue', {
      command: 'moveHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveHue called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.5.4: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentHue continuously at the given rate.
    await super.moveHue(request);
  }

  /**
   * Forwards StepHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepHueRequest} request - Step-hue request payload.
   */
  override async stepHue(request: ColorControl.StepHueRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.6.5: Reject a StepSize of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentHue by StepSize over TransitionTime.
      await super.stepHue(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: stepping hue with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.stepHue', {
      command: 'stepHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepHue called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.6.5: Reject a StepSize of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentHue by StepSize over TransitionTime.
    await super.stepHue(request);
  }

  /**
   * Forwards EnhancedMoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveToHueRequest} request - Enhanced-move-to-hue request payload.
   */
  override async enhancedMoveToHue(request: ColorControl.EnhancedMoveToHueRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.15.5: Set EnhancedColorMode to CurrentHueAndCurrentSaturation, then move EnhancedCurrentHue continuously to the EnhancedHue field over TransitionTime.
      await super.enhancedMoveToHue(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting enhanced hue to ${request.enhancedHue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.enhancedMoveToHue', {
      command: 'enhancedMoveToHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHue called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.15.5: Set EnhancedColorMode to CurrentHueAndCurrentSaturation, then move EnhancedCurrentHue continuously to the EnhancedHue field over TransitionTime.
    await super.enhancedMoveToHue(request);
  }

  /**
   * Forwards EnhancedMoveHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveHueRequest} request - Enhanced-move-hue request payload.
   */
  override async enhancedMoveHue(request: ColorControl.EnhancedMoveHueRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.16.4: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise move EnhancedCurrentHue continuously at the given rate.
      await super.enhancedMoveHue(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: moving enhanced hue with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.enhancedMoveHue', {
      command: 'enhancedMoveHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveHue called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.16.4: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise move EnhancedCurrentHue continuously at the given rate.
    await super.enhancedMoveHue(request);
  }

  /**
   * Forwards EnhancedStepHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedStepHueRequest} request - Enhanced-step-hue request payload.
   */
  override async enhancedStepHue(request: ColorControl.EnhancedStepHueRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.17.5: Reject a StepSize of zero with INVALID_COMMAND, otherwise move EnhancedCurrentHue by StepSize over TransitionTime.
      await super.enhancedStepHue(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: stepping enhanced hue with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.enhancedStepHue', {
      command: 'enhancedStepHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedStepHue called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.17.5: Reject a StepSize of zero with INVALID_COMMAND, otherwise move EnhancedCurrentHue by StepSize over TransitionTime.
    await super.enhancedStepHue(request);
  }

  /**
   * Forwards MoveToSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToSaturationRequest} request - Move-to-saturation request payload.
   */
  override async moveToSaturation(request: ColorControl.MoveToSaturationRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.7.2: Set ColorMode to CurrentHueAndCurrentSaturation, then move CurrentSaturation continuously to the Saturation field over TransitionTime.
      await super.moveToSaturation(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToSaturation', {
      command: 'moveToSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.7.2: Set ColorMode to CurrentHueAndCurrentSaturation, then move CurrentSaturation continuously to the Saturation field over TransitionTime.
    await super.moveToSaturation(request);
  }

  /**
   * Forwards MoveSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveSaturationRequest} request - Move-saturation request payload.
   */
  override async moveSaturation(request: ColorControl.MoveSaturationRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.8.4: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentSaturation continuously at the given rate.
      await super.moveSaturation(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: moving saturation with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveSaturation', {
      command: 'moveSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveSaturation called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.8.4: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentSaturation continuously at the given rate.
    await super.moveSaturation(request);
  }

  /**
   * Forwards StepSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepSaturationRequest} request - Step-saturation request payload.
   */
  override async stepSaturation(request: ColorControl.StepSaturationRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.9.5: Reject a StepSize of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentSaturation by StepSize over TransitionTime.
      await super.stepSaturation(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: stepping saturation with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.stepSaturation', {
      command: 'stepSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepSaturation called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.9.5: Reject a StepSize of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentHueAndCurrentSaturation and move CurrentSaturation by StepSize over TransitionTime.
    await super.stepSaturation(request);
  }

  /**
   * Forwards MoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueAndSaturationRequest} request - Move-to-hue-and-saturation request payload.
   */
  override async moveToHueAndSaturation(request: ColorControl.MoveToHueAndSaturationRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.10.2: Set ColorMode to CurrentHueAndCurrentSaturation, then move CurrentHue and CurrentSaturation continuously to the Hue and Saturation fields over TransitionTime.
      await super.moveToHueAndSaturation(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting hue to ${request.hue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToHueAndSaturation', {
      command: 'moveToHueAndSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.10.2: Set ColorMode to CurrentHueAndCurrentSaturation, then move CurrentHue and CurrentSaturation continuously to the Hue and Saturation fields over TransitionTime.
    await super.moveToHueAndSaturation(request);
  }

  /**
   * Forwards EnhancedMoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveToHueAndSaturationRequest} request - Enhanced-move-to-hue-and-saturation request payload.
   */
  override async enhancedMoveToHueAndSaturation(request: ColorControl.EnhancedMoveToHueAndSaturationRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.18.5: Set EnhancedColorMode to CurrentHueAndCurrentSaturation, then move EnhancedCurrentHue and CurrentSaturation continuously to the EnhancedHue and Saturation fields over TransitionTime.
      await super.enhancedMoveToHueAndSaturation(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting enhanced hue to ${request.enhancedHue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.enhancedMoveToHueAndSaturation', {
      command: 'enhancedMoveToHueAndSaturation',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHueAndSaturation called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.18.5: Set EnhancedColorMode to CurrentHueAndCurrentSaturation, then move EnhancedCurrentHue and CurrentSaturation continuously to the EnhancedHue and Saturation fields over TransitionTime.
    await super.enhancedMoveToHueAndSaturation(request);
  }

  /**
   * Forwards MoveToColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorRequest} request - Move-to-color request payload.
   */
  override async moveToColor(request: ColorControl.MoveToColorRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.11.2: Set ColorMode to CurrentXAndCurrentY, then move CurrentX and CurrentY continuously to the ColorX and ColorY fields over TransitionTime.
      await super.moveToColor(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting color to ${request.colorX}, ${request.colorY} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToColor', {
      command: 'moveToColor',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.11.2: Set ColorMode to CurrentXAndCurrentY, then move CurrentX and CurrentY continuously to the ColorX and ColorY fields over TransitionTime.
    await super.moveToColor(request);
  }

  /**
   * Forwards MoveColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveColorRequest} request - Move-color request payload.
   */
  override async moveColor(request: ColorControl.MoveColorRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.12.4: A RateX and RateY of zero performs no movement and only stops any command in progress, otherwise move CurrentX and CurrentY continuously at the given rates.
      await super.moveColor(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: moving color with rateX ${request.rateX} and rateY ${request.rateY} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveColor', {
      command: 'moveColor',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveColor called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.12.4: A RateX and RateY of zero performs no movement and only stops any command in progress, otherwise move CurrentX and CurrentY continuously at the given rates.
    await super.moveColor(request);
  }

  /**
   * Forwards StepColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepColorRequest} request - Step-color request payload.
   */
  override async stepColor(request: ColorControl.StepColorRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.13.4: Reject a StepX and StepY both of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentXAndCurrentY and move CurrentX and CurrentY by the step over TransitionTime.
      await super.stepColor(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: stepping color with stepX ${request.stepX} and stepY ${request.stepY} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.stepColor', {
      command: 'stepColor',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepColor called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.13.4: Reject a StepX and StepY both of zero with INVALID_COMMAND, otherwise set ColorMode to CurrentXAndCurrentY and move CurrentX and CurrentY by the step over TransitionTime.
    await super.stepColor(request);
  }

  /**
   * Forwards MoveToColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorTemperatureRequest} request - Move-to-color-temperature request payload.
   */
  override async moveToColorTemperature(request: ColorControl.MoveToColorTemperatureRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.14.2: Set ColorMode to ColorTemperatureMireds, then move ColorTemperatureMireds continuously to the requested value over TransitionTime.
      await super.moveToColorTemperature(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: setting color temperature to ${request.colorTemperatureMireds} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveToColorTemperature', {
      command: 'moveToColorTemperature',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColorTemperature called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.14.2: Set ColorMode to ColorTemperatureMireds, then move ColorTemperatureMireds continuously to the requested value over TransitionTime.
    await super.moveToColorTemperature(request);
  }

  /**
   * Forwards MoveColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveColorTemperatureRequest} request - Move-color-temperature request payload.
   */
  override async moveColorTemperature(request: ColorControl.MoveColorTemperatureRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.21.6: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise set ColorMode and EnhancedColorMode to ColorTemperatureMireds and move continuously at the given rate within the requested mireds limits.
      await super.moveColorTemperature(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: moving color temperature with mode ${request.moveMode} and rate ${request.rate} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.moveColorTemperature', {
      command: 'moveColorTemperature',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveColorTemperature called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.21.6: Reject an Up or Down MoveMode with a Rate of zero with INVALID_COMMAND, otherwise set ColorMode and EnhancedColorMode to ColorTemperatureMireds and move continuously at the given rate within the requested mireds limits.
    await super.moveColorTemperature(request);
  }

  /**
   * Forwards StepColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StepColorTemperatureRequest} request - Step-color-temperature request payload.
   */
  override async stepColorTemperature(request: ColorControl.StepColorTemperatureRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.22.7: Reject a StepSize of zero with INVALID_COMMAND, otherwise set ColorMode and EnhancedColorMode to ColorTemperatureMireds and move by StepSize over TransitionTime within the requested mireds limits.
      await super.stepColorTemperature(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `MatterbridgeColorControlServer: stepping color temperature with mode ${request.stepMode} and size ${request.stepSize} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ColorControl.stepColorTemperature', {
      command: 'stepColorTemperature',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stepColorTemperature called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.22.7: Reject a StepSize of zero with INVALID_COMMAND, otherwise set ColorMode and EnhancedColorMode to ColorTemperatureMireds and move by StepSize over TransitionTime within the requested mireds limits.
    await super.stepColorTemperature(request);
  }

  /**
   * Forwards StopMoveStep requests to the Matterbridge command handler.
   *
   * @param {ColorControl.StopMoveStepRequest} request - Stop-move-step request payload.
   */
  override async stopMoveStep(request: ColorControl.StopMoveStepRequest): Promise<void> {
    // v8 ignore next - forwarder gated off under MATTERBRIDGE_CHIP_TEST
    if (process.env.MATTERBRIDGE_CHIP_TEST) {
      // Matter 1.6.0 § 3.2.8.20.2: Terminate any MoveTo, Move or Step in progress, leaving CurrentHue, EnhancedCurrentHue and CurrentSaturation at their present values and setting RemainingTime to 0.
      await super.stopMoveStep(request);
      return;
    }
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`MatterbridgeColorControlServer: stopping color move/step (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.stopMoveStep', {
      command: 'stopMoveStep',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ColorControl)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
      context: this.context,
    });
    device.log.debug(`MatterbridgeColorControlServer: stopMoveStep called (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Matter 1.6.0 § 3.2.8.20.2: Terminate any MoveTo, Move or Step in progress, leaving CurrentHue, EnhancedCurrentHue and CurrentSaturation at their present values and setting RemainingTime to 0.
    await super.stopMoveStep(request);
  }
}
