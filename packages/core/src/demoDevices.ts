/**
 * @file packages/core/src/demoDevices.ts
 * @description This file contains the demo device tree synthesized for the Matterbridge demo devices.
 * @author Luca Liguori
 * @created 2026-08-17
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

/* v8 ignore start - No test cause is just a way to easily add new devices for testing purposes without using plugins */
/* oxlint-disable typescript/no-non-null-assertion */

import { CommonNumberTag } from '@matter/node';
import { AirQuality } from '@matter/types/clusters/air-quality';
import { FanControl } from '@matter/types/clusters/fan-control';
import { PowerSource } from '@matter/types/clusters/power-source';
import { EndpointNumber } from '@matter/types/datatype';

import { BasicVideoPlayer } from './devices/basicVideoPlayer.js';
import { CastingVideoClient } from './devices/castingVideoClient.js';
import { CastingVideoPlayer } from './devices/castingVideoPlayer.js';
import { Closure } from './devices/closure.js';
import { ContentApp } from './devices/contentApp.js';
import { IrrigationSystem } from './devices/irrigationSystem.js';
import { Speaker } from './devices/speaker.js';
import { VideoRemoteControl } from './devices/videoRemoteControl.js';
import type { Matterbridge } from './matterbridge.js';
import { getSupportedDeviceType } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { getSemtag } from './matterbridgeEndpointHelpers.js';

export async function createDemoDevices(matterbridge: Matterbridge): Promise<void> {
  if (matterbridge.bridgeMode !== 'bridge' || !matterbridge.serverNode || !matterbridge.aggregatorNode) return;
  const serverNode = matterbridge.serverNode;
  const aggregator = matterbridge.aggregatorNode;
  if (!serverNode || !aggregator) {
    matterbridge.log.error('Demo devices can only be created when the server node and aggregator node are available');
    return;
  }
  let ep: MatterbridgeEndpoint | undefined;
  matterbridge.plugins.set({
    name: 'matterbridge-demo-devices',
    path: '',
    type: 'DynamicPlatform',
    version: '1.0.0',
    description: 'Matterbridge demo devices',
    author: 'Matterbridge',
    enabled: false,
    private: false,
    registeredDevices: 0,
  });

  const registerDevice = async (device: MatterbridgeEndpoint, deviceName: string, serialNumber: string): Promise<void> => {
    device.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber);
    device.addRequiredClusters();
    device.plugin = 'matterbridge-demo-devices';
    await matterbridge.addBridgedEndpoint('matterbridge-demo-devices', device);
  };

  const bridgedNode = getSupportedDeviceType('BridgedNode')!;
  const powerSource = getSupportedDeviceType('PowerSource')!;

  // Chapter 2 - Utility Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensor', number: EndpointNumber(2_06) });
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createDefaultElectricalEnergyMeasurementClusterServer(100_000_000, 10_000_000);
  await registerDevice(ep, 'Electrical Sensor', 'UTILITY-02-06');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensorImported', number: EndpointNumber(2_06_1) });
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createImportedElectricalEnergyMeasurementClusterServer(200_000_000);
  await registerDevice(ep, 'Electrical Sensor Imported', 'UTILITY-02-06-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensorExported', number: EndpointNumber(2_06_2) });
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createExportedElectricalEnergyMeasurementClusterServer(50_000_000);
  await registerDevice(ep, 'Electrical Sensor Exported', 'UTILITY-02-06-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DeviceEnergyManagement')!, bridgedNode, powerSource], { id: 'DeviceEnergyManagement', number: EndpointNumber(2_07) });
  ep.createDefaultDeviceEnergyManagementClusterServer();
  ep.createDefaultDeviceEnergyManagementModeClusterServer();
  await registerDevice(ep, 'Device Energy Management', 'UTILITY-02-07');

  // Chapter 4 - Lighting Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OnOffLight')!, bridgedNode, powerSource], { id: 'OnOffLight', number: EndpointNumber(4_01) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'On/Off Light', 'LIGHTING-04-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DimmableLight')!, bridgedNode, powerSource], { id: 'DimmableLight', number: EndpointNumber(4_02) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Dimmable Light', 'LIGHTING-04-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ColorTemperatureLight')!, bridgedNode, powerSource], { id: 'ColorTemperatureLight', number: EndpointNumber(4_03) });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createCtColorControlClusterServer();
  await registerDevice(ep, 'Color Temperature Light', 'LIGHTING-04-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ExtendedColorLight')!, bridgedNode, powerSource], { id: 'ExtendedColorLightXYCT', number: EndpointNumber(4_04) });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createXyColorControlClusterServer();
  await registerDevice(ep, 'Extended Color Light XY CT', 'LIGHTING-04-04');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ExtendedColorLight')!, bridgedNode, powerSource], { id: 'ExtendedColorLightHSXYCT', number: EndpointNumber(4_04_1) });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createDefaultColorControlClusterServer();
  await registerDevice(ep, 'Extended Color Light HS XY CT', 'LIGHTING-04-04-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ExtendedColorLight')!, bridgedNode, powerSource], {
    id: 'ExtendedColorLightEnhancedEHSXYCT',
    number: EndpointNumber(4_04_2),
  });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createEnhancedColorControlClusterServer();
  await registerDevice(ep, 'Extended Color Light EHS XY CT', 'LIGHTING-04-04-02');

  // Chapter 5 - Smart Plugs/Outlets and other Actuators

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OnOffPlugInUnit')!, bridgedNode, powerSource], { id: 'OnOffPlugInUnit', number: EndpointNumber(5_01) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'On/Off Plug-in Unit', 'ACTUATOR-05-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DimmablePlugInUnit')!, bridgedNode, powerSource], { id: 'DimmablePlugInUnit', number: EndpointNumber(5_02) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Dimmable Plug-in Unit', 'ACTUATOR-05-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('MountedOnOffControl')!, bridgedNode, powerSource], { id: 'MountedOnOffControl', number: EndpointNumber(5_03) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Mounted On/Off Control', 'ACTUATOR-05-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('MountedDimmableLoadControl')!, bridgedNode, powerSource], {
    id: 'MountedDimmableLoadControl',
    number: EndpointNumber(5_04),
  });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Mounted Dimmable Load Control', 'ACTUATOR-05-04');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Pump')!, bridgedNode, powerSource], { id: 'Pump', number: EndpointNumber(5_05) });
  ep.createDefaultPowerSourceWiredClusterServer();
  // Pump has no Element Requirement for OnOff Feature Lighting (unlike the plug-in/lighting device types above),
  // so the addRequiredClusters() default (Lighting feature) would be non-conformant here — override with the
  // plain, featureless OnOff cluster server instead.
  ep.createOnOffClusterServer();
  await registerDevice(ep, 'Pump', 'ACTUATOR-05-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WaterValve')!, bridgedNode, powerSource], { id: 'WaterValve', number: EndpointNumber(5_06) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Water Valve', 'ACTUATOR-05-06');

  // IrrigationSystem has a single device class.
  ep = new IrrigationSystem('Irrigation System with 2 zones', 'ACTUATOR-05-07', { id: 'IrrigationSystem', number: EndpointNumber(5_07) });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (ep as IrrigationSystem).addZone(getSemtag(CommonNumberTag.One), 'IrrigationSystemZone1', EndpointNumber(5_07_1));
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (ep as IrrigationSystem).addZone(getSemtag(CommonNumberTag.Two), 'IrrigationSystemZone2', EndpointNumber(5_07_2));
  await registerDevice(ep, 'Irrigation System with 2 zones', 'ACTUATOR-05-07');

  // Chapter 6 - Switches and Controls Device Types
  //
  // All six device types below require only Identify as a server cluster (added by addRequiredClusters()) plus
  // a set of required *client* clusters (OnOff/LevelControl/ColorControl/etc., also added by addRequiredClusters()
  // via addRequiredClusterClients(), which is fully generic — it just registers the cluster IDs on
  // MatterbridgeBindingServer, no feature-specific configuration needed).

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OnOffLightSwitch')!, bridgedNode, powerSource], { id: 'OnOffLightSwitch', number: EndpointNumber(6_01) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'On/Off Light Switch', 'SWITCH-06-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DimmerSwitch')!, bridgedNode, powerSource], { id: 'DimmerSwitch', number: EndpointNumber(6_02) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Dimmer Switch', 'SWITCH-06-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ColorDimmerSwitch')!, bridgedNode, powerSource], { id: 'ColorDimmerSwitch', number: EndpointNumber(6_03) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Color Dimmer Switch', 'SWITCH-06-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ControlBridge')!, bridgedNode, powerSource], { id: 'ControlBridge', number: EndpointNumber(6_04) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Control Bridge', 'SWITCH-06-04');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('PumpController')!, bridgedNode, powerSource], { id: 'PumpController', number: EndpointNumber(6_05) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await registerDevice(ep, 'Pump Controller', 'SWITCH-06-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('GenericSwitch')!, bridgedNode, powerSource], { id: 'GenericSwitch', number: EndpointNumber(6_06) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Generic Switch', 'SWITCH-06-06');

  // Chapter 7 - Sensor Devices

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ContactSensor')!, bridgedNode, powerSource], { id: 'ContactSensor', number: EndpointNumber(7_01) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultBooleanStateClusterServer();
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Contact Sensor', 'SENSOR-07-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('LightSensor')!, bridgedNode, powerSource], { id: 'LightSensor', number: EndpointNumber(7_02) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultIlluminanceMeasurementClusterServer(1000, 1, 65534);
  await registerDevice(ep, 'Light Sensor', 'SENSOR-07-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OccupancySensor')!, bridgedNode, powerSource], { id: 'OccupancySensor', number: EndpointNumber(7_03) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Occupancy Sensor', 'SENSOR-07-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('TemperatureSensor')!, bridgedNode, powerSource], { id: 'TemperatureSensor', number: EndpointNumber(7_04) });
  ep.createDefaultPowerSourceReplaceableBatteryClusterServer();
  ep.createDefaultTemperatureMeasurementClusterServer(2000, -27315, 32767);
  await registerDevice(ep, 'Temperature Sensor', 'SENSOR-07-04');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('PressureSensor')!, bridgedNode, powerSource], { id: 'PressureSensor', number: EndpointNumber(7_05) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createDefaultPressureMeasurementClusterServer(1013, 0, 2000);
  await registerDevice(ep, 'Pressure Sensor', 'SENSOR-07-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('FlowSensor')!, bridgedNode, powerSource], { id: 'FlowSensor', number: EndpointNumber(7_06) });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createDefaultFlowMeasurementClusterServer(100, 0, 1000);
  await registerDevice(ep, 'Flow Sensor', 'SENSOR-07-06');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('HumiditySensor')!, bridgedNode, powerSource], { id: 'HumiditySensor', number: EndpointNumber(7_07) });
  ep.createDefaultPowerSourceRechargeableBatteryClusterServer();
  ep.createDefaultRelativeHumidityMeasurementClusterServer(5000, 0, 10000);
  await registerDevice(ep, 'Humidity Sensor', 'SENSOR-07-07');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('OnOffSensor')!, bridgedNode, powerSource], { id: 'OnOffSensor', number: EndpointNumber(7_08) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'On/Off Sensor', 'SENSOR-07-08');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { id: 'SmokeCOAlarm', number: EndpointNumber(7_09) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Smoke/CO Alarm', 'SENSOR-07-09');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { id: 'SmokeAlarm', number: EndpointNumber(7_09_1) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createSmokeOnlySmokeCOAlarmClusterServer();
  await registerDevice(ep, 'Smoke Alarm', 'SENSOR-07-09-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SmokeCOAlarm')!, bridgedNode, powerSource], { id: 'COAlarm', number: EndpointNumber(7_09_2) });
  ep.createDefaultPowerSourceBatteryClusterServer(90, PowerSource.BatChargeLevel.Ok);
  ep.createCoOnlySmokeCOAlarmClusterServer();
  await registerDevice(ep, 'CO Alarm', 'SENSOR-07-09-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('AirQualitySensor')!, bridgedNode, powerSource], { id: 'AirQualitySensor', number: EndpointNumber(7_10) });
  ep.createDefaultPowerSourceBatteryClusterServer(70, PowerSource.BatChargeLevel.Ok);
  ep.createDefaultTvocMeasurementClusterServer(50, undefined, undefined, undefined, 0, 1000);
  ep.addOptionalClusterServers();
  await registerDevice(ep, 'Air Quality Sensor', 'SENSOR-07-10');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WaterFreezeDetector')!, bridgedNode, powerSource], { id: 'WaterFreezeDetector', number: EndpointNumber(7_11) });
  ep.createDefaultPowerSourceBatteryClusterServer(50, PowerSource.BatChargeLevel.Ok);
  ep.createDefaultBooleanStateClusterServer(false);
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Water Freeze Detector', 'SENSOR-07-11');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WaterLeakDetector')!, bridgedNode, powerSource], { id: 'WaterLeakDetector', number: EndpointNumber(7_12) });
  ep.createDefaultPowerSourceBatteryClusterServer(20, PowerSource.BatChargeLevel.Warning);
  ep.createDefaultBooleanStateClusterServer(false);
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Water Leak Detector', 'SENSOR-07-12');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('RainSensor')!, bridgedNode, powerSource], { id: 'RainSensor', number: EndpointNumber(7_13) });
  ep.createDefaultPowerSourceRechargeableBatteryClusterServer(10, PowerSource.BatChargeLevel.Critical);
  ep.createDefaultBooleanStateClusterServer(false);
  ep.createDefaultBooleanStateConfigurationClusterServer();
  await registerDevice(ep, 'Rain Sensor', 'SENSOR-07-13');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('SoilSensor')!, bridgedNode, powerSource], { id: 'SoilSensor', number: EndpointNumber(7_14) });
  ep.createDefaultPowerSourceWiredClusterServer(PowerSource.WiredCurrentType.Dc);
  ep.createDefaultSoilMeasurementClusterServer(50);
  await registerDevice(ep, 'Soil Sensor', 'SENSOR-07-14');

  // Chapter 8 - Entry Control Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DoorLock')!, bridgedNode, powerSource], { id: 'DoorLock', number: EndpointNumber(8_01) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await registerDevice(ep, 'Door Lock', 'ENTRY-08-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DoorLockController')!, bridgedNode, powerSource], { id: 'DoorLockController', number: EndpointNumber(8_02) });
  await registerDevice(ep, 'Door Lock Controller', 'ENTRY-08-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WindowCovering')!, bridgedNode, powerSource], { id: 'WindowCovering', number: EndpointNumber(8_03) });
  await registerDevice(ep, 'Window Covering', 'ENTRY-08-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WindowCoveringController')!, bridgedNode, powerSource], { id: 'WindowCoveringController', number: EndpointNumber(8_04) });
  await registerDevice(ep, 'Window Covering Controller', 'ENTRY-08-04');

  ep = new Closure('Closure', 'ENTRY-08-05', { id: 'Closure', number: EndpointNumber(8_05) });
  await registerDevice(ep, 'Closure', 'ENTRY-08-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ClosureController')!, bridgedNode, powerSource], { id: 'ClosureController', number: EndpointNumber(8_07) });
  await registerDevice(ep, 'Closure Controller', 'ENTRY-08-07');

  // Chapter 9 - HVAC Device Types
  //
  // The base Thermostat/Fan/AirPurifier/ThermostatController endpoints below rely entirely on
  // addRequiredClusters()'s default automated helper (invoked via registerDevice()) to create their
  // required Thermostat/FanControl server clusters with sensible defaults, so no explicit
  // createDefault*ClusterServer() call is needed for those. The five extra Thermostat endpoints exercise
  // the other Thermostat feature-set helpers (Heating-only, Cooling-only, Presets, MatterScheduleConfiguration,
  // ThermostatSuggestions) that createDefaultThermostatClusterServer()'s Heating+Cooling+AutoMode default
  // doesn't cover, so those call the matching explicit helper before registerDevice() runs.

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'Thermostat', number: EndpointNumber(9_01) });
  await registerDevice(ep, 'Thermostat', 'HVAC-09-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'ThermostatHeating', number: EndpointNumber(9_01_1) });
  ep.createDefaultHeatingThermostatClusterServer();
  await registerDevice(ep, 'Thermostat Heating', 'HVAC-09-01-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'ThermostatCooling', number: EndpointNumber(9_01_2) });
  ep.createDefaultCoolingThermostatClusterServer();
  await registerDevice(ep, 'Thermostat Cooling', 'HVAC-09-01-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'ThermostatPresets', number: EndpointNumber(9_01_3) });
  ep.createDefaultPresetsThermostatClusterServer();
  await registerDevice(ep, 'Thermostat Presets', 'HVAC-09-01-3');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'ThermostatSchedules', number: EndpointNumber(9_01_4) });
  ep.createDefaultSchedulesThermostatClusterServer();
  await registerDevice(ep, 'Thermostat Schedules', 'HVAC-09-01-4');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'ThermostatSuggestions', number: EndpointNumber(9_01_5) });
  ep.createDefaultThermostatSuggestionsClusterServer();
  await registerDevice(ep, 'Thermostat Suggestions', 'HVAC-09-01-5');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Fan')!, bridgedNode, powerSource], { id: 'Fan', number: EndpointNumber(9_02) });
  await registerDevice(ep, 'Fan OffLowMedHighAuto', 'HVAC-09-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Fan')!, bridgedNode, powerSource], { id: 'FanOnOff', number: EndpointNumber(9_02_1) });
  ep.createOnOffFanControlClusterServer(FanControl.FanMode.High);
  await registerDevice(ep, 'Fan OffHigh', 'HVAC-09-02-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Fan')!, bridgedNode, powerSource], { id: 'FanBase', number: EndpointNumber(9_02_2) });
  ep.createBaseFanControlClusterServer(FanControl.FanMode.Low, undefined, 30, 30);
  await registerDevice(ep, 'Fan OffLowMedHigh', 'HVAC-09-02-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Fan')!, bridgedNode, powerSource], { id: 'FanMultiSpeed', number: EndpointNumber(9_02_3) });
  ep.createMultiSpeedFanControlClusterServer(FanControl.FanMode.Medium, undefined, 50, 50, 10, 5, 5);
  await registerDevice(ep, 'Fan MultiSpeed', 'HVAC-09-02-3');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Fan')!, bridgedNode, powerSource], { id: 'FanComplete', number: EndpointNumber(9_02_4) });
  ep.createCompleteFanControlClusterServer(FanControl.FanMode.Auto, undefined, 60, 60, 10, 5, 5);
  await registerDevice(ep, 'Fan Complete', 'HVAC-09-02-4');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('AirPurifier')!, bridgedNode, powerSource], {
    id: 'AirPurifier',
    number: EndpointNumber(9_03),
  });
  ep.createDefaultHepaFilterMonitoringClusterServer(85);
  ep.createDefaultActivatedCarbonFilterMonitoringClusterServer(75);
  ep.addChildDeviceType('AirQualitySensor', getSupportedDeviceType('AirQualitySensor')!, { number: EndpointNumber(9_03_1) })
    .createDefaultAirQualityClusterServer(AirQuality.AirQualityEnum.Good)
    .addRequiredClusters();
  ep.addChildDeviceType('Thermostat', getSupportedDeviceType('Thermostat')!, { number: EndpointNumber(9_03_2) }).addRequiredClusters();
  ep.addChildDeviceType('TemperatureSensor', getSupportedDeviceType('TemperatureSensor')!, { number: EndpointNumber(9_03_3) })
    .createDefaultTemperatureMeasurementClusterServer(2000, -4000, 8500)
    .addRequiredClusters();
  ep.addChildDeviceType('HumiditySensor', getSupportedDeviceType('HumiditySensor')!, { number: EndpointNumber(9_03_4) })
    .createDefaultRelativeHumidityMeasurementClusterServer(5000, 0, 10000)
    .addRequiredClusters();
  await registerDevice(ep, 'Air Purifier', 'HVAC-09-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ThermostatController')!, bridgedNode, powerSource], { id: 'ThermostatController', number: EndpointNumber(9_04) });
  await registerDevice(ep, 'Thermostat Controller', 'HVAC-09-04');

  // Chapter 10 - Media Device Types
  //
  // All Chapter 10 device types have single device classes. CastingVideoClient and VideoRemoteControl are controller
  // devices: they only expose client clusters to control a Casting Video Player.

  ep = new BasicVideoPlayer('Basic Video Player', 'MEDIA-10-02', { id: 'BasicVideoPlayer', number: EndpointNumber(10_02) });
  await registerDevice(ep, 'Basic Video Player', 'MEDIA-10-02');

  ep = new CastingVideoPlayer('Casting Video Player', 'MEDIA-10-03', { id: 'CastingVideoPlayer', number: EndpointNumber(10_03) });
  await registerDevice(ep, 'Casting Video Player', 'MEDIA-10-03');

  ep = new Speaker('Speaker', 'MEDIA-10-04', { id: 'Speaker', number: EndpointNumber(10_04) });
  await registerDevice(ep, 'Speaker', 'MEDIA-10-04');

  ep = new ContentApp('Content App', 'MEDIA-10-05', { id: 'ContentApp', number: EndpointNumber(10_05) });
  await registerDevice(ep, 'Content App', 'MEDIA-10-05');

  ep = new CastingVideoClient('Casting Video Client', 'MEDIA-10-06', { id: 'CastingVideoClient', number: EndpointNumber(10_06) });
  await registerDevice(ep, 'Casting Video Client', 'MEDIA-10-06');

  ep = new VideoRemoteControl('Video Remote Control', 'MEDIA-10-07', { id: 'VideoRemoteControl', number: EndpointNumber(10_07) });
  await registerDevice(ep, 'Video Remote Control', 'MEDIA-10-07');

  // Chapter 11 - Generic Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ModeSelect')!, bridgedNode, powerSource], { id: 'ModeSelect', number: EndpointNumber(11_01) });
  ep.createDefaultPowerSourceWiredClusterServer();
  ep.createDefaultModeSelectClusterServer('Mode', [
    { label: 'Mode 1', mode: 0, semanticTags: [] },
    { label: 'Mode 2', mode: 1, semanticTags: [] },
  ]);
  await registerDevice(ep, 'Mode Select', 'GENERIC-11-01');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Aggregator')!, bridgedNode, powerSource], { id: 'Aggregator', number: EndpointNumber(11_02) });
  ep.createDefaultPowerSourceWiredClusterServer();
  await ep.addFixedLabel('composed', 'Aggregator');
  ep.addChildDeviceType('Plug1', getSupportedDeviceType('OnOffPlugInUnit')!, {
    number: EndpointNumber(11_02_1),
    tagList: [getSemtag(CommonNumberTag.One)],
  }).addRequiredClusters();
  ep.addChildDeviceType('Plug2', getSupportedDeviceType('OnOffPlugInUnit')!, {
    number: EndpointNumber(11_02_2),
    tagList: [getSemtag(CommonNumberTag.Two)],
  }).addRequiredClusters();
  ep.addChildDeviceType('Plug3', getSupportedDeviceType('OnOffPlugInUnit')!, {
    number: EndpointNumber(11_02_3),
    tagList: [getSemtag(CommonNumberTag.Three)],
  }).addRequiredClusters();
  ep.addChildDeviceType('Plug4', getSupportedDeviceType('OnOffPlugInUnit')!, {
    number: EndpointNumber(11_02_4),
    tagList: [getSemtag(CommonNumberTag.Four)],
  }).addRequiredClusters();
  await registerDevice(ep, 'Aggregator', 'GENERIC-11-02');
}
// v8 ignore end
