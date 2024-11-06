/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { MatterbridgeEdge } from './matterbridgeEdge.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { bridge, dimmableLight, onOffLight, onOffOutlet, onOffSwitch } from './matterbridgeDevice.js';

import { DeviceTypeId, VendorId, Environment, ServerNode, Endpoint, EndpointServer, StorageContext } from '@matter/main';
import { LogFormat as Format, LogLevel as Level } from '@matter/main';
import { PressureMeasurement, RelativeHumidityMeasurement } from '@matter/main/clusters';
import { AggregatorEndpoint, AggregatorEndpointDefinition } from '@matter/main/endpoints';

import { DeviceTypes, logEndpoint } from '@project-chip/matter.js/device';

describe('Matterbridge endpoint', () => {
  let edge: MatterbridgeEdge;
  let context: StorageContext;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let count = 1;

  beforeAll(async () => {
    // Setup matter environment
    const environment = Environment.default;
    environment.vars.set('log.level', Level.DEBUG);
    environment.vars.set('log.format', Format.ANSI);
    environment.vars.set('path.root', 'matterstorage');
    environment.vars.set('runtime.signals', true);
    environment.vars.set('runtime.exitcode', true);

    // Create a MatterbridgeEdge instance
    edge = await MatterbridgeEdge.loadInstance(false);
    edge.log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    await edge.startMatterStorage('test', 'Matterbridge');

    /*
    // Mock the AnsiLogger.log method
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'debug').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked debug: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'info').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked info: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'warn').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked warn: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'error').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked error: ${message}`, ...parameters);
    });
    */
  });

  afterEach(async () => {
    // Keep the id unique
    count++;
  });

  afterAll(async () => {
    // Restore the mocked AnsiLogger.log method
    // (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  });

  describe('Server node with aggregator', () => {
    test('create a server node', async () => {
      const deviceType = bridge;
      context = await edge.createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
      server = await edge.createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create an aggregator', async () => {
      aggregator = await edge.createAggregatorNode(context);
      expect(aggregator).toBeDefined();
      expect(aggregator.id).toBe('Jest aggregator');
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
      await aggregator.add(device);
      // logEndpoint(EndpointServer.forEndpoint(device));
    });

    test('start server node', async () => {
      await edge.startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      // logEndpoint(EndpointServer.forEndpoint(server));
    });

    test('stop server node', async () => {
      await edge.stopServerNode(server);
      expect(server.lifecycle.isOnline).toBe(false);
      // logEndpoint(EndpointServer.forEndpoint(server));
    });
  });

  describe('Server node with devices', () => {
    test('create a onOffLight device', async () => {
      const deviceType = onOffLight;
      const context = await edge.createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await edge.createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.type.behaviors.identify).toBeDefined();
      expect(device.type.behaviors.groups).toBeDefined();
      expect(device.type.behaviors.onOff).toBeDefined();
      await server.add(device);
      await edge.startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await edge.stopServerNode(server);
      expect(server.lifecycle.isOnline).toBe(false);
    }, 30000);

    test('create a onOffOutlet device', async () => {
      const deviceType = onOffOutlet;
      const context = await edge.createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await edge.createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.type.behaviors.identify).toBeDefined();
      expect(device.type.behaviors.groups).toBeDefined();
      expect(device.type.behaviors.onOff).toBeDefined();
      await server.add(device);
      await edge.startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await edge.stopServerNode(server);
      expect(server.lifecycle.isOnline).toBe(false);
    }, 30000);

    test('create a onOffSwitch device', async () => {
      const deviceType = onOffSwitch;
      const context = await edge.createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await edge.createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.type.behaviors.identify).toBeDefined();
      expect(device.type.behaviors.groups).toBeDefined();
      expect(device.type.behaviors.onOff).toBeDefined();
      await server.add(device);
      await edge.startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      await edge.stopServerNode(server);
      expect(server.lifecycle.isOnline).toBe(false);
    }, 30000);

    test('create a temperature humidity pressure sensor', async () => {
      const deviceType = DeviceTypes.TEMPERATURE_SENSOR;
      const context = await edge.createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      const server = await edge.createServerNode(context);
      const device = new MatterbridgeEndpoint(deviceType, { uniqueStorageKey: deviceType.name.replace('MA-', '') + '-' + count });
      expect(device).toBeDefined();
      expect(device.id).toBe(deviceType.name.replace('MA-', '') + '-' + count);
      expect(device.type.name).toBe(deviceType.name.replace('-', '_'));
      expect(device.type.deviceType).toBe(deviceType.code);
      expect(device.type.deviceClass).toBe(deviceType.deviceClass.toLowerCase());
      expect(device.type.deviceRevision).toBe(deviceType.revision);
      expect(device.type.behaviors.identify).toBeDefined();
      expect(device.type.behaviors.temperatureMeasurement).toBeDefined();

      device.addDeviceType(DeviceTypes.HUMIDITY_SENSOR);
      device.addClusterServerFromList(device, [RelativeHumidityMeasurement.Cluster.id]);

      device.addDeviceTypeWithClusterServer([DeviceTypes.PRESSURE_SENSOR], [PressureMeasurement.Cluster.id]);

      await server.add(device);
      await edge.startServerNode(server);
      expect(server.lifecycle.isOnline).toBe(true);
      expect(server.lifecycle.isCommissioned).toBe(false);
      logEndpoint(EndpointServer.forEndpoint(device));
      await edge.stopServerNode(server);
      expect(server.lifecycle.isOnline).toBe(false);
    }, 30000);
  });
});
