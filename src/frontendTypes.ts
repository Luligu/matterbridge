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

import { ApiMatter } from './matterbridgeTypes.js';

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
 * Enumeration of WebSocket broadcast message methods.
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
 * function handleMessage<T extends keyof WsMessageMap>(msg: WsMessageById<T>) {
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
