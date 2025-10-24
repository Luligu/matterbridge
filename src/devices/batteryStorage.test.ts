// src/batteryStorage.test.ts

const MATTER_PORT = 6018;
const NAME = 'BatteryStorage';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';
// @matter
import { LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/general';
import { DeviceTypeId, VendorId } from '@matter/types';
import { MdnsService } from '@matter/protocol';
import { ServerNode, Endpoint } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ElectricalEnergyMeasurement } from '@matter/types/clusters/electrical-energy-measurement';
import { ElectricalPowerMeasurement } from '@matter/types/clusters/electrical-power-measurement';
import { DeviceEnergyManagement } from '@matter/types/clusters/device-energy-management';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { addDevice, createTestEnvironment, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { BatteryStorage } from './batteryStorage.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  beforeAll(async () => {
    //
  });

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

  test('create a battery storage device', async () => {
    device = new BatteryStorage('Battery Storage Test Device', 'BS123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('BatteryStorageTestDevice-BS123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();

    expect(device.getChildEndpointByName('BatteryPowerSource')).toBeDefined();
    expect(device.getChildEndpointByName('BatteryPowerSource')?.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.getChildEndpointByName('GridPowerSource')).toBeDefined();
    expect(device.getChildEndpointByName('GridPowerSource')?.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
  });

  test('add a battery storage device', async () => {
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
    expect(attributes.length).toBe(71);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
