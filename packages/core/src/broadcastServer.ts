/**
 * This file contains the BroadcastServer class.
 *
 * @file broadcastServer.ts
 * @author Luca Liguori
 * @created 2025-10-05
 * @version 2.0.1
 * @license Apache-2.0
 *
 * Copyright 2024, 2025, 2026 Luca Liguori.
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

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mBroadcastServer loaded.\u001B[40;0m');

import { EventEmitter } from 'node:events';
import { BroadcastChannel } from 'node:worker_threads';

import { type AnsiLogger, CYAN, db, debugStringify, er } from 'node-ansi-logger';
import { hasParameter, logError } from '@matterbridge/utils';

import type { WorkerMessage, WorkerMessageRequest, WorkerMessageRequestAny, WorkerMessageResponse, WorkerMessageResponseSuccess, WorkerMessageTypes, WorkerSrcType } from './broadcastServerTypes.js';

interface BroadcastServerEvents {
  'broadcast_message': [msg: WorkerMessage];
}

/**
 * BroadcastServer class to handle broadcast messages between workers with BroadcastChannel.
 */
export class BroadcastServer extends EventEmitter<BroadcastServerEvents> {
  private readonly broadcastChannel: BroadcastChannel;
  private closed = false;
  private readonly debug = hasParameter('debug') || hasParameter('verbose');
  private readonly verbose = hasParameter('verbose');

  /**
   * Creates an instance of BroadcastServer.
   *
   * @param {string} name - The name of the broadcast server.
   * @param {AnsiLogger} log - The logger instance to use for logging.
   * @param {string} channel - The channel name for the broadcast. Default is 'broadcast-channel'.
   */
  constructor(
    readonly name: WorkerSrcType,
    private readonly log: AnsiLogger,
    private readonly channel: string = 'broadcast-channel',
  ) {
    super();
    this.broadcastChannel = new BroadcastChannel(this.channel);
    // this.broadcastChannel.unref();
    this.broadcastChannel.onmessage = this.broadcastMessageHandler.bind(this);
    this.broadcastChannel.onmessageerror = this.broadcastMessageErrorHandler.bind(this);
  }

  /**
   * Closes the broadcast channel.
   *
   * @returns {void}
   */
  close(): void {
    this.broadcastChannel.onmessage = null;
    this.broadcastChannel.onmessageerror = null;
    this.broadcastChannel.close();
    this.closed = true;
  }

  /**
   * Handles incoming broadcast messages.
   *
   * @param {MessageEvent} event - The message event containing the broadcast message.
   * @returns {void}
   */
  private broadcastMessageHandler(event: MessageEvent): void {
    const msg = event.data as WorkerMessage;
    if (msg.dst === this.name || msg.dst === 'all') {
      if (this.verbose) this.log.debug(`Server ${CYAN}${this.name}${db} received broadcast message: ${debugStringify(msg)}`);
      this.emit('broadcast_message', msg);
    } else {
      if (this.verbose) this.log.debug(`Server ${CYAN}${this.name}${db} received unrelated broadcast message: ${debugStringify(msg)}`);
    }
  }

  /**
   * Handles incoming broadcast error messages.
   *
   * @param {MessageEvent} event - The message event containing the broadcast message.
   * @returns {void}
   */
  private broadcastMessageErrorHandler(event: MessageEvent): void {
    const msg = event.data as WorkerMessage;
    this.log.error(`Server ${CYAN}${this.name}${db} received message error: ${debugStringify(msg)}`);
  }

  /**
   * Generate a pseudo-random identifier between 100,000,000 and 999,999,999.
   *
   * @returns {number} A nine-digit identifier.
   */
  getUniqueId(): number {
    return Math.floor(Math.random() * 900000000) + 100000000;
  }

  /**
   * Type guard to verify a value matches the WorkerMessageRequest structure.
   *
   * @param {unknown} value Value to test.
   * @returns {value is WorkerMessageRequest} True when the value looks like a request message.
   */
  isWorkerRequest(value: unknown): value is WorkerMessageRequest {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const message = value as Partial<WorkerMessageRequest> & { result?: unknown; error?: unknown };
    if (typeof message.type !== 'string' || typeof message.src !== 'string' || typeof message.dst !== 'string' || typeof message.id !== 'number' || typeof message.timestamp !== 'number') {
      return false;
    }

    return message.result === undefined && message.error === undefined;
  }

  /**
   * Type guard to verify a value matches a specific WorkerMessageRequest structure.
   *
   * @param {unknown} value Value to test.
   * @param {K} type Worker message type to match.
   * @returns {value is WorkerMessageRequest<K>} True when the value looks like a request message of the requested type.
   */
  isWorkerRequestOfType<K extends keyof WorkerMessageTypes>(value: unknown, type: K): value is WorkerMessageRequest<K> {
    return this.isWorkerRequest(value) && (value as WorkerMessageRequest).type === type;
  }

  /**
   * Type guard to verify a value matches the WorkerMessageResponse structure.
   *
   * @param {unknown} value Value to test.
   * @returns {value is WorkerMessageResponse} True when the value looks like a response message.
   */
  isWorkerResponse(value: unknown): value is WorkerMessageResponse {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const message = value as Partial<WorkerMessageResponse> & { error?: unknown; result?: unknown };
    if (typeof message.type !== 'string' || typeof message.src !== 'string' || typeof message.dst !== 'string' || typeof message.id !== 'number' || typeof message.timestamp !== 'number') {
      return false;
    }

    const hasError = typeof message.error === 'string';
    const hasResult = message.result !== undefined;
    return hasError !== hasResult;
  }

  /**
   * Type guard to verify a value matches a specific WorkerMessageResponse structure.
   *
   * @param {unknown} value Value to test.
   * @param {K} type Worker message type to match.
   * @returns {value is WorkerMessageResponse<K>} True when the value looks like a response message of the requested type.
   */
  isWorkerResponseOfType<K extends keyof WorkerMessageTypes>(value: unknown, type: K): value is WorkerMessageResponse<K> {
    return this.isWorkerResponse(value) && (value as WorkerMessageResponse).type === type;
  }

  /**
   * Broadcast a message to all workers.
   *
   * @param {WorkerMessage} message - The message to broadcast.
   * @returns {void}
   *
   * @remarks No checks are performed on the message structure.
   */
  broadcast(message: WorkerMessage): void {
    if (this.closed) {
      this.log.error('Broadcast channel is closed');
      return;
    }
    if (message.id === undefined) {
      message.id = this.getUniqueId();
    }
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    message.src = this.name;
    if (this.verbose) this.log.debug(`Broadcasting message: ${debugStringify(message)}`);
    try {
      this.broadcastChannel.postMessage(message);
    } catch (error) {
      logError(this.log, `Failed to broadcast message ${debugStringify(message)}${er}`, error);
    }
  }

  /**
   * Send a request message from the worker implementation.
   *
   * @template K
   * @param {WorkerMessageRequest<K>} message The request message to send.
   * @returns {void}
   */
  request<K extends keyof WorkerMessageTypes>(message: WorkerMessageRequest<K>): void {
    if (this.closed) {
      this.log.error('Broadcast channel is closed');
      return;
    }
    if (message.id === undefined) {
      message.id = this.getUniqueId();
    }
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    message.src = this.name;
    if (!this.isWorkerRequest(message)) {
      this.log.error(`Invalid request message format: ${debugStringify(message)}`);
      return;
    }
    if (this.verbose) this.log.debug(`Broadcasting request message: ${debugStringify(message)}`);
    try {
      this.broadcastChannel.postMessage(message);
    } catch (error) {
      logError(this.log, `Failed to broadcast request message ${debugStringify(message)}${er}`, error);
    }
  }

  /**
   * Send a response message from the worker implementation.
   * It also calculates the elapsed time since the request was sent and swaps the source and destination fields.
   *
   * @template K
   * @param {WorkerMessageResponse<K>} message The response message to send.
   * @returns {void}
   */
  respond<K extends keyof WorkerMessageTypes>(message: WorkerMessageResponse<K>): void {
    if (this.closed) {
      this.log.error('Broadcast channel is closed');
      return;
    }
    if (typeof message.timestamp === 'number') {
      message.elapsed = Date.now() - message.timestamp;
    }
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    if (message.dst === this.name || message.dst === 'all') {
      message.dst = message.src;
    }
    message.src = this.name;
    if (!this.isWorkerResponse(message)) {
      this.log.error(`Invalid response message format: ${debugStringify(message)}`);
      return;
    }
    if (this.verbose) this.log.debug(`Broadcasting response message: ${debugStringify(message)}`);
    try {
      this.broadcastChannel.postMessage(message);
    } catch (error) {
      logError(this.log, `Failed to broadcast response message ${debugStringify(message)}${er}`, error);
    }
  }

  /**
   * Fetch data from a worker.
   * It broadcasts a request message and waits for a valid response with the same id.
   *
   * @template K
   * @param {WorkerMessageRequest<K>} message - The typed request message to fetch.
   * @param {number} timeout - The timeout in milliseconds to wait for a response. Default is 250ms.
   * @returns {Promise<WorkerMessageResponseSuccess<K>>} A promise that resolves with the successful response from the worker or rejects on timeout.
   * @throws {Error} If the fetch operation times out after 250ms or if an error response is received or if the response is malformed.
   */
  async fetch<T extends WorkerMessageRequestAny, K extends Extract<keyof WorkerMessageTypes, T['type']>>(message: T, timeout: number = 250): Promise<WorkerMessageResponseSuccess<K>> {
    if (this.closed) {
      return Promise.reject(new Error('Broadcast channel is closed'));
    }
    if (message.id === undefined) {
      message.id = this.getUniqueId();
    }
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    if (this.verbose) this.log.debug(`Fetching message: ${debugStringify(message)}`);

    return new Promise<WorkerMessageResponseSuccess<K>>((resolve, reject) => {
      const responseHandler = (msg: WorkerMessage) => {
        if (this.isWorkerResponseOfType(msg, message.type) && msg.id === message.id) {
          clearTimeout(timeoutId);
          this.off('broadcast_message', responseHandler);
          if (this.verbose) this.log.debug(`Fetch response: ${debugStringify(msg)}`);
          if ('error' in msg && typeof msg.error === 'string') {
            reject(new Error(`Fetch received error response ${msg.error} to message type ${message.type} id ${message.id} from ${message.src} to ${message.dst}`));
          } else if ('result' in msg) {
            resolve(msg as WorkerMessageResponseSuccess<K>);
          } else {
            reject(new Error(`Fetch received malformed response for message type ${message.type} id ${message.id} from ${message.src} to ${message.dst}`));
          }
          return;
        }
      };

      this.on('broadcast_message', responseHandler);
      this.request(message);

      const timeoutId = setTimeout(() => {
        this.off('broadcast_message', responseHandler);
        reject(new Error(`Fetch timeout after ${timeout}ms for message type ${message.type} id ${message.id} from ${message.src} to ${message.dst}`));
      }, timeout);
    });
  }
}
