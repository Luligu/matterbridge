/**
 * @file packages/core/vitest/devices/closure.test.ts
 * @description This file contains the tests for the Closure device.
 * @author Luca Liguori
 */

const NAME = 'Closure';
const MATTER_PORT = 8022;
const MATTER_CREATE_ONLY = true;

import { ClosureCoveringTag, ClosurePanelTag, ClosureTag } from '@matter/node';
import { ClosureControl } from '@matter/types/clusters/closure-control';
import { ClosureDimension } from '@matter/types/clusters/closure-dimension';
import { Identify } from '@matter/types/clusters/identify';
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

import { Closure } from '../../src/devices/closure.js';
import { closure } from '../../src/matterbridgeDeviceTypes.js';
import { getSemtag } from '../../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: Closure;
  let venetianBlind: Closure;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();
  });

  beforeEach(() => {
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
    await createServerNode(MATTER_PORT, closure.code);
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
  });

  test('create a closure device', () => {
    device = new Closure('Closure Test Device', 'CL123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('ClosureTestDevice-CL123456');

    expect(device.hasClusterServer(Identify.id)).toBeTruthy();
    expect(device.hasClusterServer(ClosureControl.id)).toBeTruthy();

    expect(device.getClusterServerOptions(ClosureControl.id)).toMatchObject({
      mainState: ClosureControl.MainState.Stopped,
    });
  });

  test('add a closure device', async () => {
    expect(await addDevice(server, device)).toBeTruthy();
  });

  test('check attributes after adding device to server', () => {
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);
  });

  test('invoke closure control commands', async () => {
    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
    });

    expect(device.getMainState()).toBe(ClosureControl.MainState.Moving);
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyOpen,
    });

    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.stop', {});
    expect(device.getMainState()).toBe(ClosureControl.MainState.Stopped);

    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: 1,
    });
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: true,
      speed: 1,
    });

    // Omit position to cover optional-field branches.
    await device.invokeBehaviorCommand('closureControl', 'ClosureControl.moveTo', {
      latch: false,
    });
    expect(device.getAttribute(ClosureControl.id, 'overallTargetState')).toMatchObject({
      position: ClosureControl.TargetPosition.MoveToFullyClosed,
      latch: false,
    });
  });

  test('create and add a closure device with two panels', async () => {
    venetianBlind = new Closure('Venetian Blind Test Device', 'CL654321', {
      tagList: [getSemtag(ClosureTag.Covering), getSemtag(ClosureCoveringTag.Venetian)],
    });
    venetianBlind.addPanel('Lift', [getSemtag(ClosurePanelTag.Lift)]);
    venetianBlind.addPanel('Tilt', [getSemtag(ClosurePanelTag.Tilt)], {
      resolution: 2,
      stepValue: 100,
      latchControlModes: { remoteLatching: false, remoteUnlatching: true },
    });

    expect(venetianBlind.getChildEndpointByOriginalId('Lift')).toBeDefined();
    expect(venetianBlind.getChildEndpointByOriginalId('Lift')?.hasClusterServer(ClosureDimension.id)).toBeTruthy();
    expect(venetianBlind.getChildEndpointByOriginalId('Tilt')).toBeDefined();
    expect(venetianBlind.getChildEndpointByOriginalId('Tilt')?.getClusterServerOptions(ClosureDimension.id)).toMatchObject({
      currentState: { position: 0, latch: true, speed: ThreeLevelAuto.Auto },
      targetState: { position: 0, latch: true, speed: ThreeLevelAuto.Auto },
      resolution: 2,
      stepValue: 100,
      latchControlModes: { remoteLatching: false, remoteUnlatching: true },
    });

    expect(await addDevice(server, venetianBlind)).toBeTruthy();
    expect(venetianBlind.getChildEndpointByOriginalId('Lift')?.getAttribute('Descriptor', 'tagList')).toEqual([
      { mfgCode: null, namespaceId: ClosurePanelTag.Lift.namespaceId, tag: ClosurePanelTag.Lift.tag },
    ]);
    expect(venetianBlind.getChildEndpointByOriginalId('Tilt')?.getAttribute('Descriptor', 'tagList')).toEqual([
      { mfgCode: null, namespaceId: ClosurePanelTag.Tilt.namespaceId, tag: ClosurePanelTag.Tilt.tag },
    ]);
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
        'closureControl(0x104).acceptedCommandList(0xfff9)=[ 0, 1 ]',
        'closureControl(0x104).attributeList(0xfffb)=[ 0, 1, 2, 3, 4, 5, 65528, 65529, 65531, 65532, 65533 ]',
        'closureControl(0x104).clusterRevision(0xfffd)=1',
        'closureControl(0x104).countdownTime(0x0)=0',
        'closureControl(0x104).currentErrorList(0x2)=[  ]',
        'closureControl(0x104).featureMap(0xfffc)={ positioning: true, motionLatching: true, instantaneous: false, speed: true, ventilation: false, pedestrian: false, calibration: false, protection: false, manuallyOperable: false }',
        'closureControl(0x104).generatedCommandList(0xfff8)=[  ]',
        'closureControl(0x104).latchControlModes(0x5)={ remoteLatching: true, remoteUnlatching: true }',
        'closureControl(0x104).mainState(0x1)=1',
        'closureControl(0x104).overallCurrentState(0x3)={ position: 0, latch: true, speed: 0, secureState: true }',
        'closureControl(0x104).overallTargetState(0x4)={ position: 0, latch: false, speed: 1 }',
        'descriptor(0x1d).acceptedCommandList(0xfff9)=[  ]',
        'descriptor(0x1d).attributeList(0xfffb)=[ 0, 1, 2, 3, 65528, 65529, 65531, 65532, 65533 ]',
        'descriptor(0x1d).clientList(0x2)=[  ]',
        'descriptor(0x1d).clusterRevision(0xfffd)=3',
        'descriptor(0x1d).deviceTypeList(0x0)=[ { deviceType: 560, revision: 1 } ]',
        'descriptor(0x1d).featureMap(0xfffc)={ tagList: false }',
        'descriptor(0x1d).generatedCommandList(0xfff8)=[  ]',
        'descriptor(0x1d).partsList(0x3)=[  ]',
        'descriptor(0x1d).serverList(0x1)=[ 3, 29, 260 ]',
        'identify(0x3).acceptedCommandList(0xfff9)=[ 0, 64 ]',
        'identify(0x3).attributeList(0xfffb)=[ 0, 1, 65528, 65529, 65531, 65532, 65533 ]',
        'identify(0x3).clusterRevision(0xfffd)=6',
        'identify(0x3).featureMap(0xfffc)={  }',
        'identify(0x3).generatedCommandList(0xfff8)=[  ]',
        'identify(0x3).identifyTime(0x0)=0',
        'identify(0x3).identifyType(0x1)=0',
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
