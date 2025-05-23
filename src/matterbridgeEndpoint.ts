/**
 * This file contains the class MatterbridgeEndpoint that extends the Endpoint class from the Matter.js library.
 *
 * @file matterbridgeEndpoint.ts
 * @author Luca Liguori
 * @date 2024-10-01
 * @version 2.0.0
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

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, LogLevel, TimestampFormat, YELLOW, db, debugStringify, er, hk, or, zb } from './logger/export.js';

// Matterbridge
import { bridgedNode, DeviceTypeDefinition, MatterbridgeEndpointOptions } from './matterbridgeDeviceTypes.js';
import { isValidNumber, isValidObject, isValidString } from './utils/export.js';
import {
  MatterbridgeServer,
  MatterbridgeServerDevice,
  MatterbridgeIdentifyServer,
  MatterbridgeOnOffServer,
  MatterbridgeLevelControlServer,
  MatterbridgeColorControlServer,
  MatterbridgeWindowCoveringServer,
  MatterbridgeThermostatServer,
  MatterbridgeFanControlServer,
  MatterbridgeDoorLockServer,
  MatterbridgeModeSelectServer,
  MatterbridgeValveConfigurationAndControlServer,
  MatterbridgeSmokeCoAlarmServer,
  MatterbridgeBooleanStateConfigurationServer,
  MatterbridgeSwitchServer,
  MatterbridgeOperationalStateServer,
} from './matterbridgeBehaviors.js';
import {
  addClusterServers,
  addFixedLabel,
  addOptionalClusterServers,
  addRequiredClusterServers,
  addUserLabel,
  capitalizeFirstLetter,
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
} from './matterbridgeEndpointHelpers.js';

// @matter
import { ActionContext, AtLeastOne, Behavior, ClusterId, Endpoint, EndpointNumber, EndpointType, HandlerFunction, Lifecycle, MutableEndpoint, NamedHandler, SupportedBehaviors, UINT16_MAX, UINT32_MAX, VendorId } from '@matter/main';
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
import { HepaFilterMonitoringServer } from '@matter/main/behaviors/hepa-filter-monitoring';
import { ActivatedCarbonFilterMonitoringServer } from '@matter/main/behaviors/activated-carbon-filter-monitoring';
import { ThermostatUserInterfaceConfigurationServer } from '@matter/main/behaviors/thermostat-user-interface-configuration';

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
  moveToSaturation: HandlerFunction;
  moveSaturation: HandlerFunction;
  stepSaturation: HandlerFunction;
  moveToHueAndSaturation: HandlerFunction;
  moveToColorTemperature: HandlerFunction;

  // Window Covering
  upOrOpen: HandlerFunction;
  downOrClose: HandlerFunction;
  stopMotion: HandlerFunction;
  goToLiftPercentage: HandlerFunction;

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

export class MatterbridgeEndpoint extends Endpoint {
  static bridgeMode = '';
  static logLevel = LogLevel.INFO;

  log: AnsiLogger;
  plugin: string | undefined = undefined;
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

  // The first device type of the endpoint
  name: string | undefined = undefined;
  deviceType: number;

  uniqueStorageKey: string | undefined = undefined;
  tagList?: Semtag[] = undefined;

  // Maps matter deviceTypes
  readonly deviceTypes = new Map<number, DeviceTypeDefinition>();

  // Command handler
  readonly commandHandler = new NamedHandler<MatterbridgeEndpointCommands>();

  /**
   * Represents a MatterbridgeEndpoint.
   * @constructor
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the endpoint.
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - Debug flag.
   */
  constructor(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug = false) {
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
      behaviors: options.tagList ? SupportedBehaviors(DescriptorServer.with(Descriptor.Feature.TagList)) : {},
    };
    const endpointV8 = MutableEndpoint(deviceTypeDefinitionV8);

    // Check if the uniqueStorageKey is valid
    if (options.uniqueStorageKey && checkNotLatinCharacters(options.uniqueStorageKey)) {
      options.uniqueStorageKey = generateUniqueId(options.uniqueStorageKey);
    }

    // Convert the options to an Endpoint.Options
    const optionsV8 = {
      id: options.uniqueStorageKey?.replace(/[ .]/g, ''),
      number: options.endpointId,
      descriptor: options.tagList ? { tagList: options.tagList, deviceTypeList } : { deviceTypeList },
    } as { id?: string; number?: EndpointNumber; descriptor?: Record<string, object> };
    super(endpointV8, optionsV8);

    this.uniqueStorageKey = options.uniqueStorageKey;
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
      `${YELLOW}new${db} MatterbridgeEndpoint: ${zb}${'0x' + firstDefinition.code.toString(16).padStart(4, '0')}${db}-${zb}${firstDefinition.name}${db} ` +
        `id: ${CYAN}${options.uniqueStorageKey}${db} number: ${CYAN}${options.endpointId}${db} taglist: ${CYAN}${options.tagList ? debugStringify(options.tagList) : 'undefined'}${db}`,
    );

    // Add MatterbridgeBehavior with MatterbridgeBehaviorDevice
    this.behaviors.require(MatterbridgeServer, { deviceCommand: new MatterbridgeServerDevice(this.log, this.commandHandler, undefined) });
  }

  /**
   * Loads an instance of the MatterbridgeEndpoint class.
   *
   * @param {DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>} definition - The DeviceTypeDefinition(s) of the device.
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - Debug flag.
   * @returns {Promise<MatterbridgeEndpoint>} MatterbridgeEndpoint instance.
   */
  static async loadInstance(definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug = false) {
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
  getClusterServerOptions(cluster: Behavior.Type | ClusterType | ClusterId | string) {
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
   */
  async updateAttribute(cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, value: boolean | number | bigint | string | object | null, log?: AnsiLogger): Promise<boolean> {
    return await updateAttribute(this, cluster, attribute, value, log);
  }

  /**
   * Subscribes to the provided attribute on a cluster.
   *
   * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to subscribe the attribute to.
   * @param {string} attribute - The name of the attribute to subscribe to.
   * @param {(newValue: any, oldValue: any, context?: any) => void} listener - A callback function that will be called when the attribute value changes.
   * @param {AnsiLogger} [log] - Optional logger for logging errors and information.
   * @returns {Promise<boolean>} - A boolean indicating whether the subscription was successful.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async subscribeAttribute(cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, listener: (newValue: any, oldValue: any, context: ActionContext) => void, log?: AnsiLogger): Promise<boolean> {
    return await subscribeAttribute(this, cluster, attribute, listener, log);
  }

  /**
   * Triggers an event on the specified cluster.
   *
   * @param {ClusterId} clusterId - The ID of the cluster.
   * @param {string} event - The name of the event to trigger.
   * @param {Record<string, boolean | number | bigint | string | object | undefined | null>} payload - The payload to pass to the event.
   * @param {AnsiLogger} [log] - Optional logger for logging information.
   * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the event was successfully triggered.
   */
  async triggerEvent(clusterId: ClusterId, event: string, payload: Record<string, boolean | number | bigint | string | object | undefined | null>, log?: AnsiLogger): Promise<boolean> {
    const clusterName = lowercaseFirstLetter(getClusterNameById(clusterId));

    if (this.construction.status !== Lifecycle.Status.Active) {
      this.log.error(`triggerEvent ${hk}${clusterName}.${event}${er} error: Endpoint ${or}${this.maybeId}${er}:${or}${this.maybeNumber}${er} is in the ${BLUE}${this.construction.status}${er} state`);
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = this.events as Record<string, Record<string, any>>;
    if (!(clusterName in events) || !(event in events[clusterName])) {
      this.log.error(`triggerEvent ${hk}${event}${er} error: Cluster ${'0x' + clusterId.toString(16).padStart(4, '0')}:${clusterName} not found on endpoint ${or}${this.id}${er}:${or}${this.number}${er}`);
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await this.act((agent) => agent[clusterName].events[event].emit(payload, agent.context));
    log?.info(`${db}Trigger event ${hk}${capitalizeFirstLetter(clusterName)}${db}.${hk}${event}${db} with ${debugStringify(payload)}${db} on endpoint ${or}${this.id}${db}:${or}${this.number}${db} `);
    return true;
  }

  /**
   * Adds cluster servers from the provided server list.
   *
   * @param {ClusterId[]} serverList - The list of cluster IDs to add.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  addClusterServers(serverList: ClusterId[]) {
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
  async addFixedLabel(label: string, value: string) {
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
  async addUserLabel(label: string, value: string) {
    await addUserLabel(this, label, value);
    return this;
  }

  /**
   * Adds a command handler for the specified command.
   *
   * @param {keyof MatterbridgeEndpointCommands} command - The command to add the handler for.
   * @param {HandlerFunction} handler - The handler function to execute when the command is received.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  addCommandHandler(command: keyof MatterbridgeEndpointCommands, handler: HandlerFunction): this {
    this.commandHandler.addHandler(command, handler);
    return this;
  }

  /**
   * Execute the command handler for the specified command. Used ONLY in Jest tests.
   *
   * @param {keyof MatterbridgeEndpointCommands} command - The command to execute.
   * @param {Record<string, boolean | number | bigint | string | object | null>} [request] - The optional request to pass to the handler function.
   *
   * @deprecated Used ONLY in Jest tests.
   */
  async executeCommandHandler(command: keyof MatterbridgeEndpointCommands, request?: Record<string, boolean | number | bigint | string | object | null>) {
    await this.commandHandler.executeHandler(command, { request });
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
  getAllClusterServers() {
    return Object.values(this.behaviors.supported);
  }

  /**
   * Retrieves the names of all cluster servers.
   *
   * @returns {string[]} An array of all cluster server names.
   */
  getAllClusterServerNames() {
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
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the endpoint.
   * @param {boolean} [debug=false] - Whether to enable debug logging.
   * @returns {MatterbridgeEndpoint} - The child endpoint that was found or added.
   *
   * @example
   * ```typescript
   * const endpoint = device.addChildDeviceType('Temperature', [temperatureSensor], { tagList: [{ mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null }] }, true);
   * ```
   */
  addChildDeviceType(endpointName: string, definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, options: MatterbridgeEndpointOptions = {}, debug = false): MatterbridgeEndpoint {
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
   * @param {ClusterId[]} [serverList=[]] - The list of cluster IDs to include.
   * @param {MatterbridgeEndpointOptions} [options={}] - The options for the device.
   * @param {boolean} [debug=false] - Whether to enable debug logging.
   * @returns {MatterbridgeEndpoint} - The child endpoint that was found or added.
   *
   * @example
   * ```typescript
   * const endpoint = device.addChildDeviceTypeWithClusterServer('Temperature', [temperatureSensor], [], { tagList: [{ mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null }] }, true);
   * ```
   */
  addChildDeviceTypeWithClusterServer(endpointName: string, definition: DeviceTypeDefinition | AtLeastOne<DeviceTypeDefinition>, serverList: ClusterId[] = [], options: MatterbridgeEndpointOptions = {}, debug = false): MatterbridgeEndpoint {
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
   * @param pluginName - The name of the plugin.
   * @returns The serialized Matterbridge device object.
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
   * @returns The deserialized MatterbridgeDevice.
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
   * @param wiredCurrentType - The type of wired current (default: PowerSource.WiredCurrentType.Ac)
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) {
    this.behaviors.require(PowerSourceServer.with(PowerSource.Feature.Wired), {
      wiredCurrentType,
      description: wiredCurrentType === PowerSource.WiredCurrentType.Ac ? 'AC Power' : 'DC Power',
      status: PowerSource.PowerSourceStatus.Active,
      order: 0,
      endpointList: [],
    });
    return this;
  }

  /**
   * Creates a default power source replaceable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   * @param batReplacementDescription - The battery replacement description (default: 'Battery type').
   * @param batQuantity - The battery quantity (default: 1).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPowerSourceReplaceableBatteryClusterServer(batPercentRemaining = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage = 1500, batReplacementDescription = 'Battery type', batQuantity = 1) {
    this.behaviors.require(PowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable), {
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
    });
    return this;
  }

  /**
   * Creates a default power source rechargeable battery cluster server.
   *
   * @param batPercentRemaining - The remaining battery percentage (default: 100).
   * @param batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
   * @param batVoltage - The battery voltage (default: 1500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPowerSourceRechargeableBatteryClusterServer(batPercentRemaining = 100, batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok, batVoltage = 1500) {
    this.behaviors.require(PowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable), {
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
    });
    return this;
  }

  /**
   * Setup the default Basic Information Cluster Server attributes for the server node.
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
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
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
    if (MatterbridgeEndpoint.bridgeMode === 'bridge') {
      const options = this.getClusterServerOptions(Descriptor.Cluster.id);
      if (options) {
        const deviceTypeList = options.deviceTypeList as { deviceType: number; revision: number }[];
        deviceTypeList.push({ deviceType: bridgedNode.code, revision: bridgedNode.revision });
      }
      this.createDefaultBridgedDeviceBasicInformationClusterServer(deviceName, serialNumber, vendorId, vendorName, productName, softwareVersion, softwareVersionString, hardwareVersion, hardwareVersionString);
    }
    return this;
  }

  /**
   * Creates a default BridgedDeviceBasicInformationClusterServer for the aggregator endpoints.
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
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks The bridgedNode device type must be added to the deviceTypeList of the Descriptor cluster.
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
        vendorId: vendorId !== undefined ? VendorId(vendorId) : undefined, // 4874
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
   * @param {number} [identifyTime=0] - The time to identify the server. Defaults to 0.
   * @param {Identify.IdentifyType} [identifyType=Identify.IdentifyType.None] - The type of identification. Defaults to Identify.IdentifyType.None.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultIdentifyClusterServer(identifyTime = 0, identifyType = Identify.IdentifyType.None) {
    this.behaviors.require(MatterbridgeIdentifyServer, {
      identifyTime,
      identifyType,
    });
    return this;
  }

  /**
   * Creates a default groups cluster server.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultGroupsClusterServer() {
    this.behaviors.require(GroupsServer);
    return this;
  }

  /**
   * Creates a default scenes management cluster server.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks The scenes management cluster server is still provisional and so not yet implemented.
   */
  createDefaultScenesClusterServer() {
    this.behaviors.require(ScenesManagementServer);
    return this;
  }

  /**
   * Creates a default OnOff cluster server for light devices with feature Lighting.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @param {boolean} [globalSceneControl=false] - The global scene control state.
   * @param {number} [onTime=0] - The on time value.
   * @param {number} [offWaitTime=0] - The off wait time value.
   * @param {OnOff.StartUpOnOff | null} [startUpOnOff=null] - The start-up OnOff state. Null means previous state.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultOnOffClusterServer(onOff = false, globalSceneControl = false, onTime = 0, offWaitTime = 0, startUpOnOff: OnOff.StartUpOnOff | null = null) {
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
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createOnOffClusterServer(onOff = false) {
    this.behaviors.require(MatterbridgeOnOffServer, {
      onOff,
    });
    return this;
  }

  /**
   * Creates a DeadFront OnOff cluster server with feature DeadFrontBehavior.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDeadFrontOnOffClusterServer(onOff = false) {
    this.behaviors.require(MatterbridgeOnOffServer.with(OnOff.Feature.DeadFrontBehavior), {
      onOff,
    });
    return this;
  }

  /**
   * Creates an OffOnly OnOff cluster server with feature OffOnly.
   *
   * @param {boolean} [onOff=false] - The initial state of the OnOff cluster.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createOffOnlyOnOffClusterServer(onOff = false) {
    this.behaviors.require(MatterbridgeOnOffServer.with(OnOff.Feature.OffOnly), {
      onOff,
    });
    return this;
  }

  /**
   * Creates a default level control cluster server for light devices with feature OnOff and Lighting.
   *
   * @param {number} [currentLevel=254] - The current level (default: 254).
   * @param {number} [minLevel=1] - The minimum level (default: 1).
   * @param {number} [maxLevel=254] - The maximum level (default: 254).
   * @param {number | null} [onLevel=null] - The on level (default: null).
   * @param {number | null} [startUpCurrentLevel=null] - The startUp on level (default: null).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLevelControlClusterServer(currentLevel = 254, minLevel = 1, maxLevel = 254, onLevel: number | null = null, startUpCurrentLevel: number | null = null) {
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
   * @param {number} [currentLevel=254] - The current level (default: 254).
   * @param {number | null} [onLevel=null] - The on level (default: null).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createLevelControlClusterServer(currentLevel = 254, onLevel: number | null = null) {
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
   * @param currentX - The current X value (range 0-65279).
   * @param currentY - The current Y value (range 0-65279).
   * @param currentHue - The current hue value (range: 0-254).
   * @param currentSaturation - The current saturation value (range: 0-254).
   * @param colorTemperatureMireds - The color temperature in mireds (default range 147-500).
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds (default range 147).
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds (default range 500).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultColorControlClusterServer(currentX = 0, currentY = 0, currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
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
      remainingTime: 0,
      startUpColorTemperatureMireds: null,
    });
    return this;
  }

  /**
   * Creates a Xy color control cluster server with feature Xy and ColorTemperature.
   *
   * @param currentX - The current X value.
   * @param currentY - The current Y value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * From zigbee to matter = Math.max(Math.min(Math.round(x * 65536), 65279), 0)
   */
  createXyColorControlClusterServer(currentX = 0, currentY = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
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
   * @param currentHue - The current hue value.
   * @param currentSaturation - The current saturation value.
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createHsColorControlClusterServer(currentHue = 0, currentSaturation = 0, colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
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
   *
   * @param colorTemperatureMireds - The color temperature in mireds.
   * @param colorTempPhysicalMinMireds - The physical minimum color temperature in mireds.
   * @param colorTempPhysicalMaxMireds - The physical maximum color temperature in mireds.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createCtColorControlClusterServer(colorTemperatureMireds = 500, colorTempPhysicalMinMireds = 147, colorTempPhysicalMaxMireds = 500) {
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
      remainingTime: 0,
      startUpColorTemperatureMireds: null,
    });
    return this;
  }

  /**
   * Configures the color control mode for the device.
   *
   * @param {ColorControl.ColorMode} colorMode - The color mode to set.
   */
  async configureColorControlMode(colorMode: ColorControl.ColorMode) {
    if (isValidNumber(colorMode, ColorControl.ColorMode.CurrentHueAndCurrentSaturation, ColorControl.ColorMode.ColorTemperatureMireds)) {
      await this.setAttribute(ColorControl.Cluster.id, 'colorMode', colorMode, this.log);
      await this.setAttribute(ColorControl.Cluster.id, 'enhancedColorMode', colorMode, this.log);
    }
  }

  /**
   * Creates a default window covering cluster server (Lift and PositionAwareLift).
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.behaviors.require(MatterbridgeWindowCoveringServer.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift), {
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
    });
    return this;
  }

  /**
   * Creates a default tilt window covering cluster server (Tilt and PositionAwareTilt).
   *
   * @param positionPercent100ths - The position percentage in 100ths (0-10000). Defaults to 0. Matter uses 10000 = fully closed 0 = fully opened.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultTiltWindowCoveringClusterServer(positionPercent100ths?: number) {
    this.behaviors.require(MatterbridgeWindowCoveringServer.with(WindowCovering.Feature.Tilt, WindowCovering.Feature.PositionAwareTilt), {
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
      targetPositionTiltPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
      currentPositionTiltPercent100ths: positionPercent100ths ?? 0, // 0 Fully open 10000 fully closed
    });
    return this;
  }

  /**
   * Sets the window covering target position as the current position and stops the movement.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  async setWindowCoveringTargetAsCurrentAndStopped() {
    if (this.hasAttributeServer(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')) {
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
    } else {
      const position = this.getAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths', this.log);
      if (isValidNumber(position, 0, 10000)) {
        await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths', position, this.log);
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
      this.log.debug(`Set WindowCovering currentPositionTiltPercent100ths and targetPositionTiltPercent100ths to ${position} and operationalStatus to Stopped.`);
    }
    return this;
  }

  /**
   * Sets the current and target status of a window covering.
   * @param {number} current - The current position of the window covering.
   * @param {number} target - The target position of the window covering.
   * @param {WindowCovering.MovementStatus} status - The movement status of the window covering.
   */
  async setWindowCoveringCurrentTargetStatus(current: number, target: number, status: WindowCovering.MovementStatus) {
    if (this.hasAttributeServer(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')) {
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
    } else {
      await this.setAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths', current, this.log);
      await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths', target, this.log);
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
      this.log.debug(`Set WindowCovering currentPositionTiltPercent100ths: ${current}, targetPositionTiltPercent100ths: ${target} and operationalStatus: ${status}.`);
    }
  }

  /**
   * Sets the status of the window covering.
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
   * @returns The global operational status of the window covering or undefined.
   */
  getWindowCoveringStatus(): WindowCovering.MovementStatus | undefined {
    const status = this.getAttribute(WindowCovering.Cluster.id, 'operationalStatus', this.log);
    if (isValidObject(status, 3) && 'global' in status && typeof status.global === 'number') {
      this.log.debug(`Get WindowCovering operationalStatus: ${status.global}`);
      return status.global;
    }
  }

  /**
   * Sets the target and current position of the window covering.
   *
   * @param position - The position to set, specified as a number.
   */
  async setWindowCoveringTargetAndCurrentPosition(position: number) {
    if (this.hasAttributeServer(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths')) {
      await this.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', position, this.log);
      await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', position, this.log);
      this.log.debug(`Set WindowCovering currentPositionLiftPercent100ths: ${position} and targetPositionLiftPercent100ths: ${position}.`);
    } else {
      await this.setAttribute(WindowCovering.Cluster.id, 'currentPositionTiltPercent100ths', position, this.log);
      await this.setAttribute(WindowCovering.Cluster.id, 'targetPositionTiltPercent100ths', position, this.log);
      this.log.debug(`Set WindowCovering currentPositionTiltPercent100ths: ${position} and targetPositionTiltPercent100ths: ${position}.`);
    }
  }

  /**
   * Creates a default thermostat cluster server with features Heating, Cooling and AutoMode.
   *
   * @param {number} [localTemperature=23] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint=21] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [occupiedCoolingSetpoint=25] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minSetpointDeadBand=1] - The minimum setpoint dead band value. Defaults to 1°.
   * @param {number} [minHeatSetpointLimit=0] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit=50] - The maximum heat setpoint limit value. Defaults to 50°.
   * @param {number} [minCoolSetpointLimit=0] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit=50] - The maximum cool setpoint limit value. Defaults to 50°.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
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
    this.behaviors.require(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode), {
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
    });
    return this;
  }

  /**
   * Creates a default heating thermostat cluster server with feature Heating.
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedHeatingSetpoint] - The occupied heating setpoint value in degrees Celsius. Defaults to 21°.
   * @param {number} [minHeatSetpointLimit] - The minimum heat setpoint limit value. Defaults to 0°.
   * @param {number} [maxHeatSetpointLimit] - The maximum heat setpoint limit value. Defaults to 50°.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultHeatingThermostatClusterServer(localTemperature = 23, occupiedHeatingSetpoint = 21, minHeatSetpointLimit = 0, maxHeatSetpointLimit = 50) {
    this.behaviors.require(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating), {
      localTemperature: localTemperature * 100,
      systemMode: Thermostat.SystemMode.Heat,
      controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.HeatingOnly,
      // Thermostat.Feature.Heating
      occupiedHeatingSetpoint: occupiedHeatingSetpoint * 100,
      minHeatSetpointLimit: minHeatSetpointLimit * 100,
      maxHeatSetpointLimit: maxHeatSetpointLimit * 100,
      absMinHeatSetpointLimit: minHeatSetpointLimit * 100,
      absMaxHeatSetpointLimit: maxHeatSetpointLimit * 100,
    });
    return this;
  }

  /**
   * Creates a default cooling thermostat cluster server with feature Cooling.
   * @param {number} [localTemperature] - The local temperature value in degrees Celsius. Defaults to 23°.
   * @param {number} [occupiedCoolingSetpoint] - The occupied cooling setpoint value in degrees Celsius. Defaults to 25°.
   * @param {number} [minCoolSetpointLimit] - The minimum cool setpoint limit value. Defaults to 0°.
   * @param {number} [maxCoolSetpointLimit] - The maximum cool setpoint limit value. Defaults to 50°.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultCoolingThermostatClusterServer(localTemperature = 23, occupiedCoolingSetpoint = 25, minCoolSetpointLimit = 0, maxCoolSetpointLimit = 50) {
    this.behaviors.require(MatterbridgeThermostatServer.with(Thermostat.Feature.Cooling), {
      localTemperature: localTemperature * 100,
      systemMode: Thermostat.SystemMode.Cool,
      controlSequenceOfOperation: Thermostat.ControlSequenceOfOperation.CoolingOnly,
      // Thermostat.Feature.Cooling
      occupiedCoolingSetpoint: occupiedCoolingSetpoint * 100,
      minCoolSetpointLimit: minCoolSetpointLimit * 100,
      maxCoolSetpointLimit: maxCoolSetpointLimit * 100,
      absMinCoolSetpointLimit: minCoolSetpointLimit * 100,
      absMaxCoolSetpointLimit: maxCoolSetpointLimit * 100,
    });
    return this;
  }

  /**
   * Creates a default thermostat user interface configuration cluster server.
   *
   * @remarks
   * The default values are:
   * - temperatureDisplayMode: ThermostatUserInterfaceConfiguration.TemperatureDisplayMode.Celsius (writeble).
   * - keypadLockout: ThermostatUserInterfaceConfiguration.KeypadLockout.NoLockout (writeble).
   * - scheduleProgrammingVisibility: ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility.ScheduleProgrammingPermitted (writeble).
   */
  createDefaultThermostatUserInterfaceConfigurationClusterServer() {
    this.behaviors.require(ThermostatUserInterfaceConfigurationServer, {
      temperatureDisplayMode: ThermostatUserInterfaceConfiguration.TemperatureDisplayMode.Celsius,
      keypadLockout: ThermostatUserInterfaceConfiguration.KeypadLockout.NoLockout,
      scheduleProgrammingVisibility: ThermostatUserInterfaceConfiguration.ScheduleProgrammingVisibility.ScheduleProgrammingPermitted,
    });
    return this;
  }

  /**
   * Creates a default fan control cluster server with features MultiSpeed, Auto, and Step.
   *
   * @param {FanControl.FanMode} [fanMode=FanControl.FanMode.Off] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * fanmode is writable and persists across reboots.
   * percentSetting is writable.
   * speedSetting is writable.
   */
  createDefaultFanControlClusterServer(fanMode = FanControl.FanMode.Off) {
    this.behaviors.require(MatterbridgeFanControlServer.with(FanControl.Feature.MultiSpeed, FanControl.Feature.Auto, FanControl.Feature.Step), {
      fanMode,
      fanModeSequence: FanControl.FanModeSequence.OffLowMedHighAuto,
      percentSetting: 0,
      percentCurrent: 0,
      speedMax: 100,
      speedSetting: 0,
      speedCurrent: 0,
    });
    return this;
  }

  /**
   * Creates a base fan control cluster server without features.
   *
   * @param {FanControl.FanMode} [fanMode=FanControl.FanMode.Off] - The fan mode to set. Defaults to `FanControl.FanMode.Off`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * fanmode is writable and persists across reboots.
   * percentSetting is writable.
   */
  createBaseFanControlClusterServer(fanMode = FanControl.FanMode.Off) {
    this.behaviors.require(FanControlServer, {
      fanMode,
      fanModeSequence: FanControl.FanModeSequence.OffLowMedHigh,
      percentSetting: 0,
      percentCurrent: 0,
    });
    return this;
  }

  /**
   * Creates a default HEPA Filter Monitoring Cluster Server with features Condition and ReplacementProductList.
   * It supports ResourceMonitoring.Feature.Condition and ResourceMonitoring.Feature.ReplacementProductList.
   *
   * @param {ResourceMonitoring.ChangeIndication} changeIndication - The initial change indication. Default is ResourceMonitoring.ChangeIndication.Ok.
   * @param {boolean | undefined} inPlaceIndicator - The in-place indicator. Default is undefined.
   * @param {number | undefined} lastChangedTime - The last changed time (EpochS). Default is undefined.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultHepaFilterMonitoringClusterServer(
    changeIndication: ResourceMonitoring.ChangeIndication = ResourceMonitoring.ChangeIndication.Ok,
    inPlaceIndicator: boolean | undefined = undefined,
    lastChangedTime: number | undefined = undefined,
  ): this {
    this.behaviors.require(HepaFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.ReplacementProductList), {
      condition: 100, // Feature.Condition
      degradationDirection: ResourceMonitoring.DegradationDirection.Down, // Feature.Condition
      changeIndication,
      inPlaceIndicator,
      lastChangedTime,
      replacementProductList: [], // Feature.ReplacementProductList
    });
    return this;
  }

  /**
   * Creates a default Activated Carbon Filter Monitoring Cluster Server with features Condition and ReplacementProductList.
   *
   * @param {ResourceMonitoring.ChangeIndication} changeIndication - The initial change indication. Default is ResourceMonitoring.ChangeIndication.Ok.
   * @param {boolean | undefined} inPlaceIndicator - The in-place indicator. Default is undefined.
   * @param {number | undefined} lastChangedTime - The last changed time (EpochS). Default is undefined.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultActivatedCarbonFilterMonitoringClusterServer(
    changeIndication: ResourceMonitoring.ChangeIndication = ResourceMonitoring.ChangeIndication.Ok,
    inPlaceIndicator: boolean | undefined = undefined,
    lastChangedTime: number | undefined = undefined,
  ): this {
    this.behaviors.require(ActivatedCarbonFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.ReplacementProductList), {
      condition: 100, // Feature.Condition
      degradationDirection: ResourceMonitoring.DegradationDirection.Down, // Feature.Condition
      changeIndication,
      inPlaceIndicator,
      lastChangedTime,
      replacementProductList: [], // Feature.ReplacementProductList
    });
    return this;
  }

  /**
   * Creates a default door lock cluster server.
   *
   * @param {DoorLock.LockState} [lockState=DoorLock.LockState.Locked] - The initial state of the lock (default: Locked).
   * @param {DoorLock.LockType} [lockType=DoorLock.LockType.DeadBolt] - The type of the lock (default: DeadBolt).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * All operating modes NOT supported by a lock SHALL be set to one. The value of the OperatingMode enumeration defines the related bit to be set.
   */
  createDefaultDoorLockClusterServer(lockState = DoorLock.LockState.Locked, lockType = DoorLock.LockType.DeadBolt) {
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
   * @param {number} [currentMode=0] - The current mode (default: 0).
   * @param {number} [startUpMode=0] - The startup mode (default: 0).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   * @remarks
   * endpoint.createDefaultModeSelectClusterServer('Night mode', [{ label: 'Led ON', mode: 0, semanticTags: [] }, { label: 'Led OFF', mode: 1, semanticTags: [] }], 0, 0);
   */
  createDefaultModeSelectClusterServer(description: string, supportedModes: ModeSelect.ModeOption[], currentMode = 0, startUpMode = 0) {
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
   * @param {ValveConfigurationAndControl.ValveState} [valveState=ValveConfigurationAndControl.ValveState.Closed] - The valve state to set. Defaults to `ValveConfigurationAndControl.ValveState.Closed`.
   * @param {number} [valveLevel=0] - The valve level to set. Defaults to 0.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultValveConfigurationAndControlClusterServer(valveState = ValveConfigurationAndControl.ValveState.Closed, valveLevel = 0) {
    this.behaviors.require(MatterbridgeValveConfigurationAndControlServer.with(ValveConfigurationAndControl.Feature.Level), {
      currentState: valveState,
      targetState: valveState,
      currentLevel: valveLevel,
      targetLevel: valveLevel,
      openDuration: null,
      defaultOpenDuration: null,
      remainingDuration: null,
      defaultOpenLevel: 100,
      valveFault: { generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false },
      levelStep: 1,
    });
    return this;
  }

  /**
   * Creates the default PumpConfigurationAndControl cluster server with features ConstantSpeed.
   *
   * @param {PumpConfigurationAndControl.OperationMode} [pumpMode=PumpConfigurationAndControl.OperationMode.Normal] - The pump mode to set. Defaults to `PumpConfigurationAndControl.OperationMode.Normal`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPumpConfigurationAndControlClusterServer(pumpMode = PumpConfigurationAndControl.OperationMode.Normal) {
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
  createDefaultSmokeCOAlarmClusterServer(smokeState = SmokeCoAlarm.AlarmState.Normal, coState = SmokeCoAlarm.AlarmState.Normal) {
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
  createSmokeOnlySmokeCOAlarmClusterServer(smokeState = SmokeCoAlarm.AlarmState.Normal) {
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
  createCoOnlySmokeCOAlarmClusterServer(coState = SmokeCoAlarm.AlarmState.Normal) {
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
   * Creates a default momentary switch cluster server with features MomentarySwitch, MomentarySwitchRelease, MomentarySwitchLongPress and MomentarySwitchMultiPress.
   *
   * @remarks
   * This method adds a cluster server with default momentary switch features and configuration suitable for (AppleHome) Single Double Long automations.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultSwitchClusterServer() {
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
   * Creates a default latching switch cluster server with features LatchingSwitch.
   *
   * @remarks
   * This method adds a cluster server with default latching switch features and configuration suitable for a latching switch with 2 positions.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultLatchingSwitchClusterServer() {
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
   *
   * @param {string} event - The type of event to trigger. Possible values are 'Single', 'Double', 'Long' for momentarySwitch and 'Press', 'Release' for latchingSwitch.
   * @param {Endpoint} endpoint - The endpoint on which to trigger the event (default the device endpoint).
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
        await this.triggerEvent(Switch.Cluster.id, 'shortRelease', { previousPosition: 1 }, log);
        await this.setAttribute(Switch.Cluster.id, 'currentPosition', 0, log);
        await this.triggerEvent(Switch.Cluster.id, 'multiPressComplete', { previousPosition: 1, totalNumberOfPressesCounted: 1 }, log);
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
   * @param {OperationalState.OperationalStateEnum} operationalState - The initial operational state.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
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
  createDefaultBooleanStateClusterServer(contact?: boolean) {
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
   * @param {boolean} [sensorFault=false] - Optional boolean value indicating the sensor fault state. Defaults to `false` if not provided.
   * @param {number} [currentSensitivityLevel=0] - The current sensitivity level. Defaults to `0` if not provided.
   * @param {number} [supportedSensitivityLevels=2] - The number of supported sensitivity levels. Defaults to `2` if not provided (min 2, max 10).
   * @param {number} [defaultSensitivityLevel=0] - The default sensitivity level. Defaults to `0` if not provided.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   *
   */
  createDefaultBooleanStateConfigurationClusterServer(sensorFault = false, currentSensitivityLevel = 0, supportedSensitivityLevels = 2, defaultSensitivityLevel = 0) {
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
   * Creates a default Power Topology Cluster Server with feature TreeTopology. Only needed for an electricalSensor device type.
   *
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPowerTopologyClusterServer() {
    this.behaviors.require(PowerTopologyServer.with(PowerTopology.Feature.TreeTopology));
    return this;
  }

  /**
   * Creates a default Electrical Energy Measurement Cluster Server with features ImportedEnergy, ExportedEnergy, and CumulativeEnergy.
   *
   * @param {number} energy - The total consumption value in mW/h.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultElectricalEnergyMeasurementClusterServer(energy: number | bigint | null = null) {
    this.behaviors.require(ElectricalEnergyMeasurementServer.with(ElectricalEnergyMeasurement.Feature.ImportedEnergy, ElectricalEnergyMeasurement.Feature.ExportedEnergy, ElectricalEnergyMeasurement.Feature.CumulativeEnergy), {
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
  createDefaultElectricalPowerMeasurementClusterServer(voltage: number | bigint | null = null, current: number | bigint | null = null, power: number | bigint | null = null, frequency: number | bigint | null = null) {
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
  createDefaultTemperatureMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
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
  createDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
    this.behaviors.require(RelativeHumidityMeasurementServer, getDefaultRelativeHumidityMeasurementClusterServer(measuredValue, minMeasuredValue, maxMeasuredValue));
    return this;
  }

  /**
   * Creates a default PressureMeasurement cluster server.
   *
   * @param {number | null} measuredValue - The measured value for the pressure.
   * @param {number | null} minMeasuredValue - The minimum measured value for the pressure.
   * @param {number | null} maxMeasuredValue - The maximum measured value for the pressure.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultPressureMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
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
   * @remark The default value for the illuminance measurement is null.
   * This attribute SHALL indicate the illuminance in Lux (symbol lx) as follows:
   * •  MeasuredValue = 10,000 x log10(illuminance) + 1,
   *    where 1 lx <= illuminance <= 3.576 Mlx, corresponding to a MeasuredValue in the range 1 to 0xFFFE.
   * • 0 indicates a value of illuminance that is too low to be measured
   * • null indicates that the illuminance measurement is invalid.
   *
   * @remarks
   * Lux to matter = Math.round(Math.max(Math.min(10000 * Math.log10(lux), 0xfffe), 0))
   * Matter to Lux = Math.round(Math.max(Math.pow(10, value / 10000), 0))
   */
  createDefaultIlluminanceMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
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
  createDefaultFlowMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
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
   * @remark The default value for the occupancy sensor type is PIR.
   */
  createDefaultOccupancySensingClusterServer(occupied = false, holdTime = 30, holdTimeMin = 1, holdTimeMax = 300) {
    this.behaviors.require(OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared), getDefaultOccupancySensingClusterServer(occupied, holdTime, holdTimeMin, holdTimeMax));
    return this;
  }

  /**
   * Creates a default AirQuality cluster server.
   *
   * @param {AirQuality.AirQualityEnum} airQuality The air quality level. Defaults to `AirQuality.AirQualityType.Unknown`.
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createDefaultAirQualityClusterServer(airQuality = AirQuality.AirQualityEnum.Unknown) {
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
   */
  createDefaultTvocMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air, uncertainty?: number) {
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
   * Creates a default TotalVolatileOrganicCompoundsConcentrationMeasurement cluster server with feature LevelIndication.

  * @param {ConcentrationMeasurement.LevelValue} levelValue - The level value of the measurement (default to ConcentrationMeasurement.LevelValue.Unknown).
   * @param {ConcentrationMeasurement.MeasurementMedium} measurementMedium - The measurement medium (default to ConcentrationMeasurement.MeasurementMedium.Air).
   * @returns {this} The current MatterbridgeEndpoint instance for chaining.
   */
  createLevelTvocMeasurementClusterServer(levelValue = ConcentrationMeasurement.LevelValue.Unknown, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultCarbonMonoxideConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultCarbonDioxideConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultFormaldehydeConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultPm1ConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultPm25ConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultPm10ConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultOzoneConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultRadonConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ppm, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
   */
  createDefaultNitrogenDioxideConcentrationMeasurementClusterServer(measuredValue: number | null = null, measurementUnit = ConcentrationMeasurement.MeasurementUnit.Ugm3, measurementMedium = ConcentrationMeasurement.MeasurementMedium.Air) {
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
