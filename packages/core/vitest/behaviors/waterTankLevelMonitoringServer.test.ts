/**
 * @file packages/core/vitest/behaviors/waterTankLevelMonitoringServer.test.ts
 * @description This file contains the tests for waterTankLevelMonitoringServer.
 * @author Luca Liguori
 */

const NAME = 'WaterTankLevelMonitoringServer';
const MATTER_PORT = 14000;
const MATTER_CREATE_ONLY = true;

import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { WaterTankLevelMonitoring } from '@matter/types/clusters/water-tank-level-monitoring';
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

import { MatterbridgeWaterTankLevelMonitoringServer } from '../../src/behaviors/waterTankLevelMonitoringServer.js';
import { onOffLight } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeWaterTankLevelMonitoringServer', () => {
  let waterTank: MatterbridgeEndpoint;

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

  test('Device type: waterTank', async () => {
    // Water Tank Level Monitoring is only optional on the Humidifier/Dehumidifier device type (Matter 1.7, not yet
    // available in this SDK), so this endpoint is a plain scaffold for exercising the cluster server in isolation.
    waterTank = new MatterbridgeEndpoint(onOffLight, { id: 'waterTank' });
    waterTank.createDefaultWaterTankLevelMonitoringClusterServer(20);
    waterTank.addRequiredClusterServers();
    expect(waterTank).toBeDefined();
    expect(await addDevice(aggregator, waterTank)).toBeTruthy();
  });

  test('WaterTankLevelMonitoring server', async () => {
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'condition')).toBe(20);
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'lastChangedTime')).toBeNull();

    const order: string[] = [];
    const emitted: unknown[] = [];
    waterTank.addCommandHandler('WaterTankLevelMonitoring.resetCondition', async (data) => {
      expect(data.endpoint).toBe(waterTank);
      expect(data).toHaveProperty('context');
      expect(data.attributes.condition).toBe(20);
      await Promise.resolve();
      order.push('forwarded');
    });
    waterTank.subscribeCommand(WaterTankLevelMonitoring, 'resetCondition', (data) => {
      order.push('emitted');
      emitted.push(data.request);
    });

    await waterTank.invokeBehaviorCommand(WaterTankLevelMonitoring, 'resetCondition');

    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'condition')).toBe(100);
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(order).toEqual(['forwarded', 'emitted']);
    expect(emitted).toEqual([{}]);
    expect(typeof waterTank.getAttribute(WaterTankLevelMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeWaterTankLevelMonitoringServer: resetCondition called (endpoint ${waterTank.id}.${waterTank.number})`);
  });

  test('should reset condition to zero when degradation direction is Up', async () => {
    const endpoint = new MatterbridgeEndpoint(onOffLight, { id: 'WaterTankDegradationUp' });
    endpoint.behaviors.require(MatterbridgeWaterTankLevelMonitoringServer, {
      condition: 80,
      degradationDirection: ResourceMonitoring.DegradationDirection.Up,
      changeIndication: ResourceMonitoring.ChangeIndication.Warning,
      inPlaceIndicator: true,
      lastChangedTime: null,
      replacementProductList: [],
    });
    endpoint.addRequiredClusterServers();
    expect(await addDevice(aggregator, endpoint)).toBeTruthy();

    const emitted: unknown[] = [];
    endpoint.subscribeCommand(WaterTankLevelMonitoring, 'resetCondition', (data) => emitted.push(data.request));
    await endpoint.invokeBehaviorCommand(WaterTankLevelMonitoring, 'resetCondition');

    expect(endpoint.getAttribute(WaterTankLevelMonitoring.id, 'condition')).toBe(0);
    expect(endpoint.getAttribute(WaterTankLevelMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(emitted).toEqual([{}]);
  });
});
