/**
 * This file contains the types for Matterbridge.
 *
 * @file matterbridgeTypes.ts
 * @author Luca Liguori
 * @created 2024-07-12
 * @version 1.0.2
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

// NodeStorage and AnsiLogger modules
import type { NodeStorage } from 'node-persist-manager';
import type { LogLevel } from 'node-ansi-logger';
// @matter
import type { ServerNode, Endpoint as EndpointNode } from '@matter/node';
import type { StorageContext } from '@matter/general';
import type { FabricIndex, VendorId, EndpointNumber } from '@matter/types';
import type { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import type { AdministratorCommissioning } from '@matter/types/clusters/administrator-commissioning';

// Matterbridge
import type { Matterbridge } from './matterbridge.js';
import type { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

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

/**
 * A type representing a read-only subset of the Matterbridge properties.
 */
export type SharedMatterbridge = Readonly<
  Pick<
    Matterbridge,
    | 'systemInformation'
    | 'rootDirectory'
    | 'homeDirectory'
    | 'matterbridgeDirectory'
    | 'matterbridgePluginDirectory'
    | 'matterbridgeCertDirectory'
    | 'globalModulesDirectory'
    | 'matterbridgeVersion'
    | 'matterbridgeLatestVersion'
    | 'matterbridgeDevVersion'
    | 'frontendVersion'
    | 'bridgeMode'
    | 'restartMode'
    | 'virtualMode'
    | 'profile'
    | 'fileLogger'
    | 'matterFileLogger'
    | 'mdnsInterface'
    | 'ipv4Address'
    | 'ipv6Address'
    | 'port'
    | 'discriminator'
    | 'passcode'
  >
>;

export type PluginName = string;

/** Define an interface for matterbridge */
export interface Plugin extends ApiPlugin {
  /** Node storage context created in the directory 'storage' in matterbridgeDirectory with the plugin name */
  nodeContext?: NodeStorage;
  storageContext?: StorageContext;
  serverNode?: ServerNode<ServerNode.RootEndpoint>;
  aggregatorNode?: EndpointNode<AggregatorEndpoint>;
  device?: MatterbridgeEndpoint;
  platform?: MatterbridgePlatform;
  reachabilityTimeout?: NodeJS.Timeout;
}

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
  cluster: string;
  matter?: ApiMatter;
}

/** Define an interface for base device information */
export interface BaseDevice {
  pluginName: string | undefined;
  deviceType: number | undefined;
  number: EndpointNumber | undefined;
  id: string | undefined;
  deviceName: string | undefined;
  serialNumber: string | undefined;
  uniqueId: string | undefined;
  productUrl: string;
  configUrl: string | undefined;
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
