/**
 * @file packages/core/buntest/behaviors/levelControlServer.test.ts
 * @description This file contains the bun tests for levelControlServer.
 * @author Luca Liguori
 */

const NAME = 'LevelControlServer';
const MATTER_PORT = 13100;

import { describe, expect, test } from 'bun:test';

import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';
import { getMoveRequest, getMoveToLevelRequest, getStepRequest, getStopRequest } from '@matterbridge/test-utils/matter';

import { bridge, bridgedNode, extendedColorLight, lightSensor, occupancySensor, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeLevelControlServer', () => {
  useServerNode(MATTER_PORT);

  test('should apply every command in the base server without the plugin handler when MATTERBRIDGE_CHIP_TEST is set', async () => {
    const light = new MatterbridgeEndpoint([extendedColorLight, bridge], { id: 'chipTestLevel' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('chipTestLevel', 'SN-chipTestLevel');
    light.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
    await light.setAttribute(OnOff, 'onOff', true);
    const commands = ['moveToLevel', 'moveToLevelWithOnOff', 'move', 'moveWithOnOff', 'step', 'stepWithOnOff', 'stop', 'stopWithOnOff'] as const;
    const calls = commands.map((command) => recordCommand(light, command === 'moveToLevel' || command === 'moveToLevelWithOnOff' ? command : `LevelControl.${command}`));
    const level = (): unknown => light.getAttribute(LevelControl, 'currentLevel');
    process.env.MATTERBRIDGE_CHIP_TEST = 'true';
    try {
      await light.invokeBehaviorCommand(LevelControl, 'moveToLevel', getMoveToLevelRequest(100, 0, false));
      expect(level()).toBe(100);
      await light.invokeBehaviorCommand(LevelControl, 'moveToLevelWithOnOff', getMoveToLevelRequest(150, 0, false));
      expect(level()).toBe(150);
      await light.invokeBehaviorCommand(LevelControl, 'move', getMoveRequest(LevelControl.MoveMode.Up, 5, false));
      await light.invokeBehaviorCommand(LevelControl, 'stop', getStopRequest(false));
      await light.invokeBehaviorCommand(LevelControl, 'moveWithOnOff', getMoveRequest(LevelControl.MoveMode.Up, 5, false));
      await light.invokeBehaviorCommand(LevelControl, 'stopWithOnOff', getStopRequest(false));
      await light.invokeBehaviorCommand(LevelControl, 'moveToLevel', getMoveToLevelRequest(100, 0, false));
      await light.invokeBehaviorCommand(LevelControl, 'step', getStepRequest(LevelControl.StepMode.Up, 10, 0, false));
      expect(level()).toBe(110);
      await light.invokeBehaviorCommand(LevelControl, 'stepWithOnOff', getStepRequest(LevelControl.StepMode.Down, 20, 0, false));
      expect(level()).toBe(90);
    } finally {
      delete process.env.MATTERBRIDGE_CHIP_TEST;
    }
    for (const recorded of calls) expect(recorded).toHaveLength(0);
  });

  test('every command reaches the plugin with the pre-command level, then the base server applies it', async () => {
    const light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
    await light.setAttribute(OnOff, 'onOff', true);
    const level = (): unknown => light.getAttribute(LevelControl, 'currentLevel');
    expect(level()).toBe(254);

    // [command, request, level the plugin sees, level after the command]
    const steps = [
      ['moveToLevel', getMoveToLevelRequest(100, 5, false), 254, 100],
      ['moveToLevelWithOnOff', getMoveToLevelRequest(150, 3, false), 100, 150],
      ['LevelControl.move', getMoveRequest(LevelControl.MoveMode.Up, 5, false), 150, 254],
      ['LevelControl.moveWithOnOff', getMoveRequest(LevelControl.MoveMode.Down, 5, false), 254, 1],
    ] as const;
    for (const [command, request, before, after] of steps) {
      await expectCommand(light, LevelControl, command, request, (data) => {
        expect(data.cluster).toBe('levelControl');
        expect(data.attributes.currentLevel).toBe(before);
      });
      expect(level()).toBe(after);
    }
    // moveWithOnOff down to the minimum turned the light off.
    expect(light.getAttribute(OnOff, 'onOff')).toBe(false);

    // step without OnOff does nothing while the light is off.
    const stepUp = getStepRequest(LevelControl.StepMode.Up, 10, 3, false);
    await light.invokeBehaviorCommand(LevelControl, 'step', stepUp);
    expect(level()).toBe(1);
    expect(light.getAttribute(OnOff, 'onOff')).toBe(false);

    await light.setAttribute(OnOff, 'onOff', true);
    const moreSteps = [
      ['LevelControl.step', stepUp, 1, 11],
      ['LevelControl.stepWithOnOff', getStepRequest(LevelControl.StepMode.Down, 10, 3, false), 11, 1],
      ['LevelControl.stop', getStopRequest(false), 1, 1],
      ['LevelControl.stopWithOnOff', getStopRequest(false), 1, 1],
    ] as const;
    for (const [command, request, before, after] of moreSteps) {
      await expectCommand(light, LevelControl, command, request, (data) => {
        expect(data.cluster).toBe('levelControl');
        expect(data.attributes.currentLevel).toBe(before);
      });
      expect(level()).toBe(after);
    }
  });

  test.each([
    ['an explicit level', 100, 200, 200],
    ['0 (minimum level)', 100, 0, 1],
    ['null (previous value)', 100, null, 100],
    ['the current level', 100, 100, 100],
  ] as const)('StartUpCurrentLevel applies %s', async (label, currentLevel, startUpCurrentLevel, expected) => {
    const id = `suLevel${label.replace(/\W/g, '')}`;
    const device = new MatterbridgeEndpoint([extendedColorLight, bridge], { id });
    device.createDefaultBridgedDeviceBasicInformationClusterServer(id, `SN-${id}`);
    device.createDefaultLevelControlClusterServer(currentLevel, 1, 254, null, startUpCurrentLevel);
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(LevelControl, 'currentLevel')).toBe(expected);
  });

  test('StartUpCurrentLevel does not apply without the Lighting feature', async () => {
    const device = new MatterbridgeEndpoint([bridgedNode, bridge], { id: 'suLevelNoLighting' });
    device.createDefaultBridgedDeviceBasicInformationClusterServer('suLevelNoLighting', 'SN-suLevelNoLighting');
    device.createOnOffClusterServer(false);
    device.createLevelControlClusterServer(100);
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(LevelControl, 'currentLevel')).toBe(100);
  });
});
