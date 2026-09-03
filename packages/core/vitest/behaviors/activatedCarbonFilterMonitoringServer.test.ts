/**
 * @file packages/core/vitest/behaviors/activatedCarbonFilterMonitoringServer.test.ts
 * @description This file contains the tests for activatedCarbonFilterMonitoringServer.
 * @author Luca Liguori
 */

const NAME = 'ActivatedCarbonFilterMonitoringServer';
const MATTER_PORT = 13900;
const MATTER_CREATE_ONLY = true;

import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { loggerLogSpy, setupTest } from '@matterbridge/vitest-utils';
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

import { airPurifier } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeActivatedCarbonFilterMonitoringServer', () => {
  let purifier: MatterbridgeEndpoint;

  beforeAll(async () => {
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

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Device type: airPurifier', async () => {
    purifier = new MatterbridgeEndpoint(airPurifier, { id: 'airPurifier' });
    purifier.createDefaultHepaFilterMonitoringClusterServer(40);
    purifier.createDefaultActivatedCarbonFilterMonitoringClusterServer(30);
    purifier.addRequiredClusterServers();
    expect(purifier).toBeDefined();
    expect(await addDevice(aggregator, purifier)).toBeTruthy();
  });

  test('ActivatedCarbonFilterMonitoring server', async () => {
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(30);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBeNull();

    await purifier.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');

    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(100);
    expect(typeof purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called (endpoint ${purifier.id}.${purifier.number})`,
    );
  });
});
