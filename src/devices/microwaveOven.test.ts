// src/microwaveOven.test.ts

const MATTER_PORT = 6023;
const NAME = 'MicrowaveOven';
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
import { MicrowaveOvenControlServer, MicrowaveOvenModeServer } from '@matter/main/behaviors';
import { Identify, MicrowaveOvenControl, MicrowaveOvenMode, OnOff, OperationalState, PowerSource } from '@matter/main/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { inspectError } from '../utils/error.js';

import { MatterbridgeMicrowaveOvenControlServer, MicrowaveOven } from './microwaveOven.js';
import { wait } from '../utils/export.js';
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

  test('create a microwave oven device', async () => {
    device = new MicrowaveOven('Microwave Oven Test Device', 'MW123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('MicrowaveOvenTestDevice-MW123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.hasClusterServer(MicrowaveOvenMode.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(MicrowaveOvenControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'operationalState', 'microwaveOvenMode', 'microwaveOvenControl']);
  });

  test('add a microwave oven device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    try {
      await server.add(device);
    } catch (error) {
      inspectError(device.log, `Error adding device ${device.deviceName}`, error);
      return;
    }
    expect(server.parts.has('MicrowaveOvenTestDevice-MW123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer initialized`);
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
    expect(attributes.length).toBe(61); // 61 attributes for the microwave oven device
  });

  test('invoke MatterbridgeMicrowaveOvenControlServer commands', async () => {
    expect(device.behaviors.has(MicrowaveOvenControlServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeMicrowaveOvenControlServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(MicrowaveOvenModeServer).commands.has('changeToMode')).toBeFalsy();
    expect((device as any).state['microwaveOvenControl'].acceptedCommandList).toEqual([0, 1]);
    expect((device as any).state['microwaveOvenControl'].generatedCommandList).toEqual([]); // No response

    // Default cookTime from constructor is 60; adding 1 should log setting cookTime to 61
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'addMoreTime', { timeToAdd: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: addMoreTime called setting cookTime to 61`);

    // Adding -1 should log invalid cookTime
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'addMoreTime', { timeToAdd: -1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeMicrowaveOvenControlServer: addMoreTime called with invalid cookTime -1`);

    // Test setCookingParameters command - all unspecified -> defaults
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - valid cookMode only
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 2`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - no cookMode provided but valid cookTime and wattSettingIndex
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookTime: 120, wattSettingIndex: 3 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 120`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 3`);

    // Test setCookingParameters - invalid cookTime (<0) -> default to 30sec
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 7, cookTime: -5, wattSettingIndex: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 7`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 0`);

    // Test setCookingParameters - cookTime > maxCookTime -> default to 30sec
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookTime: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookMode so set to Normal`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no cookTime so set to 30sec.`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - invalid wattSettingIndex (out of range) -> default to highest supported index
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 3, cookTime: 45, wattSettingIndex: 100 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 3`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 45`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called with no wattSettingIndex so set to the highest Watt setting for the selected CookMode`);

    // Test setCookingParameters - all valid values
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { cookMode: 4, cookTime: 90, wattSettingIndex: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookMode to 4`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting cookTime to 90`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting selectedWattIndex to 2`);

    // Test setCookingParameters - startAfterSetting false (no change expected)
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { startAfterSetting: false });
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
    await wait(100);
    expect((device as any).state['operationalState'].operationalState).toBe(OperationalState.OperationalStateEnum.Stopped);

    // Test setCookingParameters - startAfterSetting true (transition to Running)
    jest.clearAllMocks();
    await invokeBehaviorCommand(device, 'microwaveOvenControl', 'setCookingParameters', { startAfterSetting: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeMicrowaveOvenControlServer: setCookingParameters called setting startAfterSetting = true`);
    await wait(100);
    expect((device as any).state['operationalState'].operationalState).toBe(OperationalState.OperationalStateEnum.Running);
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
