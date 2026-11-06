/**
 * @file packages/core/buntest/matterbridgeFactory.test.ts
 * @description This file contains the bun tests for matterbridgeFactory.
 * @author Luca Liguori
 */

const NAME = 'Factory';
const MATTER_PORT = 12600;

import { describe, expect, test } from 'bun:test';

import { BooleanState } from '@matter/types/clusters/boolean-state';
import { Identify } from '@matter/types/clusters/identify';
import { OnOff } from '@matter/types/clusters/on-off';
import type { ClusterId } from '@matter/types/datatype';
import { addBridgedDevice, aggregator } from '@matterbridge/test-utils/buntest/matter';
import { loggerLogSpy, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { contactSensor, onOffLight } from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { featuresFor } from '../src/matterbridgeEndpointHelpers.js';
import { camelCase, createClusterServer, getClientBehaviorFromClusterId, getServerBehaviorFromClusterId, pascalCase, snakeCase } from '../src/matterbridgeFactory.js';
import { useServerNode } from './bunUtils.js';

await setupTest(NAME, false);

const UNKNOWN = 0xfff0 as ClusterId;
const BASE = ['descriptor', 'matterbridge'];
const ONOFF_NO_FEATURES = { lighting: false, deadFrontBehavior: false, offOnly: false };

describe('Matterbridge ' + NAME + ' without a server node', () => {
  test('snakeCase, pascalCase and camelCase convert between cluster names and behavior subpaths', () => {
    for (const [pascal, snake] of [
      ['OnOff', 'on-off'],
      ['BooleanState', 'boolean-state'],
      ['LevelControl', 'level-control'],
      ['Pm25ConcentrationMeasurement', 'pm25-concentration-measurement'],
      ['TotalVolatileOrganicCompoundsConcentrationMeasurement', 'total-volatile-organic-compounds-concentration-measurement'],
      ['Identify', 'identify'],
    ]) {
      expect(snakeCase(pascal)).toBe(snake);
      expect(pascalCase(snake)).toBe(pascal);
    }
    expect(pascalCase('off_only')).toBe('OffOnly');
    expect([camelCase('on-off'), camelCase('level-control'), camelCase('Identify')]).toEqual(['onOff', 'levelControl', 'identify']);
  });

  test('getServerBehaviorFromClusterId and getClientBehaviorFromClusterId resolve the stock matter.js behaviors', async () => {
    expect((await getServerBehaviorFromClusterId(OnOff.id))?.id).toBe('onOff');
    expect((await getServerBehaviorFromClusterId(BooleanState.id))?.id).toBe('booleanState');
    expect((await getClientBehaviorFromClusterId(OnOff.id))?.id).toBe('onOff');
    expect(await getServerBehaviorFromClusterId(UNKNOWN)).toBeUndefined();
    expect(await getClientBehaviorFromClusterId(UNKNOWN)).toBeUndefined();
  });

  // Each case: the cluster, the requested features and the resulting features.
  test.each<[string, ClusterId, object | string[] | undefined, Record<string, boolean>]>([
    ['exactly the requested features (replacement, not union)', OnOff.id, { offOnly: true }, { ...ONOFF_NO_FEATURES, offOnly: true }],
    ['features as a string array', OnOff.id, ['Lighting'], { ...ONOFF_NO_FEATURES, lighting: true }],
    ['no non-existing feature', OnOff.id, ['NotAFeature'], ONOFF_NO_FEATURES],
    ['no feature on a cluster without that feature', BooleanState.id, ['Lighting'], { changeEvent: false }],
  ])('createClusterServer applies %s', async (_name, clusterId, features, expected) => {
    const device = new MatterbridgeEndpoint(clusterId === OnOff.id ? onOffLight : contactSensor, { id: `Factory${_name.replaceAll(/\W/g, '')}` });
    const attributes = clusterId === OnOff.id ? { onOff: false } : { stateValue: false };
    expect(await createClusterServer(device, clusterId, { features: features as never, attributes })).toBe(device);
    expect(device.getAllClusterServerNames()).toEqual([...BASE, clusterId === OnOff.id ? 'onOff' : 'booleanState']);
    expect(featuresFor(device, clusterId)).toEqual(expected);
  });

  test('createClusterServer works without options and is a no-op that warns for an unknown cluster id', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'FactoryNoOptions' });
    expect(await createClusterServer(device, BooleanState.id)).toBe(device);
    expect(device.hasClusterServer(BooleanState.id)).toBe(true);
    expect(await createClusterServer(device, UNKNOWN)).toBe(device);
    expect(device.hasClusterServer(UNKNOWN)).toBe(false);
    expect(device.getAllClusterServerNames()).toEqual([...BASE, 'booleanState']);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, expect.stringContaining('createClusterServer: no matter.js server for clusterId'));
  });
});

describe('Matterbridge ' + NAME, () => {
  useServerNode(MATTER_PORT);

  test('createClusterServer creates state clusters and a working Identify server', async () => {
    const device = new MatterbridgeEndpoint(contactSensor, { id: 'FactoryBooleanState' });
    expect(await createClusterServer(device, BooleanState.id, { attributes: { stateValue: false } })).toBe(device);
    expect(device.hasAttributeServer(BooleanState, 'stateValue')).toBe(true);
    expect(featuresFor(device, BooleanState.id)).toEqual({ changeEvent: true });
    expect(await createClusterServer(device, Identify.id, { attributes: { identifyTime: 0, identifyType: Identify.IdentifyType.None } })).toBe(device);
    expect(device.hasAttributeServer(Identify, 'identifyTime')).toBe(true);
    expect(device.hasAttributeServer(Identify, 'identifyType')).toBe(true);
    expect(featuresFor(device, Identify)).toEqual({});
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual([...BASE, 'booleanState', 'identify']);
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBe(true);
    expect([device.getAttribute(BooleanState.id, 'stateValue'), device.getAttribute(Identify.id, 'identifyType')]).toEqual([false, Identify.IdentifyType.None]);

    // A real stock IdentifyServer (with the command implementation) was required.
    for (const identifyTime of [5, 0]) {
      await device.invokeBehaviorCommand('identify', 'identify', { identifyTime });
      expect(device.getAttribute(Identify.id, 'identifyTime')).toBe(identifyTime);
    }
    await device.invokeBehaviorCommand('identify', 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default });
  });

  test('createClusterServer creates a command-bearing server with features that processes commands', async () => {
    const device = new MatterbridgeEndpoint(onOffLight, { id: 'FactoryOnOffLighting' });
    expect(await createClusterServer(device, OnOff.id, { features: { lighting: true }, attributes: { onOff: false } })).toBe(device);
    expect(featuresFor(device, OnOff.id)).toEqual({ ...ONOFF_NO_FEATURES, lighting: true });
    device.addRequiredClusterServers();
    expect(device.getAllClusterServerNames()).toEqual([...BASE, 'onOff', 'identify', 'groups', 'scenesManagement']);
    expect(await addBridgedDevice(aggregator, device, 0, 0, 0, 0)).toBe(true);

    // A real stock server (with the command implementation) was required, not a plain behavior.
    for (const [command, onOff] of [
      ['on', true],
      ['off', false],
    ] as const) {
      await device.invokeBehaviorCommand('onOff', command);
      expect(device.getAttribute(OnOff.id, 'onOff')).toBe(onOff);
    }
  });
});
