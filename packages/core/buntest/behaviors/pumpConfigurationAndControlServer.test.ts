/**
 * @file packages/core/buntest/behaviors/pumpConfigurationAndControlServer.test.ts
 * @description This file contains the bun tests for pumpConfigurationAndControlServer.
 * @author Luca Liguori
 */

const NAME = 'PumpConfigurationAndControlServer';
const MATTER_PORT = 12400;

import { describe, expect, test } from 'bun:test';

import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import type { ClusterId } from '@matter/types/datatype';
import { Status } from '@matter/types/globals';
import { flushAsync } from '@matterbridge/test-utils';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeLevelControlServer } from '../../src/behaviors/levelControlServer.js';
import { MatterbridgePumpConfigurationAndControlServer } from '../../src/behaviors/pumpConfigurationAndControlServer.js';
import { bridgedNode, pump } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { OperationMode } = PumpConfigurationAndControl;
const PUMP = PumpConfigurationAndControl.id;

interface PumpOptions {
  /** Initial OnOff value, or undefined for the OnOff default. */
  onOff?: boolean;
  /** Initial CurrentLevel of a LevelControl server, or undefined for no LevelControl at all. */
  level?: number | null;
  /** MaxLevel of the LevelControl server (default 254). */
  maxLevel?: number;
  /** Use the 3000 rpm limits (maxSpeed, minConstSpeed 1000, maxConstSpeed 3000) instead of the defaults. */
  limits?: boolean;
}

/**
 * Creates and adds a Pump endpoint.
 *
 * @param {string} id - The endpoint id.
 * @param {PumpOptions} [options] - The pump options.
 * @returns {Promise<MatterbridgeEndpoint>} The added pump.
 */
async function addPump(id: string, { onOff, level, maxLevel = 254, limits = true }: PumpOptions = {}): Promise<MatterbridgeEndpoint> {
  const device = new MatterbridgeEndpoint(pump, { id });
  device.createDefaultIdentifyClusterServer();
  device.createOnOffClusterServer(onOff);
  if (level !== undefined)
    device.behaviors.require(MatterbridgeLevelControlServer.with(), { currentLevel: level, minLevel: 0, maxLevel, onLevel: null, options: { executeIfOff: false } });
  if (limits) device.createDefaultPumpConfigurationAndControlClusterServer(OperationMode.Normal, null, 3000, null, 1000, 3000);
  else device.createDefaultPumpConfigurationAndControlClusterServer();
  device.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  return device;
}

/**
 * Writes an attribute and lets the pump reactors run.
 *
 * @param {MatterbridgeEndpoint} device - The pump.
 * @param {ClusterId} cluster - The cluster id.
 * @param {string} attribute - The attribute name.
 * @param {boolean | number | object | null} value - The value to write.
 * @returns {Promise<void>} Resolves after the reactors ran.
 */
async function write(device: MatterbridgeEndpoint, cluster: ClusterId, attribute: string, value: boolean | number | object | null): Promise<void> {
  await device.setAttribute(cluster, attribute, value);
  await flushAsync(undefined, undefined, 0);
}

const speedCapacity = (device: MatterbridgeEndpoint): [unknown, unknown] => [device.getAttribute(PUMP, 'speed'), device.getAttribute(PUMP, 'capacity')];
const running = (device: MatterbridgeEndpoint): unknown => (device.getAttribute(PUMP, 'pumpStatus') as { running?: boolean }).running;

describe('MatterbridgePumpConfigurationAndControlServer', () => {
  useServerNode(MATTER_PORT);

  test('null physical limits get the medium capacity defaults, explicit ones are kept', async () => {
    const limitsOf = (device: MatterbridgeEndpoint): unknown[] =>
      ['minConstSpeed', 'maxConstSpeed', 'maxPressure', 'maxSpeed', 'maxFlow'].map((name) => device.getAttribute(PUMP, name));
    expect(limitsOf(await addPump('noDefaultsPump', { limits: false }))).toEqual([600, 3000, 6000, 3000, 100]);
    const explicitPump = new MatterbridgeEndpoint(pump, { id: 'explicitPump' });
    explicitPump.createDefaultIdentifyClusterServer();
    explicitPump.createOnOffClusterServer();
    explicitPump.createDefaultPumpConfigurationAndControlClusterServer(OperationMode.Normal, 8000, 4000, 200, 1000, 4000);
    explicitPump.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, explicitPump, 0, 0, 0, 0)).toBeTruthy();
    expect(limitsOf(explicitPump)).toEqual([1000, 4000, 8000, 4000, 200]);
  });

  test('CurrentLevel maps to Speed and Capacity with the Level/2 percent rule (Device Library § 5.5.5.2)', async () => {
    // maxConstSpeed 3000: level 120 = 60.0% = speed 1800, capacity 12000; level 200 or more = 100.0%.
    const device = await addPump('levelPump', { onOff: true, level: 0 });
    for (const [level, expected] of [
      [120, [1800, 12000]],
      [200, [3000, 20000]],
      [254, [3000, 20000]],
      [0, [0, 0]],
    ] as const) {
      await write(device, LevelControl.id, 'currentLevel', level);
      expect(speedCapacity(device)).toEqual([...expected]);
      expect(running(device)).toBe(level > 0);
    }
  });

  test('OnOff stops the pump and restarts it at the CurrentLevel setpoint, or at MaxLevel without LevelControl', async () => {
    const device = await addPump('onOffPump', { onOff: false, level: 120 });
    await write(device, OnOff.id, 'onOff', true);
    expect([...speedCapacity(device), running(device)]).toEqual([1800, 12000, true]);
    await write(device, OnOff.id, 'onOff', false);
    expect([...speedCapacity(device), running(device)]).toEqual([0, 0, false]);

    // LevelControl is optional for a Pump: without it the pump runs at 100%.
    const noLevel = await addPump('noLevelPump', { onOff: false });
    expect(noLevel.hasAttributeServer(LevelControl.id, 'currentLevel')).toBe(false);
    await write(noLevel, OnOff.id, 'onOff', true);
    expect([...speedCapacity(noLevel), running(noLevel)]).toEqual([3000, 20000, true]);
    // Created already on: initialize() starts it at 100% too.
    const onNoLevel = await addPump('onNoLevelPump', { onOff: true });
    expect([...speedCapacity(onNoLevel), running(onNoLevel)]).toEqual([3000, 20000, true]);
  });

  test('a null CurrentLevel falls back to MaxLevel at start and stops the pump later, keeping the last level', async () => {
    const device = await addPump('nullLevelPump', { onOff: false, level: null, maxLevel: 200 });
    await write(device, OnOff.id, 'onOff', true);
    expect(speedCapacity(device)).toEqual([3000, 20000]);
    await write(device, LevelControl.id, 'currentLevel', 120);
    expect(speedCapacity(device)).toEqual([1800, 12000]);
    await write(device, LevelControl.id, 'currentLevel', null);
    expect(speedCapacity(device)).toEqual([0, 0]);
    await device.setAttribute(OnOff.id, 'onOff', false);
    await write(device, OnOff.id, 'onOff', true);
    expect(speedCapacity(device)).toEqual([1800, 12000]);
  });

  test('Speed falls back to MaxSpeed, then 0, when MaxConstSpeed is unset', async () => {
    const device = await addPump('noConstSpeedPump', { onOff: true, level: 200 });
    await device.setAttribute(PUMP, 'maxConstSpeed', null);
    await write(device, LevelControl.id, 'currentLevel', 254);
    expect(speedCapacity(device)).toEqual([3000, 20000]);
    // Capacity only depends on the setpoint percentage.
    await device.setAttribute(PUMP, 'maxSpeed', null);
    await write(device, LevelControl.id, 'currentLevel', 200);
    expect(speedCapacity(device)).toEqual([0, 20000]);
  });

  test('the PumpStatus Running bit follows OnOff and the other bits are preserved', async () => {
    const device = await addPump('statusPump', { onOff: false, limits: false });
    expect(running(device)).toBe(false);
    await device.setAttribute(PUMP, 'pumpStatus', { running: false, deviceFault: true });
    for (const onOff of [true, false]) {
      await write(device, OnOff.id, 'onOff', onOff);
      expect(device.getAttribute(PUMP, 'pumpStatus')).toMatchObject({ running: onOff, deviceFault: true });
    }
  });

  test('a pump without PumpStatus or without OnOff is left alone', async () => {
    const noStatus = new MatterbridgeEndpoint(pump, { id: 'noStatusPump' });
    noStatus.createDefaultIdentifyClusterServer();
    noStatus.createOnOffClusterServer(false);
    // PumpStatus is optional (§ 4.2.7.14).
    noStatus.behaviors.require(MatterbridgePumpConfigurationAndControlServer, {
      maxPressure: null,
      maxSpeed: null,
      maxFlow: null,
      minConstSpeed: null,
      maxConstSpeed: null,
      effectiveOperationMode: OperationMode.Normal,
      effectiveControlMode: PumpConfigurationAndControl.ControlMode.ConstantSpeed,
      capacity: null,
      operationMode: OperationMode.Normal,
    });
    noStatus.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, noStatus, 0, 0, 0, 0)).toBeTruthy();
    await write(noStatus, OnOff.id, 'onOff', true);
    expect(noStatus.getAttribute(PUMP, 'speed')).toBe(3000);
    expect(noStatus.hasAttributeServer(PUMP, 'pumpStatus')).toBe(false);

    // No OnOff cluster: initialize() registers no OnOff reactor.
    const noOnOff = new MatterbridgeEndpoint(bridgedNode, { id: 'noOnOffPump' });
    noOnOff.createDefaultIdentifyClusterServer();
    noOnOff.createDefaultPumpConfigurationAndControlClusterServer(OperationMode.Normal, null, 3000, null, 1000, 3000);
    expect(await addBridgedDevice(aggregator, noOnOff, 0, 0, 0, 0)).toBeTruthy();
    expect(noOnOff.hasAttributeServer(OnOff.id, 'onOff')).toBe(false);
    expect(speedCapacity(noOnOff)).toEqual([null, null]);
  });

  test('OperationMode is mirrored to EffectiveOperationMode and rejected with FAILURE during LocalOverride', async () => {
    const device = await addPump('opModePump', { limits: false });
    const modes = (): unknown[] => [device.getAttribute(PUMP, 'operationMode'), device.getAttribute(PUMP, 'effectiveOperationMode')];
    expect(device.getAttribute(PUMP, 'effectiveOperationMode')).toBe(OperationMode.Normal);
    for (const mode of [OperationMode.Minimum, OperationMode.Maximum, OperationMode.Minimum]) {
      await device.setAttribute(PUMP, 'operationMode', mode);
      expect(modes()).toEqual([mode, mode]);
    }
    // § 4.2.6.1.3: changing OperationMode fails while LocalOverride is set.
    await device.setAttribute(PUMP, 'pumpStatus', { running: false, localOverride: true });
    expect(device.setAttribute(PUMP, 'operationMode', OperationMode.Maximum)).rejects.toMatchObject({ code: Status.Failure });
    expect(modes()).toEqual([OperationMode.Minimum, OperationMode.Minimum]);
    await device.setAttribute(PUMP, 'pumpStatus', { running: false, localOverride: false });
    await device.setAttribute(PUMP, 'operationMode', OperationMode.Maximum);
    expect(modes()).toEqual([OperationMode.Maximum, OperationMode.Maximum]);
  });

  test('Minimum and Maximum force MinConstSpeed and MaxConstSpeed, independent of LevelControl (§ 4.2.6.2)', async () => {
    const device = await addPump('opSpeedPump', { onOff: true, level: 0 });
    await write(device, LevelControl.id, 'currentLevel', 120);
    expect(speedCapacity(device)).toEqual([1800, 12000]);
    // Minimum: 1000 rpm = round(1000 / 3000 * 100 * 200) = 6667.
    await device.setAttribute(PUMP, 'operationMode', OperationMode.Minimum);
    expect(speedCapacity(device)).toEqual([1000, 6667]);
    await device.setAttribute(PUMP, 'operationMode', OperationMode.Maximum);
    expect(speedCapacity(device)).toEqual([3000, 20000]);
    // A level change in Maximum has no effect, back to Normal restores the level setpoint (42 = 21%).
    await write(device, LevelControl.id, 'currentLevel', 42);
    expect(speedCapacity(device)).toEqual([3000, 20000]);
    await device.setAttribute(PUMP, 'operationMode', OperationMode.Normal);
    expect(speedCapacity(device)).toEqual([630, 4200]);

    // Minimum with no MaxConstSpeed and no MaxSpeed reports 0% capacity, and 0 rpm once MinConstSpeed is unset too.
    const minNoMax = await addPump('minNoMaxPump', { onOff: true });
    await minNoMax.setAttribute(PUMP, 'maxConstSpeed', null);
    await minNoMax.setAttribute(PUMP, 'maxSpeed', null);
    await minNoMax.setAttribute(PUMP, 'operationMode', OperationMode.Minimum);
    expect(speedCapacity(minNoMax)).toEqual([1000, 0]);
    await minNoMax.setAttribute(PUMP, 'minConstSpeed', null);
    await minNoMax.setAttribute(PUMP, 'operationMode', OperationMode.Normal);
    await minNoMax.setAttribute(PUMP, 'operationMode', OperationMode.Minimum);
    expect(speedCapacity(minNoMax)).toEqual([0, 0]);
  });

  test('OperationMode and CurrentLevel changes while Off keep the pump stopped and apply on the next On (§ 5.5.5.1)', async () => {
    const device = await addPump('offPump', { onOff: false, level: 120 });
    // Created Off: initialize() leaves Speed and Capacity unreported (null).
    await device.setAttribute(PUMP, 'operationMode', OperationMode.Maximum);
    expect(device.getAttribute(PUMP, 'effectiveOperationMode')).toBe(OperationMode.Maximum);
    expect([...speedCapacity(device), running(device)]).toEqual([null, null, false]);
    await device.setAttribute(PUMP, 'operationMode', OperationMode.Normal);
    await write(device, LevelControl.id, 'currentLevel', 42);
    expect([...speedCapacity(device), running(device)]).toEqual([null, null, false]);
    // On applies the level stored while Off (42 = 21%).
    await write(device, OnOff.id, 'onOff', true);
    expect([...speedCapacity(device), running(device)]).toEqual([630, 4200, true]);
  });
});
