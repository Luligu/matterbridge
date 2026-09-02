/**
 * @file packages/core/src/demoDevices.ts
 * @description This file contains the demo device tree synthesized for the Matterbridge demo devices.
 * @author Luca Liguori
 * @created 2026-08-17
 * @version 1.5.0
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
/* oxlint-disable max-lines-per-function */
/* oxlint-disable typescript/no-non-null-assertion */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ClosureCoveringTag,
  ClosurePanelTag,
  ClosureTag,
  ClosureWindowTag,
  CommodityTariffChronologyTag,
  CommodityTariffCommodityTag,
  CommodityTariffFlowTag,
  CommonNumberTag,
  CommonPositionTag,
  ElectricalMeasurementTag,
  PowerSourceTag,
  RefrigeratorTag,
  SwitchesTag,
} from '@matter/node';
import { AirQuality } from '@matter/types/clusters/air-quality';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { FanControl } from '@matter/types/clusters/fan-control';
import { PowerSource } from '@matter/types/clusters/power-source';
import { PowerTopology } from '@matter/types/clusters/power-topology';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { RvcCleanMode } from '@matter/types/clusters/rvc-clean-mode';
import { RvcRunMode } from '@matter/types/clusters/rvc-run-mode';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { EndpointNumber } from '@matter/types/datatype';
import type { PlatformConfig, PlatformSchema } from '@matterbridge/types';
import { getErrorMessage } from '@matterbridge/utils/error';

import { AirConditioner } from './devices/airConditioner.js';
import { BasicVideoPlayer } from './devices/basicVideoPlayer.js';
import { BatteryStorage } from './devices/batteryStorage.js';
import { CastingVideoClient } from './devices/castingVideoClient.js';
import { CastingVideoPlayer } from './devices/castingVideoPlayer.js';
import { Closure } from './devices/closure.js';
import { ContentApp } from './devices/contentApp.js';
import { Cooktop } from './devices/cooktop.js';
import { Dishwasher } from './devices/dishwasher.js';
import { ElectricalUtilityMeter } from './devices/electricalUtilityMeter.js';
import { Evse } from './devices/evse.js';
import { ExtractorHood } from './devices/extractorHood.js';
import { HeatPump } from './devices/heatPump.js';
import { IrrigationSystem } from './devices/irrigationSystem.js';
import { LaundryDryer } from './devices/laundryDryer.js';
import { LaundryWasher } from './devices/laundryWasher.js';
import { MicrowaveOven } from './devices/microwaveOven.js';
import { Oven } from './devices/oven.js';
import { Refrigerator } from './devices/refrigerator.js';
import { RoboticVacuumCleaner } from './devices/roboticVacuumCleaner.js';
import { SolarPower } from './devices/solarPower.js';
import { Speaker } from './devices/speaker.js';
import { VideoRemoteControl } from './devices/videoRemoteControl.js';
import { WaterHeater } from './devices/waterHeater.js';
import type { Matterbridge } from './matterbridge.js';
import { getSupportedDeviceType } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { getSemtag } from './matterbridgeEndpointHelpers.js';

const demoPluginName = 'matterbridge-demo-devices';
const demoPluginType = 'DynamicPlatform';
const demoPluginVersion = '1.0.0';

const demoPluginSchema: PlatformSchema = {
  title: 'Matterbridge Demo Devices',
  description: `${demoPluginName} v. ${demoPluginVersion} by Matterbridge`,
  type: 'object',
  properties: {
    name: {
      'description': 'Plugin name',
      'type': 'string',
      'readOnly': true,
      'ui:widget': 'hidden',
    },
    type: {
      'description': 'Plugin type',
      'type': 'string',
      'readOnly': true,
      'ui:widget': 'hidden',
    },
    version: {
      'description': 'Plugin version',
      'type': 'string',
      'readOnly': true,
      'default': demoPluginVersion,
      'ui:widget': 'hidden',
    },
    whiteList: {
      description: 'Only the devices in the list will be exposed. If the list is empty, all devices will be exposed.',
      type: 'array',
      items: { type: 'string' },
      default: [],
      uniqueItems: true,
      selectFrom: 'name',
    },
    blackList: {
      description: 'The devices in the list will not be exposed. If the list is empty, no devices will be excluded.',
      type: 'array',
      items: { type: 'string' },
      default: [],
      uniqueItems: true,
      selectFrom: 'name',
    },
    debug: {
      description: 'Enable debug logging for the plugin.',
      type: 'boolean',
      default: false,
    },
    unregisterOnShutdown: {
      description: 'Unregister all devices when the plugin is stopped.',
      type: 'boolean',
      default: false,
    },
  },
};

export async function createDemoDevices(matterbridge: Matterbridge): Promise<void> {
  if (matterbridge.bridgeMode !== 'bridge') {
    matterbridge.log.error('Demo devices can only be created in bridge mode');
    return;
  }
  const serverNode = matterbridge.serverNode;
  const aggregator = matterbridge.aggregatorNode;
  if (!serverNode || !aggregator) {
    matterbridge.log.error('Demo devices can only be created when the server node and aggregator node are available');
    return;
  }
  const configFile = path.join(matterbridge.matterbridgeDirectory, `${demoPluginName}.config.json`);
  const schemaFile = path.join(matterbridge.matterbridgeDirectory, `${demoPluginName}.schema.json`);
  const defaultConfig: PlatformConfig = {
    name: demoPluginName,
    type: demoPluginType,
    version: demoPluginVersion,
    debug: false,
    unregisterOnShutdown: false,
    whiteList: [],
    blackList: [],
  };
  let config = defaultConfig;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const storedConfig = JSON.parse(await readFile(configFile, 'utf8')) as PlatformConfig;
    config = {
      ...defaultConfig,
      ...storedConfig,
      name: demoPluginName,
      type: demoPluginType,
      version: demoPluginVersion,
      whiteList: Array.isArray(storedConfig.whiteList) ? storedConfig.whiteList : [],
      blackList: Array.isArray(storedConfig.blackList) ? storedConfig.blackList : [],
    };
  } catch (error) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') matterbridge.log.error(`Failed to read demo devices config ${configFile}: ${getErrorMessage(error)}`);
  }
  try {
    await writeFile(configFile, JSON.stringify(config, null, 2), 'utf8');
    await writeFile(schemaFile, JSON.stringify(demoPluginSchema, null, 2), 'utf8');
  } catch (error) {
    matterbridge.log.error(`Failed to write demo devices config or schema: ${getErrorMessage(error)}`);
  }
  let ep: MatterbridgeEndpoint | undefined;
  matterbridge.plugins.set({
    name: demoPluginName,
    path: '',
    type: demoPluginType,
    version: demoPluginVersion,
    description: 'Matterbridge demo devices',
    author: 'https://github.com/Luligu',
    enabled: false,
    private: true,
    registeredDevices: 0,
    configJson: config,
    schemaJson: demoPluginSchema,
    hasWhiteList: true,
    hasBlackList: true,
  });

  const registerDevice = async (device: MatterbridgeEndpoint, deviceName: string, serialNumber: string): Promise<void> => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const whiteList = config.whiteList as string[];
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const blackList = config.blackList as string[];
    if (blackList.includes(deviceName)) {
      matterbridge.log.info(`Skipping demo device ${deviceName} because it is in the blacklist`);
      return;
    }
    if (whiteList.length > 0 && !whiteList.includes(deviceName)) {
      matterbridge.log.info(`Skipping demo device ${deviceName} because it is not in the whitelist`);
      return;
    }
    device.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber);
    device.addRequiredClusters();
    device.plugin = demoPluginName;
    await matterbridge.addBridgedEndpoint(demoPluginName, device);
  };

  const bridgedNode = getSupportedDeviceType('BridgedNode')!;
  const powerSource = getSupportedDeviceType('PowerSource')!;

  // Chapter 2 - Utility Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensor', number: EndpointNumber(2_06) });
  ep.createDefaultPowerTopologyClusterServer(PowerTopology.Feature.TreeTopology);
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createDefaultElectricalEnergyMeasurementClusterServer(100_000_000, 10_000_000);
  await registerDevice(ep, 'Electrical Sensor', 'UTILITY-02-06');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensorImported', number: EndpointNumber(2_06_1) });
  ep.createDefaultPowerTopologyClusterServer(PowerTopology.Feature.NodeTopology);
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createImportedElectricalEnergyMeasurementClusterServer(200_000_000);
  await registerDevice(ep, 'Electrical Sensor Imported', 'UTILITY-02-06-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensorExported', number: EndpointNumber(2_06_2) });
  ep.createDefaultPowerTopologyClusterServer(PowerTopology.Feature.SetTopology, [EndpointNumber(2_06), EndpointNumber(2_06_1)]);
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createExportedElectricalEnergyMeasurementClusterServer(50_000_000);
  await registerDevice(ep, 'Electrical Sensor Exported', 'UTILITY-02-06-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ElectricalSensor')!, bridgedNode, powerSource], { id: 'ElectricalSensorDynamic', number: EndpointNumber(2_06_3) });
  ep.createDefaultPowerTopologyClusterServer(PowerTopology.Feature.DynamicPowerFlow, [EndpointNumber(2_06), EndpointNumber(2_06_1)], [EndpointNumber(2_06)]);
  ep.createDefaultElectricalPowerMeasurementClusterServer(220_000, 1_000, 220_000_000, 50_000);
  ep.createDefaultElectricalEnergyMeasurementClusterServer(100_000_000, 10_000_000);
  await registerDevice(ep, 'Electrical Sensor Dynamic', 'UTILITY-02-06-3');

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
  ep.createOnOffClusterServer(false);
  ep.createLevelControlClusterServer(0);
  await registerDevice(ep, 'Pump', 'ACTUATOR-05-05');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WaterValve')!, bridgedNode, powerSource], { id: 'WaterValve', number: EndpointNumber(5_06) });
  ep.createDefaultPowerSourceWiredClusterServer();
  // No plugin manages this demo endpoint's physical valve, so enable the built-in Open/Close movement and
  // auto-close simulation directly here (rather than relying on MATTERBRIDGE_CHIP_TEST's initialize() default).
  ep.createDefaultValveConfigurationAndControlClusterServer(undefined, undefined, 5000, true);
  await registerDevice(ep, 'Water Valve', 'ACTUATOR-05-06');

  // IrrigationSystem has a single device class.
  ep = new IrrigationSystem('Irrigation System with 2 zones', 'ACTUATOR-05-07', { id: 'IrrigationSystem', number: EndpointNumber(5_07), autoOpenClose: true });
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (ep as IrrigationSystem).addZone(getSemtag(CommonNumberTag.One), 'IrrigationSystemZone1', EndpointNumber(5_07_1), 5000, true);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (ep as IrrigationSystem).addZone(getSemtag(CommonNumberTag.Two), 'IrrigationSystemZone2', EndpointNumber(5_07_2), 5000, true);
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

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Aggregator')!, bridgedNode, powerSource], { id: 'GenericSwitch', number: EndpointNumber(6_06) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  await ep.addFixedLabel('composed', 'GenericSwitch');
  // Each button combines a Switches-domain function tag with a Common Number position tag, per the Generic
  // Switch device type section's guidance on applying tags from multiple namespaces (Matter spec § 21).
  ep.addChildDeviceType('Button1', getSupportedDeviceType('GenericSwitch')!, {
    number: EndpointNumber(6_06_1),
    tagList: [getSemtag(SwitchesTag.On), getSemtag(CommonNumberTag.One)],
  })
    .createDefaultMomentarySwitchClusterServer()
    .addRequiredClusters();
  ep.addChildDeviceType('Button2', getSupportedDeviceType('GenericSwitch')!, {
    number: EndpointNumber(6_06_2),
    tagList: [getSemtag(SwitchesTag.Off), getSemtag(CommonNumberTag.Two)],
  })
    .createDefaultMomentarySwitchClusterServer()
    .addRequiredClusters();
  ep.addChildDeviceType('Button3', getSupportedDeviceType('GenericSwitch')!, {
    number: EndpointNumber(6_06_3),
    tagList: [getSemtag(SwitchesTag.Up), getSemtag(CommonNumberTag.Three)],
  })
    .createDefaultMomentarySwitchClusterServer()
    .addRequiredClusters();
  ep.addChildDeviceType('Button4', getSupportedDeviceType('GenericSwitch')!, {
    number: EndpointNumber(6_06_4),
    tagList: [getSemtag(SwitchesTag.Down), getSemtag(CommonNumberTag.Four)],
  })
    .createDefaultMomentarySwitchClusterServer()
    .addRequiredClusters();
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

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DoorLock')!, bridgedNode, powerSource], { id: 'DoorLockUserPin', number: EndpointNumber(8_01_1) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createUserPinDoorLockClusterServer();
  await registerDevice(ep, 'Door Lock User PIN', 'ENTRY-08-01-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DoorLock')!, bridgedNode, powerSource], { id: 'DoorLockUserPinSchedules', number: EndpointNumber(8_01_2) });
  ep.createDefaultPowerSourceBatteryClusterServer();
  ep.createUserPinDoorLockClusterServer(DoorLock.LockState.Locked, DoorLock.LockType.DeadBolt, 0, 4, 10, 2, 3, 4, 10);
  await registerDevice(ep, 'Door Lock User PIN Schedules', 'ENTRY-08-01-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('DoorLockController')!, bridgedNode, powerSource], { id: 'DoorLockController', number: EndpointNumber(8_02) });
  await registerDevice(ep, 'Door Lock Controller', 'ENTRY-08-02');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WindowCovering')!, bridgedNode, powerSource], { id: 'WindowCoveringLift', number: EndpointNumber(8_03) });
  ep.createDefaultWindowCoveringClusterServer(100_00, undefined, undefined, 10_000);
  await registerDevice(ep, 'Window Covering Lift', 'ENTRY-08-03');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WindowCovering')!, bridgedNode, powerSource], { id: 'WindowCoveringTilt', number: EndpointNumber(8_03_1) });
  ep.createDefaultTiltWindowCoveringClusterServer(100_00, undefined, undefined, 10_000);
  await registerDevice(ep, 'Window Covering Tilt', 'ENTRY-08-03-1');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WindowCovering')!, bridgedNode, powerSource], { id: 'WindowCoveringLiftTilt', number: EndpointNumber(8_03_2) });
  ep.createDefaultLiftTiltWindowCoveringClusterServer(100_00, 100_00, undefined, undefined, 10_000);
  await registerDevice(ep, 'Window Covering LiftTilt', 'ENTRY-08-03-2');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('WindowCoveringController')!, bridgedNode, powerSource], { id: 'WindowCoveringController', number: EndpointNumber(8_04) });
  await registerDevice(ep, 'Window Covering Controller', 'ENTRY-08-04');

  ep = new Closure('Closure', 'ENTRY-08-05', {
    id: 'Closure',
    number: EndpointNumber(8_05),
    movementDuration: 2000,
  });
  await registerDevice(ep, 'Closure', 'ENTRY-08-05');

  ep = new Closure('Closure Pedestrian', 'ENTRY-08-05-1', {
    id: 'ClosurePedestrian',
    number: EndpointNumber(8_05_1),
    movementDuration: 2000,
    calibrationDuration: 2000,
    motionLatching: true,
    speed: true,
    pedestrian: true,
    tagList: [getSemtag(ClosureTag.Gate)],
  });
  await registerDevice(ep, 'Closure Pedestrian', 'ENTRY-08-05-1');

  ep = new Closure('Closure Ventilation', 'ENTRY-08-05-2', {
    id: 'ClosureVentilation',
    number: EndpointNumber(8_05_2),
    movementDuration: 2000,
    calibrationDuration: 2000,
    motionLatching: true,
    speed: true,
    ventilation: true,
    tagList: [getSemtag(ClosureTag.Window), getSemtag(ClosureWindowTag.Facade)],
  });
  await registerDevice(ep, 'Closure Ventilation', 'ENTRY-08-05-2');

  ep = new Closure('Closure Calibrate', 'ENTRY-08-05-3', {
    id: 'ClosureCalibrate',
    number: EndpointNumber(8_05_3),
    movementDuration: 2000,
    calibrationDuration: 2000,
    motionLatching: true,
    speed: true,
    calibration: true,
    tagList: [getSemtag(ClosureTag.GarageDoor)],
  });
  await registerDevice(ep, 'Closure Calibrate', 'ENTRY-08-05-3');

  ep = new Closure('Closure Complete', 'ENTRY-08-05-4', {
    id: 'ClosureComplete',
    number: EndpointNumber(8_05_4),
    movementDuration: 2000,
    calibrationDuration: 2000,
    motionLatching: true,
    speed: true,
    ventilation: true,
    pedestrian: true,
    calibration: true,
    tagList: [getSemtag(ClosureTag.Door)],
  });
  await registerDevice(ep, 'Closure Complete', 'ENTRY-08-05-4');

  const closurePanelRoller = new Closure('Closure Panel Roller', 'ENTRY-08-06-1', {
    id: 'ClosurePanelRoller',
    number: EndpointNumber(8_06_1),
    movementDuration: 2000,
    signaturePosition: 50_00,
    tagList: [getSemtag(ClosureTag.Covering)],
  });
  closurePanelRoller.addPanel('Roller', [getSemtag(ClosurePanelTag.Lift)], 'lift', { number: EndpointNumber(8_06_2), movementDuration: 2000 });
  ep = closurePanelRoller;
  await registerDevice(ep, 'Closure Panel Roller', 'ENTRY-08-06-1');

  const closurePanelVenetian = new Closure('Closure Panel Venetian', 'ENTRY-08-06-3', {
    id: 'ClosurePanelVenetian',
    number: EndpointNumber(8_06_3),
    movementDuration: 2000,
    signaturePosition: 20_00,
    tagList: [getSemtag(ClosureTag.Covering), getSemtag(ClosureCoveringTag.Venetian)],
  });
  closurePanelVenetian.addPanel('Venetian', [getSemtag(ClosurePanelTag.Tilt)], 'tilt', { number: EndpointNumber(8_06_4), movementDuration: 2000 });
  ep = closurePanelVenetian;
  await registerDevice(ep, 'Closure Panel Venetian', 'ENTRY-08-06-3');

  const closurePanelSmartGlass = new Closure('Closure Panel Smart-Glass', 'ENTRY-08-06-5', {
    id: 'ClosurePanelSmartGlass',
    number: EndpointNumber(8_06_5),
    movementDuration: 2000,
    signaturePosition: 10_00,
    tagList: [getSemtag(ClosureTag.Window)],
  });
  closurePanelSmartGlass.addPanel('Smart-Glass', [getSemtag(ClosurePanelTag.Lift, 'Opacity')], 'modulation', {
    number: EndpointNumber(8_06_6),
    modulationType: ClosureDimension.ModulationType.Opacity,
    movementDuration: 2000,
  });
  ep = closurePanelSmartGlass;
  await registerDevice(ep, 'Closure Panel Smart-Glass', 'ENTRY-08-06-5');

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('ClosureController')!, bridgedNode, powerSource], { id: 'ClosureController', number: EndpointNumber(8_07) });
  await registerDevice(ep, 'Closure Controller', 'ENTRY-08-07');

  // Chapter 9 - HVAC Device Types

  ep = new MatterbridgeEndpoint([getSupportedDeviceType('Thermostat')!, bridgedNode, powerSource], { id: 'ThermostatAuto', number: EndpointNumber(9_01) });
  ep.createDefaultThermostatClusterServer(23, 21, 25, 2, 0, 47, 3, 50);
  await registerDevice(ep, 'Thermostat Auto', 'HVAC-09-01');

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
  ep.createDefaultThermostatSuggestionsClusterServer(
    23,
    21,
    25,
    0,
    0,
    50,
    0,
    50,
    undefined,
    undefined,
    undefined,
    undefined,
    null,
    [
      { presetHandle: Uint8Array.from([0]), presetScenario: Thermostat.PresetScenario.Occupied, name: 'Occupied', coolingSetpoint: 2500, heatingSetpoint: 2100, builtIn: true },
      { presetHandle: Uint8Array.from([1]), presetScenario: Thermostat.PresetScenario.Unoccupied, name: 'Unoccupied', coolingSetpoint: 2700, heatingSetpoint: 1900, builtIn: true },
    ],
    // numberOfPresets per scenario left at 4 (above the 2 built-in presets above) so TC_TSTAT_4_2.py's AtomicRequest/Presets-write steps have room to add a preset on top of the pre-populated ones.
    [
      { presetScenario: Thermostat.PresetScenario.Occupied, numberOfPresets: 4, presetTypeFeatures: { automatic: false, supportsNames: true } },
      { presetScenario: Thermostat.PresetScenario.Unoccupied, numberOfPresets: 4, presetTypeFeatures: { automatic: false, supportsNames: true } },
    ],
  );
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

  // Chapter 12 - Robotic Device Types

  ep = new RoboticVacuumCleaner('Robotic Vacuum Cleaner', 'ROBOTIC-12-01', {
    id: 'RoboticVacuumCleaner',
    number: EndpointNumber(12_01),
    tagList: [getSemtag(CommonNumberTag.One)],
    // The upstream automated RVC tests use the reference application's PIXIT mode numbering (Idle=0,
    // Cleaning=1). Keep that test-facing numbering explicit here without changing the public class defaults.
    currentRunMode: 0,
    supportedRunModes: [
      { label: 'Idle', mode: 0, modeTags: [{ value: RvcRunMode.ModeTag.Idle }] },
      { label: 'Cleaning', mode: 1, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }] },
      { label: 'Mapping', mode: 2, modeTags: [{ value: RvcRunMode.ModeTag.Mapping }] },
      { label: 'SpotCleaning', mode: 3, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }, { value: RvcRunMode.ModeTag.Max }] },
    ],
    currentCleanMode: 1,
    supportedCleanModes: [
      { label: 'Vacuum', mode: 1, modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }] },
      { label: 'Mop', mode: 2, modeTags: [{ value: RvcCleanMode.ModeTag.Mop }] },
      { label: 'DeepClean', mode: 3, modeTags: [{ value: RvcCleanMode.ModeTag.DeepClean }] },
    ],
  });
  await registerDevice(ep, 'Robotic Vacuum Cleaner', 'ROBOTIC-12-01');

  // Chapter 13 - Appliances Device Types

  ep = new LaundryWasher('Laundry Washer Level Temperature', 'APPLIANCE-13-01', {
    id: 'LaundryWasher',
    number: EndpointNumber(13_01),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Laundry Washer', 'APPLIANCE-13-01');

  ep = new LaundryWasher('Laundry Washer Number Temperature', 'APPLIANCE-13-01-2', {
    id: 'LaundryWasherNumberTemperature',
    number: EndpointNumber(13_01_2),
    tagList: [getSemtag(CommonNumberTag.Two)],
    temperatureSetpoint: 40 * 100,
    minTemperature: 30 * 100,
    maxTemperature: 60 * 100,
    step: 10 * 100,
  });
  await registerDevice(ep, 'Laundry Washer Number Temperature', 'APPLIANCE-13-01-2');

  const refrigeratorDevice = new Refrigerator('Refrigerator', 'APPLIANCE-13-02', {
    id: 'Refrigerator',
    number: EndpointNumber(13_02),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  refrigeratorDevice
    .addCabinet('Refrigerator Cabinet Top', {
      id: 'RefrigeratorCabinetTop',
      number: EndpointNumber(13_02_1),
      tagList: [getSemtag(CommonPositionTag.Top), getSemtag(RefrigeratorTag.Refrigerator)],
    })
    .addRequiredClusters();
  refrigeratorDevice
    .addCabinet('Freezer Cabinet Bottom', {
      id: 'FreezerCabinetBottom',
      number: EndpointNumber(13_02_2),
      tagList: [getSemtag(CommonPositionTag.Bottom), getSemtag(RefrigeratorTag.Freezer)],
      targetTemperature: -20 * 100,
      minTemperature: -30 * 100,
      maxTemperature: 10 * 100,
      step: 10 * 100,
    })
    .addRequiredClusters();
  await registerDevice(refrigeratorDevice, 'Refrigerator', 'APPLIANCE-13-02');

  ep = new AirConditioner('Air Conditioner', 'APPLIANCE-13-03', {
    id: 'AirConditioner',
    number: EndpointNumber(13_03),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Air Conditioner', 'APPLIANCE-13-03');

  ep = new Dishwasher('Dishwasher', 'APPLIANCE-13-05', {
    id: 'Dishwasher',
    number: EndpointNumber(13_05),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Dishwasher', 'APPLIANCE-13-05');

  ep = new LaundryDryer('Laundry Dryer', 'APPLIANCE-13-06', {
    id: 'LaundryDryer',
    number: EndpointNumber(13_06),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Laundry Dryer', 'APPLIANCE-13-06');

  const cooktopDevice = new Cooktop('Cooktop', 'APPLIANCE-13-08', {
    id: 'Cooktop',
    number: EndpointNumber(13_08),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  cooktopDevice
    .addSurface('Cook Surface Top Left', {
      id: 'CookSurfaceTopLeft',
      number: EndpointNumber(13_08_1),
      tagList: [getSemtag(CommonPositionTag.Top), getSemtag(CommonPositionTag.Left)],
    })
    .addRequiredClusters();
  cooktopDevice
    .addSurface('Cook Surface Top Right', {
      id: 'CookSurfaceTopRight',
      number: EndpointNumber(13_08_2),
      tagList: [getSemtag(CommonPositionTag.Top), getSemtag(CommonPositionTag.Right)],
    })
    .addRequiredClusters();
  cooktopDevice
    .addSurface('Cook Surface Bottom Left', {
      id: 'CookSurfaceBottomLeft',
      number: EndpointNumber(13_08_3),
      tagList: [getSemtag(CommonPositionTag.Bottom), getSemtag(CommonPositionTag.Left)],
    })
    .addRequiredClusters();
  cooktopDevice
    .addSurface('Cook Surface Bottom Right', {
      id: 'CookSurfaceBottomRight',
      number: EndpointNumber(13_08_4),
      tagList: [getSemtag(CommonPositionTag.Bottom), getSemtag(CommonPositionTag.Right)],
    })
    .addRequiredClusters();
  await registerDevice(cooktopDevice, 'Cooktop', 'APPLIANCE-13-08');

  const ovenDevice = new Oven('Oven', 'APPLIANCE-13-09', {
    id: 'Oven',
    number: EndpointNumber(13_09),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  ovenDevice
    .addCabinet('Oven Cabinet Top', {
      id: 'OvenCabinetTop',
      number: EndpointNumber(13_09_1),
      tagList: [getSemtag(CommonPositionTag.Top)],
    })
    .addRequiredClusters();
  ovenDevice
    .addCabinet('Oven Cabinet Bottom', {
      id: 'OvenCabinetBottom',
      number: EndpointNumber(13_09_2),
      tagList: [getSemtag(CommonPositionTag.Bottom)],
    })
    .addRequiredClusters();
  await registerDevice(ovenDevice, 'Oven', 'APPLIANCE-13-09');

  ep = new ExtractorHood('Extractor Hood', 'APPLIANCE-13-10', {
    id: 'ExtractorHood',
    number: EndpointNumber(13_10),
    tagList: [getSemtag(CommonNumberTag.One)],
    hepaCondition: 30,
    hepaChangeIndication: ResourceMonitoring.ChangeIndication.Warning,
    hepaLastChangedTime: 1_735_689_600,
    hepaReplacementProductList: [
      {
        productIdentifierType: ResourceMonitoring.ProductIdentifierType.Upc,
        productIdentifierValue: '012345678905',
      },
    ],
    activatedCarbonCondition: 30,
    activatedCarbonChangeIndication: ResourceMonitoring.ChangeIndication.Warning,
    activatedCarbonLastChangedTime: 1_735_689_600,
    activatedCarbonReplacementProductList: [
      {
        productIdentifierType: ResourceMonitoring.ProductIdentifierType.Ean,
        productIdentifierValue: '4006381333931',
      },
    ],
  });
  await registerDevice(ep, 'Extractor Hood', 'APPLIANCE-13-10');

  ep = new MicrowaveOven('Microwave Oven', 'APPLIANCE-13-11', {
    id: 'MicrowaveOven',
    number: EndpointNumber(13_11),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Microwave Oven', 'APPLIANCE-13-11');

  // Chapter 14 - Energy Device Types

  ep = new Evse('EVSE', 'ENERGY-14-01', {
    id: 'Evse',
    number: EndpointNumber(14_01),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'EVSE', 'ENERGY-14-01');

  ep = new WaterHeater('Water Heater', 'ENERGY-14-02', {
    id: 'WaterHeater',
    number: EndpointNumber(14_02),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Water Heater', 'ENERGY-14-02');

  ep = new SolarPower('Solar Power', 'ENERGY-14-03', {
    id: 'SolarPower',
    number: EndpointNumber(14_03),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Solar Power', 'ENERGY-14-03');

  ep = new BatteryStorage('Battery Storage', 'ENERGY-14-04', {
    id: 'BatteryStorage',
    number: EndpointNumber(14_04),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Battery Storage', 'ENERGY-14-04');

  ep = new HeatPump('Heat Pump', 'ENERGY-14-05', {
    id: 'HeatPump',
    number: EndpointNumber(14_05),
    tagList: [getSemtag(CommonNumberTag.One)],
  });
  await registerDevice(ep, 'Heat Pump', 'ENERGY-14-05');

  const electricalUtilityMeterEndpoint = new ElectricalUtilityMeter('Electrical Utility Meter', 'ENERGY-14-09', {
    id: 'ElectricalUtilityMeter',
    number: EndpointNumber(14_09),
    tagList: [getSemtag(CommodityTariffCommodityTag.ElectricalEnergy)],
  });
  electricalUtilityMeterEndpoint.addElectricalMeter('Electrical Meter', {
    id: 'ElectricalMeter',
    number: EndpointNumber(14_09_1),
    energyTariff: {},
    tagList: [getSemtag(ElectricalMeasurementTag.Ac), getSemtag(PowerSourceTag.Grid), getSemtag(CommodityTariffFlowTag.Import), getSemtag(CommodityTariffChronologyTag.Current)],
  });
  // Device Library Specification § 14.9.6.1 (Basic Utility Meter, Figure 30): optional endpoint, sibling of the
  // meter endpoint, representing the upcoming import tariff for grid power.
  electricalUtilityMeterEndpoint.addElectricalEnergyTariff('Electrical Energy Tariff Upcoming', {
    id: 'ElectricalEnergyTariffUpcoming',
    number: EndpointNumber(14_09_2),
    tagList: [getSemtag(ElectricalMeasurementTag.Ac), getSemtag(PowerSourceTag.Grid), getSemtag(CommodityTariffFlowTag.Import), getSemtag(CommodityTariffChronologyTag.Upcoming)],
  });
  await registerDevice(electricalUtilityMeterEndpoint, 'Electrical Utility Meter', 'ENERGY-14-09');

  // Device Library Specification § 14.9.6.2 (Separate EV Rate, Figure 32): building on the basic topology
  // (§ 14.9.6.1), a second Electrical Utility Meter device keeps the grid meter (+ its optional upcoming tariff)
  // and adds a separate EV meter (+ its optional upcoming tariff) for a separate EV charging rate.
  const electricalUtilityMeterEvEndpoint = new ElectricalUtilityMeter('Electrical Utility Meter Ev', 'ENERGY-14-10', {
    id: 'ElectricalUtilityMeterEv',
    number: EndpointNumber(14_10),
    tagList: [getSemtag(CommodityTariffCommodityTag.ElectricalEnergy)],
  });
  electricalUtilityMeterEvEndpoint.addElectricalMeter('Electrical Meter', {
    id: 'ElectricalMeter',
    number: EndpointNumber(14_10_1),
    energyTariff: {},
    tagList: [getSemtag(ElectricalMeasurementTag.Ac), getSemtag(PowerSourceTag.Grid), getSemtag(CommodityTariffFlowTag.Import), getSemtag(CommodityTariffChronologyTag.Current)],
  });
  // Optional endpoint, sibling of the grid meter endpoint, representing the upcoming import tariff for grid power.
  electricalUtilityMeterEvEndpoint.addElectricalEnergyTariff('Electrical Energy Tariff Upcoming', {
    id: 'ElectricalEnergyTariffUpcoming',
    number: EndpointNumber(14_10_2),
    tagList: [getSemtag(ElectricalMeasurementTag.Ac), getSemtag(PowerSourceTag.Grid), getSemtag(CommodityTariffFlowTag.Import), getSemtag(CommodityTariffChronologyTag.Upcoming)],
  });
  electricalUtilityMeterEvEndpoint.addElectricalMeter('Electrical Meter Ev', {
    id: 'ElectricalMeterEv',
    number: EndpointNumber(14_10_3),
    energyTariff: {},
    tagList: [getSemtag(ElectricalMeasurementTag.Ac), getSemtag(PowerSourceTag.Ev), getSemtag(CommodityTariffFlowTag.Import), getSemtag(CommodityTariffChronologyTag.Current)],
  });
  // Optional endpoint, sibling of the EV meter endpoint, representing the upcoming EV charging tariff.
  electricalUtilityMeterEvEndpoint.addElectricalEnergyTariff('Electrical Energy Tariff Ev Upcoming', {
    id: 'ElectricalEnergyTariffEvUpcoming',
    number: EndpointNumber(14_10_4),
    tagList: [getSemtag(ElectricalMeasurementTag.Ac), getSemtag(PowerSourceTag.Ev), getSemtag(CommodityTariffFlowTag.Import), getSemtag(CommodityTariffChronologyTag.Upcoming)],
  });
  await registerDevice(electricalUtilityMeterEvEndpoint, 'Electrical Utility Meter Ev', 'ENERGY-14-10');
}
// v8 ignore end
