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
import { NodeStorage } from 'node-persist-manager';
import { LogLevel } from 'node-ansi-logger';
// @matter
import { FabricIndex, VendorId, StorageContext, ServerNode, EndpointNumber, Endpoint as EndpointNode } from '@matter/main';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';

// Matterbridge
import { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

// Default colors
export const plg = '\u001B[38;5;33m';
export const dev = '\u001B[38;5;79m';
export const typ = '\u001B[38;5;207m';

// Define an interface for storing the plugins
export interface RegisteredPlugin extends BaseRegisteredPlugin {
  nodeContext?: NodeStorage;
  storageContext?: StorageContext;
  serverNode?: ServerNode<ServerNode.RootEndpoint>;
  aggregatorNode?: EndpointNode<AggregatorEndpoint>;
  device?: MatterbridgeEndpoint;
  platform?: MatterbridgePlatform;
  reachabilityTimeout?: NodeJS.Timeout;
}

// Simplified interface for saving the plugins in node storage
export interface BaseRegisteredPlugin {
  name: string;
  version: string;
  description: string;
  author: string;
  path: string;
  type: string;
  latestVersion?: string;
  serialNumber?: string;
  homepage?: string;
  help?: string;
  changelog?: string;
  funding?: string;
  locked?: boolean;
  error?: boolean;
  enabled?: boolean;
  loaded?: boolean;
  started?: boolean;
  configured?: boolean;
  paired?: boolean;
  restartRequired?: boolean;
  fabricInformations?: SanitizedExposedFabricInformation[];
  sessionInformations?: SanitizedSession[];
  registeredDevices?: number;
  addedDevices?: number;
  qrPairingCode?: string;
  manualPairingCode?: string;
  configJson?: PlatformConfig;
  schemaJson?: PlatformSchema;
  hasWhiteList?: boolean;
  hasBlackList?: boolean;
}

// Define an interface for storing the system information
export interface SystemInformation {
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
  rss: string;
  heapTotal: string;
  heapUsed: string;
}

// Define an interface for storing the matterbridge information
export interface MatterbridgeInformation {
  homeDirectory: string;
  rootDirectory: string;
  matterbridgeDirectory: string;
  matterbridgePluginDirectory: string;
  matterbridgeCertDirectory: string;
  globalModulesDirectory: string;
  matterbridgeVersion: string;
  matterbridgeLatestVersion: string;
  matterbridgeDevVersion: string;
  matterbridgeSerialNumber: string;
  matterbridgeQrPairingCode: string | undefined;
  matterbridgeManualPairingCode: string | undefined;
  matterbridgeFabricInformations: SanitizedExposedFabricInformation[] | undefined;
  matterbridgeSessionInformations: SanitizedSession[] | undefined;
  matterbridgePaired: boolean | undefined;
  matterbridgeAdvertise: boolean | undefined;
  bridgeMode: string;
  restartMode: string;
  virtualMode: 'disabled' | 'outlet' | 'light' | 'switch' | 'mounted_switch';
  readOnly: boolean;
  shellyBoard: boolean;
  shellySysUpdate: boolean;
  shellyMainUpdate: boolean;
  profile?: string;
  loggerLevel: LogLevel;
  fileLogger: boolean;
  matterLoggerLevel: number;
  matterFileLogger: boolean;
  mattermdnsinterface: string | undefined;
  matteripv4address: string | undefined;
  matteripv6address: string | undefined;
  matterPort: number;
  matterDiscriminator: number | undefined;
  matterPasscode: number | undefined;
  restartRequired: boolean;
  updateRequired: boolean;
}

export interface SanitizedExposedFabricInformation {
  fabricIndex: FabricIndex;
  fabricId: string; // bigint > string
  nodeId: string; // bigint > string
  rootNodeId: string; // bigint > string
  rootVendorId: VendorId;
  rootVendorName: string;
  label: string;
}

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

export interface ApiDevices {
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
  matter?: ApiDevicesMatter;
}

export interface ApiDevicesMatter {
  commissioned: boolean;
  fabricInformations?: SanitizedExposedFabricInformation[];
  sessionInformations?: SanitizedSession[];
  qrPairingCode?: string;
  manualPairingCode?: string;
}

export interface ApiClustersResponse {
  plugin: string;
  deviceName: string;
  serialNumber: string;
  endpoint: number;
  deviceTypes: number[];
  clusters: ApiClusters[];
}

export interface ApiClusters {
  endpoint: string;
  id: string;
  deviceTypes: number[];
  clusterName: string;
  clusterId: string;
  attributeName: string;
  attributeId: string;
  attributeValue: string;
  attributeLocalValue: unknown;
}
