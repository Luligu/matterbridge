/**
 * @file packages/core/vitest/behaviors/modeSelectServer.test.ts
 * @description This file contains the tests for modeSelectServer.
 * @author Luca Liguori
 */

const NAME = 'ModeSelectServer';
const MATTER_PORT = 13700;
const MATTER_CREATE_ONLY = true;

import { ModeSelect } from '@matter/types/clusters/mode-select';
import { setupTest } from '@matterbridge/vitest-utils';
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

import { modeSelect } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeModeSelectServer', () => {
  let mode: MatterbridgeEndpoint;

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

  test('Device type: modeSelect', async () => {
    mode = new MatterbridgeEndpoint(modeSelect, { id: 'modeSelect' });
    mode.createDefaultModeSelectClusterServer('Night mode', [
      { label: 'Led ON', mode: 0, semanticTags: [] },
      { label: 'Led OFF', mode: 1, semanticTags: [] },
    ]);
    mode.addRequiredClusterServers();
    expect(mode).toBeDefined();
    expect(await addDevice(aggregator, mode)).toBeTruthy();
  });

  test('ModeSelect server', async () => {
    expect(mode.getAttribute(ModeSelect.id, 'currentMode')).toBe(0);

    await expectCommand(mode, ModeSelect, 'changeToMode', { newMode: 1 }, (data) => {
      expect(data.cluster).toBe('modeSelect');
    });

    expect(mode.getAttribute(ModeSelect.id, 'currentMode')).toBe(1);
  });
});
