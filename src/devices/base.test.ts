// src\base.test.ts

const MATTER_PORT = 6000;
const NAME = 'BaseTest';
const HOMEDIR = path.join('jest', NAME);

import { rmSync } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';
// matter.js
import { Endpoint, DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/main';
import { MdnsService } from '@matter/main/protocol';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { RootEndpoint } from '@matter/main/endpoints/root';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { addDevice, assertAllEndpointNumbersPersisted, createTestEnvironment, flushAllEndpointNumberPersistence, flushAsync, startServerNode, stopServerNode } from '../jest-utils/jestHelpers.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Setup the matter and test environment
createTestEnvironment(HOMEDIR);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    [server, aggregator] = await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('add a battery storage device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });
  */

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
