// src/solarPower.test.ts

const MATTER_PORT = 6017;
const NAME = 'SolarPower';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';
// matter.js
import { Endpoint, ServerNode } from '@matter/main';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { Identify } from '@matter/main/clusters/identify';
import { PowerSource } from '@matter/main/clusters/power-source';
import { ElectricalEnergyMeasurement } from '@matter/main/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/main/clusters/electrical-power-measurement';
import { DeviceEnergyManagement } from '@matter/main/clusters/device-energy-management';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { addDevice, createTestEnvironment, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { SolarPower } from './solarPower.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

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

  test('create a solar power device', async () => {
    device = new SolarPower('Solar Power Test Device', 'SP123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('SolarPowerTestDevice-SP123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
  });

  test('add a solar power device', async () => {
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
    expect(attributes.length).toBe(89);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
