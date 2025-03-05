/**
 * This file contains the class Frontend.
 *
 * @file frontend.ts
 * @author Luca Liguori
 * @date 2025-01-13
 * @version 1.0.2
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
 * limitations under the License. *
 */

// @matter
import { EndpointServer, Logger, LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, Lifecycle } from '@matter/main';

// Node modules
import { Server as HttpServer, createServer, IncomingMessage } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import https from 'https';
import express from 'express';
import WebSocket, { WebSocketServer } from 'ws';
import multer from 'multer';

// AnsiLogger module
import { AnsiLogger, LogLevel, TimestampFormat, stringify, debugStringify, CYAN, db, er, nf, rs, UNDERLINE, UNDERLINEOFF, wr, YELLOW } from './logger/export.js';

// Matterbridge
import { createZip, deepCopy, isValidArray, isValidNumber, isValidObject, isValidString } from './utils/export.js';
import { ApiClusters, ApiDevices, BaseRegisteredPlugin, plg, RegisteredPlugin } from './matterbridgeTypes.js';
import { Matterbridge } from './matterbridge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { hasParameter } from './utils/export.js';
import { BridgedDeviceBasicInformation } from '@matter/main/clusters';

/**
 * Websocket message ID for logging.
 * @constant {number}
 */
export const WS_ID_LOG = 0;

/**
 * Websocket message ID indicating a refresh is needed.
 * @constant {number}
 */
export const WS_ID_REFRESH_NEEDED = 1;

/**
 * Websocket message ID indicating a restart is needed.
 * @constant {number}
 */
export const WS_ID_RESTART_NEEDED = 2;

/**
 * Websocket message ID indicating a cpu update.
 * @constant {number}
 */
export const WS_ID_CPU_UPDATE = 3;

/**
 * Websocket message ID indicating a memory update.
 * @constant {number}
 */
export const WS_ID_MEMORY_UPDATE = 4;

/**
 * Websocket message ID indicating an uptime update.
 * @constant {number}
 */
export const WS_ID_UPTIME_UPDATE = 5;

/**
 * Websocket message ID indicating a memory update.
 * @constant {number}
 */
export const WS_ID_SNACKBAR = 6;

/**
 * Websocket message ID indicating a memory update.
 * @constant {number}
 */
export const WS_ID_UPDATE_NEEDED = 7;

/**
 * Websocket message ID indicating a shelly system update.
 * check:
 * curl -k http://127.0.0.1:8101/api/updates/sys/check
 * perform:
 * curl -k http://127.0.0.1:8101/api/updates/sys/perform
 * @constant {number}
 */
export const WS_ID_SHELLY_SYS_UPDATE = 100;

/**
 * Websocket message ID indicating a shelly main update.
 * check:
 * curl -k http://127.0.0.1:8101/api/updates/main/check
 * perform:
 * curl -k http://127.0.0.1:8101/api/updates/main/perform
 * @constant {number}
 */
export const WS_ID_SHELLY_MAIN_UPDATE = 101;

export class Frontend {
  private matterbridge: Matterbridge;
  private log: AnsiLogger;
  private port = 8283;
  private initializeError = false;

  private expressApp: express.Express | undefined;
  private httpServer: HttpServer | undefined;
  private httpsServer: https.Server | undefined;
  private webSocketServer: WebSocketServer | undefined;

  private prevCpus: os.CpuInfo[] = deepCopy(os.cpus());
  private lastCpuUsage = 0;
  private memoryData: (NodeJS.MemoryUsage & { cpu: string })[] = [];
  private memoryInterval?: NodeJS.Timeout;
  private memoryTimeout?: NodeJS.Timeout;

  constructor(matterbridge: Matterbridge) {
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

    // Log all requests to the server for debugging
    /*
    this.expressApp.use((req, res, next) => {
      this.log.debug(`Received request on expressApp: ${req.method} ${req.url}`);
      next();
    });
    */

    // Serve static files from '/static' endpoint
    this.expressApp.use(express.static(path.join(this.matterbridge.rootDirectory, 'frontend/build')));

    if (!hasParameter('ssl')) {
      // Create an HTTP server and attach the express app
      this.httpServer = createServer(this.expressApp);

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpServer.listen(this.port, '0.0.0.0', () => {
          this.log.info(`The frontend http server is listening on ${UNDERLINE}http://0.0.0.0:${this.port}${UNDERLINEOFF}${rs}`);
        });
      } else {
        this.httpServer.listen(this.port, () => {
          if (this.matterbridge.systemInformation.ipv4Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
          if (this.matterbridge.systemInformation.ipv6Address !== '') this.log.info(`The frontend http server is listening on ${UNDERLINE}http://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.httpServer.on('error', (error: any) => {
        this.log.error(`Frontend http server error listening on ${this.port}`);
        switch (error.code) {
          case 'EACCES':
            this.log.error(`Port ${this.port} requires elevated privileges`);
            break;
          case 'EADDRINUSE':
            this.log.error(`Port ${this.port} is already in use`);
            break;
        }
        this.initializeError = true;
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
        return;
      }
      let key: string | undefined;
      try {
        key = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem'), 'utf8');
        this.log.info(`Loaded key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem')}`);
      } catch (error) {
        this.log.error(`Error reading key file ${path.join(this.matterbridge.matterbridgeDirectory, 'certs/key.pem')}: ${error}`);
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
      this.httpsServer = https.createServer(serverOptions, this.expressApp);

      // Listen on the specified port
      if (hasParameter('ingress')) {
        this.httpsServer.listen(this.port, '0.0.0.0', () => {
          this.log.info(`The frontend https server is listening on ${UNDERLINE}https://0.0.0.0:${this.port}${UNDERLINEOFF}${rs}`);
        });
      } else {
        this.httpsServer.listen(this.port, () => {
          if (this.matterbridge.systemInformation.ipv4Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://${this.matterbridge.systemInformation.ipv4Address}:${this.port}${UNDERLINEOFF}${rs}`);
          if (this.matterbridge.systemInformation.ipv6Address !== '') this.log.info(`The frontend https server is listening on ${UNDERLINE}https://[${this.matterbridge.systemInformation.ipv6Address}]:${this.port}${UNDERLINEOFF}${rs}`);
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.httpsServer.on('error', (error: any) => {
        this.log.error(`Frontend https server error listening on ${this.port}`);
        switch (error.code) {
          case 'EACCES':
            this.log.error(`Port ${this.port} requires elevated privileges`);
            break;
          case 'EADDRINUSE':
            this.log.error(`Port ${this.port} is already in use`);
            break;
        }
        this.initializeError = true;
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
    });

    this.webSocketServer.on('error', (ws: WebSocket, error: Error) => {
      this.log.error(`WebSocketServer error: ${error}`);
    });

    // Subscribe to cli events
    const { cliEmitter } = await import('./cli.js');
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

    // Endpoint to provide health check
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

    // Endpoint to start advertising the server node
    this.expressApp.get('/api/advertise', express.json(), async (req, res) => {
      const pairingCodes = await this.matterbridge.advertiseServerNode(this.matterbridge.serverNode);
      if (pairingCodes) {
        const { manualPairingCode, qrPairingCode } = pairingCodes;
        res.json({ manualPairingCode, qrPairingCode: 'https://project-chip.github.io/connectedhomeip/qrcode.html?data=' + qrPairingCode });
      } else {
        res.status(500).json({ error: 'Failed to generate pairing codes' });
      }
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
    this.expressApp.get('/api/devices', (req, res) => {
      this.log.debug('The frontend sent /api/devices');
      const devices: ApiDevices[] = [];
      this.matterbridge.devices.forEach(async (device) => {
        // Check if the device has the required properties
        if (!device.plugin || !device.name || !device.deviceName || !device.serialNumber || !device.uniqueId || !device.lifecycle.isReady) return;
        const cluster = this.getClusterTextFromDevice(device);
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
          cluster: cluster,
        });
      });
      res.json(devices);
    });

    // Endpoint to provide the cluster servers of the devices
    this.expressApp.get('/api/devices_clusters/:selectedPluginName/:selectedDeviceEndpoint', (req, res) => {
      const selectedPluginName = req.params.selectedPluginName;
      const selectedDeviceEndpoint: number = parseInt(req.params.selectedDeviceEndpoint, 10);
      this.log.debug(`The frontend sent /api/devices_clusters plugin:${selectedPluginName} endpoint:${selectedDeviceEndpoint}`);
      if (selectedPluginName === 'none') {
        res.json([]);
        return;
      }
      const data: { endpoint: string; clusterName: string; clusterId: string; attributeName: string; attributeId: string; attributeValue: string }[] = [];
      this.matterbridge.devices.forEach(async (device) => {
        const pluginName = device.plugin;
        if (pluginName === selectedPluginName && device.number === selectedDeviceEndpoint) {
          const endpointServer = EndpointServer.forEndpoint(device);
          const clusterServers = endpointServer.getAllClusterServers();
          clusterServers.forEach((clusterServer) => {
            Object.entries(clusterServer.attributes).forEach(([key, value]) => {
              if (clusterServer.name === 'EveHistory') return;
              let attributeValue;
              try {
                if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                else attributeValue = value.getLocal().toString();
              } catch (error) {
                attributeValue = 'Fabric-Scoped';
                this.log.debug(`GetLocal value ${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
              }
              data.push({
                endpoint: device.number ? device.number.toString() : '...',
                clusterName: clusterServer.name,
                clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                attributeName: key,
                attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                attributeValue,
              });
            });
          });
          endpointServer.getChildEndpoints().forEach((childEndpoint) => {
            const name = childEndpoint.name;
            const clusterServers = childEndpoint.getAllClusterServers();
            clusterServers.forEach((clusterServer) => {
              Object.entries(clusterServer.attributes).forEach(([key, value]) => {
                if (clusterServer.name === 'EveHistory') return;
                let attributeValue;
                try {
                  if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                  else attributeValue = value.getLocal().toString();
                } catch (error) {
                  attributeValue = 'Fabric-Scoped';
                  this.log.debug(`GetLocal error ${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
                }
                data.push({
                  endpoint: (childEndpoint.number ? childEndpoint.number.toString() : '...') + (name ? ' (' + name + ')' : ''),
                  clusterName: clusterServer.name,
                  clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                  attributeName: key,
                  attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                  attributeValue,
                });
              });
            });
          });
        }
      });
      res.json(data);
    });

    // Endpoint to view the log
    this.expressApp.get('/api/view-log', async (req, res) => {
      this.log.debug('The frontend sent /api/log');
      try {
        const data = await fs.readFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbrideLoggerFile), 'utf8');
        res.type('text/plain');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading log file ${this.matterbridge.matterbrideLoggerFile}: ${error instanceof Error ? error.message : error}`);
        res.status(500).send('Error reading log file');
      }
    });

    // Endpoint to download the matterbridge log
    this.expressApp.get('/api/download-mblog', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mblog');
      try {
        await fs.access(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbrideLoggerFile), fs.constants.F_OK);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        fs.appendFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbrideLoggerFile), 'Enable the log on file in the settings to enable the file logger');
      }
      res.download(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbrideLoggerFile), 'matterbridge.log', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${this.matterbridge.matterbrideLoggerFile}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge log file');
        }
      });
    });

    // Endpoint to download the matter log
    this.expressApp.get('/api/download-mjlog', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mjlog');
      try {
        await fs.access(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), fs.constants.F_OK);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        fs.appendFile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), 'Enable the log on file in the settings to enable the file logger');
      }
      res.download(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), 'matter.log', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${this.matterbridge.matterLoggerFile}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter log file');
        }
      });
    });

    // Endpoint to download the matter log
    this.expressApp.get('/api/shellydownloadsystemlog', async (req, res) => {
      this.log.debug('The frontend sent /api/shellydownloadsystemlog');
      try {
        await fs.access(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), fs.constants.F_OK);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        fs.appendFile(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), 'Create the Shelly system log before downloading it.');
      }
      res.download(path.join(this.matterbridge.matterbridgeDirectory, 'shelly.log'), 'shelly.log', (error) => {
        if (error) {
          this.log.error(`Error downloading Shelly system log file: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading Shelly system log file');
        }
      });
    });

    // Endpoint to download the matter storage file
    this.expressApp.get('/api/download-mjstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mjstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.matterStorageName}.zip`), path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterStorageName));
      res.download(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.matterStorageName}.zip`), `matterbridge.${this.matterbridge.matterStorageName}.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading the matter storage matterbridge.${this.matterbridge.matterStorageName}.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matter storage zip file');
        }
      });
    });

    // Endpoint to download the matterbridge storage directory
    this.expressApp.get('/api/download-mbstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mbstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.nodeStorageName}.zip`), path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.nodeStorageName));
      res.download(path.join(os.tmpdir(), `matterbridge.${this.matterbridge.nodeStorageName}.zip`), `matterbridge.${this.matterbridge.nodeStorageName}.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file ${`matterbridge.${this.matterbridge.nodeStorageName}.zip`}: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge storage file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin directory
    this.expressApp.get('/api/download-pluginstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginstorage');
      await createZip(path.join(os.tmpdir(), `matterbridge.pluginstorage.zip`), this.matterbridge.matterbridgePluginDirectory);
      res.download(path.join(os.tmpdir(), `matterbridge.pluginstorage.zip`), `matterbridge.pluginstorage.zip`, (error) => {
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
      // await createZip(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), path.relative(process.cwd(), path.join(this.matterbridge.matterbridgeDirectory, 'certs', '*.*')), path.relative(process.cwd(), path.join(this.matterbridge.matterbridgeDirectory, '*.config.json')));
      res.download(path.join(os.tmpdir(), `matterbridge.pluginconfig.zip`), `matterbridge.pluginconfig.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file matterbridge.pluginstorage.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send('Error downloading the matterbridge plugin storage file');
        }
      });
    });

    // Endpoint to download the matterbridge plugin config files
    this.expressApp.get('/api/download-backup', async (req, res) => {
      this.log.debug('The frontend sent /api/download-backup');
      res.download(path.join(os.tmpdir(), `matterbridge.backup.zip`), `matterbridge.backup.zip`, (error) => {
        if (error) {
          this.log.error(`Error downloading file matterbridge.backup.zip: ${error instanceof Error ? error.message : error}`);
          res.status(500).send(`Error downloading file matterbridge.backup.zip: ${error instanceof Error ? error.message : error}`);
        }
      });
    });

    // Endpoint to receive commands
    this.expressApp.post('/api/command/:command/:param', express.json(), async (req, res): Promise<void> => {
      const command = req.params.command;
      let param = req.params.param;
      this.log.debug(`The frontend sent /api/command/${command}/${param}`);

      if (!command) {
        res.status(400).json({ error: 'No command provided' });
        return;
      }

      this.log.debug(`Received frontend command: ${command}:${param}`);

      // Handle the command setpassword from Settings
      if (command === 'setpassword') {
        const password = param.slice(1, -1); // Remove the first and last characters
        this.log.debug('setpassword', param, password);
        await this.matterbridge.nodeContext?.set('password', password);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setbridgemode from Settings
      if (command === 'setbridgemode') {
        this.log.debug(`setbridgemode: ${param}`);
        this.wssSendRestartRequired();
        await this.matterbridge.nodeContext?.set('bridgeMode', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command backup from Settings
      if (command === 'backup') {
        this.log.notice(`Prepairing the backup...`);
        await createZip(path.join(os.tmpdir(), `matterbridge.backup.zip`), path.join(this.matterbridge.matterbridgeDirectory), path.join(this.matterbridge.matterbridgePluginDirectory));
        this.log.notice(`Backup ready to be downloaded.`);
        this.wssSendSnackbarMessage('Backup ready to be downloaded', 10);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmbloglevel') {
        this.log.debug('Matterbridge log level:', param);
        if (param === 'Debug') {
          this.log.logLevel = LogLevel.DEBUG;
        } else if (param === 'Info') {
          this.log.logLevel = LogLevel.INFO;
        } else if (param === 'Notice') {
          this.log.logLevel = LogLevel.NOTICE;
        } else if (param === 'Warn') {
          this.log.logLevel = LogLevel.WARN;
        } else if (param === 'Error') {
          this.log.logLevel = LogLevel.ERROR;
        } else if (param === 'Fatal') {
          this.log.logLevel = LogLevel.FATAL;
        }
        await this.matterbridge.nodeContext?.set('matterbridgeLogLevel', this.log.logLevel);
        await this.matterbridge.setLogLevel(this.log.logLevel);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmjloglevel') {
        this.log.debug('Matter.js log level:', param);
        if (param === 'Debug') {
          Logger.defaultLogLevel = MatterLogLevel.DEBUG;
        } else if (param === 'Info') {
          Logger.defaultLogLevel = MatterLogLevel.INFO;
        } else if (param === 'Notice') {
          Logger.defaultLogLevel = MatterLogLevel.NOTICE;
        } else if (param === 'Warn') {
          Logger.defaultLogLevel = MatterLogLevel.WARN;
        } else if (param === 'Error') {
          Logger.defaultLogLevel = MatterLogLevel.ERROR;
        } else if (param === 'Fatal') {
          Logger.defaultLogLevel = MatterLogLevel.FATAL;
        }
        await this.matterbridge.nodeContext?.set('matterLogLevel', Logger.defaultLogLevel);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmdnsinterface from Settings
      if (command === 'setmdnsinterface') {
        param = param.slice(1, -1); // Remove the first and last characters *mdns*
        this.matterbridge.matterbridgeInformation.mattermdnsinterface = param;
        this.log.debug('Matter.js mdns interface:', param === '' ? 'All interfaces' : param);
        await this.matterbridge.nodeContext?.set('mattermdnsinterface', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setipv4address from Settings
      if (command === 'setipv4address') {
        param = param.slice(1, -1); // Remove the first and last characters *ip*
        this.matterbridge.matterbridgeInformation.matteripv4address = param;
        this.log.debug('Matter.js ipv4 address:', param === '' ? 'All ipv4 addresses' : param);
        await this.matterbridge.nodeContext?.set('matteripv4address', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setipv6address from Settings
      if (command === 'setipv6address') {
        param = param.slice(1, -1); // Remove the first and last characters *ip*
        this.matterbridge.matterbridgeInformation.matteripv6address = param;
        this.log.debug('Matter.js ipv6 address:', param === '' ? 'All ipv6 addresses' : param);
        await this.matterbridge.nodeContext?.set('matteripv6address', param);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmatterport from Settings
      if (command === 'setmatterport') {
        const port = Math.min(Math.max(parseInt(param), 5540), 5560);
        this.matterbridge.matterbridgeInformation.matterPort = port;
        this.log.debug(`Set matter commissioning port to ${CYAN}${port}${db}`);
        await this.matterbridge.nodeContext?.set<number>('matterport', port);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmatterdiscriminator from Settings
      if (command === 'setmatterdiscriminator') {
        const discriminator = Math.min(Math.max(parseInt(param), 1000), 4095);
        this.matterbridge.matterbridgeInformation.matterDiscriminator = discriminator;
        this.log.debug(`Set matter commissioning discriminator to ${CYAN}${discriminator}${db}`);
        await this.matterbridge.nodeContext?.set<number>('matterdiscriminator', discriminator);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmatterpasscode from Settings
      if (command === 'setmatterpasscode') {
        const passcode = Math.min(Math.max(parseInt(param), 10000000), 90000000);
        this.matterbridge.matterbridgeInformation.matterPasscode = passcode;
        this.log.debug(`Set matter commissioning passcode to ${CYAN}${passcode}${db}`);
        await this.matterbridge.nodeContext?.set<number>('matterpasscode', passcode);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmblogfile') {
        this.log.debug('Matterbridge file log:', param);
        this.matterbridge.matterbridgeInformation.fileLogger = param === 'true';
        await this.matterbridge.nodeContext?.set('matterbridgeFileLog', param === 'true');
        // Create the file logger for matterbridge
        if (param === 'true') AnsiLogger.setGlobalLogfile(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterbrideLoggerFile), LogLevel.DEBUG, true);
        else AnsiLogger.setGlobalLogfile(undefined);
        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command setmbloglevel from Settings
      if (command === 'setmjlogfile') {
        this.log.debug('Matter file log:', param);
        this.matterbridge.matterbridgeInformation.matterFileLogger = param === 'true';
        await this.matterbridge.nodeContext?.set('matterFileLog', param === 'true');
        if (param === 'true') {
          try {
            Logger.addLogger('matterfilelogger', await this.matterbridge.createMatterFileLogger(path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile), true), {
              defaultLogLevel: MatterLogLevel.DEBUG,
              logFormat: MatterLogFormat.PLAIN,
            });
          } catch (error) {
            this.log.debug(`Error adding the matterfilelogger for file ${CYAN}${path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
          }
        } else {
          try {
            Logger.removeLogger('matterfilelogger');
          } catch (error) {
            this.log.debug(`Error removing the matterfilelogger for file ${CYAN}${path.join(this.matterbridge.matterbridgeDirectory, this.matterbridge.matterLoggerFile)}${er}: ${error instanceof Error ? error.message : error}`);
          }
        }

        res.json({ message: 'Command received' });
        return;
      }

      // Handle the command unregister from Settings
      if (command === 'unregister') {
        await this.matterbridge.unregisterAndShutdownProcess();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command reset from Settings
      if (command === 'reset') {
        await this.matterbridge.shutdownProcessAndReset();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command factoryreset from Settings
      if (command === 'factoryreset') {
        await this.matterbridge.shutdownProcessAndFactoryReset();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command shutdown from Header
      if (command === 'shutdown') {
        await this.matterbridge.shutdownProcess();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command restart from Header
      if (command === 'restart') {
        await this.matterbridge.restartProcess();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command update from Header
      if (command === 'update') {
        await this.matterbridge.updateProcess();
        this.wssSendRestartRequired();
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command saveconfig from Home
      if (command === 'saveconfig') {
        param = param.replace(/\*/g, '\\');
        this.log.info(`Saving config for plugin ${plg}${param}${nf}...`);
        // console.log('Req.body:', JSON.stringify(req.body, null, 2));

        if (!this.matterbridge.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.matterbridge.plugins.get(param);
          if (!plugin) return;
          this.matterbridge.plugins.saveConfigFromJson(plugin, req.body);
          this.wssSendSnackbarMessage(`Saved config for plugin ${param}`);
          this.wssSendRestartRequired();
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command installplugin from Home
      if (command === 'installplugin') {
        param = param.replace(/\*/g, '\\');
        this.log.info(`Installing plugin ${plg}${param}${nf}...`);
        this.wssSendSnackbarMessage(`Installing package ${param}`);
        try {
          await this.matterbridge.spawnCommand('npm', ['install', '-g', param, '--omit=dev', '--verbose']);
          this.log.info(`Plugin ${plg}${param}${nf} installed. Full restart required.`);
          this.wssSendSnackbarMessage(`Installed package ${param}`);
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
          this.log.error(`Error installing plugin ${plg}${param}${er}`);
          this.wssSendSnackbarMessage(`Package ${param} not installed`);
        }
        this.wssSendRestartRequired();
        param = param.split('@')[0];
        // Also add the plugin to matterbridge so no return!
        if (param === 'matterbridge') {
          // If we used the command installplugin to install a dev or a specific version of matterbridge we don't want to add it to matterbridge
          res.json({ message: 'Command received' });
          return;
        }
      }
      // Handle the command addplugin from Home
      if (command === 'addplugin' || command === 'installplugin') {
        param = param.replace(/\*/g, '\\');
        const plugin = await this.matterbridge.plugins.add(param);
        if (plugin) {
          this.wssSendSnackbarMessage(`Added plugin ${param}`);
          if (this.matterbridge.bridgeMode === 'childbridge') {
            // We don't know now if the plugin is a dynamic platform or an accessory platform so we create the server node and the aggregator node
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (this.matterbridge as any).createDynamicPlugin(plugin, true);
          }
          this.matterbridge.plugins.load(plugin, true, 'The plugin has been added', true).then(() => {
            this.wssSendRefreshRequired('plugins');
          });
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command removeplugin from Home
      if (command === 'removeplugin') {
        if (!this.matterbridge.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.matterbridge.plugins.get(param) as RegisteredPlugin;
          await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been removed.', true); // This will also close the server node in childbridge mode
          await this.matterbridge.plugins.remove(param);
          this.wssSendSnackbarMessage(`Removed plugin ${param}`);
          this.wssSendRefreshRequired('plugins');
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command enableplugin from Home
      if (command === 'enableplugin') {
        if (!this.matterbridge.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.matterbridge.plugins.get(param);
          if (plugin && !plugin.enabled) {
            plugin.locked = undefined;
            plugin.error = undefined;
            plugin.loaded = undefined;
            plugin.started = undefined;
            plugin.configured = undefined;
            plugin.platform = undefined;
            plugin.registeredDevices = undefined;
            plugin.addedDevices = undefined;
            await this.matterbridge.plugins.enable(param);
            this.wssSendSnackbarMessage(`Enabled plugin ${param}`);
            if (this.matterbridge.bridgeMode === 'childbridge' && plugin.type === 'DynamicPlatform') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (this.matterbridge as any).createDynamicPlugin(plugin, true);
            }
            this.matterbridge.plugins.load(plugin, true, 'The plugin has been enabled', true).then(() => {
              this.wssSendRefreshRequired('plugins');
            });
          }
        }
        res.json({ message: 'Command received' });
        return;
      }
      // Handle the command disableplugin from Home
      if (command === 'disableplugin') {
        if (!this.matterbridge.plugins.has(param)) {
          this.log.warn(`Plugin ${plg}${param}${wr} not found in matterbridge`);
        } else {
          const plugin = this.matterbridge.plugins.get(param);
          if (plugin && plugin.enabled) {
            await this.matterbridge.plugins.shutdown(plugin, 'The plugin has been disabled.', true); // This will also close the server node in childbridge mode
            await this.matterbridge.plugins.disable(param);
            this.wssSendSnackbarMessage(`Disabled plugin ${param}`);
            this.wssSendRefreshRequired('plugins');
          }
        }
        res.json({ message: 'Command received' });
        return;
      }
    });

    this.expressApp.post('/api/uploadpackage', upload.single('file'), async (req, res) => {
      const { filename } = req.body;
      const file = req.file;

      if (!file || !filename) {
        this.log.error(`uploadpackage: invalid request: file and filename are required`);
        res.status(400).send('Invalid request: file and filename are required');
        return;
      }

      // Define the path where the plugin file will be saved
      const filePath = path.join(this.matterbridge.matterbridgeDirectory, 'uploads', filename);

      try {
        // Move the uploaded file to the specified path
        await fs.rename(file.path, filePath);
        this.log.info(`File ${plg}${filename}${nf} uploaded successfully`);

        // Install the plugin package
        if (filename.endsWith('.tgz')) {
          await this.matterbridge.spawnCommand('npm', ['install', '-g', filePath, '--omit=dev', '--verbose']);
          this.log.info(`Plugin package ${plg}${filename}${nf} installed successfully. Full restart required.`);
          this.wssSendSnackbarMessage(`Installed package ${filename}`, 10, 'success');
          this.wssSendRestartRequired();
          res.send(`Plugin package ${filename} uploaded and installed successfully`);
        } else res.send(`File ${filename} uploaded successfully`);
      } catch (err) {
        this.log.error(`Error uploading or installing plugin package file ${plg}${filename}${er}:`, err);
        res.status(500).send(`Error uploading or installing plugin package ${filename}`);
      }
    });

    // Fallback for routing (must be the last route)
    this.expressApp.get('*', (req, res) => {
      this.log.debug('The frontend sent:', req.url);
      this.log.debug('Response send file:', path.join(this.matterbridge.rootDirectory, 'frontend/build/index.html'));
      res.sendFile(path.join(this.matterbridge.rootDirectory, 'frontend/build/index.html'));
    });

    this.log.debug(`Frontend initialized on port ${YELLOW}${this.port}${db} static ${UNDERLINE}${path.join(this.matterbridge.rootDirectory, 'frontend/build')}${UNDERLINEOFF}${rs}`);
  }

  async stop() {
    // Remove all listeners from the cliEmitter
    // cliEmitter.removeAllListeners();

    // Close the http server
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer.removeAllListeners();
      this.httpServer = undefined;
      this.log.debug('Frontend http server closed successfully');
    }

    // Close the https server
    if (this.httpsServer) {
      this.httpsServer.close();
      this.httpsServer.removeAllListeners();
      this.httpsServer = undefined;
      this.log.debug('Frontend https server closed successfully');
    }

    // Remove listeners from the express app
    if (this.expressApp) {
      this.expressApp.removeAllListeners();
      this.expressApp = undefined;
      this.log.debug('Frontend app closed successfully');
    }

    // Close the WebSocket server
    if (this.webSocketServer) {
      // Close all active connections
      this.webSocketServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close();
        }
      });
      this.webSocketServer.close((error) => {
        if (error) {
          this.log.error(`Error closing WebSocket server: ${error}`);
        } else {
          this.log.debug('WebSocket server closed successfully');
        }
      });
      this.webSocketServer = undefined;
    }
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
   * @returns {Promise<object>} A promise that resolve in the api settings object.
   */
  private async getApiSettings() {
    const { lastCpuUsage } = await import('./cli.js');

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
    this.matterbridge.matterbridgeInformation.loggerLevel = this.matterbridge.log.logLevel;
    this.matterbridge.matterbridgeInformation.matterLoggerLevel = Logger.defaultLogLevel;
    this.matterbridge.matterbridgeInformation.mattermdnsinterface = this.matterbridge.mdnsInterface;
    this.matterbridge.matterbridgeInformation.matteripv4address = this.matterbridge.ipv4address;
    this.matterbridge.matterbridgeInformation.matteripv6address = this.matterbridge.ipv6address;
    this.matterbridge.matterbridgeInformation.matterPort = (await this.matterbridge.nodeContext?.get<number>('matterport', 5540)) ?? 5540;
    this.matterbridge.matterbridgeInformation.matterDiscriminator = await this.matterbridge.nodeContext?.get<number>('matterdiscriminator');
    this.matterbridge.matterbridgeInformation.matterPasscode = await this.matterbridge.nodeContext?.get<number>('matterpasscode');
    this.matterbridge.matterbridgeInformation.matterbridgePaired = this.matterbridge.matterbridgePaired;
    this.matterbridge.matterbridgeInformation.matterbridgeQrPairingCode = this.matterbridge.matterbridgeQrPairingCode;
    this.matterbridge.matterbridgeInformation.matterbridgeManualPairingCode = this.matterbridge.matterbridgeManualPairingCode;
    this.matterbridge.matterbridgeInformation.matterbridgeFabricInformations = this.matterbridge.matterbridgeFabricInformations;
    this.matterbridge.matterbridgeInformation.matterbridgeSessionInformations = this.matterbridge.matterbridgeSessionInformations;
    this.matterbridge.matterbridgeInformation.profile = this.matterbridge.profile;
    return { systemInformation: this.matterbridge.systemInformation, matterbridgeInformation: this.matterbridge.matterbridgeInformation };
  }

  /**
   * Retrieves the reachable attribute.
   * @param {MatterbridgeDevice} device - The MatterbridgeDevice object.
   * @returns {boolean} The reachable attribute.
   */
  private getReachability(device: MatterbridgeEndpoint): boolean {
    if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return false;

    if (device.hasClusterServer(BridgedDeviceBasicInformation.Cluster.id)) return device.getAttribute(BridgedDeviceBasicInformation.Cluster.id, 'reachable') as boolean;
    if (this.matterbridge.bridgeMode === 'childbridge') return true;
    return false;
  }

  /**
   * Retrieves the cluster text description from a given device.
   * @param {MatterbridgeDevice} device - The MatterbridgeDevice object.
   * @returns {string} The attributes description of the cluster servers in the device.
   */
  private getClusterTextFromDevice(device: MatterbridgeEndpoint): string {
    if (!device.lifecycle.isReady || device.construction.status !== Lifecycle.Status.Active) return '';

    const getAttribute = (device: MatterbridgeEndpoint, cluster: string, attribute: string) => {
      let value = undefined;
      Object.entries(device.state)
        .filter(([clusterName]) => clusterName.toLowerCase() === cluster.toLowerCase())
        .forEach(([, clusterAttributes]) => {
          Object.entries(clusterAttributes)
            .filter(([attributeName]) => attributeName.toLowerCase() === attribute.toLowerCase())
            .forEach(([, attributeValue]) => {
              value = attributeValue;
            });
        });
      if (value === undefined) this.log.error(`Cluster ${cluster} or attribute ${attribute} not found in device ${device.deviceName}`);
      return value as unknown;
    };

    const getUserLabel = (device: MatterbridgeEndpoint) => {
      const labelList = getAttribute(device, 'userLabel', 'labelList') as { label: string; value: string }[];
      if (!labelList) return;
      const composed = labelList.find((entry) => entry.label === 'composed');
      if (composed) return 'Composed: ' + composed.value;
      else return '';
    };

    const getFixedLabel = (device: MatterbridgeEndpoint) => {
      const labelList = getAttribute(device, 'fixedLabel', 'labelList') as { label: string; value: string }[];
      if (!labelList) return;
      const composed = labelList.find((entry) => entry.label === 'composed');
      if (composed) return 'Composed: ' + composed.value;
      else return '';
    };

    let attributes = '';

    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.log(`${device.deviceName} => Cluster: ${clusterName}-${clusterId} Attribute: ${attributeName}-${attributeId} Value(${typeof attributeValue}): ${attributeValue}`);
      if (typeof attributeValue === 'undefined') return;
      if (clusterName === 'onOff' && attributeName === 'onOff') attributes += `OnOff: ${attributeValue} `;
      if (clusterName === 'switch' && attributeName === 'currentPosition') attributes += `Position: ${attributeValue} `;
      if (clusterName === 'windowCovering' && attributeName === 'currentPositionLiftPercent100ths' && isValidNumber(attributeValue, 0, 10000)) attributes += `Cover position: ${attributeValue / 100}% `;
      if (clusterName === 'doorLock' && attributeName === 'lockState') attributes += `State: ${attributeValue === 1 ? 'Locked' : 'Not locked'} `;
      if (clusterName === 'thermostat' && attributeName === 'localTemperature' && isValidNumber(attributeValue)) attributes += `Temperature: ${attributeValue / 100}°C `;
      if (clusterName === 'thermostat' && attributeName === 'occupiedHeatingSetpoint' && isValidNumber(attributeValue)) attributes += `Heat to: ${attributeValue / 100}°C `;
      if (clusterName === 'thermostat' && attributeName === 'occupiedCoolingSetpoint' && isValidNumber(attributeValue)) attributes += `Cool to: ${attributeValue / 100}°C `;

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
   * @returns {BaseRegisteredPlugin[]} An array of BaseRegisteredPlugin.
   */
  private getBaseRegisteredPlugins(): BaseRegisteredPlugin[] {
    const baseRegisteredPlugins: BaseRegisteredPlugin[] = [];
    for (const plugin of this.matterbridge.plugins) {
      baseRegisteredPlugins.push({
        path: plugin.path,
        type: plugin.type,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        latestVersion: plugin.latestVersion,
        locked: plugin.locked,
        error: plugin.error,
        enabled: plugin.enabled,
        loaded: plugin.loaded,
        started: plugin.started,
        configured: plugin.configured,
        paired: plugin.paired,
        fabricInformations: plugin.fabricInformations,
        sessionInformations: plugin.sessionInformations,
        registeredDevices: plugin.registeredDevices,
        addedDevices: plugin.addedDevices,
        qrPairingCode: plugin.qrPairingCode,
        manualPairingCode: plugin.manualPairingCode,
        configJson: plugin.configJson,
        schemaJson: plugin.schemaJson,
        hasWhiteList: plugin.configJson?.whiteList !== undefined,
        hasBlackList: plugin.configJson?.blackList !== undefined,
      });
    }
    return baseRegisteredPlugins;
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
        if (!isValidString(data.params.packageName, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter packageName in /api/install' }));
          return;
        }
        this.wssSendSnackbarMessage(`Installing package ${data.params.packageName}`);
        this.matterbridge
          .spawnCommand('npm', ['install', '-g', data.params.packageName, '--omit=dev', '--verbose'])
          .then((response) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response }));
            this.wssSendSnackbarMessage(`Installed package ${data.params.packageName}`);
            if (data.params.restart !== true) {
              this.wssSendSnackbarMessage(`Restart required`, 0);
            } else {
              if (this.matterbridge.restartMode !== '') {
                this.wssSendSnackbarMessage(`Restarting matterbridge...`, 0);
                this.matterbridge.shutdownProcess();
              } else this.wssSendSnackbarMessage(`Restart required`, 0);
            }
          })
          .catch((error) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: error instanceof Error ? error.message : error }));
            this.wssSendSnackbarMessage(`Package ${data.params.packageName} not installed`);
          });
        return;
      } else if (data.method === '/api/uninstall') {
        if (!isValidString(data.params.packageName, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter packageName in /api/uninstall' }));
          return;
        }
        this.wssSendSnackbarMessage(`Uninstalling package ${data.params.packageName}`);
        this.matterbridge
          .spawnCommand('npm', ['uninstall', '-g', data.params.packageName, '--verbose'])
          .then((response) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response }));
          })
          .catch((error) => {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: error instanceof Error ? error.message : error }));
            this.wssSendSnackbarMessage(`Uninstalled package ${data.params.packageName}`);
            this.wssSendSnackbarMessage(`Restart required`, 0);
          });
        return;
      } else if (data.method === '/api/shellysysupdate') {
        const { triggerShellySysUpdate } = await import('./shelly.js');
        triggerShellySysUpdate(this.matterbridge);
        return;
      } else if (data.method === '/api/shellymainupdate') {
        const { triggerShellyMainUpdate } = await import('./shelly.js');
        triggerShellyMainUpdate(this.matterbridge);
        return;
      } else if (data.method === '/api/shellycreatesystemlog') {
        const { createShellySystemLog } = await import('./shelly.js');
        createShellySystemLog(this.matterbridge);
        return;
      } else if (data.method === '/api/shellynetconfig') {
        this.log.debug('/api/shellynetconfig:', data.params);
        const { triggerShellyChangeIp: triggerShellyChangeNet } = await import('./shelly.js');
        triggerShellyChangeNet(this.matterbridge, data.params as { type: 'static' | 'dhcp'; ip: string; subnet: string; gateway: string; dns: string });
        return;
      } else if (data.method === '/api/reboot') {
        const { triggerShellyReboot } = await import('./shelly.js');
        triggerShellyReboot(this.matterbridge);
        return;
      } else if (data.method === '/api/restart') {
        this.wssSendSnackbarMessage(`Restarting matterbridge...`, 0);
        await this.matterbridge.restartProcess();
        return;
      } else if (data.method === '/api/shutdown') {
        this.wssSendSnackbarMessage(`Shutting down matterbridge...`, 0);
        await this.matterbridge.shutdownProcess();
        return;
      } else if (data.method === '/api/advertise') {
        const pairingCodes = await this.matterbridge.advertiseServerNode(this.matterbridge.serverNode);
        this.matterbridge.matterbridgeInformation.matterbridgeAdvertise = true;
        this.matterbridge.matterbridgeQrPairingCode = pairingCodes?.qrPairingCode;
        this.matterbridge.matterbridgeManualPairingCode = pairingCodes?.manualPairingCode;
        this.wssSendRefreshRequired('matterbridgeAdvertise');
        this.wssSendSnackbarMessage(`Started fabrics share`, 0);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: pairingCodes }));
        return;
      } else if (data.method === '/api/stopadvertise') {
        await this.matterbridge.stopAdvertiseServerNode(this.matterbridge.serverNode);
        this.matterbridge.matterbridgeInformation.matterbridgeAdvertise = false;
        this.wssSendRefreshRequired('matterbridgeAdvertise');
        this.wssSendSnackbarMessage(`Stopped fabrics share`, 0);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src }));
        return;
      } else if (data.method === '/api/settings') {
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: await this.getApiSettings() }));
        return;
      } else if (data.method === '/api/plugins') {
        const response = this.getBaseRegisteredPlugins();
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response }));
        return;
      } else if (data.method === '/api/devices') {
        const devices: ApiDevices[] = [];
        this.matterbridge.devices.forEach(async (device) => {
          // Filter by pluginName if provided
          if (data.params.pluginName && data.params.pluginName !== device.plugin) return;
          // Check if the device has the required properties
          if (!device.plugin || !device.name || !device.deviceName || !device.serialNumber || !device.uniqueId || !device.lifecycle.isReady) return;
          const cluster = this.getClusterTextFromDevice(device);
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
            cluster: cluster,
          });
        });
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, response: devices }));
        return;
      } else if (data.method === '/api/clusters') {
        if (!isValidString(data.params.plugin, 10)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter plugin in /api/clusters' }));
          return;
        }
        if (!isValidNumber(data.params.endpoint, 1)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter endpoint in /api/clusters' }));
          return;
        }

        const clusters: ApiClusters[] = [];
        let deviceName = '';
        let serialNumber = '';
        let deviceTypes: number[] = [];

        this.matterbridge.devices.forEach(async (device) => {
          if (data.params.plugin !== device.plugin) return;
          if (data.params.endpoint !== device.number) return;
          deviceName = device.deviceName ?? 'Unknown';
          serialNumber = device.serialNumber ?? 'Unknown';
          deviceTypes = [];

          const endpointServer = EndpointServer.forEndpoint(device);
          const clusterServers = endpointServer.getAllClusterServers();
          clusterServers.forEach((clusterServer) => {
            Object.entries(clusterServer.attributes).forEach(([key, value]) => {
              if (clusterServer.name === 'EveHistory') {
                if (['configDataGet', 'configDataSet', 'historyStatus', 'historyEntries', 'historyRequest', 'historySetTime', 'rLoc'].includes(key)) {
                  return;
                }
              }
              if (clusterServer.name === 'Descriptor' && key === 'deviceTypeList') {
                (value.getLocal() as { deviceType: number; revision: number }[]).forEach((deviceType) => {
                  deviceTypes.push(deviceType.deviceType);
                });
              }
              let attributeValue;
              let attributeLocalValue;
              try {
                if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                else attributeValue = value.getLocal().toString();
                attributeLocalValue = value.getLocal();
              } catch (error) {
                attributeValue = 'Fabric-Scoped';
                attributeLocalValue = 'Fabric-Scoped';
                this.log.debug(`GetLocal value ${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
              }
              clusters.push({
                endpoint: device.number ? device.number.toString() : '...',
                id: 'main',
                deviceTypes,
                clusterName: clusterServer.name,
                clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                attributeName: key,
                attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                attributeValue,
                attributeLocalValue,
              });
            });
          });
          endpointServer.getChildEndpoints().forEach((childEndpoint) => {
            deviceTypes = [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const name = (childEndpoint as any).endpoint?.id;
            const clusterServers = childEndpoint.getAllClusterServers();
            clusterServers.forEach((clusterServer) => {
              Object.entries(clusterServer.attributes).forEach(([key, value]) => {
                if (clusterServer.name === 'EveHistory') return;
                if (clusterServer.name === 'Descriptor' && key === 'deviceTypeList') {
                  (value.getLocal() as { deviceType: number; revision: number }[]).forEach((deviceType) => {
                    deviceTypes.push(deviceType.deviceType);
                  });
                }
                let attributeValue;
                let attributeLocalValue;
                try {
                  if (typeof value.getLocal() === 'object') attributeValue = stringify(value.getLocal());
                  else attributeValue = value.getLocal().toString();
                  attributeLocalValue = value.getLocal();
                } catch (error) {
                  attributeValue = 'Fabric-Scoped';
                  attributeLocalValue = 'Fabric-Scoped';
                  this.log.debug(`GetLocal error ${error} in clusterServer: ${clusterServer.name}(${clusterServer.id}) attribute: ${key}(${value.id})`);
                }
                clusters.push({
                  endpoint: childEndpoint.number ? childEndpoint.number.toString() : '...',
                  id: name,
                  deviceTypes,
                  clusterName: clusterServer.name,
                  clusterId: '0x' + clusterServer.id.toString(16).padStart(2, '0'),
                  attributeName: key,
                  attributeId: '0x' + value.id.toString(16).padStart(2, '0'),
                  attributeValue,
                  attributeLocalValue,
                });
              });
            });
          });
        });
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, plugin: data.params.plugin, deviceName, serialNumber, endpoint: data.params.endpoint, deviceTypes, response: clusters }));
        return;
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
        // const selectDeviceValues = plugin.platform?.selectDevice ? Array.from(plugin.platform.selectDevice.values()).sort((keyA, keyB) => keyA.name.localeCompare(keyB.name)) : [];
        const selectDeviceValues = plugin.platform?.getSelectDevices().sort((keyA, keyB) => keyA.name.localeCompare(keyB.name));
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, plugin: data.params.plugin, response: selectDeviceValues }));
        return;
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
        // const selectEntityValues = plugin.platform?.selectDevice ? Array.from(plugin.platform.selectEntity.values()).sort((keyA, keyB) => keyA.name.localeCompare(keyB.name)) : [];
        const selectEntityValues = plugin.platform?.getSelectEntities().sort((keyA, keyB) => keyA.name.localeCompare(keyB.name));
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, plugin: data.params.plugin, response: selectEntityValues }));
        return;
      } else if (data.method === '/api/command') {
        if (!isValidString(data.params.command, 5)) {
          client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Wrong parameter command in /api/command' }));
          return;
        }
        if (data.params.command === 'selectdevice' && isValidString(data.params.plugin, 10) && isValidString(data.params.serial, 1)) {
          const plugin = this.matterbridge.plugins.get(data.params.plugin);
          if (!plugin) {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/command' }));
            return;
          }
          const config = plugin.configJson;
          if (config) {
            if (config.postfix) {
              data.params.serial = data.params.serial.replace('-' + config.postfix, '');
            }
            // Add the serial to the whiteList if the whiteList exists and the serial is not already in it
            if (isValidArray(config.whiteList, 1)) {
              if (!config.whiteList.includes(data.params.serial)) {
                config.whiteList.push(data.params.serial);
              }
            }
            // Remove the serial from the blackList if the blackList exists and the serial is in it
            if (isValidArray(config.blackList, 1)) {
              if (config.blackList.includes(data.params.serial)) {
                config.blackList = config.blackList.filter((serial) => serial !== data.params.serial);
              }
            }
            if (plugin.platform) plugin.platform.config = config;
            await this.matterbridge.plugins.saveConfigFromPlugin(plugin);
            this.wssSendRestartRequired(false);
          }
        } else if (data.params.command === 'unselectdevice' && isValidString(data.params.plugin, 10) && isValidString(data.params.serial, 1)) {
          const plugin = this.matterbridge.plugins.get(data.params.plugin);
          if (!plugin) {
            client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Plugin not found in /api/command' }));
            return;
          }
          const config = plugin.configJson;
          if (config) {
            if (config.postfix) {
              data.params.serial = data.params.serial.replace('-' + config.postfix, '');
            }
            // Remove the serial from the whiteList if the whiteList exists and the serial is in it
            if (isValidArray(config.whiteList, 1)) {
              if (config.whiteList.includes(data.params.serial)) {
                config.whiteList = config.whiteList.filter((serial) => serial !== data.params.serial);
              }
            }
            // Add the serial to the blackList
            if (isValidArray(config.blackList)) {
              if (!config.blackList.includes(data.params.serial)) {
                config.blackList.push(data.params.serial);
              }
            }
            if (plugin.platform) plugin.platform.config = config;
            await this.matterbridge.plugins.saveConfigFromPlugin(plugin);
            this.wssSendRestartRequired(false);
          }
        }
      } else {
        this.log.error(`Invalid method from websocket client: ${debugStringify(data)}`);
        client.send(JSON.stringify({ id: data.id, method: data.method, src: 'Matterbridge', dst: data.src, error: 'Invalid method' }));
        return;
      }
    } catch (error) {
      this.log.error(`Error parsing message "${message}" from websocket client:`, error instanceof Error ? error.message : error);
      return;
    }
  }

  /**
   * Sends a WebSocket message to all connected clients. The function is called by AnsiLogger.setGlobalCallback.
   *
   * @param {string} level - The logger level of the message: debug info notice warn error fatal...
   * @param {string} time - The time string of the message
   * @param {string} name - The logger name of the message
   * @param {string} message - The content of the message.
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
   * Sends a memory update message to all connected clients.
   *
   */
  wssSendCpuUpdate(cpuUsage: number) {
    this.log.debug('Sending a cpu update message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_CPU_UPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'cpu_update', params: { cpuUsage } }));
      }
    });
  }

  /**
   * Sends a cpu update message to all connected clients.
   *
   */
  wssSendMemoryUpdate(totalMemory: string, freeMemory: string, rss: string, heapTotal: string, heapUsed: string, external: string, arrayBuffers: string) {
    this.log.debug('Sending a memory update message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_MEMORY_UPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'memory_update', params: { totalMemory, freeMemory, rss, heapTotal, heapUsed, external, arrayBuffers } }));
      }
    });
  }

  /**
   * Sends a memory update message to all connected clients.
   *
   */
  wssSendUptimeUpdate(systemUptime: string, processUptime: string) {
    this.log.debug('Sending a uptime update message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_UPTIME_UPDATE, src: 'Matterbridge', dst: 'Frontend', method: 'uptime_update', params: { systemUptime, processUptime } }));
      }
    });
  }

  /**
   * Sends a cpu update message to all connected clients.
   * @param {string} message - The message to send.
   * @param {number} timeout - The timeout in seconds for the snackbar message.
   * @param {'info' | 'warning' | 'error' | 'success'} severity - The severity of the snackbar message (default info).
   *
   */
  wssSendSnackbarMessage(message: string, timeout = 5, severity: 'info' | 'warning' | 'error' | 'success' = 'info') {
    this.log.debug('Sending a snackbar message to all connected clients');
    // Send the message to all connected clients
    this.webSocketServer?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ id: WS_ID_SNACKBAR, src: 'Matterbridge', dst: 'Frontend', method: 'memory_update', params: { message, timeout, severity } }));
      }
    });
  }

  /**
   * Sends a message to all connected clients.
   * @param {number} id - The message id.
   * @param {string} method - The message method.
   * @param {Record<string, string | number | boolean>} params - The message parameters.
   *
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
