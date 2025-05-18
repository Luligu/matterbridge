// src\singledevice.test.ts

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { jest } from '@jest/globals';
import { DeviceTypeId, VendorId, ServerNode, LogFormat as MatterLogFormat, LogLevel as MatterLogLevel, Environment } from '@matter/main';
import { RootEndpoint } from '@matter/main/endpoints';
import { BridgedDeviceBasicInformationServer } from '@matter/main/behaviors';
import { MdnsService } from '@matter/main/protocol';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { rmSync } from 'node:fs';

import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { Matterbridge } from './matterbridge.js';
import { RoboticVacuumCleaner } from './roboticVacuumCleaner.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

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

describe('Matterbridge Single Device', () => {
  const log = new AnsiLogger({ logName: 'SingleDevice', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  const environment = Environment.default;
  let server: ServerNode<ServerNode.RootEndpoint>;
  let device: MatterbridgeEndpoint;

  const mockMatterbridge = {
    matterbridgeVersion: '1.0.0',
    matterbridgeInformation: { virtualMode: 'disabled' },
    bridgeMode: 'bridge',
    restartMode: '',
    restartProcess: jest.fn(),
    shutdownProcess: jest.fn(),
    updateProcess: jest.fn(),
    log,
    frontend: {
      wssSendRefreshRequired: jest.fn(),
      wssSendUpdateRequired: jest.fn(),
    },
    nodeContext: {
      set: jest.fn(),
    },
  } as unknown as Matterbridge;

  beforeAll(async () => {
    // Cleanup the matter environment
    rmSync('matterstorage/SingleDevice', { recursive: true, force: true });
    // Setup the matter environment
    environment.vars.set('log.level', MatterLogLevel.DEBUG);
    environment.vars.set('log.format', MatterLogFormat.ANSI);
    environment.vars.set('path.root', 'matterstorage/SingleDevice');
    environment.vars.set('runtime.signals', false);
    environment.vars.set('runtime.exitcode', false);
  }, 30000);

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('create the server node', async () => {
    // Create the server node
    server = await ServerNode.create({
      id: 'SingleDeviceServerNode',

      productDescription: {
        name: 'SingleDeviceServerNode',
        deviceType: DeviceTypeId(RootEndpoint.deviceType),
        vendorId: VendorId(0xfff1),
        productId: 0x8001,
      },

      // Provide defaults for the BasicInformation cluster on the Root endpoint
      basicInformation: {
        vendorId: VendorId(0xfff1),
        vendorName: 'Matterbridge',
        productId: 0x8001,
        productName: 'Matter test device',
        productLabel: 'SingleDeviceServerNode',
        nodeLabel: 'SingleDeviceServerNode',
        hardwareVersion: 1,
        softwareVersion: 1,
        reachable: true,
      },
    });
    expect(server).toBeDefined();
  });

  test('start the server node', async () => {
    // Run the server
    await server.start();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeTruthy();
  });

  test('log the server node', async () => {
    expect(server).toBeDefined();
    // logEndpoint(EndpointServer.forEndpoint(server));
  });

  test('add an RVC device', async () => {
    expect(server).toBeDefined();
    device = new RoboticVacuumCleaner('RVC Test Device', 'RVC123456');
    expect(device).toBeDefined();
    expect(device.id).toBe('RVCTestDevice-RVC123456');
    // logEndpoint(EndpointServer.forEndpoint(device));
    await server.add(device);
    expect(server.parts.has('RVCTestDevice-RVC123456')).toBeTruthy();
    expect(device.lifecycle.isReady).toBeTruthy();
  });

  test('send commands to the device', async () => {
    expect(device).toBeDefined();
  });

  test('close server node', async () => {
    // Close the server
    expect(server).toBeDefined();
    await server.close();
    expect(server.lifecycle.isReady).toBeTruthy();
    expect(server.lifecycle.isOnline).toBeFalsy();
    // Stop the mDNS service
    await server.env.get(MdnsService)[Symbol.asyncDispose]();
  });
});
