// src\matterbridgeEndpointHelpers.ts

// @matter
import { ActionContext, Behavior, ClusterBehavior, ClusterId, Endpoint, Lifecycle } from '@matter/main';
import { ClusterType, getClusterNameById } from '@matter/main/types';

// @matter clusters
import { PowerSource } from '@matter/main/clusters/power-source';
import { UserLabel } from '@matter/main/clusters/user-label';
import { FixedLabel } from '@matter/main/clusters/fixed-label';
import { BasicInformation } from '@matter/main/clusters/basic-information';
import { BridgedDeviceBasicInformation } from '@matter/main/clusters/bridged-device-basic-information';
import { Identify } from '@matter/main/clusters/identify';
import { Groups } from '@matter/main/clusters/groups';
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
import { BooleanState } from '@matter/main/clusters/boolean-state';
import { BooleanStateConfiguration } from '@matter/main/clusters/boolean-state-configuration';
import { PowerTopology } from '@matter/main/clusters/power-topology';
import { ElectricalPowerMeasurement } from '@matter/main/clusters/electrical-power-measurement';
import { ElectricalEnergyMeasurement } from '@matter/main/clusters/electrical-energy-measurement';
import { TemperatureMeasurement } from '@matter/main/clusters/temperature-measurement';
import { RelativeHumidityMeasurement } from '@matter/main/clusters/relative-humidity-measurement';
import { PressureMeasurement } from '@matter/main/clusters/pressure-measurement';
import { FlowMeasurement } from '@matter/main/clusters/flow-measurement';
import { IlluminanceMeasurement } from '@matter/main/clusters/illuminance-measurement';
import { OccupancySensing } from '@matter/main/clusters/occupancy-sensing';
import { AirQuality } from '@matter/main/clusters/air-quality';
import { CarbonMonoxideConcentrationMeasurement } from '@matter/main/clusters/carbon-monoxide-concentration-measurement';
import { CarbonDioxideConcentrationMeasurement } from '@matter/main/clusters/carbon-dioxide-concentration-measurement';
import { NitrogenDioxideConcentrationMeasurement } from '@matter/main/clusters/nitrogen-dioxide-concentration-measurement';
import { OzoneConcentrationMeasurement } from '@matter/main/clusters/ozone-concentration-measurement';
import { FormaldehydeConcentrationMeasurement } from '@matter/main/clusters/formaldehyde-concentration-measurement';
import { Pm1ConcentrationMeasurement } from '@matter/main/clusters/pm1-concentration-measurement';
import { Pm25ConcentrationMeasurement } from '@matter/main/clusters/pm25-concentration-measurement';
import { Pm10ConcentrationMeasurement } from '@matter/main/clusters/pm10-concentration-measurement';
import { RadonConcentrationMeasurement } from '@matter/main/clusters/radon-concentration-measurement';
import { TotalVolatileOrganicCompoundsConcentrationMeasurement } from '@matter/main/clusters/total-volatile-organic-compounds-concentration-measurement';
import { OperationalState } from '@matter/main/clusters/operational-state';

// @matter behaviors
import { PowerSourceServer } from '@matter/main/behaviors/power-source';
import { UserLabelServer } from '@matter/main/behaviors/user-label';
import { FixedLabelServer } from '@matter/main/behaviors/fixed-label';
import { BasicInformationServer } from '@matter/main/behaviors/basic-information';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors/bridged-device-basic-information';
import { GroupsServer } from '@matter/main/behaviors/groups';
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

// Other modules
import { createHash } from 'node:crypto';
import { AnsiLogger, BLUE, CYAN, db, debugStringify, er, hk, or, YELLOW, zb } from 'node-ansi-logger';

// Matterbridge
import { deepCopy, deepEqual, isValidArray } from './utils/export.js';
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
} from './matterbridgeBehaviors.js';

export function capitalizeFirstLetter(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function lowercaseFirstLetter(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

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

export function generateUniqueId(deviceName: string): string {
  return createHash('md5').update(deviceName).digest('hex'); // MD5 hash of the device name
}

export function createUniqueId(param1: string, param2: string, param3: string, param4: string) {
  const hash = createHash('md5');
  hash.update(param1 + param2 + param3 + param4);
  return hash.digest('hex');
}

export function getBehaviourTypesFromClusterServerIds(clusterServerList: ClusterId[]) {
  // Map Server ClusterId to Behavior.Type
  const behaviorTypes: Behavior.Type[] = [];
  clusterServerList.forEach((clusterId) => {
    behaviorTypes.push(getBehaviourTypeFromClusterServerId(clusterId));
  });
  return behaviorTypes;
}

export function getBehaviourTypesFromClusterClientIds(clusterClientList: ClusterId[]) {
  // Map Client ClusterId to Behavior.Type
  const behaviorTypes: Behavior.Type[] = [];
  clusterClientList.forEach((_clusterId) => {
    // behaviorTypes.push(getBehaviourTypeFromClusterClientId(clusterId));
  });
  return behaviorTypes;
}

export function getBehaviourTypeFromClusterServerId(clusterId: ClusterId) {
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

  return MatterbridgeIdentifyServer;
}

export function getBehaviourTypeFromClusterClientId(_clusterId: ClusterId) {
  // Map ClusterId to Client Behavior.Type
  // return IdentifyClient;
}

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

export function addRequiredClusterServers(endpoint: MatterbridgeEndpoint) {
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

export function addOptionalClusterServers(endpoint: MatterbridgeEndpoint) {
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
 * @returns void
 */
export function addClusterServers(endpoint: MatterbridgeEndpoint, serverList: ClusterId[]): void {
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
  // if (serverList.includes(DeviceEnergyManagement.Cluster.id)) endpoint.createDefaultDeviceEnergyManagementClusterServer();
  // if (serverList.includes(DeviceEnergyManagementMode.Cluster.id)) endpoint.createDefaultDeviceEnergyManagementModeClusterServer();
}

/**
 * Adds a fixed label to the FixedLabel cluster. The FixedLabel cluster is created if it does not exist.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the cluster servers to.
 * @param {string} label - The label to add.
 * @param {string} value - The value of the label.
 */
export async function addFixedLabel(endpoint: MatterbridgeEndpoint, label: string, value: string) {
  if (!endpoint.hasClusterServer(FixedLabel.Cluster.id)) {
    endpoint.log.debug(`addFixedLabel: add cluster ${hk}FixedLabel${db}:${hk}fixedLabel${db} with label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
    endpoint.behaviors.require(FixedLabelServer, {
      labelList: [{ label, value }],
    });
    return;
  }
  endpoint.log.debug(`addFixedLabel: add label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
  let labelList = endpoint.getAttribute(FixedLabel.Cluster.id, 'labelList', endpoint.log) as { label: string; value: string }[];
  if (isValidArray(labelList)) {
    labelList = labelList.filter((entry) => entry.label !== label);
    labelList.push({ label, value });
    await endpoint.setAttribute(FixedLabel.Cluster.id, 'labelList', labelList, endpoint.log);
  }
}

/**
 * Adds a user label to the UserLabel cluster. The UserLabel cluster is created if it does not exist.
 *
 * @param {MatterbridgeEndpoint} endpoint - The endpoint to add the cluster servers to.
 * @param {string} label - The label to add.
 * @param {string} value - The value of the label.
 */
export async function addUserLabel(endpoint: MatterbridgeEndpoint, label: string, value: string) {
  if (!endpoint.hasClusterServer(UserLabel.Cluster.id)) {
    endpoint.log.debug(`addUserLabel: add cluster ${hk}UserLabel${db}:${hk}userLabel${db} with label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
    endpoint.behaviors.require(UserLabelServer, {
      labelList: [{ label, value }],
    });
    return;
  }
  endpoint.log.debug(`addUserLabel: add label ${CYAN}${label}${db} value ${CYAN}${value}${db}`);
  let labelList = endpoint.getAttribute(UserLabel.Cluster.id, 'labelList', endpoint.log) as { label: string; value: string }[];
  if (isValidArray(labelList)) {
    labelList = labelList.filter((entry) => entry.label !== label);
    labelList.push({ label, value });
    await endpoint.setAttribute(UserLabel.Cluster.id, 'labelList', labelList, endpoint.log);
  }
}

export function optionsFor<T extends Behavior.Type>(type: T, options: Behavior.Options<T>) {
  return options;
}

export function getClusterId(endpoint: Endpoint, cluster: string) {
  return endpoint.behaviors.supported[lowercaseFirstLetter(cluster)]?.schema?.id;
}

export function getAttributeId(endpoint: Endpoint, cluster: string, attribute: string) {
  const clusterBehavior = endpoint.behaviors.supported[lowercaseFirstLetter(cluster)] as ClusterBehavior.Type | undefined;
  return clusterBehavior?.cluster.attributes[lowercaseFirstLetter(attribute)]?.id;
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
 * @param {ClusterId} clusterId - The ID of the cluster.
 * @param {string} event - The name of the event to trigger.
 * @param {Record<string, boolean | number | bigint | string | object | undefined | null>} payload - The payload to pass to the event.
 * @param {AnsiLogger} [log] - Optional logger for logging information.
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

/**
 * Get the default OperationalState Cluster Server.
 *
 * @param {OperationalState.OperationalStateEnum} operationalState - The initial operational state.
 */
export function getDefaultOperationalStateClusterServer(operationalState: OperationalState.OperationalStateEnum = OperationalState.OperationalStateEnum.Stopped) {
  return optionsFor(MatterbridgeOperationalStateServer, {
    phaseList: [],
    currentPhase: null,
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
 * @param {number | null} measuredValue - The measured value for the pressure.
 * @param {number | null} minMeasuredValue - The minimum measured value for the pressure.
 * @param {number | null} maxMeasuredValue - The maximum measured value for the pressure.
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
 * @remark The default value for the illuminance measurement is null.
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
 *
 * @remark The default value for the occupancy sensor type is PIR.
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
