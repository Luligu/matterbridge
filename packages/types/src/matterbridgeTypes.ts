/**
 * This file contains the types for Matterbridge.
 *
 * @file matterbridgeTypes.ts
 * @author Luca Liguori
 * @created 2024-07-12
 * @version 1.0.3
 * @license Apache-2.0
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
 * limitations under the License.
 */

// AnsiLogger
import type { LogLevel } from 'node-ansi-logger';
// @matter
import type { FabricIndex, VendorId, EndpointNumber, Semtag } from '@matter/types';
import type { AdministratorCommissioning } from '@matter/types/clusters/administrator-commissioning';

// Matterbridge
import type { PlatformConfig, PlatformSchema } from './matterbridgePlatformTypes.js';

// Default colors
export const plg = '\u001B[38;5;33m';
export const dev = '\u001B[38;5;79m';
export const typ = '\u001B[38;5;207m';

// Default names
export const MATTERBRIDGE_LOGGER_FILE = 'matterbridge.log';
export const MATTER_LOGGER_FILE = 'matter.log';
export const NODE_STORAGE_DIR = 'storage';
export const MATTER_STORAGE_NAME = 'matterstorage';
export const MATTERBRIDGE_DIAGNOSTIC_FILE = 'diagnostic.log';
export const MATTERBRIDGE_HISTORY_FILE = 'history.html';

export type MaybePromise<T> = T | Promise<T>;

export type PluginName = string;

/**
 * A type representing a read-only subset of the Matterbridge properties.
 */
export type SharedMatterbridge = Readonly<{
  systemInformation: {
    interfaceName: string;
    macAddress: string;
    ipv4Address: string;
    ipv6Address: string;
    nodeVersion: string;
    hostname: string;
    user: string;
    osType: string;
    osRelease: string;
    osPlatform: string;
    osArch: string;
    totalMemory: string;
    freeMemory: string;
    systemUptime: string;
    processUptime: string;
    cpuUsage: string;
    processCpuUsage: string;
    rss: string;
    heapTotal: string;
    heapUsed: string;
  };
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
  bridgeMode: 'bridge' | 'childbridge' | 'controller' | '';
  restartMode: 'service' | 'docker' | '';
  virtualMode: 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';
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
  shellySysUpdate: boolean;
  shellyMainUpdate: boolean;
}>;

/** Define an interface for the frontend */
export interface ApiPlugin extends StoragePlugin {
  latestVersion?: string;
  devVersion?: string;
  homepage?: string;
  help?: string;
  changelog?: string;
  funding?: string;
  locked?: boolean;
  error?: boolean;
  loaded?: boolean;
  started?: boolean;
  configured?: boolean;
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
  name: string;
  path: string;
  type: 'DynamicPlatform' | 'AccessoryPlatform' | 'AnyPlatform';
  version: string;
  description: string;
  author: string;
  enabled: boolean;
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
  bridgeMode: string;
  restartMode: string;
  virtualMode: 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';
  profile: string | undefined;
  readOnly: boolean;
  shellyBoard: boolean;
  shellySysUpdate: boolean;
  shellyMainUpdate: boolean;
  loggerLevel: LogLevel;
  fileLogger: boolean;
  matterLoggerLevel: number;
  matterFileLogger: boolean;
  matterMdnsInterface: string | undefined;
  matterIpv4Address: string | undefined;
  matterIpv6Address: string | undefined;
  matterPort: number;
  matterDiscriminator: number | undefined;
  matterPasscode: number | undefined;
  restartRequired: boolean;
  fixedRestartRequired: boolean;
  updateRequired: boolean;
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
  pluginName: string;
  type: string;
  endpoint: EndpointNumber | undefined;
  name: string;
  serial: string;
  productUrl: string;
  configUrl?: string;
  uniqueId: string;
  reachable: boolean;
  powerSource?: 'ac' | 'dc' | 'ok' | 'warning' | 'critical';
  batteryLevel?: number;
  cluster: string;
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
  softwareVersion: number | undefined;
  softwareVersionString: string | undefined;
  hardwareVersion: number | undefined;
  hardwareVersionString: string | undefined;
  productUrl: string;
  tagList: Semtag[] | undefined;
  originalId: string | undefined;
  name: string | undefined;
  deviceType: number | undefined;
  // Endpoint properties
  number: EndpointNumber | undefined;
  id: string | undefined;
}

/** Define an interface for API matter information */
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
  plugin: string;
  deviceName: string;
  serialNumber: string;
  /** Endpoint number */
  number: EndpointNumber;
  /** Endpoint id */
  id: string;
  deviceTypes: number[];
  clusters: Cluster[];
}

/** Define an interface for Cluster information in ApiClusters */
export interface Cluster {
  /** Endpoint number > string */
  endpoint: string;
  /** Endpoint number */
  number: EndpointNumber;
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
