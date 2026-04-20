/**
 * @description This file contains the Jest helpers.
 * @file src/jestHelpers.test.ts
 * @author Luca Liguori
 * @created 2025-09-03
 * @version 1.0.15
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 *  This file contains the Jest helpers for testing the Matterbridge core package.
 *
 *  1) Matterbridge with initialized Matterbridge instance with matterbridge, frontend, devices and plugins.
 *
 *  ```typescript
 *  beforeAll(async () => {
 *    // Start matterbridge instance
 *    await startMatterbridge('bridge', FRONTEND_PORT, MATTER_PORT, PASSCODE, DISCRIMINATOR);
 *  });
 *
 *  afterAll(async () => {
 *    // Stop matterbridge instance
 *    await stopMatterbridge();
 *  });
 *  ```
 *
 *  2) Matterbridge with not initialized Matterbridge instance.
 *
 *  ```typescript
 *  const MATTER_CREATE_ONLY = true;
 *
 *  beforeAll(async () => {
 *    // Create Matterbridge environment
 *    await createMatterbridgeEnvironment();
 *    [server, aggregator] = await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
 *  }, 30000);
 *
 *  afterAll(async () => {
 *    // Destroy Matterbridge environment
 *    await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
 *    await destroyMatterbridgeEnvironment();
 *    // Restore all mocks
 *    jest.restoreAllMocks();
 *  }, 30000);
 *  ```
 *
 */

import path from 'node:path';

// @matter
import { Environment, RuntimeService } from '@matter/general';
import { Endpoint, ServerNode } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints';
import { MdnsService } from '@matter/protocol';
// @matterbridge
import { MATTER_STORAGE_DIR, NODE_STORAGE_DIR } from '@matterbridge/types';
import { LogLevel, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { NodeStorageManager } from 'node-persist-manager';

import type { DeviceManager } from '../deviceManager.js';
import type { Frontend } from '../frontend.js';
import { Matterbridge } from '../matterbridge.js';
import type { MatterbridgePlatform } from '../matterbridgePlatform.js';
import type { PluginManager } from '../pluginManager.js';
import { flushAsync } from './jestFlushAsync.js';
import { assertAllEndpointNumbersPersisted, createTestEnvironment, flushAllEndpointNumberPersistence } from './jestMatterTest.js';
import { HOMEDIR, loggerLogSpy, originalProcessArgv } from './jestSetupTest.js';

let server: ServerNode<ServerNode.RootEndpoint>;
let aggregator: Endpoint<AggregatorEndpoint>;

export let matterbridge: Matterbridge;
export let frontend: Frontend;
export let plugins: PluginManager;
export let devices: DeviceManager;

/**
 * Create and start a fully initialized Matterbridge instance for testing.
 *
 * @param {('bridge' | 'childbridge' | 'controller' | '')} bridgeMode The bridge mode to start the Matterbridge instance in.
 * @param {number} frontendPort The frontend port number.
 * @param {number} matterPort The matter port number.
 * @param {number} passcode The passcode number.
 * @param {number} discriminator The discriminator number.
 * @param {number} pluginSize The expected number of plugins.
 * @param {number} devicesSize The expected number of devices.
 * @returns {Promise<Matterbridge>} The Matterbridge instance.
 *
 * @example
 * ```typescript
 * // Create and start a fully initialized Matterbridge instance for testing.
 * await startMatterbridge();
 * ```
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
    '--novirtual',
    '--debug',
    '--verbose',
    '--logger',
    'debug',
    '--matterlogger',
    'debug',
    bridgeMode === '' ? '--test' : '--' + bridgeMode,
    '--homedir',
    HOMEDIR,
    '--frontend',
    frontendPort.toString(),
    '--port',
    matterPort.toString(),
    '--passcode',
    passcode.toString(),
    '--discriminator',
    discriminator.toString(),
  );

  // Load Matterbridge instance and initialize it
  // @ts-expect-error - access to private member for testing
  expect(Matterbridge.instance).toBeUndefined();
  matterbridge = await Matterbridge.loadInstance(true);
  // @ts-expect-error - access to private member for testing
  expect(matterbridge.environment).toBeDefined();

  // Clear the timeouts and intervals set by initialize to prevent them from running during tests
  expect((matterbridge as any).systemCheckTimeout).toBeDefined();
  expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
  expect((matterbridge as any).checkUpdateInterval).toBeDefined();
  clearTimeout((matterbridge as any).systemCheckTimeout);
  clearTimeout((matterbridge as any).checkUpdateTimeout);
  clearInterval((matterbridge as any).checkUpdateInterval);

  // Setup the mDNS service in the environment
  // @ts-expect-error - access to private member for testing
  new MdnsService(matterbridge.environment);

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
  expect(matterbridge.homeDirectory).toBe(path.join(HOMEDIR));
  expect(matterbridge.matterbridgeDirectory).toBe(path.join(HOMEDIR, '.matterbridge'));
  expect(matterbridge.matterbridgePluginDirectory).toBe(path.join(HOMEDIR, 'Matterbridge'));
  expect(matterbridge.matterbridgeCertDirectory).toBe(path.join(HOMEDIR, '.mattercert'));

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

  expect(Environment.default.vars.get('path.root')).toBe(path.join(matterbridge.matterbridgeDirectory, MATTER_STORAGE_DIR));

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

  expect(loggerLogSpy).toHaveBeenCalledWith(
    LogLevel.INFO,
    `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:${frontendPort}${UNDERLINEOFF}${rs}`,
  );
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
 * Stop the fully initialized Matterbridge instance.
 *
 * @param {cleanupPause} cleanupPause The pause duration before cleanup. Default is 10 ms.
 * @param {destroyPause} destroyPause The pause duration before destruction. Default is 250 ms.
 * @param {closeMdns} closeMdns Whether to close the mDNS service. Default is false.
 * @param {closeRuntime} closeRuntime Whether to close the runtime service. Default is false.
 *
 * @example
 * ```typescript
 * // Stop the fully initialized Matterbridge instance.
 * await stopMatterbridge();
 * ```
 */
export async function stopMatterbridge(cleanupPause: number = 10, destroyPause: number = 250, closeMdns: boolean = false, closeRuntime: boolean = false): Promise<void> {
  await destroyMatterbridgeEnvironment(cleanupPause, destroyPause, closeMdns, closeRuntime);
}

/**
 * Create a Matterbridge instance for testing without initializing it.
 *
 * @returns {Promise<Matterbridge>} The Matterbridge instance.
 *
 * @example
 * ```typescript
 * const NAME = 'Platform';
 * const MATTER_PORT = 5540;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Create Matterbridge environment
 * await createMatterbridgeEnvironment();
 * await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
 * ```
 */
export async function createMatterbridgeEnvironment(): Promise<Matterbridge> {
  // Create a MatterbridgeEdge instance
  matterbridge = await Matterbridge.loadInstance(false);
  expect(matterbridge).toBeDefined();
  expect(matterbridge).toBeInstanceOf(Matterbridge);
  matterbridge.matterbridgeVersion = '3.7.5';
  matterbridge.bridgeMode = 'bridge';
  matterbridge.rootDirectory = path.join(HOMEDIR);
  matterbridge.homeDirectory = path.join(HOMEDIR);
  matterbridge.matterbridgeDirectory = path.join(HOMEDIR, '.matterbridge');
  matterbridge.matterbridgePluginDirectory = path.join(HOMEDIR, 'Matterbridge');
  matterbridge.matterbridgeCertDirectory = path.join(HOMEDIR, '.mattercert');
  matterbridge.log.logLevel = LogLevel.DEBUG;

  // Get the frontend, plugins and devices
  frontend = matterbridge.frontend;
  plugins = matterbridge.plugins;
  devices = matterbridge.devices;

  // Setup matter environment
  const environment = await createTestEnvironment();
  expect(environment).toBeDefined();
  expect(environment).toBeInstanceOf(Environment);
  // @ts-expect-error - access to private member
  matterbridge.environment = environment;
  return matterbridge;
}

/**
 * Start the matterbridge environment.
 * Only node storage, matter storage and the server and aggregator nodes are started.
 *
 * @param {number} port The matter server port.
 * @param {boolean} createOnly If true, only create the environment without starting it. Default is false.
 * @returns {Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]>} The started server and aggregator.
 *
 * @example
 * ```typescript
 * const NAME = 'Platform';
 * const MATTER_PORT = 5540;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Create Matterbridge environment
 * await createMatterbridgeEnvironment();
 * await startMatterbridgeEnvironment(MATTER_PORT, MATTER_CREATE_ONLY);
 * ```
 */
export async function startMatterbridgeEnvironment(port: number = 5540, createOnly: boolean = false): Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]> {
  // Create the node storage
  matterbridge.nodeStorage = new NodeStorageManager({
    dir: path.join(matterbridge.matterbridgeDirectory, NODE_STORAGE_DIR),
    writeQueue: false,
    expiredInterval: undefined,
    logging: false,
  });
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

  if (createOnly) {
    // Ensure the queue is empty and pause
    await flushAsync();
    return [server, aggregator];
  }

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
  expect(platform).toBeDefined();
  // Setup the platform MatterNode helpers
  // @ts-expect-error - setMatterNode is intentionally private
  platform.setMatterNode?.(
    matterbridge.addBridgedEndpoint.bind(matterbridge),
    matterbridge.removeBridgedEndpoint.bind(matterbridge),
    matterbridge.removeAllBridgedEndpoints.bind(matterbridge),
    matterbridge.addVirtualEndpoint.bind(matterbridge),
  );

  if (name) platform.config.name = name;
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
 * @param {boolean} createOnly Whether the environment was created with createOnly flag. If true, only stop the environment without closing the server and aggregator nodes (default false).
 * @returns {Promise<void>} A promise that resolves when the environment is stopped.
 * @example
 * ```typescript
 * const NAME = 'Platform';
 * const MATTER_PORT = 5540;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Destroy Matterbridge environment
 * await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
 * await destroyMatterbridgeEnvironment();
 * ```
 */
export async function stopMatterbridgeEnvironment(createOnly: boolean = false): Promise<void> {
  expect(matterbridge).toBeDefined();
  expect(server).toBeDefined();
  expect(aggregator).toBeDefined();

  // Flush any pending endpoint number persistence
  await flushAllEndpointNumberPersistence(server);

  // Ensure all endpoint numbers are persisted
  await assertAllEndpointNumbersPersisted(server);

  // Close the server node
  expect(server.lifecycle.isReady).toBeTruthy();
  if (!createOnly) {
    expect(server.lifecycle.isOnline).toBeTruthy();
  }
  await server.close();
  expect(server.lifecycle.isReady).toBeFalsy();
  expect(server.lifecycle.isOnline).toBeFalsy();

  // Stop the matter storage
  // @ts-expect-error - access to private member for testing
  await matterbridge.stopMatterStorage();
  expect(matterbridge.matterStorageService).not.toBeDefined();
  expect(matterbridge.matterStorageManager).not.toBeDefined();
  expect(matterbridge.matterbridgeContext).not.toBeDefined();

  // Stop the node storage
  await matterbridge.nodeContext?.close();
  matterbridge.nodeContext = undefined;
  await matterbridge.nodeStorage?.close();
  matterbridge.nodeStorage = undefined;

  // Ensure the queue is empty and pause
  await flushAsync();
}

/**
 * Destroy the matterbridge environment
 *
 * @param {number} cleanupPause The timeout for the destroy operation (default 10ms).
 * @param {number} destroyPause The pause duration after cleanup before destroying the instance (default 100ms).
 * @param {boolean} closeMdns Whether to close the mDNS service (default false).
 * @param {boolean} closeRuntime Whether to close the runtime service (default false).
 * @returns {Promise<void>} A promise that resolves when the environment is destroyed.
 * @example
 * ```typescript
 * const NAME = 'Platform';
 * const MATTER_PORT = 5540;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Destroy Matterbridge environment
 * await stopMatterbridgeEnvironment(MATTER_CREATE_ONLY);
 * await destroyMatterbridgeEnvironment();
 * ```
 */
export async function destroyMatterbridgeEnvironment(
  cleanupPause: number = 10,
  destroyPause: number = 100,
  closeMdns: boolean = false,
  closeRuntime: boolean = false,
): Promise<void> {
  // Destroy a matterbridge instance
  await destroyInstance(matterbridge, cleanupPause, destroyPause);

  // Close the mDNS service
  if (closeMdns) {
    await closeMdnsInstance(matterbridge);
  }

  // Close the runtime service
  if (closeRuntime) {
    await closeRuntimeInstance(matterbridge);
  }

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
  const environment = (matterbridge as unknown as { environment: Environment }).environment;
  const mdns = environment.maybeGet(MdnsService);
  if (!mdns) return;
  await mdns.close();
  environment.delete(MdnsService, mdns);
}

/**
 * Close the runtime instance in the matterbridge environment.
 *
 * @param {Matterbridge} matterbridge The matterbridge instance.
 * @returns {Promise<void>} A promise that resolves when the runtime instance is closed.
 */
export async function closeRuntimeInstance(matterbridge: Matterbridge): Promise<void> {
  const environment = (matterbridge as unknown as { environment: Environment }).environment;
  const runtime = environment.maybeGet(RuntimeService);
  await runtime?.close();
}
