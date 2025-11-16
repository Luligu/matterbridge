// src/devices/extractorHood.test.ts

const MATTER_PORT = 8006;
const NAME = 'ExtractorHood';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';
// @matter
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ActivatedCarbonFilterMonitoring } from '@matter/types/clusters/activated-carbon-filter-monitoring';
import { HepaFilterMonitoring } from '@matter/types/clusters/hepa-filter-monitoring';
import { ActivatedCarbonFilterMonitoringServer } from '@matter/node/behaviors/activated-carbon-filter-monitoring';
import { HepaFilterMonitoringServer } from '@matter/node/behaviors/hepa-filter-monitoring';
import { FanControl } from '@matter/types/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand, invokeSubscribeHandler } from '../matterbridgeEndpointHelpers.js';
import { MatterbridgeActivatedCarbonFilterMonitoringServer, MatterbridgeHepaFilterMonitoringServer } from '../matterbridgeBehaviors.js';
import { wait } from '../utils/wait.js';
import { addDevice, aggregator, createTestEnvironment, loggerLogSpy, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';

import { ExtractorHood } from './extractorHood.js';

// Setup the test environment
setupTest(NAME, false);

// Setup the Matter test environment
createTestEnvironment(NAME);

describe('Matterbridge ' + NAME, () => {
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
    await startServerNode(NAME, MATTER_PORT);
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
    expect((device as any).state['hepaFilterMonitoring'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['hepaFilterMonitoring'].generatedCommandList).toEqual([]);
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
    expect((device as any).state['activatedCarbonFilterMonitoring'].acceptedCommandList).toEqual([0]);
    expect((device as any).state['activatedCarbonFilterMonitoring'].generatedCommandList).toEqual([]);
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
