/**
 * This file contains the class MatterbridgeEndpoint that extends the Endpoint class from the Matter.js library.
 *
 * @file matterbridgeEndpoint.ts
 * @author Luca Liguori
 * @created 2024-10-01
 * @version 2.1.1
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

// @matter
import { ActionContext, AtLeastOne, Behavior, ClusterId, Endpoint, EndpointNumber, EndpointType, HandlerFunction, Lifecycle, MutableEndpoint, NamedHandler, ServerNode, SupportedBehaviors, UINT16_MAX, UINT32_MAX, VendorId } from '@matter/main';
import { DeviceClassification } from '@matter/main/model';
import { ClusterType, getClusterNameById, MeasurementType, Semtag } from '@matter/main/types';
// @matter clusters
import { Descriptor } from '@matter/main/clusters/descriptor';
import { PowerSource } from '@matter/main/clusters/power-source';
import { BridgedDeviceBasicInformation } from '@matter/main/clusters/bridged-device-basic-information';
import { Identify } from '@matter/main/clusters/identify';
import { OnOff } from '@matter/main/clusters/on-off';
import { LevelControl } from '@matter/main/clusters/level-control';
import { ColorControl } from '@matter/main/clusters/color-control';
import { WindowCovering } from '@matter/main/clusters/window-covering';
import { Thermostat } from '@matter/main/clusters/thermostat';
import { FanControl } from '@matter/main/clusters/fan-control';
import { DoorLock } from '@matter/main/clusters/door-lock';
import { ModeSelect } from '@matter/main/clusters/mode-select';
import { ValveConfigurationAndControl } from '@matter/main/clusters/valve-configuration-and-control';
import { PumpConfigurationAndControl } from '@matter/main/clusters/pump-configuration-and-control';
import { SmokeCoAlarm } from '@matter/main/clusters/smoke-co-alarm';
import { Switch } from '@matter/main/clusters/switch';
import { BooleanStateConfiguration } from '@matter/main/clusters/boolean-state-configuration';
import { PowerTopology } from '@matter/main/clusters/power-topology';
import { ElectricalPowerMeasurement } from '@matter/main/clusters/electrical-power-measurement';
import { ElectricalEnergyMeasurement } from '@matter/main/clusters/electrical-energy-measurement';
import { AirQuality } from '@matter/main/clusters/air-quality';
import { ConcentrationMeasurement } from '@matter/main/clusters/concentration-measurement';
import { OccupancySensing } from '@matter/main/clusters/occupancy-sensing';
import { ThermostatUserInterfaceConfiguration } from '@matter/main/clusters/thermostat-user-interface-configuration';
import { OperationalState } from '@matter/main/clusters/operational-state';
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/main/clusters/device-energy-management-mode';
// @matter behaviors
import { DescriptorServer } from '@matter/main/behaviors/descriptor';
import { PowerSourceServer } from '@matter/main/behaviors/power-source';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors/bridged-device-basic-information';
import { GroupsServer } from '@matter/main/behaviors/groups';
import { ScenesManagementServer } from '@matter/main/behaviors/scenes-management';
import { PumpConfigurationAndControlServer } from '@matter/main/behaviors/pump-configuration-and-control';
import { SwitchServer } from '@matter/main/behaviors/switch';
import { BooleanStateServer } from '@matter/main/behaviors/boolean-state';
import { PowerTopologyServer } from '@matter/main/behaviors/power-topology';
import { ElectricalPowerMeasurementServer } from '@matter/main/behaviors/electrical-power-measurement';
import { ElectricalEnergyMeasurementServer } from '@matter/main/behaviors/electrical-energy-measurement';
import { TemperatureMeasurementServer } from '@matter/main/behaviors/temperature-measurement';
import { RelativeHumidityMeasurementServer } from '@matter/main/behaviors/relative-humidity-measurement';
import { PressureMeasurementServer } from '@matter/main/behaviors/pressure-measurement';
import { FlowMeasurementServer } from '@matter/main/behaviors/flow-measurement';
import { IlluminanceMeasurementServer } from '@matter/main/behaviors/illuminance-measurement';
import { OccupancySensingServer } from '@matter/main/behaviors/occupancy-sensing';
import { AirQualityServer } from '@matter/main/behaviors/air-quality';
import { CarbonMonoxideConcentrationMeasurementServer } from '@matter/main/behaviors/carbon-monoxide-concentration-measurement';
import { CarbonDioxideConcentrationMeasurementServer } from '@matter/main/behaviors/carbon-dioxide-concentration-measurement';
import { NitrogenDioxideConcentrationMeasurementServer } from '@matter/main/behaviors/nitrogen-dioxide-concentration-measurement';
import { OzoneConcentrationMeasurementServer } from '@matter/main/behaviors/ozone-concentration-measurement';
import { FormaldehydeConcentrationMeasurementServer } from '@matter/main/behaviors/formaldehyde-concentration-measurement';
import { Pm1ConcentrationMeasurementServer } from '@matter/main/behaviors/pm1-concentration-measurement';
import { Pm25ConcentrationMeasurementServer } from '@matter/main/behaviors/pm25-concentration-measurement';
import { Pm10ConcentrationMeasurementServer } from '@matter/main/behaviors/pm10-concentration-measurement';
import { RadonConcentrationMeasurementServer } from '@matter/main/behaviors/radon-concentration-measurement';
import { TotalVolatileOrganicCompoundsConcentrationMeasurementServer } from '@matter/main/behaviors/total-volatile-organic-compounds-concentration-measurement';
import { FanControlServer } from '@matter/main/behaviors/fan-control';
import { ResourceMonitoring } from '@matter/main/clusters/resource-monitoring';
import { ThermostatUserInterfaceConfigurationServer } from '@matter/main/behaviors/thermostat-user-interface-configuration';

// AnsiLogger module
import { AnsiLogger, CYAN, LogLevel, TimestampFormat, YELLOW, db, debugStringify, hk, or, zb } from './logger/export.js';
// Matterbridge
import { DeviceTypeDefinition, MatterbridgeEndpointOptions } from './matterbridgeDeviceTypes.js';
import { isValidNumber, isValidObject, isValidString } from './utils/export.js';
import {
  MatterbridgeServer,
  MatterbridgeIdentifyServer,
  MatterbridgeOnOffServer,
  MatterbridgeLevelControlServer,
  MatterbridgeColorControlServer,
  MatterbridgeLiftWindowCoveringServer,
  MatterbridgeLiftTiltWindowCoveringServer,
  MatterbridgeThermostatServer,
  MatterbridgeFanControlServer,
  MatterbridgeDoorLockServer,
  MatterbridgeModeSelectServer,
  MatterbridgeValveConfigurationAndControlServer,
  MatterbridgeSmokeCoAlarmServer,
  MatterbridgeBooleanStateConfigurationServer,
  MatterbridgeSwitchServer,
  MatterbridgeOperationalStateServer,
  MatterbridgeDeviceEnergyManagementModeServer,
  MatterbridgeDeviceEnergyManagementServer,
  MatterbridgeActivatedCarbonFilterMonitoringServer,
  MatterbridgeHepaFilterMonitoringServer,
  MatterbridgeEnhancedColorControlServer,
} from './matterbridgeBehaviors.js';
import {
  addClusterServers,
  addFixedLabel,
  addOptionalClusterServers,
  addRequiredClusterServers,
  addUserLabel,
  createUniqueId,
  getBehavior,
  getBehaviourTypesFromClusterClientIds,
  getBehaviourTypesFromClusterServerIds,
  getDefaultOperationalStateClusterServer,
  getDefaultFlowMeasurementClusterServer,
  getDefaultIlluminanceMeasurementClusterServer,
  getDefaultPressureMeasurementClusterServer,
  getDefaultRelativeHumidityMeasurementClusterServer,
  getDefaultTemperatureMeasurementClusterServer,
  getDefaultOccupancySensingClusterServer,
  lowercaseFirstLetter,
  updateAttribute,
  getClusterId,
  getAttributeId,
  setAttribute,
  getAttribute,
  checkNotLatinCharacters,
  generateUniqueId,
  subscribeAttribute,
  invokeBehaviorCommand,
  triggerEvent,
  featuresFor,
} from './matterbridgeEndpointHelpers.js';

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

  // Door Lock
  lockDoor: HandlerFunction;
  unlockDoor: HandlerFunction;

  // Thermostat
  setpointRaiseLower: HandlerFunction;

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

  // Device Energy Management
  powerAdjustRequest: HandlerFunction;
  cancelPowerAdjustRequest: HandlerFunction;

  // Temperature Control
  setTemperature: HandlerFunction;

  // Microwave Oven Control
  setCookingParameters: HandlerFunction;
  addMoreTime: HandlerFunction;

  // Resource Monitoring
  resetCondition: HandlerFunction;
}

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
  endpoint: EndpointNumber | undefined;
  endpointName: string;
  clusterServersId: ClusterId[];
}

export enum PresetType {
  None = 0,
  // ... autres valeurs ...
}

const supportedPresets = [PresetType.Comfort, PresetType.Eco, PresetType.Away, PresetType.Sleep];

// Mapping des presets vers leurs handles
/* const presetHandles = {
  [PresetType.Comfort]: 1,
  [PresetType.Eco]: 2,
  [PresetType.Away]: 3,
  [PresetType.Sleep]: 4,
}; */

export class MatterbridgeEndpoint extends Endpoint {
  /** The default log level of the new MatterbridgeEndpoints */
  static logLevel = LogLevel.INFO;

  /**
   * Activates a special mode for this endpoint.
   * - 'server': it creates the device server node and add the device as Matter device that needs to be paired individually.
   *   In this case the bridge mode is not relevant. The device is autonomous. The main use case is a workaround for the Apple Home rvc issue.
   *
   * - 'matter': it adds the device directly to the bridge server node as Matter device. In this case the implementation must respect
   *   the 9.2.3. Disambiguation rule (i.e. use taglist if needed cause the device doesn't have nodeLabel).
   *   Furthermore the device will be a part of the bridge (i.e. will have the same name and will be in the same room).
   *   See 9.12.2.2. Native Matter functionality in Bridge.
   *
   * @remarks
   * Always use createDefaultBasicInformationClusterServer() to create the BasicInformation cluster server.
   */
  mode: 'server' | 'matter' | undefined = undefined;
  /** The server node of the endpoint, if it is a single not bridged endpoint */
  serverNode: ServerNode<ServerNode.RootEndpoint> | undefined;

  /** The logger instance for the MatterbridgeEndpoint */
  log: AnsiLogger;
  /** The plugin name this MatterbridgeEndpoint belongs to */
  plugin: string | undefined = undefined;
  /** The configuration URL of the device, if available */
  configUrl: string | undefined = undefined;
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
  productUrl = 'https://www.npmjs.com/package/matterbridge';

  /** The name of the first device type of the endpoint (old api compatibility) */
  name: string | undefined = undefined;
  /** The code of the first device type of the endpoint (old api compatibility) */
  deviceType: number | undefined = undefined;
  /** The original id (with spaces and .) of the endpoint (old api compatibility) */
  uniqueStorageKey: string | undefined = undefined;
  tagList?: Semtag[] = undefined;

  /** Maps the DeviceTypeDefinitions with their code */
  readonly deviceTypes = new Map<number, DeviceTypeDefinition>();

  /** Command handler for the MatterbridgeEndpoint commands */
  readonly commandHandler = new NamedHandler<MatterbridgeEndpointCommands>();

  /**
   * Represents a MatterbridgeEndpoint.
   *
   * @class MatterbridgeEndpoint
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the endpoint.
   * @param {MatterbridgeEndpointOptions} [options] - The options for the device.
   * @param {boolean} [debug] - Debug flag.
   */
  constructor(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug: boolean = false) {
    let deviceTypeList: { deviceType: number; revision: number }[] = [];

    // Get the first DeviceTypeDefinition
    let firstDefinition: DeviceTypeDefinition;
    if (Array.isArray(definition)) {
      firstDefinition = definition[0];
      deviceTypeList = Array.from(definition.values()).map((dt) => ({
        deviceType: dt.code,
        revision: dt.revision,
      }));
    } else {
      firstDefinition = definition;
      deviceTypeList = [{ deviceType: firstDefinition.code, revision: firstDefinition.revision }];
    }

    // Convert the first DeviceTypeDefinition to an EndpointType.Options
    const deviceTypeDefinitionV8: EndpointType.Options = {
      name: firstDefinition.name.replace('-', '_'),
      deviceType: firstDefinition.code,
      deviceRevision: firstDefinition.revision,
      deviceClass: firstDefinition.deviceClass.toLowerCase() as unknown as DeviceClassification,
      requirements: {
        server: {
          mandatory: SupportedBehaviors(...getBehaviourTypesFromClusterServerIds(firstDefinition.requiredServerClusters)),
          optional: SupportedBehaviors(...getBehaviourTypesFromClusterServerIds(firstDefinition.optionalServerClusters)),
        },
        client: {
          mandatory: SupportedBehaviors(...getBehaviourTypesFromClusterClientIds(firstDefinition.requiredClientClusters)),
          optional: SupportedBehaviors(...getBehaviourTypesFromClusterClientIds(firstDefinition.optionalClientClusters)),
        },
      },
      behaviors: options.tagList ? SupportedBehaviors(DescriptorServer.with(Descriptor.Feature.TagList)) : SupportedBehaviors(DescriptorServer),
    };
    const endpointV8 = MutableEndpoint(deviceTypeDefinitionV8);

    // Check if the uniqueStorageKey is valid
    if (options.uniqueStorageKey && checkNotLatinCharacters(options.uniqueStorageKey)) {
      options.uniqueStorageKey = generateUniqueId(options.uniqueStorageKey);
    }
    if (options.id && checkNotLatinCharacters(options.id)) {
      options.id = generateUniqueId(options.id);
    }

    // Convert the options to an Endpoint.Options
    const optionsV8 = {
      id: options.uniqueStorageKey?.replace(/[ .]/g, ''),
      number: options.endpointId,
      descriptor: options.tagList ? { tagList: options.tagList, deviceTypeList } : { deviceTypeList },
    } as { id?: string; number?: EndpointNumber; descriptor?: Record<string, object> };
    // Override the deprecated uniqueStorageKey && endpointId with id and number if provided
    if (options.id !== undefined) {
      optionsV8.id = options.id.replace(/[ .]/g, '');
    }
    if (options.number !== undefined) {
      optionsV8.number = options.number;
    }
    super(endpointV8, optionsV8);

    this.mode = options.mode;
    this.uniqueStorageKey = options.id ? options.id : options.uniqueStorageKey;
    this.name = firstDefinition.name;
    this.deviceType = firstDefinition.code;
    this.tagList = options.tagList;
    if (Array.isArray(definition)) {
      definition.forEach((deviceType) => {
        this.deviceTypes.set(deviceType.code, deviceType);
      });
    } else this.deviceTypes.set(firstDefinition.code, firstDefinition);

    // console.log('MatterbridgeEndpoint.option', options);
    // console.log('MatterbridgeEndpoint.endpointV8', endpointV8);
    // console.log('MatterbridgeEndpoint.optionsV8', optionsV8);

    // Create the logger
    this.log = new AnsiLogger({ logName: options.uniqueStorageKey ?? 'MatterbridgeEndpoint', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: debug === true ? LogLevel.DEBUG : MatterbridgeEndpoint.logLevel });
    this.log.debug(
      `${YELLOW}new${db} MatterbridgeEndpoint: ${zb}${'0x' + firstDefinition.code.toString(16).padStart(4, '0')}${db}-${zb}${firstDefinition.name}${db} mode: ${CYAN}${this.mode}${db} id: ${CYAN}${optionsV8.id}${db} number: ${CYAN}${optionsV8.number}${db} taglist: ${CYAN}${options.tagList ? debugStringify(options.tagList) : 'undefined'}${db}`,
    );

    // Add MatterbridgeServer
    this.behaviors.require(MatterbridgeServer, { log: this.log, commandHandler: this.commandHandler });
  }

  /**
   * Loads an instance of the MatterbridgeEndpoint class.
   *
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the device.
   * @param {MatterbridgeEndpointOptions} [options] - The options for the device.
   * @param {boolean} [debug] - Debug flag.
   * @returns {Promise<MatterbridgeEndpoint>} MatterbridgeEndpoint instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug: boolean = false): Promise<MatterbridgeEndpoint> {
    return new MatterbridgeEndpoint(definition, options, debug);
  }

  /**
   * Get all the device types of this endpoint.
   *
   * @returns {DeviceTypeDefinition[]} The device types of this endpoint.
   */
  getDeviceTypes(): DeviceTypeDefinition[] {
    return Array.from(this.deviceTypes.values());
  }

  /**
   * Checks if the provided cluster server is supported by this endpoint.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to check.
   * @returns {boolean} True if the cluster server is supported, false otherwise.
   *
   * @example
   *
   * The following examples are all valid ways to check if the 'OnOff' cluster server is supported by the endpoint:
   * ```typescript
   * if(device.hasClusterServer(OnOffBehavior)) ...
   * if(device.hasClusterServer(OnOffServer)) ...
   * if(device.hasClusterServer(OnOffCluster)) ...
   * if(device.hasClusterServer(OnOff.Cluster)) ...
   * if(device.hasClusterServer(OnOff.Cluster.id)) ...
   * if(device.hasClusterServer('OnOff')) ...
   * ```
   * The last has the advantage of being able to check for clusters without imports. Just use the name found in the Matter specs.
   */
  hasClusterServer(cluster: Behavior.Type | ClusterType | ClusterId | string): boolean {
    const behavior = getBehavior(this, cluster);
    if (behavior) return this.behaviors.supported[behavior.id] !== undefined;
    else return false;
  }

  /**
   * Checks if the provided attribute server is supported for a given cluster of this endpoint.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to check.
   * @param {string} attribute - The attribute name to check.
   * @returns {boolean} True if the attribute server is supported, false otherwise.
   *
   * @example
   *
   * The following examples are all valid ways to check if the 'onOff' attribute of the 'OnOff' cluster server is supported by the endpoint:
   * ```typescript
   * if(device.hasAttributeServer(OnOffBehavior, 'onOff')) ...
   * if(device.hasAttributeServer(OnOffServer, 'onOff')) ...
   * if(device.hasAttributeServer(OnOffCluster, 'onOff')) ...
   * if(device.hasAttributeServer(OnOff.Cluster, 'onOff')) ...
   * if(device.hasAttributeServer(OnOff.Cluster.id, 'onOff')) ...
   * if(device.hasAttributeServer('OnOff', 'onOff')) ...
   * ```
   * The last has the advantage of being able to check for clusters attributes without imports. Just use the names found in the Matter specs.
   */
  hasAttributeServer(cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string): boolean {
    const behavior = getBehavior(this, cluster);
    if (!behavior || !this.behaviors.supported[behavior.id]) return false;
    const options = this.behaviors.optionsFor(behavior) as Record<string, boolean | number | bigint | string | object | null>;
    const defaults = this.behaviors.defaultsFor(behavior) as Record<string, boolean | number | bigint | string | object | null>;
    return lowercaseFirstLetter(attribute) in options || lowercaseFirstLetter(attribute) in defaults;
  }

  /**
   * Retrieves the initial options for the provided cluster server.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to get options for.
   * @returns {Record<string, boolean | number | bigint | string | object | null> | undefined} The options for the provided cluster server, or undefined if the cluster is not supported.
   */
  getClusterServerOptions(cluster: Behavior.Type | ClusterType | ClusterId | string): Record<string, boolean | number | bigint | string | object | null> | undefined {
    const behavior = getBehavior(this, cluster);
    if (!behavior) return undefined;
    return this.behaviors.optionsFor(behavior) as Record<string, boolean | number | bigint | string | object | null>;
  }

  /**
   * Retrieves the value of the provided attribute from the given cluster.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to retrieve the attribute from.
   * @param {string} attribute - The name of the attribute to retrieve.
   * @param {AnsiLogger} [log] - Optional logger for error and info messages.
   * @returns {any} The value of the attribute, or undefined if the attribute is not found.
   *
   * @example
   *
   * The following examples are all valid ways to retrieve the 'onOff' attribute of the 'OnOff' cluster server:
   * ```typescript
   * device.getAttribute(OnOffBehavior, 'onOff')
   * device.getAttribute(OnOffServer, 'onOff')
   * device.getAttribute(OnOffCluster, 'onOff')
   * device.getAttribute(OnOff.Cluster, 'onOff')
   * device.getAttribute(OnOff.Cluster.id, 'onOff')
   * device.getAttribute('OnOff', 'onOff')
   * ```
   * The last has the advantage of being able to retrieve cluster attributes without imports. Just use the names found in the Matter specs.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getAttribute(cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, log?: AnsiLogger): any {
    return getAttribute(this, cluster, attribute, log);
  }

  /**
   * Sets the value of an attribute on a cluster server.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} clusterId - The ID of the cluster.
   * @param {string} attribute - The name of the attribute.
   * @param {boolean | number | bigint | string | object | null} value - The value to set for the attribute.
   * @param {AnsiLogger} [log] - (Optional) The logger to use for logging errors and information.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the attribute was successfully set.
   *
   * @example
   *
   * The following examples are all valid ways to set the 'onOff' attribute of the 'OnOff' cluster server:
   * ```typescript
   * await device.setAttribute(OnOffBehavior, 'onOff', true)
   * await device.setAttribute(OnOffServer, 'onOff', true)
   * await device.setAttribute(OnOffCluster, 'onOff', true)
   * await device.setAttribute(OnOff.Cluster, 'onOff', true)
   * await device.setAttribute(OnOff.Cluster.id, 'onOff', true)
   * await device.setAttribute('OnOff', 'onOff', true)
   * ```
   * The last has the advantage of being able to set cluster attributes without imports. Just use the names found in the Matter specs.
   */
  async setAttribute(clusterId: Behavior.Type | ClusterType | ClusterId | string, attribute: string, value: boolean | number | bigint | string | object | null, log?: AnsiLogger): Promise<boolean> {
    return await setAttribute(this, clusterId, attribute, value, log);
  }

  /**
   * Update the value of an attribute on a cluster server only if the value is different.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to set the attribute on.
   * @param {string} attribute - The name of the attribute.
   * @param {boolean | number | bigint | string | object | null} value - The value to set for the attribute.
   * @param {AnsiLogger} [log] - (Optional) The logger to use for logging the update. Errors are logged to the endpoint logger.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the attribute was successfully set.
   *
   * @example
   *
   * The following examples are all valid ways to update the 'onOff' attribute of the 'OnOff' cluster server:
   * ```typescript
   * await device.updateAttribute(OnOffBehavior, 'onOff', true)
   * await device.updateAttribute(OnOffServer, 'onOff', true)
   * await device.updateAttribute(OnOffCluster, 'onOff', true)
   * await device.updateAttribute(OnOff.Cluster, 'onOff', true)
   * await device.updateAttribute(OnOff.Cluster.id, 'onOff', true)
   * await device.updateAttribute('OnOff', 'onOff', true)
   * ```
   * The last has the advantage of being able to update cluster attributes without imports. Just use the names found in the Matter specs.
   */
  async updateAttribute(cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, value: boolean | number | bigint | string | object | null, log?: AnsiLogger): Promise<boolean> {
    return await updateAttribute(this, cluster, attribute, value, log);
  }

  /**
   * Subscribes to the provided attribute on a cluster.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to subscribe the attribute to.
   * @param {string} attribute - The name of the attribute to subscribe to.
   * @param {(newValue: any, oldValue: any, context: ActionContext) => void} listener - A callback function that will be called when the attribute value changes. When context.offline === true then the change is locally generated and not from the controller.
   * @param {AnsiLogger} [log] - Optional logger for logging errors and information.
   * @returns {Promise<boolean>} - A boolean indicating whether the subscription was successful.
   *
   * @remarks
   * The listener function (cannot be async!) will receive three parameters:
   * - `newValue`: The new value of the attribute.
   * - `oldValue`: The old value of the attribute.
   * - `context`: The action context, which includes information about the action that triggered the change. When context.offline === true then the change is locally generated and not from the controller.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async subscribeAttribute(cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, listener: (newValue: any, oldValue: any, context: ActionContext) => void, log?: AnsiLogger): Promise<boolean> {
    return await subscribeAttribute(this, cluster, attribute, listener, log);
  }

  /**
   * Triggers an event on the specified cluster.
   *
   * @param {ClusterId} cluster - The ID of the cluster.
   * @param {string} event - The name of the event to trigger.
   * @param {Record<string, boolean | number | bigint | string | object | undefined | null>} payload - The payload to pass to the event.
   * @param {AnsiLogger} [log] - Optional logger for logging information.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the event was successfully triggered.
   */
  async triggerEvent(cluster: Behavior.Type | ClusterType | ClusterId | string, event: string, payload: Record<string, boolean | number | bigint | string | object | undefined | null>, log?: AnsiLogger): Promise<boolean> {
    return await triggerEvent(this, cluster, event, payload, log);
  }

  /**
   * Adds cluster servers from the provided server list.
   *
   * @param {ClusterId[]} serverList - The list of cluster IDs to add.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  addClusterServers(serverList: ClusterId[]): this {
    addClusterServers(this, serverList);
    return this;
  }

  /**
   * Adds a fixed label to the FixedLabel cluster. If the cluster server is not present, it will be added.
   *
   * @param {string} label - The label to add.
   * @param {string} value - The value of the label.
   * @returns {Promise<this>} The current MatterbridgeEndpoint instance for chaining.
   */
  async addFixedLabel(label: string, value: string): Promise<this> {
    await addFixedLabel(this, label, value);
    return this;
  }

  /**
   * Adds a user label to the UserLabel cluster. If the cluster server is not present, it will be added.
   *
   * @param {string} label - The label to add.
   * @param {string} value - The value of the label.
   * @returns {Promise<this>} The current MatterbridgeEndpoint instance for chaining.
   */
  async addUserLabel(label: string, value: string): Promise<this> {
    await addUserLabel(this, label, value);
    return this;
  }

  /**
   * Adds a command handler for the specified command.
   *
   * @param {keyof MatterbridgeEndpointCommands} command - The command to add the handler for.
   * @param {CommandHandlerFunction} handler - The handler function to execute when the command is received.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The handler function will receive an object with the following properties:
   * - `request`: The request object sent with the command.
   * - `cluster`: The id of the cluster that received the command (i.e. "onOff").
   * - `attributes`: The current attributes of the cluster that received the command (i.e. { onOff: true}).
   * - `endpoint`: The MatterbridgeEndpoint instance that received the command.
   */
  addCommandHandler(command: keyof MatterbridgeEndpointCommands, handler: CommandHandlerFunction): this {
    this.commandHandler.addHandler(command, handler);
    return this;
  }

  /**
   * Execute the command handler for the specified command. Used ONLY in Jest tests.
   *
   * @param {keyof MatterbridgeEndpointCommands} command - The command to execute.
   * @param {Record<string, boolean | number | bigint | string | object | null>} [request] - The optional request to pass to the handler function.
   * @param {string} [cluster] - The optional cluster to pass to the handler function.
   * @param {Record<string, boolean | number | bigint | string | object | null>} [attributes] - The optional attributes to pass to the handler function.
   * @param {MatterbridgeEndpoint} [endpoint] - The optional MatterbridgeEndpoint instance to pass to the handler function
   *
   * @deprecated Used ONLY in Jest tests.
   */
  async executeCommandHandler(
    command: keyof MatterbridgeEndpointCommands,
    request?: Record<string, boolean | number | bigint | string | object | null>,
    cluster?: string,
    attributes?: Record<string, boolean | number | bigint | string | object | null>,
    endpoint?: MatterbridgeEndpoint,
  ): Promise<void> {
    await this.commandHandler.executeHandler(command, { request, cluster, attributes, endpoint });
  }

  /**
   * Invokes a behavior command on the specified cluster. Used ONLY in Jest tests.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to invoke the command on.
   * @param {string} command - The command to invoke.
   * @param {Record<string, boolean | number | bigint | string | object | null>} [params] - The optional parameters to pass to the command.
   *
   * @deprecated Used ONLY in Jest tests.
   */
  async invokeBehaviorCommand(cluster: Behavior.Type | ClusterType | ClusterId | string, command: keyof MatterbridgeEndpointCommands, params?: Record<string, boolean | number | bigint | string | object | null>) {
    await invokeBehaviorCommand(this, cluster, command, params);
  }

  /**
   * Adds the required cluster servers (only if they are not present) for the device types of the specified endpoint.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  addRequiredClusterServers(): MatterbridgeEndpoint {
    addRequiredClusterServers(this);
    return this;
  }

  /**
   * Adds the optional cluster servers (only if they are not present) for the device types of the specified endpoint.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  addOptionalClusterServers(): MatterbridgeEndpoint {
    addOptionalClusterServers(this);
    return this;
  }

  /**
   * Retrieves all cluster servers.
   *
   * @returns {Behavior.Type[]} An array of all cluster servers.
   */
  getAllClusterServers(): Behavior.Type[] {
    return Object.values(this.behaviors.supported);
  }

  /**
   * Retrieves the names of all cluster servers.
   *
   * @returns {string[]} An array of all cluster server names.
   */
  getAllClusterServerNames(): string[] {
    return Object.keys(this.behaviors.supported);
  }

  /**
   * Iterates over each attribute of each cluster server of the device state and calls the provided callback function.
   *
   * @param {Function} callback - The callback function to call with the cluster name, cluster id, attribute name, attribute id and attribute value.
   */
  forEachAttribute(callback: (clusterName: string, clusterId: number, attributeName: string, attributeId: number, attributeValue: boolean | number | bigint | string | object | null | undefined) => void): void {
    if (!this.lifecycle.isReady || this.construction.status !== Lifecycle.Status.Active) return;

    for (const [clusterName, clusterAttributes] of Object.entries(this.state as unknown as Record<string, Record<string, boolean | number | bigint | string | object | undefined | null>>)) {
      // Skip if the key / cluster name is a number, cause they are double indexed.
      if (!isNaN(Number(clusterName))) continue;
      for (const [attributeName, attributeValue] of Object.entries(clusterAttributes)) {
        // Skip if the behavior has no associated cluster (i.e. matterbridge server)
        const clusterId = getClusterId(this, clusterName);
        if (clusterId === undefined) {
          // this.log.debug(`***forEachAttribute: cluster ${clusterName} not found`);
          continue;
        }
        // Skip if the attribute is not present in the ClusterBehavior.Type. Also skip if the attribute it is an internal state.
        const attributeId = getAttributeId(this, clusterName, attributeName);
        if (attributeId === undefined) {
          // this.log.debug(`***forEachAttribute: attribute ${clusterName}.${attributeName} not found`);
          continue;
        }
        callback(clusterName, clusterId, attributeName, attributeId, attributeValue);
      }
    }
  }

  /**
   * Adds a child endpoint with the specified device types and options.
   * If the child endpoint is not already present, it will be created and added.
   * If the child endpoint is already present, the existing child endpoint will be returned.
   *
   * @param {string} endpointName - The name of the new endpoint to add.
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The device types to add.
   * @param {MatterbridgeEndpointOptions} [options] - The options for the endpoint.
   * @param {boolean} [debug] - Whether to enable debug logging.
   * @returns {MatterbridgeEndpoint} - The child endpoint that was found or added.
   *
   * @example
   * ```typescript
   * const endpoint = device.addChildDeviceType('Temperature', [temperatureSensor], { tagList: [{ mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null }] }, true);
   * ```
   */
  addChildDeviceType(endpointName: string, definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug: boolean = false): MatterbridgeEndpoint {
    this.log.debug(`addChildDeviceType: ${CYAN}${endpointName}${db}`);
    let alreadyAdded = false;
    let child = this.getChildEndpointByName(endpointName);
    if (child) {
      this.log.debug(`****- endpoint ${CYAN}${endpointName}${db} already added!`);
      alreadyAdded = true;
    } else {
      if ('tagList' in options) {
        for (const tag of options.tagList as Semtag[]) {
          this.log.debug(`- with tagList: mfgCode ${CYAN}${tag.mfgCode}${db} namespaceId ${CYAN}${tag.namespaceId}${db} tag ${CYAN}${tag.tag}${db} label ${CYAN}${tag.label}${db}`);
        }
        child = new MatterbridgeEndpoint(definition, { uniqueStorageKey: endpointName, endpointId: options.endpointId, tagList: options.tagList }, debug);
      } else {
        child = new MatterbridgeEndpoint(definition, { uniqueStorageKey: endpointName, endpointId: options.endpointId }, debug);
      }
    }

    if (Array.isArray(definition)) {
      definition.forEach((deviceType) => {
        this.log.debug(`- with deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
      });
    } else {
      this.log.debug(`- with deviceType: ${zb}${'0x' + definition.code.toString(16).padStart(4, '0')}${db}-${zb}${definition.name}${db}`);
    }
    if (alreadyAdded) return child;
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
   * Adds a child endpoint with one or more device types with the required cluster servers and the specified cluster servers.
   * If the child endpoint is not already present in the childEndpoints, it will be added.
   * If the child endpoint is already present in the childEndpoints, the device types and cluster servers will be added to the existing child endpoint.
   *
   * @param {string} endpointName - The name of the new enpoint to add.
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The device types to add.
   * @param {ClusterId[]} [serverList] - The list of cluster IDs to include.
   * @param {MatterbridgeEndpointOptions} [options] - The options for the device.
   * @param {boolean} [debug] - Whether to enable debug logging.
   * @returns {MatterbridgeEndpoint} - The child endpoint that was found or added.
   *
   * @example
   * ```typescript
   * const endpoint = device.addChildDeviceTypeWithClusterServer('Temperature', [temperatureSensor], [], { tagList: [{ mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null }] }, true);
   * ```
   */
  addChildDeviceTypeWithClusterServer(endpointName: string, definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, serverList: ClusterId[] = [], options: MatterbridgeEndpointOptions = {}, debug: boolean = false): MatterbridgeEndpoint {
    this.log.debug(`addChildDeviceTypeWithClusterServer: ${CYAN}${endpointName}${db}`);
    let alreadyAdded = false;
    let child = this.getChildEndpointByName(endpointName);
    if (child) {
      this.log.debug(`****- endpoint ${CYAN}${endpointName}${db} already added!`);
      alreadyAdded = true;
    } else {
      if ('tagList' in options) {
        for (const tag of options.tagList as Semtag[]) {
          this.log.debug(`- with tagList: mfgCode ${CYAN}${tag.mfgCode}${db} namespaceId ${CYAN}${tag.namespaceId}${db} tag ${CYAN}${tag.tag}${db} label ${CYAN}${tag.label}${db}`);
        }
        child = new MatterbridgeEndpoint(definition, { uniqueStorageKey: endpointName, endpointId: options.endpointId, tagList: options.tagList }, debug);
      } else {
        child = new MatterbridgeEndpoint(definition, { uniqueStorageKey: endpointName, endpointId: options.endpointId }, debug);
      }
    }
    if (Array.isArray(definition)) {
      definition.forEach((deviceType) => {
        this.log.debug(`- with deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
        deviceType.requiredServerClusters.forEach((clusterId) => {
          if (!serverList.includes(clusterId)) serverList.push(clusterId);
        });
      });
    } else {
      this.log.debug(`- with deviceType: ${zb}${'0x' + definition.code.toString(16).padStart(4, '0')}${db}-${zb}${definition.name}${db}`);
      definition.requiredServerClusters.forEach((clusterId) => {
        if (!serverList.includes(clusterId)) serverList.push(clusterId);
      });
    }
    serverList.forEach((clusterId) => {
      if (!child.hasClusterServer(clusterId)) {
        this.log.debug(`- with cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
      } else {
        serverList.splice(serverList.indexOf(clusterId), 1);
      }
    });
    if (alreadyAdded) {
      serverList.forEach((clusterId) => {
        if (child.hasClusterServer(clusterId)) serverList.splice(serverList.indexOf(clusterId), 1);
      });
    }
    addClusterServers(child, serverList);
    if (alreadyAdded) return child;
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

  /**
   * Retrieves a child endpoint by its EndpointNumber.
   *
   * @param {EndpointNumber} endpointNumber - The EndpointNumber of the endpoint to retrieve.
   * @returns {MatterbridgeEndpoint | undefined} The child endpoint with the specified EndpointNumber, or undefined if not found.
   */
  getChildEndpoint(endpointNumber: EndpointNumber): MatterbridgeEndpoint | undefined {
    return this.parts.find((part) => part.number === endpointNumber) as MatterbridgeEndpoint | undefined;
  }

  /**
   * Get all the child endpoints of this endpoint.
   *
   * @returns {MatterbridgeEndpoint[]} The child endpoints.
   */
  getChildEndpoints(): MatterbridgeEndpoint[] {
    return Array.from(this.parts) as MatterbridgeEndpoint[];
  }

  /**
   * Serializes the Matterbridge device into a serialized object.
   *
   * @param {MatterbridgeEndpoint} device - The Matterbridge device to serialize.
   *
   * @returns {SerializedMatterbridgeEndpoint | undefined} The serialized Matterbridge device object.
   */
  static serialize(device: MatterbridgeEndpoint): SerializedMatterbridgeEndpoint | undefined {
    if (!device.serialNumber || !device.deviceName || !device.uniqueId) return;
    const serialized: SerializedMatterbridgeEndpoint = {
      pluginName: device.plugin ?? '',
      deviceName: device.deviceName,
      serialNumber: device.serialNumber,
      uniqueId: device.uniqueId,
      productId: device.productId,
      productName: device.productName,
      vendorId: device.vendorId,
      vendorName: device.vendorName,
      deviceTypes: Array.from(device.deviceTypes.values()),
      endpoint: device.maybeNumber,
      endpointName: device.maybeId ?? device.deviceName,
      clusterServersId: [],
    };
    Object.keys(device.behaviors.supported).forEach((behaviorName) => {
      if (behaviorName === 'bridgedDeviceBasicInformation') serialized.clusterServersId.push(BridgedDeviceBasicInformation.Cluster.id);
      if (behaviorName === 'powerSource') serialized.clusterServersId.push(PowerSource.Cluster.id);
      // serialized.clusterServersId.push(this.behaviors.supported[behaviorName]cluster.id);
    });
    return serialized;
  }

  /**
   * Deserializes the device into a serialized object.
   *
   * @param {SerializedMatterbridgeEndpoint} serializedDevice - The serialized Matterbridge device object.
   * @returns {MatterbridgeEndpoint | undefined} The deserialized Matterbridge device.
   */
  static deserialize(serializedDevice: SerializedMatterbridgeEndpoint): MatterbridgeEndpoint | undefined {
    const device = new MatterbridgeEndpoint(serializedDevice.deviceTypes as AtLeastOne<DeviceTypeDefinition>, { uniqueStorageKey: serializedDevice.endpointName, endpointId: serializedDevice.endpoint }, false);
    device.plugin = serializedDevice.pluginName;
    device.deviceName = serializedDevice.deviceName;
    device.serialNumber = serializedDevice.serialNumber;
    device.uniqueId = serializedDevice.uniqueId;
    device.vendorId = serializedDevice.vendorId;
    device.vendorName = serializedDevice.vendorName;
    device.productId = serializedDevice.productId;
    device.productName = serializedDevice.productName;
    for (const clusterId of serializedDevice.clusterServersId) {
      if (clusterId === BridgedDeviceBasicInformation.Cluster.id)
        device.createDefaultBridgedDeviceBasicInformationClusterServer(
          serializedDevice.deviceName,
          serializedDevice.serialNumber,
          serializedDevice.vendorId ?? 0xfff1,
          serializedDevice.vendorName ?? 'Matterbridge',
          serializedDevice.productName ?? 'Matterbridge device',
        );
      else if (clusterId === PowerSource.Cluster.id) device.createDefaultPowerSourceWiredClusterServer();
      // else addClusterServerFromList(device, [clusterId]);
    }
    return device;
  }

  /**
   * Creates a default power source wired cluster server.
   *
   * @param {PowerSource.WiredCurrentType} wiredCurrentType - The type of wired current (default: PowerSource.WiredCurrentType.Ac)
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - order: The order of the power source is a persisted attribute that indicates the order in which the power sources are used.
   * - description: The description of the power source is a fixed attribute that describes the power source type.
   * - wiredCurrentType: The type of wired current is a fixed attribute that indicates the type of wired current used by the power source (AC or DC).
   */
  createDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac): this {
    this.behaviors.require(PowerSourceServer.with(PowerSource.Feature.Wired), {
      // Base attributes
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      description: wiredCurrentType === PowerSource.WiredCurrentType.Ac ? 'AC Power' : 'DC Power',
      endpointList: [],
      // Wired feature attributes
      wiredCurrentType,
    });
    return this;
  }

  /**
   * Creates a default power source replaceable battery cluster server.
   *
   * @param {number} batPercentRemaining - The remaining battery percentage (default: 100).
   * @param {PowerSource.BatChargeLevel} batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param {number} batVoltage - The battery voltage (default: 1500).
   * @param {string} batReplacementDescription - The description of the battery replacement (default: 'Battery type').
   * @param {number} batQuantity - The quantity of the battery (default: 1).
   * @param {PowerSource.BatReplaceability} batReplaceability - The replaceability of the battery (default: PowerSource.BatReplaceability.Unspecified).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - order: The order of the power source is a persisted attribute that indicates the order in which the power sources are used.
   * - description: The description of the power source is a fixed attribute that describes the power source type.
   * - batReplaceability: The replaceability of the battery is a fixed attribute that indicates whether the battery is user-replaceable or not.
   * - batReplacementDescription: The description of the battery replacement is a fixed attribute that describes the battery type.
   * - batQuantity: The quantity of the battery is a fixed attribute that indicates how many batteries are present in the device.
   */
  createDefaultPowerSourceReplaceableBatteryClusterServer(
    batPercentRemaining: number = 100,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    batVoltage: number = 1500,
    batReplacementDescription: string = 'Battery type',
    batQuantity: number = 1,
    batReplaceability: PowerSource.BatReplaceability = PowerSource.BatReplaceability.UserReplaceable,
  ): this {
    this.behaviors.require(PowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable), {
      // Base attributes
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      description: 'Primary battery',
      endpointList: [],
      // Battery feature attributes
      batVoltage,
      batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
      batChargeLevel,
      batReplacementNeeded: false,
      batReplaceability,
      activeBatFaults: undefined,
      // Replaceable feature attributes
      batReplacementDescription,
      batQuantity,
    });
    return this;
  }

  /**
   * Creates a default power source rechargeable battery cluster server.
   *
   * @param {number} [batPercentRemaining] - The remaining battery percentage (default: 100).
   * @param {PowerSource.BatChargeLevel} [batChargeLevel] - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param {number} [batVoltage] - The battery voltage in mV (default: 1500).
   * @param {PowerSource.BatReplaceability} [batReplaceability] - The replaceability of the battery (default: PowerSource.BatReplaceability.Unspecified).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - order: The order of the power source is a persisted attribute that indicates the order in which the power sources are used.
   * - description: The description of the power source is a fixed attribute that describes the power source type.
   * - batReplaceability: The replaceability of the battery is a fixed attribute that indicates whether the battery is user-replaceable or not.
   */
  createDefaultPowerSourceRechargeableBatteryClusterServer(
    batPercentRemaining: number = 100,
    batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
    batVoltage: number = 1500,
    batReplaceability: PowerSource.BatReplaceability = PowerSource.BatReplaceability.Unspecified,
  ): this {
    this.behaviors.require(PowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable), {
      // Base attributes
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      description: 'Primary battery',
      endpointList: [],
      // Battery feature attributes
      batVoltage,
      batPercentRemaining: Math.min(Math.max(batPercentRemaining * 2, 0), 200),
      batTimeRemaining: null, // Indicates the estimated time in seconds before the battery will no longer be able to provide power to the Node
      batChargeLevel,
      batReplacementNeeded: false,
      batReplaceability,
      batPresent: true,
      activeBatFaults: [],
      // Rechargeable feature attributes
      batChargeState: PowerSource.BatChargeState.IsNotCharging,
      batFunctionalWhileCharging: true,
    });
    return this;
  }

  /**
   * Setup the default Basic Information Cluster Server attributes for the server node.
   *
   * This method sets the device name, serial number, unique ID, vendor ID, vendor name, product ID, product name, software version, software version string, hardware version and hardware version string.
   *
   * The actual BasicInformationClusterServer is created by the Matterbridge class for device.mode = 'server' and for the device of an AccessoryPlatform.
   *
   * @param {string} deviceName - The name of the device.
   * @param {string} serialNumber - The serial number of the device.
   * @param {number} [vendorId] - The vendor ID of the device.  Default is 0xfff1 (Matter Test VendorId).
   * @param {string} [vendorName] - The name of the vendor. Default is 'Matterbridge'.
   * @param {number} [productId] - The product ID of the device.  Default is 0x8000 (Matter Test ProductId).
   * @param {string} [productName] - The name of the product. Default is 'Matterbridge device'.
   * @param {number} [softwareVersion] - The software version of the device. Default is 1.
   * @param {string} [softwareVersionString] - The software version string of the device. Default is '1.0.0'.
   * @param {number} [hardwareVersion] - The hardware version of the device. Default is 1.
   * @param {string} [hardwareVersionString] - The hardware version string of the device. Default is '1.0.0'.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number = 0xfff1,
    vendorName: string = 'Matterbridge',
    productId: number = 0x8000,
    productName: string = 'Matterbridge device',
    softwareVersion: number = 1,
    softwareVersionString: string = '1.0.0',
    hardwareVersion: number = 1,
    hardwareVersionString: string = '1.0.0',
  ): this {
    this.log.logName = deviceName;
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.productId = productId;
    this.productName = productName;
    this.vendorId = vendorId;
    this.vendorName = vendorName;
    this.softwareVersion = softwareVersion;
    this.softwareVersionString = softwareVersionString;
    this.hardwareVersion = hardwareVersion;
    this.hardwareVersionString = hardwareVersionString;
    return this;
  }

  /**
   * Creates a default BridgedDeviceBasicInformationClusterServer for the aggregator endpoints.
   *
   * This method sets the device name, serial number, unique ID, vendor ID, vendor name, product name, software version, software version string, hardware version and hardware version string.
   *
   * @param {string} deviceName - The name of the device.
   * @param {string} serialNumber - The serial number of the device.
   * @param {number} [vendorId] - The vendor ID of the device. Default is 0xfff1 (Matter Test VendorId).
   * @param {string} [vendorName] - The name of the vendor. Default is 'Matterbridge'.
   * @param {string} [productName] - The name of the product. Default is 'Matterbridge device'.
   * @param {number} [softwareVersion] - The software version of the device. Default is 1.
   * @param {string} [softwareVersionString] - The software version string of the device. Default is '1.0.0'.
   * @param {number} [hardwareVersion] - The hardware version of the device. Default is 1.
   * @param {string} [hardwareVersionString] - The hardware version string of the device. Default is '1.0.0'.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - The productId doesn't exist on the BridgedDeviceBasicInformation cluster.
   * - The bridgedNode device type must be added to the deviceTypeList of the Descriptor cluster.
   */
  createDefaultBridgedDeviceBasicInformationClusterServer(
    deviceName: string,
    serialNumber: string,
    vendorId: number = 0xfff1,
    vendorName: string = 'Matterbridge',
    productName: string = 'Matterbridge device',
    softwareVersion: number = 1,
    softwareVersionString: string = '1.0.0',
    hardwareVersion: number = 1,
    hardwareVersionString: string = '1.0.0',
  ): this {
    this.log.logName = deviceName;
    this.deviceName = deviceName;
    this.serialNumber = serialNumber;
    this.uniqueId = createUniqueId(deviceName, serialNumber, vendorName, productName);
    this.productId = undefined;
    this.productName = productName;
    this.vendorId = vendorId;
    this.vendorName = vendorName;
    this.softwareVersion = softwareVersion;
    this.softwareVersionString = softwareVersionString;
    this.hardwareVersion = hardwareVersion;
    this.hardwareVersionString = hardwareVersionString;
    this.behaviors.require(
      BridgedDeviceBasicInformationServer.enable({
        events: { leave: true, reachableChanged: true },
      }),
      {
        vendorId: VendorId(vendorId),
        vendorName: vendorName.slice(0, 32),
        productName: productName.slice(0, 32),
        productUrl: this.productUrl.slice(0, 256),
        productLabel: deviceName.slice(0, 64),
        nodeLabel: deviceName.slice(0, 32),
        serialNumber: serialNumber.slice(0, 32),
        uniqueId: this.uniqueId.slice(0, 32),
        softwareVersion: isValidNumber(softwareVersion, 0, UINT32_MAX) ? softwareVersion : undefined,
        softwareVersionString: isValidString(softwareVersionString) ? softwareVersionString.slice(0, 64) : undefined,
        hardwareVersion: isValidNumber(hardwareVersion, 0, UINT16_MAX) ? hardwareVersion : undefined,
        hardwareVersionString: isValidString(hardwareVersionString) ? hardwareVersionString.slice(0, 64) : undefined,
        reachable: true,
      },
    );
    return this;
  }

  /**
   * Creates a default identify cluster server with the specified identify time and type.
   *
   * @param {number} [identifyTime] - The time to identify the server. Defaults to 0.
   * @param {Identify.IdentifyType} [identifyType] - The type of identification. Defaults to Identify.IdentifyType.None.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultIdentifyClusterServer(identifyTime: number = 0, identifyType: Identify.IdentifyType = Identify.IdentifyType.None): this {
    this.behaviors.require(MatterbridgeIdentifyServer, {
      identifyTime,
      identifyType,
    });
    return this;
  }

  /**
   * Creates a default groups cluster server.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultGroupsClusterServer(): this {
    this.behaviors.require(GroupsServer);
    return this;
  }

  /**
   * Creates a default scenes management cluster server.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks The scenes management cluster server is still provisional and so not yet implemented.
   */
  createDefaultScenesClusterServer(): this {
    this.behaviors.require(ScenesManagementServer);
    return this;
  }

  /**
   * Creates a default OnOff cluster server for light devices with feature Lighting.
   *
   * @param {boolean} [onOff] - The initial state of the OnOff cluster.
   * @param {boolean} [globalSceneControl] - The global scene control state.
   * @param {number} [onTime] - The on time value.
   * @param {number} [offWaitTime] - The off wait time value.
   * @param {OnOff.StartUpOnOff | null} [startUpOnOff] - The start-up OnOff state. Null means previous state.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultOnOffClusterServer(onOff: boolean = false, globalSceneControl: boolean = false, onTime: number = 0, offWaitTime: number = 0, startUpOnOff: OnOff.StartUpOnOff | null = null): this {
    this.behaviors.require(MatterbridgeOnOffServer.with(OnOff.Feature.Lighting), {
      onOff,
      globalSceneControl,
      onTime,
      offWaitTime,
      startUpOnOff,
    });
    return this;
  }

  /**
   * Creates an OnOff cluster server without features.
   *
   * @param {boolean} [onOff] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createOnOffClusterServer(onOff: boolean = false): this {
    this.behaviors.require(MatterbridgeOnOffServer, {
      onOff,
    });
    return this;
  }

  /**
   * Creates a DeadFront OnOff cluster server with feature DeadFrontBehavior.
   *
   * The "dead front" state is linked to the OnOff attribute
   * in the On/Off cluster having the value False. Thus, the Off command of the On/Off cluster SHALL
   * move the device into the "dead front" state, the On command of the On/Off cluster SHALL bring the
   * device out of the "dead front" state, and the device SHALL adhere with the associated requirements
   * on subscription handling and event reporting.
   *
   * @param {boolean} [onOff] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDeadFrontOnOffClusterServer(onOff: boolean = false): this {
    this.behaviors.require(MatterbridgeOnOffServer.with(OnOff.Feature.DeadFrontBehavior), {
      onOff,
    });
    return this;
  }

  /**
   * Creates an OffOnly OnOff cluster server with feature OffOnly.
   *
   * @param {boolean} [onOff] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createOffOnlyOnOffClusterServer(onOff: boolean = false): this {
    this.behaviors.require(MatterbridgeOnOffServer.with(OnOff.Feature.OffOnly), {
      onOff,
    });
    return this;
  }

  /**
   * Creates a default level control cluster server for light devices with feature OnOff and Lighting.
   *
   * @param {number} [currentLevel] - The current level (default: 254).
   * @param {number} [minLevel] - The minimum level (default: 1).
   * @param {number} [maxLevel] - The maximum level (default: 254).
   * @param {number | null} [onLevel] - The on level (default: null).
   * @param {number | null} [startUpCurrentLevel] - The startUp on level (default: null).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks OptionMasks and OptionOverride fields of moveToLevel and moveToLevelWithOnOff commands requests
   *
   * Each bit in the Options attribute SHALL determine the corresponding bit in the temporary Options
   * bitmap, unless the OptionsMask field is present and has the corresponding bit set to 1, in which
   * case the corresponding bit in the OptionsOverride field SHALL determine the corresponding bit in
   * the temporary Options bitmap.
   *
   * @remarks 'With On/Off' Commands
   *
   * Before commencing any command that has the effect of setting the CurrentLevel attribute above
   * the minimum level allowed by the device, the OnOff attribute of the On/Off cluster on the same endpoint, if implemented, SHALL be set to TRUE (‘On’).
   *
   * If any command that has the effect of setting the CurrentLevel attribute to the minimum level
   * allowed by the device, the OnOff attribute of the On/Off cluster on the same endpoint, if implemented, SHALL be set to FALSE (‘Off’).
   */
  createDefaultLevelControlClusterServer(currentLevel: number = 254, minLevel: number = 1, maxLevel: number = 254, onLevel: number | null = null, startUpCurrentLevel: number | null = null): this {
    this.behaviors.require(MatterbridgeLevelControlServer.with(LevelControl.Feature.OnOff, LevelControl.Feature.Lighting), {
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
    });
    return this;
  }

  /**
   * Creates a level control cluster server without features.
   *
   * @param {number} [currentLevel] - The current level (default: 254).
   * @param {number | null} [onLevel] - The on level (default: null).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createLevelControlClusterServer(currentLevel: number = 254, onLevel: number | null = null): this {
    this.behaviors.require(MatterbridgeLevelControlServer, {
      currentLevel,
      onLevel,
      options: {
        executeIfOff: false,
        coupleColorTempToLevel: false,
      },
    });
    return this;
  }

  /**
   * Creates a default color control cluster server with features Xy, HueSaturation and ColorTemperature.
   *
   * @param {number} currentX - The current X value (range 0-65279).
   * @param {number} currentY - The current Y value (range 0-65279).
   * @param {number} currentHue - The current hue value (range: 0-254).
   * @param {number} currentSaturation - The current saturation value (range: 0-254).
   * @param {number} colorTemperatureMireds - The color temperature in mireds (range colorTempPhysicalMinMireds-colorTempPhysicalMaxMireds).
   * @param {number} colorTempPhysicalMinMireds - The physical minimum color temperature in mireds (default 147).
   * @param {number} colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds (default 500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   * @remarks currentHue and currentSaturation persist across restarts.
   * @remarks currentX and currentY persist across restarts.
   * @remarks colorTemperatureMireds persists across restarts.
   * @remarks startUpColorTemperatureMireds persists across restarts.
   * @remarks coupleColorTempToLevelMinMireds persists across restarts.
   *
   * @remarks OptionMasks and OptionOverride fields of color control commands requests
   *
   * Each bit in the Options attribute SHALL determine the corresponding bit in the temporary Options
   * bitmap, unless the OptionsMask field is present and has the corresponding bit set to 1, in which
   * case the corresponding bit in the OptionsOverride field SHALL determine the corresponding bit in
   * the temporary Options bitmap.
   *
   * @remarks CoupleColorTempToLevel
   *
   * If the CoupleColorTempToLevel bit of the Options attribute of the Level Control cluster is equal to 1
   * and the ColorMode or EnhancedColorMode attribute is set to 2 (ColorTemperatureMireds) then a
   * change in the CurrentLevel attribute SHALL affect the ColorTemperatureMireds attribute.
   * This relationship is manufacturer specific, with the qualification that the maximum value of the CurrentLevel attribute
   * SHALL correspond to a ColorTemperatureMired attribute value equal to the CoupleColorTempToLevelMinMireds attribute.
   */
  createDefaultColorControlClusterServer(
    currentX: number = 0,
    currentY: number = 0,
    currentHue: number = 0,
    currentSaturation: number = 0,
    colorTemperatureMireds: number = 500,
    colorTempPhysicalMinMireds: number = 147,
    colorTempPhysicalMaxMireds: number = 500,
  ): this {
    this.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.Xy, ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature), {
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
      remainingTime: 0,
    });
    return this;
  }

  /**
   * Creates a default color control cluster server with features Xy, HueSaturation, EnhancedHueSaturation and ColorTemperature.
   *
   * @param {number} currentX - The current X value (range 0-65279).
   * @param {number} currentY - The current Y value (range 0-65279).
   * @param {number} enhancedCurrentHue - The enhanced current hue value (range: 0-65535).
   * @param {number} currentSaturation - The current saturation value (range: 0-254).
   * @param {number} colorTemperatureMireds - The color temperature in mireds (range colorTempPhysicalMinMireds-colorTempPhysicalMaxMireds).
   * @param {number} colorTempPhysicalMinMireds - The physical minimum color temperature in mireds (default 147).
   * @param {number} colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds (default 500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   * @remarks currentHue and currentSaturation persist across restarts.
   * @remarks currentX and currentY persist across restarts.
   * @remarks colorTemperatureMireds persists across restarts.
   * @remarks startUpColorTemperatureMireds persists across restarts.
   * @remarks coupleColorTempToLevelMinMireds persists across restarts.
   *
   * @remarks OptionMasks and OptionOverride field
   *
   * Each bit in the Options attribute SHALL determine the corresponding bit in the temporary Options
   * bitmap, unless the OptionsMask field is present and has the corresponding bit set to 1, in which
   * case the corresponding bit in the OptionsOverride field SHALL determine the corresponding bit in
   * the temporary Options bitmap.
   *
   * @remarks CoupleColorTempToLevel
   *
   * If the CoupleColorTempToLevel bit of the Options attribute of the Level Control cluster is equal to 1
   * and the ColorMode or EnhancedColorMode attribute is set to 2 (ColorTemperatureMireds) then a
   * change in the CurrentLevel attribute SHALL affect the ColorTemperatureMireds attribute.
   * This relationship is manufacturer specific, with the qualification that the maximum value of the CurrentLevel attribute
   * SHALL correspond to a ColorTemperatureMired attribute value equal to the CoupleColorTempToLevelMinMireds attribute.
   */
  createEnhancedColorControlClusterServer(
    currentX: number = 0,
    currentY: number = 0,
    enhancedCurrentHue: number = 0,
    currentSaturation: number = 0,
    colorTemperatureMireds: number = 500,
    colorTempPhysicalMinMireds: number = 147,
    colorTempPhysicalMaxMireds: number = 500,
  ): this {
    this.behaviors.require(MatterbridgeEnhancedColorControlServer.with(ColorControl.Feature.Xy, ColorControl.Feature.HueSaturation, ColorControl.Feature.EnhancedHue, ColorControl.Feature.ColorTemperature), {
      colorMode: ColorControl.ColorMode.CurrentHueAndCurrentSaturation,
      enhancedColorMode: ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation,
      colorCapabilities: { xy: true, hueSaturation: true, colorLoop: false, enhancedHue: true, colorTemperature: true },
      options: {
        executeIfOff: false,
      },
      numberOfPrimaries: null,
      currentX,
      currentY,
      currentHue: Math.round((enhancedCurrentHue / 65535) * 254), // currentHue range is 0-254 and enhancedCurrentHue range is 0-65535
      enhancedCurrentHue,
      currentSaturation,
      colorTemperatureMireds,
      colorTempPhysicalMinMireds,
      colorTempPhysicalMaxMireds,
      coupleColorTempToLevelMinMireds: colorTempPhysicalMinMireds,
      startUpColorTemperatureMireds: null,
      remainingTime: 0,
    });
    return this;
  }

  /**
   * Creates a Xy color control cluster server with feature Xy and ColorTemperature.
   *
   * @param {number} currentX - The current X value (range 0-65279).
   * @param {number} currentY - The current Y value (range 0-65279).
   * @param {number} colorTemperatureMireds - The color temperature in mireds (range colorTempPhysicalMinMireds-colorTempPhysicalMaxMireds).
   * @param {number} colorTempPhysicalMinMireds - The physical minimum color temperature in mireds (default 147).
   * @param {number} colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds (default 500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * From zigbee to matter = Math.max(Math.min(Math.round(x * 65536), 65279), 0)
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   * @remarks currentX and currentY persist across restarts.
   * @remarks colorTemperatureMireds persists across restarts.
   * @remarks startUpColorTemperatureMireds persists across restarts.
   * @remarks coupleColorTempToLevelMinMireds persists across restarts.
   */
  createXyColorControlClusterServer(currentX: number = 0, currentY: number = 0, colorTemperatureMireds: number = 500, colorTempPhysicalMinMireds: number = 147, colorTempPhysicalMaxMireds: number = 500): this {
    this.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.Xy, ColorControl.Feature.ColorTemperature), {
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
    });
    return this;
  }

  /**
   * Creates a default hue and saturation control cluster server with feature HueSaturation and ColorTemperature.
   *
   * @param {number} currentHue - The current hue value (range: 0-254).
   * @param {number} currentSaturation - The current saturation value (range: 0-254).
   * @param {number} colorTemperatureMireds - The color temperature in mireds (range colorTempPhysicalMinMireds-colorTempPhysicalMaxMireds).
   * @param {number} colorTempPhysicalMinMireds - The physical minimum color temperature in mireds (default 147).
   * @param {number} colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds (default 500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   * @remarks currentHue and currentSaturation persist across restarts.
   * @remarks colorTemperatureMireds persists across restarts.
   * @remarks startUpColorTemperatureMireds persists across restarts.
   * @remarks coupleColorTempToLevelMinMireds persists across restarts.
   */
  createHsColorControlClusterServer(currentHue: number = 0, currentSaturation: number = 0, colorTemperatureMireds: number = 500, colorTempPhysicalMinMireds: number = 147, colorTempPhysicalMaxMireds: number = 500): this {
    this.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature), {
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
    });
    return this;
  }

  /**
   * Creates a color temperature color control cluster server with feature ColorTemperature.
   * This cluster server is used for devices that only support color temperature control.
   *
   * @param {number} colorTemperatureMireds - The color temperature in mireds (range colorTempPhysicalMinMireds-colorTempPhysicalMaxMireds).
   * @param {number} colorTempPhysicalMinMireds - The physical minimum color temperature in mireds (default 147).
   * @param {number} colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds (default 500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   * @remarks colorTemperatureMireds persists across restarts.
   * @remarks startUpColorTemperatureMireds persists across restarts.
   * @remarks coupleColorTempToLevelMinMireds persists across restarts.
   */
  createCtColorControlClusterServer(colorTemperatureMireds: number = 250, colorTempPhysicalMinMireds: number = 147, colorTempPhysicalMaxMireds: number = 500): this {
    this.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.ColorTemperature), {
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
      startUpColorTemperatureMireds: null,
      remainingTime: 0,
    });
    return this;
  }

  /**
   * Configures the color control mode for the device.
   *
   * @param {ColorControl.ColorMode} colorMode - The color mode to set.
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   */
  async configureColorControlMode(colorMode: ColorControl.ColorMode) {
    if (isValidNumber(colorMode, ColorControl.ColorMode.CurrentHueAndCurrentSaturation, ColorControl.ColorMode.ColorTemperatureMireds)) {
      await this.setAttribute(ColorControl.Cluster.id, 'colorMode', colorMode, this.log);
      await this.setAttribute(ColorControl.Cluster.id, 'enhancedColorMode', colorMode as unknown as ColorControl.EnhancedColorMode, this.log);
    }
  }

  /**
   * Configures the enhanced color control mode for the device.
   *
   * @param {ColorControl.EnhancedColorMode} colorMode - The enhanced color mode to set.
   *
   * @remarks colorMode and enhancedColorMode persist across restarts.
   */
  async configureEnhancedColorControlMode(colorMode: ColorControl.EnhancedColorMode) {
    if (isValidNumber(colorMode, ColorControl.EnhancedColorMode.CurrentHueAndCurrentSaturation, ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation)) {
      await this.setAttribute(ColorControl.Cluster.id, 'colorMode', colorMode === ColorControl.EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation ? ColorControl.ColorMode.CurrentHueAndCurrentSaturation : colorMode, this.log);
      await this.setAttribute(ColorControl.Cluster.id, 'enhancedColorMode', colorMode, this.log);
    }
  }

  /**
   * Creates a default window covering cluster server with feature Lift and PositionAwareLift.
   *
   * @param {number} positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   * @param {WindowCovering.WindowCoveringType} type - The type of window covering (default: WindowCovering.WindowCoveringType.Rollershade). Must support feature Lift.
   * @param {WindowCovering.EndProductType} endProductType - The end product type (default: WindowCovering.EndProductType.RollerShade). Must support feature Lift.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks mode attributes is writable and persists across restarts.
   * currentPositionLiftPercent100ths persists across restarts.
   * configStatus attributes persists across restarts.
   */
  createDefaultWindowCoveringClusterServer(
    positionPercent100ths?: number,
    type: WindowCovering.WindowCoveringType = WindowCovering.WindowCoveringType.Rollershade,
    endProductType: WindowCovering.EndProductType = WindowCovering.EndProductType.RollerShade,
  ): this {
    this.behaviors.require(MatterbridgeLiftWindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift), {
      type, // Must support feature Lift
      numberOfActuationsLift: 0,
      configStatus: {
        operational: true,
        onlineReserved: false,
        liftMovementReversed: false,
        liftPositionAware: true,
        tiltPositionAware: false,
        liftEncoderControlled: false, // 0 = Timer Controlled 1 = Encoder Controlled
        tiltEncoderControlled: false, // 0 = Timer Controlled 1 = Encoder Controlled
      },
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      endProductType, // Must support feature Lift
      mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
      targetPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
      currentPositionLiftPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
    });
    return this;
  }

  /**
   * Creates a default window covering cluster server with features Lift, PositionAwareLift, Tilt, PositionAwareTilt.
   *
   * @param {number} positionLiftPercent100ths - The lift position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   * @param {number} positionTiltPercent100ths - The tilt position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   * @param {WindowCovering.WindowCoveringType} type - The type of window covering (default: WindowCovering.WindowCoveringType.TiltBlindLift). Must support features Lift and Tilt.
   * @param {WindowCovering.EndProductType} endProductType - The end product type (default: WindowCovering.EndProductType.InteriorBlind). Must support features Lift and Tilt.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks mode attributes is writable and persists across restarts.
   * currentPositionTiltPercent100ths persists across restarts.
   * configStatus attributes persists across restarts.
   */
  createDefaultLiftTiltWindowCoveringClusterServer(
    positionLiftPercent100ths?: number,
    positionTiltPercent100ths?: number,
    type: WindowCovering.WindowCoveringType = WindowCovering.WindowCoveringType.TiltBlindLift,
    endProductType: WindowCovering.EndProductType = WindowCovering.EndProductType.InteriorBlind,
  ): this {
    this.behaviors.require(MatterbridgeLiftTiltWindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift, WindowCovering.Feature.Tilt, WindowCovering.Feature.PositionAwareTilt), {
      type, // Must support features Lift and Tilt
      numberOfActuationsLift: 0,
      numberOfActuationsTilt: 0,
      configStatus: {
        operational: true,
        onlineReserved: false,
        liftMovementReversed: false,
        liftPositionAware: true,
        tiltPositionAware: true,
        liftEncoderControlled: false, // 0 = Timer Controlled 1 = Encoder Controlled
        tiltEncoderControlled: false, // 0 = Timer Controlled 1 = Encoder Controlled
      },
      operationalStatus: { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
      endProductType, // Must support features Lift and Tilt
      mode: { motorDirectionReversed: false, calibrationMode: false, maintenanceMode: false, ledFeedback: false },
      targetPositionLiftPercent100ths: positionLiftPercent100ths ?? 0, // 0 Fully open 10000 fully closed
      currentPositionLiftPercent100ths: positionLiftPercent100ths ?? 0, // 0 Fully open 10000 fully closed
      targetPositionTiltPercent100ths: positionTiltPercent100ths ?? 0, // 0 Fully open 10000 fully closed
      currentPositionTiltPercent100ths: positionTiltPercent100ths ?? 0, // 0 Fully open 10000 fully closed
    });
    return this;
  }

  /**
   * Sets the window covering lift target position as the current position and stops the movement.
   *
   */
  async setWindowCoveringTargetAsCurrentAndStopped() {
    const position = this.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', this.log);
    if (isValidNumber(position, 0, 10000)) {
      await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', position, this.log);
      await this.setAttribute(
        WindowCovering.Cluster.id,
        'operationalStatus',
        {
          global: WindowCovering.MovementStatus.Stopped,
          lift: WindowCovering.MovementStatus.Stopped,
          tilt: WindowCovering.MovementStatus.Stopped,
        },
        this.log,
      );
    }
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths and targetPositionLiftPercent100ths to ${position} and operationalStatus to Stopped.`);
    if (this.hasAttributeServer(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')) {
      const position = this.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths', this.log);
      if (isValidNumber(position, 0, 10000)) {
        await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths', position, this.log);
      }
      this.log.debug(`Set WindowCovering currentPositionTiltPercent100ths and targetPositionTiltPercent100ths to ${position} and operationalStatus to Stopped.`);
    }
  }

  /**
   * Sets the lift current and target position and the status of a window covering.
   *
   * @param {number} current - The current position of the window covering.
   * @param {number} target - The target position of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status of the window covering.
   */
  async setWindowCoveringCurrentTargetStatus(current: number, target: number, status: WindowCovering.MovementStatus) {
    await this.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', current, this.log);
    await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', target, this.log);
    await this.setAttribute(
      WindowCovering.Cluster.id,
      'operationalStatus',
      {
        global: status,
        lift: status,
        tilt: status,
      },
      this.log,
    );
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${current}, targetPositionLiftPercent100ths: ${target} and operationalStatus: ${status}.`);
  }

  /**
   * Sets the status of the window covering.
   *
   * @param {WindowCovering.MovementStatus} status - The movement status to set.
   */
  async setWindowCoveringStatus(status: WindowCovering.MovementStatus) {
    await this.setAttribute(
      WindowCovering.Cluster.id,
      'operationalStatus',
      {
        global: status,
        lift: status,
        tilt: status,
      },
      this.log,
    );
    this.log.debug(`Set WindowCovering operationalStatus: ${status}`);
  }

  /**
   * Retrieves the status of the window covering.
   *
   * @returns {WindowCovering.MovementStatus | undefined} The movement status of the window covering, or undefined if not available.
   */
  getWindowCoveringStatus(): WindowCovering.MovementStatus | undefined {
    const status = this.getAttribute(WindowCovering.Cluster.id, 'operationalStatus', this.log);
    if (isValidObject(status, 3) && 'global' in status && typeof status.global === 'number') {
      this.log.debug(`Get WindowCovering operationalStatus: ${status.global}`);
      return status.global;
    }
  }

  /**
   * Sets the lift target and current position of the window covering.
   *
   * @param {number} liftPosition - The position to set, specified as a number.
   * @param {number} [tiltPosition] - The tilt position to set, specified as a number.
   */
  async setWindowCoveringTargetAndCurrentPosition(liftPosition: number, tiltPosition?: number) {
    await this.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', liftPosition, this.log);
    await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', liftPosition, this.log);
    this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${liftPosition} and targetPositionLiftPercent100ths: ${liftPosition}.`);
    if (tiltPosition && this.hasAttributeServer(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths')) {
      await this.setAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths', tiltPosition, this.log);
      await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths', tiltPosition, this.log);
      this.log.debug(`Set WindowCovering currentPositionTiltPercent100ths: ${tiltPosition} and targetPositionTiltPercent100ths: ${tiltPosition}.`);
    }
  }

  /**
   * Creates a default thermostat cluster server with features **Heating**, **Cooling** and **AutoMode**.
   *
   * - When the occupied parameter is provided (either false or true), the **Occupancy** feature is also added (defaults to undefined).
   * - When the outdoorTemperature parameter is provided (either null or a number), the outdoorTemperature attribute is also added (defaults to undefined).
   *
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [occupiedCoolingSetpoint] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minSetpointDeadBand] - The minimum setpoint dead band value. Defaults to 1°.
   * @param {number} [minHeatSetpointLimit] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit] - The maximum heat setpoint limit value. Defaults to 50°.
   * @param {number} [minCoolSetpointLimit] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit] - The maximum cool setpoint limit value. Defaults to 50°.
   * @param {number | undefined} [unoccupiedHeatingSetpoint] - The unoccupied heating setpoint value in degrees Celsius. Defaults to 19° (it will be ignored if occupied is not provided).
   * @param {number | undefined} [unoccupiedCoolingSetpoint] - The unoccupied cooling setpoint value in degrees Celsius. Defaults to 27° (it will be ignored if occupied is not provided).
   * @param {boolean | undefined} [occupied] - The occupancy status. Defaults to undefined (it will be ignored).
   * @param {number | null | undefined} [outdoorTemperature] - The outdoor temperature value in degrees Celsius. Defaults to undefined (it will be ignored).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultThermostatClusterServer(
    localTemperature: number = 23,
    occupiedHeatingSetpoint: number = 21,
    occupiedCoolingSetpoint: number = 25,
    minSetpointDeadBand: number = 1,
    minHeatSetpointLimit: number = 0,
    maxHeatSetpointLimit: number = 50,
    minCoolSetpointLimit: number = 0,
    maxCoolSetpointLimit: number = 50,
    unoccupiedHeatingSetpoint: number | undefined = undefined,
    unoccupiedCoolingSetpoint: number | undefined = undefined,
    occupied: boolean | undefined = undefined,
    outdoorTemperature: number | null | undefined = undefined,
  ): this {
    this.behaviors.require(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode, ...(occupied !== undefined ? [Thermostat.Feature.Occupancy] : [])), {
      localTemperature: localTemperature * 100,
      ...(outdoorTemperature !== undefined ? { outdoorTemperature: outdoorTemperature !== null ? outdoorTemperature * 100 : outdoorTemperature } : {}), // Optional nullable attribute
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
      // Thermostat.Feature.Occupancy
      ...(occupied !== undefined ? { unoccupiedHeatingSetpoint: unoccupiedHeatingSetpoint !== undefined ? unoccupiedHeatingSetpoint * 100 : 1900 } : {}),
      ...(occupied !== undefined ? { unoccupiedCoolingSetpoint: unoccupiedCoolingSetpoint !== undefined ? unoccupiedCoolingSetpoint * 100 : 2700 } : {}),
      ...(occupied !== undefined ? { occupancy: { occupied } } : {}),
    });
    return this;
  }

  /**
   * Creates a default heating thermostat cluster server with feature **Heating**.
   *
   * - When the occupied parameter is provided (either false or true), the **Occupancy** feature is also added (defaults to undefined).
   * - When the outdoorTemperature parameter is provided (either null or a number), the outdoorTemperature attribute is also added (defaults to undefined).
   *
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [minHeatSetpointLimit] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit] - The maximum heat setpoint limit value. Defaults to 50°.
   * @param {number | undefined} [unoccupiedHeatingSetpoint] - The unoccupied heating setpoint value in degrees Celsius. Defaults to 19° (it will be ignored if occupied is not provided).
   * @param {boolean | undefined} [occupied] - The occupancy status. Defaults to undefined (it will be ignored).
   * @param {number | null | undefined} [outdoorTemperature] - The outdoor temperature value in degrees Celsius. Defaults to undefined (it will be ignored).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultHeatingThermostatClusterServer(
    localTemperature: number = 23,
    occupiedHeatingSetpoint: number = 21,
    minHeatSetpointLimit: number = 0,
    maxHeatSetpointLimit: number = 50,
    unoccupiedHeatingSetpoint: number | undefined = undefined,
    occupied: boolean | undefined = undefined,
    outdoorTemperature: number | null | undefined = undefined,
  ): this {
    this.behaviors.require(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating, ...(occupied !== undefined ? [Thermostat.Feature.Occupancy] : [])), {
      localTemperature: localTemperature * 100,
      ...(outdoorTemperature !== undefined ? { outdoorTemperature: outdoorTemperature !== null ? outdoorTemperature * 100 : outdoorTemperature } : {}), // Optional nullable attribute
      systemMode: Thermostat.SystemMode.Heat,
      controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.HeatingOnly,
      // Thermostat.Feature.Heating
      occupiedHeatingSetpoint: occupiedHeatingSetpoint * 100,
      minHeatSetpointLimit: minHeatSetpointLimit * 100,
      maxHeatSetpointLimit: maxHeatSetpointLimit * 100,
      absMinHeatSetpointLimit: minHeatSetpointLimit * 100,
      absMaxHeatSetpointLimit: maxHeatSetpointLimit * 100,
      // Thermostat.Feature.Occupancy
      ...(occupied !== undefined ? { unoccupiedHeatingSetpoint: unoccupiedHeatingSetpoint !== undefined ? unoccupiedHeatingSetpoint * 100 : 1900 } : {}),
      ...(occupied !== undefined ? { occupancy: { occupied } } : {}),
      // Thermostat.Feature.Presets
      // supportedPresets: supportedPresets,
      numberOfPresets: supportedPresets.length,
      type ExtendedThermostatSettings = Partial<ThermostatSettings> & {
      selectedPreset?: PresetType;
      activePresetHandle: new Uint8Array([0]),
    });
    return this;
  }

  /**
   * Creates a default cooling thermostat cluster server with feature **Cooling**.
   *
   * - When the occupied parameter is provided (either false or true), the **Occupancy** feature is also added (defaults to undefined).
   * - When the outdoorTemperature parameter is provided (either null or a number), the outdoorTemperature attribute is also added (defaults to undefined).
   *
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedCoolingSetpoint] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minCoolSetpointLimit] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit] - The maximum cool setpoint limit value. Defaults to 50°.
   * @param {number | undefined} [unoccupiedCoolingSetpoint] - The unoccupied cooling setpoint value in degrees Celsius. Defaults to 27° (it will be ignored if occupied is not provided).
   * @param {boolean | undefined} [occupied] - The occupancy status. Defaults to undefined (it will be ignored).
   * @param {number | null | undefined} [outdoorTemperature] - The outdoor temperature value in degrees Celsius. Defaults to undefined (it will be ignored).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultCoolingThermostatClusterServer(
    localTemperature: number = 23,
    occupiedCoolingSetpoint: number = 25,
    minCoolSetpointLimit: number = 0,
    maxCoolSetpointLimit: number = 50,
    unoccupiedCoolingSetpoint: number | undefined = undefined,
    occupied: boolean | undefined = undefined,
    outdoorTemperature: number | null | undefined = undefined,
  ): this {
    this.behaviors.require(MatterbridgeThermostatServer.with(Thermostat.Feature.Cooling, ...(occupied !== undefined ? [Thermostat.Feature.Occupancy] : [])), {
      localTemperature: localTemperature * 100,
      ...(outdoorTemperature !== undefined ? { outdoorTemperature: outdoorTemperature !== null ? outdoorTemperature * 100 : outdoorTemperature } : {}), // Optional nullable attribute
      systemMode: Thermostat.SystemMode.Cool,
      controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingOnly,
      // Thermostat.Feature.Cooling
      occupiedCoolingSetpoint: occupiedCoolingSetpoint * 100,
      minCoolSetpointLimit: minCoolSetpointLimit * 100,
      maxCoolSetpointLimit: maxCoolSetpointLimit * 100,
      absMinCoolSetpointLimit: minCoolSetpointLimit * 100,
      absMaxCoolSetpointLimit: maxCoolSetpointLimit * 100,
      // Thermostat.Feature.Occupancy
      ...(occupied !== undefined ? { unoccupiedCoolingSetpoint: unoccupiedCoolingSetpoint !== undefined ? unoccupiedCoolingSetpoint * 100 : 2700 } : {}),
      ...(occupied !== undefined ? { occupancy: { occupied } } : {}),
    });
    return this;
  }

  /**
   * Creates a default thermostat user interface configuration cluster server.
   *
   * @param {ThermostatUserInterfaceConfiguration.TemperatureDisplayMode} [temperatureDisplayMode] - The temperature display mode to set. Defaults to `ThermostatUserInterfaceConfiguration.TemperatureDisplayMode.Celsius`.
   * @param {ThermostatUserInterfaceConfiguration.KeypadLockout} [keypadLockout] - The keypad lockout mode. Defaults to `ThermostatUserInterfaceConfiguration.KeypadLockout.NoLockout`.
   * @param {ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility} [scheduleProgrammingVisibility] - The schedule programming visibility. Defaults to `ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility.ScheduleProgrammingPermitted`.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   * @remarks
   * The default values are:
   * - temperatureDisplayMode: ThermostatUserInterfaceConfiguration.TemperatureDisplayMode.Celsius (writable).
   * - keypadLockout: ThermostatUserInterfaceConfiguration.KeypadLockout.NoLockout (writable).
   * - scheduleProgrammingVisibility: ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility.ScheduleProgrammingPermitted (writable).
   */
  createDefaultThermostatUserInterfaceConfigurationClusterServer(
    temperatureDisplayMode: ThermostatUserInterfaceConfiguration.TemperatureDisplayMode = ThermostatUserInterfaceConfiguration.TemperatureDisplayMode.Celsius,
    keypadLockout: ThermostatUserInterfaceConfiguration.KeypadLockout = ThermostatUserInterfaceConfiguration.KeypadLockout.NoLockout,
    scheduleProgrammingVisibility: ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility = ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility.ScheduleProgrammingPermitted,
  ): this {
    this.behaviors.require(ThermostatUserInterfaceConfigurationServer, {
      temperatureDisplayMode,
      keypadLockout,
      scheduleProgrammingVisibility,
    });
    return this;
  }

  /**
   * Creates a default fan control cluster server with features Auto, and Step and mode Off Low Med High Auto.
   *
   * @param {FanControl.FanMode} [fanMode] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @param {FanControl.FanModeSequence} [fanModeSequence] - The fan mode sequence to set. Defaults to `FanControl.FanModeSequence.OffLowMedHighAuto`.
   * @param {number} [percentSetting] - The initial percent setting. Defaults to 0.
   * @param {number} [percentCurrent] - The initial percent current. Defaults to 0.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - fanmode is writable and persists across reboots.
   * - fanModeSequence is fixed.
   * - percentSetting is writable.
   */
  createDefaultFanControlClusterServer(fanMode: FanControl.FanMode = FanControl.FanMode.Off, fanModeSequence: FanControl.FanModeSequence = FanControl.FanModeSequence.OffLowMedHighAuto, percentSetting: number = 0, percentCurrent: number = 0): this {
    this.behaviors.require(MatterbridgeFanControlServer.with(FanControl.Feature.Auto, FanControl.Feature.Step), {
      // Base fan control attributes
      fanMode, // Writable and persistent attribute
      fanModeSequence, // Fixed attribute
      percentSetting, // Writable attribute
      percentCurrent,
    });
    return this;
  }

  /**
   * Creates an On Off fan control cluster server without features and mode Off High.
   *
   * @param {FanControl.FanMode} [fanMode] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * fanmode is writable and persists across reboots.
   * fanModeSequence is fixed.
   * percentSetting is writable.
   */
  createOnOffFanControlClusterServer(fanMode: FanControl.FanMode = FanControl.FanMode.Off): this {
    this.behaviors.require(FanControlServer, {
      // Base fan control attributes
      fanMode, // Writable and persistent attribute
      fanModeSequence: FanControl.FanModeSequence.OffHigh, // Fixed attribute
      percentSetting: 0, // Writable attribute
      percentCurrent: 0,
    });
    return this;
  }

  /**
   * Creates a base fan control cluster server without features and mode Off Low Med High.
   *
   * @param {FanControl.FanMode} [fanMode] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @param {FanControl.FanModeSequence} [fanModeSequence] - The fan mode sequence to set. Defaults to `FanControl.FanModeSequence.OffLowMedHigh`.
   * @param {number} [percentSetting] - The initial percent setting. Defaults to 0.
   * @param {number} [percentCurrent] - The initial percent current. Defaults to 0.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * fanmode is writable and persists across reboots.
   * fanModeSequence is fixed.
   * percentSetting is writable.
   */
  createBaseFanControlClusterServer(fanMode: FanControl.FanMode = FanControl.FanMode.Off, fanModeSequence: FanControl.FanModeSequence = FanControl.FanModeSequence.OffLowMedHigh, percentSetting: number = 0, percentCurrent: number = 0): this {
    this.behaviors.require(FanControlServer, {
      // Base fan control attributes
      fanMode, // Writable and persistent attribute
      fanModeSequence, // Fixed attribute
      percentSetting, // Writable attribute
      percentCurrent,
    });
    return this;
  }

  /**
   * Creates a fan control cluster server with features MultiSpeed, Auto, and Step and mode Off Low Med High Auto.
   *
   * @param {FanControl.FanMode} [fanMode] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @param {FanControl.FanModeSequence} [fanModeSequence] - The fan mode sequence to set. Defaults to `FanControl.FanModeSequence.OffLowMedHighAuto`.
   * @param {number} [percentSetting] - The initial percent setting. Defaults to 0.
   * @param {number} [percentCurrent] - The initial percent current. Defaults to 0.
   * @param {number} [speedMax] - The maximum speed setting. Defaults to 10.
   * @param {number} [speedSetting] - The initial speed setting. Defaults to 0.
   * @param {number} [speedCurrent] - The initial speed current. Defaults to 0.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - fanmode is writable and persists across reboots.
   * - fanModeSequence is fixed.
   * - percentSetting is writable.
   * - speedMax is fixed.
   * - speedSetting is writable.
   */
  createMultiSpeedFanControlClusterServer(
    fanMode: FanControl.FanMode = FanControl.FanMode.Off,
    fanModeSequence: FanControl.FanModeSequence = FanControl.FanModeSequence.OffLowMedHighAuto,
    percentSetting: number = 0,
    percentCurrent: number = 0,
    speedMax: number = 10,
    speedSetting: number = 0,
    speedCurrent: number = 0,
  ): this {
    this.behaviors.require(MatterbridgeFanControlServer.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto, FanControl.Feature.Step), {
      // Base fan control attributes
      fanMode, // Writable and persistent attribute
      fanModeSequence, // Fixed attribute
      percentSetting, // Writable attribute
      percentCurrent,
      // MultiSpeed feature
      speedMax, // Fixed attribute
      speedSetting, // Writable attribute
      speedCurrent,
    });
    return this;
  }

  /**
   * Creates a fan control cluster server with features MultiSpeed, Auto, Step, Rock, Wind and AirflowDirection and mode Off Low Med High Auto.
   *
   * @param {FanControl.FanMode} [fanMode] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @param {FanControl.FanModeSequence} [fanModeSequence] - The fan mode sequence to set. Defaults to `FanControl.FanModeSequence.OffLowMedHighAuto`.
   * @param {number} [percentSetting] - The initial percent setting. Defaults to 0.
   * @param {number} [percentCurrent] - The initial percent current. Defaults to 0.
   * @param {number} [speedMax] - The maximum speed setting. Defaults to 10.
   * @param {number} [speedSetting] - The initial speed setting. Defaults to 0.
   * @param {number} [speedCurrent] - The initial speed current. Defaults to 0.
   * @param {object} [rockSupport] - The rock support configuration.
   * @param {boolean} rockSupport.rockLeftRight - Indicates support for rocking left to right. Defaults to true.
   * @param {boolean} rockSupport.rockUpDown - Indicates support for rocking up and down. Defaults to true.
   * @param {boolean} rockSupport.rockRound - Indicates support for round rocking. Defaults to true.
   * @param {object} [rockSetting] - The rock setting configuration.
   * @param {boolean} rockSetting.rockLeftRight - Indicates the current setting for rocking left to right. Defaults to true.
   * @param {boolean} rockSetting.rockUpDown - Indicates the current setting for rocking up and down. Defaults to true.
   * @param {boolean} rockSetting.rockRound - Indicates the current setting for round rocking. Defaults to true.
   * @param {object} [windSupport] - The wind support configuration.
   * @param {boolean} windSupport.sleepWind - Indicates support for sleep wind. Defaults to true.
   * @param {boolean} windSupport.naturalWind - Indicates support for natural wind. Defaults to true.
   * @param {object} [windSetting] - The wind setting configuration.
   * @param {boolean} windSetting.sleepWind - Indicates the current setting for sleep wind. Defaults to false.
   * @param {boolean} windSetting.naturalWind - Indicates the current setting for natural wind. Defaults to true.
   * @param {FanControl.AirflowDirection} [airflowDirection] - The airflow direction. Defaults to `FanControl.AirflowDirection.Forward`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - fanmode is writable and persists across reboots.
   * - fanModeSequence is fixed.
   * - percentSetting is writable.
   * - speedMax is fixed.
   * - speedSetting is writable.
   * - rockSupport is fixed.
   * - rockSetting is writable.
   * - windSupport is fixed.
   * - windSetting is writable.
   * - airflowDirection is writable.
   */
  createCompleteFanControlClusterServer(
    fanMode: FanControl.FanMode = FanControl.FanMode.Off,
    fanModeSequence: FanControl.FanModeSequence = FanControl.FanModeSequence.OffLowMedHighAuto,
    percentSetting: number = 0,
    percentCurrent: number = 0,
    speedMax: number = 10,
    speedSetting: number = 0,
    speedCurrent: number = 0,
    rockSupport: { rockLeftRight: boolean; rockUpDown: boolean; rockRound: boolean } = { rockLeftRight: true, rockUpDown: true, rockRound: true },
    rockSetting: { rockLeftRight: boolean; rockUpDown: boolean; rockRound: boolean } = { rockLeftRight: true, rockUpDown: false, rockRound: false },
    windSupport: { sleepWind: boolean; naturalWind: boolean } = { sleepWind: true, naturalWind: true },
    windSetting: { sleepWind: boolean; naturalWind: boolean } = { sleepWind: false, naturalWind: true },
    airflowDirection: FanControl.AirflowDirection = FanControl.AirflowDirection.Forward,
  ): this {
    this.behaviors.require(MatterbridgeFanControlServer.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto, FanControl.Feature.Step, FanControl.Feature.Rocking, FanControl.Feature.Wind, FanControl.Feature.AirflowDirection), {
      // Base fan control attributes
      fanMode, // Writable and persistent attribute
      fanModeSequence, // Fixed attribute
      percentSetting, // Writable attribute
      percentCurrent,
      // MultiSpeed feature
      speedMax, // Fixed attribute
      speedSetting, // Writable attribute
      speedCurrent,
      // Rocking feature
      rockSupport, // Fixed attribute
      rockSetting, // Writable attribute
      // Wind feature
      windSupport, // Fixed attribute
      windSetting, // Writable attribute
      // AirflowDirection feature
      airflowDirection, // Writable attribute
    });
    return this;
  }

  /**
   * Creates a default HEPA Filter Monitoring Cluster Server with features Condition and ReplacementProductList.
   * It supports ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.Warning, and ResourceMonitoring.Feature.ReplacementProductList.
   *
   * @param {number} condition - The initial condition value (range 0-100). Default is 100.
   * @param {ResourceMonitoring.ChangeIndication} changeIndication - The initial change indication. Default is ResourceMonitoring.ChangeIndication.Ok.
   * @param {boolean | undefined} inPlaceIndicator - The in-place indicator. Default is true.
   * @param {number | undefined} lastChangedTime - The last changed time (EpochS). Default is null.
   * @param {ResourceMonitoring.ReplacementProduct[]} replacementProductList - The list of replacement products. Default is an empty array. It is a fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The HEPA Filter Monitoring Cluster Server is used to monitor the status of HEPA filters.
   * It provides information about the condition of the filter, whether it is in place, and the last time it was changed.
   * The change indication can be used to indicate if the filter needs to be replaced or serviced.
   * The replacement product list can be used to provide a list of replacement products for the filter.
   * The condition attribute is fixed at 100, indicating a healthy filter.
   * The degradation direction is fixed at ResourceMonitoring.DegradationDirection.Down, indicating that a lower value indicates a worse condition.
   * The replacement product list is initialized as an empty array.
   */
  createDefaultHepaFilterMonitoringClusterServer(
    condition: number = 100,
    changeIndication: ResourceMonitoring.ChangeIndication = ResourceMonitoring.ChangeIndication.Ok,
    inPlaceIndicator: boolean | undefined = true,
    lastChangedTime: number | null | undefined = null,
    replacementProductList: ResourceMonitoring.ReplacementProduct[] = [],
  ): this {
    this.behaviors.require(MatterbridgeHepaFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.Warning, ResourceMonitoring.Feature.ReplacementProductList), {
      // Feature.Condition
      condition,
      degradationDirection: ResourceMonitoring.DegradationDirection.Down, // Fixed attribute
      // Feature.ReplacementProductList
      replacementProductList, // Fixed attribute
      // Base attributes
      changeIndication,
      inPlaceIndicator,
      lastChangedTime, // Writable and persistent across restarts
    });
    return this;
  }

  /**
   * Creates a default Activated Carbon Filter Monitoring Cluster Server with features Condition and ReplacementProductList.
   * It supports ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.Warning, and ResourceMonitoring.Feature.ReplacementProductList.
   *
   * @param {number} condition - The initial condition value (range 0-100). Default is 100.
   * @param {ResourceMonitoring.ChangeIndication} changeIndication - The initial change indication. Default is ResourceMonitoring.ChangeIndication.Ok.
   * @param {boolean | undefined} inPlaceIndicator - The in-place indicator. Default is undefined.
   * @param {number | undefined} lastChangedTime - The last changed time (EpochS). Default is undefined.
   * @param {ResourceMonitoring.ReplacementProduct[]} replacementProductList - The list of replacement products. Default is an empty array. It is a fixed attribute.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The Activated Carbon Filter Monitoring Cluster Server is used to monitor the status of activated carbon filters.
   * It provides information about the condition of the filter, whether it is in place, and the last time it was changed.
   * The change indication can be used to indicate if the filter needs to be replaced or serviced.
   * The replacement product list can be used to provide a list of replacement products for the filter.
   * The condition attribute is fixed at 100, indicating a healthy filter.
   * The degradation direction is fixed at ResourceMonitoring.DegradationDirection.Down, indicating that a lower value indicates a worse condition.
   * The replacement product list is initialized as an empty array.
   */
  createDefaultActivatedCarbonFilterMonitoringClusterServer(
    condition: number = 100,
    changeIndication: ResourceMonitoring.ChangeIndication = ResourceMonitoring.ChangeIndication.Ok,
    inPlaceIndicator: boolean | undefined = true,
    lastChangedTime: number | null | undefined = null,
    replacementProductList: ResourceMonitoring.ReplacementProduct[] = [],
  ): this {
    this.behaviors.require(MatterbridgeActivatedCarbonFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.Warning, ResourceMonitoring.Feature.ReplacementProductList), {
      // Feature.Condition
      condition,
      degradationDirection: ResourceMonitoring.DegradationDirection.Down,
      // Feature.ReplacementProductList
      replacementProductList, // Fixed attribute
      // Base attributes
      changeIndication,
      inPlaceIndicator,
      lastChangedTime, // Writable and persistent across restarts
    });
    return this;
  }

  /**
   * Creates a default door lock cluster server.
   *
   * @param {DoorLock.LockState} [lockState] - The initial state of the lock (default: Locked).
   * @param {DoorLock.LockType} [lockType] - The type of the lock (default: DeadBolt).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * All operating modes NOT supported by a lock SHALL be set to one. The value of the OperatingMode enumeration defines the related bit to be set.
   */
  createDefaultDoorLockClusterServer(lockState: DoorLock.LockState = DoorLock.LockState.Locked, lockType: DoorLock.LockType = DoorLock.LockType.DeadBolt): this {
    this.behaviors.require(MatterbridgeDoorLockServer.enable({ events: { doorLockAlarm: true, lockOperation: true, lockOperationError: true } }), {
      lockState,
      lockType,
      actuatorEnabled: false,
      operatingMode: DoorLock.OperatingMode.Normal,
      // Special case of inverted bitmap: add also alwaysSet = 2047
      supportedOperatingModes: { normal: false, vacation: true, privacy: true, noRemoteLockUnlock: true, passage: true, alwaysSet: 2047 },
      alarmMask: { lockJammed: false, lockFactoryReset: false, lockRadioPowerCycled: false, wrongCodeEntryLimit: false, frontEscutcheonRemoved: false, doorForcedOpen: false },
    });
    return this;
  }

  /**
   * Creates a default Mode Select cluster server.
   *
   * @param {string} description - The description of the mode select cluster.
   * @param {ModeSelect.ModeOption[]} supportedModes - The list of supported modes.
   * @param {number} [currentMode] - The current mode (default: 0).
   * @param {number} [startUpMode] - The startup mode (default: 0).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * endpoint.createDefaultModeSelectClusterServer('Night mode', [{ label: 'Led ON', mode: 0, semanticTags: [] }, { label: 'Led OFF', mode: 1, semanticTags: [] }], 0, 0);
   */
  createDefaultModeSelectClusterServer(description: string, supportedModes: ModeSelect.ModeOption[], currentMode: number = 0, startUpMode: number = 0): this {
    this.behaviors.require(MatterbridgeModeSelectServer, {
      description: description,
      standardNamespace: null,
      supportedModes: supportedModes,
      currentMode: currentMode,
      startUpMode: startUpMode,
    });
    return this;
  }

  /**
   * Creates the default Valve Configuration And Control cluster server with features Level.
   *
   * @param {ValveConfigurationAndControl.ValveState} [valveState] - The valve state to set. Defaults to `ValveConfigurationAndControl.ValveState.Closed`.
   * @param {number} [valveLevel] - The valve level to set. Defaults to 0.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultValveConfigurationAndControlClusterServer(valveState: ValveConfigurationAndControl.ValveState = ValveConfigurationAndControl.ValveState.Closed, valveLevel: number = 0): this {
    this.behaviors.require(MatterbridgeValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level), {
      currentState: valveState,
      targetState: valveState,
      openDuration: null,
      defaultOpenDuration: null, // Writable and persistent across restarts
      remainingDuration: null,
      valveFault: { generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false },
      // Feature.Level
      currentLevel: valveLevel,
      targetLevel: valveLevel,
      defaultOpenLevel: 100, // Writable and persistent across restarts
      levelStep: 1, // Fixed
    });
    return this;
  }

  /**
   * Creates the default PumpConfigurationAndControl cluster server with features ConstantSpeed.
   *
   * @param {PumpConfigurationAndControl.OperationMode} [pumpMode] - The pump mode to set. Defaults to `PumpConfigurationAndControl.OperationMode.Normal`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPumpConfigurationAndControlClusterServer(pumpMode: PumpConfigurationAndControl.OperationMode = PumpConfigurationAndControl.OperationMode.Normal): this {
    this.behaviors.require(PumpConfigurationAndControlServer.with(PumpConfigurationAndControl.Feature.ConstantSpeed), {
      minConstSpeed: null,
      maxConstSpeed: null,
      maxPressure: null,
      maxSpeed: null,
      maxFlow: null,
      effectiveOperationMode: pumpMode,
      effectiveControlMode: PumpConfigurationAndControl.ControlMode.ConstantSpeed,
      capacity: null,
      operationMode: pumpMode,
    });
    return this;
  }

  /**
   * Creates the default SmokeCOAlarm Cluster Server with features SmokeAlarm and CoAlarm.
   *
   * @param {SmokeCoAlarm.AlarmState} smokeState - The state of the smoke alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @param {SmokeCoAlarm.AlarmState} coState - The state of the CO alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultSmokeCOAlarmClusterServer(smokeState: SmokeCoAlarm.AlarmState = SmokeCoAlarm.AlarmState.Normal, coState: SmokeCoAlarm.AlarmState = SmokeCoAlarm.AlarmState.Normal): this {
    this.behaviors.require(
      MatterbridgeSmokeCoAlarmServer.with(SmokeCoAlarm.Feature.SmokeAlarm, SmokeCoAlarm.Feature.CoAlarm).enable({
        events: { smokeAlarm: true, interconnectSmokeAlarm: false, coAlarm: true, interconnectCoAlarm: false, lowBattery: true, hardwareFault: true, endOfService: true, selfTestComplete: true, alarmMuted: true, muteEnded: true, allClear: true },
      }),
      {
        smokeState,
        coState,
        expressedState: SmokeCoAlarm.ExpressedState.Normal,
        batteryAlert: SmokeCoAlarm.AlarmState.Normal,
        deviceMuted: SmokeCoAlarm.MuteState.NotMuted,
        testInProgress: false,
        hardwareFaultAlert: false,
        endOfServiceAlert: SmokeCoAlarm.EndOfService.Normal,
      },
    );
    return this;
  }

  /**
   * Creates a smoke only SmokeCOAlarm Cluster Server with features SmokeAlarm.
   *
   * @param {SmokeCoAlarm.AlarmState} smokeState - The state of the smoke alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createSmokeOnlySmokeCOAlarmClusterServer(smokeState: SmokeCoAlarm.AlarmState = SmokeCoAlarm.AlarmState.Normal): this {
    this.behaviors.require(
      MatterbridgeSmokeCoAlarmServer.with(SmokeCoAlarm.Feature.SmokeAlarm).enable({
        events: { smokeAlarm: true, interconnectSmokeAlarm: false, coAlarm: false, interconnectCoAlarm: false, lowBattery: true, hardwareFault: true, endOfService: true, selfTestComplete: true, alarmMuted: true, muteEnded: true, allClear: true },
      }),
      {
        smokeState,
        expressedState: SmokeCoAlarm.ExpressedState.Normal,
        batteryAlert: SmokeCoAlarm.AlarmState.Normal,
        deviceMuted: SmokeCoAlarm.MuteState.NotMuted,
        testInProgress: false,
        hardwareFaultAlert: false,
        endOfServiceAlert: SmokeCoAlarm.EndOfService.Normal,
      },
    );
    return this;
  }

  /**
   * Creates a co only SmokeCOAlarm Cluster Server with features CoAlarm.
   *
   * @param {SmokeCoAlarm.AlarmState} coState - The state of the CO alarm. Defaults to SmokeCoAlarm.AlarmState.Normal.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createCoOnlySmokeCOAlarmClusterServer(coState: SmokeCoAlarm.AlarmState = SmokeCoAlarm.AlarmState.Normal): this {
    this.behaviors.require(
      MatterbridgeSmokeCoAlarmServer.with(SmokeCoAlarm.Feature.CoAlarm).enable({
        events: { smokeAlarm: false, interconnectSmokeAlarm: false, coAlarm: true, interconnectCoAlarm: false, lowBattery: true, hardwareFault: true, endOfService: true, selfTestComplete: true, alarmMuted: true, muteEnded: true, allClear: true },
      }),
      {
        coState,
        expressedState: SmokeCoAlarm.ExpressedState.Normal,
        batteryAlert: SmokeCoAlarm.AlarmState.Normal,
        deviceMuted: SmokeCoAlarm.MuteState.NotMuted,
        testInProgress: false,
        hardwareFaultAlert: false,
        endOfServiceAlert: SmokeCoAlarm.EndOfService.Normal,
      },
    );
    return this;
  }

  /**
   * Creates a default momentary switch cluster server with features MomentarySwitch, MomentarySwitchRelease, MomentarySwitchLongPress and MomentarySwitchMultiPress
   * and events initialPress, longPress, shortRelease, longRelease, multiPressOngoing, multiPressComplete.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * This method adds a cluster server with default momentary switch features and configuration suitable for (AppleHome) Single Double Long automations.
   */
  createDefaultSwitchClusterServer(): this {
    this.behaviors.require(
      MatterbridgeSwitchServer.with(Switch.Feature.MomentarySwitch, Switch.Feature.MomentarySwitchRelease, Switch.Feature.MomentarySwitchLongPress, Switch.Feature.MomentarySwitchMultiPress).enable({
        events: { initialPress: true, longPress: true, shortRelease: true, longRelease: true, multiPressOngoing: true, multiPressComplete: true },
      }),
      {
        numberOfPositions: 2,
        currentPosition: 0,
        multiPressMax: 2,
      },
    );
    return this;
  }

  /**
   * Creates a default momentary switch cluster server with feature MomentarySwitch and event initialPress.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * This method adds a cluster server with default momentary switch features and configuration suitable for a Single press automations.
   * It is supported by the Home app.
   */
  createDefaultMomentarySwitchClusterServer(): this {
    this.behaviors.require(
      MatterbridgeSwitchServer.with(Switch.Feature.MomentarySwitch).enable({
        events: { initialPress: true },
      }),
      {
        numberOfPositions: 2,
        currentPosition: 0,
      },
    );
    return this;
  }

  /**
   * Creates a default latching switch cluster server with features LatchingSwitch.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * This method adds a cluster server with default latching switch features and configuration suitable for a latching switch with 2 positions.
   */
  createDefaultLatchingSwitchClusterServer(): this {
    this.behaviors.require(
      SwitchServer.with(Switch.Feature.LatchingSwitch).enable({
        events: { switchLatched: true },
      }),
      {
        numberOfPositions: 2,
        currentPosition: 0,
      },
    );
    return this;
  }

  /**
   * Triggers a switch event on the specified endpoint.
   * We usually use get from real devices something like 'single', 'double', 'long'.
   * Here we convert it to the Matter sequence of events (taken from Matter specs).
   *
   * @param {string} event - The type of event to trigger. Possible values are 'Single', 'Double', 'Long' for momentarySwitch and 'Press', 'Release' for latchingSwitch.
   * @param {AnsiLogger} log - Optional logger to log the event.
   * @returns {boolean} - A boolean indicating whether the event was successfully triggered.
   */
  async triggerSwitchEvent(event: 'Single' | 'Double' | 'Long' | 'Press' | 'Release', log?: AnsiLogger): Promise<boolean> {
    if (this.maybeNumber === undefined) {
      this.log.error(`triggerSwitchEvent ${event} error: Endpoint number not assigned on endpoint ${this.maybeId}:${this.maybeNumber}`);
      return false;
    }
    if (['Single', 'Double', 'Long'].includes(event)) {
      if (!this.hasClusterServer(Switch.Cluster.id) || (this.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).momentarySwitch === false) {
        this.log.error(`triggerSwitchEvent ${event} error: Switch cluster with MomentarySwitch not found on endpoint ${this.maybeId}:${this.maybeNumber}`);
        return false;
      }
      if (event === 'Single') {
        log?.info(`${db}Trigger endpoint ${or}${this.id}:${this.number}${db} event ${hk}Switch.SinglePress${db}`);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 1, log);
        await this.triggerEvent(Switch.Cluster.id, 'initialPress', { newPosition: 1 }, log);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
        if (featuresFor(this, 'Switch').momentarySwitchRelease) {
          await this.triggerEvent(Switch.Cluster.id, 'shortRelease', { previousPosition: 1 }, log);
          await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
          await this.triggerEvent(Switch.Cluster.id, 'multiPressComplete', { previousPosition: 1, totalNumberOfPressesCounted: 1 }, log);
        }
      }
      if (event === 'Double') {
        log?.info(`${db}Trigger endpoint ${or}${this.id}:${this.number}${db} event ${hk}Switch.DoublePress${db}`);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 1, log);
        await this.triggerEvent(Switch.Cluster.id, 'initialPress', { newPosition: 1 }, log);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
        await this.triggerEvent(Switch.Cluster.id, 'shortRelease', { previousPosition: 1 }, log);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 1, log);
        await this.triggerEvent(Switch.Cluster.id, 'initialPress', { newPosition: 1 }, log);
        await this.triggerEvent(Switch.Cluster.id, 'multiPressOngoing', { newPosition: 1, currentNumberOfPressesCounted: 2 }, log);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
        await this.triggerEvent(Switch.Cluster.id, 'shortRelease', { previousPosition: 1 }, log);
        await this.triggerEvent(Switch.Cluster.id, 'multiPressComplete', { previousPosition: 1, totalNumberOfPressesCounted: 2 }, log);
      }
      if (event === 'Long') {
        log?.info(`${db}Trigger endpoint ${or}${this.id}:${this.number}${db} event ${hk}Switch.LongPress${db}`);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 1, log);
        await this.triggerEvent(Switch.Cluster.id, 'initialPress', { newPosition: 1 }, log);
        await this.triggerEvent(Switch.Cluster.id, 'longPress', { newPosition: 1 }, log);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
        await this.triggerEvent(Switch.Cluster.id, 'longRelease', { previousPosition: 1 }, log);
      }
    }
    if (['Press', 'Release'].includes(event)) {
      if (!this.hasClusterServer(Switch.Cluster.id) || (this.getAttribute(Switch.Cluster.id, 'featureMap') as Record<string, boolean>).latchingSwitch === false) {
        this.log.error(`triggerSwitchEvent ${event} error: Switch cluster with LatchingSwitch not found on endpoint ${this.maybeId}:${this.maybeNumber}`);
        return false;
      }
      if (event === 'Press') {
        log?.info(`${db}Trigger endpoint ${or}${this.id}:${this.number}${db} event ${hk}Switch.Press${db}`);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 1, log);
        await this.triggerEvent(Switch.Cluster.id, 'switchLatched', { newPosition: 1 }, log);
      }
      if (event === 'Release') {
        log?.info(`${db}Trigger endpoint ${or}${this.id}:${this.number}${db} event ${hk}Switch.Release${db}`);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
        await this.triggerEvent(Switch.Cluster.id, 'switchLatched', { newPosition: 0 }, log);
      }
    }
    return true;
  }

  /**
   * Creates a default OperationalState Cluster Server.
   *
   * @param {OperationalState.OperationalStateEnum} operationalState - The initial operational state id.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * This method adds a cluster server with a default operational state configuration:
   * - { operationalStateId: OperationalState.OperationalStateEnum.Stopped, operationalStateLabel: 'Stopped' },
   * - { operationalStateId: OperationalState.OperationalStateEnum.Running, operationalStateLabel: 'Running' },
   * - { operationalStateId: OperationalState.OperationalStateEnum.Paused, operationalStateLabel: 'Paused' },
   * - { operationalStateId: OperationalState.OperationalStateEnum.Error, operationalStateLabel: 'Error' },
   */
  createDefaultOperationalStateClusterServer(operationalState: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Stopped): this {
    this.behaviors.require(MatterbridgeOperationalStateServer, getDefaultOperationalStateClusterServer(operationalState));
    return this;
  }

  /**
   * Creates a default boolean state cluster server.
   * The stateChange event is enabled.
   *
   * @param {boolean} contact - The state of the cluster. Defaults to true (true = contact).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * Water Leak Detector: true = leak, false = no leak
   * Water Freeze Detector: true = freeze, false = no freeze
   * Rain Sensor: true = rain, false = no rain
   * Contact Sensor: true = closed or contact, false = open or no contact
   */
  createDefaultBooleanStateClusterServer(contact?: boolean): this {
    this.behaviors.require(
      BooleanStateServer.enable({
        events: { stateChange: true },
      }),
      {
        stateValue: contact ?? true,
      },
    );
    return this;
  }

  /**
   * Creates a default boolean state configuration cluster server to be used with the waterFreezeDetector, waterLeakDetector, and rainSensor device types.
   *
   * Features:
   * - Visual
   * - Audible
   * - SensitivityLevel
   *
   * @remarks Supports the enableDisableAlarm command.
   *
   * @param {boolean} [sensorFault] - Optional boolean value indicating the sensor fault state. Defaults to `false` if not provided.
   * @param {number} [currentSensitivityLevel] - The current sensitivity level. Defaults to `0` if not provided.
   * @param {number} [supportedSensitivityLevels] - The number of supported sensitivity levels. Defaults to `2` if not provided (min 2, max 10).
   * @param {number} [defaultSensitivityLevel] - The default sensitivity level. Defaults to `0` if not provided.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultBooleanStateConfigurationClusterServer(sensorFault: boolean = false, currentSensitivityLevel: number = 0, supportedSensitivityLevels: number = 2, defaultSensitivityLevel: number = 0): this {
    this.behaviors.require(
      MatterbridgeBooleanStateConfigurationServer.with(BooleanStateConfiguration.Feature.Visual, BooleanStateConfiguration.Feature.Audible, BooleanStateConfiguration.Feature.SensitivityLevel).enable({
        events: { alarmsStateChanged: true, sensorFault: true },
      }),
      {
        currentSensitivityLevel,
        supportedSensitivityLevels,
        defaultSensitivityLevel,
        alarmsActive: { visual: false, audible: false },
        alarmsEnabled: { visual: true, audible: true },
        alarmsSupported: { visual: true, audible: true },
        sensorFault: { generalFault: sensorFault },
      },
    );
    return this;
  }

  /**
   * Creates a default Device Energy Management Cluster Server with feature PowerForecastReporting and with the specified ESA type, ESA canGenerate, ESA state, and power limits.
   *
   * @param {DeviceEnergyManagement.EsaType} [esaType] - The ESA type. Defaults to `DeviceEnergyManagement.EsaType.Other`.
   * @param {boolean} [esaCanGenerate] - Indicates if the ESA can generate energy. Defaults to `false`.
   * @param {DeviceEnergyManagement.EsaState} [esaState] - The ESA state. Defaults to `DeviceEnergyManagement.EsaState.Online`.
   * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - The forecast attribute is set to null, indicating that there is no forecast currently available.
   * - The ESA type and canGenerate attributes are fixed and cannot be changed after creation.
   * - The ESA state is set to Online by default.
   * - The absolute minimum and maximum power attributes are set to 0 by default.
   * - For example, a battery storage inverter that can charge its battery at a maximum power of 2000W and can
   * discharge the battery at a maximum power of 3000W, would have a absMinPower: -3000W, absMaxPower: 2000W.
   */
  createDefaultDeviceEnergyManagementClusterServer(
    esaType: DeviceEnergyManagement.EsaType = DeviceEnergyManagement.EsaType.Other,
    esaCanGenerate: boolean = false,
    esaState: DeviceEnergyManagement.EsaState = DeviceEnergyManagement.EsaState.Online,
    absMinPower: number = 0,
    absMaxPower: number = 0,
  ): this {
    this.behaviors.require(MatterbridgeDeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
      forecast: null, // A null value indicates that there is no forecast currently available
      powerAdjustmentCapability: null, // A null value indicates that no power adjustment is currently possible, and nor is any adjustment currently active
      esaType, // Fixed attribute
      esaCanGenerate, // Fixed attribute
      esaState,
      absMinPower,
      absMaxPower,
    });
    return this;
  }

  /**
   * Creates a default EnergyManagementMode Cluster Server.
   *
   * @param {number} [currentMode] - The current mode of the EnergyManagementMode cluster. Defaults to mode 1 (DeviceEnergyManagementMode.ModeTag.NoOptimization).
   * @param {EnergyManagementMode.ModeOption[]} [supportedModes] - The supported modes for the DeviceEnergyManagementMode cluster. The attribute is fixed and defaults to a predefined set of cluster modes.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * A few examples of Device Energy Management modes and their mode tags are provided below.
   *  - For the "No Energy Management (Forecast reporting only)" mode, tags: 0x4000 (NoOptimization).
   *  - For the "Device Energy Management" mode, tags: 0x4001 (DeviceOptimization).
   *  - For the "Home Energy Management" mode, tags: 0x4001 (DeviceOptimization), 0x4002 (LocalOptimization).
   *  - For the "Grid Energy Management" mode, tags: 0x4003 (GridOptimization).
   *  - For the "Full Energy Management" mode, tags: 0x4001 (DeviceOptimization), 0x4002 (LocalOptimization), 0x4003 (GridOptimization).
   */
  createDefaultDeviceEnergyManagementModeClusterServer(currentMode?: number, supportedModes?: DeviceEnergyManagementMode.ModeOption[]): this {
    this.behaviors.require(MatterbridgeDeviceEnergyManagementModeServer, {
      supportedModes: supportedModes ?? [
        { label: 'No Energy Management (Forecast reporting only)', mode: 1, modeTags: [{ value: DeviceEnergyManagementMode.ModeTag.NoOptimization }] },
        {
          label: 'Device Energy Management',
          mode: 2,
          modeTags: [{ value: DeviceEnergyManagementMode.ModeTag.DeviceOptimization }, { value: DeviceEnergyManagementMode.ModeTag.LocalOptimization }],
        },
        {
          label: 'Home Energy Management',
          mode: 3,
          modeTags: [{ value: DeviceEnergyManagementMode.ModeTag.GridOptimization }, { value: DeviceEnergyManagementMode.ModeTag.LocalOptimization }],
        },
        { label: 'Grid Energy Managemen', mode: 4, modeTags: [{ value: DeviceEnergyManagementMode.ModeTag.GridOptimization }] },
        {
          label: 'Full Energy Management',
          mode: 5,
          modeTags: [{ value: DeviceEnergyManagementMode.ModeTag.DeviceOptimization }, { value: DeviceEnergyManagementMode.ModeTag.LocalOptimization }, { value: DeviceEnergyManagementMode.ModeTag.GridOptimization }],
        },
      ], // Fixed attribute
      currentMode: currentMode ?? 1,
    });
    return this;
  }

  /**
   * Creates a default Power Topology Cluster Server with feature TreeTopology (the endpoint provides or consumes power to/from itself and its child endpoints). Only needed for an electricalSensor device type.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPowerTopologyClusterServer(): this {
    this.behaviors.require(PowerTopologyServer.with(PowerTopology.Feature.TreeTopology));
    return this;
  }

  /**
   * Creates a default Electrical Energy Measurement Cluster Server with features ImportedEnergy, ExportedEnergy, and CumulativeEnergy.
   *
   * @param {number} energyImported - The total consumption value in mW/h.
   * @param {number} energyExported - The total production value in mW/h.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultElectricalEnergyMeasurementClusterServer(energyImported: number | bigint | null = null, energyExported: number | bigint | null = null): this {
    this.behaviors.require(ElectricalEnergyMeasurementServer.with(ElectricalEnergyMeasurement.Feature.ImportedEnergy, ElectricalEnergyMeasurement.Feature.ExportedEnergy, ElectricalEnergyMeasurement.Feature.CumulativeEnergy), {
      accuracy: {
        measurementType: MeasurementType.ElectricalEnergy,
        measured: true,
        minMeasuredValue: Number.MIN_SAFE_INTEGER,
        maxMeasuredValue: Number.MAX_SAFE_INTEGER,
        accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
      },
      cumulativeEnergyReset: null,
      cumulativeEnergyImported: energyImported !== null && energyImported >= 0 ? { energy: energyImported } : null,
      cumulativeEnergyExported: energyExported !== null && energyExported >= 0 ? { energy: energyExported } : null,
    });
    return this;
  }

  /**
   * Creates a default Electrical Power Measurement Cluster Server with features AlternatingCurrent.
   *
   * @param {number} voltage - The voltage value in millivolts.
   * @param {number} current - The current value in milliamperes.
   * @param {number} power - The power value in milliwatts.
   * @param {number} frequency - The frequency value in millihertz.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultElectricalPowerMeasurementClusterServer(voltage: number | bigint | null = null, current: number | bigint | null = null, power: number | bigint | null = null, frequency: number | bigint | null = null): this {
    this.behaviors.require(ElectricalPowerMeasurementServer.with(ElectricalPowerMeasurement.Feature.AlternatingCurrent), {
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
    });
    return this;
  }

  /**
   * Creates a default TemperatureMeasurement cluster server.
   *
   * @param {number | null} measuredValue - The measured value of the temperature x 100.
   * @param {number | null} minMeasuredValue - The minimum measured value of the temperature x 100.
   * @param {number | null} maxMeasuredValue - The maximum measured value of the temperature x 100.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultTemperatureMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null): this {
    this.behaviors.require(TemperatureMeasurementServer, getDefaultTemperatureMeasurementClusterServer(measuredValue, minMeasuredValue, maxMeasuredValue));
    return this;
  }

  /**
   * Creates a default RelativeHumidityMeasurement cluster server.
   *
   * @param {number | null} measuredValue - The measured value of the relative humidity x 100.
   * @param {number | null} minMeasuredValue - The minimum measured value of the relative humidity x 100.
   * @param {number | null} maxMeasuredValue - The maximum measured value of the relative humidity x 100.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null): this {
    this.behaviors.require(RelativeHumidityMeasurementServer, getDefaultRelativeHumidityMeasurementClusterServer(measuredValue, minMeasuredValue, maxMeasuredValue));
    return this;
  }

  /**
   * Creates a default PressureMeasurement cluster server.
   *
   * @param {number | null} measuredValue - The measured value for the pressure in kPa x 10.
   * @param {number | null} minMeasuredValue - The minimum measured value for the pressure in kPa x 10.
   * @param {number | null} maxMeasuredValue - The maximum measured value for the pressure in kPa x 10.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * - MeasuredValue = 10 x Pressure in kPa
   * - MeasuredValue = 1 x Pressure in hPa
   * - MeasuredValue = 33.8639 x Pressure in inHg
   *
   * Conversion:
   * - 1 kPa = 10 hPa
   * - 1 inHg = 33.8639 hPa
   */
  createDefaultPressureMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null): this {
    this.behaviors.require(PressureMeasurementServer, getDefaultPressureMeasurementClusterServer(measuredValue, minMeasuredValue, maxMeasuredValue));
    return this;
  }

  /**
   * Creates a default IlluminanceMeasurement cluster server.
   *
   * @param {number | null} measuredValue - The measured value of illuminance.
   * @param {number | null} minMeasuredValue - The minimum measured value of illuminance.
   * @param {number | null} maxMeasuredValue - The maximum measured value of illuminance.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   *
   * The default value for the illuminance measurement is null.
   *
   * This attribute SHALL indicate the illuminance in Lux (symbol lx) as follows:
   * •  MeasuredValue = 10,000 x log10(illuminance) + 1,
   *    where 1 lx <= illuminance <= 3.576 Mlx, corresponding to a MeasuredValue in the range 1 to 0xFFFE.
   * • 0 indicates a value of illuminance that is too low to be measured
   * • null indicates that the illuminance measurement is invalid.
   *
   * - Lux to matter = Math.round(Math.max(Math.min(10000 * Math.log10(lux), 0xfffe), 0))
   * - Matter to Lux = Math.round(Math.max(Math.pow(10, value / 10000), 0))
   */
  createDefaultIlluminanceMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null): this {
    this.behaviors.require(IlluminanceMeasurementServer, getDefaultIlluminanceMeasurementClusterServer(measuredValue, minMeasuredValue, maxMeasuredValue));
    return this;
  }

  /**
   * Creates a default FlowMeasurement cluster server.
   *
   * @param {number | null} measuredValue - The measured value of the flow in 10 x m3/h.
   * @param {number | null} minMeasuredValue - The minimum measured value of the flow in 10 x m3/h.
   * @param {number | null} maxMeasuredValue - The maximum measured value of the flow in 10 x m3/h.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultFlowMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null): this {
    this.behaviors.require(FlowMeasurementServer, getDefaultFlowMeasurementClusterServer(measuredValue, minMeasuredValue, maxMeasuredValue));
    return this;
  }

  /**
   * Creates a default OccupancySensing cluster server with feature PassiveInfrared.
   *
   * @param {boolean} occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
   * @param {number} holdTime - The hold time in seconds. Default is 30.
   * @param {number} holdTimeMin - The minimum hold time in seconds. Default is 1.
   * @param {number} holdTimeMax - The maximum hold time in seconds. Default is 300.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks The default value for the occupancy sensor type is PIR.
   */
  createDefaultOccupancySensingClusterServer(occupied: boolean = false, holdTime: number = 30, holdTimeMin: number = 1, holdTimeMax: number = 300): this {
    this.behaviors.require(OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared), getDefaultOccupancySensingClusterServer(occupied, holdTime, holdTimeMin, holdTimeMax));
    return this;
  }

  /**
   * Creates a default AirQuality cluster server.
   *
   * @param {AirQuality.AirQualityEnum} airQuality The air quality level. Defaults to `AirQuality.AirQualityType.Unknown`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultAirQualityClusterServer(airQuality: AirQuality.AirQualityEnum = AirQuality.AirQualityEnum.Unknown): this {
    this.behaviors.require(AirQualityServer.with(AirQuality.Feature.Fair, AirQuality.Feature.Moderate, AirQuality.Feature.VeryPoor, AirQuality.Feature.ExtremelyPoor), {
      airQuality,
    });
    return this;
  }

  /**
   * Creates a default TotalVolatileOrganicCompoundsConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @param {number} [uncertainty] - The uncertainty value (optional).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultTvocMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
    uncertainty?: number,
  ): this {
    this.behaviors.require(TotalVolatileOrganicCompoundsConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Creates a default TotalVolatileOrganicCompoundsConcentrationMeasurement cluster server with feature LevelIndication, MediumLevel and CriticalLevel.
   *
   * @param {ConcentrationMeasurement.LevelValue} levelValue - The level value of the measurement (default to ConcentrationMeasurement.LevelValue.Unknown).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The measurement medium (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementMedium attribute is fixed and cannot be changed after creation.
   */
  createLevelTvocMeasurementClusterServer(
    levelValue: ConcentrationMeasurement.LevelValue = ConcentrationMeasurement.LevelValue.Unknown,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(TotalVolatileOrganicCompoundsConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.LevelIndication, ConcentrationMeasurement.Feature.MediumLevel, ConcentrationMeasurement.Feature.CriticalLevel), {
      levelValue,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default CarbonMonoxideConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultCarbonMonoxideConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(CarbonMonoxideConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default CarbonDioxideConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultCarbonDioxideConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(CarbonDioxideConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default FormaldehydeConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultFormaldehydeConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(FormaldehydeConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default Pm1ConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultPm1ConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(Pm1ConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default Pm25ConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultPm25ConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(Pm25ConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default Pm10ConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultPm10ConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(Pm10ConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default OzoneConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ugm3).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultOzoneConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(OzoneConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default RadonConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ppm).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultRadonConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(RadonConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }

  /**
   * Create a default NitrogenDioxideConcentrationMeasurement cluster server with feature NumericMeasurement.
   *
   * @param {number | null} measuredValue - The measured value of the concentration.
   * @param {ConcentrationMeasurement.MeasurementUnit} measurementUnit - The unit of measurement (default to ConcentrationMeasurement.MeasurementUnit.Ugm3).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The unit of measurement (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * The measurementUnit and the measurementMedium attributes are fixed and cannot be changed after creation.
   */
  createDefaultNitrogenDioxideConcentrationMeasurementClusterServer(
    measuredValue: number | null = null,
    measurementUnit: ConcentrationMeasurement.MeasurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3,
    measurementMedium: ConcentrationMeasurement.MeasurementMedium = ConcentrationMeasurement.MeasurementMedium.Air,
  ): this {
    this.behaviors.require(NitrogenDioxideConcentrationMeasurementServer.with(ConcentrationMeasurement.Feature.NumericMeasurement), {
      measuredValue,
      minMeasuredValue: null,
      maxMeasuredValue: null,
      uncertainty: 0,
      measurementUnit,
      measurementMedium,
    });
    return this;
  }
}
