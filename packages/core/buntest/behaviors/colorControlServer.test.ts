/**
 * @file packages/core/buntest/behaviors/colorControlServer.test.ts
 * @description This file contains the bun tests for colorControlServer.
 * @author Luca Liguori
 */

const NAME = 'ColorControlServer';
const MATTER_PORT = 13200;

import { describe, expect, test } from 'bun:test';

import { ColorControl } from '@matter/types/clusters/color-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { Status } from '@matter/types/globals';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';
import {
  getEnhancedMoveHueRequest,
  getEnhancedMoveToHueAndSaturationRequest,
  getEnhancedMoveToHueRequest,
  getEnhancedStepHueRequest,
  getMoveColorRequest,
  getMoveColorTemperatureRequest,
  getMoveHueRequest,
  getMoveSaturationRequest,
  getMoveToColorRequest,
  getMoveToColorTemperatureRequest,
  getMoveToHueAndSaturationRequest,
  getMoveToHueRequest,
  getMoveToSaturationRequest,
  getStepColorRequest,
  getStepColorTemperatureRequest,
  getStepHueRequest,
  getStepSaturationRequest,
  getStopMoveStepRequest,
} from '@matterbridge/test-utils/matter';

import { MatterbridgeColorControlServer } from '../../src/behaviors/colorControlServer.js';
import { bridge, bridgedNode, colorTemperatureLight, extendedColorLight, onOffLight, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, recordCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

const { ColorMode, EnhancedColorMode, MoveMode, StepMode } = ColorControl;
type Command = Parameters<typeof expectCommand>[2];
const HS = ColorMode.CurrentHueAndCurrentSaturation;
const XY = ColorMode.CurrentXAndCurrentY;
const CT = ColorMode.ColorTemperatureMireds;
// setColorMode() writes both: EnhancedColorMode is a superset of ColorMode.
const enhancedOf: Record<ColorControl.ColorMode, ColorControl.EnhancedColorMode> = {
  [HS]: EnhancedColorMode.CurrentHueAndCurrentSaturation,
  [XY]: EnhancedColorMode.CurrentXAndCurrentY,
  [CT]: EnhancedColorMode.ColorTemperatureMireds,
};

/**
 * Creates and adds a bridged light.
 *
 * @param {string} id - The endpoint id.
 * @param {(endpoint: MatterbridgeEndpoint) => void} [configure] - Adds the cluster servers before the required ones.
 * @returns {Promise<MatterbridgeEndpoint>} The added light.
 */
async function addLight(id: string, configure?: (endpoint: MatterbridgeEndpoint) => void): Promise<MatterbridgeEndpoint> {
  const light = new MatterbridgeEndpoint(configure ? [onOffLight, bridge, powerSource] : [extendedColorLight, bridge, powerSource], { id });
  light.createDefaultBridgedDeviceBasicInformationClusterServer(id, `SN-${id}`);
  light.createDefaultPowerSourceWiredClusterServer();
  configure?.(light);
  light.addRequiredClusterServers();
  expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
  return light;
}

/**
 * Invokes a ColorControl command through the plugin handler check, then checks the state matter.js applied.
 *
 * @param {MatterbridgeEndpoint} light - The light.
 * @param {Command} command - The command.
 * @param {object} request - The request.
 * @param {Record<string, unknown>} expected - The attributes expected after the command.
 * @returns {Promise<void>} Resolves once checked.
 */
async function step(light: MatterbridgeEndpoint, command: Command, request: object, expected: Record<string, unknown>): Promise<void> {
  await expectCommand(light, ColorControl, command, request, (data) => expect(data.cluster).toBe('colorControl'));
  expect(Object.fromEntries(Object.keys(expected).map((name) => [name, light.getAttribute(ColorControl.id, name)]))).toEqual(expected);
}

describe('MatterbridgeColorControlServer', () => {
  useServerNode(MATTER_PORT);

  test('every command reaches the plugin, then matter.js applies it and settles ColorMode', async () => {
    const light = await addLight('extendedColorLight');
    // Every command honours Options.ExecuteIfOff: with the light off they would be no-ops.
    await light.setAttribute(OnOff, 'onOff', true);
    const mode = (colorMode: ColorControl.ColorMode): Record<string, unknown> => ({ colorMode, enhancedColorMode: enhancedOf[colorMode] });

    // Absolute moves: the target value is applied.
    await step(light, 'moveToHue', getMoveToHueRequest(180, 0, false), { ...mode(HS), currentHue: 180 });
    await step(light, 'moveToSaturation', getMoveToSaturationRequest(100, 0, false), { ...mode(HS), currentSaturation: 100 });
    await step(light, 'moveToHueAndSaturation', getMoveToHueAndSaturationRequest(180, 100, 0, false), { ...mode(HS), currentHue: 180, currentSaturation: 100 });
    await step(light, 'moveToColor', getMoveToColorRequest(30000, 30000, 0, false), { ...mode(XY), currentX: 30000, currentY: 30000 });
    await step(light, 'moveToColorTemperature', getMoveToColorTemperatureRequest(250, 0, false), { ...mode(CT), colorTemperatureMireds: 250 });

    // Rate and step commands: ColorMode is first forced elsewhere, so only the command itself can move it back
    // (setColorMode() returns early when the mode is already the requested one).
    const relative: [Command, object, ColorControl.ColorMode, ColorControl.ColorMode][] = [
      ['ColorControl.moveHue', getMoveHueRequest(MoveMode.Up, 5, false), CT, HS],
      ['ColorControl.stepHue', getStepHueRequest(StepMode.Up, 10, 3, false), CT, HS],
      ['ColorControl.moveSaturation', getMoveSaturationRequest(MoveMode.Up, 5, false), CT, HS],
      ['ColorControl.stepSaturation', getStepSaturationRequest(StepMode.Up, 10, 3, false), CT, HS],
      ['ColorControl.moveColor', getMoveColorRequest(100, 100, false), CT, XY],
      ['ColorControl.stepColor', getStepColorRequest(100, 100, 3, false), CT, XY],
      ['ColorControl.moveColorTemperature', getMoveColorTemperatureRequest(MoveMode.Up, 5, 153, 500, false), XY, CT],
      ['ColorControl.stepColorTemperature', getStepColorTemperatureRequest(StepMode.Up, 10, 3, 153, 500, false), XY, CT],
    ];
    for (const [command, request, forced, expected] of relative) {
      await light.setAttribute(ColorControl, 'colorMode', forced);
      await light.setAttribute(ColorControl, 'enhancedColorMode', enhancedOf[forced]);
      expect(light.getAttribute(ColorControl, 'colorMode')).toBe(forced);
      await step(light, command, request, mode(expected));
    }

    // StopMoveStep stops a running transition: transitions only run with managedTransitionTimeHandling on.
    await light.setStateOf(MatterbridgeColorControlServer, { managedTransitionTimeHandling: true });
    await light.invokeBehaviorCommand(ColorControl, 'moveToHue', getMoveToHueRequest(0, 100, false));
    expect(light.getAttribute(ColorControl, 'remainingTime')).toBeGreaterThan(0);
    await step(light, 'ColorControl.stopMoveStep', getStopMoveStepRequest(false), { remainingTime: 0 });
    await light.setStateOf(MatterbridgeColorControlServer, { managedTransitionTimeHandling: false });
  });

  test('the plugin handler runs before matter.js rejects an invalid command', async () => {
    // Matter 1.6.1 § 3.2.8.6.5: StepHue with StepSize 0 is INVALID_COMMAND.
    const light = await addLight('validationLight');
    await light.setAttribute(OnOff, 'onOff', true);
    const calls = recordCommand(light, 'ColorControl.stepHue');
    const request = getStepHueRequest(StepMode.Up, 0, 3, false);
    expect(light.invokeBehaviorCommand(ColorControl, 'stepHue', request)).rejects.toMatchObject({ code: Status.InvalidCommand });
    expect(calls).toEqual([{ cluster: 'colorControl', endpoint: light, request }]);
    expect([light.getAttribute(ColorControl, 'colorMode'), light.getAttribute(ColorControl, 'currentHue')]).toEqual([HS, 0]);
  });

  test('the enhanced hue commands drive EnhancedCurrentHue and EnhancedColorMode', async () => {
    const light = await addLight('enhancedLight', (endpoint) => {
      endpoint.createDefaultOnOffClusterServer(true);
      endpoint.createEnhancedColorControlClusterServer();
    });
    const enhancedHS = { colorMode: HS, enhancedColorMode: EnhancedColorMode.EnhancedCurrentHueAndCurrentSaturation };
    const state = { currentHue: 0, enhancedCurrentHue: 0, currentSaturation: 0, currentX: 0, currentY: 0, colorTemperatureMireds: 500 };
    const steps: [Command, object, Record<string, unknown>][] = [
      ['moveToHue', getMoveToHueRequest(180, 0, false), { ...enhancedHS, currentHue: 180 }],
      ['enhancedMoveToHue', getEnhancedMoveToHueRequest(32000, 0, false), { ...enhancedHS, enhancedCurrentHue: 32000 }],
      ['moveToSaturation', getMoveToSaturationRequest(100, 0, false), { ...enhancedHS, currentSaturation: 100 }],
      ['moveToHueAndSaturation', getMoveToHueAndSaturationRequest(180, 100, 0, false), enhancedHS],
      ['enhancedMoveToHueAndSaturation', getEnhancedMoveToHueAndSaturationRequest(32000, 100, 0, false), enhancedHS],
      ['moveToColor', getMoveToColorRequest(30000, 30000, 0, false), { colorMode: XY, enhancedColorMode: EnhancedColorMode.CurrentXAndCurrentY, currentX: 30000, currentY: 30000 }],
      [
        'moveToColorTemperature',
        getMoveToColorTemperatureRequest(250, 0, false),
        { colorMode: CT, enhancedColorMode: EnhancedColorMode.ColorTemperatureMireds, colorTemperatureMireds: 250 },
      ],
    ];
    // Each step changes only the attributes it names: the others keep their value from the previous steps.
    const expected: Record<string, unknown> = { ...state };
    for (const [command, request, changes] of steps) {
      Object.assign(expected, changes);
      await step(light, command, request, { ...expected });
    }
    // The enhanced rate commands are forwarded too.
    await step(light, 'ColorControl.enhancedMoveHue', getEnhancedMoveHueRequest(MoveMode.Up, 5, false), {});
    await step(light, 'ColorControl.enhancedStepHue', getEnhancedStepHueRequest(StepMode.Up, 10, 3, false), {});
  });

  test.each([
    ['applies the startup value and switches ColorMode', 250, 300, 300],
    ['crops a startup value above the physical range', 250, 4000, 500],
    ['crops a startup value below the physical range', 250, 1, 147],
    ['clamps a restored value above the physical range', 600, null, 500],
    ['clamps a restored value below the physical range', 100, null, 147],
    ['keeps the previous value when null', 250, null, 250],
    ['leaves a matching value untouched', 250, 250, 250],
  ] as const)('StartUpColorTemperatureMireds %s', async (label, mireds, startUp, expected) => {
    const id = `suCt${label.replace(/\W/g, '')}`;
    const device = new MatterbridgeEndpoint([colorTemperatureLight, bridge], { id });
    device.createDefaultBridgedDeviceBasicInformationClusterServer(id.slice(0, 32), `SN-${id}`.slice(0, 32));
    device.createCtColorControlClusterServer(mireds, 147, 500, startUp);
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(ColorControl, 'colorTemperatureMireds')).toBe(expected);
    if (startUp !== null) expect(device.getAttribute(ColorControl, 'colorMode')).toBe(CT);
  });

  test('StartUpColorTemperatureMireds switches ColorMode even when the value already matches', async () => {
    const device = new MatterbridgeEndpoint([colorTemperatureLight, bridge], { id: 'suCtSameMode' });
    device.createDefaultBridgedDeviceBasicInformationClusterServer('suCtSameMode', 'SN-suCtSameMode');
    device.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.HueSaturation, ColorControl.Feature.ColorTemperature), {
      colorMode: HS,
      enhancedColorMode: EnhancedColorMode.CurrentHueAndCurrentSaturation,
      colorCapabilities: { xy: false, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: true },
      options: { executeIfOff: false },
      numberOfPrimaries: null,
      colorTemperatureMireds: 250,
      colorTempPhysicalMinMireds: 147,
      colorTempPhysicalMaxMireds: 500,
      coupleColorTempToLevelMinMireds: 147,
      startUpColorTemperatureMireds: 250,
      remainingTime: 0,
    });
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect([
      device.getAttribute(ColorControl, 'colorTemperatureMireds'),
      device.getAttribute(ColorControl, 'colorMode'),
      device.getAttribute(ColorControl, 'enhancedColorMode'),
    ]).toEqual([250, CT, EnhancedColorMode.ColorTemperatureMireds]);
  });

  test('StartUpColorTemperatureMireds does not apply without the ColorTemperature feature', async () => {
    const device = new MatterbridgeEndpoint([bridgedNode, bridge], { id: 'suCtNoFeature' });
    device.createDefaultBridgedDeviceBasicInformationClusterServer('suCtNoFeature', 'SN-suCtNoFeature');
    device.behaviors.require(MatterbridgeColorControlServer.with(ColorControl.Feature.HueSaturation), {
      colorMode: HS,
      enhancedColorMode: EnhancedColorMode.CurrentHueAndCurrentSaturation,
      colorCapabilities: { xy: false, hueSaturation: true, colorLoop: false, enhancedHue: false, colorTemperature: false },
      options: { executeIfOff: false },
      numberOfPrimaries: null,
      currentHue: 10,
      currentSaturation: 20,
      remainingTime: 0,
    });
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(ColorControl, 'currentHue')).toBe(10);
  });
});
