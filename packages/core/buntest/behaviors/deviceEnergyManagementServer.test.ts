/**
 * @file packages/core/buntest/behaviors/deviceEnergyManagementServer.test.ts
 * @description This file contains the bun tests for deviceEnergyManagementServer.
 * @author Luca Liguori
 */

const NAME = 'DeviceEnergyManagementServer';
const MATTER_PORT = 11800;

import { describe, expect, test, vi } from 'bun:test';

import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { deviceEnergyManagement } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { advanceTimersByTimeAsync, expectCommand, recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { AdjustmentCause, Cause, EsaState, OptOutState, PowerAdjustReason } = DeviceEnergyManagement;
const capability = [{ minPower: 500_000, maxPower: 2_000_000, minDuration: 10, maxDuration: 60 }];

// One ESA endpoint is shared by the sequential tests below: each one starts from the state the previous one left.
describe('MatterbridgeDeviceEnergyManagementServer', () => {
  useServerNode(MATTER_PORT);
  let esa: MatterbridgeEndpoint;
  const powerAdjustStart = vi.fn();
  const powerAdjustEnd = vi.fn();
  const esaState = (): unknown => esa.getAttribute(DeviceEnergyManagement, 'esaState');
  const capabilityCause = (): unknown => (esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability') as { cause?: number } | null)?.cause;
  const adjust = async (cause: DeviceEnergyManagement.AdjustmentCause, power = 2_000_000, duration = 60): Promise<unknown> =>
    esa.invokeBehaviorCommand(DeviceEnergyManagement, 'powerAdjustRequest', { power, duration, cause });
  const cancel = async (): Promise<unknown> => esa.invokeBehaviorCommand(DeviceEnergyManagement, 'cancelPowerAdjustRequest');
  const setOptOut = async (state: DeviceEnergyManagement.OptOutState): Promise<unknown> => esa.setAttribute(DeviceEnergyManagement, 'optOutState', state);

  test('a new ESA is Online with no capability', async () => {
    esa = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagement' });
    esa.createDefaultDeviceEnergyManagementClusterServer();
    esa.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, esa, 0, 0, 0, 0)).toBeTruthy();
    expect(esaState()).toBe(EsaState.Online);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toBeNull();
    expect(esa.getAttribute(DeviceEnergyManagement, 'optOutState')).toBe(OptOutState.NoOptOut);
    const events = esa.eventsOf('deviceEnergyManagement') as unknown as Record<'powerAdjustStart' | 'powerAdjustEnd', { on: (listener: (event: unknown) => void) => void }>;
    events.powerAdjustStart.on(powerAdjustStart);
    events.powerAdjustEnd.on(powerAdjustEnd);
  });

  test('PowerAdjustRequest validates the capability, the Power and Duration ranges, and the opt-out state', async () => {
    expect(adjust(AdjustmentCause.LocalOptimization, 1_000_000, 10)).rejects.toThrow('MatterbridgeDeviceEnergyManagementServer: no power adjustment capability available');
    await esa.setAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability', { powerAdjustCapability: capability, cause: PowerAdjustReason.NoAdjustment });
    expect(adjust(AdjustmentCause.LocalOptimization, 2_000_001, 10)).rejects.toThrow('MatterbridgeDeviceEnergyManagementServer: power or duration out of range');
    expect(adjust(AdjustmentCause.LocalOptimization, 1_000_000, 9)).rejects.toThrow('MatterbridgeDeviceEnergyManagementServer: power or duration out of range');
    await setOptOut(OptOutState.LocalOptOut);
    expect(adjust(AdjustmentCause.LocalOptimization, 1_000_000, 10)).rejects.toThrow('MatterbridgeDeviceEnergyManagementServer: user has opted out of this adjustment cause');
    await setOptOut(OptOutState.NoOptOut);
    expect(esaState()).toBe(EsaState.Online);
    expect(powerAdjustStart).not.toHaveBeenCalled();
  });

  test('a session starts once, a cause-only update keeps it, and CancelPowerAdjustRequest ends it', async () => {
    const emitted: string[] = [];
    esa.subscribeCommand(DeviceEnergyManagement, 'powerAdjustRequest', (data) => emitted.push(data.command));
    esa.subscribeCommand(DeviceEnergyManagement, 'cancelPowerAdjustRequest', (data) => emitted.push(data.command));

    await adjust(AdjustmentCause.LocalOptimization);
    expect(esaState()).toBe(EsaState.PowerAdjustActive);
    expect(capabilityCause()).toBe(PowerAdjustReason.LocalOptimizationAdjustment);
    await adjust(AdjustmentCause.GridOptimization);
    expect(capabilityCause()).toBe(PowerAdjustReason.GridOptimizationAdjustment);
    expect(powerAdjustStart).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd).not.toHaveBeenCalled();

    await cancel();
    expect(esaState()).toBe(EsaState.Online);
    expect(capabilityCause()).toBe(PowerAdjustReason.NoAdjustment);
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: Cause.Cancelled });
    // Nothing active any more: rejected, and not announced.
    expect(cancel()).rejects.toThrow('MatterbridgeDeviceEnergyManagementServer: no power adjustment is currently active');
    expect(emitted).toEqual(['powerAdjustRequest', 'powerAdjustRequest', 'cancelPowerAdjustRequest']);
  });

  test.each([
    ['Grid', AdjustmentCause.GridOptimization, OptOutState.LocalOptOut],
    ['Local', AdjustmentCause.LocalOptimization, OptOutState.GridOptOut],
  ] as const)('an OptOutState change cancels a %s-caused session only when it covers that cause', async (_label, cause, otherOptOut) => {
    powerAdjustEnd.mockClear();
    await adjust(cause);
    expect(esaState()).toBe(EsaState.PowerAdjustActive);
    // Opting out of the other cause leaves the session running.
    await setOptOut(otherOptOut);
    expect(esaState()).toBe(EsaState.PowerAdjustActive);
    expect(powerAdjustEnd).not.toHaveBeenCalled();
    // Opting out of every cause cancels it as if CancelPowerAdjustRequest had been sent.
    await setOptOut(OptOutState.OptOut);
    expect(esaState()).toBe(EsaState.Online);
    expect(capabilityCause()).toBe(PowerAdjustReason.NoAdjustment);
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: Cause.UserOptOut });
    await setOptOut(OptOutState.NoOptOut);
  });

  test('CancelPowerAdjustRequest tolerates PowerAdjustmentCapability cleared during the session', async () => {
    powerAdjustEnd.mockClear();
    await adjust(AdjustmentCause.LocalOptimization);
    await esa.setAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability', null);
    await cancel();
    expect(esaState()).toBe(EsaState.Online);
    expect(esa.getAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability')).toMatchObject({ powerAdjustCapability: [], cause: PowerAdjustReason.NoAdjustment });
    expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
    await esa.setAttribute(DeviceEnergyManagement, 'powerAdjustmentCapability', { powerAdjustCapability: capability, cause: PowerAdjustReason.NoAdjustment });
  });

  test('a session completes normally after its requested duration', async () => {
    powerAdjustEnd.mockClear();
    vi.useFakeTimers();
    try {
      await adjust(AdjustmentCause.LocalOptimization, 2_000_000, 10);
      expect(esaState()).toBe(EsaState.PowerAdjustActive);
      await advanceTimersByTimeAsync(10_000, 10);
      expect(esaState()).toBe(EsaState.Online);
      expect(powerAdjustEnd).toHaveBeenCalledTimes(1);
      expect(powerAdjustEnd.mock.calls[0]?.[0]).toMatchObject({ cause: Cause.NormalCompletion });
    } finally {
      vi.useRealTimers();
    }
  });

  test('both commands are forwarded to the plugin handler first', async () => {
    const device = new MatterbridgeEndpoint(deviceEnergyManagement, { id: 'deviceEnergyManagementHandler' });
    device.createDefaultDeviceEnergyManagementClusterServer(DeviceEnergyManagement.EsaType.Other, false, EsaState.Online, -3000, 2000);
    device.createDefaultDeviceEnergyManagementModeClusterServer();
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(DeviceEnergyManagement.id, 'esaType')).toBe(DeviceEnergyManagement.EsaType.Other);
    expect(device.getAttribute(DeviceEnergyManagement.id, 'absMinPower')).toBe(-3000);
    expect(device.getAttribute(DeviceEnergyManagement.id, 'absMaxPower')).toBe(2000);
    await device.setAttribute(DeviceEnergyManagement.id, 'powerAdjustmentCapability', {
      powerAdjustCapability: [{ minPower: 0, maxPower: 1000, minDuration: 10, maxDuration: 120 }],
      cause: PowerAdjustReason.NoAdjustment,
    });
    const label = `(endpoint ${device.id}.${device.number})`;
    const request = { power: 500, duration: 60, cause: AdjustmentCause.LocalOptimization };
    await expectCommand(device, DeviceEnergyManagement, 'powerAdjustRequest', request, (data) => expect(data.cluster).toBe('deviceEnergyManagement'));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      `MatterbridgeDeviceEnergyManagementServer: powerAdjustRequest called with power 500 duration 60 cause ${request.cause} ${label}`,
    );

    const cancelCalls = recordCommand(device, 'cancelPowerAdjustRequest');
    await device.invokeBehaviorCommand('deviceEnergyManagement', 'cancelPowerAdjustRequest');
    expect(cancelCalls).toEqual([{ cluster: 'deviceEnergyManagement', endpoint: device, request: {} }]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeDeviceEnergyManagementServer: cancelPowerAdjustRequest called ${label}`);
    expect(device.getAttribute(DeviceEnergyManagement.id, 'optOutState')).toBe(OptOutState.NoOptOut);
  });
});
