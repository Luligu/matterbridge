/**
 * @file packages/core/buntest/behaviors/deviceEnergyManagementModeServer.test.ts
 * @description This file contains the bun tests for deviceEnergyManagementModeServer.
 * @author Luca Liguori
 */

const NAME = 'DeviceEnergyManagementModeServer';
const MATTER_PORT = 14100;

import { describe, expect, spyOn, test } from 'bun:test';

import { DeviceEnergyManagementServer } from '@matter/node/behaviors/device-energy-management';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { DeviceEnergyManagementMode } from '@matter/types/clusters/device-energy-management-mode';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { deviceEnergyManagement } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeDeviceEnergyManagementModeServer', () => {
  useServerNode(MATTER_PORT);

  test('changeToMode forwards every request, rejects unsupported modes and syncs OptOutState', async () => {
    const device = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagement' });
    device.createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Other, false, DeviceEnergyManagement.EsaState.Online, -3000, 2000);
    device.createDefaultDeviceEnergyManagementModeClusterServer();
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(device.getAttribute(DeviceEnergyManagementMode.id, 'supportedModes')).toHaveLength(5);

    const emitted: number[] = [];
    device.subscribeCommand(DeviceEnergyManagementMode, 'changeToMode', (data) => emitted.push(data.request.newMode));
    const calls = recordCommand(device, 'changeToMode');
    const label = `(endpoint ${device.id}.${device.number})`;
    const changeToMode = async (newMode: number): Promise<unknown> => device.invokeBehaviorCommand(DeviceEnergyManagementMode, 'changeToMode', { newMode });

    // Unsupported mode: forwarded, logged, CurrentMode unchanged.
    await changeToMode(0);
    expect(device.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeDeviceEnergyManagementModeServer: changeToMode called with unsupported newMode 0 ${label}`);

    // Mode 1 (no energy management) opts out, mode 5 (full energy management) opts back in.
    await changeToMode(1);
    expect(device.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.OptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeDeviceEnergyManagementModeServer: changeToMode called with newMode 1 => No Energy Management (Forecast reporting only) ${label}`,
    );
    await changeToMode(5);
    expect(device.getAttribute(DeviceEnergyManagementMode.id, 'currentMode')).toBe(5);
    expect(device.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeDeviceEnergyManagementModeServer: changeToMode called with newMode 5 => Full Energy Management ${label}`,
    );
    expect(calls.map((call) => call.request)).toEqual([{ newMode: 0 }, { newMode: 1 }, { newMode: 5 }]);
    expect(calls.every((call) => call.cluster === 'deviceEnergyManagementMode' && call.endpoint === device)).toBe(true);

    // Without a DeviceEnergyManagement server the mode change leaves OptOutState alone.
    const originalHas = device.behaviors.has.bind(device.behaviors);
    const hasSpy = spyOn(device.behaviors, 'has').mockImplementation((behavior: unknown) =>
      behavior === (DeviceEnergyManagementServer as unknown) ? false : originalHas(behavior as Parameters<typeof originalHas>[0]),
    );
    try {
      await device.setAttribute(DeviceEnergyManagement.id, 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut);
      await changeToMode(1);
      await changeToMode(5);
      expect(device.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(DeviceEnergyManagement.OptOutState.NoOptOut);
    } finally {
      hasSpy.mockRestore();
    }
    // The unsupported mode 0 is not announced, the accepted changes are.
    expect(emitted).toEqual([1, 5, 1, 5]);
  });
});
