// src/dishwasher.test.ts

const MATTER_PORT = 6022;
const NAME = 'Dishwasher';
const HOMEDIR = path.join('jest', NAME);

import { rmSync } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
// matter.js
import { Endpoint, DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/main';
import { MdnsService } from '@matter/main/protocol';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { RootEndpoint } from '@matter/main/endpoints/root';
import { DishwasherModeServer, TemperatureControlServer } from '@matter/main/behaviors';
import { DishwasherAlarm, DishwasherMode, Identify, OnOff, OperationalState, PowerSource, TemperatureControl } from '@matter/main/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { inspectError } from '../utils/error.js';

import { Dishwasher, MatterbridgeDishwasherModeServer } from './dishwasher.js';
import { MatterbridgeNumberTemperatureControlServer } from './temperatureControl.js';
import { assertAllEndpointNumbersPersisted, flushAllEndpointNumberPersistence, flushAsync } from '../jest-utils/helpers.test.js';

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

describe('Matterbridge ' + NAME, () => {
  const environment = Environment.default;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the matter environment
    environment.vars.set('log.level', MatterLogLevel.DEBUG);
    environment.vars.set('log.format', MatterLogFormat.ANSI);
    environment.vars.set('path.root', HOMEDIR);
    environment.vars.set('runtime.signals', false);
    environment.vars.set('runtime.exitcode', false);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Wait 'ticks' macrotask tick (setImmediate) then yield `microTurns` microtask turns so progressively chained Promise callbacks can settle
    await flushAsync();
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

  test('create a dishwasher device', async () => {
    device = new Dishwasher('Dishwasher Test Device', 'DW123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('DishwasherTestDevice-DW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherAlarm.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
  });

  test('add a dishwasher device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    try {
      await server.add(device);
    } catch (error) {
      inspectError(device.log, `Error adding device ${device.deviceName}`, error);
      return;
    }
    expect(server.parts.has('DishwasherTestDevice-DW123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeDishwasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLevelTemperatureControlServer initialized with selectedTemperatureLevel 1 and supportedTemperatureLevels: Cold, Warm, Hot, 30°, 40°, 60°, 80°`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
  });

  test('start the server node', async () => {
    // Run the server
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();

    // Wait for the server to be online
    await new Promise<void>((resolve) => {
      server.lifecycle.online.on(async () => {
        resolve();
      });
      server.start();
    });

    // Check if the server is online
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
    expect(attributes.length).toBe(72); // 72 attributes for the dishwasher device
  });

  test('invoke MatterbridgeDishwasherModeServer commands', async () => {
    expect(device.behaviors.has(DishwasherModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeDishwasherModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(DishwasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeDishwasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device as any).state['dishwasherMode'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['dishwasherMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'onOff', 'off', {}); // Dead Front state
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'dishwasherMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `DishwasherModeServer: changeToMode called with invalid mode 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'dishwasherMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `ChangeToMode (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `DishwasherModeServer: changeToMode called with mode 1 => Light`);
  });

  test('remove the laundry washer device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    await device.delete();
    expect(server.parts.has('DishwasherTestDevice-DW123456')).toBeFalsy();
    expect(server.parts.has(device)).toBeFalsy();
  });

  test('create a dishwasher device with number temperature control', async () => {
    device = new Dishwasher('Dishwasher Test Device', 'DW123456', undefined, undefined, undefined, undefined, 5500, 3000, 9000, 1000);
    expect(device).toBeDefined();
    expect(device.id).toBe('DishwasherTestDevice-DW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DishwasherAlarm.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
  });

  test('add a dishwasher device with number temperature control', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    await server.add(device);
    expect(server.parts.has('DishwasherTestDevice-DW123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeDishwasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeNumberTemperatureControlServer initialized with temperatureSetpoint 5500 minTemperature 3000 maxTemperature 9000 step 1000`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
  });

  test('invoke MatterbridgeNumberTemperatureControlServer commands', async () => {
    expect(device.behaviors.has(TemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeNumberTemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(TemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeNumberTemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect((device.state['temperatureControl'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['temperatureControl'] as any).generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperature: 3 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeNumberTemperatureControlServer: setTemperature called with invalid targetTemperature 3`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperature: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to 5000`);
  });

  test('ensure all endpoint number persistence is flushed before closing', async () => {
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    if (server) {
      await flushAllEndpointNumberPersistence(server);
      await assertAllEndpointNumbersPersisted(server);
    }
  });

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
