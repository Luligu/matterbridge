// src\singledevice.test.ts

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
import { Identify, LaundryWasherControls, LaundryWasherMode, OnOff, OperationalState, PowerSource, TemperatureControl } from '@matter/main/clusters';
import { LaundryWasherModeServer, TemperatureControlServer } from '@matter/main/behaviors';

// Matterbridge
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { LaundryWasher, MatterbridgeLaundryWasherModeServer, MatterbridgeLevelTemperatureControlServer, MatterbridgeNumberTemperatureControlServer } from './laundryWasher.js';
import { invokeBehaviorCommand } from './matterbridgeEndpointHelpers.js';

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
const NAME = 'LaundryWasher';

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

  test('create a laundry washer device', async () => {
    device = new LaundryWasher('Laundry Washer Test Device', 'LW123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('LaundryWasherTestDevice-LW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherControls.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
  });

  test('add a laundry washer device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    await server.add(device);
    expect(server.parts.has('LaundryWasherTestDevice-LW123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer initialized: currentMode is 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLevelTemperatureControlServer initialized with selectedTemperatureLevel 1 and supportedTemperatureLevels: Cold, Warm, Hot, 30°, 40°, 60°, 80°`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeOperationalStateServer initialized: setting operational state to Stopped`);
  });

  test('start the server node', async () => {
    // Run the server
    await server.start();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    // Wait for the server to be online
    await waitForOnline(server);
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

  test('invoke MatterbridgeLaundryWasherModeServer commands', async () => {
    expect(device.behaviors.has(LaundryWasherModeServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeLaundryWasherModeServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(LaundryWasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeLaundryWasherModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((device.state['laundryWasherMode'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['laundryWasherMode'] as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'onOff', 'off', {}); // Dead Front state
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `OnOffServer changed to OFF: setting Dead Front state to Manufacturer Specific`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'laundryWasherMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeLaundryWasherModeServer: changeToMode called with invalid mode 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'laundryWasherMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer: changeToMode called with mode 1 => Delicate`);
  });

  test('invoke MatterbridgeLevelTemperatureControlServer commands', async () => {
    expect(device.behaviors.has(TemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeLevelTemperatureControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(TemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeLevelTemperatureControlServer).commands.has('setTemperature')).toBeTruthy();
    expect((device.state['temperatureControl'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['temperatureControl'] as any).generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperatureLevel: 100 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeLevelTemperatureControlServer: setTemperature called with invalid targetTemperatureLevel 100`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'temperatureControl', 'setTemperature', { targetTemperatureLevel: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLevelTemperatureControlServer: setTemperature called setting selectedTemperatureLevel to 2: Hot`);
  });

  test('remove the laundry washer device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    await device.delete();
    expect(server.parts.has('LaundryWasherTestDevice-LW123456')).toBeFalsy();
    expect(server.parts.has(device)).toBeFalsy();
  });

  test('create a laundry washer device with number temperature control', async () => {
    device = new LaundryWasher('Laundry Washer Test Device', 'LW123456', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, 5500, 3000, 9000, 1000);
    expect(device).toBeDefined();
    expect(device.id).toBe('LaundryWasherTestDevice-LW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(LaundryWasherControls.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
  });

  test('add a laundry washer device with number temperature control', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    await server.add(device);
    expect(server.parts.has('LaundryWasherTestDevice-LW123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeLaundryWasherModeServer initialized: currentMode is 2`);
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeNumberTemperatureControlServer: setTemperature called setting temperatureSetpoint to 5000`);
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
