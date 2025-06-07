// src\evse.test.ts

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { jest } from '@jest/globals';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { inspect } from 'node:util';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

// matter.js
import { DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/main';
import { RootEndpoint } from '@matter/main/endpoints';
import { MdnsService } from '@matter/main/protocol';
import { Identify, PowerSource, ElectricalEnergyMeasurement, ElectricalPowerMeasurement, DeviceEnergyManagement } from '@matter/main/clusters';
import { EnergyEvseServer, EnergyEvseModeServer } from '@matter/node/behaviors';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from './matterbridgeEndpointHelpers.js';

import { Evse, MatterbridgeEnergyEvseServer, MatterbridgeEnergyEvseModeServer } from './evse.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = true; // Set to true to enable debug logging

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

describe('Matterbridge EVSE', () => {
  const name = 'Evse';

  const log = new AnsiLogger({ logName: name, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  const environment = Environment.default;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Cleanup the matter environment
    rmSync(path.join('test', name), { recursive: true, force: true });
    // Setup the matter environment
    environment.vars.set('log.level', MatterLogLevel.DEBUG);
    environment.vars.set('log.format', MatterLogFormat.ANSI);
    environment.vars.set('path.root', path.join('test', name));
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
      id: name + 'ServerNode',

      productDescription: {
        name: name + 'ServerNode',
        deviceType: DeviceTypeId(RootEndpoint.deviceType),
        vendorId: VendorId(0xfff1),
        productId: 0x8001,
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      basicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'Matterbridge',
        productId: 0x8001,
        productName: 'Matterbridge ' + name,
        nodeLabel: name + 'ServerNode',
        hardwareVersion: 1,
        softwareVersion: 1,
        reachable: true,
      },

      network: {
        port: 5580,
      },
    });
    expect(server).toBeDefined();
  });

  test('create a Evse device', async () => {
    device = new Evse('EVSE Test Device', 'EVSE12456');
    expect(device).toBeDefined();
    expect(device.id).toBe('EVSETestDevice-EVSE12456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseServer)).toBeTruthy();
    expect(device.hasClusterServer(EnergyEvseModeServer)).toBeTruthy();
  });

  test('add a Evse device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    try {
      await server.add(device);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : error;
      const errorInspect = inspect(error, { depth: 10 });
      device.log.error(`Error adding device ${device.deviceName}: ${errorMessage}\nstack: ${errorInspect}`);
      return;
    }
    expect(server.parts.has('EVSETestDevice-EVSE12456')).toBeTruthy();
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
    expect(attributes.length).toBe(103);
  });

  test('invoke MatterbridgeEnergyEvseServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect((device.state['energyEvse'] as any).acceptedCommandList).toEqual([1, 2]);
    expect((device.state['energyEvse'] as any).generatedCommandList).toEqual([]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).acceptedCommandList).toEqual([1, 2]);
    expect((device.stateOf(MatterbridgeEnergyEvseServer) as any).generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvse', 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeEnergyEvseServer disable called`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvse', 'enableCharging');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeEnergyEvseServer enableCharging called`);
  });

  test('invoke MatterbridgeEvseModeServer commands', async () => {
    expect(device.behaviors.has(EnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeEnergyEvseModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(EnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeEnergyEvseModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device.state['energyEvseMode'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['energyEvseMode'] as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvseMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeEnergyEvseModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'energyEvseMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeEnergyEvseModeServer changeToMode called with newMode 1 => Auto`);
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
