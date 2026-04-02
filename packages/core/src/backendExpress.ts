/**
 * This file contains the class BackendExpress.
 *
 * @file backendExpress.ts
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
import os from 'node:os';
import path from 'node:path';

// @matterbridge
import { BroadcastServer } from '@matterbridge/thread';
import {
  MATTER_LOGGER_FILE,
  MATTER_STORAGE_DIR,
  MATTERBRIDGE_BACKUP_FILE,
  MATTERBRIDGE_DIAGNOSTIC_FILE,
  MATTERBRIDGE_HISTORY_FILE,
  MATTERBRIDGE_LOGGER_FILE,
  MATTERBRIDGE_PLUGIN_CONFIG_FILE,
  MATTERBRIDGE_PLUGIN_STORAGE_FILE,
  NODE_STORAGE_DIR,
  plg,
  type SharedMatterbridge,
  type WorkerMessage,
} from '@matterbridge/types';
import { hasParameter } from '@matterbridge/utils/cli';
import { getErrorMessage } from '@matterbridge/utils/error';
import { formatBytes } from '@matterbridge/utils/format';
// Express
import express from 'express';
// Multer
import multer from 'multer';
// AnsiLogger
import { AnsiLogger, er, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';

// matterbridge
import type { Frontend } from './frontend.js';

// istanbul ignore next 2 lines --loader flag is only used for development and testing, not in production
// eslint-disable-next-line no-console
if (hasParameter('loader')) console.log('\u001B[32mBackendExpress loaded.\u001B[40;0m');

/**
 * Class representing an Express application for frontend connections.
 *
 * This class manages the Express application that allows communication between the backend and the frontend.
 */
export class BackendExpress {
  private debug: boolean;
  private verbose: boolean;
  private expressApp: express.Application | undefined;
  private log: AnsiLogger;
  private backend: Frontend;
  private matterbridge: SharedMatterbridge;
  private readonly server: BroadcastServer;

  /**
   * Create a new BackendExpress instance.
   *
   * @param {SharedMatterbridge} matterbridge - The shared Matterbridge instance.
   * @param {Frontend} backend - The backend instance to which this Express server will be connected.
   */
  constructor(matterbridge: SharedMatterbridge, backend: Frontend) {
    // istanbul ignore next 2 lines - debug/verbose flags are only used for development and testing, not in production
    this.debug = hasParameter('debug') || hasParameter('verbose') || hasParameter('debug-frontend') || hasParameter('verbose-frontend');
    this.verbose = hasParameter('verbose') || hasParameter('verbose-frontend');
    this.backend = backend;
    this.matterbridge = matterbridge;
    // istanbul ignore next - debug/verbose flags are only used for development and testing, not in production
    this.log = new AnsiLogger({
      logName: 'BackendExpress',
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
   * Validates the incoming request for protected endpoints by checking the client's IP address against the list of authorized clients.
   * If the client's IP address is not in the list, it responds with a 401 Unauthorized status and an error message.
   *
   * @param {import('express').Request} req - The incoming request object.
   * @param {import('express').Response} res - The response object.
   * @returns {boolean} - Returns true if the request is authorized, false otherwise.
   */
  private validateReq(req: express.Request<unknown, unknown, unknown, { password?: string }>, res: express.Response): boolean {
    if (req.ip && !this.backend.authClients.has(req.ip)) {
      this.log.warn(`Warning blocked unauthorized access request ${req.originalUrl ?? req.url} from ${req.ip}`);
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  /**
   *  Start the express application.
   *
   * @returns {Promise<express.Application | undefined>} The express application instance if it was started successfully, otherwise undefined.
   */
  async start(): Promise<express.Application | undefined> {
    this.log.debug('Starting express application...');

    // Initialize multer with the upload directory
    const uploadDir = path.join(this.matterbridge.matterbridgeDirectory, 'uploads'); // Is created by matterbridge initialize
    const upload = multer({ dest: uploadDir });

    // Create the express app that serves the frontend
    this.expressApp = express();

    // Log all requests to the server for debugging
    // istanbul ignore else
    if (this.verbose) {
      this.expressApp.use((req, res, next) => {
        this.log.debug(`Received request on expressApp: ${req.method} ${req.url}`);
        next();
      });
    }

    // Serve static files from 'frontend/build' directory
    this.expressApp.use(express.static(path.join(this.matterbridge.rootDirectory, 'apps', 'frontend', 'build')));

    // Endpoint to validate login code
    // curl -X POST "http://localhost:8283/api/login" -H "Content-Type: application/json" -d "{\"password\":\"Here\"}"
    this.expressApp.post('/api/login', express.json(), async (req, res) => {
      const { password } = req.body;
      this.log.debug(`The frontend sent /api/login with password ${password ? '[redacted]' : '(empty)'}`);
      if (this.backend.storedPassword === '' || password === this.backend.storedPassword) {
        this.log.debug('/api/login password valid');
        res.json({ valid: true });
        // istanbul ignore else
        if (req.ip) this.backend.authClients.add(req.ip);
      } else {
        this.log.warn('/api/login error wrong password');
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
        rss: formatBytes(memoryUsageRaw.rss),
        heapTotal: formatBytes(memoryUsageRaw.heapTotal),
        heapUsed: formatBytes(memoryUsageRaw.heapUsed),
        external: formatBytes(memoryUsageRaw.external),
        arrayBuffers: formatBytes(memoryUsageRaw.arrayBuffers),
      };

      // V8 heap statistics
      const { default: v8 } = await import('node:v8');
      const heapStatsRaw = v8.getHeapStatistics();
      const heapSpacesRaw = v8.getHeapSpaceStatistics();

      // Format heapStats
      const heapStats = Object.fromEntries(Object.entries(heapStatsRaw).map(([key, value]) => [key, formatBytes(value as number)]));

      // Format heapSpaces
      const heapSpaces = heapSpacesRaw.map((space) => ({
        ...space,
        space_size: formatBytes(space.space_size),
        space_used_size: formatBytes(space.space_used_size),
        space_available_size: formatBytes(space.space_available_size),
        physical_space_size: formatBytes(space.physical_space_size),
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

    // Endpoint to provide settings (debug only reasons - not used in production)
    this.expressApp.get('/api/settings', async (req, res) => {
      this.log.debug('The frontend sent /api/settings');
      if (!this.validateReq(req, res)) return;
      res.json(this.backend.getApiSettings());
    });

    // Endpoint to provide plugins (debug only reasons - not used in production)
    this.expressApp.get('/api/plugins', async (req, res) => {
      this.log.debug('The frontend sent /api/plugins');
      if (!this.validateReq(req, res)) return;
      res.json(this.backend.getApiPlugins());
    });

    // Endpoint to provide devices (debug only reasons - not used in production)
    this.expressApp.get('/api/devices', async (req, res) => {
      this.log.debug('The frontend sent /api/devices');
      if (!this.validateReq(req, res)) return;
      res.json(this.backend.getApiDevices());
    });

    // Endpoint to view the matterbridge log
    this.expressApp.get('/api/view-mblog', async (req, res) => {
      this.log.debug('The frontend sent /api/view-mblog');
      if (!this.validateReq(req, res)) return;
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), 'utf8');
        res.type('text/plain; charset=utf-8');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading matterbridge log file ${MATTERBRIDGE_LOGGER_FILE}: ${getErrorMessage(error)}`);
        res.status(500).send('Error reading matterbridge log file. Please enable the matterbridge log on file in the settings.');
      }
    });

    // Endpoint to download the matterbridge log
    this.expressApp.get('/api/download-mblog', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-mblog ${path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE)}`);
      if (!this.validateReq(req, res)) return;
      const fs = await import('node:fs');
      try {
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTERBRIDGE_LOGGER_FILE), data, 'utf-8');
      } catch (error) {
        await fs.promises.writeFile(
          path.join(os.tmpdir(), MATTERBRIDGE_LOGGER_FILE),
          'Enable the matterbridge log on file in the settings to download the matterbridge log.',
          'utf-8',
        );
        this.log.debug(`Error in /api/download-mblog: ${getErrorMessage(error)}`);
      }
      res.type('text/plain; charset=utf-8');
      res.download(path.join(os.tmpdir(), MATTERBRIDGE_LOGGER_FILE), 'matterbridge.log', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${MATTERBRIDGE_LOGGER_FILE}: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the matterbridge log file');
        } else {
          this.log.debug(`Matterbridge log file ${MATTERBRIDGE_LOGGER_FILE} downloaded successfully`);
        }
      });
    });

    // Endpoint to view the matter.js log
    this.expressApp.get('/api/view-mjlog', async (req, res) => {
      this.log.debug('The frontend sent /api/view-mjlog');
      if (!this.validateReq(req, res)) return;
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), 'utf8');
        res.type('text/plain; charset=utf-8');
        res.send(data);
      } catch (error) {
        this.log.error(`Error reading matter log file ${MATTER_LOGGER_FILE}: ${getErrorMessage(error)}`);
        res.status(500).send('Error reading matter log file. Please enable the matter log on file in the settings.');
      }
    });

    // Endpoint to download the matter log
    this.expressApp.get('/api/download-mjlog', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-mjlog ${path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE)}`);
      if (!this.validateReq(req, res)) return;
      const fs = await import('node:fs');
      try {
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTER_LOGGER_FILE), data, 'utf-8');
      } catch (error) {
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTER_LOGGER_FILE), 'Enable the matter log on file in the settings to download the matter log.', 'utf-8');
        this.log.debug(`Error in /api/download-mjlog: ${getErrorMessage(error)}`);
      }
      res.type('text/plain; charset=utf-8');
      res.download(path.join(os.tmpdir(), MATTER_LOGGER_FILE), 'matter.log', (error) => {
        if (error) {
          this.log.error(`Error downloading log file ${MATTER_LOGGER_FILE}: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the matter log file');
        } else {
          this.log.debug(`Matter log file ${MATTER_LOGGER_FILE} downloaded successfully`);
        }
      });
    });

    // Endpoint to view the diagnostic.log
    this.expressApp.get('/api/view-diagnostic', async (req, res) => {
      this.log.debug('The frontend sent /api/view-diagnostic');
      if (!this.validateReq(req, res)) return;
      await this.backend.generateDiagnostic();
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_DIAGNOSTIC_FILE), 'utf8');
        res.type('text/plain; charset=utf-8');
        res.send(data.slice(29));
      } catch (error) {
        this.log.error(`Error reading diagnostic log file ${MATTERBRIDGE_DIAGNOSTIC_FILE}: ${getErrorMessage(error)}`);
        res.status(500).send('Error reading diagnostic log file.');
      }
    });

    // Endpoint to download the diagnostic.log
    this.expressApp.get('/api/download-diagnostic', async (req, res) => {
      this.log.debug(`The frontend sent /api/download-diagnostic`);
      if (!this.validateReq(req, res)) return;
      await this.backend.generateDiagnostic();
      try {
        const fs = await import('node:fs');
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_DIAGNOSTIC_FILE), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_DIAGNOSTIC_FILE), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTERBRIDGE_DIAGNOSTIC_FILE), data, 'utf-8');
      } catch (error) {
        // istanbul ignore next
        this.log.debug(`Error in /api/download-diagnostic: ${getErrorMessage(error)}`);
      }
      res.type('text/plain; charset=utf-8');
      res.download(path.join(os.tmpdir(), MATTERBRIDGE_DIAGNOSTIC_FILE), MATTERBRIDGE_DIAGNOSTIC_FILE, (error) => {
        if (error) {
          this.log.error(`Error downloading file ${MATTERBRIDGE_DIAGNOSTIC_FILE}: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the diagnostic log file');
        } else {
          this.log.debug(`Diagnostic log file ${MATTERBRIDGE_DIAGNOSTIC_FILE} downloaded successfully`);
        }
      });
    });

    // Endpoint to view the history.html
    this.expressApp.get('/api/viewhistory', async (req, res) => {
      this.log.debug('The frontend sent /api/viewhistory');
      if (!this.validateReq(req, res)) return;
      try {
        const fs = await import('node:fs');
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_HISTORY_FILE), 'utf8');
        res.type('text/html; charset=utf-8');
        res.send(data);
      } catch (error) {
        this.log.error(`Error in /api/viewhistory reading history file ${MATTERBRIDGE_HISTORY_FILE}: ${getErrorMessage(error)}`);
        res.status(500).send('Error reading history file.');
      }
    });

    // Endpoint to download the history.html
    this.expressApp.get('/api/downloadhistory', async (req, res) => {
      this.log.debug(`The frontend sent /api/downloadhistory`);
      if (!this.validateReq(req, res)) return;
      try {
        const fs = await import('node:fs');
        await fs.promises.access(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_HISTORY_FILE), fs.constants.F_OK);
        const data = await fs.promises.readFile(path.join(this.matterbridge.matterbridgeDirectory, MATTERBRIDGE_HISTORY_FILE), 'utf8');
        await fs.promises.writeFile(path.join(os.tmpdir(), MATTERBRIDGE_HISTORY_FILE), data, 'utf-8');
        res.type('text/html; charset=utf-8');
        res.download(path.join(os.tmpdir(), MATTERBRIDGE_HISTORY_FILE), MATTERBRIDGE_HISTORY_FILE, (error) => {
          if (error) {
            this.log.error(`Error in /api/downloadhistory downloading history file ${MATTERBRIDGE_HISTORY_FILE}: ${getErrorMessage(error)}`);
            res.status(500).send('Error downloading history file');
          } else {
            this.log.debug(`History file ${MATTERBRIDGE_HISTORY_FILE} downloaded successfully`);
          }
        });
      } catch (error) {
        this.log.error(`Error in /api/downloadhistory reading history file ${MATTERBRIDGE_HISTORY_FILE}: ${getErrorMessage(error)}`);
        res.status(500).send('Error reading history file.');
      }
    });

    // Endpoint to download the matterbridge backup (created with the backup command)
    this.expressApp.get('/api/download-backup', async (req, res) => {
      this.log.debug('The frontend sent /api/download-backup');
      if (!this.validateReq(req, res)) return;
      res.download(path.join(os.tmpdir(), MATTERBRIDGE_BACKUP_FILE), MATTERBRIDGE_BACKUP_FILE, (error) => {
        this.backend.wssSendCloseSnackbarMessage('Creating matterbridge backup...');
        if (error) {
          this.log.error(`Error downloading file ${MATTERBRIDGE_BACKUP_FILE}: ${getErrorMessage(error)}`);
          res.status(500).send(`Error downloading the matterbridge backup file.`);
        } else {
          this.log.debug(`Backup ${MATTERBRIDGE_BACKUP_FILE} downloaded successfully`);
        }
      });
    });

    // Endpoint to download the matterbridge storage directory
    this.expressApp.get('/api/download-mbstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mbstorage');
      if (!this.validateReq(req, res)) return;
      res.download(path.join(os.tmpdir(), `matterbridge.${NODE_STORAGE_DIR}.zip`), `matterbridge.${NODE_STORAGE_DIR}.zip`, (error) => {
        this.backend.wssSendCloseSnackbarMessage('Creating matterbridge storage backup...');
        if (error) {
          this.log.error(`Error downloading file ${`matterbridge.${NODE_STORAGE_DIR}.zip`}: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the matterbridge storage file');
        } else {
          this.log.debug(`Matterbridge storage matterbridge.${NODE_STORAGE_DIR}.zip downloaded successfully`);
        }
      });
    });

    // Endpoint to download the matter storage directory
    this.expressApp.get('/api/download-mjstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-mjstorage');
      if (!this.validateReq(req, res)) return;
      res.download(path.join(os.tmpdir(), `matterbridge.${MATTER_STORAGE_DIR}.zip`), `matterbridge.${MATTER_STORAGE_DIR}.zip`, (error) => {
        this.backend.wssSendCloseSnackbarMessage('Creating matter storage backup...');
        if (error) {
          this.log.error(`Error downloading the matter storage matterbridge.${MATTER_STORAGE_DIR}.zip: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the matter storage file');
        } else {
          this.log.debug(`Matter storage matterbridge.${MATTER_STORAGE_DIR}.zip downloaded successfully`);
        }
      });
    });

    // Endpoint to download the matterbridge plugin directory
    this.expressApp.get('/api/download-pluginstorage', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginstorage');
      if (!this.validateReq(req, res)) return;
      res.download(path.join(os.tmpdir(), MATTERBRIDGE_PLUGIN_STORAGE_FILE), MATTERBRIDGE_PLUGIN_STORAGE_FILE, (error) => {
        this.backend.wssSendCloseSnackbarMessage('Creating plugin backup...');
        if (error) {
          this.log.error(`Error downloading file ${MATTERBRIDGE_PLUGIN_STORAGE_FILE}: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the matterbridge plugin storage file');
        } else {
          this.log.debug(`Plugin storage ${MATTERBRIDGE_PLUGIN_STORAGE_FILE} downloaded successfully`);
        }
      });
    });

    // Endpoint to download the matterbridge plugin config files
    this.expressApp.get('/api/download-pluginconfig', async (req, res) => {
      this.log.debug('The frontend sent /api/download-pluginconfig');
      if (!this.validateReq(req, res)) return;
      res.download(path.join(os.tmpdir(), MATTERBRIDGE_PLUGIN_CONFIG_FILE), MATTERBRIDGE_PLUGIN_CONFIG_FILE, (error) => {
        this.backend.wssSendCloseSnackbarMessage('Creating config backup...');
        if (error) {
          this.log.error(`Error downloading file ${MATTERBRIDGE_PLUGIN_CONFIG_FILE}: ${getErrorMessage(error)}`);
          res.status(500).send('Error downloading the matterbridge plugin config file');
        } else {
          this.log.debug(`Plugin config ${MATTERBRIDGE_PLUGIN_CONFIG_FILE} downloaded successfully`);
        }
      });
    });

    // Endpoint to upload a package
    this.expressApp.post('/api/uploadpackage', upload.single('file'), async (req, res) => {
      this.log.debug('The frontend sent /api/uploadpackage');
      if (!this.validateReq(req, res)) return;
      const { filename } = req.body;
      const file = req.file;

      if (!file || !filename) {
        this.log.error(`uploadpackage: invalid request: file and filename are required`);
        res.status(400).send('Invalid request: file and filename are required');
        return;
      }
      this.backend.wssSendSnackbarMessage(`Installing package ${filename}...`, 0);

      // Define the path where the plugin file will be saved
      const filePath = path.join(this.matterbridge.matterbridgeDirectory, 'uploads', filename);

      try {
        // Move the uploaded file to the specified path
        const fs = await import('node:fs');
        await fs.promises.rename(file.path, filePath);
        this.log.info(`File ${plg}${filename}${nf} uploaded successfully`);

        // Install the plugin package
        if (filename.endsWith('.tgz')) {
          this.server.request({
            type: 'manager_run',
            src: 'frontend',
            dst: 'manager',
            params: {
              name: 'SpawnCommand',
              workerData: {
                threadName: 'SpawnCommand',
                command: 'npm',
                args: ['install', '-g', filePath, '--omit=dev', '--verbose'],
                packageCommand: 'install',
                packageName: filename,
              },
            },
          });
        }
        res.send(`File ${filename} uploaded successfully`);
      } catch (err) {
        this.log.error(`Error uploading or installing plugin package file ${plg}${filename}${er}:`, err);
        this.backend.wssSendCloseSnackbarMessage(`Installing package ${filename}...`);
        this.backend.wssSendSnackbarMessage(`Error uploading or installing plugin package ${filename}`, 10, 'error');
        res.status(500).send(`Error uploading or installing plugin package ${filename}`);
      }
    });

    // Fallback for routing (must be the last route)
    this.expressApp.use((req, res) => {
      const filePath = path.resolve(this.matterbridge.rootDirectory, 'apps', 'frontend', 'build');
      this.log.debug(`The frontend sent ${req.url} method ${req.method}: sending index.html in ${filePath} as fallback`);
      res.sendFile('index.html', { root: filePath });
    });

    this.log.debug('Express application started');
    return this.expressApp;
  }

  /**
   * Stop the express application.
   *
   * @returns {Promise<express.Application | undefined>} The express application instance if it was running, otherwise undefined.
   */
  async stop(): Promise<express.Application | undefined> {
    // Remove listeners from the express app
    if (this.expressApp) {
      this.log.debug('Stopping express application...');
      this.expressApp.removeAllListeners();
      this.expressApp = undefined;
      this.log.debug('Frontend app closed successfully');
      this.log.debug('Express application stopped');
    } else {
      this.log.debug('Express application is not running');
    }

    return this.expressApp;
  }
}
