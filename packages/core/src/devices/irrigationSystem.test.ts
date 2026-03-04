/* eslint-disable jest/no-standalone-expect */
// src/irrigationSystem.test.ts

const MATTER_PORT = 8021;
const NAME = 'IrrigationSystem';
const HOMEDIR = path.join('jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { NumberTag } from '@matter/main';
import { FlowMeasurement } from '@matter/types/clusters/flow-measurement';
import { Identify } from '@matter/types/clusters/identify';
import { OperationalState } from '@matter/types/clusters/operational-state';
import { PowerSource } from '@matter/types/clusters/power-source';
import { ValveConfigurationAndControl } from '@matter/types/clusters/valve-configuration-and-control';

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
import { irrigationSystem } from '../matterbridgeDeviceTypes.js';
import { getSemtag } from '../matterbridgeEndpointHelpers.js';
import { IrrigationSystem } from './irrigationSystem.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: IrrigationSystem;
  let singleZoneBatteryDevice: IrrigationSystem;

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
    await startServerNode(NAME, MATTER_PORT, irrigationSystem.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create an irrigation system device', async () => {
    device = new IrrigationSystem('Irrigation System Test Device', 'IR123456', { flowMeasuredValue: 123, operationalState: OperationalState.OperationalStateEnum.Running })
      .addZone(getSemtag(NumberTag.One))
      .addZone(getSemtag(NumberTag.Two))
      .addZone(getSemtag(NumberTag.Three))
      .addZone(getSemtag(NumberTag.Four));
    expect(device).toBeDefined();
    expect(device.id).toBe('IrrigationSystemTestDevice-IR123456');
    expect(device.getChildEndpointByOriginalId('Zone 1')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 2')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 3')).toBeDefined();
    expect(device.getChildEndpointByOriginalId('Zone 4')).toBeDefined();

    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(FlowMeasurement.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();

    // Default behavior: wired power source and NOT a single-zone valve endpoint
    expect(device.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({ description: 'AC Power', wiredCurrentType: PowerSource.WiredCurrentType.Ac });
    expect(device.hasClusterServer(ValveConfigurationAndControl.Cluster.id)).toBeFalsy();

    // Cover option paths
    expect(device.getClusterServerOptions(OperationalState.Cluster.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Running });
    expect(device.getClusterServerOptions(FlowMeasurement.Cluster.id)).toMatchObject({ measuredValue: 123 });

    // Cover default paths
    const defaultDevice = new IrrigationSystem('Irrigation System Default Device', 'IR000000');
    expect(defaultDevice.getClusterServerOptions(OperationalState.Cluster.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Stopped });
    expect(defaultDevice.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({ description: 'AC Power', wiredCurrentType: PowerSource.WiredCurrentType.Ac });
    expect(defaultDevice.hasClusterServer(ValveConfigurationAndControl.Cluster.id)).toBeFalsy();
  });

  test('create a single zone battery irrigation system device', async () => {
    singleZoneBatteryDevice = new IrrigationSystem('Irrigation System Single Zone', 'IRBAT001', { singleZone: true, batteryPowered: true, flowMeasuredValue: 45 });
    expect(singleZoneBatteryDevice).toBeDefined();
    expect(singleZoneBatteryDevice.id).toBe('IrrigationSystemSingleZone-IRBAT001');

    expect(singleZoneBatteryDevice.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(OperationalState.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(FlowMeasurement.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(singleZoneBatteryDevice.hasClusterServer(ValveConfigurationAndControl.Cluster.id)).toBeTruthy();

    expect(singleZoneBatteryDevice.getClusterServerOptions(FlowMeasurement.Cluster.id)).toMatchObject({ measuredValue: 45 });
    expect(singleZoneBatteryDevice.getClusterServerOptions(PowerSource.Cluster.id)).toMatchObject({
      description: 'Primary battery',
      batChargeLevel: PowerSource.BatChargeLevel.Ok,
    });
  });

  test('add an irrigation system device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('add a single zone battery irrigation system device', async () => {
    expect(await addDevice(server, singleZoneBatteryDevice)).toBeTruthy();
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
    expect(attributes.length).toBe(54);
  });

  test('single zone battery device forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    singleZoneBatteryDevice.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(typeof clusterName).toBe('string');
      expect(typeof clusterId).toBe('number');
      expect(typeof attributeName).toBe('string');
      expect(typeof attributeId).toBe('number');
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(69);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
