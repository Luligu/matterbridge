/**
 * @file packages/core/vitest/behaviors/onOffServer.test.ts
 * @description This file contains the tests for onOffServer.
 * @author Luca Liguori
 */

const NAME = 'OnOffServer';
const MATTER_PORT = 13000;
const MATTER_CREATE_ONLY = true;

import { OnOffBaseServer } from '@matter/node/behaviors/on-off';
import { OnOff } from '@matter/types/clusters/on-off';
import { setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getOffWithEffectRequest,
  getOnWithTimedOffRequest,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { bridge, extendedColorLight, lightSensor, occupancySensor, onOffPlugInUnit, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeOnOffServer', () => {
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

  test('OnOff server', async () => {
    // `data.attributes` is the pre-command snapshot: the Matterbridge server forwards to the plugin handler before
    // calling super, so what the handler sees is the state the command is about to change. The assertion after
    // each expectCommand() is therefore the one that proves super ran and applied the change.
    const expectOnOff = (onOff: boolean): void => {
      expect(light.getAttribute(OnOff, 'onOff')).toBe(onOff);
    };

    expectOnOff(false);

    await expectCommand(light, OnOff, 'on', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
    expectOnOff(true);

    await expectCommand(light, OnOff, 'off', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(true);
    });
    expectOnOff(false);

    await expectCommand(light, OnOff, 'toggle', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
    expectOnOff(true);

    // GlobalSceneControl defaults to true; reset it so offWithEffect() doesn't try to store the global scene.
    await light.setStateOf(OnOffBaseServer, { globalSceneControl: false });

    const offWithEffectRequest = getOffWithEffectRequest(OnOff.EffectIdentifier.DelayedAllOff, 0);
    await expectCommand(light, OnOff, 'OnOff.offWithEffect', offWithEffectRequest, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(true);
    });
    expectOnOff(false);

    // GlobalSceneControl set to true makes onWithRecallGlobalScene() return early without touching the fabric-scoped scene APIs.
    await light.setStateOf(OnOffBaseServer, { globalSceneControl: true });

    await expectCommand(light, OnOff, 'OnOff.onWithRecallGlobalScene', undefined, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
    expectOnOff(false);

    const onWithTimedOffRequest = getOnWithTimedOffRequest(false, 0, 0);
    await expectCommand(light, OnOff, 'OnOff.onWithTimedOff', onWithTimedOffRequest, (data) => {
      expect(data.cluster).toBe('onOff');
      expect(data.attributes.onOff).toBe(false);
    });
    expectOnOff(true);
  });

  describe('StartUpOnOff', () => {
    /**
     * Adds an OnOff light with the given initial OnOff state and StartUpOnOff value, then returns the OnOff
     * attribute as it stands once the behavior has initialized.
     *
     * @param {string} id - Unique endpoint id.
     * @param {boolean} onOff - The persisted OnOff value the endpoint starts from.
     * @param {OnOff.StartUpOnOff | null} startUpOnOff - The StartUpOnOff value to apply on startup.
     *
     * @returns {Promise<unknown>} The OnOff attribute after initialization.
     */
    const addLight = async (id: string, onOff: boolean, startUpOnOff: OnOff.StartUpOnOff | null): Promise<unknown> => {
      const device = new MatterbridgeEndpoint([extendedColorLight, bridge], { id });
      device.createDefaultBridgedDeviceBasicInformationClusterServer(id, `SN-${id}`);
      device.createDefaultOnOffClusterServer(onOff, false, 0, 0, startUpOnOff);
      device.addRequiredClusterServers();
      expect(await addDevice(aggregator, device)).toBeTruthy();
      return device.getAttribute(OnOff, 'onOff');
    };

    it('applies On', async () => {
      expect(await addLight('suOnOffOn', false, OnOff.StartUpOnOff.On)).toBe(true);
    });

    it('applies Off', async () => {
      expect(await addLight('suOnOffOff', true, OnOff.StartUpOnOff.Off)).toBe(false);
    });

    it('applies Toggle', async () => {
      expect(await addLight('suOnOffToggle', false, OnOff.StartUpOnOff.Toggle)).toBe(true);
    });

    it('keeps the previous value when null', async () => {
      expect(await addLight('suOnOffNull', true, null)).toBe(true);
    });

    it('leaves OnOff untouched when the startup value already matches', async () => {
      expect(await addLight('suOnOffSame', true, OnOff.StartUpOnOff.On)).toBe(true);
    });

    it('does not apply without the Lighting feature', async () => {
      const device = new MatterbridgeEndpoint([onOffPlugInUnit, bridge], { id: 'suOnOffNoLighting' });
      device.createDefaultBridgedDeviceBasicInformationClusterServer('suOnOffNoLighting', 'SN-suOnOffNoLighting');
      device.createOnOffClusterServer(false);
      device.addRequiredClusterServers();
      expect(await addDevice(aggregator, device)).toBeTruthy();
      expect(device.getAttribute(OnOff, 'onOff')).toBe(false);
    });
  });
});
