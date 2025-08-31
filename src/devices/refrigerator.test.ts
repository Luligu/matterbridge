// src/refrigerator.test.ts

const MATTER_PORT = 6026;
const NAME = 'Refrigerator';
const HOMEDIR = path.join('jest', NAME);

import { rmSync } from 'node:fs';
import path from 'node:path';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
// matter.js
import { Endpoint, DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment, PositionTag } from '@matter/main';
import { MdnsService } from '@matter/main/protocol';
import { AggregatorEndpoint } from '@matter/main/endpoints/aggregator';
import { RootEndpoint } from '@matter/main/endpoints/root';
import { RefrigeratorAndTemperatureControlledCabinetModeServer } from '@matter/main/behaviors';
import { Identify, OnOff, PowerSource, RefrigeratorAndTemperatureControlledCabinetMode } from '@matter/main/clusters';

// Matterbridge
import { MatterbridgeEndpoint } from '../matterbridgeEndpoint.js';
import { invokeBehaviorCommand } from '../matterbridgeEndpointHelpers.js';
import { inspectError } from '../utils/error.js';

import { MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer, Refrigerator } from './refrigerator.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

// Cleanup the matter environment
rmSync(HOMEDIR, { recursive: true, force: true });

describe('Matterbridge ' + NAME, () => {
  const environment = Environment.default;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let aggregator: Endpoint<AggregatorEndpoint>;
  let device: Refrigerator;
  let cabinet1: MatterbridgeEndpoint;
  let cabinet2: MatterbridgeEndpoint;

  beforeAll(async () => {
    // Setup the matter environment
    environment.vars.set('log.level', MatterLogLevel.DEBUG);
    environment.vars.set('log.format', MatterLogFormat.ANSI);
    environment.vars.set('path.root', HOMEDIR);
    environment.vars.set('runtime.signals', false);
    environment.vars.set('runtime.exitcode', false);
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    // Create the server node
    server = await ServerNode.create({
      id: NAME + 'ServerNode',

      productDescription: {
        name: NAME + 'ServerNode',
        deviceType: DeviceTypeId(RootEndpoint.deviceType),
        vendorId: VendorId(0xfff1),
        productId: 0x8000,
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      basicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'Matterbridge',
        productId: 0x8000,
        productName: 'Matterbridge ' + NAME,
        nodeLabel: NAME + 'ServerNode',
        hardwareVersion: 1,
        softwareVersion: 1,
        reachable: true,
      },

      network: {
        port: MATTER_PORT,
      },
    });
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
  });

  test('create the aggregator node', async () => {
    aggregator = new Endpoint(AggregatorEndpoint, { id: NAME + 'AggregatorNode' });
    expect(aggregator).toBeDefined();
  });

  test('add the aggregator node to the server', async () => {
    expect(server).toBeDefined();
    expect(aggregator).toBeDefined();
    await server.add(aggregator);
    expect(server.parts.has(aggregator.id)).toBeTruthy();
    expect(server.parts.has(aggregator)).toBeTruthy();
    expect(aggregator.lifecycle.isReady).toBeTruthy();
  });

  test('create a refrigerator device', async () => {
    device = new Refrigerator('Refrigerator Test Device', 'RF123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('RefrigeratorTestDevice-RF123456');
    expect(device.hasClusterServer(Identify.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(PowerSource.Cluster.id)).toBeTruthy();
    expect(device.hasClusterServer(OnOff.Cluster.id)).toBeFalsy();
    expect(device.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'powerSource', 'fixedLabel']);

    cabinet1 = device.addCabinet('Refrigerator Test Cabinet Top', [{ mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label }]);
    expect(cabinet1).toBeDefined();
    expect(cabinet1.id).toBe('RefrigeratorTestCabinetTop');
    expect(cabinet1.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeTruthy();
    expect(cabinet1.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'temperatureControl', 'refrigeratorAndTemperatureControlledCabinetMode', 'refrigeratorAlarm', 'temperatureMeasurement']);

    cabinet2 = device.addCabinet('Freezer Test Cabinet Bottom', [{ mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label }]);
    expect(cabinet2).toBeDefined();
    expect(cabinet2.id).toBe('FreezerTestCabinetBottom');
    expect(cabinet2.hasClusterServer(RefrigeratorAndTemperatureControlledCabinetMode.Cluster.id)).toBeTruthy();
    expect(cabinet2.getAllClusterServerNames()).toEqual(['descriptor', 'matterbridge', 'identify', 'temperatureControl', 'refrigeratorAndTemperatureControlledCabinetMode', 'refrigeratorAlarm', 'temperatureMeasurement']);
  });

  test('add a refrigerator device', async () => {
    expect(server).toBeDefined();
    expect(device).toBeDefined();
    try {
      await server.add(device);
    } catch (error) {
      inspectError(device.log, `Error adding device ${device.deviceName}`, error);
      return;
    }
    expect(server.parts.has('RefrigeratorTestDevice-RF123456')).toBeTruthy();
    expect(server.parts.has(device)).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer initialized`);
  });

  test('start the server node', async () => {
    // Run the server
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();

    // Wait for the server to be online
    await new Promise<void>((resolve) => {
      server.lifecycle.online.on(async () => {
        resolve();
      });
      server.start();
    });

    // Check if the server is online
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
  });

  test('cabinet1 open door', async () => {
    expect(await device.setDoorOpenState('RefrigeratorTestCabinetTop', true)).toBeDefined();
    expect(cabinet1.getAttribute('RefrigeratorAlarm', 'state')).toEqual({ doorOpen: true });
  });

  test('cabinet1 trigger alert on open door', async () => {
    expect(await device.triggerDoorOpenState('RefrigeratorTestCabinetTop', true)).toBeDefined();
  });

  test('cabinet1 trigger alert on close door', async () => {
    expect(await device.triggerDoorOpenState('RefrigeratorTestCabinetTop', false)).toBeDefined();
  });

  test('cabinet2 open door', async () => {
    expect(await device.setDoorOpenState('FreezerTestCabinetBottom', true)).toBeDefined();
    expect(cabinet2.getAttribute('RefrigeratorAlarm', 'state')).toEqual({ doorOpen: true });
  });

  test('cabinet2 trigger alert on open door', async () => {
    expect(await device.triggerDoorOpenState('FreezerTestCabinetBottom', true)).toBeDefined();
  });

  test('cabinet2 trigger alert on close door', async () => {
    expect(await device.triggerDoorOpenState('FreezerTestCabinetBottom', false)).toBeDefined();
  });

  test('device forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    device.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(39); // 39 attributes for the oven device
  });

  test('cabinet1 forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    cabinet1.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(48); // 48 attributes for the cabinet1 device
  });

  test('cabinet2 forEachAttribute', async () => {
    const attributes: { clusterName: string; clusterId: number; attributeName: string; attributeId: number; attributeValue: any }[] = [];
    cabinet2.forEachAttribute((clusterName, clusterId, attributeName, attributeId, attributeValue) => {
      expect(clusterName).toBeDefined();
      expect(typeof clusterName).toBe('string');

      expect(clusterId).toBeDefined();
      expect(typeof clusterId).toBe('number');
      expect(clusterId).toBeGreaterThanOrEqual(1);

      expect(attributeName).toBeDefined();
      expect(typeof attributeName).toBe('string');

      expect(attributeId).toBeDefined();
      expect(typeof attributeId).toBe('number');
      expect(attributeId).toBeGreaterThanOrEqual(0);
      attributes.push({ clusterName, clusterId, attributeName, attributeId, attributeValue });
    });
    expect(attributes.length).toBe(48); // 48 attributes for the cabinet2 device
  });

  test('invoke MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer commands', async () => {
    expect(cabinet1.behaviors.has(RefrigeratorAndTemperatureControlledCabinetModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.has(MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer)).toBeTruthy();
    expect(cabinet1.behaviors.elementsOf(RefrigeratorAndTemperatureControlledCabinetModeServer).commands.has('changeToMode')).toBeTruthy();
    expect((cabinet1 as any).state['refrigeratorAndTemperatureControlledCabinetMode'].acceptedCommandList).toEqual([0]);
    expect((cabinet1 as any).state['refrigeratorAndTemperatureControlledCabinetMode'].generatedCommandList).toEqual([1]);

    // Change to mode 2
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'refrigeratorAndTemperatureControlledCabinetMode', 'changeToMode', { newMode: 2 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestCabinetTop.3) called with mode 2 = RapidCool`);

    // Change to mode 15
    jest.clearAllMocks();
    await invokeBehaviorCommand(cabinet1, 'refrigeratorAndTemperatureControlledCabinetMode', 'changeToMode', { newMode: 15 });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `MatterbridgeRefrigeratorAndTemperatureControlledCabinetModeServer: changeToMode (endpoint RefrigeratorTestCabinetTop.3) called with invalid mode 15`);
  });

  test('close the server node', async () => {
    expect(server).toBeDefined();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
    await server.close();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();
    await new Promise((resolve) => setTimeout(resolve, 250));
  });

  test('stop the mDNS service', async () => {
    expect(server).toBeDefined();
    await server.env.get(MdnsService)[Symbol.asyncDispose]();
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
});
