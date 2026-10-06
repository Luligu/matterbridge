/**
 * @file packages/thread/src/backend.ts
 * @description This file contains the class Backend.
 * @author Luca Liguori
 * @created 2026-03-30
 * @version 1.0.1
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

/* oxlint-disable typescript/prefer-nullish-coalescing */

// WARNING: Not released yet and excluded from Vitest coverage

// Node.js built-in modules
import EventEmitter from 'node:events';
import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer, ServerOptions as HttpsServerOptions } from 'node:https';
import path from 'node:path';

import {
  type ApiClusters,
  type ApiDevice,
  type ApiPlugin,
  type ApiSettings,
  NODE_STORAGE_DIR,
  type SharedMatterbridge,
  type WorkerMessage,
  type ApiMatter,
} from '@matterbridge/types';
import { getParameter, hasAnyParameter, hasParameter } from '@matterbridge/utils/cli';
import { writeDiagnostic } from '@matterbridge/utils/diagnostic';
import { getErrorMessage, inspectError, logError } from '@matterbridge/utils/error';
import { logModuleLoaded } from '@matterbridge/utils/loader';
import { fireAndForget } from '@matterbridge/utils/wait';
// AnsiLogger
import { AnsiLogger, LogLevel, rs, TimestampFormat, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

// Local imports
import type { BackendExpress } from './backendExpress.js';
import type { BackendWsServer } from './backendWsServer.js';
// @matterbridge
import { BroadcastServer } from './broadcastServer.js';

logModuleLoaded('Backend');

/**
 * Represents the Backend events.
 */
interface BackendEvents {
  server_listening: [protocol: string, port: number, address?: string];
  server_error: [error: unknown];
  server_stopped: [];
  websocket_server_listening: [protocol: string];
  websocket_server_stopped: [];
}

/**
 * Class representing a backend for frontend connections.
 *
 * This class manages the backend that allows communication between the backend and the frontend.
 */
export class Backend extends EventEmitter<BackendEvents> {
  private debug: boolean;
  private verbose: boolean;
  private diagnostic: boolean;
  private log: AnsiLogger;
  private matterbridge: SharedMatterbridge;
  private readonly server: BroadcastServer;
  private port: number = 8283;
  private listening = false;
  private httpServer: HttpServer | undefined;
  private httpsServer: HttpsServer | undefined;

  /** True when the backend serves https and wss (--ssl, --tls or --mtls). */
  readonly secure: boolean;
  /** True when the backend requires a client certificate (--mtls). */
  readonly requestCert: boolean;

  backendExpress: BackendExpress | undefined;
  backendWsServer: BackendWsServer | undefined;

  storedPassword: string | undefined = undefined;
  authClients = new Set<string>();
  authClientsTimeout: NodeJS.Timeout | undefined = undefined;

  /**
   * Create a new Backend instance.
   *
   * @param {SharedMatterbridge} matterbridge - The shared Matterbridge instance.
   */
  constructor(matterbridge: SharedMatterbridge) {
    super();
    this.debug = hasAnyParameter('debug', 'verbose', 'debug-backend', 'verbose-backend');
    this.verbose = hasAnyParameter('verbose', 'verbose-backend');
    this.diagnostic = hasAnyParameter('diagnostic', 'diagnostic-backend');
    this.secure = hasAnyParameter('ssl', 'tls', 'mtls');
    this.requestCert = hasParameter('mtls');
    this.matterbridge = matterbridge;
    this.log = new AnsiLogger({
      logName: 'Backend',
      logNameColor: '\x1b[38;5;97m',
      logTimestampFormat: TimestampFormat.TIME_MILLIS,
      logLevel: this.debug ? LogLevel.DEBUG : LogLevel.INFO,
    });
    this.server = new BroadcastServer('frontend', this.log);
    this.server.on('broadcast_message', (msg) => fireAndForget(this.broadcastMsgHandler(msg), this.log, 'Broadcast message handler'));
  }

  /**
   * Destroy the BroadcastServer.
   */
  destroy(): void {
    this.server.close();
  }

  /**
   * Handle incoming messages from the BroadcastServer.
   *
   * @param {WorkerMessage} msg - The message received from the frontend.
   */
  // oxlint-disable-next-line typescript/require-await
  private async broadcastMsgHandler(msg: WorkerMessage): Promise<void> {
    if (this.server.isWorkerRequest(msg)) {
      switch (msg.type) {
        case 'get_log_level':
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        case 'set_log_level':
          this.log.logLevel = msg.params.logLevel;
          this.server.respond({ ...msg, result: { logLevel: this.log.logLevel } });
          break;
        // no default
      }
    }
  }

  /**
   *  Start the backend.
   *
   * @param {number} [port] - The port on which the backend should listen for frontend connections.
   * @returns {Promise<void>} A promise that resolves when the backend has started.
   */
  async start(port: number = 8283): Promise<void> {
    this.log.debug('Starting backend...');
    this.port = port;
    const start = performance.now();
    const nodeStorage = new NodeStorageManager({
      dir: path.join(this.matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR),
      writeQueue: false,
      expiredInterval: undefined,
      logging: false,
    });
    try {
      const nodeContext = await nodeStorage.createStorage('matterbridge');
      try {
        this.storedPassword = await nodeContext.get<string>('password', '');
      } finally {
        await nodeContext.close();
      }
    } finally {
      await nodeStorage.close();
      if (this.diagnostic) writeDiagnostic('Backend', `Loading storedPassword took ${(performance.now() - start).toFixed(2)} ms`);
    }
    const { BackendExpress } = await import('./backendExpress.js');
    const { BackendWsServer } = await import('./backendWsServer.js');
    this.backendExpress = new BackendExpress(this.matterbridge, this);
    this.backendWsServer = new BackendWsServer(this.matterbridge, this);

    if (this.secure) {
      // SSL is enabled, load the certificate and the private key
      let cert: string | undefined;
      let key: string | undefined;
      let ca: string | undefined;
      let fullChain: string | undefined;

      let pfx: Buffer | undefined;
      let passphrase: string | undefined;

      let httpsServerOptions: HttpsServerOptions;

      const fs = await import('node:fs');
      if (fs.existsSync(path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.p12'))) {
        // Load the p12 certificate and the passphrase
        try {
          pfx = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.p12'));
          this.log.info(`Loaded p12 certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.p12')}`);
        } catch (error) {
          logError(this.log, `Error reading p12 certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.p12')}`, error);
          this.emit('server_error', error);
          return;
        }
        try {
          passphrase = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.pass'), 'utf8');
          passphrase = passphrase.trim(); // Ensure no extra characters
          this.log.info(`Loaded p12 passphrase file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.pass')}`);
        } catch (error) {
          logError(this.log, `Error reading p12 passphrase file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.pass')}`, error);
          this.emit('server_error', error);
          return;
        }
        httpsServerOptions = { pfx, passphrase };
      } else {
        // Load the SSL certificate, the private key and optionally the CA certificate. If the CA certificate is present, it will be used to create a full chain certificate.
        try {
          cert = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.pem'), 'utf8');
          this.log.info(`Loaded certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.pem')}`);
        } catch (error) {
          logError(this.log, `Error reading certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'cert.pem')}`, error);
          this.emit('server_error', error);
          return;
        }
        try {
          key = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'key.pem'), 'utf8');
          this.log.info(`Loaded key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'key.pem')}`);
        } catch (error) {
          logError(this.log, `Error reading key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'key.pem')}`, error);
          this.emit('server_error', error);
          return;
        }
        try {
          ca = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'ca.pem'), 'utf8');
          fullChain = `${cert}\n${ca}`;
          this.log.info(`Loaded CA certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'ca.pem')}`);
        } catch (error) {
          this.log.info(`CA certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs', 'ca.pem')} not loaded: ${getErrorMessage(error)}`);
        }
        httpsServerOptions = { cert: fullChain ?? cert, key, ca };
      }
      if (this.requestCert) {
        httpsServerOptions.requestCert = true; // Request client certificate
        httpsServerOptions.rejectUnauthorized = true; // Require client certificate validation
      }

      // Create an HTTPS server with the SSL certificate and private key (ca is optional) and attach the express app
      const https = await import('node:https');
      await this.backendExpress.start();
      try {
        this.log.debug(`Creating HTTPS server...`);
        this.httpsServer = https.createServer(httpsServerOptions, this.backendExpress.expressApp);
      } catch (error) {
        logError(this.log, `Failed to create HTTPS server`, error);
        this.emit('server_error', error);
        await this.backendExpress.stop();
        return;
      }
      await this.backendWsServer.start();

      // Listen on the specified port
      this.httpsServer.listen(this.port, getParameter('bind'), () => {
        const addr = this.httpsServer?.address();
        // v8 ignore else
        if (addr && typeof addr !== 'string') {
          this.log.info(`The frontend https server is bound to ${addr.family} ${addr.address}:${addr.port}`);
        }
        if (this.matterbridge.systemInformation.ipv4Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
        if (this.matterbridge.systemInformation.ipv6Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
        this.listening = true;
        this.emit('server_listening', 'https', this.port);
      });

      this.httpsServer.on('upgrade', (req, socket, head): void => {
        try {
          // Only proceed for real WebSocket upgrades
          /* v8 ignore next - Node.js emits the upgrade event only when the Upgrade header is present, so the '' fallback is only a safety check */
          const upgrade = (req.headers.upgrade || '').toLowerCase();
          if (upgrade !== 'websocket') {
            socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          // Build a URL so we can read ?password=...
          /* v8 ignore next - req.url is always set by Node.js on server requests, and the Host header is required by HTTP/1.1 (only an HTTP/1.0 request can omit it), so both fallbacks are only safety checks */
          const url = new URL(req.url ?? '/', `https://${req.headers.host || 'localhost'}`);

          // Validate WebSocket password
          const password = url.searchParams.get('password') ?? '';
          if (password !== this.storedPassword) {
            this.log.error(`WebSocket upgrade error: Invalid password ${password ? '[redacted]' : '(empty)'}`);
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          // Complete the WebSocket handshake
          this.log.debug(`WebSocket upgrade success host ${url.host} password ${password ? '[redacted]' : '(empty)'}`);
          if (req.socket.remoteAddress) this.authClients.add(req.socket.remoteAddress);
          this.backendWsServer?.webSocketServer?.handleUpgrade(req, socket, head, (ws) => {
            this.backendWsServer?.webSocketServer?.emit('connection', ws, req);
          });
        } catch (err) {
          {
            inspectError(this.log, 'WebSocket upgrade error:', err);
            socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
            socket.destroy();
          }
        }
      });

      this.httpsServer.on('error', (error: Error) => {
        this.log.error(`Frontend https server error listening on ${this.port}`);
        switch ((error as NodeJS.ErrnoException).code) {
          case 'EACCES':
            this.log.error(`Port ${this.port} requires elevated privileges`);
            break;
          case 'EADDRINUSE':
            this.log.error(`Port ${this.port} is already in use`);
            break;
          // no default
        }
        this.emit('server_error', error);
      });
    } else {
      // Create an HTTP server and attach the express app
      const http = await import('node:http');
      await this.backendExpress.start();
      try {
        this.log.debug(`Creating HTTP server...`);
        this.httpServer = http.createServer(this.backendExpress.expressApp);
      } catch (error) {
        logError(this.log, `Failed to create HTTP server`, error);
        this.emit('server_error', error);
        await this.backendExpress.stop();
        return;
      }
      await this.backendWsServer.start();

      // Listen on the specified port
      this.httpServer.listen(this.port, getParameter('bind'), () => {
        const addr = this.httpServer?.address();
        // v8 ignore else
        if (addr && typeof addr !== 'string') {
          this.log.info(`The frontend http server is bound to ${addr.family} ${addr.address}:${addr.port}`);
        }
        if (this.matterbridge.systemInformation.ipv4Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
        if (this.matterbridge.systemInformation.ipv6Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
        this.listening = true;
        this.emit('server_listening', 'http', this.port);
      });

      this.httpServer.on('upgrade', (req, socket, head): void => {
        try {
          // Only proceed for real WebSocket upgrades
          /* v8 ignore next - Node.js emits the upgrade event only when the Upgrade header is present, so the '' fallback is only a safety check */
          const upgrade = (req.headers.upgrade || '').toLowerCase();
          if (upgrade !== 'websocket') {
            this.log.error(`WebSocket upgrade error: Invalid upgrade header ${req.headers.upgrade}`);
            socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          // Build a URL so we can read ?password=...
          /* v8 ignore next - req.url is always set by Node.js on server requests, and the Host header is required by HTTP/1.1 (only an HTTP/1.0 request can omit it), so both fallbacks are only safety checks */
          const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);

          // Validate WebSocket password
          const password = url.searchParams.get('password') ?? '';
          if (password !== this.storedPassword) {
            this.log.error(`WebSocket upgrade error: Invalid password ${password ? '[redacted]' : '(empty)'}`);
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            socket.destroy();
            return;
          }

          // Complete the WebSocket handshake
          this.log.debug(`WebSocket upgrade success host ${url.host} password ${password ? '[redacted]' : '(empty)'}`);
          if (req.socket.remoteAddress) this.authClients.add(req.socket.remoteAddress);
          this.backendWsServer?.webSocketServer?.handleUpgrade(req, socket, head, (ws) => {
            this.backendWsServer?.webSocketServer?.emit('connection', ws, req);
          });
        } catch (err) {
          {
            inspectError(this.log, 'WebSocket upgrade error:', err);
            socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
            socket.destroy();
          }
        }
        return;
      });

      this.httpServer.on('error', (error: Error) => {
        this.log.error(`Frontend http server error listening on ${this.port}`);
        switch ((error as NodeJS.ErrnoException).code) {
          case 'EACCES':
            this.log.error(`Port ${this.port} requires elevated privileges`);
            break;
          case 'EADDRINUSE':
            this.log.error(`Port ${this.port} is already in use`);
            break;
          // no default
        }
        this.emit('server_error', error);
      });
    }

    this.log.debug('Backend started');
  }

  /**
   * Stop the backend.
   *
   * @returns {Promise<void>} A promise that resolves when the backend has stopped.
   */
  async stop(): Promise<void> {
    this.log.debug('Stopping backend...');

    await this.backendWsServer?.stop();

    // Close the http server
    if (this.httpServer) {
      this.log.debug('Closing http server...');

      this.httpServer.close();
      this.log.debug('Http server closed successfully');
      this.listening = false;
      this.emit('server_stopped');

      this.httpServer.removeAllListeners();
      this.httpServer = undefined;
      this.log.debug('Backend http server closed successfully');
    }

    // Close the https server
    if (this.httpsServer) {
      this.log.debug('Closing https server...');

      this.httpsServer.close();
      this.log.debug('Https server closed successfully');
      this.listening = false;
      this.emit('server_stopped');

      this.httpsServer.removeAllListeners();
      this.httpsServer = undefined;
      this.log.debug('Backend https server closed successfully');
    }

    await this.backendExpress?.stop();
    this.backendWsServer?.destroy();
    this.backendExpress?.destroy();
    this.backendWsServer = undefined;
    this.backendExpress = undefined;

    this.log.debug('Backend stopped');
  }

  /**
   * Retrieves the api settings data.
   *
   * @returns {ApiSettings} The api settings object.
   */
  async getApiSettings(): Promise<ApiSettings> {
    const start = performance.now();
    const response = await this.server.fetch({ type: 'matterbridge_apisettings', src: 'frontend', dst: 'matterbridge', params: undefined });
    if (this.diagnostic) writeDiagnostic('Backend', `getApiSettings() took ${(performance.now() - start).toFixed(2)} ms`);
    return response.result.data;
  }

  /**
   * Retrieves the registered plugins sanitized for res.json().
   *
   * @returns {ApiPlugin[]} An array of BaseRegisteredPlugin.
   */
  async getApiPlugins(): Promise<ApiPlugin[]> {
    const start = performance.now();
    const response = await this.server.fetch({ type: 'plugins_apipluginarray', src: 'frontend', dst: 'plugins', params: undefined });
    if (this.diagnostic) writeDiagnostic('Backend', `getApiPlugins() took ${(performance.now() - start).toFixed(2)} ms`);
    return response.result.plugins;
  }

  /**
   * Retrieves the devices from Matterbridge.
   *
   * @param {string} [pluginName] - The name of the plugin to filter devices by.
   * @returns {ApiDevice[]} An array of ApiDevices for the frontend.
   */
  async getApiDevices(pluginName?: string): Promise<ApiDevice[]> {
    const start = performance.now();
    const response = await this.server.fetch({ type: 'devices_apidevicearray', src: 'frontend', dst: 'devices', params: { pluginName } });
    if (this.diagnostic) writeDiagnostic('Backend', `getApiDevices() took ${(performance.now() - start).toFixed(2)} ms`);
    return response.result.devices;
  }

  /**
   * Retrieves the clusters from a given plugin and endpoint number.
   *
   * Response for /api/clusters
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {number} endpointNumber - The endpoint number.
   * @param {string} [serialNumber] - The device serial number to filter by (optional).
   * @param {string} [uniqueId] - The device unique ID to filter by (optional).
   * @returns {Promise<ApiClusters | undefined>} A promise that resolves to the clusters or undefined if not found.
   */
  // oxlint-disable-next-line typescript/require-await -- Preserve the async API until cluster retrieval is implemented.
  async getApiCluster(pluginName: string, endpointNumber: number, serialNumber?: string, uniqueId?: string): Promise<ApiClusters | undefined> {
    const start = performance.now();
    this.log.debug(`Retrieving API cluster for plugin: ${pluginName}, endpoint: ${endpointNumber}, serial: ${serialNumber}, uniqueId: ${uniqueId}`);
    // TODO: Implement the call to retrieve the API cluster.
    if (this.diagnostic) writeDiagnostic('Backend', `getApiCluster() took ${(performance.now() - start).toFixed(2)} ms`);
    return undefined;
  }

  /**
   * Generates a diagnostic file with the server nodes information.
   */
  // oxlint-disable-next-line typescript/require-await -- Preserve the async API until diagnostic generation is implemented.
  async generateDiagnostic(): Promise<void> {
    const start = performance.now();
    // TODO: Implement the generation of the diagnostic file with the server nodes information.
    if (this.diagnostic) writeDiagnostic('Backend', `generateDiagnostic() took ${(performance.now() - start).toFixed(2)} ms`);
  }

  /**
   * Retrieve Matter node data by ID.
   *
   * @param {string} id - The server node ID.
   * @returns {Promise<ApiMatter | undefined>} The node data, or undefined when the node is not found.
   */
  async getApiMatter(id: string): Promise<ApiMatter | undefined> {
    const start = performance.now();
    const response = await this.server.fetch({ type: 'matterbridge_apimatter', src: 'frontend', dst: 'matterbridge', params: { id } });
    if (this.diagnostic) writeDiagnostic('Backend', `getApiMatter() took ${(performance.now() - start).toFixed(2)} ms`);
    return response.result.matter;
  }
}
