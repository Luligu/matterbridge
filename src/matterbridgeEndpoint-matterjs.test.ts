// src\matterbridgeEndpoint.test.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { DeviceTypeId, VendorId, ServerNode, Endpoint, EndpointServer, StorageContext, LogFormat as Format, LogLevel as Level, ClusterId, Behavior } from '@matter/main';
import {
  ColorControl,
  Descriptor,
  DescriptorCluster,
  FanControl,
  GroupsCluster,
  Identify,
  IdentifyCluster,
  OccupancySensing,
  OnOffCluster,
  PowerSource,
  RvcCleanMode,
  RvcOperationalState,
  RvcRunMode,
  ScenesManagementCluster,
  ServiceArea,
  Thermostat,
} from '@matter/main/clusters';
import { AggregatorEndpoint } from '@matter/main/endpoints';
import { logEndpoint, MdnsService } from '@matter/main/protocol';
import { OnOffPlugInUnitDevice } from '@matter/node/devices';
import {
  BooleanStateConfigurationServer,
  ColorControlServer,
  DescriptorBehavior,
  DescriptorServer,
  DoorLockServer,
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
  WindowCoveringServer,
} from '@matter/node/behaviors';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

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
  MatterbridgeRvcCleanModeServer,
  MatterbridgeRvcOperationalStateServer,
  MatterbridgeRvcRunModeServer,
  MatterbridgeServer,
  MatterbridgeServerDevice,
  MatterbridgeSmokeCoAlarmServer,
  MatterbridgeThermostatServer,
  MatterbridgeValveConfigurationAndControlServer,
  MatterbridgeWindowCoveringServer,
} from './matterbridgeBehaviors.js';
import { Matterbridge } from './matterbridge.js';
import { lightSensor, occupancySensor, onOffOutlet, coverDevice, doorLockDevice, fanDevice, thermostatDevice, waterValve, modeSelect, smokeCoAlarm, waterLeakDetector, laundryWasher, extendedColorLight } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { getAttributeId, getBehavior, getClusterId, invokeBehaviorCommand } from './matterbridgeEndpointHelpers.js';
import { RoboticVacuumCleaner } from './roboticVacuumCleaner.js';
import { ClusterType } from '@matter/main/types';

describe('MatterbridgeEndpoint class', () => {
  let matterbridge: Matterbridge;
  let context: StorageContext;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let light: MatterbridgeEndpoint;
  let cover: MatterbridgeEndpoint;
  let lock: MatterbridgeEndpoint;
  let fan: MatterbridgeEndpoint;
  let thermostat: MatterbridgeEndpoint;
  let valve: MatterbridgeEndpoint;
  let mode: MatterbridgeEndpoint;
  let smoke: MatterbridgeEndpoint;
  let leak: MatterbridgeEndpoint;
  let laundry: MatterbridgeEndpoint;
  let rvc: RoboticVacuumCleaner;

  let matterbridgeServerDevice: MatterbridgeServerDevice;

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  beforeAll(async () => {
    // Create a MatterbridgeEdge instance
    matterbridge = await Matterbridge.loadInstance(false);
    matterbridge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    // Setup matter environment
    matterbridge.environment.vars.set('log.level', Level.INFO);
    matterbridge.environment.vars.set('log.format', Format.ANSI);
    matterbridge.environment.vars.set('path.root', 'matterstorage');
    matterbridge.environment.vars.set('runtime.signals', false);
    matterbridge.environment.vars.set('runtime.exitcode', false);
    await (matterbridge as any).startMatterStorage();
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    //
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('MatterbridgeEndpointMatter', () => {
    const deviceType = extendedColorLight;

    test('create a context for server node', async () => {
      expect(matterbridge.environment.vars.get('path.root')).toBe('matterstorage');
      context = await (matterbridge as any).createServerNodeContext('Matterbridge', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create the server node', async () => {
      server = await (matterbridge as any).createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create a onOffLight device', async () => {
      light = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }] });
      // light.addRequiredClusterServers();
      expect(light).toBeDefined();
      expect(light.id).toBe('OnOffLight');
      expect(light.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(light.type.deviceType).toBe(deviceType.code);
      expect(light.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(light.type.deviceRevision).toBe(deviceType.revision);
    });

    test('create a covert device', async () => {
      cover = new MatterbridgeEndpoint(coverDevice, { uniqueStorageKey: 'WindowCover' });
      cover.addRequiredClusterServers();
      expect(cover).toBeDefined();
      expect(cover.id).toBe('WindowCover');
    });

    test('create a lock device', async () => {
      lock = new MatterbridgeEndpoint(doorLockDevice, { uniqueStorageKey: 'DoorLock' });
      lock.addRequiredClusterServers();
      expect(lock).toBeDefined();
      expect(lock.id).toBe('DoorLock');
    });

    test('create a fan device', async () => {
      fan = new MatterbridgeEndpoint(fanDevice, { uniqueStorageKey: 'Fan' });
      fan.addRequiredClusterServers();
      expect(fan).toBeDefined();
      expect(fan.id).toBe('Fan');
    });

    test('create a thermostat device', async () => {
      thermostat = new MatterbridgeEndpoint(thermostatDevice, { uniqueStorageKey: 'Thermostat' });
      thermostat.addRequiredClusterServers();
      expect(thermostat).toBeDefined();
      expect(thermostat.id).toBe('Thermostat');
    });

    test('create a valve device', async () => {
      valve = new MatterbridgeEndpoint(waterValve, { uniqueStorageKey: 'WaterValve' });
      valve.addRequiredClusterServers();
      expect(valve).toBeDefined();
      expect(valve.id).toBe('WaterValve');
    });

    test('create a mode device', async () => {
      mode = new MatterbridgeEndpoint(modeSelect, { uniqueStorageKey: 'ModeSelect' });
      mode.createDefaultModeSelectClusterServer('Night mode', [
        { label: 'Led ON', mode: 0, semanticTags: [] },
        { label: 'Led OFF', mode: 1, semanticTags: [] },
      ]);
      expect(mode).toBeDefined();
      expect(mode.id).toBe('ModeSelect');
    });

    test('create a smoke device', async () => {
      smoke = new MatterbridgeEndpoint(smokeCoAlarm, { uniqueStorageKey: 'SmokeSensor' });
      smoke.addRequiredClusterServers();
      expect(smoke).toBeDefined();
      expect(smoke.id).toBe('SmokeSensor');
    });

    test('create a water leak device', async () => {
      leak = new MatterbridgeEndpoint(waterLeakDetector, { uniqueStorageKey: 'LeakSensor' });
      leak.createDefaultBooleanStateConfigurationClusterServer();
      leak.addRequiredClusterServers();
      expect(leak).toBeDefined();
      expect(leak.id).toBe('LeakSensor');
    });

    test('create a laundry device', async () => {
      laundry = new MatterbridgeEndpoint(laundryWasher, { uniqueStorageKey: 'Laundry' });
      laundry.addRequiredClusterServers();
      expect(laundry).toBeDefined();
      expect(laundry.id).toBe('Laundry');
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
    });

    test('add required clusters to onOffLight', async () => {
      expect(light).toBeDefined();
      light.createDefaultOnOffClusterServer(true, false, 10, 14);
      light.addRequiredClusterServers();
      expect(light.behaviors.supported.descriptor).toBeDefined();
      expect(light.behaviors.has(DescriptorBehavior)).toBeTruthy();
      expect(light.behaviors.has(DescriptorServer)).toBeTruthy();
      expect(light.hasClusterServer(DescriptorCluster)).toBeTruthy();
      expect(light.hasClusterServer(DescriptorCluster.id)).toBeTruthy();
      expect(light.hasClusterServer(DescriptorCluster.name)).toBeTruthy();
      // consoleWarnSpy?.mockRestore();
      // console.warn(device.behaviors.optionsFor(DescriptorBehavior));

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
      /*
      expect(EndpointServer.forEndpoint(light).hasClusterServer(DescriptorCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(ScenesManagementCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(OnOffCluster)).toBe(true);
      */
    });

    test('add rollerDevice device to serverNode', async () => {
      expect(await server.add(cover)).toBeDefined();
    });

    test('add lockDevice device to serverNode', async () => {
      expect(await server.add(lock)).toBeDefined();
    });

    test('add fan device to serverNode', async () => {
      expect(await server.add(fan)).toBeDefined();
    });

    test('add thermostat device to serverNode', async () => {
      expect(await server.add(thermostat)).toBeDefined();
    });

    test('add valve device to serverNode', async () => {
      expect(await server.add(valve)).toBeDefined();
    });

    test('add mode device to serverNode', async () => {
      expect(await server.add(mode)).toBeDefined();
    });

    test('add smoke device to serverNode', async () => {
      expect(await server.add(smoke)).toBeDefined();
    });

    test('add leak device to serverNode', async () => {
      expect(await server.add(leak)).toBeDefined();
    });

    test('add laundry device to serverNode', async () => {
      expect(await server.add(laundry)).toBeDefined();
    });

    test('getClusterId and getAttributeId of onOffLight device behaviors', async () => {
      expect(light).toBeDefined();
      expect(getClusterId(light, 'onOff')).toBe(6);
      expect(getClusterId(light, 'OnOff')).toBe(6);
      expect(getAttributeId(light, 'onOff', 'OnOff')).toBe(0);
      expect(getAttributeId(light, 'OnOff', 'OnOff')).toBe(0);
      expect(getAttributeId(light, 'onOff', 'onOff')).toBe(0);
      expect(getAttributeId(light, 'OnOff', 'onOff')).toBe(0);
    });

    test('add deviceType to onOffPlugin without tagList', async () => {
      const child = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer, OccupancySensingServer), {
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
        },
        descriptor: {
          deviceTypeList: [
            { deviceType: 0x10a, revision: 3 },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          ],
        },
      });
      expect(child).toBeDefined();
      child.behaviors.require(DescriptorServer, {
        deviceTypeList: [
          { deviceType: 0x10a, revision: 3 },
          { deviceType: occupancySensor.code, revision: occupancySensor.revision },
        ],
      });
      expect(await server.add(child)).toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(child));
    });

    test('add deviceType to onOffPlugin with tagList', async () => {
      const child = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer), {
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
      expect(child).toBeDefined();
      expect(() =>
        child.behaviors.require(DescriptorServer.with(Descriptor.Feature.TagList), {
          tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
          deviceTypeList: [
            { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          ],
        }),
      ).not.toThrow();
      await expect(server.add(child)).resolves.toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(child));
    });

    test('add deviceType to onOffPlugin in the costructor', async () => {
      const child = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer, IlluminanceMeasurementServer), {
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
      expect(child).toBeDefined();
      await expect(server.add(child)).resolves.toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(child));
      const deviceTypeList = child.state.descriptor.deviceTypeList;
      expect(deviceTypeList).toHaveLength(3);
      expect(deviceTypeList[0].deviceType).toBe(onOffOutlet.code);
      expect(deviceTypeList[0].revision).toBe(onOffOutlet.revision);
      expect(deviceTypeList[1].deviceType).toBe(occupancySensor.code);
      expect(deviceTypeList[1].revision).toBe(occupancySensor.revision);
      expect(deviceTypeList[2].deviceType).toBe(lightSensor.code);
      expect(deviceTypeList[2].revision).toBe(lightSensor.revision);
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
    });

    test('start server node', async () => {
      expect(server).toBeDefined();
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('log onOffLight', async () => {
      expect(light).toBeDefined();
      /*
      logEndpoint(EndpointServer.forEndpoint(light));
      expect(EndpointServer.forEndpoint(light).hasClusterServer(DescriptorCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(BasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(BridgedDeviceBasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(OnOffCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(ScenesManagementCluster)).toBe(false);
      */
    });

    test('get MatterbridgeServerDevice', async () => {
      matterbridgeServerDevice = light.stateOf(MatterbridgeServer).deviceCommand as MatterbridgeServerDevice;
      expect(matterbridgeServerDevice).toBeDefined();
      expect(matterbridgeServerDevice).toBeInstanceOf(MatterbridgeServerDevice);
      expect(matterbridgeServerDevice.log).toBeInstanceOf(AnsiLogger);
      expect(matterbridgeServerDevice.endpointId).toBeDefined();
      expect(matterbridgeServerDevice.endpointNumber).toBeDefined();
    });

    test('invoke MatterbridgeIdentifyServer commands', async () => {
      expect(light.behaviors.has(IdentifyServer)).toBeTruthy();
      expect(light.behaviors.has(MatterbridgeIdentifyServer)).toBeTruthy();
      expect(light.behaviors.elementsOf(MatterbridgeIdentifyServer).commands.has('identify')).toBeTruthy();
      expect(light.behaviors.elementsOf(MatterbridgeIdentifyServer).commands.has('triggerEffect')).toBeTruthy();
      expect((light.stateOf(IdentifyServer) as any).acceptedCommandList).toEqual([0, 64]);
      expect((light.stateOf(IdentifyServer) as any).generatedCommandList).toEqual([]);
      await invokeBehaviorCommand(light, 'identify', 'identify', { identifyTime: 5 });
      await invokeBehaviorCommand(light, 'identify', 'triggerEffect', { effectIdentifier: Identify.EffectIdentifier.Okay, effectVariant: Identify.EffectVariant.Default });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Identifying device for 5 seconds`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Triggering effect ${Identify.EffectIdentifier.Okay} variant ${Identify.EffectVariant.Default}`);
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

    test('invoke MatterbridgeWindowCoveringServer commands', async () => {
      expect(cover.behaviors.has(WindowCoveringServer)).toBeTruthy();
      expect(cover.behaviors.has(MatterbridgeWindowCoveringServer)).toBeTruthy();
      expect(cover.behaviors.elementsOf(MatterbridgeWindowCoveringServer).commands.has('upOrOpen')).toBeTruthy();
      expect(cover.behaviors.elementsOf(MatterbridgeWindowCoveringServer).commands.has('downOrClose')).toBeTruthy();
      expect(cover.behaviors.elementsOf(MatterbridgeWindowCoveringServer).commands.has('stopMotion')).toBeTruthy();
      expect(cover.behaviors.elementsOf(MatterbridgeWindowCoveringServer).commands.has('goToLiftPercentage')).toBeTruthy();
      expect((cover.stateOf(MatterbridgeWindowCoveringServer) as any).acceptedCommandList).toEqual([0, 1, 2, 5]);
      expect((cover.stateOf(MatterbridgeWindowCoveringServer) as any).generatedCommandList).toEqual([]);
      await invokeBehaviorCommand(cover, 'windowCovering', 'upOrOpen');
      await invokeBehaviorCommand(cover, 'windowCovering', 'downOrClose');
      await invokeBehaviorCommand(cover, 'windowCovering', 'stopMotion');
      await invokeBehaviorCommand(cover, 'windowCovering', 'goToLiftPercentage', { liftPercent100thsValue: 5000 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening cover (endpoint ${cover.id}.${cover.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing cover (endpoint ${cover.id}.${cover.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopping cover (endpoint ${cover.id}.${cover.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting cover lift percentage to 5000 (endpoint ${cover.id}.${cover.number})`);
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
    });

    test('invoke MatterbridgeThermostatServer commands', async () => {
      expect(thermostat.behaviors.has(ThermostatServer)).toBeTruthy();
      expect(thermostat.behaviors.has(MatterbridgeThermostatServer)).toBeTruthy();
      expect(thermostat.behaviors.elementsOf(MatterbridgeThermostatServer).commands.has('setpointRaiseLower')).toBeTruthy();
      expect((thermostat.stateOf(MatterbridgeThermostatServer) as any).acceptedCommandList).toEqual([0]);
      expect((thermostat.stateOf(MatterbridgeThermostatServer) as any).generatedCommandList).toEqual([]);
      await invokeBehaviorCommand(thermostat, 'thermostat', 'setpointRaiseLower', { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting setpoint to 5 in mode ${Thermostat.SetpointRaiseLowerMode.Both} (endpoint ${thermostat.id}.${thermostat.number})`);
    });

    test('invoke MatterbridgeValveConfigurationAndControlServer commands', async () => {
      expect(valve.behaviors.has(ValveConfigurationAndControlServer)).toBeTruthy();
      expect(valve.behaviors.has(MatterbridgeValveConfigurationAndControlServer)).toBeTruthy();
      expect(valve.behaviors.elementsOf(MatterbridgeValveConfigurationAndControlServer).commands.has('open')).toBeTruthy();
      expect(valve.behaviors.elementsOf(MatterbridgeValveConfigurationAndControlServer).commands.has('close')).toBeTruthy();
      expect((valve.stateOf(MatterbridgeValveConfigurationAndControlServer) as any).acceptedCommandList).toEqual([0, 1]);
      expect((valve.stateOf(MatterbridgeValveConfigurationAndControlServer) as any).generatedCommandList).toEqual([]);
      await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'open', { openDuration: null, targetLevel: 50 });
      await invokeBehaviorCommand(valve, 'valveConfigurationAndControl', 'close');
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening valve to 50% (endpoint ${valve.id}.${valve.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing valve (endpoint ${valve.id}.${valve.number})`);
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
      expect(count).toBe(101);
    });

    test('invoke MatterbridgeRvcRunModeServer commands', async () => {
      // consoleLogSpy?.mockRestore();
      // console.log('rvc:', rvc.state, rvc.state['rvcRunMode']);
      expect(rvc.behaviors.has(RvcRunModeServer)).toBeTruthy();
      expect(rvc.behaviors.has(MatterbridgeRvcRunModeServer)).toBeTruthy();
      expect(rvc.behaviors.elementsOf(RvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
      expect(rvc.behaviors.elementsOf(MatterbridgeRvcRunModeServer).commands.has('changeToMode')).toBeTruthy();
      expect((rvc.state['rvcRunMode'] as any).acceptedCommandList).toEqual([0]);
      expect((rvc.state['rvcRunMode'] as any).generatedCommandList).toEqual([1]);
      expect((rvc.stateOf(MatterbridgeRvcRunModeServer) as any).acceptedCommandList).toEqual([0]);
      expect((rvc.stateOf(MatterbridgeRvcRunModeServer) as any).generatedCommandList).toEqual([1]);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcRunModeServer changeToMode called with unsupported newMode: 0`);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 1 }); // 1 has Idle
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcRunModeServer changeToMode called with newMode Idle => Docked`);
      await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 2 }); // 2 has Cleaning
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 2 (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 3 }); // 3 has Mapping
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 3 (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcRunModeServer changeToMode called with newMode 3 => Mapping`);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'rvcRunMode', 'changeToMode', { newMode: 4 }); // 4 has Cleaning and Max
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 4 (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcRunModeServer changeToMode called with newMode Cleaning => Running`);
    });

    test('invoke MatterbridgeRvcCleanModeServer commands', async () => {
      // consoleLogSpy?.mockRestore();
      // console.log('rvc:', rvc.state, rvc.state['rvcCleanMode']);
      expect(rvc.behaviors.has(RvcCleanModeServer)).toBeTruthy();
      expect(rvc.behaviors.has(MatterbridgeRvcCleanModeServer)).toBeTruthy();
      expect(rvc.behaviors.elementsOf(RvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
      expect(rvc.behaviors.elementsOf(MatterbridgeRvcCleanModeServer).commands.has('changeToMode')).toBeTruthy();
      expect((rvc.state['rvcCleanMode'] as any).acceptedCommandList).toEqual([0]);
      expect((rvc.state['rvcCleanMode'] as any).generatedCommandList).toEqual([1]);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'rvcCleanMode', 'changeToMode', { newMode: 0 }); // 0 is not a valid mode
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRvcCleanModeServer changeToMode called with unsupported newMode: 0`);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'rvcCleanMode', 'changeToMode', { newMode: 1 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcCleanModeServer changeToMode called with newMode 1 => Vacuum`);
    });

    test('invoke MatterbridgeRvcOperationalStateServer commands', async () => {
      expect(rvc.behaviors.has(RvcOperationalStateServer)).toBeTruthy();
      expect(rvc.behaviors.has(MatterbridgeRvcOperationalStateServer)).toBeTruthy();
      expect(rvc.behaviors.elementsOf(RvcOperationalStateServer).commands.has('pause')).toBeTruthy();
      expect(rvc.behaviors.elementsOf(RvcOperationalStateServer).commands.has('resume')).toBeTruthy();
      expect(rvc.behaviors.elementsOf(RvcOperationalStateServer).commands.has('goHome')).toBeTruthy();
      expect((rvc.stateOf(RvcOperationalStateServer) as any).acceptedCommandList).toEqual([0, 3, 128]);
      expect((rvc.stateOf(RvcOperationalStateServer) as any).generatedCommandList).toEqual([4]);
      await invokeBehaviorCommand(rvc, 'rvcOperationalState', 'pause');
      await invokeBehaviorCommand(rvc, 'rvcOperationalState', 'resume');
      await invokeBehaviorCommand(rvc, 'rvcOperationalState', 'goHome');
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcOperationalStateServer: pause called setting operational state to Paused and currentMode to Idle`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resume (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcOperationalStateServer: resume called setting operational state to Running and currentMode to Cleaning`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `GoHome (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRvcOperationalStateServer: goHome called setting operational state to Docked and currentMode to Idle`);
    });

    test('invoke MatterbridgeServiceAreaServer commands', async () => {
      expect(rvc.behaviors.has(ServiceAreaServer)).toBeTruthy();
      expect(rvc.behaviors.has(MatterbridgeRvcOperationalStateServer)).toBeTruthy();
      expect(rvc.behaviors.elementsOf(ServiceAreaServer).commands.has('selectAreas')).toBeTruthy();
      expect((rvc.stateOf(ServiceAreaServer) as any).acceptedCommandList).toEqual([0]);
      expect((rvc.stateOf(ServiceAreaServer) as any).generatedCommandList).toEqual([1]);
      await invokeBehaviorCommand(rvc, 'serviceArea', 'selectAreas', { newAreas: [1, 2, 3, 4] });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Selecting areas 1,2,3,4 (endpoint ${rvc.id}.${rvc.number})`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeServiceAreaServer selectAreas called with: 1, 2, 3, 4`);
      jest.clearAllMocks();
      await invokeBehaviorCommand(rvc, 'serviceArea', 'selectAreas', { newAreas: [0, 5] });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeServiceAreaServer selectAreas called with unsupported area: 0`);
    });

    test('close server node', async () => {
      expect(server).toBeDefined();
      await server.close();
      await server.env.get(MdnsService)[Symbol.asyncDispose](); // loadInstance(false) so destroyInstance() does not stop the mDNS service
    });

    test('reset storage', async () => {
      expect(matterbridge.environment.vars.get('path.root')).toBe('matterstorage');
      expect(matterbridge.matterStorageManager).toBeDefined();
      expect(matterbridge.matterbridgeContext).toBeDefined();
      if (!matterbridge.matterStorageManager) throw new Error('matterStorageManager is not defined');
      if (!matterbridge.matterbridgeContext) throw new Error('matterbridgeContext is not defined');

      // Clear all storage contexts
      await matterbridge.matterStorageManager.createContext('events').clearAll();
      await matterbridge.matterStorageManager.createContext('fabrics').clearAll();
      await matterbridge.matterStorageManager.createContext('root').clearAll();
      await matterbridge.matterStorageManager.createContext('sessions').clearAll();
      await matterbridge.matterbridgeContext.clearAll();

      // Close the Matterbridge instance
      await matterbridge.destroyInstance();
    });
  });
});
