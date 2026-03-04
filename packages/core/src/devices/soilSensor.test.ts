/* eslint-disable jest/no-standalone-expect */
// src/soilSensor.test.ts

const MATTER_PORT = 8020;
const NAME = 'SoilSensor';
const HOMEDIR = path.join('jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { Identify } from '@matter/types/clusters/identify';

import { SoilMeasurement } from '../clusters/soil-measurement.js';
import {
  addDevice,
  aggregator,
  createTestEnvironment,
  destroyTestEnvironment,
  loggerErrorSpy,
  loggerFatalSpy,
  loggerWarnSpy,
  server,
  setupTest,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestHelpers.js';
import { soilSensor } from '../matterbridgeDeviceTypes.js';
import { featuresFor } from '../matterbridgeEndpointHelpers.js';
import { SoilSensor } from './soilSensor.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: SoilSensor;

  beforeAll(async () => {
    createTestEnvironment(NAME, MATTER_CREATE_ONLY);
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    await destroyTestEnvironment(MATTER_CREATE_ONLY);
    jest.restoreAllMocks();
  });

  test('create and start the server node', async () => {
    await startServerNode(NAME, MATTER_PORT, soilSensor.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a soil sensor device', async () => {
    device = new SoilSensor('Soil Sensor Test Device', 'SS123456', { soilMoistureMeasuredValue: 42 });
    expect(device).toBeDefined();
    expect(device.id).toBe('SoilSensorTestDevice-SS123456');

    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(SoilMeasurement.Cluster.id)).toBeTruthy();

    expect(device.getClusterServerOptions(SoilMeasurement.Cluster.id)).toMatchObject({
      soilMoistureMeasuredValue: 42,
    });

    // Cover default option path (value omitted -> null)
    const defaultDevice = new SoilSensor('Soil Sensor Default Device', 'SS000000');
    expect(defaultDevice.getClusterServerOptions(SoilMeasurement.Cluster.id)).toMatchObject({
      soilMoistureMeasuredValue: null,
    });
  });

  test('add a soil sensor device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('check attributes after adding device to server', async () => {
    expect(device.getSoilMoistureMeasuredValue()).toBe(42);
  });

  test('read SoilMeasurement global attributes', async () => {
    // Verify hasAttributeServer() sees both globals and custom attributes.
    expect(device.hasAttributeServer(SoilMeasurement.Cluster.id, 'soilMoistureMeasurementLimits')).toBe(true);
    expect(device.hasAttributeServer(SoilMeasurement.Cluster.id, 'soilMoistureMeasuredValue')).toBe(true);
    expect(featuresFor(device, SoilMeasurement.Cluster.id)).toEqual({});

    const clusterRevision = device.getAttribute(SoilMeasurement.Cluster.id, 'clusterRevision');
    expect(typeof clusterRevision).toBe('number');
    expect(clusterRevision).toBeGreaterThanOrEqual(1);

    const featureMap = device.getAttribute(SoilMeasurement.Cluster.id, 'featureMap');
    expect(featureMap).toEqual({});
  });

  test('setSoilMoistureMeasuredValue updates attribute', async () => {
    await device.setSoilMoistureMeasuredValue(55);
    expect(device.getSoilMoistureMeasuredValue()).toBe(55);

    await device.setSoilMoistureMeasuredValue(null);
    expect(device.getSoilMoistureMeasuredValue()).toBeNull();
  });

  test('device forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(typeof clusterName).toBe('string');
      expect(typeof clusterId).toBe('number');
      expect(typeof attributeName).toBe('string');
      expect(typeof attributeId).toBe('number');
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBeGreaterThan(0);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
