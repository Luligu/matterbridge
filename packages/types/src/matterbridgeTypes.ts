/**
 * @file packages/types/src/matterbridgeTypes.ts
 * @description This file contains the types for Matterbridge.
 * @author Luca Liguori
 * @created 2024-07-12
 * @version 1.0.5
 * @license Apache-2.0
 *
 * Copyright 2023, 2024, 2025, 2026 Luca Liguori.
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

import type { AdministratorCommissioning } from '@matter/types/clusters/administrator-commissioning';
// @matter
import type { FabricIndex, VendorId } from '@matter/types/datatype';
import type { Semtag } from '@matter/types/globals';
// AnsiLogger
import type { LogLevel } from 'node-ansi-logger';

// matterbridge
import type { PlatformConfig, PlatformSchema } from './matterbridgePlatformTypes.js';

// Default colors
export const plg = '\u001B[38;5;33m';
export const dev = '\u001B[38;5;79m';
export const typ = '\u001B[38;5;207m';

// Default names
export const MATTERBRIDGE_LOGGER_FILE = 'matterbridge.log';
export const MATTER_LOGGER_FILE = 'matter.log';
// Intentionally duplicated in apps/frontend/src/utils/backendShared.ts.
export const NODE_STORAGE_DIR = 'storage';
// Intentionally duplicated in apps/frontend/src/utils/backendShared.ts.
export const MATTER_STORAGE_DIR = 'matterstorage';
export const MATTERBRIDGE_DIAGNOSTIC_FILE = 'diagnostic.log';
export const MATTERBRIDGE_HISTORY_FILE = 'history.html';
export const MATTERBRIDGE_BACKUP_FILE = 'matterbridge.backup.zip';
export const MATTERBRIDGE_PLUGIN_STORAGE_FILE = 'matterbridge.pluginstorage.zip';
export const MATTERBRIDGE_PLUGIN_CONFIG_FILE = 'matterbridge.pluginconfig.zip';

export type MaybePromise<T> = T | Promise<T>;

export type PluginName = string;

/** It indicates the mode of the Matterbridge instance. It can be 'bridge', 'childbridge', 'controller' or 'none'. */
export type BridgeMode = 'bridge' | 'childbridge' | 'controller' | 'none';

/** It indicates the restart mode of the Matterbridge instance. It can be 'service', 'docker' or 'none'. */
export type RestartMode = 'service' | 'docker' | 'none';

/** It indicates whether virtual mode is enabled and its type. The virtual mode control the creation of "Update matterbridge" and "Restart matterbridge" endpoints. */
export type VirtualMode = 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';

/** It indicates the current status of the Matterbridge instance. */
export type BridgeStatus = 'inactive' | 'starting' | 'started' | 'stopping' | 'stopped' | 'error';

/**
 * A type representing a read-only subset of the Matterbridge properties.
 */
export type SharedMatterbridge = Readonly<{
  systemInformation: Readonly<
    Pick<
      SystemInformation,
      | 'interfaceName'
      | 'macAddress'
      | 'ipv4Address'
      | 'ipv6Address'
      | 'nodeVersion'
      | 'hostname'
      | 'user'
      | 'osType'
      | 'osRelease'
      | 'osPlatform'
      | 'osArch'
      | 'totalMemory'
      | 'freeMemory'
      | 'constrainedMemory'
      | 'systemUptime'
      | 'processUptime'
      | 'cpuUsage'
      | 'processCpuUsage'
      | 'rss'
      | 'heapTotal'
      | 'heapUsed'
    >
  >;
  uuid: string;
  rootDirectory: string;
  homeDirectory: string;
  matterbridgeDirectory: string;
  matterbridgePluginDirectory: string;
  matterbridgeCertDirectory: string;
  globalModulesDirectory: string;
  matterbridgeVersion: string;
  matterbridgeLatestVersion: string;
  matterbridgeDevVersion: string;
  frontendVersion: string;
  dockerDev: boolean | undefined;
  dockerVersion: string | undefined;
  dockerLatestVersion: string | undefined;
  dockerDevVersion: string | undefined;
  bridgeMode: BridgeMode;
  restartMode: RestartMode;
  virtualMode: VirtualMode;
  profile: string | undefined;
  logLevel: LogLevel;
  fileLogger: boolean;
  matterLogLevel: LogLevel;
  matterFileLogger: boolean;
  mdnsInterface: string | undefined;
  ipv4Address: string | undefined;
  ipv6Address: string | undefined;
  port: number | undefined;
  discriminator: number | undefined;
  passcode: number | undefined;
  /** Timestamp when the Matterbridge instance started up */
  startupAt: number;
  /** Timestamp when the Matterbridge instance shut down */
  shutdownAt: number;
  /** Total running time of the Matterbridge instance */
  runningTimes: number;
  /** Total running days of the Matterbridge instance */
  runningDays: number;
}>;

/** Define an interface for the frontend */
export interface ApiPlugin extends StoragePlugin {
  latestVersion?: string;
  devVersion?: string;
  homepage?: string;
  help?: string;
  changelog?: string;
  funding?: string;
  frontendPath?: string;
  /**
   * Signal that the dedicated Matter server node of the plugin has been created (childbridge mode only).
   * It is set when the server node of an AccessoryPlatform (with its single device) or of a DynamicPlatform (with its aggregator) is created,
   * and guards against creating it twice. It is reset when the plugin is loaded at startup and when the plugin is shut down.
   */
  locked?: boolean;
  error?: boolean;
  loaded?: boolean;
  started?: boolean;
  configured?: boolean;
  local?: boolean;
  /** Signal that the config has changed and a restart is required */
  restartRequired?: boolean;
  registeredDevices?: number;
  configJson?: PlatformConfig;
  schemaJson?: PlatformSchema;
  hasWhiteList?: boolean;
  hasBlackList?: boolean;
  matter?: ApiMatter;
}

/** Define an interface for storing the plugin information */
export interface StoragePlugin {
  /** The name of the plugin, which is used as a unique identifier */
  name: string;
  /** The path to the plugin, which can be a local path or a global module path */
  path: string;
  /** The type of the plugin */
  type: 'DynamicPlatform' | 'AccessoryPlatform' | 'AnyPlatform';
  /** The version of the plugin */
  version: string;
  /** A short description of the plugin */
  description: string;
  /** The author of the plugin */
  author: string;
  /** Indicates whether the plugin is enabled */
  enabled: boolean;
  /** Indicates whether the plugin is private. Check for updates will skip private plugins. */
  private: boolean;
  /** Path to the latest uploaded plugin tarball or undefined if not available */
  tarballPath?: string;
  /** The configuration version of the plugin server node basic information cluster */
  configurationVersion: number;
}

/** Define an interface for the system information */
export interface SystemInformation {
  // Network properties
  interfaceName: string;
  macAddress: string;
  ipv4Address: string;
  ipv6Address: string;
  // Node.js properties
  nodeVersion: string;
  // Bun properties
  bunVersion?: string;
  // Fixed system properties
  hostname: string;
  user: string;
  osType: string;
  osRelease: string;
  osPlatform: string;
  osArch: string;
  // Cpu and memory properties
  totalMemory: string;
  freeMemory: string;
  constrainedMemory: string;
  systemUptime: string;
  processUptime: string;
  cpuUsage: string;
  processCpuUsage: string;
  rss: string;
  heapTotal: string;
  heapUsed: string;
}

/** Define an interface for the matterbridge information */
export interface MatterbridgeInformation {
  rootDirectory: string;
  homeDirectory: string;
  matterbridgeDirectory: string;
  matterbridgePluginDirectory: string;
  matterbridgeCertDirectory: string;
  globalModulesDirectory: string;
  matterbridgeVersion: string;
  matterbridgeLatestVersion: string;
  matterbridgeDevVersion: string;
  frontendVersion: string;
  dockerDev: boolean | undefined;
  dockerVersion: string | undefined;
  dockerLatestVersion: string | undefined;
  dockerDevVersion: string | undefined;
  bridgeMode: BridgeMode;
  restartMode: RestartMode;
  virtualMode: VirtualMode;
  bridgeStatus: BridgeStatus;
  profile: string | undefined;
  readOnly: boolean;
  restartRequired: boolean;
  fixedRestartRequired: boolean;
  updateRequired: boolean;
  loggerLevel: LogLevel;
  fileLogger: boolean;
  matterLoggerLevel: LogLevel;
  matterFileLogger: boolean;
  matterMdnsInterface: string | undefined;
  matterIpv4Address: string | undefined;
  matterIpv6Address: string | undefined;
  matterPort: number;
  matterDiscriminator: number | undefined;
  matterPasscode: number | undefined;
  /** Timestamp when the Matterbridge instance started up */
  startupAt: number;
  /** Timestamp when the Matterbridge instance shut down */
  shutdownAt: number;
  /** Total running time of the Matterbridge instance */
  runningTimes: number;
  /** Total running days of the Matterbridge instance */
  runningDays: number;
}

/** Define an interface for sanitized exposed fabric information suitable for API responses */
export interface SanitizedExposedFabricInformation {
  fabricIndex: FabricIndex;
  fabricId: string; // bigint > string
  nodeId: string; // bigint > string
  rootNodeId: string; // bigint > string
  rootVendorId: VendorId;
  rootVendorName: string;
  label: string;
}

/** Define an interface for sanitized session information suitable for API responses */
export interface SanitizedSession {
  name: string;
  nodeId: string;
  peerNodeId: string;
  fabric?: SanitizedExposedFabricInformation;
  isPeerActive: boolean;
  lastInteractionTimestamp: string;
  lastActiveTimestamp: string;
  numberOfActiveSubscriptions: number;
}

/** Define an interface for API device information */
export interface ApiDevice {
  // MatterbridgeEndpoint device information

  /** The plugin name to be in sync with BaseDevice, ApiSelectDevice and ApiSelectEntity */
  plugin: string;
  /** The device type name and code, e.g. 'OnOffLight (0x0100)' */
  type: string;
  /** The endpoint number */
  number: number | undefined;
  /** The endpoint id */
  id: string | undefined;
  /** The device name */
  deviceName: string;
  /** The device serial number */
  serialNumber: string;
  /** The device unique id */
  uniqueId: string;
  /** The product url */
  productUrl: string;
  /** The device configuration url */
  configUrl?: string;

  // Lifecycle and state information of the MatterbridgeEndpoint device, from the helpers in packages/core/src/matterNodeHelpers.ts

  /** MatterbridgeEndpoint state: the device reachability */
  reachable: boolean;
  /** MatterbridgeEndpoint state: the device power source */
  powerSource?: 'ac' | 'dc' | 'ok' | 'warning' | 'critical';
  /** MatterbridgeEndpoint state: the device battery level in percent 0-100 (the PowerSource batPercentRemaining 0-200 divided by 2, so it can be x.5) */
  batteryLevel?: number;
  /** MatterbridgeEndpoint state: the attributes description of the cluster servers in the device */
  cluster: string;
  /** Root node information for the devices in server mode */
  matter?: ApiMatter;
}

/** Define an interface for base device information */
export interface BaseDevice {
  // MatterbridgeEndpoint properties

  mode: 'server' | 'matter' | undefined;
  plugin: string | undefined;
  configUrl: string | undefined;

  deviceName: string | undefined;
  serialNumber: string | undefined;
  uniqueId: string | undefined;
  vendorId: number | undefined;
  vendorName: string | undefined;
  productId: number | undefined;
  productName: string | undefined;
  productLabel: string | undefined;
  productUrl: string;
  configurationVersion: number;
  softwareVersion: number | undefined;
  softwareVersionString: string | undefined;
  hardwareVersion: number | undefined;
  hardwareVersionString: string | undefined;
  tagList: Semtag[] | undefined;
  /** The id passed in the MatterbridgeEndpoint constructor options, as is: the endpoint id is the same without spaces and dots (matter.js doesn't allow them), e.g. 'Light 1.0' gives id 'Light10' */
  originalId: string | undefined;
  /** The name of the first device type of the MatterbridgeEndpoint, e.g. 'OnOffLight' */
  name: string | undefined;
  /** The code of the first device type of the MatterbridgeEndpoint, e.g. 0x0100 */
  deviceType: number | undefined;
  /** The codes of all the device types of the MatterbridgeEndpoint (the keys of its deviceTypes map), the first one is deviceType */
  deviceTypes: number[] | undefined;

  // Endpoint properties

  number: number | undefined;
  id: string | undefined;
}

/** Define an interface for root node information */
export interface ApiMatter {
  id: string;
  online: boolean;
  commissioned: boolean;
  advertising: boolean;
  advertiseTime: number;
  windowStatus: AdministratorCommissioning.CommissioningWindowStatus;
  fabricInformations: SanitizedExposedFabricInformation[];
  sessionInformations: SanitizedSession[];
  qrPairingCode: string;
  manualPairingCode: string;
  serialNumber: string | undefined;
}

/** Define an interface for API clusters information */
export interface ApiClusters {
  /** The plugin name */
  plugin: string;
  /** The device name */
  deviceName: string;
  /** The device serial number */
  serialNumber: string;
  /** The device unique id */
  uniqueId: string;
  /** Endpoint number */
  number: number;
  /** Endpoint id */
  id: string;
  /** The device type codes of the device root endpoint */
  deviceTypes: number[];
  /** The cluster attributes of the device root endpoint and its child endpoints */
  clusters: Cluster[];
}

/** Define an interface for Cluster information in ApiClusters */
export interface Cluster {
  /** Endpoint number > string */
  endpoint: string;
  /** Endpoint number */
  number: number;
  /** Endpoint id or main for the device root endpoint */
  id: string;
  deviceTypes: number[];
  clusterName: string;
  clusterId: string;
  attributeName: string;
  attributeId: string;
  attributeValue: string;
  attributeLocalValue: unknown;
}

/** Define an interface for the Docker build configuration, which is read from a JSON file generated during the Docker build process */
export interface DockerBuildConfig {
  version: string;
  sha: string;
  sha7: string;
  event: string;
  workflow: string;
  type: string;
  name: string;
  dev: boolean;
}
