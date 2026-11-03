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
  addBridgedDevice,
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  deleteDevice,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '@matterbridge/test-utils/vitest/matter';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { stringify } from 'node-ansi-logger';

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
    // Sibling endpoints with the same device type need a Descriptor TagList: add the other pumps under the aggregator, one at a time
    expect(await addBridgedDevice(aggregator, noLevelDevice)).toBe(true);
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

  test('device forEachAttribute', () => {
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;
      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .toSorted(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 771, revision: 4 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 6, 8, 29, 47, 512 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'levelControl(0x8).acceptedCommandList(0xfff9)=[ 0, 1, 2, 3, 4, 5, 6, 7 ]',
        'levelControl(0x8).attributeList(0xfffb)=[ 0, 2, 3, 15, 17, 65528, 65529, 65531, 65532, 65533 ]',
        'levelControl(0x8).clusterRevision(0xfffd)=7',
        'levelControl(0x8).currentLevel(0x0)=254',
        'levelControl(0x8).featureMap(0xfffc)={ onOff: false, lighting: false, frequency: false }',
        'levelControl(0x8).generatedCommandList(0xfff8)=[  ]',
        'levelControl(0x8).maxLevel(0x3)=254',
        'levelControl(0x8).minLevel(0x2)=0',
        'levelControl(0x8).onLevel(0x11)=null',
        'levelControl(0x8).options(0xf)={ executeIfOff: false, coupleColorTempToLevel: false }',
        'onOff(0x6).acceptedCommandList(0xfff9)=[ 0, 1, 2 ]',
        'onOff(0x6).attributeList(0xfffb)=[ 0, 65528, 65529, 65531, 65532, 65533 ]',
        'onOff(0x6).clusterRevision(0xfffd)=6',
        'onOff(0x6).featureMap(0xfffc)={ lighting: false, deadFrontBehavior: false, offOnly: false }',
        'onOff(0x6).generatedCommandList(0xfff8)=[  ]',
        'onOff(0x6).onOff(0x0)=false',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'pumpConfigurationAndControl(0x200).acceptedCommandList(0xfff9)=[  ]',
        'pumpConfigurationAndControl(0x200).attributeList(0xfffb)=[ 0, 1, 2, 7, 8, 16, 17, 18, 19, 20, 32, 33, 65528, 65529, 65531, 65532, 65533 ]',
        'pumpConfigurationAndControl(0x200).capacity(0x13)=null',
        'pumpConfigurationAndControl(0x200).clusterRevision(0xfffd)=5',
        'pumpConfigurationAndControl(0x200).controlMode(0x21)=0',
        'pumpConfigurationAndControl(0x200).effectiveControlMode(0x12)=0',
        'pumpConfigurationAndControl(0x200).effectiveOperationMode(0x11)=0',
        'pumpConfigurationAndControl(0x200).featureMap(0xfffc)={ constantPressure: false, compensatedPressure: false, constantFlow: false, constantSpeed: true, constantTemperature: false, automatic: false, localOperation: false }',
        'pumpConfigurationAndControl(0x200).generatedCommandList(0xfff8)=[  ]',
        'pumpConfigurationAndControl(0x200).maxConstSpeed(0x8)=3000',
        'pumpConfigurationAndControl(0x200).maxFlow(0x2)=100',
        'pumpConfigurationAndControl(0x200).maxPressure(0x0)=6000',
        'pumpConfigurationAndControl(0x200).maxSpeed(0x1)=3000',
        'pumpConfigurationAndControl(0x200).minConstSpeed(0x7)=600',
        'pumpConfigurationAndControl(0x200).operationMode(0x20)=0',
        'pumpConfigurationAndControl(0x200).pumpStatus(0x10)={ deviceFault: false, supplyFault: false, speedLow: false, speedHigh: false, localOverride: false, running: false, remotePressure: false, remoteFlow: false, remoteTemperature: false }',
        'pumpConfigurationAndControl(0x200).speed(0x14)=null',
      ].toSorted(),
    );
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
    expect(await deleteDevice(aggregator, noLevelDevice)).toBe(true);
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
    expect(await addBridgedDevice(aggregator, sensorDevice)).toBe(true);
    await sensorDevice.setTemperatureMeasuredValue(2500);
    await sensorDevice.setPressureMeasuredValue(1200);
    await sensorDevice.setFlowMeasuredValue(50);
    expect(sensorDevice.getAttribute(TemperatureMeasurement, 'measuredValue')).toBe(2500);
    expect(sensorDevice.getAttribute(PressureMeasurement, 'measuredValue')).toBe(1200);
    expect(sensorDevice.getAttribute(FlowMeasurement, 'measuredValue')).toBe(50);
    expect(await deleteDevice(aggregator, sensorDevice)).toBe(true);
  });

  test('a pump created already on starts running at the stored level', async () => {
    const onDevice = new Pump('Pump On Device', 'PU000004', { onOff: true, currentLevel: 100 });
    expect(await addBridgedDevice(aggregator, onDevice)).toBe(true);
    expect(onDevice.getOnOff()).toBe(true);
    expect(onDevice.getSpeed()).toBe(1500);
    expect(onDevice.getCapacity()).toBe(10000);
    expect(onDevice.getAttribute(PumpConfigurationAndControl, 'pumpStatus')?.running).toBe(true);
    expect(await deleteDevice(aggregator, onDevice)).toBe(true);
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
