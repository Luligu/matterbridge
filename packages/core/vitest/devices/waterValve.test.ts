/**
 * @file packages/core/vitest/devices/waterValve.test.ts
 * @description This file contains the tests for the WaterValve device.
 * @author Luca Liguori
 */

const NAME = 'WaterValve';
const MATTER_PORT = 8031;
const MATTER_CREATE_ONLY = true;

import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';
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

import { WaterValve } from '../../src/devices/waterValve.js';
import { waterValve } from '../../src/matterbridgeDeviceTypes.js';
import { featuresFor } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: WaterValve;
  let onOffDevice: WaterValve;

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
    await createServerNode(MATTER_PORT, waterValve.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a water valve device with default options', () => {
    device = new WaterValve('Water Valve Test Device', 'WV123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('WaterValveTestDevice-WV123456');

    expect(device.hasClusterServer(Identify.id)).toBe(true);
    expect(device.hasClusterServer(ValveConfigurationAndControl.id)).toBe(true);
    expect(device.hasClusterServer(PowerSource.id)).toBe(true);
    expect(device.hasClusterServer(FlowMeasurement.id)).toBe(false);

    expect(device.getClusterServerOptions(ValveConfigurationAndControl.id)).toMatchObject({
      currentState: ValveConfigurationAndControl.ValveState.Closed,
      targetState: ValveConfigurationAndControl.ValveState.Closed,
      currentLevel: 0,
      targetLevel: 0,
      movementDuration: 0,
      autoClose: false,
    });
    expect(device.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'AC Power' });
  });

  test('create a water valve device with all options', () => {
    const fullDevice = new WaterValve('Water Valve Full Device', 'WV000001', {
      valveState: ValveConfigurationAndControl.ValveState.Open,
      valveLevel: 50,
      movementDuration: 1000,
      autoClose: true,
      flowMeasuredValue: 30,
      batteryPowered: true,
      id: 'WaterValveFullDeviceId',
    });
    expect(fullDevice.id).toBe('WaterValveFullDeviceId');
    expect(fullDevice.getClusterServerOptions(ValveConfigurationAndControl.id)).toMatchObject({
      currentState: ValveConfigurationAndControl.ValveState.Open,
      targetState: ValveConfigurationAndControl.ValveState.Open,
      currentLevel: 50,
      targetLevel: 50,
      movementDuration: 1000,
      autoClose: true,
    });
    expect(fullDevice.getClusterServerOptions(FlowMeasurement.id)).toMatchObject({ measuredValue: 30 });
    expect(fullDevice.getClusterServerOptions(PowerSource.id)).toMatchObject({ description: 'Primary battery' });
  });

  test('create an on/off water valve device', () => {
    onOffDevice = new WaterValve('Water Valve OnOff Device', 'WV000002', { level: false, valveLevel: 50, flowMeasuredValue: null });
    expect(onOffDevice.hasClusterServer(ValveConfigurationAndControl.id)).toBe(true);
    expect(onOffDevice.hasClusterServer(FlowMeasurement.id)).toBe(true);
    expect(onOffDevice.getClusterServerOptions(ValveConfigurationAndControl.id)).not.toHaveProperty('currentLevel');
  });

  test('add the water valve devices', async () => {
    expect(await addDevice(server, device)).toBe(true);
    // Sibling endpoints with the same device type need a Descriptor TagList: add the on/off valve under the aggregator
    expect(await addBridgedDevice(aggregator, onOffDevice)).toBe(true);
  });

  test('check attributes after adding the devices', () => {
    expect(featuresFor(device, ValveConfigurationAndControl.id)).toMatchObject({ level: true, timeSync: false });
    expect(featuresFor(onOffDevice, ValveConfigurationAndControl.id)).toMatchObject({ level: false, timeSync: false });
    expect(device.getCurrentState()).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(device.getCurrentLevel()).toBe(0);
    expect(onOffDevice.getCurrentState()).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(onOffDevice.getCurrentLevel()).toBeUndefined();
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
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 66, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 129 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
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
        'valveConfigurationAndControl(0x81).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'valveConfigurationAndControl(0x81).attributeList(0xfffb)=[ 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 65528, 65529, 65531, 65532, 65533 ]',
        'valveConfigurationAndControl(0x81).clusterRevision(0xfffd)=1',
        'valveConfigurationAndControl(0x81).currentLevel(0x6)=0',
        'valveConfigurationAndControl(0x81).currentState(0x4)=0',
        'valveConfigurationAndControl(0x81).defaultOpenDuration(0x1)=null',
        'valveConfigurationAndControl(0x81).defaultOpenLevel(0x8)=100',
        'valveConfigurationAndControl(0x81).featureMap(0xfffc)={ timeSync: false, level: true }',
        'valveConfigurationAndControl(0x81).generatedCommandList(0xfff8)=[  ]',
        'valveConfigurationAndControl(0x81).levelStep(0xa)=1',
        'valveConfigurationAndControl(0x81).openDuration(0x0)=null',
        'valveConfigurationAndControl(0x81).remainingDuration(0x3)=null',
        'valveConfigurationAndControl(0x81).targetLevel(0x7)=0',
        'valveConfigurationAndControl(0x81).targetState(0x5)=0',
        'valveConfigurationAndControl(0x81).valveFault(0x9)={ generalFault: false, blocked: false, leaking: false, notConnected: false, shortCircuit: false, currentExceeded: false }',
      ].toSorted(),
    );
  });

  test('openValve and closeValve run the Open/Close command logic', async () => {
    await device.openValve({ openDuration: 60, targetLevel: 80 });
    expect(device.getAttribute(ValveConfigurationAndControl, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Open);
    expect(device.getCurrentState()).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
    expect(device.getAttribute(ValveConfigurationAndControl, 'openDuration')).toBe(60);
    expect(device.getAttribute(ValveConfigurationAndControl, 'remainingDuration')).toBe(60);
    expect(device.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(80);

    // The real device reports the completed movement
    await device.setCurrentState(ValveConfigurationAndControl.ValveState.Open);
    await device.setCurrentLevel(80);
    expect(device.getCurrentState()).toBe(ValveConfigurationAndControl.ValveState.Open);
    expect(device.getCurrentLevel()).toBe(80);

    await device.closeValve();
    expect(device.getAttribute(ValveConfigurationAndControl, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(device.getCurrentState()).toBe(ValveConfigurationAndControl.ValveState.Transitioning);
    expect(device.getAttribute(ValveConfigurationAndControl, 'openDuration')).toBeNull();
    expect(device.getAttribute(ValveConfigurationAndControl, 'remainingDuration')).toBeNull();

    await device.setCurrentState(ValveConfigurationAndControl.ValveState.Closed);
    await device.setCurrentLevel(0);
    expect(device.getCurrentState()).toBe(ValveConfigurationAndControl.ValveState.Closed);
    expect(device.getCurrentLevel()).toBe(0);
  });

  test('openValve without request uses the defaults', async () => {
    await device.openValve();
    expect(device.getAttribute(ValveConfigurationAndControl, 'openDuration')).toBeNull();
    expect(device.getAttribute(ValveConfigurationAndControl.id, 'targetLevel')).toBe(100);
    await device.closeValve();
  });

  test('setCurrentLevel coerces and ignores invalid values', async () => {
    await device.setCurrentLevel(150);
    expect(device.getCurrentLevel()).toBe(100);
    await device.setCurrentLevel(Number.NaN);
    expect(device.getCurrentLevel()).toBe(100);
    await device.setCurrentLevel(null);
    expect(device.getCurrentLevel()).toBeNull();
    await device.setCurrentLevel(0);
    expect(device.getCurrentLevel()).toBe(0);
  });

  test('on/off water valve', async () => {
    await onOffDevice.openValve({ targetLevel: 50 });
    expect(onOffDevice.getAttribute(ValveConfigurationAndControl, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Open);
    await onOffDevice.setCurrentLevel(50);
    expect(onOffDevice.getCurrentLevel()).toBeUndefined();
    await onOffDevice.closeValve();
    expect(onOffDevice.getAttribute(ValveConfigurationAndControl, 'targetState')).toBe(ValveConfigurationAndControl.ValveState.Closed);
  });

  test('setFlowMeasuredValue', async () => {
    await device.setFlowMeasuredValue(30);
    expect(device.hasClusterServer(FlowMeasurement.id)).toBe(false);
    await onOffDevice.setFlowMeasuredValue(30);
    expect(onOffDevice.getAttribute(FlowMeasurement, 'measuredValue')).toBe(30);
  });

  test('remove the on/off water valve device', async () => {
    expect(await deleteDevice(aggregator, onOffDevice)).toBe(true);
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
