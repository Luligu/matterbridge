/**
 * @description This file contains the Jest Matter Test Environment.
 * @file src/jestMatterTest.test.ts
 * @author Luca Liguori
 * @created 2026-04-19
 * @version 1.0.0
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

/*
 *  Matter test environment with initialized ServerNode and AggregatorEndpoint. No matterbridge, frontend, devices and plugins.
 */

import '@matter/nodejs'; // Set up Node.js environment for matter.js

import path from 'node:path';
import { inspect } from 'node:util';

// @matter
import { Environment, Lifecycle, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel } from '@matter/general';
import { Endpoint, ServerNode, ServerNodeStore } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints';
import { DeviceTypeId, VendorId } from '@matter/types/datatype';
// @matterbridge
import { MATTER_STORAGE_DIR, type PlatformMatterbridge } from '@matterbridge/types';
import { er, rs } from 'node-ansi-logger';

// local modules
import { bridge } from '../matterbridgeDeviceTypes.js';
import { flushAsync } from './jestFlushAsync.js';
import { HOMEDIR, NAME } from './jestSetupTest.js';

export let environment: Environment;
export let server: ServerNode<ServerNode.RootEndpoint>;
export let aggregator: Endpoint<AggregatorEndpoint>;

/**
 * Create a matter test environment for testing:
 * - it will remove any existing home directory
 * - setup the matter environment with name, debug logging and ANSI format
 *
 * @returns {Environment} - The default matter environment.
 * @example
 * ```typescript
 * const NAME = 'BaseTest';
 * const MATTER_PORT = 8000;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the Matter test environment
 * await createTestEnvironment();
 *
 * // Create the server node and aggregator
 * await createServerNode(MATTER_PORT);
 *
 * // Start the server node if not in create-only mode
 * if (!MATTER_CREATE_ONLY) await startServerNode();
 *
 * // Stop or flush the server node depending on the create-only mode
 * if (MATTER_CREATE_ONLY) await flushServerNode();
 * else await stopServerNode();
 *
 * // Destroy the Matter test environment
 * await destroyTestEnvironment();
 * ```
 */
export async function createTestEnvironment(): Promise<Environment> {
  expect(NAME).toBeDefined();
  expect(typeof NAME).toBe('string');
  expect(NAME.length).toBeGreaterThanOrEqual(4); // avoid accidental deletion of short paths like "/" or "C:\"

  // Setup the matter environment
  environment = Environment.default;
  environment.vars.set('log.level', MatterLogLevel.DEBUG);
  environment.vars.set('log.format', MatterLogFormat.ANSI);
  environment.vars.set('path.root', path.join(HOMEDIR, '.matterbridge', MATTER_STORAGE_DIR));
  environment.vars.set('runtime.signals', false);
  environment.vars.set('runtime.exitcode', false);
  return environment;
}

/**
 * Destroy the matter test environment
 *
 * @returns {Promise<void>} A promise that resolves when the test environment is destroyed.
 * @example
 * ```typescript
 * const NAME = 'BaseTest';
 * const MATTER_PORT = 8000;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the Matter test environment
 * await createTestEnvironment();
 *
 * // Create the server node and aggregator
 * await createServerNode(MATTER_PORT);
 *
 * // Start the server node if not in create-only mode
 * if (!MATTER_CREATE_ONLY) await startServerNode();
 *
 * // Stop or flush the server node depending on the create-only mode
 * if (MATTER_CREATE_ONLY) await flushServerNode();
 * else await stopServerNode();
 *
 * // Destroy the Matter test environment
 * await destroyTestEnvironment();
 * ```
 */
export async function destroyTestEnvironment(): Promise<void> {
  // Nothing to clean up right now
}

/**
 * Get a mocked PlatformMatterbridge.
 *
 * @returns {PlatformMatterbridge} An object representing the mocked PlatformMatterbridge.
 */
export function getPlatformMatterbridge(): PlatformMatterbridge {
  return {
    systemInformation: {
      interfaceName: 'eth0',
      macAddress: 'aa:bb:cc:dd:ee:ff',
      ipv4Address: '',
      ipv6Address: '',
      osRelease: 'xx.xx.xx.xx.xx.xx',
      nodeVersion: '22.1.10',
      hostname: 'jest',
      user: 'matterbridge',
      osType: 'Linux',
      osPlatform: 'linux',
      osArch: 'x64',
      totalMemory: '0 B',
      freeMemory: '0 B',
      systemUptime: '0s',
      processUptime: '0s',
      cpuUsage: '0%',
      processCpuUsage: '0%',
      rss: '0 B',
      heapTotal: '0 B',
      heapUsed: '0 B',
    },
    rootDirectory: HOMEDIR,
    homeDirectory: HOMEDIR,
    matterbridgeDirectory: path.join(HOMEDIR, '.matterbridge'),
    matterbridgePluginDirectory: path.join(HOMEDIR, 'Matterbridge'),
    matterbridgeCertDirectory: path.join(HOMEDIR, '.mattercert'),
    globalModulesDirectory: path.join(HOMEDIR, 'node_modules'),
    matterbridgeVersion: '3.7.8',
    matterbridgeLatestVersion: '3.7.8',
    matterbridgeDevVersion: '3.7.8',
    frontendVersion: '3.7.8',
    bridgeMode: '',
    restartMode: '',
    virtualMode: 'mounted_switch',
    aggregatorVendorId: 0xfff1,
    aggregatorVendorName: 'Matterbridge',
    aggregatorProductId: 0x8000,
    aggregatorProductName: 'Matterbridge Jest',
    addBridgedEndpoint: jest.fn(async () => {
      return Promise.resolve(true);
    }),
    removeBridgedEndpoint: jest.fn(async () => {
      return Promise.resolve(true);
    }),
    removeAllBridgedEndpoints: jest.fn(async () => {
      return Promise.resolve(true);
    }),
    addVirtualEndpoint: jest.fn(async () => {
      return Promise.resolve();
    }),
  } as unknown as PlatformMatterbridge;
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
 * @param {number} rounds Number of macrotask + close cycles to run (3 is usually sufficient).
 * @param {number} ticks Number of macrotask (setImmediate) turns to yield after stopping the server to allow asynchronous work to complete before returning (default 1).
 * @param {number} microTurns Number of microtask drains (Promise.resolve chains) to perform after macrotask yielding to allow asynchronous work to complete before returning (default 1).
 * @param {number} pause Duration in ms to wait between cycles (default 10ms) to allow any follow-up work scheduled by close() to run.
 * @returns {Promise<void>} Resolves when pending number persistence batches have completed.
 */
export async function flushAllEndpointNumberPersistence(
  targetServer: ServerNode,
  rounds: number = 3,
  ticks: number = 1,
  microTurns: number = 1,
  pause: number = 10,
): Promise<void> {
  const nodeStore = targetServer.env.get(ServerNodeStore);
  for (let i = 0; i < rounds; i++) {
    await flushAsync(ticks, microTurns, pause);
    await nodeStore.endpointStores.close();
  }
}

/**
 * Get the root ServerNode for a given Endpoint by traversing up the owner chain until the root endpoint is reached.
 *
 * @param {Endpoint} endpoint The endpoint to find the root server for.
 * @returns {ServerNode<ServerNode.RootEndpoint>} The root ServerNode of the given endpoint.
 */
function getRootServerNode(endpoint: Endpoint): ServerNode<ServerNode.RootEndpoint> {
  let current = endpoint as Endpoint;
  while (current.owner) {
    current = current.owner as Endpoint;
  }
  return current as ServerNode<ServerNode.RootEndpoint>;
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
 * Create a matter server node for testing.
 *
 * @param {number} port TCP port to listen on.
 * @param {DeviceTypeId} deviceType Device type identifier for the server node. Defaults to the bridge device type.
 * @param {number} ticks Number of macrotask (setImmediate) turns to yield after starting the server to allow asynchronous work to complete before returning (default 1).
 * @param {number} microTurns Number of microtask drains (Promise.resolve chains) to perform after macrotask yielding to allow asynchronous work to complete before returning (default 1).
 * @param {number} pause Final timer delay in ms to wait after microtask draining to allow any follow-up work scheduled by the server start process to run before returning (default 10ms).
 * @returns {Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]>} Resolves to an array containing the created ServerNode and its AggregatorNode.
 * @example
 * ```typescript
 * const NAME = 'BaseTest';
 * const MATTER_PORT = 8000;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the Matter test environment
 * await createTestEnvironment();
 *
 * // Create the server node and aggregator
 * await createServerNode(MATTER_PORT);
 *
 * // Start the server node if not in create-only mode
 * if (!MATTER_CREATE_ONLY) await startServerNode();
 *
 * // Stop or flush the server node depending on the create-only mode
 * if (MATTER_CREATE_ONLY) await flushServerNode();
 * else await stopServerNode();
 *
 * // Destroy the Matter test environment
 * await destroyTestEnvironment();
 * ```
 */
export async function createServerNode(
  port: number,
  deviceType: DeviceTypeId = bridge.code,
  ticks: number = 1,
  microTurns: number = 1,
  pause: number = 10,
): Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]> {
  const { randomBytes } = await import('node:crypto');
  const random = randomBytes(8).toString('hex');

  // Create the server node
  server = await ServerNode.create({
    id: NAME + 'ServerNode',

    // Provide the environment
    environment,

    // Provide Node announcement settings
    productDescription: {
      name: NAME + 'ServerNode',
      deviceType: DeviceTypeId(deviceType),
      vendorId: VendorId(0xfff1),
      productId: 0x8000,
    },

    // Provide defaults for the BasicInformation cluster on the Root endpoint
    basicInformation: {
      vendorId: VendorId(0xfff1),
      vendorName: 'Matterbridge',
      productId: 0x8000,
      productName: 'Matterbridge ' + NAME,
      nodeLabel: NAME + 'ServerNode',
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
    id: NAME + 'AggregatorNode',
  });
  expect(aggregator).toBeDefined();

  // Add the aggregator to the server
  await server.add(aggregator);
  expect(server.parts.has(aggregator.id)).toBeTruthy();
  expect(server.parts.has(aggregator)).toBeTruthy();
  expect(aggregator.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeFalsy();

  // Ensure the queue is empty and pause 100ms to allow any pending work to complete before returning the server and aggregator
  await flushAsync(ticks, microTurns, pause);

  return [server, aggregator];
}

/**
 * Start a matter server node for testing.
 *
 * @param {number} ticks Number of macrotask (setImmediate) turns to yield after starting the server to allow asynchronous work to complete before returning (default 1).
 * @param {number} microTurns Number of microtask drains (Promise.resolve chains) to perform after macrotask yielding to allow asynchronous work to complete before returning (default 1).
 * @param {number} pause Final timer delay in ms to wait after microtask draining to allow any follow-up work scheduled by the server start process to run before returning (default 10ms).
 * @returns {Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]>} Resolves to an array containing the created ServerNode and its AggregatorNode.
 * @example
 * ```typescript
 * const NAME = 'BaseTest';
 * const MATTER_PORT = 8000;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the Matter test environment
 * await createTestEnvironment();
 *
 * // Create the server node and aggregator
 * await createServerNode(MATTER_PORT);
 *
 * // Start the server node if not in create-only mode
 * if (!MATTER_CREATE_ONLY) await startServerNode();
 *
 * // Stop or flush the server node depending on the create-only mode
 * if (MATTER_CREATE_ONLY) await flushServerNode();
 * else await stopServerNode();
 *
 * // Destroy the Matter test environment
 * await destroyTestEnvironment();
 * ```
 */
export async function startServerNode(ticks: number = 1, microTurns: number = 1, pause: number = 10): Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]> {
  // Create the server node
  if (!server || !aggregator) {
    // istanbul ignore next
    throw new Error('Server node and aggregator must be created before starting the server. Call createServerNode() first.');
  }

  // Wait for the server to be online
  await new Promise<void>((resolve, reject) => {
    server.lifecycle.online.on(async () => {
      resolve();
    });
    server.start().catch((err) => reject(err));
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

  // Ensure the queue is empty
  await flushAsync(ticks, microTurns, pause);

  return [server, aggregator];
}

/**
 * Stop a matter server node.
 *
 * @param {number} ticks Number of macrotask (setImmediate) turns to yield after stopping the server to allow asynchronous work to complete before returning (default 1).
 * @param {number} microTurns Number of microtask drains (Promise.resolve chains) to perform after macrotask yielding to allow asynchronous work to complete before returning (default 1).
 * @param {number} pause Final timer delay in ms to wait after microtask draining to allow any follow-up work scheduled by the server stop process to run before returning (default 10ms).
 * @returns {Promise<void>} Resolves when the server has stopped.
 * @example
 * ```typescript
 * const NAME = 'BaseTest';
 * const MATTER_PORT = 8000;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the Matter test environment
 * await createTestEnvironment();
 *
 * // Create the server node and aggregator
 * await createServerNode(MATTER_PORT);
 *
 * // Start the server node if not in create-only mode
 * if (!MATTER_CREATE_ONLY) await startServerNode();
 *
 * // Stop or flush the server node depending on the create-only mode
 * if (MATTER_CREATE_ONLY) await flushServerNode();
 * else await stopServerNode();
 *
 * // Destroy the Matter test environment
 * await destroyTestEnvironment();
 * ```
 */
export async function stopServerNode(ticks: number = 1, microTurns: number = 1, pause: number = 10): Promise<void> {
  // Flush any pending endpoint number persistence
  await flushAllEndpointNumberPersistence(server);

  // Ensure all endpoint numbers are persisted
  await assertAllEndpointNumbersPersisted(server);

  // Stop the server
  expect(server).toBeDefined();
  expect(server.lifecycle.isReady).toBeTruthy();
  expect(server.lifecycle.isOnline).toBeTruthy();
  await server.close();
  expect(server.lifecycle.isReady).toBeFalsy();
  expect(server.lifecycle.isOnline).toBeFalsy();

  // Ensure the queue is empty
  await flushAsync(ticks, microTurns, pause);
}

/**
 * Flush any pending endpoint number persistence.
 *
 * @param {number} ticks Number of macrotask (setImmediate) turns to yield after stopping the server to allow asynchronous work to complete before returning (default 1).
 * @param {number} microTurns Number of microtask drains (Promise.resolve chains) to perform after macrotask yielding to allow asynchronous work to complete before returning (default 1).
 * @param {number} pause Final timer delay in ms to wait after microtask draining to allow any follow-up work scheduled by the server stop process to run before returning (default 10ms).
 * @returns {Promise<void>} Resolves when the server has stopped.
 * @example
 * ```typescript
 * const NAME = 'BaseTest';
 * const MATTER_PORT = 8000;
 * const MATTER_CREATE_ONLY = true;
 *
 * // Setup the test environment
 * await setupTest(NAME, false);
 *
 * // Setup the Matter test environment
 * await createTestEnvironment();
 *
 * // Create the server node and aggregator
 * await createServerNode(MATTER_PORT);
 *
 * // Start the server node if not in create-only mode
 * if (!MATTER_CREATE_ONLY) await startServerNode();
 *
 * // Stop or flush the server node depending on the create-only mode
 * if (MATTER_CREATE_ONLY) await flushServerNode();
 * else await stopServerNode();
 *
 * // Destroy the Matter test environment
 * await destroyTestEnvironment();
 * ```
 */
export async function flushServerNode(ticks: number = 1, microTurns: number = 1, pause: number = 10): Promise<void> {
  // Flush any pending endpoint number persistence
  await flushAllEndpointNumberPersistence(server);

  // Ensure all endpoint numbers are persisted
  await assertAllEndpointNumbersPersisted(server);

  // Ensure the queue is empty
  await flushAsync(ticks, microTurns, pause);
}

/**
 * Add a device (endpoint) to a matter server node or an aggregator.
 *
 * @param {ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>} owner The server or aggregator to add the device to.
 * @param {Endpoint} device The device to add.
 * @param {number} rounds The number of rounds to perform after addition (default 3).
 * @param {number} pause The pause time in milliseconds after addition (default 10ms).
 * @returns {Promise<void>} Resolves when the device has been added and is ready.
 * @example
 * ```typescript
 * expect(await addDevice(aggregator, device)).toBeTruthy();
 * ```
 */
export async function addDevice(
  owner: ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>,
  device: Endpoint,
  rounds: number = 3,
  pause: number = 10,
): Promise<boolean> {
  expect(owner).toBeDefined();
  expect(device).toBeDefined();
  expect(owner.lifecycle.isReady).toBeTruthy();
  expect(owner.construction.status).toBe(Lifecycle.Status.Active);
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  const rootServerNode = getRootServerNode(owner);
  await flushAllEndpointNumberPersistence(rootServerNode, rounds, pause);

  // istanbul ignore next
  try {
    await owner.add(device);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorInspect = inspect(error, { depth: 10 });
    process.stderr.write(`${er}Error adding device ${device.maybeId}.${device.maybeNumber}: ${errorMessage}${rs}\nStack: ${errorInspect}\n`);
    return false;
  }
  await device.construction.ready;
  expect(owner.parts.has(device)).toBeTruthy();
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  expect(device.lifecycle.isReady).toBeTruthy();
  expect(device.lifecycle.isInstalled).toBeTruthy();
  expect(device.lifecycle.hasId).toBeTruthy();
  expect(device.lifecycle.hasNumber).toBeTruthy();
  expect(device.construction.status).toBe(Lifecycle.Status.Active);
  await flushAllEndpointNumberPersistence(rootServerNode, rounds, pause);
  return true;
}

/**
 * Delete a device (endpoint) from a matter server node or an aggregator.
 *
 * @param {ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>} owner The server or aggregator to remove the device from.
 * @param {Endpoint} device The device to remove.
 * @param {number} rounds The number of rounds to perform after deletion (default 3).
 * @param {number} pause The pause time in milliseconds after deletion (default 10ms).
 * @returns {Promise<void>} Resolves when the device has been removed and is no longer ready.
 * @example
 * ```typescript
 * expect(await deleteDevice(aggregator, device)).toBeTruthy();
 * ```
 */
export async function deleteDevice(
  owner: ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>,
  device: Endpoint,
  rounds: number = 3,
  pause: number = 10,
): Promise<boolean> {
  expect(owner).toBeDefined();
  expect(device).toBeDefined();
  expect(owner.lifecycle.isReady).toBeTruthy();
  expect(owner.construction.status).toBe(Lifecycle.Status.Active);
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  const rootServerNode = getRootServerNode(owner);
  await flushAllEndpointNumberPersistence(rootServerNode, rounds, pause);

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
  await flushAllEndpointNumberPersistence(rootServerNode, rounds, pause);
  return true;
}
