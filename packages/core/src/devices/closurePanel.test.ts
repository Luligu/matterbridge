/* eslint-disable jest/no-standalone-expect */
// src/closurePanel.test.ts

const MATTER_PORT = 8023;
const NAME = 'ClosurePanel';
const HOMEDIR = path.join('jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';

import { ClosureDimension } from '../clusters/closure-dimension.js';
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
import { closurePanel } from '../matterbridgeDeviceTypes.js';
import { ClosurePanel } from './closurePanel.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: ClosurePanel;
  let device2: ClosurePanel;

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
    await startServerNode(NAME, MATTER_PORT, closurePanel.code, MATTER_CREATE_ONLY);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  }, 10000);

  test('create a closure panel device', async () => {
    device = new ClosurePanel('Closure Panel Test Device', 'CP123456', { stepValue: 100 });
    expect(device).toBeDefined();
    expect(device.id).toBe('ClosurePanelTestDevice-CP123456');

    expect(device.hasClusterServer(ClosureDimension.Cluster.id)).toBeTruthy();
  });

  test('add a closure panel device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('invoke closure dimension commands', async () => {
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'targetState')).toBeNull();
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toBeNull();

    await device.invokeBehaviorCommand('closureDimension', 'setTarget', { position: 5000 });
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'targetState')).toMatchObject({ position: 5000 });

    // Exercise latch/speed optional fields.
    await device.invokeBehaviorCommand('closureDimension', 'setTarget', { latch: true, speed: 2 });

    await device.invokeBehaviorCommand('closureDimension', 'step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
      speed: 1,
    });

    expect(device.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 5200 });
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'targetState')).toMatchObject({ position: 5200 });

    // Exercise the "decrease" branch + currentState.position path.
    await device.invokeBehaviorCommand('closureDimension', 'step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 1,
    });
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 5100 });
  });

  test('invoke step clamp and fallback branches', async () => {
    // Cover constructor option defaults (stepValue/resolution fallbacks).
    const device3 = new ClosurePanel('Closure Panel Test Device 3', 'CP000000');
    expect(device3).toBeDefined();

    // Create a second device to exercise step without a prior setTarget (fallback currentPosition = 0)
    device2 = new ClosurePanel('Closure Panel Test Device 2', 'CP654321', { resolution: 2, stepValue: 6000 });
    expect(await addDevice(server, device2)).toBeTruthy();

    await device2.invokeBehaviorCommand('closureDimension', 'step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 10000 });

    await device2.invokeBehaviorCommand('closureDimension', 'step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 0 });
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
