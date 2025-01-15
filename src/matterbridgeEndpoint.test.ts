/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import {
  bridge,
  colorTemperatureLight,
  contactSensor,
  coverDevice,
  dimmableLight,
  dimmableOutlet,
  doorLockDevice,
  electricalSensor,
  flowSensor,
  genericSwitch,
  humiditySensor,
  lightSensor,
  occupancySensor,
  onOffLight,
  onOffOutlet,
  onOffSwitch,
  powerSource,
  pressureSensor,
  pumpDevice,
  temperatureSensor,
  thermostatDevice,
  waterValve,
} from './matterbridgeDeviceTypes.js';
import { Matterbridge } from './matterbridge.js';

import { DeviceTypeId, VendorId, Environment, ServerNode, Endpoint, EndpointServer, StorageContext } from '@matter/main';
import { LogFormat as Format, LogLevel as Level } from '@matter/main';
import {
  BasicInformationCluster,
  BooleanStateCluster,
  BridgedDeviceBasicInformationCluster,
  Descriptor,
  DescriptorCluster,
  ElectricalEnergyMeasurement,
  ElectricalPowerMeasurement,
  FlowMeasurementCluster,
  GroupsCluster,
  IdentifyCluster,
  IlluminanceMeasurementCluster,
  OccupancySensingCluster,
  OnOffCluster,
  PowerSource,
  PowerSourceCluster,
  PowerTopology,
  PressureMeasurement,
  PressureMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  SwitchCluster,
  TemperatureMeasurementCluster,
  WindowCovering,
  WindowCoveringCluster,
} from '@matter/main/clusters';
import { AggregatorEndpoint, AggregatorEndpointDefinition } from '@matter/main/endpoints';
import { MdnsService } from '@matter/main/protocol';
import { DescriptorBehavior, GroupsBehavior, IdentifyBehavior, OccupancySensingBehavior, OnOffBehavior } from '@matter/main/behaviors';

import { DeviceTypes, logEndpoint } from '@project-chip/matter.js/device';

describe('MatterbridgeEndpoint class', () => {
  let matterbridge: Matterbridge;
  let context: StorageContext;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;
  let count = 1;

  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.debug>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.info>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeAll(async () => {
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
    // Spy on and mock console.log
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
    // Spy on and mock console.log
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
    // Spy on and mock console.log
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      // console.error(args);
    });

    // Create a MatterbridgeEdge instance
    matterbridge = await Matterbridge.loadInstance(false);
    matterbridge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    // Setup matter environment
    matterbridge.environment.vars.set('log.level', Level.DEBUG);
    matterbridge.environment.vars.set('log.format', Format.ANSI);
    matterbridge.environment.vars.set('path.root', 'matterstorage');
    matterbridge.environment.vars.set('runtime.signals', false);
    matterbridge.environment.vars.set('runtime.exitcode', false);
    // Setup Matter mdnsInterface
    if ((matterbridge as any).mdnsInterface) matterbridge.environment.vars.set('mdns.networkInterface', (matterbridge as any).mdnsInterface);
    await (matterbridge as any).startMatterStorage('test', 'Matterbridge');
  });

  afterEach(async () => {
    // Keep the id unique
    count++;
  });

  afterAll(async () => {
    // Restore the mocked AnsiLogger.log method
    if ((AnsiLogger.prototype.log as jest.Mock).mockRestore) (AnsiLogger.prototype.log as jest.Mock).mockRestore();
    consoleLogSpy?.mockRestore();
    consoleDebugSpy?.mockRestore();
    consoleInfoSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();

    await matterbridge.environment.get(MdnsService)[Symbol.asyncDispose]();
  });

  describe('MatterbridgeBehavior', () => {
    const deviceType = onOffLight;

    test('create a context for server node', async () => {
      /*
      (AnsiLogger.prototype.log as jest.Mock).mockRestore();
      consoleLogSpy?.mockRestore();
      consoleDebugSpy?.mockRestore();
      consoleInfoSpy?.mockRestore();
      consoleErrorSpy?.mockRestore();
      */
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create the server node', async () => {
      server = await (matterbridge as any).createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create a onOffLight device', async () => {
      server = await (matterbridge as any).createServerNode(context);
      device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
    });

    test('add BasicInformationCluster to onOffLight', async () => {
      expect(device).toBeDefined();
      device.createDefaultBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 0x8000, 'Light');
      expect(device.deviceName).toBe('Light');
      expect(device.serialNumber).toBe('123456789');
      expect(device.uniqueId).toBeDefined();
      expect(device.vendorId).toBe(0xfff1);
      expect(device.vendorName).toBe('Matterbridge');
      expect(device.productId).toBe(0x8000);
      expect(device.productName).toBe('Light');
      delete device.behaviors.supported.basicInformation;
    });

    test('add BridgedDeviceBasicInformationCluster to onOffLight', async () => {
      expect(device).toBeDefined();
      device.createDefaultBridgedDeviceBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 'Light');
      expect(device.deviceName).toBe('Light');
      expect(device.serialNumber).toBe('123456789');
      expect(device.uniqueId).toBeDefined();
      expect(device.vendorId).toBe(0xfff1);
      expect(device.vendorName).toBe('Matterbridge');
      expect(device.productId).toBe(undefined);
      expect(device.productName).toBe('Light');
      delete device.behaviors.supported.bridgedDeviceBasicInformation;
    });

    test('add required clusters to onOffLight', async () => {
      expect(device).toBeDefined();
      device.addRequiredClusterServers(device);
    });

    test('add onOffLight device to serverNode', async () => {
      expect(await server.add(device)).toBeDefined();
    });

    test('start server node', async () => {
      expect(server).toBeDefined();
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('log onOffLight', async () => {
      expect(device).toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(device));
      expect(EndpointServer.forEndpoint(device).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(OnOffCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(BasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(BridgedDeviceBasicInformationCluster)).toBe(false);
    });

    test('close server node', async () => {
      expect(server).toBeDefined();
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
    });
  });

  describe('onOffLight with child endpoints', () => {
    const deviceType = onOffLight;

    test('create a context for server node', async () => {
      /*
      (AnsiLogger.prototype.log as jest.Mock).mockRestore();
      consoleLogSpy.mockRestore();
      consoleDebugSpy.mockRestore();
      consoleInfoSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      */
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create the server node', async () => {
      server = await (matterbridge as any).createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create a onOffLight device', async () => {
      device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight With Sensors' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLightWithSensors');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
    });

    test('add required clusters to onOffLight', async () => {
      expect(device).toBeDefined();
      device.addRequiredClusterServers(device);
    });

    test('add contact child to onOffLight', async () => {
      const deviceType = contactSensor;
      // const childEndpoint = device.addChildDeviceTypeWithClusterServer('contactChild-1', [deviceType], [BooleanStateCluster.id]);
      const childEndpoint = device.addChildDeviceType('contactChild-1', [deviceType]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.createDefaultIdentifyClusterServer();
      childEndpoint.createDefaultBooleanStateClusterServer(false);
      expect(device.getChildEndpointByName('contactChild-1')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(1);
    });

    test('add motion child to onOffLight', async () => {
      const deviceType = occupancySensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('occupancyChild-2', [deviceType], [OccupancySensingCluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addClusterServer(childEndpoint.getDefaultOccupancySensingClusterServer(false));
      expect(device.getChildEndpointByName('occupancyChild-2')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(2);
    });

    test('add illuminance child to onOffLight', async () => {
      const deviceType = lightSensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('illuminanceChild-3', [deviceType], [IlluminanceMeasurementCluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addClusterServer(childEndpoint.getDefaultIlluminanceMeasurementClusterServer(200));
      expect(device.getChildEndpointByName('illuminanceChild-3')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(3);
    });

    test('add temperature child to onOffLight', async () => {
      const deviceType = temperatureSensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('temperatureChild-4', [deviceType], [TemperatureMeasurementCluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addClusterServer(childEndpoint.getDefaultTemperatureMeasurementClusterServer(2500));
      expect(device.getChildEndpointByName('temperatureChild-4')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(4);
    });

    test('add humidity child to onOffLight', async () => {
      const deviceType = humiditySensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('humidityChild-5', [deviceType], [RelativeHumidityMeasurementCluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addClusterServer(childEndpoint.getDefaultRelativeHumidityMeasurementClusterServer(8000));
      expect(device.getChildEndpointByName('humidityChild-5')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(5);
    });

    test('add pressure child to onOffLight', async () => {
      const deviceType = pressureSensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('pressureChild-6', [deviceType], [PressureMeasurementCluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addClusterServer(childEndpoint.getDefaultPressureMeasurementClusterServer(900));
      expect(device.getChildEndpointByName('pressureChild-6')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(6);
    });

    test('add flow child to onOffLight', async () => {
      const deviceType = flowSensor;
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('flowChild-7', [deviceType], [FlowMeasurementCluster.id]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addClusterServer(childEndpoint.getDefaultFlowMeasurementClusterServer(900));
      expect(device.getChildEndpointByName('flowChild-7')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(7);
    });

    test('add multiple device types child to onOffLight', async () => {
      const childEndpoint = device.addChildDeviceType('multiChild-8', [temperatureSensor, humiditySensor, pressureSensor]);
      expect(childEndpoint).toBeDefined();
      childEndpoint.addRequiredClusterServers(childEndpoint);
      expect(device.getChildEndpointByName('multiChild-8')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(8);
    });

    test('add multiple device types with required child to onOffLight', async () => {
      const childEndpoint = device.addChildDeviceTypeWithClusterServer('multiChild-9', [temperatureSensor, humiditySensor, pressureSensor]);
      expect(childEndpoint).toBeDefined();
      expect(device.getChildEndpointByName('multiChild-9')).toBeDefined();
      expect(device.getChildEndpoints().length).toBe(9);
    });

    test('add onOffLight device to serverNode', async () => {
      expect(await server.add(device)).toBeDefined();
      expect(device.getChildEndpoints()).toHaveLength(9);
      expect(EndpointServer.forEndpoint(device).getChildEndpoints()).toHaveLength(9);
    });

    test('verify onOffLight child endpoints', async () => {
      const getChildDescriptorAttribute = (name: string, attribute: string) => {
        const childEndpoint = device.getChildEndpointByName(name);
        expect(childEndpoint).toBeDefined();
        if (!childEndpoint) return;
        return EndpointServer.forEndpoint(childEndpoint).getClusterServer(Descriptor.Cluster)?.attributes[attribute].getLocal();
      };
      expect(getChildDescriptorAttribute('contactChild-1', 'deviceTypeList')).toEqual([{ deviceType: contactSensor.code, revision: contactSensor.revision }]);
      expect(getChildDescriptorAttribute('occupancyChild-2', 'deviceTypeList')).toEqual([{ deviceType: occupancySensor.code, revision: occupancySensor.revision }]);
      expect(getChildDescriptorAttribute('illuminanceChild-3', 'deviceTypeList')).toEqual([{ deviceType: lightSensor.code, revision: lightSensor.revision }]);
      expect(getChildDescriptorAttribute('temperatureChild-4', 'deviceTypeList')).toEqual([{ deviceType: temperatureSensor.code, revision: temperatureSensor.revision }]);
      expect(getChildDescriptorAttribute('humidityChild-5', 'deviceTypeList')).toEqual([{ deviceType: humiditySensor.code, revision: humiditySensor.revision }]);
      expect(getChildDescriptorAttribute('pressureChild-6', 'deviceTypeList')).toEqual([{ deviceType: pressureSensor.code, revision: pressureSensor.revision }]);
      expect(getChildDescriptorAttribute('flowChild-7', 'deviceTypeList')).toEqual([{ deviceType: flowSensor.code, revision: flowSensor.revision }]);
      expect(getChildDescriptorAttribute('multiChild-8', 'deviceTypeList')).toEqual([
        { deviceType: temperatureSensor.code, revision: temperatureSensor.revision },
        { deviceType: humiditySensor.code, revision: humiditySensor.revision },
        { deviceType: pressureSensor.code, revision: pressureSensor.revision },
      ]);
      expect(getChildDescriptorAttribute('multiChild-9', 'deviceTypeList')).toEqual([
        { deviceType: temperatureSensor.code, revision: temperatureSensor.revision },
        { deviceType: humiditySensor.code, revision: humiditySensor.revision },
        { deviceType: pressureSensor.code, revision: pressureSensor.revision },
      ]);
    });

    test('start server node', async () => {
      expect(server).toBeDefined();
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('log onOffLight', async () => {
      expect(device).toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(device));
      expect(EndpointServer.forEndpoint(device).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(OnOffCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(GroupsCluster)).toBe(true);
    });

    test('close server node', async () => {
      expect(server).toBeDefined();
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
    });
  });

  describe('Constructor with multiple device types', () => {
    test('create a context for server node', async () => {
      const deviceType = onOffOutlet;
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create a onOffOutlet device', async () => {
      const deviceType = onOffOutlet;
      server = await (matterbridge as any).createServerNode(context);
      device = new MatterbridgeEndpoint([onOffOutlet, dimmableOutlet], { uniqueStorageKey: 'OnOffOutLet' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffOutLet');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
    });

    test('add required clusters to onOffOutlet', async () => {
      expect(device).toBeDefined();
      device.addRequiredClusterServers(device);
      expect(device.behaviors.supported.onOff).toBeDefined();
      expect(device.behaviors.supported.identify).toBeDefined();
      expect(device.behaviors.supported.groups).toBeDefined();
    });

    test('add onOffOutlet device to serverNode and start', async () => {
      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('check onOffOutlet device deviceTypeList', async () => {
      const getDescriptorAttribute = (device: MatterbridgeEndpoint, attribute: string) => {
        return EndpointServer.forEndpoint(device).getClusterServer(Descriptor.Cluster)?.attributes[attribute].getLocal();
      };

      expect(device.stateOf(OnOffBehavior).onOff).toBe(false);
      expect(device.state.descriptor.deviceTypeList).toEqual([
        { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
        { deviceType: dimmableOutlet.code, revision: dimmableOutlet.revision },
      ]);
      const deviceTypeList = device.getAttribute(DescriptorCluster.id, 'deviceTypeList');
      expect(deviceTypeList).toEqual([
        { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
        { deviceType: dimmableOutlet.code, revision: dimmableOutlet.revision },
      ]);
      expect(getDescriptorAttribute(device, 'deviceTypeList')).toEqual([
        { deviceType: onOffOutlet.code, revision: onOffOutlet.revision },
        { deviceType: dimmableOutlet.code, revision: dimmableOutlet.revision },
      ]);
    });

    test('close serverNode', async () => {
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });
  });

  describe('Constructor with tagList', () => {
    test('create a context for server node', async () => {
      const deviceType = onOffLight;
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create a onOffOutlet device', async () => {
      const deviceType = onOffOutlet;
      server = await (matterbridge as any).createServerNode(context);
      device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffOutLet', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Outlet1' }] });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffOutLet');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
    });

    test('add required clusters to onOffOutlet', async () => {
      expect(device).toBeDefined();
      device.addRequiredClusterServers(device);
    });

    test('add onOffOutlet device to serverNode and start', async () => {
      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('check onOffOutlet device deviceTypeList and tagList', async () => {
      const deviceTypeList = device.getAttribute(DescriptorCluster.id, 'deviceTypeList');
      expect(deviceTypeList).toBeDefined();
      expect(deviceTypeList).toHaveLength(1);
      const tagList = device.getAttribute(DescriptorCluster.id, 'tagList');
      device.setAttribute(DescriptorCluster.id, 'tagList', tagList);
      device.subscribeAttribute(DescriptorCluster.id, 'tagList', (newValue: any, oldValue: any) => {
        //
      });
      expect(tagList).toBeDefined();
      expect(tagList).toHaveLength(1);
      expect(deviceTypeList[0].deviceType).toBe(onOffOutlet.code);
      expect(deviceTypeList[0].revision).toBe(onOffOutlet.revision);
    });

    test('close serverNode', async () => {
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });
  });

  describe('Constructor with tagList and 2 deviceTypes', () => {
    test('create a context for server node', async () => {
      const deviceType = onOffLight;
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create a onOffOutlet device', async () => {
      const deviceType = onOffOutlet;
      server = await (matterbridge as any).createServerNode(context);
      device = new MatterbridgeEndpoint([deviceType, occupancySensor], { uniqueStorageKey: 'OnOffOutLet', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Outlet1' }] });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffOutLet');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
    });

    test('add required clusters to onOffOutlet', async () => {
      expect(device).toBeDefined();
      device.addRequiredClusterServers(device);
    });

    test('add onOffOutlet device to serverNode and start', async () => {
      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('tagList and deviceTypeList', async () => {
      const deviceTypeList = device.getAttribute(DescriptorCluster.id, 'deviceTypeList');
      expect(deviceTypeList).toBeDefined();
      expect(deviceTypeList).toHaveLength(2);
      expect(deviceTypeList[0].deviceType).toBe(onOffOutlet.code);
      expect(deviceTypeList[0].revision).toBe(onOffOutlet.revision);
      expect(deviceTypeList[1].deviceType).toBe(occupancySensor.code);
      expect(deviceTypeList[1].revision).toBe(occupancySensor.revision);
      const tagList = device.getAttribute(DescriptorCluster.id, 'tagList');
      expect(tagList).toBeDefined();
      expect(tagList).toHaveLength(1);
      expect(tagList[0].mfgCode).toBe(null);
      expect(tagList[0].namespaceId).toBe(0x07);
      expect(tagList[0].tag).toBe(1);
      expect(tagList[0].label).toBe('Outlet1');
    });

    test('clusters', async () => {
      expect(device).toBeDefined();

      expect(device.getAllClusterServers().length).toBe(4);
      expect(device.hasClusterServer(OnOffCluster)).toBe(true);
      expect(device.hasClusterServer(IdentifyCluster)).toBe(true);
      expect(device.hasClusterServer(GroupsCluster)).toBe(true);
      expect(device.hasClusterServer(OccupancySensingCluster)).toBe(true);

      expect(device.behaviors.has(DescriptorBehavior)).toBe(true);
      expect(device.behaviors.has(IdentifyBehavior)).toBe(true);
      expect(device.behaviors.has(OnOffBehavior)).toBe(true);
      expect(device.behaviors.has(GroupsBehavior)).toBe(true);
      expect(device.behaviors.has(OccupancySensingBehavior)).toBe(true);

      const endpointServer = EndpointServer.forEndpoint(device);
      expect(endpointServer).toBeDefined();
      expect(endpointServer.getAllClusterServers().length).toBe(5);
      expect(endpointServer.hasClusterServer(DescriptorCluster)).toBe(true);
      expect(endpointServer.hasClusterServer(OnOffCluster)).toBe(true);
      expect(endpointServer.hasClusterServer(IdentifyCluster)).toBe(true);
      expect(endpointServer.hasClusterServer(GroupsCluster)).toBe(true);
      expect(endpointServer.hasClusterServer(OccupancySensingCluster)).toBe(true);
    });

    test('close serverNode', async () => {
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });
  });

  describe('Getter, setter and subscribe', () => {
    test('create a context for server node', async () => {
      const deviceType = onOffLight;
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create a onOffLight device', async () => {
      const deviceType = onOffLight;
      server = await (matterbridge as any).createServerNode(context);
      device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight' });
      expect(device).toBeDefined();
      expect(device.id).toBe('OnOffLight');
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
    });

    test('add required clusters to onOffLight', async () => {
      expect(device).toBeDefined();
      device.addRequiredClusterServers(device);
    });

    test('add onOffLight device to serverNode and start', async () => {
      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('getAttribute OnOff.onOff', async () => {
      const state = (device.state as any)['onOff']['onOff'];
      expect(device.getAttribute(OnOffCluster.id, 'onOff', matterbridge.log)).toBe(state);
    });

    test('setAttribute OnOff.onOff', async () => {
      expect(await device.setAttribute(OnOffCluster.id, 'onOff', true, matterbridge.log)).toBe(true);
      expect(device.getAttribute(OnOffCluster.id, 'onOff', matterbridge.log)).toBe(true);

      expect(await device.setAttribute(OnOffCluster.id, 'onOff', false, matterbridge.log)).toBe(true);
      expect(device.getAttribute(OnOffCluster.id, 'onOff', matterbridge.log)).toBe(false);
    });

    test('subscribeAttribute OnOff.onOff', async () => {
      expect(await device.setAttribute(OnOffCluster.id, 'onOff', true, matterbridge.log)).toBe(true);
      let state = device.getAttribute(OnOffCluster.id, 'onOff', matterbridge.log);

      const result = await device.subscribeAttribute(
        OnOffCluster.id,
        'onOff',
        (newValue: any, oldValue: any) => {
          state = newValue;
          matterbridge.log.warn('onOff', newValue, oldValue);
        },
        matterbridge.log,
      );
      expect(result).toBe(true);

      expect(await device.setAttribute(OnOffCluster.id, 'onOff', false, matterbridge.log)).toBe(true);
      expect(state).toBe(false);

      expect(await device.setAttribute(OnOffCluster.id, 'onOff', true, matterbridge.log)).toBe(true);
      expect(state).toBe(true);
    });

    test('close serverNode', async () => {
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });
  });

  describe('Server node with aggregator', () => {
    test('create a context for server node', async () => {
      const deviceType = bridge;
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create a server node', async () => {
      server = await (matterbridge as any).createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create an aggregator', async () => {
      aggregator = await (matterbridge as any).createAggregatorNode(context);
      expect(aggregator).toBeDefined();
      expect(aggregator.id).toBe('Jest');
      expect(aggregator.type.name).toBe(AggregatorEndpointDefinition.name);
      expect(aggregator.type.deviceType).toBe(AggregatorEndpointDefinition.deviceType);
      expect(aggregator.type.deviceClass).toBe(AggregatorEndpointDefinition.deviceClass);
      expect(aggregator.type.deviceRevision).toBe(AggregatorEndpointDefinition.deviceRevision);
      await server.add(aggregator);
      // logEndpoint(EndpointServer.forEndpoint(aggregator));
    });

    test('create an onOffLight and add it', async () => {
      const deviceType = onOffLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);
      device.createDefaultBridgedDeviceBasicInformationClusterServer('Light', '123456789', 0xfff1, 'Matterbridge', 'Light');
      await aggregator.add(device);
      // logEndpoint(EndpointServer.forEndpoint(device));
    });

    test('create a dimmableLight and add it', async () => {
      const deviceType = dimmableLight;
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);
      device.createDefaultBridgedDeviceBasicInformationClusterServer('Dimmer', '123456789', 0xfff1, 'Matterbridge', 'Dimmer');
      await aggregator.add(device);
      // logEndpoint(EndpointServer.forEndpoint(device));
    });

    test('start server node', async () => {
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      // logEndpoint(EndpointServer.forEndpoint(server));
    });

    test('stop server node', async () => {
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
      // logEndpoint(EndpointServer.forEndpoint(server));
    });
  });

  describe('Server node with devices', () => {
    test('create a context for server node', async () => {
      const deviceType = bridge;
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create a onOffSwitch device with ModeSelect, UserLabel and FixedLabel', async () => {
      const deviceType = onOffSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count }, true);
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);

      await device.addFixedLabel('Type', 'Switch');
      await device.addUserLabel('Type', 'Switch');
      device.createDefaultModeSelectClusterServer(
        'Switch mode',
        [
          { label: 'Momentary', mode: 1, semanticTags: [] },
          { label: 'Latching', mode: 2, semanticTags: [] },
        ],
        1,
        1,
      );

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffSwitch device with RechargeableBattery', async () => {
      const deviceType = onOffSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count }, true);
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);

      device.addDeviceType(powerSource);
      device.createDefaultPowerSourceRechargeableBatteryClusterServer();
      expect(device.subType).toBe('BatteryRechargeablePowerSource');

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);

      expect(device.getAttribute(PowerSourceCluster.id, 'batPercentRemaining')).toBe(200);
      expect(device.getAttribute(PowerSourceCluster.id, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
      expect(device.getAttribute(PowerSourceCluster.id, 'batVoltage')).toBe(1500);

      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffSwitch device with ReplaceableBattery', async () => {
      const deviceType = onOffSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count }, true);
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);

      device.addDeviceType(powerSource);
      device.createDefaultPowerSourceReplaceableBatteryClusterServer();
      expect(device.subType).toBe('BatteryReplaceablePowerSource');

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);

      expect(device.getAttribute(PowerSourceCluster.id, 'batPercentRemaining')).toBe(200);
      expect(device.getAttribute(PowerSourceCluster.id, 'batChargeLevel')).toBe(PowerSource.BatChargeLevel.Ok);
      expect(device.getAttribute(PowerSourceCluster.id, 'batVoltage')).toBe(1500);
      expect(device.getAttribute(PowerSourceCluster.id, 'batQuantity')).toBe(1);

      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffSwitch device with Wired power', async () => {
      const deviceType = onOffSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count }, true);
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);

      device.addDeviceType(powerSource);
      device.createDefaultPowerSourceWiredClusterServer();
      expect(device.subType).toBe('WiredPowerSource');

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);

      expect(device.getAttribute(PowerSourceCluster.id, 'wiredCurrentType')).toBe(PowerSource.WiredCurrentType.Ac);
      expect(device.getAttribute(PowerSourceCluster.id, 'description')).toBe('AC Power');
      expect(device.getAttribute(PowerSourceCluster.id, 'batPercentRemaining')).toBe(undefined);
      expect(device.getAttribute(PowerSourceCluster.id, 'batChargeLevel')).toBe(undefined);
      expect(device.getAttribute(PowerSourceCluster.id, 'batVoltage')).toBe(undefined);
      expect(device.getAttribute(PowerSourceCluster.id, 'batQuantity')).toBe(undefined);

      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffSwitch device with all clusters', async () => {
      const deviceType = onOffSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count }, true);
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);

      device.createDefaultThermostatClusterServer();

      device.createDefaultFanControlClusterServer();

      device.createDefaultAirQualityClusterServer();
      device.createDefaultTvocMeasurementClusterServer();
      device.createDefaultSmokeCOAlarmClusterServer();
      device.createDefaultBooleanStateClusterServer();
      device.createDefaultBooleanStateConfigurationClusterServer();
      device.createDefaultCarbonMonoxideConcentrationMeasurementClusterServer();
      device.createDefaultCarbonDioxideConcentrationMeasurementClusterServer();
      device.createDefaultFormaldehydeConcentrationMeasurementClusterServer();
      device.createDefaultPm1ConcentrationMeasurementClusterServer();
      device.createDefaultPm25ConcentrationMeasurementClusterServer();
      device.createDefaultPm10ConcentrationMeasurementClusterServer();
      device.createDefaultOzoneConcentrationMeasurementClusterServer();
      device.createDefaultRadonConcentrationMeasurementClusterServer();
      device.createDefaultNitrogenDioxideConcentrationMeasurementClusterServer();

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffLight device', async () => {
      const deviceType = onOffLight;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createOnOffClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a dimmableLight device', async () => {
      const deviceType = dimmableLight;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a colorTemperatureLight device', async () => {
      const deviceType = colorTemperatureLight;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createDefaultColorControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a colorTemperatureLight HS device', async () => {
      const deviceType = colorTemperatureLight;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createHsColorControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a colorTemperatureLight XY device', async () => {
      const deviceType = colorTemperatureLight;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createXyColorControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a colorTemperatureLight CT device', async () => {
      const deviceType = colorTemperatureLight;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultOnOffClusterServer();
      device.createDefaultLevelControlClusterServer();
      device.createCtColorControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a pumpDevice device', async () => {
      const deviceType = pumpDevice;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultOnOffClusterServer();
      device.createDefaultIdentifyClusterServer();
      device.createDefaultPumpConfigurationAndControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a waterValve device', async () => {
      const deviceType = waterValve;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultIdentifyClusterServer();
      device.createDefaultValveConfigurationAndControlClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffOutlet device', async () => {
      const deviceType = onOffOutlet;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDeadFrontOnOffClusterServer();
      device.addRequiredClusterServers(device);

      await server.add(device);
      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffSwitch device', async () => {
      const deviceType = onOffSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a cover device', async () => {
      const deviceType = coverDevice;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultWindowCoveringClusterServer(0);
      device.addRequiredClusterServers(device);
      await server.add(device);
      await device.setWindowCoveringTargetAsCurrentAndStopped();
      await device.setWindowCoveringCurrentTargetStatus(5000, 5000, WindowCovering.MovementStatus.Stopped);
      await device.setWindowCoveringStatus(WindowCovering.MovementStatus.Stopped);
      expect(device.getWindowCoveringStatus()).toBe(WindowCovering.MovementStatus.Stopped);
      await device.setWindowCoveringTargetAndCurrentPosition(0);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a lock device', async () => {
      const deviceType = doorLockDevice;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultDoorLockClusterServer();
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a thermostat auto device', async () => {
      const deviceType = thermostatDevice;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultThermostatClusterServer();
      expect(device.subType).toBe('AutoModeThermostat');
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a thermostat heating device', async () => {
      const deviceType = thermostatDevice;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultHeatingThermostatClusterServer();
      expect(device.subType).toBe('HeatingThermostat');
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a thermostat cooling device', async () => {
      const deviceType = thermostatDevice;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultCoolingThermostatClusterServer();
      expect(device.subType).toBe('CoolingThermostat');
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a generic switch momentary device', async () => {
      const deviceType = genericSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultSwitchClusterServer();
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);

      const feature = device.getAttribute(SwitchCluster.id, 'featureMap') as Record<string, boolean>;
      expect(feature).toBeDefined();
      expect(feature['latchingSwitch']).toBe(false);
      expect(feature['momentarySwitch']).toBe(true);
      expect(feature['momentarySwitchRelease']).toBe(true);
      expect(feature['momentarySwitchLongPress']).toBe(true);
      expect(feature['momentarySwitchMultiPress']).toBe(true);

      device.triggerSwitchEvent('Single');
      device.triggerSwitchEvent('Double');
      device.triggerSwitchEvent('Long');

      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a generic switch latching device', async () => {
      const deviceType = genericSwitch;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.createDefaultLatchingSwitchClusterServer();
      device.addRequiredClusterServers(device);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);

      const feature = device.getAttribute(SwitchCluster.id, 'featureMap') as Record<string, boolean>;
      expect(feature).toBeDefined();
      expect(feature['latchingSwitch']).toBe(true);
      expect(feature['momentarySwitch']).toBe(false);
      expect(feature['momentarySwitchRelease']).toBe(false);
      expect(feature['momentarySwitchLongPress']).toBe(false);
      expect(feature['momentarySwitchMultiPress']).toBe(false);

      device.triggerSwitchEvent('Press');
      device.triggerSwitchEvent('Release');

      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a onOffOutlet with electricalSensor', async () => {
      /*
      (AnsiLogger.prototype.log as jest.Mock).mockRestore();
      consoleLogSpy.mockRestore();
      consoleDebugSpy.mockRestore();
      consoleInfoSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      */
      const deviceType = onOffOutlet;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);
      device.addDeviceTypeWithClusterServer([electricalSensor], [PowerTopology.Cluster.id, ElectricalPowerMeasurement.Cluster.id, ElectricalEnergyMeasurement.Cluster.id]);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      // logEndpoint(EndpointServer.forEndpoint(device));
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });

    test('create a temperature humidity pressure sensor', async () => {
      const deviceType = DeviceTypes.TEMPERATURE_SENSOR;
      const context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await (matterbridge as any).createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      device.addRequiredClusterServers(device);
      device.addDeviceType(DeviceTypes.HUMIDITY_SENSOR);
      device.addClusterServerFromList(device, [RelativeHumidityMeasurement.Cluster.id]);
      device.addDeviceTypeWithClusterServer([DeviceTypes.PRESSURE_SENSOR], [PressureMeasurement.Cluster.id]);
      await server.add(device);

      await (matterbridge as any).startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      // logEndpoint(EndpointServer.forEndpoint(device));
      await (matterbridge as any).stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(server.lifecycle.isOnline).toBe(false);
    });
  });
});
