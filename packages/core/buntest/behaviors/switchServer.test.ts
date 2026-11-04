/**
 * @file packages/core/buntest/behaviors/switchServer.test.ts
 * @description This file contains the bun tests for switchServer.
 * @author Luca Liguori
 */

const NAME = 'SwitchServer';
const MATTER_PORT = 12800;

import { describe, expect, test } from 'bun:test';

import { Switch } from '@matter/types/clusters/switch';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeSwitchServer } from '../../src/behaviors/switchServer.js';
import { genericSwitch, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeSwitchServer', () => {
  useServerNode(MATTER_PORT);

  test('initialize() only logs and leaves the switch state to the device', async () => {
    const button = new MatterbridgeEndpoint([genericSwitch, powerSource], { id: 'genericSwitch' });
    button.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, button, 0, 0, 0, 0)).toBeTruthy();

    const switchServer = MatterbridgeSwitchServer.with(
      Switch.Feature.MomentarySwitch,
      Switch.Feature.MomentarySwitchRelease,
      Switch.Feature.MomentarySwitchLongPress,
      Switch.Feature.MomentarySwitchMultiPress,
    );
    expect(button.behaviors.has(switchServer)).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeSwitchServer: initializing (endpoint ${button.id}.${button.number})`);
    // The base initialize() is not chained, so CurrentPosition keeps the cluster default.
    expect(button.getAttribute(Switch, 'currentPosition')).toBe(0);
    expect(button.getAttribute(Switch, 'numberOfPositions')).toBe(2);
  });
});
