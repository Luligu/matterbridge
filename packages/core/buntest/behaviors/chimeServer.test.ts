/**
 * @file packages/core/buntest/behaviors/chimeServer.test.ts
 * @description This file contains the bun tests for chimeServer.
 * @author Luca Liguori
 */

const NAME = 'ChimeServerBehavior';
const MATTER_PORT = 6002;

import { describe, expect, test } from 'bun:test';

import { Chime as ChimeCluster } from '@matter/types/clusters/chime';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerDebugSpy, loggerErrorSpy, loggerInfoSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';

import { createDefaultChimeClusterServer, MatterbridgeChimeServer } from '../../src/behaviors/chimeServer.js';
import { Chime } from '../../src/devices/chime.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeChimeServer', () => {
  useServerNode(MATTER_PORT);

  test('playChimeSound and SelectedChime validate against InstalledChimeSounds, and Enabled gates playback', async () => {
    const device = new Chime('Chime Behavior', 'CHIME-BEHAVIOR', {
      installedChimeSounds: [
        { chimeId: 0, name: 'Default Chime' },
        { chimeId: 1, name: 'Chime 1' },
      ],
      selectedChime: 0,
      enabled: true,
    });
    expect(device.behaviors.has(MatterbridgeChimeServer)).toBeTruthy();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();

    const requests: unknown[] = [];
    device.subscribeCommand(ChimeCluster, 'playChimeSound', ({ request }) => requests.push(request), device.log);
    const play = async (request: ChimeCluster.PlayChimeSoundRequest): Promise<unknown> => device.invokeBehaviorCommand(ChimeCluster, 'playChimeSound', request);

    // No chimeId plays the selected chime, a valid chimeId plays that one, an unknown one is NOT_FOUND.
    await play({});
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('playing chime sound with chimeId 0'));
    await play({ chimeId: 1 });
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('playing chime sound with chimeId 1'));
    expect(play({ chimeId: 99 })).rejects.toThrow('chime sound 99 is not present in installedChimeSounds');
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('playing chime sound with chimeId 99'));

    // SelectedChime accepts only an installed chimeId.
    expect(device.setAttribute(ChimeCluster, 'selectedChime', 1, device.log)).resolves.toBe(true);
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(1);
    await device.setAttribute(ChimeCluster, 'selectedChime', 0, device.log);
    expect(device.setAttribute(ChimeCluster, 'selectedChime', 99, device.log)).rejects.toThrow('chime sound 99 is not present in installedChimeSounds');
    expect(device.getAttribute(ChimeCluster, 'selectedChime')).toBe(0);

    // While disabled the command succeeds with no side effects and is not announced.
    await device.setAttribute(ChimeCluster, 'enabled', false, device.log);
    loggerInfoSpy.mockClear();
    await play({ chimeId: 1 });
    expect(loggerInfoSpy).not.toHaveBeenCalled();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('MatterbridgeChimeServer: playChimeSound called but chime is disabled'));
    // Only the commands that actually played are announced.
    expect(requests).toEqual([{}, { chimeId: 1 }]);

    // Subscribing to a command the cluster does not have logs an error.
    device.subscribeCommand('Chime', 'playChimeSoundXX', () => {}, device.log);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('subscribeCommand error: Command'));
    loggerErrorSpy.mockClear();
  });

  test('createDefaultChimeClusterServer returns the endpoint', () => {
    const device = new Chime('Chime Helper', 'CHIME-HELPER', { powerSourceType: 'None' });
    expect(createDefaultChimeClusterServer(device, [{ chimeId: 0, name: 'Default Chime' }], 0)).toBe(device);
  });
});
