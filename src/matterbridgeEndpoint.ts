/**
 * This file contains the class MatterbridgeEndpoint that extends the Endpoint class from the Matter.js library.
 *
 * @file matterbridgeEndpoint.ts
 * @author Luca Liguori
 * @date 2024-10-01
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

/* eslint-disable @typescript-eslint/no-unused-vars */

// Node.js modules
import { createHash } from 'crypto';

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, LogLevel, TimestampFormat, YELLOW, db, debugStringify, er, hk, or, rs, zb } from 'node-ansi-logger';

// Matterbridge
import {
  MatterbridgeBehavior,
  MatterbridgeBehaviorDevice,
  MatterbridgeBooleanStateConfigurationServer,
  MatterbridgeColorControlServer,
  MatterbridgeDoorLockServer,
  MatterbridgeFanControlServer,
  MatterbridgeIdentifyServer,
  MatterbridgeLevelControlServer,
  MatterbridgeOnOffServer,
  MatterbridgeThermostatServer,
  MatterbridgeWindowCoveringServer,
} from './matterbridgeBehaviors.js';
import { bridgedNode, MatterbridgeEndpointOptions } from './matterbridgeDeviceTypes.js';
import { deepCopy, isValidNumber, waiter } from './utils/utils.js';

// @matter
import { Endpoint, MutableEndpoint, EndpointType, Behavior, SupportedBehaviors, NamedHandler, Lifecycle } from '@matter/main';
import { ClusterId, EndpointNumber, VendorId, AtLeastOne, MakeMandatory } from '@matter/main';
import {
  AirQuality,
  AirQualityCluster,
  BasicInformation,
  BasicInformationCluster,
  BooleanState,
  BooleanStateCluster,
  BooleanStateConfiguration,
  BooleanStateConfigurationCluster,
  BridgedDeviceBasicInformation,
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
  DoorLock,
  DoorLockCluster,
  ElectricalEnergyMeasurement,
  ElectricalEnergyMeasurementCluster,
  ElectricalPowerMeasurement,
  ElectricalPowerMeasurementCluster,
  FanControl,
  FanControlCluster,
  FixedLabel,
  FixedLabelCluster,
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
  UserLabel,
  UserLabelCluster,
  WindowCovering,
  WindowCoveringCluster,
} from '@matter/main/clusters';
import { ClusterType, MeasurementType, getClusterNameById, Semtag, BitSchema, TypeFromPartialBitSchema, Attributes, Commands, Events, Cluster } from '@matter/main/types';
import { Specification, DeviceClassification } from '@matter/main/model';
import { DescriptorServer } from '@matter/node/behaviors/descriptor';
import { IdentifyBehavior, IdentifyServer } from '@matter/node/behaviors/identify';
import { GroupsServer } from '@matter/node/behaviors/groups';
import { TemperatureMeasurementServer } from '@matter/node/behaviors/temperature-measurement';
import { RelativeHumidityMeasurementServer } from '@matter/node/behaviors/relative-humidity-measurement';
import { PressureMeasurementServer } from '@matter/node/behaviors/pressure-measurement';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { FlowMeasurementServer } from '@matter/node/behaviors/flow-measurement';
import { TimeSynchronizationServer } from '@matter/node/behaviors/time-synchronization';
import { IlluminanceMeasurementServer } from '@matter/node/behaviors/illuminance-measurement';
import { BooleanStateServer } from '@matter/node/behaviors/boolean-state';
import { OccupancySensingServer } from '@matter/node/behaviors/occupancy-sensing';
import {
  AirQualityServer,
  BasicInformationServer,
  CarbonDioxideConcentrationMeasurementServer,
  CarbonMonoxideConcentrationMeasurementServer,
  ElectricalEnergyMeasurementServer,
  ElectricalPowerMeasurementServer,
  FixedLabelServer,
  FormaldehydeConcentrationMeasurementServer,
  ModeSelectServer,
  NitrogenDioxideConcentrationMeasurementServer,
  OzoneConcentrationMeasurementServer,
  Pm10ConcentrationMeasurementServer,
  Pm1ConcentrationMeasurementServer,
  Pm25ConcentrationMeasurementServer,
  PowerSourceServer,
  PowerTopologyServer,
  RadonConcentrationMeasurementServer,
  SmokeCoAlarmServer,
  SwitchServer,
  TotalVolatileOrganicCompoundsConcentrationMeasurementServer,
  UserLabelServer,
} from '@matter/main/behaviors';

// @project-chip
import { DeviceTypeDefinition, EndpointOptions } from '@project-chip/matter.js/device';
import { ClusterClientObj, ClusterServer, ClusterServerHandlers, ClusterServerObj, GroupsClusterHandler } from '@project-chip/matter.js/cluster';
import { SerializedMatterbridgeDevice } from './matterbridgeDevice.js';

export interface MatterbridgeEndpointCommands {
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

  upOrOpen: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['upOrOpen']>;
  downOrClose: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['downOrClose']>;
  stopMotion: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['stopMotion']>;
  goToLiftPercentage: MakeMandatory<ClusterServerHandlers<typeof WindowCovering.Complete>['goToLiftPercentage']>;

  lockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['lockDoor']>;
  unlockDoor: MakeMandatory<ClusterServerHandlers<typeof DoorLock.Complete>['unlockDoor']>;

  setpointRaiseLower: MakeMandatory<ClusterServerHandlers<typeof Thermostat.Complete>['setpointRaiseLower']>;

  changeToMode: MakeMandatory<ClusterServerHandlers<typeof ModeSelect.Complete>['changeToMode']>;

  step: MakeMandatory<ClusterServerHandlers<typeof FanControl.Complete>['step']>;

  suppressAlarm: MakeMandatory<ClusterServerHandlers<typeof BooleanStateConfiguration.Complete>['suppressAlarm']>;
  enableDisableAlarm: MakeMandatory<ClusterServerHandlers<typeof BooleanStateConfiguration.Complete>['enableDisableAlarm']>;

  selfTestRequest: MakeMandatory<ClusterServerHandlers<typeof SmokeCoAlarm.Complete>['selfTestRequest']>;

  resetCounts: MakeMandatory<ClusterServerHandlers<typeof ThreadNetworkDiagnostics.Complete>['resetCounts']>;

  setUtcTime: MakeMandatory<ClusterServerHandlers<typeof TimeSynchronization.Complete>['setUtcTime']>;
  setTimeZone: MakeMandatory<ClusterServerHandlers<typeof TimeSynchronization.Complete>['setTimeZone']>;
  setDstOffset: MakeMandatory<ClusterServerHandlers<typeof TimeSynchronization.Complete>['setDstOffset']>;

  pauseRequest: MakeMandatory<ClusterServerHandlers<typeof DeviceEnergyManagement.Complete>['pauseRequest']>;
  resumeRequest: MakeMandatory<ClusterServerHandlers<typeof DeviceEnergyManagement.Complete>['resumeRequest']>;
}

export class MatterbridgeEndpoint extends Endpoint {
  public static bridgeMode = '';
  public static logLevel = LogLevel.INFO;

  log: AnsiLogger;
  plugin: string | undefined = undefined;

  deviceName: string | undefined = undefined;
  serialNumber: string | undefined = undefined;
  uniqueId: string | undefined = undefined;
  vendorId: number | undefined = undefined;
  vendorName: string | undefined = undefined;
  productId: number | undefined = undefined;
  productName: string | undefined = undefined;
  softwareVersion: number | undefined = undefined;
  softwareVersionString: string | undefined = undefined;
  hardwareVersion: number | undefined = undefined;
  hardwareVersionString: string | undefined = undefined;

  name: string | undefined = undefined;
  deviceType: number;
  uniqueStorageKey: string | undefined = undefined;
  tagList?: Semtag[] = undefined;

  // Maps matter deviceTypes and endpoints
  private readonly deviceTypes = new Map<number, DeviceTypeDefinition>();
  private readonly clusterServers = new Map<ClusterId, ClusterServerObj>();
  private readonly clusterClients = new Map<ClusterId, ClusterClientObj>();
  readonly commandHandler = new NamedHandler<MatterbridgeEndpointCommands>();

  /**
   * Represents a MatterbridgeEndpoint.
   * @constructor
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the endpoint.
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the device.
   */
  constructor(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug = false) {
    // Get the first DeviceTypeDefinition
    let firstDefinition: DeviceTypeDefinition;
    if (Array.isArray(definition)) firstDefinition = definition[0];
    else firstDefinition = definition;

    // Convert the first DeviceTypeDefinition to an EndpointType.Options
    const deviceTypeDefinitionV8: EndpointType.Options = {
      name: firstDefinition.name.replace('-', '_'),
      deviceType: firstDefinition.code,
      deviceRevision: firstDefinition.revision,
      deviceClass: firstDefinition.deviceClass.toLowerCase() as unknown as DeviceClassification,
      requirements: {
        server: {
          mandatory: SupportedBehaviors(...MatterbridgeEndpoint.getBehaviourTypesFromClusterServerIds(firstDefinition.requiredServerClusters)),
          optional: SupportedBehaviors(...MatterbridgeEndpoint.getBehaviourTypesFromClusterServerIds(firstDefinition.optionalServerClusters)),
        },
        client: {
          mandatory: SupportedBehaviors(...MatterbridgeEndpoint.getBehaviourTypesFromClusterClientIds(firstDefinition.requiredClientClusters)),
          optional: SupportedBehaviors(...MatterbridgeEndpoint.getBehaviourTypesFromClusterClientIds(firstDefinition.optionalClientClusters)),
        },
      },
      behaviors: options.tagList ? SupportedBehaviors(DescriptorServer.with(Descriptor.Feature.TagList)) : {},
    };
    const endpointV8 = MutableEndpoint(deviceTypeDefinitionV8);

    // Convert the options to an Endpoint.Options
    // [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }]
    // endpoint = endpoint.enable({features: { tagList: true }});
    const optionsV8 = {
      id: options.uniqueStorageKey?.replace(/[ .]/g, ''),
      number: options.endpointId,
      descriptor: options.tagList ? { tagList: options.tagList } : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as { id?: string; number?: EndpointNumber; descriptor?: Record<string, any> };
    super(endpointV8, optionsV8);
    this.uniqueStorageKey = options.uniqueStorageKey;
    this.name = firstDefinition.name;
    this.deviceType = firstDefinition.code;
    this.tagList = options.tagList;
    // console.log('MatterbridgeEndpoint.option', options);
    // console.log('MatterbridgeEndpoint.endpointV8', endpointV8);
    // console.log('MatterbridgeEndpoint.optionsV8', optionsV8);

    // Update the endpoint
    this.log = new AnsiLogger({ logName: 'MatterbridgeEndpoint', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: debug === true ? LogLevel.DEBUG : MatterbridgeEndpoint.logLevel });
    this.log.debug(
      `${YELLOW}new${db} MatterbridgeEndpoint: ${zb}${'0x' + firstDefinition.code.toString(16).padStart(4, '0')}${db}-${zb}${firstDefinition.name}${db} ` +
        `id: ${CYAN}${options.uniqueStorageKey}${db} number: ${CYAN}${options.endpointId}${db} taglist: ${CYAN}${options.tagList ? debugStringify(options.tagList) : 'undefined'}${db}`,
    );
    this.deviceTypes.set(firstDefinition.code, firstDefinition);

    // Add the other device types to the descriptor server
    if (Array.isArray(definition)) {
      definition.forEach((deviceType) => {
        this.addDeviceType(deviceType);
      });
    }

    // Add MatterbridgeBehavior with MatterbridgeBehaviorDevice
    this.behaviors.require(MatterbridgeBehavior, { deviceCommand: new MatterbridgeBehaviorDevice(this.log, this.commandHandler, undefined) });
  }

  /**
   * Loads an instance of the MatterbridgeDevice class.
   *
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the device.
   * @returns MatterbridgeDevice instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: EndpointOptions = {}, debug = false) {
    return new MatterbridgeEndpoint(definition, options, debug);
  }

  static getBehaviourTypesFromClusterServerIds(clusterServerList: ClusterId[]) {
    // Map Server ClusterId to Behavior.Type
    const behaviorTypes: Behavior.Type[] = [];
    clusterServerList.forEach((clusterId) => {
      behaviorTypes.push(MatterbridgeEndpoint.getBehaviourTypeFromClusterServerId(clusterId));
    });
    return behaviorTypes;
  }

  static getBehaviourTypesFromClusterClientIds(clusterClientList: ClusterId[]) {
    // Map Client ClusterId to Behavior.Type
    const behaviorTypes: Behavior.Type[] = [];
    clusterClientList.forEach((clusterId) => {
      // behaviorTypes.push(MatterbridgeEndpoint.getBehaviourTypeFromClusterClientId(clusterId));
    });
    return behaviorTypes;
  }

  static getBehaviourTypeFromClusterServerId(clusterId: ClusterId, type?: string) {
    // Map ClusterId to Behavior.Type
    if (clusterId === Identify.Cluster.id) return MatterbridgeIdentifyServer;
    if (clusterId === Groups.Cluster.id) return GroupsServer;
    if (clusterId === OnOff.Cluster.id) return MatterbridgeOnOffServer;
    if (clusterId === LevelControl.Cluster.id) return MatterbridgeLevelControlServer;
    if (clusterId === ColorControl.Cluster.id) return MatterbridgeColorControlServer;
    if (clusterId === DoorLock.Cluster.id) return MatterbridgeDoorLockServer;

    if (clusterId === Thermostat.Cluster.id && type === 'AutoModeThermostat') return MatterbridgeThermostatServer.with('AutoMode', 'Heating', 'Cooling');
    if (clusterId === Thermostat.Cluster.id && type === 'HeatingThermostat') return MatterbridgeThermostatServer.with('Heating');
    if (clusterId === Thermostat.Cluster.id && type === 'CoolingThermostat') return MatterbridgeThermostatServer.with('Cooling');

    if (clusterId === WindowCovering.Cluster.id) return MatterbridgeWindowCoveringServer;
    if (clusterId === FanControl.Cluster.id) return MatterbridgeFanControlServer;
    if (clusterId === Switch.Cluster.id && type === 'MomentarySwitch') return SwitchServer.with('MomentarySwitch', 'MomentarySwitchRelease', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress');
    if (clusterId === Switch.Cluster.id && type === 'LatchingSwitch') return SwitchServer.with('LatchingSwitch');
    if (clusterId === TemperatureMeasurement.Cluster.id) return TemperatureMeasurementServer;
    if (clusterId === RelativeHumidityMeasurement.Cluster.id) return RelativeHumidityMeasurementServer;
    if (clusterId === PressureMeasurement.Cluster.id) return PressureMeasurementServer;
    if (clusterId === FlowMeasurement.Cluster.id) return FlowMeasurementServer;
    if (clusterId === BooleanState.Cluster.id) return BooleanStateServer;
    if (clusterId === BooleanStateConfiguration.Cluster.id) return MatterbridgeBooleanStateConfigurationServer;
    if (clusterId === OccupancySensing.Cluster.id) return OccupancySensingServer;
    if (clusterId === IlluminanceMeasurement.Cluster.id) return IlluminanceMeasurementServer;
    if (clusterId === SmokeCoAlarm.Cluster.id) return SmokeCoAlarmServer.with('SmokeAlarm', 'CoAlarm');

    if (clusterId === AirQuality.Cluster.id) return AirQualityServer.with('Fair', 'Moderate', 'VeryPoor', 'ExtremelyPoor');
    if (clusterId === CarbonMonoxideConcentrationMeasurement.Cluster.id) return CarbonMonoxideConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === CarbonDioxideConcentrationMeasurement.Cluster.id) return CarbonDioxideConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === NitrogenDioxideConcentrationMeasurement.Cluster.id) return NitrogenDioxideConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === OzoneConcentrationMeasurement.Cluster.id) return OzoneConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === FormaldehydeConcentrationMeasurement.Cluster.id) return FormaldehydeConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === Pm1ConcentrationMeasurement.Cluster.id) return Pm1ConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === Pm25ConcentrationMeasurement.Cluster.id) return Pm25ConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === Pm10ConcentrationMeasurement.Cluster.id) return Pm10ConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === RadonConcentrationMeasurement.Cluster.id) return RadonConcentrationMeasurementServer.with('NumericMeasurement');
    if (clusterId === TotalVolatileOrganicCompoundsConcentrationMeasurement.Cluster.id) return TotalVolatileOrganicCompoundsConcentrationMeasurementServer.with('NumericMeasurement');

    if (clusterId === ModeSelect.Cluster.id) return ModeSelectServer;
    if (clusterId === UserLabel.Cluster.id) return UserLabelServer;
    if (clusterId === FixedLabel.Cluster.id) return FixedLabelServer;

    if (clusterId === PowerTopology.Cluster.id) return PowerTopologyServer.with('TreeTopology');
    if (clusterId === ElectricalPowerMeasurement.Cluster.id) return ElectricalPowerMeasurementServer.with('AlternatingCurrent');
    if (clusterId === ElectricalEnergyMeasurement.Cluster.id) return ElectricalEnergyMeasurementServer.with('ImportedEnergy', 'ExportedEnergy', 'CumulativeEnergy');

    if (clusterId === PowerSource.Cluster.id && type === 'WiredPowerSource') return PowerSourceServer.with(PowerSource.Feature.Wired);
    if (clusterId === PowerSource.Cluster.id && type === 'BatteryReplaceablePowerSource') return PowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable);
    if (clusterId === PowerSource.Cluster.id && type === 'BatteryRechargeablePowerSource') return PowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable);

    if (clusterId === BasicInformation.Cluster.id) return BasicInformationServer;
    if (clusterId === BridgedDeviceBasicInformation.Cluster.id) return BridgedDeviceBasicInformationServer;
    return MatterbridgeIdentifyServer;
  }

  static getBehaviourTypeFromClusterClientId(clusterId: ClusterId) {
    // Map ClusterId to Behavior.Type
    return IdentifyBehavior;
  }

  /**
   * Adds a device type to the list of device types.
   * If the device type is not already present in the list, it will be added.
   *
   * @param {DeviceTypeDefinition} deviceType - The device type to add.
   */
  addDeviceType(deviceType: DeviceTypeDefinition) {
    if (!this.deviceTypes.has(deviceType.code)) {
      // Keep the Matterbridge internal map
      this.log.debug(`addDeviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
      this.deviceTypes.set(deviceType.code, deviceType);
      // Add the device types to the descriptor server
      const deviceTypeList = Array.from(this.deviceTypes.values()).map((dt) => ({
        deviceType: dt.code,
        revision: dt.revision,
      }));
      if (this.tagList) {
        this.behaviors.require(DescriptorServer.with(Descriptor.Feature.TagList), {
          tagList: this.tagList,
          deviceTypeList,
        });
      } else {
        this.behaviors.require(DescriptorServer, {
          deviceTypeList,
        });
      }
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
      this.log.debug(`- with deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    deviceTypes.forEach((deviceType) => {
      this.addDeviceType(deviceType);
    });
    this.addClusterServerFromList(this, includeServerList);
  }

  /**
   * Adds the required cluster servers (only if they are not present) for the device types of the specified endpoint.
   *
   * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the required cluster servers to.
   * @returns {MatterbridgeEndpoint} The updated endpoint with the required cluster servers added.
   */
  addRequiredClusterServers(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
    const requiredServerList: ClusterId[] = [];
    this.log.debug(`addRequiredClusterServer for ${CYAN}${endpoint.id}${db}`);
    endpoint.getDeviceTypes().forEach((deviceType) => {
      this.log.debug(`- for deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!requiredServerList.includes(clusterId) && !endpoint.getClusterServerById(clusterId)) requiredServerList.push(clusterId);
      });
    });
    requiredServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(endpoint, requiredServerList);
    return endpoint;
  }

  /**
   * Adds the optional cluster servers (only if they are not present) for the device types of the specified endpoint.
   *
   * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the required cluster servers to.
   * @returns {MatterbridgeEndpoint} The updated endpoint with the required cluster servers added.
   */
  addOptionalClusterServers(endpoint: MatterbridgeEndpoint): MatterbridgeEndpoint {
    const optionalServerList: ClusterId[] = [];
    this.log.debug(`addRequiredClusterServer for ${CYAN}${endpoint.id}${db}`);
    endpoint.getDeviceTypes().forEach((deviceType) => {
      this.log.debug(`- for deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
      deviceType.optionalServerClusters.forEach((clusterId) => {
        if (!optionalServerList.includes(clusterId) && !endpoint.getClusterServerById(clusterId)) optionalServerList.push(clusterId);
      });
    });
    optionalServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(endpoint, optionalServerList);
    return endpoint;
  }

  /**
   * Adds a child endpoint with one or more device types with the required cluster servers and the specified cluster servers.
   * If the child endpoint is not already present in the childEndpoints, it will be added.
   * If the child endpoint is already present in the childEndpoints, the device types and cluster servers will be added to the existing child endpoint.
   *
   * @param {string} endpointName - The name of the new enpoint to add.
   * @param {AtLeastOne<DeviceTypeDefinition>} deviceTypes - The device types to add.
   * @param {ClusterId[]} [includeServerList=[]] - The list of cluster IDs to include.
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - Whether to enable debug logging.
   * @returns {MatterbridgeEndpoint} - The child endpoint that was found or added.
   */
  addChildDeviceTypeWithClusterServer(endpointName: string, deviceTypes: AtLeastOne<DeviceTypeDefinition>, includeServerList: ClusterId[] = [], options: MatterbridgeEndpointOptions = {}, debug = false) {
    this.log.debug(`addChildDeviceTypeWithClusterServer: ${CYAN}${endpointName}${db}`);
    let child = this.getChildEndpointByName(endpointName);
    if (!child) {
      if ('tagList' in options) {
        for (const tag of options.tagList as Semtag[]) {
          this.log.debug(`- with tagList: mfgCode ${CYAN}${tag.mfgCode}${db} namespaceId ${CYAN}${tag.namespaceId}${db} tag ${CYAN}${tag.tag}${db} label ${CYAN}${tag.label}${db}`);
        }
        child = new MatterbridgeEndpoint(deviceTypes[0], { uniqueStorageKey: endpointName, tagList: options.tagList }, debug);
      } else {
        child = new MatterbridgeEndpoint(deviceTypes[0], { uniqueStorageKey: endpointName }, debug);
      }
    }
    deviceTypes.forEach((deviceType) => {
      this.log.debug(`- with deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
      deviceType.requiredServerClusters.forEach((clusterId) => {
        if (!includeServerList.includes(clusterId)) includeServerList.push(clusterId);
      });
    });
    includeServerList.forEach((clusterId) => {
      this.log.debug(`- with cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
    });
    this.addClusterServerFromList(child, includeServerList);
    if (this.lifecycle.isInstalled) {
      this.log.debug(`- with lifecycle installed`);
      this.add(child);
    } else {
      this.log.debug(`- with lifecycle NOT installed`);
      this.parts.add(child);
    }
    return child;
  }

  /**
   * Retrieves a child endpoint by its name.
   *
   * @param {string} endpointName - The name of the endpoint to retrieve.
   * @returns {Endpoint | undefined} The child endpoint with the specified name, or undefined if not found.
   */
  getChildEndpointByName(endpointName: string): MatterbridgeEndpoint | undefined {
    return this.parts.find((part) => part.id === endpointName) as MatterbridgeEndpoint | undefined;
  }

  getChildEndpoint(endpointNumber: EndpointNumber): MatterbridgeEndpoint | undefined {
    return this.parts.find((part) => part.number === endpointNumber) as MatterbridgeEndpoint | undefined;
  }

  getChildEndpoints(): Endpoint[] {
    return Array.from(this.parts);
  }

  getDeviceTypes(): DeviceTypeDefinition[] {
    return Array.from(this.deviceTypes.values());
  }

  setDeviceTypes(deviceTypes: AtLeastOne<DeviceTypeDefinition>): void {
    deviceTypes.forEach((deviceType) => {
      this.addDeviceType(deviceType);
    });
  }

  async setBridgedDeviceReachability(reachable: boolean) {
    await this.setAttribute(BridgedDeviceBasicInformationCluster.id, 'reachable', reachable, this.log);
    await this.triggerEvent(BridgedDeviceBasicInformationCluster.id, 'reachable', { reachableNewValue: reachable }, this.log);
  }

  hasClusterServer<F extends BitSchema, SF extends TypeFromPartialBitSchema<F>, A extends Attributes, C extends Commands, E extends Events>(cluster: Cluster<F, SF, A, C, E>): boolean {
    return this.clusterServers.has(cluster.id);
  }

  getClusterServer<const T extends ClusterType>(cluster: T): ClusterServerObj<T> | undefined {
    const clusterServer = this.clusterServers.get(cluster.id);
    if (clusterServer !== undefined) {
      return clusterServer as unknown as ClusterServerObj<T>;
    }
  }

  getAllClusterServers(): ClusterServer[] {
    return [...this.clusterServers.values()];
  }

  getClusterServerById(clusterId: ClusterId): ClusterServerObj | undefined {
    return this.clusterServers.get(clusterId);
  }

  addTagList(endpoint: Endpoint, mfgCode: VendorId | null, namespaceId: number, tag: number, label?: string | null) {
    // Do nothing here only for old api compatibility
  }

  addClusterServer<const T extends ClusterType>(cluster: ClusterServerObj<T>) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: Record<string, any> = {};
    for (const attribute of Object.values(cluster.attributes)) {
      // console.error('Attribute:', (attribute as any).id, (attribute as any).name, (attribute as any).value);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((attribute as any).id < 0xfff0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        options[(attribute as any).name] = (attribute as any).value;
      }
    }
    this.log.debug(`addClusterServer: ${hk}${'0x' + cluster.id.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(cluster.id)}${db} with options: ${debugStringify(options)}${rs}`);
    if (this.clusterServers.has(cluster.id)) {
      this.log.debug(`****cluster ${hk}${'0x' + cluster.id.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(cluster.id)}${db} already added`);
    }
    let type = undefined;
    if (cluster.id === SwitchCluster.id && cluster.isEventSupportedByName('multiPressComplete')) type = 'MomentarySwitch';
    if (cluster.id === SwitchCluster.id && cluster.isEventSupportedByName('switchLatched')) type = 'LatchingSwitch';

    if (cluster.id === PowerSourceCluster.id && cluster.isAttributeSupportedByName('wiredCurrentType')) type = 'WiredPowerSource';
    if (cluster.id === PowerSourceCluster.id && cluster.isAttributeSupportedByName('batReplacementDescription')) type = 'BatteryReplaceablePowerSource';
    if (cluster.id === PowerSourceCluster.id && cluster.isAttributeSupportedByName('batChargeState')) type = 'BatteryRechargeablePowerSource';

    if (cluster.id === ThermostatCluster.id && cluster.isAttributeSupportedByName('occupiedCoolingSetpoint')) type = 'CoolingThermostat';
    if (cluster.id === ThermostatCluster.id && cluster.isAttributeSupportedByName('occupiedHeatingSetpoint')) type = 'HeatingThermostat';
    if (cluster.id === ThermostatCluster.id && cluster.isAttributeSupportedByName('minSetpointDeadBand')) type = 'AutoModeThermostat';

    const behavior = MatterbridgeEndpoint.getBehaviourTypeFromClusterServerId(cluster.id, type);
    if (cluster.id === PowerTopologyCluster.id && this.clusterServers.has(cluster.id)) return; // TODO remove this workaround
    if (cluster.id === ElectricalPowerMeasurementCluster.id && this.clusterServers.has(cluster.id)) return; // TODO remove this workaround
    if (cluster.id === ElectricalEnergyMeasurementCluster.id && this.clusterServers.has(cluster.id)) return; // TODO remove this workaround
    if (cluster.id === ThermostatCluster.id && this.clusterServers.has(cluster.id)) return; // TODO remove this workaround
    this.clusterServers.set(cluster.id, cluster as unknown as ClusterServerObj);
    if (cluster.id === BasicInformationCluster.id) return; // Not used in Matterbridge edge for devices. Only on server node.
    this.behaviors.require(behavior, options);
  }

  /**
   * Adds cluster servers to the specified endpoint based on the provided server list.
   *
   * @param {Endpoint} endpoint - The endpoint to add cluster servers to.
   * @param {ClusterId[]} includeServerList - The list of cluster IDs to include.
   * @returns void
   */
  addClusterServerFromList(endpoint: MatterbridgeEndpoint, includeServerList: ClusterId[]): void {
    if (includeServerList.includes(Identify.Cluster.id)) endpoint.addClusterServer(this.getDefaultIdentifyClusterServer());
    if (includeServerList.includes(Groups.Cluster.id)) endpoint.addClusterServer(this.getDefaultGroupsClusterServer());
    if (includeServerList.includes(OnOff.Cluster.id)) endpoint.addClusterServer(this.getDefaultOnOffClusterServer());
    if (includeServerList.includes(LevelControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultLevelControlClusterServer());
    if (includeServerList.includes(ColorControl.Cluster.id)) endpoint.addClusterServer(this.getDefaultColorControlClusterServer());
    if (includeServerList.includes(Switch.Cluster.id)) endpoint.addClusterServer(this.getDefaultSwitchClusterServer());
    if (includeServerList.includes(DoorLock.Cluster.id)) endpoint.addClusterServer(this.getDefaultDoorLockClusterServer());
    if (includeServerList.includes(Thermostat.Cluster.id)) endpoint.addClusterServer(this.getDefaultThermostatClusterServer());
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
    // if (includeServerList.includes(DeviceEnergyManagement.Cluster.id)) endpoint.addClusterServer(this.getDefaultDeviceEnergyManagementClusterServer());
    // if (includeServerList.includes(DeviceEnergyManagementMode.Cluster.id)) endpoint.addClusterServer(this.getDefaultDeviceEnergyManagementModeClusterServer());
  }

  async addFixedLabel(label: string, value: string) {
    if (!this.clusterServers.get(FixedLabelCluster.id)) {
      this.log.debug(`addFixedLabel: add cluster ${hk}FixedLabelCluster${db} with label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
      this.addClusterServer(
        ClusterServer(
          FixedLabelCluster,
          {
            labelList: [{ label, value }],
          },
          {},
        ),
      );
      return;
    }
    this.log.debug(`addFixedLabel: add label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
    // if (this.construction.status !== Lifecycle.Status.Active) await this.construction.ready;
    const labelList = (this.getAttribute(FixedLabelCluster.id, 'labelList', this.log) ?? []).filter((entryLabel: { label: string; value: string }) => entryLabel.label !== label);
    labelList.push({ label, value });
    await this.setAttribute(FixedLabelCluster.id, 'labelList', labelList, this.log);
  }

  async addUserLabel(label: string, value: string) {
    if (!this.clusterServers.get(UserLabelCluster.id)) {
      this.log.debug(`addUserLabel: add cluster ${hk}UserLabelCluster${db} with label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
      this.addClusterServer(
        ClusterServer(
          UserLabelCluster,
          {
            labelList: [{ label, value }],
          },
          {},
        ),
      );
      return;
    }
    this.log.debug(`addUserLabel: add label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
    // if (this.construction.status !== Lifecycle.Status.Active) await this.construction.ready;
    const labelList = (this.getAttribute(UserLabelCluster.id, 'labelList', this.log) ?? []).filter((entryLabel: { label: string; value: string }) => entryLabel.label !== label);
    labelList.push({ label, value });
    await this.setAttribute(UserLabelCluster.id, 'labelList', labelList, this.log);
  }

  private capitalizeFirstLetter(name: string): string {
    if (!name) return name;
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  private lowercaseFirstLetter(name: string): string {
    if (!name) return name;
    return name.charAt(0).toLowerCase() + name.slice(1);
  }

  /**
   * Retrieves the value of the specified attribute from the given endpoint and cluster.
   *
   * @param {ClusterId} clusterId - The ID of the cluster to retrieve the attribute from.
   * @param {string} attribute - The name of the attribute to retrieve.
   * @param {AnsiLogger} [log] - Optional logger for error and info messages.
   * @param {MatterbridgeEndpoint} [endpoint] - Optional the child endpoint to retrieve the attribute from.
   * @returns {any} The value of the attribute, or undefined if the attribute is not found.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAttribute(clusterId: ClusterId, attribute: string, log?: AnsiLogger, endpoint?: MatterbridgeEndpoint): any {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    const clusterName = this.lowercaseFirstLetter(getClusterNameById(clusterId));

    if (endpoint.construction.status !== Lifecycle.Status.Active) {
      this.log.error(`getAttribute ${hk}${clusterName}.${attribute}${er} error: Endpoint ${or}${endpoint.id}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
      return undefined;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = endpoint.state as Record<string, Record<string, any>>;

    if (!(clusterName in state)) {
      this.log.error(`getAttribute error: Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} not found on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return undefined;
    }
    attribute = this.lowercaseFirstLetter(attribute);
    if (!(attribute in state[clusterName])) {
      this.log.error(`getAttribute error: Attribute ${hk}${attribute}${er} not found on Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return undefined;
    }
    const value = state[clusterName][attribute];
    log?.info(
      `${db}Get endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${this.capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db} value ${YELLOW}${typeof value === 'object' ? debugStringify(value) : value}${db}`,
    );
    return value;
  }

  /**
   * Sets the value of an attribute on a cluster server endpoint.
   *
   * @param {ClusterId} clusterId - The ID of the cluster.
   * @param {string} attribute - The name of the attribute.
   * @param {any} value - The value to set for the attribute.
   * @param {AnsiLogger} [log] - (Optional) The logger to use for logging errors and information.
   * @param {MatterbridgeEndpoint} [endpoint] - (Optional) The endpoint to set the attribute on. If not provided, the attribute will be set on the current endpoint.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the attribute was successfully set.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async setAttribute(clusterId: ClusterId, attribute: string, value: any, log?: AnsiLogger, endpoint?: MatterbridgeEndpoint): Promise<boolean> {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    const clusterName = this.lowercaseFirstLetter(getClusterNameById(clusterId));

    if (endpoint.construction.status !== Lifecycle.Status.Active) {
      this.log.error(`setAttribute ${hk}${clusterName}.${attribute}${er} error: Endpoint ${or}${endpoint.id}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
      // await endpoint.construction.ready;
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const state = endpoint.state as Record<string, Record<string, any>>;

    if (!(clusterName in state)) {
      this.log.error(`setAttribute ${hk}${attribute}${er} error: Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} not found on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return false;
    }
    attribute = this.lowercaseFirstLetter(attribute);
    if (!(attribute in state[clusterName])) {
      this.log.error(`setAttribute error: Attribute ${hk}${attribute}${er} not found on Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return false;
    }
    let oldValue = state[clusterName][attribute];
    if (typeof oldValue === 'object') oldValue = deepCopy(oldValue);
    await endpoint.setStateOf(endpoint.behaviors.supported[clusterName], { [attribute]: value });
    // await endpoint.set({ [clusterName]: { [attribute]: value } });
    log?.info(
      `${db}Set endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${this.capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db} ` +
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
   * @param {AnsiLogger} [log] - Optional logger for logging errors and information.
   * @param {MatterbridgeEndpoint} [endpoint] - Optional endpoint to subscribe the attribute on. Defaults to the current endpoint.
   * @returns {boolean} - A boolean indicating whether the subscription was successful.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async subscribeAttribute(clusterId: ClusterId, attribute: string, listener: (newValue: any, oldValue: any) => void, log?: AnsiLogger, endpoint?: MatterbridgeEndpoint): Promise<boolean> {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    const clusterName = this.lowercaseFirstLetter(getClusterNameById(clusterId));

    if (endpoint.construction.status !== Lifecycle.Status.Active) {
      // this.log.error(`subscribeAttribute ${hk}${clusterName}.${attribute}${er} error: Endpoint ${or}${endpoint.id}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
      await endpoint.construction.ready;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = endpoint.events as Record<string, Record<string, any>>;

    if (!(clusterName in events)) {
      this.log.error(`subscribeAttribute ${hk}${attribute}${er} error: Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} not found on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return false;
    }
    attribute = this.lowercaseFirstLetter(attribute) + '$Changed';
    if (!(attribute in events[clusterName])) {
      this.log.error(`subscribeAttribute error: Attribute ${hk}${attribute}${er} not found on Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return false;
    }
    events[clusterName][attribute].on(listener);
    log?.info(`${db}Subscribe endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${this.capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db}`);
    return true;
  }

  /**
   * Triggers an event on the specified cluster.
   *
   * @param {ClusterId} clusterId - The ID of the cluster.
   * @param {string} event - The name of the event to trigger.
   * @param {Record<string, boolean | number | bigint | string | object | undefined | null>} payload - The payload to pass to the event.
   * @param {AnsiLogger} [log] - Optional logger for logging information.
   * @param {MatterbridgeEndpoint} [endpoint] - Optional endpoint to trigger the event on. Defaults to the current endpoint.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the event was successfully triggered.
   */
  async triggerEvent(clusterId: ClusterId, event: string, payload: Record<string, boolean | number | bigint | string | object | undefined | null>, log?: AnsiLogger, endpoint?: MatterbridgeEndpoint): Promise<boolean> {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;

    const clusterName = this.lowercaseFirstLetter(getClusterNameById(clusterId));

    if (endpoint.construction.status !== Lifecycle.Status.Active) {
      // this.log.error(`triggerEvent ${hk}${clusterName}.${event}${er} error: Endpoint ${or}${endpoint.id}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
      await endpoint.construction.ready;
      // return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = endpoint.events as Record<string, Record<string, any>>;
    if (!(clusterName in events) || !(event in events[clusterName])) {
      this.log.error(`triggerEvent ${hk}${event}${er} error: Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} not found on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await endpoint.act((agent) => agent[clusterName].events[event].emit(payload, agent.context));
    log?.info(`${db}Trigger event ${hk}${this.capitalizeFirstLetter(clusterName)}${db}.${hk}${event}${db} with ${debugStringify(payload)}${db} on endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} `);
    return true;
  }

  /**
   * Adds a command handler for the specified command.
   *
   * @param {keyof MatterbridgeEndpointCommands} command - The command to add the handler for.
   * @param {(data: any) => void} handler - The handler function to execute when the command is received.
   * @returns {void}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addCommandHandler(command: keyof MatterbridgeEndpointCommands, handler: (data: any) => void): void {
    this.commandHandler.addHandler(command, handler);
  }

  /**
   * Serializes the Matterbridge device into a serialized object.
   *
   * @param pluginName - The name of the plugin.
   * @returns The serialized Matterbridge device object.
   */
  serialize(): SerializedMatterbridgeDevice | undefined {
    return undefined;
    /*
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
      deviceTypes: Array.from(this.deviceTypes.values()),
      endpoint: this.number,
      endpointName: this.id,
      clusterServersId: [],
    };
    this.getAllClusterServers().forEach((clusterServer) => {
      serialized.clusterServersId.push(clusterServer.id);
    });
    return serialized;
    */
  }

  /**
   * Deserializes the device into a serialized object.
   *
   * @returns The deserialized MatterbridgeDevice.
   */
  static deserialize(serializedDevice: SerializedMatterbridgeDevice): MatterbridgeEndpoint | undefined {
    return undefined;
    /*
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
    */
  }

  /**
   * From here copy paste from MatterbridgeDevice
   */

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
    if (MatterbridgeEndpoint.bridgeMode === 'bridge') {
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
   * Get a default Power Topology Cluster Server. Only needed for an electricalSensor device type.
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
   * @returns {void}
   */
  createDefaultOnOffClusterServer(onOff = false) {
    this.addClusterServer(this.getDefaultOnOffClusterServer(onOff));
  }

  /**
   * Get a default level control cluster server.
   *
   * @param currentLevel - The current level (default: 254).
   * @param minLevel - The minimum level (default: 0).
   * @param maxLevel - The maximum level (default: 254).
   * @param onLevel - The on level (default: null).
   */
  getDefaultLevelControlClusterServer(currentLevel = 254, minLevel = 0, maxLevel = 254, onLevel: number | null = null) {
    return ClusterServer(
      LevelControlCluster.with(LevelControl.Feature.OnOff),
      {
        currentLevel,
        minLevel,
        maxLevel,
        onLevel,
        options: {
          executeIfOff: false,
          coupleColorTempToLevel: false,
        },
      },
      {
        moveToLevel: async (data) => {
          this.log.debug('Matter command: moveToLevel request:', data.request, 'attributes.currentLevel:', data.attributes.currentLevel.getLocal());
          await this.commandHandler.executeHandler('moveToLevel', data);
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
        moveToLevelWithOnOff: async (data) => {
          this.log.debug('Matter command: moveToLevelWithOnOff request:', data.request, 'attributes.currentLevel:', data.attributes.currentLevel.getLocal());
          await this.commandHandler.executeHandler('moveToLevelWithOnOff', data);
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
   * @param minLevel - The minimum level (default: 0).
   * @param maxLevel - The maximum level (default: 254).
   * @param onLevel - The on level (default: null).
   */
  createDefaultLevelControlClusterServer(currentLevel = 254, minLevel = 0, maxLevel = 254, onLevel: number | null = null) {
    this.addClusterServer(this.getDefaultLevelControlClusterServer(currentLevel, minLevel, maxLevel, onLevel));
  }

  /**
   * Get a default color control cluster server.
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
        moveToHue: async (data) => {
          this.log.debug('Matter command: moveToHue request:', data.request, 'attributes.currentHue:', data.attributes.currentHue.getLocal());
          this.commandHandler.executeHandler('moveToHue', data);
        },
        moveHue: async () => {
          this.log.error('Matter command: moveHue not implemented');
        },
        stepHue: async () => {
          this.log.error('Matter command: stepHue not implemented');
        },
        moveToSaturation: async (data) => {
          this.log.debug('Matter command: moveToSaturation request:', data.request, 'attributes.currentSaturation:', data.attributes.currentSaturation.getLocal());
          this.commandHandler.executeHandler('moveToSaturation', data);
        },
        moveSaturation: async () => {
          this.log.error('Matter command: moveSaturation not implemented');
        },
        stepSaturation: async () => {
          this.log.error('Matter command: stepSaturation not implemented');
        },
        moveToHueAndSaturation: async (data) => {
          this.log.debug('Matter command: moveToHueAndSaturation request:', data.request, 'attributes.currentHue:', data.attributes.currentHue.getLocal(), 'attributes.currentSaturation:', data.attributes.currentSaturation.getLocal());
          this.commandHandler.executeHandler('moveToHueAndSaturation', data);
        },
        stopMoveStep: async () => {
          this.log.error('Matter command: stopMoveStep not implemented');
        },
        moveToColorTemperature: async (data) => {
          this.log.debug('Matter command: moveToColorTemperature request:', data.request, 'attributes.colorTemperatureMireds:', data.attributes.colorTemperatureMireds.getLocal());
          this.commandHandler.executeHandler('moveToColorTemperature', data);
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

  private isColorControlConfigured = false;

  /**
   * Configures the color control cluster for a device.
   *
   * @remark This method must be called only after creating the cluster with getDefaultColorControlClusterServer or createDefaultColorControlClusterServer
   * and before starting the matter node.
   *
   * @param {boolean} hueSaturation - A boolean indicating whether the device supports hue and saturation control.
   * @param {boolean} xy - A boolean indicating whether the device supports XY control.
   * @param {boolean} colorTemperature - A boolean indicating whether the device supports color temperature control.
   * @param {ColorControl.ColorMode} colorMode - An optional parameter specifying the color mode of the device.
   * @param {Endpoint} endpoint - An optional parameter specifying the endpoint to configure. If not provided, the device endpoint will be used.
   */
  async configureColorControlCluster(hueSaturation: boolean, xy: boolean, colorTemperature: boolean, colorMode?: ColorControl.ColorMode, endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    if (this.isColorControlConfigured) return;

    if (endpoint.construction.status !== Lifecycle.Status.Active) {
      this.log.debug(`**configureColorControlCluster() delaying for endpoint construction ${endpoint.construction.status}`);
      setTimeout(async () => {
        await endpoint.configureColorControlCluster(hueSaturation, xy, colorTemperature, colorMode, endpoint);
        this.isColorControlConfigured = true;
      }, 500);
      return;
    }
    this.log.debug(`**configureColorControlCluster()`);
    await endpoint.setAttribute(ColorControlCluster.id, 'featureMap', { hueSaturation, enhancedHue: false, colorLoop: false, xy, colorTemperature }, this.log, endpoint);
    await endpoint.setAttribute(ColorControlCluster.id, 'colorCapabilities', { hueSaturation, enhancedHue: false, colorLoop: false, xy, colorTemperature }, this.log, endpoint);
    if (isValidNumber(colorMode, ColorControl.ColorMode.CurrentHueAndCurrentSaturation, ColorControl.ColorMode.ColorTemperatureMireds)) {
      await endpoint.setAttribute(ColorControlCluster.id, 'colorMode', colorMode, this.log, endpoint);
      await endpoint.setAttribute(ColorControlCluster.id, 'enhancedColorMode', colorMode, this.log, endpoint);
    }
    this.isColorControlConfigured = true;
  }

  /**
   * Configures the color control mode for the device.
   *
   * @param {ColorControl.ColorMode} colorMode - The color mode to set.
   * @param {Endpoint} endpoint - The optional endpoint to configure. If not provided, the method will configure the current endpoint.
   */
  async configureColorControlMode(colorMode: ColorControl.ColorMode, endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    if (isValidNumber(colorMode, ColorControl.ColorMode.CurrentHueAndCurrentSaturation, ColorControl.ColorMode.ColorTemperatureMireds)) {
      await endpoint.setAttribute(ColorControlCluster.id, 'colorMode', colorMode, this.log, endpoint);
      await endpoint.setAttribute(ColorControlCluster.id, 'enhancedColorMode', colorMode, this.log, endpoint);
    }
  }

  /**
   * Get a default window covering cluster server.
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   */
  getDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    return ClusterServer(
      WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift),
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
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   */
  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.addClusterServer(this.getDefaultWindowCoveringClusterServer(positionPercent100ths));
  }

  /**
   * Sets the window covering target position as the current position and stops the movement.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  async setWindowCoveringTargetAsCurrentAndStopped(endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    const position = endpoint.getAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', this.log, endpoint); // windowCoveringCluster.getCurrentPositionLiftPercent100thsAttribute();
    if (position !== null) {
      await endpoint.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', position, this.log, endpoint);
      await endpoint.setAttribute(
        WindowCoveringCluster.id,
        'operationalStatus',
        {
          global: WindowCovering.MovementStatus.Stopped,
          lift: WindowCovering.MovementStatus.Stopped,
          tilt: WindowCovering.MovementStatus.Stopped,
        },
        this.log,
        endpoint,
      );
    }
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to ${position} and operationalStatus to Stopped.`);
  }

  /**
   * Sets the current and target status of a window covering.
   * @param {number} current - The current position of the window covering.
   * @param {number} target - The target position of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status of the window covering.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  async setWindowCoveringCurrentTargetStatus(current: number, target: number, status: WindowCovering.MovementStatus, endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    await endpoint.setAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', current, this.log, endpoint);
    await endpoint.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', target, this.log, endpoint);
    await endpoint.setAttribute(
      WindowCoveringCluster.id,
      'operationalStatus',
      {
        global: status,
        lift: status,
        tilt: status,
      },
      this.log,
      endpoint,
    );
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${current}, targetPositionLiftPercent100ths: ${target} and operationalStatus: ${status}.`);
  }

  /**
   * Sets the status of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status to set.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  async setWindowCoveringStatus(status: WindowCovering.MovementStatus, endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    await endpoint.setAttribute(
      WindowCoveringCluster.id,
      'operationalStatus',
      {
        global: status,
        lift: status,
        tilt: status,
      },
      this.log,
      endpoint,
    );
    this.log.debug(`Set WindowCovering operationalStatus: ${status}`);
  }

  /**
   * Retrieves the status of the window covering.
   * @param {Endpoint} endpoint - The endpoint on which to get the window covering (default the device endpoint).
   *
   * @returns The global operational status of the window covering.
   */
  getWindowCoveringStatus(endpoint?: MatterbridgeEndpoint): WindowCovering.MovementStatus | undefined {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    const status = endpoint.getAttribute(WindowCoveringCluster.id, 'operationalStatus', this.log, endpoint);
    this.log.debug(`Get WindowCovering operationalStatus: ${status.global}`);
    return status.global;
  }

  /**
   * Sets the target and current position of the window covering.
   *
   * @param position - The position to set, specified as a number.
   * @param {Endpoint} endpoint - The endpoint on which to set the window covering (default the device endpoint).
   */
  async setWindowCoveringTargetAndCurrentPosition(position: number, endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
    await endpoint.setAttribute(WindowCoveringCluster.id, 'currentPositionLiftPercent100ths', position, this.log, endpoint);
    await endpoint.setAttribute(WindowCoveringCluster.id, 'targetPositionLiftPercent100ths', position, this.log, endpoint);
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
  async triggerSwitchEvent(event: 'Single' | 'Double' | 'Long' | 'Press' | 'Release', log?: AnsiLogger, endpoint?: MatterbridgeEndpoint): Promise<boolean> {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;

    if (['Single', 'Double', 'Long'].includes(event)) {
      const cluster = endpoint.getClusterServer(SwitchCluster.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress));
      if (!cluster || !cluster.getFeatureMapAttribute().momentarySwitch) {
        log?.error(`triggerSwitchEvent ${event} error: Switch cluster with MomentarySwitch not found on endpoint ${endpoint.id}:${endpoint.number}`);
        return false;
      }
      if (endpoint.number === undefined) {
        log?.error(`triggerSwitchEvent ${event} error: Endpoint number not assigned on endpoint ${endpoint.id}:${endpoint.number}`);
        return false;
      }
      if (event === 'Single') {
        await endpoint.setAttribute(cluster.id, 'currentPosition', 1, log);
        endpoint.triggerEvent(cluster.id, 'initialPress', { newPosition: 1 }, log);
        await endpoint.setAttribute(cluster.id, 'currentPosition', 0, log);
        endpoint.triggerEvent(cluster.id, 'shortRelease', { previousPosition: 1 }, log);
        await endpoint.setAttribute(cluster.id, 'currentPosition', 0, log);
        endpoint.triggerEvent(cluster.id, 'multiPressComplete', { previousPosition: 1, totalNumberOfPressesCounted: 1 }, log);
        log?.info(`${db}Trigger endpoint ${or}${endpoint.id}:${endpoint.number}${db} event ${hk}${cluster.name}.SinglePress${db}`);
      }
      if (event === 'Double') {
        await endpoint.setAttribute(cluster.id, 'currentPosition', 1, log);
        endpoint.triggerEvent(cluster.id, 'initialPress', { newPosition: 1 }, log);
        await endpoint.setAttribute(cluster.id, 'currentPosition', 0, log);
        endpoint.triggerEvent(cluster.id, 'shortRelease', { previousPosition: 1 }, log);
        await endpoint.setAttribute(cluster.id, 'currentPosition', 1, log);
        endpoint.triggerEvent(cluster.id, 'initialPress', { newPosition: 1 }, log);
        endpoint.triggerEvent(cluster.id, 'multiPressOngoing', { newPosition: 1, currentNumberOfPressesCounted: 2 }, log);
        await endpoint.setAttribute(cluster.id, 'currentPosition', 0, log);
        endpoint.triggerEvent(cluster.id, 'shortRelease', { previousPosition: 1 }, log);
        endpoint.triggerEvent(cluster.id, 'multiPressComplete', { previousPosition: 1, totalNumberOfPressesCounted: 2 }, log);
        log?.info(`${db}Trigger endpoint ${or}${endpoint.id}:${endpoint.number}${db} event ${hk}${cluster.name}.DoublePress${db}`);
      }
      if (event === 'Long') {
        await endpoint.setAttribute(cluster.id, 'currentPosition', 1, log);
        endpoint.triggerEvent(cluster.id, 'initialPress', { newPosition: 1 }, log);
        endpoint.triggerEvent(cluster.id, 'longPress', { newPosition: 1 }, log);
        await endpoint.setAttribute(cluster.id, 'currentPosition', 0, log);
        endpoint.triggerEvent(cluster.id, 'longRelease', { previousPosition: 1 }, log);
        log?.info(`${db}Trigger endpoint ${or}${endpoint.id}:${endpoint.number}${db} event ${hk}${cluster.name}.LongPress${db}`);
      }
    }
    if (['Press', 'Release'].includes(event)) {
      const cluster = endpoint.getClusterServer(SwitchCluster.with(Switch.Feature.LatchingSwitch));
      if (!cluster || !cluster.getFeatureMapAttribute().latchingSwitch) {
        log?.error(`triggerSwitchEvent ${event} error: Switch cluster with LatchingSwitch not found on endpoint ${endpoint.id}:${endpoint.number}`);
        return false;
      }
      if (endpoint.number === undefined) {
        log?.error(`triggerSwitchEvent ${event} error: Endpoint number not assigned on endpoint ${endpoint.id}:${endpoint.number}`);
        return false;
      }
      if (event === 'Press') {
        await endpoint.setAttribute(cluster.id, 'currentPosition', 1, log);
        endpoint.triggerEvent(cluster.id, 'switchLatched', { newPosition: 1 }, log);
        log?.info(`${db}Trigger endpoint ${or}${endpoint.id}:${endpoint.number}${db} event ${hk}${cluster.name}.Press${db}`);
      }
      if (event === 'Release') {
        await endpoint.setAttribute(cluster.id, 'currentPosition', 0, log);
        endpoint.triggerEvent(cluster.id, 'switchLatched', { newPosition: 0 }, log);
        log?.info(`${db}Trigger endpoint ${or}${endpoint.id}:${endpoint.number}${db} event ${hk}${cluster.name}.Release${db}`);
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
   * @param description - The description of the cluster server.
   * @param supportedModes - The supported modes for the cluster server.
   * @param currentMode - The current mode of the cluster server. Defaults to 0.
   * @param startUpMode - The startup mode of the cluster server. Defaults to 0.
   * @param endpoint - The endpoint to add the cluster server to. Defaults to `this` if not provided.
   *
   */
  createDefaultModeSelectClusterServer(description: string, supportedModes: ModeSelect.ModeOption[], currentMode = 0, startUpMode = 0, endpoint?: MatterbridgeEndpoint) {
    if (!endpoint) endpoint = this as MatterbridgeEndpoint;
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
   * @param measuredValue - The measured value of the flow in 10 x m/h.
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
        enableDisableAlarm: async (data) => {
          this.log.debug('Matter command: enableDisableAlarm', data.request);
          await this.commandHandler.executeHandler('enableDisableAlarm', data);
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
        setpointRaiseLower: async (data) => {
          this.log.debug('Matter command: setpointRaiseLower', data.request);
          await this.commandHandler.executeHandler('setpointRaiseLower', data);
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
        setpointRaiseLower: async (data) => {
          this.log.debug('Matter command: setpointRaiseLower', data.request);
          await this.commandHandler.executeHandler('setpointRaiseLower', data);
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
        setpointRaiseLower: async (data) => {
          this.log.debug('Matter command: setpointRaiseLower', data.request);
          await this.commandHandler.executeHandler('setpointRaiseLower', data);
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
        selfTestRequest: async (data) => {
          this.log.debug('Matter command: selfTestRequest');
          await this.commandHandler.executeHandler('selfTestRequest', data);
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

  /*
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
        pauseRequest: async (data) => {
          this.log.debug('Matter command: pauseRequest', data.request);
          await this.commandHandler.executeHandler('pauseRequest', data);
        },
        resumeRequest: async (data) => {
          this.log.debug('Matter command: resumeRequest');
          await this.commandHandler.executeHandler('resumeRequest', data);
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
        changeToMode: async (data) => {
          this.log.debug('Matter command: DeviceEnergyManagementMode.changeToMode', data.request);
          await this.commandHandler.executeHandler('changeToMode', data);
        },
      },
      {},
    );
  }
  */
}
