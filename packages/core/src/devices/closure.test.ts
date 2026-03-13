/* eslint-disable jest/no-standalone-expect */
// src/closure.test.ts

const MATTER_PORT = 8022;
const NAME = 'Closure';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { Identify } from '@matter/types/clusters/identify';

import { ClosureControl } from '../clusters/closure-control.js';
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
import { closure } from '../matterbridgeDeviceTypes.js';
import { Closure } from './closure.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Closure;

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
    await startServerNode(NAME, MATTER_PORT, closure.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a closure device', async () => {
    device = new Closure('Closure Test Device', 'CL123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ClosureTestDevice-CL123456');

    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(ClosureControl.Cluster.id)).toBeTruthy();

    expect(device.getClusterServerOptions(ClosureControl.Cluster.id)).toMatchObject({
      mainState: ClosureControl.MainState.Stopped,
    });
  });

  test('add a closure device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('check attributes after adding device to server', async () => {
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);
  });

  test('invoke closure control commands', async () => {
    await device.invokeBehaviorCommand('closureControl', 'moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
    });

    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.Cluster.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
    });

    await device.invokeBehaviorCommand('closureControl', 'stop');
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);

    await device.invokeBehaviorCommand('closureControl', 'moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: 1,
    });
    expect(device.getAttribute(ClosureControl.Cluster.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: 1,
    });

    // Omit position to cover optional-field branches.
    await device.invokeBehaviorCommand('closureControl', 'moveTo', {
      latch: false,
    });
    expect(device.getAttribute(ClosureControl.Cluster.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
    });
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
    expect(attributes.length).toBe(27);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
