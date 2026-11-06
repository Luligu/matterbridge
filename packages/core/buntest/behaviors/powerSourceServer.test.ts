/**
 * @file packages/core/buntest/behaviors/powerSourceServer.test.ts
 * @description This file contains the bun tests for powerSourceServer.
 * @author Luca Liguori
 */

const NAME = 'PowerSourceServer';
const MATTER_PORT = 12700;

import { describe, expect, spyOn, test } from 'bun:test';

import { PowerSource } from '@matter/types/clusters/power-source';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { bridge, extendedColorLight, lightSensor, occupancySensor, powerSource, temperatureSensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgePowerSourceServer', () => {
  useServerNode(MATTER_PORT);

  test('EndpointList lists the endpoint and its ready child endpoints', async () => {
    const poweredDevice = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'powerSourceTest' });
    const constructionCallbacks: Array<() => unknown> = [];
    const onSuccess = poweredDevice.construction.onSuccess.bind(poweredDevice.construction);
    spyOn(poweredDevice.construction, 'onSuccess').mockImplementation((callback) => {
      constructionCallbacks.push(callback);
      return onSuccess(callback);
    });

    poweredDevice.createDefaultBridgedDeviceBasicInformationClusterServer('PowerSource Test', 'SNPS123456');
    poweredDevice.createDefaultPowerSourceWiredClusterServer();
    poweredDevice.addRequiredClusterServers();
    poweredDevice.addChildDeviceType('temperature', temperatureSensor).addRequiredClusterServers();
    poweredDevice.addChildDeviceType('light', lightSensor).addRequiredClusterServers();
    const notReadyChild = poweredDevice.addChildDeviceType('pending', occupancySensor).addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, poweredDevice, 0, 0, 0, 0)).toBeTruthy();

    // Re-run the construction callback with one child reported as not ready: it must be left out of the list.
    // Bun's spyOn has no getter form, so the getter is shadowed on this lifecycle instance only, then removed.
    Object.defineProperty(notReadyChild.lifecycle, 'isReady', { configurable: true, get: () => false });
    try {
      await Promise.resolve(constructionCallbacks.at(-1)?.());
      expect(poweredDevice.getAttribute(PowerSource.id, 'endpointList')).toEqual([
        poweredDevice.number,
        ...poweredDevice.parts.filter((endpoint) => endpoint.lifecycle.isReady).map((endpoint) => endpoint.number),
      ]);
      expect(poweredDevice.getAttribute(PowerSource.id, 'endpointList')).not.toContain(notReadyChild.number);
    } finally {
      Reflect.deleteProperty(notReadyChild.lifecycle, 'isReady');
    }
  });
});
