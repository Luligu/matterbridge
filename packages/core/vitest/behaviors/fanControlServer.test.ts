/**
 * @file packages/core/vitest/behaviors/fanControlServer.test.ts
 * @description This file contains the tests for fanControlServer.
 * @author Luca Liguori
 */

const NAME = 'FanControlServer';
const MATTER_PORT = 11900;
const MATTER_CREATE_ONLY = true;

import { FanControl } from '@matter/types/clusters/fan-control';
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
import { LogLevel } from 'node-ansi-logger';

import { MatterbridgeFanControlServer } from '../../src/behaviors/fanControlServer.js';
import { fan } from '../../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../../src/matterbridgeEndpoint.js';

// Setup the test environment
await setupTest(NAME, false);

describe('FanMode attribute rules (Matter 1.6 Application Cluster Spec § 4.4.6.1)', () => {
  let device: MatterbridgeEndpoint;

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

  afterEach(() => {});

  afterAll(async () => {
    // Stop or flush the server node depending on the create-only mode
    if (MATTER_CREATE_ONLY) await flushServerNode();
    else await stopServerNode();

    // Destroy the Matter test environment
    await destroyTestEnvironment();
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Create fan device with default OffLowMedHighAuto sequence', async () => {
    device = new MatterbridgeEndpoint(fan, { id: 'FanControlServerTest' });
    expect(device).toBeDefined();
    device.createDefaultFanControlClusterServer(FanControl.FanMode.Off, FanControl.FanModeSequence.OffLowMedHighAuto, 0, 0);
    device.addRequiredClusterServers();
    expect(await addDevice(aggregator, device)).toBeDefined();
    expect(device.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(device.getAttribute(FanControl, 'fanModeSequence')).toBe(FanControl.FanModeSequence.OffLowMedHighAuto);
  });

  test('Off Value (§ 4.4.6.1.1) zeroes PercentSetting and PercentCurrent', async () => {
    // Move off Off first: writing the same value again would not trigger the FanMode change handler.
    await device.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Medium);
    await device.setAttribute(FanControl, 'percentSetting', 60);
    await device.setAttribute(FanControl, 'percentCurrent', 60);

    await device.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Off);

    expect(device.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Off);
    expect(device.getAttribute(FanControl, 'percentSetting')).toBe(0);
    expect(device.getAttribute(FanControl, 'percentCurrent')).toBe(0);
  });

  test('Auto Value (§ 4.4.6.1.2) nulls PercentSetting and leaves PercentCurrent untouched', async () => {
    await device.setAttribute(FanControl, 'percentSetting', 60);
    await device.setAttribute(FanControl, 'percentCurrent', 60);

    await device.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Auto);

    expect(device.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Auto);
    expect(device.getAttribute(FanControl, 'percentSetting')).toBeNull();
    expect(device.getAttribute(FanControl, 'percentCurrent')).toBe(60);
  });

  test('On Value (§ 4.4.6.1.3) is remapped to High', async () => {
    // oxlint-disable-next-line typescript/no-deprecated
    await device.setAttribute(FanControl, 'fanMode', FanControl.FanMode.On);

    expect(device.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.High);
  });

  test('Smart Value (§ 4.4.6.1.4) is remapped to Auto when the Auto feature is supported', async () => {
    // oxlint-disable-next-line typescript/no-deprecated
    await device.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Smart);

    expect(device.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Auto);
  });

  test('Smart Value (§ 4.4.6.1.4) is remapped to High when the Auto feature is not supported', async () => {
    // None of the createDefault*FanControlClusterServer() helpers build a MatterbridgeFanControlServer without
    // Auto, so require the Step-only variant directly to exercise this fallback.
    const noAuto = new MatterbridgeEndpoint(fan, { id: 'FanControlServerNoAutoTest' });
    noAuto.behaviors.require(MatterbridgeFanControlServer.with(FanControl.Feature.Step), {
      fanMode: FanControl.FanMode.Off,
      fanModeSequence: FanControl.FanModeSequence.OffLowMedHigh,
      percentSetting: 0,
      percentCurrent: 0,
    });
    noAuto.addRequiredClusterServers();
    expect(await addDevice(aggregator, noAuto)).toBeDefined();

    // oxlint-disable-next-line typescript/no-deprecated
    await noAuto.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Smart);

    expect(noAuto.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.High);
  });

  test('FanMode not supported by FanModeSequence is rejected with CONSTRAINT_ERROR', async () => {
    // Medium is only valid when FanModeSequence is OffLowMedHigh or OffLowMedHighAuto; OffLowHighAuto omits it.
    const other = new MatterbridgeEndpoint(fan, { id: 'FanControlServerConstraintTest' });
    other.createDefaultFanControlClusterServer(FanControl.FanMode.Off, FanControl.FanModeSequence.OffLowHighAuto, 0, 0);
    other.addRequiredClusterServers();
    expect(await addDevice(aggregator, other)).toBeDefined();

    await expect(other.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Medium)).rejects.toThrow();
    expect(other.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Off);
  });

  test('Off and Auto Values also zero/null SpeedSetting and SpeedCurrent when MultiSpeed is supported', async () => {
    const multiSpeed = new MatterbridgeEndpoint(fan, { id: 'FanControlServerMultiSpeedTest' });
    multiSpeed.createMultiSpeedFanControlClusterServer(FanControl.FanMode.Medium, FanControl.FanModeSequence.OffLowMedHighAuto, 60, 60, 10, 6, 6);
    multiSpeed.addRequiredClusterServers();
    expect(await addDevice(aggregator, multiSpeed)).toBeDefined();
    expect(multiSpeed.getAttribute(FanControl, 'speedSetting')).toBe(6);
    expect(multiSpeed.getAttribute(FanControl, 'speedCurrent')).toBe(6);

    await multiSpeed.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Off);
    expect(multiSpeed.getAttribute(FanControl, 'percentSetting')).toBe(0);
    expect(multiSpeed.getAttribute(FanControl, 'percentCurrent')).toBe(0);
    expect(multiSpeed.getAttribute(FanControl, 'speedSetting')).toBe(0);
    expect(multiSpeed.getAttribute(FanControl, 'speedCurrent')).toBe(0);

    await multiSpeed.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Auto);
    expect(multiSpeed.getAttribute(FanControl, 'percentSetting')).toBeNull();
    expect(multiSpeed.getAttribute(FanControl, 'speedSetting')).toBeNull();
  });

  // Nested inside this describe's beforeAll/afterAll (server node lifecycle), not a sibling describe: a sibling
  // describe's tests would run after the afterAll above has already flushed/stopped the server node.
  describe('PercentSetting attribute rules (Matter 1.6 Application Cluster Spec § 4.4.6.3)', () => {
    let percentDevice: MatterbridgeEndpoint;

    test('Create fan device with default OffLowMedHighAuto sequence', async () => {
      percentDevice = new MatterbridgeEndpoint(fan, { id: 'PercentSettingServerTest' });
      percentDevice.createDefaultFanControlClusterServer(FanControl.FanMode.Off, FanControl.FanModeSequence.OffLowMedHighAuto, 0, 0);
      percentDevice.addRequiredClusterServers();
      expect(await addDevice(aggregator, percentDevice)).toBeDefined();
    });

    test('Writing PercentSetting to 0 sets FanMode to Off (§ 4.4.6.3.1)', async () => {
      // Move off Off first: writing 0 again would not trigger the PercentSetting change handler.
      await percentDevice.setAttribute(FanControl, 'fanMode', FanControl.FanMode.High);

      await percentDevice.setAttribute(FanControl, 'percentSetting', 0);

      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Off);
      expect(percentDevice.getAttribute(FanControl, 'percentSetting')).toBe(0);
    });

    test('Writing PercentSetting within a range sets FanMode to that range and keeps the written value (§ 4.4.6.3.1)', async () => {
      // With FanModeSequence OffLowMedHighAuto, the 1-100 domain splits into Low 1-33 / Medium 34-66 / High 67-100.
      await percentDevice.setAttribute(FanControl, 'percentSetting', 20);
      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Low);
      expect(percentDevice.getAttribute(FanControl, 'percentSetting')).toBe(20); // Not snapped to the range's midpoint.

      await percentDevice.setAttribute(FanControl, 'percentSetting', 50);
      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Medium);
      expect(percentDevice.getAttribute(FanControl, 'percentSetting')).toBe(50);

      await percentDevice.setAttribute(FanControl, 'percentSetting', 90);
      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.High);
      expect(percentDevice.getAttribute(FanControl, 'percentSetting')).toBe(90);
    });

    test('Writing FanMode to Low/Medium/High sets PercentSetting to a value within the mapped range (§ 4.4.6.1 / § 4.4.6.3.1)', async () => {
      // Currently High/90 (from the previous test) — going to Off first guarantees PercentSetting (0) starts out of range.
      await percentDevice.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Off);

      await percentDevice.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Medium);

      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Medium);
      const percentSetting = percentDevice.getAttribute(FanControl, 'percentSetting');
      expect(percentSetting).not.toBeNull();
      if (percentSetting === null) return; // Narrows the type below; the assertion above already failed the test if reached.
      expect(percentSetting).toBeGreaterThanOrEqual(34);
      expect(percentSetting).toBeLessThanOrEqual(66);
    });

    test('Writing FanMode to a value whose range already contains the current PercentSetting leaves it untouched (§ 4.4.6.3.1)', async () => {
      // PercentSetting is currently within the Medium range (from the previous test); Medium -> Medium is a no-op,
      // so move to Low first, then set PercentSetting to a specific value inside Low's own range before returning to Low.
      await percentDevice.setAttribute(FanControl, 'fanMode', FanControl.FanMode.High);
      await percentDevice.setAttribute(FanControl, 'percentSetting', 10);

      await percentDevice.setAttribute(FanControl, 'fanMode', FanControl.FanMode.Low);

      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Low);
      expect(percentDevice.getAttribute(FanControl, 'percentSetting')).toBe(10); // Already in range 1-33: not re-snapped.
    });

    test('Writing null to PercentSetting leaves it unchanged (§ 4.4.6.3 chapeau)', async () => {
      await percentDevice.setAttribute(FanControl, 'percentSetting', 10);

      await percentDevice.setAttribute(FanControl, 'percentSetting', null);

      expect(percentDevice.getAttribute(FanControl, 'percentSetting')).toBe(10);
      expect(percentDevice.getAttribute(FanControl, 'fanMode')).toBe(FanControl.FanMode.Low);
    });

    test('Writing PercentSetting computes SpeedSetting via the SpeedMax formula when MultiSpeed is supported (§ 4.4.6.3.1)', async () => {
      const multiSpeed = new MatterbridgeEndpoint(fan, { id: 'PercentSettingMultiSpeedTest' });
      // speed = ceil( SpeedMax * (percent * 0.01) ): with SpeedMax 42 and PercentSetting 25, speed = ceil(10.5) = 11.
      multiSpeed.createMultiSpeedFanControlClusterServer(FanControl.FanMode.Off, FanControl.FanModeSequence.OffLowMedHighAuto, 0, 0, 42, 0, 0);
      multiSpeed.addRequiredClusterServers();
      expect(await addDevice(aggregator, multiSpeed)).toBeDefined();

      await multiSpeed.setAttribute(FanControl, 'percentSetting', 25);

      expect(multiSpeed.getAttribute(FanControl, 'speedSetting')).toBe(11);
    });
  });
});
