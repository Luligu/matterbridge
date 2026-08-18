/**
 * @file packages/core/vitest/behaviors/occupancySensingServer.test.ts
 * @description This file contains the tests for occupancySensingServer.
 * @author Luca Liguori
 */

const NAME = 'OccupancySensingServer';
const MATTER_PORT = 12100;
const MATTER_CREATE_ONLY = true;

import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';
import { LogLevel } from 'node-ansi-logger';

import { occupancySensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('HoldTime / PIROccupiedToUnoccupiedDelay backward-compatible sync', () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Set log level to debug for better visibility during tests
    MatterbridgeEndpoint.logLevel = LogLevel.DEBUG;

    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Create occupancySensor device', async () => {
    device = new MatterbridgeEndpoint(occupancySensor, { id: 'OccupancySensingServerTest' });
    expect(device).toBeDefined();
    device.createDefaultOccupancySensingClusterServer(false, 30, 1, 300);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    expect(device.getAttribute(OccupancySensing, 'holdTime')).toBe(30);
    expect(device.getAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay')).toBe(30);
  });

  test('Writing HoldTime mirrors it to PIROccupiedToUnoccupiedDelay', async () => {
    await device.setAttribute(OccupancySensing, 'holdTime', 60);

    expect(device.getAttribute(OccupancySensing, 'holdTime')).toBe(60);
    expect(device.getAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay')).toBe(60);
  });

  test('Writing PIROccupiedToUnoccupiedDelay mirrors it to HoldTime', async () => {
    await device.setAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay', 90);

    expect(device.getAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay')).toBe(90);
    expect(device.getAttribute(OccupancySensing, 'holdTime')).toBe(90);
  });

  test('Writing the same HoldTime value is a no-op', async () => {
    await device.setAttribute(OccupancySensing, 'holdTime', 90);

    expect(device.getAttribute(OccupancySensing, 'holdTime')).toBe(90);
    expect(device.getAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay')).toBe(90);
  });
});
