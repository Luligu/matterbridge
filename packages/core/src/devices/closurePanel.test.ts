/* eslint-disable jest/no-standalone-expect */
// src/closurePanel.test.ts

const MATTER_PORT = 8023;
const NAME = 'ClosurePanel';
const HOMEDIR = path.join('.cache', 'jest', NAME);
const MATTER_CREATE_ONLY = true;

import path from 'node:path';

import { jest } from '@jest/globals';
import { stringify } from 'node-ansi-logger';

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

  afterEach(async () => {
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

    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 5000 });
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'targetState')).toMatchObject({ position: 5000 });

    // Exercise latch/speed optional fields.
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: true, speed: 2 });

    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
      speed: 1,
    });

    expect(device.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 5200 });
    expect(device.getAttribute(ClosureDimension.Cluster.id, 'targetState')).toMatchObject({ position: 5200 });

    // Exercise the "decrease" branch + currentState.position path.
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
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

    await device2.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 10000 });

    await device2.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.Cluster.id, 'currentState')).toMatchObject({ position: 0 });
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
        'closureDimension(0x105).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'closureDimension(0x105).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'closureDimension(0x105).clusterRevision(0xfffd)=1',
        'closureDimension(0x105).currentState(0x0)={ position: 5100, latch: undefined, speed: 1 }',
        'closureDimension(0x105).featureMap(0xfffc)={ positioning: true, motionLatching: false, unit: false, limitation: false, speed: false, translation: false, rotation: false, modulation: false }',
        'closureDimension(0x105).generatedCommandList(0xfff8)=[  ]',
        'closureDimension(0x105).resolution(0x2)=1',
        'closureDimension(0x105).stepValue(0x3)=100',
        'closureDimension(0x105).targetState(0x1)={ position: 5100, latch: true, speed: 2 }',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 561, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 261 ]',
      ].sort(),
    );
  });
  test('close the server node', async () => {
    expect(server).toBeDefined();
    await stopServerNode(server, MATTER_CREATE_ONLY);
  });
});
