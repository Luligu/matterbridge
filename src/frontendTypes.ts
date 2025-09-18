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

import { ApiClustersResponse, ApiDevices, ApiMatter, BaseRegisteredPlugin, MatterbridgeInformation, SystemInformation } from './matterbridgeTypes.js';

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
 * Interface for WebSocket request api messages.
 */
export interface WsMessageApiRequest {
  id: number;
  src: 'Frontend';
  dst: 'Matterbridge';
  method: string;
  sender?: string;
  params: Record<string, string | number | boolean | null | undefined>;
}

/**
 * Interface for WebSocket response api messages.
 */
export interface WsMessageApiResponse {
  id: number;
  src: 'Matterbridge';
  dst: 'Frontend';
  method: string;
  error?: string;
  success?: boolean;
  response?: unknown;
}

export interface WsMessagePingRequest extends WsMessageApiRequest {
  method: 'ping';
  params: {
    password: string;
  };
}
export interface WsMessagePingResponse extends WsMessageApiResponse {
  method: 'ping';
  response: 'pong';
  success: true;
}

export interface WsMessageApiLoginRequest extends WsMessageApiRequest {
  method: '/api/login';
  params: {
    password: string;
  };
}
export interface WsMessageApiLoginResponse extends WsMessageApiResponse {
  method: '/api/login';
  success: true;
}

export interface WsMessageApiInstallRequest extends WsMessageApiRequest {
  method: '/api/install';
  params: {
    packageName: string;
    restart?: boolean;
  };
}
export interface WsMessageApiInstallResponse extends WsMessageApiResponse {
  method: '/api/install';
  success: true;
}

export interface WsMessageApiUninstallRequest extends WsMessageApiRequest {
  method: '/api/uninstall';
  params: {
    packageName: string;
  };
}
export interface WsMessageApiUninstallResponse extends WsMessageApiResponse {
  method: '/api/uninstall';
  success: true;
}

export interface WsMessageApiAddPluginRequest extends WsMessageApiRequest {
  method: '/api/addplugin';
  params: {
    pluginNameOrPath: string;
  };
}
export interface WsMessageApiAddPluginResponse extends WsMessageApiResponse {
  method: '/api/addplugin';
  success: true;
}

export interface WsMessageApiRemovePluginRequest extends WsMessageApiRequest {
  method: '/api/removeplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiRemovePluginResponse extends WsMessageApiResponse {
  method: '/api/removeplugin';
  success: true;
}

export interface WsMessageApiEnablePluginRequest extends WsMessageApiRequest {
  method: '/api/enableplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiEnablePluginResponse extends WsMessageApiResponse {
  method: '/api/enableplugin';
  success: true;
}

export interface WsMessageApiDisablePluginRequest extends WsMessageApiRequest {
  method: '/api/disableplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiDisablePluginResponse extends WsMessageApiResponse {
  method: '/api/disableplugin';
  success: true;
}

export interface WsMessageApiRestartPluginRequest extends WsMessageApiRequest {
  method: '/api/restartplugin';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiRestartPluginResponse extends WsMessageApiResponse {
  method: '/api/restartplugin';
  success: true;
}

export interface WsMessageApiSavePluginConfigRequest extends WsMessageApiRequest {
  method: '/api/savepluginconfig';
  params: {
    pluginName: string;
  };
}
export interface WsMessageApiSavePluginConfigResponse extends WsMessageApiResponse {
  method: '/api/savepluginconfig';
  success: true;
}

export interface WsMessageApiCheckUpdatesRequest extends WsMessageApiRequest {
  method: '/api/checkupdates';
}
export interface WsMessageApiCheckUpdatesResponse extends WsMessageApiResponse {
  method: '/api/checkupdates';
  success: true;
}

export interface WsMessageApiShellySysUpdateRequest extends WsMessageApiRequest {
  method: '/api/shellysysupdate';
}
export interface WsMessageApiShellySysUpdateResponse extends WsMessageApiResponse {
  method: '/api/shellysysupdate';
  success: true;
}

export interface WsMessageApiShellyMainUpdateRequest extends WsMessageApiRequest {
  method: '/api/shellymainupdate';
}
export interface WsMessageApiShellyMainUpdateResponse extends WsMessageApiResponse {
  method: '/api/shellymainupdate';
  success: true;
}

export interface WsMessageApiShellyCreateSystemLogRequest extends WsMessageApiRequest {
  method: '/api/shellycreatesystemlog';
}
export interface WsMessageApiShellyCreateSystemLogResponse extends WsMessageApiResponse {
  method: '/api/shellycreatesystemlog';
  success: true;
}

export interface WsMessageApiShellyNetConfigRequest extends WsMessageApiRequest {
  method: '/api/shellynetconfig';
  params: {
    type: 'static' | 'dhcp';
    ip: string;
    subnet: string;
    gateway: string;
    dns: string;
  };
}
export interface WsMessageApiShellyNetConfigResponse extends WsMessageApiResponse {
  method: '/api/shellynetconfig';
  success: true;
}

export interface WsMessageApiSoftResetRequest extends WsMessageApiRequest {
  method: '/api/softreset';
}
export interface WsMessageApiSoftResetResponse extends WsMessageApiResponse {
  method: '/api/softreset';
  success: true;
}

export interface WsMessageApiHardResetRequest extends WsMessageApiRequest {
  method: '/api/hardreset';
}
export interface WsMessageApiHardResetResponse extends WsMessageApiResponse {
  method: '/api/hardreset';
  success: true;
}

export interface WsMessageApiRebootRequest extends WsMessageApiRequest {
  method: '/api/reboot';
}
export interface WsMessageApiRebootResponse extends WsMessageApiResponse {
  method: '/api/reboot';
  success: true;
}

export interface WsMessageApiRestartRequest extends WsMessageApiRequest {
  method: '/api/restart';
}
export interface WsMessageApiRestartResponse extends WsMessageApiResponse {
  method: '/api/restart';
  success: true;
}

export interface WsMessageApiShutdownRequest extends WsMessageApiRequest {
  method: '/api/shutdown';
}
export interface WsMessageApiShutdownResponse extends WsMessageApiResponse {
  method: '/api/shutdown';
  success: true;
}

export interface WsMessageApiCreateBackupRequest extends WsMessageApiRequest {
  method: '/api/create-backup';
}
export interface WsMessageApiCreateBackupResponse extends WsMessageApiResponse {
  method: '/api/create-backup';
  success: true;
}

export interface WsMessageApiUnregisterRequest extends WsMessageApiRequest {
  method: '/api/unregister';
}
export interface WsMessageApiUnregisterResponse extends WsMessageApiResponse {
  method: '/api/unregister';
  success: true;
}

export interface WsMessageApiResetRequest extends WsMessageApiRequest {
  method: '/api/reset';
}
export interface WsMessageApiResetResponse extends WsMessageApiResponse {
  method: '/api/reset';
  success: true;
}

export interface WsMessageApiFactoryResetRequest extends WsMessageApiRequest {
  method: '/api/factoryreset';
}
export interface WsMessageApiFactoryResetResponse extends WsMessageApiResponse {
  method: '/api/factoryreset';
  success: true;
}

export interface WsMessageApiMatterRequest extends WsMessageApiRequest {
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
export interface WsMessageApiMatterResponse extends WsMessageApiResponse {
  method: '/api/matter';
  success: true;
}

export interface WsMessageApiSettingsRequest extends WsMessageApiRequest {
  method: '/api/settings';
}
export interface WsMessageApiSettingsResponse extends WsMessageApiResponse {
  method: '/api/settings';
  response: {
    matterbridgeInformation: MatterbridgeInformation;
    systemInformation: SystemInformation;
  };
}

export interface WsMessageApiPluginsRequest extends WsMessageApiRequest {
  method: '/api/plugins';
}
export interface WsMessageApiPluginsResponse extends WsMessageApiResponse {
  method: '/api/plugins';
  response: BaseRegisteredPlugin[];
}

export interface WsMessageApiDevicesRequest extends WsMessageApiRequest {
  method: '/api/devices';
  params: {
    pluginName?: string;
  };
}
export interface WsMessageApiDevicesResponse extends WsMessageApiResponse {
  method: '/api/devices';
  response: ApiDevices[];
}

export interface WsMessageApiClustersRequest extends WsMessageApiRequest {
  method: '/api/clusters';
  params: {
    plugin: string;
    endpoint: number;
  };
}
export interface WsMessageApiClustersResponse extends WsMessageApiResponse {
  method: '/api/clusters';
  response: ApiClustersResponse;
}

export interface WsMessageApiSelectDevicesRequest extends WsMessageApiRequest {
  method: '/api/select/devices';
  params: {
    plugin: string;
  };
}
export interface WsMessageApiSelectDevicesResponse extends WsMessageApiResponse {
  method: '/api/select/devices';
  response: unknown[];
}

export interface WsMessageApiSelectEntitiesRequest extends WsMessageApiRequest {
  method: '/api/select/entities';
  params: {
    plugin: string;
  };
}
export interface WsMessageApiSelectEntitiesResponse extends WsMessageApiResponse {
  method: '/api/select/entities';
  response: unknown[];
}

export interface WsMessageApiActionRequest extends WsMessageApiRequest {
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
export interface WsMessageApiActionResponse extends WsMessageApiResponse {
  method: '/api/action';
  success?: boolean;
  error?: string;
}

export interface WsMessageApiConfigRequest extends WsMessageApiRequest {
  method: '/api/config';
  params: {
    name: string;
    value: string | boolean;
  };
}
export interface WsMessageApiConfigResponse extends WsMessageApiResponse {
  method: '/api/config';
  success?: boolean;
  error?: string;
}

export interface WsMessageApiCommandRequest extends WsMessageApiRequest {
  method: '/api/command';
  params: {
    command: string;
    plugin?: string;
    serial?: string;
    name?: string;
  };
}
export interface WsMessageApiCommandResponse extends WsMessageApiResponse {
  method: '/api/command';
  success?: boolean;
  error?: string;
}

// Union type for all specific WebSocket API request message types
type _WsMessageApiRequestUnion =
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
type _WsMessageApiResponseUnion =
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
  | WsMessageApiMatterResponse
  | WsMessageApiSettingsResponse
  | WsMessageApiPluginsResponse
  | WsMessageApiDevicesResponse
  | WsMessageApiClustersResponse
  | WsMessageApiSelectDevicesResponse
  | WsMessageApiSelectEntitiesResponse
  | WsMessageApiActionResponse
  | WsMessageApiConfigResponse
  | WsMessageApiCommandResponse;

/**
 * Enumeration of WebSocket broadcast message IDs.
 */
export const enum WsBroadcastMessageId {
  Log = 0,
  RefreshRequired = 1,
  RestartRequired = 2,
  RestartNotRequired = 3,
  CpuUpdate = 4,
  MemoryUpdate = 5,
  UptimeUpdate = 6,
  Snackbar = 7,
  UpdateRequired = 8,
  StateUpdate = 9,
  CloseSnackbar = 10,
  ShellySysUpdate = 100,
  ShellyMainUpdate = 101,
}

/**
 * Type of WebSocket broadcast message methods.
 */
export type WsBroadcastMessageMethod =
  | 'log'
  | 'refresh_required'
  | 'restart_required'
  | 'restart_not_required'
  | 'update_required'
  | 'update_required_dev'
  | 'snackbar'
  | 'close_snackbar'
  | 'cpu_update'
  | 'memory_update'
  | 'uptime_update'
  | 'state_update'
  | 'shelly_sys_update'
  | 'shelly_main_update';

export interface WsMessageLog {
  id: WsBroadcastMessageId.Log;
  dst: string;
  src: string;
  method: 'log';
  params: {
    level: string;
    time: string;
    name: string;
    message: string;
  };
}

export interface WsMessageRefreshRequired {
  id: WsBroadcastMessageId.RefreshRequired;
  dst: string;
  src: string;
  method: 'refresh_required';
  params: {
    changed: string | null;
    matter?: ApiMatter;
  };
}

export interface WsMessageRestartRequired {
  id: WsBroadcastMessageId.RestartRequired;
  dst: string;
  src: string;
  method: 'restart_required';
  params: {
    fixed: boolean;
  };
}

export interface WsMessageRestartNotRequired {
  id: WsBroadcastMessageId.RestartNotRequired;
  dst: string;
  src: string;
  method: 'restart_not_required';
}

export interface WsMessageCpuUpdate {
  id: WsBroadcastMessageId.CpuUpdate;
  dst: string;
  src: string;
  method: 'cpu_update';
  params: {
    cpuUsage: number;
  };
}

export interface WsMessageMemoryUpdate {
  id: WsBroadcastMessageId.MemoryUpdate;
  dst: string;
  src: string;
  method: 'memory_update';
  params: {
    totalMemory: string;
    freeMemory: string;
    heapTotal: string;
    heapUsed: string;
    external: string;
    arrayBuffers: string;
    rss: string;
  };
}

export interface WsMessageUptimeUpdate {
  id: WsBroadcastMessageId.UptimeUpdate;
  dst: string;
  src: string;
  method: 'uptime_update';
  params: {
    systemUptime: string;
    processUptime: string;
  };
}

export interface WsMessageSnackbar {
  id: WsBroadcastMessageId.Snackbar;
  dst: string;
  src: string;
  method: 'snackbar';
  params: {
    message: string;
    timeout?: number;
    severity?: 'info' | 'warning' | 'error' | 'success';
  };
}

export interface WsMessageCloseSnackbar {
  id: WsBroadcastMessageId.CloseSnackbar;
  dst: string;
  src: string;
  method: 'close_snackbar';
  params: {
    message: string;
  };
}

export interface WsMessageUpdateRequired {
  id: WsBroadcastMessageId.UpdateRequired;
  dst: string;
  src: string;
  method: 'update_required' | 'update_required_dev';
}

export interface WsMessageStateUpdate {
  id: WsBroadcastMessageId.StateUpdate;
  dst: string;
  src: string;
  method: 'state_update';
  params: Record<string, string | number | boolean | null | undefined>;
}

export interface WsMessageShellySysUpdate {
  id: WsBroadcastMessageId.ShellySysUpdate;
  dst: string;
  src: string;
  method: 'shelly_sys_update';
  params: Record<string, string | number | boolean | null | undefined>;
}

export interface WsMessageShellyMainUpdate {
  id: WsBroadcastMessageId.ShellyMainUpdate;
  dst: string;
  src: string;
  method: 'shelly_main_update';
  params: Record<string, string | number | boolean | null | undefined>;
}

// Union type for all specific WebSocket broadcast message types
export type WsMessageBroadcast =
  | WsMessageLog
  | WsMessageRefreshRequired
  | WsMessageRestartRequired
  | WsMessageRestartNotRequired
  | WsMessageUpdateRequired
  | WsMessageCpuUpdate
  | WsMessageMemoryUpdate
  | WsMessageUptimeUpdate
  | WsMessageStateUpdate
  | WsMessageSnackbar
  | WsMessageCloseSnackbar
  | WsMessageShellySysUpdate
  | WsMessageShellyMainUpdate;

// Mapping of WebSocket broadcast message IDs to their corresponding types
export type WsMessageBroadcastMap = {
  [WsBroadcastMessageId.Log]: WsMessageLog;
  [WsBroadcastMessageId.RefreshRequired]: WsMessageRefreshRequired;
  [WsBroadcastMessageId.RestartRequired]: WsMessageRestartRequired;
  [WsBroadcastMessageId.RestartNotRequired]: WsMessageRestartNotRequired;
  [WsBroadcastMessageId.UpdateRequired]: WsMessageUpdateRequired;
  [WsBroadcastMessageId.CpuUpdate]: WsMessageCpuUpdate;
  [WsBroadcastMessageId.MemoryUpdate]: WsMessageMemoryUpdate;
  [WsBroadcastMessageId.UptimeUpdate]: WsMessageUptimeUpdate;
  [WsBroadcastMessageId.StateUpdate]: WsMessageStateUpdate;
  [WsBroadcastMessageId.Snackbar]: WsMessageSnackbar;
  [WsBroadcastMessageId.CloseSnackbar]: WsMessageCloseSnackbar;
  [WsBroadcastMessageId.ShellySysUpdate]: WsMessageShellySysUpdate;
  [WsBroadcastMessageId.ShellyMainUpdate]: WsMessageShellyMainUpdate;
};

/**
 * Type helper to get the specific WebSocket message type by its ID.
 *
 * @example
 * function handleMessage<T extends keyof WsMessageBroadcastMap>(msg: WsMessageById<T>) {
 *   // msg is strongly typed based on its id
 * }
 *
 * @template T - The WebSocket message ID.
 */
export type WsMessageById<T extends keyof WsMessageBroadcastMap> = WsMessageBroadcastMap[T];

/**
 * Type guard to check if a message is a WsMessageBroadcast.
 *
 * @param {WsMessage} msg - The message to check.
 *
 * @returns {msg is WsMessageBroadcast} True if the message is a WsMessageBroadcast, false otherwise.
 */
export function isBroadcast(msg: WsMessage): msg is WsMessageBroadcast {
  return msg.id >= WsBroadcastMessageId.Log && msg.id <= WsBroadcastMessageId.ShellyMainUpdate;
}

/**
 * Type guard to check if a message is a WsMessageApiRequest.
 *
 * @param {WsMessage} msg - The message to check.
 *
 * @returns {msg is WsMessageApiRequest} True if the message is a WsMessageApiRequest, false otherwise.
 */
export function isApiRequest(msg: WsMessage): msg is WsMessageApiRequest {
  return msg.id > WsBroadcastMessageId.ShellyMainUpdate && msg.src === 'Frontend' && msg.dst === 'Matterbridge' && !('success' in msg) && !('error' in msg);
}

/**
 * Type guard to check if a message is a WsMessageApiResponse.
 *
 * @param {WsMessage} msg - The message to check.
 *
 * @returns {msg is WsMessageApiResponse} True if the message is a WsMessageApiResponse, false otherwise.
 */
export function isApiResponse(msg: WsMessage): msg is WsMessageApiResponse {
  return msg.id > WsBroadcastMessageId.ShellyMainUpdate && msg.src === 'Matterbridge' && msg.dst === 'Frontend' && ('success' in msg || 'error' in msg);
}
