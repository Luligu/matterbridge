/**
 * This file contains the BroadcastServer types.
 *
 * @file broadcastServerTypes.ts
 * @author Luca Liguori
 * @created 2025-10-05
 * @version 2.0.0
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

import { LogLevel } from 'node-ansi-logger';
import { EndpointNumber } from '@matter/types/datatype';

import { RefreshRequiredChanged, WsMessageBroadcast } from './frontendTypes.js';
import type { PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import type { ApiMatter, ApiPlugin, BaseDevice, Plugin, StoragePlugin } from './matterbridgeTypes.js';

/** Types of worker source */
export type WorkerSrcType = 'manager' | 'matterbridge' | 'plugins' | 'devices' | 'frontend' | 'matter' | 'platform' | 'spawn' | 'updates';

/** Types of worker destination */
export type WorkerDstType = 'manager' | 'matterbridge' | 'plugins' | 'devices' | 'frontend' | 'matter' | 'platform' | 'spawn' | 'updates' | 'all';

/** Normalized message request structure */
type NormalizeRequest<T> = T extends { params: infer P } ? ([P] extends [undefined] ? { params?: undefined } : { params: P }) : Record<never, never>;

/** Message request structure with id, timestamp, src and dst */
type WorkerMessageRequestMap = {
  [K in keyof WorkerMessageTypes]: {
    type: K;
    id?: number;
    timestamp?: number;
    src: WorkerSrcType;
    dst: WorkerDstType;
  } & NormalizeRequest<WorkerMessageTypes[K]['request']>;
};

/** Message request structure with id, timestamp, src and dst */
export type WorkerMessageRequest<K extends keyof WorkerMessageTypes = keyof WorkerMessageTypes> = WorkerMessageRequestMap[K];

/** Normalized message response success structure that guarantees a successful result */
type NormalizeResponseSuccess<T> = T & { error?: never };

/** Normalized message response error structure that guarantees an error-only payload */
type NormalizeResponseError<T> = { error: string } & { [K in keyof T]?: never };

/** Normalized message response structure */
type NormalizeResponse<T> = NormalizeResponseSuccess<T> | NormalizeResponseError<T>;

/** Message response structure with id, timestamp, elapsed, src and dst */
type WorkerMessageResponseMap = {
  [K in keyof WorkerMessageTypes]: {
    type: K;
    id?: number;
    timestamp?: number;
    elapsed?: number;
    src: WorkerSrcType;
    dst: WorkerDstType;
  } & NormalizeResponse<WorkerMessageTypes[K]['response']>;
};

/** Message response structure with id, timestamp, elapsed, src and dst */
export type WorkerMessageResponse<K extends keyof WorkerMessageTypes = keyof WorkerMessageTypes> = WorkerMessageResponseMap[K];

/** Message response success structure that guarantees a successful result */
type WorkerMessageResponseSuccessMap = {
  [K in keyof WorkerMessageTypes]: {
    type: K;
    id?: number;
    timestamp?: number;
    elapsed?: number;
    src: WorkerSrcType;
    dst: WorkerDstType;
  } & NormalizeResponseSuccess<WorkerMessageTypes[K]['response']>;
};

/** Message response success structure that guarantees a successful result */
export type WorkerMessageResponseSuccess<K extends keyof WorkerMessageTypes = keyof WorkerMessageTypes> = WorkerMessageResponseSuccessMap[K];

/** Message response error structure */
type WorkerMessageResponseErrorMap = {
  [K in keyof WorkerMessageTypes]: {
    type: K;
    id?: number;
    timestamp?: number;
    elapsed?: number;
    src: WorkerSrcType;
    dst: WorkerDstType;
  } & NormalizeResponseError<WorkerMessageTypes[K]['response']>;
};

/** Message response error structure */
export type WorkerMessageResponseError<K extends keyof WorkerMessageTypes = keyof WorkerMessageTypes> = WorkerMessageResponseErrorMap[K];

/** Convenience alias for any worker request */
export type WorkerMessageRequestAny = WorkerMessageRequest<keyof WorkerMessageTypes>;

/** Resolve a successful response type based on the originating request */
export type WorkerMessageResponseSuccessForRequest<T extends WorkerMessageRequestAny> = WorkerMessageResponseSuccess<Extract<keyof WorkerMessageTypes, T['type']>>;

/** Resolve an error response type based on the originating request */
export type WorkerMessageResponseErrorForRequest<T extends WorkerMessageRequestAny> = WorkerMessageResponseError<Extract<keyof WorkerMessageTypes, T['type']>>;

/** Union type for WorkerMessageRequest and WorkerMessageResponse */
export type WorkerMessage<K extends keyof WorkerMessageTypes = keyof WorkerMessageTypes> = WorkerMessageRequest<K> | WorkerMessageResponse<K> | WorkerMessageResponseSuccess<K> | WorkerMessageResponseError<K>;

/** Map of all worker message types with their request and response structures */
export type WorkerMessageTypes = {
  // Jest example message
  'jest': {
    request: { params: { userId: number } };
    response: { result: { name: string; age: number } };
  };
  'jest_simple': {
    request: { params: undefined };
    response: { result: { success: true } };
  };

  // Logger general methods
  'get_log_level': {
    request: { params: undefined };
    response: { result: { logLevel: LogLevel } };
  };
  'set_log_level': {
    request: { params: { logLevel: LogLevel } };
    response: { result: { logLevel: LogLevel } };
  };

  // Matterbridge methods
  'matterbridge_initialize': {
    request: { params: undefined };
    response: { result: { success: true } };
  };
  'matterbridge_latest_version': {
    request: { params: { version: string } };
    response: { result: { success: true } };
  };
  'matterbridge_global_prefix': {
    request: { params: { prefix: string } };
    response: { result: { success: true } };
  };
  'matterbridge_dev_version': {
    request: { params: { version: string } };
    response: { result: { success: true } };
  };
  'matterbridge_sys_update': {
    request: { params: { available: boolean } };
    response: { result: { success: true } };
  };
  'matterbridge_main_update': {
    request: { params: { available: boolean } };
    response: { result: { success: true } };
  };

  // Matter methods
  'matter_start': {
    request: { params: { storeId: string } };
    response: { result: { storeId: string; success: true } };
  };
  'matter_stop': {
    request: { params: { storeId: string } };
    response: { result: { storeId: string; success: true } };
  };

  // Frontend methods
  'frontend_start': {
    request: { params: { port: number } };
    response: { result: { success: true } };
  };
  'frontend_stop': {
    request: { params: undefined };
    response: { result: { success: true } };
  };
  'frontend_refreshrequired': {
    request: { params: { changed: RefreshRequiredChanged; matter?: ApiMatter } };
    response: { result: { success: true } };
  };
  'frontend_restartrequired': {
    request: { params: { snackbar: boolean; fixed: boolean } };
    response: { result: { success: true } };
  };
  'frontend_restartnotrequired': {
    request: { params: { snackbar: boolean } };
    response: { result: { success: true } };
  };
  'frontend_updaterequired': {
    request: { params: { devVersion: boolean } };
    response: { result: { success: true } };
  };
  'frontend_snackbarmessage': {
    request: { params: { message: string; timeout?: number; severity?: 'info' | 'success' | 'warning' | 'error' } };
    response: { result: { success: true } };
  };
  'frontend_attributechanged': {
    request: { params: { plugin: string; serialNumber: string; uniqueId: string; number: EndpointNumber; id: string; cluster: string; attribute: string; value: number | string | boolean | null } };
    response: { result: { success: true } };
  };
  'frontend_logmessage': {
    request: { params: { level: string; time: string; name: string; message: string } };
    response: { result: { success: true } };
  };
  'frontend_broadcast_message': {
    request: { params: { msg: WsMessageBroadcast } };
    response: { result: { success: true } };
  };

  // PluginManager methods
  'plugins_length': {
    request: { params: undefined };
    response: { result: { length: number } };
  };
  'plugins_size': {
    request: { params: undefined };
    response: { result: { size: number } };
  };
  'plugins_has': {
    request: { params: { name: string } };
    response: { result: { has: boolean } };
  };
  'plugins_get': {
    request: { params: { name: string } };
    response: { result: { plugin: ApiPlugin | undefined } };
  };
  'plugins_set': {
    request: { params: { plugin: ApiPlugin } };
    response: { result: { plugin: ApiPlugin } };
  };
  'plugins_clear': {
    request: { params: undefined };
    response: { result: { success: true } };
  };
  'plugins_storagepluginarray': {
    request: { params: undefined };
    response: { result: { plugins: StoragePlugin[] } };
  };
  'plugins_apipluginarray': {
    request: { params: undefined };
    response: { result: { plugins: ApiPlugin[] } };
  };
  'plugins_loadFromStorage': {
    request: { params: undefined };
    response: { result: { plugins: ApiPlugin[] } };
  };
  'plugins_saveToStorage': {
    request: { params: undefined };
    response: { result: { count: number } };
  };
  'plugins_resolve': {
    request: { params: { pluginPath: string } };
    response: { result: { resolved: string | null } };
  };
  'plugins_install': {
    request: { params: { packageName: string } };
    response: { result: { packageName: string; success: boolean } };
  };
  'plugins_uninstall': {
    request: { params: { packageName: string } };
    response: { result: { packageName: string; success: boolean } };
  };
  'plugins_parse': {
    request: { params: { plugin: Plugin } };
    response: { result: { packageJson: Record<string, unknown> | null } };
  };
  'plugins_enable': {
    request: { params: { nameOrPath: string } };
    response: { result: { plugin: ApiPlugin | null } };
  };
  'plugins_disable': {
    request: { params: { nameOrPath: string } };
    response: { result: { plugin: ApiPlugin | null } };
  };
  'plugins_remove': {
    request: { params: { nameOrPath: string } };
    response: { result: { plugin: ApiPlugin | null } };
  };
  'plugins_add': {
    request: { params: { nameOrPath: string } };
    response: { result: { plugin: ApiPlugin | null } };
  };
  'plugins_load': {
    request: { params: { plugin: ApiPlugin | string; start?: boolean; message?: string; configure?: boolean } };
    response: { result: { platform: unknown | undefined } };
  };
  'plugins_start': {
    request: { params: { plugin: ApiPlugin | string; message?: string; configure?: boolean } };
    response: { result: { plugin: ApiPlugin | undefined } };
  };
  'plugins_configure': {
    request: { params: { plugin: ApiPlugin | string } };
    response: { result: { plugin: ApiPlugin | undefined } };
  };
  'plugins_shutdown': {
    request: { params: { plugin: ApiPlugin | string; reason?: string; removeAllDevices?: boolean; force?: boolean } };
    response: { result: { plugin: ApiPlugin | undefined } };
  };
  'plugins_loadconfig': {
    request: { params: { plugin: ApiPlugin } };
    response: { result: { config: PlatformConfig } };
  };
  'plugins_saveconfigfromplugin': {
    request: { params: { name: string; restartRequired?: boolean } };
    response: { result: { success: true } };
  };
  'plugins_saveconfigfromjson': {
    request: { params: { name: string; config: PlatformConfig; restartRequired?: boolean } };
    response: { result: { success: true } };
  };
  'plugins_loadschema': {
    request: { params: { name: string } };
    response: { result: { schema: PlatformSchema | undefined } };
  };
  'plugins_getschema': {
    request: { params: { name: string } };
    response: { result: { schema: PlatformSchema | undefined } };
  };
  'plugins_setschema': {
    request: { params: { name: string; schema: PlatformSchema } };
    response: { result: { success: true } };
  };
  'plugins_set_latest_version': {
    request: { params: { plugin: ApiPlugin; version: string } };
    response: { result: { success: true } };
  };
  'plugins_set_dev_version': {
    request: { params: { plugin: ApiPlugin; version: string } };
    response: { result: { success: true } };
  };

  // DeviceManager methods
  'devices_length': {
    request: { params: undefined };
    response: { result: { length: number } };
  };
  'devices_size': {
    request: { params: undefined };
    response: { result: { size: number } };
  };
  'devices_has': {
    request: { params: { uniqueId: string } };
    response: { result: { has: boolean } };
  };
  'devices_get': {
    request: { params: { uniqueId: string } };
    response: { result: { device: BaseDevice | undefined } };
  };
  'devices_set': {
    request: { params: { device: BaseDevice } };
    response: { result: { device: BaseDevice } };
  };
  'devices_remove': {
    request: { params: { device: BaseDevice } };
    response: { result: { success: boolean } };
  };
  'devices_clear': {
    request: { params: undefined };
    response: { result: { success: true } };
  };
  'devices_basearray': {
    request: { params: { pluginName?: string } };
    response: { result: { devices: BaseDevice[] } };
  };
};
