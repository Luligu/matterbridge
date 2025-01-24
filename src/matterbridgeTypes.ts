/**
 * This file contains the types for Matterbridge.
 *
 * @file matterbridgeTypes.ts
 * @author Luca Liguori
 * @date 2024-07-12
 * @version 1.0.2
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
 * limitations under the License. *
 */

// NodeStorage and AnsiLogger modules
import { NodeStorage } from './storage/export.js';
import { LogLevel } from './logger/export.js';

// Matterbridge
import { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

// @matter
import { FabricIndex, NodeId, VendorId, StorageContext, ServerNode, EndpointNumber, Endpoint as EndpointNode } from '@matter/main';
import { ExposedFabricInformation } from '@matter/main/protocol';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';

// Default colors
export const plg = '\u001B[38;5;33m';
export const dev = '\u001B[38;5;79m';
export const typ = '\u001B[38;5;207m';

// Define an alias for MatterbridgeEndpoint by extending it
export class MatterbridgeDevice extends MatterbridgeEndpoint {}

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
  locked?: boolean;
  error?: boolean;
  enabled?: boolean;
  loaded?: boolean;
  started?: boolean;
  configured?: boolean;
  paired?: boolean;
  fabricInformations?: SanitizedExposedFabricInformation[];
  sessionInformations?: SanitizedSessionInformation[];
  registeredDevices?: number;
  addedDevices?: number;
  qrPairingCode?: string;
  manualPairingCode?: string;
  configJson?: PlatformConfig;
  schemaJson?: PlatformSchema;
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
}

// Define an interface for storing the matterbridge information
export interface MatterbridgeInformation {
  homeDirectory: string;
  rootDirectory: string;
  matterbridgeDirectory: string;
  matterbridgePluginDirectory: string;
  globalModulesDirectory: string;
  matterbridgeVersion: string;
  matterbridgeLatestVersion: string;
  matterbridgeQrPairingCode: string | undefined;
  matterbridgeManualPairingCode: string | undefined;
  matterbridgeFabricInformations: SanitizedExposedFabricInformation[] | undefined;
  matterbridgeSessionInformations: SanitizedSessionInformation[] | undefined;
  matterbridgePaired: boolean | undefined;
  bridgeMode: string;
  restartMode: string;
  readOnly: boolean;
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
  refreshRequired: boolean;
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

export interface SessionInformation {
  name: string;
  nodeId: NodeId;
  peerNodeId: NodeId;
  fabric?: ExposedFabricInformation;
  isPeerActive: boolean;
  secure: boolean;
  lastInteractionTimestamp?: number;
  lastActiveTimestamp?: number;
  numberOfActiveSubscriptions: number;
}

export interface SanitizedSessionInformation {
  name: string;
  nodeId: string;
  peerNodeId: string;
  fabric?: SanitizedExposedFabricInformation;
  isPeerActive: boolean;
  secure: boolean;
  lastInteractionTimestamp?: string;
  lastActiveTimestamp?: string;
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
  cluster: string;
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
