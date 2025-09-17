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

/**
 * Websocket message ID for logging.
 *
 * @constant {number}
 */
export const WS_ID_LOG = 0;

/**
 * Websocket message ID indicating a refresh is needed.
 *
 * @constant {number}
 */
export const WS_ID_REFRESH_NEEDED = 1;

/**
 * Websocket message ID indicating a restart is needed.
 *
 * @constant {number}
 */
export const WS_ID_RESTART_NEEDED = 2;

/**
 * Websocket message ID indicating a cpu update.
 *
 * @constant {number}
 */
export const WS_ID_CPU_UPDATE = 3;

/**
 * Websocket message ID indicating a memory update.
 *
 * @constant {number}
 */
export const WS_ID_MEMORY_UPDATE = 4;

/**
 * Websocket message ID indicating an uptime update.
 *
 * @constant {number}
 */
export const WS_ID_UPTIME_UPDATE = 5;

/**
 * Websocket message ID indicating a snackbar message.
 *
 * @constant {number}
 */
export const WS_ID_SNACKBAR = 6;

/**
 * Websocket message ID indicating matterbridge has un update available.
 *
 * @constant {number}
 */
export const WS_ID_UPDATE_NEEDED = 7;

/**
 * Websocket message ID indicating a state update.
 *
 * @constant {number}
 */
export const WS_ID_STATEUPDATE = 8;

/**
 * Websocket message ID indicating to close a permanent snackbar message.
 *
 * @constant {number}
 */
export const WS_ID_CLOSE_SNACKBAR = 9;

/**
 * Websocket message ID indicating a shelly system update.
 * check:
 * curl -k http://127.0.0.1:8101/api/updates/sys/check
 * perform:
 * curl -k http://127.0.0.1:8101/api/updates/sys/perform
 *
 * @constant {number}
 */
export const WS_ID_SHELLY_SYS_UPDATE = 100;

/**
 * Websocket message ID indicating a shelly main update.
 * check:
 * curl -k http://127.0.0.1:8101/api/updates/main/check
 * perform:
 * curl -k http://127.0.0.1:8101/api/updates/main/perform
 *
 * @constant {number}
 */
export const WS_ID_SHELLY_MAIN_UPDATE = 101;

export interface WsMessage {
  id: number;
  dst: string;
  src: string;
  method: string;
}

export interface WsMessageRequest extends WsMessage {
  params: Record<string, string | number | boolean>;
}

export interface WsMessageResponse extends WsMessage {
  error?: string;
  success?: boolean;
  response: unknown;
}

export interface WsMessageLog extends WsMessage {
  level: string;
  time: string;
  name: string;
  message: string;
}
