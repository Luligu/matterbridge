/**
 * This file contains the helpers for the class MatterbridgeEndpoint.
 *
 * @file matterbridgeEndpointHelpers.ts
 * @author Luca Liguori
 * @created 2024-10-01
 * @version 2.1.0
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

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mMatterbridgeEndpointHelpers loaded.\u001B[40;0m');

// Other modules
import { createHash } from 'node:crypto';

// AnsiLogger module
import { AnsiLogger, BLUE, CYAN, db, debugStringify, er, hk, or, YELLOW, zb } from 'node-ansi-logger';
// @matter
import { Lifecycle } from '@matter/general';
import { ActionContext, Behavior, ClusterBehavior, Endpoint } from '@matter/node';
import { ClusterId } from '@matter/types/datatype';
import { MeasurementType } from '@matter/types/globals';
import { ClusterType, getClusterNameById } from '@matter/types/cluster';
// @matter clusters
import { PowerSource } from '@matter/types/clusters/power-source';
import { UserLabel } from '@matter/types/clusters/user-label';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
import { BasicInformation } from '@matter/types/clusters/basic-information';
import { BridgedDeviceBasicInformation } from '@matter/types/clusters/bridged-device-basic-information';
import { Identify } from '@matter/types/clusters/identify';
import { Groups } from '@matter/types/clusters/groups';
import { OnOff } from '@matter/types/clusters/on-off';
import { LevelControl } from '@matter/types/clusters/level-control';
import { ColorControl } from '@matter/types/clusters/color-control';
import { WindowCovering } from '@matter/types/clusters/window-covering';
import { Thermostat } from '@matter/types/clusters/thermostat';
import { FanControl } from '@matter/types/clusters/fan-control';
import { DoorLock } from '@matter/types/clusters/door-lock';
import { ModeSelect } from '@matter/types/clusters/mode-select';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { Switch } from '@matter/types/clusters/switch';
import { BooleanState } from '@matter/types/clusters/boolean-state';
import { BooleanStateConfiguration } from '@matter/types/clusters/boolean-state-configuration';
import { PowerTopology } from '@matter/types/clusters/power-topology';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { RelativeHumidityMeasurement } from '@matter/types/clusters/relative-humidity-measurement';
import { PressureMeasurement } from '@matter/types/clusters/pressure-measurement';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { IlluminanceMeasurement } from '@matter/types/clusters/illuminance-measurement';
import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { AirQuality } from '@matter/types/clusters/air-quality';
import { CarbonMonoxideConcentrationMeasurement } from '@matter/types/clusters/carbon-monoxide-concentration-measurement';
import { CarbonDioxideConcentrationMeasurement } from '@matter/types/clusters/carbon-dioxide-concentration-measurement';
import { NitrogenDioxideConcentrationMeasurement } from '@matter/types/clusters/nitrogen-dioxide-concentration-measurement';
import { OzoneConcentrationMeasurement } from '@matter/types/clusters/ozone-concentration-measurement';
import { FormaldehydeConcentrationMeasurement } from '@matter/types/clusters/formaldehyde-concentration-measurement';
import { Pm1ConcentrationMeasurement } from '@matter/types/clusters/pm1-concentration-measurement';
import { Pm25ConcentrationMeasurement } from '@matter/types/clusters/pm25-concentration-measurement';
import { Pm10ConcentrationMeasurement } from '@matter/types/clusters/pm10-concentration-measurement';
import { RadonConcentrationMeasurement } from '@matter/types/clusters/radon-concentration-measurement';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/types/clusters/total-volatile-organic-compounds-concentration-measurement';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
// @matter behaviors
import { PowerSourceServer } from '@matter/node/behaviors/power-source';
import { UserLabelServer } from '@matter/node/behaviors/user-label';
import { FixedLabelServer } from '@matter/node/behaviors/fixed-label';
import { BasicInformationServer } from '@matter/node/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/node/behaviors/bridged-device-basic-information';
import { GroupsServer } from '@matter/node/behaviors/groups';
import { PumpConfigurationAndControlServer } from '@matter/node/behaviors/pump-configuration-and-control';
import { SwitchServer } from '@matter/node/behaviors/switch';
import { BooleanStateServer } from '@matter/node/behaviors/boolean-state';
import { PowerTopologyServer } from '@matter/node/behaviors/power-topology';
import { ElectricalPowerMeasurementServer } from '@matter/node/behaviors/electrical-power-measurement';
import { ElectricalEnergyMeasurementServer } from '@matter/node/behaviors/electrical-energy-measurement';
import { TemperatureMeasurementServer } from '@matter/node/behaviors/temperature-measurement';
import { RelativeHumidityMeasurementServer } from '@matter/node/behaviors/relative-humidity-measurement';
import { PressureMeasurementServer } from '@matter/node/behaviors/pressure-measurement';
import { FlowMeasurementServer } from '@matter/node/behaviors/flow-measurement';
import { IlluminanceMeasurementServer } from '@matter/node/behaviors/illuminance-measurement';
import { OccupancySensingServer } from '@matter/node/behaviors/occupancy-sensing';
import { AirQualityServer } from '@matter/node/behaviors/air-quality';
import { CarbonMonoxideConcentrationMeasurementServer } from '@matter/node/behaviors/carbon-monoxide-concentration-measurement';
import { CarbonDioxideConcentrationMeasurementServer } from '@matter/node/behaviors/carbon-dioxide-concentration-measurement';
import { NitrogenDioxideConcentrationMeasurementServer } from '@matter/node/behaviors/nitrogen-dioxide-concentration-measurement';
import { OzoneConcentrationMeasurementServer } from '@matter/node/behaviors/ozone-concentration-measurement';
import { FormaldehydeConcentrationMeasurementServer } from '@matter/node/behaviors/formaldehyde-concentration-measurement';
import { Pm1ConcentrationMeasurementServer } from '@matter/node/behaviors/pm1-concentration-measurement';
import { Pm25ConcentrationMeasurementServer } from '@matter/node/behaviors/pm25-concentration-measurement';
import { Pm10ConcentrationMeasurementServer } from '@matter/node/behaviors/pm10-concentration-measurement';
import { RadonConcentrationMeasurementServer } from '@matter/node/behaviors/radon-concentration-measurement';
import { TotalVolatileOrganicCompoundsConcentrationMeasurementServer } from '@matter/node/behaviors/total-volatile-organic-compounds-concentration-measurement';
import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';

// Matterbridge
import { deepCopy } from './utils/deepCopy.js';
import { deepEqual } from './utils/deepEqual.js';
import { isValidArray } from './utils/isvalid.js';
import { MatterbridgeEndpoint, MatterbridgeEndpointCommands } from './matterbridgeEndpoint.js';
import {
  MatterbridgeIdentifyServer,
  MatterbridgeOnOffServer,
  MatterbridgeLevelControlServer,
  MatterbridgeColorControlServer,
  MatterbridgeLiftWindowCoveringServer,
  MatterbridgeThermostatServer,
  MatterbridgeFanControlServer,
  MatterbridgeDoorLockServer,
  MatterbridgeModeSelectServer,
  MatterbridgeValveConfigurationAndControlServer,
  MatterbridgeSmokeCoAlarmServer,
  MatterbridgeBooleanStateConfigurationServer,
  MatterbridgeOperationalStateServer,
  MatterbridgeDeviceEnergyManagementModeServer,
  MatterbridgePowerSourceServer,
  MatterbridgeDeviceEnergyManagementServer,
} from './matterbridgeBehaviors.js';

/**
 *  Capitalizes the first letter of a string.
 *
 * @param {string} name - The string to capitalize.
 * @returns {string} The string with the first letter capitalized.
 */
export function capitalizeFirstLetter(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Lowercases the first letter of a string.
 *
 * @param {string} name - The string to lowercase the first letter of.
 * @returns {string} The string with the first letter lowercased.
 */
export function lowercaseFirstLetter(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

/**
 * Checks if the device name contains non-Latin characters.
 *
 * @param {string} deviceName - The name of the device to check.
 * @returns {boolean} Returns true if the device name contains non-Latin characters, false otherwise.
 */
export function checkNotLatinCharacters(deviceName: string): boolean {
  const nonLatinRegexList = [
    /[\u0400-\u04FF\u0500-\u052F]/, // Cyrillic
    /[\u2E80-\u9FFF]/, // CJK (Chinese, Japanese, Korean)
    /[\uAC00-\uD7AF]/, // Korean Hangul
    /[\u0600-\u06FF\u0750-\u077F]/, // Arabic, Persian
    /[\u0590-\u05FF]/, // Hebrew
    /[\u0900-\u097F]/, // Devanagari (Hindi, Sanskrit)
    /[\u0E00-\u0E7F]/, // Thai
    /[\u1200-\u137F]/, // Ethiopic (Amharic, Tigrinya)
  ];
  return nonLatinRegexList.some((regex) => regex.test(deviceName));
}

/**
 * Generates a unique ID based on the device name.
 *
 * @param {string} deviceName - The name of the device to generate a unique ID for.
 * @returns {string} A unique ID generated from the device name using MD5 hashing.
 */
export function generateUniqueId(deviceName: string): string {
  return createHash('md5').update(deviceName).digest('hex'); // MD5 hash of the device name
}

/**
 * Generates a unique ID based on four parameters.
 *
 * @param {string} param1 - The first parameter.
 * @param {string} param2 - The second parameter.
 * @param {string} param3 - The third parameter.
 * @param {string} param4 - The fourth parameter.
 * @returns {string} A unique ID generated from the concatenation of the parameters using MD5 hashing.
 */
export function createUniqueId(param1: string, param2: string, param3: string, param4: string): string {
  const hash = createHash('md5');
  hash.update(param1 + param2 + param3 + param4);
  return hash.digest('hex');
}

/**
 * Retrieves the features for a specific behavior.
 *
 * @param {Endpoint} endpoint - The endpoint to retrieve the features from.
 * @param {string} behavior - The behavior to retrieve the features for.
 *
 * @returns {Record<string, boolean | undefined>} The features for the specified behavior.
 *
 * @remarks Use with:
 * ```typescript
 *     expect(featuresFor(device, 'powerSource').wired).toBe(true);
 * ```
 */
export function featuresFor(endpoint: Endpoint, behavior: string): Record<string, boolean | undefined> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (endpoint.behaviors.supported as any)[lowercaseFirstLetter(behavior)]['cluster']['supportedFeatures'];
}

/**
 * Maps a list of ClusterId to Behavior.Type for server clusters.
 *
 * @param {ClusterId[]} clusterServerList - The list of ClusterId to map.
 * @returns {Behavior.Type[]} An array of Behavior.Type corresponding to the ClusterId in the server list.
 */
export function getBehaviourTypesFromClusterServerIds(clusterServerList: ClusterId[]): Behavior.Type[] {
  // Map Server ClusterId to Behavior.Type
  const behaviorTypes: Behavior.Type[] = [];
  clusterServerList.forEach((clusterId) => {
    behaviorTypes.push(getBehaviourTypeFromClusterServerId(clusterId));
  });
  return behaviorTypes;
}

/**
 * Maps a list of ClusterId to Behavior.Type for client clusters.
 *
 * @param {ClusterId[]} clusterClientList - The list of ClusterId to map.
 * @returns {Behavior.Type[]} An array of Behavior.Type corresponding to the ClusterId in the client list.
 */
export function getBehaviourTypesFromClusterClientIds(clusterClientList: ClusterId[]): Behavior.Type[] {
  // Map Client ClusterId to Behavior.Type
  const behaviorTypes: Behavior.Type[] = [];
  clusterClientList.forEach((_clusterId) => {
    // behaviorTypes.push(getBehaviourTypeFromClusterClientId(clusterId));
  });
  return behaviorTypes;
}

/**
 * Maps a ClusterId to a Behavior.Type for server clusters.
 *
 * @param {ClusterId} clusterId - The ClusterId to map.
 * @returns {Behavior.Type} The corresponding Behavior.Type for the given ClusterId.
 */
export function getBehaviourTypeFromClusterServerId(clusterId: ClusterId): Behavior.Type {
  // Map ClusterId to Server Behavior.Type
  if (clusterId === PowerSource.Cluster.id) return PowerSourceServer.with(PowerSource.Feature.Wired);
  if (clusterId === UserLabel.Cluster.id) return UserLabelServer;
  if (clusterId === FixedLabel.Cluster.id) return FixedLabelServer;
  if (clusterId === BasicInformation.Cluster.id) return BasicInformationServer;
  if (clusterId === BridgedDeviceBasicInformation.Cluster.id) return BridgedDeviceBasicInformationServer;
  if (clusterId === Identify.Cluster.id) return MatterbridgeIdentifyServer;
  if (clusterId === Groups.Cluster.id) return GroupsServer;
  if (clusterId === OnOff.Cluster.id) return MatterbridgeOnOffServer.with('Lighting');
  if (clusterId === LevelControl.Cluster.id) return MatterbridgeLevelControlServer.with('OnOff', 'Lighting');
  if (clusterId === ColorControl.Cluster.id) return MatterbridgeColorControlServer;
  if (clusterId === WindowCovering.Cluster.id) return MatterbridgeLiftWindowCoveringServer.with('Lift', 'PositionAwareLift');
  if (clusterId === Thermostat.Cluster.id) return MatterbridgeThermostatServer.with('AutoMode', 'Heating', 'Cooling');
  if (clusterId === FanControl.Cluster.id) return MatterbridgeFanControlServer;
  if (clusterId === DoorLock.Cluster.id) return MatterbridgeDoorLockServer;
  if (clusterId === ModeSelect.Cluster.id) return MatterbridgeModeSelectServer;
  if (clusterId === ValveConfigurationAndControl.Cluster.id) return MatterbridgeValveConfigurationAndControlServer.with('Level');
  if (clusterId === PumpConfigurationAndControl.Cluster.id) return PumpConfigurationAndControlServer.with('ConstantSpeed');
  if (clusterId === SmokeCoAlarm.Cluster.id) return MatterbridgeSmokeCoAlarmServer.with('SmokeAlarm', 'CoAlarm');
  if (clusterId === Switch.Cluster.id) return SwitchServer.with('MomentarySwitch', 'MomentarySwitchRelease', 'MomentarySwitchLongPress', 'MomentarySwitchMultiPress');
  if (clusterId === OperationalState.Cluster.id) return MatterbridgeOperationalStateServer;
  if (clusterId === BooleanState.Cluster.id) return BooleanStateServer.enable({ events: { stateChange: true } });
  if (clusterId === BooleanStateConfiguration.Cluster.id) return MatterbridgeBooleanStateConfigurationServer;
  if (clusterId === PowerTopology.Cluster.id) return PowerTopologyServer.with('TreeTopology');
  if (clusterId === ElectricalPowerMeasurement.Cluster.id) return ElectricalPowerMeasurementServer.with('AlternatingCurrent');
  if (clusterId === ElectricalEnergyMeasurement.Cluster.id) return ElectricalEnergyMeasurementServer.with('ImportedEnergy', 'ExportedEnergy', 'CumulativeEnergy');
  if (clusterId === TemperatureMeasurement.Cluster.id) return TemperatureMeasurementServer;
  if (clusterId === RelativeHumidityMeasurement.Cluster.id) return RelativeHumidityMeasurementServer;
  if (clusterId === PressureMeasurement.Cluster.id) return PressureMeasurementServer;
  if (clusterId === FlowMeasurement.Cluster.id) return FlowMeasurementServer;
  if (clusterId === IlluminanceMeasurement.Cluster.id) return IlluminanceMeasurementServer;
  if (clusterId === OccupancySensing.Cluster.id) return OccupancySensingServer;
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
  if (clusterId === DeviceEnergyManagement.Cluster.id) return DeviceEnergyManagementServer.with('PowerForecastReporting');
  if (clusterId === DeviceEnergyManagementMode.Cluster.id) return MatterbridgeDeviceEnergyManagementModeServer;

  return MatterbridgeIdentifyServer;
}

/**
 *  Maps a ClusterId to a Behavior.Type for client clusters.
 *
 * @param {ClusterId} _clusterId - The ClusterId to map.
 */
export function getBehaviourTypeFromClusterClientId(_clusterId: ClusterId) {
  // Map ClusterId to Client Behavior.Type
  // return IdentifyClient;
}

/**
 *  Retrieves the Behavior.Type for a given cluster from the endpoint's supported behaviors.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to retrieve the behavior from.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to retrieve the behavior for.
 * @returns {Behavior.Type | undefined} The Behavior.Type for the given cluster, or undefined if not found.
 */
export function getBehavior(endpoint: MatterbridgeEndpoint, cluster: Behavior.Type | ClusterType | ClusterId | string): Behavior.Type | undefined {
  let behavior: Behavior.Type | undefined;
  if (typeof cluster === 'string') {
    behavior = endpoint.behaviors.supported[lowercaseFirstLetter(cluster)];
  } else if (typeof cluster === 'number') {
    behavior = endpoint.behaviors.supported[lowercaseFirstLetter(getClusterNameById(cluster))];
  } else if (typeof cluster === 'object') {
    behavior = endpoint.behaviors.supported[lowercaseFirstLetter(cluster.name)];
  } else if (typeof cluster === 'function') {
    behavior = cluster;
  }
  return behavior;
}

/**
 * Invokes a command on the specified behavior of the endpoint. Used ONLY in Jest tests.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to invoke the command on.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to invoke the command on.
 * @param {keyof MatterbridgeEndpointCommands} command - The command to invoke.
 * @param {Record<string, boolean | number | bigint | string | object | null>} [params] - The parameters to pass to the command.
 *
 * @returns {Promise<boolean>} A promise that resolves to true if the command was invoked successfully, false otherwise.
 *
 * @deprecated Used ONLY in Jest tests.
 */
export async function invokeBehaviorCommand(
  endpoint: MatterbridgeEndpoint,
  cluster: Behavior.Type | ClusterType | ClusterId | string,
  command: keyof MatterbridgeEndpointCommands,
  params?: Record<string, boolean | number | bigint | string | object | null>,
): Promise<boolean> {
  const behaviorId = getBehavior(endpoint, cluster)?.id;
  if (!behaviorId) {
    endpoint.log?.error(`invokeBehaviorCommand error: command ${hk}${command}${er} not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return false;
  }

  await endpoint.act((agent) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const behavior = (agent as unknown as Record<string, Record<string, Function>>)[behaviorId];
    if (!(command in behavior) || typeof behavior[command] !== 'function') {
      endpoint.log?.error(`invokeBehaviorCommand error: command ${hk}${command}${er} not found on agent for endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
      return false;
    }
    behavior[command](params);
  });
  return true;
}

/**
 * Invokes the subscription handler on the specified cluster and attribute of the endpoint. Used ONLY in Jest tests.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to invoke the subscription handler on.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to invoke the subscription handler on.
 * @param {string} attribute - The attribute to invoke the subscription handler on.
 * @param {unknown} newValue - The new value of the attribute.
 * @param {unknown} oldValue - The old value of the attribute.
 *
 * @returns {Promise<boolean>} A promise that resolves to true if the subscription handler was invoked successfully, false otherwise.
 *
 * @deprecated Used ONLY in Jest tests.
 */
export async function invokeSubscribeHandler(endpoint: MatterbridgeEndpoint, cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, newValue: unknown, oldValue: unknown): Promise<boolean> {
  const event = attribute + '$Changed';
  const clusterName = getBehavior(endpoint, cluster)?.id;
  if (!clusterName) {
    endpoint.log.error(`invokeSubscribeHandler ${hk}${event}${er} error: cluster not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return false;
  }

  if (endpoint.construction.status !== Lifecycle.Status.Active) {
    endpoint.log.error(`invokeSubscribeHandler ${hk}${clusterName}.${event}${er} error: Endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
    return false;
  }

  const events = endpoint.events as Record<string, Record<string, unknown>>;
  if (!(clusterName in events) || !(event in events[clusterName])) {
    endpoint.log.error(`invokeSubscribeHandler ${hk}${event}${er} error: cluster ${clusterName} not found on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await endpoint.act((agent) => agent[clusterName].events[event].emit(newValue, oldValue, { ...agent.context, offline: false }));
  return true;
}

/**
 * Adds required cluster servers to the specified endpoint based on the device types.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the required cluster servers to.
 * @returns {void}
 */
export function addRequiredClusterServers(endpoint: MatterbridgeEndpoint): void {
  const requiredServerList: ClusterId[] = [];
  endpoint.log.debug(`addRequiredClusterServers for ${CYAN}${endpoint.maybeId}${db}`);
  Array.from(endpoint.deviceTypes.values()).forEach((deviceType) => {
    endpoint.log.debug(`- for deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
    deviceType.requiredServerClusters.forEach((clusterId) => {
      if (!requiredServerList.includes(clusterId) && !endpoint.hasClusterServer(clusterId)) {
        requiredServerList.push(clusterId);
        endpoint.log.debug(`- cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
      }
    });
  });
  addClusterServers(endpoint, requiredServerList);
}

/**
 * Adds optional cluster servers to the specified endpoint based on the device types.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the optional cluster servers to.
 * @returns {void}
 */
export function addOptionalClusterServers(endpoint: MatterbridgeEndpoint): void {
  const optionalServerList: ClusterId[] = [];
  endpoint.log.debug(`addOptionalClusterServers for ${CYAN}${endpoint.maybeId}${db}`);
  Array.from(endpoint.deviceTypes.values()).forEach((deviceType) => {
    endpoint.log.debug(`- for deviceType: ${zb}${'0x' + deviceType.code.toString(16).padStart(4, '0')}${db}-${zb}${deviceType.name}${db}`);
    deviceType.optionalServerClusters.forEach((clusterId) => {
      if (!optionalServerList.includes(clusterId) && !endpoint.hasClusterServer(clusterId)) {
        optionalServerList.push(clusterId);
        endpoint.log.debug(`- cluster: ${hk}${'0x' + clusterId.toString(16).padStart(4, '0')}${db}-${hk}${getClusterNameById(clusterId)}${db}`);
      }
    });
  });
  addClusterServers(endpoint, optionalServerList);
}

/**
 * Adds cluster servers to the specified endpoint based on the provided server list.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the cluster servers to.
 * @param {ClusterId[]} serverList - The list of cluster IDs to add.
 */
export function addClusterServers(endpoint: MatterbridgeEndpoint, serverList: ClusterId[]) {
  if (serverList.includes(PowerSource.Cluster.id)) endpoint.createDefaultPowerSourceWiredClusterServer();
  if (serverList.includes(Identify.Cluster.id)) endpoint.createDefaultIdentifyClusterServer();
  if (serverList.includes(Groups.Cluster.id)) endpoint.createDefaultGroupsClusterServer();
  if (serverList.includes(OnOff.Cluster.id)) endpoint.createDefaultOnOffClusterServer();
  if (serverList.includes(LevelControl.Cluster.id)) endpoint.createDefaultLevelControlClusterServer();
  if (serverList.includes(ColorControl.Cluster.id)) endpoint.createDefaultColorControlClusterServer();
  if (serverList.includes(WindowCovering.Cluster.id)) endpoint.createDefaultWindowCoveringClusterServer();
  if (serverList.includes(Thermostat.Cluster.id)) endpoint.createDefaultThermostatClusterServer();
  if (serverList.includes(FanControl.Cluster.id)) endpoint.createDefaultFanControlClusterServer();
  if (serverList.includes(DoorLock.Cluster.id)) endpoint.createDefaultDoorLockClusterServer();
  if (serverList.includes(ValveConfigurationAndControl.Cluster.id)) endpoint.createDefaultValveConfigurationAndControlClusterServer();
  if (serverList.includes(PumpConfigurationAndControl.Cluster.id)) endpoint.createDefaultPumpConfigurationAndControlClusterServer();
  if (serverList.includes(SmokeCoAlarm.Cluster.id)) endpoint.createDefaultSmokeCOAlarmClusterServer();
  if (serverList.includes(Switch.Cluster.id)) endpoint.createDefaultSwitchClusterServer();
  if (serverList.includes(OperationalState.Cluster.id)) endpoint.createDefaultOperationalStateClusterServer();
  if (serverList.includes(BooleanState.Cluster.id)) endpoint.createDefaultBooleanStateClusterServer();
  if (serverList.includes(BooleanStateConfiguration.Cluster.id)) endpoint.createDefaultBooleanStateConfigurationClusterServer();
  if (serverList.includes(PowerTopology.Cluster.id)) endpoint.createDefaultPowerTopologyClusterServer();
  if (serverList.includes(ElectricalPowerMeasurement.Cluster.id)) endpoint.createDefaultElectricalPowerMeasurementClusterServer();
  if (serverList.includes(ElectricalEnergyMeasurement.Cluster.id)) endpoint.createDefaultElectricalEnergyMeasurementClusterServer();
  if (serverList.includes(TemperatureMeasurement.Cluster.id)) endpoint.createDefaultTemperatureMeasurementClusterServer();
  if (serverList.includes(RelativeHumidityMeasurement.Cluster.id)) endpoint.createDefaultRelativeHumidityMeasurementClusterServer();
  if (serverList.includes(PressureMeasurement.Cluster.id)) endpoint.createDefaultPressureMeasurementClusterServer();
  if (serverList.includes(FlowMeasurement.Cluster.id)) endpoint.createDefaultFlowMeasurementClusterServer();
  if (serverList.includes(IlluminanceMeasurement.Cluster.id)) endpoint.createDefaultIlluminanceMeasurementClusterServer();
  if (serverList.includes(OccupancySensing.Cluster.id)) endpoint.createDefaultOccupancySensingClusterServer();
  if (serverList.includes(AirQuality.Cluster.id)) endpoint.createDefaultAirQualityClusterServer();
  if (serverList.includes(CarbonMonoxideConcentrationMeasurement.Cluster.id)) endpoint.createDefaultCarbonMonoxideConcentrationMeasurementClusterServer();
  if (serverList.includes(CarbonDioxideConcentrationMeasurement.Cluster.id)) endpoint.createDefaultCarbonDioxideConcentrationMeasurementClusterServer();
  if (serverList.includes(NitrogenDioxideConcentrationMeasurement.Cluster.id)) endpoint.createDefaultNitrogenDioxideConcentrationMeasurementClusterServer();
  if (serverList.includes(OzoneConcentrationMeasurement.Cluster.id)) endpoint.createDefaultOzoneConcentrationMeasurementClusterServer();
  if (serverList.includes(FormaldehydeConcentrationMeasurement.Cluster.id)) endpoint.createDefaultFormaldehydeConcentrationMeasurementClusterServer();
  if (serverList.includes(Pm1ConcentrationMeasurement.Cluster.id)) endpoint.createDefaultPm1ConcentrationMeasurementClusterServer();
  if (serverList.includes(Pm25ConcentrationMeasurement.Cluster.id)) endpoint.createDefaultPm25ConcentrationMeasurementClusterServer();
  if (serverList.includes(Pm10ConcentrationMeasurement.Cluster.id)) endpoint.createDefaultPm10ConcentrationMeasurementClusterServer();
  if (serverList.includes(RadonConcentrationMeasurement.Cluster.id)) endpoint.createDefaultRadonConcentrationMeasurementClusterServer();
  if (serverList.includes(TotalVolatileOrganicCompoundsConcentrationMeasurement.Cluster.id)) endpoint.createDefaultTvocMeasurementClusterServer();
  if (serverList.includes(DeviceEnergyManagement.Cluster.id)) endpoint.createDefaultDeviceEnergyManagementClusterServer();
  if (serverList.includes(DeviceEnergyManagementMode.Cluster.id)) endpoint.createDefaultDeviceEnergyManagementModeClusterServer();
}

/**
 * Adds a fixed label to the FixedLabel cluster. The FixedLabel cluster is created if it does not exist.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the cluster servers to.
 * @param {string} label - The label to add. Max 16 characters.
 * @param {string} value - The value of the label. Max 16 characters.
 */
export async function addFixedLabel(endpoint: MatterbridgeEndpoint, label: string, value: string) {
  if (!endpoint.hasClusterServer(FixedLabel.Cluster.id)) {
    endpoint.log.debug(`addFixedLabel: add cluster ${hk}FixedLabel${db}:${hk}fixedLabel${db} with label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
    endpoint.behaviors.require(FixedLabelServer, {
      labelList: [{ label: label.substring(0, 16), value: value.substring(0, 16) }],
    });
    return;
  }
  endpoint.log.debug(`addFixedLabel: add label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
  let labelList = endpoint.getAttribute(FixedLabel.Cluster.id, 'labelList', endpoint.log) as { label: string; value: string }[];
  if (isValidArray(labelList)) {
    labelList = labelList.filter((entry) => entry.label !== label.substring(0, 16));
    labelList.push({ label: label.substring(0, 16), value: value.substring(0, 16) });
    await endpoint.setAttribute(FixedLabel.Cluster.id, 'labelList', labelList, endpoint.log);
  }
}

/**
 * Adds a user label to the UserLabel cluster. The UserLabel cluster is created if it does not exist.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the cluster servers to.
 * @param {string} label - The label to add. Max 16 characters.
 * @param {string} value - The value of the label. Max 16 characters.
 */
export async function addUserLabel(endpoint: MatterbridgeEndpoint, label: string, value: string) {
  if (!endpoint.hasClusterServer(UserLabel.Cluster.id)) {
    endpoint.log.debug(`addUserLabel: add cluster ${hk}UserLabel${db}:${hk}userLabel${db} with label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
    endpoint.behaviors.require(UserLabelServer, {
      labelList: [{ label: label.substring(0, 16), value: value.substring(0, 16) }],
    });
    return;
  }
  endpoint.log.debug(`addUserLabel: add label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
  let labelList = endpoint.getAttribute(UserLabel.Cluster.id, 'labelList', endpoint.log) as { label: string; value: string }[];
  if (isValidArray(labelList)) {
    labelList = labelList.filter((entry) => entry.label !== label.substring(0, 16));
    labelList.push({ label: label.substring(0, 16), value: value.substring(0, 16) });
    await endpoint.setAttribute(UserLabel.Cluster.id, 'labelList', labelList, endpoint.log);
  }
}

/**
 * Returns the options for a given behavior type.
 *
 * @param {T} type - The behavior type.
 * @param {Behavior.Options<T>} options - The options for the behavior type.
 * @returns {Behavior.Options<T>} The options for the behavior type.
 */
export function optionsFor<T extends Behavior.Type>(type: T, options: Behavior.Options<T>): Behavior.Options<T> {
  return options;
}

/**
 * Retrieves the cluster ID.
 *
 * @param {Endpoint} endpoint - The endpoint to retrieve the cluster ID from.
 * @param {ClusterId} cluster - The ID of the cluster.
 * @returns {number | undefined} The ID of the cluster.
 */
export function getClusterId(endpoint: Endpoint, cluster: string): number | undefined {
  return endpoint.behaviors.supported[lowercaseFirstLetter(cluster)]?.schema?.id;
}

/**
 * Retrieves the ID of an attribute from a cluster behavior.
 *
 * @param {Endpoint} endpoint - The endpoint to retrieve the attribute ID from.
 * @param {string} cluster - The name of the cluster.
 * @param {string} attribute - The name of the attribute.
 * @returns {number | undefined} The ID of the attribute, or undefined if not found.
 */
export function getAttributeId(endpoint: Endpoint, cluster: string, attribute: string): number | undefined {
  const clusterBehavior = endpoint.behaviors.supported[lowercaseFirstLetter(cluster)] as ClusterBehavior.Type | undefined;
  return clusterBehavior?.cluster?.attributes[lowercaseFirstLetter(attribute)]?.id;
}

/**
 * Retrieves the value of the provided attribute from the given cluster.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to retrieve the attribute from.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to retrieve the attribute from.
 * @param {string} attribute - The name of the attribute to retrieve.
 * @param {AnsiLogger} [log] - (Optional) The logger to use for logging the retrieve. Errors are logged to the endpoint logger.
 * @returns {any} The value of the attribute, or undefined if the attribute is not found.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getAttribute(endpoint: MatterbridgeEndpoint, cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, log?: AnsiLogger): any {
  const clusterName = getBehavior(endpoint, cluster)?.id;
  if (!clusterName) {
    endpoint.log.error(`getAttribute ${hk}${attribute}${er} error: cluster not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return undefined;
  }

  if (endpoint.construction.status !== Lifecycle.Status.Active) {
    endpoint.log.error(`getAttribute ${hk}${clusterName}.${attribute}${er} error: Endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
    return undefined;
  }

  const state = endpoint.state as Record<string, Record<string, boolean | number | bigint | string | object | null>>;
  attribute = lowercaseFirstLetter(attribute);
  if (!(attribute in state[clusterName])) {
    endpoint.log.error(
      `getAttribute error: Attribute ${hk}${attribute}${er} not found on Cluster ${'0x' + getClusterId(endpoint, clusterName)?.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`,
    );
    return undefined;
  }

  let value = state[clusterName][attribute];
  if (typeof value === 'object') value = deepCopy(value);
  log?.info(
    `${db}Get endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db} value ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${db}`,
  );
  return value;
}

/**
 * Sets the value of an attribute on a cluster server.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to set the attribute on.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to set the attribute on.
 * @param {string} attribute - The name of the attribute.
 * @param {boolean | number | bigint | string | object | null} value - The value to set for the attribute.
 * @param {AnsiLogger} [log] - (Optional) The logger to use for logging the set. Errors are logged to the endpoint logger.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the attribute was successfully set.
 */
export async function setAttribute(endpoint: MatterbridgeEndpoint, cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, value: boolean | number | bigint | string | object | null, log?: AnsiLogger): Promise<boolean> {
  const clusterName = getBehavior(endpoint, cluster)?.id;
  if (!clusterName) {
    endpoint.log.error(`setAttribute ${hk}${attribute}${er} error: cluster not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return false;
  }

  if (endpoint.construction.status !== Lifecycle.Status.Active) {
    endpoint.log.error(`setAttribute ${hk}${clusterName}.${attribute}${er} error: Endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
    return false;
  }

  const state = endpoint.state as Record<string, Record<string, boolean | number | bigint | string | object | null>>;
  attribute = lowercaseFirstLetter(attribute);
  if (!(attribute in state[clusterName])) {
    endpoint.log.error(
      `setAttribute error: Attribute ${hk}${attribute}${er} not found on cluster ${'0x' + getClusterId(endpoint, clusterName)?.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`,
    );
    return false;
  }
  let oldValue = state[clusterName][attribute];
  if (typeof oldValue === 'object') oldValue = deepCopy(oldValue);
  await endpoint.setStateOf(endpoint.behaviors.supported[clusterName], { [attribute]: value });
  log?.info(
    `${db}Set endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db} ` +
      `from ${YELLOW}${oldValue !== null && typeof oldValue === 'object' ? debugStringify(oldValue) : oldValue}${db} ` +
      `to ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${db}`,
  );
  return true;
}

/**
 * Sets the value of an attribute on a cluster server.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to update the attribute on.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to update the attribute on.
 * @param {string} attribute - The name of the attribute.
 * @param {boolean | number | bigint | string | object | null} value - The value to set for the attribute.
 * @param {AnsiLogger} [log] - (Optional) The logger to use for logging the update. Errors are logged to the endpoint logger.
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the attribute was successfully set.
 */
export async function updateAttribute(endpoint: MatterbridgeEndpoint, cluster: Behavior.Type | ClusterType | ClusterId | string, attribute: string, value: boolean | number | bigint | string | object | null, log?: AnsiLogger): Promise<boolean> {
  const clusterName = getBehavior(endpoint, cluster)?.id;
  if (!clusterName) {
    endpoint.log.error(`updateAttribute ${hk}${attribute}${er} error: cluster not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return false;
  }

  if (endpoint.construction.status !== Lifecycle.Status.Active) {
    endpoint.log.error(`updateAttribute ${hk}${clusterName}.${attribute}${er} error: Endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
    return false;
  }

  const state = endpoint.state as Record<string, Record<string, boolean | number | bigint | string | object | null>>;
  attribute = lowercaseFirstLetter(attribute);
  if (!(attribute in state[clusterName])) {
    endpoint.log.error(
      `updateAttribute error: Attribute ${hk}${attribute}${er} not found on cluster ${'0x' + getClusterId(endpoint, clusterName)?.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`,
    );
    return false;
  }
  let oldValue = state[clusterName][attribute];
  if (typeof oldValue === 'object') {
    if (deepEqual(oldValue, value)) return false;
    oldValue = deepCopy(oldValue);
  } else if (oldValue === value) return false;
  await endpoint.setStateOf(endpoint.behaviors.supported[clusterName], { [attribute]: value });
  log?.info(
    `${db}Update endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db} ` +
      `from ${YELLOW}${oldValue !== null && typeof oldValue === 'object' ? debugStringify(oldValue) : oldValue}${db} ` +
      `to ${YELLOW}${value !== null && typeof value === 'object' ? debugStringify(value) : value}${db}`,
  );
  return true;
}

/**
 * Subscribes to the provided attribute on a cluster.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to subscribe the attribute to.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The cluster to subscribe the attribute to.
 * @param {string} attribute - The name of the attribute to subscribe to.
 * @param {(newValue: any, oldValue: any, context: ActionContext) => void} listener - A callback function that will be called when the attribute value changes. When context.offline === true then the change is locally generated and not from the controller.
 * @param {AnsiLogger} [log] - Optional logger for logging errors and information.
 * @returns {boolean} - A boolean indicating whether the subscription was successful.
 *
 * @remarks The listener function (cannot be async) will receive three parameters:
 * - `newValue`: The new value of the attribute.
 * - `oldValue`: The old value of the attribute.
 * - `context`: The action context, which includes information about the action that triggered the change. When context.offline === true then the change is locally generated and not from the controller.
 */
export async function subscribeAttribute(
  endpoint: MatterbridgeEndpoint,
  cluster: Behavior.Type | ClusterType | ClusterId | string,
  attribute: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  listener: (newValue: any, oldValue: any, context: ActionContext) => void,
  log?: AnsiLogger,
): Promise<boolean> {
  const clusterName = getBehavior(endpoint, cluster)?.id;
  if (!clusterName) {
    endpoint.log.error(`subscribeAttribute ${hk}${attribute}${er} error: cluster not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return false;
  }

  if (endpoint.construction.status !== Lifecycle.Status.Active) {
    endpoint.log.debug(`subscribeAttribute ${hk}${clusterName}.${attribute}${db}: Endpoint ${or}${endpoint.maybeId}${db}:${or}${endpoint.maybeNumber}${db} is in the ${BLUE}${endpoint.construction.status}${db} state`);
    await endpoint.construction.ready;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = endpoint.events as Record<string, Record<string, any>>;
  attribute = lowercaseFirstLetter(attribute) + '$Changed';
  if (!(clusterName in events) || !(attribute in events[clusterName])) {
    endpoint.log.error(
      `subscribeAttribute error: Attribute ${hk}${attribute.replace('$Changed', '')}${er} not found on Cluster ${'0x' + getClusterId(endpoint, clusterName)?.toString(16).padStart(4, '0')}:${clusterName} on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`,
    );
    return false;
  }
  events[clusterName][attribute].on(listener);
  log?.info(`${db}Subscribed endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} attribute ${hk}${capitalizeFirstLetter(clusterName)}${db}.${hk}${attribute}${db}`);
  return true;
}

/**
 * Triggers an event on the specified cluster.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to trigger the event on.
 * @param {Behavior.Type | ClusterType | ClusterId | string} cluster - The ID of the cluster.
 * @param {string} event - The name of the event to trigger.
 * @param {Record<string, boolean | number | bigint | string | object | undefined | null>} payload - The payload to pass to the event.
 * @param {AnsiLogger} [log] - Optional logger for logging information.
 *
 * @returns {Promise<boolean>} - A promise that resolves to a boolean indicating whether the event was successfully triggered.
 */
export async function triggerEvent(
  endpoint: MatterbridgeEndpoint,
  cluster: Behavior.Type | ClusterType | ClusterId | string,
  event: string,
  payload: Record<string, boolean | number | bigint | string | object | undefined | null>,
  log?: AnsiLogger,
): Promise<boolean> {
  const clusterName = getBehavior(endpoint, cluster)?.id;
  if (!clusterName) {
    endpoint.log.error(`triggerEvent ${hk}${event}${er} error: cluster not found on endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er}`);
    return false;
  }

  if (endpoint.construction.status !== Lifecycle.Status.Active) {
    endpoint.log.error(`triggerEvent ${hk}${clusterName}.${event}${er} error: Endpoint ${or}${endpoint.maybeId}${er}:${or}${endpoint.maybeNumber}${er} is in the ${BLUE}${endpoint.construction.status}${er} state`);
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const events = endpoint.events as Record<string, Record<string, any>>;
  if (!(clusterName in events) || !(event in events[clusterName])) {
    endpoint.log.error(`triggerEvent ${hk}${event}${er} error: cluster ${clusterName} not found on endpoint ${or}${endpoint.id}${er}:${or}${endpoint.number}${er}`);
    return false;
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  await endpoint.act((agent) => agent[clusterName].events[event].emit(payload, agent.context));
  log?.info(`${db}Trigger event ${hk}${capitalizeFirstLetter(clusterName)}${db}.${hk}${event}${db} with ${debugStringify(payload)}${db} on endpoint ${or}${endpoint.id}${db}:${or}${endpoint.number}${db} `);
  return true;
}

/** Utility Cluster Helpers */

/**
 * Get the default power source wired cluster server options.
 *
 * @param {PowerSource.WiredCurrentType} wiredCurrentType - The type of wired current (default: PowerSource.WiredCurrentType.Ac)
 * @returns {Behavior.Options<PowerSourceClusterServer>} The options for the power source wired cluster server.
 *
 * @remarks
 * - order: The order of the power source is a persisted attribute that indicates the order in which the power sources are used.
 * - description: The description of the power source is a fixed attribute that describes the power source type.
 * - wiredCurrentType: The type of wired current is a fixed attribute that indicates the type of wired current used by the power source (AC or DC).
 */
export function getDefaultPowerSourceWiredClusterServer(wiredCurrentType: PowerSource.WiredCurrentType = PowerSource.WiredCurrentType.Ac) {
  return optionsFor(MatterbridgePowerSourceServer.with(PowerSource.Feature.Wired), {
    // Base attributes
    status: PowerSource.PowerSourceStatus.Active,
    order: 0,
    description: wiredCurrentType === PowerSource.WiredCurrentType.Ac ? 'AC Power' : 'DC Power',
    endpointList: [], // Will be filled by the MatterbridgePowerSourceServer
    // Wired feature attributes
    wiredCurrentType,
  });
}

/**
 * Get the default power source replaceable battery cluster server options.
 *
 * @param {number} batPercentRemaining - The remaining battery percentage (default: 100). The attribute is in the range 0-200.
 * @param {PowerSource.BatChargeLevel} batChargeLevel - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
 * @param {number} batVoltage - The battery voltage (default: 1500).
 * @param {string} batReplacementDescription - The description of the battery replacement (default: 'Battery type').
 * @param {number} batQuantity - The quantity of the battery (default: 1).
 * @param {PowerSource.BatReplaceability} batReplaceability - The replaceability of the battery (default: PowerSource.BatReplaceability.Unspecified).
 * @returns {Behavior.Options<PowerSourceClusterServer>} The options for the power source replaceable battery cluster server.
 *
 * @remarks
 * - order: The order of the power source is a persisted attribute that indicates the order in which the power sources are used.
 * - description: The description of the power source is a fixed attribute that describes the power source type.
 * - batReplaceability: The replaceability of the battery is a fixed attribute that indicates whether the battery is user-replaceable or not.
 * - batReplacementDescription: The description of the battery replacement is a fixed attribute that describes the battery type.
 * - batQuantity: The quantity of the battery is a fixed attribute that indicates how many batteries are present in the device.
 */
export function getDefaultPowerSourceReplaceableBatteryClusterServer(
  batPercentRemaining: number = 100,
  batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
  batVoltage: number = 1500,
  batReplacementDescription: string = 'Battery type',
  batQuantity: number = 1,
  batReplaceability: PowerSource.BatReplaceability = PowerSource.BatReplaceability.UserReplaceable,
) {
  return optionsFor(MatterbridgePowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Replaceable), {
    // Base attributes
    status: PowerSource.PowerSourceStatus.Active,
    order: 0,
    description: 'Primary battery',
    endpointList: [], // Will be filled by the MatterbridgePowerSourceServer
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
}

/**
 * Creates a default power source rechargeable battery cluster server.
 *
 * @param {number} [batPercentRemaining] - The remaining battery percentage (default: 100). The attribute is in the range 0-200.
 * @param {PowerSource.BatChargeLevel} [batChargeLevel] - The battery charge level (default: PowerSource.BatChargeLevel.Ok).
 * @param {number} [batVoltage] - The battery voltage in mV (default: 1500).
 * @param {PowerSource.BatReplaceability} [batReplaceability] - The replaceability of the battery (default: PowerSource.BatReplaceability.Unspecified).
 * @returns {Behavior.Options<PowerSourceClusterServer>} The options for the power source rechargeable battery cluster server.
 *
 * @remarks
 * - order: The order of the power source is a persisted attribute that indicates the order in which the power sources are used.
 * - description: The description of the power source is a fixed attribute that describes the power source type.
 * - batReplaceability: The replaceability of the battery is a fixed attribute that indicates whether the battery is user-replaceable or not.
 */
export function getDefaultPowerSourceRechargeableBatteryClusterServer(
  batPercentRemaining: number = 100,
  batChargeLevel: PowerSource.BatChargeLevel = PowerSource.BatChargeLevel.Ok,
  batVoltage: number = 1500,
  batReplaceability: PowerSource.BatReplaceability = PowerSource.BatReplaceability.Unspecified,
) {
  return optionsFor(MatterbridgePowerSourceServer.with(PowerSource.Feature.Battery, PowerSource.Feature.Rechargeable), {
    // Base attributes
    status: PowerSource.PowerSourceStatus.Active,
    order: 0,
    description: 'Primary battery',
    endpointList: [], // Will be filled by the MatterbridgePowerSourceServer
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
}

/**
 * Get the default Electrical Energy Measurement Cluster Server options with features ImportedEnergy, ExportedEnergy, and CumulativeEnergy.
 *
 * @param {number} energyImported - The total consumption value in mW/h.
 * @param {number} energyExported - The total production value in mW/h.
 * @returns {Behavior.Options<ElectricalEnergyMeasurementServer>} - The default options for the Electrical Energy Measurement Cluster Server.
 */
export function getDefaultElectricalEnergyMeasurementClusterServer(energyImported: number | bigint | null = null, energyExported: number | bigint | null = null) {
  return optionsFor(ElectricalEnergyMeasurementServer.with(ElectricalEnergyMeasurement.Feature.ImportedEnergy, ElectricalEnergyMeasurement.Feature.ExportedEnergy, ElectricalEnergyMeasurement.Feature.CumulativeEnergy), {
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
}

/**
 * Get the default Electrical Power Measurement Cluster Server options with features AlternatingCurrent.
 *
 * @param {number} voltage - The voltage value in millivolts.
 * @param {number} current - The current value in milliamperes.
 * @param {number} power - The power value in milliwatts.
 * @param {number} frequency - The frequency value in millihertz.
 * @returns {Behavior.Options<ElectricalPowerMeasurementServer>} - The default options for the Electrical Power Measurement Cluster Server.
 */
export function getDefaultElectricalPowerMeasurementClusterServer(voltage: number | bigint | null = null, current: number | bigint | null = null, power: number | bigint | null = null, frequency: number | bigint | null = null) {
  return optionsFor(ElectricalPowerMeasurementServer.with(ElectricalPowerMeasurement.Feature.AlternatingCurrent), {
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
}

/**
 * Get the default Electrical Apparent Power Measurement Cluster Server with features AlternatingCurrent.
 *
 * @param {number} voltage - The voltage value in millivolts.
 * @param {number} apparentCurrent - The current value in milliamperes.
 * @param {number} apparentPower - The apparent power value in millivoltamperes.
 * @param {number} frequency - The frequency value in millihertz.
 * @returns {Behavior.Options<ElectricalPowerMeasurementServer>} - The default options for the Electrical Apparent Power Measurement Cluster Server.
 */
export function getApparentElectricalPowerMeasurementClusterServer(voltage: number | bigint | null = null, apparentCurrent: number | bigint | null = null, apparentPower: number | bigint | null = null, frequency: number | bigint | null = null) {
  return optionsFor(ElectricalPowerMeasurementServer.with(ElectricalPowerMeasurement.Feature.AlternatingCurrent), {
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
        measurementType: MeasurementType.ApparentCurrent,
        measured: true,
        minMeasuredValue: Number.MIN_SAFE_INTEGER,
        maxMeasuredValue: Number.MAX_SAFE_INTEGER,
        accuracyRanges: [{ rangeMin: Number.MIN_SAFE_INTEGER, rangeMax: Number.MAX_SAFE_INTEGER, fixedMax: 1 }],
      },
      {
        measurementType: MeasurementType.ApparentPower,
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
    apparentCurrent: apparentCurrent,
    apparentPower: apparentPower,
    frequency: frequency,
  });
}

/**
 * Get the default Device Energy Management Cluster Server with feature PowerForecastReporting and with the specified ESA type, ESA canGenerate, ESA state, and power limits.
 *
 * @param {DeviceEnergyManagement.EsaType} [esaType] - The ESA type. Defaults to `DeviceEnergyManagement.EsaType.Other`.
 * @param {boolean} [esaCanGenerate] - Indicates if the ESA can generate energy. Defaults to `false`.
 * @param {DeviceEnergyManagement.EsaState} [esaState] - The ESA state. Defaults to `DeviceEnergyManagement.EsaState.Online`.
 * @param {number} [absMinPower] - Indicate the minimum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
 * @param {number} [absMaxPower] - Indicate the maximum electrical power in mw that the ESA can consume when switched on. Defaults to `0` if not provided.
 * @returns {Behavior.Options<DeviceEnergyManagementClusterServer>} - The default options for the Device Energy Management Cluster Server.
 *
 * @remarks
 * - The forecast attribute is set to null, indicating that there is no forecast currently available.
 * - The ESA type and canGenerate attributes are fixed and cannot be changed after creation.
 * - The ESA state is set to Online by default.
 * - The absolute minimum and maximum power attributes are set to 0 by default.
 * - For example, a battery storage inverter that can charge its battery at a maximum power of 2000W and can
 * discharge the battery at a maximum power of 3000W, would have a absMinPower: -3000W, absMaxPower: 2000W.
 */
export function getDefaultDeviceEnergyManagementClusterServer(
  esaType: DeviceEnergyManagement.EsaType = DeviceEnergyManagement.EsaType.Other,
  esaCanGenerate: boolean = false,
  esaState: DeviceEnergyManagement.EsaState = DeviceEnergyManagement.EsaState.Online,
  absMinPower: number = 0,
  absMaxPower: number = 0,
) {
  return optionsFor(MatterbridgeDeviceEnergyManagementServer.with(DeviceEnergyManagement.Feature.PowerForecastReporting, DeviceEnergyManagement.Feature.PowerAdjustment), {
    esaType, // Fixed attribute
    esaCanGenerate, // Fixed attribute
    esaState,
    absMinPower,
    absMaxPower,
    // PowerAdjustment feature (commands: powerAdjustRequest and cancelPowerAdjustRequest events: powerAdjustStart and powerAdjustEnd)
    powerAdjustmentCapability: null, // A null value indicates that no power adjustment is currently possible, and nor is any adjustment currently active
    optOutState: DeviceEnergyManagement.OptOutState.NoOptOut,
    // PowerForecastReporting
    forecast: null, // A null value indicates that there is no forecast currently available
  });
}

/**
 * Get the default EnergyManagementMode Cluster Server.
 *
 * @param {number} [currentMode] - The current mode of the EnergyManagementMode cluster. Defaults to mode 1 (DeviceEnergyManagementMode.ModeTag.NoOptimization).
 * @param {EnergyManagementMode.ModeOption[]} [supportedModes] - The supported modes for the DeviceEnergyManagementMode cluster. The attribute is fixed and defaults to a predefined set of cluster modes.
 * @returns {Behavior.Options<DeviceEnergyManagementModeClusterServer>} - The default options for the Device Energy Management Mode cluster server.
 *
 * @remarks
 * A few examples of Device Energy Management modes and their mode tags are provided below.
 *  - For the "No Energy Management (Forecast reporting only)" mode, tags: 0x4000 (NoOptimization).
 *  - For the "Device Energy Management" mode, tags: 0x4001 (DeviceOptimization).
 *  - For the "Home Energy Management" mode, tags: 0x4001 (DeviceOptimization), 0x4002 (LocalOptimization).
 *  - For the "Grid Energy Management" mode, tags: 0x4003 (GridOptimization).
 *  - For the "Full Energy Management" mode, tags: 0x4001 (DeviceOptimization), 0x4002 (LocalOptimization), 0x4003 (GridOptimization).
 */
export function getDefaultDeviceEnergyManagementModeClusterServer(currentMode?: number, supportedModes?: DeviceEnergyManagementMode.ModeOption[]) {
  return optionsFor(MatterbridgeDeviceEnergyManagementModeServer, {
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
}

/** Application Cluster Helpers */

/**
 * Get the default OperationalState Cluster Server.
 *
 * @param {OperationalState.OperationalStateEnum} operationalState - The initial operational state id.
 * @returns {Behavior.Options<MatterbridgeOperationalStateServer>} - The default options for the OperationalState cluster server.
 *
 * @remarks
 * This method adds a cluster server with a default operational state configuration:
 * - { operationalStateId: OperationalState.OperationalStateEnum.Stopped, operationalStateLabel: 'Stopped' },
 * - { operationalStateId: OperationalState.OperationalStateEnum.Running, operationalStateLabel: 'Running' },
 * - { operationalStateId: OperationalState.OperationalStateEnum.Paused, operationalStateLabel: 'Paused' },
 * - { operationalStateId: OperationalState.OperationalStateEnum.Error, operationalStateLabel: 'Error' },
 */
export function getDefaultOperationalStateClusterServer(operationalState: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Stopped) {
  return optionsFor(MatterbridgeOperationalStateServer, {
    phaseList: [],
    currentPhase: null,
    countdownTime: null,
    operationalStateList: [
      { operationalStateId: OperationalState.OperationalStateEnum.Stopped, operationalStateLabel: 'Stopped' },
      { operationalStateId: OperationalState.OperationalStateEnum.Running, operationalStateLabel: 'Running' },
      { operationalStateId: OperationalState.OperationalStateEnum.Paused, operationalStateLabel: 'Paused' },
      { operationalStateId: OperationalState.OperationalStateEnum.Error, operationalStateLabel: 'Error' },
    ],
    operationalState,
    operationalError: { errorStateId: OperationalState.ErrorState.NoError, errorStateLabel: 'No error', errorStateDetails: 'Fully operational' },
  });
}

/**
 * Get the default TemperatureMeasurement cluster server options.
 *
 * @param {number | null} measuredValue - The measured value of the temperature x 100.
 * @param {number | null} minMeasuredValue - The minimum measured value of the temperature x 100.
 * @param {number | null} maxMeasuredValue - The maximum measured value of the temperature x 100.
 * @returns {Behavior.Options<MatterbridgeTemperatureMeasurementServer>} - The default options for the TemperatureMeasurement cluster server.
 */
export function getDefaultTemperatureMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
  return optionsFor(TemperatureMeasurementServer, {
    measuredValue,
    minMeasuredValue,
    maxMeasuredValue,
    tolerance: 0,
  });
}

/**
 * Get the default RelativeHumidityMeasurement cluster server options.
 *
 * @param {number | null} measuredValue - The measured value of the relative humidity x 100.
 * @param {number | null} minMeasuredValue - The minimum measured value of the relative humidity x 100.
 * @param {number | null} maxMeasuredValue - The maximum measured value of the relative humidity x 100.
 * @returns {Behavior.Options<MatterbridgeRelativeHumidityMeasurementServer>} - The default options for the RelativeHumidityMeasurement cluster server.
 */
export function getDefaultRelativeHumidityMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
  return optionsFor(RelativeHumidityMeasurementServer, {
    measuredValue,
    minMeasuredValue,
    maxMeasuredValue,
    tolerance: 0,
  });
}

/**
 * Get the default PressureMeasurement cluster server options.
 *
 * @param {number | null} measuredValue - The measured value for the pressure in kPa x 10.
 * @param {number | null} minMeasuredValue - The minimum measured value for the pressure in kPa x 10.
 * @param {number | null} maxMeasuredValue - The maximum measured value for the pressure in kPa x 10.
 * @returns {Behavior.Options<MatterbridgePressureMeasurementServer>} - The default options for the PressureMeasurement cluster server.
 */
export function getDefaultPressureMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
  return optionsFor(PressureMeasurementServer, {
    measuredValue,
    minMeasuredValue,
    maxMeasuredValue,
    tolerance: 0,
  });
}

/**
 * Get the default IlluminanceMeasurement cluster server options.
 *
 * @param {number | null} measuredValue - The measured value of illuminance.
 * @param {number | null} minMeasuredValue - The minimum measured value of illuminance.
 * @param {number | null} maxMeasuredValue - The maximum measured value of illuminance.
 * @returns {Behavior.Options<MatterbridgeIlluminanceMeasurementServer>} - The default options for the IlluminanceMeasurement cluster server.
 *
 * @remarks The default value for the illuminance measurement is null.
 * This attribute SHALL indicate the illuminance in Lux (symbol lx) as follows:
 * •  MeasuredValue = 10,000 x log10(illuminance) + 1,
 *    where 1 lx <= illuminance <= 3.576 Mlx, corresponding to a MeasuredValue in the range 1 to 0xFFFE.
 * • 0 indicates a value of illuminance that is too low to be measured
 * • null indicates that the illuminance measurement is invalid.
 */
export function getDefaultIlluminanceMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
  return optionsFor(IlluminanceMeasurementServer, {
    measuredValue,
    minMeasuredValue,
    maxMeasuredValue,
    tolerance: 0,
  });
}

/**
 * Get the default FlowMeasurement cluster server options.
 *
 * @param {number | null} measuredValue - The measured value of the flow in 10 x m3/h.
 * @param {number | null} minMeasuredValue - The minimum measured value of the flow in 10 x m3/h.
 * @param {number | null} maxMeasuredValue - The maximum measured value of the flow in 10 x m3/h.
 * @returns {Behavior.Options<MatterbridgeFlowMeasurementServer>} - The default options for the FlowMeasurement cluster server.
 */
export function getDefaultFlowMeasurementClusterServer(measuredValue: number | null = null, minMeasuredValue: number | null = null, maxMeasuredValue: number | null = null) {
  return optionsFor(FlowMeasurementServer, {
    measuredValue,
    minMeasuredValue,
    maxMeasuredValue,
    tolerance: 0,
  });
}

/**
 * Get the default OccupancySensing cluster server options.
 *
 * @param {boolean} occupied - A boolean indicating whether the occupancy is occupied or not. Default is false.
 * @param {number} holdTime - The hold time in seconds. Default is 30.
 * @param {number} holdTimeMin - The minimum hold time in seconds. Default is 1.
 * @param {number} holdTimeMax - The maximum hold time in seconds. Default is 300.
 * @returns {Behavior.Options<MatterbridgeOccupancySensingServer>} - The default options for the OccupancySensing cluster server.
 *
 * @remarks The default value for the occupancy sensor type is PIR.
 * Servers SHALL set these attributes for backward compatibility with clients implementing a cluster revision <= 4 as
 * described in OccupancySensorType and OccupancySensorTypeBitmap Attributes.
 * This replaces the 9 legacy attributes PIROccupiedToUnoccupiedDelay through PhysicalContactUnoccupiedToOccupiedThreshold.
 */
export function getDefaultOccupancySensingClusterServer(occupied = false, holdTime = 30, holdTimeMin = 1, holdTimeMax = 300) {
  return optionsFor(OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared), {
    occupancy: { occupied },
    occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
    occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
    pirOccupiedToUnoccupiedDelay: holdTime,
    pirUnoccupiedToOccupiedDelay: holdTime,
    holdTime,
    holdTimeLimits: { holdTimeMin, holdTimeMax, holdTimeDefault: holdTime },
  });
}
