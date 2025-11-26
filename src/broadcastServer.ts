/**
 * This file contains the BroadcastServer class.
 *
 * @file broadcastServer.ts
 * @author Luca Liguori
 * @created 2025-10-05
 * @version 1.0.3
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

import { type AnsiLogger, CYAN, db, debugStringify } from 'node-ansi-logger';

import type { WorkerMessage, WorkerMessageType, WorkerRequest, WorkerResponse, WorkerSrcType } from './broadcastServerTypes.js';
import { hasParameter } from './utils/commandLine.js';

interface BroadcastServerEvents {
  'broadcast_message': [msg: WorkerMessage];
}

/**
 * BroadcastServer class to handle broadcast messages between workers with BroadcastChannel.
 */
export class BroadcastServer extends EventEmitter<BroadcastServerEvents> {
  private readonly broadcastChannel: BroadcastChannel;
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
    this.broadcastChannel.onmessage = this.broadcastMessageHandler.bind(this);
  }

  /**
   * Closes the broadcast channel.
   *
   * @returns {void}
   */
  close(): void {
    // @ts-expect-error: wrong type definition in node.d.ts
    this.broadcastChannel.onmessage = null;
    this.broadcastChannel.close();
  }

  /**
   * Generates a unique ID with range 100000-999999.
   *
   * @returns {number} - A unique ID between 100000 and 999999
   */
  getUniqueId(): number {
    return Math.floor(Math.random() * (999999 - 100000 + 1)) + 100000; // random int between 100000 and 999999
  }

  /**
   * Type guard to check if a message is a request of a specific type.
   *
   * @param {unknown} msg - The message to check.
   * @param {T} type - The type to check against.
   * @returns {msg is WorkerRequest<T>} True if the message is a request of the specified type.
   */
  isWorkerRequest<T extends WorkerMessageType>(msg: unknown, type: T): msg is WorkerRequest<T> {
    return typeof msg === 'object' && msg !== null && 'id' in msg && 'timestamp' in msg && 'type' in msg && msg.type === type && !('response' in msg) && 'src' in msg && 'dst' in msg;
  }

  /**
   * Type guard to check if a message is a response of a specific type.
   *
   * @param {unknown} msg - The message to check.
   * @param {T} type - The type to check against.
   * @returns {msg is WorkerResponse<T>} True if the message is a response of the specified type.
   */
  isWorkerResponse<T extends WorkerMessageType>(msg: unknown, type: T): msg is WorkerResponse<T> {
    return typeof msg === 'object' && msg !== null && 'id' in msg && 'timestamp' in msg && 'type' in msg && msg.type === type && 'response' in msg && 'src' in msg && 'dst' in msg;
  }

  /**
   * Handles incoming broadcast messages.
   *
   * @param {MessageEvent} event - The message event containing the broadcast message.
   * @returns {void}
   */
  private broadcastMessageHandler(event: MessageEvent): void {
    const data = event.data as WorkerMessage;
    if (this.verbose && (data.dst === this.name || data.dst === 'all')) this.log.debug(`Server ${CYAN}${this.name}${db} received broadcast message: ${debugStringify(data)}`);
    this.emit('broadcast_message', data);
  }

  /**
   * Broadcast a message to all workers.
   *
   * @param {WorkerMessage} message - The message to broadcast.
   */
  broadcast(message: WorkerMessage) {
    if (this.verbose) this.log.debug(`Broadcasting message: ${debugStringify(message)}`);
    this.broadcastChannel.postMessage(message);
  }

  /**
   * Broadcast a request message to all workers.
   *
   * @param {WorkerRequest<T>} message - The typed request message to broadcast.
   * @returns {void}
   */
  request<M extends WorkerRequest<WorkerMessageType>>(message: M): void {
    if (message.id === undefined) {
      message.id = this.getUniqueId();
    }
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    if (!this.isWorkerRequest(message, message.type)) {
      this.log.error(`Invalid request message format for broadcast: ${debugStringify(message)}`);
      return;
    }
    if (this.verbose) this.log.debug(`Broadcasting request message: ${debugStringify(message)}`);
    this.broadcastChannel.postMessage(message);
  }

  /**
   * Broadcast a response message to all workers.
   *
   * @param {WorkerResponse<T>} message - The typed response message to broadcast.
   * @returns {void}
   */
  respond<M extends WorkerResponse<WorkerMessageType>>(message: M): void {
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    if (!this.isWorkerResponse(message, message.type)) {
      this.log.error(`Invalid response message format for broadcast: ${debugStringify(message)}`);
      return;
    }
    if (this.verbose) this.log.debug(`Broadcasting response message: ${debugStringify(message)}`);
    this.broadcastChannel.postMessage(message);
  }

  /**
   * Fetch data from a worker.
   * It broadcasts a request message and waits for a response with the same id.
   *
   * @param {WorkerRequest<T>} message - The typed request message to broadcast.
   * @param {number} timeout - The timeout in milliseconds to wait for a response. Default is 250ms.
   * @returns {Promise<WorkerResponse<T>>} A promise that resolves with the response from the worker or rejects on timeout.
   * @throws {Error} If the fetch operation times out after 250ms.
   */
  async fetch<M extends WorkerRequest<WorkerMessageType>>(message: M, timeout: number = 250): Promise<WorkerResponse<M['type']>> {
    if (message.id === undefined) {
      message.id = this.getUniqueId();
    }
    if (message.timestamp === undefined) {
      message.timestamp = Date.now();
    }
    if (this.verbose) this.log.debug(`Fetching message: ${debugStringify(message)}`);

    return new Promise<WorkerResponse<M['type']>>((resolve, reject) => {
      const responseHandler = (msg: WorkerMessage) => {
        if (this.isWorkerResponse(msg, message.type) && msg.id === message.id) {
          clearTimeout(timeoutId);
          this.off('broadcast_message', responseHandler);
          if (this.verbose) this.log.debug(`Fetch response: ${debugStringify(msg)}`);
          resolve(msg);
        } else if (this.isWorkerResponse(msg, message.type) && msg.id !== message.id) {
          if (this.verbose) this.log.debug(`Fetch received unrelated response: ${debugStringify(msg)}`);
        }
      };

      this.on('broadcast_message', responseHandler);
      this.request(message);

      const timeoutId = setTimeout(() => {
        this.off('broadcast_message', responseHandler);
        reject(new Error(`Fetch timeout after ${timeout}ms for message id ${message.id}`));
      }, timeout);
    });
  }
}
