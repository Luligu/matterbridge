// src/devices/extractorHood.test.ts

const MATTER_PORT = 6023;
const NAME = 'ExtractorHood';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
// matter.js
import { Endpoint, ServerNode } from '@matter/main';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { Identify } from '@matter/main/clusters/identify';
import { PowerSource } from '@matter/main/clusters/power-source';
import { ActivatedCarbonFilterMonitoring } from '@matter/main/clusters/activated-carbon-filter-monitoring';
import { HepaFilterMonitoring } from '@matter/main/clusters/hepa-filter-monitoring';
import { ActivatedCarbonFilterMonitoringServer } from '@matter/main/behaviors/activated-carbon-filter-monitoring';
import { HepaFilterMonitoringServer } from '@matter/main/behaviors/hepa-filter-monitoring';
import { FanControl } from '@matter/main/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand, invokeSubscribeHandler } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeActivatedCarbonFilterMonitoringServer, MatterbridgeHepaFilterMonitoringServer } from '../matterbridgeBehaviors.js';
import { wait } from '../utils/wait.js';
import { addDevice, createTestEnvironment, startServerNode, stopServerNode } from '../jest-utils/jestHelpers.js';

import { ExtractorHood } from './extractorHood.js';

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

// Setup the matter and test environment
createTestEnvironment(HOMEDIR);

describe('Matterbridge ' + NAME, () => {
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

  test('create an extractor hood device', async () => {
    device = new ExtractorHood('Extractor Hood Test Device', 'EH123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ExtractorHoodTestDevice-EH123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(FanControl.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(HepaFilterMonitoring.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ActivatedCarbonFilterMonitoring.Cluster.id)).toBeTruthy();
  });

  test('add an extractor hood device', async () => {
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
    expect(attributes.length).toBe(64); // ExtractorHood has 64 attributes
  });

  test('invoke MatterbridgeHepaFilterMonitoringServer commands', async () => {
    expect(device.behaviors.has(HepaFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeHepaFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(HepaFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeHepaFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect((device.state['hepaFilterMonitoring'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['hepaFilterMonitoring'] as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(device, 'hepaFilterMonitoring', 'resetCondition', {}); // Reset condition
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting condition (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeHepaFilterMonitoringServer: resetCondition called`);
  });

  test('invoke MatterbridgeActivatedCarbonFilterMonitoringServer commands', async () => {
    expect(device.behaviors.has(ActivatedCarbonFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.has(MatterbridgeActivatedCarbonFilterMonitoringServer)).toBeTruthy();
    expect(device.behaviors.elementsOf(ActivatedCarbonFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect(device.behaviors.elementsOf(MatterbridgeActivatedCarbonFilterMonitoringServer).commands.has('resetCondition')).toBeTruthy();
    expect((device.state['activatedCarbonFilterMonitoring'] as any).acceptedCommandList).toEqual([0]);
    expect((device.state['activatedCarbonFilterMonitoring'] as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(device, 'activatedCarbonFilterMonitoring', 'resetCondition', {}); // Reset condition
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting condition (endpoint ${device.id}.${device.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeActivatedCarbonFilterMonitoringServer: resetCondition called`);
  });

  test('write attributes fanMode and percentSetting of fanControl cluster', async () => {
    await device.setAttribute('fanControl', 'fanMode', 1); // Set fan mode to 1
    await invokeSubscribeHandler(device, 'fanControl', 'fanMode', 1, 1);
    await wait(100); // Wait for the device to be ready
    expect(device.getAttribute('fanControl', 'fanMode')).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Fan control fanMode attribute changed: 1`);

    await device.setAttribute('fanControl', 'percentSetting', 50); // Set percent setting to 50
    await invokeSubscribeHandler(device, 'fanControl', 'percentSetting', 50, 50);
    await wait(100); // Wait for the device to be ready
    expect(device.getAttribute('fanControl', 'percentSetting')).toBe(50);
    expect(device.getAttribute('fanControl', 'percentCurrent')).toBe(50);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Fan control percentSetting attribute changed: 50`);
  });

  test('write attributes lastChangedTime of hepa cluster', async () => {
    const epochSeconds = Math.floor(Date.now() / 1000); // Current epoch time in seconds
    await device.setAttribute('hepaFilterMonitoring', 'lastChangedTime', epochSeconds); // Set last changed time
    await invokeSubscribeHandler(device, 'hepaFilterMonitoring', 'lastChangedTime', epochSeconds, epochSeconds);
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Hepa filter monitoring lastChangedTime attribute changed: ${epochSeconds}`);
    expect(device.getAttribute('hepaFilterMonitoring', 'lastChangedTime')).toBe(epochSeconds);
  });

  test('write attributes lastChangedTime of activated carbon cluster', async () => {
    const epochSeconds = Math.floor(Date.now() / 1000); // Current epoch time in seconds
    await device.setAttribute('activatedCarbonFilterMonitoring', 'lastChangedTime', epochSeconds); // Set last changed time
    await invokeSubscribeHandler(device, 'activatedCarbonFilterMonitoring', 'lastChangedTime', epochSeconds, epochSeconds);
    await wait(100); // Wait for the device to be ready
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Activated carbon filter monitoring lastChangedTime attribute changed: ${epochSeconds}`);
    expect(device.getAttribute('activatedCarbonFilterMonitoring', 'lastChangedTime')).toBe(epochSeconds);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
