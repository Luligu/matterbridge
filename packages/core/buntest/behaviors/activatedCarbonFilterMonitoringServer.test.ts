/**
 * @file packages/core/buntest/behaviors/activatedCarbonFilterMonitoringServer.test.ts
 * @description This file contains the bun tests for activatedCarbonFilterMonitoringServer.
 * @author Luca Liguori
 */

const NAME = 'ActivatedCarbonFilterMonitoringServer';
const MATTER_PORT = 13900;

import { describe, expect, test } from 'bun:test';

import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { ResourceMonitoring } from '@matter/types/clusters/resource-monitoring';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeActivatedCarbonFilterMonitoringServer } from '../../src/behaviors/activatedCarbonFilterMonitoringServer.js';
import { airPurifier } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeActivatedCarbonFilterMonitoringServer', () => {
  useServerNode(MATTER_PORT);

  test('resetCondition on a Down DegradationDirection restores Condition to 100 and notifies the subscribers', async () => {
    const purifier = new MatterbridgeEndpoint(airPurifier, { id: 'airPurifier' });
    purifier.createDefaultHepaFilterMonitoringClusterServer(40);
    purifier.createDefaultActivatedCarbonFilterMonitoringClusterServer(30);
    purifier.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, purifier, 0, 0, 0, 0)).toBeTruthy();
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(30);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBeNull();

    const emitted: unknown[] = [];
    purifier.subscribeCommand(ActivatedCarbonFilterMonitoring, 'resetCondition', (data) => emitted.push(data.request));
    await purifier.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(100);
    expect(purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
    expect(typeof purifier.getAttribute(ActivatedCarbonFilterMonitoring.id, 'lastChangedTime')).toBe('number');
    expect(emitted).toEqual([{}]);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called (endpoint ${purifier.id}.${purifier.number})`,
    );
  });

  test('resetCondition on an Up DegradationDirection resets Condition to 0', async () => {
    const endpoint = new MatterbridgeEndpoint(airPurifier, { id: 'ActivatedCarbonFilterMonitoringServerDegradationUp' });
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
    expect(await addBridgedDevice(aggregator, endpoint, 0, 0, 0, 0)).toBeTruthy();
    await endpoint.invokeBehaviorCommand(ActivatedCarbonFilterMonitoring, 'resetCondition');
    expect(endpoint.getAttribute(ActivatedCarbonFilterMonitoring.id, 'condition')).toBe(0);
    expect(endpoint.getAttribute(ActivatedCarbonFilterMonitoring.id, 'changeIndication')).toBe(ResourceMonitoring.ChangeIndication.Ok);
  });
});
