/**
 * @file packages/core/buntest/behaviors/fanControlServer.test.ts
 * @description This file contains the bun tests for fanControlServer.
 * @author Luca Liguori
 */

const NAME = 'FanControlServer';
const MATTER_PORT = 11900;

import { describe, expect, test } from 'bun:test';

import { FanControl } from '@matter/types/clusters/fan-control';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { MatterbridgeFanControlServer } from '../../src/behaviors/fanControlServer.js';
import { fan } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { FanMode, FanModeSequence, StepDirection } = FanControl;
type FanAttribute = 'fanMode' | 'percentSetting' | 'percentCurrent' | 'speedSetting' | 'speedCurrent';

/**
 * Creates and adds a fan. Without `multiSpeed` it uses the default Auto + Step server with OffLowMedHighAuto.
 *
 * @param {string} id - The endpoint id.
 * @param {[FanControl.FanMode, number, number, number, number]} [multiSpeed] - FanMode, percent setting/current, SpeedMax and speed setting/current of a MultiSpeed fan.
 * @returns {Promise<MatterbridgeEndpoint>} The added fan.
 */
async function addFan(id: string, multiSpeed?: [FanControl.FanMode, number, number, number, number]): Promise<MatterbridgeEndpoint> {
  const device = new MatterbridgeEndpoint(fan, { id });
  if (multiSpeed) {
    const [fanMode, percent, speedMax, speed] = multiSpeed;
    device.createMultiSpeedFanControlClusterServer(fanMode, FanModeSequence.OffLowMedHighAuto, percent, percent, speedMax, speed, speed);
  } else device.createDefaultFanControlClusterServer(FanMode.Off, FanModeSequence.OffLowMedHighAuto, 0, 0);
  device.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
  return device;
}

/**
 * Reads FanControl attributes.
 *
 * @param {MatterbridgeEndpoint} device - The fan.
 * @param {FanAttribute[]} names - The attributes to read.
 * @returns {unknown[]} The values, in order.
 */
const read = (device: MatterbridgeEndpoint, ...names: FanAttribute[]): unknown[] => names.map((name) => device.getAttribute(FanControl, name));

/**
 * Invokes Step through the behavior.
 *
 * @param {MatterbridgeEndpoint} device - The fan.
 * @param {FanControl.StepRequest} request - The Step request.
 * @returns {Promise<void>} Resolves once the command completed.
 */
const step = async (device: MatterbridgeEndpoint, request: FanControl.StepRequest): Promise<void> =>
  device.act(async (agent) => agent.get(MatterbridgeFanControlServer).step(request));

describe('MatterbridgeFanControlServer', () => {
  useServerNode(MATTER_PORT);

  test('FanMode rules (§ 4.4.6.1): Off zeroes, Auto nulls, On and Smart are remapped', async () => {
    const device = await addFan('FanControlServerTest');
    expect(read(device, 'fanMode')).toEqual([FanMode.Off]);
    expect(device.getAttribute(FanControl, 'fanModeSequence')).toBe(FanModeSequence.OffLowMedHighAuto);
    // Off zeroes PercentSetting and PercentCurrent (leave Off first, a same-value write triggers nothing).
    await device.setAttribute(FanControl, 'fanMode', FanMode.Medium);
    await device.setAttribute(FanControl, 'percentSetting', 60);
    await device.setAttribute(FanControl, 'percentCurrent', 60);
    await device.setAttribute(FanControl, 'fanMode', FanMode.Off);
    expect(read(device, 'fanMode', 'percentSetting', 'percentCurrent')).toEqual([FanMode.Off, 0, 0]);
    // Auto nulls PercentSetting and leaves PercentCurrent alone.
    await device.setAttribute(FanControl, 'percentSetting', 60);
    await device.setAttribute(FanControl, 'percentCurrent', 60);
    await device.setAttribute(FanControl, 'fanMode', FanMode.Auto);
    expect(read(device, 'fanMode', 'percentSetting', 'percentCurrent')).toEqual([FanMode.Auto, null, 60]);
    // The deprecated On is High, the deprecated Smart is Auto when supported.
    // oxlint-disable-next-line typescript/no-deprecated
    await device.setAttribute(FanControl, 'fanMode', FanMode.On);
    expect(read(device, 'fanMode')).toEqual([FanMode.High]);
    // oxlint-disable-next-line typescript/no-deprecated
    await device.setAttribute(FanControl, 'fanMode', FanMode.Smart);
    expect(read(device, 'fanMode')).toEqual([FanMode.Auto]);

    // Without the Auto feature Smart is High.
    const noAuto = new MatterbridgeEndpoint(fan, { id: 'FanControlServerNoAutoTest' });
    noAuto.behaviors.require(MatterbridgeFanControlServer.with(FanControl.Feature.Step), {
      fanMode: FanMode.Off,
      fanModeSequence: FanModeSequence.OffLowMedHigh,
      percentSetting: 0,
      percentCurrent: 0,
    });
    noAuto.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, noAuto, 0, 0, 0, 0)).toBeTruthy();
    // oxlint-disable-next-line typescript/no-deprecated
    await noAuto.setAttribute(FanControl, 'fanMode', FanMode.Smart);
    expect(read(noAuto, 'fanMode')).toEqual([FanMode.High]);

    // A FanMode outside FanModeSequence is CONSTRAINT_ERROR: OffLowHighAuto has no Medium.
    const noMedium = new MatterbridgeEndpoint(fan, { id: 'FanControlServerConstraintTest' });
    noMedium.createDefaultFanControlClusterServer(FanMode.Off, FanModeSequence.OffLowHighAuto, 0, 0);
    noMedium.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, noMedium, 0, 0, 0, 0)).toBeTruthy();
    expect(noMedium.setAttribute(FanControl, 'fanMode', FanMode.Medium)).rejects.toThrow();
    expect(read(noMedium, 'fanMode')).toEqual([FanMode.Off]);

    // With MultiSpeed, Off and Auto also zero and null the speeds.
    const multiSpeed = await addFan('FanControlServerMultiSpeedTest', [FanMode.Medium, 60, 10, 6, 6]);
    expect(read(multiSpeed, 'speedSetting', 'speedCurrent')).toEqual([6, 6]);
    await multiSpeed.setAttribute(FanControl, 'fanMode', FanMode.Off);
    expect(read(multiSpeed, 'percentSetting', 'percentCurrent', 'speedSetting', 'speedCurrent')).toEqual([0, 0, 0, 0]);
    await multiSpeed.setAttribute(FanControl, 'fanMode', FanMode.Auto);
    expect(read(multiSpeed, 'percentSetting', 'speedSetting')).toEqual([null, null]);
  });

  test('PercentSetting rules (§ 4.4.6.3): ranges Low 1-33, Medium 34-66, High 67-100', async () => {
    const device = await addFan('PercentSettingServerTest');
    await device.setAttribute(FanControl, 'fanMode', FanMode.High);
    // A written PercentSetting selects the FanMode of its range and is kept as written; 0 is Off.
    for (const [percent, mode] of [
      [0, FanMode.Off],
      [20, FanMode.Low],
      [50, FanMode.Medium],
      [90, FanMode.High],
    ] as const) {
      await device.setAttribute(FanControl, 'percentSetting', percent);
      expect(read(device, 'fanMode', 'percentSetting')).toEqual([mode, percent]);
    }
    // A FanMode write moves an out-of-range PercentSetting into the new range...
    await device.setAttribute(FanControl, 'fanMode', FanMode.Off);
    await device.setAttribute(FanControl, 'fanMode', FanMode.Medium);
    const [percentSetting] = read(device, 'percentSetting') as [number];
    expect(percentSetting).toBeGreaterThanOrEqual(34);
    expect(percentSetting).toBeLessThanOrEqual(66);
    // ...and leaves an in-range one untouched.
    await device.setAttribute(FanControl, 'fanMode', FanMode.High);
    await device.setAttribute(FanControl, 'percentSetting', 10);
    await device.setAttribute(FanControl, 'fanMode', FanMode.Low);
    expect(read(device, 'fanMode', 'percentSetting')).toEqual([FanMode.Low, 10]);
    // A null write changes nothing.
    await device.setAttribute(FanControl, 'percentSetting', null);
    expect(read(device, 'fanMode', 'percentSetting')).toEqual([FanMode.Low, 10]);
  });

  test.each([
    // [label, SpeedMax, PercentSetting written, SpeedSetting expected]
    ['ceil(SpeedMax * percent / 100)', 42, 25, 11],
    ['without floating-point error (10 * 70 / 100 = 7)', 10, 70, 7],
    ['without the reciprocal SpeedSetting mapping overwriting it', 10, 1, 1],
  ] as const)('PercentSetting maps to SpeedSetting %s (§ 4.4.6.3.1)', async (label, speedMax, percent, speed) => {
    const device = await addFan(`Percent${label.replace(/\W/g, '')}`.slice(0, 40), [FanMode.Off, 0, speedMax, 0, 0]);
    await device.setAttribute(FanControl, 'percentSetting', percent);
    expect(read(device, 'percentSetting', 'speedSetting')).toEqual([percent, speed]);
  });

  test('SpeedSetting rules (§ 4.4.6.6.1)', async () => {
    // Writing every SpeedSetting from 1 to SpeedMax reads back the written value (TC_FAN_3_2).
    const ascending = await addFan('SpeedSettingAscendingTest', [FanMode.Off, 0, 10, 0, 0]);
    for (let speed = 1; speed <= 10; speed++) {
      await ascending.setAttribute(FanControl, 'speedSetting', speed);
      expect(read(ascending, 'speedSetting')).toEqual([speed]);
    }
    // 0 is Off with PercentSetting 0, SpeedMax is High with PercentSetting 100.
    const zero = await addFan('SpeedSettingZeroTest', [FanMode.High, 90, 10, 9, 9]);
    await zero.setAttribute(FanControl, 'speedSetting', 0);
    expect(read(zero, 'fanMode', 'percentSetting')).toEqual([FanMode.Off, 0]);
    const max = await addFan('SpeedSettingMaxTest', [FanMode.Off, 0, 10, 0, 0]);
    await max.setAttribute(FanControl, 'speedSetting', 10);
    expect(read(max, 'fanMode', 'percentSetting')).toEqual([FanMode.High, 100]);
    // A null write outside Auto changes nothing.
    const nullWrite = await addFan('SpeedSettingNullTest', [FanMode.Low, 20, 10, 2, 2]);
    await nullWrite.setAttribute(FanControl, 'speedSetting', null);
    expect(read(nullWrite, 'speedSetting', 'fanMode')).toEqual([2, FanMode.Low]);
    // SpeedSetting 2 of 3 reverse-maps to the current PercentSetting 67, which is kept as is.
    const reverse = await addFan('SpeedSettingReverseMapIdempotencyTest', [FanMode.High, 67, 3, 3, 3]);
    await reverse.setAttribute(FanControl, 'speedSetting', 2);
    expect(read(reverse, 'speedSetting', 'percentSetting', 'fanMode')).toEqual([2, 67, FanMode.High]);
  });

  test('Step (§ 4.4.7.1) walks the FanModeSequence, clamps or wraps, and honours LowestOff', async () => {
    const device = await addFan('FanControlServerStepTest');
    const increase = { direction: StepDirection.Increase, wrap: false, lowestOff: true };
    // Off to Low converges PercentCurrent with PercentSetting inside Low's range.
    await step(device, increase);
    const [mode, percentSetting, percentCurrent] = read(device, 'fanMode', 'percentSetting', 'percentCurrent') as [number, number, number];
    expect([mode, percentSetting]).toEqual([FanMode.Low, percentCurrent]);
    expect(percentSetting).toBeGreaterThanOrEqual(1);
    expect(percentSetting).toBeLessThanOrEqual(33);
    // Low, Medium, High, then clamped at High without wrap.
    for (const expected of [FanMode.Medium, FanMode.High, FanMode.High]) {
      await step(device, increase);
      expect(read(device, 'fanMode')).toEqual([expected]);
    }
    // Wrap at the top goes to Off.
    await step(device, { ...increase, wrap: true });
    expect(read(device, 'fanMode', 'percentSetting', 'percentCurrent')).toEqual([FanMode.Off, 0, 0]);
    // LowestOff false keeps Off out of the sequence: Decrease at Low clamps at Low.
    await device.setAttribute(FanControl, 'fanMode', FanMode.Low);
    await step(device, { direction: StepDirection.Decrease, wrap: false, lowestOff: false });
    expect(read(device, 'fanMode')).toEqual([FanMode.Low]);

    // With MultiSpeed the step also converges SpeedCurrent with the SpeedMax formula.
    const multiSpeed = await addFan('FanControlServerStepMultiSpeedTest', [FanMode.Off, 0, 10, 0, 0]);
    await step(multiSpeed, increase);
    const [multiPercent, speedCurrent, speedSetting] = read(multiSpeed, 'percentSetting', 'speedCurrent', 'speedSetting') as [number, number, number];
    expect([speedCurrent, speedSetting]).toEqual([Math.ceil(10 * (multiPercent * 0.01)), speedCurrent]);

    // Omitted Wrap and LowestOff default to false and true.
    const defaults = await addFan('FanControlServerStepDefaultsTest');
    await step(defaults, { direction: StepDirection.Increase });
    expect(read(defaults, 'fanMode')).toEqual([FanMode.Low]);
  });

  test('Step is forwarded to the plugin first and lands PercentCurrent on the range boundary', async () => {
    const vent = new MatterbridgeEndpoint(fan, { id: 'fan' });
    vent.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    vent.createDefaultHepaFilterMonitoringClusterServer();
    vent.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, vent, 0, 0, 0, 0)).toBeTruthy();
    expect(vent.getAttribute(FanControl.id, 'percentCurrent')).toBe(0);
    const emitted: unknown[] = [];
    vent.subscribeCommand(FanControl, 'step', (data) => emitted.push(data.request));
    const calls = recordCommand(vent, 'step');

    // [starting FanMode or undefined to continue, direction, wrap, lowestOff, FanMode after, PercentCurrent after]
    const sequence: [FanControl.FanMode | undefined, FanControl.StepDirection, boolean, boolean, FanControl.FanMode, number][] = [
      [undefined, StepDirection.Increase, false, false, FanMode.Low, 1],
      [FanMode.High, StepDirection.Increase, true, false, FanMode.Low, 1],
      [FanMode.High, StepDirection.Increase, true, true, FanMode.Off, 0],
      [FanMode.Medium, StepDirection.Decrease, false, false, FanMode.Low, 33],
      [undefined, StepDirection.Decrease, true, false, FanMode.High, 100],
      [FanMode.Off, StepDirection.Decrease, true, true, FanMode.High, 100],
      [FanMode.Low, StepDirection.Decrease, false, true, FanMode.Off, 0],
    ];
    for (const [start, direction, wrap, lowestOff, fanMode, percentCurrent] of sequence) {
      if (start !== undefined) await vent.setAttribute(FanControl.id, 'fanMode', start);
      await vent.invokeBehaviorCommand('fanControl', 'step', { direction, wrap, lowestOff });
      expect(calls.at(-1)).toEqual({ cluster: 'fanControl', endpoint: vent, request: { direction, wrap, lowestOff } });
      expect([vent.getAttribute(FanControl.id, 'fanMode'), vent.getAttribute(FanControl.id, 'percentCurrent')]).toEqual([fanMode, percentCurrent]);
    }

    // An invalid Direction is a safe no-op.
    await vent.setAttribute(FanControl.id, 'fanMode', FanMode.Medium);
    await vent.setAttribute(FanControl.id, 'percentCurrent', 30);
    // oxlint-disable-next-line typescript/no-unsafe-enum-assignment
    await vent.invokeBehaviorCommand('fanControl', 'step', { direction: 99 as FanControl.StepDirection, wrap: false, lowestOff: false });
    expect(calls).toHaveLength(sequence.length + 1);
    expect([vent.getAttribute(FanControl.id, 'fanMode'), vent.getAttribute(FanControl.id, 'percentCurrent')]).toEqual([FanMode.Medium, 30]);
    expect(emitted).toContainEqual({ direction: StepDirection.Increase, wrap: false, lowestOff: false });
  });
});
