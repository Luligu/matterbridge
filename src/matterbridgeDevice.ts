/**
 * This file contains the class MatterbridgeDevice.
 *
 * @file matterbridgeDevice.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 1.1.1
 *
 * Copyright 2023, 2024 Luca Liguori.
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

import {
  BasicInformationCluster,
  BooleanState,
  BooleanStateCluster,
  ClusterServer,
  ClusterServerHandlers,
  ColorControl,
  ColorControlCluster,
  DoorLock,
  DoorLockCluster,
  ElectricalMeasurement,
  ElectricalMeasurementCluster,
  FanControl,
  FanControlCluster,
  FixedLabelCluster,
  FlowMeasurement,
  FlowMeasurementCluster,
  Groups,
  Identify,
  IdentifyCluster,
  IlluminanceMeasurement,
  IlluminanceMeasurementCluster,
  LevelControl,
  LevelControlCluster,
  ModeSelect,
  ModeSelectCluster,
  OccupancySensing,
  OccupancySensingCluster,
  OnOff,
  OnOffCluster,
  PowerSource,
  PowerSourceCluster,
  PowerSourceConfigurationCluster,
  PressureMeasurement,
  PressureMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  Scenes,
  Switch,
  SwitchCluster,
  TemperatureMeasurement,
  TemperatureMeasurementCluster,
  Thermostat,
  ThermostatCluster,
  ThreadNetworkDiagnostics,
  ThreadNetworkDiagnosticsCluster,
  TimeSync,
  TimeSyncCluster,
  WindowCovering,
  WindowCoveringCluster,
  createDefaultGroupsClusterServer,
  createDefaultScenesClusterServer,
  getClusterNameById,
} from '@project-chip/matter-node.js/cluster';
import { ClusterId, EndpointNumber, VendorId } from '@project-chip/matter-node.js/datatype';
import { Device, DeviceClasses, DeviceTypeDefinition, Endpoint, EndpointOptions } from '@project-chip/matter-node.js/device';
import { AtLeastOne, extendPublicHandlerMethods } from '@project-chip/matter-node.js/util';

import { MatterHistory, Sensitivity, WeatherTrend, TemperatureDisplayUnits } from 'matter-history';
import { EveHistory, EveHistoryCluster } from 'matter-history';

import { AirQuality, AirQualityCluster } from './cluster/AirQualityCluster.js';
import { AnsiLogger, CYAN, TimestampFormat, db, hk, zb } from 'node-ansi-logger';
import { createHash } from 'crypto';
import { TvocMeasurement, TvocMeasurementCluster } from './cluster/TvocCluster.js';
import { BridgedDeviceBasicInformation, BridgedDeviceBasicInformationCluster } from './cluster/BridgedDeviceBasicInformationCluster.js';
import { PowerTopology, PowerTopologyCluster } from './cluster/PowerTopologyCluster.js';
import { ElectricalPowerMeasurement, ElectricalPowerMeasurementCluster } from './cluster/ElectricalPowerMeasurementCluster.js';
import { ElectricalEnergyMeasurement, ElectricalEnergyMeasurementCluster } from './cluster/ElectricalEnergyMeasurementCluster.js';
import { MeasurementType } from './cluster/MeasurementType.js';
import { CarbonMonoxideConcentrationMeasurement, CarbonMonoxideConcentrationMeasurementCluster } from './cluster/CarbonMonoxideConcentrationMeasurementCluster.js';
import { SmokeCoAlarm, SmokeCoAlarmCluster } from './cluster/SmokeCoAlarmCluster.js';
import { BooleanStateConfiguration, BooleanStateConfigurationCluster } from './cluster/BooleanStateConfigurationCluster.js';
import { DeviceEnergyManagement, DeviceEnergyManagementCluster } from './cluster/DeviceEnergyManagementCluster.js';
import { DeviceEnergyManagementMode, DeviceEnergyManagementModeCluster } from './cluster/DeviceEnergyManagementModeCluster.js';
// import { FanControl, FanControlCluster } from './cluster/FanControlCluster.js';
import { ConcentrationMeasurement } from './cluster/ConcentrationMeasurementCluster.js';
import { CarbonDioxideConcentrationMeasurement, CarbonDioxideConcentrationMeasurementCluster } from './cluster/CarbonDioxideConcentrationMeasurementCluster.js';
import { OzoneConcentrationMeasurement, OzoneConcentrationMeasurementCluster } from './cluster/OzoneConcentrationMeasurementCluster.js';
import { Pm1ConcentrationMeasurement, Pm1ConcentrationMeasurementCluster } from './cluster/Pm1ConcentrationMeasurementCluster.js';
import { Pm25ConcentrationMeasurement, Pm25ConcentrationMeasurementCluster } from './cluster/Pm25ConcentrationMeasurementCluster.js';
import { Pm10ConcentrationMeasurement, Pm10ConcentrationMeasurementCluster } from './cluster/Pm10ConcentrationMeasurementCluster.js';
import { RadonConcentrationMeasurement, RadonConcentrationMeasurementCluster } from './cluster/RadonConcentrationMeasurementCluster.js';
import { NitrogenDioxideConcentrationMeasurement, NitrogenDioxideConcentrationMeasurementCluster } from './cluster/NitrogenDioxideConcentrationMeasurementCluster.js';
import { FormaldehydeConcentrationMeasurement, FormaldehydeConcentrationMeasurementCluster } from './cluster/FormaldehydeConcentrationMeasurementCluster.js';

type MakeMandatory<T> = Exclude<T, undefined>;

interface MatterbridgeDeviceCommands {
  identify: MakeMandatory<ClusterServerHandlers<typeof Identify.Complete>['identify']>;

  on: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['on']>;
  off: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['off']>;
  toggle: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['toggle']>;
  offWithEffect: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['offWithEffect']>;

  moveToLevel: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevel']>;
  moveToLevelWithOnOff: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevelWithOnOff']>;

  moveToColor: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  moveColor: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  stepColor: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  moveToHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  moveHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveHue']>;
  stepHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepHue']>;
  moveToSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToSaturation']>;
  moveSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveSaturation']>;
  stepSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepSaturation']>;
  moveToHueAndSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHueAndSaturation']>;
  moveToColorTemperature: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToColorTemperature']>;

  upOrOpen: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['upOrOpen']>;
  downOrClose: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['downOrClose']>;
  stopMotion: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['stopMotion']>;
  goToLiftPercentage: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['goToLiftPercentage']>;

  lockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['lockDoor']>;
  unlockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['unlockDoor']>;

  setpointRaiseLower: MakeMandatory<ClusterServerHandlers<typeof Thermostat.Complete>['setpointRaiseLower']>;

  // step: MakeMandatory<ClusterServerHandlers<typeof FanControl.Complete>['step']>; // Rev > 2

  suppressAlarm: MakeMandatory<ClusterServerHandlers<typeof BooleanStateConfiguration.Complete>['suppressAlarm']>;
  enableDisableAlarm: MakeMandatory<ClusterServerHandlers<typeof BooleanStateConfiguration.Complete>['enableDisableAlarm']>;

  selfTestRequest: MakeMandatory<ClusterServerHandlers<typeof SmokeCoAlarm.Complete>['selfTestRequest']>;
}

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
    TvocMeasurement.Cluster.id,
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

export const smokeCoAlarm = DeviceTypeDefinition({
  name: 'MA-smokeCoAlarm',
  code: 0x0076,
  deviceClass: DeviceClasses.Simple,
  revision: 1,
  requiredServerClusters: [Identify.Cluster.id, SmokeCoAlarm.Cluster.id],
  optionalServerClusters: [Groups.Cluster.id, TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id, CarbonMonoxideConcentrationMeasurement.Cluster.id],
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

export const powerSource = DeviceTypeDefinition({
  name: 'MA-powerSource',
  code: 0x0011,
  deviceClass: DeviceClasses.Utility,
  revision: 1,
  requiredServerClusters: [PowerSource.Cluster.id],
  optionalServerClusters: [],
});

export const bridgedNode = DeviceTypeDefinition({
  name: 'MA-bridgedNode',
  code: 0x0013,
  deviceClass: DeviceClasses.Utility,
  revision: 2,
  requiredServerClusters: [BridgedDeviceBasicInformation.Cluster.id],
  optionalServerClusters: [PowerSource.Cluster.id],
});

// Custom device types: switch without ClientClusters

export const onOffSwitch = DeviceTypeDefinition({
  name: 'MA-onoffswitch',
  code: 0x0103,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id],
  optionalServerClusters: [LevelControl.Cluster.id, ColorControl.Cluster.id],
});

export const dimmableSwitch = DeviceTypeDefinition({
  name: 'MA-dimmableswitch',
  code: 0x0104,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id],
  optionalServerClusters: [ColorControl.Cluster.id],
});

export const colorTemperatureSwitch = DeviceTypeDefinition({
  name: 'MA-colortemperatureswitch',
  code: 0x0105,
  deviceClass: DeviceClasses.Simple,
  revision: 2,
  requiredServerClusters: [Identify.Cluster.id, Groups.Cluster.id, Scenes.Cluster.id, OnOff.Cluster.id, LevelControl.Cluster.id, ColorControl.Cluster.id],
  optionalServerClusters: [],
});

export interface SerializedMatterbridgeDevice {
  pluginName: string;
  deviceName: string;
  serialNumber: string;
  uniqueId: string;
  deviceTypes: AtLeastOne<DeviceTypeDefinition>;
  endpoint: EndpointNumber | undefined;
  endpointName: string;
  clusterServersId: ClusterId[];
}

export class MatterbridgeDevice extends extendPublicHandlerMethods<typeof Device, MatterbridgeDeviceCommands>(Device) {
  public static bridgeMode = '';
  log: AnsiLogger;
  serialNumber: string | undefined = undefined;
  deviceName: string | undefined = undefined;
  uniqueId: string | undefined = undefined;

  /**
   * Create a Matterbridge device.
   * @constructor
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The definition of the device.
   * @param {EndpointOptions} [options={}] - The options for the device.
   */
  constructor(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: EndpointOptions = {}, debug = false) {
    let firstDefinition: DeviceTypeDefinition;
    if (Array.isArray(definition)) firstDefinition = definition[0];
    else firstDefinition = definition;
    super(firstDefinition, options);
    if (Array.isArray(definition)) {
      definition.forEach((deviceType) => {
        this.addDeviceType(deviceType);
      });
    }
    this.addDeviceType(firstDefinition);
    this.log = new AnsiLogger({ logName: 'MatterbridgeDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logDebug: debug });
    this.log.debug(`MatterbridgeDevice with deviceType: ${zb}${firstDefinition.code}${db}-${zb}${firstDefinition.name}${db}`);
  }

  /**
   * Loads an instance of the MatterbridgeDevice class.
   *
   * @param {DeviceTypeDefinition} definition - The DeviceTypeDefinition of the device.
   * @returns MatterbridgeDevice instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition, options: EndpointOptions = {}, debug = false) {
    return new MatterbridgeDevice(definition, options, debug);
  }

  /**
   * Adds a device type to the list of device types of the MatterbridgeDevice endpoint.
   * If the device type is not already present in the list, it will be added.
   *
   * @param {DeviceTypeDefinition} deviceType - The device type to add.
   */
  addDeviceType(deviceType: DeviceTypeDefinition) {
    const deviceTypes = this.getDeviceTypes();
    if (!deviceTypes.includes(deviceType)) {
      this.log.debug(`addDeviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceTypes.push(deviceType);
      this.setDeviceTypes(deviceTypes);
    }
  }

  /**
   * Adds one or more device types with the required cluster servers and the specified cluster servers.
   *
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   */
  addDeviceTypeWithClusterServer(deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[]) {
    this.log.debug('addDeviceTypeWithClusterServer:');
    deviceTypes.forEach((deviceType) => {
      this.addDeviceType(deviceType);
      this.log.debug(`- with deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${clusterId}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(this, includeServerList);
  }

  /**
   * Adds a child endpoint with one or more device types with the required cluster servers and the specified cluster servers.
   * If the child endpoint is not already present in the childEndpoints, it will be added.
   * If the child endpoint is already present in the childEndpoints, the device types and cluster servers will be added to the existing child endpoint.
   *
   * @param {string} endpointName - The name of the new enpoint to add.
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   * @returns {Endpoint} - The child endpoint that was found or added.
   */
  addChildDeviceTypeWithClusterServer(endpointName: string, deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[]): Endpoint {
    this.log.debug(`addChildDeviceTypeWithClusterServer: ${CYAN}${endpointName}${db}`);
    let child = this.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === endpointName);
    if (!child) {
      child = new Endpoint(deviceTypes, { uniqueStorageKey: endpointName });
      child.addFixedLabel('endpointName', endpointName);
    }
    deviceTypes.forEach((deviceType) => {
      this.log.debug(`- with deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${clusterId}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(child, includeServerList);
    this.addChildEndpoint(child);
    return child;
  }

  /**
   * Adds cluster servers to the specified endpoint based on the provided server list.
   *
   * @param {Endpoint} endpoint - The endpoint to add cluster servers to.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   * @returns void
   */
  addClusterServerFromList(endpoint: Endpoint, includeServerList: ClusterId[]): void {
    if (includeServerList.includes(Identify.Cluster.id)) endpoint.addClusterServer(this.getDefaultIdentifyClusterServer());
    if (includeServerList.includes(Groups.Cluster.id)) endpoint.addClusterServer(this.getDefaultGroupsClusterServer());
    if (includeServerList.includes(Scenes.Cluster.id)) endpoint.addClusterServer(this.getDefaultScenesClusterServer());
    if (includeServerList.includes(OnOff.Cluster.id)) endpoint.addClusterServer(this.getDefaultOnOffClusterServer());
    if (includeServerList.includes(LevelControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultLevelControlClusterServer());
    if (includeServerList.includes(ColorControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultColorControlClusterServer());
    if (includeServerList.includes(Switch.Cluster.id)) endpoint.addClusterServer(this.getDefaultSwitchClusterServer());
    if (includeServerList.includes(DoorLock.Cluster.id)) endpoint.addClusterServer(this.getDefaultDoorLockClusterServer());
    if (includeServerList.includes(Thermostat.Cluster.id)) endpoint.addClusterServer(this.getDefaultThermostatClusterServer());
    if (includeServerList.includes(TimeSync.Cluster.id)) endpoint.addClusterServer(this.getDefaultTimeSyncClusterServer());
    if (includeServerList.includes(WindowCovering.Cluster.id)) endpoint.addClusterServer(this.getDefaultWindowCoveringClusterServer());
    if (includeServerList.includes(TemperatureMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultTemperatureMeasurementClusterServer());
    if (includeServerList.includes(RelativeHumidityMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultRelativeHumidityMeasurementClusterServer());
    if (includeServerList.includes(PressureMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultPressureMeasurementClusterServer());
    if (includeServerList.includes(FlowMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultFlowMeasurementClusterServer());
    if (includeServerList.includes(BooleanState.Cluster.id)) endpoint.addClusterServer(this.getDefaultBooleanStateClusterServer());
    if (includeServerList.includes(BooleanStateConfiguration.Cluster.id)) endpoint.addClusterServer(this.getDefaultBooleanStateConfigurationClusterServer());
    if (includeServerList.includes(OccupancySensing.Cluster.id)) endpoint.addClusterServer(this.getDefaultOccupancySensingClusterServer());
    if (includeServerList.includes(IlluminanceMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultIlluminanceMeasurementClusterServer());
    if (includeServerList.includes(PowerSource.Cluster.id)) endpoint.addClusterServer(this.getDefaultPowerSourceWiredClusterServer());
    if (includeServerList.includes(EveHistory.Cluster.id)) endpoint.addClusterServer(this.getDefaultStaticEveHistoryClusterServer());
    if (includeServerList.includes(ElectricalMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultElectricalMeasurementClusterServer());
    if (includeServerList.includes(PowerTopology.Cluster.id)) endpoint.addClusterServer(this.getDefaultPowerTopologyClusterServer());
    if (includeServerList.includes(ElectricalPowerMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultElectricalPowerMeasurementClusterServer());
    if (includeServerList.includes(ElectricalEnergyMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultElectricalEnergyMeasurementClusterServer());
    if (includeServerList.includes(SmokeCoAlarm.Cluster.id)) endpoint.addClusterServer(this.getDefaultSmokeCOAlarmClusterServer());
    if (includeServerList.includes(AirQuality.Cluster.id)) endpoint.addClusterServer(this.getDefaultAirQualityClusterServer());
    if (includeServerList.includes(CarbonMonoxideConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultCarbonMonoxideConcentrationMeasurementClusterServer());
    if (includeServerList.includes(CarbonDioxideConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultCarbonDioxideConcentrationMeasurementClusterServer());
    if (includeServerList.includes(NitrogenDioxideConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultNitrogenDioxideConcentrationMeasurementClusterServer());
    if (includeServerList.includes(OzoneConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultOzoneConcentrationMeasurementClusterServer());
    if (includeServerList.includes(FormaldehydeConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultFormaldehydeConcentrationMeasurementClusterServer());
    if (includeServerList.includes(Pm1ConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultPm1ConcentrationMeasurementClusterServer());
    if (includeServerList.includes(Pm25ConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultPm25ConcentrationMeasurementClusterServer());
    if (includeServerList.includes(Pm10ConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultPm10ConcentrationMeasurementClusterServer());
    if (includeServerList.includes(RadonConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultRadonConcentrationMeasurementClusterServer());
    if (includeServerList.includes(TvocMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultTvocMeasurementClusterServer());
    if (includeServerList.includes(FanControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultFanControlClusterServer());
    if (includeServerList.includes(DeviceEnergyManagement.Cluster.id)) endpoint.addClusterServer(this.getDefaultDeviceEnergyManagementClusterServer());
    if (includeServerList.includes(DeviceEnergyManagementMode.Cluster.id)) endpoint.addClusterServer(this.getDefaultDeviceEnergyManagementModeClusterServer());
  }

  /**
   * Retrieves a child endpoint by its name.
   *
   * @param {string} endpointName - The name of the endpoint to retrieve.
   * @returns {Endpoint | undefined} The child endpoint with the specified name, or undefined if not found.
   */
  getChildEndpointByName(endpointName: string): Endpoint | undefined {
    for (const child of this.getChildEndpoints()) {
      // Find the endpoint name (l1...)
      const labelList = child.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
      if (!labelList) continue;
      const value = labelList.find((entry) => entry.label === 'endpointName');
      if (value && value.value === endpointName) return child;
    }
    return undefined;
  }

  /**
   * Retrieves a child endpoint name.
   *
   * @param {Endpoint} child - The child endpoint to retrieve the name.
   * @returns {string | undefined} The child endpoint name, or undefined if not found.
   */
  getChildEndpointName(child: Endpoint): string | undefined {
    // Find the endpoint name (l1...)
    const labelList = child.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
    if (!labelList) return undefined;
    const endpointNameLabel = labelList.find((entry) => entry.label === 'endpointName');
    if (endpointNameLabel) return endpointNameLabel.value;
    return undefined;
  }

  /**
   * Sets the endpoint name for a child endpoint.
   *
   * @param {Endpoint} child - The child endpoint.
   * @param {string} endpointName - The name of the endpoint.
   */
  setChildEndpointName(child: Endpoint, endpointName: string) {
    child.addFixedLabel('endpointName', endpointName);
  }

  /**
   * Retrieves the label associated with the specified endpoint number.
   * @param {EndpointNumber | undefined} endpointNumber - The number of the endpoint.
   * @returns {string | undefined} The label associated with the endpoint number, or undefined if not found.
   */
  getEndpointLabel(endpointNumber: EndpointNumber | undefined): string | undefined {
    if (!endpointNumber) return undefined;
    const labelList = this.getChildEndpoint(endpointNumber)?.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
    if (!labelList) return undefined;
    for (const entry of labelList) {
      if (entry.label === 'endpointName') return entry.value;
    }
    return undefined;
  }

  /**
   * Retrieves the child endpoint with the specified label.
   *
   * @param {string} label - The label of the child endpoint to retrieve.
   * @returns {Endpoint | undefined} The child endpoint with the specified label, or undefined if not found.
   */
  getChildEndpointWithLabel(label: string): Endpoint | undefined {
    const endpoints = this.getChildEndpoints();
    for (const endpoint of endpoints) {
      const labelList = endpoint.getClusterServer(FixedLabelCluster)?.getLabelListAttribute();
      if (!labelList) return undefined;
      let endpointName = '';
      for (const entry of labelList) {
        if (entry.label === 'endpointName') endpointName = entry.value;
      }
      if (endpointName === label) return endpoint;
    }
    return undefined;
  }

  /**
   * Serializes the Matterbridge device into a serialized object.
   *
   * @param pluginName - The name of the plugin.
   * @returns The serialized Matterbridge device object.
   */
  serialize(pluginName: string) {
    if (!this.serialNumber || !this.deviceName || !this.uniqueId) return;
    const serialized: SerializedMatterbridgeDevice = {
      pluginName,
      serialNumber: this.serialNumber,
      deviceName: this.deviceName,
      uniqueId: this.uniqueId,
      deviceTypes: this.getDeviceTypes(),
      endpoint: this.number,
      endpointName: this.name,
      clusterServersId: [],
    };
    this.getAllClusterServers().forEach((clusterServer) => {
      serialized.clusterServersId.push(clusterServer.id);
    });
    return serialized;
  }

  /**
   * Returns a default static EveHistoryClusterServer object with the specified voltage, current, power, and consumption values.
   * This shows up in HA as a static sensor!
   * @param voltage - The voltage value (default: 0).
   * @param current - The current value (default: 0).
   * @param power - The power value (default: 0).
   * @param consumption - The consumption value (default: 0).
   * @returns The default static EveHistoryClusterServer object.
   */
  getDefaultStaticEveHistoryClusterServer(voltage = 0, current = 0, power = 0, consumption = 0) {
    return ClusterServer(
      EveHistoryCluster.with(EveHistory.Feature.EveEnergy),
      {
        // Dynamic attributes
        ConfigDataGet: Uint8Array.fromHex(''),
        ConfigDataSet: Uint8Array.fromHex(''),
        HistoryStatus: Uint8Array.fromHex(''),
        HistoryEntries: Uint8Array.fromHex(''),
        HistoryRequest: Uint8Array.fromHex(''),
        HistorySetTime: Uint8Array.fromHex(''),
        LastEvent: 0,
        ResetTotal: 0,
        // Normal attributes
        Voltage: voltage,
        Current: current,
        Consumption: power,
        TotalConsumption: consumption,
        EnergyUnknown: 1,
        ChildLock: false,
        RLoc: 46080,
      },
      {},
      {},
    );
  }

  /**
   * Creates a room Eve History Cluster Server.
   *
   * @param history - The MatterHistory object.
   * @param log - The AnsiLogger object.
   */
  createRoomEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('room', this.serialNumber);
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveRoom),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          // Normal attributes
          TemperatureDisplayUnits: TemperatureDisplayUnits.CELSIUS,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a Weather Eve History Cluster Server.
   *
   * @param history - The MatterHistory instance.
   * @param log - The AnsiLogger instance.
   */
  createWeatherEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('weather', this.serialNumber);
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveWeather),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          // Normal attributes
          Elevation: 0,
          AirPressure: 1000,
          WeatherTrend: WeatherTrend.SUN,
          TemperatureDisplayUnits: TemperatureDisplayUnits.CELSIUS,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates an Energy Eve History Cluster Server.
   *
   * @param history - The MatterHistory object.
   * @param log - The AnsiLogger object.
   */
  createEnergyEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('energy');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveEnergy),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          LastEvent: 0,
          ResetTotal: 0,
          // Normal attributes
          Voltage: 0,
          Current: 0,
          Consumption: 0,
          TotalConsumption: 0,
          EnergyUnknown: 1,
          ChildLock: false,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },

          LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastEvent();
          },

          ResetTotalAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastResetTotalAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastReset();
          },
          ResetTotalAttributeSetter: (value: number, { attributes, endpoint, session }) => {
            log.debug(`LastResetTotalAttributeSetter ${value} ${attributes.ResetTotal} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetLastReset(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a Motion Eve History Cluster Server.
   *
   * @param history - The MatterHistory object.
   * @param log - The AnsiLogger object.
   */
  createMotionEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('motion');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveMotion),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          LastEvent: 0,
          // Normal attributes
          MotionSensitivity: Sensitivity.HIGH,
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },

          LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastEvent();
          },
        },
        {},
      ),
    );
  }

  /**
   * Creates a door EveHistoryCluster server.
   *
   * @param history - The MatterHistory instance.
   * @param log - The AnsiLogger instance.
   */
  createDoorEveHistoryClusterServer(history: MatterHistory, log: AnsiLogger) {
    history.setMatterHystoryType('door');
    this.addClusterServer(
      ClusterServer(
        EveHistoryCluster.with(EveHistory.Feature.EveDoor),
        {
          // Dynamic attributes
          ConfigDataGet: Uint8Array.fromHex(''),
          ConfigDataSet: Uint8Array.fromHex(''),
          HistoryStatus: Uint8Array.fromHex(''),
          HistoryEntries: Uint8Array.fromHex(''),
          HistoryRequest: Uint8Array.fromHex(''),
          HistorySetTime: Uint8Array.fromHex(''),
          TimesOpened: 0,
          LastEvent: 0,
          ResetTotal: 0,
          // Normal attributes
          RLoc: 46080,
        },
        {
          ConfigDataGetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataGetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetConfigData(isFabricFiltered);
          },

          ConfigDataSetAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`ConfigDataSetAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          ConfigDataSetAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`ConfigDataSetAttributeSetter [${value.toHex()}] ${attributes.ConfigDataSet} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetConfigData(value);
          },

          HistoryStatusAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryStatusAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryStatus(isFabricFiltered);
          },

          HistoryEntriesAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryEntriesAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetHistoryEntries();
          },

          HistorySetTimeAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistorySetTimeAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistorySetTimeAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistorySetTimeAttributeSetter ${value.toHex()} ${attributes.HistorySetTime} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistorySetTime(value);
          },

          HistoryRequestAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`HistoryRequestAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return Uint8Array.fromHex('');
          },
          HistoryRequestAttributeSetter: (value: Uint8Array, { attributes, endpoint, session }) => {
            log.debug(`HistoryRequestAttributeSetter ${value.toHex()} ${attributes.HistoryRequest} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetHistoryRequest(value);
          },

          LastEventAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastEventAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastEvent();
          },

          TimesOpenedAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`TimesOpenedAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetimesOpened();
          },

          ResetTotalAttributeGetter: ({ session, isFabricFiltered }) => {
            log.debug(`LastResetTotalAttributeGetter session: ${session?.name} ${isFabricFiltered?.valueOf()}`);
            return history.OnGetLastReset();
          },
          ResetTotalAttributeSetter: (value: number, { attributes, endpoint, session }) => {
            log.debug(`LastResetTotalAttributeSetter ${value} ${attributes.ResetTotal} endpoint: ${endpoint?.name} session: ${session?.name}`);
            return history.OnSetLastReset(value);
          },
        },
        {},
      ),
    );
  }

  /**
   * Get a default IdentifyCluster server.
   */
  getDefaultIdentifyClusterServer() {
    return ClusterServer(
      IdentifyCluster,
      {
        identifyTime: 0,
        identifyType: Identify.IdentifyType.None,
      },
      {
        identify: async (data) => {
          this.log.debug('Matter command: Identify');
          await this.commandHandler.executeHandler('identify', data);
        },
      },
    );
  }

  /**
   * Creates a default IdentifyCluster server.
   */
  createDefaultIdentifyClusterServer() {
    this.addClusterServer(this.getDefaultIdentifyClusterServer());
  }

  /**
   * Get a default IdentifyCluster server.
   */
  getDefaultGroupsClusterServer() {
    return createDefaultGroupsClusterServer();
  }

  /**
   * Creates a default groups cluster server and adds it to the device.
   */
  createDefaultGroupsClusterServer() {
    this.addClusterServer(this.getDefaultGroupsClusterServer());
  }

  /**
   * Get a default scenes cluster server and adds it to the current instance.
   */
  getDefaultScenesClusterServer() {
    return createDefaultScenesClusterServer();
  }

  /**
   * Creates a default scenes cluster server and adds it to the current instance.
   */
  createDefaultScenesClusterServer() {
    this.addClusterServer(this.getDefaultScenesClusterServer());
  }

  /**
   * Creates a unique identifier based on the provided parameters.
   * @param param1 - The first parameter.
   * @param param2 - The second parameter.
   * @param param3 - The third parameter.
   * @param param4 - The fourth parameter.
   * @returns A unique identifier generated using the MD5 hash algorithm.
   */
  private createUniqueId(param1: string, param2: string, param3: string, param4: string) {
    const hash = createHash('md5');
    hash.update(param1 + param2 + param3 + param4);
    return hash.digest('hex');
  }

  /**
   * Get a default Basic Information Cluster Server.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The vendor name of the device.
   * @param productId - The product ID of the device.
   * @param productName - The product name of the device.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  getDefaultBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productId: number,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    return ClusterServer(
      BasicInformationCluster,
      {
        dataModelRevision: 1,
        location: 'XX',
        vendorId: VendorId(vendorId),
        vendorName: vendorName.slice(0, 32),
        productId: productId,
        productName: productName.slice(0, 32),
        productLabel: deviceName.slice(0, 64),
        nodeLabel: deviceName.slice(0, 32),
        serialNumber: serialNumber.slice(0, 32),
        uniqueId: this.createUniqueId(deviceName, serialNumber, vendorName, productName),
        softwareVersion,
        softwareVersionString: softwareVersionString.slice(0, 64),
        hardwareVersion,
        hardwareVersionString: hardwareVersionString.slice(0, 64),
        reachable: true,
        capabilityMinima: { caseSessionsPerFabric: 3, subscriptionsPerFabric: 3 },
      },
      {},
      {
        startUp: true,
        shutDown: true,
        leave: true,
        reachableChanged: true,
      },
    );
  }
  /**
   * Creates a default Basic Information Cluster Server.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The vendor name of the device.
   * @param productId - The product ID of the device.
   * @param productName - The product name of the device.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  createDefaultBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productId: number,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    if (MatterbridgeDevice.bridgeMode === 'bridge') {
      this.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString);
      return;
    }
    this.addClusterServer(this.getDefaultBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productId, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString));
  }

  /**
   * Get a default BridgedDeviceBasicInformationClusterServer.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The name of the vendor.
   * @param productName - The name of the product.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  getDefaultBridgedDeviceBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    return ClusterServer(
      BridgedDeviceBasicInformationCluster,
      {
        vendorId: vendorId !== undefined ? VendorId(vendorId) : undefined, // 4874
        vendorName: vendorName.slice(0, 32),
        productId: 0x8000,
        productName: productName.slice(0, 32),
        productLabel: deviceName.slice(0, 64),
        nodeLabel: deviceName.slice(0, 32),
        serialNumber: serialNumber.slice(0, 32),
        uniqueId: this.createUniqueId(deviceName, serialNumber, vendorName, productName),
        softwareVersion,
        softwareVersionString: softwareVersionString.slice(0, 64),
        hardwareVersion,
        hardwareVersionString: hardwareVersionString.slice(0, 64),
        reachable: true,
      },
      {},
      {
        reachableChanged: true,
      },
    );
  }

  /**
   * Creates a default BridgedDeviceBasicInformationClusterServer.
   *
   * @param deviceName - The name of the device.
   * @param serialNumber - The serial number of the device.
   * @param vendorId - The vendor ID of the device.
   * @param vendorName - The name of the vendor.
   * @param productName - The name of the product.
   * @param softwareVersion - The software version of the device. Default is 1.
   * @param softwareVersionString - The software version string of the device. Default is 'v.1.0.0'.
   * @param hardwareVersion - The hardware version of the device. Default is 1.
   * @param hardwareVersionString - The hardware version string of the device. Default is 'v.1.0.0'.
   */
  createDefaultBridgedDeviceBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number,
    vendorName: string,
    productName: string,
    softwareVersion = 1,
    softwareVersionString = '1.0.0',
    hardwareVersion = 1,
    hardwareVersionString = '1.0.0',
  ) {
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.addClusterServer(this.getDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString));
  }

  /**
   * Get a default Electrical Energy Measurement Cluster Server.
   *
   * @param energy - The total consumption value.
   */
  getDefaultPowerTopologyClusterServer() {
    return ClusterServer(PowerTopologyCluster.with(PowerTopology.Feature.TreeTopology), {}, {}, {});
  }

  /**
   * Get a default Electrical Energy Measurement Cluster Server.
   *
   * @param energy - The total consumption value.
   */
  getDefaultElectricalEnergyMeasurementClusterServer(energy = 0) {
    return ClusterServer(
      ElectricalEnergyMeasurementCluster.with(ElectricalEnergyMeasurement.Feature.ImportedEnergy, ElectricalEnergyMeasurement.Feature.ExportedEnergy, ElectricalEnergyMeasurement.Feature.CumulativeEnergy),
      {
        accuracy: {
          measurementType: MeasurementType.ElectricalEnergy,
          measured: true,
          minMeasuredValue: 0,
          maxMeasuredValue: 0,
          accuracyRanges: [{ rangeMin: 0, rangeMax: 2 ** 62, fixedMin: 10, fixedMax: 10, fixedTypical: 0 }],
        },
        cumulativeEnergyImported: { energy },
        cumulativeEnergyExported: null,
      },
      {},
      {
        cumulativeEnergyMeasured: true,
      },
    );
  }

  /**
   * Get a default Electrical Power Measurement Cluster Server.
   *
   * @param energy - The total consumption value.
   */
  getDefaultElectricalPowerMeasurementClusterServer(voltage = 0, current = 0, power = 0) {
    return ClusterServer(
      ElectricalPowerMeasurementCluster.with(ElectricalPowerMeasurement.Feature.AlternatingCurrent),
      {
        powerMode: ElectricalPowerMeasurement.PowerMode.Ac,
        numberOfMeasurementTypes: 3,
        accuracy: [
          {
            measurementType: MeasurementType.Voltage,
            measured: true,
            minMeasuredValue: 0,
            maxMeasuredValue: 100,
            accuracyRanges: [{ rangeMin: 0, rangeMax: 2 ** 62, fixedMin: 10, fixedMax: 10, fixedTypical: 0 }],
          },
          {
            measurementType: MeasurementType.ActiveCurrent,
            measured: true,
            minMeasuredValue: 0,
            maxMeasuredValue: 100,
            accuracyRanges: [{ rangeMin: 0, rangeMax: 2 ** 62, fixedMin: 10, fixedMax: 10, fixedTypical: 0 }],
          },
          {
            measurementType: MeasurementType.ActivePower,
            measured: true,
            minMeasuredValue: 0,
            maxMeasuredValue: 100,
            accuracyRanges: [{ rangeMin: 0, rangeMax: 2 ** 62, fixedMin: 10, fixedMax: 10, fixedTypical: 0 }],
          },
        ],
        voltage: voltage,
        activeCurrent: current,
        activePower: power,
      },
      {},
      {},
    );
  }

  /**
   * @deprecated This method is deprecated and will be removed in a future version.
   * Get a default Electrical Measurement Cluster Server.
   *
   * @param voltage - The RMS voltage value.
   * @param current - The RMS current value.
   * @param power - The active power value.
   * @param consumption - The total active power consumption value.
   */
  getDefaultElectricalMeasurementClusterServer(voltage = 0, current = 0, power = 0, consumption = 0) {
    return ClusterServer(
      ElectricalMeasurementCluster,
      {
        rmsVoltage: voltage,
        rmsCurrent: current,
        activePower: power,
        totalActivePower: consumption,
      },
      {},
      {},
    );
  }

  /**
   * @deprecated This method is deprecated and will be removed in a future version.
   * Creates a default Electrical Measurement Cluster Server.
   *
   * @param voltage - The RMS voltage value.
   * @param current - The RMS current value.
   * @param power - The active power value.
   * @param consumption - The total active power consumption value.
   */
  createDefaultElectricalMeasurementClusterServer(voltage = 0, current = 0, power = 0, consumption = 0) {
    this.addClusterServer(this.getDefaultElectricalMeasurementClusterServer(voltage, current, power, consumption));
  }

  /**
   * Creates a default Dummy Thread Network Diagnostics Cluster server.
   *
   * @remarks
   * This method adds a cluster server used only to give the networkName to Eve app.
   *
   * @returns void
   */
  createDefaultDummyThreadNetworkDiagnosticsClusterServer() {
    this.addClusterServer(
      ClusterServer(
        ThreadNetworkDiagnosticsCluster.with(ThreadNetworkDiagnostics.Feature.PacketCounts, ThreadNetworkDiagnostics.Feature.ErrorCounts),
        {
          channel: 1,
          routingRole: ThreadNetworkDiagnostics.RoutingRole.Router,
          networkName: 'MyMatterThread',
          panId: 0,
          extendedPanId: 0,
          meshLocalPrefix: null,
          neighborTable: [],
          routeTable: [],
          partitionId: null,
          weighting: null,
          dataVersion: null,
          stableDataVersion: null,
          leaderRouterId: null,
          securityPolicy: null,
          channelPage0Mask: null,
          operationalDatasetComponents: null,
          overrunCount: 0,
          activeNetworkFaults: [],
        },
        {
          resetCounts: async (data) => {
            this.log.debug('Matter command: resetCounts');
            await this.commandHandler.executeHandler('resetCounts', data);
          },
        },
        {},
      ),
    );
  }

  /**
   * Get a default OnOff cluster server.
   *
   * @param onOff - The initial state of the OnOff cluster (default: false).
   */
  getDefaultOnOffClusterServer(onOff = false) {
    return ClusterServer(
      OnOffCluster,
      {
        onOff,
      },
      {
        on: async (data) => {
          this.log.debug('Matter command: on onOff:', data.attributes.onOff.getLocal());
          await this.commandHandler.executeHandler('on', data);
        },
        off: async (data) => {
          this.log.debug('Matter command: off onOff:', data.attributes.onOff.getLocal());
          await this.commandHandler.executeHandler('off', data);
        },
        toggle: async (data) => {
          this.log.debug('Matter command: toggle onOff:', data.attributes.onOff.getLocal());
          await this.commandHandler.executeHandler('toggle', data);
        },
      },
      {},
    );
  }

  /**
   * Creates a default OnOff cluster server.
   *
   * @param onOff - The initial state of the OnOff cluster (default: false).
   */
  createDefaultOnOffClusterServer(onOff = false) {
    this.addClusterServer(this.getDefaultOnOffClusterServer(onOff));
  }

  /**
   * Get a default level control cluster server.
   *
   * @param currentLevel - The current level (default: 0).
   */
  getDefaultLevelControlClusterServer(currentLevel = 0) {
    return ClusterServer(
      LevelControlCluster.with(LevelControl.Feature.OnOff),
      {
        currentLevel,
        onLevel: 0,
        options: {
          executeIfOff: false,
          coupleColorTempToLevel: false,
        },
      },
      {
        moveToLevel: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToLevel request:', request, 'attributes.currentLevel:', attributes.currentLevel.getLocal());
          await this.commandHandler.executeHandler('moveToLevel', { request, attributes, endpoint });
        },
        move: async () => {
          this.log.error('Matter command: move not implemented');
        },
        step: async () => {
          this.log.error('Matter command: step not implemented');
        },
        stop: async () => {
          this.log.error('Matter command: stop not implemented');
        },
        moveToLevelWithOnOff: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToLevelWithOnOff request:', request, 'attributes.currentLevel:', attributes.currentLevel.getLocal());
          await this.commandHandler.executeHandler('moveToLevelWithOnOff', { request, attributes, endpoint });
        },
        moveWithOnOff: async () => {
          this.log.error('Matter command: moveWithOnOff not implemented');
        },
        stepWithOnOff: async () => {
          this.log.error('Matter command: stepWithOnOff not implemented');
        },
        stopWithOnOff: async () => {
          this.log.error('Matter command: stopWithOnOff not implemented');
        },
      },
    );
  }

  /**
   * Creates a default level control cluster server.
   *
   * @param currentLevel - The current level (default: 0).
   */
  createDefaultLevelControlClusterServer(currentLevel = 0) {
    this.addClusterServer(this.getDefaultLevelControlClusterServer(currentLevel));
  }

  /**
   * Get a default color control cluster server.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getDefaultColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
        colorCapabilities: { xy: false, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
        currentHue,
        currentSaturation,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
      },
      {
        moveToHue: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToHue request:', request, 'attributes.currentHue:', attributes.currentHue.getLocal());
          // attributes.currentHue.setLocal(request.hue);
          this.commandHandler.executeHandler('moveToHue', { request, attributes, endpoint });
        },
        moveHue: async () => {
          this.log.error('Matter command: moveHue not implemented');
        },
        stepHue: async () => {
          this.log.error('Matter command: stepHue not implemented');
        },
        moveToSaturation: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToSaturation request:', request, 'attributes.currentSaturation:', attributes.currentSaturation.getLocal());
          // attributes.currentSaturation.setLocal(request.saturation);
          this.commandHandler.executeHandler('moveToSaturation', { request, attributes, endpoint });
        },
        moveSaturation: async () => {
          this.log.error('Matter command: moveSaturation not implemented');
        },
        stepSaturation: async () => {
          this.log.error('Matter command: stepSaturation not implemented');
        },
        moveToHueAndSaturation: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToHueAndSaturation request:', request, 'attributes.currentHue:', attributes.currentHue.getLocal(), 'attributes.currentSaturation:', attributes.currentSaturation.getLocal());
          // attributes.currentHue.setLocal(request.hue);
          // attributes.currentSaturation.setLocal(request.saturation);
          this.commandHandler.executeHandler('moveToHueAndSaturation', { request, attributes, endpoint });
        },
        stopMoveStep: async () => {
          this.log.error('Matter command: stopMoveStep not implemented');
        },
        moveToColorTemperature: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToColorTemperature request:', request, 'attributes.colorTemperatureMireds:', attributes.colorTemperatureMireds.getLocal());
          // attributes.colorTemperatureMireds.setLocal(request.colorTemperatureMireds);
          this.commandHandler.executeHandler('moveToColorTemperature', { request, attributes, endpoint });
        },
        moveColorTemperature: async () => {
          this.log.error('Matter command: moveColorTemperature not implemented');
        },
        stepColorTemperature: async () => {
          this.log.error('Matter command: stepColorTemperature not implemented');
        },
      },
      {},
    );
  }
  /**
   * Creates a default color control cluster server.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createDefaultColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getDefaultColorControlClusterServer(currentHue, currentSaturation, colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Get a default color control cluster server.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getDefaultXYColorControlClusterServer(currentX = 0, currentY = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.Xy, ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
        colorCapabilities: { xy: true, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
        currentHue: 0,
        currentSaturation: 0,
        currentX,
        currentY,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
      },
      {
        moveToColor: async (data) => {
          this.log.debug('Matter command: moveToColor request:', data.request, 'attributes.currentHue:', data.attributes.currentX.getLocal(), data.attributes.currentY.getLocal());
          this.commandHandler.executeHandler('moveToColor', data);
        },
        moveColor: async () => {
          this.log.error('Matter command: moveColor not implemented');
        },
        stepColor: async () => {
          this.log.error('Matter command: stepColor not implemented');
        },
        moveToHue: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToHue request:', request, 'attributes.currentHue:', attributes.currentHue.getLocal());
          this.commandHandler.executeHandler('moveToHue', { request, attributes, endpoint });
        },
        moveHue: async () => {
          this.log.error('Matter command: moveHue not implemented');
        },
        stepHue: async () => {
          this.log.error('Matter command: stepHue not implemented');
        },
        moveToSaturation: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToSaturation request:', request, 'attributes.currentSaturation:', attributes.currentSaturation.getLocal());
          this.commandHandler.executeHandler('moveToSaturation', { request, attributes, endpoint });
        },
        moveSaturation: async () => {
          this.log.error('Matter command: moveSaturation not implemented');
        },
        stepSaturation: async () => {
          this.log.error('Matter command: stepSaturation not implemented');
        },
        moveToHueAndSaturation: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToHueAndSaturation request:', request, 'attributes.currentHue:', attributes.currentHue.getLocal(), 'attributes.currentSaturation:', attributes.currentSaturation.getLocal());
          this.commandHandler.executeHandler('moveToHueAndSaturation', { request, attributes, endpoint });
        },
        stopMoveStep: async () => {
          this.log.error('Matter command: stopMoveStep not implemented');
        },
        moveToColorTemperature: async ({ request, attributes, endpoint }) => {
          this.log.debug('Matter command: moveToColorTemperature request:', request, 'attributes.colorTemperatureMireds:', attributes.colorTemperatureMireds.getLocal());
          this.commandHandler.executeHandler('moveToColorTemperature', { request, attributes, endpoint });
        },
        moveColorTemperature: async () => {
          this.log.error('Matter command: moveColorTemperature not implemented');
        },
        stepColorTemperature: async () => {
          this.log.error('Matter command: stepColorTemperature not implemented');
        },
      },
      {},
    );
  }
  /**
   * Creates a default color control cluster server.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createDefaultXYColorControlClusterServer(currentX = 0, currentY = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getDefaultXYColorControlClusterServer(currentX, currentY, colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Get a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0.
   */
  getDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    return ClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition),
      {
        type: WindowCovering.WindowCoveringType.Rollershade,
        configStatus: {
          operational: true,
          onlineReserved: true,
          liftMovementReversed: false,
          liftPositionAware: true,
          tiltPositionAware: false,
          liftEncoderControlled: false,
          tiltEncoderControlled: false,
        },
        operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
        endProductType: WindowCovering.EndProductType.RollerShade,
        mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
        targetPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
        currentPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
        installedClosedLimitLift: 10000,
        installedOpenLimitLift: 0,
      },
      {
        upOrOpen: async (data) => {
          this.log.debug('Matter command: upOrOpen');
          await this.commandHandler.executeHandler('upOrOpen', data);
        },
        downOrClose: async (data) => {
          this.log.debug('Matter command: downOrClose');
          await this.commandHandler.executeHandler('downOrClose', data);
        },
        stopMotion: async (data) => {
          this.log.debug('Matter command: stopMotion');
          await this.commandHandler.executeHandler('stopMotion', data);
        },
        goToLiftPercentage: async (data) => {
          this.log.debug(
            `Matter command: goToLiftPercentage: ${data.request.liftPercent100thsValue} current: ${data.attributes.currentPositionLiftPercent100ths?.getLocal()} ` +
              `target: ${data.attributes.targetPositionLiftPercent100ths?.getLocal()} status: ${data.attributes.operationalStatus.getLocal().lift}`,
          );
          await this.commandHandler.executeHandler('goToLiftPercentage', data);
        },
      },
      {},
    );
  }
  /**
   * Creates a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0.
   */
  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.addClusterServer(this.getDefaultWindowCoveringClusterServer(positionPercent100ths));
  }

  /**
   * Sets the window covering target position as the current position and stops the movement.
   */
  setWindowCoveringTargetAsCurrentAndStopped(endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCoveringCluster = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (windowCoveringCluster) {
      const position = windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
      if (position !== null) {
        windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(position);
        windowCoveringCluster.setOperationalStatusAttribute({
          global: WindowCovering.MovementStatus.Stopped,
          lift: WindowCovering.MovementStatus.Stopped,
          tilt: 0,
        });
      }
      this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to ${position} and operationalStatus to Stopped.`);
    }
  }

  /**
   * Sets the current and target status of a window covering.
   * @param current - The current position of the window covering.
   * @param target - The target position of the window covering.
   * @param status - The movement status of the window covering.
   */
  setWindowCoveringCurrentTargetStatus(current: number, target: number, status: WindowCovering.MovementStatus, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCoveringCluster = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (windowCoveringCluster) {
      windowCoveringCluster.setCurrentPositionLiftPercent100thsAttribute(current);
      windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(target);
      windowCoveringCluster.setOperationalStatusAttribute({
        global: status,
        lift: status,
        tilt: 0,
      });
    }
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${current}, targetPositionLiftPercent100ths: ${target} and operationalStatus: ${status}.`);
  }

  /**
   * Sets the status of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status to set.
   */
  setWindowCoveringStatus(status: WindowCovering.MovementStatus, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCovering = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (!windowCovering) return;
    windowCovering.setOperationalStatusAttribute({ global: status, lift: status, tilt: 0 });
    this.log.debug(`Set WindowCovering operationalStatus: ${status}`);
  }

  /**
   * Retrieves the status of the window covering.
   * @returns The global operational status of the window covering.
   */
  getWindowCoveringStatus(endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCovering = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.AbsolutePosition));
    if (!windowCovering) return undefined;
    const status = windowCovering.getOperationalStatusAttribute();
    this.log.debug(`Get WindowCovering operationalStatus: ${status.global}`);
    return status.global;
  }

  /**
   * Sets the target and current position of the window covering.
   *
   * @param position - The position to set, specified as a number.
   */
  setWindowCoveringTargetAndCurrentPosition(position: number, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCovering = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
    if (!windowCovering) return;
    windowCovering.setCurrentPositionLiftPercent100thsAttribute(position);
    windowCovering.setTargetPositionLiftPercent100thsAttribute(position);
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${position} and targetPositionLiftPercent100ths: ${position}.`);
  }

  /**
   * Get a default door lock cluster server.
   *
   * @remarks
   * This method adds a cluster server for a door lock cluster with default settings.
   *
   */
  getDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.Deadbolt) {
    return ClusterServer(
      DoorLockCluster,
      {
        operatingMode: DoorLock.OperatingMode.Normal,
        lockState,
        lockType,
        actuatorEnabled: false,
        supportedOperatingModes: { normal: true, vacation: false, privacy: false, noRemoteLockUnlock: false, passage: false },
      },
      {
        lockDoor: async (data) => {
          this.log.debug('Matter command: lockDoor', data.request);
          await this.commandHandler.executeHandler('lockDoor', data);
        },
        unlockDoor: async (data) => {
          this.log.debug('Matter command: unlockDoor', data.request);
          await this.commandHandler.executeHandler('unlockDoor', data);
        },
      },
      {
        doorLockAlarm: true,
        lockOperation: true,
        lockOperationError: true,
      },
    );
  }
  /**
   * Creates a default door lock cluster server.
   *
   * @remarks
   * This method adds a cluster server for a door lock cluster with default settings.
   *
   */
  createDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.Deadbolt) {
    this.addClusterServer(this.getDefaultDoorLockClusterServer(lockState, lockType));
  }

  /**
   * Get a default momentary switch cluster server.
   *
   * @remarks
   * This method adds a cluster server with default momentary switch features and configurations suitable for (AppleHome) Single Double Long automations.
   */
  getDefaultSwitchClusterServer() {
    return ClusterServer(
      SwitchCluster.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress),
      {
        numberOfPositions: 2,
        currentPosition: 0,
        multiPressMax: 2,
      },
      {},
      {
        initialPress: true,
        longPress: true,
        shortRelease: true,
        longRelease: true,
        multiPressOngoing: true,
        multiPressComplete: true,
      },
    );
  }

  /**
   * Creates a default momentary switch cluster server.
   *
   * @remarks
   * This method adds a cluster server with default momentary switch features and configurations.
   */
  createDefaultSwitchClusterServer() {
    this.addClusterServer(this.getDefaultSwitchClusterServer());
    this.addFixedLabel('orientation', 'Switch');
    this.addFixedLabel('label', 'Switch');
  }

  /**
   * Get a default latching switch cluster server.
   *
   * @remarks
   * This method adds a cluster server with default latching switch features and configuration.
   */
  getDefaultLatchingSwitchClusterServer() {
    return ClusterServer(
      SwitchCluster.with(Switch.Feature.LatchingSwitch),
      {
        numberOfPositions: 2,
        currentPosition: 0,
      },
      {},
      {
        switchLatched: true,
      },
    );
  }

  /**
   * Creates a default latching switch cluster server.
   *
   * @remarks
   * This method adds a cluster server with default latching switch features and configuration.
   */
  createDefaultLatchingSwitchClusterServer() {
    this.addClusterServer(this.getDefaultLatchingSwitchClusterServer());
    this.addFixedLabel('orientation', 'Switch');
    this.addFixedLabel('label', 'Switch');
  }

  getDefaultModeSelectClusterServer(description: string, supportedModes: ModeSelect.ModeOptionStruct[], currentMode = 0, startUpMode = 0) {
    return ClusterServer(
      ModeSelectCluster,
      {
        description: description,
        standardNamespace: null,
        supportedModes: supportedModes,
        currentMode: currentMode,
        startUpMode: startUpMode,
      },
      {
        changeToMode: async (data) => {
          this.log.debug('Matter command: changeToMode', data.request);
          await this.commandHandler.executeHandler('changeToMode', data);
        },
      },
    );
  }
  createDefaultModeSelectClusterServer(endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    endpoint.addClusterServer(
      this.getDefaultModeSelectClusterServer('Mode select', [
        { label: 'Mode 0', mode: 0, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 0 }] },
        { label: 'Mode 1', mode: 1, semanticTags: [{ mfgCode: VendorId(0xfff1), value: 1 }] },
      ]),
    );
  }

  /**
   * Get a default occupancy sensing cluster server.
   *
   * @param occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
   */
  getDefaultOccupancySensingClusterServer(occupied = false) {
    return ClusterServer(
      OccupancySensingCluster,
      {
        occupancy: { occupied },
        occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
        occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
        pirOccupiedToUnoccupiedDelay: 30,
      },
      {},
    );
  }
  /**
   * Creates a default occupancy sensing cluster server.
   *
   * @param occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
   */
  createDefaultOccupancySensingClusterServer(occupied = false) {
    this.addClusterServer(this.getDefaultOccupancySensingClusterServer(occupied));
  }

  /**
   * Get a default Illuminance Measurement Cluster Server.
   *
   * @param measuredValue - The measured value of illuminance.
   */
  getDefaultIlluminanceMeasurementClusterServer(measuredValue = 0) {
    return ClusterServer(
      IlluminanceMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default Illuminance Measurement Cluster Server.
   *
   * @param measuredValue - The measured value of illuminance.
   */
  createDefaultIlluminanceMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultIlluminanceMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default flow measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  getDefaultFlowMeasurementClusterServer(measuredValue = 0) {
    return ClusterServer(
      FlowMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default flow measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  createDefaultFlowMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultFlowMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default temperature measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  getDefaultTemperatureMeasurementClusterServer(measuredValue = 0) {
    return ClusterServer(
      TemperatureMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default temperature measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature.
   */
  createDefaultTemperatureMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultTemperatureMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default RelativeHumidityMeasurementCluster server.
   *
   * @param measuredValue - The measured value of the relative humidity.
   */
  getDefaultRelativeHumidityMeasurementClusterServer(measuredValue = 0) {
    return ClusterServer(
      RelativeHumidityMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default RelativeHumidityMeasurementCluster server.
   *
   * @param measuredValue - The measured value of the relative humidity.
   */
  createDefaultRelativeHumidityMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultRelativeHumidityMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default Pressure Measurement Cluster Server.
   *
   * @param measuredValue - The measured value for the pressure.
   */
  getDefaultPressureMeasurementClusterServer(measuredValue = 1000) {
    return ClusterServer(
      PressureMeasurementCluster,
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        tolerance: 0,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default Pressure Measurement Cluster Server.
   *
   * @param measuredValue - The measured value for the pressure.
   */
  createDefaultPressureMeasurementClusterServer(measuredValue = 1000) {
    this.addClusterServer(this.getDefaultPressureMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default boolean state cluster server.
   *
   * @param contact - Optional boolean value indicating the contact state. Defaults to `true` if not provided.
   */
  getDefaultBooleanStateClusterServer(contact?: boolean) {
    return ClusterServer(
      BooleanStateCluster,
      {
        stateValue: contact ?? true, // true=contact false=no_contact
      },
      {},
      {
        stateChange: true,
      },
    );
  }

  /**
   * Creates a default boolean state configuration cluster server.
   *
   * @param contact - Optional boolean value indicating the contact state. Defaults to `true` if not provided.
   */
  createDefaultBooleanStateClusterServer(contact?: boolean) {
    this.addClusterServer(this.getDefaultBooleanStateClusterServer(contact));
  }

  /**
   * Get a default boolean state configuration cluster server.
   *
   * @param contact - Optional boolean value indicating the sensor fault state. Defaults to `false` if not provided.
   */
  getDefaultBooleanStateConfigurationClusterServer(sensorFault = false) {
    return ClusterServer(
      BooleanStateConfigurationCluster.with(BooleanStateConfiguration.Feature.Visual, BooleanStateConfiguration.Feature.Audible, BooleanStateConfiguration.Feature.SensitivityLevel),
      {
        currentSensitivityLevel: 0,
        supportedSensitivityLevels: 2,
        defaultSensitivityLevel: 0,
        alarmsActive: { visual: false, audible: false },
        alarmsEnabled: { visual: false, audible: false },
        alarmsSupported: { visual: true, audible: true },
        // alarmsSuppressed: { visual: false, audible: false },
        sensorFault: { generalFault: sensorFault },
      },
      {
        enableDisableAlarm: async ({ request, attributes }) => {
          this.log.debug('Matter command: enableDisableAlarm', request);
          await this.commandHandler.executeHandler('enableDisableAlarm', { request, attributes });
        },
      },
      {
        alarmsStateChanged: true,
        sensorFault: true,
      },
    );
  }
  /**
   * Creates a default boolean state configuration cluster server.
   *
   * @param contact - Optional boolean value indicating the sensor fault state. Defaults to `false` if not provided.
   */
  createDefaultBooleanStateConfigurationClusterServer(sensorFault = false) {
    this.addClusterServer(this.getDefaultBooleanStateConfigurationClusterServer(sensorFault));
  }

  /**
   * Get a default power source replaceable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   * @param batReplacementDescription - The battery replacement description (default: 'Battery type').
   * @param batQuantity - The battery quantity (default: 1).
   */
  getDefaultPowerSourceReplaceableBatteryClusterServer(batPercentRemaining = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage = 1500, batReplacementDescription = 'Battery type', batQuantity = 1) {
    return ClusterServer(
      PowerSourceCluster.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable),
      {
        status: PowerSource.PowerSourceStatus.Active,
        order: 0,
        description: 'Primary battery',
        batVoltage,
        batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
        batChargeLevel,
        batReplacementNeeded: false,
        batReplaceability: PowerSource.BatReplaceability.UserReplaceable,
        activeBatFaults: undefined,
        batReplacementDescription,
        batQuantity,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default power source replaceable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   * @param batReplacementDescription - The battery replacement description (default: 'Battery type').
   * @param batQuantity - The battery quantity (default: 1).
   */
  createDefaultPowerSourceReplaceableBatteryClusterServer(batPercentRemaining = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage = 1500, batReplacementDescription = 'Battery type', batQuantity = 1) {
    this.addClusterServer(this.getDefaultPowerSourceReplaceableBatteryClusterServer(batPercentRemaining, batChargeLevel, batVoltage, batReplacementDescription, batQuantity));
  }

  /**
   * Get a default power source rechargeable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   */
  getDefaultPowerSourceRechargeableBatteryClusterServer(batPercentRemaining = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage = 1500) {
    return ClusterServer(
      PowerSourceCluster.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable),
      {
        status: PowerSource.PowerSourceStatus.Active,
        order: 0,
        description: 'Primary battery',
        batVoltage,
        batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
        batTimeRemaining: 1,
        batChargeLevel,
        batReplacementNeeded: false,
        batReplaceability: PowerSource.BatReplaceability.Unspecified,
        activeBatFaults: undefined,
        batChargeState: PowerSource.BatChargeState.IsNotCharging,
        batFunctionalWhileCharging: true,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default power source rechargeable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   */
  createDefaultPowerSourceRechargeableBatteryClusterServer(batPercentRemaining = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage = 1500) {
    this.addClusterServer(this.getDefaultPowerSourceRechargeableBatteryClusterServer(batPercentRemaining, batChargeLevel, batVoltage));
  }

  /**
   * Get a default power source wired cluster server.
   *
   * @param wiredCurrentType - The type of wired current (default: PowerSource.WiredCurrentType.Ac)
   */
  getDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) {
    return ClusterServer(
      PowerSourceCluster.with(PowerSource.Feature.Wired),
      {
        wiredCurrentType,
        description: wiredCurrentType === PowerSource.WiredCurrentType.Ac ? 'AC Power' : 'DC Power',
        status: PowerSource.PowerSourceStatus.Active,
        order: 0,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default power source wired cluster server.
   *
   * @param wiredCurrentType - The type of wired current (default: PowerSource.WiredCurrentType.Ac)
   */
  createDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) {
    this.addClusterServer(this.getDefaultPowerSourceWiredClusterServer(wiredCurrentType));
  }

  /**
   * @deprecated This function is deprecated by Matter 1.3 spec and will be removed in a future version.
   */
  createDefaultPowerSourceConfigurationClusterServer(endpointNumber?: number) {
    this.addClusterServer(
      ClusterServer(
        PowerSourceConfigurationCluster,
        {
          sources: endpointNumber ? [EndpointNumber(endpointNumber)] : [],
        },
        {},
        {},
      ),
    );
  }

  /**
   * Get a default air quality cluster server.
   *
   * @param airQuality The air quality type. Defaults to `AirQuality.AirQualityType.Unknown`.
   */
  getDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityType.Unknown) {
    return ClusterServer(
      AirQualityCluster.with(AirQuality.Feature.FairAirQuality, AirQuality.Feature.ModerateAirQuality, AirQuality.Feature.VeryPoorAirQuality),
      {
        airQuality,
      },
      {},
      {},
    );
  }
  /**
   * Creates a default air quality cluster server.
   *
   * @param airQuality The air quality type. Defaults to `AirQuality.AirQualityType.Unknown`.
   */
  createDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityType.Unknown) {
    this.addClusterServer(this.getDefaultAirQualityClusterServer(airQuality));
  }

  /**
   * Get a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  getDefaultTvocMeasurementClusterServer(measuredValue = 0) {
    return ClusterServer(
      TvocMeasurementCluster.with(TvocMeasurement.Feature.NumericMeasurement),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  createDefaultTvocMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultTvocMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default thermostat cluster server with the specified parameters.
   *
   * @param localTemperature - The local temperature value in degrees Celsius. Defaults to 23.
   * @param occupiedHeatingSetpoint - The occupied heating setpoint value in degrees Celsius. Defaults to 21.
   * @param occupiedCoolingSetpoint - The occupied cooling setpoint value in degrees Celsius. Defaults to 25.
   * @param minSetpointDeadBand - The minimum setpoint dead band value.
   */
  getDefaultThermostatClusterServer(localTemperature = 23, occupiedHeatingSetpoint = 21, occupiedCoolingSetpoint = 25, minSetpointDeadBand = 1) {
    return ClusterServer(
      ThermostatCluster.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode),
      {
        localTemperature: localTemperature * 100,
        occupiedHeatingSetpoint: occupiedHeatingSetpoint * 100,
        occupiedCoolingSetpoint: occupiedCoolingSetpoint * 100,
        minHeatSetpointLimit: 0,
        maxHeatSetpointLimit: 5000,
        absMinHeatSetpointLimit: 0,
        absMaxHeatSetpointLimit: 5000,
        minCoolSetpointLimit: 0,
        maxCoolSetpointLimit: 5000,
        absMinCoolSetpointLimit: 0,
        absMaxCoolSetpointLimit: 5000,
        minSetpointDeadBand,
        systemMode: Thermostat.SystemMode.Off,
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingAndHeating,
        thermostatRunningMode: Thermostat.ThermostatRunningMode.Off,
      },
      {
        setpointRaiseLower: async ({ request, attributes }) => {
          this.log.debug('Matter command: setpointRaiseLower', request);
          await this.commandHandler.executeHandler('setpointRaiseLower', { request, attributes });
        },
      },
      {},
    );
  }

  /**
   * Creates and adds a default thermostat cluster server to the device.
   *
   * @param localTemperature - The local temperature value.
   * @param occupiedHeatingSetpoint - The occupied heating setpoint value.
   * @param occupiedCoolingSetpoint - The occupied cooling setpoint value.
   * @param minSetpointDeadBand - The minimum setpoint dead band value.
   */
  createDefaultThermostatClusterServer(localTemperature = 23, occupiedHeatingSetpoint = 21, occupiedCoolingSetpoint = 25, minSetpointDeadBand = 1) {
    this.addClusterServer(this.getDefaultThermostatClusterServer(localTemperature, occupiedHeatingSetpoint, occupiedCoolingSetpoint, minSetpointDeadBand));
  }

  /**
   * Get a default dummy time sync cluster server. Only needed to create a thermostat.
   */
  getDefaultTimeSyncClusterServer() {
    return ClusterServer(
      TimeSyncCluster.with(TimeSync.Feature.TimeZone),
      {
        utcTime: null,
        granularity: TimeSync.Granularity.NoTimeGranularity,
        timeZone: [{ offset: 0, validAt: 0 }],
        trustedTimeNodeId: null,
        dstOffset: [],
        localTime: null,
        timeZoneDatabase: true,
      },
      {
        setUtcTime: async ({ request, attributes }) => {
          this.log.debug('Matter command: setUtcTime', request);
          await this.commandHandler.executeHandler('setUtcTime', { request, attributes });
        },
      },
      {
        dstTableEmpty: true,
        dstStatus: true,
        timeZoneStatus: true,
      },
    );
  }
  /**
   * Creates a default dummy time sync cluster server. Only needed to create a thermostat.
   */
  createDefaultTimeSyncClusterServer() {
    this.addClusterServer(this.getDefaultTimeSyncClusterServer());
  }

  /**
   * Returns the default SmokeCOAlarm Cluster Server.
   *
   * @param smokeState - The state of the smoke alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @param coState - The state of the CO alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @returns The default SmokeCOAlarmClusterServer.
   */
  getDefaultSmokeCOAlarmClusterServer(smokeState = SmokeCoAlarm.AlarmState.Normal, coState = SmokeCoAlarm.AlarmState.Normal) {
    return ClusterServer(
      SmokeCoAlarmCluster.with(SmokeCoAlarm.Feature.SmokeAlarm, SmokeCoAlarm.Feature.CoAlarm),
      {
        smokeState,
        coState,
        expressedState: SmokeCoAlarm.ExpressedState.Normal,
        batteryAlert: SmokeCoAlarm.AlarmState.Normal,
        deviceMuted: SmokeCoAlarm.MuteState.NotMuted,
        testInProgress: false,
        hardwareFaultAlert: false,
        endOfServiceAlert: SmokeCoAlarm.EndOfService.Normal,
        interconnectSmokeAlarm: SmokeCoAlarm.AlarmState.Normal,
        interconnectCoAlarm: SmokeCoAlarm.AlarmState.Normal,
      },
      {
        selfTestRequest: async ({ request, attributes }) => {
          this.log.debug('Matter command: selfTestRequest');
          await this.commandHandler.executeHandler('selfTestRequest', { request, attributes });
        },
      },
      {
        smokeAlarm: true,
        interconnectSmokeAlarm: true,
        coAlarm: true,
        interconnectCoAlarm: true,
        lowBattery: true,
        hardwareFault: true,
        endOfService: true,
        selfTestComplete: true,
        alarmMuted: true,
        muteEnded: true,
        allClear: true,
      },
    );
  }
  /**
   * Create the default SmokeCOAlarm Cluster Server.
   *
   * @param smokeState - The state of the smoke alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @param coState - The state of the CO alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @returns The default SmokeCOAlarmClusterServer.
   */
  createDefaultSmokeCOAlarmClusterServer(smokeState = SmokeCoAlarm.AlarmState.Normal, coState = SmokeCoAlarm.AlarmState.Normal) {
    this.addClusterServer(this.getDefaultSmokeCOAlarmClusterServer(smokeState, coState));
  }

  /**
   * Returns the default Carbon Monoxide Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultCarbonMonoxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      CarbonMonoxideConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Carbon Monoxide Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaultCarbonMonoxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultCarbonMonoxideConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Carbon Dioxide Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultCarbonDioxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      CarbonDioxideConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Carbon Dioxide Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaultCarbonDioxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultCarbonDioxideConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Formaldehyde Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultFormaldehydeConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      FormaldehydeConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Formaldehyde Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaultFormaldehydeConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultFormaldehydeConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Pm1 Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultPm1ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      Pm1ConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Pm1 Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaulPm1ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultPm1ConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Pm25 Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultPm25ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      Pm25ConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Pm25 Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaulPm25ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultPm25ConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Pm10 Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultPm10ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      Pm10ConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Pm10 Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaulPm10ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultPm10ConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Ozone Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultOzoneConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      OzoneConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Ozone Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaulOzoneConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultOzoneConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Radon Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultRadonConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      RadonConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Radon Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaulRadonConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultRadonConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default Nitrogen Dioxide Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   * @returns {ClusterServer} - The default Carbon Monoxide Concentration Measurement Cluster Server.
   */
  getDefaultNitrogenDioxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      NitrogenDioxideConcentrationMeasurementCluster.with('NumericMeasurement'),
      {
        measuredValue,
        minMeasuredValue: null,
        maxMeasuredValue: null,
        uncertainty: 0,
        measurementUnit,
        measurementMedium,
      },
      {},
      {},
    );
  }
  /**
   * Create the default Nitrogen Dioxide Concentration Measurement Cluster Server.
   *
   * @param {number} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement.
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The medium of measurement.
   */
  createDefaulNitrogenDioxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultNitrogenDioxideConcentrationMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Returns the default fan control cluster server rev 2.
   *
   * @param fanMode The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @returns The default fan control cluster server.
   */
  getDefaultFanControlClusterServer(fanMode = FanControl.FanMode.Off) {
    return ClusterServer(
      FanControlCluster.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto /* , FanControl.Feature.Step*/),
      {
        fanMode,
        fanModeSequence: FanControl.FanModeSequence.OffLowMedHighAuto,
        percentSetting: 0,
        percentCurrent: 0,
        speedMax: 100,
        speedSetting: 0,
        speedCurrent: 0,
      },
      {
        /*
        step: async ({ request, attributes }) => {
          this.log.debug('Matter command: step', request);
          await this.commandHandler.executeHandler('step', { request, attributes });
        },
        */
      },
      {},
    );
  }
  /**
   * Create the default fan control cluster server rev 2.
   *
   * @param fanMode The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @returns The default fan control cluster server.
   */
  createDefaultFanControlClusterServer(fanMode = FanControl.FanMode.Off) {
    this.addClusterServer(this.getDefaultFanControlClusterServer(fanMode));
  }

  // NOTE Support of Device Energy Management Cluster is provisional.
  getDefaultDeviceEnergyManagementClusterServer() {
    return ClusterServer(
      DeviceEnergyManagementCluster.with(DeviceEnergyManagement.Feature.Pausable, DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.StateForecastReporting),
      {
        esaType: DeviceEnergyManagement.EsaType.Other,
        esaCanGenerate: false,
        esaState: DeviceEnergyManagement.EsaState.Online,
        absMinPower: 0,
        absMaxPower: 0,
        optOutState: DeviceEnergyManagement.OptOutState.NoOptOut,
        forecast: null,
      },
      {
        pauseRequest: async ({ request, attributes }) => {
          this.log.debug('Matter command: pauseRequest', request);
          await this.commandHandler.executeHandler('pauseRequest', { request, attributes });
        },
        resumeRequest: async () => {
          this.log.debug('Matter command: resumeRequest');
          await this.commandHandler.executeHandler('resumeRequest');
        },
      },
      {
        paused: true,
        resumed: true,
      },
    );
  }

  // NOTE Support of Device Energy Management Mode Cluster is provisional.
  getDefaultDeviceEnergyManagementModeClusterServer() {
    return ClusterServer(
      DeviceEnergyManagementModeCluster,
      {
        esaType: DeviceEnergyManagement.EsaType.Other,
        esaCanGenerate: false,
        esaState: DeviceEnergyManagement.EsaState.Online,
        absMinPower: 0,
        absMaxPower: 0,
        optOutState: DeviceEnergyManagement.OptOutState.NoOptOut,
      },
      {},
      {},
    );
  }
}
