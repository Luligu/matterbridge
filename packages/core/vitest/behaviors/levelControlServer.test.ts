/**
 * @file packages/core/vitest/behaviors/levelControlServer.test.ts
 * @description This file contains the tests for levelControlServer.
 * @author Luca Liguori
 */

const NAME = 'LevelControlServer';
const MATTER_PORT = 13100;
const MATTER_CREATE_ONLY = true;

import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { setupTest } from '@matterbridge/vitest-utils';
import {
  addDevice,
  aggregator,
  createServerNode,
  createTestEnvironment,
  destroyTestEnvironment,
  flushServerNode,
  getMoveRequest,
  getMoveToLevelRequest,
  getStepRequest,
  getStopRequest,
  startServerNode,
  stopServerNode,
} from '@matterbridge/vitest-utils/matter';

import { bridge, extendedColorLight, lightSensor, occupancySensor, powerSource } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';
import { expectCommand } from '../vitestUtils.js';

// Setup the test environment
await setupTest(NAME, false);

describe('MatterbridgeLevelControlServer', () => {
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

  test('LevelControl server', async () => {
    // MoveToLevel is a no-op while the endpoint is off, so turn it on before walking through the level commands.
    await light.setAttribute(OnOff, 'onOff', true);

    // `data.attributes` is the pre-command snapshot: the Matterbridge server forwards to the plugin handler before
    // calling super, so what the handler sees is the level the command is about to change. The assertion after each
    // expectCommand() is therefore the one that proves super ran and applied the change.
    const expectCurrentLevel = (currentLevel: number): void => {
      expect(light.getAttribute(LevelControl, 'currentLevel')).toBe(currentLevel);
    };

    expectCurrentLevel(254);

    const moveToLevelRequest = getMoveToLevelRequest(100, 5, false);
    await expectCommand(light, LevelControl, 'moveToLevel', moveToLevelRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(254);
    });
    expectCurrentLevel(100);

    const moveToLevelWithOnOffRequest = getMoveToLevelRequest(150, 3, false);
    await expectCommand(light, LevelControl, 'moveToLevelWithOnOff', moveToLevelWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(100);
    });
    expectCurrentLevel(150);

    // With transitions unmanaged (the default), Move runs to the end of its range immediately.
    const moveRequest = getMoveRequest(LevelControl.MoveMode.Up, 5, false);
    await expectCommand(light, LevelControl, 'LevelControl.move', moveRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(150);
    });
    expectCurrentLevel(254);

    const moveWithOnOffRequest = getMoveRequest(LevelControl.MoveMode.Down, 5, false);
    await expectCommand(light, LevelControl, 'LevelControl.moveWithOnOff', moveWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(254);
    });
    expectCurrentLevel(1);

    const stepRequest = getStepRequest(LevelControl.StepMode.Up, 10, 3, false);
    await expectCommand(light, LevelControl, 'LevelControl.step', stepRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(1);
    });
    expectCurrentLevel(11);

    const stepWithOnOffRequest = getStepRequest(LevelControl.StepMode.Down, 10, 3, false);
    await expectCommand(light, LevelControl, 'LevelControl.stepWithOnOff', stepWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(11);
    });
    expectCurrentLevel(1);

    // Stop/StopWithOnOff cancel an in-flight transition; with none running they leave the level where it is.
    const stopRequest = getStopRequest(false);
    await expectCommand(light, LevelControl, 'LevelControl.stop', stopRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(1);
    });
    expectCurrentLevel(1);

    const stopWithOnOffRequest = getStopRequest(false);
    await expectCommand(light, LevelControl, 'LevelControl.stopWithOnOff', stopWithOnOffRequest, (data) => {
      expect(data.cluster).toBe('levelControl');
      expect(data.attributes.currentLevel).toBe(1);
    });
    expectCurrentLevel(1);
  });
});
