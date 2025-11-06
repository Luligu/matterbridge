/**
 * This file contains the BroadcastServer types.
 *
 * @file broadcastServerTypes.ts
 * @author Luca Liguori
 * @created 2025-10-05
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

import { LogLevel } from 'node-ansi-logger';
import { EndpointNumber } from '@matter/types/datatype';

import { RefreshRequiredChanged } from './frontendTypes.js';
import type { PlatformConfig, PlatformSchema } from './matterbridgePlatform.js';
import type { ApiMatter, ApiPlugin, BaseDevice, Plugin, StoragePlugin } from './matterbridgeTypes.js';

export type WorkerSrcType = 'manager' | 'matterbridge' | 'plugins' | 'devices' | 'frontend' | 'matter';
export type WorkerDstType = 'manager' | 'matterbridge' | 'plugins' | 'devices' | 'frontend' | 'matter' | 'all';

/** Base message request structure with id, timestamp, src and dst */
type BaseWorkerMessageRequest = {
  id?: number;
  timestamp?: number;
  src: WorkerSrcType;
  dst: WorkerDstType;
};

/** Base message response structure with id, timestamp, src and dst */
type BaseWorkerMessageResponse = {
  id?: number;
  timestamp?: number;
  src: WorkerSrcType;
  dst: WorkerDstType;
};

/** Extended message map that adds src/dst to all requests and responses */
type ExtendedWorkerMessageMap = {
  [K in keyof WorkerMessageMap]: {
    request: WorkerMessageMap[K]['request'] & BaseWorkerMessageRequest;
    response: WorkerMessageMap[K]['response'] & BaseWorkerMessageResponse;
  };
};

/** Union type of all worker messages (requests and responses) */
export type WorkerMessage = {
  [K in keyof ExtendedWorkerMessageMap]: ExtendedWorkerMessageMap[K]['request'] | ExtendedWorkerMessageMap[K]['response'];
}[keyof ExtendedWorkerMessageMap];

/** Map of all worker message types with their request and response structures */
type WorkerMessageMap = {
  'jest': { request: { type: 'jest' }; response: { type: 'jest'; response: { name: string; age: number } } };

  // Logger general methods
  'get_log_level': { request: { type: 'get_log_level' }; response: { type: 'get_log_level'; response: { logLevel: LogLevel; success: boolean } } };
  'set_log_level': { request: { type: 'set_log_level'; params: { logLevel: LogLevel } }; response: { type: 'set_log_level'; response: { logLevel: LogLevel; success: boolean } } };

  // Matterbridge methods
  'matterbridge_initialize': {
    request: { type: 'matterbridge_initialize' };
    response: { type: 'matterbridge_initialize'; response: { success: boolean } };
  };

  // Matter methods
  'matter_start': {
    request: { type: 'matter_start'; params: { storeId: string } };
    response: { type: 'matter_start'; response: { storeId: string; success: boolean } };
  };
  'matter_stop': {
    request: { type: 'matter_stop'; params: { storeId: string } };
    response: { type: 'matter_stop'; response: { storeId: string; success: boolean } };
  };

  // Frontend methods
  'frontend_start': {
    request: { type: 'frontend_start'; params: { port: number } };
    response: { type: 'frontend_start'; response: { success: boolean } };
  };
  'frontend_stop': {
    request: { type: 'frontend_stop' };
    response: { type: 'frontend_stop'; response: { success: boolean } };
  };
  'frontend_refreshrequired': {
    request: { type: 'frontend_refreshrequired'; params: { changed: RefreshRequiredChanged; matter: ApiMatter } };
    response: { type: 'frontend_refreshrequired'; response: { success: boolean } };
  };
  'frontend_restartrequired': {
    request: { type: 'frontend_restartrequired'; params: { snackbar: boolean; fixed: boolean } };
    response: { type: 'frontend_restartrequired'; response: { success: boolean } };
  };
  'frontend_restartnotrequired': {
    request: { type: 'frontend_restartnotrequired'; params: { snackbar: boolean } };
    response: { type: 'frontend_restartnotrequired'; response: { success: boolean } };
  };
  'frontend_updaterequired': {
    request: { type: 'frontend_updaterequired'; params: { devVersion: boolean } };
    response: { type: 'frontend_updaterequired'; response: { success: boolean } };
  };
  'frontend_snackbarmessage': {
    request: { type: 'frontend_snackbarmessage'; params: { message: string; timeout?: number; severity?: 'info' | 'success' | 'warning' | 'error' } };
    response: { type: 'frontend_snackbarmessage'; response: { success: boolean } };
  };
  'frontend_attributechanged': {
    request: { type: 'frontend_attributechanged'; params: { plugin: string; serialNumber: string; uniqueId: string; number: EndpointNumber; id: string; cluster: string; attribute: string; value: number | string | boolean | null } };
    response: { type: 'frontend_attributechanged'; response: { success: boolean } };
  };

  // PluginManager methods
  'plugins_length': {
    request: { type: 'plugins_length' };
    response: { type: 'plugins_length'; response: { length: number } };
  };
  'plugins_size': {
    request: { type: 'plugins_size' };
    response: { type: 'plugins_size'; response: { size: number } };
  };
  'plugins_has': {
    request: { type: 'plugins_has'; params: { name: string } };
    response: { type: 'plugins_has'; response: { has: boolean } };
  };
  'plugins_get': {
    request: { type: 'plugins_get'; params: { name: string } };
    response: { type: 'plugins_get'; response: { plugin: ApiPlugin | undefined } };
  };
  'plugins_set': {
    request: { type: 'plugins_set'; params: { plugin: ApiPlugin } };
    response: { type: 'plugins_set'; response: { plugin: ApiPlugin } };
  };
  'plugins_clear': {
    request: { type: 'plugins_clear' };
    response: { type: 'plugins_clear'; response: { success: boolean } };
  };
  'plugins_storagepluginarray': {
    request: { type: 'plugins_storagepluginarray' };
    response: { type: 'plugins_storagepluginarray'; response: { plugins: StoragePlugin[] } };
  };
  'plugins_apipluginarray': {
    request: { type: 'plugins_apipluginarray' };
    response: { type: 'plugins_apipluginarray'; response: { plugins: ApiPlugin[] } };
  };
  'plugins_loadFromStorage': {
    request: { type: 'plugins_loadFromStorage' };
    response: { type: 'plugins_loadFromStorage'; response: { plugins: ApiPlugin[] } };
  };
  'plugins_saveToStorage': {
    request: { type: 'plugins_saveToStorage' };
    response: { type: 'plugins_saveToStorage'; response: { count: number } };
  };
  'plugins_resolve': {
    request: { type: 'plugins_resolve'; params: { pluginPath: string } };
    response: { type: 'plugins_resolve'; response: { resolved: string | null } };
  };
  'plugins_install': {
    request: { type: 'plugins_install'; params: { packageName: string } };
    response: { type: 'plugins_install'; response: { packageName: string; success: boolean } };
  };
  'plugins_uninstall': {
    request: { type: 'plugins_uninstall'; params: { packageName: string } };
    response: { type: 'plugins_uninstall'; response: { packageName: string; success: boolean } };
  };
  'plugins_getAuthor': {
    request: { type: 'plugins_getAuthor'; params: { packageJson: Record<string, unknown> } };
    response: { type: 'plugins_getAuthor'; response: { author: string } };
  };
  'plugins_getHomepage': {
    request: { type: 'plugins_getHomepage'; params: { packageJson: Record<string, unknown> } };
    response: { type: 'plugins_getHomepage'; response: { homepage?: string } };
  };
  'plugins_getHelp': {
    request: { type: 'plugins_getHelp'; params: { packageJson: Record<string, unknown> } };
    response: { type: 'plugins_getHelp'; response: { help?: string } };
  };
  'plugins_getChangelog': {
    request: { type: 'plugins_getChangelog'; params: { packageJson: Record<string, unknown> } };
    response: { type: 'plugins_getChangelog'; response: { changelog?: string } };
  };
  'plugins_getFunding': {
    request: { type: 'plugins_getFunding'; params: { packageJson: Record<string, unknown> } };
    response: { type: 'plugins_getFunding'; response: { funding?: string } };
  };
  'plugins_parse': {
    request: { type: 'plugins_parse'; params: { plugin: Plugin } };
    response: { type: 'plugins_parse'; response: { packageJson: Record<string, unknown> | null } };
  };
  'plugins_enable': {
    request: { type: 'plugins_enable'; params: { nameOrPath: string } };
    response: { type: 'plugins_enable'; response: { plugin: ApiPlugin | null } };
  };
  'plugins_disable': {
    request: { type: 'plugins_disable'; params: { nameOrPath: string } };
    response: { type: 'plugins_disable'; response: { plugin: ApiPlugin | null } };
  };
  'plugins_remove': {
    request: { type: 'plugins_remove'; params: { nameOrPath: string } };
    response: { type: 'plugins_remove'; response: { plugin: ApiPlugin | null } };
  };
  'plugins_add': {
    request: { type: 'plugins_add'; params: { nameOrPath: string } };
    response: { type: 'plugins_add'; response: { plugin: ApiPlugin | null } };
  };
  'plugins_load': {
    request: { type: 'plugins_load'; params: { plugin: ApiPlugin | string; start?: boolean; message?: string; configure?: boolean } };
    response: { type: 'plugins_load'; response: { platform: unknown | undefined } };
  };
  'plugins_start': {
    request: { type: 'plugins_start'; params: { plugin: ApiPlugin | string; message?: string; configure?: boolean } };
    response: { type: 'plugins_start'; response: { plugin: ApiPlugin | undefined } };
  };
  'plugins_configure': {
    request: { type: 'plugins_configure'; params: { plugin: ApiPlugin | string } };
    response: { type: 'plugins_configure'; response: { plugin: ApiPlugin | undefined } };
  };
  'plugins_shutdown': {
    request: { type: 'plugins_shutdown'; params: { plugin: ApiPlugin | string; reason?: string; removeAllDevices?: boolean; force?: boolean } };
    response: { type: 'plugins_shutdown'; response: { plugin: ApiPlugin | undefined } };
  };
  'plugins_loadConfig': {
    request: { type: 'plugins_loadConfig'; params: { plugin: ApiPlugin } };
    response: { type: 'plugins_loadConfig'; response: { config: PlatformConfig } };
  };
  'plugins_saveConfigFromPlugin': {
    request: { type: 'plugins_saveConfigFromPlugin'; params: { plugin: ApiPlugin; restartRequired?: boolean } };
    response: { type: 'plugins_saveConfigFromPlugin'; response: { success: boolean } };
  };
  'plugins_saveConfigFromJson': {
    request: { type: 'plugins_saveConfigFromJson'; params: { plugin: ApiPlugin; config: PlatformConfig; restartRequired?: boolean } };
    response: { type: 'plugins_saveConfigFromJson'; response: { success: boolean } };
  };
  'plugins_loadSchema': {
    request: { type: 'plugins_loadSchema'; params: { plugin: ApiPlugin } };
    response: { type: 'plugins_loadSchema'; response: { schema: PlatformSchema } };
  };
  'plugins_getDefaultSchema': {
    request: { type: 'plugins_getDefaultSchema'; params: { plugin: ApiPlugin } };
    response: { type: 'plugins_getDefaultSchema'; response: { schema: PlatformSchema } };
  };

  // DeviceManager methods
  'devices_length': {
    request: { type: 'devices_length' };
    response: { type: 'devices_length'; response: { length: number } };
  };
  'devices_size': {
    request: { type: 'devices_size' };
    response: { type: 'devices_size'; response: { size: number } };
  };
  'devices_has': {
    request: { type: 'devices_has'; params: { uniqueId: string } };
    response: { type: 'devices_has'; response: { has: boolean } };
  };
  'devices_get': {
    request: { type: 'devices_get'; params: { uniqueId: string } };
    response: { type: 'devices_get'; response: { device: BaseDevice | undefined } };
  };
  'devices_set': {
    request: { type: 'devices_set'; params: { device: BaseDevice } };
    response: { type: 'devices_set'; response: { device: BaseDevice } };
  };
  'devices_remove': {
    request: { type: 'devices_remove'; params: { device: BaseDevice } };
    response: { type: 'devices_remove'; response: { success: boolean } };
  };
  'devices_clear': {
    request: { type: 'devices_clear' };
    response: { type: 'devices_clear'; response: { success: boolean } };
  };
  'devices_basearray': {
    request: { type: 'devices_basearray'; params: { pluginName?: string } };
    response: { type: 'devices_basearray'; response: { devices: BaseDevice[] } };
  };
};

export type WorkerMessageType = keyof WorkerMessageMap;

export type WorkerRequest<T extends WorkerMessageType> = ExtendedWorkerMessageMap[T]['request'];

export type WorkerResponse<T extends WorkerMessageType> = ExtendedWorkerMessageMap[T]['response'];
