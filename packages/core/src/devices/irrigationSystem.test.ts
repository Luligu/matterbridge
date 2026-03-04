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

    // Cover option paths
    expect(device.getClusterServerOptions(OperationalState.Cluster.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Running });
    expect(device.getClusterServerOptions(FlowMeasurement.Cluster.id)).toMatchObject({ measuredValue: 123 });

    // Cover default paths
    const defaultDevice = new IrrigationSystem('Irrigation System Default Device', 'IR000000');
    expect(defaultDevice.getClusterServerOptions(OperationalState.Cluster.id)).toMatchObject({ operationalState: OperationalState.OperationalStateEnum.Stopped });
    expect(defaultDevice.getClusterServerOptions(FlowMeasurement.Cluster.id)).toMatchObject({ measuredValue: null });
  });

  test('add an irrigation system device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('device forEachAttribute', async () => {
    let count = 0;
    device.forEachAttribute(() => {
      count++;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
