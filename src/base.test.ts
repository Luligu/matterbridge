// src\base.test.ts

/* eslint-disable jest/no-commented-out-tests */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

// Import necessary modules and types
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { rmSync } from 'node:fs';
import path from 'node:path';

// matter.js
import { Endpoint, DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/main/';
import { MdnsService } from '@matter/main/protocol';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { RootEndpoint } from '@matter/main/endpoints/root';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

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

const MATTER_PORT = 6001;
const NAME = 'BaseTest';

/**
 * Waits for the `isOnline` property to become `true`.
 * This function checks the `isOnline` property of the provided server node at regular intervals until it becomes `true` or the specified timeout is reached.
 * If the timeout is reached before `isOnline` becomes `true`, the promise is rejected with an error.
 *
 * @param {ServerNode<ServerNode.RootEndpoint>} server - The server node to check for online status.
 * @param {number} timeout - The maximum time to wait in milliseconds.
 * @returns {Promise<void>} A promise that resolves when `isOnline` becomes `true` or rejects if the timeout is reached.
 */
async function waitForOnline(server: ServerNode<ServerNode.RootEndpoint>, timeout = 10000): Promise<void> {
  const start = Date.now();

  return new Promise((resolve, reject) => {
    const checkOnline = () => {
      if (server.lifecycle.isOnline) {
        resolve();
      } else if (Date.now() - start >= timeout) {
        reject(new Error('Timeout waiting for server.lifecycle.isOnline to become true'));
      } else {
        setTimeout(checkOnline, 100); // Check every 100ms
      }
    };
    // Start checking immediately
    checkOnline();
  });
}

describe('Matterbridge ' + NAME, () => {
  const log = new AnsiLogger({ logName: NAME, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  const environment = Environment.default;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Cleanup the matter environment
    rmSync(path.join('test', NAME), { recursive: true, force: true });
    // Setup the matter environment
    environment.vars.set('log.level', MatterLogLevel.DEBUG);
    environment.vars.set('log.format', MatterLogFormat.ANSI);
    environment.vars.set('path.root', path.join('test', NAME));
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
        productId: 0x8000,
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      basicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'Matterbridge',
        productId: 0x8000,
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
    expect(server.lifecycle.isReady).toBeTruthy();
  });

  test('create the aggregator node', async () => {
    aggregator = new Endpoint(AggregatorEndpoint, { id: NAME + 'AggregatorNode' });
    expect(aggregator).toBeDefined();
  });

  test('add the aggregator node to the server', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    await server.add(aggregator);
    expect(server.parts.has(aggregator.id)).toBeTruthy();
    expect(server.parts.has(aggregator)).toBeTruthy();
    expect(aggregator.lifecycle.isReady).toBeTruthy();
  });

  /*
  test('create a water heater device', async () => {
    device = new WaterHeater('Water Heater Test Device', 'WH123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('WaterHeaterTestDevice-WH123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(WaterHeaterManagementServer)).toBeTruthy();
    expect(device.hasClusterServer(WaterHeaterModeServer)).toBeTruthy();
    expect(device.hasClusterServer(ThermostatServer)).toBeTruthy();
  });

  test('add a water heater device', async () => {
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
    expect(server.parts.has('WaterHeaterTestDevice-WH123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();
  });
  */

  test('start the server node', async () => {
    // Run the server
    await server.start();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    // Wait for the server to be online
    await waitForOnline(server);
  });

  /*
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
    expect(attributes.length).toBe(84);
  });

  test('invoke MatterbridgeThermostatServer commands', async () => {
    expect(device.behaviors.has(ThermostatServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating))).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).commands.has('setpointRaiseLower')).toBeTruthy();
    expect((device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)) as any).acceptedCommandList).toEqual([0]);
    expect((device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)) as any).generatedCommandList).toEqual([]);

    jest.clearAllMocks();
    const occupiedHeatingSetpoint = device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).occupiedHeatingSetpoint;
    expect(occupiedHeatingSetpoint).toBeDefined();
    if (!occupiedHeatingSetpoint) return;
    await invokeBehaviorCommand(device, 'thermostat', 'setpointRaiseLower', { mode: Thermostat.SetpointRaiseLowerMode.Heat, amount: 5 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting setpoint by 5 in mode ${Thermostat.SetpointRaiseLowerMode.Heat} (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Set occupiedHeatingSetpoint to ${(occupiedHeatingSetpoint + 50) / 100}`);
    expect(device.stateOf(MatterbridgeThermostatServer.with(Thermostat.Feature.Heating)).occupiedHeatingSetpoint).toBe(occupiedHeatingSetpoint + 50);
  });

  test('invoke MatterbridgeWaterHeaterManagementServer commands', async () => {
    expect(device.behaviors.has(WaterHeaterManagementServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeWaterHeaterManagementServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(WaterHeaterManagementServer).commands.has('boost')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeWaterHeaterManagementServer).commands.has('boost')).toBeTruthy();
    expect(device.behaviors.elementsOf(WaterHeaterManagementServer).commands.has('cancelBoost')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeWaterHeaterManagementServer).commands.has('cancelBoost')).toBeTruthy();
    expect((device.state['waterHeaterManagement'] as any).acceptedCommandList).toEqual([0, 1]);
    expect((device.state['waterHeaterManagement'] as any).generatedCommandList).toEqual([]);
    expect((device.stateOf(MatterbridgeWaterHeaterManagementServer) as any).acceptedCommandList).toEqual([0, 1]);
    expect((device.stateOf(MatterbridgeWaterHeaterManagementServer) as any).generatedCommandList).toEqual([]);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterManagement', 'boost', { boostInfo: { duration: 60 } });
    expect(device.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Active);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Boost (endpoint ${device.id}.${device.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterManagement', 'cancelBoost', {});
    expect(device.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Inactive);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Cancel boost (endpoint ${device.id}.${device.number})`);
  });

  test('invoke MatterbridgeWaterHeaterModeServer commands', async () => {
    expect(device.behaviors.has(WaterHeaterModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeWaterHeaterModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(WaterHeaterModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeWaterHeaterModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device.state['waterHeaterMode'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['waterHeaterMode'] as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeWaterHeaterModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'waterHeaterMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeWaterHeaterModeServer changeToMode called with newMode 1 => Auto`);
  });
  */

  test('close the server node', async () => {
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    await server.close();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();
  });

  test('stop the mDNS service', async () => {
    expect(server).toBeDefined();
    await server.env.get(MdnsService)[Symbol.asyncDispose]();
  });
});
