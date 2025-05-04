/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { lightSensor, occupancySensor, onOffLight, onOffOutlet, coverDevice, doorLockDevice, fanDevice, thermostatDevice, waterValve, modeSelect, smokeCoAlarm, waterLeakDetector, laundryWasher } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { getAttributeId, getBehavior, getClusterId } from './matterbridgeEndpointHelpers.js';

// @matter
import { DeviceTypeId, VendorId, ServerNode, Endpoint, EndpointServer, StorageContext } from '@matter/main';
import { LogFormat as Format, LogLevel as Level } from '@matter/main';
import {
  BasicInformationCluster,
  BridgedDeviceBasicInformationCluster,
  Descriptor,
  DescriptorCluster,
  FanControl,
  GroupsCluster,
  Identify,
  IdentifyCluster,
  OccupancySensing,
  OnOffCluster,
  ScenesManagementCluster,
  Thermostat,
} from '@matter/main/clusters';
import { AggregatorEndpoint } from '@matter/main/endpoints';
import { logEndpoint, MdnsService } from '@matter/main/protocol';
import { OnOffPlugInUnitDevice } from '@matter/node/devices';
import {
  DescriptorBehavior,
  DescriptorServer,
  GroupsBehavior,
  GroupsServer,
  IdentifyBehavior,
  IdentifyServer,
  IlluminanceMeasurementServer,
  OccupancySensingServer,
  OnOffBehavior,
  OnOffServer,
  ScenesManagementBehavior,
  ScenesManagementServer,
} from '@matter/node/behaviors';
import { wait } from './utils/wait.js';
import { MatterbridgeIdentifyServer, MatterbridgeServer, MatterbridgeServerDevice } from './matterbridgeBehaviors.js';

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
    const deviceType = onOffLight;

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
      expect(EndpointServer.forEndpoint(light).hasClusterServer(DescriptorCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(ScenesManagementCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(OnOffCluster)).toBe(true);
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

    test('start server node', async () => {
      expect(server).toBeDefined();
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('log onOffLight', async () => {
      expect(light).toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(light));
      expect(EndpointServer.forEndpoint(light).hasClusterServer(DescriptorCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(BasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(BridgedDeviceBasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(OnOffCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(light).hasClusterServer(ScenesManagementCluster)).toBe(false);
    });

    test('get MatterbridgeServerDevice', async () => {
      matterbridgeServerDevice = light.stateOf(MatterbridgeServer).deviceCommand as MatterbridgeServerDevice;
      expect(matterbridgeServerDevice).toBeDefined();
      expect(matterbridgeServerDevice).toBeInstanceOf(MatterbridgeServerDevice);

      expect(matterbridgeServerDevice.log).toBeInstanceOf(AnsiLogger);
      expect(matterbridgeServerDevice.endpointId).toBeDefined();
      expect(matterbridgeServerDevice.endpointNumber).toBeDefined();
    });

    test('invoke MatterbridgeServerDevice Identify commands', async () => {
      expect(light.behaviors.has(MatterbridgeIdentifyServer)).toBeTruthy();
      expect(light.behaviors.elementsOf(MatterbridgeIdentifyServer).commands.has('identify')).toBeTruthy();
      expect(light.behaviors.elementsOf(MatterbridgeIdentifyServer).commands.has('triggerEffect')).toBeTruthy();

      matterbridgeServerDevice.identify({ identifyTime: 5 });
      matterbridgeServerDevice.triggerEffect({ effectIdentifier: Identify.EffectIdentifier.Okay, effectVariant: Identify.EffectVariant.Default });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Identifying device for 5 seconds`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Triggering effect ${Identify.EffectIdentifier.Okay} variant ${Identify.EffectVariant.Default}`);
    });

    test('invoke MatterbridgeServerDevice OnOff commands', async () => {
      matterbridgeServerDevice.on();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Switching device on (endpoint ${light.id}.${light.number})`);
      matterbridgeServerDevice.off();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Switching device off (endpoint ${light.id}.${light.number})`);
      matterbridgeServerDevice.toggle();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Toggle device on/off (endpoint ${light.id}.${light.number})`);
    });

    test('invoke MatterbridgeServerDevice LevelControl commands', async () => {
      matterbridgeServerDevice.moveToLevel({ level: 100, transitionTime: 5, optionsMask: {}, optionsOverride: {} });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting level to 100 with transitionTime 5 (endpoint ${light.id}.${light.number})`);
      matterbridgeServerDevice.moveToLevelWithOnOff({ level: 100, transitionTime: 5, optionsMask: {}, optionsOverride: {} });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting level to 100 with transitionTime 5 (endpoint ${light.id}.${light.number})`);
    });

    test('invoke MatterbridgeServerDevice ColorControl commands', async () => {
      matterbridgeServerDevice.moveToHue({ optionsMask: {}, optionsOverride: {}, hue: 180, direction: 0, transitionTime: 0 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting hue to 180 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
      matterbridgeServerDevice.moveToSaturation({ optionsMask: {}, optionsOverride: {}, saturation: 100, transitionTime: 0 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting saturation to 100 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
      matterbridgeServerDevice.moveToHueAndSaturation({ optionsMask: {}, optionsOverride: {}, hue: 180, saturation: 100, transitionTime: 0 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting hue to 180 and saturation to 100 with transitionTime 0 (endpoint ${light.id}.${light.number})`);

      matterbridgeServerDevice.moveToColor({ optionsMask: {}, optionsOverride: {}, colorX: 0, colorY: 0, transitionTime: 0 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting color to 0, 0 with transitionTime 0 (endpoint ${light.id}.${light.number})`);

      matterbridgeServerDevice.moveToColorTemperature({ optionsMask: {}, optionsOverride: {}, colorTemperatureMireds: 0, transitionTime: 0 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting color temperature to 0 with transitionTime 0 (endpoint ${light.id}.${light.number})`);
    });

    test('invoke MatterbridgeServerDevice WindowCover commands', async () => {
      matterbridgeServerDevice.setEndpointId(cover.id);
      matterbridgeServerDevice.setEndpointNumber(cover.number);
      matterbridgeServerDevice.upOrOpen();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening cover (endpoint ${cover.id}.${cover.number})`);
      matterbridgeServerDevice.downOrClose();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing cover (endpoint ${cover.id}.${cover.number})`);
      matterbridgeServerDevice.stopMotion();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stopping cover (endpoint ${cover.id}.${cover.number})`);
      matterbridgeServerDevice.goToLiftPercentage({ liftPercent100thsValue: 5000 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting cover lift percentage to 5000 (endpoint ${cover.id}.${cover.number})`);
    });

    test('invoke MatterbridgeServerDevice Lock commands', async () => {
      matterbridgeServerDevice.setEndpointId(lock.id);
      matterbridgeServerDevice.setEndpointNumber(lock.number);
      matterbridgeServerDevice.lockDoor();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Locking door (endpoint ${lock.id}.${lock.number})`);
      matterbridgeServerDevice.unlockDoor();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Unlocking door (endpoint ${lock.id}.${lock.number})`);
    });

    test('invoke MatterbridgeServerDevice Fan commands', async () => {
      matterbridgeServerDevice.setEndpointId(fan.id);
      matterbridgeServerDevice.setEndpointNumber(fan.number);
      matterbridgeServerDevice.step({ direction: FanControl.StepDirection.Increase, wrap: false, lowestOff: false });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stepping fan with direction ${FanControl.StepDirection.Increase} (endpoint ${fan.id}.${fan.number})`);
    });

    test('invoke MatterbridgeServerDevice Thermostat commands', async () => {
      matterbridgeServerDevice.setEndpointId(thermostat.id);
      matterbridgeServerDevice.setEndpointNumber(thermostat.number);
      matterbridgeServerDevice.setpointRaiseLower({ mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 5 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Setting setpoint to 5 in mode ${Thermostat.SetpointRaiseLowerMode.Both} (endpoint ${thermostat.id}.${thermostat.number})`);
    });

    test('invoke MatterbridgeServerDevice WaterValve commands', async () => {
      matterbridgeServerDevice.setEndpointId(valve.id);
      matterbridgeServerDevice.setEndpointNumber(valve.number);
      matterbridgeServerDevice.open({ openDuration: null, targetLevel: 50 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Opening valve to 50% (endpoint ${valve.id}.${valve.number})`);
      matterbridgeServerDevice.close();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closing valve (endpoint ${valve.id}.${valve.number})`);
    });

    test('invoke MatterbridgeServerDevice ModeSelect commands', async () => {
      matterbridgeServerDevice.setEndpointId(mode.id);
      matterbridgeServerDevice.setEndpointNumber(mode.number);
      matterbridgeServerDevice.changeToMode({ newMode: 1 });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Changing mode to 1 (endpoint ${mode.id}.${mode.number})`);
    });

    test('invoke MatterbridgeServerDevice Smoke commands', async () => {
      matterbridgeServerDevice.setEndpointId(smoke.id);
      matterbridgeServerDevice.setEndpointNumber(smoke.number);
      matterbridgeServerDevice.selfTestRequest();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Testing SmokeCOAlarm (endpoint ${smoke.id}.${smoke.number})`);
    });

    test('invoke MatterbridgeServerDevice Leak commands', async () => {
      matterbridgeServerDevice.setEndpointId(leak.id);
      matterbridgeServerDevice.setEndpointNumber(leak.number);
      matterbridgeServerDevice.enableDisableAlarm({ alarmsToEnableDisable: { audible: true, visual: true } });
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Enabling/disabling alarm ${{ audible: true, visual: true }} (endpoint ${leak.id}.${leak.number})`);
    });

    test('invoke MatterbridgeServerDevice Laundry commands', async () => {
      matterbridgeServerDevice.setEndpointId(laundry.id);
      matterbridgeServerDevice.setEndpointNumber(laundry.number);
      matterbridgeServerDevice.start();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Start (endpoint ${laundry.id}.${laundry.number})`);
      matterbridgeServerDevice.stop();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Stop (endpoint ${laundry.id}.${laundry.number})`);
      matterbridgeServerDevice.pause();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Pause (endpoint ${laundry.id}.${laundry.number})`);
      matterbridgeServerDevice.resume();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Resume (endpoint ${laundry.id}.${laundry.number})`);
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
