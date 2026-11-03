/**
 * @file packages/core/vitest/devices/pump.test.ts
 * @description This file contains the tests for the Pump device.
 * @author Luca Liguori
 */

const NAME = 'Pump';
const MATTER_PORT = 8030;
const MATTER_CREATE_ONLY = true;

import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { PowerSource } from '@matter/types/clusters/power-source';
import { PressureMeasurement } from '@matter/types/clusters/pressure-measurement';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';

import { Pump } from '../../src/devices/pump.js';
import { pump } from '../../src/matterbridgeDeviceTypes.js';
import { featuresFor } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Pump;
  let noLevelDevice: Pump;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, pump.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a pump device with default options', () => {
    device = new Pump('Pump Test Device', 'PU123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('PumpTestDevice-PU123456');

    expect(device.hasClusterServer(Identify.id)).toBe(true);
    expect(device.hasClusterServer(OnOff.id)).toBe(true);
    expect(device.hasClusterServer(LevelControl.id)).toBe(true);
    expect(device.hasClusterServer(PumpConfigurationAndControl.id)).toBe(true);
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);
    expect(device.hasClusterServer(TemperatureMeasurement.id)).toBe(false);
    expect(device.hasClusterServer(PressureMeasurement.id)).toBe(false);
    expect(device.hasClusterServer(FlowMeasurement.id)).toBe(false);

    expect(device.getClusterServerOptions(OnOff.id)).toMatchObject({ onOff: false });
    expect(device.getClusterServerOptions(LevelControl.id)).toMatchObject({ currentLevel: 254 });
    expect(device.getClusterServerOptions(PumpConfigurationAndControl.id)).toMatchObject({
      operationMode: PumpConfigurationAndControl.OperationMode.Normal,
      effectiveOperationMode: PumpConfigurationAndControl.OperationMode.Normal,
      controlMode: PumpConfigurationAndControl.ControlMode.ConstantSpeed,
      maxPressure: null,
      maxSpeed: null,
      maxFlow: null,
      minConstSpeed: null,
      maxConstSpeed: null,
    });
    expect(device.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'AC Power' });
  });

  test('create a pump device with all options', () => {
    const fullDevice = new Pump('Pump Full Device', 'PU000001', {
      onOff: true,
      currentLevel: 100,
      operationMode: PumpConfigurationAndControl.OperationMode.Maximum,
      maxPressure: 5000,
      maxSpeed: 2800,
      maxFlow: 80,
      minConstSpeed: 500,
      maxConstSpeed: 2800,
      temperatureMeasuredValue: 2500,
      pressureMeasuredValue: 1200,
      flowMeasuredValue: null,
      batteryPowered: true,
      id: 'PumpFullDeviceId',
    });
    expect(fullDevice.id).toBe('PumpFullDeviceId');
    expect(fullDevice.getClusterServerOptions(OnOff.id)).toMatchObject({ onOff: true });
    expect(fullDevice.getClusterServerOptions(LevelControl.id)).toMatchObject({ currentLevel: 100 });
    expect(fullDevice.getClusterServerOptions(PumpConfigurationAndControl.id)).toMatchObject({
      operationMode: PumpConfigurationAndControl.OperationMode.Maximum,
      maxPressure: 5000,
      maxSpeed: 2800,
      maxFlow: 80,
      minConstSpeed: 500,
      maxConstSpeed: 2800,
    });
    expect(fullDevice.getClusterServerOptions(TemperatureMeasurement.id)).toMatchObject({ measuredValue: 2500 });
    expect(fullDevice.getClusterServerOptions(PressureMeasurement.id)).toMatchObject({ measuredValue: 1200 });
    expect(fullDevice.getClusterServerOptions(FlowMeasurement.id)).toMatchObject({ measuredValue: null });
    expect(fullDevice.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'Primary battery' });
  });

  test('create a pump device without level control', () => {
    noLevelDevice = new Pump('Pump No Level Device', 'PU000002', { levelControl: false, currentLevel: 100 });
    expect(noLevelDevice.hasClusterServer(OnOff.id)).toBe(true);
    expect(noLevelDevice.hasClusterServer(LevelControl.id)).toBe(false);
    expect(noLevelDevice.hasClusterServer(PumpConfigurationAndControl.id)).toBe(true);
  });

  test('add the pump devices', async () => {
    expect(await addDevice(server, device)).toBe(true);
    expect(await addDevice(server, noLevelDevice)).toBe(true);
  });

  test('check attributes after adding the device', () => {
    expect(featuresFor(device, PumpConfigurationAndControl.id)).toMatchObject({ constantSpeed: true });
    expect(device.getOnOff()).toBe(false);
    expect(device.getLevel()).toBe(254);
    expect(device.getOperationMode()).toBe(PumpConfigurationAndControl.OperationMode.Normal);
    // Defaults filled in by MatterbridgePumpConfigurationAndControlServer.initialize()
    expect(device.getAttribute(PumpConfigurationAndControl, 'maxConstSpeed')).toBe(3000);
    expect(device.getAttribute(PumpConfigurationAndControl, 'minConstSpeed')).toBe(600);
  });

  test('setOnOff starts and stops the pump', async () => {
    await device.setOnOff(true);
    expect(device.getOnOff()).toBe(true);
    expect(device.getSpeed()).toBe(3000);
    expect(device.getCapacity()).toBe(20000);
    expect(device.getAttribute(PumpConfigurationAndControl, 'pumpStatus')?.running).toBe(true);

    await device.setOnOff(false);
    expect(device.getOnOff()).toBe(false);
    expect(device.getSpeed()).toBe(0);
    expect(device.getCapacity()).toBe(0);
    expect(device.getAttribute(PumpConfigurationAndControl, 'pumpStatus')?.running).toBe(false);
  });

  test('setLevel changes the pump setpoint', async () => {
    await device.setOnOff(true);
    await device.setLevel(100);
    expect(device.getLevel()).toBe(100);
    expect(device.getSpeed()).toBe(1500);
    expect(device.getCapacity()).toBe(10000);

    // Coerced to the 0..254 range
    await device.setLevel(300);
    expect(device.getLevel()).toBe(254);
    expect(device.getSpeed()).toBe(3000);

    // Non-finite values are ignored
    await device.setLevel(Number.NaN);
    expect(device.getLevel()).toBe(254);
  });

  test('setOperationMode changes the pump operation mode', async () => {
    await device.setOperationMode(PumpConfigurationAndControl.OperationMode.Minimum);
    expect(device.getOperationMode()).toBe(PumpConfigurationAndControl.OperationMode.Minimum);
    expect(device.getAttribute(PumpConfigurationAndControl, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Minimum);
    expect(device.getSpeed()).toBe(600);

    await device.setOperationMode(PumpConfigurationAndControl.OperationMode.Normal);
    expect(device.getOperationMode()).toBe(PumpConfigurationAndControl.OperationMode.Normal);
    expect(device.getSpeed()).toBe(3000);
    await device.setOnOff(false);
  });

  test('pump without level control', async () => {
    expect(noLevelDevice.getLevel()).toBeUndefined();
    await noLevelDevice.setLevel(100);
    expect(noLevelDevice.getLevel()).toBeUndefined();
    await noLevelDevice.setOnOff(true);
    expect(noLevelDevice.getOnOff()).toBe(true);
    await noLevelDevice.setOnOff(false);
    expect(noLevelDevice.getOnOff()).toBe(false);
  });

  test('measurement setters are ignored without the measurement clusters', async () => {
    await device.setTemperatureMeasuredValue(2500);
    await device.setPressureMeasuredValue(1200);
    await device.setFlowMeasuredValue(50);
    expect(device.hasClusterServer(TemperatureMeasurement.id)).toBe(false);
    expect(device.hasClusterServer(PressureMeasurement.id)).toBe(false);
    expect(device.hasClusterServer(FlowMeasurement.id)).toBe(false);
  });

  test('measurement setters update the measurement clusters', async () => {
    const sensorDevice = new Pump('Pump Sensor Device', 'PU000003', { temperatureMeasuredValue: null, pressureMeasuredValue: null, flowMeasuredValue: null });
    expect(await addDevice(server, sensorDevice)).toBe(true);
    await sensorDevice.setTemperatureMeasuredValue(2500);
    await sensorDevice.setPressureMeasuredValue(1200);
    await sensorDevice.setFlowMeasuredValue(50);
    expect(sensorDevice.getAttribute(TemperatureMeasurement, 'measuredValue')).toBe(2500);
    expect(sensorDevice.getAttribute(PressureMeasurement, 'measuredValue')).toBe(1200);
    expect(sensorDevice.getAttribute(FlowMeasurement, 'measuredValue')).toBe(50);
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
