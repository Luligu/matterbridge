// src/oven.test.ts

const MATTER_PORT = 6024;
const NAME = 'Oven';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
// @matter
import { LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/general';
import { DeviceTypeId, VendorId } from '@matter/types';
import { MdnsService } from '@matter/protocol';
import { ServerNode, Endpoint, PositionTag } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { OvenCavityOperationalStateServer, OvenModeServer } from '@matter/node/behaviors';
import { Identify, OnOff, OperationalState, OvenCavityOperationalState, OvenMode, PowerSource } from '@matter/types/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { addDevice, createTestEnvironment, loggerLogSpy, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { MatterbridgeOvenCavityOperationalStateServer, MatterbridgeOvenModeServer, Oven } from './oven.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: Oven;
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

  test('create a oven device', async () => {
    device = new Oven('Oven Test Device', 'OV123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('OvenTestDevice-OV123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'fixedLabel']);

    cabinet1 = device.addCabinet('Oven Test Cabinet Top', [{ mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label }]);
    expect(cabinet1).toBeDefined();
    expect(cabinet1.id).toBe('OvenTestCabinetTop');
    expect(cabinet1.hasClusterServer(OvenMode.Cluster.id)).toBeTruthy();
    expect(cabinet1.hasClusterServer(OvenCavityOperationalState.Cluster.id)).toBeTruthy();
    expect(cabinet1.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'temperatureControl', 'temperatureMeasurement', 'ovenMode', 'ovenCavityOperationalState']);

    cabinet2 = device.addCabinet(
      'Oven Test Cabinet Bottom',
      [{ mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label }],
      3,
      [
        { label: 'Convection', mode: 1, modeTags: [{ value: OvenMode.ModeTag.Convection }] },
        { label: 'Clean', mode: 2, modeTags: [{ value: OvenMode.ModeTag.Clean }] },
        { label: 'Steam', mode: 3, modeTags: [{ value: OvenMode.ModeTag.Steam }] },
      ],
      2,
      ['180°', '190°', '200°'],
      OperationalState.OperationalStateEnum.Running,
      1,
      ['pre-heating', 'pre-heated', 'cooling down'],
    );
    expect(cabinet2).toBeDefined();
    expect(cabinet2.id).toBe('OvenTestCabinetBottom');
    expect(cabinet2.hasClusterServer(OvenMode.Cluster.id)).toBeTruthy();
    expect(cabinet2.hasClusterServer(OvenCavityOperationalState.Cluster.id)).toBeTruthy();
    expect(cabinet2.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'temperatureControl', 'temperatureMeasurement', 'ovenMode', 'ovenCavityOperationalState']);
  });

  test('add a oven device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenModeServer initialized`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenCavityOperationalStateServer initialized: setting operational state to Stopped and operational error to No error`);
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
    expect(attributes.length).toBe(51); // 51 attributes for the cabinet1 device
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
    expect(attributes.length).toBe(51); // 51 attributes for the cabinet2 device
  });

  test('invoke MatterbridgeOvenModeServer commands', async () => {
    expect(cabinet1.behaviors.has(OvenModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.has(MatterbridgeOvenModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((cabinet1 as any).state['ovenMode'].acceptedCommandList).toEqual([0]);
    expect((cabinet1 as any).state['ovenMode'].generatedCommandList).toEqual([1]);

    // Change to mode 2
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'ovenMode', 'changeToMode', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenModeServer: changeToMode (endpoint OvenTestCabinetTop.3) called with mode 2 = Convection`);

    // Change to mode 15
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'ovenMode', 'changeToMode', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeOvenModeServer: changeToMode (endpoint OvenTestCabinetTop.3) called with invalid mode 15`);
  });

  test('invoke MatterbridgeOvenCavityOperationalStateServer commands', async () => {
    expect(cabinet1.behaviors.has(OvenCavityOperationalStateServer)).toBeTruthy();
    expect(cabinet1.behaviors.has(MatterbridgeOvenCavityOperationalStateServer)).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('stop')).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('start')).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('pause')).toBeFalsy();
    expect(cabinet1.behaviors.elementsOf(OvenCavityOperationalStateServer).commands.has('resume')).toBeFalsy();
    expect((cabinet1 as any).state['ovenCavityOperationalState'].acceptedCommandList).toEqual([1, 2]);
    expect((cabinet1 as any).state['ovenCavityOperationalState'].generatedCommandList).toEqual([4]);

    // Change to mode 2
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'ovenCavityOperationalState', 'start', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenCavityOperationalStateServer: start (endpoint OvenTestCabinetTop.3) called setting operational state to Running and operational error to No error`);

    // Change to mode 15
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'ovenCavityOperationalState', 'stop', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeOvenCavityOperationalStateServer: stop (endpoint OvenTestCabinetTop.3) called setting operational state to Stopped and operational error to No error`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
