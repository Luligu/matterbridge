/**
 * This file contains the class Backend.
 *
 * @file backend.ts
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

// Node.js built-in modules
import EventEmitter from 'node:events';
import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer, ServerOptions as HttpsServerOptions } from 'node:https';
import path from 'node:path';

// @matterbridge
import { BroadcastServer } from '@matterbridge/thread';
import type { ApiDevice, ApiPlugin, ApiSettings, SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { getParameter, hasParameter } from '@matterbridge/utils/cli';
import { getErrorMessage, inspectError, logError } from '@matterbridge/utils/error';
// AnsiLogger
import { AnsiLogger, LogLevel, rs, TimestampFormat, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';

// Local imports
import type { BackendExpress } from './backendExpress.js';
import type { BackendWsServer } from './backendWsServer.js';

// istanbul ignore next 2 lines --loader flag is only used for development and testing, not in production
// eslint-disable-next-line no-console
if (hasParameter('loader')) console.log('\u001B[32mBackend loaded.\u001B[40;0m');

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
  private log: AnsiLogger;
  private matterbridge: SharedMatterbridge;
  private readonly server: BroadcastServer;
  private port: number = 8283;
  private listening = false;
  private httpServer: HttpServer | undefined;
  private httpsServer: HttpsServer | undefined;

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
    // istanbul ignore next 2 lines - debug/verbose flags are only used for development and testing, not in production
    this.debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-frontend') || hasParameter('verbose-frontend');
    this.verbose = hasParameter('verbose') || hasParameter('verbose-frontend');
    this.matterbridge = matterbridge;
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    this.log = new AnsiLogger({
      logName: 'Backend',
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
  private async broadcastMsgHandler(msg: WorkerMessage) {
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
   *  Start the backend.
   *
   * @param {number} [port] - The port on which the backend should listen for frontend connections.
   * @returns {Promise<void>} A promise that resolves when the backend has started.
   */
  async start(port: number = 8283): Promise<void> {
    this.log.debug('Starting backend...');
    this.port = port;
    const { BackendExpress } = await import('./backendExpress.js');
    const { BackendWsServer } = await import('./backendWsServer.js');
    this.backendExpress = new BackendExpress(this.matterbridge, this);
    this.backendWsServer = new BackendWsServer(this.matterbridge, this);

    if (!hasParameter('ssl')) {
      // Create an HTTP server and attach the express app
      const http = await import('node:http');
      try {
        this.log.debug(`Creating HTTP server...`);
        this.httpServer = http.createServer(this.backendExpress.expressApp);
      } catch (error) {
        logError(this.log, `Failed to create HTTP server`, error);
        this.emit('server_error', error);
        return;
      }

      // Listen on the specified port
      this.httpServer.listen(this.port, getParameter('bind'), () => {
        const addr = this.httpServer?.address();
        // istanbul ignore else
        if (addr && typeof addr !== 'string') {
          this.log.info(`The frontend http server is bound to ${addr.family} ${addr.address}:${addr.port}`);
        }
        // istanbul ignore else
        if (this.matterbridge.systemInformation.ipv4Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
        // istanbul ignore else
        if (this.matterbridge.systemInformation.ipv6Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
        this.listening = true;
        this.emit('server_listening', 'http', this.port);
      });

      this.httpServer.on('upgrade', (req, socket, head) => {
        try {
          // Only proceed for real WebSocket upgrades
          // istanbul ignore next cause is only a safety check
          if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
            this.log.error(`WebSocket upgrade error: Invalid upgrade header ${req.headers.upgrade}`);
            socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
            return socket.destroy();
          }

          // Build a URL so we can read ?password=...
          const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);

          // Validate WebSocket password
          const password = url.searchParams.get('password') ?? '';
          if (password !== this.storedPassword) {
            this.log.error(`WebSocket upgrade error: Invalid password ${password ? '[redacted]' : '(empty)'}`);
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            return socket.destroy();
          }

          // Complete the WebSocket handshake
          this.log.debug(`WebSocket upgrade success host ${url.host} password ${password ? '[redacted]' : '(empty)'}`);
          // istanbul ignore else
          if (req.socket.remoteAddress) this.authClients.add(req.socket.remoteAddress);
          this.backendWsServer?.webSocketServer?.handleUpgrade(req, socket, head, (ws) => {
            this.backendWsServer?.webSocketServer?.emit('connection', ws, req);
          });
        } catch (err) {
          /* istanbul ignore next: only triggered on unexpected internal error */
          {
            inspectError(this.log, 'WebSocket upgrade error:', err);
            socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
            socket.destroy();
          }
        }
        return undefined;
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
        }
        this.emit('server_error', error);
        return;
      });
    } else {
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
      if (hasParameter('mtls')) {
        httpsServerOptions.requestCert = true; // Request client certificate
        httpsServerOptions.rejectUnauthorized = true; // Require client certificate validation
      }

      // Create an HTTPS server with the SSL certificate and private key (ca is optional) and attach the express app
      const https = await import('node:https');
      try {
        this.log.debug(`Creating HTTPS server...`);
        this.httpsServer = https.createServer(httpsServerOptions, this.backendExpress.expressApp);
      } catch (error) {
        logError(this.log, `Failed to create HTTPS server`, error);
        this.emit('server_error', error);
        return;
      }

      // Listen on the specified port
      this.httpsServer.listen(this.port, getParameter('bind'), () => {
        const addr = this.httpsServer?.address();
        // istanbul ignore else
        if (addr && typeof addr !== 'string') {
          this.log.info(`The frontend https server is bound to ${addr.family} ${addr.address}:${addr.port}`);
        }
        // istanbul ignore else
        if (this.matterbridge.systemInformation.ipv4Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
        // istanbul ignore else
        if (this.matterbridge.systemInformation.ipv6Address !== '' && !getParameter('bind'))
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
        this.listening = true;
        this.emit('server_listening', 'https', this.port);
      });

      this.httpsServer.on('upgrade', (req, socket, head) => {
        try {
          // Only proceed for real WebSocket upgrades
          // istanbul ignore next cause is only a safety check
          if ((req.headers.upgrade || '').toLowerCase() !== 'websocket') {
            socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
            return socket.destroy();
          }

          // Build a URL so we can read ?password=...
          const url = new URL(req.url ?? '/', `https://${req.headers.host || 'localhost'}`);

          // Validate WebSocket password
          const password = url.searchParams.get('password') ?? '';
          if (password !== this.storedPassword) {
            this.log.error(`WebSocket upgrade error: Invalid password ${password ? '[redacted]' : '(empty)'}`);
            socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
            return socket.destroy();
          }

          // Complete the WebSocket handshake
          this.log.debug(`WebSocket upgrade success host ${url.host} password ${password ? '[redacted]' : '(empty)'}`);
          // istanbul ignore else
          if (req.socket.remoteAddress) this.authClients.add(req.socket.remoteAddress);
          this.backendWsServer?.webSocketServer?.handleUpgrade(req, socket, head, (ws) => {
            this.backendWsServer?.webSocketServer?.emit('connection', ws, req);
          });
        } catch (err) {
          /* istanbul ignore next: only triggered on unexpected internal error */
          {
            inspectError(this.log, 'WebSocket upgrade error:', err);
            socket.write('HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n');
            socket.destroy();
          }
        }
        return undefined;
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
        }
        this.emit('server_error', error);
        return;
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

    this.log.debug('Backend stopped');
  }

  // TODO check

  /**
   * Retrieves the api settings data.
   *
   * @returns {ApiSettings} The api settings object.
   */
  getApiSettings(): ApiSettings {
    return {} as ApiSettings;
  }

  /**
   * Retrieves the registered plugins sanitized for res.json().
   *
   * @returns {ApiPlugin[]} An array of BaseRegisteredPlugin.
   */
  getApiPlugins(): ApiPlugin[] {
    return [];
  }

  /**
   * Retrieves the devices from Matterbridge.
   *
   * @param {string} [_pluginName] - The name of the plugin to filter devices by.
   * @returns {ApiDevice[]} An array of ApiDevices for the frontend.
   */
  getApiDevices(_pluginName?: string): ApiDevice[] {
    return [];
  }

  /**
   * Generates a diagnostic file with the server nodes information.
   */
  async generateDiagnostic(): Promise<void> {}
}
