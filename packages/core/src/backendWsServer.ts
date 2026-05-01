/**
 * This file contains the class FrontendsWsServer.
 *
 * @file backendWsServer.ts
 * @author Luca Liguori
 * @created 2026-03-30
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

// @matter
import { Logger, LogLevel as MatterLogLevel } from '@matter/general';
import type { EndpointNumber } from '@matter/types/datatype';
// @matterbridge
import { BroadcastServer } from '@matterbridge/thread';
import type {
  ApiMatter,
  RefreshRequiredChanged,
  SharedMatterbridge,
  WorkerMessage,
  WsMessageApiRequest,
  WsMessageApiResponse,
  WsMessageBroadcast,
  WsMessageErrorApiResponse,
} from '@matterbridge/types';
import { hasParameter } from '@matterbridge/utils/cli';
import { inspectError } from '@matterbridge/utils/error';
import { isValidNumber, isValidString } from '@matterbridge/utils/validate';
import { fireAndForget, withTimeout } from '@matterbridge/utils/wait';
// AnsiLogger
import { AnsiLogger, CYAN, debugStringify, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';
// WebSocket
import { WebSocket, WebSocketServer } from 'ws';

// matterbridge
import type { Frontend } from './frontend.js';

// istanbul ignore next 2 lines --loader flag is only used for development and testing, not in production
// eslint-disable-next-line no-console
if (hasParameter('loader')) console.log('\u001B[32mBackendWsServer loaded.\u001B[40;0m');

/**
 * Class representing a WebSocket server for frontend connections.
 *
 * This class manages the WebSocket server that allows communication between the backend and the frontend.
 * It provides methods to send messages to the frontend and handle incoming messages from the frontend.
 */
export class BackendsWsServer {
  private debug: boolean;
  private verbose: boolean;
  private webSocketServer: WebSocketServer | undefined;
  private log: AnsiLogger;
  private backend: Frontend;
  private matterbridge: SharedMatterbridge;
  private readonly server: BroadcastServer;

  /**
   * Create a new FrontendsWsServer instance.
   *
   * @param {SharedMatterbridge} matterbridge - The shared Matterbridge instance.
   * @param {Frontend} backend - The backend instance to which this WebSocket server will be connected.
   */
  constructor(matterbridge: SharedMatterbridge, backend: Frontend) {
    // istanbul ignore next 2 lines - debug/verbose flags are only used for development and testing, not in production
    this.debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-frontend') || hasParameter('verbose-frontend');
    this.verbose = hasParameter('verbose') || hasParameter('verbose-frontend');
    this.backend = backend;
    this.matterbridge = matterbridge;
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    this.log = new AnsiLogger({
      logName: 'BackendWsServer',
      logNameColor: '\x1b[38;5;97m',
      logTimestampFormat: TimestampFormat.TIME_MILLIS,
      logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO,
    });
    this.server = new BroadcastServer('frontend', this.log);
    this.server.on('broadcast_message', this.broadcastMsgHandler.bind(this));
  }

  /**
   * Destroy the BroadcastServer.
   */
  destroy(): void {
    this.server.off('broadcast_message', this.broadcastMsgHandler.bind(this));
    this.server.close();
  }

  /**
   * Handle incoming messages from the BroadcastServer.
   *
   * @param {WorkerMessage} msg - The message received from the frontend.
   */
  private broadcastMsgHandler(msg: WorkerMessage): void {
    // istanbul ignore else
    if (this.server.isWorkerRequest(msg)) {
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          this.log.logLevel = msg.params.logLevel;
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
      }
    }
  }

  /**
   * Start the WebSocket server and set up event listeners for incoming connections and messages.
   *
   * @returns {Promise<WebSocketServer | undefined>} A promise that resolves when the WebSocket server is successfully started.
   */
  async start(): Promise<WebSocketServer | undefined> {
    // Create a WebSocket server to be wired to the http or https server
    this.log.debug(`Creating WebSocketServer...`);
    this.webSocketServer = new WebSocketServer({ noServer: true });
    // istanbul ignore next
    this.backend.emit('websocket_server_listening', hasParameter('ssl') ? 'wss' : 'ws');

    this.webSocketServer.on('connection', (websocket, request) => {
      const clientIp = request.socket.remoteAddress;
      this.log.info(`WebSocketServer client ${CYAN}${clientIp}${nf} connected to Matterbridge`);

      // Set the global logger callback for the WebSocketServer
      let callbackLogLevel = LogLevel.NOTICE;
      if (this.log.logLevel === LogLevel.INFO || Logger.level === MatterLogLevel.INFO) callbackLogLevel = LogLevel.INFO;
      if (this.log.logLevel === LogLevel.DEBUG || Logger.level === MatterLogLevel.DEBUG) callbackLogLevel = LogLevel.DEBUG;
      AnsiLogger.setGlobalCallback(this.wssSendLogMessage.bind(this), callbackLogLevel);
      this.log.debug(`WebSocketServer logger global callback set to ${callbackLogLevel}`);

      websocket.on('message', (data) => {
        this.log.debug(`WebSocket client ${CYAN}${clientIp}${nf} sent a message`);
        fireAndForget(this.wsMessageHandler(websocket, data), this.log, `Error handling message from WebSocket client ${clientIp}`);
      });

      websocket.on('ping', () => {
        this.log.debug(`WebSocket client ${CYAN}${clientIp}${nf} ping received`);
        websocket.pong();
      });

      websocket.on('pong', () => {
        this.log.debug(`WebSocket client ${CYAN}${clientIp}${nf} pong received`);
      });

      websocket.on('close', (code, reason) => {
        this.log.info(`WebSocket client ${CYAN}${clientIp}${nf} disconnected code ${code} reason ${reason.toString()}`);
        if (this.webSocketServer?.clients.size === 0) {
          AnsiLogger.setGlobalCallback(undefined);
          this.log.debug('All WebSocket clients disconnected. WebSocketServer logger global callback removed');
          setTimeout(() => {
            // istanbul ignore else
            if (this.webSocketServer?.clients.size === 0) {
              this.log.debug('All WebSocket clients disconnected. Auth clients list cleared');
              this.backend.authClients.clear();
            }
          }, 1000).unref();
        } else {
          this.log.debug(`WebSocketServer still has ${this.webSocketServer?.clients.size} connected clients`);
        }
      });

      websocket.on('error', (error: Error) => {
        inspectError(this.log, `WebSocket client error`, error);
      });
    });

    this.webSocketServer.on('close', () => {
      this.log.debug(`WebSocketServer closed`);
    });

    this.webSocketServer.on('error', (ws: WebSocket, error: Error) => {
      inspectError(this.log, `WebSocketServer error`, error);
    });

    return this.webSocketServer;
  }

  /**
   * Stop the WebSocket server and close all active connections.
   *
   * @returns {Promise<WebSocketServer | undefined>} A promise that resolves when the WebSocket server is successfully stopped.
   */
  async stop(): Promise<WebSocketServer | undefined> {
    // Close the WebSocket server
    if (this.webSocketServer) {
      this.log.debug('Closing WebSocket server...');
      // Close all active connections
      this.webSocketServer.clients.forEach((client) => {
        // istanbul ignore else
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      await withTimeout(
        new Promise<void>((resolve) => {
          this.webSocketServer?.close((error) => {
            if (error) {
              inspectError(this.log, `Error closing WebSocket server`, error);
            } else {
              this.log.debug('WebSocket server closed successfully');
              this.backend.emit('websocket_server_stopped');
            }
            resolve();
          });
        }),
        10000,
        false,
      );
      this.webSocketServer.removeAllListeners();
      this.webSocketServer = undefined;
    } else {
      this.log.debug('WebSocket server is not running');
    }

    return this.webSocketServer;
  }

  /**
   * Helper function to check if there are active WebSocket clients connected to the server.
   *
   * @returns {boolean} True if there are active clients, false otherwise.
   */
  hasActiveClients(): boolean {
    return this.webSocketServer !== undefined && this.webSocketServer.clients.size > 0;
  }

  /**
   * Handles incoming websocket api request messages from the Matterbridge frontend.
   *
   * @param {WebSocket} client - The websocket client that sent the message.
   * @param {WebSocket.RawData} rawData - The raw data of the message received from the client.
   * @returns {Promise<void>} A promise that resolves when the message has been handled.
   */
  private async wsMessageHandler(client: WebSocket, rawData: WebSocket.RawData): Promise<void> {
    let data: WsMessageApiRequest;

    const sendResponse = (data: WsMessageApiResponse | WsMessageErrorApiResponse) => {
      if (client.readyState === client.OPEN) {
        // istanbul ignore else
        if ('response' in data) {
          const { response, ...rest } = data;
          this.log.debug(`Sending api response message: ${debugStringify(rest)}`);
        } else if ('error' in data) {
          this.log.debug(`Sending api error message: ${debugStringify(data)}`);
        }
        client.send(JSON.stringify(data));
      } else {
        this.log.error('Cannot send api response, client not connected');
      }
    };

    try {
      data = JSON.parse(rawData.toString());
      if (!isValidNumber(data.id) || !isValidString(data.dst) || !isValidString(data.src) || !isValidString(data.method) || data.dst !== 'Matterbridge') {
        this.log.error(`Invalid message from websocket client: ${debugStringify(data)}`);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid message' });
        return;
      }
      this.log.debug(`Received message from websocket client: ${debugStringify(data)}`);

      // Handle the message based on the method
    } catch (error) {
      inspectError(this.log, `Error parsing message from websocket client`, error);
      return;
    }
  }

  /**
   * Helper function to send a broadcast message to all connected clients.
   *
   * @param {WsMessageBroadcast} msg - The message to send.
   */
  wssBroadcastMessage(msg: WsMessageBroadcast) {
    if (!this.hasActiveClients()) return;
    try {
      const stringifiedMsg = JSON.stringify(msg);
      // istanbul ignore next debug/verbose branch
      if (this.verbose) this.log.debug(`Sending a broadcast message: ${debugStringify(msg)}`);
      this.webSocketServer?.clients.forEach((client) => {
        // istanbul ignore else
        if (client.readyState === client.OPEN) {
          client.send(stringifiedMsg);
        }
      });
    } catch (error) {
      inspectError(this.log, `Error broadcasting message to websocket clients`, error);
    }
  }

  /**
   * Sends a WebSocket log message to all connected clients. The function is called by AnsiLogger.setGlobalCallback.
   *
   * @param {string} level - The logger level of the message: debug info notice warn error fatal...
   * @param {string} time - The time string of the message
   * @param {string} name - The logger name of the message
   * @param {string} message - The content of the message.
   *
   * @remarks
   * The function removes ANSI escape codes, leading asterisks, non-printable characters, and replaces all occurrences of \t and \n.
   * It also replaces all occurrences of \" with " and angle-brackets with &lt; and &gt;.
   * The function sends the message to all connected clients.
   */
  wssSendLogMessage(level: string, time: string, name: string, message: string): void {
    if (!this.hasActiveClients()) return;
    if (!level || !time || !name || !message) return;
    // Remove ANSI escape codes from the message
    // eslint-disable-next-line no-control-regex
    message = message.replace(/\x1B\[[0-9;]*[m|s|u|K]/g, '');
    // Remove leading asterisks from the message
    message = message.replace(/^\*+/, '');
    // Replace all occurrences of \t and \n
    message = message.replace(/[\t\n]/g, '');
    // Remove non-printable characters
    // eslint-disable-next-line no-control-regex
    message = message.replace(/[\x00-\x1F\x7F]/g, '');
    // Replace all occurrences of \" with "
    message = message.replace(/\\"/g, '"');

    // Define the maximum allowed length for continuous characters without a space
    const maxContinuousLength = 100;
    const keepStartLength = 20;
    const keepEndLength = 20;
    // Split the message into words
    if (level !== 'spawn') {
      message = message
        .split(' ')
        .map((word) => {
          // If the word length exceeds the max continuous length, insert spaces and truncate
          if (word.length > maxContinuousLength) {
            return word.slice(0, keepStartLength) + ' ... ' + word.slice(-keepEndLength);
          }
          return word;
        })
        .join(' ');
    }
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log', success: true, response: { level, time, name, message } });
  }

  /**
   * Sends a need to refresh WebSocket message to all connected clients.
   *
   * @param {string} changed - The changed value.
   * @param {Record<string, unknown>} params - Additional parameters to send with the message.
   * possible values for changed:
   * - 'settings' (when the bridge has started in bridge mode or childbridge mode and when update finds a new version)
   * - 'plugins' with param 'lock' (prevents to the config to open)
   * - 'devices'
   * - 'matter' with param 'matter' (QRDiv component)
   * @param {ApiMatter} params.matter - The matter device that has changed. Required if changed is 'matter'.
   * @param {string} params.lock - The name of the plugin that has locked the refresh. Required if changed is 'plugins'.
   */
  wssSendRefreshRequired(changed: RefreshRequiredChanged, params?: { matter?: ApiMatter; lock?: string }) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a refresh required message to all connected clients');
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed, lock: params?.lock, ...params } });
  }

  /**
   * Sends a need to restart WebSocket message to all connected clients.
   *
   * @param {boolean} snackbar - If true, a snackbar message will be sent to all connected clients. Default is true.
   * @param {boolean} fixed - If true, the restart is fixed and will not be reset by plugin restarts. Default is false.
   */
  wssSendRestartRequired(snackbar: boolean = true, fixed: boolean = false) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a restart required message to all connected clients');
    this.backend.restartRequired = true;
    this.backend.fixedRestartRequired = fixed;
    // istanbul ignore else
    if (snackbar === true) this.wssSendSnackbarMessage(`Restart required`, 0);
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'restart_required', success: true, response: { fixed } });
  }

  /**
   * Sends a no need to restart WebSocket message to all connected clients.
   *
   * @param {boolean} snackbar - If true, the snackbar message will be cleared from all connected clients. Default is true.
   */
  wssSendRestartNotRequired(snackbar: boolean = true) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a restart not required message to all connected clients');
    this.backend.restartRequired = false;
    // istanbul ignore else
    if (snackbar === true) this.wssSendCloseSnackbarMessage(`Restart required`);
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'restart_not_required', success: true });
  }

  /**
   * Sends a need to update WebSocket message to all connected clients.
   *
   * @param {boolean} devVersion - If true, the update is for a development version. Default is false.
   */
  wssSendUpdateRequired(devVersion: boolean = false) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending an update required message to all connected clients');
    this.backend.updateRequired = true;
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'update_required', success: true, response: { devVersion } });
  }

  /**
   * Sends a cpu update message to all connected clients.
   *
   * @param {number} cpuUsage - The CPU usage percentage to send.
   * @param {number} processCpuUsage - The CPU usage percentage of the process to send.
   */
  wssSendCpuUpdate(cpuUsage: number, processCpuUsage: number) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a cpu update message to all connected clients');
    this.wssBroadcastMessage({
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'cpu_update',
      success: true,
      response: { cpuUsage: Math.round(cpuUsage * 100) / 100, processCpuUsage: Math.round(processCpuUsage * 100) / 100 },
    });
  }

  /**
   * Sends a memory update message to all connected clients.
   *
   * @param {string} totalMemory - The total memory in bytes.
   * @param {string} freeMemory - The free memory in bytes.
   * @param {string} rss - The resident set size in bytes.
   * @param {string} heapTotal - The total heap memory in bytes.
   * @param {string} heapUsed - The used heap memory in bytes.
   * @param {string} external - The external memory in bytes.
   * @param {string} arrayBuffers - The array buffers memory in bytes.
   */
  wssSendMemoryUpdate(totalMemory: string, freeMemory: string, rss: string, heapTotal: string, heapUsed: string, external: string, arrayBuffers: string) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a memory update message to all connected clients');
    this.wssBroadcastMessage({
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'memory_update',
      success: true,
      response: { totalMemory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers },
    });
  }

  /**
   * Sends an uptime update message to all connected clients.
   *
   * @param {string} systemUptime - The system uptime in a human-readable format.
   * @param {string} processUptime - The process uptime in a human-readable format.
   */
  wssSendUptimeUpdate(systemUptime: string, processUptime: string) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a uptime update message to all connected clients');
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'uptime_update', success: true, response: { systemUptime, processUptime } });
  }

  /**
   * Sends an open snackbar message to all connected clients.
   *
   * @param {string} message - The message to send.
   * @param {number} timeout - The timeout in seconds for the snackbar message. Default is 5 seconds.
   * @param {'info' | 'warning' | 'error' | 'success'} severity - The severity of the message.
   * possible values are: 'info', 'warning', 'error', 'success'. Default is 'info'.
   *
   * @remarks
   * If timeout is 0, the snackbar message will be displayed until closed by the user.
   */
  wssSendSnackbarMessage(message: string, timeout: number = 5, severity: 'info' | 'warning' | 'error' | 'success' = 'info') {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a snackbar message to all connected clients');
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'snackbar', success: true, response: { message, timeout, severity } });
  }

  /**
   * Sends a close snackbar message to all connected clients.
   * It will close the snackbar message with the same message and timeout = 0.
   *
   * @param {string} message - The message to send.
   */
  wssSendCloseSnackbarMessage(message: string) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending a close snackbar message to all connected clients');
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'close_snackbar', success: true, response: { message } });
  }

  /**
   * Sends an attribute update message to all connected WebSocket clients.
   *
   * @param {string | undefined} plugin - The name of the plugin.
   * @param {string | undefined} serialNumber - The serial number of the device.
   * @param {string | undefined} uniqueId - The unique identifier of the device.
   * @param {EndpointNumber} number - The endpoint number where the attribute belongs.
   * @param {string} id - The endpoint id where the attribute belongs.
   * @param {string} cluster - The cluster name where the attribute belongs.
   * @param {string} attribute - The name of the attribute that changed.
   * @param {number | string | boolean | null} value - The new value of the attribute.
   */
  wssSendAttributeChangedMessage(
    plugin: string,
    serialNumber: string,
    uniqueId: string,
    number: EndpointNumber,
    id: string,
    cluster: string,
    attribute: string,
    value: number | string | boolean | null,
  ) {
    if (!this.hasActiveClients()) return;
    // istanbul ignore next debug/verbose branch
    if (this.verbose) this.log.debug('Sending an attribute update message to all connected clients');
    this.wssBroadcastMessage({
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'state_update',
      success: true,
      response: { plugin, serialNumber, uniqueId, number, id, cluster, attribute, value },
    });
  }
}
