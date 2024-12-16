/**
 * This file contains the class MatterbridgeDevice.
 *
 * @file matterbridgeDevice.ts
 * @author Luca Liguori
 * @date 2023-12-29
 * @version 2.0.0
 *
 * Copyright 2023, 2024, 2025 Luca Liguori.
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
import {
  AirQuality,
  AirQualityCluster,
  BasicInformationCluster,
  BooleanState,
  BooleanStateCluster,
  BooleanStateConfiguration,
  BooleanStateConfigurationCluster,
  BridgedDeviceBasicInformationCluster,
  CarbonDioxideConcentrationMeasurement,
  CarbonDioxideConcentrationMeasurementCluster,
  CarbonMonoxideConcentrationMeasurement,
  CarbonMonoxideConcentrationMeasurementCluster,
  ColorControl,
  ColorControlCluster,
  ConcentrationMeasurement,
  Descriptor,
  DescriptorCluster,
  DeviceEnergyManagement,
  DeviceEnergyManagementCluster,
  DeviceEnergyManagementMode,
  DeviceEnergyManagementModeCluster,
  DoorLock,
  DoorLockCluster,
  ElectricalEnergyMeasurement,
  ElectricalEnergyMeasurementCluster,
  ElectricalPowerMeasurement,
  ElectricalPowerMeasurementCluster,
  FanControl,
  FanControlCluster,
  FlowMeasurement,
  FlowMeasurementCluster,
  FormaldehydeConcentrationMeasurement,
  FormaldehydeConcentrationMeasurementCluster,
  Groups,
  GroupsCluster,
  Identify,
  IdentifyCluster,
  IlluminanceMeasurement,
  IlluminanceMeasurementCluster,
  LevelControl,
  LevelControlCluster,
  ModeSelect,
  ModeSelectCluster,
  NitrogenDioxideConcentrationMeasurement,
  NitrogenDioxideConcentrationMeasurementCluster,
  OccupancySensing,
  OccupancySensingCluster,
  OnOff,
  OnOffCluster,
  OzoneConcentrationMeasurement,
  OzoneConcentrationMeasurementCluster,
  Pm10ConcentrationMeasurement,
  Pm10ConcentrationMeasurementCluster,
  Pm1ConcentrationMeasurement,
  Pm1ConcentrationMeasurementCluster,
  Pm25ConcentrationMeasurement,
  Pm25ConcentrationMeasurementCluster,
  PowerSource,
  PowerSourceCluster,
  PowerSourceConfigurationCluster,
  PowerTopology,
  PowerTopologyCluster,
  PressureMeasurement,
  PressureMeasurementCluster,
  PumpConfigurationAndControl,
  PumpConfigurationAndControlCluster,
  RadonConcentrationMeasurement,
  RadonConcentrationMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  SmokeCoAlarm,
  SmokeCoAlarmCluster,
  Switch,
  SwitchCluster,
  TemperatureMeasurement,
  TemperatureMeasurementCluster,
  Thermostat,
  ThermostatCluster,
  ThreadNetworkDiagnostics,
  ThreadNetworkDiagnosticsCluster,
  TimeSynchronization,
  TimeSynchronizationCluster,
  TotalVolatileOrganicCompoundsConcentrationMeasurement,
  TotalVolatileOrganicCompoundsConcentrationMeasurementCluster,
  ValveConfigurationAndControl,
  ValveConfigurationAndControlCluster,
  WindowCovering,
  WindowCoveringCluster,
} from '@matter/main/clusters';
import { Specification } from '@matter/main/model';
import { ClusterId, EndpointNumber, extendPublicHandlerMethods, VendorId, AtLeastOne, MakeMandatory } from '@matter/main';
import { MeasurementType, Semtag, getClusterNameById } from '@matter/main/types';

// @project-chip
import { Device, DeviceTypeDefinition, Endpoint, EndpointOptions } from '@project-chip/matter.js/device';
import { ClusterServerHandlers, GroupsClusterHandler, ClusterServer } from '@project-chip/matter.js/cluster';

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat, CYAN, YELLOW, db, hk, or, zb, debugStringify } from 'node-ansi-logger';

// Node.js modules
import { createHash } from 'crypto';
import { bridgedNode, MatterbridgeEndpointOptions } from './matterbridgeDeviceTypes.js';

interface MatterbridgeDeviceCommands {
  identify: MakeMandatory<ClusterServerHandlers<typeof Identify.Complete>['identify']>;
  triggerEffect: MakeMandatory<ClusterServerHandlers<typeof Identify.Complete>['triggerEffect']>;

  on: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['on']>;
  off: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['off']>;
  toggle: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['toggle']>;
  offWithEffect: MakeMandatory<ClusterServerHandlers<typeof OnOff.Complete>['offWithEffect']>;

  moveToLevel: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevel']>;
  moveToLevelWithOnOff: MakeMandatory<ClusterServerHandlers<typeof LevelControl.Complete>['moveToLevelWithOnOff']>;

  moveToColor: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToColor']>;
  moveColor: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveColor']>;
  stepColor: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepColor']>;
  moveToHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHue']>;
  moveHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveHue']>;
  stepHue: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepHue']>;
  moveToSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToSaturation']>;
  moveSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveSaturation']>;
  stepSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepSaturation']>;
  moveToHueAndSaturation: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToHueAndSaturation']>;
  moveToColorTemperature: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveToColorTemperature']>;
  moveColorTemperature: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['moveColorTemperature']>;
  stepColorTemperature: MakeMandatory<ClusterServerHandlers<typeof ColorControl.Complete>['stepColorTemperature']>;

  upOrOpen: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['upOrOpen']>;
  downOrClose: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['downOrClose']>;
  stopMotion: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['stopMotion']>;
  goToLiftPercentage: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['goToLiftPercentage']>;

  open: MakeMandatory<ClusterServerHandlers<typeof ValveConfigurationAndControl.Complete>['open']>;
  close: MakeMandatory<ClusterServerHandlers<typeof ValveConfigurationAndControl.Complete>['close']>;

  lockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['lockDoor']>;
  unlockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['unlockDoor']>;

  setpointRaiseLower: MakeMandatory<ClusterServerHandlers<typeof Thermostat.Complete>['setpointRaiseLower']>;

  // changeToMode: MakeMandatory<ClusterServerHandlers<typeof ModeSelect.Complete>['changeToMode']>;
  changeToMode: MakeMandatory<ClusterServerHandlers<typeof DeviceEnergyManagementMode.Complete>['changeToMode']>;

  step: MakeMandatory<ClusterServerHandlers<typeof FanControl.Complete>['step']>;

  suppressAlarm: MakeMandatory<ClusterServerHandlers<typeof BooleanStateConfiguration.Complete>['suppressAlarm']>;
  enableDisableAlarm: MakeMandatory<ClusterServerHandlers<typeof BooleanStateConfiguration.Complete>['enableDisableAlarm']>;

  selfTestRequest: MakeMandatory<ClusterServerHandlers<typeof SmokeCoAlarm.Complete>['selfTestRequest']>;
}

export interface SerializedMatterbridgeDevice {
  pluginName: string;
  deviceName: string;
  serialNumber: string;
  uniqueId: string;
  productId?: number;
  productName?: string;
  vendorId?: number;
  vendorName?: string;
  deviceTypes: AtLeastOne<DeviceTypeDefinition>;
  endpoint: EndpointNumber | undefined;
  endpointName: string;
  clusterServersId: ClusterId[];
}

export class MatterbridgeDevice extends extendPublicHandlerMethods<typeof Device, MatterbridgeDeviceCommands>(Device) {
  public static bridgeMode = '';
  public static logLevel = LogLevel.INFO;

  log: AnsiLogger;
  plugin: string | undefined = undefined;
  configUrl: string | undefined = undefined;

  serialNumber: string | undefined = undefined;
  deviceName: string | undefined = undefined;
  uniqueId: string | undefined = undefined;
  vendorId: number | undefined = undefined;
  vendorName: string | undefined = undefined;
  productId: number | undefined = undefined;
  productName: string | undefined = undefined;
  softwareVersion: number | undefined = undefined;
  softwareVersionString: string | undefined = undefined;
  hardwareVersion: number | undefined = undefined;
  hardwareVersionString: string | undefined = undefined;

  /**
   * Create a Matterbridge device.
   * @constructor
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition of the device.
   * @param {EndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - The debug level for the device.
   */
  constructor(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: EndpointOptions = {}, debug = false) {
    let firstDefinition: DeviceTypeDefinition;
    if (Array.isArray(definition)) firstDefinition = definition[0];
    else firstDefinition = definition;
    super(firstDefinition, options);
    this.log = new AnsiLogger({ logName: 'MatterbridgeDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: debug === true ? LogLevel.DEBUG : MatterbridgeDevice.logLevel });
    this.log.debug(`new MatterbridgeDevice with deviceType: ${zb}${firstDefinition.code}${db}-${zb}${firstDefinition.name}${db}`);
    if (Array.isArray(definition)) {
      definition.forEach((deviceType) => {
        this.addDeviceType(deviceType);
      });
    } else this.addDeviceType(firstDefinition);
  }

  /**
   * Loads asyncronously an instance of the MatterbridgeDevice class.
   *
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition of the device.
   * @param {EndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - The debug level for the device.
   * @returns {Promise<MatterbridgeDevice>} A Promise of MatterbridgeDevice instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: EndpointOptions = {}, debug = false): Promise<MatterbridgeDevice> {
    return new MatterbridgeDevice(definition, options, debug);
  }

  // Present in new API but not here
  get maybeNumber() {
    return this.number;
  }

  /**
   * Adds a device type to the list of device types of the MatterbridgeDevice endpoint.
   * If the device type is not already present in the list, it will be added.
   *
   * @param {DeviceTypeDefinition} deviceType - The device type to add.
   * @returns {MatterbridgeDevice} The MatterbridgeDevice instance.
   */
  addDeviceType(deviceType: DeviceTypeDefinition): MatterbridgeDevice {
    const deviceTypes = this.getDeviceTypes();
    if (!deviceTypes.includes(deviceType)) {
      this.log.debug(`addDeviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceTypes.push(deviceType);
      this.setDeviceTypes(deviceTypes);
    }
    return this;
  }

  /**
   * Adds one or more device types with the required cluster servers and the specified cluster servers.
   *
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   * @returns {MatterbridgeDevice} The MatterbridgeDevice instance.
   */
  addDeviceTypeWithClusterServer(deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[] = []): MatterbridgeDevice {
    this.log.debug('addDeviceTypeWithClusterServer:');
    deviceTypes.forEach((deviceType) => {
      this.log.debug(`- with deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${clusterId}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    const endpointDeviceTypes = this.getDeviceTypes();
    deviceTypes.forEach((deviceType) => {
      if (!endpointDeviceTypes.includes(deviceType)) endpointDeviceTypes.push(deviceType);
    });
    this.setDeviceTypes(endpointDeviceTypes);
    this.addClusterServerFromList(this, includeServerList);
    return this;
  }

  /**
   * Adds a child endpoint with the specified device types and options.
   * If the child endpoint is not already present, it will be created and added.
   * If the child endpoint is already present, the device types will be added to the existing child endpoint.
   *
   * @param {string} endpointName - The name of the new endpoint to add.
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the endpoint.
   * @param {boolean} [debug=false] - Whether to enable debug logging.
   * @returns {MatterbridgeDevice} - The child endpoint that was found or added.
   */
  addChildDeviceType(endpointName: string, deviceTypes: AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug = false): MatterbridgeDevice {
    this.log.debug(`addChildDeviceType: ${CYAN}${endpointName}${db}`);
    let child = this.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === endpointName) as MatterbridgeDevice;
    if (!child) {
      child = new MatterbridgeDevice(deviceTypes, { uniqueStorageKey: endpointName }, debug);
      if ('tagList' in options) {
        for (const tag of options.tagList as Semtag[]) {
          this.log.debug(`- with tagList: mfgCode ${CYAN}${tag.mfgCode}${db} namespaceId ${CYAN}${tag.namespaceId}${db} tag ${CYAN}${tag.tag}${db} label ${CYAN}${tag.label}${db}`);
          this.addTagList(child, tag.mfgCode, tag.namespaceId, tag.tag, tag.label);
        }
      }
      this.addChildEndpoint(child);
    }
    deviceTypes.forEach((deviceType) => {
      this.log.debug(`- with deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
    });
    const childDeviceTypes = child.getDeviceTypes();
    deviceTypes.forEach((deviceType) => {
      if (!childDeviceTypes.includes(deviceType)) childDeviceTypes.push(deviceType);
    });
    child.setDeviceTypes(childDeviceTypes);
    return child;
  }

  /**
   * Adds a child endpoint with one or more device types with the required cluster servers and the specified cluster servers.
   * If the child endpoint is not already present in the childEndpoints, it will be added.
   * If the child endpoint is already present in the childEndpoints, the device types and cluster servers will be added to the existing child endpoint.
   *
   * @param {string} endpointName - The name of the new enpoint to add.
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {ClusterId[]} [includeServerList=[]] - The list of cluster IDs to include.
   * @param {EndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - Whether to enable debug logging.
   * @returns {MatterbridgeDevice} - The child endpoint that was found or added.
   */
  addChildDeviceTypeWithClusterServer(endpointName: string, deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[] = [], options: MatterbridgeEndpointOptions = {}, debug = false): MatterbridgeDevice {
    this.log.debug(`addChildDeviceTypeWithClusterServer: ${CYAN}${endpointName}${db}`);
    let child = this.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === endpointName) as MatterbridgeDevice;
    if (!child) {
      child = new MatterbridgeDevice(deviceTypes, { uniqueStorageKey: endpointName }, debug);
      if ('tagList' in options) {
        for (const tag of options.tagList as Semtag[]) {
          this.log.debug(`- with tagList: mfgCode ${CYAN}${tag.mfgCode}${db} namespaceId ${CYAN}${tag.namespaceId}${db} tag ${CYAN}${tag.tag}${db} label ${CYAN}${tag.label}${db}`);
          this.addTagList(child, tag.mfgCode, tag.namespaceId, tag.tag, tag.label);
        }
      }
      this.addChildEndpoint(child);
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
    const childDeviceTypes = child.getDeviceTypes();
    deviceTypes.forEach((deviceType) => {
      if (!childDeviceTypes.includes(deviceType)) childDeviceTypes.push(deviceType);
    });
    child.setDeviceTypes(childDeviceTypes);
    this.addClusterServerFromList(child, includeServerList);
    return child;
  }

  /**
   * Adds the required cluster servers (only if they are not present) for the device types of the specified endpoint.
   *
   * @param {Endpoint} endpoint - The endpoint to add the required cluster servers to.
   * @returns {Endpoint} The updated endpoint with the required cluster servers added.
   */
  addRequiredClusterServers(endpoint: Endpoint): Endpoint {
    const requiredServerList: ClusterId[] = [];
    this.log.debug(`addRequiredClusterServer for ${CYAN}${endpoint.name}${db}`);
    endpoint.getDeviceTypes().forEach((deviceType) => {
      this.log.debug(`- for deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!requiredServerList.includes(clusterId) && !endpoint.getClusterServerById(clusterId)) requiredServerList.push(clusterId);
      });
    });
    requiredServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${clusterId}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(endpoint, requiredServerList);
    return endpoint;
  }

  /**
   * Adds the optional cluster servers (only if they are not present) for the device types of the specified endpoint.
   *
   * @param {Endpoint} endpoint - The endpoint to add the required cluster servers to.
   * @returns {Endpoint} The updated endpoint with the required cluster servers added.
   */
  addOptionalClusterServers(endpoint: Endpoint): Endpoint {
    const optionalServerList: ClusterId[] = [];
    this.log.debug(`addRequiredClusterServer for ${CYAN}${endpoint.name}${db}`);
    endpoint.getDeviceTypes().forEach((deviceType) => {
      this.log.debug(`- for deviceType: ${zb}${deviceType.code}${db}-${zb}${deviceType.name}${db}`);
      deviceType.optionalServerClusters.forEach((clusterId) => {
        if (!optionalServerList.includes(clusterId) && !endpoint.getClusterServerById(clusterId)) optionalServerList.push(clusterId);
      });
    });
    optionalServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${clusterId}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(endpoint, optionalServerList);
    return endpoint;
  }

  /**
   * Adds cluster servers to the specified endpoint based on the provided server list.
   *
   * @param {Endpoint} endpoint - The endpoint to add cluster servers to.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   * @returns {Endpoint} The updated endpoint with the cluster servers added.
   */
  addClusterServerFromList(endpoint: Endpoint, includeServerList: ClusterId[]): Endpoint {
    if (includeServerList.includes(Identify.Cluster.id)) endpoint.addClusterServer(this.getDefaultIdentifyClusterServer());
    if (includeServerList.includes(Groups.Cluster.id)) endpoint.addClusterServer(this.getDefaultGroupsClusterServer());
    // if (includeServerList.includes(ScenesManagement.Cluster.id)) endpoint.addClusterServer(this.getDefaultScenesClusterServer());
    if (includeServerList.includes(OnOff.Cluster.id)) endpoint.addClusterServer(this.getDefaultOnOffClusterServer());
    if (includeServerList.includes(LevelControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultLevelControlClusterServer());
    if (includeServerList.includes(ColorControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultColorControlClusterServer());
    if (includeServerList.includes(Switch.Cluster.id)) endpoint.addClusterServer(this.getDefaultSwitchClusterServer());
    if (includeServerList.includes(DoorLock.Cluster.id)) endpoint.addClusterServer(this.getDefaultDoorLockClusterServer());
    if (includeServerList.includes(Thermostat.Cluster.id)) endpoint.addClusterServer(this.getDefaultThermostatClusterServer());
    if (includeServerList.includes(TimeSynchronization.Cluster.id)) endpoint.addClusterServer(this.getDefaultTimeSyncClusterServer());
    if (includeServerList.includes(WindowCovering.Cluster.id)) endpoint.addClusterServer(this.getDefaultWindowCoveringClusterServer());
    if (includeServerList.includes(FanControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultFanControlClusterServer());
    if (includeServerList.includes(TemperatureMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultTemperatureMeasurementClusterServer());
    if (includeServerList.includes(RelativeHumidityMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultRelativeHumidityMeasurementClusterServer());
    if (includeServerList.includes(PressureMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultPressureMeasurementClusterServer());
    if (includeServerList.includes(FlowMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultFlowMeasurementClusterServer());
    if (includeServerList.includes(BooleanState.Cluster.id)) endpoint.addClusterServer(this.getDefaultBooleanStateClusterServer());
    if (includeServerList.includes(BooleanStateConfiguration.Cluster.id)) endpoint.addClusterServer(this.getDefaultBooleanStateConfigurationClusterServer());
    if (includeServerList.includes(OccupancySensing.Cluster.id)) endpoint.addClusterServer(this.getDefaultOccupancySensingClusterServer());
    if (includeServerList.includes(IlluminanceMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultIlluminanceMeasurementClusterServer());
    if (includeServerList.includes(PowerSource.Cluster.id)) endpoint.addClusterServer(this.getDefaultPowerSourceWiredClusterServer());
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
    if (includeServerList.includes(TotalVolatileOrganicCompoundsConcentrationMeasurement.Cluster.id)) endpoint.addClusterServer(this.getDefaultTvocMeasurementClusterServer());
    if (includeServerList.includes(DeviceEnergyManagement.Cluster.id)) endpoint.addClusterServer(this.getDefaultDeviceEnergyManagementClusterServer());
    if (includeServerList.includes(DeviceEnergyManagementMode.Cluster.id)) endpoint.addClusterServer(this.getDefaultDeviceEnergyManagementModeClusterServer());
    return endpoint;
  }

  /**
   * Retrieves a child endpoint by its name.
   *
   * @param {string} endpointName - The name of the endpoint to retrieve.
   * @returns {Endpoint | undefined} The child endpoint with the specified name, or undefined if not found.
   */
  getChildEndpointByName(endpointName: string): Endpoint | undefined {
    return this.getChildEndpoints().find((endpoint) => endpoint.uniqueStorageKey === endpointName);
  }

  /**
   * Retrieves the value of the specified attribute from the given endpoint and cluster.
   *
   * @param {ClusterId} clusterId - The ID of the cluster to retrieve the attribute from.
   * @param {string} attribute - The name of the attribute to retrieve.
   * @param {AnsiLogger} [log] - Optional logger for error and info messages.
   * @param {Endpoint} [endpoint] - Optional the child endpoint to retrieve the attribute from.
   * @returns {any} The value of the attribute, or undefined if the attribute is not found.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAttribute(clusterId: ClusterId, attribute: string, log?: AnsiLogger, endpoint?: Endpoint): any {
    if (!endpoint) endpoint = this as Endpoint;

    const clusterServer = endpoint.getClusterServerById(clusterId);
    if (!clusterServer) {
      this.log.error(`getAttribute error: Cluster ${clusterId} not found on endpoint ${endpoint.name}:${endpoint.number}`);
      return undefined;
    }
    const capitalizedAttributeName = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    if (!clusterServer.isAttributeSupportedByName(attribute) && !clusterServer.isAttributeSupportedByName(capitalizedAttributeName)) {
      this.log.error(`getAttribute error: Attribute ${attribute} not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return undefined;
    }
    // Find the getter method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(clusterServer as any)[`get${capitalizedAttributeName}Attribute`]) {
      this.log.error(`getAttribute error: Getter get${capitalizedAttributeName}Attribute not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
    const getter = (clusterServer as any)[`get${capitalizedAttributeName}Attribute`] as () => {};
    const value = getter();
    log?.info(`${db}Get endpoint ${or}${endpoint.name}:${endpoint.number}${db} attribute ${hk}${clusterServer.name}.${capitalizedAttributeName}${db} value ${YELLOW}${typeof value === 'object' ? debugStringify(value) : value}${db}`);
    return value;
  }

  /**
   * Sets the value of an attribute on a cluster server endpoint.
   *
   * @param {ClusterId} clusterId - The ID of the cluster.
   * @param {string} attribute - The name of the attribute.
   * @param {any} value - The value to set for the attribute.
   * @param {AnsiLogger} [log] - (Optional) The logger to use for logging errors and information.
   * @param {Endpoint} [endpoint] - (Optional) The endpoint to set the attribute on. If not provided, the attribute will be set on the current endpoint.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setAttribute(clusterId: ClusterId, attribute: string, value: any, log?: AnsiLogger, endpoint?: Endpoint): boolean {
    if (!endpoint) endpoint = this as Endpoint;

    const clusterServer = endpoint.getClusterServerById(clusterId);
    if (!clusterServer) {
      this.log.error(`setAttribute error: Cluster ${clusterId} not found on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    const capitalizedAttributeName = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    if (!clusterServer.isAttributeSupportedByName(attribute) && !clusterServer.isAttributeSupportedByName(capitalizedAttributeName)) {
      this.log.error(`setAttribute error: Attribute ${attribute} not found on Cluster ${clusterId} on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    // Find the getter method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(clusterServer as any)[`get${capitalizedAttributeName}Attribute`]) {
      this.log.error(`setAttribute error: Getter get${capitalizedAttributeName}Attribute not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
    const getter = (clusterServer as any)[`get${capitalizedAttributeName}Attribute`] as () => {};
    // Find the setter method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(clusterServer as any)[`set${capitalizedAttributeName}Attribute`]) {
      this.log.error(`setAttribute error: Setter set${capitalizedAttributeName}Attribute not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
    const setter = (clusterServer as any)[`set${capitalizedAttributeName}Attribute`] as (value: any) => {};
    const oldValue = getter();
    setter(value);
    log?.info(
      `${db}Set endpoint ${or}${endpoint.name}:${endpoint.number}${db} attribute ${hk}${clusterServer.name}.${capitalizedAttributeName}${db} ` +
        `from ${YELLOW}${typeof oldValue === 'object' ? debugStringify(oldValue) : oldValue}${db} ` +
        `to ${YELLOW}${typeof value === 'object' ? debugStringify(value) : value}${db}`,
    );
    return true;
  }

  /**
   * Subscribes to an attribute on a cluster.
   *
   * @param {ClusterId} clusterId - The ID of the cluster.
   * @param {string} attribute - The name of the attribute to subscribe to.
   * @param {(newValue: any, oldValue: any) => void} listener - A callback function that will be called when the attribute value changes.
   * @param {AnsiLogger} log - (Optional) An AnsiLogger instance for logging errors and information.
   * @param {Endpoint} endpoint - (Optional) The endpoint to subscribe the attribute on. If not provided, the current endpoint will be used.
   * @returns A boolean indicating whether the subscription was successful.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  subscribeAttribute(clusterId: ClusterId, attribute: string, listener: (newValue: any, oldValue: any) => void, log?: AnsiLogger, endpoint?: Endpoint): boolean {
    if (!endpoint) endpoint = this as Endpoint;

    const clusterServer = endpoint.getClusterServerById(clusterId);
    if (!clusterServer) {
      this.log.error(`subscribeAttribute error: Cluster ${clusterId} not found on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    const capitalizedAttributeName = attribute.charAt(0).toUpperCase() + attribute.slice(1);
    if (!clusterServer.isAttributeSupportedByName(attribute) && !clusterServer.isAttributeSupportedByName(capitalizedAttributeName)) {
      this.log.error(`subscribeAttribute error: Attribute ${attribute} not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    // Find the subscribe method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(clusterServer as any)[`subscribe${capitalizedAttributeName}Attribute`]) {
      this.log.error(`subscribeAttribute error: subscribe${capitalizedAttributeName}Attribute not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return false;
    }
    // Subscribe to the attribute
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
    const subscribe = (clusterServer as any)[`subscribe${capitalizedAttributeName}Attribute`] as (listener: (newValue: any, oldValue: any) => void) => {};
    subscribe(listener);
    log?.info(`${db}Subscribe endpoint ${or}${endpoint.name}:${endpoint.number}${db} attribute ${hk}${clusterServer.name}.${capitalizedAttributeName}${db}`);
    return true;
  }

  /**
   * Triggers the specified event of the specified cluster from the given endpoint and cluster.
   *
   * @param {ClusterId} clusterId - The ID of the cluster to retrieve the event from.
   * @param {string} event - The name of the event to trigger.
   * @param {Record<string, any>} payload - The payload of the event to trigger.
   * @param {AnsiLogger} [log] - Optional logger for error and info messages.
   * @param {Endpoint} [endpoint] - Optional the child endpoint to retrieve the event from.
   */
  triggerEvent(clusterId: ClusterId, event: string, payload: Record<string, boolean | number | bigint | string | object | undefined | null>, log?: AnsiLogger, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    if (!endpoint.number) return;

    const clusterServer = endpoint.getClusterServerById(clusterId);
    if (!clusterServer) {
      this.log.error(`triggerEvent error: Cluster ${clusterId} not found on endpoint ${endpoint.name}:${endpoint.number}`);
      return;
    }
    const capitalizedEventName = event.charAt(0).toUpperCase() + event.slice(1);
    if (!clusterServer.isEventSupportedByName(event) && !clusterServer.isEventSupportedByName(capitalizedEventName)) {
      this.log.error(`triggerEvent error: Event ${event} not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return;
    }
    // Find the getter method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(clusterServer as any)[`trigger${capitalizedEventName}Event`]) {
      this.log.error(`triggerEvent error: Trigger trigger${capitalizedEventName}Event not found on Cluster ${clusterServer.name} on endpoint ${endpoint.name}:${endpoint.number}`);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-empty-object-type
    const trigger = (clusterServer as any)[`trigger${capitalizedEventName}Event`] as (payload: Record<string, boolean | number | bigint | string | object | undefined | null>) => {};
    trigger(payload);
    log?.info(`${db}Trigger event ${hk}${clusterServer.name}.${capitalizedEventName}${db} on endpoint ${or}${endpoint.name}:${endpoint.number}${db}`);
  }

  /**
   * Adds a tag to the tag list of the specified endpoint.
   *
   * @param {Endpoint} endpoint - The endpoint to add the tag to.
   * @param {VendorId | null} mfgCode - The manufacturer code.
   * @param {number} namespaceId - The namespace ID of the tag.
   * @param {number} tag - The tag number.
   * @param {string | null} [label=null] - The label for the tag.
   *
   * @remarks
   * This method is used to add a tag to the tag list of a given endpoint.
   * If the tag list already exists, the new tag is added to the existing list. Otherwise, a new tag list is created with the provided tag.
   *
   * Example usage:
   * ```typescript
   * this.addTagList(endpoint, null, NumberTag.One.namespaceId, NumberTag.One.tag, 'Label');
   * this.addTagList(endpoint, null, SwitchesTag.Custom.namespaceId, SwitchesTag.Custom.tag, 'Label');
   * ```
   */
  addTagList(endpoint: Endpoint, mfgCode: VendorId | null, namespaceId: number, tag: number, label?: string | null) {
    const descriptor = endpoint.getClusterServer(DescriptorCluster.with(Descriptor.Feature.TagList));
    if (!descriptor) {
      this.log.error(`addTagList: descriptor cluster not found on endpoint ${endpoint.name}:${endpoint.number}`);
      return;
    }

    // tagList: { mfgCode: VendorId | null; namespaceId: number; tag: number; label?: string | null }[] = [];

    if (descriptor.attributes.tagList) {
      this.log.debug(`addTagList: adding ${CYAN}tagList${db} mfCode: ${mfgCode}, namespaceId: ${namespaceId}, tag: ${tag}, label: ${label} on endpoint ${endpoint.name}:${endpoint.number}`);
      const tagList = descriptor.attributes.tagList.getLocal();
      tagList.push({ mfgCode, namespaceId, tag, label });
      return;
    }

    this.log.debug(`addTagList: creating ${CYAN}tagList${db} mfCode: ${mfgCode}, namespaceId: ${namespaceId}, tag: ${tag}, label: ${label} on endpoint ${endpoint.name}:${endpoint.number}`);
    endpoint.addClusterServer(
      ClusterServer(
        DescriptorCluster.with(Descriptor.Feature.TagList),
        {
          tagList: [{ mfgCode, namespaceId, tag, label }],
          deviceTypeList: [...descriptor.attributes.deviceTypeList.getLocal()],
          serverList: [...descriptor.attributes.serverList.getLocal()],
          clientList: [...descriptor.attributes.clientList.getLocal()],
          partsList: [...descriptor.attributes.partsList.getLocal()],
        },
        {},
        {},
      ),
    );
  }

  /**
   * Serializes the Matterbridge device into a serialized object.
   *
   * @param pluginName - The name of the plugin.
   * @returns The serialized Matterbridge device object.
   */
  serialize(): SerializedMatterbridgeDevice | undefined {
    if (!this.serialNumber || !this.deviceName || !this.uniqueId) return;
    const cluster = this.getClusterServer(BasicInformationCluster) ?? this.getClusterServer(BridgedDeviceBasicInformationCluster);
    if (!cluster) return;
    const serialized: SerializedMatterbridgeDevice = {
      pluginName: this.plugin ?? 'Unknown',
      serialNumber: this.serialNumber,
      deviceName: this.deviceName,
      uniqueId: this.uniqueId,
      productName: cluster.attributes.productName?.getLocal(),
      vendorId: cluster.attributes.vendorId?.getLocal(),
      vendorName: cluster.attributes.vendorName?.getLocal(),
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
   * Deserializes the device into a serialized object.
   *
   * @returns The deserialized MatterbridgeDevice.
   */
  static deserialize(serializedDevice: SerializedMatterbridgeDevice): MatterbridgeDevice {
    const device = new MatterbridgeDevice(serializedDevice.deviceTypes);
    device.serialNumber = serializedDevice.serialNumber;
    device.deviceName = serializedDevice.deviceName;
    device.uniqueId = serializedDevice.uniqueId;
    for (const clusterId of serializedDevice.clusterServersId) {
      if (clusterId === BasicInformationCluster.id)
        device.createDefaultBasicInformationClusterServer(
          serializedDevice.deviceName,
          serializedDevice.serialNumber,
          serializedDevice.vendorId ?? 0xfff1,
          serializedDevice.vendorName ?? 'Matterbridge',
          serializedDevice.productId ?? 0x8000,
          serializedDevice.productName ?? 'Matterbridge device',
        );
      else if (clusterId === BridgedDeviceBasicInformationCluster.id)
        device.createDefaultBridgedDeviceBasicInformationClusterServer(
          serializedDevice.deviceName,
          serializedDevice.serialNumber,
          serializedDevice.vendorId ?? 0xfff1,
          serializedDevice.vendorName ?? 'Matterbridge',
          serializedDevice.productName ?? 'Matterbridge device',
        );
      else device.addClusterServerFromList(device, [clusterId]);
    }
    return device;
  }

  /**
   * Get a default IdentifyCluster server.
   */
  getDefaultIdentifyClusterServer(identifyTime = 0, identifyType = Identify.IdentifyType.None) {
    return ClusterServer(
      IdentifyCluster,
      {
        identifyTime,
        identifyType,
      },
      {
        identify: async (data) => {
          this.log.debug('Matter command: Identify');
          await this.commandHandler.executeHandler('identify', data);
        },
        triggerEffect: async (data) => {
          this.log.debug('Matter command: TriggerEffect');
          await this.commandHandler.executeHandler('triggerEffect', data);
        },
      },
    );
  }

  /**
   * Creates a default IdentifyCluster server.
   */
  createDefaultIdentifyClusterServer(identifyTime = 0, identifyType = Identify.IdentifyType.None) {
    this.addClusterServer(this.getDefaultIdentifyClusterServer(identifyTime, identifyType));
    return this;
  }

  /**
   * Get a default IdentifyCluster server.
   */
  getDefaultGroupsClusterServer() {
    return ClusterServer(
      GroupsCluster,
      {
        nameSupport: {
          nameSupport: true,
        },
      },
      GroupsClusterHandler(),
    );
    // return createDefaultGroupsClusterServer();
  }

  /**
   * Creates a default groups cluster server and adds it to the device.
   */
  createDefaultGroupsClusterServer() {
    this.addClusterServer(this.getDefaultGroupsClusterServer());
  }

  /**
   * Get a default scenes cluster server and adds it to the current instance.
   * @deprecated This method is deprecated.
   *
   */
  getDefaultScenesClusterServer() {
    /*
    return ClusterServer(
      ScenesCluster,
      {
        sceneCount: 0,
        currentScene: 0,
        currentGroup: GroupId(0),
        sceneValid: false,
        nameSupport: {
          nameSupport: true,
        },
        lastConfiguredBy: null,
      },
      {},
    );
    */
  }

  /**
   * Creates a default scenes cluster server and adds it to the current instance.
   * @deprecated This method is deprecated.
   */
  createDefaultScenesClusterServer() {
    /*
    this.addClusterServer(this.getDefaultScenesClusterServer());
    */
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
    this.log.logName = deviceName;
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.productId = productId;
    this.productName = productName;
    this.vendorId = vendorId;
    this.vendorName = vendorName;
    this.softwareVersion = softwareVersion;
    this.softwareVersionString = softwareVersionString;
    this.hardwareVersion = hardwareVersion;
    this.hardwareVersionString = hardwareVersionString;
    return ClusterServer(
      BasicInformationCluster,
      {
        dataModelRevision: 1,
        location: 'XX',
        vendorId: VendorId(vendorId),
        vendorName: vendorName.slice(0, 32),
        productId: productId,
        productName: productName.slice(0, 32),
        productUrl: 'https://www.npmjs.com/package/matterbridge',
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
        specificationVersion: Specification.SPECIFICATION_VERSION,
        maxPathsPerInvoke: 1,
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
    if (MatterbridgeDevice.bridgeMode === 'bridge') {
      this.addDeviceType(bridgedNode);
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
    this.log.logName = deviceName;
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = this.createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.productId = undefined;
    this.productName = productName;
    this.vendorId = vendorId;
    this.vendorName = vendorName;
    this.softwareVersion = softwareVersion;
    this.softwareVersionString = softwareVersionString;
    this.hardwareVersion = hardwareVersion;
    this.hardwareVersionString = hardwareVersionString;
    return ClusterServer(
      BridgedDeviceBasicInformationCluster,
      {
        vendorId: vendorId !== undefined ? VendorId(vendorId) : undefined, // 4874
        vendorName: vendorName.slice(0, 32),
        productName: productName.slice(0, 32),
        productUrl: 'https://www.npmjs.com/package/matterbridge',
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
        startUp: true,
        shutDown: true,
        leave: true,
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
    this.addClusterServer(this.getDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString));
  }

  /**
   * Get a default Power Topology Cluster Server.
   *
   * @returns {ClusterServer} - The configured Power Topology Cluster Server.
   */
  getDefaultPowerTopologyClusterServer() {
    return ClusterServer(PowerTopologyCluster.with(PowerTopology.Feature.TreeTopology), {}, {}, {});
  }

  /**
   * Get a default Electrical Energy Measurement Cluster Server.
   *
   * @param {number} energy - The total consumption value in mW/h.
   * @returns {ClusterServer} - The configured Electrical Energy Measurement Cluster Server.
   */
  getDefaultElectricalEnergyMeasurementClusterServer(energy: number | bigint | null = null) {
    return ClusterServer(
      ElectricalEnergyMeasurementCluster.with(ElectricalEnergyMeasurement.Feature.ImportedEnergy, ElectricalEnergyMeasurement.Feature.ExportedEnergy, ElectricalEnergyMeasurement.Feature.CumulativeEnergy),
      {
        accuracy: {
          measurementType: MeasurementType.ElectricalEnergy,
          measured: true,
          minMeasuredValue: Number.MIN_SAFE_INTEGER,
          maxMeasuredValue: Number.MAX_SAFE_INTEGER,
          accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
        },
        cumulativeEnergyReset: null,
        cumulativeEnergyImported: energy ? { energy } : null,
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
   * @param {number} voltage - The voltage value in millivolts.
   * @param {number} current - The current value in milliamperes.
   * @param {number} power - The power value in milliwatts.
   * @param {number} frequency - The frequency value in millihertz.
   * @returns {ClusterServer} - The configured Electrical Power Measurement Cluster Server.
   */
  getDefaultElectricalPowerMeasurementClusterServer(voltage: number | bigint | null = null, current: number | bigint | null = null, power: number | bigint | null = null, frequency: number | bigint | null = null) {
    return ClusterServer(
      ElectricalPowerMeasurementCluster.with(ElectricalPowerMeasurement.Feature.AlternatingCurrent),
      {
        powerMode: ElectricalPowerMeasurement.PowerMode.Ac,
        numberOfMeasurementTypes: 4,
        accuracy: [
          {
            measurementType: MeasurementType.Voltage,
            measured: true,
            minMeasuredValue: Number.MIN_SAFE_INTEGER,
            maxMeasuredValue: Number.MAX_SAFE_INTEGER,
            accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
          },
          {
            measurementType: MeasurementType.ActiveCurrent,
            measured: true,
            minMeasuredValue: Number.MIN_SAFE_INTEGER,
            maxMeasuredValue: Number.MAX_SAFE_INTEGER,
            accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
          },
          {
            measurementType: MeasurementType.ActivePower,
            measured: true,
            minMeasuredValue: Number.MIN_SAFE_INTEGER,
            maxMeasuredValue: Number.MAX_SAFE_INTEGER,
            accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
          },
          {
            measurementType: MeasurementType.Frequency,
            measured: true,
            minMeasuredValue: Number.MIN_SAFE_INTEGER,
            maxMeasuredValue: Number.MAX_SAFE_INTEGER,
            accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
          },
        ],
        voltage: voltage,
        activeCurrent: current,
        activePower: power,
        frequency: frequency,
      },
      {},
      {},
    );
  }

  /**
   * Creates a default Dummy Thread Network Diagnostics Cluster server.
   * @deprecated This method is deprecated and is only used for testing.
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
          activeNetworkFaultsList: [],
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
   * Get a default OnOff cluster server for light devices.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @param {boolean} [globalSceneControl=false] - The global scene control state.
   * @param {number} [onTime=0] - The on time value.
   * @param {number} [offWaitTime=0] - The off wait time value.
   * @param {OnOff.StartUpOnOff | null} [startUpOnOff=null] - The start-up OnOff state. Null means previous state.
   *
   * @returns {ClusterServer} - The configured OnOff cluster server.
   */
  getDefaultOnOffClusterServer(onOff = false, globalSceneControl = false, onTime = 0, offWaitTime = 0, startUpOnOff: OnOff.StartUpOnOff | null = null) {
    return ClusterServer(
      OnOffCluster.with(OnOff.Feature.Lighting),
      {
        onOff,
        globalSceneControl,
        onTime,
        offWaitTime,
        startUpOnOff,
      },
      {
        on: async (data) => {
          this.log.debug('Matter command: on');
          await this.commandHandler.executeHandler('on', data);
        },
        off: async (data) => {
          this.log.debug('Matter command: off');
          await this.commandHandler.executeHandler('off', data);
        },
        toggle: async (data) => {
          this.log.debug('Matter command: toggle');
          await this.commandHandler.executeHandler('toggle', data);
        },
        offWithEffect: async (data) => {
          this.log.debug('Matter command: offWithEffect', data.request);
          await this.commandHandler.executeHandler('offWithEffect', data);
        },
        onWithRecallGlobalScene: async (data) => {
          this.log.debug('Matter command: onWithRecallGlobalScene', data.request);
          await this.commandHandler.executeHandler('onWithRecallGlobalScene', data);
        },
        onWithTimedOff: async (data) => {
          this.log.debug('Matter command: onWithTimedOff', data.request);
          await this.commandHandler.executeHandler('onWithTimedOff', data);
        },
      },
      {},
    );
  }

  /**
   * Creates a default OnOff cluster server for light devices.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @param {boolean} [globalSceneControl=false] - The global scene control state.
   * @param {number} [onTime=0] - The on time value.
   * @param {number} [offWaitTime=0] - The off wait time value.
   * @param {OnOff.StartUpOnOff | null} [startUpOnOff=null] - The start-up OnOff state. Null means previous state.
   */
  createDefaultOnOffClusterServer(onOff = false, globalSceneControl = false, onTime = 0, offWaitTime = 0, startUpOnOff: OnOff.StartUpOnOff | null = null) {
    this.addClusterServer(this.getDefaultOnOffClusterServer(onOff, globalSceneControl, onTime, offWaitTime, startUpOnOff));
  }

  /**
   * Get a DeadFront OnOff cluster server.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   *
   * @returns {ClusterServer} - The configured OnOff cluster server.
   */
  getDeadFrontOnOffClusterServer(onOff = false) {
    return ClusterServer(
      OnOffCluster.with(OnOff.Feature.DeadFrontBehavior),
      {
        onOff,
      },
      {
        on: async (data) => {
          this.log.debug('Matter command: on');
          await this.commandHandler.executeHandler('on', data);
        },
        off: async (data) => {
          this.log.debug('Matter command: off');
          await this.commandHandler.executeHandler('off', data);
        },
        toggle: async (data) => {
          this.log.debug('Matter command: toggle');
          await this.commandHandler.executeHandler('toggle', data);
        },
      },
      {},
    );
  }

  /**
   * Creates a DeadFront OnOff cluster server.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   */
  createDeadFrontOnOffClusterServer(onOff = false) {
    this.addClusterServer(this.getDeadFrontOnOffClusterServer(onOff));
  }

  /**
   * Get an OnOff cluster server without features.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   *
   * @returns {ClusterServer} - The configured OnOff cluster server.
   */
  getOnOffClusterServer(onOff = false) {
    return ClusterServer(
      OnOffCluster,
      {
        onOff,
      },
      {
        on: async (data) => {
          this.log.debug('Matter command: on');
          await this.commandHandler.executeHandler('on', data);
        },
        off: async (data) => {
          this.log.debug('Matter command: off');
          await this.commandHandler.executeHandler('off', data);
        },
        toggle: async (data) => {
          this.log.debug('Matter command: toggle');
          await this.commandHandler.executeHandler('toggle', data);
        },
      },
      {},
    );
  }

  /**
   * Creates an OnOff cluster server without features.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   */
  createOnOffClusterServer(onOff = false) {
    this.addClusterServer(this.getOnOffClusterServer(onOff));
  }

  /**
   * Get a default level control cluster server.
   *
   * @param currentLevel - The current level (default: 254).
   * @param minLevel - The minimum level (default: 1).
   * @param maxLevel - The maximum level (default: 254).
   * @param onLevel - The on level (default: null).
   * @param startUpCurrentLevel - The startUp on level (default: null).
   */
  getDefaultLevelControlClusterServer(currentLevel = 254, minLevel = 1, maxLevel = 254, onLevel: number | null = null, startUpCurrentLevel: number | null = null) {
    return ClusterServer(
      LevelControlCluster.with(LevelControl.Feature.OnOff, LevelControl.Feature.Lighting),
      {
        currentLevel,
        minLevel,
        maxLevel,
        onLevel,
        remainingTime: 0,
        startUpCurrentLevel,
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
   * @param currentLevel - The current level (default: 254).
   * @param minLevel - The minimum level (default: 1).
   * @param maxLevel - The maximum level (default: 254).
   * @param onLevel - The on level (default: null).
   * @param startUpCurrentLevel - The startUp on level (default: null).
   */
  createDefaultLevelControlClusterServer(currentLevel = 254, minLevel = 1, maxLevel = 254, onLevel: number | null = null, startUpCurrentLevel: number | null = null) {
    this.addClusterServer(this.getDefaultLevelControlClusterServer(currentLevel, minLevel, maxLevel, onLevel, startUpCurrentLevel));
  }

  /**
   * Get a default color control cluster server with Xy, HueSaturation and ColorTemperature.
   *
   * @param currentX - The current X value.
   * @param currentY - The current Y value.
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getDefaultColorControlClusterServer(currentX = 0, currentY = 0, currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.Xy, ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
        enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
        colorCapabilities: { xy: true, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        currentX,
        currentY,
        currentHue,
        currentSaturation,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
        coupleColorTempToLevelMinMireds: colorTempPhysicalMinMireds,
        remainingTime: 0,
        startUpColorTemperatureMireds: null,
      },
      {
        moveToColor: async (data) => {
          this.log.debug('Matter command: moveToColor request:', data.request, 'attributes.currentX:', data.attributes.currentX.getLocal(), 'attributes.currentY:', data.attributes.currentY.getLocal());
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
   * Creates a default color control cluster server with Xy, HueSaturation and ColorTemperature.
   *
   * @param currentX - The current X value.
   * @param currentY - The current Y value.
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createDefaultColorControlClusterServer(currentX = 0, currentY = 0, currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getDefaultColorControlClusterServer(currentX, currentY, currentHue, currentSaturation, colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Get a Xy color control cluster server with Xy and ColorTemperature.
   *
   * @param currentX - The current X value.
   * @param currentY - The current Y value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getXyColorControlClusterServer(currentX = 0, currentY = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.CurrentXAndCurrentY,
        enhancedColorMode: ColorControl.EnhancedColorMode.CurrentXAndCurrentY,
        colorCapabilities: { xy: true, hueSaturation: false, colorLoop: false, enhancedHue: false, colorTemperature: true },
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        currentX,
        currentY,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
        coupleColorTempToLevelMinMireds: colorTempPhysicalMinMireds,
        startUpColorTemperatureMireds: null,
        remainingTime: 0,
      },
      {
        moveToColor: async (data) => {
          this.log.debug('Matter command: moveToColor request:', data.request, 'attributes.currentX:', data.attributes.currentX.getLocal(), 'attributes.currentY:', data.attributes.currentY.getLocal());
          this.commandHandler.executeHandler('moveToColor', data);
        },
        moveColor: async () => {
          this.log.error('Matter command: moveColor not implemented');
        },
        stepColor: async () => {
          this.log.error('Matter command: stepColor not implemented');
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
   * Creates a Xy color control cluster server with Xy and ColorTemperature.
   *
   * @param currentX - The current X value.
   * @param currentY - The current Y value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createXyColorControlClusterServer(currentX = 0, currentY = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getXyColorControlClusterServer(currentX, currentY, colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Get a default hue and saturation control cluster server with HueSaturation and ColorTemperature.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getHsColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
        enhancedColorMode: ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation,
        colorCapabilities: { xy: false, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        currentHue,
        currentSaturation,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
        coupleColorTempToLevelMinMireds: colorTempPhysicalMinMireds,
        startUpColorTemperatureMireds: null,
        remainingTime: 0,
      },
      {
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
   * Creates a hue and saturation color control cluster server with HueSaturation and ColorTemperature.
   *
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createHsColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getHsColorControlClusterServer(currentHue, currentSaturation, colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Get a color temperature color control cluster server.
   *
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  getCtColorControlClusterServer(colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    return ClusterServer(
      ColorControlCluster.with(ColorControl.Feature.ColorTemperature),
      {
        colorMode: ColorControl.ColorMode.ColorTemperatureMireds,
        enhancedColorMode: ColorControl.EnhancedColorMode.ColorTemperatureMireds,
        colorCapabilities: { xy: false, hueSaturation: false, colorLoop: false, enhancedHue: false, colorTemperature: true },
        options: {
          executeIfOff: false,
        },
        numberOfPrimaries: null,
        colorTemperatureMireds,
        colorTempPhysicalMinMireds,
        colorTempPhysicalMaxMireds,
        coupleColorTempToLevelMinMireds: colorTempPhysicalMinMireds,
        remainingTime: 0,
        startUpColorTemperatureMireds: null,
      },
      {
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
   * Creates a color temperature color control cluster server.
   *
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   */
  createCtColorControlClusterServer(colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
    this.addClusterServer(this.getCtColorControlClusterServer(colorTemperatureMireds, colorTempPhysicalMinMireds, colorTempPhysicalMaxMireds));
  }

  /**
   * Configures the color control cluster for a device.
   *
   * @remark This method must be called only after creating the cluster with getDefaultCompleteColorControlClusterServer or createDefaultCompleteColorControlClusterServer
   * and before starting the matter server.
   *
   * @deprecated Use configureColorControlMode instead.
   *
   * @param {boolean} hueSaturation - A boolean indicating whether the device supports hue and saturation control.
   * @param {boolean} xy - A boolean indicating whether the device supports XY control.
   * @param {boolean} colorTemperature - A boolean indicating whether the device supports color temperature control.
   * @param {ColorControl.ColorMode} colorMode - An optional parameter specifying the color mode of the device.
   * @param {Endpoint} endpoint - An optional parameter specifying the endpoint to configure. If not provided, the device endpoint will be used.
   */
  configureColorControlCluster(hueSaturation: boolean, xy: boolean, colorTemperature: boolean, colorMode?: ColorControl.ColorMode, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    endpoint.getClusterServer(ColorControlCluster)?.setFeatureMapAttribute({ hueSaturation, enhancedHue: false, colorLoop: false, xy, colorTemperature });
    endpoint.getClusterServer(ColorControlCluster)?.setColorCapabilitiesAttribute({ hueSaturation, enhancedHue: false, colorLoop: false, xy, colorTemperature });
    if (colorMode !== undefined && colorMode >= ColorControl.ColorMode.CurrentHueAndCurrentSaturation && colorMode <= ColorControl.ColorMode.ColorTemperatureMireds) {
      endpoint.getClusterServer(ColorControlCluster)?.setColorModeAttribute(colorMode);
      endpoint.getClusterServer(ColorControlCluster)?.setEnhancedColorModeAttribute(colorMode as unknown as ColorControl.EnhancedColorMode);
    }
  }

  /**
   * Configures the color control mode for the device.
   *
   * @param {ColorControl.ColorMode} colorMode - The color mode to set.
   * @param {Endpoint} endpoint - The optional endpoint to configure. If not provided, the method will configure the current endpoint.
   */
  configureColorControlMode(colorMode: ColorControl.ColorMode, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    if (colorMode !== undefined && colorMode >= ColorControl.ColorMode.CurrentHueAndCurrentSaturation && colorMode <= ColorControl.ColorMode.ColorTemperatureMireds) {
      endpoint.getClusterServer(ColorControlCluster)?.setColorModeAttribute(colorMode);
      endpoint.getClusterServer(ColorControlCluster)?.setEnhancedColorModeAttribute(colorMode as unknown as ColorControl.EnhancedColorMode);
    }
  }

  /**
   * Get a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0.
   */
  getDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    return ClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift /* , WindowCovering.Feature.AbsolutePosition*/),
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
        // installedClosedLimitLift: 10000,
        // installedOpenLimitLift: 0,
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
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  setWindowCoveringTargetAsCurrentAndStopped(endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCoveringCluster = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
    if (windowCoveringCluster) {
      const position = windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
      if (position !== null) {
        windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(position);
        windowCoveringCluster.setOperationalStatusAttribute({
          global: WindowCovering.MovementStatus.Stopped,
          lift: WindowCovering.MovementStatus.Stopped,
          tilt: WindowCovering.MovementStatus.Stopped,
        });
      }
      this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to ${position} and operationalStatus to Stopped.`);
    }
  }

  /**
   * Sets the current and target status of a window covering.
   * @param {number} current - The current position of the window covering.
   * @param {number} target - The target position of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status of the window covering.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  setWindowCoveringCurrentTargetStatus(current: number, target: number, status: WindowCovering.MovementStatus, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCoveringCluster = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
    if (windowCoveringCluster) {
      windowCoveringCluster.setCurrentPositionLiftPercent100thsAttribute(current);
      windowCoveringCluster.setTargetPositionLiftPercent100thsAttribute(target);
      windowCoveringCluster.setOperationalStatusAttribute({
        global: status,
        lift: status,
        tilt: status,
      });
    }
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${current}, targetPositionLiftPercent100ths: ${target} and operationalStatus: ${status}.`);
  }

  /**
   * Sets the status of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status to set.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  setWindowCoveringStatus(status: WindowCovering.MovementStatus, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCovering = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
    if (!windowCovering) return;
    windowCovering.setOperationalStatusAttribute({ global: status, lift: status, tilt: status });
    this.log.debug(`Set WindowCovering operationalStatus: ${status}`);
  }

  /**
   * Retrieves the status of the window covering.
   * @param {Endpoint} endpoint - The endpoint on which to get the window covering (default the device endpoint).
   *
   * @returns The global operational status of the window covering.
   */
  getWindowCoveringStatus(endpoint?: Endpoint): WindowCovering.MovementStatus | undefined {
    if (!endpoint) endpoint = this as Endpoint;
    const windowCovering = endpoint.getClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift));
    if (!windowCovering) return undefined;
    const status = windowCovering.getOperationalStatusAttribute();
    this.log.debug(`Get WindowCovering operationalStatus: ${status.global}`);
    return status.global;
  }

  /**
   * Sets the target and current position of the window covering.
   *
   * @param position - The position to set, specified as a number.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
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
  getDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.DeadBolt) {
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
  createDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.DeadBolt) {
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
  }

  /**
   * Triggers a switch event on the specified endpoint.
   *
   * @param {string} event - The type of event to trigger. Possible values are 'Single', 'Double', 'Long' for momentarySwitch and 'Press', 'Release' for latchingSwitch.
   * @param {Endpoint} endpoint - The endpoint on which to trigger the event (default the device endpoint).
   * @returns {void}
   */
  triggerSwitchEvent(event: 'Single' | 'Double' | 'Long' | 'Press' | 'Release', log?: AnsiLogger, endpoint?: Endpoint): boolean {
    if (!endpoint) endpoint = this as Endpoint;

    if (['Single', 'Double', 'Long'].includes(event)) {
      const cluster = endpoint.getClusterServer(SwitchCluster.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress));
      if (!cluster || !cluster.getFeatureMapAttribute().momentarySwitch) {
        log?.error(`triggerSwitchEvent ${event} error: Switch cluster with MomentarySwitch not found on endpoint ${endpoint.name}:${endpoint.number}`);
        return false;
      }
      if (endpoint.number === undefined) {
        log?.error(`triggerSwitchEvent ${event} error: Endpoint number not assigned on endpoint ${endpoint.name}:${endpoint.number}`);
        return false;
      }
      if (event === 'Single') {
        cluster.setCurrentPositionAttribute(1);
        cluster.triggerInitialPressEvent({ newPosition: 1 });
        cluster.setCurrentPositionAttribute(0);
        cluster.triggerShortReleaseEvent({ previousPosition: 1 });
        cluster.setCurrentPositionAttribute(0);
        cluster.triggerMultiPressCompleteEvent({ previousPosition: 1, totalNumberOfPressesCounted: 1 });
        log?.info(`${db}Trigger endpoint ${or}${endpoint.name}:${endpoint.number}${db} event ${hk}${cluster.name}.SinglePress${db}`);
      }
      if (event === 'Double') {
        cluster.setCurrentPositionAttribute(1);
        cluster.triggerInitialPressEvent({ newPosition: 1 });
        cluster.setCurrentPositionAttribute(0);
        cluster.triggerShortReleaseEvent({ previousPosition: 1 });
        cluster.setCurrentPositionAttribute(1);
        cluster.triggerInitialPressEvent({ newPosition: 1 });
        cluster.triggerMultiPressOngoingEvent({ newPosition: 1, currentNumberOfPressesCounted: 2 });
        cluster.setCurrentPositionAttribute(0);
        cluster.triggerShortReleaseEvent({ previousPosition: 1 });
        cluster.triggerMultiPressCompleteEvent({ previousPosition: 1, totalNumberOfPressesCounted: 2 });
        log?.info(`${db}Trigger endpoint ${or}${endpoint.name}:${endpoint.number}${db} event ${hk}${cluster.name}.DoublePress${db}`);
      }
      if (event === 'Long') {
        cluster.setCurrentPositionAttribute(1);
        cluster.triggerInitialPressEvent({ newPosition: 1 });
        cluster.triggerLongPressEvent({ newPosition: 1 });
        cluster.setCurrentPositionAttribute(0);
        cluster.triggerLongReleaseEvent({ previousPosition: 1 });
        log?.info(`${db}Trigger endpoint ${or}${endpoint.name}:${endpoint.number}${db} event ${hk}${cluster.name}.LongPress${db}`);
      }
    }
    if (['Press', 'Release'].includes(event)) {
      const cluster = endpoint.getClusterServer(Switch.Complete);
      if (!cluster || !cluster.getFeatureMapAttribute().latchingSwitch) {
        log?.error(`triggerSwitchEvent ${event} error: Switch cluster with LatchingSwitch not found on endpoint ${endpoint.name}:${endpoint.number}`);
        return false;
      }
      if (endpoint.number === undefined) {
        log?.error(`triggerSwitchEvent ${event} error: Endpoint number not assigned on endpoint ${endpoint.name}:${endpoint.number}`);
        return false;
      }
      if (event === 'Press') {
        cluster.setCurrentPositionAttribute(1);
        log?.info(`${db}Update endpoint ${or}${endpoint.name}:${endpoint.number}${db} attribute ${hk}${cluster.name}.CurrentPosition${db} to ${YELLOW}1${db}`);
        if (cluster.triggerSwitchLatchedEvent) cluster.triggerSwitchLatchedEvent({ newPosition: 1 });
        log?.info(`${db}Trigger endpoint ${or}${endpoint.name}:${endpoint.number}${db} event ${hk}${cluster.name}.Press${db}`);
      }
      if (event === 'Release') {
        cluster.setCurrentPositionAttribute(0);
        log?.info(`${db}Update endpoint ${or}${endpoint.name}:${endpoint.number}${db} attribute ${hk}${cluster.name}.CurrentPosition${db} to ${YELLOW}0${db}`);
        if (cluster.triggerSwitchLatchedEvent) cluster.triggerSwitchLatchedEvent({ newPosition: 0 });
        log?.info(`${db}Trigger endpoint ${or}${endpoint.name}:${endpoint.number}${db} event ${hk}${cluster.name}.Release${db}`);
      }
    }
    return true;
  }

  /**
   * Retrieves the default mode select cluster server.
   *
   * @param description - The description of the cluster server.
   * @param supportedModes - The supported modes for the cluster server.
   * @param currentMode - The current mode of the cluster server. Defaults to 0.
   * @param startUpMode - The startup mode of the cluster server. Defaults to 0.
   * @returns The default mode select cluster server.
   */
  getDefaultModeSelectClusterServer(description: string, supportedModes: ModeSelect.ModeOption[], currentMode = 0, startUpMode = 0) {
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
          this.log.debug('Matter command: ModeSelectCluster.changeToMode', data.request);
          await this.commandHandler.executeHandler('changeToMode', data);
        },
      },
    );
  }

  /**
   * Creates a default mode select cluster server.
   *
   * @remarks
   * This method adds a cluster server for a mode select cluster with default settings.
   *
   * @param endpoint - The endpoint to add the cluster server to. Defaults to `this` if not provided.
   */
  createDefaultModeSelectClusterServer(description: string, supportedModes: ModeSelect.ModeOption[], currentMode = 0, startUpMode = 0, endpoint?: Endpoint) {
    if (!endpoint) endpoint = this as Endpoint;
    endpoint.addClusterServer(this.getDefaultModeSelectClusterServer(description, supportedModes, currentMode, startUpMode));
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
   * @param measuredValue - The measured value of the flow in 10 x m/h.
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
   * @param measuredValue - The measured value of the of the flow in 10 x m/h.
   */
  createDefaultFlowMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultFlowMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default temperature measurement cluster server.
   *
   * @param measuredValue - The measured value of the temperature x 100.
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
   * @param measuredValue - The measured value of the temperature x 100.
   */
  createDefaultTemperatureMeasurementClusterServer(measuredValue = 0) {
    this.addClusterServer(this.getDefaultTemperatureMeasurementClusterServer(measuredValue));
  }

  /**
   * Get a default RelativeHumidityMeasurementCluster server.
   *
   * @param measuredValue - The measured value of the relative humidity x 100.
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
   * @param measuredValue - The measured value of the relative humidity x 100.
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
        endpointList: [],
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
        endpointList: [],
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
        endpointList: [],
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
  getDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityEnum.Unknown) {
    return ClusterServer(
      AirQualityCluster.with(AirQuality.Feature.Fair, AirQuality.Feature.Moderate, AirQuality.Feature.VeryPoor, AirQuality.Feature.ExtremelyPoor),
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
  createDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityEnum.Unknown) {
    this.addClusterServer(this.getDefaultAirQualityClusterServer(airQuality));
  }

  /**
   * Get a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  getDefaultTvocMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    return ClusterServer(
      TotalVolatileOrganicCompoundsConcentrationMeasurementCluster.with('NumericMeasurement'),
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
   * Creates a default TVOC measurement cluster server.
   *
   * @param measuredValue - The measured value for TVOC.
   */
  createDefaultTvocMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
    this.addClusterServer(this.getDefaultTvocMeasurementClusterServer(measuredValue, measurementUnit, measurementMedium));
  }

  /**
   * Get a default heating thermostat cluster server with the specified parameters.
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [minHeatSetpointLimit] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit] - The maximum heat setpoint limit value. Defaults to 50°.
   * @returns {ThermostatClusterServer} A default thermostat cluster server configured with the specified parameters.
   */
  getDefaultHeatingThermostatClusterServer(localTemperature = 23, occupiedHeatingSetpoint = 21, minHeatSetpointLimit = 0, maxHeatSetpointLimit = 50) {
    return ClusterServer(
      ThermostatCluster.with(Thermostat.Feature.Heating),
      {
        localTemperature: localTemperature * 100,
        systemMode: Thermostat.SystemMode.Heat,
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.HeatingOnly,
        // Thermostat.Feature.Heating
        occupiedHeatingSetpoint: occupiedHeatingSetpoint * 100,
        minHeatSetpointLimit: minHeatSetpointLimit * 100,
        maxHeatSetpointLimit: maxHeatSetpointLimit * 100,
        absMinHeatSetpointLimit: minHeatSetpointLimit * 100,
        absMaxHeatSetpointLimit: maxHeatSetpointLimit * 100,
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
   * Creates and adds a default heating thermostat cluster server to the device.
   *
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [minHeatSetpointLimit] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit] - The maximum heat setpoint limit value. Defaults to 50°.
   */
  createDefaultHeatingThermostatClusterServer(localTemperature = 23, occupiedHeatingSetpoint = 25, minHeatSetpointLimit = 0, maxHeatSetpointLimit = 50) {
    this.addClusterServer(this.getDefaultHeatingThermostatClusterServer(localTemperature, occupiedHeatingSetpoint, minHeatSetpointLimit, maxHeatSetpointLimit));
  }

  /**
   * Get a default cooling thermostat cluster server with the specified parameters.
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedCoolingSetpoint] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minCoolSetpointLimit] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit] - The maximum cool setpoint limit value. Defaults to 50°.
   * @returns {ThermostatClusterServer} A default thermostat cluster server configured with the specified parameters.
   */
  getDefaultCoolingThermostatClusterServer(localTemperature = 23, occupiedCoolingSetpoint = 25, minCoolSetpointLimit = 0, maxCoolSetpointLimit = 50) {
    return ClusterServer(
      ThermostatCluster.with(Thermostat.Feature.Cooling),
      {
        localTemperature: localTemperature * 100,
        systemMode: Thermostat.SystemMode.Cool,
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingOnly,
        // Thermostat.Feature.Cooling
        occupiedCoolingSetpoint: occupiedCoolingSetpoint * 100,
        minCoolSetpointLimit: minCoolSetpointLimit * 100,
        maxCoolSetpointLimit: maxCoolSetpointLimit * 100,
        absMinCoolSetpointLimit: minCoolSetpointLimit * 100,
        absMaxCoolSetpointLimit: maxCoolSetpointLimit * 100,
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
   * Creates and adds a default cooling thermostat cluster server to the device.
   *
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedCoolingSetpoint] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minCoolSetpointLimit] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit] - The maximum cool setpoint limit value. Defaults to 50°.
   */
  createDefaultCoolingThermostatClusterServer(localTemperature = 23, occupiedCoolingSetpoint = 25, minCoolSetpointLimit = 0, maxCoolSetpointLimit = 50) {
    this.addClusterServer(this.getDefaultCoolingThermostatClusterServer(localTemperature, occupiedCoolingSetpoint, minCoolSetpointLimit, maxCoolSetpointLimit));
  }

  /**
   * Get a default thermostat cluster server with the specified parameters.
   *
   * @param {number} [localTemperature=23] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint=21] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [occupiedCoolingSetpoint=25] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minSetpointDeadBand=1] - The minimum setpoint dead band value. Defaults to 1°.
   * @param {number} [minHeatSetpointLimit=0] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit=50] - The maximum heat setpoint limit value. Defaults to 50°.
   * @param {number} [minCoolSetpointLimit=0] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit=50] - The maximum cool setpoint limit value. Defaults to 50°.
   * @returns {ThermostatClusterServer} A default thermostat cluster server configured with the specified parameters.
   */
  getDefaultThermostatClusterServer(
    localTemperature = 23,
    occupiedHeatingSetpoint = 21,
    occupiedCoolingSetpoint = 25,
    minSetpointDeadBand = 1,
    minHeatSetpointLimit = 0,
    maxHeatSetpointLimit = 50,
    minCoolSetpointLimit = 0,
    maxCoolSetpointLimit = 50,
  ) {
    return ClusterServer(
      ThermostatCluster.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode),
      {
        localTemperature: localTemperature * 100,
        systemMode: Thermostat.SystemMode.Auto,
        controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingAndHeating,
        // Thermostat.Feature.Heating
        occupiedHeatingSetpoint: occupiedHeatingSetpoint * 100,
        minHeatSetpointLimit: minHeatSetpointLimit * 100,
        maxHeatSetpointLimit: maxHeatSetpointLimit * 100,
        absMinHeatSetpointLimit: minHeatSetpointLimit * 100,
        absMaxHeatSetpointLimit: maxHeatSetpointLimit * 100,
        // Thermostat.Feature.Cooling
        occupiedCoolingSetpoint: occupiedCoolingSetpoint * 100,
        minCoolSetpointLimit: minCoolSetpointLimit * 100,
        maxCoolSetpointLimit: maxCoolSetpointLimit * 100,
        absMinCoolSetpointLimit: minCoolSetpointLimit * 100,
        absMaxCoolSetpointLimit: maxCoolSetpointLimit * 100,
        // Thermostat.Feature.AutoMode
        minSetpointDeadBand: minSetpointDeadBand * 100,
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
   * @param {number} [localTemperature=23] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint=21] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [occupiedCoolingSetpoint=25] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minSetpointDeadBand=1] - The minimum setpoint dead band value. Defaults to 1°.
   * @param {number} [minHeatSetpointLimit=0] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit=50] - The maximum heat setpoint limit value. Defaults to 50°.
   * @param {number} [minCoolSetpointLimit=0] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit=50] - The maximum cool setpoint limit value. Defaults to 50°.
   */
  createDefaultThermostatClusterServer(
    localTemperature = 23,
    occupiedHeatingSetpoint = 21,
    occupiedCoolingSetpoint = 25,
    minSetpointDeadBand = 1,
    minHeatSetpointLimit = 0,
    maxHeatSetpointLimit = 50,
    minCoolSetpointLimit = 0,
    maxCoolSetpointLimit = 50,
  ) {
    this.addClusterServer(this.getDefaultThermostatClusterServer(localTemperature, occupiedHeatingSetpoint, occupiedCoolingSetpoint, minSetpointDeadBand, minHeatSetpointLimit, maxHeatSetpointLimit, minCoolSetpointLimit, maxCoolSetpointLimit));
  }

  /**
   * Get a default dummy time sync cluster server. Only needed to create a thermostat.
   */
  getDefaultTimeSyncClusterServer() {
    return ClusterServer(
      TimeSynchronizationCluster.with(TimeSynchronization.Feature.TimeZone),
      {
        utcTime: null,
        granularity: TimeSynchronization.Granularity.NoTimeGranularity,
        timeZone: [{ offset: 0, validAt: 0 }],
        dstOffset: [],
        localTime: null,
        timeZoneDatabase: TimeSynchronization.TimeZoneDatabase.None,
        timeZoneListMaxSize: 1,
        dstOffsetListMaxSize: 1,
      },
      {
        setTimeZone: async ({ request, attributes }) => {
          this.log.debug('Matter command: setTimeZone', request);
          await this.commandHandler.executeHandler('setTimeZone', { request, attributes });
          return { dstOffsetsRequired: false };
        },
        setDstOffset: async ({ request, attributes }) => {
          this.log.debug('Matter command: setDstOffset', request);
          await this.commandHandler.executeHandler('setDstOffset', { request, attributes });
        },
        setUtcTime: async ({ request, attributes }) => {
          this.log.debug('Matter command: setUtcTime', request);
          await this.commandHandler.executeHandler('setUtcTime', { request, attributes });
        },
      },
      {
        dstTableEmpty: true,
        dstStatus: true,
        timeZoneStatus: true,
        timeFailure: true,
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
  createDefaultPm1ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
  createDefaultPm25ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
  createDefaultPm10ConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
  createDefaultOzoneConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
  createDefaultRadonConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
  createDefaultNitrogenDioxideConcentrationMeasurementClusterServer(measuredValue = 0, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
      FanControlCluster.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto, FanControl.Feature.Step),
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
        step: async (data) => {
          this.log.debug('Matter command: step', data.request);
          await this.commandHandler.executeHandler('step', data);
        },
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

  /**
   * Returns the default Pump Configuration And Control cluster server.
   *
   * @param {PumpConfigurationAndControl.OperationMode} [pumpMode=PumpConfigurationAndControl.OperationMode.Normal] - The pump mode to set. Defaults to `PumpConfigurationAndControl.OperationMode.Normal`.
   * @returns {ClusterServer} - The default Pump Configuration And Control cluster server.
   */
  getDefaultPumpConfigurationAndControlClusterServer(pumpMode = PumpConfigurationAndControl.OperationMode.Normal) {
    return ClusterServer(
      PumpConfigurationAndControlCluster.with(PumpConfigurationAndControl.Feature.ConstantSpeed),
      {
        minConstSpeed: null,
        maxConstSpeed: null,
        maxPressure: null,
        maxSpeed: null,
        maxFlow: null,
        effectiveOperationMode: pumpMode,
        effectiveControlMode: PumpConfigurationAndControl.ControlMode.ConstantSpeed,
        capacity: null,
        operationMode: pumpMode,
      },
      {},
      {},
    );
  }
  /**
   * Creates the default Pump Configuration And Control cluster server.
   *
   * @param {PumpConfigurationAndControl.OperationMode} [pumpMode=PumpConfigurationAndControl.OperationMode.Normal] - The pump mode to set. Defaults to `PumpConfigurationAndControl.OperationMode.Normal`.
   * @returns {void}
   */
  createDefaultPumpConfigurationAndControlClusterServer(pumpMode = PumpConfigurationAndControl.OperationMode.Normal) {
    this.addClusterServer(this.getDefaultPumpConfigurationAndControlClusterServer(pumpMode));
  }

  getDefaultValveConfigurationAndControlClusterServer(valveState = ValveConfigurationAndControl.ValveState.Closed, valveLevel = 0) {
    return ClusterServer(
      ValveConfigurationAndControlCluster.with(ValveConfigurationAndControl.Feature.Level),
      {
        currentState: valveState,
        targetState: valveState,
        currentLevel: valveLevel,
        targetLevel: valveLevel,
        openDuration: null,
        defaultOpenDuration: null,
        remainingDuration: null,
      },
      {
        open: async (data) => {
          this.log.debug('Matter command: open', data.request);
          await this.commandHandler.executeHandler('open', data);
        },
        close: async (data) => {
          this.log.debug('Matter command: close');
          await this.commandHandler.executeHandler('close', data);
        },
      },
      {},
    );
  }
  /**
   * Create the default Valve Configuration And Control cluster server rev 2.
   *
   * @param {ValveConfigurationAndControl.ValveState} [valveState=ValveConfigurationAndControl.ValveState.Closed] - The valve state to set. Defaults to `ValveConfigurationAndControl.ValveState.Closed`.
   * @param {number} [valveLevel=0] - The valve level to set. Defaults to 0.
   * @returns {void}
   */
  createDefaultValveConfigurationAndControlClusterServer(valveState = ValveConfigurationAndControl.ValveState.Closed, valveLevel = 0) {
    this.addClusterServer(this.getDefaultValveConfigurationAndControlClusterServer(valveState, valveLevel));
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
        supportedModes: [
          { label: 'Normal', mode: 1, modeTags: [{ value: 1 }] },
          { label: 'Eco', mode: 2, modeTags: [{ value: 2 }] },
        ],
        currentMode: 1,
        startUpMode: 1,
      },
      {
        changeToMode: async ({ request, attributes }) => {
          this.log.debug('Matter command: DeviceEnergyManagementMode.changeToMode', request);
          await this.commandHandler.executeHandler('changeToMode', { request, attributes });
        },
      },
      {},
    );
  }
}
