/**
 * @file packages/core/buntest/behaviors/onOffServer.test.ts
 * @description This file contains the bun tests for onOffServer.
 * @author Luca Liguori
 */

const NAME = 'OnOffServer';
const MATTER_PORT = 13000;

import { describe, expect, test } from 'bun:test';

import { OnOffBaseServer } from '@matter/node/behaviors/on-off';
import { OnOff } from '@matter/types/clusters/on-off';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';
import { getOffWithEffectRequest, getOnWithTimedOffRequest } from '@matterbridge/test-utils/matter';

import { bridge, bridgedNode, extendedColorLight, lightSensor, occupancySensor, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeOnOffServer', () => {
  useServerNode(MATTER_PORT);

  test('every command reaches the plugin with the pre-command state, then the base server applies it', async () => {
    const light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
    expect(light.getAttribute(OnOff, 'onOff')).toBe(false);

    /**
     * Invokes a command and checks the state the plugin saw before it and the OnOff value the server applied after it.
     *
     * @param {Parameters<typeof expectCommand>[2]} command - The command name.
     * @param {object | undefined} request - The command request.
     * @param {boolean} before - The OnOff value the plugin handler must see.
     * @param {boolean} after - The OnOff value once the command completed.
     * @returns {Promise<void>} Resolves once the command completed and was checked.
     */
    const step = async (command: Parameters<typeof expectCommand>[2], request: object | undefined, before: boolean, after: boolean): Promise<void> => {
      await expectCommand(light, OnOff, command, request, (data) => {
        expect(data.cluster).toBe('onOff');
        expect(data.attributes.onOff).toBe(before);
      });
      expect(light.getAttribute(OnOff, 'onOff')).toBe(after);
    };
    await step('on', undefined, false, true);
    await step('off', undefined, true, false);
    await step('toggle', undefined, false, true);
    // GlobalSceneControl false: offWithEffect does not store the global scene.
    await light.setStateOf(OnOffBaseServer, { globalSceneControl: false });
    await step('OnOff.offWithEffect', getOffWithEffectRequest(OnOff.EffectIdentifier.DelayedAllOff, 0), true, false);
    // GlobalSceneControl true: onWithRecallGlobalScene returns early and leaves OnOff off.
    await light.setStateOf(OnOffBaseServer, { globalSceneControl: true });
    await step('OnOff.onWithRecallGlobalScene', undefined, false, false);
    await step('OnOff.onWithTimedOff', getOnWithTimedOffRequest(false, 0, 0), false, true);
  });

  test.each([
    ['On', false, OnOff.StartUpOnOff.On, true],
    ['Off', true, OnOff.StartUpOnOff.Off, false],
    ['Toggle', false, OnOff.StartUpOnOff.Toggle, true],
    ['null (previous value)', true, null, true],
    ['On when already on', true, OnOff.StartUpOnOff.On, true],
  ] as const)('StartUpOnOff %s', async (label, onOff, startUpOnOff, expected) => {
    const id = `suOnOff${label.replace(/\W/g, '')}`;
    const device = new MatterbridgeEndpoint([extendedColorLight, bridge], { id });
    device.createDefaultBridgedDeviceBasicInformationClusterServer(id, `SN-${id}`);
    device.createDefaultOnOffClusterServer(onOff, false, 0, 0, startUpOnOff);
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(OnOff, 'onOff')).toBe(expected);
  });

  test('StartUpOnOff does not apply without the Lighting feature', async () => {
    const device = new MatterbridgeEndpoint([bridgedNode, bridge], { id: 'suOnOffNoLighting' });
    device.createDefaultBridgedDeviceBasicInformationClusterServer('suOnOffNoLighting', 'SN-suOnOffNoLighting');
    device.createOnOffClusterServer(false);
    device.addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBeTruthy();
    expect(device.getAttribute(OnOff, 'onOff')).toBe(false);
  });
});
