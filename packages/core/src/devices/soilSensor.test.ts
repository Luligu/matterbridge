// src/soilSensor.test.ts
/* eslint-disable jest/no-standalone-expect */

const NAME = 'SoilSensor';
const MATTER_PORT = 8020;
const MATTER_CREATE_ONLY = true;

import { jest } from '@jest/globals';
import { Identify } from '@matter/types/clusters/identify';
import { PowerSource } from '@matter/types/clusters/power-source';
import { TemperatureMeasurement } from '@matter/types/clusters/temperature-measurement';
import { stringify } from 'node-ansi-logger';

import { SoilMeasurement } from '../clusters/soil-measurement.js';
// Jest utilities for Matter testing
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  server,
  startServerNode,
  stopServerNode,
} from '../jestutils/jestMatterTest.js';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '../jestutils/jestSetupTest.js';
import { soilSensor } from '../matterbridgeDeviceTypes.js';
import { featuresFor } from '../matterbridgeEndpointHelpers.js';
import { SoilSensor } from './soilSensor.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: SoilSensor;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  afterEach(async () => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, soilSensor.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a soil sensor device', async () => {
    device = new SoilSensor('Soil Sensor Test Device', 'SS123456', { soilMoistureMeasuredValue: 42 });
    expect(device).toBeDefined();
    expect(device.id).toBe('SoilSensorTestDevice-SS123456');

    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(SoilMeasurement.Cluster.id)).toBeTruthy();

    expect(device.getClusterServerOptions(SoilMeasurement.Cluster.id)).toMatchObject({
      soilMoistureMeasuredValue: 42,
    });
  });

  test('create a soil sensor device with default option', async () => {
    const defaultDevice = new SoilSensor('Soil Sensor Default Device', 'SS000000');
    expect(defaultDevice.getClusterServerOptions(SoilMeasurement.Cluster.id)).toMatchObject({
      soilMoistureMeasuredValue: null,
    });
  });

  test('create a soil sensor device with battery power', async () => {
    const defaultDevice = new SoilSensor('Soil Sensor Default Device', 'SS000000', { batteryPowered: true });
    expect(defaultDevice.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({
      batChargeLevel: 0,
      batPercentRemaining: null,
      batReplaceability: 0,
      batReplacementNeeded: false,
      batVoltage: null,
      description: 'Primary battery',
      endpointList: [],
      order: 0,
      status: 1,
    });
  });

  test('create a soil sensor device with temperature', async () => {
    const defaultDevice = new SoilSensor('Soil Sensor Default Device', 'SS000000', { temperatureMeasuredValue: 2500 });
    expect(defaultDevice.getClusterServerOptions(SoilMeasurement.Cluster.id)).toMatchObject({
      soilMoistureMeasuredValue: null,
    });
    expect(defaultDevice.getClusterServerOptions(TemperatureMeasurement.Cluster.id)).toMatchObject({
      maxMeasuredValue: null,
      measuredValue: 2500,
      minMeasuredValue: null,
      tolerance: 0,
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
    const attributes: {
      clusterName: string;
      clusterId: number;
      attributeName: string;
      attributeId: number;
      attributeValue: string | number | bigint | boolean | object | null | undefined;
    }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      if (attributeValue === undefined) return;

      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');
      expect(clusterName.length).toBeGreaterThanOrEqual(1);

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');
      expect(attributeName.length).toBeGreaterThanOrEqual(1);

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);

      if (['serverList', 'clientList', 'partsList', 'attributeList', 'acceptedCommandList', 'generatedCommandList'].includes(attributeName)) {
        const sortedAttributeValue = Array.from(attributeValue as number[]).sort((a, b) => a - b);
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue: sortedAttributeValue });
      } else {
        attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
      }
    });
    expect(
      attributes
        .map(
          ({ clusterName, clusterId, attributeName, attributeId, attributeValue }) =>
            `${clusterName}(0x${clusterId.toString(16)}).${attributeName}(0x${attributeId.toString(16)})=${stringify(attributeValue, false)}`,
        )
        .sort(),
    ).toEqual(
      [
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 69, revision: 1 }, { deviceType: 17, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 47, 1072 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
        'powerSource(0x2f).acceptedCommandList(0xfff9)=[  ]',
        'powerSource(0x2f).attributeList(0xfffb)=[ 0, 1, 2, 5, 31, 65528, 65529, 65531, 65532, 65533 ]',
        'powerSource(0x2f).clusterRevision(0xfffd)=3',
        "powerSource(0x2f).description(0x2)='AC Power'",
        'powerSource(0x2f).endpointList(0x1f)=[ 2 ]',
        'powerSource(0x2f).featureMap(0xfffc)={ wired: true, battery: false, rechargeable: false, replaceable: false }',
        'powerSource(0x2f).generatedCommandList(0xfff8)=[  ]',
        'powerSource(0x2f).order(0x1)=0',
        'powerSource(0x2f).status(0x0)=1',
        'powerSource(0x2f).wiredCurrentType(0x5)=0',
        'soilMeasurement(0x430).acceptedCommandList(0xfff9)=[  ]',
        'soilMeasurement(0x430).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'soilMeasurement(0x430).clusterRevision(0xfffd)=1',
        'soilMeasurement(0x430).featureMap(0xfffc)={  }',
        'soilMeasurement(0x430).generatedCommandList(0xfff8)=[  ]',
        'soilMeasurement(0x430).soilMoistureMeasuredValue(0x1)=null',
        'soilMeasurement(0x430).soilMoistureMeasurementLimits(0x0)={ measurementType: 17, measured: true, minMeasuredValue: 0, maxMeasuredValue: 100, accuracyRanges: [ { rangeMin: 0, rangeMax: 100, percentMax: undefined, percentMin: undefined, percentTypical: undefined, fixedMax: 1, fixedMin: undefined, fixedTypical: undefined } ] }',
      ].sort(),
    );
  });

  test('start the server node', async () => {
    if (!MATTER_CREATE_ONLY) await startServerNode();
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('stop the server node', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();
  });
});
