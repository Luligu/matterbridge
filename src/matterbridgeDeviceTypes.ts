/**
 * This file contains the class MatterbridgeDevice.
 *
 * @file matterbridgeDeviceTypes.ts
 * @author Luca Liguori
 * @date 2024-11-08
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

// @matter
import { ClusterId, DeviceTypeId, EndpointNumber } from '@matter/main';
import { Semtag } from '@matter/main/types';

// @matter clusters
import { BooleanState } from '@matter/main/clusters/boolean-state';
import { BooleanStateConfiguration } from '@matter/main/clusters/boolean-state-configuration';
import { BridgedDeviceBasicInformation } from '@matter/main/clusters/bridged-device-basic-information';
import { CarbonDioxideConcentrationMeasurement } from '@matter/main/clusters/carbon-dioxide-concentration-measurement';
import { CarbonMonoxideConcentrationMeasurement } from '@matter/main/clusters/carbon-monoxide-concentration-measurement';
import { ColorControl } from '@matter/main/clusters/color-control';
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';
import { DoorLock } from '@matter/main/clusters/door-lock';
import { ElectricalEnergyMeasurement } from '@matter/main/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/main/clusters/electrical-power-measurement';
import { FanControl } from '@matter/main/clusters/fan-control';
import { FixedLabel } from '@matter/main/clusters/fixed-label';
import { FlowMeasurement } from '@matter/main/clusters/flow-measurement';
import { FormaldehydeConcentrationMeasurement } from '@matter/main/clusters/formaldehyde-concentration-measurement';
import { Groups } from '@matter/main/clusters/groups';
import { Identify } from '@matter/main/clusters/identify';
import { IlluminanceMeasurement } from '@matter/main/clusters/illuminance-measurement';
import { LevelControl } from '@matter/main/clusters/level-control';
import { ModeSelect } from '@matter/main/clusters/mode-select';
import { NitrogenDioxideConcentrationMeasurement } from '@matter/main/clusters/nitrogen-dioxide-concentration-measurement';
import { OccupancySensing } from '@matter/main/clusters/occupancy-sensing';
import { OnOff } from '@matter/main/clusters/on-off';
import { OzoneConcentrationMeasurement } from '@matter/main/clusters/ozone-concentration-measurement';
import { Pm10ConcentrationMeasurement } from '@matter/main/clusters/pm10-concentration-measurement';
import { Pm1ConcentrationMeasurement } from '@matter/main/clusters/pm1-concentration-measurement';
import { Pm25ConcentrationMeasurement } from '@matter/main/clusters/pm25-concentration-measurement';
import { PowerSource } from '@matter/main/clusters/power-source';
import { PowerTopology } from '@matter/main/clusters/power-topology';
import { PressureMeasurement } from '@matter/main/clusters/pressure-measurement';
import { PumpConfigurationAndControl } from '@matter/main/clusters/pump-configuration-and-control';
import { RadonConcentrationMeasurement } from '@matter/main/clusters/radon-concentration-measurement';
import { RelativeHumidityMeasurement } from '@matter/main/clusters/relative-humidity-measurement';
import { SmokeCoAlarm } from '@matter/main/clusters/smoke-co-alarm';
import { SwitchCluster } from '@matter/main/clusters/switch';
import { TemperatureMeasurement } from '@matter/main/clusters/temperature-measurement';
import { Thermostat } from '@matter/main/clusters/thermostat';
import { TimeSynchronization } from '@matter/main/clusters/time-synchronization';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/main/clusters/total-volatile-organic-compounds-concentration-measurement';
import { ValveConfigurationAndControl } from '@matter/main/clusters/valve-configuration-and-control';
import { WindowCovering } from '@matter/main/clusters/window-covering';
import { AirQuality } from '@matter/main/clusters/air-quality';
import { Actions } from '@matter/main/clusters/actions';
import { ThermostatUserInterfaceConfiguration } from '@matter/main/clusters/thermostat-user-interface-configuration';
import { EnergyPreference } from '@matter/main/clusters/energy-preference';
import { RvcRunMode } from '@matter/main/clusters/rvc-run-mode';
import { RvcOperationalState } from '@matter/main/clusters/rvc-operational-state';
import { RvcCleanMode } from '@matter/main/clusters/rvc-clean-mode';
import { ScenesManagement } from '@matter/main/clusters/scenes-management';
import { HepaFilterMonitoring } from '@matter/main/clusters/hepa-filter-monitoring';
import { ActivatedCarbonFilterMonitoring } from '@matter/main/clusters/activated-carbon-filter-monitoring';
import { DeviceEnergyManagementMode } from '@matter/main/clusters/device-energy-management-mode';

export enum DeviceClasses {
  /** Node device type. */
  Node = 'Node',

  /**
   * Utility device type.
   * A Utility device type supports configuration and settings.
   */
  Utility = 'Utility',

  /**
   * Application device type.
   * Application devices types are typically the most datatype endpoints on a node and in the network.
   */
  App = 'App',

  /**
   * Simple device type.
   * A Simple device type supports local control that is persistent, independent, and unsupervised.
   */
  Simple = 'Simple',

  /**
   * Dynamic device type.
   * A Dynamic device type supports intelligent and supervisory services, such as commissioning,
   * monitoring, trend analysis, scheduling and central management. A dynamic device type is an
   * application device type.
   */
  Dynamic = 'Dynamic',

  /** There exists a client application cluster on the endpoint. */
  Client = 'Client',

  /** There exists a server application cluster on the endpoint. */
  Server = 'Server',

  /** The device type is composed of 2 or more device types. */
  Composed = 'Composed',

  /** Composed device type that is composed of 2 or more endpoints with the same device type. */
  Multiple = 'Multiple',

  /** The endpoint is an Initiator for Zigbee EZ-Mode Finding & Binding. */
  'EZInitiator' = 'EZ-Initiator',

  /** The endpoint is a Target for Zigbee EZ-Mode Finding & Binding. */
  'EZTarget' = 'EZ-Target',

  /**
   * The endpoint represents a Bridged Device, for which information about the state of
   * its power source is available to the Bridge
   */
  BridgedPowerSourceInfo = 'BridgedPowerSourceInfo',
}

export interface DeviceTypeDefinition {
  name: string;
  code: DeviceTypeId;
  deviceClass: DeviceClasses;
  superSet?: string;
  revision: number;
  requiredServerClusters: ClusterId[];
  optionalServerClusters: ClusterId[];
  requiredClientClusters: ClusterId[];
  optionalClientClusters: ClusterId[];
  unknown: boolean;
}

export const DeviceTypeDefinition = ({
  name,
  code,
  deviceClass,
  superSet,
  revision,
  requiredServerClusters = [],
  optionalServerClusters = [],
  requiredClientClusters = [],
  optionalClientClusters = [],
  unknown = false,
}: {
  name: string;
  code: number;
  deviceClass: DeviceClasses;
  superSet?: string;
  revision: number;
  requiredServerClusters?: ClusterId[];
  optionalServerClusters?: ClusterId[];
  requiredClientClusters?: ClusterId[];
  optionalClientClusters?: ClusterId[];
  unknown?: boolean;
}): DeviceTypeDefinition => ({
  name,
  code: DeviceTypeId(code),
  deviceClass,
  superSet,
  revision,
  requiredServerClusters,
  optionalServerClusters,
  requiredClientClusters,
  optionalClientClusters,
  unknown,
});

export interface MatterbridgeEndpointOptions extends EndpointOptions {
  tagList?: Semtag[];
}

export interface EndpointOptions {
  endpointId?: EndpointNumber;
  uniqueStorageKey?: string;
}

// Matter 1.0 and 1.1 device types

export const bridge = DeviceTypeDefinition({
  name: 'MA-aggregator',
  code: 0x000e,
  deviceClass: DeviceClasses.Dynamic,
  revision: 1,
  optionalServerClusters: [Identify.Cluster.id, Actions.Cluster.id],
});

export const aggregator = DeviceTypeDefinition({
  name: 'MA-aggregator',
  code: 0x000e,
  deviceClass: DeviceClasses.Dynamic,
  revision: 1,
  optionalServerClusters: [Identify.Cluster.id, Actions.Cluster.id],
});

export const powerSource = DeviceTypeDefinition({
  name: 'MA-powerSource',
  code: 0x0011,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [PowerSource.Cluster.id],
  optionalServerClusters: [],
});

/**
    2.5.3. Conditions
    Please see the Base Device Type definition for conformance tags.
    This device type SHALL only be used for Nodes which have a device type of Bridge.
  
    2.5.6. Endpoint Composition
    • A Bridged Node endpoint SHALL support one of the following composition patterns:
      ◦ Separate Endpoints: All application device types are supported on separate endpoints, and
        not on the Bridged Node endpoint. The Bridged Node endpoint’s Descriptor cluster PartsList
        attribute SHALL indicate a list of all endpoints representing the functionality of the bridged
        device, including the endpoints supporting the application device types, i.e. the full-family
        pattern defined in the System Model specification.
      ◦ One Endpoint: Both the Bridged Node and one or more application device types are sup
        ported on the same endpoint (following application device type rules). Endpoint composi
        tion SHALL conform to the application device type(s) definition
 */
export const bridgedNode = DeviceTypeDefinition({
  name: 'MA-bridgedNode',
  code: 0x0013,
  deviceClass: DeviceClasses.Utility,
  revision: 2,
  requiredServerClusters: [BridgedDeviceBasicInformation.Cluster.id],
  optionalServerClusters: [PowerSource.Cluster.id],
});

export const genericSwitch = DeviceTypeDefinition({
  name: 'MA-genericswitch',
  code: 0x000f,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, SwitchCluster.id],
  optionalServerClusters: [FixedLabel.Cluster.id],
});

export const onOffLight = DeviceTypeDefinition({
  name: 'MA-onofflight',
  code: 0x0100,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id, ColorControl.Cluster.id],
});

export const dimmableLight = DeviceTypeDefinition({
  name: 'MA-dimmablelight',
  code: 0x0101,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [ColorControl.Cluster.id],
});

export const colorTemperatureLight = DeviceTypeDefinition({
  name: 'MA-colortemperaturelight',
  code: 0x010c,
  deviceClass: DeviceClasses.Simple,
  revision: 4,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

export const onOffOutlet = DeviceTypeDefinition({
  name: 'MA-onoffpluginunit',
  code: 0x010a,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id],
});

export const dimmableOutlet = DeviceTypeDefinition({
  name: 'MA-dimmablepluginunit',
  code: 0x010b,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [],
});

export const doorLockDevice = DeviceTypeDefinition({
  name: 'MA-doorLock',
  code: 0xa,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, DoorLock.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id /* , Scenes.Cluster.id,*/],
});

export const coverDevice = DeviceTypeDefinition({
  name: 'MA-windowCovering',
  code: 0x202,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, WindowCovering.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id /* , Scenes.Cluster.id,*/],
});

/**
 *  Remark: it may have a thermostat device type.
 *  Additional device types MAY also be included in device compositions.
 *  The FanControl cluster must have the FanModeSequence attribute.
 */
export const fanDevice = DeviceTypeDefinition({
  name: 'MA-fan',
  code: 0x2b,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, FanControl.Cluster.id],
  optionalServerClusters: [],
});

export const thermostatDevice = DeviceTypeDefinition({
  name: 'MA-thermostat',
  code: 0x301,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Thermostat.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id /* , Scenes.Cluster.id,*/, ThermostatUserInterfaceConfiguration.Cluster.id, EnergyPreference.Cluster.id, TimeSynchronization.Cluster.id],
});

export const contactSensor = DeviceTypeDefinition({
  name: 'MA-contactsensor',
  code: 0x0015,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, BooleanState.Cluster.id],
});

export const lightSensor = DeviceTypeDefinition({
  name: 'MA-lightsensor',
  code: 0x0106,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, IlluminanceMeasurement.Cluster.id],
});

export const occupancySensor = DeviceTypeDefinition({
  name: 'MA-occupancysensor',
  code: 0x0107,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, OccupancySensing.Cluster.id],
});

export const temperatureSensor = DeviceTypeDefinition({
  name: 'MA-tempsensor',
  code: 0x0302,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, TemperatureMeasurement.Cluster.id],
});

export const pressureSensor = DeviceTypeDefinition({
  name: 'MA-pressuresensor',
  code: 0x0305,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, PressureMeasurement.Cluster.id],
});

export const flowSensor = DeviceTypeDefinition({
  name: 'MA-flowsensor',
  code: 0x0306,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, FlowMeasurement.Cluster.id],
});

export const humiditySensor = DeviceTypeDefinition({
  name: 'MA-humiditysensor',
  code: 0x0307,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, RelativeHumidityMeasurement.Cluster.id],
});

export const modeSelect = DeviceTypeDefinition({
  name: 'MA-modeselect',
  code: 0x27,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [ModeSelect.Cluster.id],
});

export const roboticVacuumCleaner = DeviceTypeDefinition({
  name: 'MA-roboticvacuumcleaner',
  code: 0x74,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, RvcRunMode.Cluster.id, RvcOperationalState.Cluster.id],
  optionalServerClusters: [RvcCleanMode.Cluster.id],
});

// Custom device types without client clusters (not working in Alexa)
export const onOffSwitch = DeviceTypeDefinition({
  name: 'MA-onoffswitch',
  code: 0x0103,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id, ColorControl.Cluster.id],
});

// Custom device types without client clusters (not working in Alexa)
export const dimmableSwitch = DeviceTypeDefinition({
  name: 'MA-dimmableswitch',
  code: 0x0104,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [ColorControl.Cluster.id],
});

// Custom device types without client clusters (not working in Alexa)
export const colorTemperatureSwitch = DeviceTypeDefinition({
  name: 'MA-colortemperatureswitch',
  code: 0x0105,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* Scenes.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

// Matter 1.2 and 1.3 device types

export const airQualitySensor = DeviceTypeDefinition({
  name: 'MA-airQualitySensor',
  code: 0x002c,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, AirQuality.Cluster.id],
  optionalServerClusters: [
    TemperatureMeasurement.Cluster.id,
    RelativeHumidityMeasurement.Cluster.id,
    CarbonMonoxideConcentrationMeasurement.Cluster.id,
    CarbonDioxideConcentrationMeasurement.Cluster.id,
    NitrogenDioxideConcentrationMeasurement.Cluster.id,
    OzoneConcentrationMeasurement.Cluster.id,
    FormaldehydeConcentrationMeasurement.Cluster.id,
    Pm1ConcentrationMeasurement.Cluster.id,
    Pm25ConcentrationMeasurement.Cluster.id,
    Pm10ConcentrationMeasurement.Cluster.id,
    RadonConcentrationMeasurement.Cluster.id,
    TotalVolatileOrganicCompoundsConcentrationMeasurement.Cluster.id,
  ],
});

export const waterFreezeDetector = DeviceTypeDefinition({
  name: 'MA-waterFreezeDetector',
  code: 0x0041,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, BooleanState.Cluster.id],
  optionalServerClusters: [BooleanStateConfiguration.Cluster.id],
});

export const waterLeakDetector = DeviceTypeDefinition({
  name: 'MA-waterLeakDetector',
  code: 0x0043,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, BooleanState.Cluster.id],
  optionalServerClusters: [BooleanStateConfiguration.Cluster.id],
});

export const rainSensor = DeviceTypeDefinition({
  name: 'MA-rainSensor',
  code: 0x0044,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, BooleanState.Cluster.id],
  optionalServerClusters: [BooleanStateConfiguration.Cluster.id],
});

// Remark: A Smoke CO Alarm device type SHALL support an instance of a Power Source device type on some endpoint.
export const smokeCoAlarm = DeviceTypeDefinition({
  name: 'MA-smokeCoAlarm',
  code: 0x0076,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, SmokeCoAlarm.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id, CarbonMonoxideConcentrationMeasurement.Cluster.id],
});

/**
 *  Remark: LevelControl cluster:
 *   0 N/A Pump is stopped,
 *   1–200 Level / 2 (0.5–100.0%) Pump setpoint in percent
 *   201–255 100.0% Pump setpoint is 100.0%
 */
export const pumpDevice = DeviceTypeDefinition({
  name: 'MA-pump',
  code: 0x303,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [OnOff.Cluster.id, PumpConfigurationAndControl.Cluster.id, Identify.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id, Groups.Cluster.id, ScenesManagement.Cluster.id, TemperatureMeasurement.Cluster.id, PressureMeasurement.Cluster.id, FlowMeasurement.Cluster.id],
});

export const waterValve = DeviceTypeDefinition({
  name: 'MA-waterValve',
  code: 0x42,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, ValveConfigurationAndControl.Cluster.id],
  optionalServerClusters: [FlowMeasurement.Cluster.id],
});

/**
 *  Remark: it may have a Thermostat, Temperature Sensor, Humidity Sensor and an Air Quality Sensor device type.
 *  Additional device types MAY also be included in device compositions.
 */
export const airPurifier = DeviceTypeDefinition({
  name: 'MA-airPurifier',
  code: 0x2d,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, FanControl.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, HepaFilterMonitoring.Cluster.id, ActivatedCarbonFilterMonitoring.Cluster.id],
});

/**
 *  Remark: it may have a temperature sensor and a humidity sensor device.
 *  Additional device types MAY also be included in device compositions.
 *  The DF (Dead Front) feature is required for the On/Off cluster in this device type:
 *  - Thermostat                      LocalTemperature    null
 *  - Temperature Measurement         MeasuredValue       null
 *  - Relative Humidity Measurement   MeasuredValue       null
 *  - Fan Control                     SpeedSetting        null
 *  - Fan Control                     PercentSetting      null
 */
export const airConditioner = DeviceTypeDefinition({
  name: 'MA-airConditioner',
  code: 0x72,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, OnOff.Cluster.id, Thermostat.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, ScenesManagement.Cluster.id, FanControl.Cluster.id, ThermostatUserInterfaceConfiguration.Cluster.id, TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id],
});

export const electricalSensor = DeviceTypeDefinition({
  name: 'MA-electricalSensor',
  code: 0x0510,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [PowerTopology.Cluster.id],
  optionalServerClusters: [ElectricalPowerMeasurement.Cluster.id, ElectricalEnergyMeasurement.Cluster.id],
});

export const deviceEnergyManagement = DeviceTypeDefinition({
  name: 'MA-deviceEnergyManagement',
  code: 0x050d,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [DeviceEnergyManagement.Cluster.id, DeviceEnergyManagementMode.Cluster.id],
  optionalServerClusters: [],
});
