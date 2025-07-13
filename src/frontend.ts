/**
 * This file contains the class Frontend.
 *
 * @file frontend.ts
 * @author Luca Liguori
 * @created 2025-01-13
 * @version 1.1.0
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

// Node modules
import { Server as HttpServer, createServer, IncomingMessage } from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import EventEmitter from 'node:events';

// Third-party modules
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import multer from 'multer';
// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat, stringify, debugStringify, CYAN, db, er, nf, rs, UNDERLINE, UNDERLINEOFF, YELLOW, nt } from 'node-ansi-logger';
// @matter
import { Logger, LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, Lifecycle } from '@matter/main';
import { BridgedDeviceBasicInformation, PowerSource } from '@matter/main/clusters';

// Matterbridge
import { createZip, isValidArray, isValidNumber, isValidObject, isValidString, isValidBoolean, withTimeout, hasParameter } from './utils/export.js';
import { ApiClusters, ApiClustersResponse, ApiDevices, ApiDevicesMatter, BaseRegisteredPlugin, FrontendRegisteredPlugin, MatterbridgeInformation, plg, RegisteredPlugin, SystemInformation } from './matterbridgeTypes.js';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { PlatformConfig } from './matterbridgePlatform.js';
import { capitalizeFirstLetter, getAttribute } from './matterbridgeEndpointHelpers.js';
import { cliEmitter, lastCpuUsage } from './cliEmitter.js';

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

/**
 * Represents the Matterbridge events.
 */
interface FrontendEvents {
  server_listening: [protocol: string, port: number, address?: string];
  server_error: [error: Error];
  websocket_server_listening: [host: string];
}

export class Frontend extends EventEmitter<FrontendEvents> {
  private matterbridge: Matterbridge;
  private log: AnsiLogger;
  private port = 8283;
  private initializeError = false;

  private expressApp: express.Express | undefined;
  private httpServer: HttpServer | undefined;
  private httpsServer: https.Server | undefined;
  private webSocketServer: WebSocketServer | undefined;

  constructor(matterbridge: Matterbridge) {
    super();
    this.matterbridge = matterbridge;
    this.log = new AnsiLogger({ logName: 'Frontend', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: hasParameter('debug') ? LogLevel.DEBUG : LogLevel.INFO });
  }

  set logLevel(logLevel: LogLevel) {
    this.log.logLevel = logLevel;
  }

  async start(port = 8283) {
    this.port = port;
    this.log.debug(`Initializing the frontend ${hasParameter('ssl') ? 'https' : 'http'} server on port ${YELLOW}${this.port}${db}`);

    // Initialize multer with the upload directory
    const uploadDir = path.join(this.matterbridge.matterbridgeDirectory, 'uploads');
    await fs.mkdir(uploadDir, { recursive: true });
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

    // Serve static files from '/static' endpoint
    this.expressApp.use(express.static(path.join(this.matterbridge.rootDirectory, 'frontend/build')));

    if (!hasParameter('ssl')) {
      // Create an HTTP server and attach the express app
      try {
        this.httpServer = createServer(this.expressApp);
      } catch (error) {
        this.log.error(`Failed to create HTTP server: ${error}`);
        this.emit('server_error', error as Error);
        return;
      }

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpServer.listen(this.port, '0.0.0.0', () => {
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://0.0.0.0:${this.port}${UNDERLINEOFF}${rs}`);
          this.emit('server_listening', 'http', this.port, '0.0.0.0');
        });
      } else {
        this.httpServer.listen(this.port, () => {
          if (this.matterbridge.systemInformation.ipv4Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
          if (this.matterbridge.systemInformation.ipv6Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
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
        this.initializeError = true;
        this.emit('server_error', error);
        return;
      });
    } else {
      // Load the SSL certificate, the private key and optionally the CA certificate
      let cert: string | undefined;
      try {
        cert = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pem'), 'utf8');
        this.log.info(`Loaded certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pem')}`);
      } catch (error) {
        this.log.error(`Error reading certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/cert.pem')}: ${error}`);
        this.emit('server_error', error as Error);
        return;
      }
      let key: string | undefined;
      try {
        key = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem'), 'utf8');
        this.log.info(`Loaded key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem')}`);
      } catch (error) {
        this.log.error(`Error reading key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem')}: ${error}`);
        this.emit('server_error', error as Error);
        return;
      }
      let ca: string | undefined;
      try {
        ca = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/ca.pem'), 'utf8');
        this.log.info(`Loaded CA certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/ca.pem')}`);
      } catch (error) {
        this.log.info(`CA certificate file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/ca.pem')} not loaded: ${error}`);
      }
      const serverOptions: https.ServerOptions = { cert, key, ca };

      // Create an HTTPS server with the SSL certificate and private key (ca is optional) and attach the express app
      try {
        this.httpsServer = https.createServer(serverOptions, this.expressApp);
      } catch (error) {
        this.log.error(`Failed to create HTTPS server: ${error}`);
        this.emit('server_error', error as Error);
        return;
      }

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpsServer.listen(this.port, '0.0.0.0', () => {
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://0.0.0.0:${this.port}${UNDERLINEOFF}${rs}`);
          this.emit('server_listening', 'https', this.port, '0.0.0.0');
        });
      } else {
        this.httpsServer.listen(this.port, () => {
          if (this.matterbridge.systemInformation.ipv4Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
          if (this.matterbridge.systemInformation.ipv6Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
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
        this.initializeError = true;
        this.emit('server_error', error);
        return;
      });
    }

    if (this.initializeError) return;

    // Create a WebSocket server and attach it to the http or https server
    const wssPort = this.port;
    const wssHost = hasParameter('ssl') ? `wss://${this.matterbridge.systemInformation.ipv4Address}:${wssPort}` : `ws://${this.matterbridge.systemInformation.ipv4Address}:${wssPort}`;
    this.webSocketServer = new WebSocketServer(hasParameter('ssl') ? { server: this.httpsServer } : { server: this.httpServer });

    this.webSocketServer.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const clientIp = request.socket.remoteAddress;

      // Set the global logger callback for the WebSocketServer
      let callbackLogLevel = LogLevel.NOTICE;
      if (this.matterbridge.matterbridgeInformation.loggerLevel === LogLevel.INFO || this.matterbridge.matterbridgeInformation.matterLoggerLevel === MatterLogLevel.INFO) callbackLogLevel = LogLevel.INFO;
      if (this.matterbridge.matterbridgeInformation.loggerLevel === LogLevel.DEBUG || this.matterbridge.matterbridgeInformation.matterLoggerLevel === MatterLogLevel.DEBUG) callbackLogLevel = LogLevel.DEBUG;
      AnsiLogger.setGlobalCallback(this.wssSendMessage.bind(this), callbackLogLevel);
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
        this.log.error(`WebSocket client error: ${error}`);
      });
    });

    this.webSocketServer.on('close', () => {
      this.log.debug(`WebSocketServer closed`);
    });

    this.webSocketServer.on('listening', () => {
      this.log.info(`The WebSocketServer is listening on ${UNDERLINE}${wssHost}${UNDERLINEOFF}${rs}`);
      this.emit('websocket_server_listening', wssHost);
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
        rss: this.formatMemoryUsage(memoryUsageRaw.rss),
        heapTotal: this.formatMemoryUsage(memoryUsageRaw.heapTotal),
        heapUsed: this.formatMemoryUsage(memoryUsageRaw.heapUsed),
        external: this.formatMemoryUsage(memoryUsageRaw.external),
        arrayBuffers: this.formatMemoryUsage(memoryUsageRaw.arrayBuffers),
      };

      // V8 heap statistics
      const { default: v8 } = await import('node:v8');
      const heapStatsRaw = v8.getHeapStatistics();
      const heapSpacesRaw = v8.getHeapSpaceStatistics();

      // Format heapStats
      const heapStats = Object.fromEntries(Object.entries(heapStatsRaw).map(([key, value]) => [key, this.formatMemoryUsage(value as number)]));

      // Format heapSpaces
      const heapSpaces = heapSpacesRaw.map((space) => ({
        ...space,
        space_size: this.formatMemoryUsage(space.space_size),
        space_used_size: this.formatMemoryUsage(space.space_used_size),
        space_available_size: this.formatMemoryUsage(space.space_available_size),
        physical_space_size: this.formatMemoryUsage(space.physical_space_size),
      }));

      // Define a type for the module with a _cache property
      interface ModuleWithCache {
        _cache: Record<string, unknown>;
      }
      const { default: module } = await import('node:module');
      const loadedModules = (module as unknown as ModuleWithCache)._cache ? Object.keys((module as unknown as ModuleWithCache)._cache).sort() : [];

      const memoryReport = {
        memoryUsage,
        heapStats,
        heapSpaces,
        loadedModules,
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
      res.json(this.getBaseRegisteredPlugins());
    });

    // Endpoint to provide devices
    this.expressApp.get('/api/devices', async (req, res) => {
      this.log.debug('The frontend sent /api/devices');
      const devices = await this.getDevices();
      res.json(devices);
    });

    // Endpoint to view the matterbridge log
    this.expressApp.get('/api/view-mblog', async (req, res) => {
      this.log.debug('The frontend sent /api/view-mblog');
      try {
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbridgeLoggerFile), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading matterbridge log file ${this.matterbridge.matterbridgeLoggerFile}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading matterbridge log file. Please enable the matterbridge log on file in the settings.');
      }
    });

    // Endpoint to view the matter.js log
    this.expressApp.get('/api/view-mjlog', async (req, res) => {
      this.log.debug('The frontend sent /api/view-mjlog');
      try {
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading matter log file ${this.matterbridge.matterLoggerFile}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading matter log file. Please enable the matter log on file in the settings.');
      }
    });

    // Endpoint to view the shelly log
    this.expressApp.get('/api/shellyviewsystemlog', async (req, res) => {
      this.log.debug('The frontend sent /api/shellyviewsystemlog');
      try {
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading shelly log file ${this.matterbridge.matterbridgeLoggerFile}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading shelly log file. Please create the shelly system log before loading it.');
      }
    });

    // Endpoint to download the matterbridge log
    this.expressApp.get('/api/download-mblog', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-mblog ${path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbridgeLoggerFile)}`);
      try {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        await fs.access(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbridgeLoggerFile), fs.constants.F_OK);
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbridgeLoggerFile), 'utf8');
        await fs.writeFile(path.join(os.tmpdir(), this.matterbridge.matterbridgeLoggerFile), data, 'utf-8');
      } catch (error) {
        await fs.writeFile(path.join(os.tmpdir(), this.matterbridge.matterbridgeLoggerFile), 'Enable the matterbridge log on file in the settings to download the matterbridge log.', 'utf-8');
        this.log.debug(`Error in /api/download-mblog: ${error instanceof Error ? error.message : error}`);
      }
      res.type('text/plain');
      res.download(path.join(os.tmpdir(), this.matterbridge.matterbridgeLoggerFile), 'matterbridge.log', (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading log file ${this.matterbridge.matterbridgeLoggerFile}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge log file');
        }
      });
    });

    // Endpoint to download the matter log
    this.expressApp.get('/api/download-mjlog', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-mjlog ${path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbridgeLoggerFile)}`);
      try {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        await fs.access(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), fs.constants.F_OK);
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), 'utf8');
        await fs.writeFile(path.join(os.tmpdir(), this.matterbridge.matterLoggerFile), data, 'utf-8');
      } catch (error) {
        await fs.writeFile(path.join(os.tmpdir(), this.matterbridge.matterLoggerFile), 'Enable the matter log on file in the settings to download the matter log.', 'utf-8');
        this.log.debug(`Error in /api/download-mblog: ${error instanceof Error ? error.message : error}`);
      }
      res.type('text/plain');
      res.download(path.join(os.tmpdir(), this.matterbridge.matterLoggerFile), 'matter.log', (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading log file ${this.matterbridge.matterLoggerFile}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter log file');
        }
      });
    });

    // Endpoint to download the shelly log
    this.expressApp.get('/api/shellydownloadsystemlog', async (req, res) => {
      this.log.debug('The frontend sent /api/shellydownloadsystemlog');
      try {
        // eslint-disable-next-line n/no-unsupported-features/node-builtins
        await fs.access(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), fs.constants.F_OK);
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), 'utf8');
        await fs.writeFile(path.join(os.tmpdir(), 'shelly.log'), data, 'utf-8');
      } catch (error) {
        await fs.writeFile(path.join(os.tmpdir(), 'shelly.log'), 'Create the Shelly system log before downloading it.', 'utf-8');
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
      await createZip(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.nodeStorageName}.zip`), path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.nodeStorageName));
      res.download(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.nodeStorageName}.zip`), `matterbridge.${this.matterbridge.nodeStorageName}.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading file ${`matterbridge.${this.matterbridge.nodeStorageName}.zip`}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge storage file');
        }
      });
    });

    // Endpoint to download the matter storage file
    this.expressApp.get('/api/download-mjstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mjstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.matterStorageName}.zip`), path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterStorageName));
      res.download(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.matterStorageName}.zip`), `matterbridge.${this.matterbridge.matterStorageName}.zip`, (error) => {
        /* istanbul ignore if */
        if (error) {
          this.log.error(`Error downloading the matter storage matterbridge.${this.matterbridge.matterStorageName}.zip: ${error instanceof Error ? error.message : error}`);
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
        await fs.rename(file.path, filePath);
        this.log.info(`File ${plg}${filename}${nf} uploaded successfully`);

        // Install the plugin package
        if (filename.endsWith('.tgz')) {
          const { spawnCommand } = await import('./utils/spawn.js');
          await spawnCommand(this.matterbridge, 'npm', ['install', '-g', filePath, '--omit=dev', '--verbose']);
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
              this.log.error(`Error closing WebSocket server: ${error}`);
            } else {
              this.log.debug('WebSocket server closed successfully');
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
      await withTimeout(
        new Promise<void>((resolve) => {
          this.httpServer?.close((error) => {
            if (error) {
              this.log.error(`Error closing http server: ${error}`);
            } else {
              this.log.debug('Http server closed successfully');
            }
            resolve();
          });
        }),
        10000,
        false,
      );
      this.httpServer.removeAllListeners();
      this.httpServer = undefined;
      this.log.debug('Frontend http server closed successfully');
    }

    // Close the https server
    if (this.httpsServer) {
      this.log.debug('Closing https server...');
      await withTimeout(
        new Promise<void>((resolve) => {
          this.httpsServer?.close((error) => {
            if (error) {
              this.log.error(`Error closing https server: ${error}`);
            } else {
              this.log.debug('Https server closed successfully');
            }
            resolve();
          });
        }),
        10000,
        false,
      );
      this.httpsServer.removeAllListeners();
      this.httpsServer = undefined;
      this.log.debug('Frontend https server closed successfully');
    }
    this.log.debug('Frontend stopped successfully');
  }

  // Function to format bytes to KB, MB, or GB
  private formatMemoryUsage = (bytes: number): string => {
    if (bytes >= 1024 ** 3) {
      return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
    } else if (bytes >= 1024 ** 2) {
      return `${(bytes / 1024 ** 2).toFixed(2)} MB`;
    } else {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
  };

  // Function to format system uptime with only the most significant unit
  private formatOsUpTime = (seconds: number): string => {
    if (seconds >= 86400) {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''}`;
    }
    if (seconds >= 3600) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    }
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  };

  /**
   * Retrieves the api settings data.
   *
   * @returns {Promise<{ matterbridgeInformation: MatterbridgeInformation, systemInformation: SystemInformation }>} A promise that resolve in the api settings object.
   */
  private async getApiSettings(): Promise<{
    matterbridgeInformation: MatterbridgeInformation;
    systemInformation: SystemInformation;
  }> {
    // Update the system information
    this.matterbridge.systemInformation.totalMemory = this.formatMemoryUsage(os.totalmem());
    this.matterbridge.systemInformation.freeMemory = this.formatMemoryUsage(os.freemem());
    this.matterbridge.systemInformation.systemUptime = this.formatOsUpTime(os.uptime());
    this.matterbridge.systemInformation.processUptime = this.formatOsUpTime(Math.floor(process.uptime()));
    this.matterbridge.systemInformation.cpuUsage = lastCpuUsage.toFixed(2) + ' %';
    this.matterbridge.systemInformation.rss = this.formatMemoryUsage(process.memoryUsage().rss);
    this.matterbridge.systemInformation.heapTotal = this.formatMemoryUsage(process.memoryUsage().heapTotal);
    this.matterbridge.systemInformation.heapUsed = this.formatMemoryUsage(process.memoryUsage().heapUsed);

    // Update the matterbridge information
    this.matterbridge.matterbridgeInformation.bridgeMode = this.matterbridge.bridgeMode;
    this.matterbridge.matterbridgeInformation.restartMode = this.matterbridge.restartMode;
    this.matterbridge.matterbridgeInformation.profile = this.matterbridge.profile;
    this.matterbridge.matterbridgeInformation.loggerLevel = this.matterbridge.log.logLevel;
    this.matterbridge.matterbridgeInformation.matterLoggerLevel = Logger.defaultLogLevel;
    this.matterbridge.matterbridgeInformation.mattermdnsinterface = this.matterbridge.mdnsInterface;
    this.matterbridge.matterbridgeInformation.matteripv4address = this.matterbridge.ipv4address;
    this.matterbridge.matterbridgeInformation.matteripv6address = this.matterbridge.ipv6address;
    this.matterbridge.matterbridgeInformation.matterPort = (await this.matterbridge.nodeContext?.get<number>('matterport', 5540)) ?? 5540;
    this.matterbridge.matterbridgeInformation.matterDiscriminator = await this.matterbridge.nodeContext?.get<number>('matterdiscriminator');
    this.matterbridge.matterbridgeInformation.matterPasscode = await this.matterbridge.nodeContext?.get<number>('matterpasscode');

    // Update the matterbridge information in bridge mode
    if (this.matterbridge.bridgeMode === 'bridge' && this.matterbridge.serverNode) {
      this.matterbridge.matterbridgeInformation.matterbridgePaired = this.matterbridge.serverNode.state.commissioning.commissioned;
      this.matterbridge.matterbridgeInformation.matterbridgeQrPairingCode = this.matterbridge.matterbridgeInformation.matterbridgeEndAdvertise ? undefined : this.matterbridge.serverNode.state.commissioning.pairingCodes.qrPairingCode;
      this.matterbridge.matterbridgeInformation.matterbridgeManualPairingCode = this.matterbridge.matterbridgeInformation.matterbridgeEndAdvertise ? undefined : this.matterbridge.serverNode.state.commissioning.pairingCodes.manualPairingCode;
      this.matterbridge.matterbridgeInformation.matterbridgeFabricInformations = this.matterbridge.sanitizeFabricInformations(Object.values(this.matterbridge.serverNode.state.commissioning.fabrics));
      this.matterbridge.matterbridgeInformation.matterbridgeSessionInformations = this.matterbridge.sanitizeSessionInformation(Object.values(this.matterbridge.serverNode.state.sessions.sessions));
    }
    return { systemInformation: this.matterbridge.systemInformation, matterbridgeInformation: this.matterbridge.matterbridgeInformation };
  }

  /**
   * Retrieves the reachable attribute.
   *
   * @param {MatterbridgeEndpoint} device - The MatterbridgeEndpoint object.
   * @returns {boolean} The reachable attribute.
   */
  private getReachability(device: MatterbridgeEndpoint): boolean {
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
   * Retrieves the commissioned status, matter pairing codes, fabrics and sessions from a given device in server mode.
   *
   * @param {MatterbridgeEndpoint} device - The MatterbridgeEndpoint to retrieve the data from.
   * @returns {ApiDevicesMatter | undefined} An ApiDevicesMatter object or undefined if not found.
   */
  private getMatterDataFromDevice(device: MatterbridgeEndpoint): ApiDevicesMatter | undefined {
    if (device.mode === 'server' && device.serverNode) {
      return {
        commissioned: device.serverNode.state.commissioning.commissioned,
        qrPairingCode: device.serverNode.state.commissioning.pairingCodes.qrPairingCode,
        manualPairingCode: device.serverNode.state.commissioning.pairingCodes.manualPairingCode,
        fabricInformations: this.matterbridge.sanitizeFabricInformations(Object.values(device.serverNode.state.commissioning.fabrics)),
        sessionInformations: this.matterbridge.sanitizeSessionInformation(Object.values(device.serverNode.state.sessions.sessions)),
      } as ApiDevicesMatter;
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
    if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return '';

    const getUserLabel = (device: MatterbridgeEndpoint) => {
      const labelList = getAttribute(device, 'userLabel', 'labelList') as { label: string; value: string }[];
      if (labelList) {
        const composed = labelList.find((entry) => entry.label === 'composed');
        if (composed) return 'Composed: ' + composed.value;
      }
      return '';
    };

    const getFixedLabel = (device: MatterbridgeEndpoint) => {
      const labelList = getAttribute(device, 'fixedLabel', 'labelList') as { label: string; value: string }[];
      if (labelList) {
        const composed = labelList.find((entry) => entry.label === 'composed');
        if (composed) return 'Composed: ' + composed.value;
      }
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
   * Retrieves the base registered plugins sanitized for res.json().
   *
   * @returns {BaseRegisteredPlugin[]} An array of BaseRegisteredPlugin.
   */
  private getBaseRegisteredPlugins(): BaseRegisteredPlugin[] {
    if (this.matterbridge.hasCleanupStarted) return []; // Skip if cleanup has started
    const baseRegisteredPlugins: FrontendRegisteredPlugin[] = [];
    for (const plugin of this.matterbridge.plugins) {
      baseRegisteredPlugins.push({
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
        serialNumber: plugin.serialNumber,
        locked: plugin.locked,
        error: plugin.error,
        enabled: plugin.enabled,
        loaded: plugin.loaded,
        started: plugin.started,
        configured: plugin.configured,
        restartRequired: plugin.restartRequired,
        registeredDevices: plugin.registeredDevices,
        addedDevices: plugin.addedDevices,
        configJson: plugin.configJson,
        schemaJson: plugin.schemaJson,
        hasWhiteList: plugin.configJson?.whiteList !== undefined,
        hasBlackList: plugin.configJson?.blackList !== undefined,
        // Childbridge mode specific data
        paired: plugin.serverNode?.state.commissioning.commissioned,
        qrPairingCode: this.matterbridge.matterbridgeInformation.matterbridgeEndAdvertise ? undefined : plugin.serverNode?.state.commissioning.pairingCodes.qrPairingCode,
        manualPairingCode: this.matterbridge.matterbridgeInformation.matterbridgeEndAdvertise ? undefined : plugin.serverNode?.state.commissioning.pairingCodes.manualPairingCode,
        fabricInformations: plugin.serverNode ? this.matterbridge.sanitizeFabricInformations(Object.values(plugin.serverNode?.state.commissioning.fabrics)) : undefined,
        sessionInformations: plugin.serverNode ? this.matterbridge.sanitizeSessionInformation(Object.values(plugin.serverNode?.state.sessions.sessions)) : undefined,
      });
    }
    return baseRegisteredPlugins;
  }

  /**
   * Retrieves the devices from Matterbridge.
   *
   * @param {string} [pluginName] - The name of the plugin to filter devices by.
   * @returns {Promise<ApiDevices[]>} A promise that resolves to an array of ApiDevices for the frontend.
   */
  private async getDevices(pluginName?: string): Promise<ApiDevices[]> {
    if (this.matterbridge.hasCleanupStarted) return []; // Skip if cleanup has started
    const devices: ApiDevices[] = [];
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
        matter: this.getMatterDataFromDevice(device),
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
   * @returns {ApiClustersResponse | undefined} A promise that resolves to the clusters or undefined if not found.
   */
  private getClusters(pluginName: string, endpointNumber: number): ApiClustersResponse | undefined {
    const endpoint = this.matterbridge.devices.array().find((d) => d.plugin === pluginName && d.maybeNumber === endpointNumber);
    if (!endpoint || !endpoint.plugin || !endpoint.maybeNumber || !endpoint.deviceName || !endpoint.serialNumber) {
      this.log.error(`getClusters: no device found for plugin ${pluginName} and endpoint number ${endpointNumber}`);
      return;
    }
    // this.log.debug(`***getClusters: getting clusters for device ${endpoint.deviceName} plugin ${pluginName} endpoint number ${endpointNumber}`);

    // Get the device types from the main endpoint
    const deviceTypes: number[] = [];
    const clusters: ApiClusters[] = [];
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
          id: childEndpoint.maybeId ?? 'null', // Never happens
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
    return { plugin: endpoint.plugin, deviceName: endpoint.deviceName, serialNumber: endpoint.serialNumber, endpoint: endpoint.maybeNumber, deviceTypes, clusters };
  }

  /**
   * Handles incoming websocket messages for the Matterbridge frontend.
   *
   * @param {WebSocket} client - The websocket client that sent the message.
   * @param {WebSocket.RawData} message - The raw data of the message received from the client.
   * @returns {Promise<void>} A promise that resolves when the message has been handled.
   */
  private async wsMessageHandler(client: WebSocket, message: WebSocket.RawData): Promise<void> {
    let data: { id: number; dst: string; src: string; method: string; params: Record<string, string | number | boolean> };
    try {
      data = JSON.parse(message.toString());
      if (!isValidNumber(data.id) || !isValidString(data.dst) || !isValidString(data.src) || !isValidString(data.method) || !isValidObject(data.params) || data.dst !== 'Matterbridge') {
        this.log.error(`Invalid message from websocket client: ${debugStringify(data)}`);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid message' }));
        return;
      }
      this.log.debug(`Received message from websocket client: ${debugStringify(data)}`);

      if (data.method === 'ping') {
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: 'pong' }));
        return;
      } else if (data.method === '/api/login') {
        if (!this.matterbridge.nodeContext) {
          this.log.error('Login nodeContext not found');
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Internal error: nodeContext not found' }));
          return;
        }
        const storedPassword = await this.matterbridge.nodeContext.get('password', '');
        if (storedPassword === '' || storedPassword === data.params.password) {
          this.log.debug('Login password valid');
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: { valid: true } }));
          return;
        } else {
          this.log.debug('Error wrong password');
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong password' }));
          return;
        }
      } else if (data.method === '/api/install') {
        if (!isValidString(data.params.packageName, 10) || !isValidBoolean(data.params.restart)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter in /api/install' }));
          return;
        }
        this.wssSendSnackbarMessage(`Installing package ${data.params.packageName}...`, 0);
        const { spawnCommand } = await import('./utils/spawn.js');
        spawnCommand(this.matterbridge, 'npm', ['install', '-g', data.params.packageName, '--omit=dev', '--verbose'])
          .then((response) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response }));
            this.wssSendCloseSnackbarMessage(`Installing package ${data.params.packageName}...`);
            this.wssSendSnackbarMessage(`Installed package ${data.params.packageName}`, 5, 'success');
            const packageName = (data.params.packageName as string).replace(/@.*$/, '');
            if (data.params.restart === false && packageName !== 'matterbridge') {
              // The install comes from InstallPlugins
              this.matterbridge.plugins
                .add(packageName)
                .then((plugin) => {
                  if (plugin) {
                    // The plugin is not registered
                    this.wssSendSnackbarMessage(`Added plugin ${packageName}`, 5, 'success');

                    this.matterbridge.plugins
                      .load(plugin, true, 'The plugin has been added', true)
                      // eslint-disable-next-line promise/no-nesting
                      .then(() => {
                        this.wssSendSnackbarMessage(`Started plugin ${packageName}`, 5, 'success');
                        this.wssSendRefreshRequired('plugins');
                        return;
                      })
                      // eslint-disable-next-line promise/no-nesting
                      .catch((_error) => {
                        //
                      });
                  } else {
                    // The plugin is already registered
                    this.wssSendSnackbarMessage(`Restart required`, 0);
                    this.wssSendRefreshRequired('plugins');
                    this.wssSendRestartRequired();
                  }
                  return;
                })
                // eslint-disable-next-line promise/no-nesting
                .catch((_error) => {
                  //
                });
            } else {
              // The package is matterbridge
              if (this.matterbridge.restartMode !== '') {
                this.wssSendSnackbarMessage(`Restarting matterbridge...`, 0);
                this.matterbridge.shutdownProcess();
              } else {
                this.wssSendSnackbarMessage(`Restart required`, 0);
                this.wssSendRestartRequired();
              }
            }
            return;
          })
          .catch((error) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: error instanceof Error ? error.message : error }));
            this.wssSendCloseSnackbarMessage(`Installing package ${data.params.packageName}...`);
            this.wssSendSnackbarMessage(`Package ${data.params.packageName} not installed`, 10, 'error');
          });
      } else if (data.method === '/api/uninstall') {
        if (!isValidString(data.params.packageName, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter packageName in /api/uninstall' }));
          return;
        }
        // The package is a plugin
        const plugin = this.matterbridge.plugins.get(data.params.packageName) as RegisteredPlugin;
        if (plugin) {
          await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been removed.', true);
          await this.matterbridge.plugins.remove(data.params.packageName);
          this.wssSendSnackbarMessage(`Removed plugin ${data.params.packageName}`, 5, 'success');
          this.wssSendRefreshRequired('plugins');
          this.wssSendRefreshRequired('devices');
        }
        // Uninstall the package
        this.wssSendSnackbarMessage(`Uninstalling package ${data.params.packageName}...`, 0);
        const { spawnCommand } = await import('./utils/spawn.js');
        spawnCommand(this.matterbridge, 'npm', ['uninstall', '-g', data.params.packageName, '--verbose'])
          .then((response) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response }));
            this.wssSendCloseSnackbarMessage(`Uninstalling package ${data.params.packageName}...`);
            this.wssSendSnackbarMessage(`Uninstalled package ${data.params.packageName}`, 5, 'success');
            return;
          })
          .catch((error) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: error instanceof Error ? error.message : error }));
            this.wssSendCloseSnackbarMessage(`Uninstalling package ${data.params.packageName}...`);
            this.wssSendSnackbarMessage(`Package ${data.params.packageName} not uninstalled`, 10, 'error');
            this.wssSendSnackbarMessage(`Restart required`, 0);
          });
      } else if (data.method === '/api/addplugin') {
        if (!isValidString(data.params.pluginNameOrPath, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginNameOrPath in /api/addplugin' }));
          return;
        }
        data.params.pluginNameOrPath = (data.params.pluginNameOrPath as string).replace(/@.*$/, '');
        if (this.matterbridge.plugins.has(data.params.pluginNameOrPath)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Plugin ${data.params.pluginNameOrPath} already added` }));
          this.wssSendSnackbarMessage(`Plugin ${data.params.pluginNameOrPath} already added`, 10, 'warning');
          return;
        }
        const plugin = await this.matterbridge.plugins.add(data.params.pluginNameOrPath);
        if (plugin) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: plugin.name }));
          this.wssSendSnackbarMessage(`Added plugin ${data.params.pluginNameOrPath}`, 5, 'success');
          this.matterbridge.plugins
            .load(plugin, true, 'The plugin has been added', true)
            .then(() => {
              this.wssSendRefreshRequired('plugins');
              this.wssSendRefreshRequired('devices');
              this.wssSendSnackbarMessage(`Started plugin ${data.params.pluginNameOrPath}`, 5, 'success');
              return;
            })
            .catch((_error) => {
              //
            });
        } else {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Plugin ${data.params.pluginNameOrPath} not added` }));
          this.wssSendSnackbarMessage(`Plugin ${data.params.pluginNameOrPath} not added`, 10, 'error');
        }
      } else if (data.method === '/api/removeplugin') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/removeplugin' }));
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as RegisteredPlugin;
        await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been removed.', true);
        await this.matterbridge.plugins.remove(data.params.pluginName);
        this.wssSendSnackbarMessage(`Removed plugin ${data.params.pluginName}`, 5, 'success');
        this.wssSendRefreshRequired('plugins');
        this.wssSendRefreshRequired('devices');
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/enableplugin') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/enableplugin' }));
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as RegisteredPlugin;
        if (plugin && !plugin.enabled) {
          plugin.locked = undefined;
          plugin.error = undefined;
          plugin.loaded = undefined;
          plugin.started = undefined;
          plugin.configured = undefined;
          plugin.platform = undefined;
          plugin.registeredDevices = undefined;
          plugin.addedDevices = undefined;
          await this.matterbridge.plugins.enable(data.params.pluginName);
          this.wssSendSnackbarMessage(`Enabled plugin ${data.params.pluginName}`, 5, 'success');
          this.matterbridge.plugins
            .load(plugin, true, 'The plugin has been enabled', true)
            .then(() => {
              this.wssSendRefreshRequired('plugins');
              this.wssSendRefreshRequired('devices');
              this.wssSendSnackbarMessage(`Started plugin ${data.params.pluginName}`, 5, 'success');
              return;
            })
            .catch((_error) => {
              //
            });
        }
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/disableplugin') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/disableplugin' }));
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as RegisteredPlugin;
        await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been disabled.', true);
        await this.matterbridge.plugins.disable(data.params.pluginName);
        this.wssSendSnackbarMessage(`Disabled plugin ${data.params.pluginName}`, 5, 'success');
        this.wssSendRefreshRequired('plugins');
        this.wssSendRefreshRequired('devices');
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/savepluginconfig') {
        if (!isValidString(data.params.pluginName, 10) || !this.matterbridge.plugins.has(data.params.pluginName)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter pluginName in /api/savepluginconfig' }));
          return;
        }
        if (!isValidObject(data.params.formData, 5)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter formData in /api/savepluginconfig' }));
          return;
        }
        this.log.info(`Saving config for plugin ${plg}${data.params.pluginName}${nf}...`);
        const plugin = this.matterbridge.plugins.get(data.params.pluginName) as RegisteredPlugin;
        if (plugin) {
          this.matterbridge.plugins.saveConfigFromJson(plugin, data.params.formData, true);
          this.wssSendSnackbarMessage(`Saved config for plugin ${data.params.pluginName}`);
          this.wssSendRefreshRequired('pluginsRestart');
          this.wssSendRestartRequired();
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
        }
      } else if (data.method === '/api/shellysysupdate') {
        const { triggerShellySysUpdate } = await import('./shelly.js');
        triggerShellySysUpdate(this.matterbridge);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/shellymainupdate') {
        const { triggerShellyMainUpdate } = await import('./shelly.js');
        triggerShellyMainUpdate(this.matterbridge);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/shellycreatesystemlog') {
        const { createShellySystemLog } = await import('./shelly.js');
        createShellySystemLog(this.matterbridge);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/shellynetconfig') {
        this.log.debug('/api/shellynetconfig:', data.params);
        const { triggerShellyChangeIp: triggerShellyChangeNet } = await import('./shelly.js');
        triggerShellyChangeNet(this.matterbridge, data.params as { type: 'static' | 'dhcp'; ip: string; subnet: string; gateway: string; dns: string });
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/softreset') {
        const { triggerShellySoftReset } = await import('./shelly.js');
        triggerShellySoftReset(this.matterbridge);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/hardreset') {
        const { triggerShellyHardReset } = await import('./shelly.js');
        triggerShellyHardReset(this.matterbridge);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/reboot') {
        const { triggerShellyReboot } = await import('./shelly.js');
        triggerShellyReboot(this.matterbridge);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/restart') {
        this.wssSendSnackbarMessage(`Restarting matterbridge...`, 0);
        await this.matterbridge.restartProcess();
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/shutdown') {
        this.wssSendSnackbarMessage(`Shutting down matterbridge...`, 0);
        await this.matterbridge.shutdownProcess();
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/create-backup') {
        this.wssSendSnackbarMessage('Creating backup...', 0);
        this.log.notice(`Creating the backup...`);
        await createZip(path.join(os.tmpdir(), `matterbridge.backup.zip`), path.join(this.matterbridge.matterbridgeDirectory), path.join(this.matterbridge.matterbridgePluginDirectory));
        this.log.notice(`Backup ready to be downloaded.`);
        this.wssSendCloseSnackbarMessage('Creating backup...');
        this.wssSendSnackbarMessage('Backup ready to be downloaded', 10);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/unregister') {
        this.wssSendSnackbarMessage('Unregistering all bridged devices...', 0);
        await this.matterbridge.unregisterAndShutdownProcess();
        this.wssSendCloseSnackbarMessage('Unregistering all bridged devices...');
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/reset') {
        this.wssSendSnackbarMessage('Resetting matterbridge commissioning...', 10);
        await this.matterbridge.shutdownProcessAndReset();
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/factoryreset') {
        this.wssSendSnackbarMessage('Factory reset of matterbridge...', 10);
        await this.matterbridge.shutdownProcessAndFactoryReset();
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/advertise') {
        const pairingCodes = await this.matterbridge.advertiseServerNode(this.matterbridge.serverNode);
        this.matterbridge.matterbridgeInformation.matterbridgeAdvertise = true;
        // this.matterbridge.matterbridgeQrPairingCode = pairingCodes?.qrPairingCode;
        // this.matterbridge.matterbridgeManualPairingCode = pairingCodes?.manualPairingCode;
        this.wssSendRefreshRequired('matterbridgeAdvertise');
        this.wssSendSnackbarMessage(`Started fabrics share`, 0);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: pairingCodes, success: true }));
      } else if (data.method === '/api/stopadvertise') {
        await this.matterbridge.stopAdvertiseServerNode(this.matterbridge.serverNode);
        this.matterbridge.matterbridgeInformation.matterbridgeAdvertise = false;
        this.wssSendRefreshRequired('matterbridgeAdvertise');
        this.wssSendSnackbarMessage(`Stopped fabrics share`, 0);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
      } else if (data.method === '/api/settings') {
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: await this.getApiSettings() }));
      } else if (data.method === '/api/plugins') {
        const response = this.getBaseRegisteredPlugins();
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response }));
      } else if (data.method === '/api/devices') {
        const devices = await this.getDevices(isValidString(data.params.pluginName) ? data.params.pluginName : undefined);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: devices }));
      } else if (data.method === '/api/clusters') {
        if (!isValidString(data.params.plugin, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/clusters' }));
          return;
        }
        if (!isValidNumber(data.params.endpoint, 1)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter endpoint in /api/clusters' }));
          return;
        }
        const response = this.getClusters(data.params.plugin, data.params.endpoint);
        if (response) {
          client.send(
            JSON.stringify({
              id: data.id,
              method: data.method,
              src: 'Matterbridge',
              dst: data.src,
              plugin: data.params.plugin,
              deviceName: response.deviceName,
              serialNumber: response.serialNumber,
              endpoint: response.endpoint,
              deviceTypes: response.deviceTypes,
              response: response.clusters,
            }),
          );
        } else {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Endpoint not found in /api/clusters' }));
        }
      } else if (data.method === '/api/select' || data.method === '/api/select/devices') {
        if (!isValidString(data.params.plugin, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/select' }));
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.plugin);
        if (!plugin) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/select' }));
          return;
        }
        const selectDeviceValues = plugin.platform?.getSelectDevices().sort((keyA, keyB) => keyA.name.localeCompare(keyB.name));
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, plugin: data.params.plugin, response: selectDeviceValues }));
      } else if (data.method === '/api/select/entities') {
        if (!isValidString(data.params.plugin, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/select/entities' }));
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.plugin);
        if (!plugin) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/select/entities' }));
          return;
        }
        const selectEntityValues = plugin.platform?.getSelectEntities().sort((keyA, keyB) => keyA.name.localeCompare(keyB.name));
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, plugin: data.params.plugin, response: selectEntityValues }));
      } else if (data.method === '/api/action') {
        if (!isValidString(data.params.plugin, 5) || !isValidString(data.params.action, 1)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter in /api/action' }));
          return;
        }
        const plugin = this.matterbridge.plugins.get(data.params.plugin);
        if (!plugin) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/action' }));
          return;
        }
        this.log.notice(`Action ${CYAN}${data.params.action}${nt}${data.params.value ? ' with ' + CYAN + data.params.value + nt : ''} for plugin ${CYAN}${plugin.name}${nt}`);
        plugin.platform
          ?.onAction(data.params.action, data.params.value as string | undefined, data.params.id as string | undefined, data.params.formData as unknown as PlatformConfig)
          .then(() => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            return;
          })
          .catch((error) => {
            this.log.error(`Error in plugin ${plugin.name} action ${data.params.action}: ${error}`);
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Error in plugin ${plugin.name} action ${data.params.action}: ${error}` }));
          });
      } else if (data.method === '/api/config') {
        if (!isValidString(data.params.name, 5) || data.params.value === undefined) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter in /api/config' }));
          return;
        }
        this.log.debug(`Received /api/config name ${CYAN}${data.params.name}${db} value ${CYAN}${data.params.value}${db}`);
        switch (data.params.name) {
          case 'setpassword':
            if (isValidString(data.params.value)) {
              await this.matterbridge.nodeContext?.set('password', data.params.value);
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setbridgemode':
            if (isValidString(data.params.value) && ['bridge', 'childbridge'].includes(data.params.value)) {
              await this.matterbridge.nodeContext?.set('bridgeMode', data.params.value);
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
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
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setmblogfile':
            if (isValidBoolean(data.params.value)) {
              this.log.debug('Matterbridge file log:', data.params.value);
              this.matterbridge.matterbridgeInformation.fileLogger = data.params.value;
              await this.matterbridge.nodeContext?.set('matterbridgeFileLog', data.params.value);
              // Create the file logger for matterbridge
              if (data.params.value) AnsiLogger.setGlobalLogfile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbridgeLoggerFile), this.matterbridge.matterbridgeInformation.loggerLevel, true);
              else AnsiLogger.setGlobalLogfile(undefined);
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
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
              this.matterbridge.matterbridgeInformation.matterLoggerLevel = Logger.level as MatterLogLevel;
              await this.matterbridge.nodeContext?.set('matterLogLevel', Logger.level);
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setmjlogfile':
            if (isValidBoolean(data.params.value)) {
              this.log.debug('Matter file log:', data.params.value);
              this.matterbridge.matterbridgeInformation.matterFileLogger = data.params.value;
              await this.matterbridge.nodeContext?.set('matterFileLog', data.params.value);
              if (data.params.value) {
                try {
                  Logger.addLogger('matterfilelogger', await this.matterbridge.createMatterFileLogger(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), true), {
                    defaultLogLevel: this.matterbridge.matterbridgeInformation.matterLoggerLevel as MatterLogLevel,
                    logFormat: MatterLogFormat.PLAIN,
                  });
                } catch (error) {
                  /* istanbul ignore next */
                  this.log.debug(`Error adding the matterfilelogger for file ${CYAN}${path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
                }
              } else {
                try {
                  Logger.removeLogger('matterfilelogger');
                } catch (error) {
                  /* istanbul ignore next */
                  this.log.debug(`Error removing the matterfilelogger for file ${CYAN}${path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
                }
              }
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setmdnsinterface':
            if (isValidString(data.params.value)) {
              this.log.debug(`Matter.js mdns interface: ${data.params.value === '' ? 'all interfaces' : data.params.value}`);
              this.matterbridge.mdnsInterface = data.params.value === '' ? undefined : data.params.value;
              this.matterbridge.matterbridgeInformation.mattermdnsinterface = this.matterbridge.mdnsInterface;
              await this.matterbridge.nodeContext?.set('mattermdnsinterface', data.params.value);
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setipv4address':
            if (isValidString(data.params.value)) {
              this.log.debug(`Matter.js ipv4 address: ${data.params.value === '' ? 'all ipv4 addresses' : data.params.value}`);
              this.matterbridge.ipv4address = data.params.value === '' ? undefined : data.params.value;
              this.matterbridge.matterbridgeInformation.matteripv4address = this.matterbridge.ipv4address;
              await this.matterbridge.nodeContext?.set('matteripv4address', data.params.value);
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setipv6address':
            if (isValidString(data.params.value)) {
              this.log.debug(`Matter.js ipv6 address: ${data.params.value === '' ? 'all ipv6 addresses' : data.params.value}`);
              this.matterbridge.ipv6address = data.params.value === '' ? undefined : data.params.value;
              this.matterbridge.matterbridgeInformation.matteripv6address = this.matterbridge.ipv6address;
              await this.matterbridge.nodeContext?.set('matteripv6address', data.params.value);
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            }
            break;
          case 'setmatterport':
            data.params.value = isValidString(data.params.value) ? parseInt(data.params.value) : 0;
            if (isValidNumber(data.params.value, 5540, 5580)) {
              this.log.debug(`Set matter commissioning port to ${CYAN}${data.params.value}${db}`);
              this.matterbridge.matterbridgeInformation.matterPort = data.params.value;
              await this.matterbridge.nodeContext?.set<number>('matterport', data.params.value);
              this.wssSendRestartRequired();
            } else {
              this.log.debug(`Reset matter commissioning port to ${CYAN}5540${db}`);
              this.matterbridge.matterbridgeInformation.matterPort = 5540;
              await this.matterbridge.nodeContext?.set<number>('matterport', 5540);
              this.wssSendRestartRequired();
            }
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            break;
          case 'setmatterdiscriminator':
            data.params.value = isValidString(data.params.value) ? parseInt(data.params.value) : 0;
            if (isValidNumber(data.params.value, 1000, 4095)) {
              this.log.debug(`Set matter commissioning discriminator to ${CYAN}${data.params.value}${db}`);
              this.matterbridge.matterbridgeInformation.matterDiscriminator = data.params.value;
              await this.matterbridge.nodeContext?.set<number>('matterdiscriminator', data.params.value);
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            } else {
              this.log.debug(`Reset matter commissioning discriminator to ${CYAN}undefined${db}`);
              this.matterbridge.matterbridgeInformation.matterDiscriminator = undefined;
              await this.matterbridge.nodeContext?.remove('matterdiscriminator');
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: false }));
            }
            break;
          case 'setmatterpasscode':
            data.params.value = isValidString(data.params.value) ? parseInt(data.params.value) : 0;
            if (isValidNumber(data.params.value, 10000000, 90000000)) {
              this.matterbridge.matterbridgeInformation.matterPasscode = data.params.value;
              this.log.debug(`Set matter commissioning passcode to ${CYAN}${data.params.value}${db}`);
              await this.matterbridge.nodeContext?.set<number>('matterpasscode', data.params.value);
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            } else {
              this.log.debug(`Reset matter commissioning passcode to ${CYAN}undefined${db}`);
              this.matterbridge.matterbridgeInformation.matterPasscode = undefined;
              await this.matterbridge.nodeContext?.remove('matterpasscode');
              this.wssSendRestartRequired();
              client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: false }));
            }
            break;
          case 'setvirtualmode':
            if (isValidString(data.params.value, 1) && ['disabled', 'light', 'outlet', 'switch', 'mounted_switch'].includes(data.params.value)) {
              this.matterbridge.matterbridgeInformation.virtualMode = data.params.value as 'disabled' | 'light' | 'outlet' | 'switch' | 'mounted_switch';
              this.log.debug(`Set matterbridge virtual mode to ${CYAN}${data.params.value}${db}`);
              await this.matterbridge.nodeContext?.set<string>('virtualmode', data.params.value);
              this.wssSendRestartRequired();
            }
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
            break;
          default:
            this.log.warn(`Unknown parameter ${data.params.name} in /api/config`);
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `Unknown parameter ${data.params.name} in /api/config` }));
        }
      } else if (data.method === '/api/command') {
        if (!isValidString(data.params.command, 5)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter command in /api/command' }));
          return;
        }
        if (data.params.command === 'selectdevice' && isValidString(data.params.plugin, 10) && isValidString(data.params.serial, 1) && isValidString(data.params.name, 1)) {
          const plugin = this.matterbridge.plugins.get(data.params.plugin);
          if (!plugin) {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/command' }));
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
                config.blackList = config.blackList.filter((item) => item !== data.params.serial);
              } else if (select === 'name' && config.blackList.includes(data.params.name)) {
                config.blackList = config.blackList.filter((item) => item !== data.params.name);
              }
            }
            if (plugin.platform) plugin.platform.config = config;
            plugin.configJson = config;
            const restartRequired = plugin.restartRequired;
            await this.matterbridge.plugins.saveConfigFromPlugin(plugin, true);
            if (!restartRequired) this.wssSendRefreshRequired('pluginsRestart');
            this.wssSendRestartRequired(false);
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
          } else {
            this.log.error(`SelectDevice: select ${select} not supported`);
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `SelectDevice: select ${select} not supported` }));
          }
        } else if (data.params.command === 'unselectdevice' && isValidString(data.params.plugin, 10) && isValidString(data.params.serial, 1) && isValidString(data.params.name, 1)) {
          const plugin = this.matterbridge.plugins.get(data.params.plugin);
          if (!plugin) {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/command' }));
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
                config.whiteList = config.whiteList.filter((item) => item !== data.params.serial);
              } else if (select === 'name' && config.whiteList.includes(data.params.name)) {
                config.whiteList = config.whiteList.filter((item) => item !== data.params.name);
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
            const restartRequired = plugin.restartRequired;
            await this.matterbridge.plugins.saveConfigFromPlugin(plugin, true);
            if (!restartRequired) this.wssSendRefreshRequired('pluginsRestart');
            this.wssSendRestartRequired(false);
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, success: true }));
          } else {
            this.log.error(`SelectDevice: select ${select} not supported`);
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: `SelectDevice: select ${select} not supported` }));
          }
        }
      } else {
        this.log.error(`Invalid method from websocket client: ${debugStringify(data)}`);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid method' }));
      }
    } catch (error) {
      this.log.error(`Error parsing message "${message}" from websocket client:`, error instanceof Error ? error.message : error);
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
  wssSendMessage(level: string, time: string, name: string, message: string) {
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
    // Replace all occurrences of angle-brackets with &lt; and &gt;"
    message = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // Define the maximum allowed length for continuous characters without a space
    const maxContinuousLength = 100;
    const keepStartLength = 20;
    const keepEndLength = 20;
    // Split the message into words
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

    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_LOG, src: 'Matterbridge', level, time, name, message }));
      }
    });
  }

  /**
   * Sends a need to refresh WebSocket message to all connected clients.
   *
   * @param {string} changed - The changed value. If null, the whole page will be refreshed.
   * possible values:
   * - 'matterbridgeLatestVersion'
   * - 'matterbridgeAdvertise'
   * - 'online'
   * - 'offline'
   * - 'reachability'
   * - 'settings'
   * - 'plugins'
   * - 'pluginsRestart'
   * - 'devices'
   * - 'fabrics'
   * - 'sessions'
   */
  wssSendRefreshRequired(changed: string | null = null) {
    this.log.debug('Sending a refresh required message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_REFRESH_NEEDED, src: 'Matterbridge', dst: 'Frontend', method: 'refresh_required', params: { changed: changed } }));
      }
    });
  }

  /**
   * Sends a need to restart WebSocket message to all connected clients.
   *
   * @param {boolean} snackbar - If true, a snackbar message will be sent to all connected clients.
   */
  wssSendRestartRequired(snackbar = true) {
    this.log.debug('Sending a restart required message to all connected clients');
    this.matterbridge.matterbridgeInformation.restartRequired = true;
    if (snackbar === true) this.wssSendSnackbarMessage(`Restart required`, 0);
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_RESTART_NEEDED, src: 'Matterbridge', dst: 'Frontend', method: 'restart_required', params: {} }));
      }
    });
  }

  /**
   * Sends a need to update WebSocket message to all connected clients.
   *
   */
  wssSendUpdateRequired() {
    this.log.debug('Sending an update required message to all connected clients');
    this.matterbridge.matterbridgeInformation.updateRequired = true;
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_UPDATE_NEEDED, src: 'Matterbridge', dst: 'Frontend', method: 'update_required', params: {} }));
      }
    });
  }

  /**
   * Sends a cpu update message to all connected clients.
   *
   * @param {number} cpuUsage - The CPU usage percentage to send.
   */
  wssSendCpuUpdate(cpuUsage: number) {
    if (hasParameter('debug')) this.log.debug('Sending a cpu update message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_CPU_UPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'cpu_update', params: { cpuUsage } }));
      }
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
    if (hasParameter('debug')) this.log.debug('Sending a memory update message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_MEMORY_UPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'memory_update', params: { totalMemory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers } }));
      }
    });
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
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_UPTIME_UPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'uptime_update', params: { systemUptime, processUptime } }));
      }
    });
  }

  /**
   * Sends an open snackbar message to all connected clients.
   *
   * @param {string} message - The message to send.
   * @param {number} timeout - The timeout in seconds for the snackbar message.
   * @param {'info' | 'warning' | 'error' | 'success'} severity - The severity of the snackbar message (default info).
   */
  wssSendSnackbarMessage(message: string, timeout = 5, severity: 'info' | 'warning' | 'error' | 'success' = 'info') {
    this.log.debug('Sending a snackbar message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_SNACKBAR, src: 'Matterbridge', dst: 'Frontend', params: { message, timeout, severity } }));
      }
    });
  }

  /**
   * Sends a close snackbar message to all connected clients.
   *
   * @param {string} message - The message to send.
   */
  wssSendCloseSnackbarMessage(message: string) {
    this.log.debug('Sending a close snackbar message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_CLOSE_SNACKBAR, src: 'Matterbridge', dst: 'Frontend', params: { message } }));
      }
    });
  }

  /**
   * Sends an attribute update message to all connected WebSocket clients.
   *
   * @param {string | undefined} plugin - The name of the plugin.
   * @param {string | undefined} serialNumber - The serial number of the device.
   * @param {string | undefined} uniqueId - The unique identifier of the device.
   * @param {string} cluster - The cluster name where the attribute belongs.
   * @param {string} attribute - The name of the attribute that changed.
   * @param {number | string | boolean} value - The new value of the attribute.
   *
   * @remarks
   * This method logs a debug message and sends a JSON-formatted message to all connected WebSocket clients
   * with the updated attribute information.
   */
  wssSendAttributeChangedMessage(plugin: string | undefined, serialNumber: string | undefined, uniqueId: string | undefined, cluster: string, attribute: string, value: number | string | boolean) {
    this.log.debug('Sending an attribute update message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_STATEUPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'state_update', params: { plugin, serialNumber, uniqueId, cluster, attribute, value } }));
      }
    });
  }

  /**
   * Sends a message to all connected clients.
   *
   * @param {number} id - The message id.
   * @param {string} method - The message method.
   * @param {Record<string, string | number | boolean>} params - The message parameters.
   */
  wssBroadcastMessage(id: number, method?: string, params?: Record<string, string | number | boolean>) {
    this.log.debug(`Sending a broadcast message id ${id} method ${method} params ${debugStringify(params ?? {})} to all connected clients`);
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id, src: 'Matterbridge', dst: 'Frontend', method, params }));
      }
    });
  }
}
