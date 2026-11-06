/**
 * @file packages/core/buntest/behaviors/modeSelectServer.test.ts
 * @description This file contains the bun tests for modeSelectServer.
 * @author Luca Liguori
 */

const NAME = 'ModeSelectServer';
const MATTER_PORT = 13700;

import { describe, expect, test } from 'bun:test';

import { ModeSelect } from '@matter/types/clusters/mode-select';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { modeSelect } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeModeSelectServer', () => {
  useServerNode(MATTER_PORT);

  test('changeToMode forwards, sets CurrentMode and notifies the subscribers', async () => {
    const mode = new MatterbridgeEndpoint(modeSelect, { id: 'modeSelect' });
    mode.createDefaultModeSelectClusterServer('Night mode', [
      { label: 'Led ON', mode: 0, semanticTags: [] },
      { label: 'Led OFF', mode: 1, semanticTags: [] },
    ]);
    mode.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, mode, 0, 0, 0, 0)).toBeTruthy();

    const emitted: unknown[] = [];
    mode.subscribeCommand(ModeSelect, 'changeToMode', (data) => emitted.push({ command: data.command, request: data.request }));
    expect(mode.getAttribute(ModeSelect.id, 'currentMode')).toBe(0);

    await expectCommand(mode, ModeSelect, 'changeToMode', { newMode: 1 }, (data) => expect(data.cluster).toBe('modeSelect'));
    expect(mode.getAttribute(ModeSelect.id, 'currentMode')).toBe(1);
    expect(emitted).toEqual([{ command: 'changeToMode', request: { newMode: 1 } }]);
  });
});
