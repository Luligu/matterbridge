/**
 * @file packages/core/vitest/matterbridgeEndpoint-matterjs.test.ts
 * @description This file contains the tests for the MatterbridgeEndpoint class with matter.js.
 * @author Luca Liguori
 */

/* oxlint-disable typescript/no-misused-promises */
/* oxlint-disable typescript/prefer-nullish-coalescing */

/**
 * WARNING!!!
 * The tests in this unit are supposed to run sequentially because they depend on the Matterbridge/Matter state.
 * Is not possible for timing reasons to create and destroy a Matter node each test to keep isolation.
 */

const NAME = 'EndpointMatterJs';
const MATTER_PORT = 11100;
const MATTER_CREATE_ONLY = true;

import { existsSync } from 'node:fs';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';

import { Diagnostic, LogDestination, LogFormat as MatterLogFormat, Logger, LogLevel as MatterLogLevel, type StorageContext } from '@matter/general';
import { Endpoint } from '@matter/node';
import { BooleanStateServer } from '@matter/node/behaviors/boolean-state';
import { DescriptorBehavior, DescriptorServer } from '@matter/node/behaviors/descriptor';
import { GroupsBehavior, GroupsServer } from '@matter/node/behaviors/groups';
import { IdentifyBehavior, IdentifyServer } from '@matter/node/behaviors/identify';
import { IlluminanceMeasurementServer } from '@matter/node/behaviors/illuminance-measurement';
import { OccupancySensingServer } from '@matter/node/behaviors/occupancy-sensing';
import { OnOffBehavior, OnOffServer } from '@matter/node/behaviors/on-off';
import { ScenesManagementBehavior, ScenesManagementServer } from '@matter/node/behaviors/scenes-management';
import { ContactSensorDevice } from '@matter/node/devices/contact-sensor';
import { OccupancySensorDevice, OccupancySensorDeviceDefinition } from '@matter/node/devices/occupancy-sensor';
import { OnOffLightSwitchDevice, OnOffLightSwitchRequirements } from '@matter/node/devices/on-off-light-switch';
import { OnOffPlugInUnitDevice, OnOffPlugInUnitDeviceDefinition } from '@matter/node/devices/on-off-plug-in-unit';
import { FabricManager } from '@matter/protocol';
import { Binding, ColorControl, Descriptor, Groups, Identify, LevelControl, OccupancySensing, OnOff, ScenesManagement, Thermostat } from '@matter/types/clusters';
import { flushAsync } from '@matterbridge/test-utils';
import { createServerNode, createTestEnvironment, destroyTestEnvironment, flushServerNode, server, startServerNode, stopServerNode } from '@matterbridge/test-utils/vitest/matter';
import { HOMEDIR, setDebug, setupTest } from '@matterbridge/test-utils/vitest/setup';

import {
  doorLock,
  extendedColorLight,
  fan,
  laundryWasher,
  lightSensor,
  modeSelect,
  occupancySensor,
  onOffLight,
  onOffLightSwitch,
  onOffPlugInUnit,
  smokeCoAlarm,
  thermostat,
  waterHeater,
  waterLeakDetector,
  waterValve,
  windowCovering,
} from '../src/matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from '../src/matterbridgeEndpoint.js';
import { getAttributeId, getClusterId } from '../src/matterbridgeEndpointHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('Matterbridge ' + NAME, () => {
  let context: StorageContext;
  let light: MatterbridgeEndpoint;
  let extendedLight: MatterbridgeEndpoint;
  let coverLift: MatterbridgeEndpoint;
  let coverLiftTilt: MatterbridgeEndpoint;
  let lock: MatterbridgeEndpoint;
  let vent: MatterbridgeEndpoint;
  let thermo: MatterbridgeEndpoint;
  let valve: MatterbridgeEndpoint;
  let mode: MatterbridgeEndpoint;
  let smoke: MatterbridgeEndpoint;
  let leak: MatterbridgeEndpoint;
  let laundry: MatterbridgeEndpoint;
  let heater: MatterbridgeEndpoint;
  let waterTank: MatterbridgeEndpoint;

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

  test('logger and destinations', () => {
    const write = vi.fn((text: string, message: Diagnostic.Message) => {});
    const originalWrite = Logger.destinations.default.write;
    Logger.destinations.default.write = write;
    const logger = Logger.get('Matterbridge');
    logger.info('Starting test ' + NAME, MATTER_PORT);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Starting test ' + NAME),
      expect.objectContaining({
        facility: 'Matterbridge',
        level: MatterLogLevel.INFO,
        now: expect.anything(),
        prefix: '',
        values: ['Starting test EndpointMatterJs', MATTER_PORT],
      }),
    );
    Logger.destinations.default.write = originalWrite;
  });

  test('log the server node on destination file', async () => {
    await setDebug(true);

    const fileDestination = LogDestination({ name: 'file', level: MatterLogLevel.DEBUG, format: MatterLogFormat.formats.plain });
    const write = vi.fn((text: string, message: Diagnostic.Message) => {});
    write.mockImplementation(async (text: string, message: Diagnostic.Message) => {
      await appendFile(path.join(HOMEDIR, 'diagnostic.log'), text + '\n', { encoding: 'utf8' });
    });
    fileDestination.write = write;
    Logger.destinations.file = fileDestination;
    expect(existsSync(path.join(HOMEDIR, 'diagnostic.log'))).toBe(false);
    expect(Object.keys(Logger.destinations)).toHaveLength(2);
    expect(Object.keys(Logger.destinations)).toContain('default');
    expect(Object.keys(Logger.destinations)).toContain('file');

    const logger = Logger.get('ServerNode');

    /*
    fileDestination.add({
      facility: 'ServerNode',
      level: MatterLogLevel.NOTICE,
      now: Time.now(),
      prefix: '',
      values: ['Server node:', server.maybeId, server.maybeNumber],
    });
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Server node:'),
      expect.objectContaining({
        facility: 'ServerNode',
        level: MatterLogLevel.NOTICE,
        now: expect.anything(),
        prefix: '',
        values: ['Server node:', server.maybeId, server.maybeNumber],
      }),
    );
    */

    /*
    logger.notice('Server node:', server.maybeId, server.maybeNumber);
    expect(write).toHaveBeenCalledWith(
      expect.stringContaining('Server node:'),
      expect.objectContaining({
        facility: 'ServerNode',
        level: MatterLogLevel.NOTICE,
        now: expect.anything(),
        prefix: '',
        values: ['Server node:', server.maybeId, server.maybeNumber],
      }),
    );
    */

    if (!fileDestination.context) {
      fileDestination.context = Diagnostic.Context();
    }

    fileDestination.context.run(() =>
      fileDestination.add(
        Diagnostic.message({
          now: new Date(),
          facility: 'Server node',
          level: MatterLogLevel.INFO,
          prefix: Logger.nestingLevel ? '⎸'.padEnd(Logger.nestingLevel * 2) : '',
          values: [server],
        }),
      ),
    );
    await flushAsync();
    expect(existsSync(path.join(HOMEDIR, 'diagnostic.log'))).toBe(true);

    delete Logger.destinations.file;
    expect(Object.keys(Logger.destinations)).toHaveLength(1);
    expect(Object.keys(Logger.destinations)).toContain('default');

    await setDebug(false);
  });

  test('FabricManager', async () => {
    await setDebug(true);

    const fabricManager = server.env.get(FabricManager);
    expect(fabricManager).toBeDefined();

    await setDebug(false);
  });

  test('create a onOffLight device', () => {
    light = new MatterbridgeEndpoint(onOffLight, { id: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }] });
    expect(light).toBeDefined();
    expect(light.id).toBe('OnOffLight');
    expect(light.type.name).toBe(onOffLight.name.replace('-', '_'));
    expect(light.type.deviceType).toBe(onOffLight.code);
    expect(light.type.deviceClass).toBe(onOffLight.deviceClass.toLowerCase());
    expect(light.type.deviceRevision).toBe(onOffLight.revision);
    expect(light.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
  });

  test('create an enhanced onOffLight device', () => {
    extendedLight = new MatterbridgeEndpoint(extendedColorLight, { id: 'EnhancedOnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }] });
    expect(extendedLight).toBeDefined();
    expect(extendedLight.id).toBe('EnhancedOnOffLight');
    expect(extendedLight.type.name).toBe(extendedColorLight.name.replace('-', '_'));
    expect(extendedLight.type.deviceType).toBe(extendedColorLight.code);
    expect(extendedLight.type.deviceClass).toBe(extendedColorLight.deviceClass.toLowerCase());
    expect(extendedLight.type.deviceRevision).toBe(extendedColorLight.revision);
    expect(extendedLight.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
  });

  test('create a cover lift device', () => {
    coverLift = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverLift' });
    coverLift.addRequiredClusterServers();
    expect(coverLift).toBeDefined();
    expect(coverLift.id).toBe('WindowCoverLift');
    expect(coverLift.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'windowCovering']);
  });

  test('create a cover tilt device', () => {
    coverLiftTilt = new MatterbridgeEndpoint(windowCovering, { id: 'WindowCoverTilt' });
    coverLiftTilt.createDefaultLiftTiltWindowCoveringClusterServer();
    coverLiftTilt.addRequiredClusterServers();
    expect(coverLiftTilt).toBeDefined();
    expect(coverLiftTilt.id).toBe('WindowCoverTilt');
    expect(coverLiftTilt.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'windowCovering', 'identify']);
  });

  test('create a lock device', () => {
    lock = new MatterbridgeEndpoint(doorLock, { id: 'DoorLock' });
    lock.addRequiredClusterServers();
    expect(lock).toBeDefined();
    expect(lock.id).toBe('DoorLock');
    expect(lock.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'doorLock']);
  });

  test('create a fan device', () => {
    vent = new MatterbridgeEndpoint(fan, { id: 'Fan' });
    vent.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    vent.createDefaultHepaFilterMonitoringClusterServer();
    vent.addRequiredClusterServers();
    expect(vent).toBeDefined();
    expect(vent.id).toBe('Fan');
    expect(vent.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'activatedCarbonFilterMonitoring', 'hepaFilterMonitoring', 'identify', 'groups', 'fanControl']);
  });

  test('create a water tank device', () => {
    // Water Tank Level Monitoring is only optional on the Humidifier/Dehumidifier device type (Matter 1.7, not yet
    // available in this SDK), so onOffLight is used here as a plain scaffold for the cluster server itself.
    waterTank = new MatterbridgeEndpoint(onOffLight, { id: 'WaterTank' });
    waterTank.createDefaultWaterTankLevelMonitoringClusterServer();
    waterTank.addRequiredClusterServers();
    expect(waterTank).toBeDefined();
    expect(waterTank.id).toBe('WaterTank');
    expect(waterTank.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'waterTankLevelMonitoring', 'identify', 'groups', 'scenesManagement', 'onOff']);
  });

  test('create a thermostat device', () => {
    thermo = new MatterbridgeEndpoint(thermostat, { id: 'Thermostat' });
    thermo.addRequiredClusterServers();
    expect(thermo).toBeDefined();
    expect(thermo.id).toBe('Thermostat');
    expect(thermo.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat']);
  });

  test('create a valve device', () => {
    valve = new MatterbridgeEndpoint(waterValve, { id: 'WaterValve' });
    valve.addRequiredClusterServers();
    expect(valve).toBeDefined();
    expect(valve.id).toBe('WaterValve');
    expect(valve.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'valveConfigurationAndControl']);
  });

  test('create a mode device', () => {
    mode = new MatterbridgeEndpoint(modeSelect, { id: 'ModeSelect' });
    mode.createDefaultModeSelectClusterServer('Night mode', [
      { label: 'Led ON', mode: 0, semanticTags: [] },
      { label: 'Led OFF', mode: 1, semanticTags: [] },
    ]);
    expect(mode).toBeDefined();
    expect(mode.id).toBe('ModeSelect');
    expect(mode.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'modeSelect']);
  });

  test('create a smoke device', () => {
    smoke = new MatterbridgeEndpoint(smokeCoAlarm, { id: 'SmokeSensor' });
    smoke.addRequiredClusterServers();
    expect(smoke).toBeDefined();
    expect(smoke.id).toBe('SmokeSensor');
    expect(smoke.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'smokeCoAlarm']);
  });

  test('create a water leak device', () => {
    leak = new MatterbridgeEndpoint(waterLeakDetector, { id: 'LeakSensor' });
    leak.createDefaultBooleanStateConfigurationClusterServer();
    leak.addRequiredClusterServers();
    expect(leak).toBeDefined();
    expect(leak.id).toBe('LeakSensor');
    expect(leak.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanStateConfiguration', 'identify', 'booleanState']);
  });

  test('create a laundry device', () => {
    laundry = new MatterbridgeEndpoint(laundryWasher, { id: 'Laundry' });
    laundry.addRequiredClusterServers();
    expect(laundry).toBeDefined();
    expect(laundry.id).toBe('Laundry');
    expect(laundry.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'operationalState']);
  });

  test('create a waterHeater device', () => {
    heater = new MatterbridgeEndpoint(waterHeater, { id: 'WaterHeater' });
    heater.createDefaultIdentifyClusterServer();
    heater.createDefaultHeatingThermostatClusterServer();
    // heater.addRequiredClusterServers(); // Wait for the PR 304 to finish with the cluster helpers
    expect(heater).toBeDefined();
    expect(heater.id).toBe('WaterHeater');
    expect(heater.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat']);
  });

  test('add BasicInformationCluster to onOffLight', () => {
    expect(light).toBeDefined();
    light.createDefaultBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 0x8000, 'Light');
    expect(light.deviceName).toBe('Light');
    expect(light.serialNumber).toBe('123456789');
    expect(light.uniqueId).toBeDefined();
    expect(light.vendorId).toBe(0xfff1);
    expect(light.vendorName).toBe('Matterbridge');
    expect(light.productId).toBe(0x8000);
    expect(light.productName).toBe('Light');
    expect(light.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
  });

  test('add BridgedDeviceBasicInformationCluster to onOffLight', () => {
    expect(light).toBeDefined();
    light.createDefaultBridgedDeviceBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 'Light');
    expect(light.deviceName).toBe('Light');
    expect(light.serialNumber).toBe('123456789');
    expect(light.uniqueId).toBeDefined();
    expect(light.vendorId).toBe(0xfff1);
    expect(light.vendorName).toBe('Matterbridge');
    expect(light.productId).toBe(undefined);
    expect(light.productName).toBe('Light');
    delete light.behaviors.supported.bridgedDeviceBasicInformation;
    expect(light.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
  });

  test('add required clusters to onOffLight', () => {
    expect(light).toBeDefined();
    light.createDefaultOnOffClusterServer(true, false, 10, 14);
    light.addRequiredClusterServers();
    expect(light.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'identify', 'groups', 'scenesManagement']);
    expect(light.behaviors.supported.descriptor).toBeDefined();
    expect(light.behaviors.has(DescriptorBehavior)).toBeTruthy();
    expect(light.behaviors.has(DescriptorServer)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorBehavior)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorServer)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor.id)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor.id)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor.name)).toBeTruthy();
    expect(light.hasClusterServer('Descriptor')).toBeTruthy();
    expect(light.hasClusterServer('descriptor')).toBeTruthy();
    // consoleWarnSpy?.mockRestore();
    // console.warn(light.behaviors.optionsFor(DescriptorBehavior));

    expect(light.behaviors.supported['identify']).toBeDefined();
    expect(light.behaviors.has(IdentifyBehavior)).toBeTruthy();
    expect(light.behaviors.has(IdentifyServer)).toBeTruthy();
    expect(light.hasClusterServer(Identify)).toBeTruthy();
    expect(light.hasClusterServer(Identify.id)).toBeTruthy();
    expect(light.hasClusterServer(Identify.name)).toBeTruthy();

    expect(light.behaviors.supported['groups']).toBeDefined();
    expect(light.behaviors.has(GroupsBehavior)).toBeTruthy();
    expect(light.behaviors.has(GroupsServer)).toBeTruthy();
    expect(light.hasClusterServer(Groups)).toBeTruthy();
    expect(light.hasClusterServer(Groups.id)).toBeTruthy();
    expect(light.hasClusterServer(Groups.name)).toBeTruthy();

    expect(light.behaviors.supported['scenesManagement']).toBeDefined();
    expect(light.behaviors.has(ScenesManagementBehavior)).toBeTruthy();
    expect(light.behaviors.has(ScenesManagementServer)).toBeTruthy();
    expect(light.hasClusterServer(ScenesManagement)).toBeTruthy();
    expect(light.hasClusterServer(ScenesManagement.id)).toBeTruthy();
    expect(light.hasClusterServer(ScenesManagement.name)).toBeTruthy();
    expect(light.behaviors.supported['onOff']).toBeDefined();
    expect(light.behaviors.has(OnOffBehavior)).toBeTruthy();
    expect(light.behaviors.has(OnOffServer)).toBeTruthy();
    expect(light.hasClusterServer(OnOff)).toBeTruthy();
    expect(light.hasClusterServer(OnOff.id)).toBeTruthy();
    expect(light.hasClusterServer(OnOff.name)).toBeTruthy();
  });

  test('add onOffLight device to serverNode', async () => {
    expect(await server.add(light)).toBeDefined();
    expect(light.hasClusterServer(Descriptor)).toBe(true);
    expect(light.hasClusterServer(Identify)).toBe(true);
    expect(light.hasClusterServer(Groups)).toBe(true);
    expect(light.hasClusterServer(ScenesManagement)).toBe(true);
    expect(light.hasClusterServer(OnOff)).toBe(true);
  });

  test('add required clusters to enhanced onOffLight', () => {
    expect(extendedLight).toBeDefined();
    extendedLight.createDefaultOnOffClusterServer(true, false, 10, 14);
    extendedLight.createEnhancedColorControlClusterServer();
    extendedLight.addRequiredClusterServers();
    expect(extendedLight.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'colorControl', 'identify', 'groups', 'scenesManagement', 'levelControl']);
    expect(extendedLight.behaviors.supported.descriptor).toBeDefined();
    expect(extendedLight.behaviors.has(DescriptorBehavior)).toBeTruthy();
    expect(extendedLight.behaviors.has(DescriptorServer)).toBeTruthy();
    expect(extendedLight.hasClusterServer(DescriptorBehavior)).toBeTruthy();
    expect(extendedLight.hasClusterServer(DescriptorServer)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Descriptor)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Descriptor)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Descriptor.id)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Descriptor.id)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Descriptor.name)).toBeTruthy();
    expect(extendedLight.hasClusterServer('Descriptor')).toBeTruthy();
    expect(extendedLight.hasClusterServer('descriptor')).toBeTruthy();

    expect(extendedLight.behaviors.supported['identify']).toBeDefined();
    expect(extendedLight.behaviors.has(IdentifyBehavior)).toBeTruthy();
    expect(extendedLight.behaviors.has(IdentifyServer)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Identify)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Identify.id)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Identify.name)).toBeTruthy();

    expect(extendedLight.behaviors.supported['groups']).toBeDefined();
    expect(extendedLight.behaviors.has(GroupsBehavior)).toBeTruthy();
    expect(extendedLight.behaviors.has(GroupsServer)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Groups)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Groups.id)).toBeTruthy();
    expect(extendedLight.hasClusterServer(Groups.name)).toBeTruthy();

    expect(extendedLight.behaviors.supported['scenesManagement']).toBeDefined();
    expect(extendedLight.behaviors.has(ScenesManagementBehavior)).toBeTruthy();
    expect(extendedLight.behaviors.has(ScenesManagementServer)).toBeTruthy();
    expect(extendedLight.hasClusterServer(ScenesManagement)).toBeTruthy();
    expect(extendedLight.hasClusterServer(ScenesManagement.id)).toBeTruthy();
    expect(extendedLight.hasClusterServer(ScenesManagement.name)).toBeTruthy();

    expect(extendedLight.behaviors.supported['onOff']).toBeDefined();
    expect(extendedLight.behaviors.has(OnOffBehavior)).toBeTruthy();
    expect(extendedLight.behaviors.has(OnOffServer)).toBeTruthy();
    expect(extendedLight.hasClusterServer(OnOff)).toBeTruthy();
    expect(extendedLight.hasClusterServer(OnOff.id)).toBeTruthy();
    expect(extendedLight.hasClusterServer(OnOff.name)).toBeTruthy();
  });

  test('add enhanced onOffLight device to serverNode', async () => {
    expect(await server.add(extendedLight)).toBeDefined();
    expect(extendedLight.hasClusterServer(Descriptor)).toBe(true);
    expect(extendedLight.hasClusterServer(Identify)).toBe(true);
    expect(extendedLight.hasClusterServer(Groups)).toBe(true);
    expect(extendedLight.hasClusterServer(ScenesManagement)).toBe(true);
    expect(extendedLight.hasClusterServer(OnOff)).toBe(true);
    expect(extendedLight.hasClusterServer(LevelControl)).toBe(true);
    expect(extendedLight.hasClusterServer(ColorControl)).toBe(true);
  });

  test('add lift coverDevice device to serverNode', async () => {
    expect(await server.add(coverLift)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(coverLift);
  });

  test('add tilt coverDevice device to serverNode', async () => {
    expect(await server.add(coverLiftTilt)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(coverLiftTilt);
  });

  test('add lockDevice device to serverNode', async () => {
    expect(await server.add(lock)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(lock);
  });

  test('add fan device to serverNode', async () => {
    expect(await server.add(vent)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(vent);
  });

  test('add water tank device to serverNode', async () => {
    expect(await server.add(waterTank)).toBeDefined();
  });

  test('add thermostat device to serverNode', async () => {
    expect(await server.add(thermo)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(thermo);
  });

  test('add valve device to serverNode', async () => {
    expect(await server.add(valve)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(valve);
  });

  test('add mode device to serverNode', async () => {
    expect(await server.add(mode)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(mode);
  });

  test('add smoke device to serverNode', async () => {
    expect(await server.add(smoke)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(smoke);
  });

  test('add leak device to serverNode', async () => {
    expect(await server.add(leak)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(leak);
  });

  test('add laundry device to serverNode', async () => {
    expect(await server.add(laundry)).toBeDefined();
    // (matterbridge as any).frontend.getClusterTextFromDevice(laundry);
  });

  test('getClusterId and getAttributeId of onOffLight device behaviors', () => {
    expect(light).toBeDefined();
    expect(getClusterId(light, 'onOff')).toBe(0x6);
    expect(getClusterId(light, 'OnOff')).toBe(0x6);
    expect(getClusterId(light, 'onOffWrong')).toBeUndefined();
    expect(getClusterId(light, 'OnOffWrong')).toBeUndefined();

    expect(getClusterId(light, 'levelControl')).toBeUndefined();
    expect(getClusterId(light, 'LevelControl')).toBeUndefined();
    expect(getClusterId(light, 'levelControlWrong')).toBeUndefined();
    expect(getClusterId(light, 'LevelControlWrong')).toBeUndefined();

    expect(getAttributeId(light, 'onOff', 'OnOff')).toBe(0);
    expect(getAttributeId(light, 'OnOff', 'OnOff')).toBe(0);
    expect(getAttributeId(light, 'onOff', 'onOff')).toBe(0);
    expect(getAttributeId(light, 'OnOff', 'onOff')).toBe(0);
    expect(getAttributeId(light, 'onOffWrong', 'OnOff')).toBeUndefined();
    expect(getAttributeId(light, 'OnOffWrong', 'OnOff')).toBeUndefined();
    expect(getAttributeId(light, 'onOff', 'OnOffWrong')).toBeUndefined();
    expect(getAttributeId(light, 'OnOff', 'OnOffWrong')).toBeUndefined();
    expect(getAttributeId(light, 'onOff', 'onOffWrong')).toBeUndefined();
    expect(getAttributeId(light, 'OnOff', 'onOffWrong')).toBeUndefined();

    expect(getAttributeId(light, 'onOff', 'OnTime')).toBe(0x4001);
    expect(getAttributeId(light, 'OnOff', 'OnTime')).toBe(0x4001);
    expect(getAttributeId(light, 'onOff', 'onTime')).toBe(0x4001);
    expect(getAttributeId(light, 'OnOff', 'onTime')).toBe(0x4001);
    expect(getAttributeId(light, 'onOffWrong', 'OnTime')).toBeUndefined();
    expect(getAttributeId(light, 'OnOffWrong', 'OnTime')).toBeUndefined();
    expect(getAttributeId(light, 'onOff', 'OnTimeWrong')).toBeUndefined();
    expect(getAttributeId(light, 'OnOff', 'OnTimeWrong')).toBeUndefined();
    expect(getAttributeId(light, 'onOff', 'onTimeWrong')).toBeUndefined();
    expect(getAttributeId(light, 'OnOff', 'onTimeWrong')).toBeUndefined();
  });

  test('add deviceType to onOffPlugin without tagList', async () => {
    const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer, OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared)), {
      id: 'OnOffPlugin1',
      identify: {
        identifyTime: 0,
        identifyType: Identify.IdentifyType.None,
      },
      onOff: {
        onOff: false,
      },
      occupancySensing: {
        occupancy: { occupied: false },
        occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
        occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
        pirOccupiedToUnoccupiedDelay: 300,
        pirUnoccupiedToOccupiedDelay: 0,
      },
      descriptor: {
        deviceTypeList: [
          { deviceType: OnOffPlugInUnitDeviceDefinition.deviceType, revision: OnOffPlugInUnitDeviceDefinition.deviceRevision },
          { deviceType: OccupancySensorDevice.deviceType, revision: OccupancySensorDeviceDefinition.deviceRevision },
        ],
      },
    });
    expect(endpoint).toBeDefined();
    endpoint.behaviors.require(DescriptorServer, {
      deviceTypeList: [
        { deviceType: onOffPlugInUnit.code, revision: onOffPlugInUnit.revision },
        { deviceType: occupancySensor.code, revision: occupancySensor.revision },
      ],
    });
    expect(await server.add(endpoint)).toBeDefined();

    const endpoint_copy = server.parts.get('OnOffPlugin1');
    expect(endpoint_copy).toBeDefined();
    if (!endpoint_copy) throw new Error('Endpoint not found');
    Logger.get('Matterbridge').info('Occupancy state:', endpoint.state.occupancySensing.pirOccupiedToUnoccupiedDelay);
    // @ts-expect-error no more typed
    Logger.get('Matterbridge').info('Occupancy state:', endpoint_copy.state.occupancySensing.pirOccupiedToUnoccupiedDelay);
    // typed
    Logger.get('Matterbridge').info('Occupancy state:', endpoint_copy.stateOf(OccupancySensingServer).occupancy);
    // @ts-expect-error no more typed
    Logger.get('Matterbridge').info('Occupancy state:', endpoint_copy.stateOf(OccupancySensingServer).pirOccupiedToUnoccupiedDelay);
    // typed
    Logger.get('Matterbridge').info('Occupancy state:', endpoint_copy.stateOf(OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared)).pirOccupiedToUnoccupiedDelay);

    await new Promise<void>((resolve) => {
      endpoint.events.occupancySensing.occupancy$Changed.on((newState, oldState, context) => {
        // console.log(wr + 'occupancySensing.occupancy$Changed', newState, oldState, context);
        expect(newState).toBeDefined();
        expect(newState).toEqual({ occupied: true });
        expect(oldState).toBeDefined();
        expect(oldState).toEqual({ occupied: false });
        expect(context).toBeDefined();
        expect(context?.fabric === undefined).toBe(true);
        expect(context?.fabric).toBeUndefined();
        if (newState.occupied && !oldState.occupied && context?.fabric === undefined) {
          resolve();
        }
      });
      void endpoint.setStateOf(OccupancySensingServer, { occupancy: { occupied: true } });
    });
  });

  test('add deviceType to onOffPlugin with tagList', async () => {
    const endpoint = new Endpoint(
      OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared)),
      {
        id: 'OnOffPlugin2',
        identify: {
          identifyTime: 0,
          identifyType: Identify.IdentifyType.None,
        },
        onOff: {
          onOff: false,
        },
        occupancySensing: {
          occupancy: { occupied: false },
          occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
          occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
        },
        descriptor: {
          tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
          deviceTypeList: [
            { deviceType: onOffPlugInUnit.code, revision: onOffPlugInUnit.revision },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          ],
        },
      },
    );
    expect(endpoint).toBeDefined();
    expect(() =>
      endpoint.behaviors.require(DescriptorServer.with(Descriptor.Feature.TagList), {
        tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
        deviceTypeList: [
          { deviceType: onOffPlugInUnit.code, revision: onOffPlugInUnit.revision },
          { deviceType: occupancySensor.code, revision: occupancySensor.revision },
        ],
      }),
    ).not.toThrow();
    await expect(server.add(endpoint)).resolves.toBeDefined();
  });

  test('add deviceType to onOffPlugin in the costructor', async () => {
    const endpoint = new Endpoint(
      OnOffPlugInUnitDevice.with(
        DescriptorServer.with(Descriptor.Feature.TagList),
        OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared),
        IlluminanceMeasurementServer,
      ),
      {
        id: 'OnOffPlugin3',
        identify: {
          identifyTime: 0,
          identifyType: Identify.IdentifyType.None,
        },
        onOff: {
          onOff: false,
        },
        occupancySensing: {
          occupancy: { occupied: false },
          occupancySensorType: OccupancySensing.OccupancySensorType.Pir,
          occupancySensorTypeBitmap: { pir: true, ultrasonic: false, physicalContact: false },
        },
        descriptor: {
          tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
          deviceTypeList: [
            { deviceType: onOffPlugInUnit.code, revision: onOffPlugInUnit.revision },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
            { deviceType: lightSensor.code, revision: lightSensor.revision },
          ],
        },
      },
    );
    expect(endpoint).toBeDefined();
    await expect(server.add(endpoint)).resolves.toBeDefined();
    const deviceTypeList = endpoint.state.descriptor.deviceTypeList;
    expect(deviceTypeList).toHaveLength(3);
    expect(deviceTypeList[0].deviceType).toBe(onOffPlugInUnit.code);
    expect(deviceTypeList[0].revision).toBe(onOffPlugInUnit.revision);
    expect(deviceTypeList[1].deviceType).toBe(occupancySensor.code);
    expect(deviceTypeList[1].revision).toBe(occupancySensor.revision);
    expect(deviceTypeList[2].deviceType).toBe(lightSensor.code);
    expect(deviceTypeList[2].revision).toBe(lightSensor.revision);

    // await endpoint.setStateOf(OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared), { pirOccupiedToUnoccupiedDelay: 30 });
    // await endpoint.setStateOf(OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared), { pirUnoccupiedToOccupiedDelay: 30 });
  });

  test('add a booleanState', async () => {
    const endpoint = new Endpoint(ContactSensorDevice.with(BooleanStateServer.enable({ events: { stateChange: true } })), {
      id: 'ContactSensor1',
      identify: {
        identifyTime: 0,
        identifyType: Identify.IdentifyType.None,
      },
      booleanState: {
        stateValue: false,
      },
    });
    expect(endpoint).toBeDefined();
    await expect(server.add(endpoint)).resolves.toBeDefined();
    /*
    await endpoint.setStateOf(BooleanStateServer, { stateValue: true });
    await endpoint.set({ booleanState: { stateValue: false } });

    await endpoint.commands.identify.identify({ identifyTime: 5 });
    await endpoint.commands.identify.triggerEffect({ effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: 0 });
    await endpoint.commandsOf(IdentifyServer).identify({ identifyTime: 5 });
    await endpoint.commandsOf(IdentifyServer).triggerEffect({ effectIdentifier: Identify.EffectIdentifier.Blink, effectVariant: 0 });
    */
  });

  test('onOffSwitch device type matches OnOffLightSwitchDevice requirements', () => {
    const device = new MatterbridgeEndpoint(onOffLightSwitch, { id: 'SwitchTypeCheck' });

    // Extracts sorted numeric cluster IDs from a SupportedBehaviors or requirements map.
    const clusterIds = (behaviors: Record<string, any>): number[] =>
      Object.values(behaviors)
        .map((b) => b?.cluster?.id)
        .filter((id): id is number => id !== undefined)
        .toSorted((a: number, b: number) => a - b);

    // deviceType and deviceRevision must match
    expect(device.type.deviceType).toBe(OnOffLightSwitchDevice.deviceType);
    expect(device.type.deviceRevision).toBe(OnOffLightSwitchDevice.deviceRevision);

    const mbServerMandatory = clusterIds((device.type as any).requirements?.server?.mandatory ?? {});
    const mjServerMandatory = clusterIds(OnOffLightSwitchRequirements.server.mandatory);
    // Device Library §1.1.7 requires Binding for Simple endpoints with application clients.
    // On/Off Light Switch (§6.1) requires Identify server and Identify/OnOff clients.
    expect(mjServerMandatory).toEqual([Identify.id, Binding.id]);
    expect(mbServerMandatory).toEqual(mjServerMandatory);
    expect(mbServerMandatory).not.toContain(OnOff.id);

    const mbClientMandatory = clusterIds((device.type as any).requirements?.client?.mandatory ?? {});
    const mjClientMandatory = clusterIds(OnOffLightSwitchRequirements.client.mandatory);
    // client mandatory must match matter.js: [Identify, OnOff]
    expect(mbClientMandatory).toEqual(mjClientMandatory);

    const mbClientOptional = clusterIds((device.type as any).requirements?.client?.optional ?? {});
    const mjClientOptional = clusterIds(OnOffLightSwitchRequirements.client.optional);
    // client optional must match matter.js: [Groups, ScenesManagement]
    expect(mbClientOptional).toEqual(mjClientOptional);

    // MutableEndpoint auto-merges requirements.client.mandatory into clientClusters
    const mbClientClusters = clusterIds(device.type.clientClusters as Record<string, any>);
    expect(mbClientClusters).toEqual(expect.arrayContaining(mjClientMandatory));
  });
});
