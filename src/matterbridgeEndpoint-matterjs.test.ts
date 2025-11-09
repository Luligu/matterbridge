// src\matterbridgeEndpoint.test.ts

const MATTER_PORT = 6011;
const NAME = 'EndpointMatterJs';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import { appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import { jest } from '@jest/globals';
import { AnsiLogger, er, hk, LogLevel } from 'node-ansi-logger';
import { StorageContext, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Logger, Diagnostic, LogDestination, Time, NamedHandler } from '@matter/general';
import { FabricManager, MdnsService } from '@matter/protocol';
import { DeviceTypeId, VendorId } from '@matter/types';
import {
  ColorControl,
  ColorControlCluster,
  Descriptor,
  DescriptorCluster,
  DeviceEnergyManagement,
  DeviceEnergyManagementMode,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  FanControl,
  GroupsCluster,
  Identify,
  IdentifyCluster,
  LevelControlCluster,
  OccupancySensing,
  OnOffCluster,
  PowerSource,
  RvcCleanMode,
  RvcOperationalState,
  RvcRunMode,
  ScenesManagementCluster,
  ServiceArea,
  Thermostat,
  WaterHeaterManagement,
  WaterHeaterMode,
} from '@matter/types/clusters';
import { Endpoint, ServerNode } from '@matter/node';
import { AggregatorEndpoint } from '@matter/node/endpoints/aggregator';
import { ContactSensorDevice, OccupancySensorDevice, OccupancySensorDeviceDefinition, OnOffPlugInUnitDevice, OnOffPlugInUnitDeviceDefinition } from '@matter/node/devices';
import {
  BooleanStateConfigurationServer,
  BooleanStateServer,
  ColorControlServer,
  DescriptorBehavior,
  DescriptorServer,
  DeviceEnergyManagementModeServer,
  DoorLockServer,
  EnergyEvseModeServer,
  EnergyEvseServer,
  FanControlServer,
  GroupsBehavior,
  GroupsServer,
  IdentifyBehavior,
  IdentifyServer,
  IlluminanceMeasurementServer,
  LevelControlServer,
  ModeSelectServer,
  OccupancySensingServer,
  OnOffBehavior,
  OnOffServer,
  OperationalStateServer,
  RvcCleanModeServer,
  RvcOperationalStateServer,
  RvcRunModeServer,
  ScenesManagementBehavior,
  ScenesManagementServer,
  ServiceAreaServer,
  SmokeCoAlarmServer,
  ThermostatServer,
  ValveConfigurationAndControlServer,
  WaterHeaterManagementServer,
  WaterHeaterModeServer,
  WindowCoveringServer,
} from '@matter/node/behaviors';

import {
  MatterbridgeBooleanStateConfigurationServer,
  MatterbridgeColorControlServer,
  MatterbridgeDoorLockServer,
  MatterbridgeFanControlServer,
  MatterbridgeIdentifyServer,
  MatterbridgeLevelControlServer,
  MatterbridgeModeSelectServer,
  MatterbridgeOnOffServer,
  MatterbridgeOperationalStateServer,
  MatterbridgeServer,
  MatterbridgeSmokeCoAlarmServer,
  MatterbridgeThermostatServer,
  MatterbridgeValveConfigurationAndControlServer,
  MatterbridgeLiftWindowCoveringServer,
  MatterbridgeLiftTiltWindowCoveringServer,
  MatterbridgeDeviceEnergyManagementModeServer,
  MatterbridgeDeviceEnergyManagementServer,
  MatterbridgeEnhancedColorControlServer,
} from './matterbridgeBehaviors.js';
import { Matterbridge } from './matterbridge.js';
import {
  lightSensor,
  occupancySensor,
  onOffOutlet,
  coverDevice,
  doorLockDevice,
  fanDevice,
  thermostatDevice,
  waterValve,
  modeSelect,
  smokeCoAlarm,
  waterLeakDetector,
  laundryWasher,
  extendedColorLight,
  waterHeater,
} from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { getAttributeId, getClusterId, invokeBehaviorCommand } from './matterbridgeEndpointHelpers.js';
import { MatterbridgeRvcCleanModeServer, MatterbridgeRvcOperationalStateServer, MatterbridgeRvcRunModeServer, RoboticVacuumCleaner } from './devices/roboticVacuumCleaner.js';
import { WaterHeater } from './devices/waterHeater.js';
import { Evse, MatterbridgeEnergyEvseServer } from './devices/evse.js';
import { assertAllEndpointNumbersPersisted, closeMdnsInstance, createTestEnvironment, destroyInstance, flushAllEndpointNumberPersistence, flushAsync, loggerLogSpy, setDebug, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

// Setup the matter and test environment
createTestEnvironment(NAME);

describe('Matterbridge ' + NAME, () => {
  let matterbridge: Matterbridge;
  let context: StorageContext;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let light: MatterbridgeEndpoint;
  let enhancedLight: MatterbridgeEndpoint;
  let coverLift: MatterbridgeEndpoint;
  let coverLiftTilt: MatterbridgeEndpoint;
  let lock: MatterbridgeEndpoint;
  let fan: MatterbridgeEndpoint;
  let thermostat: MatterbridgeEndpoint;
  let valve: MatterbridgeEndpoint;
  let mode: MatterbridgeEndpoint;
  let smoke: MatterbridgeEndpoint;
  let leak: MatterbridgeEndpoint;
  let laundry: MatterbridgeEndpoint;
  let rvc: RoboticVacuumCleaner;
  let heater: MatterbridgeEndpoint;
  let evse: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance not initialized
    matterbridge = await Matterbridge.loadInstance(false);
    matterbridge.homeDirectory = HOMEDIR;
    matterbridge.matterbridgeDirectory = path.join(HOMEDIR, '.matterbridge');
    matterbridge.matterbridgePluginDirectory = path.join(HOMEDIR, 'Matterbridge');

    // Setup matter environment
    (matterbridge as any).environment.vars.set('log.level', MatterLogLevel.INFO);
    (matterbridge as any).environment.vars.set('log.format', MatterLogFormat.ANSI);
    (matterbridge as any).environment.vars.set('path.root', path.join(HOMEDIR, '.matterbridge', 'matterstorage'));
    (matterbridge as any).environment.vars.set('runtime.signals', false);
    (matterbridge as any).environment.vars.set('runtime.exitcode', false);
    await (matterbridge as any).startMatterStorage();
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
    // Restore all mocks
    jest.restoreAllMocks();
  });

  const deviceType = extendedColorLight;

  test('logger and destinations', async () => {
    const write = jest.fn((text: string, message: Diagnostic.Message) => {});
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

  test('create a context for server node', async () => {
    expect((matterbridge as any).environment.vars.get('path.root')).toBe(path.join(HOMEDIR, '.matterbridge', 'matterstorage'));
    context = await (matterbridge as any).createServerNodeContext('Matterbridge', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
    expect(context).toBeDefined();
  });

  test('create the server node', async () => {
    server = await (matterbridge as any).createServerNode(context, MATTER_PORT);
    expect(server).toBeDefined();
  });

  test('log the server node on destination file', async () => {
    setDebug(true);

    const fileDestination = LogDestination({ name: 'file', level: MatterLogLevel.DEBUG, format: MatterLogFormat.formats.plain });
    const write = jest.fn((text: string, message: Diagnostic.Message) => {});
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
          now: Time.now(),
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

    setDebug(false);
  });

  test('FabricManager', async () => {
    setDebug(true);

    const fabricManager = server.env.get(FabricManager);
    expect(fabricManager).toBeDefined();

    setDebug(false);
  });

  test('create a onOffLight device', async () => {
    light = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }] });
    expect(light).toBeDefined();
    expect(light.id).toBe('OnOffLight');
    expect(light.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(light.type.deviceType).toBe(deviceType.code);
    expect(light.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(light.type.deviceRevision).toBe(deviceType.revision);
    expect(light.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
  });

  test('create an enhanced onOffLight device', async () => {
    enhancedLight = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'EnhancedOnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }] });
    expect(enhancedLight).toBeDefined();
    expect(enhancedLight.id).toBe('EnhancedOnOffLight');
    expect(enhancedLight.type.name).toBe(deviceType.name.replace('-', '_'));
    expect(enhancedLight.type.deviceType).toBe(deviceType.code);
    expect(enhancedLight.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
    expect(enhancedLight.type.deviceRevision).toBe(deviceType.revision);
    expect(enhancedLight.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge']);
  });

  test('create a cover lift device', async () => {
    coverLift = new MatterbridgeEndpoint(coverDevice, { uniqueStorageKey: 'WindowCoverLift' });
    coverLift.addRequiredClusterServers();
    expect(coverLift).toBeDefined();
    expect(coverLift.id).toBe('WindowCoverLift');
    expect(coverLift.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'windowCovering']);
  });

  test('create a cover tilt device', async () => {
    coverLiftTilt = new MatterbridgeEndpoint(coverDevice, { uniqueStorageKey: 'WindowCoverTilt' });
    coverLiftTilt.createDefaultLiftTiltWindowCoveringClusterServer();
    coverLiftTilt.addRequiredClusterServers();
    expect(coverLiftTilt).toBeDefined();
    expect(coverLiftTilt.id).toBe('WindowCoverTilt');
    expect(coverLiftTilt.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'windowCovering', 'identify']);
  });

  test('create a lock device', async () => {
    lock = new MatterbridgeEndpoint(doorLockDevice, { uniqueStorageKey: 'DoorLock' });
    lock.addRequiredClusterServers();
    expect(lock).toBeDefined();
    expect(lock.id).toBe('DoorLock');
    expect(lock.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'doorLock']);
  });

  test('create a fan device', async () => {
    fan = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan' });
    fan.createDefaultActivatedCarbonFilterMonitoringClusterServer();
    fan.createDefaultHepaFilterMonitoringClusterServer();
    fan.addRequiredClusterServers();
    expect(fan).toBeDefined();
    expect(fan.id).toBe('Fan');
    expect(fan.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'activatedCarbonFilterMonitoring', 'hepaFilterMonitoring', 'identify', 'groups', 'fanControl']);
  });

  test('create a thermostat device', async () => {
    thermostat = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'Thermostat' });
    thermostat.addRequiredClusterServers();
    expect(thermostat).toBeDefined();
    expect(thermostat.id).toBe('Thermostat');
    expect(thermostat.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat']);
  });

  test('create a valve device', async () => {
    valve = new MatterbridgeEndpoint(waterValve, { uniqueStorageKey: 'WaterValve' });
    valve.addRequiredClusterServers();
    expect(valve).toBeDefined();
    expect(valve.id).toBe('WaterValve');
    expect(valve.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'valveConfigurationAndControl']);
  });

  test('create a mode device', async () => {
    mode = new MatterbridgeEndpoint(modeSelect, { uniqueStorageKey: 'ModeSelect' });
    mode.createDefaultModeSelectClusterServer('Night mode', [
      { label: 'Led ON', mode: 0, semanticTags: [] },
      { label: 'Led OFF', mode: 1, semanticTags: [] },
    ]);
    expect(mode).toBeDefined();
    expect(mode.id).toBe('ModeSelect');
    expect(mode.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'modeSelect']);
  });

  test('create a smoke device', async () => {
    smoke = new MatterbridgeEndpoint(smokeCoAlarm, { uniqueStorageKey: 'SmokeSensor' });
    smoke.addRequiredClusterServers();
    expect(smoke).toBeDefined();
    expect(smoke.id).toBe('SmokeSensor');
    expect(smoke.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'smokeCoAlarm']);
  });

  test('create a water leak device', async () => {
    leak = new MatterbridgeEndpoint(waterLeakDetector, { uniqueStorageKey: 'LeakSensor' });
    leak.createDefaultBooleanStateConfigurationClusterServer();
    leak.addRequiredClusterServers();
    expect(leak).toBeDefined();
    expect(leak.id).toBe('LeakSensor');
    expect(leak.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'booleanStateConfiguration', 'identify', 'booleanState']);
  });

  test('create a laundry device', async () => {
    laundry = new MatterbridgeEndpoint(laundryWasher, { uniqueStorageKey: 'Laundry' });
    laundry.addRequiredClusterServers();
    expect(laundry).toBeDefined();
    expect(laundry.id).toBe('Laundry');
    expect(laundry.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'operationalState']);
  });

  test('create a waterHeater device', async () => {
    heater = new MatterbridgeEndpoint(waterHeater, { uniqueStorageKey: 'WaterHeater' });
    heater.createDefaultIdentifyClusterServer();
    heater.createDefaultHeatingThermostatClusterServer();
    // heater.addRequiredClusterServers(); // Wait for the PR 304 to finish with the cluster helpers
    expect(heater).toBeDefined();
    expect(heater.id).toBe('WaterHeater');
    expect(heater.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'thermostat']);
  });

  test('add BasicInformationCluster to onOffLight', async () => {
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

  test('add BridgedDeviceBasicInformationCluster to onOffLight', async () => {
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

  test('add required clusters to onOffLight', async () => {
    expect(light).toBeDefined();
    light.createDefaultOnOffClusterServer(true, false, 10, 14);
    light.addRequiredClusterServers();
    expect(light.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'identify', 'groups', 'levelControl', 'colorControl']);
    expect(light.behaviors.supported.descriptor).toBeDefined();
    expect(light.behaviors.has(DescriptorBehavior)).toBeTruthy();
    expect(light.behaviors.has(DescriptorServer)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorBehavior)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorServer)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor.Cluster)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorCluster.id)).toBeTruthy();
    expect(light.hasClusterServer(Descriptor.Cluster.id)).toBeTruthy();
    expect(light.hasClusterServer(DescriptorCluster.name)).toBeTruthy();
    expect(light.hasClusterServer('Descriptor')).toBeTruthy();
    expect(light.hasClusterServer('descriptor')).toBeTruthy();
    // consoleWarnSpy?.mockRestore();
    console.warn(light.behaviors.optionsFor(DescriptorBehavior));

    expect(light.behaviors.supported['identify']).toBeDefined();
    expect(light.behaviors.has(IdentifyBehavior)).toBeTruthy();
    expect(light.behaviors.has(IdentifyServer)).toBeTruthy();
    expect(light.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(light.hasClusterServer(IdentifyCluster.id)).toBeTruthy();
    expect(light.hasClusterServer(IdentifyCluster.name)).toBeTruthy();

    expect(light.behaviors.supported['groups']).toBeDefined();
    expect(light.behaviors.has(GroupsBehavior)).toBeTruthy();
    expect(light.behaviors.has(GroupsServer)).toBeTruthy();
    expect(light.hasClusterServer(GroupsCluster)).toBeTruthy();
    expect(light.hasClusterServer(GroupsCluster.id)).toBeTruthy();
    expect(light.hasClusterServer(GroupsCluster.name)).toBeTruthy();

    expect(light.behaviors.supported['scenesManagement']).not.toBeDefined();
    expect(light.behaviors.has(ScenesManagementBehavior)).toBeFalsy();
    expect(light.behaviors.has(ScenesManagementServer)).toBeFalsy();
    expect(light.hasClusterServer(ScenesManagementCluster)).toBeFalsy();
    expect(light.hasClusterServer(ScenesManagementCluster.id)).toBeFalsy();
    expect(light.hasClusterServer(ScenesManagementCluster.name)).toBeFalsy();

    expect(light.behaviors.supported['onOff']).toBeDefined();
    expect(light.behaviors.has(OnOffBehavior)).toBeTruthy();
    expect(light.behaviors.has(OnOffServer)).toBeTruthy();
    expect(light.hasClusterServer(OnOffCluster)).toBeTruthy();
    expect(light.hasClusterServer(OnOffCluster.id)).toBeTruthy();
    expect(light.hasClusterServer(OnOffCluster.name)).toBeTruthy();
  });

  test('add onOffLight device to serverNode', async () => {
    expect(await server.add(light)).toBeDefined();
    expect(light.hasClusterServer(DescriptorCluster)).toBe(true);
    expect(light.hasClusterServer(IdentifyCluster)).toBe(true);
    expect(light.hasClusterServer(GroupsCluster)).toBe(true);
    expect(light.hasClusterServer(ScenesManagementCluster)).toBe(false);
    expect(light.hasClusterServer(OnOffCluster)).toBe(true);
  });

  test('add required clusters to enhanced onOffLight', async () => {
    expect(enhancedLight).toBeDefined();
    enhancedLight.createDefaultOnOffClusterServer(true, false, 10, 14);
    enhancedLight.createEnhancedColorControlClusterServer();
    enhancedLight.addRequiredClusterServers();
    expect(enhancedLight.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'onOff', 'colorControl', 'identify', 'groups', 'levelControl']);
    expect(enhancedLight.behaviors.supported.descriptor).toBeDefined();
    expect(enhancedLight.behaviors.has(DescriptorBehavior)).toBeTruthy();
    expect(enhancedLight.behaviors.has(DescriptorServer)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(DescriptorBehavior)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(DescriptorServer)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(DescriptorCluster)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(Descriptor.Cluster)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(DescriptorCluster.id)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(Descriptor.Cluster.id)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(DescriptorCluster.name)).toBeTruthy();
    expect(enhancedLight.hasClusterServer('Descriptor')).toBeTruthy();
    expect(enhancedLight.hasClusterServer('descriptor')).toBeTruthy();

    expect(enhancedLight.behaviors.supported['identify']).toBeDefined();
    expect(enhancedLight.behaviors.has(IdentifyBehavior)).toBeTruthy();
    expect(enhancedLight.behaviors.has(IdentifyServer)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(IdentifyCluster)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(IdentifyCluster.id)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(IdentifyCluster.name)).toBeTruthy();

    expect(enhancedLight.behaviors.supported['groups']).toBeDefined();
    expect(enhancedLight.behaviors.has(GroupsBehavior)).toBeTruthy();
    expect(enhancedLight.behaviors.has(GroupsServer)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(GroupsCluster)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(GroupsCluster.id)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(GroupsCluster.name)).toBeTruthy();

    expect(enhancedLight.behaviors.supported['scenesManagement']).not.toBeDefined();
    expect(enhancedLight.behaviors.has(ScenesManagementBehavior)).toBeFalsy();
    expect(enhancedLight.behaviors.has(ScenesManagementServer)).toBeFalsy();
    expect(enhancedLight.hasClusterServer(ScenesManagementCluster)).toBeFalsy();
    expect(enhancedLight.hasClusterServer(ScenesManagementCluster.id)).toBeFalsy();
    expect(enhancedLight.hasClusterServer(ScenesManagementCluster.name)).toBeFalsy();

    expect(enhancedLight.behaviors.supported['onOff']).toBeDefined();
    expect(enhancedLight.behaviors.has(OnOffBehavior)).toBeTruthy();
    expect(enhancedLight.behaviors.has(OnOffServer)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(OnOffCluster)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(OnOffCluster.id)).toBeTruthy();
    expect(enhancedLight.hasClusterServer(OnOffCluster.name)).toBeTruthy();
  });

  test('add enhanced onOffLight device to serverNode', async () => {
    expect(await server.add(enhancedLight)).toBeDefined();
    expect(enhancedLight.hasClusterServer(DescriptorCluster)).toBe(true);
    expect(enhancedLight.hasClusterServer(IdentifyCluster)).toBe(true);
    expect(enhancedLight.hasClusterServer(GroupsCluster)).toBe(true);
    expect(enhancedLight.hasClusterServer(ScenesManagementCluster)).toBe(false);
    expect(enhancedLight.hasClusterServer(OnOffCluster)).toBe(true);
    expect(enhancedLight.hasClusterServer(LevelControlCluster)).toBe(true);
    expect(enhancedLight.hasClusterServer(ColorControlCluster)).toBe(true);
  });

  test('add lift coverDevice device to serverNode', async () => {
    expect(await server.add(coverLift)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(coverLift);
  });

  test('add tilt coverDevice device to serverNode', async () => {
    expect(await server.add(coverLiftTilt)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(coverLiftTilt);
  });

  test('add lockDevice device to serverNode', async () => {
    expect(await server.add(lock)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(lock);
  });

  test('add fan device to serverNode', async () => {
    expect(await server.add(fan)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(fan);
  });

  test('add thermostat device to serverNode', async () => {
    expect(await server.add(thermostat)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(thermostat);
  });

  test('add valve device to serverNode', async () => {
    expect(await server.add(valve)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(valve);
  });

  test('add mode device to serverNode', async () => {
    expect(await server.add(mode)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(mode);
  });

  test('add smoke device to serverNode', async () => {
    expect(await server.add(smoke)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(smoke);
  });

  test('add leak device to serverNode', async () => {
    expect(await server.add(leak)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(leak);
  });

  test('add laundry device to serverNode', async () => {
    expect(await server.add(laundry)).toBeDefined();
    (matterbridge as any).frontend.getClusterTextFromDevice(laundry);
  });

  test('getClusterId and getAttributeId of onOffLight device behaviors', async () => {
    expect(light).toBeDefined();
    expect(getClusterId(light, 'onOff')).toBe(0x6);
    expect(getClusterId(light, 'OnOff')).toBe(0x6);

    expect(getClusterId(light, 'levelControl')).toBe(0x8);
    expect(getClusterId(light, 'LevelControl')).toBe(0x8);

    expect(getAttributeId(light, 'onOff', 'OnOff')).toBe(0);
    expect(getAttributeId(light, 'OnOff', 'OnOff')).toBe(0);
    expect(getAttributeId(light, 'onOff', 'onOff')).toBe(0);
    expect(getAttributeId(light, 'OnOff', 'onOff')).toBe(0);

    expect(getAttributeId(light, 'onOff', 'OnTime')).toBe(0x4001);
    expect(getAttributeId(light, 'OnOff', 'OnTime')).toBe(0x4001);
    expect(getAttributeId(light, 'onOff', 'onTime')).toBe(0x4001);
    expect(getAttributeId(light, 'OnOff', 'onTime')).toBe(0x4001);
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
        { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
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
        expect(newState).toEqual({ 'occupied': true });
        expect(oldState).toBeDefined();
        expect(oldState).toEqual({ 'occupied': false });
        expect(context).toBeDefined();
        expect(context.offline).toBe(true);
        if (newState.occupied && !oldState.occupied && context.offline) {
          resolve();
        }
      });
      endpoint.setStateOf(OccupancySensingServer, { occupancy: { occupied: true } });
    });
  });

  test('add deviceType to onOffPlugin with tagList', async () => {
    const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared)), {
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
          { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
          { deviceType: occupancySensor.code, revision: occupancySensor.revision },
        ],
      },
    });
    expect(endpoint).toBeDefined();
    expect(() =>
      endpoint.behaviors.require(DescriptorServer.with(Descriptor.Feature.TagList), {
        tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
        deviceTypeList: [
          { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
          { deviceType: occupancySensor.code, revision: occupancySensor.revision },
        ],
      }),
    ).not.toThrow();
    await expect(server.add(endpoint)).resolves.toBeDefined();
  });

  test('add deviceType to onOffPlugin in the costructor', async () => {
    const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer.with(OccupancySensing.Feature.PassiveInfrared), IlluminanceMeasurementServer), {
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
          { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
          { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          { deviceType: lightSensor.code, revision: lightSensor.revision },
        ],
      },
    });
    expect(endpoint).toBeDefined();
    await expect(server.add(endpoint)).resolves.toBeDefined();
    const deviceTypeList = endpoint.state.descriptor.deviceTypeList;
    expect(deviceTypeList).toHaveLength(3);
    expect(deviceTypeList[0].deviceType).toBe(onOffOutlet.code);
    expect(deviceTypeList[0].revision).toBe(onOffOutlet.revision);
    expect(deviceTypeList[1].deviceType).toBe(occupancySensor.code);
    expect(deviceTypeList[1].revision).toBe(occupancySensor.revision);
    expect(deviceTypeList[2].deviceType).toBe(lightSensor.code);
    expect(deviceTypeList[2].revision).toBe(lightSensor.revision);
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
  });

  test('create an Rvc device', async () => {
    rvc = new RoboticVacuumCleaner('Robot Vacuum Cleaner', '0xABC123456789');
    expect(rvc).toBeDefined();
    expect(rvc.id).toBe('RobotVacuumCleaner-0xABC123456789');
    expect(rvc.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(rvc.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(rvc.hasClusterServer(RvcRunMode.Cluster.id)).toBeTruthy();
    expect(rvc.hasClusterServer(RvcCleanMode.Cluster.id)).toBeTruthy();
    expect(rvc.hasClusterServer(RvcOperationalState.Cluster.id)).toBeTruthy();
    expect(rvc.hasClusterServer(ServiceArea.Cluster.id)).toBeTruthy();
  });

  test('add the Rvc device', async () => {
    expect(await server.add(rvc)).toBeDefined();
    expect(rvc.lifecycle.isReady).toBe(true);
    (matterbridge as any).frontend.getClusterTextFromDevice(rvc);
  });

  test('create a Water Heater device', async () => {
    heater = new WaterHeater('Water Heater', '0xABC123456789');
    expect(heater).toBeDefined();
    expect(heater.id).toBe('WaterHeater-0xABC123456789');
    expect(heater.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(heater.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(heater.hasClusterServer(WaterHeaterManagement.Cluster.id)).toBeTruthy();
    expect(heater.hasClusterServer(WaterHeaterMode.Cluster.id)).toBeTruthy();
  });

  test('add the Water Heater device', async () => {
    expect(await server.add(heater)).toBeDefined();
    expect(heater.lifecycle.isReady).toBe(true);
    (matterbridge as any).frontend.getClusterTextFromDevice(heater);
  });

  test('create an Evse device', async () => {
    evse = new Evse('Evse', '0xABC123456789');
    evse.createDefaultDeviceEnergyManagementModeClusterServer();
    expect(evse).toBeDefined();
    expect(evse.id).toBe('Evse-0xABC123456789');
    expect(evse.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(evse.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(evse.hasClusterServer(ElectricalEnergyMeasurement.Cluster.id)).toBeTruthy();
    expect(evse.hasClusterServer(ElectricalPowerMeasurement.Cluster.id)).toBeTruthy();
    expect(evse.hasClusterServer(DeviceEnergyManagement.Cluster.id)).toBeTruthy();
    expect(evse.hasClusterServer(DeviceEnergyManagementMode.Cluster.id)).toBeTruthy();
    expect(evse.hasClusterServer(EnergyEvseServer)).toBeTruthy();
    expect(evse.hasClusterServer(EnergyEvseModeServer)).toBeTruthy();
  });

  test('add the Evse device', async () => {
    expect(await server.add(evse)).toBeDefined();
    expect(evse.lifecycle.isReady).toBe(true);
    (matterbridge as any).frontend.getClusterTextFromDevice(evse);
  });

  test('start server node', async () => {
    expect(server).toBeDefined();
    await (matterbridge as any).startServerNode(server);
    expect(server.lifecycle.isOnline).toBe(true);
    expect(server.lifecycle.isCommissioned).toBe(false);
  });

  test('get MatterbridgeServer', async () => {
    expect(light.stateOf(MatterbridgeServer)).toBeDefined();
    expect(light.stateOf(MatterbridgeServer).log).toBeDefined();
    expect(light.stateOf(MatterbridgeServer).log).toBeInstanceOf(AnsiLogger);
    expect(light.stateOf(MatterbridgeServer).commandHandler).toBeDefined();
    expect(light.stateOf(MatterbridgeServer).commandHandler).toBeInstanceOf(NamedHandler);
  });

  test('invoke MatterbridgeIdentifyServer commands', async () => {
    expect(light.behaviors.has(IdentifyServer)).toBeTruthy();
    expect(light.behaviors.has(MatterbridgeIdentifyServer)).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeIdentifyServer).commands.has('identify')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeIdentifyServer).commands.has('triggerEffect')).toBeTruthy();
    expect((light.stateOf(IdentifyServer) as any).acceptedCommandList).toEqual([0, 64]);
    expect((light.stateOf(IdentifyServer) as any).generatedCommandList).toEqual([]);

    let called = false;
    light.addCommandHandler('identify', async ({ request, attributes, endpoint }) => {
      expect(request).toBeDefined();
      expect(request.identifyTime).toBeDefined();
      expect(request.identifyTime).toBe(5);
      expect(attributes).toBeDefined();
      expect(attributes.identifyTime).toBe(0);
      expect(attributes.identifyType).toBe(Identify.IdentifyType.None);
      expect(endpoint).toBeDefined();
      expect(endpoint).toBe(light);
      expect(endpoint.id).toBe(light.id);
      called = true;
    });

    await invokeBehaviorCommand(light, 'identify', 'identify', { identifyTime: 5 });
    await invokeBehaviorCommand(light, 'identify', 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Okay, effectVariant: Identify.EffectVariant.Default });
    expect(called).toBeTruthy();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Identifying device for 5 seconds (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Triggering effect ${Identify.EffectIdentifier.Okay} variant ${Identify.EffectVariant.Default} (endpoint ${light.id}.${light.number})`);
  });

  test('invoke MatterbridgeOnOffServer commands', async () => {
    expect(light.behaviors.has(OnOffServer)).toBeTruthy();
    expect(light.behaviors.has(MatterbridgeOnOffServer)).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeOnOffServer).commands.has('on')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeOnOffServer).commands.has('off')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeOnOffServer).commands.has('toggle')).toBeTruthy();
    expect((light.stateOf(MatterbridgeOnOffServer) as any).acceptedCommandList).toEqual([0, 64, 65, 66, 1, 2]);
    expect((light.stateOf(MatterbridgeOnOffServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(light, 'onOff', 'on');
    await invokeBehaviorCommand(light, 'onOff', 'off');
    await invokeBehaviorCommand(light, 'onOff', 'toggle');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Switching device on (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Switching device off (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Toggle device on/off (endpoint ${light.id}.${light.number})`);
  });

  test('invoke MatterbridgeLevelControlServer commands', async () => {
    expect(light.behaviors.has(LevelControlServer)).toBeTruthy();
    expect(light.behaviors.has(MatterbridgeLevelControlServer)).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeLevelControlServer).commands.has('moveToLevel')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeLevelControlServer).commands.has('moveToLevelWithOnOff')).toBeTruthy();
    expect((light.stateOf(MatterbridgeLevelControlServer) as any).acceptedCommandList).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect((light.stateOf(MatterbridgeLevelControlServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(light, 'levelControl', 'moveToLevel', { level: 100, transitionTime: 5, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(light, 'levelControl', 'moveToLevelWithOnOff', { level: 100, transitionTime: 5, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting level to 100 with transitionTime 5 (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting level to 100 with transitionTime 5 (endpoint ${light.id}.${light.number})`);
  });

  test('invoke MatterbridgeColorControlServer commands', async () => {
    expect(light.behaviors.has(ColorControlServer)).toBeTruthy();
    expect(light.behaviors.has(MatterbridgeColorControlServer)).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeColorControlServer).commands.has('moveToHue')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeColorControlServer).commands.has('moveToSaturation')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeColorControlServer).commands.has('moveToHueAndSaturation')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeColorControlServer).commands.has('moveToColor')).toBeTruthy();
    expect(light.behaviors.elementsOf(MatterbridgeColorControlServer).commands.has('moveToColorTemperature')).toBeTruthy();
    expect((light.stateOf(MatterbridgeColorControlServer) as any).acceptedCommandList).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 75, 76, 71]);
    expect((light.stateOf(MatterbridgeColorControlServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(light, 'colorControl', 'moveToHue', { hue: 180, direction: ColorControl.Direction.Shortest, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(light, 'colorControl', 'moveToSaturation', { saturation: 100, direction: ColorControl.Direction.Shortest, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(light, 'colorControl', 'moveToHueAndSaturation', { hue: 180, saturation: 100, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(light, 'colorControl', 'moveToColor', { colorX: 30000, colorY: 30000, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(light, 'colorControl', 'moveToColorTemperature', { colorTemperatureMireds: 250, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting hue to 180 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting saturation to 100 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting hue to 180 and saturation to 100 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting color to 30000, 30000 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting color temperature to 250 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
  });

  test('invoke MatterbridgeEnhancedColorControlServer commands', async () => {
    expect(enhancedLight.behaviors.has(ColorControlServer)).toBeTruthy();
    expect(enhancedLight.behaviors.has(MatterbridgeEnhancedColorControlServer)).toBeTruthy();
    expect(enhancedLight.behaviors.elementsOf(MatterbridgeEnhancedColorControlServer).commands.has('moveToHue')).toBeTruthy();
    expect(enhancedLight.behaviors.elementsOf(MatterbridgeEnhancedColorControlServer).commands.has('moveToSaturation')).toBeTruthy();
    expect(enhancedLight.behaviors.elementsOf(MatterbridgeEnhancedColorControlServer).commands.has('moveToHueAndSaturation')).toBeTruthy();
    expect(enhancedLight.behaviors.elementsOf(MatterbridgeEnhancedColorControlServer).commands.has('moveToColor')).toBeTruthy();
    expect(enhancedLight.behaviors.elementsOf(MatterbridgeEnhancedColorControlServer).commands.has('moveToColorTemperature')).toBeTruthy();
    expect((enhancedLight.stateOf(MatterbridgeEnhancedColorControlServer) as any).acceptedCommandList).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 75, 76, 64, 65, 66, 67, 71]);
    expect((enhancedLight.stateOf(MatterbridgeEnhancedColorControlServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'moveToHue', { hue: 180, direction: ColorControl.Direction.Shortest, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'enhancedMoveToHue', {
      enhancedHue: 32000,
      direction: ColorControl.Direction.Shortest,
      transitionTime: 0,
      optionsMask: { executeIfOff: false },
      optionsOverride: { executeIfOff: false },
    });
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'moveToSaturation', { saturation: 100, direction: ColorControl.Direction.Shortest, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'moveToHueAndSaturation', { hue: 180, saturation: 100, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'enhancedMoveToHueAndSaturation', { enhancedHue: 32000, saturation: 100, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'moveToColor', { colorX: 30000, colorY: 30000, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    await invokeBehaviorCommand(enhancedLight, 'colorControl', 'moveToColorTemperature', { colorTemperatureMireds: 250, transitionTime: 0, optionsMask: { executeIfOff: false }, optionsOverride: { executeIfOff: false } });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting hue to 180 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting enhanced hue to 32000 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting saturation to 100 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting hue to 180 and saturation to 100 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting enhanced hue to 32000 and saturation to 100 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting color to 30000, 30000 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting color temperature to 250 with transitionTime 0 (endpoint ${enhancedLight.id}.${enhancedLight.number})`);
  });

  test('invoke MatterbridgeLiftWindowCoveringServer commands', async () => {
    expect(coverLift.behaviors.has(WindowCoveringServer)).toBeTruthy();
    expect(coverLift.behaviors.has(MatterbridgeLiftWindowCoveringServer)).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(MatterbridgeLiftWindowCoveringServer).commands.has('upOrOpen')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(MatterbridgeLiftWindowCoveringServer).commands.has('downOrClose')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(MatterbridgeLiftWindowCoveringServer).commands.has('stopMotion')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(MatterbridgeLiftWindowCoveringServer).commands.has('goToLiftPercentage')).toBeTruthy();
    expect(coverLift.behaviors.elementsOf(MatterbridgeLiftWindowCoveringServer).commands.has('goToTiltPercentage')).toBeFalsy();
    expect((coverLift.stateOf(MatterbridgeLiftWindowCoveringServer) as any).acceptedCommandList).toEqual([0, 1, 2, 5]);
    expect((coverLift.stateOf(MatterbridgeLiftWindowCoveringServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(coverLift, 'windowCovering', 'upOrOpen');
    await invokeBehaviorCommand(coverLift, 'windowCovering', 'downOrClose');
    await invokeBehaviorCommand(coverLift, 'windowCovering', 'stopMotion');
    await invokeBehaviorCommand(coverLift, 'windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening cover (endpoint ${coverLift.id}.${coverLift.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing cover (endpoint ${coverLift.id}.${coverLift.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopping cover (endpoint ${coverLift.id}.${coverLift.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting cover lift percentage to 5000 (endpoint ${coverLift.id}.${coverLift.number})`);
  });

  test('invoke MatterbridgeLiftTiltWindowCoveringServer commands', async () => {
    expect(coverLiftTilt.behaviors.has(WindowCoveringServer)).toBeTruthy();
    expect(coverLiftTilt.behaviors.has(MatterbridgeLiftTiltWindowCoveringServer)).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(MatterbridgeLiftTiltWindowCoveringServer).commands.has('upOrOpen')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(MatterbridgeLiftTiltWindowCoveringServer).commands.has('downOrClose')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(MatterbridgeLiftTiltWindowCoveringServer).commands.has('stopMotion')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(MatterbridgeLiftTiltWindowCoveringServer).commands.has('goToLiftPercentage')).toBeTruthy();
    expect(coverLiftTilt.behaviors.elementsOf(MatterbridgeLiftTiltWindowCoveringServer).commands.has('goToTiltPercentage')).toBeTruthy();
    expect((coverLiftTilt.stateOf(MatterbridgeLiftTiltWindowCoveringServer) as any).acceptedCommandList).toEqual([0, 1, 2, 5, 8]);
    expect((coverLiftTilt.stateOf(MatterbridgeLiftTiltWindowCoveringServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(coverLiftTilt, 'windowCovering', 'upOrOpen');
    await invokeBehaviorCommand(coverLiftTilt, 'windowCovering', 'downOrClose');
    await invokeBehaviorCommand(coverLiftTilt, 'windowCovering', 'stopMotion');
    await invokeBehaviorCommand(coverLiftTilt, 'windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
    await invokeBehaviorCommand(coverLiftTilt, 'windowCovering', 'goToTiltPercentage', { tiltPercent100thsValue: 5000 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening cover (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing cover (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopping cover (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting cover lift percentage to 5000 (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting cover tilt percentage to 5000 (endpoint ${coverLiftTilt.id}.${coverLiftTilt.number})`);
  });

  test('invoke MatterbridgeDoorLockServer commands', async () => {
    expect(lock.behaviors.has(DoorLockServer)).toBeTruthy();
    expect(lock.behaviors.has(MatterbridgeDoorLockServer)).toBeTruthy();
    expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer).commands.has('lockDoor')).toBeTruthy();
    expect(lock.behaviors.elementsOf(MatterbridgeDoorLockServer).commands.has('unlockDoor')).toBeTruthy();
    expect((lock.stateOf(MatterbridgeDoorLockServer) as any).acceptedCommandList).toEqual([0, 1]);
    expect((lock.stateOf(MatterbridgeDoorLockServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(lock, 'doorLock', 'lockDoor');
    await invokeBehaviorCommand(lock, 'doorLock', 'unlockDoor');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Locking door (endpoint ${lock.id}.${lock.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Unlocking door (endpoint ${lock.id}.${lock.number})`);
  });

  test('invoke MatterbridgeModeSelectServer commands', async () => {
    expect(mode.behaviors.has(ModeSelectServer)).toBeTruthy();
    expect(mode.behaviors.has(MatterbridgeModeSelectServer)).toBeTruthy();
    expect(mode.behaviors.elementsOf(MatterbridgeModeSelectServer).commands.has('changeToMode')).toBeTruthy();
    expect((mode.stateOf(MatterbridgeModeSelectServer) as any).acceptedCommandList).toEqual([0]);
    expect((mode.stateOf(MatterbridgeModeSelectServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(mode, 'modeSelect', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${mode.id}.${mode.number})`);
  });

  test('invoke MatterbridgeFanControlServer commands', async () => {
    expect(fan.behaviors.has(FanControlServer)).toBeTruthy();
    expect(fan.behaviors.has(MatterbridgeFanControlServer)).toBeTruthy();
    expect(fan.behaviors.elementsOf(MatterbridgeFanControlServer).commands.has('step')).toBeTruthy();
    expect((fan.stateOf(MatterbridgeFanControlServer) as any).acceptedCommandList).toEqual([0]);
    expect((fan.stateOf(MatterbridgeFanControlServer) as any).generatedCommandList).toEqual([]);
    await fan.setStateOf(FanControlServer, { percentCurrent: 100 });
    await invokeBehaviorCommand(fan, 'fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false });
    await invokeBehaviorCommand(fan, 'fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: false });
    await invokeBehaviorCommand(fan, 'fanControl', 'step', { direction: FanControl.StepDirection.Increase, wrap: true, lowestOff: true });
    await invokeBehaviorCommand(fan, 'fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: false, lowestOff: false });
    await fan.setStateOf(FanControlServer, { percentCurrent: 10 });
    await invokeBehaviorCommand(fan, 'fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: false });
    await fan.setStateOf(FanControlServer, { percentCurrent: 0 });
    await invokeBehaviorCommand(fan, 'fanControl', 'step', { direction: FanControl.StepDirection.Decrease, wrap: true, lowestOff: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stepping fan with direction ${FanControl.StepDirection.Increase} (endpoint ${fan.id}.${fan.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(fan, 'HepaFilterMonitoring', 'resetCondition', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting condition (endpoint ${fan.id}.${fan.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(fan, 'ActivatedCarbonFilterMonitoring', 'resetCondition', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resetting condition (endpoint ${fan.id}.${fan.number})`);
  });

  test('invoke MatterbridgeThermostatServer commands', async () => {
    expect(thermostat.behaviors.has(ThermostatServer)).toBeTruthy();
    expect(thermostat.behaviors.has(MatterbridgeThermostatServer)).toBeTruthy();
    expect(thermostat.behaviors.elementsOf(MatterbridgeThermostatServer).commands.has('setpointRaiseLower')).toBeTruthy();
    expect((thermostat.stateOf(MatterbridgeThermostatServer) as any).acceptedCommandList).toEqual([0]);
    expect((thermostat.stateOf(MatterbridgeThermostatServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(thermostat, 'thermostat', 'setpointRaiseLower', { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting setpoint by 5 in mode ${Thermostat.SetpointRaiseLowerMode.Both} (endpoint ${thermostat.id}.${thermostat.number})`);
  });

  test('invoke MatterbridgeValveConfigurationAndControlServer commands', async () => {
    expect(valve.behaviors.has(ValveConfigurationAndControlServer)).toBeTruthy();
    expect(valve.behaviors.has(MatterbridgeValveConfigurationAndControlServer)).toBeTruthy();
    expect(valve.behaviors.elementsOf(MatterbridgeValveConfigurationAndControlServer).commands.has('open')).toBeTruthy();
    expect(valve.behaviors.elementsOf(MatterbridgeValveConfigurationAndControlServer).commands.has('close')).toBeTruthy();
    expect((valve.stateOf(MatterbridgeValveConfigurationAndControlServer) as any).acceptedCommandList).toEqual([0, 1]);
    expect((valve.stateOf(MatterbridgeValveConfigurationAndControlServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'open', { openDuration: null, targetLevel: 50 });
    await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'open', { openDuration: 60, targetLevel: 50 });
    await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'open', { openDuration: null });
    await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'open', { openDuration: 60 });
    await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'close');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening valve to 50% until closed (endpoint ${valve.id}.${valve.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening valve to 50% for 60s (endpoint ${valve.id}.${valve.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening valve to fully opened until closed (endpoint ${valve.id}.${valve.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening valve to fully opened for 60s (endpoint ${valve.id}.${valve.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing valve (endpoint ${valve.id}.${valve.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`MatterbridgeValveConfigurationAndControlServer: open called`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeValveConfigurationAndControlServer: close called`);
  });

  test('invoke MatterbridgeSmokeCoAlarmServer commands', async () => {
    expect(smoke.behaviors.has(SmokeCoAlarmServer)).toBeTruthy();
    expect(smoke.behaviors.has(MatterbridgeSmokeCoAlarmServer)).toBeTruthy();
    expect(smoke.behaviors.elementsOf(MatterbridgeSmokeCoAlarmServer).commands.has('selfTestRequest')).toBeTruthy();
    expect((smoke.stateOf(MatterbridgeSmokeCoAlarmServer) as any).acceptedCommandList).toEqual([0]);
    expect((smoke.stateOf(MatterbridgeSmokeCoAlarmServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(smoke, 'smokeCoAlarm', 'selfTestRequest');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Testing SmokeCOAlarm (endpoint ${smoke.id}.${smoke.number})`);
  });

  test('invoke MatterbridgeBooleanStateConfigurationServer commands', async () => {
    expect(leak.behaviors.has(BooleanStateConfigurationServer)).toBeTruthy();
    expect(leak.behaviors.has(MatterbridgeBooleanStateConfigurationServer)).toBeTruthy();
    expect(leak.behaviors.elementsOf(MatterbridgeBooleanStateConfigurationServer).commands.has('enableDisableAlarm')).toBeTruthy();
    expect((leak.stateOf(MatterbridgeBooleanStateConfigurationServer) as any).acceptedCommandList).toEqual([1]);
    expect((leak.stateOf(MatterbridgeBooleanStateConfigurationServer) as any).generatedCommandList).toEqual([]);
    await invokeBehaviorCommand(leak, 'booleanStateConfiguration', 'enableDisableAlarm', { alarmsToEnableDisable: { audible: true, visual: true } });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabling/disabling alarm ${{ audible: true, visual: true }} (endpoint ${leak.id}.${leak.number})`);
  });

  test('invoke MatterbridgeOperationalStateServer commands', async () => {
    expect(laundry.behaviors.has(OperationalStateServer)).toBeTruthy();
    expect(laundry.behaviors.has(MatterbridgeOperationalStateServer)).toBeTruthy();
    expect(laundry.behaviors.elementsOf(MatterbridgeOperationalStateServer).commands.has('start')).toBeTruthy();
    expect(laundry.behaviors.elementsOf(MatterbridgeOperationalStateServer).commands.has('stop')).toBeTruthy();
    expect(laundry.behaviors.elementsOf(MatterbridgeOperationalStateServer).commands.has('pause')).toBeTruthy();
    expect(laundry.behaviors.elementsOf(MatterbridgeOperationalStateServer).commands.has('resume')).toBeTruthy();
    expect((laundry.stateOf(MatterbridgeOperationalStateServer) as any).acceptedCommandList).toEqual([0, 1, 2, 3]);
    expect((laundry.stateOf(MatterbridgeOperationalStateServer) as any).generatedCommandList).toEqual([4]);
    await invokeBehaviorCommand(laundry, 'operationalState', 'start');
    await invokeBehaviorCommand(laundry, 'operationalState', 'stop');
    await invokeBehaviorCommand(laundry, 'operationalState', 'pause');
    await invokeBehaviorCommand(laundry, 'operationalState', 'resume');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Start (endpoint ${laundry.id}.${laundry.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stop (endpoint ${laundry.id}.${laundry.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${laundry.id}.${laundry.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resume (endpoint ${laundry.id}.${laundry.number})`);
  });

  test('rvc forEachAttribute', async () => {
    let count = 0;
    // consoleWarnSpy.mockRestore();
    rvc.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      // console.warn('forEachAttribute', clusterName, clusterId, attributeName, attributeId, attributeValue);
      expect(clusterName).toBeDefined();
      expect(clusterId).toBeDefined();
      expect(attributeName).toBeDefined();
      expect(attributeId).toBeDefined();
      count++;
    });
    expect(count).toBe(74);
  });

  test('invoke MatterbridgeRvcRunModeServer commands', async () => {
    expect(rvc.behaviors.has(RvcRunModeServer)).toBeTruthy();
    expect(rvc.behaviors.has(MatterbridgeRvcRunModeServer)).toBeTruthy();
    expect(rvc.behaviors.elementsOf(RvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(rvc.behaviors.elementsOf(MatterbridgeRvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((rvc as any).state['rvcRunMode'].acceptedCommandList).toEqual([0]);
    expect((rvc as any).state['rvcRunMode'].generatedCommandList).toEqual([1]);
    expect((rvc.stateOf(MatterbridgeRvcRunModeServer) as any).acceptedCommandList).toEqual([0]);
    expect((rvc.stateOf(MatterbridgeRvcRunModeServer) as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await rvc.invokeBehaviorCommand('noCluster', 'changeToMode', { newMode: 0 }); // noCluster is invalid
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeBehaviorCommand error: command ${hk}changeToMode${er} not found on endpoint`));
    jest.clearAllMocks();
    await rvc.invokeBehaviorCommand('rvcRunMode', 'noCommand' as any, { newMode: 0 }); // noCommand is invalid
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`invokeBehaviorCommand error: command ${hk}noCommand${er} not found on agent for endpoint`));
    jest.clearAllMocks();
    await rvc.invokeBehaviorCommand('rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 1 }); // 1 has Idle
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked`);
    await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 2 }); // 2 has Cleaning
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 2 (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 3 }); // 3 has Mapping
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 3 (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode 3 => Mapping`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 4 }); // 4 has Cleaning and Max
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 4 (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
  });

  test('invoke MatterbridgeRvcCleanModeServer commands', async () => {
    expect(rvc.behaviors.has(RvcCleanModeServer)).toBeTruthy();
    expect(rvc.behaviors.has(MatterbridgeRvcCleanModeServer)).toBeTruthy();
    expect(rvc.behaviors.elementsOf(RvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(rvc.behaviors.elementsOf(MatterbridgeRvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((rvc as any).state['rvcCleanMode'].acceptedCommandList).toEqual([0]);
    expect((rvc as any).state['rvcCleanMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcCleanMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcCleanMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcCleanModeServer changeToMode called with newMode 1 => Vacuum`);
  });

  test('invoke MatterbridgeRvcOperationalStateServer commands', async () => {
    expect(rvc.behaviors.has(RvcOperationalStateServer)).toBeTruthy();
    expect(rvc.behaviors.has(MatterbridgeRvcOperationalStateServer)).toBeTruthy();
    expect(rvc.behaviors.elementsOf(RvcOperationalStateServer).commands.has('pause')).toBeTruthy();
    expect(rvc.behaviors.elementsOf(RvcOperationalStateServer).commands.has('resume')).toBeTruthy();
    expect(rvc.behaviors.elementsOf(RvcOperationalStateServer).commands.has('goHome')).toBeTruthy();
    expect((rvc.stateOf(RvcOperationalStateServer) as any).acceptedCommandList).toEqual([0, 3, 128]);
    expect((rvc.stateOf(RvcOperationalStateServer) as any).generatedCommandList).toEqual([4]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcOperationalState', 'pause');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcOperationalState', 'resume');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resume (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'rvcOperationalState', 'goHome');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `GoHome (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle`);
  });

  test('invoke MatterbridgeServiceAreaServer commands', async () => {
    expect(rvc.behaviors.has(ServiceAreaServer)).toBeTruthy();
    expect(rvc.behaviors.has(MatterbridgeRvcOperationalStateServer)).toBeTruthy();
    expect(rvc.behaviors.elementsOf(ServiceAreaServer).commands.has('selectAreas')).toBeTruthy();
    expect((rvc.stateOf(ServiceAreaServer) as any).acceptedCommandList).toEqual([0]);
    expect((rvc.stateOf(ServiceAreaServer) as any).generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'serviceArea', 'selectAreas', { newAreas: [1, 2, 3, 4] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Selecting areas 1,2,3,4 (endpoint ${rvc.id}.${rvc.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeServiceAreaServer selectAreas called with: 1, 2, 3, 4`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(rvc, 'serviceArea', 'selectAreas', { newAreas: [0, 5] });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeServiceAreaServer selectAreas called with unsupported area: 0`);
  });

  test('invoke MatterbridgeWaterHeaterManagementServer commands', async () => {
    jest.clearAllMocks();
    await invokeBehaviorCommand(heater, 'waterHeaterManagement', 'boost', { boostInfo: { duration: 60 } });
    expect(heater.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Active);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Boost (endpoint ${heater.id}.${heater.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(heater, 'waterHeaterManagement', 'cancelBoost', {});
    expect(heater.stateOf(WaterHeaterManagementServer).boostState).toBe(WaterHeaterManagement.BoostState.Inactive);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Cancel boost (endpoint ${heater.id}.${heater.number})`);
  });

  test('invoke MatterbridgeWaterHeaterModeServer commands', async () => {
    jest.clearAllMocks();
    await invokeBehaviorCommand(heater, 'waterHeaterMode', 'changeToMode', { newMode: 1 });
    expect(heater.stateOf(WaterHeaterModeServer).currentMode).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${heater.id}.${heater.number})`);

    jest.clearAllMocks();
    await invokeBehaviorCommand(heater, 'waterHeaterMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(heater.stateOf(WaterHeaterModeServer).currentMode).toBe(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeWaterHeaterModeServer changeToMode called with unsupported newMode: 0`);
  });

  test('invoke MatterbridgeDeviceEnergyManagementServer commands', async () => {
    expect(evse.behaviors.has(MatterbridgeDeviceEnergyManagementServer)).toBeTruthy();
    expect(evse.behaviors.elementsOf(MatterbridgeDeviceEnergyManagementServer).commands.has('powerAdjustRequest')).toBeTruthy();
    expect(evse.behaviors.elementsOf(MatterbridgeDeviceEnergyManagementServer).commands.has('cancelPowerAdjustRequest')).toBeTruthy();
    expect((evse as any).state['deviceEnergyManagement'].acceptedCommandList).toEqual([0, 1]);
    expect((evse as any).state['deviceEnergyManagement'].generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'deviceEnergyManagement', 'powerAdjustRequest', { power: 0, duration: 0, cause: 'Test' }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Adjusting power to 0 duration 0 cause Test (endpoint ${evse.id}.${evse.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeDeviceEnergyManagementServer powerAdjustRequest called with power 0 duration 0 cause Test`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'deviceEnergyManagement', 'cancelPowerAdjustRequest', {});
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Cancelling power adjustment (endpoint ${evse.id}.${evse.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeDeviceEnergyManagementServer cancelPowerAdjustRequest called`);
  });

  test('invoke MatterbridgeDeviceEnergyManagementModeServer commands', async () => {
    expect(evse.behaviors.has(DeviceEnergyManagementModeServer)).toBeTruthy();
    expect(evse.behaviors.has(MatterbridgeDeviceEnergyManagementModeServer)).toBeTruthy();
    expect(evse.behaviors.elementsOf(DeviceEnergyManagementModeServer).commands.has('changeToMode')).toBeTruthy();
    expect(evse.behaviors.elementsOf(MatterbridgeDeviceEnergyManagementModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((evse as any).state['deviceEnergyManagementMode'].acceptedCommandList).toEqual([0]);
    expect((evse as any).state['deviceEnergyManagementMode'].generatedCommandList).toEqual([1]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'deviceEnergyManagementMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with unsupported newMode: 0`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'deviceEnergyManagementMode', 'changeToMode', { newMode: 1 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${evse.id}.${evse.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 1 => No Energy Management (Forecast reporting only)`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'deviceEnergyManagementMode', 'changeToMode', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 2 (endpoint ${evse.id}.${evse.number})`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeDeviceEnergyManagementModeServer changeToMode called with newMode 2 => Device Energy Management`);
  });

  test('invoke MatterbridgeEnergyEvseServer commands', async () => {
    expect(evse.behaviors.has(EnergyEvseServer)).toBeTruthy();
    expect(evse.behaviors.has(MatterbridgeEnergyEvseServer)).toBeTruthy();
    expect(evse.behaviors.elementsOf(EnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(evse.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('disable')).toBeTruthy();
    expect(evse.behaviors.elementsOf(EnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect(evse.behaviors.elementsOf(MatterbridgeEnergyEvseServer).commands.has('enableCharging')).toBeTruthy();
    expect((evse as any).state['energyEvse'].acceptedCommandList).toEqual([1, 2]);
    expect((evse as any).state['energyEvse'].generatedCommandList).toEqual([]);
    expect((evse as any).stateOf(MatterbridgeEnergyEvseServer).acceptedCommandList).toEqual([1, 2]);
    expect((evse as any).stateOf(MatterbridgeEnergyEvseServer).generatedCommandList).toEqual([]);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'energyEvse', 'disable');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer disable called`);
    jest.clearAllMocks();
    await invokeBehaviorCommand(evse, 'energyEvse', 'enableCharging', { chargingEnabledUntil: null, minimumChargeCurrent: 6000, maximumChargeCurrent: 0 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `MatterbridgeEnergyEvseServer enableCharging called`);
  });

  test('ensure all endpoint number persistence is flushed before closing', async () => {
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    if (server) {
      // Ensure all endpoint number persistence is flushed before closing
      await flushAllEndpointNumberPersistence(server);
      await assertAllEndpointNumbersPersisted(server);
    }
  });

  test('close server node', async () => {
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    await server.close();
    await server.env.get(MdnsService)[Symbol.asyncDispose](); // loadInstance(false) so destroyInstance() does not stop the mDNS service
  });

  test('destroy instance', async () => {
    expect(matterbridge).toBeDefined();
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
  });
});
