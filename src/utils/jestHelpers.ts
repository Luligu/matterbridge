/**
 * @description This file contains the Jest helpers.
 * @file src/helpers.test.ts
 * @author Luca Liguori
 * @created 2025-09-03
 * @version 1.0.5
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

// Imports from Matterbridge
import { jest } from '@jest/globals';
import { DeviceTypeId, Endpoint, Environment, ServerNode, ServerNodeStore, VendorId, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Lifecycle } from '@matter/main';
import { AggregatorEndpoint, RootEndpoint } from '@matter/main/endpoints';
import { MdnsService } from '@matter/main/protocol';
import { AnsiLogger } from 'matterbridge/logger';

// Imports from a plugin
/*
import { jest } from '@jest/globals';
import { DeviceTypeId, Endpoint, Environment, MdnsService, ServerNode, ServerNodeStore, VendorId, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Lifecycle } from 'matterbridge/matter';
import { RootEndpoint, AggregatorEndpoint } from 'matterbridge/matter/endpoints';
import { AnsiLogger } from 'matterbridge/logger';
*/

export let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
export let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
export let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
export let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
export let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
export let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;

/**
 * Setup the Jest environment:
 * - it will remove any existing home directory.
 * - setup the spies for logging.
 
 * @param {string} name The name of the test suite.
 * @param {boolean} debug If true, the logging is not mocked.
 *
 * ```typescript
 * import { consoleDebugSpy, consoleErrorSpy, consoleInfoSpy, consoleLogSpy, consoleWarnSpy, loggerLogSpy, setDebug, setupTest } from './jestHelpers.js';
 *
 * // Setup the test environment
 * setupTest(NAME, false);
 *
 * ```
 */
export function setupTest(name: string, debug: boolean = false): void {
  expect(name).toBeDefined();
  expect(typeof name).toBe('string');
  expect(name.length).toBeGreaterThanOrEqual(4); // avoid accidental deletion of short paths like "/" or "C:\"

  // Cleanup any existing home directory
  rmSync(path.join('jest', name), { recursive: true, force: true });

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
}

/**
 * Set or unset the debug mode.
 *
 * @param {boolean} debug If true, the logging is not mocked.
 */
export function setDebug(debug: boolean): void {
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
 * Create a Matterbridge Environment for testing.
 * It will remove any existing home directory.
 *
 * @param {string} homeDir Home directory for the environment.
 * @returns {Environment}  The created environment.
 */
export function createTestEnvironment(homeDir: string): Environment {
  expect(homeDir).toBeDefined();
  expect(typeof homeDir).toBe('string');
  expect(homeDir.length).toBeGreaterThanOrEqual(4); // avoid accidental deletion of short paths like "/" or "C:\"

  // Cleanup any existing home directory
  rmSync(homeDir, { recursive: true, force: true });

  // Setup the matter environment
  const environment = Environment.default;
  environment.vars.set('log.level', MatterLogLevel.DEBUG);
  environment.vars.set('log.format', MatterLogFormat.ANSI);
  environment.vars.set('path.root', homeDir);
  environment.vars.set('runtime.signals', false);
  environment.vars.set('runtime.exitcode', false);
  return environment;
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
 * @param {number} pause       Final timer delay in ms; set 0 to disable (default 100ms).
 * @returns {Promise<void>}        Resolves after the requested event loop advancement has completed.
 */
export async function flushAsync(ticks: number = 3, microTurns: number = 10, pause: number = 100): Promise<void> {
  for (let i = 0; i < ticks; i++) await new Promise((resolve) => setImmediate(resolve));
  for (let i = 0; i < microTurns; i++) await Promise.resolve();
  if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
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
 * Start a Matterbridge ServerNode for testing.
 *
 * @param {string} name Name of the server (used for logging and product description).
 * @param {number} port TCP port to listen on.
 * @returns {Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]>} Resolves to an array containing the created ServerNode and its AggregatorNode.
 */
export async function startServerNode(name: string, port: number): Promise<[ServerNode<ServerNode.RootEndpoint>, Endpoint<AggregatorEndpoint>]> {
  // Create the server node
  const server = await ServerNode.create({
    id: name + 'ServerNode',

    productDescription: {
      name: name + 'ServerNode',
      deviceType: DeviceTypeId(RootEndpoint.deviceType),
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
    },

    network: {
      port,
    },
  });
  expect(server).toBeDefined();
  expect(server.lifecycle.isReady).toBeTruthy();

  // Create the aggregator node
  const aggregator = new Endpoint(AggregatorEndpoint, {
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

  // Ensure the queue is empty and pause 100ms
  await flushAsync();

  return [server, aggregator];
}

/**
 * Stop a Matterbridge ServerNode.
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
  await server.env.get(MdnsService)[Symbol.asyncDispose]();

  // Ensure the queue is empty and pause 100ms
  await flushAsync();
}

/**
 * Add a device (endpoint) to a server or aggregator.
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

  try {
    await owner.add(device);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorInspect = inspect(error, { depth: 10 });
    // eslint-disable-next-line no-console
    console.error(`Error adding device ${device.maybeId}.${device.maybeNumber}: ${errorMessage}\nstack: ${errorInspect}`);
    return false;
  }
  expect(owner.parts.has(device)).toBeTruthy();
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  expect(device.lifecycle.isReady).toBeTruthy();
  expect(device.lifecycle.isInstalled).toBeTruthy();
  expect(device.lifecycle.hasId).toBeTruthy();
  expect(device.lifecycle.hasNumber).toBeTruthy();
  expect(device.construction.status).toBe(Lifecycle.Status.Active);
  await flushAsync(1, 1, pause);
  return true;
}

/**
 * Add a device (endpoint) to a server or aggregator.
 *
 * @param {ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>} owner The server or aggregator to add the device to.
 * @param {Endpoint} device The device to add.
 * @param {number} pause The pause time in milliseconds after deletion (default 10ms).
 * @returns {Promise<void>} Resolves when the device has been added and is ready.
 */
export async function deleteDevice(owner: ServerNode<ServerNode.RootEndpoint> | Endpoint<AggregatorEndpoint>, device: Endpoint, pause: number = 10): Promise<boolean> {
  expect(owner).toBeDefined();
  expect(device).toBeDefined();
  expect(owner.lifecycle.isReady).toBeTruthy();
  expect(owner.construction.status).toBe(Lifecycle.Status.Active);
  expect(owner.lifecycle.isPartsReady).toBeTruthy();

  try {
    await device.delete();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorInspect = inspect(error, { depth: 10 });
    // eslint-disable-next-line no-console
    console.error(`Error deleting device ${device.maybeId}.${device.maybeNumber}: ${errorMessage}\nstack: ${errorInspect}`);
    return false;
  }
  expect(owner.parts.has(device)).toBeFalsy();
  expect(owner.lifecycle.isPartsReady).toBeTruthy();
  expect(device.lifecycle.isReady).toBeFalsy();
  expect(device.lifecycle.isInstalled).toBeFalsy();
  expect(device.lifecycle.hasId).toBeTruthy();
  expect(device.lifecycle.hasNumber).toBeTruthy();
  expect(device.construction.status).toBe(Lifecycle.Status.Destroyed);
  await flushAsync(1, 1, pause);
  return true;
}
