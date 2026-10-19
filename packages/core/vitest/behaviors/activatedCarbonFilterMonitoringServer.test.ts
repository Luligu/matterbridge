/**
 * @file packages/core/vitest/behaviors/activatedCarbonFilterMonitoringServer.test.ts
 * @description This file contains the tests for activatedCarbonFilterMonitoringServer.
 * @author Luca Liguori
 */

const NAME = 'ActivatedCarbonFilterMonitoringServer';
const MATTER_PORT = 13900;
const MATTER_CREATE_ONLY = true;

import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeActivatedCarbonFilterMonitoringServer } from '../../src/behaviors/activatedCarbonFilterMonitoringServer.js';
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

    // Collect the commands announced to subscribeCommand() listeners
    const emitted: unknown[] = [];
    purifier.subscribeCommand(ActivatedCarbonFilterMonitoring, 'resetCondition', (data) => emitted.push(data.request));

    await purifier.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');

    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(100);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(emitted).toEqual([{}]);
    expect(typeof purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called (endpoint ${purifier.id}.${purifier.number})`,
    );
  });

  test('ActivatedCarbonFilterMonitoring resetCondition resets an Up DegradationDirection to 0', async () => {
    const endpoint = new MatterbridgeEndpoint(airPurifier, { id: 'ActivatedCarbonDegradationUp' });
    endpoint.behaviors.require(
      MatterbridgeActivatedCarbonFilterMonitoringServer.with(
        ResourceMonitoring.Feature.Condition,
        ResourceMonitoring.Feature.Warning,
        ResourceMonitoring.Feature.ReplacementProductList,
      ),
      {
        condition: 80,
        degradationDirection: ResourceMonitoring.DegradationDirection.Up,
        changeIndication: ResourceMonitoring.ChangeIndication.Warning,
        inPlaceIndicator: true,
        lastChangedTime: null,
        replacementProductList: [],
      },
    );
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    await endpoint.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');

    // Matter 1.6.0 § 2.8.6.2: with DegradationDirection Up, full resource availability is the lowest Condition value.
    expect(endpoint.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(0);
    expect(endpoint.getAttribute(ActivatedCarbonFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
  });
});
