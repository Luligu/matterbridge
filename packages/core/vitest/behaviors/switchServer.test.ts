/**
 * @file packages/core/vitest/behaviors/switchServer.test.ts
 * @description This file contains the tests for switchServer.
 * @author Luca Liguori
 */

const NAME = 'SwitchServer';
const MATTER_PORT = 12800;
const MATTER_CREATE_ONLY = true;

import { Switch } from '@matter/types/clusters/switch';
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

import { MatterbridgeSwitchServer } from '../../src/behaviors/switchServer.js';
import { genericSwitch, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeSwitchServer', () => {
  let button: MatterbridgeEndpoint;

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

  test('Switch server', async () => {
    button = new MatterbridgeEndpoint([genericSwitch, powerSource], { id: 'genericSwitch' });
    button.addRequiredClusterServers();
    expect(button).toBeDefined();
    expect(await addDevice(aggregator, button)).toBeTruthy();

    // MatterbridgeSwitchServer overrides initialize() to log only and deliberately does not chain to
    // super.initialize(): switch state is driven entirely by the device implementation through triggerSwitchEvent(),
    // so the base server must not install its own handling. The log line is the observable proof the override ran.
    const switchServer = MatterbridgeSwitchServer.with(
      Switch.Feature.MomentarySwitch,
      Switch.Feature.MomentarySwitchRelease,
      Switch.Feature.MomentarySwitchLongPress,
      Switch.Feature.MomentarySwitchMultiPress,
    );
    expect(button.behaviors.has(switchServer)).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeSwitchServer: initializing (endpoint ${button.id}.${button.number})`);

    // The base server's own initialize() would have seeded currentPosition; it stays at the cluster default here.
    expect(button.getAttribute(Switch, 'currentPosition')).toBe(0);
    expect(button.getAttribute(Switch, 'numberOfPositions')).toBe(2);
  });
});
