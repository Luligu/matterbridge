/**
 * @file packages/core/vitest/devices/closurePanel.test.ts
 * @description This file contains the tests for the ClosurePanel device.
 * @author Luca Liguori
 */

const NAME = 'ClosurePanel';
const MATTER_PORT = 8023;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
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

import { createClosureDimensionClusterServer, type ClosureDimensionType, type ClosurePanelOptions } from '../../src/devices/closurePanel.js';
import { closurePanel } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let device: MatterbridgeEndpoint;
  let device2: MatterbridgeEndpoint;
  let device3: MatterbridgeEndpoint;
  let device4: MatterbridgeEndpoint;

  const createClosurePanelTestEndpoint = (name: string, serial: string, dimensionType: ClosureDimensionType, options: ClosurePanelOptions = {}): MatterbridgeEndpoint => {
    const endpoint = new MatterbridgeEndpoint([closurePanel], { id: `${name.replaceAll(' ', '')}-${serial.replaceAll(' ', '')}` });

    endpoint.createDefaultBasicInformationClusterServer(name, serial, 0xfff1, 'Matterbridge', 0x8000, 'Matterbridge Closure Panel');
    createClosureDimensionClusterServer(endpoint, dimensionType, options);

    return endpoint;
  };

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
    device = createClosurePanelTestEndpoint('Closure Panel Test Device', 'CP123456', 'lift', { stepValue: 100 });
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

    // CurrentState.latch is true, so a position change must explicitly request latch: false (Matter spec §5.5.8.1.4).
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 5000, latch: false });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 5000 });

    // An omitted Latch field retains the previous target's latch value.
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { speed: ThreeLevelAuto.High });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toEqual({ position: 5000, latch: false, speed: ThreeLevelAuto.High });

    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: true, speed: ThreeLevelAuto.Medium });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ speed: ThreeLevelAuto.Medium });

    // An omitted position retains its previous target, while an omitted speed falls back to Auto.
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: true });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toEqual({ position: 5000, latch: true, speed: ThreeLevelAuto.Auto });

    // Direction, NumberOfSteps and Speed are constrained fields (Matter spec §5.5.8.2.1-3): an out-of-range value
    // SHALL return CONSTRAINT_ERROR, checked ahead of the latch/mainState InvalidInState checks below.
    await expect(
      device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
        direction: 2 as ClosureDimension.StepDirection,
        numberOfSteps: 1,
      }),
    ).rejects.toMatchObject({ code: Status.ConstraintError });

    await expect(
      device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
        direction: ClosureDimension.StepDirection.Increase,
        numberOfSteps: 0,
      }),
    ).rejects.toMatchObject({ code: Status.ConstraintError });

    await expect(
      device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
        direction: ClosureDimension.StepDirection.Increase,
        numberOfSteps: 1,
        speed: 4 as ThreeLevelAuto,
      }),
    ).rejects.toMatchObject({ code: Status.ConstraintError });

    // Step is only allowed while CurrentState is unlatched (Matter spec §5.5.8.2.4) and only updates TargetState,
    // computed from CurrentState.Position (Matter spec §5.5.8.2.4).
    await expect(
      device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
        direction: ClosureDimension.StepDirection.Increase,
        numberOfSteps: 1,
      }),
    ).rejects.toMatchObject({ code: Status.InvalidInState });

    await device.setAttribute(ClosureDimension.id, 'currentState', { position: 0, latch: false, speed: ThreeLevelAuto.Auto });
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toEqual({ position: 200, latch: true, speed: ThreeLevelAuto.Auto });

    // Exercise the "decrease" branch + currentState.position path.
    await device.setAttribute(ClosureDimension.id, 'currentState', { position: 200, latch: false, speed: ThreeLevelAuto.Auto });
    await device.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 1,
    });
    expect(device.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 100 });
  });

  test('invoke step clamp branches', async () => {
    device2 = createClosurePanelTestEndpoint('Closure Panel Test Device 2', 'CP654321', 'lift', { resolution: 2, stepValue: 6000 });
    expect(await addDevice(server, device2)).toBeTruthy();

    await device2.setAttribute(ClosureDimension.id, 'currentState', { position: 0, latch: false, speed: ThreeLevelAuto.Auto });
    await device2.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 10000 });

    await device2.setAttribute(ClosureDimension.id, 'currentState', { position: 10000, latch: false, speed: ThreeLevelAuto.Auto });
    await device2.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 2,
    });
    expect(device2.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 0 });
  });

  test('invoke closure dimension fallback branches', async () => {
    device4 = createClosurePanelTestEndpoint('Closure Panel Test Device 4', 'CP456789', 'lift', {
      currentState: { position: null, latch: true, speed: ThreeLevelAuto.Auto },
      targetState: { position: 300, latch: true, speed: ThreeLevelAuto.Auto },
      stepValue: 10,
      latchControlModes: { remoteLatching: false, remoteUnlatching: true },
    });
    expect(await addDevice(server, device4)).toBeTruthy();
    expect(device4.getAttribute(ClosureDimension.id, 'latchControlModes')).toMatchObject({ remoteLatching: false, remoteUnlatching: true });

    // A null CurrentState.Position is treated as 0 for the Step position calculation.
    await device4.setAttribute(ClosureDimension.id, 'currentState', { position: null, latch: false, speed: ThreeLevelAuto.Auto });
    await device4.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Increase,
      numberOfSteps: 2,
    });
    // TargetState.Speed remains unchanged since the command's Speed field was omitted.
    expect(device4.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 20, speed: ThreeLevelAuto.Auto });

    await device4.setAttribute(ClosureDimension.id, 'currentState', { position: null, latch: true, speed: ThreeLevelAuto.Auto });
    await device4.setAttribute(ClosureDimension.id, 'targetState', null);
    await device4.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { latch: false });
    expect(device4.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ latch: false, speed: ThreeLevelAuto.Auto });

    // Exercise the Direction Decrease branch, clamped at 0, a null previous TargetState, and an explicit Speed field.
    await device4.setAttribute(ClosureDimension.id, 'currentState', { position: null, latch: false, speed: ThreeLevelAuto.Auto });
    await device4.setAttribute(ClosureDimension.id, 'targetState', null);
    await device4.invokeBehaviorCommand('closureDimension', 'ClosureDimension.step', {
      direction: ClosureDimension.StepDirection.Decrease,
      numberOfSteps: 1,
      speed: ThreeLevelAuto.Medium,
    });
    expect(device4.getAttribute(ClosureDimension.id, 'targetState')).toEqual({ position: 0, speed: ThreeLevelAuto.Medium });
  });

  test('cover constructor option defaults', async () => {
    device3 = createClosurePanelTestEndpoint('Closure Panel Test Device 3', 'CP345678', 'lift');
    expect(await addDevice(server, device3)).toBeTruthy();
  });

  test('create a closure panel device with modulation dimension type', async () => {
    const device5 = createClosurePanelTestEndpoint('Closure Panel Test Device 5', 'CP567890', 'modulation');
    expect(await addDevice(server, device5)).toBeTruthy();
    expect(device5.getAttribute(ClosureDimension.id, 'modulationType')).toBe(ClosureDimension.ModulationType.SlatsOrientation);
  });

  test('create a closure panel device with motionLatching and speed disabled', async () => {
    const device6 = createClosurePanelTestEndpoint('Closure Panel Test Device 6', 'CP678901', 'lift', { motionLatching: false, speed: false });
    expect(await addDevice(server, device6)).toBeTruthy();

    expect(device6.getAttribute(ClosureDimension.id, 'featureMap')).toMatchObject({ positioning: true, motionLatching: false, speed: false, translation: true });
    expect(device6.hasAttributeServer(ClosureDimension.id, 'latchControlModes')).toBeFalsy();

    // Position-only SetTarget still works without the Latch/Speed fields the disabled features would have required.
    await device6.invokeBehaviorCommand('closureDimension', 'ClosureDimension.setTarget', { position: 3000 });
    expect(device6.getAttribute(ClosureDimension.id, 'targetState')).toMatchObject({ position: 3000 });
  });

  test('create a closure panel device with motionLatching enabled and speed disabled', async () => {
    const device7 = createClosurePanelTestEndpoint('Closure Panel Test Device 7', 'CP789012', 'tilt', { speed: false });
    expect(await addDevice(server, device7)).toBeTruthy();

    expect(device7.getAttribute(ClosureDimension.id, 'featureMap')).toMatchObject({ positioning: true, motionLatching: true, speed: false, rotation: true });
    expect(device7.getAttribute(ClosureDimension.id, 'latchControlModes')).toMatchObject({ remoteLatching: true, remoteUnlatching: true });
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
        'closureDimension(0x105).attributeList(0xfffb)=[ 0, 1, 2, 3, 7, 11, 65528, 65529, 65531, 65532, 65533 ]',
        'closureDimension(0x105).clusterRevision(0xfffd)=1',
        'closureDimension(0x105).currentState(0x0)={ position: 200, latch: false, speed: 0 }',
        'closureDimension(0x105).featureMap(0xfffc)={ positioning: true, motionLatching: true, unit: false, limitation: false, speed: true, translation: true, rotation: false, modulation: false }',
        'closureDimension(0x105).generatedCommandList(0xfff8)=[  ]',
        'closureDimension(0x105).latchControlModes(0xb)={ remoteLatching: true, remoteUnlatching: true }',
        'closureDimension(0x105).resolution(0x2)=1',
        'closureDimension(0x105).stepValue(0x3)=100',
        'closureDimension(0x105).targetState(0x1)={ position: 100, latch: true, speed: 0 }',
        'closureDimension(0x105).translationDirection(0x7)=0',
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
