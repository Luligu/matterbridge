// src/cooktop.test.ts

const MATTER_PORT = 6025;
const NAME = 'Cooktop';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger } from 'node-ansi-logger';
// @matter
import { LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/general';
import { DeviceTypeId, VendorId } from '@matter/types';
import { MdnsService } from '@matter/protocol';
import { ServerNode, Endpoint, PositionTag } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { Identify, OnOff, PowerSource, TemperatureControl, TemperatureMeasurement } from '@matter/types/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { addDevice, createTestEnvironment, setupTest, startServerNode, stopServerNode } from '../utils/jestHelpers.js';

import { Cooktop } from './cooktop.js';

// Setup the Matter test environment
createTestEnvironment(HOMEDIR);

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: Cooktop;
  let surface1: MatterbridgeEndpoint;
  let surface2: MatterbridgeEndpoint;

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

  test('create a cooktop device', async () => {
    device = new Cooktop('Cooktop Test Device', 'CT123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('CooktopTestDevice-CT123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'onOff', 'fixedLabel']);

    surface1 = device.addSurface('Surface Top Left', [
      { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
      { mfgCode: null, namespaceId: PositionTag.Left.namespaceId, tag: PositionTag.Left.tag, label: PositionTag.Left.label },
    ]);
    expect(surface1).toBeDefined();
    expect(surface1.id).toBe('SurfaceTopLeft');
    expect(surface1.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(surface1.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(surface1.hasClusterServer(TemperatureMeasurement.Cluster.id)).toBeTruthy();
    expect(surface1.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'temperatureControl', 'temperatureMeasurement', 'onOff']);

    surface2 = device.addSurface('Surface Top Right', [
      { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
      { mfgCode: null, namespaceId: PositionTag.Right.namespaceId, tag: PositionTag.Right.tag, label: PositionTag.Right.label },
    ]);
    expect(surface2).toBeDefined();
    expect(surface2.id).toBe('SurfaceTopRight');
    expect(surface2.hasClusterServer(OnOff.Cluster.id)).toBeTruthy();
    expect(surface2.hasClusterServer(TemperatureControl.Cluster.id)).toBeTruthy();
    expect(surface2.hasClusterServer(TemperatureMeasurement.Cluster.id)).toBeTruthy();
    expect(surface2.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'temperatureControl', 'temperatureMeasurement', 'onOff']);
  });

  test('add a cooktop device', async () => {
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
    expect(attributes.length).toBe(45); // 45 attributes for the oven device
  });

  test('surface1 forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    surface1.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
    expect(attributes.length).toBe(32); // 32 attributes for the surface1 device
  });

  test('surface2 forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    surface2.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
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
    expect(attributes.length).toBe(32); // 32 attributes for the surface2 device
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server);
  });
});
