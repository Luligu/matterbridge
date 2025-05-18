/**
 * This file contains the class MatterbridgeEndpoint that extends the Endpoint class from the Matter.js library.
 *
 * @file matterbridgeBehaviors.ts
 * @author Luca Liguori
 * @date 2024-11-07
 * @version 1.0.0
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
 * limitations under the License. *
 */

/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

// @matter
import { Behavior, MaybePromise, NamedHandler } from '@matter/main';

// @matter clusters
import { BooleanStateConfiguration } from '@matter/main/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/main/clusters/color-control';
import { FanControl } from '@matter/main/clusters/fan-control';
import { Identify } from '@matter/main/clusters/identify';
import { LevelControl } from '@matter/main/clusters/level-control';
import { WindowCovering } from '@matter/main/clusters/window-covering';
import { Thermostat } from '@matter/main/clusters/thermostat';
import { ValveConfigurationAndControl } from '@matter/main/clusters/valve-configuration-and-control';
import { ModeSelect } from '@matter/main/clusters/mode-select';
import { SmokeCoAlarm } from '@matter/main/clusters/smoke-co-alarm';
import { BooleanStateConfigurationServer } from '@matter/main/behaviors/boolean-state-configuration';
import { OperationalState } from '@matter/main/clusters/operational-state';
import { ModeBase } from '@matter/main/clusters/mode-base';
import { RvcRunMode } from '@matter/main/clusters/rvc-run-mode';
import { RvcOperationalState } from '@matter/main/clusters/rvc-operational-state';
import { ServiceArea } from '@matter/main/clusters/service-area';
import { WaterHeaterManagement } from '@matter/main/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/main/clusters/water-heater-mode';


// @matter behaviors
import { IdentifyServer } from '@matter/main/behaviors/identify';
import { OnOffServer } from '@matter/main/behaviors/on-off';
import { LevelControlServer } from '@matter/main/behaviors/level-control';
import { ColorControlServer } from '@matter/main/behaviors/color-control';
import { MovementDirection, MovementType, WindowCoveringServer } from '@matter/main/behaviors/window-covering';
import { DoorLockServer } from '@matter/main/behaviors/door-lock';
import { FanControlServer } from '@matter/main/behaviors/fan-control';
import { ThermostatServer } from '@matter/main/behaviors/thermostat';
import { ValveConfigurationAndControlServer } from '@matter/main/behaviors/valve-configuration-and-control';
import { ModeSelectServer } from '@matter/main/behaviors/mode-select';
import { SmokeCoAlarmServer } from '@matter/main/behaviors/smoke-co-alarm';
import { SwitchServer } from '@matter/main/behaviors/switch';
import { OperationalStateServer } from '@matter/main/behaviors/operational-state';
import { RvcRunModeServer } from '@matter/main/behaviors/rvc-run-mode';
import { RvcCleanModeServer } from '@matter/main/behaviors/rvc-clean-mode';
import { RvcOperationalStateServer } from '@matter/main/behaviors/rvc-operational-state';
import { ServiceAreaServer } from '@matter/main/behaviors/service-area';
import { WaterHeaterManagementServer } from '@matter/main/behaviors/water-heater-management';
import { WaterHeaterModeServer } from '@matter/main/behaviors/water-heater-mode';

// AnsiLogger module
import { AnsiLogger } from './logger/export.js';

// MatterbridgeEndpoint
import { MatterbridgeEndpointCommands } from './matterbridgeEndpoint.js';

export class MatterbridgeServerDevice {
  log: AnsiLogger;
  commandHandler: NamedHandler<MatterbridgeEndpointCommands>;
  device: any; // Will be a plugin device
  endpointId: string | undefined = undefined;
  endpointNumber: number | undefined = undefined;

  constructor(log: AnsiLogger, commandHandler: NamedHandler<MatterbridgeEndpointCommands>, device: any) {
    this.log = log;
    this.commandHandler = commandHandler;
    this.device = device;
  }

  setEndpointId(endpointId: string | undefined) {
    this.endpointId = endpointId;
  }

  setEndpointNumber(endpointNumber: number | undefined) {
    this.endpointNumber = endpointNumber;
  }

  identify({ identifyTime }: Identify.IdentifyRequest) {
    this.log.info(`Identifying device for ${identifyTime} seconds`);
    this.commandHandler.executeHandler('identify', { request: { identifyTime }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  triggerEffect({ effectIdentifier, effectVariant }: Identify.TriggerEffectRequest) {
    this.log.info(`Triggering effect ${effectIdentifier} variant ${effectVariant}`);
    this.commandHandler.executeHandler('triggerEffect', { request: { effectIdentifier, effectVariant }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  on() {
    this.log.info(`Switching device on (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('on', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  off() {
    this.log.info(`Switching device off (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('off', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  toggle() {
    this.log.info(`Toggle device on/off (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('toggle', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  moveToLevel({ level, transitionTime, optionsMask, optionsOverride }: LevelControl.MoveToLevelRequest) {
    this.log.info(`Setting level to ${level} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToLevel', { request: { level, transitionTime, optionsMask, optionsOverride }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride }: LevelControl.MoveToLevelRequest) {
    this.log.info(`Setting level to ${level} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToLevelWithOnOff', { request: { level, transitionTime, optionsMask, optionsOverride }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime }: ColorControl.MoveToHueRequest) {
    this.log.info(`Setting hue to ${hue} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToHue', { request: { optionsMask, optionsOverride, hue, direction, transitionTime }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime }: ColorControl.MoveToSaturationRequest) {
    this.log.info(`Setting saturation to ${saturation} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToSaturation', { request: { optionsMask, optionsOverride, saturation, transitionTime }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime }: ColorControl.MoveToHueAndSaturationRequest) {
    this.log.info(`Setting hue to ${hue} and saturation to ${saturation} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToHueAndSaturation', { request: { optionsOverride, optionsMask, saturation, hue, transitionTime }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime }: ColorControl.MoveToColorRequest) {
    this.log.info(`Setting color to ${colorX}, ${colorY} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToColor', { request: { optionsMask, optionsOverride, colorX, colorY, transitionTime }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime }: ColorControl.MoveToColorTemperatureRequest) {
    this.log.info(`Setting color temperature to ${colorTemperatureMireds} with transitionTime ${transitionTime} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('moveToColorTemperature', {
      request: { optionsOverride, optionsMask, colorTemperatureMireds, transitionTime },
      attributes: {},
      endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId },
    } as any);
  }

  upOrOpen() {
    this.log.info(`Opening cover (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler(`upOrOpen`, { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  downOrClose() {
    this.log.info(`Closing cover (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler(`downOrClose`, { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  stopMotion() {
    this.log.info(`Stopping cover (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('stopMotion', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  goToLiftPercentage({ liftPercent100thsValue }: WindowCovering.GoToLiftPercentageRequest) {
    this.log.info(`Setting cover lift percentage to ${liftPercent100thsValue} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('goToLiftPercentage', { request: { liftPercent100thsValue }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  lockDoor() {
    this.log.info(`Locking door (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('lockDoor', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  unlockDoor() {
    this.log.info(`Unlocking door (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('unlockDoor', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  step({ direction, wrap, lowestOff }: FanControl.StepRequest) {
    this.log.info(`Stepping fan with direction ${direction} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('step', { request: { direction, wrap, lowestOff }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  setpointRaiseLower({ mode, amount }: Thermostat.SetpointRaiseLowerRequest) {
    this.log.info(`Setting setpoint to ${amount} in mode ${mode} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('setpointRaiseLower', { request: { mode, amount }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  open({ openDuration, targetLevel }: ValveConfigurationAndControl.OpenRequest) {
    this.log.info(`Opening valve to ${targetLevel}% (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('open', { request: { openDuration, targetLevel }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  close() {
    this.log.info(`Closing valve (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('close', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  changeToMode({ newMode }: ModeSelect.ChangeToModeRequest) {
    this.log.info(`Changing mode to ${newMode} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('changeToMode', { request: { newMode }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  selfTestRequest() {
    this.log.info(`Testing SmokeCOAlarm (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('selfTestRequest', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  enableDisableAlarm({ alarmsToEnableDisable }: BooleanStateConfiguration.EnableDisableAlarmRequest) {
    this.log.info(`Enabling/disabling alarm ${alarmsToEnableDisable} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('enableDisableAlarm', { request: { alarmsToEnableDisable }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  pause() {
    this.log.info(`Pause (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('pause', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  stop() {
    this.log.info(`Stop (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('stop', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  start() {
    this.log.info(`Start (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('start', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  resume() {
    this.log.info(`Resume (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('resume', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  goHome() {
    this.log.info(`GoHome (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('goHome', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  selectAreas({ newAreas }: ServiceArea.SelectAreasRequest) {
    this.log.info(`Selecting areas ${newAreas} (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('selectAreas', { request: { newAreas }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
}

export class MatterbridgeServer extends Behavior {
  static override readonly id = 'matterbridge';
  declare state: MatterbridgeServer.State;

  override initialize() {
    const device = this.state.deviceCommand;
    device?.setEndpointId(this.endpoint.maybeId);
    device?.setEndpointNumber(this.endpoint.maybeNumber);
    super.initialize();
  }
}

export namespace MatterbridgeServer {
  export class State {
    deviceCommand!: MatterbridgeServerDevice;
  }
}

export class MatterbridgeIdentifyServer extends IdentifyServer {
  override identify({ identifyTime }: Identify.IdentifyRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.identify({ identifyTime });
    device.log.debug(`MatterbridgeIdentifyServer: identify called`);
    super.identify({ identifyTime });
  }

  override triggerEffect({ effectIdentifier, effectVariant }: Identify.TriggerEffectRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.triggerEffect({ effectIdentifier, effectVariant });
    device.log.debug(`MatterbridgeIdentifyServer: triggerEffect called`);
    super.triggerEffect({ effectIdentifier, effectVariant });
  }
}

export class MatterbridgeOnOffServer extends OnOffServer {
  override on(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.on();
    device.log.debug(`MatterbridgeOnOffServer: on called`);
    super.on();
  }
  override off(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.off();
    device.log.debug(`MatterbridgeOnOffServer: off called`);
    super.off();
  }
  override toggle(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.toggle();
    device.log.debug(`MatterbridgeOnOffServer: toggle called`);
    super.toggle();
  }
}

export class MatterbridgeLevelControlServer extends LevelControlServer {
  override moveToLevel({ level, transitionTime, optionsMask, optionsOverride }: LevelControl.MoveToLevelRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToLevel({ level, transitionTime, optionsMask, optionsOverride });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevel called`);
    super.moveToLevel({ level, transitionTime, optionsMask, optionsOverride });
  }
  override moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride }: LevelControl.MoveToLevelRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride });
    device.log.debug(`MatterbridgeLevelControlServer: moveToLevelWithOnOff called`);
    super.moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride });
  }
}

export class MatterbridgeColorControlServer extends ColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature) {
  override moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime }: ColorControl.MoveToHueRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime });
    device.log.debug(`MatterbridgeColorControlServer: moveToHue called`);
    super.moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime });
  }
  override moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime }: ColorControl.MoveToSaturationRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime });
    device.log.debug(`MatterbridgeColorControlServer: moveToSaturation called`);
    super.moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime });
  }
  override moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime }: ColorControl.MoveToHueAndSaturationRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime });
    device.log.debug(`MatterbridgeColorControlServer: moveToHueAndSaturation called`);
    super.moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime });
  }
  override moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime }: ColorControl.MoveToColorRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime });
    device.log.debug(`MatterbridgeColorControlServer: moveToColor called`);
    super.moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime });
  }
  override moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime }: ColorControl.MoveToColorTemperatureRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime });
    device.log.debug(`MatterbridgeColorControlServer: moveToColorTemperature called`);
    super.moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime });
  }
}

export class MatterbridgeWindowCoveringServer extends WindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift) {
  override upOrOpen(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.upOrOpen();
    device.log.debug(`MatterbridgeWindowCoveringServer: upOrOpen called`);
    super.upOrOpen();
  }
  override downOrClose(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.downOrClose();
    device.log.debug(`MatterbridgeWindowCoveringServer: downOrClose called`);
    super.downOrClose();
  }
  override stopMotion(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.stopMotion();
    device.log.debug(`MatterbridgeWindowCoveringServer: stopMotion called`);
    super.stopMotion();
  }
  override goToLiftPercentage({ liftPercent100thsValue }: WindowCovering.GoToLiftPercentageRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.goToLiftPercentage({ liftPercent100thsValue });
    device.log.debug(`MatterbridgeWindowCoveringServer: goToLiftPercentage with ${liftPercent100thsValue}`);
    super.goToLiftPercentage({ liftPercent100thsValue });
  }
  override async handleMovement(type: MovementType, reversed: boolean, direction: MovementDirection, targetPercent100ths?: number) {
    // Do nothing here, as the device will handle the movement
  }
}

export class MatterbridgeDoorLockServer extends DoorLockServer {
  override lockDoor(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.lockDoor();
    device.log.debug(`MatterbridgeDoorLockServer: lockDoor called`);
    super.lockDoor();
  }
  override unlockDoor(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.unlockDoor();
    device.log.debug(`MatterbridgeDoorLockServer: unlockDoor called`);
    super.unlockDoor();
  }
}

export class MatterbridgeModeSelectServer extends ModeSelectServer {
  override changeToMode({ newMode }: ModeSelect.ChangeToModeRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.changeToMode({ newMode });
    device.log.debug(`MatterbridgeModeSelectServer: changeToMode called with mode: ${newMode}`);
    super.changeToMode({ newMode });
  }
}

export class MatterbridgeFanControlServer extends FanControlServer.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto, FanControl.Feature.Step) {
  override step({ direction, wrap, lowestOff }: FanControl.StepRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.step({ direction, wrap, lowestOff });

    const lookupStepDirection = ['Increase', 'Decrease'];
    device.log.debug(`MatterbridgeFanControlServer: step called with direction: ${lookupStepDirection[direction]} wrap: ${wrap} lowestOff: ${lowestOff}`);
    device.log.debug(`- current percentCurrent: ${this.state.percentCurrent}`);

    if (direction === FanControl.StepDirection.Increase) {
      if (wrap && this.state.percentCurrent === 100) {
        this.state.percentCurrent = lowestOff ? 0 : 10;
      } else this.state.percentCurrent = Math.min(this.state.percentCurrent + 10, 100);
    } else if (direction === FanControl.StepDirection.Decrease) {
      if (wrap && this.state.percentCurrent === (lowestOff ? 0 : 10)) {
        this.state.percentCurrent = 100;
      } else this.state.percentCurrent = Math.max(this.state.percentCurrent - 10, lowestOff ? 0 : 10);
    }
    device.log.debug('Set percentCurrent to:', this.state.percentCurrent);

    // step is not implemented in matter.js
    // super.step();
  }
}

export class MatterbridgeThermostatServer extends ThermostatServer.with(Thermostat.Feature.Cooling, Thermostat.Feature.Heating, Thermostat.Feature.AutoMode) {
  override setpointRaiseLower({ mode, amount }: Thermostat.SetpointRaiseLowerRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.setpointRaiseLower({ mode, amount });

    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`MatterbridgeThermostatServer: setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[mode]} amount: ${amount / 10}`);
    device.log.debug(`- current occupiedHeatingSetpoint: ${this.state.occupiedHeatingSetpoint / 100}`);
    device.log.debug(`- current occupiedCoolingSetpoint: ${this.state.occupiedCoolingSetpoint / 100}`);

    if ((mode === Thermostat.SetpointRaiseLowerMode.Heat || mode === Thermostat.SetpointRaiseLowerMode.Both) && this.state.occupiedHeatingSetpoint !== undefined) {
      const setpoint = this.state.occupiedHeatingSetpoint / 100 + amount / 10;
      this.state.occupiedHeatingSetpoint = setpoint * 100;
      device.log.debug('Set occupiedHeatingSetpoint to:', setpoint);
    }

    if ((mode === Thermostat.SetpointRaiseLowerMode.Cool || mode === Thermostat.SetpointRaiseLowerMode.Both) && this.state.occupiedCoolingSetpoint !== undefined) {
      const setpoint = this.state.occupiedCoolingSetpoint / 100 + amount / 10;
      this.state.occupiedCoolingSetpoint = setpoint * 100;
      device.log.debug('Set occupiedCoolingSetpoint to:', setpoint);
    }
    // setpointRaiseLower is not implemented in matter.js
    // super.setpointRaiseLower();
  }
}

export class MatterbridgeValveConfigurationAndControlServer extends ValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level) {
  override open({ openDuration, targetLevel }: ValveConfigurationAndControl.OpenRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: open called with openDuration: ${openDuration} targetLevel: ${targetLevel}`);
    device.open({ openDuration, targetLevel });
    this.state.targetLevel = targetLevel ?? 100;
    this.state.currentLevel = targetLevel ?? 100;
    // open is not implemented in matter.js
    // super.open();
  }

  override close(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.log.debug(`MatterbridgeValveConfigurationAndControlServer: close called`);
    device.close();
    this.state.targetLevel = 0;
    this.state.currentLevel = 0;
    // close is not implemented in matter.js
    // super.close();
  }
}

export class MatterbridgeSmokeCoAlarmServer extends SmokeCoAlarmServer.with(SmokeCoAlarm.Feature.SmokeAlarm, SmokeCoAlarm.Feature.CoAlarm) {
  override selfTestRequest(): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.log.debug(`MatterbridgeSmokeCoAlarmServer: selfTestRequest called`);
    device.selfTestRequest();
    // selfTestRequest is not implemented in matter.js
    // super.selfTestRequest();
  }
}

export class MatterbridgeBooleanStateConfigurationServer extends BooleanStateConfigurationServer.with(BooleanStateConfiguration.Feature.Visual, BooleanStateConfiguration.Feature.Audible, BooleanStateConfiguration.Feature.SensitivityLevel) {
  override enableDisableAlarm({ alarmsToEnableDisable }: BooleanStateConfiguration.EnableDisableAlarmRequest): MaybePromise {
    const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    device.log.debug(`MatterbridgeBooleanStateConfigurationServer: enableDisableAlarm called`);
    device.enableDisableAlarm({ alarmsToEnableDisable });
    // enableDisableAlarm is not implemented in matter.js
    // super.enableDisableAlarm({ alarmsToEnableDisable });
  }
}

export class MatterbridgeSwitchServer extends SwitchServer {
  override initialize() {
    // Do nothing here, as the device will handle the switch logic: we need to convert something like "single" into the oppropriate states and events sequences
  }
}

export class MatterbridgeOperationalStateServer extends OperationalStateServer {
  override initialize(): MaybePromise {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeOperationalStateServer initialized: setting operational state to Stopped');
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
  }

  override pause(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeOperationalStateServer: pause called setting operational state to Paused');
    device.pause();
    this.state.operationalState = OperationalState.OperationalStateEnum.Paused;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
    // pause is not implemented in matter.js
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    };
  }

  override stop(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeOperationalStateServer: stop called setting operational state to Stopped');
    device.stop();
    this.state.operationalState = OperationalState.OperationalStateEnum.Stopped;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
    // stop is not implemented in matter.js
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    };
  }

  override start(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeOperationalStateServer: start called setting operational state to Running');
    device.start();
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
    // start is not implemented in matter.js
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    };
  }

  override resume(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.debug('MatterbridgeOperationalStateServer: resume called setting operational state to Running');
    device.resume();
    this.state.operationalState = OperationalState.OperationalStateEnum.Running;
    this.state.operationalError = { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' };
    // resume is not implemented in matter.js
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    };
  }
}

/** ********************************************* RVC  **********************************************************/

export class MatterbridgeRvcRunModeServer extends RvcRunModeServer {
  override changeToMode({ newMode }: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const supported = this.state.supportedModes.find((mode) => mode.mode === newMode);
    if (!supported) {
      device.log.error(`MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: ${newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    device.changeToMode({ newMode });
    this.state.currentMode = newMode;
    if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Cleaning)) {
      device.log.info('MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running');
      this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Running' };
    } else if (supported.modeTags.find((tag) => tag.value === RvcRunMode.ModeTag.Idle)) {
      device.log.info('MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked');
      this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Docked;
      return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Docked' };
    }
    device.log.info(`MatterbridgeRvcRunModeServer changeToMode called with newMode ${newMode} => ${supported.label}`);
    this.agent.get(MatterbridgeRvcOperationalStateServer).state.operationalState = RvcOperationalState.OperationalState.Running;
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

export class MatterbridgeRvcCleanModeServer extends RvcCleanModeServer {
  override changeToMode({ newMode }: ModeBase.ChangeToModeRequest): MaybePromise<ModeBase.ChangeToModeResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    const supported = this.state.supportedModes.find((mode) => mode.mode === newMode);
    if (!supported) {
      device.log.error(`MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: ${newMode}`);
      return { status: ModeBase.ModeChangeStatus.UnsupportedMode, statusText: 'Unsupported mode' };
    }
    device.changeToMode({ newMode });
    this.state.currentMode = newMode;
    device.log.info(`MatterbridgeRvcCleanModeServer changeToMode called with newMode ${newMode} => ${supported.label}`);
    return { status: ModeBase.ModeChangeStatus.Success, statusText: 'Success' };
  }
}

export class MatterbridgeRvcOperationalStateServer extends RvcOperationalStateServer {
  override pause(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.info('MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle');
    device.pause();
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Paused;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override resume(): MaybePromise<OperationalState.OperationalCommandResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.info('MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning');
    device.resume();
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 2; // RvcRunMode.ModeTag.Cleaning
    this.state.operationalState = RvcOperationalState.OperationalState.Running;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }

  override goHome(): MaybePromise<OperationalState.OperationalCommandResponse> {
    // const device = this.agent.get(MatterbridgeServer).state.deviceCommand;
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    device.log.info('MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle');
    device.goHome();
    this.agent.get(MatterbridgeRvcRunModeServer).state.currentMode = 1; // RvcRunMode.ModeTag.Idle
    this.state.operationalState = RvcOperationalState.OperationalState.Docked;
    this.state.operationalError = { errorStateId: RvcOperationalState.ErrorState.NoError, errorStateLabel: 'No Error', errorStateDetails: 'Fully operational' };
    return {
      commandResponseState: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
    } as OperationalState.OperationalCommandResponse;
  }
}

export class MatterbridgeServiceAreaServer extends ServiceAreaServer {
  override selectAreas({ newAreas }: ServiceArea.SelectAreasRequest): MaybePromise<ServiceArea.SelectAreasResponse> {
    const device = this.endpoint.stateOf(MatterbridgeServer).deviceCommand;
    for (const area of newAreas) {
      const supportedArea = this.state.supportedAreas.find((supportedArea) => supportedArea.areaId === area);
      if (!supportedArea) {
        device.log.error(`MatterbridgeServiceAreaServer selectAreas called with unsupported area: ${area}`);
        return { status: ServiceArea.SelectAreasStatus.UnsupportedArea, statusText: 'Unsupported areas' };
      }
    }
    device.selectAreas({ newAreas });
    this.state.selectedAreas = newAreas;
    this.state.currentArea = newAreas[0];
    device.log.info(`MatterbridgeServiceAreaServer selectAreas called with: ${newAreas.map((area) => area.toString()).join(', ')}`);
    device.selectAreas({ newAreas });
    return { status: ServiceArea.SelectAreasStatus.Success, statusText: 'Succesfully selected new areas' };
  }
}
