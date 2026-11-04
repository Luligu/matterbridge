/**
 * @file packages/core/buntest/behaviors/waterTankLevelMonitoringServer.test.ts
 * @description This file contains the bun tests for waterTankLevelMonitoringServer.
 * @author Luca Liguori
 */

const NAME = 'WaterTankLevelMonitoringServer';
const MATTER_PORT = 14000;

import { describe, expect, test } from 'bun:test';

import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { WaterTankLevelMonitoring } from '@matter/types/clusters/water-tank-level-monitoring';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeWaterTankLevelMonitoringServer } from '../../src/behaviors/waterTankLevelMonitoringServer.js';
import { onOffLight } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeWaterTankLevelMonitoringServer', () => {
  useServerNode(MATTER_PORT);

  // Water Tank Level Monitoring has no device type of its own in this SDK, so an OnOffLight hosts the cluster.
  test('resetCondition forwards before emitting and restores a Down DegradationDirection to 100', async () => {
    const waterTank = new MatterbridgeEndpoint(onOffLight, { id: 'waterTank' });
    waterTank.createDefaultWaterTankLevelMonitoringClusterServer(20);
    waterTank.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, waterTank, 0, 0, 0, 0)).toBeTruthy();
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'condition')).toBe(20);
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'lastChangedTime')).toBeNull();

    const order: string[] = [];
    waterTank.addCommandHandler('WaterTankLevelMonitoring.resetCondition', async (data) => {
      expect(data.endpoint).toBe(waterTank);
      expect(data).toHaveProperty('context');
      expect(data.attributes.condition).toBe(20);
      await Promise.resolve();
      order.push('forwarded');
    });
    waterTank.subscribeCommand(WaterTankLevelMonitoring, 'resetCondition', (data) => order.push(`emitted ${JSON.stringify(data.request)}`));

    await waterTank.invokeBehaviorCommand(WaterTankLevelMonitoring, 'resetCondition');
    expect(order).toEqual(['forwarded', 'emitted {}']);
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'condition')).toBe(100);
    expect(waterTank.getAttribute(WaterTankLevelMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(typeof waterTank.getAttribute(WaterTankLevelMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeWaterTankLevelMonitoringServer: resetCondition called (endpoint ${waterTank.id}.${waterTank.number})`);
  });

  test('resetCondition on an Up DegradationDirection resets Condition to 0', async () => {
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
    expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
    const emitted: unknown[] = [];
    endpoint.subscribeCommand(WaterTankLevelMonitoring, 'resetCondition', (data) => emitted.push(data.request));
    await endpoint.invokeBehaviorCommand(WaterTankLevelMonitoring, 'resetCondition');
    expect(endpoint.getAttribute(WaterTankLevelMonitoring.id, 'condition')).toBe(0);
    expect(endpoint.getAttribute(WaterTankLevelMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(emitted).toEqual([{}]);
  });
});
