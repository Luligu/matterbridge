// vitest\frontend.test.ts

// oxlint-disable typescript/require-await typescript/explicit-function-return-type typescript/consistent-return typescript/no-floating-promises
/* eslint-disable no-console */

const MATTER_PORT = 9000;
const FRONTEND_PORT = 8284;
const NAME = 'Frontend';

import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { Lifecycle } from '@matter/general';
import { PowerSource } from '@matter/types/clusters/power-source';
import { EndpointNumber } from '@matter/types/datatype';
import { BroadcastServer } from '@matterbridge/thread/server';
import { wait, waiter } from '@matterbridge/utils/wait';
import { flushAsync, HOMEDIR, loggerDebugSpy, loggerInfoSpy, loggerLogSpy, setDebug, setupTest } from '@matterbridge/vitest-utils';
import { db, LogLevel, rs, UNDERLINE, UNDERLINEOFF, YELLOW } from 'node-ansi-logger';
import type { MockedFunction } from 'vitest';
import { WebSocket } from 'ws';

import { cliEmitter } from '../src/cliEmitter.js';
import type { Frontend as FrontendType } from '../src/frontend.js';
import type { Matterbridge as MatterbridgeType } from '../src/matterbridge.js';
import { closeMdnsInstance, destroyInstance } from './vitestUtils.js';

// Mock node:http so createServer can be spied on and overridden in specific tests
vi.mock('node:http', async () => {
  const originalModule = await vi.importActual<typeof import('node:http')>('node:http');
  return {
    ...originalModule,
    createServer: vi.fn((...args) => {
      return originalModule.createServer(...(args as any));
    }),
  };
});
const http = await import('node:http');
const createServerMock = http.createServer as MockedFunction<typeof http.createServer>;

// Dynamically import after mocking
const { Matterbridge } = await import('../src/matterbridge.js');
const { Frontend } = await import('../src/frontend.js');

// Mock BroadcastServer methods
const broadcastServerIsWorkerRequestSpy = vi.spyOn(BroadcastServer.prototype, 'isWorkerRequest').mockImplementation(() => true);
const broadcastServerIsWorkerResponseSpy = vi.spyOn(BroadcastServer.prototype, 'isWorkerResponse').mockImplementation(() => true);
const broadcastServerBroadcastMessageHandlerSpy = vi.spyOn(BroadcastServer.prototype as any, 'broadcastMessageHandler').mockImplementation(() => {});
const broadcastServerRequestSpy = vi.spyOn(BroadcastServer.prototype, 'request').mockImplementation(() => {});
const broadcastServerRespondSpy = vi.spyOn(BroadcastServer.prototype, 'respond').mockImplementation(() => {});
const broadcastServerFetchSpy = vi.spyOn(BroadcastServer.prototype, 'fetch').mockImplementation(async () => {
  return Promise.resolve() as any;
});

// Spy on Frontend methods
const startSpy = vi.spyOn(Frontend.prototype, 'start');
const stopSpy = vi.spyOn(Frontend.prototype, 'stop');

// Setup the test environment
await setupTest(NAME, false);

// setupTest resets process.argv; set the frontend/matter args afterwards
process.argv = [
  'node',
  'frontend.test.js',
  '--novirtual',
  '--test',
  '--homedir',
  HOMEDIR,
  '--frontend',
  FRONTEND_PORT.toString(),
  '--port',
  MATTER_PORT.toString(),
  '--logger',
  'debug',
  '--debug',
  '--verbose',
];

describe('Matterbridge frontend', () => {
  let matterbridge: MatterbridgeType;
  let frontend: FrontendType;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Verify mock of createServer', () => {
    // Call the createServer mock to ensure it is defined
    http.createServer();
    // Verify that the createServer mock is called
    expect(createServerMock).toBeDefined();
    expect(createServerMock).toHaveBeenCalled();
  });

  test('Matterbridge.loadInstance(true)', async () => {
    // Load the Matterbridge instance with frontend enabled
    matterbridge = await Matterbridge.loadInstance(true);
    frontend = matterbridge.frontend;
    expect(matterbridge).toBeDefined();
    expect(frontend).toBeDefined();
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);

    // Clear the timeouts and intervals set by initialize to prevent them from running during tests
    expect((matterbridge as any).systemCheckTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateTimeout).toBeDefined();
    expect((matterbridge as any).checkUpdateInterval).toBeDefined();
    clearTimeout((matterbridge as any).systemCheckTimeout);
    clearTimeout((matterbridge as any).checkUpdateTimeout);
    clearInterval((matterbridge as any).checkUpdateInterval);

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).frontend.httpServer!==undefined; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).frontend.webSocketServer!==undefined; });

    await flushAsync();

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(createServerMock).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}${FRONTEND_PORT}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on`));
  }, 60000);

  test('broadcast handler', async () => {
    startSpy.mockImplementationOnce(async () => Promise.resolve());
    stopSpy.mockImplementationOnce(async () => Promise.resolve());
    broadcastServerIsWorkerRequestSpy.mockImplementationOnce(() => false);
    await (frontend as any).broadcastMsgHandler({} as any);
    broadcastServerIsWorkerResponseSpy.mockImplementationOnce(() => false);
    await (frontend as any).broadcastMsgHandler({} as any);

    expect((frontend as any).server).toBeInstanceOf(BroadcastServer);

    await (frontend as any).broadcastMsgHandler({ type: 'jest', src: 'manager', dst: 'frontend' } as any); // no id
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'unknown' } as any); // unknown dst
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'frontend' } as any); // valid
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'all' } as any); // valid
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'frontend', params: {} } as any);
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } } as any);
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'frontend_start', src: 'manager', dst: 'frontend', params: { port: 3000 } } as any);
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'frontend_stop', src: 'manager', dst: 'frontend', params: { port: 3000 } } as any);
    // prettier-ignore
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'frontend_refreshrequired', src: 'manager', dst: 'frontend', params: { changed: 'matter', matter: {} } } as any);
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'frontend_restartrequired', src: 'manager', dst: 'frontend', params: { snackbar: true, fixed: true } } as any);
    await (frontend as any).broadcastMsgHandler({ id: 123456, type: 'frontend_restartnotrequired', src: 'manager', dst: 'frontend', params: { snackbar: true } } as any);
    await (frontend as any).broadcastMsgHandler({
      id: 123456,
      type: 'frontend_updaterequired',
      src: 'manager',
      dst: 'frontend',
      params: { version: '3.3.0-dev-1', devVersion: true },
    } as any);
    const pluginUpdateSpy = vi.spyOn(frontend, 'wssSendPluginUpdateRequired');
    await (frontend as any).broadcastMsgHandler({
      id: 123456,
      type: 'frontend_pluginupdaterequired',
      src: 'manager',
      dst: 'frontend',
      params: { plugin: 'matterbridge-example', version: '1.2.3', devVersion: true },
    } as any);
    expect(pluginUpdateSpy).toHaveBeenCalledWith('matterbridge-example', '1.2.3', true);
    pluginUpdateSpy.mockRestore();
    await (frontend as any).broadcastMsgHandler({
      id: 123456,
      type: 'frontend_snackbarmessage',
      src: 'manager',
      dst: 'frontend',
      params: { message: 'message', timeout: 5, severity: 'info' },
    } as any);
    await (frontend as any).broadcastMsgHandler({
      id: 123456,
      type: 'frontend_broadcast_message',
      src: 'manager',
      dst: 'frontend',
      params: { msg: { id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'shelly_sys_update', success: true, response: { available: true } } },
    } as any);
    await (frontend as any).broadcastMsgHandler({
      id: 123456,
      type: 'frontend_attributechanged',
      src: 'manager',
      dst: 'frontend',
      params: { plugin: 'test', serialNumber: '1234', uniqueId: 'uniqueId', number: 123, id: 'id', cluster: 'cluster', attribute: 'attribute', value: 'value' },
    } as any);
    await (frontend as any).broadcastMsgHandler({
      id: 123456,
      type: 'frontend_logmessage',
      src: 'manager',
      dst: 'frontend',
      params: { level: 'info', time: 'time', name: 'jest', message: 'info' },
    } as any);
    // prettier-ignore
    {
      await (frontend as any).broadcastMsgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_spawn_response', src: 'manager', dst: 'all', result: { success: true, packageCommand: 'install', packageName: 'testPlugin' } } as any);
      await (frontend as any).broadcastMsgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_spawn_response', src: 'manager', dst: 'all', result: { success: false, packageCommand: 'install', packageName: 'testPlugin' } } as any);
      await (frontend as any).broadcastMsgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_spawn_response', src: 'manager', dst: 'all', result: { success: true, packageCommand: 'uninstall', packageName: 'testPlugin' } } as any);
      await (frontend as any).broadcastMsgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_spawn_response', src: 'manager', dst: 'all', result: { success: false, packageCommand: 'uninstall', packageName: 'testPlugin' } } as any);

      await (frontend as any).broadcastMsgHandler({ id: 123456, timestamp: Date.now(), type: 'manager_archive_response', src: 'manager', dst: 'all', result: { success: true, command: 'zip', archivePath: 'test.zip', sourcePaths: ['file1', 'file2'], destinationPath: 'dest' } } as any);
    }
  });

  test('Frontend cliEmitter', () => {
    // Test the cliEmitter functionality
    expect(cliEmitter).toBeDefined();
    expect(cliEmitter.on).toBeDefined();
    expect(cliEmitter.emit).toBeDefined();
    expect(cliEmitter.listeners('uptime')).toHaveLength(1);
    expect(cliEmitter.listeners('memory')).toHaveLength(1);
    expect(cliEmitter.listeners('cpu')).toHaveLength(1);

    cliEmitter.emit('cpu', 12.34, 5.67);
    cliEmitter.emit('uptime', '1 day, 10:00:00', '1 day, 10:00:00');
    cliEmitter.emit('memory', '12345678', '87654321', '12345678', '87654321', '12345678', '87654321', '12345678');
  });

  test('Frontend validateReq', async () => {
    (frontend as any).authClients.clear();
    let result = (frontend as any).validateReq(
      { ip: '0.0.0.0' } as any,
      {
        status: () => {
          return { json: () => {} };
        },
      } as any,
    );
    expect(result).toBeFalsy();
    (frontend as any).authClients.add('0.0.0.0');
    result = (frontend as any).validateReq(
      { ip: '0.0.0.0' } as any,
      {
        status: () => {
          return { json: () => {} };
        },
      } as any,
    );
    expect(result).toBeTruthy();
    (frontend as any).authClients.clear();
  });

  test('Frontend getApiSettings', async () => {
    const apiSetting = await (frontend as any).getApiSettings();
    expect(apiSetting).toBeDefined();
    expect(apiSetting.systemInformation).toBeDefined();
    expect(apiSetting.matterbridgeInformation).toBeDefined();
  });

  test('Frontend getReachability', () => {
    // False if cleanup has started
    (frontend as any).matterbridge.hasCleanupStarted = true;
    expect((frontend as any).getReachability({})).toBe(false);
    (frontend as any).matterbridge.hasCleanupStarted = false;

    // Test the getReachability functionality
    expect((frontend as any).getReachability({ lifecycle: { isReady: false } })).toBeFalsy();
    expect((frontend as any).getReachability({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBeFalsy();
    expect(
      (frontend as any).getReachability({
        hasClusterServer: () => true,
        getAttribute: () => true,
        lifecycle: { isReady: true },
        construction: { status: Lifecycle.Status.Active },
      }),
    ).toBeTruthy();
    expect(
      (frontend as any).getReachability({
        hasClusterServer: () => false,
        mode: 'server',
        serverNode: { state: { basicInformation: { reachable: true } } },
        lifecycle: { isReady: true },
        construction: { status: Lifecycle.Status.Active },
      }),
    ).toBeTruthy();
    matterbridge.bridgeMode = 'childbridge';
    expect((frontend as any).getReachability({ hasClusterServer: () => false, lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active } })).toBeTruthy();
    matterbridge.bridgeMode = 'bridge';
    expect((frontend as any).getReachability({ hasClusterServer: () => false, lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active } })).toBeFalsy();
  });

  test('Frontend getPowerSource and getBatteryLevel', () => {
    // Undefined if cleanup has started
    (frontend as any).matterbridge.hasCleanupStarted = true;
    expect((frontend as any).getPowerSource({})).toBeUndefined();
    expect((frontend as any).getBatteryLevel({})).toBeUndefined();
    (frontend as any).matterbridge.hasCleanupStarted = false;

    // Undefined if not active
    expect((frontend as any).getPowerSource({ lifecycle: { isReady: false } })).toBeUndefined();
    expect((frontend as any).getPowerSource({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBeUndefined();
    expect((frontend as any).getBatteryLevel({ lifecycle: { isReady: false } })).toBeUndefined();
    expect((frontend as any).getBatteryLevel({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBeUndefined();

    // Wired ac
    let device = {
      lifecycle: { isReady: true },
      construction: { status: Lifecycle.Status.Active },
      hasClusterServer: vi.fn(),
      getAttribute: vi.fn((cluster: number, attribute: string): any => {}),
      getChildEndpoints: vi.fn(),
    };
    device.hasClusterServer = vi.fn(() => true);
    device.getAttribute = vi.fn((cluster: number, attribute: string): any => {
      if (cluster === PowerSource.id && attribute === 'featureMap') return { wired: true };
      if (cluster === PowerSource.id && attribute === 'wiredCurrentType') return PowerSource.WiredCurrentType.Ac;
    });
    expect((frontend as any).getPowerSource(device)).toBe('ac');
    expect((frontend as any).getBatteryLevel(device)).toBeUndefined();

    // Battery
    device = {
      lifecycle: { isReady: true },
      construction: { status: Lifecycle.Status.Active },
      hasClusterServer: vi.fn(),
      getAttribute: vi.fn((cluster: number, attribute: string): any => {}),
      getChildEndpoints: vi.fn(),
    };
    device.hasClusterServer = vi.fn(() => true);
    device.getAttribute = vi.fn((cluster: number, attribute: string): any => {
      if (cluster === PowerSource.id && attribute === 'featureMap') return { battery: true };
      if (cluster === PowerSource.id && attribute === 'batChargeLevel') return PowerSource.BatChargeLevel.Ok;
      if (cluster === PowerSource.id && attribute === 'batPercentRemaining') return 120;
    });
    expect((frontend as any).getPowerSource(device)).toBe('ok');
    expect((frontend as any).getBatteryLevel(device)).toBe(60);
    device.getAttribute = vi.fn((cluster: number, attribute: string): any => {
      if (cluster === PowerSource.id && attribute === 'featureMap') return { battery: true };
      if (cluster === PowerSource.id && attribute === 'batChargeLevel') return PowerSource.BatChargeLevel.Ok;
      if (cluster === PowerSource.id && attribute === 'batPercentRemaining') return;
    });
    expect((frontend as any).getPowerSource(device)).toBe('ok');
    expect((frontend as any).getBatteryLevel(device)).toBe(undefined);
    device.getAttribute = vi.fn((cluster: number, attribute: string): any => {
      if (cluster === PowerSource.id && attribute === 'featureMap') return { battery: true };
      if (cluster === PowerSource.id && attribute === 'batChargeLevel') return PowerSource.BatChargeLevel.Ok;
      if (cluster === PowerSource.id && attribute === 'batPercentRemaining') return 120;
    });

    // Not wired nor battery
    device = {
      lifecycle: { isReady: true },
      construction: { status: Lifecycle.Status.Active },
      hasClusterServer: vi.fn(),
      getAttribute: vi.fn((cluster: number, attribute: string): any => {}),
      getChildEndpoints: vi.fn(),
    };
    device.hasClusterServer = vi.fn(() => true);
    device.getAttribute = vi.fn((cluster: number, attribute: string): any => {
      if (cluster === PowerSource.id && attribute === 'featureMap') return {};
    });
    expect((frontend as any).getPowerSource(device)).toBe(undefined);
    expect((frontend as any).getBatteryLevel(device)).toBe(undefined);
    // Child endpoints
    device.hasClusterServer.mockImplementationOnce(() => false);
    device.getChildEndpoints = vi.fn(() => [device]);
    expect((frontend as any).getPowerSource(device)).toBe(undefined);
    device.hasClusterServer.mockImplementationOnce(() => false);
    expect((frontend as any).getBatteryLevel(device)).toBe(undefined);
  });

  test('Frontend getPlugins', () => {
    (frontend as any).matterbridge.hasCleanupStarted = true;
    expect(frontend.getApiPlugins()).toEqual([]);
    (frontend as any).matterbridge.hasCleanupStarted = false;
    expect(frontend.getApiPlugins()).toEqual([]);
  });

  test('Frontend getDevices', async () => {
    (frontend as any).matterbridge.hasCleanupStarted = true;
    expect(frontend.getApiDevices()).toEqual([]);
    (frontend as any).matterbridge.hasCleanupStarted = false;
    expect(frontend.getApiDevices()).toEqual([]);
  });

  test('Frontend getClusters', async () => {
    (frontend as any).matterbridge.hasCleanupStarted = true;
    expect(frontend.getClusters('', 1)).toBeUndefined();
    (frontend as any).matterbridge.hasCleanupStarted = false;
    expect(frontend.getClusters('', 1)).toBeUndefined();
  });

  test('Frontend getClusterTextFromDevice', () => {
    // Empty if cleanup has started
    (frontend as any).matterbridge.hasCleanupStarted = true;
    expect((frontend as any).getClusterTextFromDevice({})).toBe('');
    (frontend as any).matterbridge.hasCleanupStarted = false;

    // Undefined if not active
    expect((frontend as any).getClusterTextFromDevice({ lifecycle: { isReady: false } })).toBe('');
    expect((frontend as any).getClusterTextFromDevice({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBe('');

    // Drive the attribute chain via a fake device whose forEachAttribute replays the given tuples.
    // Tuples are [clusterName, clusterId, attributeName, attributeId, attributeValue].
    const runTuples = (tuples: [string, number, string, number, any][]): string => {
      const device = {
        lifecycle: { isReady: true },
        construction: { status: Lifecycle.Status.Active },
        forEachAttribute: (cb: (clusterName: string, clusterId: number, attributeName: string, attributeId: number, attributeValue: any) => void) => {
          for (const [cn, ci, an, ai, av] of tuples) cb(cn, ci, an, ai, av);
        },
      };
      return (frontend as any).getClusterTextFromDevice(device);
    };

    // undefined attribute value is skipped early
    expect(runTuples([['onOff', 0x06, 'onOff', 0, undefined]])).toBe('');

    // Simple branches (no getAttribute dependency)
    const text = runTuples([
      ['onOff', 0x06, 'onOff', 0, true],
      ['switch', 0x3b, 'currentPosition', 0, 1],
      ['windowCovering', 0x102, 'currentPositionLiftPercent100ths', 0, 5000],
      ['doorLock', 0x101, 'lockState', 0, 1],
      ['doorLock', 0x101, 'lockState', 0, 2],
      ['thermostat', 0x201, 'localTemperature', 0, 2000],
      ['thermostat', 0x201, 'occupiedHeatingSetpoint', 0, 2100],
      ['thermostat', 0x201, 'occupiedCoolingSetpoint', 0, 2500],
      ['rvcRunMode', 0x54, 'supportedModes', 0, [{ label: 'Cleaning', mode: 1 }]],
      ['rvcRunMode', 0x54, 'currentMode', 0, 1],
      ['rvcRunMode', 0x54, 'currentMode', 0, 99],
      ['operationalState', 0x60, 'operationalState', 0, 'Running'],
      ['rvcOperationalState', 0x61, 'operationalState', 0, 'Docked'],
      ['pumpConfigurationAndControl', 0x200, 'operationMode', 0, 1],
      ['valveConfigurationAndControl', 0x81, 'currentState', 0, 1],
      ['levelControl', 0x08, 'currentLevel', 0, 100],
      ['booleanState', 0x45, 'stateValue', 0, true],
      ['booleanStateConfiguration', 0x80, 'alarmsActive', 0, { foo: true }],
      ['smokeCoAlarm', 0x5c, 'smokeState', 0, 0],
      ['smokeCoAlarm', 0x5c, 'coState', 0, 0],
      ['fanControl', 0x202, 'fanMode', 0, 1],
      ['fanControl', 0x202, 'percentCurrent', 0, 50],
      ['fanControl', 0x202, 'speedCurrent', 0, 3],
      ['occupancySensing', 0x406, 'occupancy', 0, { occupied: true }],
      ['illuminanceMeasurement', 0x400, 'measuredValue', 0, 50000],
      ['airQuality', 0x5b, 'airQuality', 0, 1],
      ['totalVolatileOrganicCompoundsConcentrationMeasurement', 0x42e, 'measuredValue', 0, 10],
      ['pm1ConcentrationMeasurement', 0x42c, 'measuredValue', 0, 5],
      ['pm25ConcentrationMeasurement', 0x42a, 'measuredValue', 0, 5],
      ['pm10ConcentrationMeasurement', 0x42d, 'measuredValue', 0, 5],
      ['formaldehydeConcentrationMeasurement', 0x42b, 'measuredValue', 0, 5],
      ['temperatureMeasurement', 0x402, 'measuredValue', 0, 2000],
      ['relativeHumidityMeasurement', 0x405, 'measuredValue', 0, 5000],
      ['pressureMeasurement', 0x403, 'measuredValue', 0, 1000],
      ['flowMeasurement', 0x404, 'measuredValue', 0, 100],
    ]);
    expect(text).toContain('OnOff: true');
    expect(text).toContain('Position: 1');
    expect(text).toContain('Cover position: 50%');
    expect(text).toContain('State: Locked');
    expect(text).toContain('State: Not locked');
    expect(text).toContain('Temperature: 20°C');
    expect(text).toContain('Heat to: 21°C');
    expect(text).toContain('Cool to: 25°C');
    expect(text).toContain('Mode: Cleaning');
    expect(text).toContain('OpState: Running');
    expect(text).toContain('OpState: Docked');
    expect(text).toContain('Level: 100');
    expect(text).toContain('Contact: true');
    expect(text).toContain('Active alarms:');
    expect(text).toContain('Smoke: 0');
    expect(text).toContain('Co: 0');
    expect(text).toContain('Occupancy: true');
    expect(text).toContain('Air quality: 1');
    expect(text).toContain('Pm2.5: 5');
    expect(text).toContain('Humidity: 50%');

    // isValid* false sides (out-of-range / wrong-type values are not appended)
    const skipped = runTuples([
      ['windowCovering', 0x102, 'currentPositionLiftPercent100ths', 0, 20000],
      ['thermostat', 0x201, 'localTemperature', 0, 'x'],
      ['thermostat', 0x201, 'occupiedHeatingSetpoint', 0, 'x'],
      ['thermostat', 0x201, 'occupiedCoolingSetpoint', 0, 'x'],
      ['booleanStateConfiguration', 0x80, 'alarmsActive', 0, 'not-an-object'],
      ['occupancySensing', 0x406, 'occupancy', 0, 'not-an-object'],
      ['illuminanceMeasurement', 0x400, 'measuredValue', 0, 'x'],
      ['temperatureMeasurement', 0x402, 'measuredValue', 0, 'x'],
      ['relativeHumidityMeasurement', 0x405, 'measuredValue', 0, 'x'],
    ]);
    expect(skipped).toBe('');
  });

  test('Frontend wssSendLogMessage', async () => {
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendLogMessage('info', '12:00', 'Test', 'Message')).toBeUndefined();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendLogMessage('info', '12:00', 'Test', undefined as any)).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();

    expect(frontend.wssSendLogMessage('spawn', '12:00', 'Test', 'Message')).toBeUndefined();
    expect(spy).toHaveBeenCalledWith({
      dst: 'Frontend',
      id: 0,
      method: 'log',
      response: { level: 'spawn', message: 'Message', name: 'Test', time: '12:00' },
      src: 'Matterbridge',
      success: true,
    });
    vi.clearAllMocks();

    expect(frontend.wssSendLogMessage('info', '12:00', 'Test', 'Message')).toBeUndefined();
    expect(spy).toHaveBeenCalledWith({
      dst: 'Frontend',
      id: 0,
      method: 'log',
      response: { level: 'info', message: 'Message', name: 'Test', time: '12:00' },
      src: 'Matterbridge',
      success: true,
    });
    vi.clearAllMocks();

    expect(
      frontend.wssSendLogMessage(
        'info',
        '12:00',
        'Test',
        'Messageaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      ),
    ).toBeUndefined();
    expect(spy).toHaveBeenCalledWith({
      dst: 'Frontend',
      id: 0,
      method: 'log',
      response: { level: 'info', message: 'Messageaaaaaaaaaaaaa ... aaaaaaaaaaaaaaaaaaaa', name: 'Test', time: '12:00' },
      src: 'Matterbridge',
      success: true,
    });

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssSendRefreshRequired', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendRefreshRequired('settings')).toBeUndefined();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendRefreshRequired('settings')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssSendRestartRequired', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendRestartRequired()).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendRestartRequired()).toBeUndefined();
    expect(frontend.wssSendRestartRequired(false)).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(3);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssSendRestartNotRequired', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendRestartNotRequired()).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendRestartNotRequired()).toBeUndefined();
    expect(frontend.wssSendRestartNotRequired(false)).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(3);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssSendUpdateRequired', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendUpdateRequired('3.3.0')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendUpdateRequired('3.3.0')).toBeUndefined();
    expect(frontend.wssSendUpdateRequired('3.3.0', true)).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, {
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'update_required',
      success: true,
      response: { version: '3.3.0', devVersion: false },
    });
    expect(spy).toHaveBeenNthCalledWith(2, {
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'update_required',
      success: true,
      response: { version: '3.3.0', devVersion: true },
    });
    expect((frontend as any).updateRequired).toBe(true);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    (frontend as any).updateRequired = false;
    spy.mockRestore();
  });

  test('Frontend wssSendPluginUpdateRequired', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendPluginUpdateRequired('matterbridge-example', '1.2.3')).toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendPluginUpdateRequired('matterbridge-example', '1.2.3')).toBeUndefined();
    expect(frontend.wssSendPluginUpdateRequired('matterbridge-example', '1.2.4', true)).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, {
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'plugin_update_required',
      success: true,
      response: { plugin: 'matterbridge-example', version: '1.2.3', devVersion: false },
    });
    expect(spy).toHaveBeenNthCalledWith(2, {
      id: 0,
      src: 'Matterbridge',
      dst: 'Frontend',
      method: 'plugin_update_required',
      success: true,
      response: { plugin: 'matterbridge-example', version: '1.2.4', devVersion: true },
    });
    expect((frontend as any).updateRequired).toBe(false);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    (frontend as any).updateRequired = false;
    spy.mockRestore();
  });

  test('Frontend wssSendCpuUpdate wssSendMemoryUpdate wssSendUptimeUpdate', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendCpuUpdate(1, 1)).toBeUndefined();
    expect(frontend.wssSendMemoryUpdate('', '', '', '', '', '', '')).toBeUndefined();
    expect(frontend.wssSendUptimeUpdate('', '')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendCpuUpdate(1, 1)).toBeUndefined();
    expect(frontend.wssSendMemoryUpdate('', '', '', '', '', '', '')).toBeUndefined();
    expect(frontend.wssSendUptimeUpdate('', '')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(3);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssSendSnackbarMessage  wssSendCloseSnackbarMessage', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendSnackbarMessage('Message')).toBeUndefined();
    expect(frontend.wssSendCloseSnackbarMessage('Message')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendSnackbarMessage('Message', 2, 'success')).toBeUndefined();
    expect(frontend.wssSendCloseSnackbarMessage('Message')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(2);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssSendAttributeChangedMessage', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;
    const spy = vi.spyOn(frontend, 'wssBroadcastMessage').mockImplementation(() => {});

    (frontend as any).listening = false;
    expect(frontend.wssSendAttributeChangedMessage('plugin', 'serialNumber', 'uniqueId', EndpointNumber(1), 'id', 'cluster', 'attribute', 'value')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(0);
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{}]) } as any;
    expect(frontend.wssSendAttributeChangedMessage('plugin', 'serialNumber', 'uniqueId', EndpointNumber(1), 'id', 'cluster', 'attribute', 'value')).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
    spy.mockRestore();
  });

  test('Frontend wssBroadcastMessage', async () => {
    // Mocks
    const savedWss = (frontend as any).webSocketServer;

    (frontend as any).listening = false;
    expect(frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'api' } as any)).toBeUndefined();
    vi.clearAllMocks();
    (frontend as any).listening = true;
    (frontend as any).webSocketServer = { clients: new Set([{ send: () => {} }]) } as any;
    expect(frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log' } as any)).toBeUndefined();
    expect(frontend.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'api' } as any)).toBeUndefined();

    // Restore for next tests
    (frontend as any).webSocketServer = savedWss;
    (frontend as any).listening = false;
  });

  test('WebSocketServer connection and message', async () => {
    const client = new WebSocket(`ws://localhost:${FRONTEND_PORT}`);
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
    });

    client.ping(); // Send a ping to test the handler

    client.pong(); // Send a pong to test the handler

    await new Promise<void>((resolve, reject) => {
      client.on('close', () => {
        console.warn(`WebSocket connection closed`);
        resolve();
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
      client.close(); // Close the connection
    });

    await wait(100); // Wait a bit for the async log
    expect(loggerDebugSpy).toHaveBeenCalledWith(`WebSocket client ping received`);
    expect(loggerDebugSpy).toHaveBeenCalledWith(`WebSocket client pong received`);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`WebSocket client disconnected`);
    expect(client.removeAllListeners()).toBeDefined();
  });

  test('WebSocketServer connection and message with no password', async () => {
    frontend.storedPassword = 'testpassword';
    const client = new WebSocket(`ws://localhost:${FRONTEND_PORT}`);
    await new Promise<void>((resolve, reject) => {
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        resolve();
      });
    });

    expect(client.removeAllListeners()).toBeDefined();
  });

  test('WebSocketServer connection and message with correct password', async () => {
    frontend.storedPassword = 'testpassword';
    const client = new WebSocket(`ws://localhost:${FRONTEND_PORT}?password=testpassword`);
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
    });

    await new Promise<void>((resolve, reject) => {
      client.on('close', () => {
        console.warn(`WebSocket connection closed`);
        resolve();
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
      client.close(); // Close the connection
    });

    expect(client.removeAllListeners()).toBeDefined();
  });

  test('Frontend.stop()', async () => {
    // Stop the frontend
    await matterbridge.frontend.stop();

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stopping the frontend...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend app closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Http server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend stopped successfully`);
  });

  test('Frontend.start() with createServerMock', async () => {
    process.argv = ['node', 'frontend.test.js', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    createServerMock.mockImplementationOnce(() => {
      throw new Error('Test error');
    });

    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
      frontend.start(FRONTEND_PORT);
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(createServerMock).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Failed to create HTTP server: Test error`));
  });

  test('Frontend.start()', async () => {
    process.argv = ['node', 'frontend.test.js', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];
    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_listening', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);

    // Test httpServer on error
    const errorEACCES = new Error('Test error');
    (errorEACCES as any).code = 'EACCES';
    (frontend as any).httpServer.emit('error', errorEACCES);

    const errorEADDRINUSE = new Error('Test error');
    (errorEADDRINUSE as any).code = 'EADDRINUSE';
    (frontend as any).httpServer.emit('error', errorEADDRINUSE);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Port ${FRONTEND_PORT} requires elevated privileges`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Port ${FRONTEND_PORT} is already in use`);
  });

  test('Frontend.stop() II', async () => {
    // Stop the frontend
    await matterbridge.frontend.stop();

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stopping the frontend...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend app closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Http server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend stopped successfully`);
  });

  test('Frontend.start() -ssl without certs shall reject', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading certificate file`));
  });

  test('Frontend.start() -ssl without key certs shall reject', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    copyFileSync(new URL('../src/mock/certs/server.crt', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pem'));

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading key file`));
  });

  test('Frontend.start() -ssl without ca cert', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    copyFileSync(new URL('../src/mock/certs/server.key', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/key.pem'));

    await new Promise<void>((resolve) => {
      frontend.on('server_listening', (protocol, port) => {
        expect(protocol).toBe('https');
        expect(port).toBe(FRONTEND_PORT);
        resolve();
      });
      frontend.on('websocket_server_listening', (protocol) => {
        expect(protocol).toBe('wss');
        // resolve();
      });
      frontend.start(FRONTEND_PORT);
    });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeDefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded certificate file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded key file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`ca.pem not loaded`));

    await new Promise<void>((resolve) => {
      frontend.on('websocket_server_stopped', () => {
        // console.log(`WebSocket server stopped`);
      });
      frontend.on('server_stopped', () => {
        // console.log(`Server stopped`);
        resolve();
      });
      frontend.stop();
    });
  });

  test('Frontend.start() -ssl with ca cert', async () => {
    process.argv = [
      'node',
      'frontend.test.js',
      '-ingress',
      '-ssl',
      '-novirtual',
      '-test',
      '-homedir',
      HOMEDIR,
      '-frontend',
      FRONTEND_PORT.toString(),
      '-port',
      MATTER_PORT.toString(),
    ];

    copyFileSync(new URL('../src/mock/certs/ca.crt', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/ca.pem'));

    await new Promise<void>((resolve) => {
      frontend.on('server_listening', (protocol, port) => {
        expect(protocol).toBe('https');
        expect(port).toBe(FRONTEND_PORT);
        resolve();
      });
      frontend.on('websocket_server_listening', (protocol) => {
        expect(protocol).toBe('wss');
        // resolve();
      });
      frontend.start(FRONTEND_PORT);
    });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeDefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded p12 certificate file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded p12 passphrase file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded certificate file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded key file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded CA certificate file`));

    const client = new WebSocket(`wss://localhost:${FRONTEND_PORT}`, {
      ca: readFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/ca.pem'), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('message', (data) => {
        // oxlint-disable-next-line typescript/no-base-to-string typescript/restrict-template-expressions
        console.log(`Received message: ${data}`);
      });
      client.on('close', () => {
        console.warn(`WebSocket connection closed`);
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
    });
    client.close();
    client.removeAllListeners();

    frontend.storedPassword = 'testpassword';
    const client2 = new WebSocket(`wss://localhost:${FRONTEND_PORT}`, {
      ca: readFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/ca.pem'), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client2.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        resolve();
        client2.close();
        client2.removeAllListeners();
      });
    });

    frontend.storedPassword = 'testpassword';
    const client3 = new WebSocket(`wss://localhost:${FRONTEND_PORT}?password=testpassword`, {
      ca: readFileSync(path.join(matterbridge.matterbridgeDirectory, 'certs/ca.pem'), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client3.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
        client3.close();
        client3.removeAllListeners();
      });
      client3.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
    });
    frontend.storedPassword = '';

    // Test httpsServer on error
    const errorEACCES = new Error('Test error');
    (errorEACCES as any).code = 'EACCES';
    (frontend as any).httpsServer.emit('error', errorEACCES);

    const errorEADDRINUSE = new Error('Test error');
    (errorEADDRINUSE as any).code = 'EADDRINUSE';
    (frontend as any).httpsServer.emit('error', errorEADDRINUSE);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Port ${FRONTEND_PORT} requires elevated privileges`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Port ${FRONTEND_PORT} is already in use`);

    await new Promise<void>((resolve) => {
      frontend.on('websocket_server_stopped', () => {
        // console.log(`WebSocket server stopped`);
      });
      frontend.on('server_stopped', () => {
        // console.log(`Server stopped`);
        resolve();
      });
      frontend.stop();
    });
    await wait(500); // Wait for the server to stop completely
  });

  test('Frontend.start() -ssl with p12 cert', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    copyFileSync(new URL('../src/mock/certs/server.p12', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.p12'));
    copyFileSync(new URL('../src/mock/certs/server.pass', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pass'));

    // Test the frontend error on start with p12 certificate
    loggerLogSpy.mockImplementation((...args: string[]) => {
      if (args[1].startsWith('Loaded p12 certificate file')) {
        throw new Error('Test error');
      }
    });
    await frontend.start(FRONTEND_PORT);

    // Test the frontend error on start with p12 passphrase
    loggerLogSpy.mockImplementation((...args: string[]) => {
      if (args[1].startsWith('Loaded p12 passphrase file')) {
        throw new Error('Test error');
      }
    });
    await frontend.start(FRONTEND_PORT);

    // Test the frontend error on start
    loggerLogSpy.mockImplementation((...args: string[]) => {
      if (args[1].startsWith('Creating HTTPS server')) {
        throw new Error('Test error');
      }
    });
    await frontend.start(FRONTEND_PORT);

    setDebug(false); // Restore the mocks!!!

    await new Promise<void>((resolve) => {
      frontend.on('server_listening', (protocol, port) => {
        expect(protocol).toBe('https');
        expect(port).toBe(FRONTEND_PORT);
        resolve();
      });
      frontend.on('websocket_server_listening', (protocol) => {
        expect(protocol).toBe('wss');
        // resolve();
      });
      frontend.start(FRONTEND_PORT);
    });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeDefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded p12 certificate file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded p12 passphrase file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded certificate file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded key file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded CA certificate file`));

    const client = new WebSocket(`wss://localhost:${FRONTEND_PORT}`, {
      ca: readFileSync(new URL('../src/mock/certs/ca.crt', import.meta.url), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('message', (data) => {
        // oxlint-disable-next-line typescript/no-base-to-string typescript/restrict-template-expressions
        console.log(`Received message: ${data}`);
      });
      client.on('close', () => {
        console.warn(`WebSocket connection closed`);
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
    });
    client.ping(); // Send a ping to test the connection
    client.pong(); // Send a pong to test the connection
    client.send('test'); // Send a message to test the connection

    await new Promise<void>((resolve) => {
      frontend.on('websocket_server_stopped', () => {
        // console.log(`WebSocket server stopped`);
      });
      frontend.on('server_stopped', () => {
        // console.log(`Server stopped`);
        resolve();
      });
      frontend.stop();
    });
  });

  test('Frontend.start() -ssl with p12 cert and mTLS', async () => {
    process.argv = [
      'node',
      'frontend.test.js',
      '-ssl',
      '-mtls',
      '-novirtual',
      '-test',
      '-homedir',
      HOMEDIR,
      '-frontend',
      FRONTEND_PORT.toString(),
      '-port',
      MATTER_PORT.toString(),
    ];

    copyFileSync(new URL('../src/mock/certs/server.p12', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.p12'));
    copyFileSync(new URL('../src/mock/certs/server.pass', import.meta.url), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pass'));

    await new Promise<void>((resolve) => {
      frontend.on('server_listening', (protocol, port) => {
        expect(protocol).toBe('https');
        expect(port).toBe(FRONTEND_PORT);
        resolve();
      });
      frontend.on('websocket_server_listening', (protocol) => {
        expect(protocol).toBe('wss');
        // resolve();
      });
      frontend.start(FRONTEND_PORT);
    });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeDefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded p12 certificate file`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded p12 passphrase file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded certificate file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded key file`));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Loaded CA certificate file`));

    const client = new WebSocket(`wss://localhost:${FRONTEND_PORT}`, {
      cert: readFileSync(new URL('../src/mock/certs/client.crt', import.meta.url), 'utf8'), // Provide certificate for validation
      key: readFileSync(new URL('../src/mock/certs/client.key', import.meta.url), 'utf8'), // Provide key for validation
      ca: readFileSync(new URL('../src/mock/certs/ca.crt', import.meta.url), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('message', (data) => {
        // oxlint-disable-next-line typescript/no-base-to-string typescript/restrict-template-expressions
        console.log(`Received message: ${data}`);
      });
      client.on('close', () => {
        console.warn(`WebSocket connection closed`);
      });
      client.on('error', (error) => {
        console.error(`WebSocket error: ${error}`);
        reject(error);
      });
    });
    client.ping(); // Send a ping to test the connection
    client.pong(); // Send a pong to test the connection
    client.send('test'); // Send a message to test the connection

    await new Promise<void>((resolve) => {
      frontend.on('websocket_server_stopped', () => {
        // console.log(`WebSocket server stopped`);
      });
      frontend.on('server_stopped', () => {
        // console.log(`Server stopped`);
        resolve();
      });
      frontend.stop();
    });
  });

  test('Matterbridge.destroyInstance()', async () => {
    // Destroy the Matterbridge instance
    await destroyInstance(matterbridge);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('Cleanup completed. Shutting down...'));
    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect((frontend as any).httpServer).toBeUndefined();
    expect((frontend as any).httpsServer).toBeUndefined();
    expect((frontend as any).expressApp).toBeUndefined();
    expect((frontend as any).webSocketServer).toBeUndefined();

    // Close mDNS instance
    // await closeMdnsInstance(matterbridge);
  });
});
