// src\frontend.websocket.test.ts
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'frontend.test.js', '-frontend', '8284', '-logger', 'info', '-matterlogger', 'info', '-bridge', '-profile', 'JestFrontendWebsocket', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { expect, jest } from '@jest/globals';
import path from 'node:path';
import { LogLevel as MatterLogLevel } from '@matter/main';
import { AnsiLogger, CYAN, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import WebSocket from 'ws';

import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/export.js';
import { onOffLight, onOffOutlet, onOffSwitch, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { Identify } from '@matter/main/clusters';
import { RegisteredPlugin } from './matterbridgeTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { WS_ID_CLOSE_SNACKBAR, WS_ID_CPU_UPDATE, WS_ID_LOG, WS_ID_MEMORY_UPDATE, WS_ID_REFRESH_NEEDED, WS_ID_RESTART_NEEDED, WS_ID_SNACKBAR, WS_ID_STATEUPDATE, WS_ID_UPDATE_NEEDED, WS_ID_UPTIME_UPDATE } from './frontend.js';

jest.unstable_mockModule('./shelly.ts', () => ({
  triggerShellySysUpdate: jest.fn(() => Promise.resolve()),
  triggerShellyMainUpdate: jest.fn(() => Promise.resolve()),
  createShellySystemLog: jest.fn(() => Promise.resolve()),
  triggerShellySoftReset: jest.fn(() => Promise.resolve()),
  triggerShellyHardReset: jest.fn(() => Promise.resolve()),
  triggerShellyReboot: jest.fn(() => Promise.resolve()),
  triggerShellyChangeIp: jest.fn(() => Promise.resolve()),
}));
const { triggerShellySysUpdate, triggerShellyMainUpdate, createShellySystemLog, triggerShellySoftReset, triggerShellyHardReset, triggerShellyReboot, triggerShellyChangeIp } = await import('./shelly.ts');

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  return undefined as never;
});

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

let WS_ID = 10050;

describe('Matterbridge frontend', () => {
  let matterbridge: Matterbridge;
  let baseUrl: string;
  let ws: WebSocket;

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

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  const waitMessageId = async (id: number, method?: string, message?: Record<string, any>): Promise<Record<string, any>> => {
    const response = new Promise<Record<string, any>>((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        // console.log('received message:', event.data);
        const data = JSON.parse(event.data as string);
        expect(data).toBeDefined();
        if (data.id === id && (method ? data.method === method : true)) {
          ws.removeEventListener('message', onMessage);
          resolve(data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    if (message) {
      ws.send(JSON.stringify(message));
      // console.log('sent message:', message);
    }
    return response;
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    ws.close();
  }, 60000);

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('JestFrontendWebsocket');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);

    await waiter('Matter server node started', () => {
      return matterbridge.serverNode?.lifecycle.isOnline === true;
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8284${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8284${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
  }, 60000);

  test('Reset Jest plugins', async () => {
    matterbridge.plugins.clear();
    expect(await matterbridge.plugins.saveToStorage()).toBe(0);
  });

  test('Add mock plugin 1', async () => {
    await (matterbridge as any).plugins.add('./src/mock/plugin1');
    const plugins: RegisteredPlugin[] = (matterbridge as any).plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(1);
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect((matterbridge as any).plugins.size).toBe(1);
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeTruthy();
    expect((matterbridge as any).plugins.get('matterbridge-mock1')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
  }, 60000);

  test('Add mock plugin 2', async () => {
    await (matterbridge as any).plugins.add('./src/mock/plugin2');
    const plugins: RegisteredPlugin[] = (matterbridge as any).plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(2);
    expect(plugins[1].name).toBe('matterbridge-mock2');
    expect(plugins[1].version).toBe('1.0.2');
    expect(plugins[1].description).toBe('Matterbridge mock plugin 2');
    expect((matterbridge as any).plugins.size).toBe(2);
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeTruthy();
    expect((matterbridge as any).plugins.get('matterbridge-mock2')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock2${nf}`);
  }, 60000);

  test('Add mock plugin 3', async () => {
    await (matterbridge as any).plugins.add('./src/mock/plugin3');
    const plugins: RegisteredPlugin[] = (matterbridge as any).plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(3);
    expect(plugins[2].name).toBe('matterbridge-mock3');
    expect(plugins[2].version).toBe('1.0.3');
    expect(plugins[2].description).toBe('Matterbridge mock plugin 3');
    expect((matterbridge as any).plugins.size).toBe(3);
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeTruthy();
    expect((matterbridge as any).plugins.get('matterbridge-mock3')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
  }, 60000);

  test('Start mock plugin 1', async () => {
    const plugin = (matterbridge as any).plugins.get('matterbridge-mock1');
    await (matterbridge as any).plugins.load(plugin, true, 'Jest test', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Loaded plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Started plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Configured plugin/));
  }, 60000);

  test('Start mock plugin 2', async () => {
    const plugin = (matterbridge as any).plugins.get('matterbridge-mock2');
    await (matterbridge as any).plugins.load(plugin, true, 'Jest test', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Loaded plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Started plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Configured plugin/));
  }, 60000);

  test('Start mock plugin 3', async () => {
    const plugin = (matterbridge as any).plugins.get('matterbridge-mock3');
    await (matterbridge as any).plugins.load(plugin, true, 'Jest test', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Loaded plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Started plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Configured plugin/));
  }, 60000);

  test('create an switch device: Switch 1 for plugin matterbridge-mock1', async () => {
    const device = new MatterbridgeEndpoint(onOffSwitch);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Switch 1', 'SerialSwitch1', 1, 'VendorName', 'ProductName');
    device.addChildDeviceTypeWithClusterServer('Temperature:0', [temperatureSensor]);
    device.plugin = 'matterbridge-mock1';
    await matterbridge.addBridgedEndpoint('matterbridge-mock1', device);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged endpoint/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged endpoint/));
  }, 60000);

  test('create an light device: Light 1 for plugin matterbridge-mock2', async () => {
    const device = new MatterbridgeEndpoint(onOffLight);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Light 1', 'SerialLight1', 1, 'VendorName', 'ProductName');
    device.plugin = 'matterbridge-mock2';
    await matterbridge.addBridgedEndpoint('matterbridge-mock2', device);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged endpoint/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged endpoint/));
  }, 60000);

  test('create an outlet device: Outlet 1 for plugin matterbridge-mock3', async () => {
    const device = new MatterbridgeEndpoint(onOffOutlet);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Outlet 1', 'SerialOutlet1', 1, 'VendorName', 'ProductName');
    device.plugin = 'matterbridge-mock3';
    await matterbridge.addBridgedEndpoint('matterbridge-mock3', device);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged endpoint/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged endpoint/));
  }, 60000);

  test('create Websocket', async () => {
    ws = new WebSocket(`ws://localhost:8284`);
    expect(ws).toBeDefined();
    // prettier-ignore
    await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));
  }, 60000);

  test('Websocket API send bad json message', async () => {
    ws.send('This is not a JSON message');
    await wait(1000);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Error parsing message/), expect.stringMatching(/^Unexpected token/));
  }, 60000);

  test('Websocket API send wrong message', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/settings', { id: WS_ID, dst: 'Matter', src: 'Jest test', method: '/api/settings', params: {} });
    expect(msg.error).toBe('Invalid message');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid message from websocket client/));
  }, 60000);

  test('Websocket API send wrong method', async () => {
    const msg = await waitMessageId(++WS_ID, '/api', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api', params: {} });
    expect(msg.error).toBe('Invalid method');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid method from websocket client/));
  }, 60000);

  test('Websocket API send /api/login with no nodeContext', async () => {
    const context = (matterbridge as any).nodeContext;
    (matterbridge as any).nodeContext = undefined;
    const msg = await waitMessageId(++WS_ID, '/api/login', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    expect(msg.error).toBe('Internal error: nodeContext not found');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Login nodeContext not found/));
    (matterbridge as any).nodeContext = context;
  }, 60000);

  test('Websocket API send /api/login with empty password', async () => {
    await (matterbridge as any).nodeContext.set('password', '');
    const msg = await waitMessageId(++WS_ID, '/api/login', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    expect(msg.response).toEqual({ valid: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
  }, 60000);

  test('Websocket API send /api/login with password', async () => {
    await (matterbridge as any).nodeContext.set('password', '');
    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: 'test' } }));
    const msg = await waitMessageId(WS_ID);
    expect(msg.response).toEqual({ valid: true });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
  }, 60000);

  test('Websocket API send /api/login with wrong password', async () => {
    await (matterbridge as any).nodeContext.set('password', 'abcdef');
    const msg = await waitMessageId(++WS_ID, '/api/login', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    expect(msg.error).toBe('Wrong password');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Error wrong password/));
    await (matterbridge as any).nodeContext.set('password', '');
  }, 60000);

  test('Websocket API send ping', async () => {
    const msg = await waitMessageId(++WS_ID, 'ping', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: 'ping', params: {} });
    expect(msg.response).toBe('pong');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/restart', async () => {
    const restart = jest.spyOn(matterbridge as any, 'restartProcess').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/restart', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/restart', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(restart).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/shutdown', async () => {
    const shutdown = jest.spyOn(matterbridge as any, 'shutdownProcess').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/shutdown', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shutdown', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(shutdown).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/unregister', async () => {
    const unregister = jest.spyOn(matterbridge as any, 'unregisterAndShutdownProcess').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/unregister', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/unregister', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(unregister).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/reset', async () => {
    const reset = jest.spyOn(matterbridge as any, 'shutdownProcessAndReset').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/reset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/reset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(reset).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/shellysysupdate', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellysysupdate', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellysysupdate', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellySysUpdate).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/shellymainupdate', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellymainupdate', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellymainupdate', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyMainUpdate).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/shellycreatesystemlog', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellycreatesystemlog', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellycreatesystemlog', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(createShellySystemLog).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/shellynetconfig', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellynetconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellynetconfig', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyChangeIp).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/softreset', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/softreset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/softreset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellySoftReset).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/hardreset', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/hardreset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/hardreset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyHardReset).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/reboot', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/reboot', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/reboot', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyReboot).toHaveBeenCalled();
  }, 60000);

  test('Websocket API send /api/settings', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/settings', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/settings', params: {} });
    expect(msg.response.matterbridgeInformation).toBeDefined();
    expect(msg.response.systemInformation).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/plugins', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/plugins', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/plugins', params: {} });
    expect(msg.response.length).toBe(3);
    expect(msg.response[0].name).toBe('matterbridge-mock1');
    expect(msg.response[1].name).toBe('matterbridge-mock2');
    expect(msg.response[2].name).toBe('matterbridge-mock3');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/devices', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/devices', params: {} });
    expect(msg.response.length).toBe(6);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/devices with params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/devices', params: { pluginName: 'matterbridge-mock1' } });
    expect(msg.response.length).toBe(2);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/clusters without params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: {} });
    expect(msg.error).toBe('Wrong parameter plugin in /api/clusters');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/clusters with wrong params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1' } });
    expect(msg.error).toBe('Wrong parameter endpoint in /api/clusters');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/clusters', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1', endpoint: 2 } });
    expect(msg.error).toBeUndefined();
    expect(msg.response).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/select without plugin param', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select', params: {} });
    expect(msg.error).toBe('Wrong parameter plugin in /api/select');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/select with wrong plugin', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select', params: { plugin: 'matterbridge_unknown' } });
    expect(msg.error).toBe('Plugin not found in /api/select');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/select', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select', params: { plugin: 'matterbridge-mock1' } });
    expect(msg.error).toBeUndefined();
    expect(msg.response.length).toBe(1);
    expect(msg.response).toEqual([
      {
        name: 'Switch plugin 1',
        pluginName: 'matterbridge-mock1',
        serial: '0x123456789',
        configUrl: '192.168.0.0',
        icon: 'hub',
        entities: [
          {
            description: 'Switch',
            icon: 'matter',
            name: 'Switch',
          },
        ],
      },
    ]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/select/entities without plugin param', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/entities', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: {} });
    expect(msg.error).toBe('Wrong parameter plugin in /api/select/entities');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/select/entities with wrong plugin', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/entities', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: { plugin: 'matterbridge_unknown' } });
    expect(msg.error).toBe('Plugin not found in /api/select/entities');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/select/entities', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/entities', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: { plugin: 'matterbridge-mock1' } });
    expect(msg.error).toBeUndefined();
    expect(msg.response).toEqual([{ description: 'Switch', icon: 'matter', name: 'Switch', pluginName: 'matterbridge-mock1' }]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API /api/install without params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: {} });
    expect(msg.response).not.toBeDefined();
    expect(msg.error).toBe('Wrong parameter in /api/install');
  }, 60000);

  test('Websocket API /api/install with wrong params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbri' } });
    expect(msg.response).not.toBeDefined();
    expect(msg.error).toBe('Wrong parameter in /api/install');
  }, 60000);

  test('Websocket API /api/install', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbridge-test', restart: false } });
    expect(msg.response).toBe(true);
    expect(msg.error).not.toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/installed correctly$/));
  }, 60000);

  test('Websocket API /api/install with wrong package name', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbridge-xxxtest', restart: false } });
    expect(msg.response).toBeUndefined();
    expect(msg.error).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
  }, 60000);

  test('Websocket API /api/uninstall with wrong params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/uninstall', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbri' } });
    expect(msg.response).not.toBeDefined();
    expect(msg.error).toBe('Wrong parameter packageName in /api/uninstall');
  }, 60000);

  test('Websocket API /api/uninstall', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/uninstall', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-test' } });
    expect(msg.response).toBe(true);
    expect(msg.error).not.toBeDefined();
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Shutting down plugin/));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Removed plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('closed with code 0'));
  }, 60000);

  test('Websocket API /api/uninstall with wrong package name', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/uninstall', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-st' } });
    expect(msg.response).toBeDefined();
    expect(msg.error).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
  }, 60000);

  test('Websocket API /api/uninstall wrong package name with mock', async () => {
    // Mock `spawnCommand` to reject with an error
    jest.spyOn(matterbridge as any, 'spawnCommand').mockRejectedValueOnce(new Error('Package not found'));

    const msg = await waitMessageId(++WS_ID, '/api/uninstall', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-st' } });
    expect(msg.response).toBeUndefined();
    expect(msg.error).toBeDefined();
  }, 60000);

  test('Websocket API /api/addplugin', async () => {
    const pluginNameOrPath = path.join('.', 'src', 'mock', 'plugin4');
    const data = await waitMessageId(++WS_ID, '/api/addplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/addplugin', params: { pluginNameOrPath } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBe('matterbridge-mock4');
    await waiter('matterbridge-mock4 loaded', () => {
      return matterbridge.plugins.get('matterbridge-mock4')?.loaded === true;
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added plugin/));
  }, 60000);

  test('Websocket API /api/disableplugin', async () => {
    const pluginName = 'matterbridge-mock4';
    const data = await waitMessageId(++WS_ID, '/api/disableplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/disableplugin', params: { pluginName } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    await waiter('matterbridge-mock4 disabled', () => {
      return matterbridge.plugins.get('matterbridge-mock4')?.enabled === false;
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Disabled plugin/));
  }, 60000);

  test('Websocket API /api/enableplugin', async () => {
    const pluginName = 'matterbridge-mock4';
    const data = await waitMessageId(++WS_ID, '/api/enableplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/enableplugin', params: { pluginName } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    await waiter('matterbridge-mock4 enabled', () => {
      return matterbridge.plugins.get('matterbridge-mock4')?.enabled === true;
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Enabled plugin/));
  }, 60000);

  test('Websocket API /api/savepluginconfig', async () => {
    const pluginName = 'matterbridge-mock4';
    const formData = { name: 'matterbridge-mock4', type: 'AccessoryPlatform', debug: false, unregisterOnShutdown: false, version: '1.2.2' };
    const data = await waitMessageId(++WS_ID, '/api/savepluginconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/savepluginconfig', params: { pluginName, formData } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Saving config for plugin/));
  }, 60000);

  test('Websocket API /api/removeplugin', async () => {
    const pluginName = 'matterbridge-mock4';
    const data = await waitMessageId(++WS_ID, '/api/removeplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/removeplugin', params: { pluginName } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    await waiter('matterbridge-mock4 removed', () => {
      return matterbridge.plugins.get('matterbridge-mock4') === undefined;
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Removed plugin/));
  }, 60000);

  test('Websocket API /api/action with wrong plugin', async () => {
    const data = await waitMessageId(++WS_ID, '/api/action', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/action', params: { plugin: 'xyz', action: 'test' } });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  }, 60000);

  test('Websocket API /api/config', async () => {
    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'unk', value: 'none' } }));
    let data = await waitMessageId(WS_ID, '/api/config');
    expect(data.id).toBe(WS_ID);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.method).toBe('/api/config');
    expect(data.params).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBe('Wrong parameter in /api/config');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'unknown', value: 'none' } }));
    data = await waitMessageId(WS_ID);
    expect(data.error).toBe('Unknown parameter unknown in /api/config');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setpassword', value: 'abc' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('password')).toBe('abc');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setbridgemode', value: 'childbridge' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('bridgeMode')).toBe('childbridge');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Info' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.INFO);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmblogfile', value: true } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeFileLog')).toBe(true);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Fatal' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.FATAL);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjlogfile', value: true } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterFileLog')).toBe(true);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmdnsinterface', value: 'eth1' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('mattermdnsinterface')).toBe('eth1');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setipv4address', value: 'localhost' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matteripv4address')).toBe('localhost');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setipv6address', value: '::1' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matteripv6address')).toBe('::1');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterport', value: '5550' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterport')).toBe(5550);
    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterport', value: '5000' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterport')).toBe(5540);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterdiscriminator', value: '3040' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterdiscriminator')).toBe(3040);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterpasscode', value: '20202026' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterpasscode')).toBe(20202026);
  }, 60000);

  test('Websocket API /api/command with no params', async () => {
    const data = await waitMessageId(++WS_ID, '/api/command', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/command', params: {} });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  }, 60000);

  test('Websocket API /api/command with selectdevice', async () => {
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: {
        command: 'selectdevice',
        plugin: 'matterbridge-mock1',
        serial: '0x123456789',
        name: 'Switch plugin 1',
      },
    });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  }, 60000);

  test('Websocket API /api/command with unselectdevice', async () => {
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: {
        command: 'unselectdevice',
        plugin: 'matterbridge-mock1',
        serial: '0x123456789',
        name: 'Switch plugin 1',
      },
    });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  }, 60000);

  test('Websocket SendMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_LOG) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendMessage('info', '12:45', 'Frontend', `***${CYAN}Test message${rs}`);
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_LOG);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBeUndefined();
    expect(data.level).toBe('info');
    expect(data.time).toBe('12:45');
    expect(data.name).toBe('Frontend');
    expect(data.message).toBe('Test message');
    expect(data.method).toBeUndefined();
    expect(data.params).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendRefreshRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_REFRESH_NEEDED) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendRefreshRequired();
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_REFRESH_NEEDED);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('refresh_required');
    expect(data.params).toEqual({ changed: null });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendRestartRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_RESTART_NEEDED) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendRestartRequired();
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_RESTART_NEEDED);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('restart_required');
    expect(data.params).toEqual({});
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendUpdateRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_UPDATE_NEEDED) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendUpdateRequired();
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_UPDATE_NEEDED);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('update_required');
    expect(data.params).toEqual({});
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendCpuUpdate', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_CPU_UPDATE) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendCpuUpdate(50);
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_CPU_UPDATE);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('cpu_update');
    expect(data.params).toEqual({ cpuUsage: 50 });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendMemoryUpdate', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_MEMORY_UPDATE) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendMemoryUpdate('totalMemory', 'freeMemory', 'rss', 'heapTotal', 'heapUsed', 'external', 'arrayBuffers');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_MEMORY_UPDATE);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('memory_update');
    expect(data.params).toEqual({ totalMemory: 'totalMemory', freeMemory: 'freeMemory', rss: 'rss', heapTotal: 'heapTotal', heapUsed: 'heapUsed', external: 'external', arrayBuffers: 'arrayBuffers' });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendUptimeUpdate', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_UPTIME_UPDATE) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendUptimeUpdate('1 hour', '2 minutes');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_UPTIME_UPDATE);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('uptime_update');
    expect(data.params).toEqual({ systemUptime: '1 hour', processUptime: '2 minutes' });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendSnackbarMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_SNACKBAR) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendSnackbarMessage('Message');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_SNACKBAR);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBeUndefined();
    expect(data.params).toEqual({ message: 'Message', timeout: 5, severity: 'info' });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendCloseSnackbarMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_CLOSE_SNACKBAR) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendCloseSnackbarMessage('Message');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_CLOSE_SNACKBAR);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBeUndefined();
    expect(data.params).toEqual({ message: 'Message' });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket SendAttributeChangedMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === WS_ID_STATEUPDATE) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendAttributeChangedMessage('matterbridge-mock1', 'serial', 'unique', 'cluster', 'attribute', 'value');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(WS_ID_STATEUPDATE);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('state_update');
    expect(data.params).toEqual({
      'attribute': 'attribute',
      'cluster': 'cluster',
      'plugin': 'matterbridge-mock1',
      'serialNumber': 'serial',
      'uniqueId': 'unique',
      'value': 'value',
    });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket BroadcastMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10029) {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssBroadcastMessage(10029, '/broadcast', { param1: 'matterbridge' });
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10029);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('/broadcast');
    expect(data.params).toEqual({ param1: 'matterbridge' });
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  }, 60000);

  test('Websocket API ping', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.ping();
    await wait(1000, 'Wait for ping', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client ping`);
  }, 60000);

  test('Websocket API pong', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.pong();
    await wait(1000, 'Wait for pong', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client pong`);
  }, 60000);

  test('Websocket client disconnected', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    // prettier-ignore
    await waiter('Websocket closed', () => { return ws.readyState === WebSocket.CLOSED; });
    expect(ws.readyState).toBe(WebSocket.CLOSED);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `WebSocket client disconnected`);
  }, 60000);

  test('Remove mock plugin 1', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin1');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeFalsy();
  }, 60000);

  test('Remove mock plugin 2', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin2');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock2${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeFalsy();
  }, 60000);

  test('Remove mock plugin 3', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin3');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock3${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeFalsy();
  }, 60000);

  test('Plugins removed', async () => {
    expect((matterbridge as any).plugins.size).toBe(0);
  }, 60000);

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('Cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
  }, 60000);
});
