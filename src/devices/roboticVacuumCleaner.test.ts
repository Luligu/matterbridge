// src\roboticVacuumCleaner.test.ts

const MATTER_PORT = 6002;
const NAME = 'Vacuum';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { AnsiLogger, er, hk, LogLevel } from 'node-ansi-logger';
import { jest } from '@jest/globals';
// @matter
import { LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/general';
import { DeviceTypeId, VendorId } from '@matter/types';
import { MdnsService } from '@matter/protocol';
import { ServerNode, Endpoint, PositionTag } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { Identify, PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from '@matter/types/clusters';
import { RvcCleanModeServer, RvcOperationalStateServer, RvcRunModeServer, ServiceAreaServer } from '@matter/node/behaviors';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { MatterbridgeServiceAreaServer } from '../matterbridgeBehaviors.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { addDevice, createTestEnvironment, loggerLogSpy, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { MatterbridgeRvcCleanModeServer, MatterbridgeRvcOperationalStateServer, MatterbridgeRvcRunModeServer, RoboticVacuumCleaner } from './roboticVacuumCleaner.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge Robotic Vacuum Cleaner', () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
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
    [server, aggregator] = await startServerNode(NAME, MATTER_PORT);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create an RVC device', async () => {
    device = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('RVCTestDevice-RVC123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RvcRunMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RvcCleanMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(RvcOperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ServiceArea.Cluster.id)).toBeTruthy();
  });

  test('add an RVC device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
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
    expect(attributes.length).toBe(74);
  });

  test('invoke MatterbridgeRvcRunModeServer commands', async () => {
    expect(device.behaviors.has(RvcRunModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcRunModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeRvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['rvcRunMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['rvcRunMode'].generatedCommandList).toEqual([1]);
    expect((device.stateOf(MatterbridgeRvcRunModeServer) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeRvcRunModeServer) as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('noCluster', 'changeToMode', { newMode: 0 }); // noCluster is invalid
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeBehaviorCommand error: command ${hk}changeToMode${er} not found on endpoint`));
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'noCommand' as any, { newMode: 0 }); // noCommand is invalid
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeBehaviorCommand error: command ${hk}noCommand${er} not found on agent for endpoint`));
    jest.clearAllMocks();
    await device.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcRunMode', 'changeToMode', { newMode: 1 }); // 1 has Idle
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked`);
    await invokeBehaviorCommand(device, 'rvcRunMode', 'changeToMode', { newMode: 2 }); // 2 has Cleaning
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 2 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcRunMode', 'changeToMode', { newMode: 3 }); // 3 has Mapping
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 3 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode 3 => Mapping`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcRunMode', 'changeToMode', { newMode: 4 }); // 4 has Cleaning and Max
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 4 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
  });

  test('invoke MatterbridgeRvcCleanModeServer commands', async () => {
    expect(device.behaviors.has(RvcCleanModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcCleanModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeRvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['rvcCleanMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['rvcCleanMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcCleanMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcCleanMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcCleanModeServer changeToMode called with newMode 1 => Vacuum`);
  });

  test('invoke MatterbridgeRvcOperationalStateServer commands', async () => {
    expect(device.behaviors.has(RvcOperationalStateServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcOperationalStateServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcOperationalStateServer).commands.has('pause')).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcOperationalStateServer).commands.has('resume')).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcOperationalStateServer).commands.has('goHome')).toBeTruthy();
    expect((device.stateOf(RvcOperationalStateServer) as any).acceptedCommandList).toEqual([0, 3, 128]);
    expect((device.stateOf(RvcOperationalStateServer) as any).generatedCommandList).toEqual([4]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcOperationalState', 'pause');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcOperationalState', 'resume');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resume (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'rvcOperationalState', 'goHome');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `GoHome (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle`);
  });

  test('invoke MatterbridgeServiceAreaServer commands', async () => {
    expect(device.behaviors.has(ServiceAreaServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeServiceAreaServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(ServiceAreaServer).commands.has('selectAreas')).toBeTruthy();
    expect((device.stateOf(ServiceAreaServer) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(ServiceAreaServer) as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'serviceArea', 'selectAreas', { newAreas: [1, 2, 3, 4] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Selecting areas 1,2,3,4 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeServiceAreaServer selectAreas called with: 1, 2, 3, 4`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'serviceArea', 'selectAreas', { newAreas: [0, 5] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeServiceAreaServer selectAreas called with unsupported area: 0`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
