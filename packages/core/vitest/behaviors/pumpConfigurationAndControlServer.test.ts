/**
 * @file packages/core/vitest/behaviors/pumpConfigurationAndControlServer.test.ts
 * @description This file contains the tests for pumpConfigurationAndControlServer.
 * @author Luca Liguori
 */

const NAME = 'PumpConfigurationAndControlServer';
const MATTER_PORT = 12400;
const MATTER_CREATE_ONLY = true;

import { Status } from '@matter/types';
import { LevelControl } from '@matter/types/clusters/level-control';
import { OnOff } from '@matter/types/clusters/on-off';
import { PumpConfigurationAndControl } from '@matter/types/clusters/pump-configuration-and-control';
import { flushAsync, setupTest } from '@matterbridge/vitest-utils';
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
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeLevelControlServer } from '../../src/behaviors/levelControlServer.js';
import { pump } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Server clusters and behaviors', () => {
  beforeAll(async () => {
    // Set log level to debug for better visibility during tests
    MatterbridgeEndpoint.logLevel = LogLevel.DEBUG;

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

  test('should apply medium capacity pump defaults when the caller leaves the physical limits null', async () => {
    const noDefaultsPump = new MatterbridgeEndpoint(pump, { id: 'noDefaultsPump' });
    noDefaultsPump.createDefaultIdentifyClusterServer();
    noDefaultsPump.createOnOffClusterServer();
    noDefaultsPump.createDefaultPumpConfigurationAndControlClusterServer();
    noDefaultsPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, noDefaultsPump)).toBeTruthy();

    expect(noDefaultsPump.getAttribute(PumpConfigurationAndControl.id, 'minConstSpeed')).toBe(600);
    expect(noDefaultsPump.getAttribute(PumpConfigurationAndControl.id, 'maxConstSpeed')).toBe(3000);
    expect(noDefaultsPump.getAttribute(PumpConfigurationAndControl.id, 'maxPressure')).toBe(6000);
    expect(noDefaultsPump.getAttribute(PumpConfigurationAndControl.id, 'maxSpeed')).toBe(3000);
    expect(noDefaultsPump.getAttribute(PumpConfigurationAndControl.id, 'maxFlow')).toBe(100);
  });

  test('should not override explicit physical limits with the medium capacity pump defaults', async () => {
    const explicitPump = new MatterbridgeEndpoint(pump, { id: 'explicitPump' });
    explicitPump.createDefaultIdentifyClusterServer();
    explicitPump.createOnOffClusterServer();
    explicitPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, 8000, 4000, 200, 1000, 4000);
    explicitPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, explicitPump)).toBeTruthy();

    expect(explicitPump.getAttribute(PumpConfigurationAndControl.id, 'minConstSpeed')).toBe(1000);
    expect(explicitPump.getAttribute(PumpConfigurationAndControl.id, 'maxConstSpeed')).toBe(4000);
    expect(explicitPump.getAttribute(PumpConfigurationAndControl.id, 'maxPressure')).toBe(8000);
    expect(explicitPump.getAttribute(PumpConfigurationAndControl.id, 'maxSpeed')).toBe(4000);
    expect(explicitPump.getAttribute(PumpConfigurationAndControl.id, 'maxFlow')).toBe(200);
  });

  test('should map LevelControl CurrentLevel to the Pump Speed and Capacity setpoints using the Level/2 percent rule', async () => {
    // Device Library Pump clarifications (§5.5.5.2): Level 1-200 is a setpoint of Level/2 percent, applied to
    // maxConstSpeed for Speed (§4.2.7.3) and to the Capacity attribute (§4.2.7.17, 0.005% granularity: percent x 200).
    // With maxConstSpeed=3000: level 120 -> 60.0% -> speed 1800, capacity 12000; level 200 -> 100.0% -> speed 3000,
    // capacity 20000.
    const levelPump = new MatterbridgeEndpoint(pump, { id: 'levelPump' });
    levelPump.createDefaultIdentifyClusterServer();
    levelPump.createOnOffClusterServer();
    levelPump.behaviors.require(MatterbridgeLevelControlServer.with(), {
      currentLevel: 0,
      minLevel: 0,
      maxLevel: 254,
      onLevel: null,
      options: { executeIfOff: false },
    });
    levelPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, null, 3000, null, 1000, 3000);
    levelPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, levelPump)).toBeTruthy();

    await levelPump.setAttribute(LevelControl.id, 'currentLevel', 120);
    await flushAsync();
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(1800);
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(12000);

    await levelPump.setAttribute(LevelControl.id, 'currentLevel', 200);
    await flushAsync();
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(3000);
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(20000);

    // Level 201-255 clamps to a 100.0% setpoint.
    await levelPump.setAttribute(LevelControl.id, 'currentLevel', 254);
    await flushAsync();
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(3000);
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(20000);

    // Level 0 stops the pump.
    await levelPump.setAttribute(LevelControl.id, 'currentLevel', 0);
    await flushAsync();
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(0);
    expect(levelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(0);
  });

  test('should set speed to 0 on OnOff Off, and to the current level setpoint on OnOff On', async () => {
    const onOffPump = new MatterbridgeEndpoint(pump, { id: 'onOffPump' });
    onOffPump.createDefaultIdentifyClusterServer();
    onOffPump.createOnOffClusterServer(false);
    onOffPump.behaviors.require(MatterbridgeLevelControlServer.with(), {
      currentLevel: 120,
      minLevel: 0,
      maxLevel: 254,
      onLevel: null,
      options: { executeIfOff: false },
    });
    onOffPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, null, 3000, null, 1000, 3000);
    onOffPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, onOffPump)).toBeTruthy();

    await onOffPump.setAttribute(OnOff.id, 'onOff', true);
    await flushAsync();
    expect(onOffPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(1800);
    expect(onOffPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(12000);

    await onOffPump.setAttribute(OnOff.id, 'onOff', false);
    await flushAsync();
    expect(onOffPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(0);
    expect(onOffPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(0);
  });

  test('should power on to MaxLevel (100%) when LevelControl has no CurrentLevel to restore', async () => {
    const noLevelPump = new MatterbridgeEndpoint(pump, { id: 'noLevelPump' });
    noLevelPump.createDefaultIdentifyClusterServer();
    noLevelPump.createOnOffClusterServer(false);
    // No LevelControl cluster on this endpoint: LevelControl is optional for the Pump device type.
    noLevelPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, null, 3000, null, 1000, 3000);
    noLevelPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, noLevelPump)).toBeTruthy();
    expect(noLevelPump.hasAttributeServer(LevelControl.id, 'currentLevel')).toBe(false);

    await noLevelPump.setAttribute(OnOff.id, 'onOff', true);
    await flushAsync();
    expect(noLevelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(3000);
    expect(noLevelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(20000);
  });

  test('should not react to OnOff when the Pump has no OnOff cluster', async () => {
    const noOnOffPump = new MatterbridgeEndpoint(pump, { id: 'noOnOffPump' });
    noOnOffPump.createDefaultIdentifyClusterServer();
    // No OnOff cluster on this endpoint, so initialize() must skip registering the OnOff reactor entirely.
    noOnOffPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, null, 3000, null, 1000, 3000);
    expect(await addDevice(aggregator, noOnOffPump)).toBeTruthy();
    expect(noOnOffPump.hasAttributeServer(OnOff.id, 'onOff')).toBe(false);
    expect(noOnOffPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBeNull();
    expect(noOnOffPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBeNull();
  });

  test('should fall back to MaxLevel and treat a null CurrentLevel as stopped', async () => {
    const nullLevelPump = new MatterbridgeEndpoint(pump, { id: 'nullLevelPump' });
    nullLevelPump.createDefaultIdentifyClusterServer();
    nullLevelPump.createOnOffClusterServer(false);
    // CurrentLevel starts null (a legal, nullable LevelControl value): initialize() falls back to MaxLevel.
    nullLevelPump.behaviors.require(MatterbridgeLevelControlServer.with(), {
      currentLevel: null,
      minLevel: 0,
      maxLevel: 200,
      onLevel: null,
      options: { executeIfOff: false },
    });
    nullLevelPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, null, 3000, null, 1000, 3000);
    nullLevelPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, nullLevelPump)).toBeTruthy();

    await nullLevelPump.setAttribute(OnOff.id, 'onOff', true);
    await flushAsync();
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(3000);
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(20000);

    // A CurrentLevel change back to null stops the pump but keeps the last known level for a later OnOff.on.
    await nullLevelPump.setAttribute(LevelControl.id, 'currentLevel', 120);
    await flushAsync();
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(1800);
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(12000);

    await nullLevelPump.setAttribute(LevelControl.id, 'currentLevel', null);
    await flushAsync();
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(0);
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(0);

    await nullLevelPump.setAttribute(OnOff.id, 'onOff', false);
    await nullLevelPump.setAttribute(OnOff.id, 'onOff', true);
    await flushAsync();
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(1800);
    expect(nullLevelPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(12000);
  });

  test('should fall back to MaxSpeed, then 0, when MaxConstSpeed is unset', async () => {
    const noConstSpeedPump = new MatterbridgeEndpoint(pump, { id: 'noConstSpeedPump' });
    noConstSpeedPump.createDefaultIdentifyClusterServer();
    noConstSpeedPump.createOnOffClusterServer();
    noConstSpeedPump.behaviors.require(MatterbridgeLevelControlServer.with(), {
      currentLevel: 200,
      minLevel: 0,
      maxLevel: 254,
      onLevel: null,
      options: { executeIfOff: false },
    });
    noConstSpeedPump.createDefaultPumpConfigurationAndControlClusterServer(PumpConfigurationAndControl.OperationMode.Normal, null, 3000, null, 1000, 3000);
    noConstSpeedPump.addRequiredClusterServers();
    expect(await addDevice(aggregator, noConstSpeedPump)).toBeTruthy();

    // MaxConstSpeed unset (null): falls back to MaxSpeed for the 100% setpoint. Capacity is unaffected, since
    // it is derived purely from the setpoint percentage, not from MaxConstSpeed/MaxSpeed.
    await noConstSpeedPump.setAttribute(PumpConfigurationAndControl.id, 'maxConstSpeed', null);
    await noConstSpeedPump.setAttribute(LevelControl.id, 'currentLevel', 254);
    await flushAsync();
    expect(noConstSpeedPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(3000);
    expect(noConstSpeedPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(20000);

    // Both MaxConstSpeed and MaxSpeed unset: falls back to 0.
    await noConstSpeedPump.setAttribute(PumpConfigurationAndControl.id, 'maxSpeed', null);
    await noConstSpeedPump.setAttribute(LevelControl.id, 'currentLevel', 200);
    await flushAsync();
    expect(noConstSpeedPump.getAttribute(PumpConfigurationAndControl.id, 'speed')).toBe(0);
    expect(noConstSpeedPump.getAttribute(PumpConfigurationAndControl.id, 'capacity')).toBe(20000);
  });

  test('should mirror OperationMode writes onto EffectiveOperationMode', async () => {
    // Device Library Pump clarifications (§4.2.7.15): "The value of the EffectiveOperationMode attribute is
    // the same as the OperationMode attribute" (outside of LocalOverride, covered separately below).
    const opModePump = new MatterbridgeEndpoint(pump, { id: 'opModePump' });
    opModePump.createDefaultIdentifyClusterServer();
    opModePump.createOnOffClusterServer();
    opModePump.createDefaultPumpConfigurationAndControlClusterServer();
    opModePump.addRequiredClusterServers();
    expect(await addDevice(aggregator, opModePump)).toBeTruthy();
    expect(opModePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Normal);

    await opModePump.setAttribute(PumpConfigurationAndControl.id, 'operationMode', PumpConfigurationAndControl.OperationMode.Minimum);
    expect(opModePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Minimum);

    await opModePump.setAttribute(PumpConfigurationAndControl.id, 'operationMode', PumpConfigurationAndControl.OperationMode.Maximum);
    expect(opModePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Maximum);

    await opModePump.setAttribute(PumpConfigurationAndControl.id, 'operationMode', PumpConfigurationAndControl.OperationMode.Normal);
    expect(opModePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Normal);
  });

  test('should reject OperationMode writes while PumpStatus.LocalOverride is set', async () => {
    // §4.2.6.1.3 LocalOverride Bit: "Any request changing OperationMode SHALL generate a FAILURE error
    // status until LocalOverride is cleared on the physical device." This Pump only enables the
    // ConstantSpeed feature, so LocalOverride never legitimately gets set by this class itself (the Local
    // OperationMode value requires the LocalOperation feature) — this test sets it directly to exercise the
    // rejection rule on its own.
    const localOverridePump = new MatterbridgeEndpoint(pump, { id: 'localOverridePump' });
    localOverridePump.createDefaultIdentifyClusterServer();
    localOverridePump.createOnOffClusterServer();
    localOverridePump.createDefaultPumpConfigurationAndControlClusterServer();
    localOverridePump.addRequiredClusterServers();
    expect(await addDevice(aggregator, localOverridePump)).toBeTruthy();

    await localOverridePump.setAttribute(PumpConfigurationAndControl.id, 'operationMode', PumpConfigurationAndControl.OperationMode.Minimum);
    expect(localOverridePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Minimum);

    await localOverridePump.setAttribute(PumpConfigurationAndControl.id, 'pumpStatus', { running: false, localOverride: true });

    await expect(localOverridePump.setAttribute(PumpConfigurationAndControl.id, 'operationMode', PumpConfigurationAndControl.OperationMode.Maximum)).rejects.toMatchObject({
      code: Status.Failure,
    });
    expect(localOverridePump.getAttribute(PumpConfigurationAndControl.id, 'operationMode')).toBe(PumpConfigurationAndControl.OperationMode.Minimum);
    expect(localOverridePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Minimum);

    // Once LocalOverride clears, OperationMode writes are accepted again.
    await localOverridePump.setAttribute(PumpConfigurationAndControl.id, 'pumpStatus', { running: false, localOverride: false });
    await localOverridePump.setAttribute(PumpConfigurationAndControl.id, 'operationMode', PumpConfigurationAndControl.OperationMode.Maximum);
    expect(localOverridePump.getAttribute(PumpConfigurationAndControl.id, 'effectiveOperationMode')).toBe(PumpConfigurationAndControl.OperationMode.Maximum);
  });
});
