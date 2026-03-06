/**
 * This file contains the types for MatterbridgeEndpoint.
 *
 * @file matterbridgeEndpointTypes.ts
 * @author Luca Liguori
 * @created 2025-11-10
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

// istanbul ignore if -- Loader logs are not relevant for coverage
// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgeEndpointTypes loaded.\u001B[40;0m');

// @matter
import { HandlerFunction } from '@matter/general';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { ColorControl } from '@matter/types/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { FanControl } from '@matter/types/clusters/fan-control';
import { Identify } from '@matter/types/clusters/identify';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { LevelControl } from '@matter/types/clusters/level-control';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ThreadNetworkDiagnostics } from '@matter/types/clusters/thread-network-diagnostics';
import { TimeSynchronization } from '@matter/types/clusters/time-synchronization';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { ClusterId, EndpointNumber } from '@matter/types/datatype';
import { Semtag } from '@matter/types/globals';

// matterbridge
import { ClosureControl } from './clusters/closure-control.js';
import { ClosureDimension } from './clusters/closure-dimension.js';
import type { DeviceTypeDefinition } from './matterbridgeDeviceTypes.js';
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

export type PrimitiveTypes = boolean | number | bigint | string | object | undefined | null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CommandHandlerData = { request: Record<string, any>; cluster: string; attributes: Record<string, PrimitiveTypes>; endpoint: MatterbridgeEndpoint };
export type CommandHandlerFunction = (data: CommandHandlerData) => void | Promise<void>;

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

/* Will be wired in MatterbridgeEndpoint.addCommandHandler() to provide the correct types for the command handler functions */
type _CommandHandlerCommands = keyof _CommandHandlerDataMap;
type _CommandHandlerData<T extends _CommandHandlerCommands = _CommandHandlerCommands> = _CommandHandlerDataMap[T];
type _CommandHandlerFunction = (data: _CommandHandlerData) => void | Promise<void>;
type _CommandHandlerDataMap = {
  // Identify
  'Identify.identify': {
    request: Identify.IdentifyRequest;
    cluster: 'identify';
    attributes: (typeof Identify.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'Identify.triggerEffect': {
    request: Identify.TriggerEffectRequest;
    cluster: 'identify';
    attributes: (typeof Identify.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // On/Off
  'OnOff.on': {
    request: {}; // TlvNoArguments
    cluster: 'onOff';
    attributes: (typeof OnOff.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'OnOff.off': {
    request: {}; // TlvNoArguments
    cluster: 'onOff';
    attributes: (typeof OnOff.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'OnOff.toggle': {
    request: {}; // TlvNoArguments
    cluster: 'onOff';
    attributes: (typeof OnOff.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'OnOff.offWithEffect': {
    request: OnOff.OffWithEffectRequest;
    cluster: 'onOff';
    attributes: (typeof OnOff.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Level Control
  'LevelControl.moveToLevel': {
    request: LevelControl.MoveToLevelRequest;
    cluster: 'levelControl';
    attributes: (typeof LevelControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'LevelControl.moveToLevelWithOnOff': {
    request: LevelControl.MoveToLevelRequest;
    cluster: 'levelControl';
    attributes: (typeof LevelControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Color Control
  'ColorControl.moveToColor': {
    request: ColorControl.MoveToColorRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveColor': {
    request: ColorControl.MoveColorRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.stepColor': {
    request: ColorControl.StepColorRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToHue': {
    request: ColorControl.MoveToHueRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveHue': {
    request: ColorControl.MoveHueRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.stepHue': {
    request: ColorControl.StepHueRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedMoveToHue': {
    request: ColorControl.EnhancedMoveToHueRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedMoveHue': {
    request: ColorControl.EnhancedMoveHueRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedStepHue': {
    request: ColorControl.EnhancedStepHueRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToSaturation': {
    request: ColorControl.MoveToSaturationRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveSaturation': {
    request: ColorControl.MoveSaturationRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.stepSaturation': {
    request: ColorControl.StepSaturationRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToHueAndSaturation': {
    request: ColorControl.MoveToHueAndSaturationRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.enhancedMoveToHueAndSaturation': {
    request: ColorControl.EnhancedMoveToHueAndSaturationRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ColorControl.moveToColorTemperature': {
    request: ColorControl.MoveToColorTemperatureRequest;
    cluster: 'colorControl';
    attributes: (typeof ColorControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Window Covering
  'WindowCovering.upOrOpen': {
    request: {}; // TlvNoArguments
    cluster: 'windowCovering';
    attributes: (typeof WindowCovering.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.downOrClose': {
    request: {}; // TlvNoArguments
    cluster: 'windowCovering';
    attributes: (typeof WindowCovering.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.stopMotion': {
    request: {}; // TlvNoArguments
    cluster: 'windowCovering';
    attributes: (typeof WindowCovering.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.goToLiftPercentage': {
    request: WindowCovering.GoToLiftPercentageRequest;
    cluster: 'windowCovering';
    attributes: (typeof WindowCovering.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'WindowCovering.goToTiltPercentage': {
    request: WindowCovering.GoToTiltPercentageRequest;
    cluster: 'windowCovering';
    attributes: (typeof WindowCovering.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Closure
  'ClosureControl.moveTo': {
    request: ClosureControl.MoveToRequest;
    cluster: 'closureControl';
    attributes: (typeof ClosureControl.Complete)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ClosureControl.stop': {
    request: {}; // TlvNoArguments
    cluster: 'closureControl';
    attributes: (typeof ClosureControl.Complete)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ClosureDimension.setTarget': {
    request: ClosureDimension.SetTargetRequest;
    cluster: 'closureDimension';
    attributes: (typeof ClosureDimension.Complete)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ClosureDimension.step': {
    request: ClosureDimension.StepRequest;
    cluster: 'closureDimension';
    attributes: (typeof ClosureDimension.Complete)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Door Lock
  'DoorLock.lockDoor': {
    request: DoorLock.LockDoorRequest;
    cluster: 'doorLock';
    attributes: (typeof DoorLock.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'DoorLock.unlockDoor': {
    request: DoorLock.UnlockDoorRequest;
    cluster: 'doorLock';
    attributes: (typeof DoorLock.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Thermostat
  'Thermostat.setpointRaiseLower': {
    request: Thermostat.SetpointRaiseLowerRequest;
    cluster: 'thermostat';
    attributes: (typeof Thermostat.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'Thermostat.setActivePresetRequest': {
    request: Thermostat.SetActivePresetRequest;
    cluster: 'thermostat';
    attributes: (typeof Thermostat.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Fan Control
  'FanControl.step': {
    request: FanControl.StepRequest;
    cluster: 'fanControl';
    attributes: (typeof FanControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Mode Select
  'ModeSelect.changeToMode': {
    request: ModeSelect.ChangeToModeRequest;
    cluster: 'modeSelect';
    attributes: (typeof ModeSelect.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Valve Configuration and Control
  'ValveConfigurationAndControl.open': {
    request: ValveConfigurationAndControl.OpenRequest;
    cluster: 'valveConfigurationAndControl';
    attributes: (typeof ValveConfigurationAndControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'ValveConfigurationAndControl.close': {
    request: {}; // TlvNoArguments
    cluster: 'valveConfigurationAndControl';
    attributes: (typeof ValveConfigurationAndControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Boolean State Configuration
  'BooleanStateConfiguration.suppressAlarm': {
    request: BooleanStateConfiguration.SuppressAlarmRequest;
    cluster: 'booleanStateConfiguration';
    attributes: (typeof BooleanStateConfiguration.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'BooleanStateConfiguration.enableDisableAlarm': {
    request: BooleanStateConfiguration.EnableDisableAlarmRequest;
    cluster: 'booleanStateConfiguration';
    attributes: (typeof BooleanStateConfiguration.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Smoke and CO Alarm
  'SmokeCoAlarm.selfTestRequest': {
    request: {}; // TlvNoArguments
    cluster: 'smokeCoAlarm';
    attributes: (typeof SmokeCoAlarm.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Thread Network Diagnostics
  'ThreadNetworkDiagnostics.resetCounts': {
    request: {}; // TlvNoArguments
    cluster: 'threadNetworkDiagnostics';
    attributes: (typeof ThreadNetworkDiagnostics.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Time Synchronization
  'TimeSynchronization.setUtcTime': {
    request: TimeSynchronization.SetUtcTimeRequest;
    cluster: 'timeSynchronization';
    attributes: (typeof TimeSynchronization.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'TimeSynchronization.setTimeZone': {
    request: TimeSynchronization.SetTimeZoneRequest;
    cluster: 'timeSynchronization';
    attributes: (typeof TimeSynchronization.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'TimeSynchronization.setDstOffset': {
    request: TimeSynchronization.SetDstOffsetRequest;
    cluster: 'timeSynchronization';
    attributes: (typeof TimeSynchronization.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Device Energy Management
  'DeviceEnergyManagement.pauseRequest': {
    request: DeviceEnergyManagement.PauseRequest;
    cluster: 'deviceEnergyManagement';
    attributes: (typeof DeviceEnergyManagement.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'DeviceEnergyManagement.resumeRequest': {
    request: {}; // TlvNoArguments
    cluster: 'deviceEnergyManagement';
    attributes: (typeof DeviceEnergyManagement.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'DeviceEnergyManagement.powerAdjustRequest': {
    request: DeviceEnergyManagement.PowerAdjustRequest;
    cluster: 'deviceEnergyManagement';
    attributes: (typeof DeviceEnergyManagement.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'DeviceEnergyManagement.cancelPowerAdjustRequest': {
    request: {}; // TlvNoArguments
    cluster: 'deviceEnergyManagement';
    attributes: (typeof DeviceEnergyManagement.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Operational State
  'OperationalState.pause': {
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: (typeof OperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'OperationalState.stop': {
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: (typeof OperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'OperationalState.start': {
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: (typeof OperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'OperationalState.resume': {
    request: {}; // TlvNoArguments
    cluster: 'operationalState';
    attributes: (typeof OperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Operational State
  'RvcOperationalState.pause': {
    request: {}; // TlvNoArguments
    cluster: 'rvcOperationalState';
    attributes: (typeof RvcOperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'RvcOperationalState.resume': {
    request: {}; // TlvNoArguments
    cluster: 'rvcOperationalState';
    attributes: (typeof RvcOperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'RvcOperationalState.goHome': {
    request: {}; // TlvNoArguments
    cluster: 'rvcOperationalState';
    attributes: (typeof RvcOperationalState.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Service Area
  'ServiceArea.selectAreas': {
    request: ServiceArea.SelectAreasRequest;
    cluster: 'serviceArea';
    attributes: (typeof ServiceArea.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Water Heater Management
  'WaterHeaterManagement.boost': {
    request: WaterHeaterManagement.BoostRequest;
    cluster: 'waterHeaterManagement';
    attributes: (typeof WaterHeaterManagement.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'WaterHeaterManagement.cancelBoost': {
    request: {}; // TlvNoArguments
    cluster: 'waterHeaterManagement';
    attributes: (typeof WaterHeaterManagement.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Energy Evse
  'EnergyEvse.enableCharging': {
    request: EnergyEvse.EnableChargingRequest;
    cluster: 'energyEvse';
    attributes: (typeof EnergyEvse.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.disable': {
    request: {}; // TlvNoArguments
    cluster: 'energyEvse';
    attributes: (typeof EnergyEvse.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.setTargets': {
    request: EnergyEvse.SetTargetsRequest;
    cluster: 'energyEvse';
    attributes: (typeof EnergyEvse.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.getTargets': {
    request: {}; // TlvNoArguments
    cluster: 'energyEvse';
    attributes: (typeof EnergyEvse.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'EnergyEvse.clearTargets': {
    request: {}; // TlvNoArguments
    cluster: 'energyEvse';
    attributes: (typeof EnergyEvse.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Temperature Control
  'TemperatureControl.setTemperature': {
    request: TemperatureControl.SetTemperatureRequest;
    cluster: 'temperatureControl';
    attributes: (typeof TemperatureControl.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Microwave Oven Control
  'MicrowaveOvenControl.setCookingParameters': {
    request: MicrowaveOvenControl.SetCookingParametersRequest;
    cluster: 'microwaveOvenControl';
    attributes: (typeof MicrowaveOvenControl.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MicrowaveOvenControl.addMoreTime': {
    request: MicrowaveOvenControl.AddMoreTimeRequest;
    cluster: 'microwaveOvenControl';
    attributes: (typeof MicrowaveOvenControl.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // MediaPlayback
  'MediaPlayback.pause': {
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.stop': {
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.play': {
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.previous': {
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.next': {
    request: {}; // TlvNoArguments
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.skipForward': {
    request: MediaPlayback.SkipForwardRequest;
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
  'MediaPlayback.skipBackward': {
    request: MediaPlayback.SkipBackwardRequest;
    cluster: 'mediaPlayback';
    attributes: (typeof MediaPlayback.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // KeypadInput
  'KeypadInput.sendKey': {
    request: KeypadInput.SendKeyRequest;
    cluster: 'keypadInput';
    attributes: (typeof KeypadInput.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Resource Monitoring
  'ResourceMonitoring.resetCondition': {
    request: {}; // TlvNoArguments
    cluster: 'resourceMonitoring';
    attributes: (typeof ResourceMonitoring.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };
};

export interface SerializedMatterbridgeEndpoint {
  pluginName: string;
  deviceName: string;
  serialNumber: string;
  uniqueId: string;
  productId?: number;
  productName?: string;
  vendorId?: number;
  vendorName?: string;
  deviceTypes: DeviceTypeDefinition[];
  number: EndpointNumber | undefined;
  id: string | undefined;
  clusterServersId: ClusterId[];
}

/**
 *  MatterbridgeEndpointOptions interface is used to define the options for a Matterbridge endpoint.
 *
 *  @remarks
 *  - tagList?: Semtag[]. It is used to disambiguate the sibling child endpoints (9.2.3. Disambiguation rule).
 *    - mfgCode: VendorId | null,
 *    - namespaceId: number,
 *    - tag: number,
 *    - label: string | undefined | null
 *  - mode?: 'server' | 'matter'. It is used to activate a special mode for the endpoint.
 *  - id?: string. It is the unique storage key for the endpoint.
 *  - number?: EndpointNumber. It is the endpoint number for the endpoint.
 */
export interface MatterbridgeEndpointOptions {
  /**
   *  The semantic tags array for the endpoint.
   *  The tagList is used to disambiguate the sibling child endpoints (9.2.3. Disambiguation rule).
   *  The tagList is used to identify the endpoint and to provide additional information about the endpoint.
   *
   *  @remarks
   *    - mfgCode: VendorId | null,
   *    - namespaceId: number,
   *    - tag: number,
   *    - label: string | undefined | null
   *  @remarks
   *  Use the getSemtag() utility function to create the Semtag objects for the tagList.
   */
  tagList?: Semtag[];
  /**
   * Activates a special mode for this endpoint.
   * - 'server': it creates the device server node and add the device as Matter device that needs to be paired individually.
   *   In this case the Matterbridge bridge mode (bridge or childbridge) is not relevant. The device is independent.
   *
   * - 'matter': it adds the device directly to the Matterbridge server node as Matter device alongside the aggregator. In this case the implementation must respect
   *   the 9.2.3. Disambiguation rule (i.e. use taglist if needed cause the device doesn't have nodeLabel).
   *   Furthermore the device will be a part of the bridge (i.e. will have the same name and will be in the same room).
   *   See 9.12.2.2. Native Matter functionality in Bridge.
   *
   * @remarks
   * Always use createDefaultBasicInformationClusterServer() to create the BasicInformation cluster server when using mode 'server' or 'matter'.
   */
  mode?: 'server' | 'matter';
  /**
   * The unique storage key for the endpoint.
   * If not provided, a default key will be used.
   */
  id?: string;
  /**
   * The endpoint number for the endpoint.
   * If not provided, the endpoint will be created with the next available endpoint number.
   * If provided, the endpoint will be created with the specified endpoint number.
   */
  number?: EndpointNumber;
}
