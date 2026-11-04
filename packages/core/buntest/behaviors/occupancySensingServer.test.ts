/**
 * @file packages/core/buntest/behaviors/occupancySensingServer.test.ts
 * @description This file contains the bun tests for occupancySensingServer.
 * @author Luca Liguori
 */

const NAME = 'OccupancySensingServer';
const MATTER_PORT = 12100;

import { describe, expect, test } from 'bun:test';

import { OccupancySensing } from '@matter/types/clusters/occupancy-sensing';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { occupancySensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeOccupancySensingServer HoldTime / PIROccupiedToUnoccupiedDelay sync', () => {
  useServerNode(MATTER_PORT);

  test('both attributes start in sync and each write is mirrored to the other one', async () => {
    const device = new MatterbridgeEndpoint(occupancySensor, { id: 'OccupancySensingServerTest' });
    device.createDefaultOccupancySensingClusterServer(false, 30, 1, 300);
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();

    const expectBoth = (value: number): void => {
      expect(device.getAttribute(OccupancySensing, 'holdTime')).toBe(value);
      expect(device.getAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay')).toBe(value);
    };
    expectBoth(30);

    await device.setAttribute(OccupancySensing, 'holdTime', 60);
    expectBoth(60);
    await device.setAttribute(OccupancySensing, 'pirOccupiedToUnoccupiedDelay', 90);
    expectBoth(90);
    // Writing the same value again is a no-op.
    await device.setAttribute(OccupancySensing, 'holdTime', 90);
    expectBoth(90);
  });
});
