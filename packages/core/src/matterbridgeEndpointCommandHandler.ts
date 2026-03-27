/**
 * This file contains the command handler for MatterbridgeEndpoint.
 *
 * @file matterbridgeEndpointCommandHandler.ts
 * @author Luca Liguori
 * @created 2026-03-17
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable jsdoc/reject-any-type */

// istanbul ignore if -- Loader logs are not relevant for coverage
// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgeEndpointTypes loaded.\u001B[40;0m');

// @matter
import { HandlerFunction } from '@matter/general';
import type { Attribute } from '@matter/types/cluster';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/types/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { FanControl } from '@matter/types/clusters/fan-control';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { Identify } from '@matter/types/clusters/identify';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import { LevelControl } from '@matter/types/clusters/level-control';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { ModeBase } from '@matter/types/clusters/mode-base';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ThreadNetworkDiagnostics } from '@matter/types/clusters/thread-network-diagnostics';
import { TimeSynchronization } from '@matter/types/clusters/time-synchronization';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/types/clusters/water-heater-mode';
import { WindowCovering } from '@matter/types/clusters/window-covering';

// matterbridge
import { ClosureControl } from './clusters/closure-control.js';
import { ClosureDimension } from './clusters/closure-dimension.js';
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

/** @deprecated Use CommandHandlers instead. This signature is still here for backward compatibility and will be removed in a future release. */
export interface MatterbridgeEndpointCommands {
  // Identify
  identify: HandlerFunction;
  triggerEffect: HandlerFunction;

  // On/Off
  on: HandlerFunction;
  off: HandlerFunction;
  toggle: HandlerFunction;
  offWithEffect: HandlerFunction;

  // Level Control
  moveToLevel: HandlerFunction;
  moveToLevelWithOnOff: HandlerFunction;

  // Color Control
  moveToColor: HandlerFunction;
  moveColor: HandlerFunction;
  stepColor: HandlerFunction;
  moveToHue: HandlerFunction;
  moveHue: HandlerFunction;
  stepHue: HandlerFunction;
  enhancedMoveToHue: HandlerFunction;
  enhancedMoveHue: HandlerFunction;
  enhancedStepHue: HandlerFunction;
  moveToSaturation: HandlerFunction;
  moveSaturation: HandlerFunction;
  stepSaturation: HandlerFunction;
  moveToHueAndSaturation: HandlerFunction;
  enhancedMoveToHueAndSaturation: HandlerFunction;
  moveToColorTemperature: HandlerFunction;

  // Window Covering
  upOrOpen: HandlerFunction;
  downOrClose: HandlerFunction;
  stopMotion: HandlerFunction;
  goToLiftPercentage: HandlerFunction;
  goToTiltPercentage: HandlerFunction;

  // Closure
  moveTo: HandlerFunction;
  setTarget: HandlerFunction;

  // Door Lock
  lockDoor: HandlerFunction;
  unlockDoor: HandlerFunction;

  // Thermostat
  setpointRaiseLower: HandlerFunction;
  setActivePresetRequest: HandlerFunction;

  // Fan Control
  step: HandlerFunction;

  // Mode Select
  changeToMode: HandlerFunction;

  // Valve Configuration and Control
  open: HandlerFunction;
  close: HandlerFunction;

  // Boolean State Configuration
  suppressAlarm: HandlerFunction;
  enableDisableAlarm: HandlerFunction;

  // Smoke and CO Alarm
  selfTestRequest: HandlerFunction;

  // Thread Network Diagnostics
  resetCounts: HandlerFunction;

  // Time Synchronization
  setUtcTime: HandlerFunction;
  setTimeZone: HandlerFunction;
  setDstOffset: HandlerFunction;

  // Device Energy Management
  pauseRequest: HandlerFunction;
  resumeRequest: HandlerFunction;

  // Operational State
  pause: HandlerFunction;
  stop: HandlerFunction;
  start: HandlerFunction;
  resume: HandlerFunction;

  // Rvc Operational State
  goHome: HandlerFunction;

  // Rvc Service Area
  selectAreas: HandlerFunction;

  // Water Heater Management
  boost: HandlerFunction;
  cancelBoost: HandlerFunction;

  // Energy Evse
  enableCharging: HandlerFunction;
  disable: HandlerFunction;
  setTargets: HandlerFunction;
  getTargets: HandlerFunction;
  clearTargets: HandlerFunction;

  // Device Energy Management
  powerAdjustRequest: HandlerFunction;
  cancelPowerAdjustRequest: HandlerFunction;

  // Temperature Control
  setTemperature: HandlerFunction;

  // Microwave Oven Control
  setCookingParameters: HandlerFunction;
  addMoreTime: HandlerFunction;

  // MediaPlayback Control
  play: HandlerFunction;
  // pause: HandlerFunction; Already defined
  // stop: HandlerFunction; Already defined
  previous: HandlerFunction;
  next: HandlerFunction;
  skipForward: HandlerFunction;
  skipBackward: HandlerFunction;

  // KeypadInput Control
  sendKey: HandlerFunction;

  // Resource Monitoring
  resetCondition: HandlerFunction;
}

type OptionalKeys<T> = {
  [K in keyof T]-?: T[K] extends { optional: true } ? K : never;
}[keyof T];

type AttributeValue<T> = T extends Attribute<infer JsType, infer _F> ? JsType : never;

export type ClusterAttributeValues<T extends Record<string, unknown>> = {
  -readonly [K in Exclude<keyof T, OptionalKeys<T>>]: AttributeValue<T[K]>;
} & {
  -readonly [K in OptionalKeys<T>]?: AttributeValue<T[K]>;
};

/**
 * Keys of the supported commands for MatterbridgeEndpoint. The keys are in the format 'ClusterName.commandName' and correspond to the commands defined in the clusters used by MatterbridgeEndpoint.
 */
export type CommandHandlers = keyof CommandHandlerDataMap;

/**
 * Data passed to command handlers for a specific command. The type is determined by the command name and contains the request, cluster, attributes, and endpoint related to the command.
 */
export type CommandHandlerData<T extends CommandHandlers = CommandHandlers> = CommandHandlerDataMap[T];

/**
 * Type of the command handler function for MatterbridgeEndpoint. The function receives data related to the received command, including the command,request, cluster, attributes, and endpoint.
 */
export type CommandHandlerFunction<T extends CommandHandlers = CommandHandlers> = (data: CommandHandlerData<T>) => void | Promise<void>;

/**
 * Data passed to command handlers for each supported command. The keys are in the format 'ClusterName.commandName' and the values contain the command,request, cluster, attributes, and endpoint related to the command.
 * AI generated note: The CommandHandlerDataMap type is generated based on the commands defined in the clusters used by MatterbridgeEndpoint.
 */
export type CommandHandlerDataMap = {
  // Identify
  'identify': CommandHandlerData<'Identify.identify'>;
  'triggerEffect': CommandHandlerData<'Identify.triggerEffect'>;
  'Identify.identify': {
    command: 'identify';
    request: Identify.IdentifyRequest;
    cluster: 'identify';
    attributes: ClusterAttributeValues<(typeof Identify.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'Identify.triggerEffect': {
    command: 'triggerEffect';
    request: Identify.TriggerEffectRequest;
    cluster: 'identify';
    attributes: ClusterAttributeValues<(typeof Identify.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // On/Off
  'on': CommandHandlerData<'OnOff.on'>;
  'off': CommandHandlerData<'OnOff.off'>;
  'toggle': CommandHandlerData<'OnOff.toggle'>;
  'offWithEffect': CommandHandlerData<'OnOff.offWithEffect'>;
  'OnOff.on': {
    command: 'on';
    request: {}; // TlvNoArguments
    cluster: 'onOff';
    attributes: ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'OnOff.off': {
    command: 'off';
    request: {}; // TlvNoArguments
    cluster: 'onOff';
    attributes: ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'OnOff.toggle': {
    command: 'toggle';
    request: {}; // TlvNoArguments
    cluster: 'onOff';
    attributes: ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'OnOff.offWithEffect': {
    command: 'offWithEffect';
    request: OnOff.OffWithEffectRequest;
    cluster: 'onOff';
    attributes: ClusterAttributeValues<(typeof OnOff.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Level Control
  'moveToLevel': CommandHandlerData<'LevelControl.moveToLevel'>;
  'moveToLevelWithOnOff': CommandHandlerData<'LevelControl.moveToLevelWithOnOff'>;
  'LevelControl.moveToLevel': {
    command: 'moveToLevel';
    request: LevelControl.MoveToLevelRequest;
    cluster: 'levelControl';
    attributes: ClusterAttributeValues<(typeof LevelControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'LevelControl.moveToLevelWithOnOff': {
    command: 'moveToLevelWithOnOff';
    request: LevelControl.MoveToLevelRequest;
    cluster: 'levelControl';
    attributes: ClusterAttributeValues<(typeof LevelControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Color Control
  'moveToColor': CommandHandlerData<'ColorControl.moveToColor'>;
  'moveColor': CommandHandlerData<'ColorControl.moveColor'>;
  'stepColor': CommandHandlerData<'ColorControl.stepColor'>;
  'moveToHue': CommandHandlerData<'ColorControl.moveToHue'>;
  'moveHue': CommandHandlerData<'ColorControl.moveHue'>;
  'stepHue': CommandHandlerData<'ColorControl.stepHue'>;
  'enhancedMoveToHue': CommandHandlerData<'ColorControl.enhancedMoveToHue'>;
  'enhancedMoveHue': CommandHandlerData<'ColorControl.enhancedMoveHue'>;
  'enhancedStepHue': CommandHandlerData<'ColorControl.enhancedStepHue'>;
  'moveToSaturation': CommandHandlerData<'ColorControl.moveToSaturation'>;
  'moveSaturation': CommandHandlerData<'ColorControl.moveSaturation'>;
  'stepSaturation': CommandHandlerData<'ColorControl.stepSaturation'>;
  'moveToHueAndSaturation': CommandHandlerData<'ColorControl.moveToHueAndSaturation'>;
  'enhancedMoveToHueAndSaturation': CommandHandlerData<'ColorControl.enhancedMoveToHueAndSaturation'>;
  'moveToColorTemperature': CommandHandlerData<'ColorControl.moveToColorTemperature'>;
  'ColorControl.moveToColor': {
    command: 'moveToColor';
    request: ColorControl.MoveToColorRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveColor': {
    command: 'moveColor';
    request: ColorControl.MoveColorRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.stepColor': {
    command: 'stepColor';
    request: ColorControl.StepColorRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToHue': {
    command: 'moveToHue';
    request: ColorControl.MoveToHueRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveHue': {
    command: 'moveHue';
    request: ColorControl.MoveHueRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.stepHue': {
    command: 'stepHue';
    request: ColorControl.StepHueRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedMoveToHue': {
    command: 'enhancedMoveToHue';
    request: ColorControl.EnhancedMoveToHueRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedMoveHue': {
    command: 'enhancedMoveHue';
    request: ColorControl.EnhancedMoveHueRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedStepHue': {
    command: 'enhancedStepHue';
    request: ColorControl.EnhancedStepHueRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToSaturation': {
    command: 'moveToSaturation';
    request: ColorControl.MoveToSaturationRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveSaturation': {
    command: 'moveSaturation';
    request: ColorControl.MoveSaturationRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.stepSaturation': {
    command: 'stepSaturation';
    request: ColorControl.StepSaturationRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToHueAndSaturation': {
    command: 'moveToHueAndSaturation';
    request: ColorControl.MoveToHueAndSaturationRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedMoveToHueAndSaturation': {
    command: 'enhancedMoveToHueAndSaturation';
    request: ColorControl.EnhancedMoveToHueAndSaturationRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToColorTemperature': {
    command: 'moveToColorTemperature';
    request: ColorControl.MoveToColorTemperatureRequest;
    cluster: 'colorControl';
    attributes: ClusterAttributeValues<(typeof ColorControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Window Covering
  'upOrOpen': CommandHandlerData<'WindowCovering.upOrOpen'>;
  'downOrClose': CommandHandlerData<'WindowCovering.downOrClose'>;
  'stopMotion': CommandHandlerData<'WindowCovering.stopMotion'>;
  'goToLiftPercentage': CommandHandlerData<'WindowCovering.goToLiftPercentage'>;
  'goToTiltPercentage': CommandHandlerData<'WindowCovering.goToTiltPercentage'>;
  'WindowCovering.upOrOpen': {
    command: 'upOrOpen';
    request: {}; // TlvNoArguments
    cluster: 'windowCovering';
    attributes: ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.downOrClose': {
    command: 'downOrClose';
    request: {}; // TlvNoArguments
    cluster: 'windowCovering';
    attributes: ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.stopMotion': {
    command: 'stopMotion';
    request: {}; // TlvNoArguments
    cluster: 'windowCovering';
    attributes: ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.goToLiftPercentage': {
    command: 'goToLiftPercentage';
    request: WindowCovering.GoToLiftPercentageRequest;
    cluster: 'windowCovering';
    attributes: ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.goToTiltPercentage': {
    command: 'goToTiltPercentage';
    request: WindowCovering.GoToTiltPercentageRequest;
    cluster: 'windowCovering';
    attributes: ClusterAttributeValues<(typeof WindowCovering.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Closure Control
  'moveTo': CommandHandlerData<'ClosureControl.moveTo'>;
  'ClosureControl.moveTo': {
    command: 'moveTo';
    request: ClosureControl.MoveToRequest;
    cluster: 'closureControl';
    attributes: ClusterAttributeValues<(typeof ClosureControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ClosureControl.stop': {
    command: 'stop';
    request: {}; // TlvNoArguments
    cluster: 'closureControl';
    attributes: ClusterAttributeValues<(typeof ClosureControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Closure Dimension
  'setTarget': CommandHandlerData<'ClosureDimension.setTarget'>;
  'ClosureDimension.setTarget': {
    command: 'setTarget';
    request: ClosureDimension.SetTargetRequest;
    cluster: 'closureDimension';
    attributes: ClusterAttributeValues<(typeof ClosureDimension.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ClosureDimension.step': {
    command: 'step';
    request: ClosureDimension.StepRequest;
    cluster: 'closureDimension';
    attributes: ClusterAttributeValues<(typeof ClosureDimension.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Door Lock
  'lockDoor': CommandHandlerData<'DoorLock.lockDoor'>;
  'unlockDoor': CommandHandlerData<'DoorLock.unlockDoor'>;
  'DoorLock.lockDoor': {
    command: 'lockDoor'; // Base command
    request: DoorLock.LockDoorRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.unlockDoor': {
    command: 'unlockDoor'; // Base command
    request: DoorLock.UnlockDoorRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.unlockWithTimeout': {
    command: 'unlockWithTimeout'; // Base command
    request: DoorLock.UnlockWithTimeoutRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.setPinCode': {
    command: 'setPinCode'; // PIN not USR
    request: DoorLock.SetPinCodeRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.getPinCode': {
    command: 'getPinCode'; // PIN not USR
    request: DoorLock.GetPinCodeRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.clearPinCode': {
    command: 'clearPinCode'; // PIN not USR
    request: DoorLock.ClearPinCodeRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.clearAllPinCodes': {
    command: 'clearAllPinCodes'; // PIN not USR
    request: {};
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.setUserStatus': {
    command: 'setUserStatus'; // PIN not USR
    request: DoorLock.SetUserStatusRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.getUserStatus': {
    command: 'getUserStatus'; // PIN not USR
    request: DoorLock.GetUserStatusRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.setUserType': {
    command: 'setUserType'; // PIN not USR
    request: DoorLock.SetUserTypeRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.getUserType': {
    command: 'getUserType'; // PIN not USR
    request: DoorLock.GetUserTypeRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.setUser': {
    command: 'setUser'; // USR
    request: DoorLock.SetUserRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.getUser': {
    command: 'getUser'; // USR
    request: DoorLock.GetUserRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.clearUser': {
    command: 'clearUser'; // USR
    request: DoorLock.ClearUserRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.setCredential': {
    command: 'setCredential'; // USR
    request: DoorLock.SetCredentialRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.getCredentialStatus': {
    command: 'getCredentialStatus'; // USR
    request: DoorLock.GetCredentialStatusRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.clearCredential': {
    command: 'clearCredential'; // USR
    request: DoorLock.ClearCredentialRequest;
    cluster: 'doorLock';
    attributes: ClusterAttributeValues<(typeof DoorLock.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Thermostat
  'setpointRaiseLower': CommandHandlerData<'Thermostat.setpointRaiseLower'>;
  'setActivePresetRequest': CommandHandlerData<'Thermostat.setActivePresetRequest'>;
  'Thermostat.setpointRaiseLower': {
    command: 'setpointRaiseLower';
    request: Thermostat.SetpointRaiseLowerRequest;
    cluster: 'thermostat';
    attributes: ClusterAttributeValues<(typeof Thermostat.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'Thermostat.setActivePresetRequest': {
    command: 'setActivePresetRequest';
    request: Thermostat.SetActivePresetRequest;
    cluster: 'thermostat';
    attributes: ClusterAttributeValues<(typeof Thermostat.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Fan Control
  'step': CommandHandlerData<'FanControl.step'>;
  'FanControl.step': {
    command: 'step';
    request: FanControl.StepRequest;
    cluster: 'fanControl';
    attributes: ClusterAttributeValues<(typeof FanControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Mode Select
  'changeToMode': CommandHandlerData<'ModeSelect.changeToMode'>;
  'ModeSelect.changeToMode': {
    command: 'changeToMode';
    request: ModeSelect.ChangeToModeRequest;
    cluster: 'modeSelect';
    attributes: ClusterAttributeValues<(typeof ModeSelect.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Dishwasher Mode
  'DishwasherMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'dishwasherMode';
    attributes: ClusterAttributeValues<(typeof DishwasherMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Laundry Washer Mode
  'LaundryWasherMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'laundryWasherMode';
    attributes: ClusterAttributeValues<(typeof LaundryWasherMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Energy EVSE Mode
  'EnergyEvseMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'energyEvseMode';
    attributes: ClusterAttributeValues<(typeof EnergyEvseMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Run Mode
  'RvcRunMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'rvcRunMode';
    attributes: ClusterAttributeValues<(typeof RvcRunMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Clean Mode
  'RvcCleanMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'rvcCleanMode';
    attributes: ClusterAttributeValues<(typeof RvcCleanMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Water Heater Mode
  'WaterHeaterMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'waterHeaterMode';
    attributes: ClusterAttributeValues<(typeof WaterHeaterMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Device Energy Management Mode
  'DeviceEnergyManagementMode.changeToMode': {
    command: 'changeToMode';
    request: ModeBase.ChangeToModeRequest;
    cluster: 'deviceEnergyManagementMode';
    attributes: ClusterAttributeValues<(typeof DeviceEnergyManagementMode.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Valve Configuration and Control
  'open': CommandHandlerData<'ValveConfigurationAndControl.open'>;
  'close': CommandHandlerData<'ValveConfigurationAndControl.close'>;
  'ValveConfigurationAndControl.open': {
    command: 'open';
    request: ValveConfigurationAndControl.OpenRequest;
    cluster: 'valveConfigurationAndControl';
    attributes: ClusterAttributeValues<(typeof ValveConfigurationAndControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'ValveConfigurationAndControl.close': {
    command: 'close';
    request: {}; // TlvNoArguments
    cluster: 'valveConfigurationAndControl';
    attributes: ClusterAttributeValues<(typeof ValveConfigurationAndControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Boolean State Configuration
  'suppressAlarm': CommandHandlerData<'BooleanStateConfiguration.suppressAlarm'>;
  'enableDisableAlarm': CommandHandlerData<'BooleanStateConfiguration.enableDisableAlarm'>;
  'BooleanStateConfiguration.suppressAlarm': {
    command: 'suppressAlarm';
    request: BooleanStateConfiguration.SuppressAlarmRequest;
    cluster: 'booleanStateConfiguration';
    attributes: ClusterAttributeValues<(typeof BooleanStateConfiguration.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'BooleanStateConfiguration.enableDisableAlarm': {
    command: 'enableDisableAlarm';
    request: BooleanStateConfiguration.EnableDisableAlarmRequest;
    cluster: 'booleanStateConfiguration';
    attributes: ClusterAttributeValues<(typeof BooleanStateConfiguration.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Smoke and CO Alarm
  'selfTestRequest': CommandHandlerData<'SmokeCoAlarm.selfTestRequest'>;
  'SmokeCoAlarm.selfTestRequest': {
    command: 'selfTestRequest';
    request: {}; // TlvNoArguments
    cluster: 'smokeCoAlarm';
    attributes: ClusterAttributeValues<(typeof SmokeCoAlarm.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Thread Network Diagnostics
  'resetCounts': CommandHandlerData<'ThreadNetworkDiagnostics.resetCounts'>;
  'ThreadNetworkDiagnostics.resetCounts': {
    command: 'resetCounts';
    request: {}; // TlvNoArguments
    cluster: 'threadNetworkDiagnostics';
    attributes: ClusterAttributeValues<(typeof ThreadNetworkDiagnostics.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Time Synchronization
  'setUtcTime': CommandHandlerData<'TimeSynchronization.setUtcTime'>;
  'setTimeZone': CommandHandlerData<'TimeSynchronization.setTimeZone'>;
  'setDstOffset': CommandHandlerData<'TimeSynchronization.setDstOffset'>;
  'TimeSynchronization.setUtcTime': {
    command: 'setUtcTime';
    request: TimeSynchronization.SetUtcTimeRequest;
    cluster: 'timeSynchronization';
    attributes: ClusterAttributeValues<(typeof TimeSynchronization.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'TimeSynchronization.setTimeZone': {
    command: 'setTimeZone';
    request: TimeSynchronization.SetTimeZoneRequest;
    cluster: 'timeSynchronization';
    attributes: ClusterAttributeValues<(typeof TimeSynchronization.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'TimeSynchronization.setDstOffset': {
    command: 'setDstOffset';
    request: TimeSynchronization.SetDstOffsetRequest;
    cluster: 'timeSynchronization';
    attributes: ClusterAttributeValues<(typeof TimeSynchronization.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Device Energy Management
  'pauseRequest': CommandHandlerData<'DeviceEnergyManagement.pauseRequest'>;
  'resumeRequest': CommandHandlerData<'DeviceEnergyManagement.resumeRequest'>;
  'powerAdjustRequest': CommandHandlerData<'DeviceEnergyManagement.powerAdjustRequest'>;
  'cancelPowerAdjustRequest': CommandHandlerData<'DeviceEnergyManagement.cancelPowerAdjustRequest'>;
  'DeviceEnergyManagement.pauseRequest': {
    command: 'pauseRequest';
    request: DeviceEnergyManagement.PauseRequest;
    cluster: 'deviceEnergyManagement';
    attributes: ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DeviceEnergyManagement.resumeRequest': {
    command: 'resumeRequest';
    request: {}; // TlvNoArguments
    cluster: 'deviceEnergyManagement';
    attributes: ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DeviceEnergyManagement.powerAdjustRequest': {
    command: 'powerAdjustRequest';
    request: DeviceEnergyManagement.PowerAdjustRequest;
    cluster: 'deviceEnergyManagement';
    attributes: ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'DeviceEnergyManagement.cancelPowerAdjustRequest': {
    command: 'cancelPowerAdjustRequest';
    request: {}; // TlvNoArguments
    cluster: 'deviceEnergyManagement';
    attributes: ClusterAttributeValues<(typeof DeviceEnergyManagement.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Operational State
  'pause': CommandHandlerData<'OperationalState.pause'>;
  'stop': CommandHandlerData<'OperationalState.stop'>;
  'start': CommandHandlerData<'OperationalState.start'>;
  'resume': CommandHandlerData<'OperationalState.resume'>;
  'OperationalState.pause': {
    command: 'pause';
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'OperationalState.stop': {
    command: 'stop';
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'OperationalState.start': {
    command: 'start';
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'OperationalState.resume': {
    command: 'resume';
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: ClusterAttributeValues<(typeof OperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Operational State
  'goHome': CommandHandlerData<'RvcOperationalState.goHome'>;
  'RvcOperationalState.pause': {
    command: 'pause';
    request: {}; // TlvNoArguments
    cluster: 'rvcOperationalState';
    attributes: ClusterAttributeValues<(typeof RvcOperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'RvcOperationalState.resume': {
    command: 'resume';
    request: {}; // TlvNoArguments
    cluster: 'rvcOperationalState';
    attributes: ClusterAttributeValues<(typeof RvcOperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'RvcOperationalState.goHome': {
    command: 'goHome';
    request: {}; // TlvNoArguments
    cluster: 'rvcOperationalState';
    attributes: ClusterAttributeValues<(typeof RvcOperationalState.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Service Area
  'selectAreas': CommandHandlerData<'ServiceArea.selectAreas'>;
  'ServiceArea.selectAreas': {
    command: 'selectAreas';
    request: ServiceArea.SelectAreasRequest;
    cluster: 'serviceArea';
    attributes: ClusterAttributeValues<(typeof ServiceArea.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Water Heater Management
  'boost': CommandHandlerData<'WaterHeaterManagement.boost'>;
  'cancelBoost': CommandHandlerData<'WaterHeaterManagement.cancelBoost'>;
  'WaterHeaterManagement.boost': {
    command: 'boost';
    request: WaterHeaterManagement.BoostRequest;
    cluster: 'waterHeaterManagement';
    attributes: ClusterAttributeValues<(typeof WaterHeaterManagement.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'WaterHeaterManagement.cancelBoost': {
    command: 'cancelBoost';
    request: {}; // TlvNoArguments
    cluster: 'waterHeaterManagement';
    attributes: ClusterAttributeValues<(typeof WaterHeaterManagement.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Energy Evse
  'enableCharging': CommandHandlerData<'EnergyEvse.enableCharging'>;
  'disable': CommandHandlerData<'EnergyEvse.disable'>;
  'setTargets': CommandHandlerData<'EnergyEvse.setTargets'>;
  'getTargets': CommandHandlerData<'EnergyEvse.getTargets'>;
  'clearTargets': CommandHandlerData<'EnergyEvse.clearTargets'>;
  'EnergyEvse.enableCharging': {
    command: 'enableCharging';
    request: EnergyEvse.EnableChargingRequest;
    cluster: 'energyEvse';
    attributes: ClusterAttributeValues<(typeof EnergyEvse.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.disable': {
    command: 'disable';
    request: {}; // TlvNoArguments
    cluster: 'energyEvse';
    attributes: ClusterAttributeValues<(typeof EnergyEvse.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.setTargets': {
    command: 'setTargets';
    request: EnergyEvse.SetTargetsRequest;
    cluster: 'energyEvse';
    attributes: ClusterAttributeValues<(typeof EnergyEvse.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.getTargets': {
    command: 'getTargets';
    request: {}; // TlvNoArguments
    cluster: 'energyEvse';
    attributes: ClusterAttributeValues<(typeof EnergyEvse.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.clearTargets': {
    command: 'clearTargets';
    request: {}; // TlvNoArguments
    cluster: 'energyEvse';
    attributes: ClusterAttributeValues<(typeof EnergyEvse.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Temperature Control
  'setTemperature': CommandHandlerData<'TemperatureControl.setTemperature'>;
  'TemperatureControl.setTemperature': {
    command: 'setTemperature';
    request: TemperatureControl.SetTemperatureRequest;
    cluster: 'temperatureControl';
    attributes: ClusterAttributeValues<(typeof TemperatureControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Microwave Oven Control
  'setCookingParameters': CommandHandlerData<'MicrowaveOvenControl.setCookingParameters'>;
  'addMoreTime': CommandHandlerData<'MicrowaveOvenControl.addMoreTime'>;
  'MicrowaveOvenControl.setCookingParameters': {
    command: 'setCookingParameters';
    request: MicrowaveOvenControl.SetCookingParametersRequest;
    cluster: 'microwaveOvenControl';
    attributes: ClusterAttributeValues<(typeof MicrowaveOvenControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MicrowaveOvenControl.addMoreTime': {
    command: 'addMoreTime';
    request: MicrowaveOvenControl.AddMoreTimeRequest;
    cluster: 'microwaveOvenControl';
    attributes: ClusterAttributeValues<(typeof MicrowaveOvenControl.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Media Playback
  'play': CommandHandlerData<'MediaPlayback.play'>;
  'previous': CommandHandlerData<'MediaPlayback.previous'>;
  'next': CommandHandlerData<'MediaPlayback.next'>;
  'skipForward': CommandHandlerData<'MediaPlayback.skipForward'>;
  'skipBackward': CommandHandlerData<'MediaPlayback.skipBackward'>;
  'MediaPlayback.pause': {
    command: 'pause';
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.stop': {
    command: 'stop';
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.play': {
    command: 'play';
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.previous': {
    command: 'previous';
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.next': {
    command: 'next';
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.skipForward': {
    command: 'skipForward';
    request: MediaPlayback.SkipForwardRequest;
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.skipBackward': {
    command: 'skipBackward';
    request: MediaPlayback.SkipBackwardRequest;
    cluster: 'mediaPlayback';
    attributes: ClusterAttributeValues<(typeof MediaPlayback.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Keypad Input
  'sendKey': CommandHandlerData<'KeypadInput.sendKey'>;
  'KeypadInput.sendKey': {
    command: 'sendKey';
    request: KeypadInput.SendKeyRequest;
    cluster: 'keypadInput';
    attributes: ClusterAttributeValues<(typeof KeypadInput.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Resource Monitoring
  'resetCondition': CommandHandlerData<'ResourceMonitoring.resetCondition'>;
  'ResourceMonitoring.resetCondition': {
    command: 'resetCondition';
    request: {}; // TlvNoArguments
    cluster: 'resourceMonitoring';
    attributes: ClusterAttributeValues<(typeof ResourceMonitoring.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Hepa Filter Monitoring
  'HepaFilterMonitoring.resetCondition': {
    command: 'resetCondition';
    request: {}; // TlvNoArguments
    cluster: 'hepaFilterMonitoring';
    attributes: ClusterAttributeValues<(typeof HepaFilterMonitoring.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };

  // Activated Carbon Filter Monitoring
  'ActivatedCarbonFilterMonitoring.resetCondition': {
    command: 'resetCondition';
    request: {}; // TlvNoArguments
    cluster: 'activatedCarbonFilterMonitoring';
    attributes: ClusterAttributeValues<(typeof ActivatedCarbonFilterMonitoring.Complete)['attributes']>;
    endpoint: MatterbridgeEndpoint;
  };
};

type CommandHandlerEntry = {
  [K in CommandHandlers]: {
    command: K;
    handler: CommandHandlerFunction<K>;
  };
}[CommandHandlers];

/**
 * CommandHandler class that manages command handlers for MatterbridgeEndpoint.
 */
export class CommandHandler {
  private handler: CommandHandlerEntry[] = [];

  /**
   * Checks if a handler exists for the given command.
   *
   * @param {CommandHandlers} command - The command to check for a handler.
   * @returns {boolean} - True if a handler exists, false otherwise.
   */
  hasHandler<K extends CommandHandlers>(command: K): boolean {
    return this.handler.some(({ command: registeredCommand }) => registeredCommand === command);
  }

  /**
   * Adds a handler for the given command.
   *
   * @param {CommandHandlers} command - The command to add a handler for.
   * @param {CommandHandlerFunction<K>} handler - The handler function to execute for the command.
   */
  addHandler<K extends CommandHandlers>(command: K, handler: CommandHandlerFunction<K>): void {
    this.handler.push({ command, handler } as CommandHandlerEntry);
  }

  /**
   * Executes the handler for the given command with the provided arguments.
   * If a handler for the exact command is not found, it will attempt to find a handler for the fallback command,
   * which is derived from the original command by taking the part after the last dot (if any).
   * If a handler for the fallback command is found, it will be executed with the same arguments.
   *
   * @param {CommandHandlers} command - The command to execute the handler for.
   * @param {...any} args - The arguments to pass to the handler function.
   * @returns {Promise<void>} - A promise that resolves when the handler has been executed.
   */
  async executeHandler<K extends CommandHandlers>(command: K, ...args: Parameters<CommandHandlerFunction<K>>): Promise<void> {
    for (const { command: registeredCommand, handler } of this.handler) {
      if (registeredCommand === command) {
        return await (handler as CommandHandlerFunction<K>)(...args);
      }
    }

    const fallbackCommand = command.includes('.') ? command.split('.').pop() : undefined;
    if (fallbackCommand === undefined) return;

    for (const { command: registeredCommand, handler } of this.handler) {
      if (registeredCommand === fallbackCommand) {
        return await (handler as (...handlerArgs: Parameters<CommandHandlerFunction<K>>) => void | Promise<void>)(...args);
      }
    }
  }

  /**
   * Removes the handler for the given command.
   *
   * @param {CommandHandlers} command - The command to remove the handler for.
   * @param {CommandHandlerFunction<K>} handler - The handler function to remove.
   */
  removeHandler<K extends CommandHandlers>(command: K, handler: CommandHandlerFunction<K>): void {
    this.handler = this.handler.filter(({ command: registeredCommand, handler: registeredHandler }) => {
      return registeredCommand !== command && registeredHandler !== handler;
    });
  }
}
