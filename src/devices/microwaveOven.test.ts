// src/microwaveOven.test.ts

const MATTER_PORT = 8010;
const NAME = 'MicrowaveOven';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';
// @matter
import { MicrowaveOvenControlServer, MicrowaveOvenModeServer } from '@matter/node/behaviors';
import { Identify, MicrowaveOvenControl, MicrowaveOvenMode, OnOff, OperationalState, PowerSource } from '@matter/types/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { wait } from '../utils/export.js';
import { addDevice, aggregator, createTestEnvironment, loggerLogSpy, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';

import { MatterbridgeMicrowaveOvenControlServer, MicrowaveOven } from './microwaveOven.js';

// Setup the test environment
setupTest(NAME, false);

// Setup the Matter test environment
createTestEnvironment(NAME);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a microwave oven device', async () => {
    device = new MicrowaveOven('Microwave Oven Test Device', 'MW123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('MicrowaveOvenTestDevice-MW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.hasClusterServer(MicrowaveOvenMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(MicrowaveOvenControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'operationalState', 'microwaveOvenMode', 'microwaveOvenControl']);
  });

  test('add a microwave oven device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer initialized`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
  });

  test('device forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(61); // 61 attributes for the microwave oven device
  });

  test('invoke MatterbridgeMicrowaveOvenControlServer commands', async () => {
    expect(device.behaviors.has(MicrowaveOvenControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeMicrowaveOvenControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(MicrowaveOvenModeServer).commands.has('changeToMode')).toBeFalsy();
    expect((device as any).state['microwaveOvenControl'].acceptedCommandList).toEqual([0, 1]);
    expect((device as any).state['microwaveOvenControl'].generatedCommandList).toEqual([]); // No response

    // Default cookTime from constructor is 60; adding 1 should log setting cookTime to 61
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'addMoreTime', { timeToAdd: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: addMoreTime called setting cookTime to 61`);

    // Adding -1 should log invalid cookTime
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'addMoreTime', { timeToAdd: -1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeMicrowaveOvenControlServer: addMoreTime called with invalid cookTime -1`);

    // Test setCookingParameters command - all unspecified -> defaults
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - valid cookMode only
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - no cookMode provided but valid cookTime and wattSettingIndex
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookTime: 120, wattSettingIndex: 3 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 120`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 3`);

    // Test setCookingParameters - invalid cookTime (<0) -> default to 30sec
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 7, cookTime: -5, wattSettingIndex: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 7`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 0`);

    // Test setCookingParameters - cookTime > maxCookTime -> default to 30sec
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookTime: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - invalid wattSettingIndex (out of range) -> default to highest supported index
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 3, cookTime: 45, wattSettingIndex: 100 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 3`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 45`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - all valid values
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 4, cookTime: 90, wattSettingIndex: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 4`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 90`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 2`);

    // Test setCookingParameters - startAfterSetting false (no change expected)
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { startAfterSetting: false });
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
    await wait(100);
    expect((device as any).state['operationalState'].operationalState).toBe(OperationalState.OperationalStateEnum.Stopped);

    // Test setCookingParameters - startAfterSetting true (transition to Running)
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { startAfterSetting: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
    await wait(100);
    expect((device as any).state['operationalState'].operationalState).toBe(OperationalState.OperationalStateEnum.Running);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
