/**
 * This file contains the behavior server classes of Matterbridge.
 *
 * @file matterbridgeBehaviorsServer.ts
 * @author Luca Liguori
 * @created 2024-11-07
 * @version 1.4.0
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
import { Bytes, MaybePromise, NamedHandler } from '@matter/general';
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
import { StatusResponse } from '@matter/types';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
// @matter clusters
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/types/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { FanControl } from '@matter/types/clusters/fan-control';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { EndpointNumber } from '@matter/types/datatype';
import { AnsiLogger } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { CommandHandler } from './matterbridgeEndpointCommandHandler.js';

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

// istanbul ignore next cause this is just a namespace for shared state types
export namespace MatterbridgeServer {
  /**
   * State shared by Matterbridge servers.
   */
  export class State {
    log!: AnsiLogger;
    commandHandler!: CommandHandler;
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
  override async identify(request: Identify.IdentifyRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Identifying device for ${request.identifyTime} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Identify.identify', {
      command: 'identify',
      request,
      cluster: IdentifyServer.id,
      attributes: this.state as unknown as (typeof Identify.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeIdentifyServer: identify called`);
    super.identify(request);
  }

  /**
   * Forwards TriggerEffect requests to the Matterbridge command handler.
   *
   * @param {Identify.TriggerEffectRequest} request - Trigger-effect request payload.
   */
  override async triggerEffect(request: Identify.TriggerEffectRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Triggering effect ${request.effectIdentifier} variant ${request.effectVariant} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Identify.triggerEffect', {
      command: 'triggerEffect',
      request,
      cluster: IdentifyServer.id,
      attributes: this.state as unknown as (typeof Identify.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async on(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device on (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.on', {
      command: 'on',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state as unknown as (typeof OnOff.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeOnOffServer: on called`);
    super.on();
  }

  /**
   * Handles the Off command.
   */
  override async off(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Switching device off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.off', {
      command: 'off',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state as unknown as (typeof OnOff.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeOnOffServer: off called`);
    super.off();
  }

  /**
   * Handles the Toggle command.
   */
  override async toggle(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Toggle device on/off (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OnOff.toggle', {
      command: 'toggle',
      request: {},
      cluster: OnOffServer.id,
      attributes: this.state as unknown as (typeof OnOff.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async moveToLevel(request: LevelControl.MoveToLevelRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LevelControl.moveToLevel', {
      command: 'moveToLevel',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as (typeof LevelControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called`);
    super.moveToLevel(request);
  }

  /**
   * Forwards MoveToLevelWithOnOff requests to the Matterbridge command handler.
   *
   * @param {LevelControl.MoveToLevelRequest} request - Move-to-level request payload.
   */
  override async moveToLevelWithOnOff(request: LevelControl.MoveToLevelRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting level to ${request.level} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('LevelControl.moveToLevelWithOnOff', {
      command: 'moveToLevelWithOnOff',
      request,
      cluster: LevelControlServer.id,
      attributes: this.state as unknown as (typeof LevelControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async moveToHue(request: ColorControl.MoveToHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting hue to ${request.hue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveToHue', {
      command: 'moveToHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    super.moveToHue(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    super.moveToSaturation(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called`);
    super.moveToHueAndSaturation(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    super.moveToColor(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async moveToHue(request: ColorControl.MoveToHueRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting hue to ${request.hue} with transitionTime ${request.transitionTime} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ColorControl.moveToHue', {
      command: 'moveToHue',
      request,
      cluster: ColorControlServer.id,
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    super.moveToHue(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHue called`);
    super.enhancedMoveToHue(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    super.moveToSaturation(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called`);
    super.moveToHueAndSaturation(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: enhancedMoveToHueAndSaturation called`);
    super.enhancedMoveToHueAndSaturation(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    super.moveToColor(request);
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
      attributes: this.state as unknown as (typeof ColorControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async upOrOpen(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.upOrOpen', {
      command: 'upOrOpen',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: upOrOpen called`);
    super.upOrOpen();
  }

  /**
   * Handles DownOrClose for lift-only window coverings.
   */
  override async downOrClose(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.downOrClose', {
      command: 'downOrClose',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: downOrClose called`);
    super.downOrClose();
  }

  /**
   * Handles StopMotion for lift-only window coverings.
   */
  override async stopMotion(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.stopMotion', {
      command: 'stopMotion',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: stopMotion called`);
    super.stopMotion();
  }

  /**
   * Forwards GoToLiftPercentage requests to the Matterbridge command handler.
   *
   * @param {WindowCovering.GoToLiftPercentageRequest} request - Go-to-lift-percentage request payload.
   */
  override async goToLiftPercentage(request: WindowCovering.GoToLiftPercentageRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover lift percentage to ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.goToLiftPercentage', {
      command: 'goToLiftPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async upOrOpen(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.upOrOpen', {
      command: 'upOrOpen',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: upOrOpen called`);
    super.upOrOpen();
  }

  /**
   * Handles DownOrClose for lift/tilt window coverings.
   */
  override async downOrClose(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.downOrClose', {
      command: 'downOrClose',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: downOrClose called`);
    super.downOrClose();
  }

  /**
   * Handles StopMotion for lift/tilt window coverings.
   */
  override async stopMotion(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.stopMotion', {
      command: 'stopMotion',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: stopMotion called`);
    super.stopMotion();
  }

  /**
   * Forwards GoToLiftPercentage requests to the Matterbridge command handler.
   *
   * @param {WindowCovering.GoToLiftPercentageRequest} request - Go-to-lift-percentage request payload.
   */
  override async goToLiftPercentage(request: WindowCovering.GoToLiftPercentageRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover lift percentage to ${request.liftPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.goToLiftPercentage', {
      command: 'goToLiftPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLiftTiltWindowCoveringServer: goToLiftPercentage with ${request.liftPercent100thsValue}`);
    super.goToLiftPercentage(request);
  }

  /**
   * Forwards GoToTiltPercentage requests to the Matterbridge command handler.
   *
   * @param {WindowCovering.GoToTiltPercentageRequest} request - Go-to-tilt-percentage request payload.
   */
  override async goToTiltPercentage(request: WindowCovering.GoToTiltPercentageRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting cover tilt percentage to ${request.tiltPercent100thsValue} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.goToTiltPercentage', {
      command: 'goToTiltPercentage',
      request,
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as (typeof WindowCovering.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async lockDoor(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Locking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.lockDoor', {
      command: 'lockDoor',
      request: {},
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as (typeof DoorLock.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    super.lockDoor();
  }

  /**
   * Handles the UnlockDoor command.
   */
  override async unlockDoor(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Unlocking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request: {},
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as (typeof DoorLock.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async step(request: FanControl.StepRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stepping fan with direction ${request.direction} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('FanControl.step', {
      command: 'step',
      request,
      cluster: FanControlServer.id,
      attributes: this.state as unknown as (typeof FanControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });

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
  override async initialize() {
    await super.initialize();

    // While matter.js solve the issue we remove the 'atomic' commands only required for Preset and Schedule features, to avoid the error "Unsupported command received: 0" when receiving a SetpointRaiseLower command without Preset or Schedule features
    this.endpoint.construction.onSuccess(async () => {
      const device = this.endpoint.stateOf(MatterbridgeServer);
      device.log.debug(`Removing atomic commands (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
      // @ts-expect-error cause acceptedCommandList and generatedCommandList are not typed in the cluster state
      await this.endpoint.setStateOf(ThermostatServer, {
        acceptedCommandList: [0],
        generatedCommandList: [],
      });
    });
  }

  /**
   * Forwards SetpointRaiseLower requests to the Matterbridge command handler and updates occupied setpoints.
   *
   * @param {Thermostat.SetpointRaiseLowerRequest} request - Setpoint-raise/lower request payload.
   */
  override async setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting setpoint by ${request.amount} in mode ${request.mode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setpointRaiseLower', {
      command: 'setpointRaiseLower',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as (typeof Thermostat.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10}`);
    await super.setpointRaiseLower(request);
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
  override async setpointRaiseLower(request: Thermostat.SetpointRaiseLowerRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Setting setpoint by ${request.amount} in mode ${request.mode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setpointRaiseLower', {
      command: 'setpointRaiseLower',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as (typeof Thermostat.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgePresetThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10}`);
    await super.setpointRaiseLower(request);
  }

  /**
   * Forwards SetActivePresetRequest requests to the Matterbridge command handler.
   *
   * @param {Thermostat.SetActivePresetRequest} request - Set-active-preset request payload.
   */
  override async setActivePresetRequest(request: Thermostat.SetActivePresetRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const presetHandle = request.presetHandle ? `0x${Buffer.from(request.presetHandle).toString('hex')}` : 'null';
    device.log.info(`Setting preset to ${presetHandle} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('Thermostat.setActivePresetRequest', {
      command: 'setActivePresetRequest',
      request,
      cluster: ThermostatServer.id,
      attributes: this.state as unknown as (typeof Thermostat.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgePresetThermostatServer: setActivePresetRequest called with presetHandle: ${presetHandle}`);
    await super.setActivePresetRequest(request);
    const activePresetHandle = this.state.activePresetHandle ? `0x${Buffer.from(this.state.activePresetHandle).toString('hex')}` : 'null';
    device.log.debug(
      `MatterbridgePresetThermostatServer: setActivePresetRequest completed with activePresetHandle: ${activePresetHandle} occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint} occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint}`,
    );
    // matter.js currently clears activePresetHandle again while applying preset-derived setpoint writes: that behavior appears questionable versus the Thermostat preset spec.
    // 4.3.10.9.2. Effect on Receipt. The server SHALL set the ActivePresetHandle attribute to the value of the PresetHandle field.
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
  override async open(request: ValveConfigurationAndControl.OpenRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Opening valve to ${request.targetLevel ? request.targetLevel + '%' : 'fully opened'} ${request.openDuration ? 'for ' + request.openDuration + 's' : 'until closed'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('ValveConfigurationAndControl.open', {
      command: 'open',
      request,
      cluster: ValveConfigurationAndControlServer.id,
      attributes: this.state as unknown as (typeof ValveConfigurationAndControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async close(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing valve (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ValveConfigurationAndControl.close', {
      command: 'close',
      request: {},
      cluster: ValveConfigurationAndControlServer.id,
      attributes: this.state as unknown as (typeof ValveConfigurationAndControl.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async selfTestRequest(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Testing SmokeCOAlarm (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('SmokeCoAlarm.selfTestRequest', {
      command: 'selfTestRequest',
      request: {},
      cluster: SmokeCoAlarmServer.id,
      attributes: this.state as unknown as (typeof SmokeCoAlarm.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async enableDisableAlarm(request: BooleanStateConfiguration.EnableDisableAlarmRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Enabling/disabling alarm ${request.alarmsToEnableDisable} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('BooleanStateConfiguration.enableDisableAlarm', {
      command: 'enableDisableAlarm',
      request,
      cluster: BooleanStateConfigurationServer.id,
      attributes: this.state as unknown as (typeof BooleanStateConfiguration.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async pause(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Pause (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.pause', {
      command: 'pause',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as (typeof OperationalState.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async stop(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stop (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.stop', {
      command: 'stop',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as (typeof OperationalState.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async start(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Start (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.start', {
      command: 'start',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as (typeof OperationalState.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async resume(): Promise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resume (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('OperationalState.resume', {
      command: 'resume',
      request: {},
      cluster: OperationalStateServer.id,
      attributes: this.state as unknown as (typeof OperationalState.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async selectAreas(request: ServiceArea.SelectAreasRequest): Promise<ServiceArea.SelectAreasResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Selecting areas ${request.newAreas} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ServiceArea.selectAreas', {
      command: 'selectAreas',
      request,
      cluster: ServiceAreaServer.id,
      attributes: this.state as unknown as (typeof ServiceArea.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    for (const area of request.newAreas) {
      const supportedArea = this.state.supportedAreas.find((supportedArea) => supportedArea.areaId === area);
      if (!supportedArea) {
        device.log.error(`MatterbridgeServiceAreaServer selectAreas called with unsupported area: ${area}`);
        return { status: ServiceArea.SelectAreasStatus.UnsupportedArea, statusText: 'Unsupported areas' };
      }
    }
    this.state.selectedAreas = request.newAreas;
    device.log.debug(`MatterbridgeServiceAreaServer selectAreas called with: ${request.newAreas.map((area) => area.toString()).join(', ')}`);
    return await super.selectAreas(request);
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
  override async changeToMode(request: ModeSelect.ChangeToModeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Changing mode to ${request.newMode} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ModeSelect.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: ModeSelectServer.id,
      attributes: this.state as unknown as (typeof ModeSelect.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async resetCondition(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resetting condition (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('HepaFilterMonitoring.resetCondition', {
      command: 'resetCondition',
      request: {},
      cluster: MatterbridgeHepaFilterMonitoringServer.id,
      attributes: this.state as unknown as (typeof HepaFilterMonitoring.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async resetCondition(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Resetting condition (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ActivatedCarbonFilterMonitoring.resetCondition', {
      command: 'resetCondition',
      request: {},
      cluster: MatterbridgeActivatedCarbonFilterMonitoringServer.id,
      attributes: this.state as unknown as (typeof ActivatedCarbonFilterMonitoring.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
  override async powerAdjustRequest(request: DeviceEnergyManagement.PowerAdjustRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Adjusting power to ${request.power} duration ${request.duration} cause ${request.cause} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagement.powerAdjustRequest', {
      command: 'powerAdjustRequest',
      request,
      cluster: DeviceEnergyManagementServer.id,
      attributes: this.state as unknown as (typeof DeviceEnergyManagement.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${request.power} duration ${request.duration} cause ${request.cause}`);
    // The implementation is responsible for setting the device accordingly with the powerAdjustRequest command
    // powerAdjustRequest is not implemented in matter.js
    // return super.powerAdjustRequest();
  }
  /**
   * Cancels an in-progress power adjustment.
   */
  override async cancelPowerAdjustRequest(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Cancelling power adjustment (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DeviceEnergyManagement.cancelPowerAdjustRequest', {
      command: 'cancelPowerAdjustRequest',
      request: {},
      cluster: DeviceEnergyManagementServer.id,
      attributes: this.state as unknown as (typeof DeviceEnergyManagement.CompleteInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
    await device.commandHandler.executeHandler('DeviceEnergyManagementMode.changeToMode', {
      command: 'changeToMode',
      request,
      cluster: DeviceEnergyManagementModeServer.id,
      attributes: this.state as unknown as (typeof DeviceEnergyManagementMode.ClusterInstance)['attributes'],
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
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
