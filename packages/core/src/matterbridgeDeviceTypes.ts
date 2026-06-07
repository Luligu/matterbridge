/**
 * This file contains the matter device type definitions for MatterbridgeEndpoint.
 *
 * @file matterbridgeDeviceTypes.ts
 * @author Luca Liguori
 * @created 2024-11-08
 * @version 1.0.0
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

// istanbul ignore if -- Loader logs are not relevant for coverage
// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgeDeviceTypes loaded.\u001B[40;0m');

// @matter clusters
import { AccountLogin } from '@matter/types/clusters/account-login';
import { Actions } from '@matter/types/clusters/actions';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { AdministratorCommissioning } from '@matter/types/clusters/administrator-commissioning';
import { AirQuality } from '@matter/types/clusters/air-quality';
import { ApplicationLauncher } from '@matter/types/clusters/application-launcher';
import { AudioOutput } from '@matter/types/clusters/audio-output';
import { Binding } from '@matter/types/clusters/binding';
import { BooleanState } from '@matter/types/clusters/boolean-state';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { BridgedDeviceBasicInformation } from '@matter/types/clusters/bridged-device-basic-information';
import { CameraAvSettingsUserLevelManagement } from '@matter/types/clusters/camera-av-settings-user-level-management';
import { CameraAvStreamManagement } from '@matter/types/clusters/camera-av-stream-management';
import { CarbonDioxideConcentrationMeasurement } from '@matter/types/clusters/carbon-dioxide-concentration-measurement';
import { CarbonMonoxideConcentrationMeasurement } from '@matter/types/clusters/carbon-monoxide-concentration-measurement';
import { Channel } from '@matter/types/clusters/channel';
import { Chime } from '@matter/types/clusters/chime';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import { ColorControl } from '@matter/types/clusters/color-control';
import { CommissionerControl } from '@matter/types/clusters/commissioner-control';
import { CommodityMetering } from '@matter/types/clusters/commodity-metering';
import { CommodityPrice } from '@matter/types/clusters/commodity-price';
import { CommodityTariff } from '@matter/types/clusters/commodity-tariff';
import { ContentControl } from '@matter/types/clusters/content-control';
import { ContentLauncher } from '@matter/types/clusters/content-launcher';
import { Descriptor } from '@matter/types/clusters/descriptor';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { DishwasherAlarm } from '@matter/types/clusters/dishwasher-alarm';
import { DishwasherMode } from '@matter/types/clusters/dishwasher-mode';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { EcosystemInformation } from '@matter/types/clusters/ecosystem-information';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalGridConditions } from '@matter/types/clusters/electrical-grid-conditions';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { EnergyEvse } from '@matter/types/clusters/energy-evse';
import { EnergyEvseMode } from '@matter/types/clusters/energy-evse-mode';
import { EnergyPreference } from '@matter/types/clusters/energy-preference';
import { FanControl } from '@matter/types/clusters/fan-control';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { FormaldehydeConcentrationMeasurement } from '@matter/types/clusters/formaldehyde-concentration-measurement';
import { Groups } from '@matter/types/clusters/groups';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { Identify } from '@matter/types/clusters/identify';
import { IlluminanceMeasurement } from '@matter/types/clusters/illuminance-measurement';
import { KeypadInput } from '@matter/types/clusters/keypad-input';
import { LaundryDryerControls } from '@matter/types/clusters/laundry-dryer-controls';
import { LaundryWasherControls } from '@matter/types/clusters/laundry-washer-controls';
import { LaundryWasherMode } from '@matter/types/clusters/laundry-washer-mode';
import { LevelControl } from '@matter/types/clusters/level-control';
import { LowPower } from '@matter/types/clusters/low-power';
import { MediaInput } from '@matter/types/clusters/media-input';
import { MediaPlayback } from '@matter/types/clusters/media-playback';
import { Messages } from '@matter/types/clusters/messages';
import { MeterIdentification } from '@matter/types/clusters/meter-identification';
import { MicrowaveOvenControl } from '@matter/types/clusters/microwave-oven-control';
import { MicrowaveOvenMode } from '@matter/types/clusters/microwave-oven-mode';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { NitrogenDioxideConcentrationMeasurement } from '@matter/types/clusters/nitrogen-dioxide-concentration-measurement';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { OnOff } from '@matter/types/clusters/on-off';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { OtaSoftwareUpdateProvider } from '@matter/types/clusters/ota-software-update-provider';
import { OtaSoftwareUpdateRequestor } from '@matter/types/clusters/ota-software-update-requestor';
import { OvenCavityOperationalState } from '@matter/types/clusters/oven-cavity-operational-state';
import { OvenMode } from '@matter/types/clusters/oven-mode';
import { OzoneConcentrationMeasurement } from '@matter/types/clusters/ozone-concentration-measurement';
import { Pm1ConcentrationMeasurement } from '@matter/types/clusters/pm1-concentration-measurement';
import { Pm10ConcentrationMeasurement } from '@matter/types/clusters/pm10-concentration-measurement';
import { Pm25ConcentrationMeasurement } from '@matter/types/clusters/pm25-concentration-measurement';
import { PowerSource } from '@matter/types/clusters/power-source';
import { PowerTopology } from '@matter/types/clusters/power-topology';
import { PressureMeasurement } from '@matter/types/clusters/pressure-measurement';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { PushAvStreamTransport } from '@matter/types/clusters/push-av-stream-transport';
import { RadonConcentrationMeasurement } from '@matter/types/clusters/radon-concentration-measurement';
import { RefrigeratorAlarm } from '@matter/types/clusters/refrigerator-alarm';
import { RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/types/clusters/refrigerator-and-temperature-controlled-cabinet-mode';
import { RelativeHumidityMeasurement } from '@matter/types/clusters/relative-humidity-measurement';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { ScenesManagement } from '@matter/types/clusters/scenes-management';
import { ServiceArea } from '@matter/types/clusters/service-area';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { SoilMeasurement } from '@matter/types/clusters/soil-measurement';
import { Switch } from '@matter/types/clusters/switch';
import { TargetNavigator } from '@matter/types/clusters/target-navigator';
import { TemperatureControl } from '@matter/types/clusters/temperature-control';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { ThermostatUserInterfaceConfiguration } from '@matter/types/clusters/thermostat-user-interface-configuration';
import { TlsCertificateManagement } from '@matter/types/clusters/tls-certificate-management';
import { TlsClientManagement } from '@matter/types/clusters/tls-client-management';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/types/clusters/total-volatile-organic-compounds-concentration-measurement';
import { UserLabel } from '@matter/types/clusters/user-label';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { WakeOnLan } from '@matter/types/clusters/wake-on-lan';
import { WaterHeaterManagement } from '@matter/types/clusters/water-heater-management';
import { WaterHeaterMode } from '@matter/types/clusters/water-heater-mode';
import { WebRtcTransportProvider } from '@matter/types/clusters/web-rtc-transport-provider';
import { WebRtcTransportRequestor } from '@matter/types/clusters/web-rtc-transport-requestor';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { ZoneManagement } from '@matter/types/clusters/zone-management';
import { ClusterId, DeviceTypeId } from '@matter/types/datatype';

/*
import { ClosureControl } from './clusters/closure-control.js';
import { ClosureDimension } from './clusters/closure-dimension.js';
import { SoilMeasurement } from './clusters/soil-measurement.js';
*/

export enum DeviceClasses {
  /** 1.1.5. Device Type Class Conditions */

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

  /** The device type is composed of 2 or more device types. */
  Composed = 'Composed',

  /** 1.1.6. Endpoint Type Class Conditions */

  /** There exists a client application cluster on the endpoint. */
  Client = 'Client',

  /** There exists a server application cluster on the endpoint. */
  Server = 'Server',

  /**
   * The endpoint and at least one of its sibling endpoints have an overlap in application device type(s),
   * as defined in the "Disambiguation" section in the System Model specification. This condition triggers
   * requirements for providing additional information about the endpoints in order to disambiguate
   * between the endpoints (see "Disambiguation" section in the System Model specification).
   */
  Duplicate = 'Duplicate',

  /**
   * The endpoint represents a Bridged Device, for which information about the state of
   * its power source is available to the Bridge
   */
  BridgedPowerSourceInfo = 'BridgedPowerSourceInfo',
}

export enum DeviceScopes {
  /** Endpoint scope — the device type applies to an endpoint. */
  Endpoint = 'endpoint',

  /** Node scope — the device type applies to a node. */
  Node = 'node',
}

export interface DeviceTypeDefinition {
  name: string;
  deviceName: string;
  code: DeviceTypeId;
  deviceClass: DeviceClasses;
  deviceScope: DeviceScopes;
  revision: number;
  requiredServerClusters: ClusterId[];
  optionalServerClusters: ClusterId[];
  requiredClientClusters: ClusterId[];
  optionalClientClusters: ClusterId[];
}

export const DeviceTypeDefinition = ({
  name,
  deviceName,
  code,
  deviceClass,
  deviceScope,
  revision,
  requiredServerClusters = [],
  optionalServerClusters = [],
  requiredClientClusters = [],
  optionalClientClusters = [],
}: {
  name: string;
  deviceName: string;
  code: number;
  deviceClass: DeviceClasses;
  deviceScope: DeviceScopes;
  revision: number;
  requiredServerClusters?: ClusterId[];
  optionalServerClusters?: ClusterId[];
  requiredClientClusters?: ClusterId[];
  optionalClientClusters?: ClusterId[];
}): DeviceTypeDefinition => ({
  name,
  deviceName,
  code: DeviceTypeId(code),
  deviceClass,
  deviceScope,
  revision,
  requiredServerClusters,
  optionalServerClusters,
  requiredClientClusters,
  optionalClientClusters,
});

/** Chapter 1. Base Device Types */

export const baseDevice = DeviceTypeDefinition({
  name: 'MA-baseDevice',
  deviceName: 'Base Device Type',
  code: 0x0000,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Descriptor.id],
  optionalServerClusters: [Binding.id, FixedLabel.id, UserLabel.id],
});

/** Chapter 2. Utility Device Types  */

export const rootNode = DeviceTypeDefinition({
  name: 'MA-rootNode',
  deviceName: 'Root Node',
  code: 0x0016,
  deviceClass: DeviceClasses.Node,
  deviceScope: DeviceScopes.Node,
  revision: 4,
  requiredServerClusters: [], // Intentionally left empty to avoid imports
  optionalServerClusters: [], // Intentionally left empty to avoid imports
});

export const powerSource = DeviceTypeDefinition({
  name: 'MA-powerSource',
  deviceName: 'Power Source',
  code: 0x0011,
  deviceClass: DeviceClasses.Utility,
  deviceScope: DeviceScopes.Node,
  revision: 1,
  requiredServerClusters: [PowerSource.id],
  optionalServerClusters: [],
});

export const OTARequestor = DeviceTypeDefinition({
  name: 'MA-OTARequestor',
  deviceName: 'OTA Requestor',
  code: 0x0012,
  deviceClass: DeviceClasses.Utility,
  deviceScope: DeviceScopes.Node,
  revision: 1,
  requiredServerClusters: [OtaSoftwareUpdateRequestor.id],
  optionalServerClusters: [],
  requiredClientClusters: [OtaSoftwareUpdateProvider.id],
  optionalClientClusters: [],
});

export const OTAProvider = DeviceTypeDefinition({
  name: 'MA-OTAProvider',
  deviceName: 'OTA Provider',
  code: 0x0014,
  deviceClass: DeviceClasses.Utility,
  deviceScope: DeviceScopes.Node,
  revision: 1,
  requiredServerClusters: [OtaSoftwareUpdateProvider.id],
  optionalServerClusters: [],
  requiredClientClusters: [],
  optionalClientClusters: [OtaSoftwareUpdateRequestor.id],
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
  ◦ One Endpoint: Both the Bridged Node and one or more application device types are supported
    on the same endpoint (following application device type rules). Endpoint composition
    SHALL conform to the application device type(s) definition.
 */
export const bridgedNode = DeviceTypeDefinition({
  name: 'MA-bridgedNode',
  deviceName: 'Bridged Node',
  code: 0x0013,
  deviceClass: DeviceClasses.Utility,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [BridgedDeviceBasicInformation.id], // omitted PowerSourceConfiguration cause is deprecated
  optionalServerClusters: [PowerSource.id, EcosystemInformation.id, AdministratorCommissioning.id],
});

/**
 * An Electrical Sensor device measures the electrical power and/or energy being imported and/or
 * exported.
 * It is a utility device type that provides information about the electrical power and/or energy
 * consumption and generation.
 *
 *  2.6.3. Device Type Requirements
 *  Electrical measurements made by either the Electrical Power Measurement cluster, the Electrical
 *  Energy Measurement cluster, or both SHALL apply to the endpoints indicated by the Power Topology
 *  cluster.
 */
export const electricalSensor = DeviceTypeDefinition({
  name: 'MA-electricalSensor',
  deviceName: 'Electrical Sensor',
  code: 0x0510,
  deviceClass: DeviceClasses.Utility,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [PowerTopology.id],
  optionalServerClusters: [ElectricalPowerMeasurement.id, ElectricalEnergyMeasurement.id],
});

/**
 * A Device Energy Management device provides reporting and optionally adjustment of the electrical
 * power planned on being consumed or produced by the device.
 *
 * Element Requirements:
 * - Device Energy Management Feature PowerAdjustment [ControllableESA].a+
 * - Device Energy Management Feature StartTimeAdjustment [ControllableESA].a+
 * - Device Energy Management Feature Pausable [ControllableESA].a+
 * - Device Energy Management Feature ForecastAdjustment [ControllableESA].a+
 * - Device Energy Management Feature ConstraintBasedAdjustment [ControllableESA].a+
 */
export const deviceEnergyManagement = DeviceTypeDefinition({
  name: 'MA-deviceEnergyManagement',
  deviceName: 'Device Energy Management',
  code: 0x050d,
  deviceClass: DeviceClasses.Utility,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [DeviceEnergyManagement.id],
  optionalServerClusters: [DeviceEnergyManagementMode.id],
  requiredClientClusters: [],
  optionalClientClusters: [ElectricalGridConditions.id],
});

/** Chapter 3. Application Device Types */

/** Chapter 4. Lighting Device Types */

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
  deviceName: 'OnOff Light',
  code: 0x0100,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id],
  optionalServerClusters: [LevelControl.id],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
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
  deviceName: 'Dimmable Light',
  code: 0x0101,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id, LevelControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
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
  deviceName: 'Color Temperature Light',
  code: 0x010c,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id, LevelControl.id, ColorControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
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
  deviceName: 'Extended Color Light',
  code: 0x010d,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id, LevelControl.id, ColorControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
});

/** Chapter 5. Smart plugs/Outlets and other Actuators */

/**
 * An On/Off Plug-in Unit is a device that provides power to another device that is plugged into it, and
 * is capable of switching that provided power on or off.
 * The Mounted On/Off Control (added in Matter 1.4) has identical cluster requirements as the On/Off
 * Plug-In Unit, and is marked as superset of this device type (since Matter 1.4.2). For devices intended
 * to be mounted permanently, the Mounted On/Off Control device type SHALL be used, with the
 * On/Off Plug-In Unit device type optionally added in the DeviceTypeList of the Descriptor cluster in
 * addition to the On/Off Plug-In Unit device type (see [ref_MountedOnOffControlServerGuidance]).
 *
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
  deviceName: 'OnOff Plugin Unit',
  code: 0x010a,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id],
  optionalServerClusters: [LevelControl.id],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
});

/**
 * A Dimmable Plug-In Unit is a device that provides power to another device that is plugged into it,
 * and is capable of being switched on or off and have its level adjusted. The Dimmable Plug-in Unit is
 * typically used to control a conventional non-communicating light through its mains connection
 * using phase cutting.
 * The Mounted Dimmable Load Control (added in Matter 1.4) has identical cluster requirements as
 * the Dimmable Plug-In Unit, and is marked as a superset of this device type (since Matter 1.4.2). For
 * devices intended to be mounted permanently, the Mounted Dimmable Load Control device type
 * SHALL be used, with the Dimmable Plug-In Unit device type optionally added to the DeviceTypeList
 * of the Descriptor cluster in addition to the Mounted Dimmable Load Control device type (see [ref_MountedDimmableLoadControlServerGuidance]).
 *
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
  deviceName: 'Dimmable PlugIn Unit',
  code: 0x010b,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 5,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id, LevelControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
});

/**
 * A Mounted On/Off Control is a fixed device that provides power to another device that is plugged
 * into it, and is capable of switching that provided power on or off.
 * This device type is intended for any wall-mounted or hardwired load controller, while On/Off Plugin
 * Unit is intended only for smart plugs and other power switching devices that are not permaMatter
 * Device Library Specification R1.4.2 Connectivity Standards Alliance Document 23-27351 July 16, 2025
 * Copyright © Connectivity Standards Alliance, Inc. All rights reserved. Page 53
 * nently connected, and which can be unplugged from their power source.
 *
 * It is a simple device type that does not require any client clusters. As per matter 1.4.2 it should be added also on/Off Plug-In Unit for backward compatibility.
 *
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
  deviceName: 'Mounted OnOff Control',
  code: 0x010f,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id],
  optionalServerClusters: [LevelControl.id],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
});

/**
 * A Mounted Dimmable Load Control is a fixed device that provides power to a load connected to it,
 * and is capable of being switched on or off and have its level adjusted. The Mounted Dimmable Load
 * Control is typically used to control a conventional non-communicating light through its mains connection
 * using phase cutting.
 * This device type is intended for any wall-mounted or hardwired dimmer-capable load controller,
 * while Dimmable Plug-In Unit is intended only for dimmer-capable smart plugs that are not permanently
 * connected, and which can be unplugged from their power source.
 *
 * It is a simple device type that does not require any client clusters. As per matter 1.4.2 it should be added also dimmable Plug-In Unit for backward compatibility.
 *
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
  deviceName: 'Mounted Dimmable Load Control',
  code: 0x0110,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [Identify.id, Groups.id, ScenesManagement.id, OnOff.id, LevelControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [],
  optionalClientClusters: [OccupancySensing.id],
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
  deviceName: 'Pump',
  code: 0x303,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [OnOff.id, PumpConfigurationAndControl.id, Identify.id],
  optionalServerClusters: [LevelControl.id, Groups.id, ScenesManagement.id, TemperatureMeasurement.id, PressureMeasurement.id, FlowMeasurement.id],
  requiredClientClusters: [],
  optionalClientClusters: [TemperatureMeasurement.id, PressureMeasurement.id, FlowMeasurement.id, OccupancySensing.id],
});

export const waterValve = DeviceTypeDefinition({
  name: 'MA-waterValve',
  deviceName: 'Water Valve',
  code: 0x42,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, ValveConfigurationAndControl.id],
  optionalServerClusters: [FlowMeasurement.id],
  requiredClientClusters: [],
  optionalClientClusters: [FlowMeasurement.id],
});

/**
 * 5.7. Irrigation System Device Type
 *
 * An irrigation system is always defined via endpoint composition. Irrigation system manufacturers
 * determine how many watering "zone" terminals are present on the physical device. Each zone is
 * represented by a disambiguated Water Valve endpoint.
 *
 * 5.7.5. Device Type Requirements
 * An irrigation system SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below. There MAY be more endpoints with additional instances of these device types or
 * additional device types existing in the irrigation system.
 *
 * - ID     Name                        Constraint    Conformance
 * - 0x0042 Water Valve                 min 1         M
 */
export const irrigationSystem = DeviceTypeDefinition({
  name: 'MA-irrigationSystem',
  deviceName: 'Irrigation System',
  code: 0x0040,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [],
  optionalServerClusters: [Identify.id, OperationalState.id, FlowMeasurement.id],
  requiredClientClusters: [],
  optionalClientClusters: [FlowMeasurement.id],
});

/** Chapter 6. Switches and Controls Device Types */

// Custom device types with server cluster instead of client clusters (not working in Alexa)
export const onOffSwitch = DeviceTypeDefinition({
  name: 'MA-onoffswitch',
  deviceName: 'OnOff Light Switch',
  code: 0x0103,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, OnOff.id],
  optionalServerClusters: [],
  requiredClientClusters: [Identify.id, OnOff.id],
  optionalClientClusters: [Groups.id, ScenesManagement.id],
});

// Custom device types with server cluster instead of client clusters (not working in Alexa)
export const dimmableSwitch = DeviceTypeDefinition({
  name: 'MA-dimmableswitch',
  deviceName: 'Dimmer Switch',
  code: 0x0104,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, OnOff.id, LevelControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [Identify.id, OnOff.id, LevelControl.id],
  optionalClientClusters: [Groups.id, ScenesManagement.id],
});

// Custom device types with server cluster instead of client clusters (not working in Alexa)
export const colorTemperatureSwitch = DeviceTypeDefinition({
  name: 'MA-colortemperatureswitch',
  deviceName: 'Color Dimmer Switch',
  code: 0x0105,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, OnOff.id, LevelControl.id, ColorControl.id],
  optionalServerClusters: [],
  requiredClientClusters: [Identify.id, OnOff.id, LevelControl.id, ColorControl.id],
  optionalClientClusters: [Groups.id, ScenesManagement.id],
});

export const genericSwitch = DeviceTypeDefinition({
  name: 'MA-genericswitch',
  deviceName: 'Generic Switch',
  code: 0x000f,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, Switch.id],
  optionalServerClusters: [],
});

// Chapter 7. Sensor Device Types

/**
 * Closed or contact: state true
 * Open or no contact: state false
 */
export const contactSensor = DeviceTypeDefinition({
  name: 'MA-contactsensor',
  deviceName: 'Contact Sensor',
  code: 0x0015,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [Identify.id, BooleanState.id],
  optionalServerClusters: [BooleanStateConfiguration.id],
});

export const lightSensor = DeviceTypeDefinition({
  name: 'MA-lightsensor',
  deviceName: 'Light Sensor',
  code: 0x0106,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, IlluminanceMeasurement.id],
});

export const occupancySensor = DeviceTypeDefinition({
  name: 'MA-occupancysensor',
  deviceName: 'Occupancy Sensor',
  code: 0x0107,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, OccupancySensing.id],
  optionalServerClusters: [BooleanStateConfiguration.id],
});

/**
 * Element Requirements:
 * - Thermostat User Interface Configuration Attribute KeypadLockout O
 */
export const temperatureSensor = DeviceTypeDefinition({
  name: 'MA-tempsensor',
  deviceName: 'Temperature Sensor',
  code: 0x0302,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, TemperatureMeasurement.id],
  optionalServerClusters: [ThermostatUserInterfaceConfiguration.id],
});

export const pressureSensor = DeviceTypeDefinition({
  name: 'MA-pressuresensor',
  deviceName: 'Pressure Sensor',
  code: 0x0305,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, PressureMeasurement.id],
});

export const flowSensor = DeviceTypeDefinition({
  name: 'MA-flowsensor',
  deviceName: 'Flow Sensor',
  code: 0x0306,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, FlowMeasurement.id],
});

export const humiditySensor = DeviceTypeDefinition({
  name: 'MA-humiditysensor',
  deviceName: 'Humidity Sensor',
  code: 0x0307,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, RelativeHumidityMeasurement.id],
});

/**
 * Device Type Requirements:
 * - 0x0011 Power Source min 1 M
 */
export const smokeCoAlarm = DeviceTypeDefinition({
  name: 'MA-smokeCoAlarm',
  deviceName: 'Smoke CO Alarm',
  code: 0x0076,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, SmokeCoAlarm.id],
  optionalServerClusters: [Groups.id, TemperatureMeasurement.id, RelativeHumidityMeasurement.id, CarbonMonoxideConcentrationMeasurement.id],
});

export const airQualitySensor = DeviceTypeDefinition({
  name: 'MA-airQualitySensor',
  deviceName: 'Air Quality Sensor',
  code: 0x002c,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, AirQuality.id],
  optionalServerClusters: [
    TemperatureMeasurement.id,
    RelativeHumidityMeasurement.id,
    CarbonMonoxideConcentrationMeasurement.id,
    CarbonDioxideConcentrationMeasurement.id,
    NitrogenDioxideConcentrationMeasurement.id,
    OzoneConcentrationMeasurement.id,
    FormaldehydeConcentrationMeasurement.id,
    Pm1ConcentrationMeasurement.id,
    Pm25ConcentrationMeasurement.id,
    Pm10ConcentrationMeasurement.id,
    RadonConcentrationMeasurement.id,
    TotalVolatileOrganicCompoundsConcentrationMeasurement.id,
  ],
});

/**
 * Element Requirements:
 * - Boolean State Event StateChange M
 */
export const waterFreezeDetector = DeviceTypeDefinition({
  name: 'MA-waterFreezeDetector',
  deviceName: 'Water Freeze Detector',
  code: 0x0041,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, BooleanState.id],
  optionalServerClusters: [BooleanStateConfiguration.id],
});

/**
 * Element Requirements:
 * - Boolean State Event StateChange M
 */
export const waterLeakDetector = DeviceTypeDefinition({
  name: 'MA-waterLeakDetector',
  deviceName: 'Water Leak Detector',
  code: 0x0043,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, BooleanState.id],
  optionalServerClusters: [BooleanStateConfiguration.id],
});

/**
 * Element Requirements:
 * - Boolean State Event StateChange M
 */
export const rainSensor = DeviceTypeDefinition({
  name: 'MA-rainSensor',
  deviceName: 'Rain Sensor',
  code: 0x0044,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, BooleanState.id],
  optionalServerClusters: [BooleanStateConfiguration.id],
});

/**
 * 7.14. Soil Sensor Device Type
 *
 * A Soil Sensor device reports measurements of soil values, such as moisture and (optionally) temperature.
 */
export const soilSensor = DeviceTypeDefinition({
  name: 'MA-soilSensor',
  deviceName: 'Soil Sensor',
  code: 0x0045,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, SoilMeasurement.id],
  optionalServerClusters: [TemperatureMeasurement.id],
});

/** Chapter 8. Entry Control Device Types */

/**
 * A Door Lock is a device used to secure a door. It is possible to actuate a door lock either by means of a manual or a remote method.
 *
 * Element Requirements:
 *
 * - AccessControl Attribute Extension
 * - DoorLock Feature User
 * - DoorLock Attribute AlarmMask
 */
export const doorLockDevice = DeviceTypeDefinition({
  name: 'MA-doorLock',
  deviceName: 'Door Lock',
  code: 0xa,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, DoorLock.id],
  optionalServerClusters: [],
});

export const coverDevice = DeviceTypeDefinition({
  name: 'MA-windowCovering',
  deviceName: 'Window Covering',
  code: 0x202,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 6,
  requiredServerClusters: [Identify.id, WindowCovering.id],
  optionalServerClusters: [Groups.id],
});

/**
 * 8.5. Closure Device Type
 *
 * A Closure device provides actuator control over an endpoint.
 *
 * Device Type Requirements:
 * - 0x000A Door Lock O
 * - 0x0100+ On/Off Light+ O
 * - 0x0231 Closure Panel O
 *
 * Element Requirements:
 * - Descriptor Feature TagList M
 *   (exactly one tag from Closure namespace 0x44; no tag from ClosurePanel namespace 0x45)
 */
export const closure = DeviceTypeDefinition({
  name: 'MA-closure',
  deviceName: 'Closure',
  code: 0x0230,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id, ClosureControl.id],
  optionalServerClusters: [],
});

/**
 * 8.6. Closure Panel Device Type
 *
 * A Closure Panel device provides dimension information for an endpoint.
 *
 * Element Requirements:
 * - Descriptor Feature TagList M
 *   (exactly one tag from ClosurePanel namespace 0x45; no tag from Closure namespace 0x44)
 */
export const closurePanel = DeviceTypeDefinition({
  name: 'MA-closurePanel',
  deviceName: 'Closure Panel',
  code: 0x0231,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [ClosureDimension.id],
  optionalServerClusters: [],
});

/**
 * 8.7. Closure Controller Device Type
 *
 * A Closure Controller is capable of controlling a Closure.
 *
 * 8.7.5. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                Direction    Conformance
 * - 0x0003 Identify            client       O
 * - 0x0004 Groups              client       O
 * - 0x0104 Closure Control     client       M
 * - 0x0105 Closure Dimension   client       O
 */
export const closureController = DeviceTypeDefinition({
  name: 'MA-closureController',
  deviceName: 'Closure Controller',
  code: 0x023e,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [],
  optionalServerClusters: [],
  requiredClientClusters: [ClosureControl.id],
  optionalClientClusters: [Identify.id, Groups.id, ClosureDimension.id],
});

/** Chapter 9. HVAC Device Types */

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
  deviceName: 'Thermostat',
  code: 0x301,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 5,
  requiredServerClusters: [Identify.id, Thermostat.id],
  optionalServerClusters: [Groups.id, ThermostatUserInterfaceConfiguration.id, EnergyPreference.id],
  requiredClientClusters: [],
  optionalClientClusters: [FanControl.id, TemperatureMeasurement.id, RelativeHumidityMeasurement.id, OccupancySensing.id],
});

/**
 * A Fan device is typically standalone or mounted on a ceiling or wall and is used to circulate air in a room.
 *
 * Device Type Requirements:
 * - 0x0301 Thermostat O
 *
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
  deviceName: 'Fan',
  code: 0x2b,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, Groups.id, FanControl.id],
  optionalServerClusters: [OnOff.id],
});

/**
 * An Air Purifier is a standalone device that is designed to clean the air in a room.
 * It is a device that has a fan to control the air speed while it is operating. Optionally, it can report on
 * the condition of its filters.
 *
 * Device Type Requirements:
 * - 0x002C Air Quality Sensor O
 * - 0x0301 Thermostat O
 * - 0x0302 Temperature Sensor O
 * - 0x0307 Humidity Sensor O
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
  deviceName: 'Air Purifier',
  code: 0x2d,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [Identify.id, FanControl.id],
  optionalServerClusters: [Groups.id, OnOff.id, HepaFilterMonitoring.id, ActivatedCarbonFilterMonitoring.id],
});

/** Chapter 10. Media Device Types */

/**
 * 10.2. A Basic Video Player has playback controls (play, pause, etc.) and keypad remote controls (up, down, number input),
 * but is not able to launch arbitrary content applications. It is a commissionable node.
 *
 * Required server clusters (minimum features per spec):
 * - Media Playback (media playback controls)
 * - Keypad Input (remote key events)
 * - On/Off (basic power control)
 *
 * Optional server clusters (additional capabilities commonly implemented):
 * - Audio Output (speaker selection / volume endpoints)
 * - Channel (linear channel navigation)
 * - Target Navigator (high level app / target navigation)
 * - Media Input (input source selection)
 * - Low Power (power saving / wake logic)
 * - Wake On LAN (remote wake capabilities)
 * - Messages (device messaging / notifications)
 * - Content Control (parental or content access control)
 */
export const basicVideoPlayer = DeviceTypeDefinition({
  name: 'MA-basicVideoPlayer',
  deviceName: 'Basic Video Player',
  code: 0x0028,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [OnOff.id, MediaPlayback.id, KeypadInput.id],
  optionalServerClusters: [WakeOnLan.id, Channel.id, TargetNavigator.id, MediaInput.id, LowPower.id, AudioOutput.id, ContentControl.id, Messages.id],
});

/**
 * 10.3. A Casting Video Player supports Basic Video Player features and content launching features.
 * It is a Commissioner and can launch Content Apps (Content Launcher cluster) and optionally expose
 * an Application Launcher cluster when acting as a Content App Platform.
 *
 * Required server clusters (minimum features per spec):
 * - Media Playback (playback controls)
 * - Keypad Input (remote key events)
 * - Content Launcher (content launching capability)
 * - On/Off (basic power control)
 *
 * Optional server clusters (additional capabilities):
 * - Application Launcher (hosting content apps)
 * - Account Login (account / session association)
 * - Audio Output (output / volume endpoints)
 * - Channel (linear channel navigation)
 * - Target Navigator (high level target navigation)
 * - Media Input (input source selection)
 * - Low Power (power saving / wake logic)
 * - Wake On LAN (remote wake capabilities)
 * - Messages (device messaging / notifications)
 * - Content Control (parental or content access control)
 *
 * Element Requirements:
 * - Application Launcher Feature ApplicationPlatform M
 */
export const castingVideoPlayer = DeviceTypeDefinition({
  name: 'MA-castingVideoPlayer',
  deviceName: 'Casting Video Player',
  code: 0x0023,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [OnOff.id, MediaPlayback.id, KeypadInput.id, ContentLauncher.id],
  optionalServerClusters: [
    WakeOnLan.id,
    Channel.id,
    TargetNavigator.id,
    MediaInput.id,
    LowPower.id,
    AudioOutput.id,
    ApplicationLauncher.id,
    AccountLogin.id,
    ContentControl.id,
    Messages.id,
  ],
});

/**
 * 10.4. A Speaker device type controls the speaker.
 * unmute/mute, the On/Off cluster SHALL be used. A value of TRUE for the OnOff attribute
 * SHALL represent the volume on (not muted) state, while a value of FALSE SHALL represent the volume
 * off (muted) state. For volume level control, the Level cluster SHALL be used.
 */
export const speakerDevice = DeviceTypeDefinition({
  name: 'MA-speaker',
  deviceName: 'Speaker',
  code: 0x0022,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [OnOff.id, LevelControl.id],
  optionalServerClusters: [],
});

/** Chapter 11. Generic Device Types */

export const modeSelect = DeviceTypeDefinition({
  name: 'MA-modeselect',
  deviceName: 'Mode Select',
  code: 0x27,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [ModeSelect.id],
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
  deviceName: 'Aggregator',
  code: 0x000e,
  deviceClass: DeviceClasses.Dynamic,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [],
  optionalServerClusters: [Actions.id, Identify.id, CommissionerControl.id],
});

export const bridge = aggregator;

/** Chapter 12. Robotic Device Types */

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
 * Element Requirements:
 * - RVC Operational State Event OperationCompletion M
 *
 */
export const roboticVacuumCleaner = DeviceTypeDefinition({
  name: 'MA-roboticvacuumcleaner',
  deviceName: 'Robotic Vacuum Cleaner',
  code: 0x74, // 116
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 4,
  requiredServerClusters: [Identify.id, RvcRunMode.id, RvcOperationalState.id],
  optionalServerClusters: [RvcCleanMode.id, ServiceArea.id],
});

/** Chapter 13. Appliances Device Types */

/**
 * Cluster Restrictions:
 * On/Off Cluster: the DF (Dead Front) feature is required
 * Operational State Event OperationCompletion
 *
 * Element Requirements:
 * - On/Off Feature DeadFrontBehavior M
 * - Laundry Washer Mode Feature OnOff X
 * - Laundry Washer Mode Attribute StartUpMode X
 * - Operational State Event OperationCompletion M
 */
export const laundryWasher = DeviceTypeDefinition({
  name: 'MA-laundrywasher',
  deviceName: 'Laundry Washer',
  code: 0x73, // 115
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [OperationalState.id],
  optionalServerClusters: [Identify.id, LaundryWasherMode.id, OnOff.id, LaundryWasherControls.id, TemperatureControl.id],
});

/**
 * A refrigerator represents a device that contains one or more cabinets that are capable of chilling or freezing food.
 * A Refrigerator SHALL be composed of at least one endpoint with the Temperature Controlled Cabinet device type.
 * A Refrigerator SHALL have the Cooler condition applied to at least one endpoint containing the Temperature Control Cluster.
 *
 * Device Type Requirements:
 * 0x0071 Temperature Controlled Cabinet with Cooler condition
 *
 * Element Requirements:
 * - Refrigerator And Temperature Controlled Cabinet Mode Feature OnOff X
 * - Refrigerator And Temperature Controlled Cabinet Mode Attribute StartUpMode X
 */
export const refrigerator = DeviceTypeDefinition({
  name: 'MA-refrigerator',
  deviceName: 'Refrigerator',
  code: 0x70, // 112
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [],
  optionalServerClusters: [Identify.id, RefrigeratorAndTemperatureControlledCabinetMode.id, RefrigeratorAlarm.id],
});

/**
 * A Room Air Conditioner is a device with the primary function of controlling the air temperature in a single room.
 *
 * Device Type Requirements:
 * - 0x0302 Temperature Sensor O
 * - 0x0307 Humidity Sensor O
 *
 * Element Requirements:
 * - On/Off Feature DeadFrontBehavior M
 * - Thermostat User Interface Configuration Attribute KeypadLockout O
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
  deviceName: 'Room Air Conditioner',
  code: 0x72, // 114
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 3,
  requiredServerClusters: [Identify.id, OnOff.id, Thermostat.id],
  optionalServerClusters: [
    Groups.id,
    ScenesManagement.id,
    FanControl.id,
    ThermostatUserInterfaceConfiguration.id,
    TemperatureMeasurement.id,
    RelativeHumidityMeasurement.id,
    HepaFilterMonitoring.id,
    ActivatedCarbonFilterMonitoring.id,
  ],
});

/**
 * A Temperature Controlled Cabinet only exists composed as part of another device type. It represents
 * a single cabinet that is capable of having its temperature controlled. Such a cabinet may be
 * chilling or freezing food, for example as part of a refrigerator, freezer, wine chiller, or other similar
 * device. Equally, such a cabinet may be warming or heating food, for example as part of an oven,
 * range, or similar device.
 *
 * Conditions:
 * Cooler The device has cooling functionality.
 *
 * Cluster Restrictions:
 * TemperatureNumber is the only valid temperature control mode
 *
 * Element Requirements:
 * - Refrigerator And Temperature Controlled Cabinet Mode Attribute StartUpMode X
 * - Refrigerator And Temperature Controlled Cabinet Mode Feature OnOff X
 * - Oven Mode Attribute StartUpMode X
 * - Oven Mode Feature OnOff X
 * - Oven Cavity Operational State Command Pause X
 * - Oven Cavity Operational State Command Resume X
 * - Oven Cavity Operational State Event OperationCompletion M
 * - Temperature Control Feature TemperatureNumber M
 * - Temperature Control Feature TemperatureLevel X
 */
export const temperatureControlledCabinetCooler = DeviceTypeDefinition({
  name: 'MA-temperaturecontrolledcabinetcooler',
  deviceName: 'Temperature Controlled Cabinet',
  code: 0x71, // 113
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 5,
  requiredServerClusters: [TemperatureControl.id, RefrigeratorAndTemperatureControlledCabinetMode.id],
  optionalServerClusters: [TemperatureMeasurement.id],
});

/**
 * A Temperature Controlled Cabinet only exists composed as part of another device type. It represents
 * a single cabinet that is capable of having its temperature controlled. Such a cabinet may be
 * chilling or freezing food, for example as part of a refrigerator, freezer, wine chiller, or other similar
 * device. Equally, such a cabinet may be warming or heating food, for example as part of an oven,
 * range, or similar device.
 *
 * Conditions:
 * Heater The device has heating functionality.
 *
 * Cluster Restrictions:
 * TemperatureNumber is the only valid temperature control mode
 * OperationCompletion event for Oven Cavity Operational State cluster
 *
 * Element Requirements:
 * - Refrigerator And Temperature Controlled Cabinet Mode Attribute StartUpMode X
 * - Refrigerator And Temperature Controlled Cabinet Mode Feature OnOff X
 * - Oven Mode Attribute StartUpMode X
 * - Oven Mode Feature OnOff X
 * - Oven Cavity Operational State Command Pause X
 * - Oven Cavity Operational State Command Resume X
 * - Oven Cavity Operational State Event OperationCompletion M
 * - Temperature Control Feature TemperatureNumber M
 * - Temperature Control Feature TemperatureLevel X
 */
export const temperatureControlledCabinetHeater = DeviceTypeDefinition({
  name: 'MA-temperaturecontrolledcabinetheater',
  deviceName: 'Temperature Controlled Cabinet',
  code: 0x71, // 113
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 5,
  requiredServerClusters: [TemperatureControl.id, OvenMode.id, OvenCavityOperationalState.id],
  optionalServerClusters: [TemperatureMeasurement.id],
});

/**
 * Cluster Restrictions:
 * On/Off Cluster: the DF (Dead Front) feature is required
 * Operational State Event OperationCompletion
 *
 * Element Requirements:
 * - On/Off Feature DeadFrontBehavior M
 * - Dishwasher Mode Attribute StartUpMode X
 * - Dishwasher Mode Feature OnOff X
 * - Operational State Event OperationCompletion M
 */
export const dishwasher = DeviceTypeDefinition({
  name: 'MA-dishwasher',
  deviceName: 'Dishwasher',
  code: 0x75, // 117
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [OperationalState.id],
  optionalServerClusters: [Identify.id, OnOff.id, TemperatureControl.id, DishwasherMode.id, DishwasherAlarm.id],
});

/**
 * Cluster Restrictions:
 * On/Off Cluster: the DF (Dead Front) feature is required
 * Operational State Event OperationCompletion
 *
 * Element Requirements:
 * - On/Off Feature DeadFrontBehavior M
 * - Laundry Washer Mode Feature OnOff X
 * - Laundry Washer Mode Attribute StartUpMode X
 * - Operational State Event OperationCompletion M
 */
export const laundryDryer = DeviceTypeDefinition({
  name: 'MA-laundrydryer',
  deviceName: 'Laundry Dryer',
  code: 0x7c, // 124
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [OperationalState.id],
  optionalServerClusters: [Identify.id, LaundryWasherMode.id, OnOff.id, LaundryDryerControls.id, TemperatureControl.id],
});

/**
 * A Cook Surface device type represents a heating object on a cooktop or other similar device. It
 * SHALL only be used when composed as part of another device type (cooktop).
 *
 * Cluster Restrictions:
 * The OffOnly feature is required for the On/Off cluster in this device type due to safety requirements. OnOff Cluster is optional.
 * The TemperatureLevel feature is the only valid temperature control feature.
 *
 * Element Requirements:
 * - On/Off Feature OffOnly M
 * - Temperature Control Feature TemperatureLevel M
 * - Temperature Control Feature TemperatureNumber X
 */
export const cookSurface = DeviceTypeDefinition({
  name: 'MA-cooksurface',
  deviceName: 'Cook Surface',
  code: 0x77, // 119
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [],
  optionalServerClusters: [TemperatureControl.id, TemperatureMeasurement.id, OnOff.id],
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
 *
 * Element Requirements:
 * - On/Off Feature OffOnly M
 */
export const cooktop = DeviceTypeDefinition({
  name: 'MA-cooktop',
  deviceName: 'Cooktop',
  code: 0x78, // 120
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [OnOff.id],
  optionalServerClusters: [Identify.id],
});

/**
 * An oven represents a device that contains one or more cabinets, and optionally a single cooktop, that are all capable of heating food.
 * An oven is always defined via endpoint composition.
 * Conditions:
 * An Oven SHALL have the Heater condition applied to at least one endpoint containing the Temperature Control Cluster.
 * Device Type Requirements:
 * - 0x0071 Temperature Controlled Cabinet min 1
 * - 0x0078 Cooktop max 1 Optional
 */
export const oven = DeviceTypeDefinition({
  name: 'MA-oven',
  deviceName: 'Oven',
  code: 0x7b, // 123
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [],
  optionalServerClusters: [Identify.id],
});

/**
 * An Extractor Hood is a device that is generally installed above a cooking surface in residential kitchens.
 * Additional device types not listed in this table MAY also be included in device compositions.
 * Device Type Requirements:
 * 0x0100+ On/Off Light+ O
 *
 *
 * Element Requirements:
 * - 0x0202 Fan Control Feature Rocking X
 * - 0x0202 Fan Control Feature Wind X
 * - 0x0202 Fan Control Feature AirflowDirection X
 */
export const extractorHood = DeviceTypeDefinition({
  name: 'MA-extractorhood',
  deviceName: 'Extractor Hood',
  code: 0x7a, // 122
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [FanControl.id],
  optionalServerClusters: [Identify.id, HepaFilterMonitoring.id, ActivatedCarbonFilterMonitoring.id],
});

/**
 * A Microwave Oven is a device with the primary function of heating foods and beverages using a magnetron.
 * A Microwave Oven is a device which at a minimum is capable of being started and stopped and of setting a power level.
 * A Microwave Oven MAY also support additional capabilities via endpoint composition.
 *
 * Element Requirements:
 * Operational State Event OperationCompletion
 */
export const microwaveOven = DeviceTypeDefinition({
  name: 'MA-microwaveoven',
  deviceName: 'Microwave Oven',
  code: 0x79, // 121
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [OperationalState.id, MicrowaveOvenMode.id, MicrowaveOvenControl.id],
  optionalServerClusters: [Identify.id, FanControl.id],
});

/** Chapter 14. Energy Device Types */

/**
 * An EVSE (Electric Vehicle Supply Equipment) is a device that allows an EV (Electric Vehicle) to be
 * connected to the mains electricity supply to allow it to be charged (or discharged in case of Vehicle
 * to Grid / Vehicle to Home applications).
 *
 * 14.1.5. Device Type Requirements
 * An EVSE SHALL be composed of at least one endpoint with device types as defined by the conformance
 * below. There MAY be more endpoints with other device types existing in the EVSE.
 * - ID     Name                        Constraint    Conformance
 * - 0x0011 Power Source                min 1         M
 * - 0x0510 Electrical Sensor           min 1         M
 * - 0x050D Device Energy Management    min 1         M
 *
 * The Electrical Sensor device SHALL include both the Electrical Energy Measurement and Electrical
 * Power Measurement clusters, measuring the total energy and power of the EVSE.
 *
 * The Device Energy Management cluster included in the Device Energy Management device SHALL
 * support the Power Forecast Reporting (PFR) feature.
 */
export const evse = DeviceTypeDefinition({
  name: 'MA-evse',
  deviceName: 'Energy EVSE',
  code: 0x050c,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [EnergyEvse.id, EnergyEvseMode.id],
  optionalServerClusters: [Identify.id, TemperatureMeasurement.id],
});

/**
 * A water heater is a device that is generally installed in properties to heat water for showers, baths etc.
 * A Water Heater is always defined via endpoint composition.
 *
 * 14.2.5. Device Type Requirements
 * A Water Heater SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below. There MAY be more endpoints with other device types existing in the Water Heater.
 * - ID     Name                        Constraint    Conformance
 * - 0x0011 Power Source                              O
 * - 0x0302 Temperature Sensor                        O
 * - 0x0510 Electrical Sensor                         desc
 * - 0x050D Device Energy Management                  O
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
 *
 * WaterHeaterMode Cluster
 * 9.6.6.1. SupportedModes Attribute
 * At least one entry in the SupportedModes attribute SHALL include the Manual mode tag in the
 * ModeTags field list.
 * At least one entry in the SupportedModes attribute SHALL include the Off mode tag in the ModeTags
 * field list.
 * An entry in the SupportedModes attribute that includes one of an Off, Manual, or Timed tag SHALL
 * NOT also include an additional instance of any one of these tag types.
 */
export const waterHeater = DeviceTypeDefinition({
  name: 'MA-waterheater',
  deviceName: 'Water Heater',
  code: 0x050f,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Thermostat.id, WaterHeaterManagement.id, WaterHeaterMode.id],
  optionalServerClusters: [Identify.id],
});

/**
 * A Solar Power device is a device that allows a solar panel array, which can optionally be comprised
 * of a set parallel strings of solar panels, and its associated controller and, if appropriate, inverter, to
 * be monitored and controlled by an Energy Management System.
 *
 * 14.3.5. Device Type Requirements
 * A Solar Power device SHALL be composed of at least one endpoint with device types as defined by
 * the conformance below. There MAY be more endpoints with additional instances of these device
 * types or additional device types existing in the Solar Power device.
 *
 * - ID     Name                        Constraint    Conformance
 * - 0x0011 Power Source                min 1         M
 * - 0x0510 Electrical Sensor           min 1         M
 * - 0x050D Device Energy Management                  O
 * - 0x0302 Temperature Sensor                        O
 *
 * 14.3.5.1. Cluster Requirements on Composing Device Types
 *
 * - 0x0011 Power Source 0x002F Power Source Feature Wired M
 * - 0x0011 Power Source 0x001D Descriptor Feature TagList M
 * - 0x0510 Electrical Sensor 0x0090 Electrical Power Measurement M
 * - 0x0510 Electrical Sensor 0x0090 Electrical Power Measurement Attribute Voltage M
 * - 0x0510 Electrical Sensor 0x0090 Electrical Power Measurement Attribute ActiveCurrent M
 * - 0x0510 Electrical Sensor 0x0091 Electrical Energy Measurement M
 * - 0x0510 Electrical Sensor 0x0091 Electrical Energy Measurement Feature ExportedEnergy M
 * - 0x050D Device Energy Management 0x0098 Device Energy Management Feature PowerAdjustment M
 * - 0x0302 Temperature Sensor 0x001D Descriptor Feature TagList M
 */
export const solarPower = DeviceTypeDefinition({
  name: 'MA-solarpower',
  deviceName: 'Solar Power',
  code: 0x0017,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [], // See 14.3.5.1. Cluster Requirements on Composing Device Types
  optionalServerClusters: [Identify.id],
});

/**
 * A Battery Storage device is a device that allows a DC battery, which can optionally be comprised of
 * a set parallel strings of battery packs and associated controller, and an AC inverter, to be monitored
 * and controlled by an Energy Management System in order to manage the peaks and troughs of supply
 * and demand, and/or to optimize cost of the energy consumed in premises. It is not intended to
 * be used for a UPS directly supplying a set of appliances, nor for portable battery storage devices.
 *
 * 14.4.5. Device Type Requirements
 * A Battery Storage device SHALL be composed of at least one endpoint with device types as defined by
 * the conformance below. There MAY be more endpoints with additional instances of these device
 * types or additional device types existing in the Battery Storage device.
 * - ID     Name                        Constraint    Conformance
 * - 0x0011 Power Source                min 1         M
 * - 0x0510 Electrical Sensor           min 1         M
 * - 0x050D Device Energy Management                  M
 * - 0x0302 Temperature Sensor                        O
 * - 0x0017 Solar Power                               O
 *
 * See 14.4.5.1. Cluster Requirements on Composing Device Types
 */
export const batteryStorage = DeviceTypeDefinition({
  name: 'MA-batterystorage',
  deviceName: 'Battery Storage',
  code: 0x0018,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [], // See 14.4.5.1. Cluster Requirements on Composing Device Types
  optionalServerClusters: [Identify.id],
});

/**
 * A Heat Pump device is a device that uses electrical energy to heat either spaces or water tanks using
 * ground, water or air as the heat source. These typically can heat the air or can pump water via central
 * heating radiators or underfloor heating systems. It is typical to also heat hot water and store
 * the heat in a hot water tank.
 *
 * 14.5.1. Heat Pump Architecture
 * A Heat Pump device is always defined via endpoint composition.
 *
 * 14.5.5. Device Type Requirements
 * A Heat Pump device SHALL be composed of at least one endpoint with device types as defined by
 * the conformance below. There MAY be more endpoints with additional instances of these device
 * types or additional device types existing in the Heat Pump device.
 * - ID     Name                        Constraint    Conformance
 * - 0x0011 Power Source                              M
 * - 0x0510 Electrical Sensor           min 1         M
 * - 0x050D Device Energy Management                  M
 * - 0x0301 Thermostat                                O
 * - 0x050f Water Heater                              O
 * - 0x0302 Temperature Sensor                        O
 *
 * See 14.5.5.1. Cluster Requirements on Composing Device Types
 */
export const heatPump = DeviceTypeDefinition({
  name: 'MA-heatpump',
  deviceName: 'Heat Pump',
  code: 0x0309,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [], // See 14.5.5.1. Cluster Requirements on Composing Device Types
  optionalServerClusters: [Identify.id],
  requiredClientClusters: [],
  optionalClientClusters: [Thermostat.id],
});

/**
 * 14.6. Meter Reference Point Device Type
 *
 * A Meter Reference Point device provides details about tariffs and metering.
 *
 * 14.6.5. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name        Direction    Conformance
 * - 0x0003 Identify    server       M
 *
 * 14.6.6. Device Type Requirements
 * A Meter Reference Point SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below.
 *
 * - ID     Name                       Constraint    Conformance
 * - 0x0513 Electrical Energy Tariff   min 1         [ElectricalEnergy].a+
 * - 0x0514 Electrical Meter           min 1         [ElectricalEnergy].a+
 */
export const meterReferencePoint = DeviceTypeDefinition({
  name: 'MA-meterReferencePoint',
  deviceName: 'Meter Reference Point',
  code: 0x0512,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Identify.id],
  optionalServerClusters: [],
});

/**
 * 14.7. Electrical Energy Tariff Device Type
 *
 * An Electrical Energy Tariff is a device that defines a tariff for the consumption or production of electrical energy.
 *
 * 14.7.4. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                         Direction    Conformance
 * - 0x0095 Commodity Price              server       [ActiveTariff].a+
 * - 0x00A0 Electrical Grid Conditions   server       O
 * - 0x0700 Commodity Tariff             server       O.a+
 *
 * Element Requirements:
 * - Descriptor Feature TagList M
 *
 * Semantic Tag Requirements:
 * - Commodity Tariff Chronology namespace (0x0B) Tag CurrentActiveTariff (0x00) M
 * - Commodity Tariff Commodity namespace (0x0D) Tag ElectricalEnergy (0x00) M
 */
export const electricalEnergyTariff = DeviceTypeDefinition({
  name: 'MA-electricalEnergyTariff',
  deviceName: 'Electrical Energy Tariff',
  code: 0x0513,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [],
  optionalServerClusters: [CommodityPrice.id, ElectricalGridConditions.id, CommodityTariff.id],
});

/**
 * 14.8. Electrical Meter Device Type
 *
 * An Electrical Meter device meters the electrical energy being imported and/or exported for billing purposes.
 * It is a superset of the Electrical Energy Tariff device type.
 *
 * 14.8.3. Device Type Requirements
 * An Electrical Meter SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below.
 *
 * - ID     Name                 Constraint    Conformance
 * - 0x0510 Electrical Sensor    min 1         M
 *
 * 14.8.4. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                 Direction    Conformance
 * - 0x0B07 Commodity Metering   server       P, M
 */
export const electricalMeter = DeviceTypeDefinition({
  name: 'MA-electricalMeter',
  deviceName: 'Electrical Meter',
  code: 0x0514,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [ElectricalPowerMeasurement.id, ElectricalEnergyMeasurement.id],
  optionalServerClusters: [CommodityMetering.id],
});

/**
 * 14.9. Electrical Utility Meter Device Type
 *
 * An Electrical Utility Meter device provides utility account information, as well as optional details about tariffs and metering.
 * It is a superset of the Meter Reference Point device type.
 *
 * 14.9.5. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                  Direction    Conformance
 * - 0x0B06 Meter Identification  server       M
 */
export const electricalUtilityMeter = DeviceTypeDefinition({
  name: 'MA-electricalUtilityMeter',
  deviceName: 'Electrical Utility Meter',
  code: 0x0511,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [MeterIdentification.id],
  optionalServerClusters: [],
});

/** Chapter 15. Network Infrastructure Device Types */

/** Chapter 16. Camera Device Types */

/**
 * 16.1. Camera Device Type
 *
 * A Camera device is a camera that provides interfaces for controlling and transporting captured media,
 * such as Audio, Video or Snapshots.
 *
 * 16.1.6. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                                         Direction    Conformance
 * - 0x0003 Identify                                     server       O
 * - 0x0406 Occupancy Sensing                            server       O
 * - 0x0550 Zone Management                              server       O
 * - 0x0551 Camera AV Stream Management                  server       M
 * - 0x0552 Camera AV Settings User Level Management     server       O
 * - 0x0553 WebRTC Transport Provider                    server       M
 * - 0x0553 WebRTC Transport Provider                    client       O
 * - 0x0554 WebRTC Transport Requestor                   server       O
 * - 0x0554 WebRTC Transport Requestor                   client       M
 * - 0x0555 Push AV Stream Transport                     server       O
 *
 * Device Type Requirements:
 * - 0x0107 Occupancy Sensor O
 *
 * Element Requirements:
 * - Zone Management Feature TwoDimensionalCartesianZone M
 * - Camera AV Stream Management Feature Video M
 * - Camera AV Stream Management Feature Audio M
 * - Camera AV Stream Management Feature Snapshot M
 */
export const camera = DeviceTypeDefinition({
  name: 'MA-camera',
  deviceName: 'Camera',
  code: 0x0142,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [CameraAvStreamManagement.id, WebRtcTransportProvider.id],
  optionalServerClusters: [Identify.id, OccupancySensing.id, ZoneManagement.id, CameraAvSettingsUserLevelManagement.id, WebRtcTransportRequestor.id, PushAvStreamTransport.id],
  requiredClientClusters: [WebRtcTransportRequestor.id],
  optionalClientClusters: [WebRtcTransportProvider.id],
});

/**
 * 16.2. Floodlight Camera Device Type
 *
 * A Floodlight Camera device is a composite device which combines a camera and a light,
 * primarily used in security use cases.
 *
 * 16.2.4. Device Type Requirements
 * A Floodlight Camera SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below.
 *
 * - ID     Name             Constraint    Conformance
 * - 0x0100 On/Off Light     min 1         M
 * - 0x0142 Camera           1             M
 */
export const floodlightCamera = DeviceTypeDefinition({
  name: 'MA-floodlightCamera',
  deviceName: 'Floodlight Camera',
  code: 0x0144,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [],
  optionalServerClusters: [],
});

/**
 * 16.3. Video Doorbell Device Type
 *
 * A Video Doorbell device is a composite device which combines a camera and a switch to provide
 * a doorbell with Video and Audio streaming.
 *
 * 16.3.3. Device Type Requirements
 * A Video Doorbell SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below.
 *
 * - ID     Name        Constraint    Conformance
 * - 0x0142 Camera      1             M
 * - 0x0148 Doorbell    min 1         M
 */
export const videoDoorbell = DeviceTypeDefinition({
  name: 'MA-videoDoorbell',
  deviceName: 'Video Doorbell',
  code: 0x0143,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [],
  optionalServerClusters: [],
});

/**
 * 16.4. Intercom Device Type
 *
 * An Intercom is a device which provides two-way on demand communication facilities between devices.
 *
 * 16.4.4. Device Type Requirements
 * An Intercom SHALL be composed of at least one endpoint with device types as defined by the
 * conformance below. The Generic Switch endpoint SHALL have the MomentarySwitch (MS) feature.
 *
 * - ID     Name            Constraint    Conformance
 * - 0x000F Generic Switch  min 1         M
 *
 * 16.4.6. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                                         Direction    Conformance
 * - 0x0003 Identify                                     server       O
 * - 0x0551 Camera AV Stream Management                  server       M
 * - 0x0552 Camera AV Settings User Level Management     server       O
 * - 0x0553 WebRTC Transport Provider                    server       M
 * - 0x0553 WebRTC Transport Provider                    client       M
 * - 0x0554 WebRTC Transport Requestor                   server       M
 * - 0x0554 WebRTC Transport Requestor                   client       M
 * - 0x0556 Chime                                        client       O
 *
 * Element Requirements on Component Device Types:
 * - Generic Switch (0x000F) Switch Feature MomentarySwitch M
 */
export const intercom = DeviceTypeDefinition({
  name: 'MA-intercom',
  deviceName: 'Intercom',
  code: 0x0140,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [CameraAvStreamManagement.id, WebRtcTransportProvider.id, WebRtcTransportRequestor.id],
  optionalServerClusters: [Identify.id, CameraAvSettingsUserLevelManagement.id],
  requiredClientClusters: [WebRtcTransportProvider.id, WebRtcTransportRequestor.id],
  optionalClientClusters: [Chime.id],
});

/**
 * 16.5. Audio Doorbell Device Type
 *
 * An Audio Doorbell device is composed in all cases with a generic switch to provide a doorbell
 * with Audio only streaming.
 *
 * 16.5.4. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                               Direction    Conformance
 * - 0x0003 Identify                           server       M
 * - 0x003B Switch                             server       M
 * - 0x0551 Camera AV Stream Management        server       M
 * - 0x0553 WebRTC Transport Provider          server       M
 * - 0x0553 WebRTC Transport Provider          client       O
 * - 0x0554 WebRTC Transport Requestor         server       O
 * - 0x0554 WebRTC Transport Requestor         client       M
 * - 0x0555 Push AV Stream Transport           server       O
 * - 0x0556 Chime                              client       M
 *
 * Element Requirements:
 * - Camera AV Stream Management Feature Audio M
 * - Camera AV Stream Management Feature Snapshot X
 * - Camera AV Stream Management Feature Video X
 */
export const audioDoorbell = DeviceTypeDefinition({
  name: 'MA-audioDoorbell',
  deviceName: 'Audio Doorbell',
  code: 0x0141,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [Identify.id, Switch.id, CameraAvStreamManagement.id, WebRtcTransportProvider.id],
  optionalServerClusters: [WebRtcTransportRequestor.id, PushAvStreamTransport.id],
  requiredClientClusters: [WebRtcTransportRequestor.id, Chime.id],
  optionalClientClusters: [WebRtcTransportProvider.id],
});

/**
 * 16.6. Snapshot Camera Device Type
 *
 * A Snapshot Camera device is a camera which can only support retrieving still images on-demand
 * via the Capture Snapshot command in the Camera AV Stream Management cluster.
 *
 * 16.6.6. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                                         Direction    Conformance
 * - 0x0003 Identify                                     server       O
 * - 0x0406 Occupancy Sensing                            server       O
 * - 0x0550 Zone Management                              server       O
 * - 0x0551 Camera AV Stream Management                  server       M
 * - 0x0552 Camera AV Settings User Level Management     server       O
 *
 * Device Type Requirements:
 * - 0x0107 Occupancy Sensor O
 *
 * Element Requirements:
 * - Zone Management Feature TwoDimensionalCartesianZone M
 * - Camera AV Stream Management Feature Snapshot M
 * - Camera AV Stream Management Feature Video X
 * - Camera AV Stream Management Feature Audio X
 */
export const snapshotCamera = DeviceTypeDefinition({
  name: 'MA-snapshotCamera',
  deviceName: 'Snapshot Camera',
  code: 0x0145,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [CameraAvStreamManagement.id],
  optionalServerClusters: [Identify.id, OccupancySensing.id, ZoneManagement.id, CameraAvSettingsUserLevelManagement.id],
});

/**
 * 16.7. Chime Device Type
 *
 * A Chime device is a device which can play from a range of pre-installed sounds and is typically
 * used with a Doorbell, Audio Doorbell, or Video Doorbell.
 *
 * 16.7.4. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name        Direction    Conformance
 * - 0x0003 Identify    server       O
 * - 0x0556 Chime       server       M
 *
 * Element Requirements:
 * - There are no cluster element overrides.
 */
export const chime = DeviceTypeDefinition({
  name: 'MA-chime',
  deviceName: 'Chime',
  code: 0x0146,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [Chime.id],
  optionalServerClusters: [Identify.id],
});

/**
 * 16.8. Camera Controller Device Type
 *
 * A Camera controller device is a device that provides interfaces for controlling and managing camera devices.
 *
 * 16.8.3. Cluster Requirements
 * Each endpoint supporting this device type SHALL support these clusters based on the conformance defined below.
 *
 * - ID     Name                                         Direction    Conformance
 * - 0x0003 Identify                                     client       O
 * - 0x002F Power Source                                 client       O
 * - 0x0406 Occupancy Sensing                            client       O
 * - 0x0550 Zone Management                              client       O
 * - 0x0551 Camera AV Stream Management                  client       O
 * - 0x0552 Camera AV Settings User Level Management     client       O
 * - 0x0553 WebRTC Transport Provider                    client       M
 * - 0x0554 WebRTC Transport Requestor                   server       M
 * - 0x0555 Push AV Stream Transport                     client       O
 * - 0x0801 TLS Certificate Management                   client       O
 * - 0x0802 TLS Client Management                        client       O
 */
export const cameraController = DeviceTypeDefinition({
  name: 'MA-cameraController',
  deviceName: 'Camera Controller',
  code: 0x0147,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 1,
  requiredServerClusters: [WebRtcTransportRequestor.id],
  optionalServerClusters: [],
  requiredClientClusters: [WebRtcTransportProvider.id],
  optionalClientClusters: [
    Identify.id,
    PowerSource.id,
    OccupancySensing.id,
    ZoneManagement.id,
    CameraAvStreamManagement.id,
    CameraAvSettingsUserLevelManagement.id,
    PushAvStreamTransport.id,
    TlsCertificateManagement.id,
    TlsClientManagement.id,
  ],
});

/**
 * 16.9. Doorbell Device Type
 *
 * A Doorbell device is a switch which when pressed usually causes a Chime to activate.
 * The Switch cluster SHALL have the MomentarySwitch (MS) feature.
 *
 * - ID     Name        Direction    Conformance
 * - 0x0003 Identify    server       M
 * - 0x003B Switch      server       M
 * - 0x0556 Chime       client       M
 */
export const doorbell = DeviceTypeDefinition({
  name: 'MA-doorbell',
  deviceName: 'Doorbell',
  code: 0x0148,
  deviceClass: DeviceClasses.Simple,
  deviceScope: DeviceScopes.Endpoint,
  revision: 2,
  requiredServerClusters: [Identify.id, Switch.id],
  optionalServerClusters: [],
  requiredClientClusters: [Chime.id],
});
