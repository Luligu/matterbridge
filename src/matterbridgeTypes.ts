import { NodeStorage } from 'node-persist-manager';

import { FabricIndex, NodeId, VendorId } from '@project-chip/matter-node.js/datatype';
import { ExposedFabricInformation } from '@project-chip/matter-node.js/fabric';
import { MatterbridgePlatform, PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import { MatterbridgeDevice } from './matterbridgeDevice.js';
import { StorageContext } from '@project-chip/matter-node.js/storage';
import { CommissioningServer } from '@project-chip/matter-node.js';
import { Aggregator } from '@project-chip/matter-node.js/device';

// Define an interface for storing the plugins
export interface RegisteredPlugin extends BaseRegisteredPlugin {
  nodeContext?: NodeStorage;
  storageContext?: StorageContext;
  commissioningServer?: CommissioningServer;
  aggregator?: Aggregator;
  device?: MatterbridgeDevice;
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
  connected?: boolean;
  fabricInformations?: SanitizedExposedFabricInformation[];
  sessionInformations?: SanitizedSessionInformation[];
  registeredDevices?: number;
  addedDevices?: number;
  qrPairingCode?: string;
  manualPairingCode?: string;
  configJson?: PlatformConfig;
  schemaJson?: PlatformSchema;
}

// Define an interface for storing the devices
export interface RegisteredDevice {
  plugin: string;
  device: MatterbridgeDevice;
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
  matterbridgeFabricInformations: SanitizedExposedFabricInformation[];
  matterbridgeSessionInformations: SanitizedSessionInformation[];
  matterbridgePaired: boolean;
  matterbridgeConnected: boolean;
  bridgeMode: string;
  restartMode: string;
  debugEnabled: boolean;
  matterLoggerLevel: number;
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
