/**
 * @description This file contains the Jest helpers.
 * @file src/helpers.test.ts
 * @author Luca Liguori
 * @created 2025-09-03
 * @version 1.0.14
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

import { rmSync } from 'node:fs';
import { inspect } from 'node:util';
import path from 'node:path';

import type { jest } from '@jest/globals';
// Imports from node-ansi-logger
import { AnsiLogger, er, LogLevel, rs, TimestampFormat, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
// Imports from @matter
import { LogLevel as MatterLogLevel, LogFormat as MatterLogFormat, Environment, Lifecycle } from '@matter/general';
import { Endpoint, ServerNode, ServerNodeStore } from '@matter/node';
import { DeviceTypeId, VendorId } from '@matter/types/datatype';
import { AggregatorEndpoint } from '@matter/node/endpoints';
import { MdnsService } from '@matter/main/protocol';
import { NodeStorageManager } from 'node-persist-manager';

// Imports from Matterbridge
import { Matterbridge } from '../matterbridge.js';
import { MatterbridgePlatform } from '../matterbridgePlatform.js';
import { MATTER_STORAGE_NAME, NODE_STORAGE_DIR } from '../matterbridgeTypes.js';
import { bridge } from '../matterbridgeDeviceTypes.js';
import { DeviceManager } from '../deviceManager.js';
import { PluginManager } from '../pluginManager.js';
import { Frontend } from '../frontend.js';
import { BroadcastServer } from '../broadcastServer.js';

/* Imports from a plugin
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { DeviceTypeId, Endpoint, Environment, MdnsService, ServerNode, ServerNodeStore, VendorId, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Lifecycle } from 'matterbridge/matter';
import { RootEndpoint, AggregatorEndpoint } from 'matterbridge/matter/endpoints';
import { MATTER_STORAGE_NAME, Matterbridge, MatterbridgePlatform } from 'matterbridge';
*/

export const originalProcessArgv = Object.freeze([...process.argv]);
export const originalProcessEnv = Object.freeze({ ...process.env } as Record<string, string | undefined>);

export let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
export let loggerDebugSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.debug>;
export let loggerInfoSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.info>;
export let loggerNoticeSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.notice>;
export let loggerWarnSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.warn>;
export let loggerErrorSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.error>;
export let loggerFatalSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.fatal>;

export let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
export let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
export let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
export let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
export let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;

// Spy on Matterbridge methods
export let addBridgedEndpointSpy: jest.SpiedFunction<typeof Matterbridge.prototype.addBridgedEndpoint>;
export let removeBridgedEndpointSpy: jest.SpiedFunction<typeof Matterbridge.prototype.removeBridgedEndpoint>;
export let removeAllBridgedEndpointsSpy: jest.SpiedFunction<typeof Matterbridge.prototype.removeAllBridgedEndpoints>;
export let addVirtualEndpointSpy: jest.SpiedFunction<typeof Matterbridge.prototype.addVirtualEndpoint>;

// Spy on PluginManager methods
export let installPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.install>;
export let uninstallPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.uninstall>;
export let addPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.add>;
export let loadPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.load>;
export let startPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.start>;
export let configurePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.configure>;
export let shutdownPluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.shutdown>;
export let removePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.remove>;
export let enablePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.enable>;
export let disablePluginSpy: jest.SpiedFunction<typeof PluginManager.prototype.disable>;

// Spy on Frontend methods
export let wssSendSnackbarMessageSpy: jest.SpiedFunction<typeof Frontend.prototype.wssSendSnackbarMessage>;
export let wssSendCloseSnackbarMessageSpy: jest.SpiedFunction<typeof Frontend.prototype.wssSendCloseSnackbarMessage>;
export let wssSendUpdateRequiredSpy: jest.SpiedFunction<typeof Frontend.prototype.wssSendUpdateRequired>;
export let wssSendRefreshRequiredSpy: jest.SpiedFunction<typeof Frontend.prototype.wssSendRefreshRequired>;
export let wssSendRestartRequiredSpy: jest.SpiedFunction<typeof Frontend.prototype.wssSendRestartRequired>;
export let wssSendRestartNotRequiredSpy: jest.SpiedFunction<typeof Frontend.prototype.wssSendRestartNotRequired>;

// Spy on BroadcastServer methods
export let broadcastServerIsWorkerRequestSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.isWorkerRequest>;
export let broadcastServerIsWorkerResponseSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.isWorkerResponse>;
export let broadcastServerRequestSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.request>;
export let broadcastServerRespondSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.respond>;
export let broadcastServerFetchSpy: jest.SpiedFunction<typeof BroadcastServer.prototype.fetch>;
export let broadcastMessageHandlerSpy: jest.SpiedFunction<(this: BroadcastServer, event: MessageEvent) => void>;

export let NAME: string;
export let HOMEDIR: string;
export let matterbridge: Matterbridge;
export let frontend: Frontend;
export let plugins: PluginManager;
export let devices: DeviceManager;

export let environment: Environment;
export let server: ServerNode<ServerNode.RootEndpoint>;
export let aggregator: Endpoint<AggregatorEndpoint>;
export let log: AnsiLogger;

/**
 * Setup the Jest environment:
 * - it will remove any existing home directory
 * - setup the spies for logging
 *
 * @param {string} name The name of the test suite.
 * @param {boolean} debug If true, the logging is not mocked.
 *
 * @example
 * ```typescript
 * import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, loggerLogSpy, setDebug, setupTest } from './jestutils/jestHelpers.js';
 *
 * // Setup the test environment
 * setupTest(NAME, false);
 *
 * ```
 */
export async function setupTest(name: string, debug: boolean = false): Promise<void> {
  expect(name).toBeDefined();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThanOrEqual(4);
  NAME = name;
  HOMEDIR = path.join('jest', name);

  // Cleanup any existing home directory
  rmSync(HOMEDIR, { recursive: true, force: true });

  const { jest } = await import('@jest/globals');
  loggerDebugSpy = jest.spyOn(AnsiLogger.prototype, 'debug');
  loggerInfoSpy = jest.spyOn(AnsiLogger.prototype, 'info');
  loggerNoticeSpy = jest.spyOn(AnsiLogger.prototype, 'notice');
  loggerWarnSpy = jest.spyOn(AnsiLogger.prototype, 'warn');
  loggerErrorSpy = jest.spyOn(AnsiLogger.prototype, 'error');
  loggerFatalSpy = jest.spyOn(AnsiLogger.prototype, 'fatal');
  if (debug) {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  }

  addBridgedEndpointSpy = jest.spyOn(Matterbridge.prototype, 'addBridgedEndpoint');
  removeBridgedEndpointSpy = jest.spyOn(Matterbridge.prototype, 'removeBridgedEndpoint');
  removeAllBridgedEndpointsSpy = jest.spyOn(Matterbridge.prototype, 'removeAllBridgedEndpoints');
  addVirtualEndpointSpy = jest.spyOn(Matterbridge.prototype, 'addVirtualEndpoint');

  installPluginSpy = jest.spyOn(PluginManager.prototype, 'install');
  uninstallPluginSpy = jest.spyOn(PluginManager.prototype, 'uninstall');
  addPluginSpy = jest.spyOn(PluginManager.prototype, 'add');
  loadPluginSpy = jest.spyOn(PluginManager.prototype, 'load');
  startPluginSpy = jest.spyOn(PluginManager.prototype, 'start');
  configurePluginSpy = jest.spyOn(PluginManager.prototype, 'configure');
  shutdownPluginSpy = jest.spyOn(PluginManager.prototype, 'shutdown');
  removePluginSpy = jest.spyOn(PluginManager.prototype, 'remove');
  enablePluginSpy = jest.spyOn(PluginManager.prototype, 'enable');
  disablePluginSpy = jest.spyOn(PluginManager.prototype, 'disable');

  wssSendSnackbarMessageSpy = jest.spyOn(Frontend.prototype, 'wssSendSnackbarMessage');
  wssSendCloseSnackbarMessageSpy = jest.spyOn(Frontend.prototype, 'wssSendCloseSnackbarMessage');
  wssSendUpdateRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendUpdateRequired');
  wssSendRefreshRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendRefreshRequired');
  wssSendRestartRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendRestartRequired');
  wssSendRestartNotRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendRestartNotRequired');

  broadcastServerIsWorkerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest');
  broadcastServerIsWorkerResponseSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse');
  broadcastServerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'request');
  broadcastServerRespondSpy = jest.spyOn(BroadcastServer.prototype, 'respond');
  broadcastServerFetchSpy = jest.spyOn(BroadcastServer.prototype, 'fetch');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  broadcastMessageHandlerSpy = jest.spyOn(BroadcastServer.prototype as any, 'broadcastMessageHandler');
}

/**
 * Set or unset the debug mode.
 *
 * @param {boolean} debug If true, the logging is not mocked.
 * @returns {Promise<void>} A promise that resolves when the debug mode is set.
 *
 * @example
 * ```typescript
 * // Set the debug mode in test environment
 * setDebug(true);
 * ```
 *
 * ```typescript
 * // Reset the debug mode in test environment
 * setDebug(false);
 * ```
 */
export async function setDebug(debug: boolean): Promise<void> {
  const { jest } = await import('@jest/globals');
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  }
}

/**
 * Start a Matterbridge instance for testing.
 *
 * @param {('bridge' | 'childbridge' | 'controller' | '')} bridgeMode The bridge mode to start the Matterbridge instance in.
 * @param {number} frontendPort The frontend port number.
 * @param {number} matterPort The matter port number.
 * @param {number} passcode The passcode number.
 * @param {number} discriminator The discriminator number.
 * @param {number} pluginSize The expected number of plugins.
 * @param {number} devicesSize The expected number of devices.
 * @returns {Promise<Matterbridge>} The Matterbridge instance.
 */
export async function startMatterbridge(
  bridgeMode: 'bridge' | 'childbridge' | 'controller' | '' = 'bridge',
  frontendPort: number = 8283,
  matterPort: number = 5540,
  passcode: number = 20252026,
  discriminator: number = 3840,
  pluginSize: number = 0,
  devicesSize: number = 0,
): Promise<Matterbridge> {
  // Set the environment variables
  process.env['MATTERBRIDGE_START_MATTER_INTERVAL_MS'] = '100';
  process.env['MATTERBRIDGE_PAUSE_MATTER_INTERVAL_MS'] = '100';
  // Setup the process arguments
  process.argv.length = 0;
  process.argv.push(
    ...originalProcessArgv,
    '-novirtual',
    '-debug',
    '-verbose',
    '-logger',
    'debug',
    '-matterlogger',
    'debug',
    bridgeMode === '' ? '-test' : '-' + bridgeMode,
    '-homedir',
    HOMEDIR,
    '-frontend',
    frontendPort.toString(),
    '-port',
    matterPort.toString(),
    '-passcode',
    passcode.toString(),
    '-discriminator',
    discriminator.toString(),
  );

  // Load Matterbridge instance and initialize it
  matterbridge = await Matterbridge.loadInstance(true);
  expect(matterbridge).toBeDefined();
  expect(matterbridge.profile).toBeUndefined();
  expect(matterbridge.bridgeMode).toBe(bridgeMode);

  // Get the frontend, plugins and devices
  frontend = matterbridge.frontend;
  plugins = matterbridge.plugins;
  devices = matterbridge.devices;

  // @ts-expect-error - access to private member for testing
  expect(matterbridge.initialized).toBeTruthy();
  expect(matterbridge.log).toBeDefined();
  expect(matterbridge.rootDirectory).toBe(path.resolve('./'));
  expect(matterbridge.homeDirectory).toBe(path.join('jest', NAME));
  expect(matterbridge.matterbridgeDirectory).toBe(path.join('jest', NAME, '.matterbridge'));
  expect(matterbridge.matterbridgePluginDirectory).toBe(path.join('jest', NAME, 'Matterbridge'));
  expect(matterbridge.matterbridgeCertDirectory).toBe(path.join('jest', NAME, '.mattercert'));

  expect(plugins).toBeDefined();
  expect(plugins.size).toBe(pluginSize);

  expect(devices).toBeDefined();
  expect(devices.size).toBe(devicesSize);

  expect(frontend).toBeDefined();
  // @ts-expect-error - access to private member for testing
  expect(frontend.listening).toBeTruthy();
  // @ts-expect-error - access to private member for testing
  expect(frontend.httpServer).toBeDefined();
  // @ts-expect-error - access to private member for testing
  expect(frontend.httpsServer).toBeUndefined();
  // @ts-expect-error - access to private member for testing
  expect(frontend.expressApp).toBeDefined();
  // @ts-expect-error - access to private member for testing
  expect(frontend.webSocketServer).toBeDefined();

  expect(matterbridge.nodeStorage).toBeDefined();
  expect(matterbridge.nodeContext).toBeDefined();

  expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_NAME));

  expect(matterbridge.matterStorageService).toBeDefined();
  expect(matterbridge.matterStorageManager).toBeDefined();
  expect(matterbridge.matterbridgeContext).toBeDefined();
  expect(matterbridge.controllerContext).toBeUndefined();

  if (bridgeMode === 'bridge') {
    expect(matterbridge.serverNode).toBeDefined();
    expect(matterbridge.aggregatorNode).toBeDefined();
  }

  expect(matterbridge.mdnsInterface).toBe(undefined);
  expect(matterbridge.port).toBe(matterPort + (bridgeMode === 'bridge' ? 1 : 0));
  expect(matterbridge.passcode).toBe(passcode + (bridgeMode === 'bridge' ? 1 : 0));
  expect(matterbridge.discriminator).toBe(discriminator + (bridgeMode === 'bridge' ? 1 : 0));

  if (bridgeMode === 'bridge') {
    const started = new Promise<void>((resolve) => {
      matterbridge.once('bridge_started', () => {
        resolve();
      });
    });
    const online = new Promise<void>((resolve) => {
      matterbridge.once('online', (name) => {
        if (name === 'Matterbridge') resolve();
      });
    });
    await Promise.all([started, online]);
  } else if (bridgeMode === 'childbridge') {
    await new Promise<void>((resolve) => {
      matterbridge.once('childbridge_started', () => {
        resolve();
      });
    });
  }

  expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:${frontendPort}${UNDERLINEOFF}${rs}`);
  if (bridgeMode === 'bridge') {
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in bridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in bridge mode`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Matterbridge bridge started successfully`);
  } else if (bridgeMode === 'childbridge') {
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Starting start matter interval in childbridge mode...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cleared startMatterInterval interval in childbridge mode`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Matterbridge childbridge started successfully`);
  }

  return matterbridge;
}

/**
 * Stop the active Matterbridge instance.
 *
 * @param {cleanupPause} cleanupPause The pause duration before cleanup. Default is 10 ms.
 * @param {destroyPause} destroyPause The pause duration before destruction. Default is 250 ms.
 */
export async function stopMatterbridge(cleanupPause: number = 10, destroyPause: number = 250) {
  await destroyMatterbridgeEnvironment(cleanupPause, destroyPause);
}

/**
 * Create a Matterbridge instance for testing without initializing it.
 *
 * @param {string} name - Name for the environment (jest/name).
 * @returns {Promise<Matterbridge>} The Matterbridge instance.
 *
 * @example
 * ```typescript
 * // Create Matterbridge environment
 * await createMatterbridgeEnvironment(NAME);
 * await startMatterbridgeEnvironment(MATTER_PORT);
 * ```
 */
export async function createMatterbridgeEnvironment(name: string): Promise<Matterbridge> {
  // Create a MatterbridgeEdge instance
  matterbridge = await Matterbridge.loadInstance(false);
  expect(matterbridge).toBeDefined();
  expect(matterbridge).toBeInstanceOf(Matterbridge);
  matterbridge.matterbridgeVersion = '3.4.0';
  matterbridge.bridgeMode = 'bridge';
  matterbridge.rootDirectory = path.join('jest', name);
  matterbridge.homeDirectory = path.join('jest', name);
  matterbridge.matterbridgeDirectory = path.join('jest', name, '.matterbridge');
  matterbridge.matterbridgePluginDirectory = path.join('jest', name, 'Matterbridge');
  matterbridge.matterbridgeCertDirectory = path.join('jest', name, '.mattercert');
  matterbridge.log.logLevel = LogLevel.DEBUG;
  log = new AnsiLogger({ logName: 'Plugin platform', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  // Setup matter environment
  // @ts-expect-error - access to private member for testing
  matterbridge.environment = createTestEnvironment(name);
  // @ts-expect-error - access to private member for testing
  expect(matterbridge.environment).toBeDefined();
  // @ts-expect-error - access to private member for testing
  expect(matterbridge.environment).toBeInstanceOf(Environment);
  return matterbridge;
}

/**
 * Start the matterbridge environment.
 * Only node storage, matter storage and the server and aggregator nodes are started.
 *
 * @param {number} port The matter server port.
 * @returns {Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]>} The started server and aggregator.
 *
 * @example
 * ```typescript
 * // Create Matterbridge environment
 * await createMatterbridgeEnvironment(NAME);
 * await startMatterbridgeEnvironment(MATTER_PORT);
 * ```
 */
export async function startMatterbridgeEnvironment(port: number = 5540): Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]> {
  // Create the node storage
  matterbridge.nodeStorage = new NodeStorageManager({ dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR), writeQueue: false, expiredInterval: undefined, logging: false });
  matterbridge.nodeContext = await matterbridge.nodeStorage.createStorage('matterbridge');

  // Create the matter storage
  // @ts-expect-error - access to private member for testing
  await matterbridge.startMatterStorage();
  expect(matterbridge.matterStorageService).toBeDefined();
  expect(matterbridge.matterStorageManager).toBeDefined();
  expect(matterbridge.matterbridgeContext).toBeDefined();

  // @ts-expect-error - access to private member for testing
  server = await matterbridge.createServerNode(matterbridge.matterbridgeContext, port);
  expect(server).toBeDefined();
  expect(server).toBeDefined();
  expect(server.lifecycle.isReady).toBeTruthy();
  matterbridge.serverNode = server;

  // @ts-expect-error - access to private member for testing
  aggregator = await matterbridge.createAggregatorNode(matterbridge.matterbridgeContext);
  expect(aggregator).toBeDefined();
  matterbridge.aggregatorNode = aggregator;

  expect(await server.add(aggregator)).toBeDefined();
  expect(server.parts.has(aggregator.id)).toBeTruthy();
  expect(server.parts.has(aggregator)).toBeTruthy();
  expect(aggregator.lifecycle.isReady).toBeTruthy();

  // Wait for the server to be online
  expect(server.lifecycle.isOnline).toBeFalsy();
  await new Promise<void>((resolve) => {
    server.lifecycle.online.on(async () => {
      resolve();
    });
    server.start();
  });

  // Check if the server is online
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeTruthy();
  expect(server.lifecycle.isCommissioned).toBeFalsy();
  expect(server.lifecycle.isPartsReady).toBeTruthy();
  expect(server.lifecycle.hasId).toBeTruthy();
  expect(server.lifecycle.hasNumber).toBeTruthy();
  expect(aggregator.lifecycle.isReady).toBeTruthy();
  expect(aggregator.lifecycle.isInstalled).toBeTruthy();
  expect(aggregator.lifecycle.isPartsReady).toBeTruthy();
  expect(aggregator.lifecycle.hasId).toBeTruthy();
  expect(aggregator.lifecycle.hasNumber).toBeTruthy();

  // Ensure the queue is empty and pause
  await flushAsync();

  return [server, aggregator];
}

/**
 * Add a matterbridge platform for testing.
 *
 * @param {MatterbridgePlatform} platform The platform to add.
 * @param {string} [name] Optional name of the platform.
 *
 * @example
 * ```typescript
 * platform = new Platform(matterbridge, log, config);
 * // Add the platform to the Matterbridge environment
 * addMatterbridgePlatform(platform);
 * ```
 */
export function addMatterbridgePlatform(platform: MatterbridgePlatform, name?: string): void {
  if (name) platform.config.name = name;
  expect(platform).toBeDefined();
  expect(platform.config.name).toBeDefined();
  expect(platform.config.type).toBeDefined();
  expect(platform.type).toBeDefined();
  expect(platform.config.version).toBeDefined();
  expect(platform.version).toBeDefined();
  expect(platform.config.debug).toBeDefined();
  expect(platform.config.unregisterOnShutdown).toBeDefined();

  // @ts-expect-error accessing private member for testing
  matterbridge.plugins._plugins.set(platform.config.name, {
    name: platform.config.name,
    path: './',
    type: platform.type,
    version: platform.version,
    description: 'Plugin ' + platform.config.name,
    author: 'Unknown',
    enabled: true,
  });
  platform['name'] = platform.config.name;
}

/**
 * Stop the matterbridge environment
 *
 * @example
 * ```typescript
 * // Destroy Matterbridge environment
 * await stopMatterbridgeEnvironment();
 * await destroyMatterbridgeEnvironment();
 * ```
 */
export async function stopMatterbridgeEnvironment(): Promise<void> {
  expect(matterbridge).toBeDefined();
  expect(server).toBeDefined();
  expect(aggregator).toBeDefined();

  // Flush any pending endpoint number persistence
  await flushAllEndpointNumberPersistence(server);

  // Ensure all endpoint numbers are persisted
  await assertAllEndpointNumbersPersisted(server);

  // Close the server node
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeTruthy();
  await server.close();
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeFalsy();

  // Stop the matter storage
  // @ts-expect-error - access to private member for testing
  await matterbridge.stopMatterStorage();
  expect(matterbridge.matterStorageService).not.toBeDefined();
  expect(matterbridge.matterStorageManager).not.toBeDefined();
  expect(matterbridge.matterbridgeContext).not.toBeDefined();

  // Stop the node storage
  await matterbridge.nodeContext?.close();
  await matterbridge.nodeStorage?.close();

  // Ensure the queue is empty and pause
  await flushAsync();
}

/**
 * Destroy the matterbridge environment
 *
 * @param {number} cleanupPause The timeout for the destroy operation (default 10ms).
 * @param {number} destroyPause The pause duration after cleanup before destroying the instance (default 250ms).
 *
 * @example
 * ```typescript
 * // Destroy Matterbridge environment
 * await stopMatterbridgeEnvironment();
 * await destroyMatterbridgeEnvironment();
 * ```
 */
export async function destroyMatterbridgeEnvironment(cleanupPause: number = 10, destroyPause: number = 250): Promise<void> {
  // Destroy a matterbridge instance
  await destroyInstance(matterbridge, cleanupPause, destroyPause);

  // Close the mDNS service
  await closeMdnsInstance(matterbridge);

  // Reset the singleton instance
  // @ts-expect-error - accessing private member for testing
  Matterbridge.instance = undefined;
}

/**
 * Destroy a matterbridge instance
 *
 * @param {Matterbridge} matterbridge The matterbridge instance to destroy.
 * @param {number} cleanupPause The pause duration to wait for the cleanup to complete in milliseconds (default 10ms).
 * @param {number} destroyPause The pause duration to wait after cleanup before destroying the instance in milliseconds (default 250ms).
 */
export async function destroyInstance(matterbridge: Matterbridge, cleanupPause: number = 10, destroyPause: number = 250): Promise<void> {
  // Cleanup the Matterbridge instance
  // @ts-expect-error - accessing private member for testing
  await matterbridge.cleanup('destroying instance...', false, cleanupPause);

  // Pause before destroying the instance
  if (destroyPause > 0) await flushAsync(undefined, undefined, destroyPause);
}

/**
 * Close the mDNS instance in the matterbridge environment.
 *
 * @param {Matterbridge} matterbridge The matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the mDNS instance is closed.
 */
export async function closeMdnsInstance(matterbridge: Matterbridge): Promise<void> {
  // TODO: matter.js 0.16.0 - provide close method to close the mDNS service
  // @ts-expect-error - accessing private member for testing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mdns = matterbridge.environment.get(MdnsService) as any;
  if (mdns && mdns[Symbol.asyncDispose] && typeof mdns[Symbol.asyncDispose] === 'function') await mdns[Symbol.asyncDispose]();
  if (mdns && mdns.close && typeof mdns.close === 'function') await mdns.close();
}

/**
 * Create a matter test environment for testing:
 * - it will remove any existing home directory
 * - setup the matter environment with name, debug logging and ANSI format
 * - setup the mDNS service in the environment
 *
 * @param {string} name - Name for the environment (jest/name).
 * @returns {Environment} - The default matter environment.
 */
export function createTestEnvironment(name: string): Environment {
  expect(name).toBeDefined();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThanOrEqual(4); // avoid accidental deletion of short paths like "/" or "C:\"

  // Cleanup any existing home directory
  rmSync(path.join('jest', name), { recursive: true, force: true });

  // Setup the matter environment
  environment = Environment.default;
  environment.vars.set('log.level', MatterLogLevel.DEBUG);
  environment.vars.set('log.format', MatterLogFormat.ANSI);
  environment.vars.set('path.root', path.join('jest', name, '.matterbridge', MATTER_STORAGE_NAME));
  environment.vars.set('runtime.signals', false);
  environment.vars.set('runtime.exitcode', false);

  // Setup the mDNS service in the environment
  new MdnsService(environment);
  // await environment.get(MdnsService)?.construction.ready;

  return environment;
}

/**
 * Destroy the matter test environment by closing the mDNS service.
 *
 * @returns {Promise<void>} A promise that resolves when the test environment is destroyed.
 */
export async function destroyTestEnvironment(): Promise<void> {
  // stop the mDNS service
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mdns = environment.get(MdnsService) as any;
  if (mdns && typeof mdns[Symbol.asyncDispose] === 'function') await mdns[Symbol.asyncDispose]();
  if (mdns && typeof mdns.close === 'function') await mdns.close();
}

/**
 * Advance the Node.js event loop deterministically to allow chained asynchronous work (Promises scheduled in
 * microtasks and follow‑up macrotasks) to complete inside tests without adding arbitrary long timeouts.
 *
 * NOTE: This does not guarantee OS level network IO completion—only JavaScript task queue progression inside the
 *       current process.
 *
 * @param {number} ticks       Number of macrotask (setImmediate) turns to yield (default 3).
 * @param {number} microTurns  Number of microtask drains (Promise.resolve chains) after macrotask yielding (default 10).
 * @param {number} pause       Final timer delay in ms; set 0 to disable (default 250ms).
 * @returns {Promise<void>}        Resolves after the requested event loop advancement has completed.
 */
export async function flushAsync(ticks: number = 3, microTurns: number = 10, pause: number = 250): Promise<void> {
  for (let i = 0; i < ticks; i++) await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < microTurns; i++) await Promise.resolve();
  if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
}

/**
 * Summarize live libuv handles/requests inside a process.
 *
 * @param {AnsiLogger} log - Logger to use for output
 *
 * @returns {number} - The total number of active handles and requests
 */
export function logKeepAlives(log?: AnsiLogger): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handles = (process as any)._getActiveHandles?.() ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requests = (process as any)._getActiveRequests?.() ?? [];

  // istanbul ignore next
  const fmtHandle = (h: unknown, i: number) => {
    const ctor = (h as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown';
    // Timer-like?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasRef = typeof (h as any)?.hasRef === 'function' ? (h as any).hasRef() : undefined;
    // MessagePort?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isPort = (h as any)?.constructor?.name?.includes('MessagePort');
    // Socket/Server?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fd = (h as any)?.fd ?? (h as any)?._handle?.fd;
    return { i, type: ctor, hasRef, isPort, fd };
  };

  // istanbul ignore next
  const fmtReq = (r: unknown, i: number) => {
    const ctor = (r as { constructor?: { name?: string } })?.constructor?.name ?? 'Unknown';
    return { i, type: ctor };
  };

  const summary = {
    handles: handles.map(fmtHandle),
    requests: requests.map(fmtReq),
  };

  // istanbul ignore next if
  if (summary.handles.length === 0 && summary.requests.length === 0) {
    log?.debug('KeepAlive: no active handles or requests.');
  } else {
    log?.debug(`KeepAlive:${rs}\n${inspect(summary, { depth: 5, colors: true })}`);
    if (!log) {
      process.stdout.write(`KeepAlive:\n${inspect(summary, { depth: 5, colors: true })}\n`);
    }
  }
  return summary.handles.length + summary.requests.length;
}

/**
 * Flush (await) the lazy endpoint number persistence mechanism used by matter.js.
 *
 * Background:
 *  assignNumber() batches persistence (store.saveNumber + updating __nextNumber__) via an internal promise (#numbersPersisted).
 *  Calling endpointStores.close() waits for the current batch only. If new endpoints were added in the same macrotask
 *  cycle additional micro/macro turns might be needed to ensure the batch started. We defensively yield macrotasks
 *  (setImmediate) and then await close() multiple rounds.
 *
 * @param {ServerNode} targetServer  The server whose endpoint numbering persistence should be flushed.
 * @param {number} rounds Number of macrotask + close cycles to run (2 is usually sufficient; 1 often works).
 * @returns {Promise<void>}          Resolves when pending number persistence batches have completed.
 */
export async function flushAllEndpointNumberPersistence(targetServer: ServerNode, rounds: number = 2): Promise<void> {
  const nodeStore = targetServer.env.get(ServerNodeStore);
  for (let i = 0; i < rounds; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    await nodeStore.endpointStores.close();
  }
}

/**
 * Collect all endpoints in the server endpoint tree (root -> descendants).
 *
 * @param {Endpoint} root  Root endpoint (typically the ServerNode root endpoint cast as Endpoint).
 * @returns {Endpoint[]}   Flat array including the root and every descendant once.
 */
function collectAllEndpoints(root: Endpoint): Endpoint[] {
  const list: Endpoint[] = [];
  const walk = (ep: Endpoint) => {
    list.push(ep);
    if (ep.parts) {
      for (const child of ep.parts as unknown as Endpoint[]) {
        walk(child);
      }
    }
  };
  walk(root);
  return list;
}

/**
 * Assert that every endpoint attached to the server has an assigned and (batch-)persisted endpoint number.
 *
 * This waits for any outstanding number persistence batch (endpointStores.close()), then traverses the endpoint
 * graph and asserts:
 *  - Root endpoint: number is 0 (allowing undefined to coerce to 0 via nullish coalescing check).
 *  - All other endpoints: number > 0.
 *
 * @param {ServerNode} targetServer The server whose endpoint numbers are verified.
 * @returns {Promise<void>}         Resolves when assertions complete.
 */
export async function assertAllEndpointNumbersPersisted(targetServer: ServerNode): Promise<number> {
  const nodeStore = targetServer.env.get(ServerNodeStore);
  // Ensure any pending persistence finished (flush any in-flight batch promise)
  await nodeStore.endpointStores.close();
  const all = collectAllEndpoints(targetServer as unknown as Endpoint);
  for (const ep of all) {
    const store = nodeStore.storeForEndpoint(ep);
    if (ep.maybeNumber === 0) {
      expect(store.number ?? 0).toBe(0); // root
    } else {
      expect(store.number).toBeGreaterThan(0);
    }
  }
  return all.length;
}

/**
 * Close the server node stores to flush any pending endpoint number persistence.
 *
 * @param {ServerNode} targetServer The server whose endpoint stores should be closed.
 * @returns {Promise<void>} Resolves when the stores have been closed.
 */
export async function closeServerNodeStores(targetServer?: ServerNode): Promise<void> {
  // Close endpoint stores to avoid number persistence issues
  if (!targetServer) targetServer = server;
  await targetServer?.env.get(ServerNodeStore)?.endpointStores.close();
}

/**
 * Start a matter server node for testing.
 *
 * @param {string} name Name of the server (used for logging and product description).
 * @param {number} port TCP port to listen on.
 * @param {DeviceTypeId} deviceType Device type identifier for the server node.
 * @returns {Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]>} Resolves to an array containing the created ServerNode and its AggregatorNode.
 */
export async function startServerNode(name: string, port: number, deviceType: DeviceTypeId = bridge.code): Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]> {
  const { randomBytes } = await import('node:crypto');
  const random = randomBytes(8).toString('hex');

  // Create the server node
  server = await ServerNode.create({
    id: name + 'ServerNode',

    // Provide the environment
    environment,

    // Provide Node announcement settings
    productDescription: {
      name: name + 'ServerNode',
      deviceType: DeviceTypeId(deviceType),
      vendorId: VendorId(0xfff1),
      productId: 0x8000,
    },

    // Provide defaults for the BasicInformation cluster on the Root endpoint
    basicInformation: {
      vendorId: VendorId(0xfff1),
      vendorName: 'Matterbridge',
      productId: 0x8000,
      productName: 'Matterbridge ' + name,
      nodeLabel: name + 'ServerNode',
      hardwareVersion: 1,
      softwareVersion: 1,
      reachable: true,
      serialNumber: 'SN' + random,
      uniqueId: 'UI' + random,
    },

    // Provide Network relevant configuration like the port
    network: {
      listeningAddressIpv4: undefined,
      listeningAddressIpv6: undefined,
      port,
    },

    // Provide the certificate for the device
    operationalCredentials: {
      certification: undefined,
    },
  });
  expect(server).toBeDefined();
  expect(server.lifecycle.isReady).toBeTruthy();

  // Create the aggregator node
  aggregator = new Endpoint(AggregatorEndpoint, {
    id: name + 'AggregatorNode',
  });
  expect(aggregator).toBeDefined();

  // Add the aggregator to the server
  await server.add(aggregator);
  expect(server.parts.has(aggregator.id)).toBeTruthy();
  expect(server.parts.has(aggregator)).toBeTruthy();
  expect(aggregator.lifecycle.isReady).toBeTruthy();

  // Run the server
  expect(server.lifecycle.isOnline).toBeFalsy();

  // Wait for the server to be online
  await new Promise<void>((resolve) => {
    server.lifecycle.online.on(async () => {
      resolve();
    });
    server.start();
  });

  // Check if the server is online
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeTruthy();
  expect(server.lifecycle.isCommissioned).toBeFalsy();
  expect(server.lifecycle.isPartsReady).toBeTruthy();
  expect(server.lifecycle.hasId).toBeTruthy();
  expect(server.lifecycle.hasNumber).toBeTruthy();
  expect(aggregator.lifecycle.isReady).toBeTruthy();
  expect(aggregator.lifecycle.isInstalled).toBeTruthy();
  expect(aggregator.lifecycle.isPartsReady).toBeTruthy();
  expect(aggregator.lifecycle.hasId).toBeTruthy();
  expect(aggregator.lifecycle.hasNumber).toBeTruthy();

  // Ensure the queue is empty and pause 250ms
  await flushAsync();

  return [server, aggregator];
}

/**
 * Stop a matter server node.
 *
 * @param {ServerNode<ServerNode.RootEndpoint>} server The server to stop.
 * @returns {Promise<void>} Resolves when the server has stopped.
 */
export async function stopServerNode(server: ServerNode<ServerNode.RootEndpoint>): Promise<void> {
  // Flush any pending endpoint number persistence
  await flushAllEndpointNumberPersistence(server);

  // Ensure all endpoint numbers are persisted
  await assertAllEndpointNumbersPersisted(server);

  // Stop the server
  expect(server).toBeDefined();
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeTruthy();
  await server.close();
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeFalsy();

  // stop the mDNS service
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mdns = environment.get(MdnsService) as any;
  if (mdns && typeof mdns[Symbol.asyncDispose] === 'function') await mdns[Symbol.asyncDispose]();
  if (mdns && typeof mdns.close === 'function') await mdns.close();

  // Ensure the queue is empty and pause 100ms
  await flushAsync();
}

/**
 * Add a device (endpoint) to a matter server node or an aggregator.
 *
 * @param {ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>} owner The server or aggregator to add the device to.
 * @param {Endpoint} device The device to add.
 * @param {number} pause The pause time in milliseconds after addition (default 10ms).
 * @returns {Promise<void>} Resolves when the device has been added and is ready.
 */
export async function addDevice(owner: ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>, device: Endpoint, pause: number = 10): Promise<boolean> {
  expect(owner).toBeDefined();
  expect(device).toBeDefined();
  expect(owner.lifecycle.isReady).toBeTruthy();
  expect(owner.construction.status).toBe(Lifecycle.Status.Active);
  expect(owner.lifecycle.isPartsReady).toBeTruthy();

  // istanbul ignore next
  try {
    await owner.add(device);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorInspect = inspect(error, { depth: 10 });
    process.stderr.write(`${er}Error adding device ${device.maybeId}.${device.maybeNumber}: ${errorMessage}${rs}\nStack: ${errorInspect}\n`);
    return false;
  }
  expect(owner.parts.has(device)).toBeTruthy();
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  expect(device.lifecycle.isReady).toBeTruthy();
  expect(device.lifecycle.isInstalled).toBeTruthy();
  expect(device.lifecycle.hasId).toBeTruthy();
  expect(device.lifecycle.hasNumber).toBeTruthy();
  expect(device.construction.status).toBe(Lifecycle.Status.Active);
  await flushAsync(undefined, undefined, pause);
  return true;
}

/**
 * Delete a device (endpoint) from a matter server node or an aggregator.
 *
 * @param {ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>} owner The server or aggregator to remove the device from.
 * @param {Endpoint} device The device to remove.
 * @param {number} pause The pause time in milliseconds after deletion (default 10ms).
 * @returns {Promise<void>} Resolves when the device has been removed and is no longer ready.
 */
export async function deleteDevice(owner: ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>, device: Endpoint, pause: number = 10): Promise<boolean> {
  expect(owner).toBeDefined();
  expect(device).toBeDefined();
  expect(owner.lifecycle.isReady).toBeTruthy();
  expect(owner.construction.status).toBe(Lifecycle.Status.Active);
  expect(owner.lifecycle.isPartsReady).toBeTruthy();

  // istanbul ignore next
  try {
    await device.delete();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorInspect = inspect(error, { depth: 10 });
    process.stderr.write(`${er}Error deleting device ${device.maybeId}.${device.maybeNumber}: ${errorMessage}${rs}\nStack: ${errorInspect}\n`);
    return false;
  }
  expect(owner.parts.has(device)).toBeFalsy();
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  expect(device.lifecycle.isReady).toBeFalsy();
  expect(device.lifecycle.isInstalled).toBeFalsy();
  expect(device.lifecycle.hasId).toBeTruthy();
  expect(device.lifecycle.hasNumber).toBeTruthy();
  expect(device.construction.status).toBe(Lifecycle.Status.Destroyed);
  await flushAsync(undefined, undefined, pause);
  return true;
}
