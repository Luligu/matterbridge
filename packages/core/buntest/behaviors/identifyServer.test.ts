/**
 * @file packages/core/buntest/behaviors/identifyServer.test.ts
 * @description This file contains the bun tests for identifyServer.
 * @author Luca Liguori
 */

const NAME = 'IdentifyServer';
const MATTER_PORT = 12900;

import { describe, expect, test } from 'bun:test';

import { Identify } from '@matter/types/clusters/identify';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { setupTest } from '@matterbridge/test-utils/buntest/setup';

import { bridge, extendedColorLight, lightSensor, occupancySensor, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand, useServerNode } from '../bunUtils.js';

await setupTest(NAME, false);

describe('MatterbridgeIdentifyServer', () => {
  useServerNode(MATTER_PORT);

  test('identify and triggerEffect forward, update the state and notify the subscribers', async () => {
    const light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();
    expect(await addBridgedDevice(aggregator, light, 0, 0, 0, 0)).toBeTruthy();
    expect(light.getAttribute(Identify, 'identifyTime')).toBe(0);
    expect(light.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.None);

    const emitted: string[] = [];
    light.subscribeCommand(Identify, 'identify', () => emitted.push('identify'));
    light.subscribeCommand(Identify, 'triggerEffect', () => emitted.push('triggerEffect'));

    // Start, then stop identifying: each request reaches the plugin and sets IdentifyTime.
    for (const identifyTime of [1, 0]) {
      await expectCommand(light, Identify, 'identify', { identifyTime }, (data) => expect(data.cluster).toBe('identify'));
      expect(light.getAttribute(Identify, 'identifyTime')).toBe(identifyTime);
    }

    const effectTriggeredEvents: unknown[] = [];
    light.eventsOf('identify').effectTriggered?.on((event) => {
      effectTriggeredEvents.push(event);
    });
    const triggerEffectRequest = { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default };
    await expectCommand(light, Identify, 'triggerEffect', triggerEffectRequest, (data) => {
      expect(data.cluster).toBe('identify');
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
    expect(effectTriggeredEvents).toEqual([triggerEffectRequest]);
    expect(emitted).toEqual(['identify', 'identify', 'triggerEffect']);
  });
});
