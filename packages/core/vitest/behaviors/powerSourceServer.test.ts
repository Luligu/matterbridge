/**
 * @file packages/core/vitest/behaviors/powerSourceServer.test.ts
 * @description This file contains the tests for powerSourceServer.
 * @author Luca Liguori
 */

const NAME = 'PowerSourceServer';
const MATTER_PORT = 12700;
const MATTER_CREATE_ONLY = true;

import { PowerSource } from '@matter/types/clusters/power-source';
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

import { bridge, extendedColorLight, lightSensor, occupancySensor, powerSource, temperatureSensor } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgePowerSourceServer', () => {
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

  test('PowerSource server', async () => {
    const poweredDevice = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'powerSourceTest' });
    const constructionCallbacks: Array<() => unknown> = [];
    const onSuccess = poweredDevice.construction.onSuccess.bind(poweredDevice.construction);

    vi.spyOn(poweredDevice.construction, 'onSuccess').mockImplementation((callback) => {
      constructionCallbacks.push(callback);
      return onSuccess(callback);
    });

    poweredDevice.createDefaultBridgedDeviceBasicInformationClusterServer('PowerSource Test', 'SNPS123456');
    poweredDevice.createDefaultPowerSourceWiredClusterServer();
    poweredDevice.addRequiredClusterServers();

    poweredDevice.addChildDeviceType('temperature', temperatureSensor).addRequiredClusterServers();
    poweredDevice.addChildDeviceType('light', lightSensor).addRequiredClusterServers();
    const notReadyChild = poweredDevice.addChildDeviceType('pending', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, poweredDevice)).toBeTruthy();
    vi.spyOn(notReadyChild.lifecycle, 'isReady', 'get').mockReturnValue(false);
    await Promise.resolve(constructionCallbacks.at(-1)?.());
    expect(poweredDevice.getAttribute(PowerSource.id, 'endpointList')).toEqual([
      poweredDevice.number,
      ...poweredDevice.parts.filter((endpoint) => endpoint.lifecycle.isReady).map((endpoint) => endpoint.number),
    ]);
  });
});
