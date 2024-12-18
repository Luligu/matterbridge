/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { MatterbridgeEdge } from './matterbridgeEdge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { bridge, coverDevice, dimmableLight, doorLockDevice, electricalSensor, genericSwitch, lightSensor, occupancySensor, onOffLight, onOffOutlet, onOffSwitch, powerSource } from './matterbridgeDeviceTypes.js';
import { getMacAddress } from './utils/utils.js';

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
  Identify,
  IdentifyCluster,
  IlluminanceMeasurementCluster,
  OccupancySensing,
  OccupancySensingCluster,
  OnOffCluster,
  PowerTopology,
  PressureMeasurement,
  PressureMeasurementCluster,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  ScenesManagementCluster,
  TemperatureMeasurementCluster,
  WindowCovering,
  WindowCoveringCluster,
} from '@matter/main/clusters';
import { AggregatorEndpoint, AggregatorEndpointDefinition } from '@matter/main/endpoints';

import { DeviceTypeDefinition, DeviceTypes, logEndpoint } from '@project-chip/matter.js/device';
import { MdnsService } from '@matter/main/protocol';
import { log } from 'console';
import { DescriptorServer, IlluminanceMeasurementServer, OccupancySensingServer } from '@matter/main/behaviors';
import { OccupancySensorDevice, OnOffPlugInUnitDevice } from '@matter/main/devices';
import { MatterbridgeBehavior, MatterbridgeIdentifyServer } from './matterbridgeBehaviors.js';

describe('MatterbridgeEndpoint class', () => {
  let edge: MatterbridgeEdge;
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
    edge = await MatterbridgeEdge.loadInstance(false);
    edge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    // Setup matter environment
    edge.environment.vars.set('log.level', Level.DEBUG);
    edge.environment.vars.set('log.format', Format.ANSI);
    edge.environment.vars.set('path.root', 'matterstorage');
    edge.environment.vars.set('runtime.signals', false);
    edge.environment.vars.set('runtime.exitcode', false);
    // Setup Matter mdnsInterface
    if ((edge as any).mdnsInterface) edge.environment.vars.set('mdns.networkInterface', (edge as any).mdnsInterface);
    await edge.startMatterStorage('test', 'Matterbridge');
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

    await edge.environment.get(MdnsService)[Symbol.asyncDispose]();
  });

  describe('MatterbridgeBehavior', () => {
    const deviceType = onOffLight;

    test('create a context for server node', async () => {
      /*
      (AnsiLogger.prototype.log as jest.Mock).mockRestore();
      consoleLogSpy.mockRestore();
      consoleDebugSpy.mockRestore();
      consoleInfoSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      */
      context = await edge.createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create the server node', async () => {
      server = await edge.createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create a onOffLight device', async () => {
      server = await edge.createServerNode(context);
      device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: 'OnOffLight', tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }] });
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

    test('add deviceType to onOffPlugin without tagList', async () => {
      const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer, OccupancySensingServer), {
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
      expect(endpoint).toBeDefined();
      endpoint.behaviors.require(DescriptorServer, {
        deviceTypeList: [
          { deviceType: 0x10a, revision: 3 },
          { deviceType: occupancySensor.code, revision: occupancySensor.revision },
        ],
      });
      expect(await server.add(endpoint)).toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(endpoint));
    });

    test('add deviceType to onOffPlugin with tagList', async () => {
      const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer), {
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
            { deviceType: 0x10a, revision: 3 },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          ],
        },
      });
      expect(endpoint).toBeDefined();
      expect(() =>
        endpoint.behaviors.require(DescriptorServer.with(Descriptor.Feature.TagList), {
          tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
          deviceTypeList: [
            { deviceType: 0x10a, revision: 3 },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          ],
        }),
      ).toThrow();
      await expect(server.add(endpoint)).resolves.toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(endpoint));
    });

    test('add deviceType to onOffPlugin in the costructor', async () => {
      const endpoint = new Endpoint(OnOffPlugInUnitDevice.with(DescriptorServer.with(Descriptor.Feature.TagList), OccupancySensingServer, IlluminanceMeasurementServer), {
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
      logEndpoint(EndpointServer.forEndpoint(endpoint));
      const deviceTypeList = endpoint.state.descriptor.deviceTypeList;
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
      await edge.startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
    });

    test('log onOffLight', async () => {
      expect(device).toBeDefined();
      logEndpoint(EndpointServer.forEndpoint(device));
      expect(EndpointServer.forEndpoint(device).hasClusterServer(DescriptorCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(BasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(BridgedDeviceBasicInformationCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(OnOffCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(ScenesManagementCluster)).toBe(false);
    });

    test('close server node', async () => {
      expect(server).toBeDefined();
      await edge.stopServerNode(server);
      await server.env.get(MdnsService)[Symbol.asyncDispose]();
    });
  });
});
