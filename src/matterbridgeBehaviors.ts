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
import { Behavior, NamedHandler } from '@matter/main';

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

// AnsiLogger module
import { AnsiLogger } from './logger/export.js';

// MatterbridgeEndpoint
import { MatterbridgeEndpointCommands } from './matterbridgeEndpoint.js';

export class MatterbridgeBehaviorDevice {
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
    this.log.info(`Opening valve (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('open', { request: { openDuration, targetLevel }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
  close() {
    this.log.info(`Closing valve (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('close', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  changeToMode({ newMode }: ModeSelect.ChangeToModeRequest) {
    this.log.info(`Changing mode to ${newMode}`);
    this.commandHandler.executeHandler('changeToMode', { request: { newMode }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  selfTestRequest() {
    this.log.info(`Testing SmokeCOAlarm (endpoint ${this.endpointId}.${this.endpointNumber})`);
    this.commandHandler.executeHandler('selfTestRequest', { request: {}, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }

  enableDisableAlarm({ alarmsToEnableDisable }: BooleanStateConfiguration.EnableDisableAlarmRequest) {
    this.log.info(`Enabling/disabling alarm ${alarmsToEnableDisable}`);
    this.commandHandler.executeHandler('enableDisableAlarm', { request: { alarmsToEnableDisable }, attributes: {}, endpoint: { number: this.endpointNumber, uniqueStorageKey: this.endpointId } } as any);
  }
}

export class MatterbridgeBehavior extends Behavior {
  static override readonly id = 'matterbridge';
  declare state: MatterbridgeBehavior.State;
}

export namespace MatterbridgeBehavior {
  export class State {
    deviceCommand!: MatterbridgeBehaviorDevice;
  }
}

export class MatterbridgeIdentifyServer extends IdentifyServer {
  override initialize() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.setEndpointId(this.endpoint.maybeId);
    device.setEndpointNumber(this.endpoint.maybeNumber);
    super.initialize();
  }

  override identify({ identifyTime }: Identify.IdentifyRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.identify({ identifyTime });
    super.identify({ identifyTime });
  }

  override triggerEffect({ effectIdentifier, effectVariant }: Identify.TriggerEffectRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.triggerEffect({ effectIdentifier, effectVariant });
    super.triggerEffect({ effectIdentifier, effectVariant });
  }
}

export class MatterbridgeOnOffServer extends OnOffServer {
  override async on() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.on();
    super.on();
  }
  override async off() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.off();
    super.off();
  }
  override async toggle() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.toggle();
    super.toggle();
  }
}

export class MatterbridgeLevelControlServer extends LevelControlServer {
  override async moveToLevel({ level, transitionTime, optionsMask, optionsOverride }: LevelControl.MoveToLevelRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToLevel({ level, transitionTime, optionsMask, optionsOverride });
    super.moveToLevel({ level, transitionTime, optionsMask, optionsOverride });
  }
  override async moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride }: LevelControl.MoveToLevelRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride });
    super.moveToLevelWithOnOff({ level, transitionTime, optionsMask, optionsOverride });
  }
}

export class MatterbridgeColorControlServer extends ColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature) {
  override async moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime }: ColorControl.MoveToHueRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime });
    super.moveToHue({ optionsMask, optionsOverride, hue, direction, transitionTime });
  }
  override async moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime }: ColorControl.MoveToSaturationRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime });
    super.moveToSaturation({ optionsMask, optionsOverride, saturation, transitionTime });
  }
  override async moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime }: ColorControl.MoveToHueAndSaturationRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime });
    super.moveToHueAndSaturation({ optionsOverride, optionsMask, saturation, hue, transitionTime });
  }
  override async moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime }: ColorControl.MoveToColorRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime });
    super.moveToColor({ optionsMask, optionsOverride, colorX, colorY, transitionTime });
  }
  override async moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime }: ColorControl.MoveToColorTemperatureRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime });
    super.moveToColorTemperature({ optionsOverride, optionsMask, colorTemperatureMireds, transitionTime });
  }
}

export class MatterbridgeWindowCoveringServer extends WindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift) {
  override async upOrOpen() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.upOrOpen();
    super.upOrOpen();
  }
  override async downOrClose() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.downOrClose();
    super.downOrClose();
  }
  override stopMotion() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.stopMotion();
    super.stopMotion();
  }
  override goToLiftPercentage({ liftPercent100thsValue }: WindowCovering.GoToLiftPercentageRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.goToLiftPercentage({ liftPercent100thsValue });
    super.goToLiftPercentage({ liftPercent100thsValue });
  }
  override async handleMovement(type: MovementType, reversed: boolean, direction: MovementDirection, targetPercent100ths?: number) {
    // Do nothing here, as the device will handle the movement
  }
}

export class MatterbridgeDoorLockServer extends DoorLockServer {
  override async lockDoor() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.lockDoor();
    super.lockDoor();
  }
  override async unlockDoor() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.unlockDoor();
    super.unlockDoor();
  }
}

export class MatterbridgeModeSelectServer extends ModeSelectServer {
  override async changeToMode({ newMode }: ModeSelect.ChangeToModeRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.changeToMode({ newMode });
    super.changeToMode({ newMode });
  }
}

export class MatterbridgeFanControlServer extends FanControlServer.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto, FanControl.Feature.Step) {
  override async step({ direction, wrap, lowestOff }: FanControl.StepRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.step({ direction, wrap, lowestOff });

    const lookupStepDirection = ['Increase', 'Decrease'];
    device.log.debug(`Command step called with direction: ${lookupStepDirection[direction]} wrap: ${wrap} lowestOff: ${lowestOff}`);
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

    super.step({ direction, wrap, lowestOff });
  }
}

export class MatterbridgeThermostatServer extends ThermostatServer.with(Thermostat.Feature.Cooling, Thermostat.Feature.Heating, Thermostat.Feature.AutoMode) {
  override async setpointRaiseLower({ mode, amount }: Thermostat.SetpointRaiseLowerRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.setpointRaiseLower({ mode, amount });

    const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
    device.log.debug(`Command setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[mode]} amount: ${amount / 10}`);
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

    super.setpointRaiseLower({ mode, amount });
  }
}

export class MatterbridgeValveConfigurationAndControlServer extends ValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level) {
  override async open({ openDuration, targetLevel }: ValveConfigurationAndControl.OpenRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.open({ openDuration, targetLevel });
    super.open({ openDuration, targetLevel });
  }
  override async close() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.close();
    super.close();
  }
}

export class MatterbridgeSmokeCOAlarmServer extends SmokeCoAlarmServer.with(SmokeCoAlarm.Feature.SmokeAlarm, SmokeCoAlarm.Feature.CoAlarm) {
  override async selfTestRequest() {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.selfTestRequest();
    super.selfTestRequest();
  }
}

export class MatterbridgeBooleanStateConfigurationServer extends BooleanStateConfigurationServer.with(BooleanStateConfiguration.Feature.Visual, BooleanStateConfiguration.Feature.Audible, BooleanStateConfiguration.Feature.SensitivityLevel) {
  override async enableDisableAlarm({ alarmsToEnableDisable }: BooleanStateConfiguration.EnableDisableAlarmRequest) {
    const device = this.agent.get(MatterbridgeBehavior).state.deviceCommand;
    device.enableDisableAlarm({ alarmsToEnableDisable });
    super.enableDisableAlarm({ alarmsToEnableDisable });
  }
}
