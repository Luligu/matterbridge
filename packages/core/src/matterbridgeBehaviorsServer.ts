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
import { MaybePromise } from '@matter/general';
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
import { MovementDirection, MovementType, WindowCoveringBaseServer, WindowCoveringServer } from '@matter/node/behaviors/window-covering';
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
import { StatusResponse } from '@matter/types/common';
import { EndpointNumber, FabricIndex } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { getEnumDescription } from '@matterbridge/utils';
import { AnsiLogger, debugStringify } from 'node-ansi-logger';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import type { ClusterAttributeValues } from './matterbridgeEndpointCommandHandler.js';
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Identify.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeIdentifyServer: identify called`);
    await super.identify(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Identify.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeIdentifyServer: triggerEffect called`);
    await super.triggerEffect(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeOnOffServer: on called`);
    await super.on();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeOnOffServer: off called`);
    await super.off();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeOnOffServer: toggle called`);
    await super.toggle();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called`);
    await super.moveToLevel(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof LevelControl.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevelWithOnOff called`);
    await super.moveToLevelWithOnOff(request);
  }
}

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

/**
 * WindowCovering server (lift + tilt) that forwards covering commands to the Matterbridge command handler.
 */
export class MatterbridgeWindowCoveringServer extends WindowCoveringServer.with(
  WindowCovering.Feature.Lift,
  WindowCovering.Feature.PositionAwareLift,
  WindowCovering.Feature.Tilt,
  WindowCovering.Feature.PositionAwareTilt,
) {
  declare protected internal: WindowCoveringBaseServer.Internal;
  lookupMovementStatus = ['Stopped', 'Opening', 'Closing', 'Unknown'];

  /**
   * Will set the initial movement status to Stopped and target = current, which is a safe default until we get the real status from the device.
   * Disable automatic operational mode handling to let the device manage it.
   */
  override async initialize() {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Initializing MatterbridgeWindowCoveringServer (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    this.internal.disableOperationalModeHandling = true;
    await super.initialize();
  }

  /**
   * Handles UpOrOpen for lift/tilt window coverings.
   * Will set target position to 0.
   */
  override async upOrOpen(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Opening cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.upOrOpen', {
      command: 'upOrOpen',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: upOrOpen called`);
    await super.upOrOpen();
    // istanbul ignore next - this is just debug logging to verify that the state updates correctly after the command
    device.log.debug(
      `MatterbridgeWindowCoveringServer: upOrOpen result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.lookupMovementStatus[this.state.operationalStatus.global ?? 3]} lift ${this.lookupMovementStatus[this.state.operationalStatus.lift ?? 3]} tilt ${this.lookupMovementStatus[this.state.operationalStatus.tilt ?? 3]}`,
    );
  }

  /**
   * Handles DownOrClose for lift/tilt window coverings.
   * Will set target position to 10000.
   */
  override async downOrClose(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Closing cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.downOrClose', {
      command: 'downOrClose',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: downOrClose called`);
    await super.downOrClose(); // Will set target position to 10000 and trigger event
    // istanbul ignore next - this is just debug logging to verify that the state updates correctly after the command
    device.log.debug(
      `MatterbridgeWindowCoveringServer: downOrClose result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.lookupMovementStatus[this.state.operationalStatus.global ?? 3]} lift ${this.lookupMovementStatus[this.state.operationalStatus.lift ?? 3]} tilt ${this.lookupMovementStatus[this.state.operationalStatus.tilt ?? 3]}`,
    );
  }

  /**
   * Handles StopMotion for lift/tilt window coverings.
   * Will set target position to current position.
   */
  override async stopMotion(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Stopping cover (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('WindowCovering.stopMotion', {
      command: 'stopMotion',
      request: {},
      cluster: WindowCoveringServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: stopMotion called`);
    await super.stopMotion();
    // istanbul ignore next - this is just debug logging to verify that the state updates correctly after the command
    device.log.debug(
      `MatterbridgeWindowCoveringServer: stopMotion result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.lookupMovementStatus[this.state.operationalStatus.global ?? 3]} lift ${this.lookupMovementStatus[this.state.operationalStatus.lift ?? 3]} tilt ${this.lookupMovementStatus[this.state.operationalStatus.tilt ?? 3]}`,
    );
  }

  /**
   * Forwards GoToLiftPercentage requests to the Matterbridge command handler.
   * Will set target position to the requested value.
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: goToLiftPercentage with ${request.liftPercent100thsValue}`);
    await super.goToLiftPercentage(request);
    // istanbul ignore next - this is just debug logging to verify that the state updates correctly after the command
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToLiftPercentage result target ${this.state.targetPositionLiftPercent100ths} current ${this.state.currentPositionLiftPercent100ths} status global ${this.lookupMovementStatus[this.state.operationalStatus.global ?? 3]} lift ${this.lookupMovementStatus[this.state.operationalStatus.lift ?? 3]} tilt ${this.lookupMovementStatus[this.state.operationalStatus.tilt ?? 3]}`,
    );
  }

  /**
   * Forwards GoToTiltPercentage requests to the Matterbridge command handler.
   * Will set target position to the requested value.
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeWindowCoveringServer: goToTiltPercentage with ${request.tiltPercent100thsValue}`);
    await super.goToTiltPercentage(request);
    // istanbul ignore next - this is just debug logging to verify that the state updates correctly after the command
    device.log.debug(
      `MatterbridgeWindowCoveringServer: goToTiltPercentage result target ${this.state.targetPositionTiltPercent100ths} current ${this.state.currentPositionTiltPercent100ths} status global ${this.lookupMovementStatus[this.state.operationalStatus.global ?? 3]} lift ${this.lookupMovementStatus[this.state.operationalStatus.lift ?? 3]} tilt ${this.lookupMovementStatus[this.state.operationalStatus.tilt ?? 3]}`,
    );
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
 * WindowCovering server (lift) that forwards covering commands to the Matterbridge command handler.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeWindowCoveringServer with only the Lift and PositionAwareLift features.
 */
export class MatterbridgeLiftWindowCoveringServer extends MatterbridgeWindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift) {}

/**
 * WindowCovering server (lift + tilt) that forwards covering commands to the Matterbridge command handler.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeWindowCoveringServer with the Lift, PositionAwareLift, Tilt and PositionAwareTilt features.
 */
export class MatterbridgeLiftTiltWindowCoveringServer extends MatterbridgeWindowCoveringServer.with(
  WindowCovering.Feature.Lift,
  WindowCovering.Feature.PositionAwareLift,
  WindowCovering.Feature.Tilt,
  WindowCovering.Feature.PositionAwareTilt,
) {}

/**
 * DoorLock server that forwards lock, user, and credential commands to the Matterbridge command handler.
 */
export class MatterbridgeDoorLockServer extends DoorLockServer.enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
}) {
  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Locking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.lockDoor', {
      command: 'lockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    await super.lockDoor(request);
  }

  /**
   * Handles the UnlockDoor command.
   * It will set lockState to Unlocked.
   *
   * @param {DoorLock.UnlockDoorRequest} request - Unlock-door request payload.
   */
  override async unlockDoor(request: DoorLock.UnlockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Unlocking door (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called`);
    await super.unlockDoor(request);
  }

  /**
   * Handles the UnlockWithTimeout command.
   * It will set lockState to Unlocked.
   * The implementation of relocking after the timeout expires is left to the device.
   *
   * @param {DoorLock.UnlockWithTimeoutRequest} request - Unlock-door request payload.
   */
  override async unlockWithTimeout(request: DoorLock.UnlockWithTimeoutRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Unlocking door with timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.unlockWithTimeout', {
      command: 'unlockWithTimeout',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockWithTimeout called`);
    this.state.lockState = DoorLock.LockState.Unlocked;
    // unlockWithTimeout is not implemented in the base DoorLockServer
    // await super.unlockWithTimeout(request);
  }
}

/**
 * DoorLock server with PinCredential and CredentialOverTheAirAccess features that forwards lock, user, and credential commands to the Matterbridge command handler.
 * This is not supported by Apple Home. Home requires User and Pin.
 * Work in progress. Waiting https://github.com/matter-js/matter.js/issues/3468.
 */
export class MatterbridgePinDoorLockServer extends DoorLockServer.with(DoorLock.Feature.PinCredential, DoorLock.Feature.CredentialOverTheAirAccess).enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true, setUserStatus: true, getUserStatus: true, setUserType: true, getUserType: true },
}) {
  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Locking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.lockDoor', {
      command: 'lockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    await super.lockDoor(request);
  }

  /**
   * Handles the UnlockDoor command.
   * It will set lockState to Unlocked.
   *
   * @param {DoorLock.UnlockDoorRequest} request - Unlock-door request payload.
   */
  override async unlockDoor(request: DoorLock.UnlockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called`);
    await super.unlockDoor(request);
  }

  /**
   * Handles the UnlockWithTimeout command.
   * It will set lockState to Unlocked.
   * The implementation of relocking after the timeout expires is left to the device.
   *
   * @param {DoorLock.UnlockWithTimeoutRequest} request - Unlock-door request payload.
   */
  override async unlockWithTimeout(request: DoorLock.UnlockWithTimeoutRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.unlockWithTimeout', {
      command: 'unlockWithTimeout',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockWithTimeout called`);
    this.state.lockState = DoorLock.LockState.Unlocked;
    // unlockWithTimeout is not implemented in the base DoorLockServer
    // await super.unlockWithTimeout(request);
  }

  /**
   * Handles the SetPinCode command (feature PinCredential not User).
   *
   * @param {DoorLock.SetPinCodeRequest} request - Set-pin-code request payload.
   */
  override async setPinCode(request: DoorLock.SetPinCodeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting pin code ${request.pin ? '0x' + Buffer.from(request.pin).toString('hex') : 'N/A'} for user ${request.userId} type ${getEnumDescription(DoorLock.UserType, request.userType)} status ${getEnumDescription(DoorLock.UserStatus, request.userStatus)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setPinCode', {
      command: 'setPinCode',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setPinCode called for user ${request.userId}`);
  }

  /**
   *  Handles the GetPinCode command (feature PinCredential not User).
   *
   * @param {DoorLock.GetPinCodeRequest} request - Get-pin-code request payload.
   * @returns {Promise<DoorLock.GetPinCodeResponse>} - Get-pin-code response payload.
   */
  override async getPinCode(request: DoorLock.GetPinCodeRequest): Promise<DoorLock.GetPinCodeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting pin code for user ${request.userId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getPinCode', {
      command: 'getPinCode',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.Available,
      userType: DoorLock.UserType.UnrestrictedUser,
      pinCode: Buffer.from('1234'), // Return a dummy pin code for testing purposes
    };
  }

  /**
   * Handles the ClearPinCode command (feature PinCredential not User).
   *
   * @param {DoorLock.ClearPinCodeRequest} request - Clear-pin-code request payload.
   */
  override async clearPinCode(request: DoorLock.ClearPinCodeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Clearing pin code for ${request.pinSlotIndex === 0xfffe ? 'all slots' : 'slot ' + request.pinSlotIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearPinCode', {
      command: 'clearPinCode',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearPinCode called for ${request.pinSlotIndex === 0xfffe ? 'all PIN slots' : 'PIN slot ' + request.pinSlotIndex}`);
  }

  /**
   * Handles the ClearAllPinCodes command (feature PinCredential not User).
   */
  override async clearAllPinCodes(): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Clearing all pin codes (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.clearAllPinCodes', {
      command: 'clearAllPinCodes',
      request: {},
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug('MatterbridgeDoorLockServer: clearAllPinCodes called');
  }

  /**
   * Handles the SetUserStatus command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserStatusRequest} request - SetUserStatus request payload.
   * @returns {Promise<void>} - Promise that resolves when the command is executed.
   */
  async setUserStatus(request: DoorLock.SetUserStatusRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting user status for user ${request.userId} to ${getEnumDescription(DoorLock.UserStatus, request.userStatus)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setUserStatus', {
      command: 'setUserStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setUserStatus called for user ${request.userId}`);
  }

  /**
   * Handles the GetUserStatus command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserStatusRequest} request - GetUserStatus request payload.
   * @returns {Promise<DoorLock.GetUserStatusResponse>} - GetUserStatus response payload with dummy data for testing purposes.
   */
  async getUserStatus(request: DoorLock.GetUserStatusRequest): Promise<DoorLock.GetUserStatusResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting user status for user ${request.userId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getUserStatus', {
      command: 'getUserStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: getUserStatus called for user ${request.userId}`);
    return {
      userId: request.userId,
      userStatus: DoorLock.UserStatus.Available,
    };
  }
  /**
   * Handles the SetUserType command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserTypeRequest} request - SetUserType request payload.
   * @returns {Promise<void>} - Promise that resolves when the command is executed.
   */
  async setUserType(request: DoorLock.SetUserTypeRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Setting user type for user ${request.userId} to ${getEnumDescription(DoorLock.UserType, request.userType)} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setUserType', {
      command: 'setUserType',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: setUserType called for user ${request.userId}`);
  }

  /**
   * Handles the GetUserType command (feature PinCredential not User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.GetUserTypeRequest} request - GetUserType request payload.
   * @returns {Promise<DoorLock.GetUserTypeResponse>} - GetUserType response payload with dummy data for testing purposes.
   */
  async getUserType(request: DoorLock.GetUserTypeRequest): Promise<DoorLock.GetUserTypeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting user type for user ${request.userId} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getUserType', {
      command: 'getUserType',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: getUserType called for user ${request.userId}`);
    return {
      userId: request.userId,
      userType: DoorLock.UserType.UnrestrictedUser,
    };
  }
}

/**
 * DoorLock server with User and PinCredential features that forwards lock, user, and credential commands to the Matterbridge command handler.
 * This is supported by Apple Home.
 * Work in progress. Waiting https://github.com/matter-js/matter.js/issues/3468.
 */
export class MatterbridgeUserPinDoorLockServer extends DoorLockServer.with(
  DoorLock.Feature.User,
  DoorLock.Feature.PinCredential,
  DoorLock.Feature.CredentialOverTheAirAccess,
).enable({
  events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true },
  commands: { lockDoor: true, unlockDoor: true, unlockWithTimeout: true },
}) {
  declare protected internal: MatterbridgeUserPinDoorLockServer.Internal;

  private getAccessingFabricIndex(): FabricIndex | null {
    let fabricIndex: FabricIndex | undefined;

    try {
      fabricIndex = this.context.fabric;
    } catch {
      return null;
    }

    if (fabricIndex === undefined || fabricIndex === FabricIndex.NO_FABRIC) {
      return null;
    }
    return fabricIndex;
  }

  private findStoredCredential(credential: DoorLock.Credential) {
    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType === credential.credentialType && storedCredential.credentialIndex === credential.credentialIndex) {
          return { user, storedCredential };
        }
      }
    }
    return null;
  }

  private getStoredCredentialStateDebug() {
    if (this.internal.users.length === 0) {
      return 'no users';
    }

    return this.internal.users
      .map((user) => {
        const credentials =
          user.credentials
            ?.map(
              (credential) =>
                `${getEnumDescription(DoorLock.CredentialType, credential.credentialType)}:${credential.credentialIndex}=0x${Buffer.from(credential.credentialData).toString('hex')}`,
            )
            .join(', ') ?? 'none';
        return `user ${user.userIndex} [${credentials}]`;
      })
      .join('; ');
  }

  private logStoredCredentialState(reason: string) {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug(`MatterbridgeDoorLockServer: ${reason}; stored credentials: ${this.getStoredCredentialStateDebug()}`);
  }

  private hasMatchingPinCredential(pinCode: Uint8Array) {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.debug(`MatterbridgeDoorLockServer: checking remote PIN 0x${Buffer.from(pinCode).toString('hex')} against ${this.internal.users.length} user(s)`);

    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType !== DoorLock.CredentialType.Pin) {
          continue;
        }
        if (Buffer.from(storedCredential.credentialData).equals(Buffer.from(pinCode))) {
          device.log.debug(`MatterbridgeDoorLockServer: remote PIN matched userIndex ${user.userIndex} credentialIndex ${storedCredential.credentialIndex}`);
          return true;
        }
      }
    }

    device.log.debug(`MatterbridgeDoorLockServer: remote PIN 0x${Buffer.from(pinCode).toString('hex')} did not match any stored PIN credential`);
    return false;
  }

  private validateRemotePinCode(pinCode: Uint8Array | undefined) {
    const device = this.endpoint.stateOf(MatterbridgeServer);

    if (!this.state.requirePinForRemoteOperation) {
      device.log.debug('MatterbridgeDoorLockServer: skipping remote PIN validation because requirePinForRemoteOperation is false');
      return;
    }

    if (pinCode === undefined) {
      device.log.debug('MatterbridgeDoorLockServer: rejecting remote operation because the request did not include a PIN');
      this.logStoredCredentialState('remote PIN validation failed');
      throw new StatusResponse.FailureError('Missing or invalid PIN code for remote operation');
    }

    device.log.debug(`MatterbridgeDoorLockServer: validating remote PIN 0x${Buffer.from(pinCode).toString('hex')}`);

    if (pinCode === undefined || !this.hasMatchingPinCredential(pinCode)) {
      this.logStoredCredentialState('remote PIN validation failed');
      throw new StatusResponse.FailureError('Missing or invalid PIN code for remote operation');
    }

    device.log.debug(`MatterbridgeDoorLockServer: accepted remote PIN 0x${Buffer.from(pinCode).toString('hex')}`);
  }

  private getNextOccupiedCredentialIndex(credential: DoorLock.Credential): number | null {
    let nextCredentialIndex: number | null = null;

    for (const user of this.internal.users) {
      for (const storedCredential of user.credentials ?? []) {
        if (storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex <= credential.credentialIndex) {
          continue;
        }
        if (nextCredentialIndex === null || storedCredential.credentialIndex < nextCredentialIndex) {
          nextCredentialIndex = storedCredential.credentialIndex;
        }
      }
    }

    return nextCredentialIndex;
  }

  private upsertStoredCredential(userIndex: number | null, credential: DoorLock.Credential, credentialData: Uint8Array) {
    const device = this.endpoint.stateOf(MatterbridgeServer);

    if (userIndex === null) {
      device.log.debug(
        `MatterbridgeDoorLockServer: not storing credentialType ${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex} because userIndex is null`,
      );
      return;
    }

    const user = this.internal.users.find((storedUser) => storedUser.userIndex === userIndex);
    if (!user) {
      device.log.debug(
        `MatterbridgeDoorLockServer: not storing credentialType ${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex} because userIndex ${userIndex} was not found`,
      );
      return;
    }

    let removedCredentials = 0;
    for (const storedUser of this.internal.users) {
      const nextCredentials =
        storedUser.credentials?.filter(
          (storedCredential) => storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex !== credential.credentialIndex,
        ) ?? null;
      removedCredentials += (storedUser.credentials?.length ?? 0) - (nextCredentials?.length ?? 0);
      storedUser.credentials = nextCredentials && nextCredentials.length > 0 ? nextCredentials : null;
    }

    if (!user.credentials) {
      user.credentials = [];
    }
    user.credentials.push({
      credentialType: credential.credentialType,
      credentialIndex: credential.credentialIndex,
      credentialData: Uint8Array.from(credentialData),
    });
    device.log.debug(
      `MatterbridgeDoorLockServer: stored credentialType ${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex} for userIndex ${userIndex} (removed ${removedCredentials} replaced credential(s))`,
    );
    this.logStoredCredentialState('credential stored');
  }

  private clearStoredCredential(credential: DoorLock.Credential | null) {
    const device = this.endpoint.stateOf(MatterbridgeServer);

    for (const user of this.internal.users) {
      if (credential === null) {
        user.credentials = null;
        continue;
      }

      const nextCredentials =
        user.credentials?.filter(
          (storedCredential) => storedCredential.credentialType !== credential.credentialType || storedCredential.credentialIndex !== credential.credentialIndex,
        ) ?? null;
      user.credentials = nextCredentials && nextCredentials.length > 0 ? nextCredentials : null;
    }

    device.log.debug(
      `MatterbridgeDoorLockServer: cleared ${credential ? `${getEnumDescription(DoorLock.CredentialType, credential.credentialType)} credentialIndex ${credential.credentialIndex}` : 'all credentials'} from internal state`,
    );
    this.logStoredCredentialState('credential cleared');
  }

  /**
   * Handles the LockDoor command.
   * It will set lockState to Locked.
   *
   * @param {DoorLock.LockDoorRequest} request - Lock-door request payload.
   */
  override async lockDoor(request: DoorLock.LockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Locking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.validateRemotePinCode(request.pinCode);
    device.log.debug(`MatterbridgeDoorLockServer: remote lockDoor PIN validation completed`);
    await device.commandHandler.executeHandler('DoorLock.lockDoor', {
      command: 'lockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    await super.lockDoor(request);
  }

  /**
   * Handles the UnlockDoor command.
   * It will set lockState to Unlocked.
   *
   * @param {DoorLock.UnlockDoorRequest} request - Unlock-door request payload.
   */
  override async unlockDoor(request: DoorLock.UnlockDoorRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.validateRemotePinCode(request.pinCode);
    device.log.debug(`MatterbridgeDoorLockServer: remote unlockDoor PIN validation completed`);
    await device.commandHandler.executeHandler('DoorLock.unlockDoor', {
      command: 'unlockDoor',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called`);
    await super.unlockDoor(request);
  }

  /**
   * Handles the UnlockWithTimeout command.
   * It will set lockState to Unlocked.
   * The implementation of relocking after the timeout expires is left to the device.
   *
   * @param {DoorLock.UnlockWithTimeoutRequest} request - Unlock-door request payload.
   */
  override async unlockWithTimeout(request: DoorLock.UnlockWithTimeoutRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Unlocking door with pincode ${request.pinCode ? '0x' + Buffer.from(request.pinCode).toString('hex') : 'N/A'} timeout ${request.timeout} seconds (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    this.validateRemotePinCode(request.pinCode);
    device.log.debug(`MatterbridgeDoorLockServer: remote unlockWithTimeout PIN validation completed`);
    await device.commandHandler.executeHandler('DoorLock.unlockWithTimeout', {
      command: 'unlockWithTimeout',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: unlockWithTimeout called`);
    this.state.lockState = DoorLock.LockState.Unlocked;
    // unlockWithTimeout is not implemented in the base DoorLockServer
    // await super.unlockWithTimeout(request);
  }

  /**
   * Handles the SetUser command (feature User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.SetUserRequest} request - Set-user request payload.
   */
  override async setUser(request: DoorLock.SetUserRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const accessingFabricIndex = this.getAccessingFabricIndex();
    device.log.info(
      `Setting user operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} userIndex ${request.userIndex} userName ${request.userName ?? 'null'} userUniqueId ${request.userUniqueId ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} credentialRule ${getEnumDescription(DoorLock.CredentialRule, request.credentialRule, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    device.log.debug(`MatterbridgeDoorLockServer: setUser accessingFabricIndex ${accessingFabricIndex ?? 'null'}`);
    await device.commandHandler.executeHandler('DoorLock.setUser', {
      command: 'setUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const user = this.internal.users.find((user) => user.userIndex === request.userIndex);
    device.log.debug(`MatterbridgeDoorLockServer: setUser called for userIndex ${request.userIndex} (${user ? 'existing user ' + debugStringify(user) : 'new user'})`);
    if (!user && request.operationType === DoorLock.DataOperationType.Add) {
      this.internal.users.push({
        userIndex: request.userIndex,
        userName: request.userName,
        userUniqueId: request.userUniqueId,
        userStatus: request.userStatus,
        userType: request.userType,
        credentialRule: request.credentialRule,
        credentials: null,
        creatorFabricIndex: accessingFabricIndex,
        lastModifiedFabricIndex: accessingFabricIndex,
        nextUserIndex: null,
      });
      device.log.debug(
        `MatterbridgeDoorLockServer: added userIndex ${request.userIndex} (total users: ${this.internal.users.length}) to internal state: ${debugStringify(this.internal.users.find((user) => user.userIndex === request.userIndex))}`,
      );
      this.logStoredCredentialState('user added');
      return;
    }

    this.logStoredCredentialState(`setUser completed for userIndex ${request.userIndex} without adding a new internal user`);
  }

  /**
   * Handles the GetUser command (feature User).
   * The implementation of user management is left to the device, here we just forward the command and return a stub response.
   *
   * @param {DoorLock.GetUserRequest} request - Get-user request payload.
   * @returns {Promise<DoorLock.GetUserResponse>} - Get-user response payload.
   */
  override async getUser(request: DoorLock.GetUserRequest): Promise<DoorLock.GetUserResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(`Getting userIndex ${request.userIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('DoorLock.getUser', {
      command: 'getUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const user = this.internal.users.find((user) => user.userIndex === request.userIndex);
    device.log.debug(
      `MatterbridgeDoorLockServer: getUser called for userIndex ${request.userIndex} (total users: ${this.internal.users.length}) (${user ? 'existing user: ' + debugStringify(user) : 'new user'})`,
    );
    this.logStoredCredentialState(`getUser returning state for userIndex ${request.userIndex}`);
    if (user) {
      return {
        ...user,
        credentials: user.credentials?.map(({ credentialType, credentialIndex }) => ({ credentialType, credentialIndex })) ?? null,
      };
    }

    return {
      userIndex: request.userIndex,
      userName: null,
      userUniqueId: null,
      userStatus: null,
      userType: null,
      credentialRule: null,
      credentials: null,
      creatorFabricIndex: null,
      lastModifiedFabricIndex: null,
      nextUserIndex: null,
    };
  }

  /**
   * Handles the ClearUser command (feature User).
   * The implementation of user management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.ClearUserRequest} request - Clear-user request payload.
   */
  override async clearUser(request: DoorLock.ClearUserRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Clearing userIndex ${request.userIndex} ${request.userIndex === 0xfffe ? '(all users)' : ''} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearUser', {
      command: 'clearUser',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDoorLockServer: clearUser called for userIndex ${request.userIndex}`);
    this.logStoredCredentialState(`clearUser completed for userIndex ${request.userIndex}`);
  }

  /**
   * Handles the SetCredential command (feature User).
   * The implementation of credential management is left to the device, here we just forward the command and return a stub response.
   *
   * @param {DoorLock.SetCredentialRequest} request - Set-credential request payload.
   * @returns {Promise<DoorLock.SetCredentialResponse>} - Set-credential response payload.
   */
  override async setCredential(request: DoorLock.SetCredentialRequest): Promise<DoorLock.SetCredentialResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    const accessingFabricIndex = this.getAccessingFabricIndex();
    device.log.info(
      `Setting credential operationType ${getEnumDescription(DoorLock.DataOperationType, request.operationType)} credentialType ${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex} credentialData ${Buffer.from(request.credentialData).toString('hex') ? '0x' + Buffer.from(request.credentialData).toString('hex') : '0x'} userIndex ${request.userIndex ?? 'null'} userStatus ${getEnumDescription(DoorLock.UserStatus, request.userStatus, { fallback: 'null' })} userType ${getEnumDescription(DoorLock.UserType, request.userType, { fallback: 'null' })} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.setCredential', {
      command: 'setCredential',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const user = this.internal.users.find((user) => user.userIndex === request.userIndex);
    const existingCredential = this.findStoredCredential(request.credential);
    device.log.debug(
      `MatterbridgeDoorLockServer: setCredential pre-update lookup for credentialIndex ${request.credential.credentialIndex} (${existingCredential ? 'existing credential found' : 'no existing credential'})`,
    );
    device.log.debug(`MatterbridgeDoorLockServer: setCredential called for credentialIndex ${request.credential.credentialIndex}`);
    if (user && (request.operationType === DoorLock.DataOperationType.Add || request.operationType === DoorLock.DataOperationType.Modify)) {
      this.upsertStoredCredential(request.userIndex, request.credential, request.credentialData);
      user.lastModifiedFabricIndex = accessingFabricIndex;
      device.log.debug(`MatterbridgeDoorLockServer: setCredential updated lastModifiedFabricIndex for userIndex ${user.userIndex} to ${accessingFabricIndex ?? 'null'}`);
    } else {
      device.log.debug(
        `MatterbridgeDoorLockServer: setCredential did not update internal state for credentialIndex ${request.credential.credentialIndex} (user ${request.userIndex ?? 'null'} not found or operation not handled)`,
      );
    }
    return {
      status: Status.Success,
      userIndex: request.userIndex,
    };
  }

  /**
   * Handles the GetCredentialStatus command (feature User).
   * The implementation of credential management is left to the device, here we just forward the command and return a stub response.
   *
   * @param {DoorLock.GetCredentialStatusRequest} request - Get-credential-status request payload.
   * @returns {Promise<DoorLock.GetCredentialStatusResponse>} - Get-credential-status response payload.
   */
  override async getCredentialStatus(request: DoorLock.GetCredentialStatusRequest): Promise<DoorLock.GetCredentialStatusResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Getting credential status for credentialType ${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.getCredentialStatus', {
      command: 'getCredentialStatus',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const credentialRecord = this.findStoredCredential(request.credential);
    const nextCredentialIndex = this.getNextOccupiedCredentialIndex(request.credential);
    device.log.debug(`MatterbridgeDoorLockServer: getCredentialStatus called`);
    device.log.debug(
      `MatterbridgeDoorLockServer: getCredentialStatus result for credentialIndex ${request.credential.credentialIndex} (${credentialRecord ? `userIndex ${credentialRecord.user.userIndex} credentialData 0x${Buffer.from(credentialRecord.storedCredential.credentialData).toString('hex')}` : 'credential missing'}, nextCredentialIndex ${nextCredentialIndex ?? 'null'})`,
    );
    return {
      credentialExists: credentialRecord !== null,
      userIndex: credentialRecord?.user.userIndex ?? null,
      creatorFabricIndex: credentialRecord?.user.creatorFabricIndex ?? null,
      lastModifiedFabricIndex: credentialRecord?.user.lastModifiedFabricIndex ?? null,
      nextCredentialIndex,
      credentialData: credentialRecord?.storedCredential.credentialData ?? null,
    };
  }

  /**
   * Handles the ClearCredential command (feature User).
   * The implementation of credential management is left to the device, here we just forward the command and log it.
   *
   * @param {DoorLock.ClearCredentialRequest} request - Clear-credential request payload.
   */
  override async clearCredential(request: DoorLock.ClearCredentialRequest): Promise<void> {
    const device = this.endpoint.stateOf(MatterbridgeServer);
    device.log.info(
      `Clearing credentialType ${request.credential ? getEnumDescription(DoorLock.CredentialType, request.credential.credentialType) : 'null'} credentialIndex ${request.credential ? request.credential.credentialIndex : 'null'} ${request.credential === null ? '(all credentials)' : ''} (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`,
    );
    await device.commandHandler.executeHandler('DoorLock.clearCredential', {
      command: 'clearCredential',
      request,
      cluster: DoorLockServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    this.clearStoredCredential(request.credential);
    device.log.debug('MatterbridgeDoorLockServer: clearCredential called');
    this.logStoredCredentialState(
      `clearCredential completed for ${
        request.credential
          ? `${getEnumDescription(DoorLock.CredentialType, request.credential.credentialType)} credentialIndex ${request.credential.credentialIndex}`
          : 'all credentials'
      }`,
    );
  }
}

/* istanbul ignore next -- TypeScript namespace merging emits an unreachable binary-expression branch */
export namespace MatterbridgeUserPinDoorLockServer {
  export type StoredCredential = DoorLock.Credential & {
    credentialData: Uint8Array;
  };

  export type StoredUser = {
    userIndex: number;
    userName: string | null;
    userUniqueId: number | null;
    userStatus: DoorLock.UserStatus | null;
    userType: DoorLock.UserType | null;
    credentialRule: DoorLock.CredentialRule | null;
    credentials: StoredCredential[] | null;
    creatorFabricIndex: FabricIndex | null;
    lastModifiedFabricIndex: FabricIndex | null;
    nextUserIndex: number | null;
  };

  /**
   * Runtime internal state for the DoorLock server.
   * Matter.js keeps this on the behavior backing, so it survives behavior instance recreation.
   * TODO: consider persistence options if the device needs to remember users/credentials across reboots.
   */
  export class Internal {
    users: StoredUser[] = [];
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof FanControl.Complete)['attributes']>,
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
    // await super.step(request);
  }
}

/**
 * Thermostat server (cooling/heating/auto/presets) with Matterbridge-specific command handling.
 */
export class MatterbridgeThermostatServer extends ThermostatServer.with(
  Thermostat.Feature.Cooling,
  Thermostat.Feature.Heating,
  Thermostat.Feature.AutoMode,
  Thermostat.Feature.Presets,
) {
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[request.mode]} amount: ${request.amount / 10}`);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof Thermostat.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeThermostatServer: setActivePresetRequest called with presetHandle: ${presetHandle}`);
    await super.setActivePresetRequest(request);
    const activePresetHandle = this.state.activePresetHandle ? `0x${Buffer.from(this.state.activePresetHandle).toString('hex')}` : 'null';
    device.log.debug(
      `MatterbridgeThermostatServer: setActivePresetRequest completed with activePresetHandle: ${activePresetHandle} occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint} occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint}`,
    );
    // matter.js currently clears activePresetHandle again while applying preset-derived setpoint writes: that behavior appears questionable versus the Thermostat preset spec.
    // 4.3.10.9.2. Effect on Receipt. The server SHALL set the ActivePresetHandle attribute to the value of the PresetHandle field.
  }
}

/**
 * Thermostat server with Presets feature enabled and Matterbridge-specific command handling.
 *
 * @deprecated This server is deprecated in favor of using MatterbridgeThermostatServer with the Presets feature.
 */
export class MatterbridgePresetThermostatServer extends ThermostatServer.with(
  Thermostat.Feature.Presets,
  Thermostat.Feature.Cooling,
  Thermostat.Feature.Heating,
  Thermostat.Feature.AutoMode,
) {}

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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ValveConfigurationAndControl.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ValveConfigurationAndControl.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof SmokeCoAlarm.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof BooleanStateConfiguration.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>,
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
    device.log.info(`Selecting areas [${request.newAreas.join(', ')}] (endpoint ${this.endpoint.maybeId}.${this.endpoint.maybeNumber})`);
    await device.commandHandler.executeHandler('ServiceArea.selectAreas', {
      command: 'selectAreas',
      request,
      cluster: ServiceAreaServer.id,
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ServiceArea.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    /*
    for (const area of request.newAreas) {
      const supportedArea = this.state.supportedAreas.find((supportedArea) => supportedArea.areaId === area);
      if (!supportedArea) {
        device.log.error(`MatterbridgeServiceAreaServer selectAreas called with unsupported area: ${area}`);
        return { status: ServiceArea.SelectAreasStatus.UnsupportedArea, statusText: 'Unsupported areas' };
      }
    }
    this.state.selectedAreas = request.newAreas;
    */
    device.log.debug(`MatterbridgeServiceAreaServer selectAreas called with: [${request.newAreas.join(', ')}]`);
    return await super.selectAreas(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ModeSelect.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeModeSelectServer: changeToMode called with mode: ${request.newMode}`);
    await super.changeToMode(request);
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof HepaFilterMonitoring.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    this.state.condition = 100; // Reset condition to 100%
    this.state.lastChangedTime = Math.floor(new Date().getTime() / 1000); // TlvEpochS (seconds since Unix epoch)
    device.log.debug(`MatterbridgeHepaFilterMonitoringServer: resetCondition called`);
    // resetCondition is not implemented in matter.js
    // await super.resetCondition();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof ActivatedCarbonFilterMonitoring.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    this.state.condition = 100; // Reset condition to 100%
    this.state.lastChangedTime = Math.floor(new Date().getTime() / 1000); // TlvEpochS (seconds since Unix epoch)
    device.log.debug(`MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called`);
    // resetCondition is not implemented in matter.js
    // await super.resetCondition();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power ${request.power} duration ${request.duration} cause ${request.cause}`);
    // The implementation is responsible for setting the device accordingly with the powerAdjustRequest command
    // powerAdjustRequest is not implemented in matter.js
    // await super.powerAdjustRequest();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>,
      endpoint: this.endpoint as MatterbridgeEndpoint,
    });
    device.log.debug(`MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called`);
    // The implementation is responsible for setting the device accordingly with the cancelPowerAdjustRequest command
    // cancelPowerAdjustRequest is not implemented in matter.js
    // await super.cancelPowerAdjustRequest();
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
      attributes: this.state as unknown as ClusterAttributeValues<(typeof DeviceEnergyManagementMode.Complete)['attributes']>,
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
    return await super.changeToMode(request);
  }
}
