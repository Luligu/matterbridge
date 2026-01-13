// src\laundryDryer.test.ts

const MATTER_PORT = 8008;
const NAME = 'LaundryDryer';
const HOMEDIR = path.join('jest', NAME);

// Import necessary modules and types
import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';
// @matter
import { Identify, LaundryDryerControls, LaundryWasherMode, OnOff, OperationalState, PowerSource, TemperatureControl } from '@matter/types/clusters';
import { LaundryWasherModeServer, TemperatureControlServer } from '@matter/node/behaviors';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { addDevice, aggregator, createTestEnvironment, deleteDevice, loggerLogSpy, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';

import { LaundryDryer } from './laundryDryer.js';
import { MatterbridgeLaundryWasherModeServer } from './laundryWasher.js';
import { MatterbridgeLevelTemperatureControlServer, MatterbridgeNumberTemperatureControlServer } from './temperatureControl.js';

// Setup the test environment
await setupTest(NAME, false);

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
  }, 10000);

  test('create a laundry dryer device', async () => {
    device = new LaundryDryer('Laundry Dryer Test Device', 'LD123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('LaundryDryerTestDevice-LD123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryDryerControls.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
  });

  test('add a laundry dryer device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLevelTemperatureControlServer initialized with selectedTemperatureLevel 1 and supportedTemperatureLevels: Cold, Warm, Hot, 30°, 40°, 60°, 80°`);
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
    expect(attributes.length).toBe(72);
  });

  test('invoke MatterbridgeLaundryWasherModeServer commands', async () => {
    expect(device.behaviors.has(LaundryWasherModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeLaundryWasherModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(LaundryWasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeLaundryWasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['laundryWasherMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['laundryWasherMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'onOff', 'off', {}); // Dead Front state
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'laundryWasherMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeLaundryWasherModeServer: changeToMode called with invalid mode 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'laundryWasherMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `ChangeToMode (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeLaundryWasherModeServer: changeToMode called with mode 1 => Delicate`);
  });

  test('invoke MatterbridgeLevelTemperatureControlServer commands', async () => {
    expect(device.behaviors.has(TemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeLevelTemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(TemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeLevelTemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect((device as any).state['temperatureControl'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['temperatureControl'].generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperatureLevel: 100 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeLevelTemperatureControlServer: setTemperature called with invalid targetTemperatureLevel 100`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperatureLevel: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeLevelTemperatureControlServer: setTemperature called setting selectedTemperatureLevel to 2: Hot`);
  });

  test('remove the laundry washer device', async () => {
    expect(await deleteDevice(server, device)).toBeTruthy();
  });

  test('create a laundry dryer device with number temperature control', async () => {
    device = new LaundryDryer('Laundry Dryer Test Device', 'LD123456', undefined, undefined, undefined, undefined, 5500, 3000, 9000, 1000);
    expect(device).toBeDefined();
    expect(device.id).toBe('LaundryDryerTestDevice-LD123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryDryerControls.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
  });

  test('add a laundry dryer device with number temperature control', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeNumberTemperatureControlServer initialized with temperatureSetpoint 5500 minTemperature 3000 maxTemperature 9000 step 1000`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
  });

  test('invoke MatterbridgeNumberTemperatureControlServer commands', async () => {
    expect(device.behaviors.has(TemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeNumberTemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(TemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeNumberTemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect((device as any).state['temperatureControl'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['temperatureControl'].generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperature: 3 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeNumberTemperatureControlServer: setTemperature called with invalid targetTemperature 3`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperature: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to 5000`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
