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
import { Switch } from '@matter/main/clusters/switch';
import { TemperatureMeasurement } from '@matter/main/clusters/temperature-measurement';
import { Thermostat } from '@matter/main/clusters/thermostat';
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
import { HepaFilterMonitoring } from '@matter/main/clusters/hepa-filter-monitoring';
import { ActivatedCarbonFilterMonitoring } from '@matter/main/clusters/activated-carbon-filter-monitoring';
import { DeviceEnergyManagementMode } from '@matter/main/clusters/device-energy-management-mode';
import { AdministratorCommissioning } from '@matter/main/clusters/administrator-commissioning';
import { EcosystemInformation } from '@matter/main/clusters/ecosystem-information';
import { CommissionerControl } from '@matter/main/clusters/commissioner-control';
import { DishwasherAlarm } from '@matter/main/clusters/dishwasher-alarm';
import { DishwasherMode } from '@matter/main/clusters/dishwasher-mode';
import { LaundryDryerControls } from '@matter/main/clusters/laundry-dryer-controls';
import { LaundryWasherControls } from '@matter/main/clusters/laundry-washer-controls';
import { LaundryWasherMode } from '@matter/main/clusters/laundry-washer-mode';
import { MicrowaveOvenControl } from '@matter/main/clusters/microwave-oven-control';
import { MicrowaveOvenMode } from '@matter/main/clusters/microwave-oven-mode';
import { OperationalState } from '@matter/main/clusters/operational-state';
import { OvenCavityOperationalState } from '@matter/main/clusters/oven-cavity-operational-state';
import { OvenMode } from '@matter/main/clusters/oven-mode';
import { RefrigeratorAlarm } from '@matter/main/clusters/refrigerator-alarm';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/main/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { ServiceArea } from '@matter/main/clusters/service-area';
import { TemperatureControl } from '@matter/main/clusters/temperature-control';
import { OtaSoftwareUpdateRequestor } from '@matter/main/clusters/ota-software-update-requestor';
import { OtaSoftwareUpdateProvider, WaterHeaterManagement, WaterHeaterMode } from '@matter/main/clusters';

export enum DeviceClasses {
  /** Node device type. */
  Node = 'Node',

  /**
   * Application device type.
   * Application devices types are typically the most datatype endpoints on a node and in the network.
   */
  App = 'App',

  /**
   * Utility device type.
   * A Utility device type supports configuration and settings.
   */
  Utility = 'Utility',

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

  /** The endpoint and at least one of its sibling endpoints have an overlap in application device type(s). */
  Duplicate = 'Duplicate',

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
  revision: number;
  requiredServerClusters: ClusterId[];
  optionalServerClusters: ClusterId[];
  requiredClientClusters: ClusterId[];
  optionalClientClusters: ClusterId[];
}

export const DeviceTypeDefinition = ({
  name,
  code,
  deviceClass,
  revision,
  requiredServerClusters = [],
  optionalServerClusters = [],
  requiredClientClusters = [],
  optionalClientClusters = [],
}: {
  name: string;
  code: number;
  deviceClass: DeviceClasses;
  revision: number;
  requiredServerClusters?: ClusterId[];
  optionalServerClusters?: ClusterId[];
  requiredClientClusters?: ClusterId[];
  optionalClientClusters?: ClusterId[];
}): DeviceTypeDefinition => ({
  name,
  code: DeviceTypeId(code),
  deviceClass,
  revision,
  requiredServerClusters,
  optionalServerClusters,
  requiredClientClusters,
  optionalClientClusters,
});

export interface MatterbridgeEndpointOptions extends EndpointOptions {
  tagList?: Semtag[];
}

export interface EndpointOptions {
  endpointId?: EndpointNumber;
  uniqueStorageKey?: string;
}

// Chapter 2. Utility device types

export const powerSource = DeviceTypeDefinition({
  name: 'MA-powerSource',
  code: 0x0011,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [PowerSource.Cluster.id],
  optionalServerClusters: [],
});

export const OTARequestor = DeviceTypeDefinition({
  name: 'MA-OTARequestor',
  code: 0x0012,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [OtaSoftwareUpdateRequestor.Cluster.id],
  optionalServerClusters: [],
  requiredClientClusters: [OtaSoftwareUpdateProvider.Cluster.id],
  optionalClientClusters: [],
});

export const OTAProvider = DeviceTypeDefinition({
  name: 'MA-OTAProvider',
  code: 0x0014,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [OtaSoftwareUpdateProvider.Cluster.id],
  optionalServerClusters: [],
  requiredClientClusters: [OtaSoftwareUpdateRequestor.Cluster.id],
  optionalClientClusters: [],
});

/**
    2.5.3. Conditions
    Please see the Base Device Type definition for conformance tags.
    This device type SHALL only be used for Nodes which have a device type of Bridge.
  
    2.5.5. Cluster Requirements
    Each endpoint supporting this device type SHALL include these clusters based on the conformance
    defined below.
    -  0x0039 Bridged Device Basic Information Server

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
  revision: 3,
  requiredServerClusters: [BridgedDeviceBasicInformation.Cluster.id],
  optionalServerClusters: [PowerSource.Cluster.id, EcosystemInformation.Cluster.id, AdministratorCommissioning.Cluster.id],
});

/**
  2.6.3. Device Type Requirements
  Electrical measurements made by either the Electrical Power Measurement cluster, the Electrical
  Energy Measurement cluster, or both SHALL apply to the endpoints indicated by the Power Topology
  cluster.
*/
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
  revision: 2,
  requiredServerClusters: [DeviceEnergyManagement.Cluster.id, DeviceEnergyManagementMode.Cluster.id],
  optionalServerClusters: [],
});

// Chapter 4. Lightning device types

/**
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 */
export const onOffLight = DeviceTypeDefinition({
  name: 'MA-onofflight',
  code: 0x0100,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id],
});

/**
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 */
export const dimmableLight = DeviceTypeDefinition({
  name: 'MA-dimmablelight',
  code: 0x0101,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [],
});

/**
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 * - Color Control Feature ColorTemperature
 * - Color Control Attribute RemainingTime
 */
export const colorTemperatureLight = DeviceTypeDefinition({
  name: 'MA-colortemperaturelight',
  code: 0x010c,
  deviceClass: DeviceClasses.Simple,
  revision: 4,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

/**
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 * - Color Control Feature XY
 * - Color Control Feature ColorTemperature
 * - Color Control Attribute RemainingTime
 */
export const extendedColorLight = DeviceTypeDefinition({
  name: 'MA-extendedcolorlight',
  code: 0x010d,
  deviceClass: DeviceClasses.Simple,
  revision: 4,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

// Chapter 5. Smart plugs/Outlets and other Actuators device types

/**
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 */
export const onOffOutlet = DeviceTypeDefinition({
  name: 'MA-onoffpluginunit',
  code: 0x010a,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id],
});

/**
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 */
export const dimmableOutlet = DeviceTypeDefinition({
  name: 'MA-dimmablepluginunit',
  code: 0x010b,
  deviceClass: DeviceClasses.Simple,
  revision: 4,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [],
});

/**
 * A Mounted On/Off Control is a fixed device that provides power to another device that is plugged
 * into it, and is capable of switching that provided power on or off.
 * It is a simple device type that does not require any client clusters.
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 */
export const onOffMountedSwitch = DeviceTypeDefinition({
  name: 'MA-onoffmountedswitch',
  code: 0x010f,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id],
});

/**
 * A Mounted Dimmable Load Control is a fixed device that provides power to another device that is
 * plugged into it, and is capable of being switched on or off and have its level adjusted. The Mounted
 * Dimmable Load Control is typically used to control a conventional non-communicating light
 * through its mains connection using phase cutting.
 * It is a simple device type that does not require any client clusters.
 * Element Requirements:
 * - Identify Command TriggerEffect
 * - Scenes Management Command CopyScene
 * - On/Off Feature Lighting
 * - Level Control Feature OnOff
 * - Level Control Feature Lighting
 * - Level Control Attribute CurrentLevel 1 to 254
 * - Level Control Attribute MinLevel 1
 * - Level Control Attribute MaxLevel 254
 */
export const dimmableMountedSwitch = DeviceTypeDefinition({
  name: 'MA-dimmablemountedswitch',
  code: 0x0110,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id,*/ OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [],
});

/**
 *  Remark:
 *  On/Off Cluster:
 *    - Off If the pump is powered on, store the current level then immediately power it off.
 *    - On If the pump is powered off, power it on and move immediately to the level stored by a previous Off command. If no such level has been stored,
 *      move immediately to the maximum level allowed for the pump.
 *    - Toggle If the pump is powered on, proceed as for the Off command. If the device is powered off, proceed as for the On command.
 *
 *  LevelControl cluster:
 *    Level   Setpoint                Meaning
 *    0       N/A                     Pump is stopped,
 *    1–200   Level / 2 (0.5–100.0%)  Pump setpoint in percent
 *    201–255 100.0%                  Pump setpoint is 100.0%
 */
export const pumpDevice = DeviceTypeDefinition({
  name: 'MA-pump',
  code: 0x303,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [OnOff.Cluster.id, PumpConfigurationAndControl.Cluster.id, Identify.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id, Groups.Cluster.id, /* ScenesManagement.Cluster.id, */ TemperatureMeasurement.Cluster.id, PressureMeasurement.Cluster.id, FlowMeasurement.Cluster.id],
});

export const waterValve = DeviceTypeDefinition({
  name: 'MA-waterValve',
  code: 0x42,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, ValveConfigurationAndControl.Cluster.id],
  optionalServerClusters: [FlowMeasurement.Cluster.id],
});

// Chapter 6. Switches and Controls device types

// Custom device types without client clusters (not working in Alexa)
export const onOffSwitch = DeviceTypeDefinition({
  name: 'MA-onoffswitch',
  code: 0x0103,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, OnOff.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id /* , ScenesManagement.Cluster.id*/],
});

// Custom device types without client clusters (not working in Alexa)
export const dimmableSwitch = DeviceTypeDefinition({
  name: 'MA-dimmableswitch',
  code: 0x0104,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id /* , ScenesManagement.Cluster.id*/],
});

// Custom device types without client clusters (not working in Alexa)
export const colorTemperatureSwitch = DeviceTypeDefinition({
  name: 'MA-colortemperatureswitch',
  code: 0x0105,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id /* , ScenesManagement.Cluster.id*/],
});

export const genericSwitch = DeviceTypeDefinition({
  name: 'MA-genericswitch',
  code: 0x000f,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Switch.Cluster.id],
  optionalServerClusters: [],
});

// Chapter 7. Sensor device types

/**
 * Closed or contact: state true
 * Open or no contact: state false
 */
export const contactSensor = DeviceTypeDefinition({
  name: 'MA-contactsensor',
  code: 0x0015,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, BooleanState.Cluster.id],
  optionalServerClusters: [BooleanStateConfiguration.Cluster.id],
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
  revision: 4,
  requiredServerClusters: [Identify.Cluster.id, OccupancySensing.Cluster.id],
  optionalServerClusters: [BooleanStateConfiguration.Cluster.id],
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

// Remark: A Smoke CO Alarm device type SHALL support an instance of a Power Source device type on some endpoint.
export const smokeCoAlarm = DeviceTypeDefinition({
  name: 'MA-smokeCoAlarm',
  code: 0x0076,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, SmokeCoAlarm.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id, CarbonMonoxideConcentrationMeasurement.Cluster.id],
});

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

// Closures device types
/**
 * A Door Lock is a device used to secure a door. It is possible to actuate a door lock either by means of a manual or a remote method.
 * Element Requirements:
 *
 * - AccessControl Attribute Extension
 * - DoorLock Feature User
 * - DoorLock Attribute AlarmMask
 */
export const doorLockDevice = DeviceTypeDefinition({
  name: 'MA-doorLock',
  code: 0xa,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, DoorLock.Cluster.id],
  optionalServerClusters: [],
});

export const coverDevice = DeviceTypeDefinition({
  name: 'MA-windowCovering',
  code: 0x202,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, WindowCovering.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id],
});

// HVAC device types

/**
 * A Thermostat device is capable of having either built-in or separate sensors for temperature,
 * humidity or occupancy. It allows the desired temperature to be set either remotely or locally. The
 * thermostat is capable of sending heating and/or cooling requirement notifications to a heating/cooling
 * unit (for example, an indoor air handler) or is capable of including a mechanism to control a
 * heating or cooling unit directly.
 *
 */
export const thermostatDevice = DeviceTypeDefinition({
  name: 'MA-thermostat',
  code: 0x301,
  deviceClass: DeviceClasses.Simple,
  revision: 4,
  requiredServerClusters: [Identify.Cluster.id, Thermostat.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, ThermostatUserInterfaceConfiguration.Cluster.id, EnergyPreference.Cluster.id],
});

/**
 * A Fan device is typically standalone or mounted on a ceiling or wall and is used to circulate air in a room.
 *  Remark: it may have a thermostat device type.
 *  Additional device types MAY also be included in device compositions.
 * Element Requirements:
 *  The FanControl cluster must have the FanModeSequence attribute.
 *
 * The On/Off cluster is independent from the Fan Control Cluster’s FanMode attribute, which also
 * includes an Off setting.
 * If the FanMode attribute of the Fan Control cluster is set to a value other than Off when the OnOff
 * attribute of the On/Off cluster transitions from TRUE to FALSE, it may be desirable to restore the
 * FanMode, SpeedSetting and PercentSetting attribute values of the Fan Control cluster when the OnOff
 * attribute of the On/Off cluster later transitions from FALSE to TRUE. If the FanMode is set to Off when
 * the device is turned off, this information is lost, as the SpeedSetting and PercentSetting will be set to
 * zero. Using the On/Off cluster alongside the Fan Control cluster allows the FanMode, SpeedSetting and
 * PercentSetting to remain unchanged when the device is turned off. In this case, the On/Off cluster
 * would be set to Off, and the SpeedCurrent and PercentCurrent set to zero, without changing FanMode,
 * SpeedSetting and PercentSetting.
 */
export const fanDevice = DeviceTypeDefinition({
  name: 'MA-fan',
  code: 0x2b,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, FanControl.Cluster.id],
  optionalServerClusters: [OnOff.Cluster.id],
});

/**
 * An Air Purifier is a standalone device that is designed to clean the air in a room.
 * It is a device that has a fan to control the air speed while it is operating. Optionally, it can report on
 * the condition of its filters.
 *
 * Remark:
 * An Air Purifier MAY expose elements of its functionality through one or more additional device
 * types on different endpoints. All devices used in compositions SHALL adhere to the disambiguation
 * requirements of the System Model. Other device types, not explicitly listed in the table, MAY also be
 * included in device compositions but are not considered part of the core functionality of the device.
 * 0x0301 Thermostat O
 * 0x0302 Temperature Sensor O
 * 0x0307 Humidity Sensor O
 * 0x002C Air Quality Sensor O
 *
 * Cluster Restrictions:
 * The On/Off cluster is independent from the Fan Control Cluster’s FanMode attribute, which also
 * includes an Off setting.
 * If the FanMode attribute of the Fan Control cluster is set to a value other than Off when the OnOff
 * attribute of the On/Off cluster transitions from TRUE to FALSE, it may be desirable to restore the
 * FanMode, SpeedSetting and PercentSetting attribute values of the Fan Control cluster when the OnOff
 * attribute of the On/Off cluster later transitions from FALSE to TRUE. If the FanMode is set to Off when
 * the device is turned off, this information is lost, as the SpeedSetting and PercentSetting will be set to
 * zero. Using the On/Off cluster alongside the Fan Control cluster allows the FanMode, SpeedSetting and
 * PercentSetting to remain unchanged when the device is turned off. In this case, the On/Off cluster
 * would be set to Off, and the SpeedCurrent and PercentCurrent set to zero, without changing FanMode,
 * SpeedSetting and PercentSetting.
 *
 */
export const airPurifier = DeviceTypeDefinition({
  name: 'MA-airPurifier',
  code: 0x2d,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, FanControl.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, OnOff.Cluster.id, HepaFilterMonitoring.Cluster.id, ActivatedCarbonFilterMonitoring.Cluster.id],
});

// Generic device types

export const modeSelect = DeviceTypeDefinition({
  name: 'MA-modeselect',
  code: 0x27,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [ModeSelect.Cluster.id],
});

/**
 * This device type aggregates endpoints as a collection. Clusters on the endpoint indicating this
 * device type provide functionality for the collection of descendant endpoints present in the PartsList
 * of the endpoint’s descriptor, for example the Actions cluster.
 *
 * Endpoint Composition:
 * An Aggregator endpoint’s Descriptor cluster PartsList attribute SHALL list the collection of all endpoints
 * aggregated by the Aggregator device type, i.e. the full-family pattern defined in the System Model specification.
 *
 * Disambiguation:
 * If the Duplicate condition applies to child endpoints of an Aggregator endpoint that represent multiple
 * independent bridged devices, the endpoints SHOULD make available metadata to allow a
 * client to disambiguate distinct bridged devices with an overlap in application device types.
 *
 * Typically this is done using the NodeLabel attribute of the Bridged Device Basic Information cluster
 * - thus reusing the naming information which the bridge already has to allow disambiguation to the
 * user when using a direct user interface to the bridge.
 *
 * Actions cluster (9.14 Matter specification):
 * If a Bridge has (such) information on topology or logical grouping, it SHOULD expose such information
 * in the EndpointLists attribute of an Actions cluster (the ActionLists of which MAY be empty if
 * no actions are exposed). 9.12 Matter specification
 *
 * 9.12.5. New features for Bridged Devices
 * Bridged Devices can have their software updated independently of the Bridge, through Bridge Manufacturer-
 * specific means. These updates MAY result in one or more changes to their capabilities,
 * such as supported clusters and/or attributes, for an endpoint. Like every Matter Node, every endpoint
 * on the Bridge’s Node contains a Descriptor cluster that contains attributes for the device types
 * (DeviceTypeList), endpoints (PartsList) and supported clusters (ServerList and ClientList). Nodes
 * that wish to be notified of such changes SHOULD monitor changes of these attributes.
 */
export const aggregator = DeviceTypeDefinition({
  name: 'MA-aggregator',
  code: 0x000e,
  deviceClass: DeviceClasses.Dynamic,
  revision: 2,
  requiredServerClusters: [],
  optionalServerClusters: [Actions.Cluster.id, Identify.Cluster.id, CommissionerControl.Cluster.id],
});

export const bridge = aggregator;

// Robotic device types

/**
 * A Robotic Vacuum Cleaner is a device that is capable of cleaning floors and other surfaces
 * in a home or office environment. It is typically a mobile device that can navigate around
 * obstacles and can be controlled remotely.
 *
 * Cluster Usage:
 * The RVC Operational State cluster’s OperationalState attribute SHALL be updated according to the
 * state of the device, and therefore it SHOULD be used for monitoring purposes.
 *
 * To attempt starting a cleaning operation, the RVC Run Mode cluster can be sent a ChangeToMode
 * command with the NewMode field set to a mode that has the Cleaning mode tag associated with it.
 *
 * To attempt stopping a cleaning operation, the RVC Run Mode cluster can be sent a ChangeToMode
 * command with the NewMode field set to a mode that has the Idle mode tag associated with it.
 *
 * To attempt pausing a cleaning operation, the RVC Operational State cluster can be sent a Pause command.
 *
 * To attempt resuming a cleaning operation, the RVC Operational State cluster can be sent a Resume
 * command.
 *
 *
 */
export const roboticVacuumCleaner = DeviceTypeDefinition({
  name: 'MA-roboticvacuumcleaner',
  code: 0x74,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [Identify.Cluster.id, RvcRunMode.Cluster.id, RvcOperationalState.Cluster.id],
  optionalServerClusters: [RvcCleanMode.Cluster.id, ServiceArea.Cluster.id],
});

// Chapter 13. Appliances device types

/**
 * Cluster Restrictions:
 * On/Off Cluster: the DF (Dead Front) feature is required
 */
export const laundryWasher = DeviceTypeDefinition({
  name: 'MA-laundrywasher',
  code: 0x73,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [OperationalState.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id, LaundryWasherMode.Cluster.id, OnOff.Cluster.id, LaundryWasherControls.Cluster.id, TemperatureControl.Cluster.id],
});

/**
 * A refrigerator represents a device that contains one or more cabinets that are capable of chilling or freezing food.
 * A Refrigerator SHALL be composed of at least one endpoint with the Temperature Controlled Cabinet device type.
 *
 * Device Type Requirements:
 * 0x0071 Temperature Controlled Cabinet
 */
export const refrigerator = DeviceTypeDefinition({
  name: 'MA-refrigerator',
  code: 0x70,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id, RefrigeratorAlarm.Cluster.id],
  optionalServerClusters: [],
});

/**
 * A Room Air Conditioner is a device with the primary function of controlling the air temperature in a single room.
 *
 * A Room Air Conditioner MAY have zero or more of each device type listed in this table subject to
 * the conformance column of the table. All devices used in compositions SHALL adhere to the disambiguation
 * requirements of the System Model. Additional device types not listed in this table MAY also be included in device compositions.
 *  0x0302 Temperature Sensor O
 *  0x0307 Humidity Sensor O
 *
 *  Remark:
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
  optionalServerClusters: [
    Groups.Cluster.id,
    /* ScenesManagement.Cluster.id,*/
    FanControl.Cluster.id,
    ThermostatUserInterfaceConfiguration.Cluster.id,
    TemperatureMeasurement.Cluster.id,
    RelativeHumidityMeasurement.Cluster.id,
  ],
});

/**
 * A Temperature Controlled Cabinet only exists composed as part of another device type. It represents
 * a single cabinet that is capable of having its temperature controlled. Such a cabinet may be
 * chilling or freezing food, for example as part of a refrigerator, freezer, wine chiller, or other similar
 * device. Equally, such a cabinet may be warming or heating food, for example as part of an oven,
 * range, or similar device.
 * Conditions:
 * Cooler The device has cooling functionality.
 */
export const temperatureControlledCabinetCooler = DeviceTypeDefinition({
  name: 'MA-temperaturecontrolledcabinetcooler',
  code: 0x71,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [TemperatureControl.Cluster.id, RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id],
  optionalServerClusters: [TemperatureMeasurement.Cluster.id],
});

/**
 * A Temperature Controlled Cabinet only exists composed as part of another device type. It represents
 * a single cabinet that is capable of having its temperature controlled. Such a cabinet may be
 * chilling or freezing food, for example as part of a refrigerator, freezer, wine chiller, or other similar
 * device. Equally, such a cabinet may be warming or heating food, for example as part of an oven,
 * range, or similar device.
 * Conditions:
 * Heater The device has heating functionality.
 */
export const temperatureControlledCabinetHeater = DeviceTypeDefinition({
  name: 'MA-temperaturecontrolledcabinetheater',
  code: 0x71,
  deviceClass: DeviceClasses.Simple,
  revision: 3,
  requiredServerClusters: [TemperatureControl.Cluster.id, OvenMode.Cluster.id, OvenCavityOperationalState.Cluster.id],
  optionalServerClusters: [TemperatureMeasurement.Cluster.id],
});

/**
 * Cluster Restrictions:
 * On/Off Cluster: the DF (Dead Front) feature is required
 */
export const dishwasher = DeviceTypeDefinition({
  name: 'MA-dishwasher',
  code: 0x75,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [OperationalState.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id, OnOff.Cluster.id, TemperatureControl.Cluster.id, DishwasherMode.Cluster.id, DishwasherAlarm.Cluster.id],
});

/**
 * Cluster Restrictions:
 * On/Off Cluster: the DF (Dead Front) feature is required
 */
export const laundryDryer = DeviceTypeDefinition({
  name: 'MA-laundrydryer',
  code: 0x7c,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [OperationalState.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id, LaundryWasherMode.Cluster.id, OnOff.Cluster.id, LaundryDryerControls.Cluster.id, TemperatureControl.Cluster.id],
});

/**
 * A Cook Surface device type represents a heating object on a cooktop or other similar device. It
 * SHALL only be used when composed as part of another device type (cooktop).
 *
 * Cluster Restrictions:
 * The OffOnly feature is required for the On/Off cluster in this device type due to safety requirements.
 */
export const cookSurface = DeviceTypeDefinition({
  name: 'MA-cooksurface',
  code: 0x77,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [TemperatureControl.Cluster.id, TemperatureMeasurement.Cluster.id],
  optionalServerClusters: [OnOff.Cluster.id],
});

/**
 * A cooktop is a cooking surface that heats food either by transferring currents from an electromagnetic
 * field located below the glass surface directly to the magnetic induction cookware placed
 * above or through traditional gas or electric burners.
 *
 * Device Type Requirements:
 * A Cooktop SHALL be composed of zero or more endpoints with the Cook Surface device type as defined by the conformance below.
 *  0x0077 Cook Surface min 1 O
 *
 * Cluster Restrictions:
 * The OffOnly feature is required for the On/Off cluster in this device type due to safety requirements.
 */
export const cooktop = DeviceTypeDefinition({
  name: 'MA-cooktop',
  code: 0x78,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [OnOff.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id],
});

/**
 * An oven represents a device that contains one or more cabinets, and optionally a single cooktop, that are all capable of heating food.
 * An oven is always defined via endpoint composition.
 * Conditions:
 * An Oven SHALL have the Heater condition applied to at least one endpoint containing the Temperature Control Cluster.
 * Device Type Requirements:
 * 0x0071 Temperature Controlled Cabinet min 1
 * 0x0078 Cooktop
 */
export const oven = DeviceTypeDefinition({
  name: 'MA-oven',
  code: 0x7b,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id],
  optionalServerClusters: [],
});

/**
 * An Extractor Hood is a device that is generally installed above a cooking surface in residential kitchens.
 * Additional device types not listed in this table MAY also be included in device compositions.
 * Device Type Requirements:
 * 0x0100+ On/Off Light+ O
 *
 *
 * Element Requirements:
 * 0x0202 Fan Control Feature Rocking X
 * 0x0202 Fan Control Feature Wind X
 * 0x0202 Fan Control Feature AirflowDirection X
 */
export const extractorHood = DeviceTypeDefinition({
  name: 'MA-extractorhood',
  code: 0x7a,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [FanControl.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id, HepaFilterMonitoring.Cluster.id, ActivatedCarbonFilterMonitoring.Cluster.id],
});

/**
 * A Microwave Oven is a device with the primary function of heating foods and beverages using a magnetron.
 * A Microwave Oven is a device which at a minimum is capable of being started and stopped and of setting a power level.
 * A Microwave Oven MAY also support additional capabilities via endpoint composition.
 *
 */
export const microwaveOven = DeviceTypeDefinition({
  name: 'MA-microwaveoven',
  code: 0x79,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [OperationalState.Cluster.id, MicrowaveOvenMode.Cluster.id, MicrowaveOvenControl.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id, FanControl.Cluster.id],
});

// Chapter 14. Energy Device Types

/**
 * A water heater is a device that is generally installed in properties to heat water for showers, baths etc.
 * A Water Heater is always defined via endpoint composition.
 *
 * 14.2.5. Device Type Requirements
 * A Water Heater SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below. There MAY be more endpoints with other device types existing in the Water Heater.
 * ID     Name                        Constraint    Conformance
 * 0x0011 Power Source                              O
 * 0x0302 Temperature Sensor                        O
 * 0x0510 Electrical Sensor                         desc
 * 0x050D Device Energy Management                  O
 *
 * 14.2.7. Element Requirements
 * 0x0201 Thermostat Feature Heating M
 *
 * The Energy Management feature of the Water Heater cluster SHALL be supported if the Device
 * Energy Management device type is included.
 * If Off is a supported SystemMode in the Thermostat cluster, setting the SystemMode of the Thermostat
 * cluster to Off SHALL set the CurrentMode attribute of the Water Heater Mode cluster to a mode
 * having the Off mode tag value and vice versa.
 * At least one entry in the SupportedModes attribute of the Water Heater Mode cluster SHALL
 * include the Timed mode tag in the ModeTags field list.
 */
export const waterHeater = DeviceTypeDefinition({
  name: 'MA-waterheater',
  code: 0x050f,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Thermostat.Cluster.id, WaterHeaterManagement.Cluster.id, WaterHeaterMode.Cluster.id],
  optionalServerClusters: [Identify.Cluster.id],
});
