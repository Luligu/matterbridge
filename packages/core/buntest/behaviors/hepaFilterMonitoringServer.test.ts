/**
 * @file packages/core/buntest/behaviors/hepaFilterMonitoringServer.test.ts
 * @description This file contains the bun tests for hepaFilterMonitoringServer.
 * @author Luca Liguori
 */

const NAME = 'HepaFilterMonitoringServer';
const MATTER_PORT = 13800;

import { describe, expect, test } from 'bun:test';

import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeHepaFilterMonitoringServer } from '../../src/behaviors/hepaFilterMonitoringServer.js';
import { airPurifier } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeHepaFilterMonitoringServer', () => {
  useServerNode(MATTER_PORT);

  test('resetCondition on a Down DegradationDirection restores Condition to 100 and notifies the subscribers', async () => {
    const purifier = new MatterbridgeEndpoint(airPurifier, { id: 'airPurifier' });
    purifier.createDefaultHepaFilterMonitoringClusterServer(40);
    purifier.createDefaultActivatedCarbonFilterMonitoringClusterServer(30);
    purifier.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, purifier, 0, 0, 0, 0)).toBeTruthy();
    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'condition')).toBe(40);
    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'lastChangedTime')).toBeNull();

    const emitted: unknown[] = [];
    purifier.subscribeCommand(HepaFilterMonitoring, 'resetCondition', (data) => emitted.push(data.request));
    await purifier.invokeBehaviorCommand(HepaFilterMonitoring, 'resetCondition');
    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'condition')).toBe(100);
    expect(purifier.getAttribute(HepaFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(typeof purifier.getAttribute(HepaFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(emitted).toEqual([{}]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeHepaFilterMonitoringServer: resetCondition called (endpoint ${purifier.id}.${purifier.number})`);
  });

  test('resetCondition on an Up DegradationDirection resets Condition to 0', async () => {
    const endpoint = new MatterbridgeEndpoint(airPurifier, { id: 'HepaFilterMonitoringServerDegradationUp' });
    endpoint.behaviors.require(
      MatterbridgeHepaFilterMonitoringServer.with(ResourceMonitoring.Feature.Condition, ResourceMonitoring.Feature.Warning, ResourceMonitoring.Feature.ReplacementProductList),
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
    expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
    await endpoint.invokeBehaviorCommand(HepaFilterMonitoring, 'resetCondition');
    expect(endpoint.getAttribute(HepaFilterMonitoring.id, 'condition')).toBe(0);
    expect(endpoint.getAttribute(HepaFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
  });
});
