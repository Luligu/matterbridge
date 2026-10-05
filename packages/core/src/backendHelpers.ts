/**
 * @file packages/core/src/backendHelpers.ts
 * @description This file contains the helper functions of the Backend.
 * @author Luca Liguori
 * @created 2026-10-05
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

/* oxlint-disable complexity */
/* oxlint-disable typescript/restrict-template-expressions */
/* oxlint-disable typescript/no-base-to-string */
/* oxlint-disable typescript/no-unsafe-type-assertion */
/* oxlint-disable typescript/non-nullable-type-assertion-style */

import { Lifecycle } from '@matter/general';
// @matter
import { ServerNode, type SessionsBehavior } from '@matter/node';
import type { ExposedFabricInformation } from '@matter/protocol';
import { getClusterNameById } from '@matter/types/cluster';
import { AirQuality } from '@matter/types/clusters/air-quality';
import type { Binding } from '@matter/types/clusters/binding';
import { BridgedDeviceBasicInformation } from '@matter/types/clusters/bridged-device-basic-information';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { FanControl } from '@matter/types/clusters/fan-control';
import { FixedLabel } from '@matter/types/clusters/fixed-label';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { RvcOperationalState } from '@matter/types/clusters/rvc-operational-state';
import { SmokeCoAlarm } from '@matter/types/clusters/smoke-co-alarm';
import { SoilMeasurement } from '@matter/types/clusters/soil-measurement';
import { UserLabel } from '@matter/types/clusters/user-label';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
import type { ClusterId } from '@matter/types/datatype';
import { ThreeLevelAuto } from '@matter/types/globals';
import type { ApiMatter, SanitizedExposedFabricInformation, SanitizedSession } from '@matterbridge/types';
// @matterbridge
import { getEnumDescription } from '@matterbridge/utils/enum';
import { isValidArray, isValidNumber, isValidObject } from '@matterbridge/utils/validate';
// Third-party modules
import { stringify } from 'node-ansi-logger';

// matterbridge
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { featuresFor, getAttribute } from './matterbridgeEndpointHelpers.js';

/** Advertising nodes map: time advertising started keyed by storeId */
const advertisingNodes = new Map<string, number>();

/**
 * Retrieves the reachable attribute.
 *
 * @param {MatterbridgeEndpoint} device - The MatterbridgeEndpoint object.
 * @returns {boolean} The reachable attribute.
 */
export function getReachability(device: MatterbridgeEndpoint): boolean {
  if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return false;

  // Normal case of bridged endpoints
  if (device.hasClusterServer(BridgedDeviceBasicInformation.id)) return device.getAttribute(BridgedDeviceBasicInformation, 'reachable') as boolean;
  // Device with server mode
  if (device.mode === 'server' && device.serverNode?.state.basicInformation.reachable !== undefined) return device.serverNode.state.basicInformation.reachable;
  // Device with matter mode, added directly to a server node or accessory plugin in childbridge mode
  const owner = device.ownerOfType(ServerNode.RootEndpoint);
  if (owner?.state.basicInformation.reachable !== undefined) return owner.state.basicInformation.reachable;
  return false;
}

/**
 * Retrieves the power source attribute.
 *
 * @param {MatterbridgeEndpoint} endpoint - The MatterbridgeDevice to retrieve the power source from.
 * @returns {'ac' | 'dc' | 'ok' | 'warning' | 'critical' | undefined} The power source attribute.
 */
export function getPowerSource(endpoint: MatterbridgeEndpoint): 'ac' | 'dc' | 'ok' | 'warning' | 'critical' | undefined {
  if (!endpoint.lifecycle.isReady || endpoint.construction.status !== Lifecycle.Status.Active) return undefined;

  const powerSource = (device: MatterbridgeEndpoint): 'ac' | 'dc' | 'ok' | 'warning' | 'critical' | undefined => {
    const featureMap = featuresFor(device, PowerSource);
    if (featureMap.wired) {
      const wiredCurrentType = device.getAttribute(PowerSource.id, 'wiredCurrentType') as PowerSource.WiredCurrentType;
      return ['ac', 'dc'][wiredCurrentType] as 'ac' | 'dc' | undefined;
    }
    if (featureMap.battery) {
      const batChargeLevel = device.getAttribute(PowerSource.id, 'batChargeLevel') as PowerSource.BatChargeLevel;
      return ['ok', 'warning', 'critical'][batChargeLevel] as 'ok' | 'warning' | 'critical' | undefined;
    }
    return undefined;
  };

  // Root endpoint
  if (endpoint.hasClusterServer(PowerSource.id)) return powerSource(endpoint);
  // Child endpoints
  for (const child of endpoint.getChildEndpoints()) {
    if (child.hasClusterServer(PowerSource.id)) return powerSource(child);
  }
  return undefined;
}

/**
 * Retrieves the battery level attribute.
 *
 * @param {MatterbridgeEndpoint} endpoint - The MatterbridgeDevice to retrieve the battery level from.
 * @returns {number | undefined} The battery level attribute.
 */
export function getBatteryLevel(endpoint: MatterbridgeEndpoint): number | undefined {
  if (!endpoint.lifecycle.isReady || endpoint.construction.status !== Lifecycle.Status.Active) return undefined;

  const batteryLevel = (device: MatterbridgeEndpoint): number | undefined => {
    const featureMap = featuresFor(device, PowerSource);
    if (featureMap.battery) {
      const batChargeLevel = device.getAttribute(PowerSource, 'batPercentRemaining');
      return isValidNumber(batChargeLevel, 0, 200) ? batChargeLevel / 2 : undefined;
    }
    return undefined;
  };

  // Root endpoint
  if (endpoint.hasClusterServer(PowerSource.id)) return batteryLevel(endpoint);
  // Child endpoints
  for (const child of endpoint.getChildEndpoints()) {
    if (child.hasClusterServer(PowerSource.id)) return batteryLevel(child);
  }
  return undefined;
}

/**
 * Retrieves the cluster text description from a given device.
 * The output is a string with the attributes description of the cluster servers in the device to show in the frontend.
 *
 * @param {MatterbridgeEndpoint} device - The MatterbridgeEndpoint to retrieve the cluster text from.
 * @returns {string} The attributes description of the cluster servers in the device.
 */
export function getClusterTextFromDevice(device: MatterbridgeEndpoint): string {
  if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return '';

  let attributes = '';
  let supportedModes: { label: string; mode: number }[] = [];

  const getUserLabel = (device: MatterbridgeEndpoint): string => {
    const labelList = getAttribute(device, UserLabel, 'labelList') as { label: string; value: string }[];
    if (labelList) {
      const composed = labelList.find((entry) => entry.label === 'composed');
      if (composed) return 'Composed: ' + composed.value;
    }
    return '';
  };

  const getFixedLabel = (device: MatterbridgeEndpoint): string => {
    const labelList = getAttribute(device, FixedLabel, 'labelList') as { label: string; value: string }[];
    if (labelList) {
      const composed = labelList.find((entry) => entry.label === 'composed');
      if (composed) return 'Composed: ' + composed.value;
    }
    return '';
  };

  const getMeasurementText = (value: unknown, scale: number, unit: string): string => {
    if (value === null) return 'unknown';
    if (isValidNumber(value) || typeof value === 'bigint') return `${Number(value) / scale}${unit}`;
    return '';
  };

  const getEnergyText = (value: unknown): string => {
    if (value === null) return 'unknown';
    if (isValidObject(value) && 'energy' in value && (isValidNumber(value.energy) || typeof value.energy === 'bigint')) return `${Number(value.energy) / 1_000_000}kWh`;
    return '';
  };

  const appendMeasurement = (label: string, value: string): void => {
    if (value) attributes += `${label}: ${value} `;
  };

  device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
    // console.log(`${device.deviceName} => Cluster: ${clusterName}-${clusterId} Attribute: ${attributeName}-${attributeId} Value(${typeof attributeValue}): ${attributeValue}`);
    if (typeof attributeValue === 'undefined' || attributeValue === undefined) return;
    if (clusterName === 'descriptor' && attributeName === 'clientList' && isValidArray(attributeValue, 1))
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      attributes += `Client cluster(s): [${(attributeValue as ClusterId[]).map((id) => getClusterNameById(id)).join(', ')}] `;
    if (clusterName === 'binding' && attributeName === 'binding' && isValidArray(attributeValue)) {
      if (attributeValue.length === 0) attributes += `Bound cluster(s): none `;
      else {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const targets = attributeValue as Binding.Target[];
        const formatted = targets.map((target) => {
          const parts: string[] = [];
          if (target.node !== undefined) parts.push(`node: ${target.node}`);
          if (target.group !== undefined) parts.push(`group: ${target.group}`);
          if (target.endpoint !== undefined) parts.push(`endpoint: ${target.endpoint}`);
          if (target.cluster !== undefined) parts.push(`cluster: ${getClusterNameById(target.cluster)}`);
          if (target.fabricIndex !== undefined) parts.push(`fabricIndex: ${target.fabricIndex}`);
          return `[${parts.join(', ')}]`;
        });
        attributes += `Bound cluster(s): ${formatted.join(' ')} `;
      }
    }
    if (clusterName === 'onOff' && attributeName === 'onOff') attributes += `OnOff: ${attributeValue} `;
    if (clusterName === 'switch' && attributeName === 'currentPosition') attributes += `Position: ${attributeValue} `;
    if (clusterName === 'windowCovering' && attributeName === 'currentPositionLiftPercent100ths' && isValidNumber(attributeValue, 0, 10000))
      attributes += `Cover position: ${attributeValue / 100}% `;
    if (clusterName === 'doorLock' && attributeName === 'lockState') attributes += `State: ${attributeValue === 1 ? 'Locked' : 'Not locked'} `;
    if (clusterName === 'closureControl' && attributeName === 'overallCurrentState' && attributeValue === null)
      attributes += `Position: unknown Latch: unknown Speed: unknown SecureState: unknown `;
    if (clusterName === 'closureControl' && attributeName === 'overallCurrentState' && isValidObject(attributeValue)) {
      const overallCurrentState = attributeValue as ClosureControl.OverallCurrentState;
      attributes += `Position: ${getEnumDescription(ClosureControl.CurrentPosition, overallCurrentState.position, { fallback: 'unknown' })} `;
      if (overallCurrentState.latch !== undefined) attributes += `Latch: ${overallCurrentState.latch} `;
      if (overallCurrentState.speed !== undefined) attributes += `Speed: ${getEnumDescription(ThreeLevelAuto, overallCurrentState.speed)} `;
      attributes += `SecureState: ${overallCurrentState.secureState ?? 'unknown'} `;
    }
    if (clusterName === 'thermostat' && attributeName === 'localTemperature' && isValidNumber(attributeValue)) attributes += `Temperature: ${attributeValue / 100}°C `;
    if (clusterName === 'thermostat' && attributeName === 'occupiedHeatingSetpoint' && isValidNumber(attributeValue)) attributes += `Heat to: ${attributeValue / 100}°C `;
    if (clusterName === 'thermostat' && attributeName === 'occupiedCoolingSetpoint' && isValidNumber(attributeValue)) attributes += `Cool to: ${attributeValue / 100}°C `;

    const modeClusters = new Set(['modeSelect', 'rvcRunMode', 'rvcCleanMode', 'laundryWasherMode', 'ovenMode', 'microwaveOvenMode', 'deviceEnergyManagementMode']);
    if (modeClusters.has(clusterName) && attributeName === 'supportedModes') {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      supportedModes = attributeValue as { label: string; mode: number }[];
    }
    if (modeClusters.has(clusterName) && attributeName === 'currentMode') {
      const supportedMode = supportedModes.find((mode) => mode.mode === attributeValue);
      if (supportedMode) attributes += `Mode: ${supportedMode.label} `;
    }
    if (clusterName === 'operationalState' && attributeName === 'operationalState')
      attributes += `OpState: ${getEnumDescription(OperationalState.OperationalStateEnum, attributeValue as OperationalState.OperationalStateEnum)} `;
    if (clusterName === 'rvcOperationalState' && attributeName === 'operationalState')
      attributes += `OpState: ${getEnumDescription(RvcOperationalState.OperationalState, attributeValue as RvcOperationalState.OperationalState)} `;

    if (clusterName === 'pumpConfigurationAndControl' && attributeName === 'operationMode') attributes += `Mode: ${attributeValue} `;

    if (clusterName === 'valveConfigurationAndControl' && attributeName === 'currentState')
      attributes += `State: ${getEnumDescription(ValveConfigurationAndControl.ValveState, attributeValue as ValveConfigurationAndControl.ValveState, { fallback: 'unknown' })} `;

    if (clusterName === 'levelControl' && attributeName === 'currentLevel') attributes += `Level: ${attributeValue} `;

    if (clusterName === 'applicationBasic' && attributeName === 'applicationName') attributes += `App: ${attributeValue} `;

    if (clusterName === 'colorControl' && attributeName === 'colorMode' && isValidNumber(attributeValue, 0, 2)) attributes += `Mode: ${['HS', 'XY', 'CT'][attributeValue]} `;
    if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 0 && attributeName === 'currentHue' && isValidNumber(attributeValue))
      attributes += `Hue: ${Math.round(attributeValue)} `;
    if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 0 && attributeName === 'currentSaturation' && isValidNumber(attributeValue))
      attributes += `Saturation: ${Math.round(attributeValue)} `;
    if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 1 && attributeName === 'currentX' && isValidNumber(attributeValue))
      attributes += `X: ${Math.round(attributeValue / 655.36) / 100} `;
    if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 1 && attributeName === 'currentY' && isValidNumber(attributeValue))
      attributes += `Y: ${Math.round(attributeValue / 655.36) / 100} `;
    if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 2 && attributeName === 'colorTemperatureMireds' && isValidNumber(attributeValue))
      attributes += `ColorTemp: ${Math.round(attributeValue)} `;

    if (clusterName === 'booleanState' && attributeName === 'stateValue') attributes += `Contact: ${attributeValue} `;
    if (clusterName === 'booleanStateConfiguration' && attributeName === 'alarmsActive' && isValidObject(attributeValue))
      attributes += `Active alarms: ${stringify(attributeValue)} `;

    if (clusterName === 'smokeCoAlarm' && attributeName === 'smokeState')
      attributes += `Smoke: ${getEnumDescription(SmokeCoAlarm.AlarmState, attributeValue as SmokeCoAlarm.AlarmState)} `;
    if (clusterName === 'smokeCoAlarm' && attributeName === 'coState')
      attributes += `Co: ${getEnumDescription(SmokeCoAlarm.AlarmState, attributeValue as SmokeCoAlarm.AlarmState)} `;

    if (clusterName === 'fanControl' && attributeName === 'fanMode') attributes += `Mode: ${getEnumDescription(FanControl.FanMode, attributeValue as FanControl.FanMode)} `;
    if (clusterName === 'fanControl' && attributeName === 'percentCurrent') attributes += `Percent: ${attributeValue}% `;
    if (clusterName === 'fanControl' && attributeName === 'speedCurrent') attributes += `Speed: ${attributeValue} `;
    if (clusterName === 'fanControl' && attributeName === 'rockSetting' && isValidObject(attributeValue)) attributes += `Rock: ${stringify(attributeValue)} `;
    if (clusterName === 'fanControl' && attributeName === 'windSetting' && isValidObject(attributeValue)) attributes += `Wind: ${stringify(attributeValue)} `;
    if (clusterName === 'fanControl' && attributeName === 'airflowDirection')
      attributes += `Direction: ${getEnumDescription(FanControl.AirflowDirection, attributeValue as FanControl.AirflowDirection)} `;

    if (clusterName === 'hepaFilterMonitoring' && attributeName === 'condition') attributes += `Hepa filter: ${attributeValue}% `;
    if (clusterName === 'activatedCarbonFilterMonitoring' && attributeName === 'condition') attributes += `Carbon filter: ${attributeValue}% `;
    if (clusterName === 'waterTankLevelMonitoring' && attributeName === 'condition') attributes += `Water tank: ${attributeValue}% `;

    if (clusterName === 'temperatureAlarm' && attributeName === 'state' && isValidObject(attributeValue)) attributes += `Temp alarm: ${stringify(attributeValue)} `;

    if (clusterName === 'occupancySensing' && attributeName === 'occupancy' && isValidObject(attributeValue, 1))
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      attributes += `Occupancy: ${(attributeValue as { occupied: boolean }).occupied} `;
    if (clusterName === 'illuminanceMeasurement' && attributeName === 'measuredValue') {
      if (attributeValue === null) attributes += `Illuminance: unknown `;
      else if (isValidNumber(attributeValue)) attributes += `Illuminance: ${Math.round(Math.max(Math.pow(10, attributeValue / 10000), 0))} lx`;
    }
    if (clusterName === 'airQuality' && attributeName === 'airQuality')
      attributes += `Air quality: ${getEnumDescription(AirQuality.AirQualityEnum, attributeValue as AirQuality.AirQualityEnum)} `;
    if (clusterName === 'totalVolatileOrganicCompoundsConcentrationMeasurement' && attributeName === 'measuredValue')
      appendMeasurement('Voc', getMeasurementText(attributeValue, 1, ''));
    if (clusterName === 'pm1ConcentrationMeasurement' && attributeName === 'measuredValue') appendMeasurement('Pm1', getMeasurementText(attributeValue, 1, ''));
    if (clusterName === 'pm25ConcentrationMeasurement' && attributeName === 'measuredValue') appendMeasurement('Pm2.5', getMeasurementText(attributeValue, 1, ''));
    if (clusterName === 'pm10ConcentrationMeasurement' && attributeName === 'measuredValue') appendMeasurement('Pm10', getMeasurementText(attributeValue, 1, ''));
    if (clusterName === 'formaldehydeConcentrationMeasurement' && attributeName === 'measuredValue') appendMeasurement('CH₂O', getMeasurementText(attributeValue, 1, ''));
    if (clusterName === 'temperatureMeasurement' && attributeName === 'measuredValue') appendMeasurement('Temperature', getMeasurementText(attributeValue, 100, ' °C'));
    if (clusterName === 'relativeHumidityMeasurement' && attributeName === 'measuredValue') appendMeasurement('Humidity', getMeasurementText(attributeValue, 100, '%'));
    if (clusterName === 'pressureMeasurement' && attributeName === 'measuredValue') appendMeasurement('Pressure', getMeasurementText(attributeValue, 1, ' hPa'));
    if (clusterName === 'flowMeasurement' && attributeName === 'measuredValue') appendMeasurement('Flow', getMeasurementText(attributeValue, 10, ' m³/h'));
    if (clusterId === SoilMeasurement.id && attributeName === 'soilMoistureMeasuredValue') appendMeasurement('Soil moisture', getMeasurementText(attributeValue, 1, '%'));
    if (clusterName === 'electricalPowerMeasurement' && attributeName === 'voltage') appendMeasurement('Voltage', getMeasurementText(attributeValue, 1_000, 'V'));
    if (clusterName === 'electricalPowerMeasurement' && attributeName === 'activeCurrent') appendMeasurement('Current', getMeasurementText(attributeValue, 1_000, 'A'));
    if (clusterName === 'electricalPowerMeasurement' && attributeName === 'activePower') appendMeasurement('Power', getMeasurementText(attributeValue, 1_000_000, 'kW'));
    if (clusterName === 'electricalPowerMeasurement' && attributeName === 'frequency') appendMeasurement('Frequency', getMeasurementText(attributeValue, 1_000, 'Hz'));
    if (clusterName === 'electricalEnergyMeasurement' && attributeName === 'cumulativeEnergyImported') appendMeasurement('Imported', getEnergyText(attributeValue));
    if (clusterName === 'electricalEnergyMeasurement' && attributeName === 'cumulativeEnergyExported') appendMeasurement('Exported', getEnergyText(attributeValue));
    if (clusterName === 'deviceEnergyManagement' && attributeName === 'esaCanGenerate') attributes += `ESA can generate: ${attributeValue} `;
    if (clusterName === 'deviceEnergyManagement' && attributeName === 'esaState')
      attributes += `ESA state: ${DeviceEnergyManagement.EsaState[attributeValue as DeviceEnergyManagement.EsaState]} `;
    if (clusterName === 'fixedLabel' && attributeName === 'labelList') attributes += `${getFixedLabel(device)} `;
    if (clusterName === 'userLabel' && attributeName === 'labelList') attributes += `${getUserLabel(device)} `;
  });
  // console.log(`${device.deviceName}.forEachAttribute: ${attributes}`);
  return attributes.trimStart().trimEnd();
}

/**
 * Sets the advertising node with the specified store ID and advertise time.
 *
 * @param {string} storeId - The store ID of the advertising node.
 * @param {number} advertiseTime - The advertise time of the node.
 */
export function setAdvertisingNode(storeId: string, advertiseTime: number): void {
  advertisingNodes.set(storeId, advertiseTime);
}

/**
 * Deletes the advertising node with the specified store ID.
 *
 * @param {string} storeId - The store ID of the advertising node to delete.
 */
export function deleteAdvertisingNode(storeId: string): void {
  advertisingNodes.delete(storeId);
}

/**
 * Gets the matter sanitized data of the specified server node.
 *
 * @param {ServerNode} serverNode - The server node to get the data from.
 * @returns {ApiMatter} The sanitized data of the server node.
 */
export function getServerNodeData(serverNode: ServerNode): ApiMatter {
  const advertiseTime = advertisingNodes.get(serverNode.id) ?? 0;
  return {
    id: serverNode.id,
    online: serverNode.lifecycle.isOnline,
    commissioned: serverNode.state.commissioning.commissioned,
    advertising: advertiseTime > 0, // Date.now() - 15 * 60 * 1000,
    advertiseTime,
    windowStatus: serverNode.state.administratorCommissioning.windowStatus,
    qrPairingCode: serverNode.state.commissioning.pairingCodes.qrPairingCode,
    manualPairingCode: serverNode.state.commissioning.pairingCodes.manualPairingCode,
    fabricInformations: sanitizeFabricInformations(Object.values(serverNode.state.commissioning.fabrics)),
    sessionInformations: sanitizeSessionInformation(Object.values(serverNode.state.sessions.sessions)),
    serialNumber: serverNode.state.basicInformation.serialNumber,
  };
}

/**
 * Sanitizes the fabric information by converting bigint properties to strings because `res.json` doesn't support bigint.
 *
 * @param {ExposedFabricInformation[]} fabricInfo - The array of exposed fabric information objects.
 * @returns {SanitizedExposedFabricInformation[]} An array of sanitized exposed fabric information objects.
 */
export function sanitizeFabricInformations(fabricInfo: ExposedFabricInformation[]): SanitizedExposedFabricInformation[] {
  return fabricInfo.map((info): SanitizedExposedFabricInformation => {
    return {
      fabricIndex: info.fabricIndex,
      fabricId: info.fabricId.toString(),
      nodeId: info.nodeId.toString(),
      rootNodeId: info.rootNodeId.toString(),
      rootVendorId: info.rootVendorId,
      rootVendorName: getVendorIdName(info.rootVendorId),
      label: info.label,
    };
  });
}

/**
 * Converts a matter.js session timestamp (milliseconds since the epoch) to an ISO 8601 string.
 *
 * @param {number | undefined} timestamp - The timestamp in milliseconds. Undefined, 0 (session never active) or invalid values are not valid timestamps.
 * @returns {string} The ISO 8601 timestamp, or an empty string if the timestamp is not valid.
 */
function toIsoTimestamp(timestamp: number | undefined): string {
  if (!isValidNumber(timestamp, 1) || Number.isNaN(new Date(timestamp).getTime())) return '';
  return new Date(timestamp).toISOString();
}

/**
 * Sanitizes the session information by converting bigint properties to strings because `res.json` doesn't support bigint.
 *
 * @param {SessionsBehavior.Session[]} sessions - The array of session information objects.
 * @returns {SanitizedSession[]} An array of sanitized session information objects.
 */
export function sanitizeSessionInformation(sessions: SessionsBehavior.Session[]): SanitizedSession[] {
  return sessions
    .filter((session) => session.isPeerActive)
    .map((session): SanitizedSession => {
      return {
        name: session.name,
        nodeId: session.nodeId.toString(),
        peerNodeId: session.peerNodeId.toString(),
        fabric: session.fabric
          ? {
              fabricIndex: session.fabric.fabricIndex,
              fabricId: session.fabric.fabricId.toString(),
              nodeId: session.fabric.nodeId.toString(),
              rootNodeId: session.fabric.rootNodeId.toString(),
              rootVendorId: session.fabric.rootVendorId,
              rootVendorName: getVendorIdName(session.fabric.rootVendorId),
              label: session.fabric.label,
            }
          : undefined,
        isPeerActive: session.isPeerActive,
        lastInteractionTimestamp: toIsoTimestamp(session.lastInteractionTimestamp),
        lastActiveTimestamp: toIsoTimestamp(session.lastActiveTimestamp),
        numberOfActiveSubscriptions: session.numberOfActiveSubscriptions,
      };
    });
}

/**
 * Gets the name of a known vendor id.
 *
 * @param {number | undefined} vendorId - The vendor id.
 * @returns {string} The vendor name in parentheses, '(Unknown vendorId)' if the vendor id is not known, or an empty string if the vendor id is undefined or 0.
 */
export function getVendorIdName(vendorId: number | undefined): string {
  if (!vendorId) return '';
  let vendorName = '(Unknown vendorId)';
  switch (vendorId) {
    case 4937:
      vendorName = '(AppleHome)';
      break;
    case 4996:
      vendorName = '(AppleKeyChain)';
      break;
    case 4362:
      vendorName = '(SmartThings)';
      break;
    case 4939:
      vendorName = '(HomeAssistant)';
      break;
    case 24582:
      vendorName = '(GoogleHome)';
      break;
    case 4631:
      vendorName = '(Alexa)';
      break;
    case 4701:
      vendorName = '(Tuya)';
      break;
    case 4718:
      vendorName = '(Xiaomi)';
      break;
    case 4742:
      vendorName = '(eWeLink)';
      break;
    case 5264:
      vendorName = '(Shelly)';
      break;
    case 0x1488:
      vendorName = '(ShortcutLabsFlic)';
      break;
    case 65521: // 0xFFF1
      vendorName = '(MatterTest)';
      break;
    // no default
  }
  return vendorName;
}
