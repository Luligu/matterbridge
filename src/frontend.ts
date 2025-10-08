/**
 * This file contains the class Frontend.
 *
 * @file frontend.ts
 * @author Luca Liguori
 * @created 2025-01-13
 * @version 1.3.0
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

// eslint-disable-next-line no-console
if (process.argv.includes('--loader') || process.argv.includes('-loader')) console.log('\u001B[32mFrontend loaded.\u001B[40;0m');

// Node modules
import type { Server as HttpServer, IncomingMessage as HttpIncomingMessage } from 'node:http';
import type { Server as HttpsServer, ServerOptions as HttpsServerOptions } from 'node:https';
import os from 'node:os';
import path from 'node:path';
import EventEmitter from 'node:events';

// Third-party modules
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import multer from 'multer';
// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat, stringify, debugStringify, CYAN, db, er, nf, rs, UNDERLINE, UNDERLINEOFF, YELLOW, nt, wr } from 'node-ansi-logger';
// @matter
import { Logger, LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, Lifecycle, ServerNode, LogDestination, Diagnostic, Time, FabricIndex, EndpointNumber } from '@matter/main';
import { BridgedDeviceBasicInformation } from '@matter/main/clusters/bridged-device-basic-information';
import { PowerSource } from '@matter/main/clusters/power-source';
import { DeviceAdvertiser, DeviceCommissioner, FabricManager } from '@matter/main/protocol';
import { CommissioningOptions } from '@matter/main/types';

// Matterbridge
import type { Cluster, ApiClusters, ApiDevice, ApiMatter, ApiPlugin, MatterbridgeInformation, Plugin } from './matterbridgeTypes.js';
import type { Matterbridge } from './matterbridge.js';
import type { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import type { PlatformConfig } from './matterbridgePlatform.js';
import type { ApiSettings, RefreshRequiredChanged, WsMessageApiRequest, WsMessageApiResponse, WsMessageBroadcast, WsMessageErrorApiResponse } from './frontendTypes.js';
import { MATTER_LOGGER_FILE, MATTER_STORAGE_NAME, MATTERBRIDGE_LOGGER_FILE, NODE_STORAGE_DIR, plg } from './matterbridgeTypes.js';
import { createZip, isValidArray, isValidNumber, isValidObject, isValidString, isValidBoolean, withTimeout, hasParameter, wait, inspectError } from './utils/export.js';
import { formatMemoryUsage, formatOsUpTime } from './utils/network.js';
import { capitalizeFirstLetter, getAttribute } from './matterbridgeEndpointHelpers.js';
import { cliEmitter, lastCpuUsage } from './cliEmitter.js';
import { BroadcastServer } from './broadcastServer.js';
import { WorkerMessage } from './broadcastServerTypes.js';

/**
 * Represents the Frontend events.
 */
interface FrontendEvents {
  server_listening: [protocol: string, port: number, address?: string];
  server_error: [error: Error];
  server_stopped: [];
  websocket_server_listening: [protocol: string];
  websocket_server_stopped: [];
}

export class Frontend extends EventEmitter<FrontendEvents> {
  private matterbridge: Matterbridge;
  private log: AnsiLogger;
  private port = 8283;
  private listening = false;

  private expressApp: express.Express | undefined;
  private httpServer: HttpServer | undefined;
  private httpsServer: HttpsServer | undefined;
  private webSocketServer: WebSocketServer | undefined;
  private server: BroadcastServer;

  constructor(matterbridge: Matterbridge) {
    super();
    this.matterbridge = matterbridge;
    this.log = new AnsiLogger({ logName: 'Frontend', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });
    this.log.logNameColor = '\x1b[38;5;97m';
    this.server = new BroadcastServer('plugins', this.log);
    this.server.on('broadcast_message', this.msgHandler.bind(this));
  }

  destroy(): void {
    this.server.close();
  }

  private async msgHandler(msg: WorkerMessage) {
    if (this.server.isWorkerRequest(msg, msg.type)) {
      if (!msg.id || (msg.dst !== 'all' && msg.dst !== 'frontend')) return;
      this.log.debug(`**Received broadcast request ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'frontend_start':
          await this.start(msg.params.port);
          this.server.respond({ ...msg, id: msg.id, response: { success: true } });
          break;
        case 'frontend_stop':
          await this.stop();
          this.server.respond({ ...msg, id: msg.id, response: { success: true } });
          break;
        default:
          this.log.warn(`Unknown broadcast request ${CYAN}${msg.type}${wr} from ${CYAN}${msg.src}${wr}`);
      }
    }
    if (this.server.isWorkerResponse(msg, msg.type)) {
      this.log.debug(`**Received broadcast response ${CYAN}${msg.type}${db} from ${CYAN}${msg.src}${db}: ${debugStringify(msg)}${db}`);
      switch (msg.type) {
        case 'plugins_install':
          this.wssSendCloseSnackbarMessage(`Installing package ${msg.response.packageName}...`);
          if (msg.response.success) {
            this.wssSendRestartRequired(true, true);
            this.wssSendRefreshRequired('plugins');
            this.wssSendSnackbarMessage(`Installed package ${msg.response.packageName}`, 5, 'success');
          } else {
            this.wssSendSnackbarMessage(`Package ${msg.response.packageName} not installed`, 10, 'error');
          }
          break;
        case 'plugins_uninstall':
          this.wssSendCloseSnackbarMessage(`Uninstalling package ${msg.response.packageName}...`);
          if (msg.response.success) {
            this.wssSendRestartRequired(true, true);
            this.wssSendRefreshRequired('plugins');
            this.wssSendSnackbarMessage(`Uninstalled package ${msg.response.packageName}`, 5, 'success');
          } else {
            this.wssSendSnackbarMessage(`Package ${msg.response.packageName} not uninstalled`, 10, 'error');
          }
          break;
        default:
          this.log.warn(`Unknown broadcast response ${CYAN}${msg.type}${wr} from ${CYAN}${msg.src}${wr}`);
      }
    }
  }

  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  async start(port = 8283) {
    this.port = port;
    this.log.debug(`Initializing the frontend ${hasParameter('ssl') ? 'https' : 'http'} server on port ${YELLOW}${this.port}${db}`);

    // Initialize multer with the upload directory
    const uploadDir = path.join(this.matterbridge.matterbridgeDirectory, 'uploads'); // Is created by matterbridge initialize
    const upload = multer({ dest: uploadDir });

    // Create the express app that serves the frontend
    this.expressApp = express();

    // Inject logging/debug wrapper for route/middleware registration
    /*
    const methods = ['get', 'post', 'put', 'delete', 'use'];
    for (const method of methods) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = (this.expressApp as any)[method].bind(this.expressApp);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.expressApp as any)[method] = (path: any, ...rest: any) => {
        try {
          console.log(`[DEBUG] Registering ${method.toUpperCase()} route:`, path);
          return original(path, ...rest);
        } catch (err) {
          console.error(`[ERROR] Failed to register route: ${path}`);
          throw err;
        }
      };
    }
    */

    // Log all requests to the server for debugging
    /*
    this.expressApp.use((req, res, next) => {
      this.log.debug(`***Received request on expressApp: ${req.method} ${req.url}`);
      next();
    });
    */

    // Serve static files from 'frontend/build' directory
    this.expressApp.use(express.static(path.join(this.matterbridge.rootDirectory, 'frontend/build')));

    if (!hasParameter('ssl')) {
      // Create an HTTP server and attach the express app
      const http = await import('node:http');
      try {
        this.log.debug(`Creating HTTP server...`);
        this.httpServer = http.createServer(this.expressApp);
      } catch (error) {
        this.log.error(`Failed to create HTTP server: ${error}`);
        this.emit('server_error', error as Error);
        return;
      }

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpServer.listen(this.port, '0.0.0.0', () => {
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://0.0.0.0:${this.port}${UNDERLINEOFF}${rs}`);
          this.listening = true;
          this.emit('server_listening', 'http', this.port, '0.0.0.0');
        });
      } else {
        this.httpServer.listen(this.port, () => {
          if (this.matterbridge.systemInformation.ipv4Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
          if (this.matterbridge.systemInformation.ipv6Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
          this.listening = true;
          this.emit('server_listening', 'http', this.port);
        });
      }

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

      let httpsServerOptions: HttpsServerOptions = {};

      const fs = await import('node:fs');
      if (fs.existsSync(path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.p12'))) {
        // Load the p12 certificate and the passphrase
        try {
          pfx = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.p12'));
          this.log.info(`Loaded p12 certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.p12')}`);
        } catch (error) {
          this.log.error(`Error reading p12 certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.p12')}: ${error}`);
          this.emit('server_error', error as Error);
          return;
        }
        try {
          passphrase = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pass'), 'utf8');
          passphrase = passphrase.trim(); // Ensure no extra characters
          this.log.info(`Loaded p12 passphrase file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pass')}`);
        } catch (error) {
          this.log.error(`Error reading p12 passphrase file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pass')}: ${error}`);
          this.emit('server_error', error as Error);
          return;
        }
        httpsServerOptions = { pfx, passphrase };
      } else {
        // Load the SSL certificate, the private key and optionally the CA certificate. If the CA certificate is present, it will be used to create a full chain certificate.
        try {
          cert = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pem'), 'utf8');
          this.log.info(`Loaded certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pem')}`);
        } catch (error) {
          this.log.error(`Error reading certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pem')}: ${error}`);
          this.emit('server_error', error as Error);
          return;
        }
        try {
          key = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem'), 'utf8');
          this.log.info(`Loaded key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem')}`);
        } catch (error) {
          this.log.error(`Error reading key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem')}: ${error}`);
          this.emit('server_error', error as Error);
          return;
        }
        try {
          ca = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/ca.pem'), 'utf8');
          fullChain = `${cert}\n${ca}`;
          this.log.info(`Loaded CA certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/ca.pem')}`);
        } catch (error) {
          this.log.info(`CA certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/ca.pem')} not loaded: ${error}`);
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
        this.httpsServer = https.createServer(httpsServerOptions, this.expressApp);
      } catch (error) {
        this.log.error(`Failed to create HTTPS server: ${error}`);
        this.emit('server_error', error as Error);
        return;
      }

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpsServer.listen(this.port, '0.0.0.0', () => {
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://0.0.0.0:${this.port}${UNDERLINEOFF}${rs}`);
          this.listening = true;
          this.emit('server_listening', 'https', this.port, '0.0.0.0');
        });
      } else {
        this.httpsServer.listen(this.port, () => {
          if (this.matterbridge.systemInformation.ipv4Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
          if (this.matterbridge.systemInformation.ipv6Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
          this.listening = true;
          this.emit('server_listening', 'https', this.port);
        });
      }

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

    // Create a WebSocket server and attach it to the http or https server
    this.log.debug(`Creating WebSocketServer...`);
    this.webSocketServer = new WebSocketServer(hasParameter('ssl') ? { server: this.httpsServer } : { server: this.httpServer });

    this.webSocketServer.on('connection', (ws: WebSocket, request: HttpIncomingMessage) => {
      const clientIp = request.socket.remoteAddress;

      // Set the global logger callback for the WebSocketServer
      let callbackLogLevel = LogLevel.NOTICE;
      if (this.matterbridge.getLogLevel() === LogLevel.INFO || Logger.level === MatterLogLevel.INFO) callbackLogLevel = LogLevel.INFO;
      if (this.matterbridge.getLogLevel() === LogLevel.DEBUG || Logger.level === MatterLogLevel.DEBUG) callbackLogLevel = LogLevel.DEBUG;
      AnsiLogger.setGlobalCallback(this.wssSendLogMessage.bind(this), callbackLogLevel);
      this.log.debug(`WebSocketServer logger global callback set to ${callbackLogLevel}`);
      this.log.info(`WebSocketServer client "${clientIp}" connected to Matterbridge`);

      ws.on('message', (message) => {
        this.wsMessageHandler(ws, message);
      });

      ws.on('ping', () => {
        this.log.debug('WebSocket client ping');
        ws.pong();
      });

      ws.on('pong', () => {
        this.log.debug('WebSocket client pong');
      });

      ws.on('close', () => {
        this.log.info('WebSocket client disconnected');
        if (this.webSocketServer?.clients.size === 0) {
          AnsiLogger.setGlobalCallback(undefined);
          this.log.debug('All WebSocket clients disconnected. WebSocketServer logger global callback removed');
        }
      });

      ws.on('error', (error: Error) => {
        // istanbul ignore next
        this.log.error(`WebSocket client error: ${error}`);
      });
    });

    this.webSocketServer.on('close', () => {
      this.log.debug(`WebSocketServer closed`);
    });

    this.webSocketServer.on('listening', () => {
      this.log.info(`The WebSocketServer is listening`);
      this.emit('websocket_server_listening', hasParameter('ssl') ? 'wss' : 'ws');
    });

    this.webSocketServer.on('error', (ws: WebSocket, error: Error) => {
      this.log.error(`WebSocketServer error: ${error}`);
    });

    // Subscribe to cli events
    cliEmitter.removeAllListeners();
    cliEmitter.on('uptime', (systemUptime: string, processUptime: string) => {
      this.wssSendUptimeUpdate(systemUptime, processUptime);
    });
    cliEmitter.on('memory', (totalMememory: string, freeMemory: string, rss: string, heapTotal: string, heapUsed: string, external: string, arrayBuffers: string) => {
      this.wssSendMemoryUpdate(totalMememory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers);
    });
    cliEmitter.on('cpu', (cpuUsage: number) => {
      this.wssSendCpuUpdate(cpuUsage);
    });

    // Endpoint to validate login code
    // curl -X POST "http://localhost:8283/api/login" -H "Content-Type: application/json" -d "{\"password\":\"Here\"}"
    this.expressApp.post('/api/login', express.json(), async (req, res) => {
      const { password } = req.body;
      this.log.debug('The frontend sent /api/login', password);
      if (!this.matterbridge.nodeContext) {
        this.log.error('/api/login nodeContext not found');
        res.json({ valid: false });
        return;
      }
      try {
        const storedPassword = await this.matterbridge.nodeContext.get('password', '');
        if (storedPassword === '' || password === storedPassword) {
          this.log.debug('/api/login password valid');
          res.json({ valid: true });
        } else {
          this.log.warn('/api/login error wrong password');
          res.json({ valid: false });
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        this.log.error('/api/login error getting password');
        res.json({ valid: false });
      }
    });

    // Endpoint to provide health check for docker
    this.expressApp.get('/health', (req, res) => {
      this.log.debug('Express received /health');

      const healthStatus = {
        status: 'ok', // Indicate service is healthy
        uptime: process.uptime(), // Server uptime in seconds
        timestamp: new Date().toISOString(), // Current timestamp
      };

      res.status(200).json(healthStatus);
    });

    // Endpoint to provide memory usage details
    this.expressApp.get('/memory', async (req, res) => {
      this.log.debug('Express received /memory');

      // Memory usage from process
      const memoryUsageRaw = process.memoryUsage();
      const memoryUsage = {
        rss: formatMemoryUsage(memoryUsageRaw.rss),
        heapTotal: formatMemoryUsage(memoryUsageRaw.heapTotal),
        heapUsed: formatMemoryUsage(memoryUsageRaw.heapUsed),
        external: formatMemoryUsage(memoryUsageRaw.external),
        arrayBuffers: formatMemoryUsage(memoryUsageRaw.arrayBuffers),
      };

      // V8 heap statistics
      const { default: v8 } = await import('node:v8');
      const heapStatsRaw = v8.getHeapStatistics();
      const heapSpacesRaw = v8.getHeapSpaceStatistics();

      // Format heapStats
      const heapStats = Object.fromEntries(Object.entries(heapStatsRaw).map(([key, value]) => [key, formatMemoryUsage(value as number)]));

      // Format heapSpaces
      const heapSpaces = heapSpacesRaw.map((space) => ({
        ...space,
        space_size: formatMemoryUsage(space.space_size),
        space_used_size: formatMemoryUsage(space.space_used_size),
        space_available_size: formatMemoryUsage(space.space_available_size),
        physical_space_size: formatMemoryUsage(space.physical_space_size),
      }));

      const { createRequire } = await import('node:module');
      const require = createRequire(import.meta.url);
      const cjsModules = Object.keys(require.cache).sort();

      const memoryReport = {
        memoryUsage,
        heapStats,
        heapSpaces,
        cjsModules,
      };

      res.status(200).json(memoryReport);
    });

    // Endpoint to provide settings
    this.expressApp.get('/api/settings', express.json(), async (req, res) => {
      this.log.debug('The frontend sent /api/settings');
      res.json(await this.getApiSettings());
    });

    // Endpoint to provide plugins
    this.expressApp.get('/api/plugins', async (req, res) => {
      this.log.debug('The frontend sent /api/plugins');
      res.json(this.matterbridge.hasCleanupStarted ? [] : this.getPlugins());
    });

    // Endpoint to provide devices
    this.expressApp.get('/api/devices', async (req, res) => {
      this.log.debug('The frontend sent /api/devices');
      res.json(this.matterbridge.hasCleanupStarted ? [] : this.getDevices());
    });

    // Endpoint to view the matterbridge log
    this.expressApp.get('/api/view-mblog', async (req, res) => {
      this.log.debug('The frontend sent /api/view-mblog');
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading matterbridge log file ${MATTERBRIDGE_LOGGER_FILE}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading matterbridge log file. Please enable the matterbridge log on file in the settings.');
      }
    });

    // Endpoint to view the matter.js log
    this.expressApp.get('/api/view-mjlog', async (req, res) => {
      this.log.debug('The frontend sent /api/view-mjlog');
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading matter log file ${MATTER_LOGGER_FILE}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading matter log file. Please enable the matter log on file in the settings.');
      }
    });

    // Endpoint to view the diagnostic.log
    this.expressApp.get('/api/view-diagnostic', async (req, res) => {
      this.log.debug('The frontend sent /api/view-diagnostic');

      const serverNodes: ServerNode<ServerNode.RootEndpoint>[] = [];
      // istanbul ignore else
      if (this.matterbridge.bridgeMode === 'bridge') {
        if (this.matterbridge.serverNode) serverNodes.push(this.matterbridge.serverNode);
      } else if (this.matterbridge.bridgeMode === 'childbridge') {
        for (const plugin of this.matterbridge.plugins.array()) {
          if (plugin.serverNode) serverNodes.push(plugin.serverNode);
        }
      }
      // istanbul ignore next
      for (const device of this.matterbridge.devices.array()) {
        if (device.serverNode) serverNodes.push(device.serverNode);
      }
      const fs = await import('node:fs');
      if (fs.existsSync(path.join(this.matterbridge.matterbridgeDirectory, 'diagnostic.log'))) fs.unlinkSync(path.join(this.matterbridge.matterbridgeDirectory, 'diagnostic.log'));
      const diagnosticDestination = LogDestination({ name: 'diagnostic', level: MatterLogLevel.INFO, format: MatterLogFormat.formats.plain });
      diagnosticDestination.write = async (text: string, _message: Diagnostic.Message) => {
        await fs.promises.appendFile(path.join(this.matterbridge.matterbridgeDirectory, 'diagnostic.log'), text + '\n', { encoding: 'utf8' });
      };
      Logger.destinations.diagnostic = diagnosticDestination;
      if (!diagnosticDestination.context) {
        diagnosticDestination.context = Diagnostic.Context();
      }
      diagnosticDestination.context.run(() =>
        diagnosticDestination.add(
          Diagnostic.message({
            now: Time.now(),
            facility: 'Server nodes:',
            level: MatterLogLevel.INFO,
            prefix: Logger.nestingLevel ? '⎸'.padEnd(Logger.nestingLevel * 2) : '',
            values: [...serverNodes],
          }),
        ),
      );
      delete Logger.destinations.diagnostic;
      await wait(500); // Wait for the log to be written

      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'diagnostic.log'), 'utf8');
        res.type('text/plain');
        res.send(data.slice(29));
      } catch (error) {
        // istanbul ignore next
        this.log.error(`Error reading diagnostic log file ${MATTER_LOGGER_FILE}: ${error instanceof Error ? error.message : error}`);
        // istanbul ignore next
        res.status(500).send('Error reading diagnostic log file.');
      }
    });

    // Endpoint to view the shelly log
    this.expressApp.get('/api/shellyviewsystemlog', async (req, res) => {
      this.log.debug('The frontend sent /api/shellyviewsystemlog');
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading shelly log file ${MATTERBRIDGE_LOGGER_FILE}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading shelly log file. Please create the shelly system log before loading it.');
      }
    });

    // Endpoint to download the matterbridge log
    this.expressApp.get('/api/download-mblog', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-mblog ${path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE)}`);
      const fs = await import('node:fs');
      try {
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTERBRIDGE_LOGGER_FILE), data, 'utf-8');
      } catch (error) {
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTERBRIDGE_LOGGER_FILE), 'Enable the matterbridge log on file in the settings to download the matterbridge log.', 'utf-8');
        this.log.debug(`Error in /api/download-mblog: ${error instanceof Error ? error.message : error}`);
      }
      res.type('text/plain');
      res.download(path.join(os.tmpdir(), MATTERBRIDGE_LOGGER_FILE), 'matterbridge.log', (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading log file ${MATTERBRIDGE_LOGGER_FILE}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge log file');
        }
      });
    });

    // Endpoint to download the matter log
    this.expressApp.get('/api/download-mjlog', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-mjlog ${path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE)}`);
      const fs = await import('node:fs');
      try {
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTER_LOGGER_FILE), data, 'utf-8');
      } catch (error) {
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTER_LOGGER_FILE), 'Enable the matter log on file in the settings to download the matter log.', 'utf-8');
        this.log.debug(`Error in /api/download-mblog: ${error instanceof Error ? error.message : error}`);
      }
      res.type('text/plain');
      res.download(path.join(os.tmpdir(), MATTER_LOGGER_FILE), 'matter.log', (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading log file ${MATTER_LOGGER_FILE}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter log file');
        }
      });
    });

    // Endpoint to download the shelly log
    this.expressApp.get('/api/shellydownloadsystemlog', async (req, res) => {
      this.log.debug('The frontend sent /api/shellydownloadsystemlog');
      const fs = await import('node:fs');
      try {
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), 'shelly.log'), data, 'utf-8');
      } catch (error) {
        await fs.promises.writeFile(path.join(os.tmpdir(), 'shelly.log'), 'Create the Shelly system log before downloading it.', 'utf-8');
        this.log.debug(`Error in /api/shellydownloadsystemlog: ${error instanceof Error ? error.message : error}`);
      }
      res.type('text/plain');
      res.download(path.join(os.tmpdir(), 'shelly.log'), 'shelly.log', (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading Shelly system log file: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading Shelly system log file');
        }
      });
    });

    // Endpoint to download the matterbridge storage directory
    this.expressApp.get('/api/download-mbstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mbstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.${NODE_STORAGE_DIR}.zip`), path.join(this.matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR));
      res.download(path.join(os.tmpdir(), `matterbridge.${NODE_STORAGE_DIR}.zip`), `matterbridge.${NODE_STORAGE_DIR}.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading file ${`matterbridge.${NODE_STORAGE_DIR}.zip`}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge storage file');
        }
      });
    });

    // Endpoint to download the matter storage file
    this.expressApp.get('/api/download-mjstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mjstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.${MATTER_STORAGE_NAME}.zip`), path.join(this.matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME));
      res.download(path.join(os.tmpdir(), `matterbridge.${MATTER_STORAGE_NAME}.zip`), `matterbridge.${MATTER_STORAGE_NAME}.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading the matter storage matterbridge.${MATTER_STORAGE_NAME}.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter storage zip file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin directory
    this.expressApp.get('/api/download-pluginstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.pluginstorage.zip`), this.matterbridge.matterbridgePluginDirectory);
      res.download(path.join(os.tmpdir(), `matterbridge.pluginstorage.zip`), `matterbridge.pluginstorage.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading file matterbridge.pluginstorage.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge plugin storage file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin config files
    this.expressApp.get('/api/download-pluginconfig', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginconfig');
      await createZip(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), path.relative(process.cwd(), path.join(this.matterbridge.matterbridgeDirectory, '*.config.json')));
      res.download(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), `matterbridge.pluginconfig.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading file matterbridge.pluginconfig.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge plugin config file');
        }
      });
    });

    // Endpoint to download the matterbridge backup (created with the backup command)
    this.expressApp.get('/api/download-backup', async (req, res) => {
      this.log.debug('The frontend sent /api/download-backup');
      res.download(path.join(os.tmpdir(), `matterbridge.backup.zip`), `matterbridge.backup.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading file matterbridge.backup.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send(`Error downloading file matterbridge.backup.zip: ${error instanceof Error ? error.message : error}`);
        }
      });
    });

    // Endpoint to upload a package
    this.expressApp.post('/api/uploadpackage', upload.single('file'), async (req, res) => {
      const { filename } = req.body;
      const file = req.file;

      /* istanbul ignore if */
      if (!file || !filename) {
        this.log.error(`uploadpackage: invalid request: file and filename are required`);
        res.status(400).send('Invalid request: file and filename are required');
        return;
      }
      this.wssSendSnackbarMessage(`Installing package ${filename}. Please wait...`, 0);

      // Define the path where the plugin file will be saved
      const filePath = path.join(this.matterbridge.matterbridgeDirectory, 'uploads', filename);

      try {
        // Move the uploaded file to the specified path
        const fs = await import('node:fs');
        await fs.promises.rename(file.path, filePath);
        this.log.info(`File ${plg}${filename}${nf} uploaded successfully`);

        // Install the plugin package
        if (filename.endsWith('.tgz')) {
          const { spawnCommand } = await import('./utils/spawn.js');
          await spawnCommand(this.matterbridge, 'npm', ['install', '-g', filePath, '--omit=dev', '--verbose'], 'install', filename);
          this.log.info(`Plugin package ${plg}${filename}${nf} installed successfully. Full restart required.`);
          this.wssSendCloseSnackbarMessage(`Installing package ${filename}. Please wait...`);
          this.wssSendSnackbarMessage(`Installed package ${filename}`, 10, 'success');
          this.wssSendRestartRequired();
          res.send(`Plugin package ${filename} uploaded and installed successfully`);
        } else res.send(`File ${filename} uploaded successfully`);
      } catch (err) {
        this.log.error(`Error uploading or installing plugin package file ${plg}${filename}${er}:`, err);
        this.wssSendCloseSnackbarMessage(`Installing package ${filename}. Please wait...`);
        this.wssSendSnackbarMessage(`Error uploading or installing plugin package ${filename}`, 10, 'error');
        res.status(500).send(`Error uploading or installing plugin package ${filename}`);
      }
    });

    // Fallback for routing (must be the last route)
    this.expressApp.use((req, res) => {
      this.log.debug(`The frontend sent ${req.url} method ${req.method}: sending index.html as fallback`);
      res.sendFile(path.join(this.matterbridge.rootDirectory, 'frontend/build/index.html'));
    });

    this.log.debug(`Frontend initialized on port ${YELLOW}${this.port}${db} static ${UNDERLINE}${path.join(this.matterbridge.rootDirectory, 'frontend/build')}${UNDERLINEOFF}${rs}`);
  }

  async stop() {
    this.log.debug('Stopping the frontend...');

    // Remove listeners from the express app
    if (this.expressApp) {
      this.expressApp.removeAllListeners();
      this.expressApp = undefined;
      this.log.debug('Frontend app closed successfully');
    }

    // Close the WebSocket server
    if (this.webSocketServer) {
      this.log.debug('Closing WebSocket server...');
      // Close all active connections
      this.webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      await withTimeout(
        new Promise<void>((resolve) => {
          this.webSocketServer?.close((error) => {
            if (error) {
              // istanbul ignore next
              this.log.error(`Error closing WebSocket server: ${error}`);
            } else {
              this.log.debug('WebSocket server closed successfully');
              this.emit('websocket_server_stopped');
            }
            resolve();
          });
        }),
        10000,
        false,
      );
      this.webSocketServer.removeAllListeners();
      this.webSocketServer = undefined;
    }

    // Close the http server
    if (this.httpServer) {
      this.log.debug('Closing http server...');
      /*
      await withTimeout(
        new Promise<void>((resolve) => {
          this.httpServer?.close((error) => {
            if (error) {
              // istanbul ignore next
              this.log.error(`Error closing http server: ${error}`);
            } else {
              this.log.debug('Http server closed successfully');
              this.emit('server_stopped');
            }
            resolve();
          });
        }),
        5000,
        false,
      );
      */
      this.httpServer.close();
      this.log.debug('Http server closed successfully');
      this.listening = false;
      this.emit('server_stopped');

      this.httpServer.removeAllListeners();
      this.httpServer = undefined;
      this.log.debug('Frontend http server closed successfully');
    }

    // Close the https server
    if (this.httpsServer) {
      this.log.debug('Closing https server...');
      /*
      await withTimeout(
        new Promise<void>((resolve) => {
          this.httpsServer?.close((error) => {
            if (error) {
              // istanbul ignore next
              this.log.error(`Error closing https server: ${error}`);
            } else {
              this.log.debug('Https server closed successfully');
              this.emit('server_stopped');
            }
            resolve();
          });
        }),
        5000,
        false,
      );
      */
      this.httpsServer.close();
      this.log.debug('Https server closed successfully');
      this.listening = false;
      this.emit('server_stopped');
      this.httpsServer.removeAllListeners();
      this.httpsServer = undefined;
      this.log.debug('Frontend https server closed successfully');
    }
    this.log.debug('Frontend stopped successfully');
  }

  /**
   * Retrieves the api settings data.
   *
   * @returns {Promise<{ matterbridgeInformation: MatterbridgeInformation, systemInformation: SystemInformation }>} A promise that resolve in the api settings object.
   */
  private async getApiSettings(): Promise<ApiSettings> {
    // Update the variable system information properties
    this.matterbridge.systemInformation.totalMemory = formatMemoryUsage(os.totalmem());
    this.matterbridge.systemInformation.freeMemory = formatMemoryUsage(os.freemem());
    this.matterbridge.systemInformation.systemUptime = formatOsUpTime(os.uptime());
    this.matterbridge.systemInformation.processUptime = formatOsUpTime(Math.floor(process.uptime()));
    this.matterbridge.systemInformation.cpuUsage = lastCpuUsage.toFixed(2) + ' %';
    this.matterbridge.systemInformation.rss = formatMemoryUsage(process.memoryUsage().rss);
    this.matterbridge.systemInformation.heapTotal = formatMemoryUsage(process.memoryUsage().heapTotal);
    this.matterbridge.systemInformation.heapUsed = formatMemoryUsage(process.memoryUsage().heapUsed);

    // Create the matterbridge information
    const info: MatterbridgeInformation = {
      homeDirectory: this.matterbridge.homeDirectory,
      rootDirectory: this.matterbridge.rootDirectory,
      matterbridgeDirectory: this.matterbridge.matterbridgeDirectory,
      matterbridgePluginDirectory: this.matterbridge.matterbridgePluginDirectory,
      matterbridgeCertDirectory: this.matterbridge.matterbridgeCertDirectory,
      globalModulesDirectory: this.matterbridge.globalModulesDirectory,
      matterbridgeVersion: this.matterbridge.matterbridgeVersion,
      matterbridgeLatestVersion: this.matterbridge.matterbridgeLatestVersion,
      matterbridgeDevVersion: this.matterbridge.matterbridgeDevVersion,
      frontendVersion: this.matterbridge.frontendVersion,
      bridgeMode: this.matterbridge.bridgeMode,
      restartMode: this.matterbridge.restartMode,
      virtualMode: this.matterbridge.virtualMode,
      profile: this.matterbridge.profile,
      readOnly: this.matterbridge.readOnly,
      shellyBoard: this.matterbridge.shellyBoard,
      shellySysUpdate: this.matterbridge.shellySysUpdate,
      shellyMainUpdate: this.matterbridge.shellyMainUpdate,
      loggerLevel: await this.matterbridge.getLogLevel(),
      fileLogger: this.matterbridge.fileLogger,
      matterLoggerLevel: Logger.level as MatterLogLevel,
      matterFileLogger: this.matterbridge.matterFileLogger,
      matterMdnsInterface: this.matterbridge.mdnsInterface,
      matterIpv4Address: this.matterbridge.ipv4Address,
      matterIpv6Address: this.matterbridge.ipv6Address,
      matterPort: (await this.matterbridge.nodeContext?.get<number>('matterport', 5540)) ?? 5540,
      matterDiscriminator: await this.matterbridge.nodeContext?.get<number>('matterdiscriminator'),
      matterPasscode: await this.matterbridge.nodeContext?.get<number>('matterpasscode'),
      restartRequired: this.matterbridge.restartRequired,
      fixedRestartRequired: this.matterbridge.fixedRestartRequired,
      updateRequired: this.matterbridge.updateRequired,
    };

    return { systemInformation: this.matterbridge.systemInformation, matterbridgeInformation: info };
  }

  /**
   * Retrieves the reachable attribute.
   *
   * @param {MatterbridgeEndpoint} device - The MatterbridgeEndpoint object.
   * @returns {boolean} The reachable attribute.
   */
  private getReachability(device: MatterbridgeEndpoint): boolean {
    if (this.matterbridge.hasCleanupStarted) return false; // Skip if cleanup has started
    if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return false;
    if (device.hasClusterServer(BridgedDeviceBasicInformation.Cluster.id)) return device.getAttribute(BridgedDeviceBasicInformation.Cluster.id, 'reachable') as boolean;
    if (device.mode === 'server' && device.serverNode && device.serverNode.state.basicInformation.reachable !== undefined) return device.serverNode.state.basicInformation.reachable;
    if (this.matterbridge.bridgeMode === 'childbridge') return true;
    return false;
  }

  /**
   * Retrieves the power source attribute.
   *
   * @param {MatterbridgeEndpoint} endpoint - The MatterbridgeDevice to retrieve the power source from.
   * @returns {'ac' | 'dc' | 'ok' | 'warning' | 'critical' | undefined} The power source attribute.
   */
  private getPowerSource(endpoint: MatterbridgeEndpoint): 'ac' | 'dc' | 'ok' | 'warning' | 'critical' | undefined {
    if (this.matterbridge.hasCleanupStarted) return; // Skip if cleanup has started
    if (!endpoint.lifecycle.isReady || endpoint.construction.status !== Lifecycle.Status.Active) return undefined;

    const powerSource = (device: MatterbridgeEndpoint) => {
      const featureMap = device.getAttribute(PowerSource.Cluster.id, 'featureMap') as Record<string, boolean>;
      if (featureMap.wired) {
        const wiredCurrentType = device.getAttribute(PowerSource.Cluster.id, 'wiredCurrentType') as PowerSource.WiredCurrentType;
        return ['ac', 'dc'][wiredCurrentType] as 'ac' | 'dc' | undefined;
      }
      if (featureMap.battery) {
        const batChargeLevel = device.getAttribute(PowerSource.Cluster.id, 'batChargeLevel') as PowerSource.BatChargeLevel;
        return ['ok', 'warning', 'critical'][batChargeLevel] as 'ok' | 'warning' | 'critical' | undefined;
      }
      return;
    };

    // Root endpoint
    if (endpoint.hasClusterServer(PowerSource.Cluster.id)) return powerSource(endpoint);
    // Child endpoints
    for (const child of endpoint.getChildEndpoints()) {
      if (child.hasClusterServer(PowerSource.Cluster.id)) return powerSource(child);
    }
  }

  /**
   * Retrieves the cluster text description from a given device.
   * The output is a string with the attributes description of the cluster servers in the device to show in the frontend.
   *
   * @param {MatterbridgeEndpoint} device - The MatterbridgeEndpoint to retrieve the cluster text from.
   * @returns {string} The attributes description of the cluster servers in the device.
   */
  private getClusterTextFromDevice(device: MatterbridgeEndpoint): string {
    if (this.matterbridge.hasCleanupStarted) return ''; // Skip if cleanup has started
    if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return '';

    const getUserLabel = (device: MatterbridgeEndpoint) => {
      const labelList = getAttribute(device, 'userLabel', 'labelList') as { label: string; value: string }[];
      if (labelList) {
        const composed = labelList.find((entry) => entry.label === 'composed');
        if (composed) return 'Composed: ' + composed.value;
      }
      // istanbul ignore next cause is not reachable
      return '';
    };

    const getFixedLabel = (device: MatterbridgeEndpoint) => {
      const labelList = getAttribute(device, 'fixedLabel', 'labelList') as { label: string; value: string }[];
      if (labelList) {
        const composed = labelList.find((entry) => entry.label === 'composed');
        if (composed) return 'Composed: ' + composed.value;
      }
      // istanbul ignore next cause is not reacheable
      return '';
    };

    let attributes = '';
    let supportedModes: { label: string; mode: number }[] = [];

    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.log(`${device.deviceName} => Cluster: ${clusterName}-${clusterId} Attribute: ${attributeName}-${attributeId} Value(${typeof attributeValue}): ${attributeValue}`);
      if (typeof attributeValue === 'undefined' || attributeValue === undefined) return;
      if (clusterName === 'onOff' && attributeName === 'onOff') attributes += `OnOff: ${attributeValue} `;
      if (clusterName === 'switch' && attributeName === 'currentPosition') attributes += `Position: ${attributeValue} `;
      if (clusterName === 'windowCovering' && attributeName === 'currentPositionLiftPercent100ths' && isValidNumber(attributeValue, 0, 10000)) attributes += `Cover position: ${attributeValue / 100}% `;
      if (clusterName === 'doorLock' && attributeName === 'lockState') attributes += `State: ${attributeValue === 1 ? 'Locked' : 'Not locked'} `;
      if (clusterName === 'thermostat' && attributeName === 'localTemperature' && isValidNumber(attributeValue)) attributes += `Temperature: ${attributeValue / 100}°C `;
      if (clusterName === 'thermostat' && attributeName === 'occupiedHeatingSetpoint' && isValidNumber(attributeValue)) attributes += `Heat to: ${attributeValue / 100}°C `;
      if (clusterName === 'thermostat' && attributeName === 'occupiedCoolingSetpoint' && isValidNumber(attributeValue)) attributes += `Cool to: ${attributeValue / 100}°C `;

      const modeClusters = ['modeSelect', 'rvcRunMode', 'rvcCleanMode', 'laundryWasherMode', 'ovenMode', 'microwaveOvenMode'];
      if (modeClusters.includes(clusterName) && attributeName === 'supportedModes') {
        supportedModes = attributeValue as { label: string; mode: number }[];
      }
      if (modeClusters.includes(clusterName) && attributeName === 'currentMode') {
        const supportedMode = supportedModes.find((mode) => mode.mode === attributeValue);
        if (supportedMode) attributes += `Mode: ${supportedMode.label} `;
      }
      const operationalStateClusters = ['operationalState', 'rvcOperationalState'];
      if (operationalStateClusters.includes(clusterName) && attributeName === 'operationalState') attributes += `OpState: ${attributeValue} `;

      if (clusterName === 'pumpConfigurationAndControl' && attributeName === 'operationMode') attributes += `Mode: ${attributeValue} `;

      if (clusterName === 'valveConfigurationAndControl' && attributeName === 'currentState') attributes += `State: ${attributeValue} `;

      if (clusterName === 'levelControl' && attributeName === 'currentLevel') attributes += `Level: ${attributeValue} `;

      if (clusterName === 'colorControl' && attributeName === 'colorMode' && isValidNumber(attributeValue, 0, 2)) attributes += `Mode: ${['HS', 'XY', 'CT'][attributeValue]} `;
      if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 0 && attributeName === 'currentHue' && isValidNumber(attributeValue)) attributes += `Hue: ${Math.round(attributeValue)} `;
      if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 0 && attributeName === 'currentSaturation' && isValidNumber(attributeValue)) attributes += `Saturation: ${Math.round(attributeValue)} `;
      if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 1 && attributeName === 'currentX' && isValidNumber(attributeValue)) attributes += `X: ${Math.round(attributeValue / 655.36) / 100} `;
      if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 1 && attributeName === 'currentY' && isValidNumber(attributeValue)) attributes += `Y: ${Math.round(attributeValue / 655.36) / 100} `;
      if (clusterName === 'colorControl' && getAttribute(device, 'colorControl', 'colorMode') === 2 && attributeName === 'colorTemperatureMireds' && isValidNumber(attributeValue)) attributes += `ColorTemp: ${Math.round(attributeValue)} `;

      if (clusterName === 'booleanState' && attributeName === 'stateValue') attributes += `Contact: ${attributeValue} `;
      if (clusterName === 'booleanStateConfiguration' && attributeName === 'alarmsActive' && isValidObject(attributeValue)) attributes += `Active alarms: ${stringify(attributeValue)} `;

      if (clusterName === 'smokeCoAlarm' && attributeName === 'smokeState') attributes += `Smoke: ${attributeValue} `;
      if (clusterName === 'smokeCoAlarm' && attributeName === 'coState') attributes += `Co: ${attributeValue} `;

      if (clusterName === 'fanControl' && attributeName === 'fanMode') attributes += `Mode: ${attributeValue} `;
      if (clusterName === 'fanControl' && attributeName === 'percentCurrent') attributes += `Percent: ${attributeValue} `;
      if (clusterName === 'fanControl' && attributeName === 'speedCurrent') attributes += `Speed: ${attributeValue} `;

      if (clusterName === 'occupancySensing' && attributeName === 'occupancy' && isValidObject(attributeValue, 1)) attributes += `Occupancy: ${(attributeValue as { occupied: boolean }).occupied} `;
      if (clusterName === 'illuminanceMeasurement' && attributeName === 'measuredValue' && isValidNumber(attributeValue)) attributes += `Illuminance: ${Math.round(Math.max(Math.pow(10, attributeValue / 10000), 0))} `;
      if (clusterName === 'airQuality' && attributeName === 'airQuality') attributes += `Air quality: ${attributeValue} `;
      if (clusterName === 'totalVolatileOrganicCompoundsConcentrationMeasurement' && attributeName === 'measuredValue') attributes += `Voc: ${attributeValue} `;
      if (clusterName === 'pm1ConcentrationMeasurement' && attributeName === 'measuredValue') attributes += `Pm1: ${attributeValue} `;
      if (clusterName === 'pm25ConcentrationMeasurement' && attributeName === 'measuredValue') attributes += `Pm2.5: ${attributeValue} `;
      if (clusterName === 'pm10ConcentrationMeasurement' && attributeName === 'measuredValue') attributes += `Pm10: ${attributeValue} `;
      if (clusterName === 'formaldehydeConcentrationMeasurement' && attributeName === 'measuredValue') attributes += `CH₂O: ${attributeValue} `;
      if (clusterName === 'temperatureMeasurement' && attributeName === 'measuredValue' && isValidNumber(attributeValue)) attributes += `Temperature: ${attributeValue / 100}°C `;
      if (clusterName === 'relativeHumidityMeasurement' && attributeName === 'measuredValue' && isValidNumber(attributeValue)) attributes += `Humidity: ${attributeValue / 100}% `;
      if (clusterName === 'pressureMeasurement' && attributeName === 'measuredValue') attributes += `Pressure: ${attributeValue} `;
      if (clusterName === 'flowMeasurement' && attributeName === 'measuredValue') attributes += `Flow: ${attributeValue} `;
      if (clusterName === 'fixedLabel' && attributeName === 'labelList') attributes += `${getFixedLabel(device)} `;
      if (clusterName === 'userLabel' && attributeName === 'labelList') attributes += `${getUserLabel(device)} `;
    });
    // console.log(`${device.deviceName}.forEachAttribute: ${attributes}`);
    return attributes.trimStart().trimEnd();
  }

  /**
   * Retrieves the registered plugins sanitized for res.json().
   *
   * @returns {ApiPlugin[]} An array of BaseRegisteredPlugin.
   */
  private getPlugins(): ApiPlugin[] {
    if (this.matterbridge.hasCleanupStarted) return []; // Skip if cleanup has started
    const plugins: ApiPlugin[] = [];
    for (const plugin of this.matterbridge.plugins.array()) {
      plugins.push({
        path: plugin.path,
        type: plugin.type,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        homepage: plugin.homepage,
        help: plugin.help,
        changelog: plugin.changelog,
        funding: plugin.funding,
        latestVersion: plugin.latestVersion,
        devVersion: plugin.devVersion,
        locked: plugin.locked,
        error: plugin.error,
        enabled: plugin.enabled,
        loaded: plugin.loaded,
        started: plugin.started,
        configured: plugin.configured,
        restartRequired: plugin.restartRequired,
        registeredDevices: plugin.registeredDevices,
        configJson: plugin.configJson,
        schemaJson: plugin.schemaJson,
        hasWhiteList: plugin.configJson?.whiteList !== undefined,
        hasBlackList: plugin.configJson?.blackList !== undefined,
        // Childbridge mode specific data
        matter: plugin.serverNode ? this.matterbridge.getServerNodeData(plugin.serverNode) : undefined,
      });
    }
    return plugins;
  }

  /**
   * Retrieves the devices from Matterbridge.
   *
   * @param {string} [pluginName] - The name of the plugin to filter devices by.
   * @returns {ApiDevice[]} An array of ApiDevices for the frontend.
   */
  private getDevices(pluginName?: string): ApiDevice[] {
    if (this.matterbridge.hasCleanupStarted) return []; // Skip if cleanup has started
    const devices: ApiDevice[] = [];
    for (const device of this.matterbridge.devices.array()) {
      // Filter by pluginName if provided
      if (pluginName && pluginName !== device.plugin) continue;
      // Check if the device has the required properties
      if (!device.plugin || !device.deviceType || !device.name || !device.deviceName || !device.serialNumber || !device.uniqueId || !device.lifecycle.isReady) continue;
      devices.push({
        pluginName: device.plugin,
        type: device.name + ' (0x' + device.deviceType.toString(16).padStart(4, '0') + ')',
        endpoint: device.number,
        name: device.deviceName,
        serial: device.serialNumber,
        productUrl: device.productUrl,
        configUrl: device.configUrl,
        uniqueId: device.uniqueId,
        reachable: this.getReachability(device),
        powerSource: this.getPowerSource(device),
        matter: device.mode === 'server' && device.serverNode ? this.matterbridge.getServerNodeData(device.serverNode) : undefined,
        cluster: this.getClusterTextFromDevice(device),
      });
    }
    return devices;
  }

  /**
   * Retrieves the clusters from a given plugin and endpoint number.
   *
   * Response for /api/clusters
   *
   * @param {string} pluginName - The name of the plugin.
   * @param {number} endpointNumber - The endpoint number.
   * @returns {ApiClusters | undefined} A promise that resolves to the clusters or undefined if not found.
   */
  private getClusters(pluginName: string, endpointNumber: number): ApiClusters | undefined {
    if (this.matterbridge.hasCleanupStarted) return; // Skip if cleanup has started
    const endpoint = this.matterbridge.devices.array().find((d) => d.plugin === pluginName && d.maybeNumber === endpointNumber);
    if (!endpoint || !endpoint.plugin || !endpoint.maybeNumber || !endpoint.maybeId || !endpoint.deviceName || !endpoint.serialNumber) {
      this.log.error(`getClusters: no device found for plugin ${pluginName} and endpoint number ${endpointNumber}`);
      return;
    }
    // this.log.debug(`***getClusters: getting clusters for device ${endpoint.deviceName} plugin ${pluginName} endpoint number ${endpointNumber}`);

    // Get the device types from the main endpoint
    const deviceTypes: number[] = [];
    const clusters: Cluster[] = [];
    endpoint.state.descriptor.deviceTypeList.forEach((d) => {
      deviceTypes.push(d.deviceType);
    });

    // Get the clusters from the main endpoint
    endpoint.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (typeof attributeValue === 'undefined' || attributeValue === undefined) return;
      if (clusterName === 'EveHistory' && ['configDataGet', 'configDataSet', 'historyStatus', 'historyEntries', 'historyRequest', 'historySetTime', 'rLoc'].includes(attributeName)) return;
      // console.log(
      //   `${idn}${endpoint.deviceName}${rs}${nf} => Cluster: ${CYAN}${clusterName} (0x${clusterId.toString(16).padStart(2, '0')})${nf} Attribute: ${CYAN}${attributeName} (0x${attributeId.toString(16).padStart(2, '0')})${nf} Value: ${YELLOW}${typeof attributeValue === 'object' ? stringify(attributeValue as object) : attributeValue}${nf}`,
      // );
      clusters.push({
        endpoint: endpoint.number.toString(),
        number: endpoint.number,
        id: 'main',
        deviceTypes,
        clusterName: capitalizeFirstLetter(clusterName),
        clusterId: '0x' + clusterId.toString(16).padStart(2, '0'),
        attributeName,
        attributeId: '0x' + attributeId.toString(16).padStart(2, '0'),
        attributeValue: typeof attributeValue === 'object' ? stringify(attributeValue as object) : attributeValue.toString(),
        attributeLocalValue: attributeValue,
      });
    });

    // Get the child endpoints
    const childEndpoints = endpoint.getChildEndpoints();
    // if (childEndpoints.length === 0) {
    // this.log.debug(`***getClusters: found ${childEndpoints.length} child endpoints for device ${endpoint.deviceName} plugin ${pluginName} and endpoint number ${endpointNumber}`);
    // }
    childEndpoints.forEach((childEndpoint) => {
      // istanbul ignore if cause is not reachable: should never happen but ...
      if (!childEndpoint.maybeId || !childEndpoint.maybeNumber) {
        this.log.error(`getClusters: no child endpoint found for plugin ${pluginName} and endpoint number ${endpointNumber}`);
        return;
      }
      // this.log.debug(`***getClusters: getting clusters for child endpoint ${childEndpoint.id} of device ${endpoint.deviceName} plugin ${pluginName} endpoint number ${childEndpoint.number}`);

      // Get the device types of the child endpoint
      const deviceTypes: number[] = [];
      childEndpoint.state.descriptor.deviceTypeList.forEach((d) => {
        deviceTypes.push(d.deviceType);
      });

      childEndpoint.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
        if (typeof attributeValue === 'undefined' || attributeValue === undefined) return;
        if (clusterName === 'EveHistory' && ['configDataGet', 'configDataSet', 'historyStatus', 'historyEntries', 'historyRequest', 'historySetTime', 'rLoc'].includes(attributeName)) return;
        // console.log(
        //   `${idn}${childEndpoint.deviceName}${rs}${nf} => Cluster: ${CYAN}${clusterName} (0x${clusterId.toString(16).padStart(2, '0')})${nf} Attribute: ${CYAN}${attributeName} (0x${attributeId.toString(16).padStart(2, '0')})${nf} Value: ${YELLOW}${typeof attributeValue === 'object' ? stringify(attributeValue as object) : attributeValue}${nf}`,
        // );
        clusters.push({
          endpoint: childEndpoint.number.toString(),
          number: childEndpoint.number,
          id: childEndpoint.id,
          deviceTypes,
          clusterName: capitalizeFirstLetter(clusterName),
          clusterId: '0x' + clusterId.toString(16).padStart(2, '0'),
          attributeName,
          attributeId: '0x' + attributeId.toString(16).padStart(2, '0'),
          attributeValue: typeof attributeValue === 'object' ? stringify(attributeValue as object) : attributeValue.toString(),
          attributeLocalValue: attributeValue,
        });
      });
    });
    return { plugin: endpoint.plugin, deviceName: endpoint.deviceName, serialNumber: endpoint.serialNumber, number: endpoint.number, id: endpoint.id, deviceTypes, clusters };
  }

  /**
   * Handles incoming websocket api request messages from the Matterbridge frontend.
   *
   * @param {WebSocket} client - The websocket client that sent the message.
   * @param {WebSocket.RawData} message - The raw data of the message received from the client.
   * @returns {Promise<void>} A promise that resolves when the message has been handled.
   */
  private async wsMessageHandler(client: WebSocket, message: WebSocket.RawData): Promise<void> {
    let data: WsMessageApiRequest;

    const sendResponse = (data: WsMessageApiResponse | WsMessageErrorApiResponse) => {
      if (client.readyState === WebSocket.OPEN) {
        if ('response' in data) {
          const { response, ...rest } = data;
          this.log.debug(`Sending api response message: ${debugStringify(rest)}`);
        } else if ('error' in data) {
          this.log.debug(`Sending api error message: ${debugStringify(data)}`);
        } else {
          this.log.debug(`Sending api response message: ${debugStringify(data)}`);
        }
        client.send(JSON.stringify(data));
      }
    };

    try {
      data = JSON.parse(message.toString());
      if (!isValidNumber(data.id) || !isValidString(data.dst) || !isValidString(data.src) || !isValidString(data.method) /* || !isValidObject(data.params)*/ || data.dst !== 'Matterbridge') {
        this.log.error(`Invalid message from websocket client: ${debugStringify(data)}`);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid message' });
        return;
      }
      this.log.debug(`Received message from websocket client: ${debugStringify(data)}`);

      if (data.method === 'ping') {
        sendResponse({ id: data.id, method: 'pong', src: 'Matterbridge', dst: data.src, success: true, response: 'pong' });
        return;
      } else if (data.method === '/api/login') {
        if (!this.matterbridge.nodeContext) {
          this.log.error('Login nodeContext not found');
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Internal error: nodeContext not found' });
          return;
        }
        const storedPassword = await this.matterbridge.nodeContext.get('password', '');
        if (storedPassword === '' || storedPassword === data.params.password) {
          this.log.debug('Login password valid');
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
          return;
        } else {
          this.log.debug('Error wrong password');
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong password' });
          return;
        }
      } else if (data.method === '/api/install') {
        if (isValidString(data.params.packageName, 14) && isValidBoolean(data.params.restart)) {
          this.wssSendSnackbarMessage(`Installing package ${data.params.packageName}...`, 0);
          this.server.request({ type: 'plugins_install', src: this.server.name, dst: 'plugins', params: { packageName: data.params.packageName } });
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
        } else {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter in /api/install' });
        }
      } else if (data.method === '/api/uninstall') {
        if (isValidString(data.params.packageName, 14)) {
          this.wssSendSnackbarMessage(`Uninstalling package ${data.params.packageName}...`, 0);
          this.server.request({ type: 'plugins_uninstall', src: this.server.name, dst: 'plugins', params: { packageName: data.params.packageName } });
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
        } else {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter packageName in /api/uninstall' });
        }
      } else if (data.method === '/api/addplugin') {
        const localData = data;
        if (!isValidString(data.params.pluginNameOrPath, 10)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginNameOrPath in /api/addplugin' });
          this.wssSendSnackbarMessage(`Plugin ${data.params.pluginNameOrPath} not added`, 10, 'error');
          return;
        }
        data.params.pluginNameOrPath = (data.params.pluginNameOrPath as string).replace(/@.*$/, '');
        if (this.matterbridge.plugins.has(data.params.pluginNameOrPath)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Plugin ${data.params.pluginNameOrPath} already added` });
          this.wssSendSnackbarMessage(`Plugin ${data.params.pluginNameOrPath} already added`, 10, 'warning');
          return;
        }
        const plugin = await this.matterbridge.plugins.add(data.params.pluginNameOrPath);
        if (plugin) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
          this.wssSendSnackbarMessage(`Added plugin ${data.params.pluginNameOrPath}`, 5, 'success');
          this.matterbridge.plugins
            .load(plugin, true, 'The plugin has been added', true)
            .then(() => {
              this.wssSendRefreshRequired('plugins');
              this.wssSendRefreshRequired('devices');
              this.wssSendSnackbarMessage(`Started plugin ${localData.params.pluginNameOrPath}`, 5, 'success');
              return;
            })
            .catch((_error) => {
              //
            });
        } else {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Plugin ${data.params.pluginNameOrPath} not added` });
          this.wssSendSnackbarMessage(`Plugin ${data.params.pluginNameOrPath} not added`, 10, 'error');
        }
      } else if (data.method === '/api/removeplugin') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/removeplugin' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as Plugin;
        await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been removed.', true);
        await this.matterbridge.plugins.remove(data.params.pluginName);
        this.wssSendSnackbarMessage(`Removed plugin ${data.params.pluginName}`, 5, 'success');
        this.wssSendRefreshRequired('plugins');
        this.wssSendRefreshRequired('devices');
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/enableplugin') {
        const localData = data;
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/enableplugin' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as Plugin;
        if (plugin && !plugin.enabled) {
          plugin.locked = undefined;
          plugin.error = undefined;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.platform = undefined;
          plugin.registeredDevices = undefined;
          plugin.matter = undefined;
          await this.matterbridge.plugins.enable(data.params.pluginName);
          this.wssSendSnackbarMessage(`Enabled plugin ${data.params.pluginName}`, 5, 'success');
          this.matterbridge.plugins
            .load(plugin, true, 'The plugin has been enabled', true)
            .then(() => {
              this.wssSendRefreshRequired('plugins');
              this.wssSendRefreshRequired('devices');
              this.wssSendSnackbarMessage(`Started plugin ${localData.params.pluginName}`, 5, 'success');
              return;
            })
            .catch((_error) => {
              //
            });
        }
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/disableplugin') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/disableplugin' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as Plugin;
        await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been disabled.', true);
        await this.matterbridge.plugins.disable(data.params.pluginName);
        this.wssSendSnackbarMessage(`Disabled plugin ${data.params.pluginName}`, 5, 'success');
        this.wssSendRefreshRequired('plugins');
        this.wssSendRefreshRequired('devices');
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/restartplugin') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/restartplugin' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as Plugin;
        await this.matterbridge.plugins.shutdown(plugin, 'The plugin is restarting.', false, true);
        if (plugin.serverNode) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.matterbridge as any).stopServerNode(plugin.serverNode);
          plugin.serverNode = undefined;
        }
        for (const device of this.matterbridge.devices) {
          if (device.plugin === plugin.name) {
            this.log.debug(`Removing device ${device.deviceName} from plugin ${plugin.name}`);
            this.matterbridge.devices.remove(device);
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (plugin.type === 'DynamicPlatform' && !plugin.locked) await (this.matterbridge as any).createDynamicPlugin(plugin);
        await this.matterbridge.plugins.load(plugin, true, 'The plugin has been restarted', true);
        plugin.restartRequired = false; // Reset plugin restartRequired
        let needRestart = 0;
        for (const plugin of this.matterbridge.plugins) {
          if (plugin.restartRequired) needRestart++;
        }
        if (needRestart === 0) {
          this.wssSendRestartNotRequired(true); // Reset global restart required message
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (plugin.serverNode) await (this.matterbridge as any).startServerNode(plugin.serverNode);
        this.wssSendSnackbarMessage(`Restarted plugin ${data.params.pluginName}`, 5, 'success');
        this.wssSendRefreshRequired('plugins');
        this.wssSendRefreshRequired('devices');
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/savepluginconfig') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/savepluginconfig' });
          return;
        }
        if (!isValidObject(data.params.formData, 5)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter formData in /api/savepluginconfig' });
          return;
        }
        this.log.info(`Saving config for plugin ${plg}${data.params.pluginName}${nf}...`);
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as Plugin;
        if (plugin) {
          this.matterbridge.plugins.saveConfigFromJson(plugin, data.params.formData, true);
          this.wssSendSnackbarMessage(`Saved config for plugin ${data.params.pluginName}`);
          this.wssSendRestartRequired();
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
        }
      } else if (data.method === '/api/checkupdates') {
        const { checkUpdates } = await import('./update.js');
        checkUpdates(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/shellysysupdate') {
        const { triggerShellySysUpdate } = await import('./shelly.js');
        triggerShellySysUpdate(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/shellymainupdate') {
        const { triggerShellyMainUpdate } = await import('./shelly.js');
        triggerShellyMainUpdate(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/shellycreatesystemlog') {
        const { createShellySystemLog } = await import('./shelly.js');
        createShellySystemLog(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/shellynetconfig') {
        this.log.debug('/api/shellynetconfig:', data.params);
        const { triggerShellyChangeIp } = await import('./shelly.js');
        triggerShellyChangeIp(this.matterbridge, data.params as { type: 'static' | 'dhcp'; ip: string; subnet: string; gateway: string; dns: string });
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/softreset') {
        const { triggerShellySoftReset } = await import('./shelly.js');
        triggerShellySoftReset(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/hardreset') {
        const { triggerShellyHardReset } = await import('./shelly.js');
        triggerShellyHardReset(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/reboot') {
        const { triggerShellyReboot } = await import('./shelly.js');
        triggerShellyReboot(this.matterbridge);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/restart') {
        this.wssSendSnackbarMessage(`Restarting matterbridge...`, 0);
        await this.matterbridge.restartProcess();
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/shutdown') {
        this.wssSendSnackbarMessage(`Shutting down matterbridge...`, 0);
        await this.matterbridge.shutdownProcess();
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/create-backup') {
        this.wssSendSnackbarMessage('Creating backup...', 0);
        this.log.notice(`Creating the backup...`);
        await createZip(path.join(os.tmpdir(), `matterbridge.backup.zip`), path.join(this.matterbridge.matterbridgeDirectory), path.join(this.matterbridge.matterbridgePluginDirectory));
        this.log.notice(`Backup ready to be downloaded.`);
        this.wssSendCloseSnackbarMessage('Creating backup...');
        this.wssSendSnackbarMessage('Backup ready to be downloaded', 10);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/unregister') {
        this.wssSendSnackbarMessage('Unregistering all bridged devices...', 0);
        await this.matterbridge.unregisterAndShutdownProcess();
        this.wssSendCloseSnackbarMessage('Unregistering all bridged devices...');
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/reset') {
        this.wssSendSnackbarMessage('Resetting matterbridge commissioning...', 10);
        await this.matterbridge.shutdownProcessAndReset();
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/factoryreset') {
        this.wssSendSnackbarMessage('Factory reset of matterbridge...', 10);
        await this.matterbridge.shutdownProcessAndFactoryReset();
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
      } else if (data.method === '/api/matter') {
        const localData = data;
        if (!isValidString(data.params.id)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter id in /api/matter' });
          return;
        }
        let serverNode: ServerNode<ServerNode.RootEndpoint> | undefined;
        if (data.params.id === 'Matterbridge') serverNode = this.matterbridge.serverNode;
        else
          serverNode =
            this.matterbridge.plugins.array().find((p) => p.serverNode && p.serverNode.id === localData.params.id)?.serverNode || this.matterbridge.devices.array().find((d) => d.serverNode && d.serverNode.id === localData.params.id)?.serverNode;
        if (!serverNode) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Unknown server node id ${localData.params.id} in /api/matter` });
          return;
        }
        const matter = this.matterbridge.getServerNodeData(serverNode);
        this.log.debug(`*Server node ${serverNode.id}: commissioned ${serverNode.state.commissioning.commissioned} upTime ${serverNode.state.generalDiagnostics.upTime}.`);
        if (data.params.server) {
          this.log.debug(`*Sending data for node ${data.params.id}`);
          this.wssSendRefreshRequired('matter', { matter: { ...matter } });
        }
        if (data.params.startCommission) {
          await serverNode.env.get(DeviceCommissioner)?.allowBasicCommissioning();
          this.matterbridge.advertisingNodes.set(serverNode.id, Date.now());
          this.log.debug(`*Allow commissioning has been sent for node ${data.params.id}`);
          this.wssSendRefreshRequired('matter', { matter: { ...matter, advertiseTime: Date.now(), advertising: true } });
        }
        if (data.params.stopCommission) {
          await serverNode.env.get(DeviceCommissioner)?.endCommissioning();
          this.matterbridge.advertisingNodes.delete(serverNode.id);
          this.log.debug(`*End commissioning has been sent for node ${data.params.id}`);
          this.wssSendRefreshRequired('matter', { matter: { ...matter, advertiseTime: 0, advertising: false } });
        }
        if (data.params.advertise) {
          await serverNode.env.get(DeviceAdvertiser)?.advertise(true);
          this.log.debug(`*Advertising has been sent for node ${data.params.id}`);
          this.wssSendRefreshRequired('matter', { matter: { ...matter, advertising: true } });
        }
        if (data.params.removeFabric) {
          if (serverNode.env.get(FabricManager).has(FabricIndex(data.params.removeFabric as number))) await serverNode.env.get(FabricManager).removeFabric(FabricIndex(data.params.removeFabric as number));
          this.log.debug(`*Removed fabric index ${data.params.removeFabric} for node ${data.params.id}`);
          this.wssSendRefreshRequired('matter', { matter: { ...matter } });
        }
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true, response: matter });
      } else if (data.method === '/api/settings') {
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true, response: await this.getApiSettings() });
      } else if (data.method === '/api/plugins') {
        const plugins = this.matterbridge.hasCleanupStarted ? [] : this.getPlugins();
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true, response: plugins });
      } else if (data.method === '/api/devices') {
        const devices = this.matterbridge.hasCleanupStarted ? [] : this.getDevices(isValidString(data.params.pluginName) ? data.params.pluginName : undefined);
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true, response: devices });
      } else if (data.method === '/api/clusters') {
        if (!isValidString(data.params.plugin, 10)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/clusters' });
          return;
        }
        if (!isValidNumber(data.params.endpoint, 1)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter endpoint in /api/clusters' });
          return;
        }
        const response = this.getClusters(data.params.plugin, data.params.endpoint);
        if (response) {
          sendResponse({
            id: data.id,
            method: data.method,
            src: 'Matterbridge',
            dst: data.src,
            success: true,
            response,
          });
        } else {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Endpoint not found in /api/clusters' });
        }
      } else if (data.method === '/api/select/devices') {
        if (!isValidString(data.params.plugin, 10)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/select/devices' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.plugin);
        if (!plugin) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/select/devices' });
          return;
        }
        const selectDeviceValues = !plugin.platform ? [] : plugin.platform.getSelectDevices().sort((keyA, keyB) => keyA.name.localeCompare(keyB.name));
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true, response: selectDeviceValues });
      } else if (data.method === '/api/select/entities') {
        if (!isValidString(data.params.plugin, 10)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/select/entities' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.plugin);
        if (!plugin) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/select/entities' });
          return;
        }
        const selectEntityValues = !plugin.platform ? [] : plugin.platform.getSelectEntities().sort((keyA, keyB) => keyA.name.localeCompare(keyB.name));
        sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true, response: selectEntityValues });
      } else if (data.method === '/api/action') {
        const localData = data;
        if (!isValidString(data.params.plugin, 5) || !isValidString(data.params.action, 1)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter in /api/action' });
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.plugin);
        if (!plugin) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/action' });
          return;
        }
        this.log.notice(`Action ${CYAN}${data.params.action}${nt}${data.params.value ? ' with ' + CYAN + data.params.value + nt : ''} for plugin ${CYAN}${plugin.name}${nt}`);
        plugin.platform
          ?.onAction(data.params.action, data.params.value as string | undefined, data.params.id as string | undefined, data.params.formData as unknown as PlatformConfig)
          .then(() => {
            sendResponse({ id: localData.id, method: localData.method, src: 'Matterbridge', dst: localData.src, success: true });
            return;
          })
          .catch((error) => {
            this.log.error(`Error in plugin ${plugin.name} action ${localData.params.action}: ${error}`);
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Error in plugin ${plugin.name} action ${localData.params.action}: ${error}` });
          });
      } else if (data.method === '/api/config') {
        if (!isValidString(data.params.name, 5) || data.params.value === undefined) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter in /api/config' });
          return;
        }
        this.log.debug(`Received /api/config name ${CYAN}${data.params.name}${db} value ${CYAN}${data.params.value}${db}`);
        switch (data.params.name) {
          case 'setpassword':
            if (isValidString(data.params.value)) {
              await this.matterbridge.nodeContext?.set('password', data.params.value);
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            }
            break;
          case 'setbridgemode':
            if (isValidString(data.params.value) && ['bridge', 'childbridge'].includes(data.params.value)) {
              await this.matterbridge.nodeContext?.set('bridgeMode', data.params.value);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            }
            break;
          case 'setmbloglevel':
            if (isValidString(data.params.value, 4)) {
              this.log.debug('Matterbridge logger level:', data.params.value);
              if (data.params.value === 'Debug') {
                await this.matterbridge.setLogLevel(LogLevel.DEBUG);
              } else if (data.params.value === 'Info') {
                await this.matterbridge.setLogLevel(LogLevel.INFO);
              } else if (data.params.value === 'Notice') {
                await this.matterbridge.setLogLevel(LogLevel.NOTICE);
              } else if (data.params.value === 'Warn') {
                await this.matterbridge.setLogLevel(LogLevel.WARN);
              } else if (data.params.value === 'Error') {
                await this.matterbridge.setLogLevel(LogLevel.ERROR);
              } else if (data.params.value === 'Fatal') {
                await this.matterbridge.setLogLevel(LogLevel.FATAL);
              }
              await this.matterbridge.nodeContext?.set('matterbridgeLogLevel', this.log.logLevel);
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            }
            break;
          case 'setmblogfile':
            if (isValidBoolean(data.params.value)) {
              this.log.debug('Matterbridge file log:', data.params.value);
              this.matterbridge.fileLogger = data.params.value;
              await this.matterbridge.nodeContext?.set('matterbridgeFileLog', data.params.value);
              // Create the file logger for matterbridge
              if (data.params.value) AnsiLogger.setGlobalLogfile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), await this.matterbridge.getLogLevel(), true);
              else AnsiLogger.setGlobalLogfile(undefined);
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            }
            break;
          case 'setmjloglevel':
            if (isValidString(data.params.value, 4)) {
              this.log.debug('Matter logger level:', data.params.value);
              if (data.params.value === 'Debug') {
                Logger.level = MatterLogLevel.DEBUG;
              } else if (data.params.value === 'Info') {
                Logger.level = MatterLogLevel.INFO;
              } else if (data.params.value === 'Notice') {
                Logger.level = MatterLogLevel.NOTICE;
              } else if (data.params.value === 'Warn') {
                Logger.level = MatterLogLevel.WARN;
              } else if (data.params.value === 'Error') {
                Logger.level = MatterLogLevel.ERROR;
              } else if (data.params.value === 'Fatal') {
                Logger.level = MatterLogLevel.FATAL;
              }
              await this.matterbridge.nodeContext?.set('matterLogLevel', Logger.level);
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            }
            break;
          case 'setmjlogfile':
            if (isValidBoolean(data.params.value)) {
              this.log.debug('Matter file log:', data.params.value);
              this.matterbridge.matterFileLogger = data.params.value;
              await this.matterbridge.nodeContext?.set('matterFileLog', data.params.value);
              if (data.params.value) {
                this.matterbridge.matterLog.logFilePath = path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE);
              } else {
                this.matterbridge.matterLog.logFilePath = undefined;
              }
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            }
            break;
          case 'setmdnsinterface':
            if (isValidString(data.params.value)) {
              this.log.debug(`Matter.js mdns interface: ${data.params.value === '' ? 'all interfaces' : data.params.value}`);
              this.matterbridge.mdnsInterface = data.params.value === '' ? undefined : data.params.value;
              await this.matterbridge.nodeContext?.set('mattermdnsinterface', data.params.value);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
              this.wssSendSnackbarMessage(`Mdns interface changed to ${data.params.value === '' ? 'all interfaces' : data.params.value}`);
            }
            break;
          case 'setipv4address':
            if (isValidString(data.params.value)) {
              this.log.debug(`Matter.js ipv4 address: ${data.params.value === '' ? 'all ipv4 addresses' : data.params.value}`);
              this.matterbridge.ipv4Address = data.params.value === '' ? undefined : data.params.value;
              await this.matterbridge.nodeContext?.set('matteripv4address', data.params.value);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
              this.wssSendSnackbarMessage(`IPv4 address changed to ${data.params.value === '' ? 'all ipv4 addresses' : data.params.value}`);
            }
            break;
          case 'setipv6address':
            if (isValidString(data.params.value)) {
              this.log.debug(`Matter.js ipv6 address: ${data.params.value === '' ? 'all ipv6 addresses' : data.params.value}`);
              this.matterbridge.ipv6Address = data.params.value === '' ? undefined : data.params.value;
              await this.matterbridge.nodeContext?.set('matteripv6address', data.params.value);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
              this.wssSendSnackbarMessage(`IPv6 address changed to ${data.params.value === '' ? 'all ipv6 addresses' : data.params.value}`);
            }
            break;
          case 'setmatterport':
            // eslint-disable-next-line no-case-declarations
            const port = isValidString(data.params.value) ? parseInt(data.params.value) : 0;
            if (isValidNumber(port, 5540, 5600)) {
              this.log.debug(`Set matter commissioning port to ${CYAN}${port}${db}`);
              this.matterbridge.port = port;
              await this.matterbridge.nodeContext?.set<number>('matterport', port);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
              this.wssSendSnackbarMessage(`Matter port changed to ${port}`);
            } else {
              this.log.debug(`Reset matter commissioning port to ${CYAN}5540${db}`);
              this.matterbridge.port = 5540;
              await this.matterbridge.nodeContext?.set<number>('matterport', 5540);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid value: reset matter commissioning port to default 5540' });
              this.wssSendSnackbarMessage(`Matter port reset to default 5540`, undefined, 'error');
            }
            break;
          case 'setmatterdiscriminator':
            // eslint-disable-next-line no-case-declarations
            const discriminator = isValidString(data.params.value) ? parseInt(data.params.value) : 0;
            if (isValidNumber(discriminator, 0, 4095)) {
              this.log.debug(`Set matter commissioning discriminator to ${CYAN}${discriminator}${db}`);
              this.matterbridge.discriminator = discriminator;
              await this.matterbridge.nodeContext?.set<number>('matterdiscriminator', discriminator);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
              this.wssSendSnackbarMessage(`Matter discriminator changed to ${discriminator}`);
            } else {
              this.log.debug(`Reset matter commissioning discriminator to ${CYAN}undefined${db}`);
              this.matterbridge.discriminator = undefined;
              await this.matterbridge.nodeContext?.remove('matterdiscriminator');
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid value: reset matter commissioning discriminator to default undefined' });
              this.wssSendSnackbarMessage(`Matter discriminator reset to default`, undefined, 'error');
            }
            break;
          case 'setmatterpasscode':
            // eslint-disable-next-line no-case-declarations
            const passcode = isValidString(data.params.value) ? parseInt(data.params.value) : 0;
            if (isValidNumber(passcode, 1, 99999998) && CommissioningOptions.FORBIDDEN_PASSCODES.includes(passcode) === false) {
              this.matterbridge.passcode = passcode;
              this.log.debug(`Set matter commissioning passcode to ${CYAN}${passcode}${db}`);
              await this.matterbridge.nodeContext?.set<number>('matterpasscode', passcode);
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
              this.wssSendSnackbarMessage(`Matter passcode changed to ${passcode}`);
            } else {
              this.log.debug(`Reset matter commissioning passcode to ${CYAN}undefined${db}`);
              this.matterbridge.passcode = undefined;
              await this.matterbridge.nodeContext?.remove('matterpasscode');
              this.wssSendRestartRequired();
              sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid value: reset matter commissioning passcode to default undefined' });
              this.wssSendSnackbarMessage(`Matter passcode reset to default`, undefined, 'error');
            }
            break;
          case 'setvirtualmode':
            if (isValidString(data.params.value, 1) && ['disabled', 'light', 'outlet', 'switch', 'mounted_switch'].includes(data.params.value)) {
              this.matterbridge.virtualMode = data.params.value as 'disabled' | 'light' | 'outlet' | 'switch' | 'mounted_switch';
              this.log.debug(`Set matterbridge virtual mode to ${CYAN}${data.params.value}${db}`);
              await this.matterbridge.nodeContext?.set<string>('virtualmode', data.params.value);
              this.wssSendRestartRequired();
            }
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
            break;
          default:
            this.log.warn(`Unknown parameter ${data.params.name} in /api/config`);
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Unknown parameter ${data.params.name} in /api/config` });
        }
      } else if (data.method === '/api/command') {
        const localData = data;
        if (!isValidString(data.params.command, 5)) {
          sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter command in /api/command' });
          return;
        }
        if (data.params.command === 'selectdevice' && isValidString(data.params.plugin, 10) && isValidString(data.params.serial, 1) && isValidString(data.params.name, 1)) {
          const plugin = this.matterbridge.plugins.get(data.params.plugin);
          if (!plugin) {
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/command' });
            return;
          }
          const config = plugin.configJson;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const select = (plugin.schemaJson?.properties as any)?.blackList?.selectFrom;
          // this.log.debug(`SelectDevice(selectMode ${select}) data ${debugStringify(data)}`);
          if (select === 'serial') this.log.info(`Selected device serial ${data.params.serial}`);
          if (select === 'name') this.log.info(`Selected device name ${data.params.name}`);
          if (config && select && (select === 'serial' || select === 'name')) {
            // Remove postfix from the serial if it exists
            if (config.postfix) {
              data.params.serial = data.params.serial.replace('-' + config.postfix, '');
            }
            // Add the serial to the whiteList if the whiteList exists and the serial or name is not already in it
            if (isValidArray(config.whiteList, 1)) {
              if (select === 'serial' && !config.whiteList.includes(data.params.serial)) {
                config.whiteList.push(data.params.serial);
              } else if (select === 'name' && !config.whiteList.includes(data.params.name)) {
                config.whiteList.push(data.params.name);
              }
            }
            // Remove the serial from the blackList if the blackList exists and the serial or name is in it
            if (isValidArray(config.blackList, 1)) {
              if (select === 'serial' && config.blackList.includes(data.params.serial)) {
                config.blackList = config.blackList.filter((item) => item !== localData.params.serial);
              } else if (select === 'name' && config.blackList.includes(data.params.name)) {
                config.blackList = config.blackList.filter((item) => item !== localData.params.name);
              }
            }
            if (plugin.platform) plugin.platform.config = config;
            plugin.configJson = config;
            await this.matterbridge.plugins.saveConfigFromPlugin(plugin, true);
            this.wssSendRestartRequired(false);
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
          } else {
            this.log.error(`SelectDevice: select ${select} not supported`);
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `SelectDevice: select ${select} not supported` });
          }
        } else if (data.params.command === 'unselectdevice' && isValidString(data.params.plugin, 10) && isValidString(data.params.serial, 1) && isValidString(data.params.name, 1)) {
          const plugin = this.matterbridge.plugins.get(data.params.plugin);
          if (!plugin) {
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/command' });
            return;
          }
          const config = plugin.configJson;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const select = (plugin.schemaJson?.properties as any)?.blackList?.selectFrom;
          // this.log.debug(`UnselectDevice(selectMode ${select}) data ${debugStringify(data)}`);
          if (select === 'serial') this.log.info(`Unselected device serial ${data.params.serial}`);
          if (select === 'name') this.log.info(`Unselected device name ${data.params.name}`);
          if (config && select && (select === 'serial' || select === 'name')) {
            if (config.postfix) {
              data.params.serial = data.params.serial.replace('-' + config.postfix, '');
            }
            // Remove the serial from the whiteList if the whiteList exists and the serial is in it
            if (isValidArray(config.whiteList, 1)) {
              if (select === 'serial' && config.whiteList.includes(data.params.serial)) {
                config.whiteList = config.whiteList.filter((item) => item !== localData.params.serial);
              } else if (select === 'name' && config.whiteList.includes(data.params.name)) {
                config.whiteList = config.whiteList.filter((item) => item !== localData.params.name);
              }
            }
            // Add the serial to the blackList
            if (isValidArray(config.blackList)) {
              if (select === 'serial' && !config.blackList.includes(data.params.serial)) {
                config.blackList.push(data.params.serial);
              } else if (select === 'name' && !config.blackList.includes(data.params.name)) {
                config.blackList.push(data.params.name);
              }
            }
            if (plugin.platform) plugin.platform.config = config;
            plugin.configJson = config;
            await this.matterbridge.plugins.saveConfigFromPlugin(plugin, true);
            this.wssSendRestartRequired(false);
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true });
          } else {
            this.log.error(`SelectDevice: select ${select} not supported`);
            sendResponse({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `SelectDevice: select ${select} not supported` });
          }
        }
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const localData: any = data;
        this.log.error(`Invalid method from websocket client: ${debugStringify(localData)}`);
        sendResponse({ id: localData.id, method: localData.method, src: 'Matterbridge', dst: localData.src, error: 'Invalid method' });
      }
    } catch (error) {
      inspectError(this.log, `Error processing message "${message}" from websocket client`, error);
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
  wssSendLogMessage(level: string, time: string, name: string, message: string) {
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
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log', success: true, response: { level, time, name, message } });
  }

  /**
   * Sends a need to refresh WebSocket message to all connected clients.
   *
   * @param {string} changed - The changed value.
   * @param {Record<string, unknown>} params - Additional parameters to send with the message.
   * possible values for changed:
   * - 'settings' (when the bridge has started in bridge mode or childbridge mode and when update finds a new version)
   * - 'plugins'
   * - 'devices'
   * - 'matter' with param 'matter' (QRDiv component)
   * @param {ApiMatter} params.matter - The matter device that has changed. Required if changed is 'matter'.
   */
  wssSendRefreshRequired(changed: RefreshRequiredChanged, params?: { matter: ApiMatter }) {
    this.log.debug('Sending a refresh required message to all connected clients');
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', success: true, response: { changed, ...params } });
  }

  /**
   * Sends a need to restart WebSocket message to all connected clients.
   *
   * @param {boolean} snackbar - If true, a snackbar message will be sent to all connected clients. Default is true.
   * @param {boolean} fixed - If true, the restart is fixed and will not be reset by plugin restarts. Default is false.
   */
  wssSendRestartRequired(snackbar: boolean = true, fixed: boolean = false) {
    this.log.debug('Sending a restart required message to all connected clients');
    this.matterbridge.restartRequired = true;
    this.matterbridge.fixedRestartRequired = fixed;
    if (snackbar === true) this.wssSendSnackbarMessage(`Restart required`, 0);
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'restart_required', success: true, response: { fixed } });
  }

  /**
   * Sends a no need to restart WebSocket message to all connected clients.
   *
   * @param {boolean} snackbar - If true, the snackbar message will be cleared from all connected clients. Default is true.
   */
  wssSendRestartNotRequired(snackbar: boolean = true) {
    this.log.debug('Sending a restart not required message to all connected clients');
    this.matterbridge.restartRequired = false;
    if (snackbar === true) this.wssSendCloseSnackbarMessage(`Restart required`);
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'restart_not_required', success: true });
  }

  /**
   * Sends a need to update WebSocket message to all connected clients.
   *
   * @param {boolean} devVersion - If true, the update is for a development version. Default is false.
   */
  wssSendUpdateRequired(devVersion: boolean = false) {
    this.log.debug('Sending an update required message to all connected clients');
    this.matterbridge.updateRequired = true;
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'update_required', success: true, response: { devVersion } });
  }

  /**
   * Sends a cpu update message to all connected clients.
   *
   * @param {number} cpuUsage - The CPU usage percentage to send.
   */
  wssSendCpuUpdate(cpuUsage: number) {
    if (hasParameter('debug')) this.log.debug('Sending a cpu update message to all connected clients');
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'cpu_update', success: true, response: { cpuUsage: Math.round(cpuUsage * 100) / 100 } });
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
    if (hasParameter('debug')) this.log.debug('Sending a memory update message to all connected clients');
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'memory_update', success: true, response: { totalMemory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers } });
  }

  /**
   * Sends an uptime update message to all connected clients.
   *
   * @param {string} systemUptime - The system uptime in a human-readable format.
   * @param {string} processUptime - The process uptime in a human-readable format.
   */
  wssSendUptimeUpdate(systemUptime: string, processUptime: string) {
    if (hasParameter('debug')) this.log.debug('Sending a uptime update message to all connected clients');
    // Send the message to all connected clients
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
    this.log.debug('Sending a snackbar message to all connected clients');
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'snackbar', success: true, response: { message, timeout, severity } });
  }

  /**
   * Sends a close snackbar message to all connected clients.
   * It will close the snackbar message with the same message and timeout = 0.
   *
   * @param {string} message - The message to send.
   */
  wssSendCloseSnackbarMessage(message: string) {
    this.log.debug('Sending a close snackbar message to all connected clients');
    // Send the message to all connected clients
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
   * @param {number | string | boolean} value - The new value of the attribute.
   *
   * @remarks
   * This method logs a debug message and sends a JSON-formatted message to all connected WebSocket clients
   * with the updated attribute information.
   */
  wssSendAttributeChangedMessage(plugin: string, serialNumber: string, uniqueId: string, number: EndpointNumber, id: string, cluster: string, attribute: string, value: number | string | boolean | null) {
    this.log.debug('Sending an attribute update message to all connected clients');
    // Send the message to all connected clients
    this.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'state_update', success: true, response: { plugin, serialNumber, uniqueId, number, id, cluster, attribute, value } });
  }

  /**
   * Sends a message to all connected clients.
   * This is an helper function to send a broadcast message to all connected clients.
   *
   * @param {WsMessageBroadcast} msg - The message to send.
   */
  wssBroadcastMessage(msg: WsMessageBroadcast) {
    // Send the message to all connected clients
    const stringifiedMsg = JSON.stringify(msg);
    if (msg.method !== 'log') this.log.debug(`Sending a broadcast message: ${debugStringify(msg)}`);
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(stringifiedMsg);
      }
    });
  }
}
