/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { lightSensor, occupancySensor, onOffLight, onOffOutlet } from './matterbridgeDeviceTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { getAttributeId, getClusterId } from './matterbridgeEndpointHelpers.js';

// @matter
import { DeviceTypeId, VendorId, ServerNode, Endpoint, EndpointServer, StorageContext } from '@matter/main';
import { LogFormat as Format, LogLevel as Level } from '@matter/main';
import { BasicInformationCluster, BridgedDeviceBasicInformationCluster, Descriptor, DescriptorCluster, GroupsCluster, Identify, IdentifyCluster, OccupancySensing, OnOffCluster, ScenesManagementCluster } from '@matter/main/clusters';
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

describe('MatterbridgeEndpoint class', () => {
  let matterbridge: Matterbridge;
  let context: StorageContext;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: MatterbridgeEndpoint;

  // Spy on and mock AnsiLogger.log
  const loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
    //
  });
  // Spy on and mock console.log
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
    //
  });

  /*
  // Spy on AnsiLogger.log
  const loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  // Spy on console.log
  const consoleLogSpy = jest.spyOn(console, 'log');
  // Spy on console.debug
  const consoleDebugSpy = jest.spyOn(console, 'debug');
  // Spy on console.info
  const consoleInfoSpy = jest.spyOn(console, 'info');
  // Spy on console.warn
  const consoleWarnSpy = jest.spyOn(console, 'warn');
  // Spy on console.error
  const consoleErrorSpy = jest.spyOn(console, 'error');
  */

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
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    //
  });

  afterAll(async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();

    // Restore all mocks
    jest.restoreAllMocks();
  });

  describe('MatterbridgeEndpointMatter', () => {
    const deviceType = onOffLight;

    test('create a context for server node', async () => {
      context = await (matterbridge as any).createServerNodeContext('Jest', deviceType.name, DeviceTypeId(deviceType.code), VendorId(0xfff1), 'Matterbridge', 0x8000, 'Matterbridge ' + deviceType.name.replace('MA-', ''));
      expect(context).toBeDefined();
    });

    test('create the server node', async () => {
      server = await (matterbridge as any).createServerNode(context);
      expect(server).toBeDefined();
    });

    test('create a onOffLight device', async () => {
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
      device.createDefaultOnOffClusterServer(true, false, 10, 14);
      device.addRequiredClusterServers();
      expect(device.behaviors.supported.descriptor).toBeDefined();
      expect(device.behaviors.has(DescriptorBehavior)).toBeTruthy();
      expect(device.behaviors.has(DescriptorServer)).toBeTruthy();
      expect(device.hasClusterServer(DescriptorCluster)).toBeTruthy();
      expect(device.hasClusterServer(DescriptorCluster.id)).toBeTruthy();
      expect(device.hasClusterServer(DescriptorCluster.name)).toBeTruthy();
      // consoleWarnSpy?.mockRestore();
      // console.warn(device.behaviors.optionsFor(DescriptorBehavior));

      expect(device.behaviors.supported['identify']).toBeDefined();
      expect(device.behaviors.has(IdentifyBehavior)).toBeTruthy();
      expect(device.behaviors.has(IdentifyServer)).toBeTruthy();
      expect(device.hasClusterServer(IdentifyCluster)).toBeTruthy();
      expect(device.hasClusterServer(IdentifyCluster.id)).toBeTruthy();
      expect(device.hasClusterServer(IdentifyCluster.name)).toBeTruthy();

      expect(device.behaviors.supported['groups']).toBeDefined();
      expect(device.behaviors.has(GroupsBehavior)).toBeTruthy();
      expect(device.behaviors.has(GroupsServer)).toBeTruthy();
      expect(device.hasClusterServer(GroupsCluster)).toBeTruthy();
      expect(device.hasClusterServer(GroupsCluster.id)).toBeTruthy();
      expect(device.hasClusterServer(GroupsCluster.name)).toBeTruthy();

      expect(device.behaviors.supported['scenesManagement']).not.toBeDefined();
      expect(device.behaviors.has(ScenesManagementBehavior)).toBeFalsy();
      expect(device.behaviors.has(ScenesManagementServer)).toBeFalsy();
      expect(device.hasClusterServer(ScenesManagementCluster)).toBeFalsy();
      expect(device.hasClusterServer(ScenesManagementCluster.id)).toBeFalsy();
      expect(device.hasClusterServer(ScenesManagementCluster.name)).toBeFalsy();

      expect(device.behaviors.supported['onOff']).toBeDefined();
      expect(device.behaviors.has(OnOffBehavior)).toBeTruthy();
      expect(device.behaviors.has(OnOffServer)).toBeTruthy();
      expect(device.hasClusterServer(OnOffCluster)).toBeTruthy();
      expect(device.hasClusterServer(OnOffCluster.id)).toBeTruthy();
      expect(device.hasClusterServer(OnOffCluster.name)).toBeTruthy();
    });

    test('add onOffLight device to serverNode', async () => {
      expect(await server.add(device)).toBeDefined();
      expect(EndpointServer.forEndpoint(device).hasClusterServer(DescriptorCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(IdentifyCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(GroupsCluster)).toBe(true);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(ScenesManagementCluster)).toBe(false);
      expect(EndpointServer.forEndpoint(device).hasClusterServer(OnOffCluster)).toBe(true);
    });

    test('getClusterId and getAttributeId of onOffLight device behaviors', async () => {
      expect(device).toBeDefined();
      expect(getClusterId(device, 'onOff')).toBe(6);
      expect(getClusterId(device, 'OnOff')).toBe(6);
      expect(getAttributeId(device, 'onOff', 'OnOff')).toBe(0);
      expect(getAttributeId(device, 'OnOff', 'OnOff')).toBe(0);
      expect(getAttributeId(device, 'onOff', 'onOff')).toBe(0);
      expect(getAttributeId(device, 'OnOff', 'onOff')).toBe(0);
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
            { deviceType: 0x10a, revision: 3 },
            { deviceType: occupancySensor.code, revision: occupancySensor.revision },
          ],
        },
      });
      expect(child).toBeDefined();
      expect(() =>
        child.behaviors.require(DescriptorServer.with(Descriptor.Feature.TagList), {
          tagList: [{ mfgCode: null, namespaceId: 0x07, tag: 1, label: 'Switch1' }],
          deviceTypeList: [
            { deviceType: 0x10a, revision: 3 },
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
      await server.close();
      await server.env.get(MdnsService)[Symbol.asyncDispose](); // loadInstance(false) so destroyInstance() does not stop the mDNS service
    });
  });
});
