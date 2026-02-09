/**
 * This file contains the types for WebSocket messages.
 *
 * @file frontendTypes.ts
 * @author Luca Liguori
 * @created 2025-09-17
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

import type { EndpointNumber } from '@matter/types';

import type { PlatformConfig } from './matterbridgePlatformTypes.js';
import type { ApiClusters, ApiDevice, ApiMatter, ApiPlugin, MatterbridgeInformation, SystemInformation } from './matterbridgeTypes.js';

export type RefreshRequiredChanged = 'settings' | 'plugins' | 'devices' | 'matter';

export interface ApiSettings {
  matterbridgeInformation: MatterbridgeInformation;
  systemInformation: SystemInformation;
}

export interface ApiSelectDevice {
  pluginName: string;
  serial: string;
  name: string;
  configUrl?: string;
  icon?: string;
  entities?: ApiSelectDeviceEntity[];
}

export interface ApiSelectDeviceEntity {
  name: string;
  description: string;
  icon?: string;
}

export interface ApiSelectEntity {
  pluginName: string;
  name: string;
  description: string;
  icon?: string;
}

/**
 * Base interface for WebSocket messages.
 */
export interface WsMessage {
  id: number;
  src: string;
  dst: string;
  method: string;
}

/**
 * Base interface for WebSocket request api messages.
 */
export interface WsMessageBaseApiRequest {
  id: number;
  src: 'Frontend';
  dst: 'Matterbridge';
  method: string;
  sender?: string;
  params: Record<string, string | number | boolean | null | undefined | unknown>;
}

/**
 * Base interface for WebSocket success response api messages.
 */
export interface WsMessageSuccessApiResponse {
  id: number;
  src: 'Matterbridge';
  dst: 'Frontend';
  method: string;
  success: true;
  response?: unknown;
}

/**
 * Base interface for WebSocket error response api messages.
 */
export interface WsMessageErrorApiResponse {
  id: number;
  src: 'Matterbridge';
  dst: 'Frontend';
  method: string;
  error: string;
}

export interface WsMessagePingRequest extends WsMessageBaseApiRequest {
  method: 'ping';
}
export interface WsMessagePingResponse extends WsMessageSuccessApiResponse {
  method: 'pong';
  response: 'pong';
  success: true;
}

export interface WsMessageApiLoginRequest extends WsMessageBaseApiRequest {
  method: '/api/login';
  params: {
    password: string;
  };
}
export interface WsMessageApiLoginResponse extends WsMessageSuccessApiResponse {
  method: '/api/login';
}

export interface WsMessageApiInstallRequest extends WsMessageBaseApiRequest {
  method: '/api/install';
  params: {
    packageName: string;
    restart?: boolean;
  };
}
export interface WsMessageApiInstallResponse extends WsMessageSuccessApiResponse {
  method: '/api/install';
}

export interface WsMessageApiUninstallRequest extends WsMessageBaseApiRequest {
  method: '/api/uninstall';
  params: {
    packageName: string;
  };
}
export interface WsMessageApiUninstallResponse extends WsMessageSuccessApiResponse {
  method: '/api/uninstall';
}

export interface WsMessageApiAddPluginRequest extends WsMessageBaseApiRequest {
  method: '/api/addplugin';
  params: {
    pluginNameOrPath: string;
  };
}
export interface WsMessageApiAddPluginResponse extends WsMessageSuccessApiResponse {
  method: '/api/addplugin';
}

export interface WsMessageApiRemovePluginRequest extends WsMessageBaseApiRequest {
  method: '/api/removeplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiRemovePluginResponse extends WsMessageSuccessApiResponse {
  method: '/api/removeplugin';
}

export interface WsMessageApiEnablePluginRequest extends WsMessageBaseApiRequest {
  method: '/api/enableplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiEnablePluginResponse extends WsMessageSuccessApiResponse {
  method: '/api/enableplugin';
}

export interface WsMessageApiDisablePluginRequest extends WsMessageBaseApiRequest {
  method: '/api/disableplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiDisablePluginResponse extends WsMessageSuccessApiResponse {
  method: '/api/disableplugin';
}

export interface WsMessageApiRestartPluginRequest extends WsMessageBaseApiRequest {
  method: '/api/restartplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiRestartPluginResponse extends WsMessageSuccessApiResponse {
  method: '/api/restartplugin';
}

export interface WsMessageApiSavePluginConfigRequest extends WsMessageBaseApiRequest {
  method: '/api/savepluginconfig';
  params: {
    pluginName: string;
    formData: PlatformConfig;
  };
}
export interface WsMessageApiSavePluginConfigResponse extends WsMessageSuccessApiResponse {
  method: '/api/savepluginconfig';
}

export interface WsMessageApiCheckUpdatesRequest extends WsMessageBaseApiRequest {
  method: '/api/checkupdates';
}
export interface WsMessageApiCheckUpdatesResponse extends WsMessageSuccessApiResponse {
  method: '/api/checkupdates';
}

export interface WsMessageApiShellySysUpdateRequest extends WsMessageBaseApiRequest {
  method: '/api/shellysysupdate';
}
export interface WsMessageApiShellySysUpdateResponse extends WsMessageSuccessApiResponse {
  method: '/api/shellysysupdate';
}

export interface WsMessageApiShellyMainUpdateRequest extends WsMessageBaseApiRequest {
  method: '/api/shellymainupdate';
}
export interface WsMessageApiShellyMainUpdateResponse extends WsMessageSuccessApiResponse {
  method: '/api/shellymainupdate';
}

export interface WsMessageApiShellyCreateSystemLogRequest extends WsMessageBaseApiRequest {
  method: '/api/shellycreatesystemlog';
}
export interface WsMessageApiShellyCreateSystemLogResponse extends WsMessageSuccessApiResponse {
  method: '/api/shellycreatesystemlog';
}

export interface WsMessageApiShellyNetConfigRequest extends WsMessageBaseApiRequest {
  method: '/api/shellynetconfig';
  params: { type: 'static' | 'dhcp'; ip: string; subnet: string; gateway: string; dns: string };
}
export interface WsMessageApiShellyNetConfigResponse extends WsMessageSuccessApiResponse {
  method: '/api/shellynetconfig';
}

export interface WsMessageApiSoftResetRequest extends WsMessageBaseApiRequest {
  method: '/api/softreset';
}
export interface WsMessageApiSoftResetResponse extends WsMessageSuccessApiResponse {
  method: '/api/softreset';
}

export interface WsMessageApiHardResetRequest extends WsMessageBaseApiRequest {
  method: '/api/hardreset';
}
export interface WsMessageApiHardResetResponse extends WsMessageSuccessApiResponse {
  method: '/api/hardreset';
}

export interface WsMessageApiRebootRequest extends WsMessageBaseApiRequest {
  method: '/api/reboot';
}
export interface WsMessageApiRebootResponse extends WsMessageSuccessApiResponse {
  method: '/api/reboot';
}

export interface WsMessageApiRestartRequest extends WsMessageBaseApiRequest {
  method: '/api/restart';
}
export interface WsMessageApiRestartResponse extends WsMessageSuccessApiResponse {
  method: '/api/restart';
}

export interface WsMessageApiShutdownRequest extends WsMessageBaseApiRequest {
  method: '/api/shutdown';
}
export interface WsMessageApiShutdownResponse extends WsMessageSuccessApiResponse {
  method: '/api/shutdown';
}

export interface WsMessageApiCreateBackupRequest extends WsMessageBaseApiRequest {
  method: '/api/create-backup';
}
export interface WsMessageApiCreateBackupResponse extends WsMessageSuccessApiResponse {
  method: '/api/create-backup';
}

export interface WsMessageApiUnregisterRequest extends WsMessageBaseApiRequest {
  method: '/api/unregister';
}
export interface WsMessageApiUnregisterResponse extends WsMessageSuccessApiResponse {
  method: '/api/unregister';
}

export interface WsMessageApiResetRequest extends WsMessageBaseApiRequest {
  method: '/api/reset';
}
export interface WsMessageApiResetResponse extends WsMessageSuccessApiResponse {
  method: '/api/reset';
}

export interface WsMessageApiFactoryResetRequest extends WsMessageBaseApiRequest {
  method: '/api/factoryreset';
}
export interface WsMessageApiFactoryResetResponse extends WsMessageSuccessApiResponse {
  method: '/api/factoryreset';
}

export interface WsMessageApiViewHistoryPageRequest extends WsMessageBaseApiRequest {
  method: '/api/viewhistorypage';
}
export interface WsMessageApiViewHistoryPageResponse extends WsMessageSuccessApiResponse {
  method: '/api/viewhistorypage';
  success: true;
}

export interface WsMessageApiDownloadHistoryPageRequest extends WsMessageBaseApiRequest {
  method: '/api/downloadhistorypage';
}
export interface WsMessageApiDownloadHistoryPageResponse extends WsMessageSuccessApiResponse {
  method: '/api/downloadhistorypage';
  success: true;
}

export interface WsMessageApiMatterRequest extends WsMessageBaseApiRequest {
  method: '/api/matter';
  params: {
    id: string;
    server?: boolean;
    startCommission?: boolean;
    stopCommission?: boolean;
    advertise?: boolean;
    removeFabric?: number;
  };
}
export interface WsMessageApiMatterResponse extends WsMessageSuccessApiResponse {
  method: '/api/matter';
  response: ApiMatter;
}

export interface WsMessageApiSettingsRequest extends WsMessageBaseApiRequest {
  method: '/api/settings';
}
export interface WsMessageApiSettingsResponse extends WsMessageSuccessApiResponse {
  method: '/api/settings';
  response: ApiSettings;
}

export interface WsMessageApiPluginsRequest extends WsMessageBaseApiRequest {
  method: '/api/plugins';
}
export interface WsMessageApiPluginsResponse extends WsMessageSuccessApiResponse {
  method: '/api/plugins';
  response: ApiPlugin[];
}

export interface WsMessageApiDevicesRequest extends WsMessageBaseApiRequest {
  method: '/api/devices';
  params: {
    pluginName?: string;
  };
}
export interface WsMessageApiDevicesResponse extends WsMessageSuccessApiResponse {
  method: '/api/devices';
  response: ApiDevice[];
}

export interface WsMessageApiClustersRequest extends WsMessageBaseApiRequest {
  method: '/api/clusters';
  params: {
    plugin: string;
    endpoint: number;
  };
}
export interface WsMessageApiClustersResponse extends WsMessageSuccessApiResponse {
  method: '/api/clusters';
  response: ApiClusters;
}

export interface WsMessageApiSelectDevicesRequest extends WsMessageBaseApiRequest {
  method: '/api/select/devices';
  params: {
    plugin: string;
  };
}
export interface WsMessageApiSelectDevicesResponse extends WsMessageSuccessApiResponse {
  method: '/api/select/devices';
  response: ApiSelectDevice[];
}

export interface WsMessageApiSelectEntitiesRequest extends WsMessageBaseApiRequest {
  method: '/api/select/entities';
  params: {
    plugin: string;
  };
}
export interface WsMessageApiSelectEntitiesResponse extends WsMessageSuccessApiResponse {
  method: '/api/select/entities';
  response: ApiSelectEntity[];
}

export interface WsMessageApiActionRequest extends WsMessageBaseApiRequest {
  method: '/api/action';
  params: {
    plugin: string;
    action: string;
    value?: string;
    id?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formData?: any;
  };
}
export interface WsMessageApiActionResponse extends WsMessageSuccessApiResponse {
  method: '/api/action';
}

export interface WsMessageApiConfigRequest extends WsMessageBaseApiRequest {
  method: '/api/config';
  params: {
    name: string;
    value: string | boolean;
  };
}
export interface WsMessageApiConfigResponse extends WsMessageSuccessApiResponse {
  method: '/api/config';
}

export interface WsMessageApiCommandRequest extends WsMessageBaseApiRequest {
  method: '/api/command';
  params: {
    command: string;
    plugin?: string;
    serial?: string;
    name?: string;
  };
}
export interface WsMessageApiCommandResponse extends WsMessageSuccessApiResponse {
  method: '/api/command';
}

// Broadcast message types

export interface WsMessageApiLog extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'log';
  response: {
    level: string;
    time: string;
    name: string;
    message: string;
  };
}

export interface WsMessageApiRefreshRequired extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'refresh_required';
  response: {
    changed: RefreshRequiredChanged;
    matter?: ApiMatter;
  };
}

export interface WsMessageApiRestartRequired extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'restart_required';
  response: {
    fixed: boolean;
  };
}

export interface WsMessageApiRestartNotRequired extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'restart_not_required';
}

export interface WsMessageApiCpuUpdate extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'cpu_update';
  response: {
    cpuUsage: number;
    processCpuUsage: number;
  };
}

export interface WsMessageApiMemoryUpdate extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'memory_update';
  response: {
    totalMemory: string;
    freeMemory: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
    arrayBuffers: string;
    rss: string;
  };
}

export interface WsMessageApiUptimeUpdate extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'uptime_update';
  response: {
    systemUptime: string;
    processUptime: string;
  };
}

export interface WsMessageApiSnackbar extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'snackbar';
  response: {
    message: string;
    timeout?: number;
    severity?: 'info' | 'warning' | 'error' | 'success';
  };
}

export interface WsMessageApiCloseSnackbar extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'close_snackbar';
  response: {
    message: string;
  };
}

export interface WsMessageApiUpdateRequired extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'update_required';
  response: {
    devVersion: boolean;
  };
}

export interface WsMessageApiStateUpdate extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'state_update';
  response: {
    plugin: string;
    serialNumber: string;
    uniqueId: string;
    number: EndpointNumber;
    id: string;
    cluster: string;
    attribute: string;
    value: number | string | boolean | null | undefined;
  };
}

export interface WsMessageApiShellySysUpdate extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'shelly_sys_update';
  response: { available: boolean };
}

export interface WsMessageApiShellyMainUpdate extends WsMessageSuccessApiResponse {
  id: 0;
  method: 'shelly_main_update';
  response: { available: boolean };
}

// Union type for all specific WebSocket API request message types
export type WsMessageApiRequest =
  | WsMessagePingRequest
  | WsMessageApiLoginRequest
  | WsMessageApiInstallRequest
  | WsMessageApiUninstallRequest
  | WsMessageApiAddPluginRequest
  | WsMessageApiRemovePluginRequest
  | WsMessageApiEnablePluginRequest
  | WsMessageApiDisablePluginRequest
  | WsMessageApiRestartPluginRequest
  | WsMessageApiSavePluginConfigRequest
  | WsMessageApiCheckUpdatesRequest
  | WsMessageApiShellySysUpdateRequest
  | WsMessageApiShellyMainUpdateRequest
  | WsMessageApiShellyCreateSystemLogRequest
  | WsMessageApiShellyNetConfigRequest
  | WsMessageApiSoftResetRequest
  | WsMessageApiHardResetRequest
  | WsMessageApiRebootRequest
  | WsMessageApiRestartRequest
  | WsMessageApiShutdownRequest
  | WsMessageApiCreateBackupRequest
  | WsMessageApiUnregisterRequest
  | WsMessageApiResetRequest
  | WsMessageApiFactoryResetRequest
  | WsMessageApiViewHistoryPageRequest
  | WsMessageApiDownloadHistoryPageRequest
  | WsMessageApiMatterRequest
  | WsMessageApiSettingsRequest
  | WsMessageApiPluginsRequest
  | WsMessageApiDevicesRequest
  | WsMessageApiClustersRequest
  | WsMessageApiSelectDevicesRequest
  | WsMessageApiSelectEntitiesRequest
  | WsMessageApiActionRequest
  | WsMessageApiConfigRequest
  | WsMessageApiCommandRequest;

// Union type for all specific WebSocket API response message types
export type WsMessageApiResponse =
  | WsMessagePingResponse
  | WsMessageApiLoginResponse
  | WsMessageApiInstallResponse
  | WsMessageApiUninstallResponse
  | WsMessageApiAddPluginResponse
  | WsMessageApiRemovePluginResponse
  | WsMessageApiEnablePluginResponse
  | WsMessageApiDisablePluginResponse
  | WsMessageApiRestartPluginResponse
  | WsMessageApiSavePluginConfigResponse
  | WsMessageApiCheckUpdatesResponse
  | WsMessageApiShellySysUpdateResponse
  | WsMessageApiShellyMainUpdateResponse
  | WsMessageApiShellyCreateSystemLogResponse
  | WsMessageApiShellyNetConfigResponse
  | WsMessageApiSoftResetResponse
  | WsMessageApiHardResetResponse
  | WsMessageApiRebootResponse
  | WsMessageApiRestartResponse
  | WsMessageApiShutdownResponse
  | WsMessageApiCreateBackupResponse
  | WsMessageApiUnregisterResponse
  | WsMessageApiResetResponse
  | WsMessageApiFactoryResetResponse
  | WsMessageApiViewHistoryPageResponse
  | WsMessageApiDownloadHistoryPageResponse
  | WsMessageApiMatterResponse
  | WsMessageApiSettingsResponse
  | WsMessageApiPluginsResponse
  | WsMessageApiDevicesResponse
  | WsMessageApiClustersResponse
  | WsMessageApiSelectDevicesResponse
  | WsMessageApiSelectEntitiesResponse
  | WsMessageApiActionResponse
  | WsMessageApiConfigResponse
  | WsMessageApiCommandResponse
  | WsMessageApiLog
  | WsMessageApiRefreshRequired
  | WsMessageApiRestartRequired
  | WsMessageApiRestartNotRequired
  | WsMessageApiUpdateRequired
  | WsMessageApiCpuUpdate
  | WsMessageApiMemoryUpdate
  | WsMessageApiUptimeUpdate
  | WsMessageApiStateUpdate
  | WsMessageApiSnackbar
  | WsMessageApiCloseSnackbar
  | WsMessageApiShellySysUpdate
  | WsMessageApiShellyMainUpdate;

// Union type for all specific WebSocket broadcast message types
export type WsMessageBroadcast =
  | WsMessageApiLog
  | WsMessageApiRefreshRequired
  | WsMessageApiRestartRequired
  | WsMessageApiRestartNotRequired
  | WsMessageApiUpdateRequired
  | WsMessageApiCpuUpdate
  | WsMessageApiMemoryUpdate
  | WsMessageApiUptimeUpdate
  | WsMessageApiStateUpdate
  | WsMessageApiSnackbar
  | WsMessageApiCloseSnackbar
  | WsMessageApiShellySysUpdate
  | WsMessageApiShellyMainUpdate;

/**
 * Type guard to check if a message is a WsMessageApiRequest.
 *
 * @param {WsMessage} msg - The message to check.
 *
 * @returns {msg is WsMessageApiRequest} True if the message is a WsMessageApiRequest, false otherwise.
 */
export function isApiRequest(msg: WsMessage): msg is WsMessageApiRequest {
  return msg.id !== 0 && msg.src === 'Frontend' && msg.dst === 'Matterbridge';
}

/**
 * Type guard to check if a message is a WsMessageApiResponse.
 *
 * @param {WsMessage} msg - The message to check.
 *
 * @returns {msg is WsMessageApiResponse} True if the message is a WsMessageApiResponse, false otherwise.
 */
export function isApiResponse(msg: WsMessage): msg is WsMessageApiResponse {
  return msg.id !== 0 && msg.src === 'Matterbridge' && msg.dst === 'Frontend';
}

/**
 * Type guard to check if a message is a WsMessageBroadcast.
 *
 * @param {WsMessage} msg - The message to check.
 *
 * @returns {msg is WsMessageBroadcast} True if the message is a WsMessageBroadcast, false otherwise.
 */
export function isBroadcast(msg: WsMessage): msg is WsMessageBroadcast {
  return msg.id === 0 && msg.src === 'Matterbridge' && msg.dst === 'Frontend';
}
