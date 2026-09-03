/**
 * @file packages/core/vitest/behaviors/deviceEnergyManagementModeServer.test.ts
 * @description This file contains the tests for deviceEnergyManagementModeServer.
 * @author Luca Liguori
 */

const NAME = 'DeviceEnergyManagementModeServer';
const MATTER_PORT = 14100;
const MATTER_CREATE_ONLY = true;

import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
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

import { deviceEnergyManagement } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeDeviceEnergyManagementModeServer', () => {
  let energyManagement: MatterbridgeEndpoint;

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

  test('Device type: deviceEnergyManagement', async () => {
    energyManagement = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagement' });
    energyManagement.createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Other, false, DeviceEnergyManagement.EsaState.Online, -3000, 2000);
    energyManagement.createDefaultDeviceEnergyManagementModeClusterServer();
    energyManagement.addRequiredClusterServers();
    expect(energyManagement).toBeDefined();
    expect(await addDevice(aggregator, energyManagement)).toBeTruthy();
  });

  test('DeviceEnergyManagementMode server', async () => {
    const modeCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    energyManagement.addCommandHandler('changeToMode', (data) => {
      modeCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'supportedModes')).toHaveLength(5);

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 0 });
    expect(modeCalls[0]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 0 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0');

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 1 });
    expect(modeCalls[1]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 1 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.OptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 1 => No Energy Management (Forecast reporting only)',
    );

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 5 });
    expect(modeCalls[2]).toEqual({ cluster: 'deviceEnergyManagementMode', endpoint: energyManagement, request: { newMode: 5 } });
    expect(energyManagement.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(5);
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 5 => Full Energy Management');

    const originalHas = energyManagement.behaviors.has.bind(energyManagement.behaviors);
    const hasSpy = vi.spyOn(energyManagement.behaviors, 'has');
    hasSpy.mockImplementation((behavior: any) => {
      if (behavior === (DeviceEnergyManagementServer as any)) return false;
      return originalHas(behavior);
    });

    await energyManagement.setAttribute(DeviceEnergyManagement.id, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 1 });
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    await energyManagement.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode: 5 });
    expect(energyManagement.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);

    hasSpy.mockRestore();
  });
});
