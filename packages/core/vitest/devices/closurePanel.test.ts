/**
 * @file packages/core/vitest/devices/closurePanel.test.ts
 * @description This file contains the tests for the ClosurePanel device.
 * @author Luca Liguori
 */

const NAME = 'ClosurePanel';
const MATTER_PORT = 8023;
const MATTER_CREATE_ONLY = true;

import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import { ThreeLevelAuto } from '@matter/types/globals';
import { loggerErrorSpy, loggerFatalSpy, loggerWarnSpy, setupTest } from '@matterbridge/vitest-utils';
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
} from '@matterbridge/vitest-utils/matter';
import { stringify } from 'node-ansi-logger';

import { ClosurePanel } from '../../src/devices/closurePanel.js';
import { closurePanel } from '../../src/matterbridgeDeviceTypes.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: ClosurePanel;
  let device2: ClosurePanel;
  let device3: ClosurePanel;
  let device4: ClosurePanel;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    expect(loggerWarnSpy).not.toHaveBeenCalled();
    expect(loggerErrorSpy).not.toHaveBeenCalled();
    expect(loggerFatalSpy).not.toHaveBeenCalled();
  });

  afterAll(async () => {
    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('create the server node', async () => {
    await createServerNode(MATTER_PORT, closurePanel.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a closure panel device', () => {
    device = new ClosurePanel('Closure Panel Test Device', 'CP123456', { stepValue: 100 });
    expect(device).toBeDefined();
    expect(device.id).toBe('ClosurePanelTestDevice-CP123456');

    expect(device.hasClusterServer(ClosureDimension.id)).toBeTruthy();
  });

  test('add a closure panel device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('invoke closure dimension commands', async () => {
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 0, latch: true, speed: ThreeLevelAuto.Auto });
    expect(device.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 0, latch: true, speed: ThreeLevelAuto.Auto });
    expect(device.getAttribute(ClosureDimension.id, 'latchControlModes')).toMatchObject({ remoteLatching: true, remoteUnlatching: true });

    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 5000 });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 5000 });

    // Exercise latch/speed optional fields.
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: true, speed: 2 });

    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });

    expect(device.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 200 });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 200 });

    // Exercise the "decrease" branch + currentState.position path.
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 1,
    });
    expect(device.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 100 });
  });

  test('invoke step clamp branches', async () => {
    device2 = new ClosurePanel('Closure Panel Test Device 2', 'CP654321', { resolution: 2, stepValue: 6000 });
    expect(await addDevice(server, device2)).toBeTruthy();

    await device2.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 10000 });

    await device2.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 0 });
  });

  test('invoke closure dimension fallback branches', async () => {
    device4 = new ClosurePanel('Closure Panel Test Device 4', 'CP456789', {
      currentState: { position: null, latch: true, speed: ThreeLevelAuto.Auto },
      targetState: { position: 300, latch: true, speed: ThreeLevelAuto.Auto },
      stepValue: 10,
      latchControlModes: { remoteLatching: false, remoteUnlatching: true },
    });
    expect(await addDevice(server, device4)).toBeTruthy();
    expect(device4.getAttribute(ClosureDimension.id, 'latchControlModes')).toMatchObject({ remoteLatching: false, remoteUnlatching: true });

    await device4.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    expect(device4.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 320, latch: true, speed: ThreeLevelAuto.Auto });
    expect(device4.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 320, speed: ThreeLevelAuto.Auto });

    await device4.setAttribute(ClosureDimension.id, 'targetState', null);
    await device4.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: false });
    expect(device4.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ latch: false, speed: ThreeLevelAuto.Auto });

    await device4.setAttribute(ClosureDimension.id, 'currentState', null);
    await device4.setAttribute(ClosureDimension.id, 'targetState', null);
    await device4.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 1,
    });
    expect(device4.getAttribute(ClosureDimension.id, 'currentState')).toMatchObject({ position: 10, speed: ThreeLevelAuto.Auto });
    expect(device4.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 10, speed: ThreeLevelAuto.Auto });
  });

  test('cover constructor option defaults', async () => {
    device3 = new ClosurePanel('Closure Panel Test Device 3', 'CP345678');
    expect(await addDevice(server, device3)).toBeTruthy();
  });

  test('device forEachAttribute', () => {
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
        const sortedAttributeValue = (attributeValue as number[]).toSorted((a, b) => a - b);
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
        .toSorted(),
    ).toEqual(
      [
        'closureDimension(0x105).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'closureDimension(0x105).attributeList(0xfffb)=[ 0, 1, 2, 3, 11, 65528, 65529, 65531, 65532, 65533 ]',
        'closureDimension(0x105).clusterRevision(0xfffd)=1',
        'closureDimension(0x105).currentState(0x0)={ position: 100, latch: true, speed: 0 }',
        'closureDimension(0x105).featureMap(0xfffc)={ positioning: true, motionLatching: true, unit: false, limitation: false, speed: true, translation: false, rotation: false, modulation: false }',
        'closureDimension(0x105).generatedCommandList(0xfff8)=[  ]',
        'closureDimension(0x105).latchControlModes(0xb)={ remoteLatching: true, remoteUnlatching: true }',
        'closureDimension(0x105).resolution(0x2)=1',
        'closureDimension(0x105).stepValue(0x3)=100',
        'closureDimension(0x105).targetState(0x1)={ position: 100, latch: true, speed: 0 }',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 561, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 29, 261 ]',
      ].toSorted(),
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
