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
import { addDevice, assertAllEndpointNumbersPersisted, createTestEnvironment, flushAllEndpointNumberPersistence, flushAsync, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

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
