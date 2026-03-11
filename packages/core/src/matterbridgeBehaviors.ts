/**
 * This file contains the behavior classes of Matterbridge.
 *
 * @file matterbridgeBehaviors.ts
 * @author Luca Liguori
 * @created 2024-11-07
 * @version 1.3.0
 * @license Apache-2.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */

// AnsiLogger module
// @matter
import { MaybePromise, NamedHandler } from '@matter/general';
import { Behavior } from '@matter/node';
// @matter behaviors
import { ActivatedCarbonFilterMonitoringServer } from '@matter/node/behaviors/activated-carbon-filter-monitoring';
import { BooleanStateConfigurationServer } from '@matter/node/behaviors/boolean-state-configuration';
import { ColorControlServer } from '@matter/node/behaviors/color-control';
import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { DeviceEnergyManagementModeServer } from '@matter/node/behaviors/device-energy-management-mode';
import { DoorLockServer } from '@matter/node/behaviors/door-lock';
import { FanControlServer } from '@matter/node/behaviors/fan-control';
import { HepaFilterMonitoringServer } from '@matter/node/behaviors/hepa-filter-monitoring';
import { IdentifyServer } from '@matter/node/behaviors/identify';
import { LevelControlServer } from '@matter/node/behaviors/level-control';
import { ModeSelectServer } from '@matter/node/behaviors/mode-select';
import { OnOffServer } from '@matter/node/behaviors/on-off';
import { OperationalStateServer } from '@matter/node/behaviors/operational-state';
import { PowerSourceServer } from '@matter/node/behaviors/power-source';
import { ServiceAreaServer } from '@matter/node/behaviors/service-area';
import { SmokeCoAlarmServer } from '@matter/node/behaviors/smoke-co-alarm';
import { SwitchServer } from '@matter/node/behaviors/switch';
import { ThermostatServer } from '@matter/node/behaviors/thermostat';
import { ValveConfigurationAndControlServer } from '@matter/node/behaviors/valve-configuration-and-control';
import { MovementDirection, MovementType, WindowCoveringServer } from '@matter/node/behaviors/window-covering';
// @matter clusters
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/types/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { FanControl } from '@matter/types/clusters/fan-control';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { EndpointNumber } from '@matter/types/datatype';
import { AnsiLogger } from 'node-ansi-logger';

// MatterbridgeEndpoint
import { MatterbridgeEndpointCommands } from './matterbridgeEndpointTypes.js';

/**
 * Base behavior providing a logger and command dispatch for Matterbridge endpoints.
 */
export class MatterbridgeServer extends Behavior {
  static override readonly id = 'matterbridge';
  declare state: MatterbridgeServer.State;

  /**
   * Logs initialization and delegates to the base behavior.
   */
  override initialize() {
    this.state.log.debug(`MatterbridgeServer initialized (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    super.initialize();
  }
}

export namespace MatterbridgeServer {
  /**
   * State shared by Matterbridge servers.
   */
  export class State {
    log!: AnsiLogger;
    commandHandler!: NamedHandler<MatterbridgeEndpointCommands>;
  }
}

/**
 * PowerSource server that keeps the Matterbridge endpoint list in sync.
 */
export class MatterbridgePowerSourceServer extends PowerSourceServer {
  /**
   * Initializes state and updates endpointList when construction completes.
   */
  override async initialize() {
    await super.initialize();

    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgePowerSourceServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.state.endpointList = [this.endpoint.number];
    this.endpoint.construction.onSuccess(async () => {
      device.log.debug(`MatterbridgePowerSourceServer: endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber} construction completed`);
      const endpointList: EndpointNumber[] = [this.endpoint.number];
      for (const endpoint of this.endpoint.parts) {
        if (endpoint.lifecycle.isReady) {
          endpointList.push(endpoint.number);
        }
      }
      await this.endpoint.setStateOf(PowerSourceServer, { endpointList });
      device.log.debug(
        `MatterbridgePowerSourceServer: endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber} construction completed with endpointList: ${endpointList.join(', ')}`,
      );
    });
  }
}

/**
 * Identify server that forwards Identify commands to the Matterbridge command handler.
 */
export class MatterbridgeIdentifyServer extends IdentifyServer {
  /**
   * Forwards Identify requests to the Matterbridge command handler.
   *
   * @param {Identify.IdentifyRequest} request - Identify request payload.
   */
  override identify(request: Identify.IdentifyRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Identifying device for ${request.identifyTime} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('identify', { request, cluster: IdentifyServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeIdentifyServer: identify called`);
    super.identify(request);
  }

  /**
   * Forwards TriggerEffect requests to the Matterbridge command handler.
   *
   * @param {Identify.TriggerEffectRequest} request - Trigger-effect request payload.
   */
  override triggerEffect(request: Identify.TriggerEffectRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Triggering effect ${request.effectIdentifier} variant ${request.effectVariant} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('triggerEffect', { request, cluster: IdentifyServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeIdentifyServer: triggerEffect called`);
    super.triggerEffect(request);
  }
}

/**
 * OnOff server that forwards On/Off commands to the Matterbridge command handler.
 */
export class MatterbridgeOnOffServer extends OnOffServer {
  /**
   * Handles the On command.
   */
  override on(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device on (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('on', { request: {}, cluster: OnOffServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeOnOffServer: on called`);
    super.on();
  }

  /**
   * Handles the Off command.
   */
  override off(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('off', { request: {}, cluster: OnOffServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeOnOffServer: off called`);
    super.off();
  }

  /**
   * Handles the Toggle command.
   */
  override toggle(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Toggle device on/off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('toggle', { request: {}, cluster: OnOffServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeOnOffServer: toggle called`);
    super.toggle();
  }
}

/**
 * LevelControl server that forwards level commands to the Matterbridge command handler.
 */
export class MatterbridgeLevelControlServer extends LevelControlServer {
  /**
   * Forwards MoveToLevel requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override moveToLevel(request: LevelControl.MoveToLevelRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveToLevel', { request, cluster: LevelControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called`);
    super.moveToLevel(request);
  }

  /**
   * Forwards MoveToLevelWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override moveToLevelWithOnOff(request: LevelControl.MoveToLevelRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveToLevelWithOnOff', { request, cluster: LevelControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevelWithOnOff called`);
    super.moveToLevelWithOnOff(request);
  }
}

/**
 * ColorControl server (hue/saturation/xy/color temperature) forwarding commands to the Matterbridge command handler.
 */
export class MatterbridgeColorControlServer extends ColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature) {
  /**
   * Forwards MoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueRequest} request - Move-to-hue request payload.
   */
  override moveToHue(request: ColorControl.MoveToHueRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting hue to ${request.hue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveToHue', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    super.moveToHue(request);
  }

  /**
   * Forwards MoveToSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToSaturationRequest} request - Move-to-saturation request payload.
   */
  override moveToSaturation(request: ColorControl.MoveToSaturationRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveToSaturation', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    super.moveToSaturation(request);
  }

  /**
   * Forwards MoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueAndSaturationRequest} request - Move-to-hue-and-saturation request payload.
   */
  override moveToHueAndSaturation(request: ColorControl.MoveToHueAndSaturationRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting hue to ${request.hue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('moveToHueAndSaturation', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called`);
    super.moveToHueAndSaturation(request);
  }

  /**
   * Forwards MoveToColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorRequest} request - Move-to-color request payload.
   */
  override moveToColor(request: ColorControl.MoveToColorRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting color to ${request.colorX}, ${request.colorY} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('moveToColor', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    super.moveToColor(request);
  }

  /**
   * Forwards MoveToColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorTemperatureRequest} request - Move-to-color-temperature request payload.
   */
  override moveToColorTemperature(request: ColorControl.MoveToColorTemperatureRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting color temperature to ${request.colorTemperatureMireds} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('moveToColorTemperature', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToColorTemperature called`);
    super.moveToColorTemperature(request);
  }
}

/**
 * Enhanced ColorControl server forwarding enhanced hue commands to the Matterbridge command handler.
 */
export class MatterbridgeEnhancedColorControlServer extends ColorControlServer.with(
  ColorControl.Feature.HueSaturation,
  ColorControl.Feature.EnhancedHue,
  ColorControl.Feature.Xy,
  ColorControl.Feature.ColorTemperature,
) {
  /**
   * Forwards MoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueRequest} request - Move-to-hue request payload.
   */
  override moveToHue(request: ColorControl.MoveToHueRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting hue to ${request.hue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveToHue', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    super.moveToHue(request);
  }

  /**
   * Forwards EnhancedMoveToHue requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveToHueRequest} request - Enhanced-move-to-hue request payload.
   */
  override enhancedMoveToHue(request: ColorControl.EnhancedMoveToHueRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting enhanced hue to ${request.enhancedHue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('enhancedMoveToHue', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHue called`);
    super.enhancedMoveToHue(request);
  }

  /**
   * Forwards MoveToSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToSaturationRequest} request - Move-to-saturation request payload.
   */
  override moveToSaturation(request: ColorControl.MoveToSaturationRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('moveToSaturation', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    super.moveToSaturation(request);
  }

  /**
   * Forwards MoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToHueAndSaturationRequest} request - Move-to-hue-and-saturation request payload.
   */
  override moveToHueAndSaturation(request: ColorControl.MoveToHueAndSaturationRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting hue to ${request.hue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('moveToHueAndSaturation', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called`);
    super.moveToHueAndSaturation(request);
  }

  /**
   * Forwards EnhancedMoveToHueAndSaturation requests to the Matterbridge command handler.
   *
   * @param {ColorControl.EnhancedMoveToHueAndSaturationRequest} request - Enhanced-move-to-hue-and-saturation request payload.
   */
  override enhancedMoveToHueAndSaturation(request: ColorControl.EnhancedMoveToHueAndSaturationRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting enhanced hue to ${request.enhancedHue} and saturation to ${request.saturation} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('enhancedMoveToHueAndSaturation', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHueAndSaturation called`);
    super.enhancedMoveToHueAndSaturation(request);
  }

  /**
   * Forwards MoveToColor requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorRequest} request - Move-to-color request payload.
   */
  override moveToColor(request: ColorControl.MoveToColorRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting color to ${request.colorX}, ${request.colorY} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('moveToColor', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    super.moveToColor(request);
  }

  /**
   * Forwards MoveToColorTemperature requests to the Matterbridge command handler.
   *
   * @param {ColorControl.MoveToColorTemperatureRequest} request - Move-to-color-temperature request payload.
   */
  override moveToColorTemperature(request: ColorControl.MoveToColorTemperatureRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting color temperature to ${request.colorTemperatureMireds} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('moveToColorTemperature', { request, cluster: ColorControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeColorControlServer: moveToColorTemperature called`);
    super.moveToColorTemperature(request);
  }
}

/**
 * WindowCovering server (lift) that forwards covering commands to the Matterbridge command handler.
 */
export class MatterbridgeLiftWindowCoveringServer extends WindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift) {
  /**
   * Handles UpOrOpen for lift-only window coverings.
   */
  override upOrOpen(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler(`upOrOpen`, { request: {}, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeWindowCoveringServer: upOrOpen called`);
    super.upOrOpen();
  }

  /**
   * Handles DownOrClose for lift-only window coverings.
   */
  override downOrClose(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler(`downOrClose`, { request: {}, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeWindowCoveringServer: downOrClose called`);
    super.downOrClose();
  }

  /**
   * Handles StopMotion for lift-only window coverings.
   */
  override stopMotion(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('stopMotion', { request: {}, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeWindowCoveringServer: stopMotion called`);
    super.stopMotion();
  }

  /**
   * Forwards GoToLiftPercentage requests to the Matterbridge command handler.
   *
   * @param {WindowCovering.GoToLiftPercentageRequest} request - Go-to-lift-percentage request payload.
   */
  override goToLiftPercentage(request: WindowCovering.GoToLiftPercentageRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover lift percentage to ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('goToLiftPercentage', { request, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeWindowCoveringServer: goToLiftPercentage with ${request.liftPercent100thsValue}`);
    super.goToLiftPercentage(request);
  }

  /**
   * No-op: movement is handled by the device implementation.
   *
   * @param {MovementType} type - Movement type.
   * @param {boolean} reversed - Whether the direction is reversed.
   * @param {MovementDirection} direction - Movement direction.
   * @param {number} [targetPercent100ths] - Target position in hundredths of a percent.
   */
  override async handleMovement(type: MovementType, reversed: boolean, direction: MovementDirection, targetPercent100ths?: number) {
    // Do nothing here, as the device will handle the movement
  }
}

/**
 * WindowCovering server (lift + tilt) that forwards covering commands to the Matterbridge command handler.
 */
export class MatterbridgeLiftTiltWindowCoveringServer extends WindowCoveringServer.with(
  WindowCovering.Feature.Lift,
  WindowCovering.Feature.PositionAwareLift,
  WindowCovering.Feature.Tilt,
  WindowCovering.Feature.PositionAwareTilt,
) {
  /**
   * Handles UpOrOpen for lift/tilt window coverings.
   */
  override upOrOpen(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler(`upOrOpen`, { request: {}, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: upOrOpen called`);
    super.upOrOpen();
  }

  /**
   * Handles DownOrClose for lift/tilt window coverings.
   */
  override downOrClose(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler(`downOrClose`, { request: {}, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: downOrClose called`);
    super.downOrClose();
  }

  /**
   * Handles StopMotion for lift/tilt window coverings.
   */
  override stopMotion(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('stopMotion', { request: {}, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: stopMotion called`);
    super.stopMotion();
  }

  /**
   * Forwards GoToLiftPercentage requests to the Matterbridge command handler.
   *
   * @param {WindowCovering.GoToLiftPercentageRequest} request - Go-to-lift-percentage request payload.
   */
  override goToLiftPercentage(request: WindowCovering.GoToLiftPercentageRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover lift percentage to ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('goToLiftPercentage', { request, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: goToLiftPercentage with ${request.liftPercent100thsValue}`);
    super.goToLiftPercentage(request);
  }

  /**
   * Forwards GoToTiltPercentage requests to the Matterbridge command handler.
   *
   * @param {WindowCovering.GoToTiltPercentageRequest} request - Go-to-tilt-percentage request payload.
   */
  override goToTiltPercentage(request: WindowCovering.GoToTiltPercentageRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover tilt percentage to ${request.tiltPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('goToTiltPercentage', { request, cluster: WindowCoveringServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: goToTiltPercentage with ${request.tiltPercent100thsValue}`);
    super.goToTiltPercentage(request);
  }

  /**
   * No-op: movement is handled by the device implementation.
   *
   * @param {MovementType} type - Movement type.
   * @param {boolean} reversed - Whether the direction is reversed.
   * @param {MovementDirection} direction - Movement direction.
   * @param {number} [targetPercent100ths] - Target position in hundredths of a percent.
   */
  override async handleMovement(type: MovementType, reversed: boolean, direction: MovementDirection, targetPercent100ths?: number) {
    // Do nothing here, as the device will handle the movement
  }
}

/**
 * DoorLock server that forwards lock/unlock commands to the Matterbridge command handler.
 */
export class MatterbridgeDoorLockServer extends DoorLockServer {
  /**
   * Handles the LockDoor command.
   */
  override lockDoor(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Locking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('lockDoor', { request: {}, cluster: DoorLockServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    super.lockDoor();
  }

  /**
   * Handles the UnlockDoor command.
   */
  override unlockDoor(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Unlocking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('unlockDoor', { request: {}, cluster: DoorLockServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called`);
    super.unlockDoor();
  }
}

/**
 * FanControl server (auto + step) that forwards step commands to the Matterbridge command handler.
 */
export class MatterbridgeFanControlServer extends FanControlServer.with(FanControl.Feature.Auto, FanControl.Feature.Step) {
  /**
   * Forwards Step requests to the Matterbridge command handler and updates percentCurrent.
   *
   * @param {FanControl.StepRequest} request - Step request payload.
   */
  override step(request: FanControl.StepRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping fan with direction ${request.direction} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('step', { request, cluster: FanControlServer.id, attributes: this.state, endpoint: this.endpoint });

    const lookupStepDirection = ['Increase', 'Decrease'];
    device.log.debug(`MatterbridgeFanControlServer: step called with direction: ${lookupStepDirection[request.direction]} wrap: ${request.wrap} lowestOff: ${request.lowestOff}`);
    device.log.debug(`- current percentCurrent: ${this.state.percentCurrent}`);

    if (request.direction === FanControl.StepDirection.Increase) {
      if (request.wrap && this.state.percentCurrent === 100) {
        this.state.percentCurrent = request.lowestOff ? 0 : 10;
      } else this.state.percentCurrent = Math.min(this.state.percentCurrent + 10, 100);
    } else if (request.direction === FanControl.StepDirection.Decrease) {
      if (request.wrap && this.state.percentCurrent === (request.lowestOff ? 0 : 10)) {
        this.state.percentCurrent = 100;
      } else this.state.percentCurrent = Math.max(this.state.percentCurrent - 10, request.lowestOff ? 0 : 10);
    }
    device.log.debug('Set percentCurrent to:', this.state.percentCurrent);

    // step is not implemented in matter.js
    // super.step(request);
  }
}

/**
 * Thermostat server (cooling/heating/auto) with Matterbridge-specific command handling.
 */
export class MatterbridgeThermostatServer extends ThermostatServer.with(Thermostat.Feature.Cooling, Thermostat.Feature.Heating, Thermostat.Feature.AutoMode) {
  /**
   * Initializes thermostat behavior and adjusts command lists to avoid unsupported atomic commands.
   */
  /*
   * Fixed upstream in matter.js in 0.17.x
  override async initialize() {
    await super.initialize();

    // While matter.js solve the issue we remove the 'atomic' commands only required for Preset and Schedule features, to avoid the error "Unsupported command received: 0" when receiving a SetpointRaiseLower command without Preset or Schedule features
    this.endpoint.construction.onSuccess(async () => {
      const device = this.endpoint.stateOf(MatterbridgeServer);
      device.log.debug(`Removing atomic commands (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      /// @ts-expect-error cause acceptedCommandList and generatedCommandList are not typed in the cluster state
      await this.endpoint.setStateOf(ThermostatServer, {
        acceptedCommandList: [0],
        generatedCommandList: [],
      });
    });
  }
  */

  /**
   * Forwards SetpointRaiseLower requests to the Matterbridge command handler and updates occupied setpoints.
   *
   * @param {Thermostat.SetpointRaiseLowerRequest} request - Setpoint-raise/lower request payload.
   */
  override setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting setpoint by ${request.amount} in mode ${request.mode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setpointRaiseLower', { request, cluster: ThermostatServer.id, attributes: this.state, endpoint: this.endpoint });

    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10}`);
    if (this.state.occupiedHeatingSetpoint !== undefined) device.log.debug(`- current occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint / 100}`);
    if (this.state.occupiedCoolingSetpoint !== undefined) device.log.debug(`- current occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint / 100}`);

    if ((request.mode === Thermostat.SetpointRaiseLowerMode.Heat || request.mode === Thermostat.SetpointRaiseLowerMode.Both) && this.state.occupiedHeatingSetpoint !== undefined) {
      const setpoint = this.state.occupiedHeatingSetpoint / 100 + request.amount / 10;
      this.state.occupiedHeatingSetpoint = setpoint * 100;
      device.log.debug(`Set occupiedHeatingSetpoint to ${setpoint}`);
    }

    if ((request.mode === Thermostat.SetpointRaiseLowerMode.Cool || request.mode === Thermostat.SetpointRaiseLowerMode.Both) && this.state.occupiedCoolingSetpoint !== undefined) {
      const setpoint = this.state.occupiedCoolingSetpoint / 100 + request.amount / 10;
      this.state.occupiedCoolingSetpoint = setpoint * 100;
      device.log.debug(`Set occupiedCoolingSetpoint to ${setpoint}`);
    }

    // super.setpointRaiseLower(request);
  }
}

// istanbul ignore next
/**
 * Thermostat server with Presets feature enabled and Matterbridge-specific command handling.
 */
export class MatterbridgePresetThermostatServer extends ThermostatServer.with(
  Thermostat.Feature.Presets,
  Thermostat.Feature.Cooling,
  Thermostat.Feature.Heating,
  Thermostat.Feature.AutoMode,
) {
  /**
   * Forwards SetpointRaiseLower requests to the Matterbridge command handler and updates occupied setpoints.
   *
   * @param {Thermostat.SetpointRaiseLowerRequest} request - Setpoint-raise/lower request payload.
   */
  override setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting setpoint by ${request.amount} in mode ${request.mode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('setpointRaiseLower', { request, cluster: ThermostatServer.id, attributes: this.state, endpoint: this.endpoint });

    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10}`);
    if (this.state.occupiedHeatingSetpoint !== undefined) device.log.debug(`- current occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint / 100}`);
    if (this.state.occupiedCoolingSetpoint !== undefined) device.log.debug(`- current occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint / 100}`);

    if ((request.mode === Thermostat.SetpointRaiseLowerMode.Heat || request.mode === Thermostat.SetpointRaiseLowerMode.Both) && this.state.occupiedHeatingSetpoint !== undefined) {
      const setpoint = this.state.occupiedHeatingSetpoint / 100 + request.amount / 10;
      this.state.occupiedHeatingSetpoint = setpoint * 100;
      device.log.debug(`Set occupiedHeatingSetpoint to ${setpoint}`);
    }

    if ((request.mode === Thermostat.SetpointRaiseLowerMode.Cool || request.mode === Thermostat.SetpointRaiseLowerMode.Both) && this.state.occupiedCoolingSetpoint !== undefined) {
      const setpoint = this.state.occupiedCoolingSetpoint / 100 + request.amount / 10;
      this.state.occupiedCoolingSetpoint = setpoint * 100;
      device.log.debug(`Set occupiedCoolingSetpoint to ${setpoint}`);
    }

    // super.setpointRaiseLower(request);
  }

  /**
   * Forwards SetActivePresetRequest requests to the Matterbridge command handler.
   *
   * @param {Thermostat.SetActivePresetRequest} request - Set-active-preset request payload.
   */
  override setActivePresetRequest(request: Thermostat.SetActivePresetRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting preset to ${request.presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    // Update the internal state to reflect the active preset handle, so that attribute reads are always in sync after a command.
    if (request.presetHandle !== undefined) {
      this.state.activePresetHandle = request.presetHandle instanceof Uint8Array ? request.presetHandle : Uint8Array.from(request.presetHandle);
      device.log.debug(`Updated state.activePresetHandle to: ${Array.from(this.state.activePresetHandle)}`);
    }
    device.commandHandler.executeHandler('setActivePresetRequest', { request, cluster: ThermostatServer.id, attributes: this.state, endpoint: this.endpoint });

    device.log.debug(`MatterbridgePresetThermostatServer: setActivePresetRequest called with presetHandle: ${request.presetHandle}`);

    // super.setActivePresetRequest(request);
  }
}

/**
 * ValveConfigurationAndControl server that forwards valve commands to the Matterbridge command handler.
 */
export class MatterbridgeValveConfigurationAndControlServer extends ValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level) {
  /**
   * Forwards Open requests to the Matterbridge command handler and updates valve state.
   *
   * @param {ValveConfigurationAndControl.OpenRequest} request - Open request payload.
   */
  override open(request: ValveConfigurationAndControl.OpenRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Opening valve to ${request.targetLevel ? request.targetLevel + '%' : 'fully opened'} ${request.openDuration ? 'for ' + request.openDuration + 's' : 'until closed'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.commandHandler.executeHandler('open', { request, cluster: ValveConfigurationAndControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: open called with openDuration: ${request.openDuration} targetLevel: ${request.targetLevel}`);
    this.state.targetState = ValveConfigurationAndControl.ValveState.Open;
    this.state.currentState = ValveConfigurationAndControl.ValveState.Open;
    this.state.targetLevel = request.targetLevel ?? 100;
    this.state.currentLevel = request.targetLevel ?? 100;
    this.state.openDuration = request.openDuration ?? this.state.defaultOpenDuration;
    if (this.state.openDuration === null) this.state.remainingDuration = null;

    // open is not implemented in matter.js
    // super.open(request);
  }

  /**
   * Handles the Close command.
   */
  override close(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing valve (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('close', { request: {}, cluster: ValveConfigurationAndControlServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: close called`);
    this.state.targetState = ValveConfigurationAndControl.ValveState.Closed;
    this.state.currentState = ValveConfigurationAndControl.ValveState.Closed;
    this.state.targetLevel = 0;
    this.state.currentLevel = 0;
    this.state.openDuration = null;
    this.state.remainingDuration = null;

    // close is not implemented in matter.js
    // super.close();
  }
}

/**
 * Smoke/CO Alarm server that forwards self-test commands to the Matterbridge command handler.
 */
export class MatterbridgeSmokeCoAlarmServer extends SmokeCoAlarmServer.with(SmokeCoAlarm.Feature.SmokeAlarm, SmokeCoAlarm.Feature.CoAlarm) {
  /**
   * Handles the SelfTestRequest command.
   */
  override selfTestRequest(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Testing SmokeCOAlarm (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('selfTestRequest', { request: {}, cluster: SmokeCoAlarmServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeSmokeCoAlarmServer: selfTestRequest called`);

    // selfTestRequest is not implemented in matter.js
    // super.selfTestRequest();
  }
}

/**
 * BooleanStateConfiguration server that forwards alarm control commands to the Matterbridge command handler.
 */
export class MatterbridgeBooleanStateConfigurationServer extends BooleanStateConfigurationServer.with(
  BooleanStateConfiguration.Feature.Visual,
  BooleanStateConfiguration.Feature.Audible,
  BooleanStateConfiguration.Feature.SensitivityLevel,
) {
  /**
   * Forwards EnableDisableAlarm requests to the Matterbridge command handler.
   *
   * @param {BooleanStateConfiguration.EnableDisableAlarmRequest} request - Enable/disable-alarm request payload.
   */
  override enableDisableAlarm(request: BooleanStateConfiguration.EnableDisableAlarmRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Enabling/disabling alarm ${request.alarmsToEnableDisable} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('enableDisableAlarm', { request, cluster: BooleanStateConfigurationServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: enableDisableAlarm called`);

    // enableDisableAlarm is not implemented in matter.js
    // super.enableDisableAlarm(request);
  }
}

/**
 * Switch server placeholder; the device implementation drives switch logic.
 */
export class MatterbridgeSwitchServer extends SwitchServer {
  /**
   * Intentionally no-op: switch logic is handled by the device implementation.
   */
  override initialize() {
    // Do nothing here, as the device will handle the switch logic: we need to convert something like "single" into the appropriate sequence of state changes and events
  }
}

/**
 * OperationalState server that maps operational commands to Matterbridge command handler calls.
 */
export class MatterbridgeOperationalStateServer extends OperationalStateServer {
  /**
   * Initializes operational state defaults.
   */
  override initialize(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug('MatterbridgeOperationalStateServer initialized: setting operational state to Stopped');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    super.initialize(); // Error handling logic is handled in matter.js
  }

  /**
   * Handles the Pause command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override pause(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('pause', { request: {}, cluster: OperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeOperationalStateServer: pause called setting operational state to Paused');
    this.state.operationalState = OperationalState.OperationalStateEnum.Paused;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    // pause is not implemented in matter.js
    // return super.pause();
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Stop command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override stop(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('stop', { request: {}, cluster: OperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeOperationalStateServer: stop called setting operational state to Stopped');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    // stop is not implemented in matter.js
    // return super.stop();
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Start command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override start(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Start (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('start', { request: {}, cluster: OperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeOperationalStateServer: start called setting operational state to Running');
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    // start is not implemented in matter.js
    // return super.start();
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }

  /**
   * Handles the Resume command.
   *
   * @returns {MaybePromise<OperationalState.OperationalCommandResponse>} The operational command response.
   */
  override resume(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resume (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('resume', { request: {}, cluster: OperationalStateServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug('MatterbridgeOperationalStateServer: resume called setting operational state to Running');
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' };
    // resume is not implemented in matter.js
    // return super.resume();
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateDetails: 'Fully operational' },
    };
  }
}

/**
 * ServiceArea server that validates and applies selected areas.
 */
export class MatterbridgeServiceAreaServer extends ServiceAreaServer {
  /**
   * Validates area IDs, updates selectedAreas, and forwards the request.
   *
   * @param {ServiceArea.SelectAreasRequest} request - Select-areas request payload.
   * @returns {MaybePromise<ServiceArea.SelectAreasResponse>} The select-areas response.
   */
  override selectAreas(request: ServiceArea.SelectAreasRequest): MaybePromise<ServiceArea.SelectAreasResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Selecting areas ${request.newAreas} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('selectAreas', { request, cluster: ServiceAreaServer.id, attributes: this.state, endpoint: this.endpoint });
    for (const area of request.newAreas) {
      const supportedArea = this.state.supportedAreas.find((supportedArea) => supportedArea.areaId === area);
      if (!supportedArea) {
        device.log.error(`MatterbridgeServiceAreaServer selectAreas called with unsupported area: ${area}`);
        return { status: ServiceArea.SelectAreasStatus.UnsupportedArea, statusText: 'Unsupported areas' };
      }
    }
    this.state.selectedAreas = request.newAreas;
    device.log.debug(`MatterbridgeServiceAreaServer selectAreas called with: ${request.newAreas.map((area) => area.toString()).join(', ')}`);
    return super.selectAreas(request);
    // return { status: ServiceArea.SelectAreasStatus.Success, statusText: 'Succesfully selected new areas' };
  }
}

/**
 * ModeSelect server that forwards mode changes to the Matterbridge command handler.
 */
export class MatterbridgeModeSelectServer extends ModeSelectServer {
  /**
   * Forwards ChangeToMode requests to the Matterbridge command handler.
   *
   * @param {ModeSelect.ChangeToModeRequest} request - Change-to-mode request payload.
   */
  override changeToMode(request: ModeSelect.ChangeToModeRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: ModeSelectServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeModeSelectServer: changeToMode called with mode: ${request.newMode}`);
    super.changeToMode(request);
  }
}

/**
 * HEPA filter monitoring server that forwards reset commands and updates condition state.
 */
export class MatterbridgeHepaFilterMonitoringServer extends HepaFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition) {
  /**
   * Resets filter condition to 100%.
   */
  override resetCondition(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resetting condition (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('resetCondition', { cluster: MatterbridgeHepaFilterMonitoringServer.id, attributes: this.state, endpoint: this.endpoint });
    this.state.condition = 100; // Reset condition to 100%
    this.state.lastChangedTime = Math.floor(new Date().getTime() / 1000); // TlvEpochS (seconds since Unix epoch)
    device.log.debug(`MatterbridgeHepaFilterMonitoringServer: resetCondition called`);
  }
}

/**
 * Activated carbon filter monitoring server that forwards reset commands and updates condition state.
 */
export class MatterbridgeActivatedCarbonFilterMonitoringServer extends ActivatedCarbonFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition) {
  /**
   * Resets filter condition to 100%.
   */
  override resetCondition(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resetting condition (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('resetCondition', { cluster: MatterbridgeActivatedCarbonFilterMonitoringServer.id, attributes: this.state, endpoint: this.endpoint });
    this.state.condition = 100; // Reset condition to 100%
    this.state.lastChangedTime = Math.floor(new Date().getTime() / 1000); // TlvEpochS (seconds since Unix epoch)
    device.log.debug(`MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called`);
  }
}

/**
 * DeviceEnergyManagement server forwarding energy management commands to the Matterbridge command handler.
 */
export class MatterbridgeDeviceEnergyManagementServer extends DeviceEnergyManagementServer.with(
  DeviceEnergyManagement.Feature.PowerForecastReporting,
  DeviceEnergyManagement.Feature.PowerAdjustment,
) {
  /**
   * Forwards PowerAdjustRequest requests to the Matterbridge command handler.
   *
   * @param {DeviceEnergyManagement.PowerAdjustRequest} request - Power-adjust request payload.
   */
  override powerAdjustRequest(request: DeviceEnergyManagement.PowerAdjustRequest): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Adjusting power to ${request.power} duration ${request.duration} cause ${request.cause} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('powerAdjustRequest', { request, cluster: DeviceEnergyManagementServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${request.power} duration ${request.duration} cause ${request.cause}`);
    // The implementation is responsible for setting the device accordingly with the powerAdjustRequest command
    // powerAdjustRequest is not implemented in matter.js
    // return super.powerAdjustRequest();
  }
  /**
   * Cancels an in-progress power adjustment.
   */
  override cancelPowerAdjustRequest(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Cancelling power adjustment (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('cancelPowerAdjustRequest', { cluster: DeviceEnergyManagementServer.id, attributes: this.state, endpoint: this.endpoint });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called`);
    // The implementation is responsible for setting the device accordingly with the cancelPowerAdjustRequest command
    // cancelPowerAdjustRequest is not implemented in matter.js
    // return super.cancelPowerAdjustRequest();
  }
}

/**
 * DeviceEnergyManagementMode server that validates and applies energy optimization modes.
 */
export class MatterbridgeDeviceEnergyManagementModeServer extends DeviceEnergyManagementModeServer {
  /**
   * Validates the requested mode, updates opt-out state, and forwards the request.
   *
   * @param {ModeBase.ChangeToModeRequest} request - Change-to-mode request payload.
   * @returns {Promise<ModeBase.ChangeToModeResponse>} The change-to-mode response.
   */
  override async changeToMode(request: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    device.commandHandler.executeHandler('changeToMode', { request, cluster: DeviceEnergyManagementModeServer.id, attributes: this.state, endpoint: this.endpoint });
    const supported = this.state.supportedModes.find((mode) => mode.mode === request.newMode);
    if (!supported) {
      device.log.error(`MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: ${request.newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    this.state.currentMode = request.newMode;
    // The implementation is responsible for setting the device accordingly with the new mode if this logic is not enough
    if (supported.modeTags.find((tag) => tag.value === DeviceEnergyManagementMode.ModeTag.NoOptimization)) {
      if (this.endpoint.behaviors.has(DeviceEnergyManagementServer))
        await this.endpoint.setStateOf(DeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
          optOutState: DeviceEnergyManagement.OptOutState.OptOut,
        });
    } else {
      if (this.endpoint.behaviors.has(DeviceEnergyManagementServer))
        await this.endpoint.setStateOf(DeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
          optOutState: DeviceEnergyManagement.OptOutState.NoOptOut,
        });
    }
    device.log.debug(`MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode ${request.newMode} => ${supported.label}`);
    return super.changeToMode(request);
    // return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}
