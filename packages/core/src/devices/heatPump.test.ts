// src/heatPump.test.ts

const MATTER_PORT = 8007;
const NAME = 'HeatPump';
const HOMEDIR = path.join('jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
// @matter
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { addDevice, aggregator, createTestEnvironment, destroyTestEnvironment, server, setupTest, startServerNode, stopServerNode } from '../jestutils/jestHelpers.js';
import { heatPump } from '../matterbridgeDeviceTypes.js';

import { HeatPump } from './heatPump.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment(MATTER_CREATE_ONLY);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, heatPump.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a heat pump device', async () => {
    device = new HeatPump('Heat Pump Test Device', 'HP123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('HeatPumpTestDevice-HP123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
  });

  test('add a heat pump device', async () => {
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
    expect(attributes.length).toBe(90);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
