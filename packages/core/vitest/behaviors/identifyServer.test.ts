/**
 * @file packages/core/vitest/behaviors/identifyServer.test.ts
 * @description This file contains the tests for identifyServer.
 * @author Luca Liguori
 */

const NAME = 'IdentifyServer';
const MATTER_PORT = 12900;
const MATTER_CREATE_ONLY = true;

import { Identify } from '@matter/types/clusters/identify';
import { setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { bridge, extendedColorLight, lightSensor, occupancySensor, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeIdentifyServer', () => {
  let light: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the Matter test environment
    await createTestEnvironment();

    // Create the server node and aggregator
    await createServerNode(MATTER_PORT);

    // Start the server node if not in create-only mode
    if (!MATTER_CREATE_ONLY) await startServerNode();
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();

    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Device type: extendedLight', async () => {
    light = new MatterbridgeEndpoint([extendedColorLight, bridge, powerSource], { id: 'extendedColorLight' });
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Extended Color Light', 'SN12345678');
    light.createDefaultPowerSourceWiredClusterServer();
    light.addRequiredClusterServers();
    expect(light).toBeDefined();

    light.addChildDeviceType('illuminance', lightSensor).addRequiredClusterServers();
    light.addChildDeviceType('motion', occupancySensor).addRequiredClusterServers();

    expect(await addDevice(aggregator, light)).toBeTruthy();
  });

  test('Identify server', async () => {
    // A single recording handler is registered for the two identify invocations below, because only the first
    // handler registered for a command name is ever executed: a second registration would silently never run.
    const identifyCalls: Array<{ cluster: string; endpoint: MatterbridgeEndpoint; request: object }> = [];
    light.addCommandHandler('identify', (data) => {
      identifyCalls.push({ cluster: data.cluster, endpoint: data.endpoint, request: data.request });
    });

    expect(light.getAttribute(Identify, 'identifyTime')).toBe(0);
    expect(light.getAttribute(Identify, 'identifyType')).toBe(Identify.IdentifyType.None);

    await light.invokeBehaviorCommand(Identify, 'identify', { identifyTime: 1 });
    expect(identifyCalls).toEqual([{ cluster: 'identify', endpoint: light, request: { identifyTime: 1 } }]);
    // super.identify() ran and put the endpoint into identify mode.
    expect(light.getAttribute(Identify, 'identifyTime')).toBe(1);

    // Turn identify mode off again, so its 1-second countdown timer does not outlive the test.
    await light.invokeBehaviorCommand(Identify, 'identify', { identifyTime: 0 });
    expect(identifyCalls).toHaveLength(2);
    expect(identifyCalls[1]).toEqual({ cluster: 'identify', endpoint: light, request: { identifyTime: 0 } });
    expect(light.getAttribute(Identify, 'identifyTime')).toBe(0);

    // TriggerEffect changes no attribute: super.triggerEffect() emits the effectTriggered event, which is the only
    // observable proof the forwarder went on to call it.
    const effectTriggeredEvents: unknown[] = [];
    const effectTriggered = light.eventsOf('identify').effectTriggered;
    expect(effectTriggered).toBeDefined();
    effectTriggered?.on((event) => {
      effectTriggeredEvents.push(event);
    });

    const triggerEffectRequest = { effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: Identify.EffectVariant.Default };
    await expectCommand(light, Identify, 'triggerEffect', triggerEffectRequest, (data) => {
      expect(data.cluster).toBe(Identify.name.toLowerCase());
      expect(data.attributes.identifyTime).toBe(0);
      expect(data.attributes.identifyType).toBe(Identify.IdentifyType.None);
    });
    expect(effectTriggeredEvents).toEqual([triggerEffectRequest]);
  });
});
