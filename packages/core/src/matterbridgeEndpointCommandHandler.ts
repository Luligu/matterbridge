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

/**
 * Keys of the supported commands for MatterbridgeEndpoint. The keys are in the format 'ClusterName.commandName' and correspond to the commands defined in the clusters used by MatterbridgeEndpoint.
 */
export type CommandHandlers = keyof CommandHandlerDataMap;

/**
 * Data passed to command handlers for a specific command. The type is determined by the command name and contains the request, cluster, attributes, and endpoint related to the command.
 */
export type CommandHandlerData<T extends CommandHandlers = CommandHandlers> = CommandHandlerDataMap[T];

/**
 * Type of the command handler function for MatterbridgeEndpoint. The function receives data related to the executed command, including the request, cluster, attributes, and endpoint.
 */
export type CommandHandlerFunction<T extends CommandHandlers = CommandHandlers> = (data: CommandHandlerData<T>) => void | Promise<void>;

/**
 * Data passed to command handlers for each supported command. The keys are in the format 'ClusterName.commandName' and the values contain the request, cluster, attributes, and endpoint related to the command.
 * AI generated note: The CommandHandlerDataMap type is generated based on the commands defined in the clusters used by MatterbridgeEndpoint.
 * Each command has a corresponding entry in the map with the appropriate types for request, cluster, attributes, and endpoint.
 */
export type CommandHandlerDataMap = {
  // Identify
  'identify': CommandHandlerData<'Identify.identify'>;
  'triggerEffect': CommandHandlerData<'Identify.triggerEffect'>;
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
  'on': CommandHandlerData<'OnOff.on'>;
  'off': CommandHandlerData<'OnOff.off'>;
  'toggle': CommandHandlerData<'OnOff.toggle'>;
  'offWithEffect': CommandHandlerData<'OnOff.offWithEffect'>;
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
  'moveToLevel': CommandHandlerData<'LevelControl.moveToLevel'>;
  'moveToLevelWithOnOff': CommandHandlerData<'LevelControl.moveToLevelWithOnOff'>;
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
  'upOrOpen': CommandHandlerData<'WindowCovering.upOrOpen'>;
  'downOrClose': CommandHandlerData<'WindowCovering.downOrClose'>;
  'stopMotion': CommandHandlerData<'WindowCovering.stopMotion'>;
  'goToLiftPercentage': CommandHandlerData<'WindowCovering.goToLiftPercentage'>;
  'goToTiltPercentage': CommandHandlerData<'WindowCovering.goToTiltPercentage'>;
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

  // Closure Control
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

  // Closure Dimension
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
  'lockDoor': CommandHandlerData<'DoorLock.lockDoor'>;
  'unlockDoor': CommandHandlerData<'DoorLock.unlockDoor'>;
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
  'setpointRaiseLower': CommandHandlerData<'Thermostat.setpointRaiseLower'>;
  'setActivePresetRequest': CommandHandlerData<'Thermostat.setActivePresetRequest'>;
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
  'step': CommandHandlerData<'FanControl.step'>;
  'FanControl.step': {
    request: FanControl.StepRequest;
    cluster: 'fanControl';
    attributes: (typeof FanControl.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Mode Select
  'changeToMode': CommandHandlerData<'ModeSelect.changeToMode'>;
  'ModeSelect.changeToMode': {
    request: ModeSelect.ChangeToModeRequest;
    cluster: 'modeSelect';
    attributes: (typeof ModeSelect.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Dishwasher Mode
  'DishwasherMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'dishwasherMode';
    attributes: (typeof DishwasherMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Laundry Washer Mode
  'LaundryWasherMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'laundryWasherMode';
    attributes: (typeof LaundryWasherMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Energy EVSE Mode
  'EnergyEvseMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'energyEvseMode';
    attributes: (typeof EnergyEvseMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Run Mode
  'RvcRunMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'rvcRunMode';
    attributes: (typeof RvcRunMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Rvc Clean Mode
  'RvcCleanMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'rvcCleanMode';
    attributes: (typeof RvcCleanMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Water Heater Mode
  'WaterHeaterMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'waterHeaterMode';
    attributes: (typeof WaterHeaterMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Device Energy Management Mode
  'DeviceEnergyManagementMode.changeToMode': {
    request: ModeBase.ChangeToModeRequest;
    cluster: 'deviceEnergyManagementMode';
    attributes: (typeof DeviceEnergyManagementMode.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Valve Configuration and Control
  'open': CommandHandlerData<'ValveConfigurationAndControl.open'>;
  'close': CommandHandlerData<'ValveConfigurationAndControl.close'>;
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
  'suppressAlarm': CommandHandlerData<'BooleanStateConfiguration.suppressAlarm'>;
  'enableDisableAlarm': CommandHandlerData<'BooleanStateConfiguration.enableDisableAlarm'>;
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
  'selfTestRequest': CommandHandlerData<'SmokeCoAlarm.selfTestRequest'>;
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
  'pauseRequest': CommandHandlerData<'DeviceEnergyManagement.pauseRequest'>;
  'resumeRequest': CommandHandlerData<'DeviceEnergyManagement.resumeRequest'>;
  'powerAdjustRequest': CommandHandlerData<'DeviceEnergyManagement.powerAdjustRequest'>;
  'cancelPowerAdjustRequest': CommandHandlerData<'DeviceEnergyManagement.cancelPowerAdjustRequest'>;
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
  'pause': CommandHandlerData<'OperationalState.pause'>;
  'stop': CommandHandlerData<'OperationalState.stop'>;
  'start': CommandHandlerData<'OperationalState.start'>;
  'resume': CommandHandlerData<'OperationalState.resume'>;
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
  'goHome': CommandHandlerData<'RvcOperationalState.goHome'>;
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

  // Service Area
  'selectAreas': CommandHandlerData<'ServiceArea.selectAreas'>;
  'ServiceArea.selectAreas': {
    request: ServiceArea.SelectAreasRequest;
    cluster: 'serviceArea';
    attributes: (typeof ServiceArea.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Water Heater Management
  'boost': CommandHandlerData<'WaterHeaterManagement.boost'>;
  'cancelBoost': CommandHandlerData<'WaterHeaterManagement.cancelBoost'>;
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
  'enableCharging': CommandHandlerData<'EnergyEvse.enableCharging'>;
  'disable': CommandHandlerData<'EnergyEvse.disable'>;
  'setTargets': CommandHandlerData<'EnergyEvse.setTargets'>;
  'getTargets': CommandHandlerData<'EnergyEvse.getTargets'>;
  'clearTargets': CommandHandlerData<'EnergyEvse.clearTargets'>;
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
  'setCookingParameters': CommandHandlerData<'MicrowaveOvenControl.setCookingParameters'>;
  'addMoreTime': CommandHandlerData<'MicrowaveOvenControl.addMoreTime'>;
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

  // Media Playback
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

  // Keypad Input
  'KeypadInput.sendKey': {
    request: KeypadInput.SendKeyRequest;
    cluster: 'keypadInput';
    attributes: (typeof KeypadInput.ClusterInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Resource Monitoring
  'resetCondition': CommandHandlerData<'ResourceMonitoring.resetCondition'>;
  'ResourceMonitoring.resetCondition': {
    request: {}; // TlvNoArguments
    cluster: 'resourceMonitoring';
    attributes: (typeof ResourceMonitoring.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Hepa Filter Monitoring
  'HepaFilterMonitoring.resetCondition': {
    request: {}; // TlvNoArguments
    cluster: 'hepaFilterMonitoring';
    attributes: (typeof HepaFilterMonitoring.CompleteInstance)['attributes'];
    endpoint: MatterbridgeEndpoint;
  };

  // Activated Carbon Filter Monitoring
  'ActivatedCarbonFilterMonitoring.resetCondition': {
    request: {}; // TlvNoArguments
    cluster: 'activatedCarbonFilterMonitoring';
    attributes: (typeof ActivatedCarbonFilterMonitoring.CompleteInstance)['attributes'];
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
