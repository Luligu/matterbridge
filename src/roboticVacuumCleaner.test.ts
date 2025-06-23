// src\roboticVacuumCleaner.test.ts

const MATTER_PORT = 6002;
const NAME = 'Rvc';
const HOMEDIR = path.join('jest', NAME);

import { jest } from '@jest/globals';
import { AnsiLogger, er, hk, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { rmSync } from 'node:fs';
import path from 'node:path';

import { DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/main';
import { RootEndpoint } from '@matter/main/endpoints';
import { MdnsService } from '@matter/main/protocol';
import { Identify, PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from '@matter/main/clusters';
import { RvcCleanModeServer, RvcOperationalStateServer, RvcRunModeServer, ServiceAreaServer } from '@matter/node/behaviors';

import { Matterbridge } from './matterbridge.ts';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.ts';
import { MatterbridgeRvcCleanModeServer, MatterbridgeRvcOperationalStateServer, MatterbridgeRvcRunModeServer, RoboticVacuumCleaner } from './roboticVacuumCleaner.ts';
import { MatterbridgeServiceAreaServer } from './matterbridgeBehaviors.ts';
import { invokeBehaviorCommand } from './matterbridgeEndpointHelpers.ts';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge Robotic Vacuum Cleaner', () => {
  const log = new AnsiLogger({ logName: NAME, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  const environment = Environment.default;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let device: MatterbridgeEndpoint;

  const mockMatterbridge = {
    matterbridgeVersion: '1.0.0',
    matterbridgeInformation: { virtualMode: 'disabled' },
    bridgeMode: 'bridge',
    restartMode: '',
    restartProcess: jest.fn(),
    shutdownProcess: jest.fn(),
    updateProcess: jest.fn(),
    log,
    frontend: {
      wssSendRefreshRequired: jest.fn(),
      wssSendUpdateRequired: jest.fn(),
    },
    nodeContext: {
      set: jest.fn(),
    },
  } as unknown as Matterbridge;

  beforeAll(async () => {
    // Setup the matter environment
    environment.vars.set('log.level', MatterLogLevel.DEBUG);
    environment.vars.set('log.format', MatterLogFormat.ANSI);
    environment.vars.set('path.root', HOMEDIR);
    environment.vars.set('runtime.signals', false);
    environment.vars.set('runtime.exitcode', false);
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    // Create the server node
    server = await ServerNode.create({
      id: NAME + 'ServerNode',

      productDescription: {
        name: NAME + 'ServerNode',
        deviceType: DeviceTypeId(RootEndpoint.deviceType),
        vendorId: VendorId(0xfff1),
        productId: 0x8001,
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      basicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'Matterbridge',
        productId: 0x8001,
        productName: 'Matterbridge ' + NAME,
        nodeLabel: NAME + 'ServerNode',
        hardwareVersion: 1,
        softwareVersion: 1,
        reachable: true,
      },

      network: {
        port: MATTER_PORT,
      },
    });
    expect(server).toBeDefined();
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
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    await server.add(device);
    expect(server.parts.has('RVCTestDevice-RVC123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();
  });

  test('start the server node', async () => {
    // Run the server
    await server.start();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
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
    expect(attributes.length).toBe(73);
  });

  test('invoke MatterbridgeRvcRunModeServer commands', async () => {
    expect(device.behaviors.has(RvcRunModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeRvcRunModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(RvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeRvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device.state['rvcRunMode'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['rvcRunMode'] as any).generatedCommandList).toEqual([1]);
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
    expect((device.state['rvcCleanMode'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['rvcCleanMode'] as any).generatedCommandList).toEqual([1]);
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

  test('close server node', async () => {
    // Close the server
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    await server.close();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();
    // Stop the mDNS service
    await server.env.get(MdnsService)[Symbol.asyncDispose]();
  });
});
