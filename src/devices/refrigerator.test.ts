// src/refrigerator.test.ts

const MATTER_PORT = 6026;
const NAME = 'Refrigerator';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
// matter.js
import { Endpoint, ServerNode, PositionTag } from '@matter/main';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { RefrigeratorAndTemperatureControlledCabinetModeServer } from '@matter/main/behaviors';
import { Identify, OnOff, PowerSource, RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/main/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { addDevice, createTestEnvironment, loggerLogSpy, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer, Refrigerator } from './refrigerator.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: Refrigerator;
  let cabinet1: MatterbridgeEndpoint;
  let cabinet2: MatterbridgeEndpoint;

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
    [server, aggregator] = await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a refrigerator device', async () => {
    device = new Refrigerator('Refrigerator Test Device', 'RF123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('RefrigeratorTestDevice-RF123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'fixedLabel']);

    cabinet1 = device.addCabinet('Refrigerator Test Cabinet Top', [{ mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label }]);
    expect(cabinet1).toBeDefined();
    expect(cabinet1.id).toBe('RefrigeratorTestCabinetTop');
    expect(cabinet1.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeTruthy();
    expect(cabinet1.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'temperatureControl', 'refrigeratorAndTemperatureControlledCabinetMode', 'refrigeratorAlarm', 'temperatureMeasurement']);

    cabinet2 = device.addCabinet('Freezer Test Cabinet Bottom', [{ mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label }]);
    expect(cabinet2).toBeDefined();
    expect(cabinet2.id).toBe('FreezerTestCabinetBottom');
    expect(cabinet2.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeTruthy();
    expect(cabinet2.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'temperatureControl', 'refrigeratorAndTemperatureControlledCabinetMode', 'refrigeratorAlarm', 'temperatureMeasurement']);
  });

  test('add a refrigerator device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer initialized`);
  });

  test('cabinet1 open door', async () => {
    expect(await device.setDoorOpenState('RefrigeratorTestCabinetTop', true)).toBeDefined();
    expect(cabinet1.getAttribute('RefrigeratorAlarm', 'state')).toEqual({ doorOpen: true });
  });

  test('cabinet1 trigger alert on open door', async () => {
    expect(await device.triggerDoorOpenState('RefrigeratorTestCabinetTop', true)).toBeDefined();
  });

  test('cabinet1 trigger alert on close door', async () => {
    expect(await device.triggerDoorOpenState('RefrigeratorTestCabinetTop', false)).toBeDefined();
  });

  test('cabinet2 open door', async () => {
    expect(await device.setDoorOpenState('FreezerTestCabinetBottom', true)).toBeDefined();
    expect(cabinet2.getAttribute('RefrigeratorAlarm', 'state')).toEqual({ doorOpen: true });
  });

  test('cabinet2 trigger alert on open door', async () => {
    expect(await device.triggerDoorOpenState('FreezerTestCabinetBottom', true)).toBeDefined();
  });

  test('cabinet2 trigger alert on close door', async () => {
    expect(await device.triggerDoorOpenState('FreezerTestCabinetBottom', false)).toBeDefined();
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
    expect(attributes.length).toBe(39); // 39 attributes for the oven device
  });

  test('cabinet1 forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    cabinet1.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
    expect(attributes.length).toBe(48); // 48 attributes for the cabinet1 device
  });

  test('cabinet2 forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    cabinet2.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
    expect(attributes.length).toBe(48); // 48 attributes for the cabinet2 device
  });

  test('invoke MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer commands', async () => {
    expect(cabinet1.behaviors.has(RefrigeratorAndTemperatureControlledCabinetModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.has(MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(RefrigeratorAndTemperatureControlledCabinetModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((cabinet1 as any).state['refrigeratorAndTemperatureControlledCabinetMode'].acceptedCommandList).toEqual([0]);
    expect((cabinet1 as any).state['refrigeratorAndTemperatureControlledCabinetMode'].generatedCommandList).toEqual([1]);

    // Change to mode 2
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'refrigeratorAndTemperatureControlledCabinetMode', 'changeToMode', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestCabinetTop.3) called with mode 2 = RapidCool`);

    // Change to mode 15
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'refrigeratorAndTemperatureControlledCabinetMode', 'changeToMode', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestCabinetTop.3) called with invalid mode 15`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
