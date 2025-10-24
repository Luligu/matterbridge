// src\frontend.websocket.test.ts

const MATTER_PORT = 6008;
const FRONTEND_PORT = 8284;
const NAME = 'FrontendWebsocket';
const HOMEDIR = path.join('jest', NAME);

process.argv = [
  'node',
  'frontend.test.js',
  '-frontend',
  FRONTEND_PORT.toString(),
  '-logger',
  'info',
  '-matterlogger',
  'info',
  '-bridge',
  '-homedir',
  HOMEDIR,
  '-profile',
  'JestFrontendWebsocket',
  '-port',
  MATTER_PORT.toString(),
  '-passcode',
  '123456',
  '-discriminator',
  '3860',
];

import path from 'node:path';

import { jest } from '@jest/globals';
import { CYAN, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import WebSocket from 'ws';
import { LogLevel as MatterLogLevel } from '@matter/general';
import { EndpointNumber } from '@matter/types';
import { Identify } from '@matter/types/clusters';

import { Matterbridge } from './matterbridge.js';
import { onOffLight, onOffOutlet, onOffSwitch, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { plg, Plugin } from './matterbridgeTypes.js';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';
import { Frontend } from './frontend.js';
import { isApiRequest, isApiResponse, isBroadcast, WsMessageApiLog, WsMessageApiMemoryUpdate } from './frontendTypes.ts';
import { wait, waiter } from './utils/wait.js';
import { PluginManager } from './pluginManager.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.ts';
import { BroadcastServer } from './broadcastServer.ts';

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

// Spy on Matterbridge methods
const createServerNodeSpy = jest.spyOn(Matterbridge.prototype as any, 'createServerNode');
const startServerNodeSpy = jest.spyOn(Matterbridge.prototype as any, 'startServerNode');
const stopServerNodeSpy = jest.spyOn(Matterbridge.prototype as any, 'stopServerNode');

// Spy on PluginManager methods
const addPluginSpy = jest.spyOn(PluginManager.prototype, 'add');
const loadPluginSpy = jest.spyOn(PluginManager.prototype, 'load');

// Spy on Frontend methods
const wssSendSnackbarMessageSpy = jest.spyOn(Frontend.prototype, 'wssSendSnackbarMessage');
const wssSendCloseSnackbarMessageSpy = jest.spyOn(Frontend.prototype, 'wssSendCloseSnackbarMessage');
const wssSendRefreshRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendRefreshRequired');
const wssSendRestartRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendRestartRequired');
const wssSendRestartNotRequiredSpy = jest.spyOn(Frontend.prototype, 'wssSendRestartNotRequired');

// Mock BroadcastServer methods
const broadcastServerIsWorkerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest').mockImplementation(() => true);
const broadcastServerIsWorkerResponseSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse').mockImplementation(() => true);
const broadcastServerBroadcastMessageHandlerSpy = jest.spyOn(BroadcastServer.prototype as any, 'broadcastMessageHandler').mockImplementation(() => {});
const broadcastServerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'request').mockImplementation(() => {});
const broadcastServerRespondSpy = jest.spyOn(BroadcastServer.prototype, 'respond').mockImplementation(() => {});
const broadcastServerFetchSpy = jest.spyOn(BroadcastServer.prototype, 'fetch').mockImplementation(async () => {
  return Promise.resolve(undefined) as any;
});

// Setup the test environment
setupTest(NAME, false);

let WS_ID = 10050;

describe('Matterbridge frontend', () => {
  let matterbridge: Matterbridge;
  let ws: WebSocket;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    matterbridge.frontend.destroy();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    ws.close();
  }, 60000);

  let messageId = 0;
  let messageMethod: string | undefined = '';
  let messageResolve: (value: Record<string, any>) => void;

  const onMessage = (event: WebSocket.MessageEvent) => {
    // console.log('received message:', event.data);
    const data = JSON.parse(event.data as string);
    expect(data).toBeDefined();
    if (data.id === messageId && (messageMethod ? data.method === messageMethod : true)) {
      messageResolve(data);
    }
  };

  const waitMessageId = async (id: number, method?: string, message?: Record<string, any>): Promise<Record<string, any>> => {
    return new Promise<Record<string, any>>((resolve) => {
      messageId = id;
      messageMethod = method;
      messageResolve = resolve;
      if (message) ws.send(JSON.stringify(message));
    });
  };

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('JestFrontendWebsocket');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).frontend.httpServer!==undefined; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).frontend.webSocketServer!==undefined; });
    // prettier-ignore
    await waiter('Matter server node started', () => { return (matterbridge as any).reachabilityTimeout; });
    // prettier-ignore
    await waiter('Matter server node started', () => { return matterbridge.serverNode?.lifecycle.isOnline === true; });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8284${UNDERLINEOFF}${rs}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Server node for Matterbridge is online`);
  }, 60000);

  test('Add mock plugin 1', async () => {
    await matterbridge.plugins.add('./src/mock/plugin1');
    const plugins: Plugin[] = matterbridge.plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(1);
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
    expect((matterbridge as any).plugins.size).toBe(1);
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeTruthy();
    expect((matterbridge as any).plugins.get('matterbridge-mock1')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
  });

  test('Add mock plugin 2', async () => {
    await matterbridge.plugins.add('./src/mock/plugin2');
    const plugins: Plugin[] = matterbridge.plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(2);
    expect(plugins[1].name).toBe('matterbridge-mock2');
    expect(plugins[1].version).toBe('1.0.2');
    expect(plugins[1].description).toBe('Matterbridge mock plugin 2');
    expect((matterbridge as any).plugins.size).toBe(2);
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeTruthy();
    expect((matterbridge as any).plugins.get('matterbridge-mock2')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock2${nf}`);
  });

  test('Add mock plugin 3', async () => {
    await matterbridge.plugins.add('./src/mock/plugin3');
    const plugins: Plugin[] = matterbridge.plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(3);
    expect(plugins[2].name).toBe('matterbridge-mock3');
    expect(plugins[2].version).toBe('1.0.3');
    expect(plugins[2].description).toBe('Matterbridge mock plugin 3');
    expect((matterbridge as any).plugins.size).toBe(3);
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeTruthy();
    expect((matterbridge as any).plugins.get('matterbridge-mock3')).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
  });

  test('Load and start mock plugin 1', async () => {
    const plugin = matterbridge.plugins.get('matterbridge-mock1');
    expect(plugin).toBeDefined();
    if (plugin) await matterbridge.plugins.load(plugin, true, 'Jest test', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Loaded plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Started plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Configured plugin/));
    if (!plugin || !plugin.configJson) return;
    plugin.configJson.whiteList = [];
    plugin.configJson.blackList = [];
  });

  test('Load and start mock plugin 2', async () => {
    const plugin = matterbridge.plugins.get('matterbridge-mock2');
    expect(plugin).toBeDefined();
    if (plugin) await matterbridge.plugins.load(plugin, true, 'Jest test', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Loaded plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Started plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Configured plugin/));
    if (!plugin || !plugin.configJson) return;
    plugin.configJson.whiteList = [];
    plugin.configJson.blackList = [];
  });

  test('Load and start mock plugin 3', async () => {
    const plugin = matterbridge.plugins.get('matterbridge-mock3');
    expect(plugin).toBeDefined();
    if (plugin) await matterbridge.plugins.load(plugin, true, 'Jest test', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Loaded plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Started plugin/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringMatching(/^Configured plugin/));
    if (!plugin || !plugin.configJson) return;
    plugin.configJson.whiteList = [];
    plugin.configJson.blackList = [];
  });

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
    expect(device.maybeNumber).toBe(7);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged endpoint/));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged endpoint/));
  });

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
  });

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
  });

  test('create Websocket', async () => {
    ws = new WebSocket(`ws://localhost:8284`);
    expect(ws).toBeDefined();
    // prettier-ignore
    await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));
    ws.addEventListener('message', onMessage);
  });

  test('Websocket API send bad json message', async () => {
    ws.send('This is not a JSON message');
    await wait(100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Error processing message/));
  });

  test('Websocket API send wrong message', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/settings', { id: WS_ID, dst: 'Matter', src: 'Jest test', method: '/api/settings', params: {} });
    expect(msg.error).toBe('Invalid message');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid message from websocket client/));
  });

  test('Websocket API send wrong method', async () => {
    const msg = await waitMessageId(++WS_ID, '/api', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api', params: {} });
    expect(msg.error).toBe('Invalid method');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid method from websocket client/));
  });

  test('Websocket API send /api/login with no nodeContext', async () => {
    const context = (matterbridge as any).nodeContext;
    (matterbridge as any).nodeContext = undefined;
    const msg = await waitMessageId(++WS_ID, '/api/login', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    expect(msg.error).toBe('Internal error: nodeContext not found');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Login nodeContext not found/));
    (matterbridge as any).nodeContext = context;
  });

  test('Websocket API send /api/login with empty password', async () => {
    await (matterbridge as any).nodeContext.set('password', '');
    const msg = await waitMessageId(++WS_ID, '/api/login', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    expect(msg.success).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
  });

  test('Websocket API send /api/login with password', async () => {
    await (matterbridge as any).nodeContext.set('password', '');
    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: 'test' } }));
    const msg = await waitMessageId(WS_ID);
    expect(msg.success).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
  });

  test('Websocket API send /api/login with wrong password', async () => {
    await (matterbridge as any).nodeContext.set('password', 'abcdef');
    const msg = await waitMessageId(++WS_ID, '/api/login', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    expect(msg.error).toBe('Wrong password');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Error wrong password/));
    await (matterbridge as any).nodeContext.set('password', '');
  });

  test('Websocket API send ping', async () => {
    const msg = await waitMessageId(++WS_ID, 'pong', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: 'ping', params: {} });
    expect(msg.response).toBe('pong');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/restart', async () => {
    const restart = jest.spyOn(matterbridge as any, 'restartProcess').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/restart', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/restart', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(restart).toHaveBeenCalled();
  });

  test('Websocket API send /api/shutdown', async () => {
    const shutdown = jest.spyOn(matterbridge as any, 'shutdownProcess').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/shutdown', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shutdown', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(shutdown).toHaveBeenCalled();
  });

  test('Websocket API send /api/create-backup', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/create-backup', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/create-backup', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(msg.success).toBe(true);
  });

  test('Websocket API send /api/unregister', async () => {
    const unregister = jest.spyOn(matterbridge as any, 'unregisterAndShutdownProcess').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/unregister', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/unregister', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(unregister).toHaveBeenCalled();
  });

  test('Websocket API send /api/reset', async () => {
    const reset = jest.spyOn(matterbridge as any, 'shutdownProcessAndReset').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/reset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/reset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(reset).toHaveBeenCalled();
  });

  test('Websocket API send /api/factoryreset', async () => {
    const reset = jest.spyOn(matterbridge as any, 'shutdownProcessAndFactoryReset').mockImplementationOnce(() => {
      // Simulate a successful command execution
    });
    const msg = await waitMessageId(++WS_ID, '/api/factoryreset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/factoryreset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(reset).toHaveBeenCalled();
    expect(msg.success).toBe(true);
  });

  test('Websocket API send /api/viewhistorypage', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/viewhistorypage', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/viewhistorypage', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(msg.success).toBe(true);
  });

  test('Websocket API send /api/downloadhistorypage', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/downloadhistorypage', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/downloadhistorypage', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(msg.success).toBe(true);
  });

  test('Websocket API send /api/matter', async () => {
    let msg = await waitMessageId(++WS_ID, '/api/matter', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/matter', params: {} });
    expect(msg.error).toBe('Wrong parameter id in /api/matter');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));

    msg = await waitMessageId(++WS_ID, '/api/matter', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/matter', params: { id: 'unknown' } });
    expect(msg.error).toBe('Unknown server node id unknown in /api/matter');

    msg = await waitMessageId(++WS_ID, '/api/matter', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/matter',
      params: { id: 'Matterbridge', server: true, startCommission: true, stopCommission: true, advertise: true, removeFabric: 1 },
    });
    expect(msg.success).toBe(true);
  });

  test('Websocket API send /api/checkupdates', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/checkupdates', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/checkupdates', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/shellysysupdate', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellysysupdate', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellysysupdate', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellySysUpdate).toHaveBeenCalled();
  });

  test('Websocket API send /api/shellymainupdate', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellymainupdate', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellymainupdate', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyMainUpdate).toHaveBeenCalled();
  });

  test('Websocket API send /api/shellycreatesystemlog', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellycreatesystemlog', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellycreatesystemlog', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(createShellySystemLog).toHaveBeenCalled();
  });

  test('Websocket API send /api/shellynetconfig', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/shellynetconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/shellynetconfig', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyChangeIp).toHaveBeenCalled();
  });

  test('Websocket API send /api/softreset', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/softreset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/softreset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellySoftReset).toHaveBeenCalled();
  });

  test('Websocket API send /api/hardreset', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/hardreset', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/hardreset', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyHardReset).toHaveBeenCalled();
  });

  test('Websocket API send /api/reboot', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/reboot', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/reboot', params: {} });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    expect(triggerShellyReboot).toHaveBeenCalled();
  });

  test('Websocket API send /api/settings', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/settings', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/settings', params: {} });
    expect(msg.response.matterbridgeInformation).toBeDefined();
    expect(msg.response.systemInformation).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/plugins', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/plugins', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/plugins', params: {} });
    expect(msg.response.length).toBe(3);
    expect(msg.response[0].name).toBe('matterbridge-mock1');
    expect(msg.response[1].name).toBe('matterbridge-mock2');
    expect(msg.response[2].name).toBe('matterbridge-mock3');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/devices', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/devices', params: {} });
    expect(msg.response.length).toBe(6);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/devices with params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/devices', params: { pluginName: 'matterbridge-mock1' } });
    expect(msg.response.length).toBe(2);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/clusters without params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: {} });
    expect(msg.error).toBe('Wrong parameter plugin in /api/clusters');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/clusters with wrong params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1' } });
    expect(msg.error).toBe('Wrong parameter endpoint in /api/clusters');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/clusters with wrong endpoint', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1', endpoint: 15 } });
    expect(msg.error).toBe('Endpoint not found in /api/clusters');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/clusters', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/clusters', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1', endpoint: 7 } });
    expect(msg.error).toBeUndefined();
    expect(msg.response).toBeDefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/select/devices without plugin param', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/devices', params: {} });
    expect(msg.error).toBe('Wrong parameter plugin in /api/select/devices');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/select/devices with wrong plugin', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/devices', params: { plugin: 'matterbridge_unknown' } });
    expect(msg.error).toBe('Plugin not found in /api/select/devices');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/select/devices', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/devices', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/devices', params: { plugin: 'matterbridge-mock1' } });
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
  });

  test('Websocket API send /api/select/entities without plugin param', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/entities', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: {} });
    expect(msg.error).toBe('Wrong parameter plugin in /api/select/entities');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/select/entities with wrong plugin', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/entities', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: { plugin: 'matterbridge_unknown' } });
    expect(msg.error).toBe('Plugin not found in /api/select/entities');
    expect(msg.response).toBeUndefined();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API send /api/select/entities', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/select/entities', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: { plugin: 'matterbridge-mock1' } });
    expect(msg.error).toBeUndefined();
    expect(msg.response).toEqual([{ description: 'Switch', icon: 'matter', name: 'Switch', pluginName: 'matterbridge-mock1' }]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  });

  test('Websocket API /api/install without params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: {} });
    expect(msg.response).not.toBeDefined();
    expect(msg.error).toBe('Wrong parameter in /api/install');
  });

  test('Websocket API /api/install with wrong params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbri' } });
    expect(msg.response).toBeUndefined();
    expect(msg.error).toBe('Wrong parameter in /api/install');
  });

  test('Websocket API /api/install', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/install', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbridge-test', restart: false } });
    expect(msg.success).toBe(true);
    expect(msg.error).not.toBeDefined();
    expect(wssSendSnackbarMessageSpy).toHaveBeenCalledWith(`Installing package matterbridge-test...`, 0);
  });

  test('Websocket API /api/uninstall with wrong params', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/uninstall', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbri' } });
    expect(msg.response).not.toBeDefined();
    expect(msg.error).toBe('Wrong parameter packageName in /api/uninstall');
  });

  test('Websocket API /api/uninstall', async () => {
    const msg = await waitMessageId(++WS_ID, '/api/uninstall', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-test' } });
    expect(msg.success).toBe(true);
    expect(msg.error).not.toBeDefined();
  });

  test('Websocket API /api/addplugin', async () => {
    const pluginNameOrPath = path.join('.', 'src', 'mock', 'plugin4');
    const data = await waitMessageId(++WS_ID, '/api/addplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/addplugin', params: { pluginNameOrPath } });
    expect(data.error).toBeUndefined();
    expect(data.success).toBe(true);
    await waiter('matterbridge-mock4 loaded', () => {
      return matterbridge.plugins.get('matterbridge-mock4')?.loaded === true;
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added plugin/));

    await waitMessageId(++WS_ID, '/api/addplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/addplugin', params: { pluginNameOrPath: '' } });
    await waitMessageId(++WS_ID, '/api/addplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/addplugin', params: { pluginNameOrPath } });
    await waitMessageId(++WS_ID, '/api/addplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/addplugin', params: { pluginNameOrPath: 'matterbridge-mock4' } });
  });

  // eslint-disable-next-line jest/no-commented-out-tests
  /*
  test('Websocket API /api/restartplugin DynamicPlatform', async () => {
    stopServerNodeSpy.mockImplementationOnce(async () => {
      return Promise.resolve();
    });
    const pluginName = 'matterbridge-mock1';
    const plugin = matterbridge.plugins.get(pluginName);
    expect(plugin).toBeDefined();
    if (!plugin) return;
    await (matterbridge as any).stopServerNode(plugin.serverNode);
    await plugin.serverNode?.env.get(MdnsService)[Symbol.asyncDispose]();
    plugin.restartRequired = true;
    const data = await waitMessageId(++WS_ID, '/api/restartplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/restartplugin', params: { pluginName } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    expect(wssSendSnackbarMessageSpy).toHaveBeenCalledWith(expect.stringMatching(/^Restarted plugin/), 5, 'success');
    expect(wssSendRefreshRequiredSpy).toHaveBeenCalledWith('plugins');
    expect(wssSendRefreshRequiredSpy).toHaveBeenCalledWith('devices');
    expect(plugin.restartRequired).toBe(false);
    expect(wssSendRestartNotRequiredSpy).toHaveBeenCalled();

    // Wrong parameters
    await waitMessageId(++WS_ID, '/api/restartplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/restartplugin', params: { pluginName: '' } });
  });
  */

  test('Websocket API /api/restartplugin AccessoryPlatform', async () => {
    stopServerNodeSpy.mockImplementationOnce(async () => {
      return Promise.resolve();
    });
    const pluginName = 'matterbridge-mock4';
    const plugin = matterbridge.plugins.get(pluginName);
    expect(plugin).toBeDefined();
    if (!plugin) return;
    plugin.restartRequired = true;
    plugin.serverNode = {} as any;
    const data = await waitMessageId(++WS_ID, '/api/restartplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/restartplugin', params: { pluginName } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    expect(wssSendSnackbarMessageSpy).toHaveBeenCalledWith(expect.stringMatching(/^Restarted plugin/), 5, 'success');
    expect(wssSendRefreshRequiredSpy).toHaveBeenCalledWith('plugins');
    expect(wssSendRefreshRequiredSpy).toHaveBeenCalledWith('devices');
    expect(plugin.restartRequired).toBe(false);
    expect(wssSendRestartNotRequiredSpy).toHaveBeenCalled();

    // Wrong parameters
    await waitMessageId(++WS_ID, '/api/restartplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/restartplugin', params: { pluginName: '' } });
  });

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

    await waitMessageId(++WS_ID, '/api/disableplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/disableplugin', params: { pluginName: '' } });
  });

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

    await waitMessageId(++WS_ID, '/api/enableplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/enableplugin', params: { pluginName: '' } });
  });

  test('Websocket API /api/savepluginconfig', async () => {
    const pluginName = 'matterbridge-mock4';
    const formData = { name: 'matterbridge-mock4', type: 'AccessoryPlatform', debug: false, unregisterOnShutdown: false, version: '1.2.2' };
    const data = await waitMessageId(++WS_ID, '/api/savepluginconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/savepluginconfig', params: { pluginName, formData } });
    expect(data.error).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.success).toBe(true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Saving config for plugin/));

    await waitMessageId(++WS_ID, '/api/savepluginconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/savepluginconfig', params: { pluginName: '', formData } });
    await waitMessageId(++WS_ID, '/api/savepluginconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/savepluginconfig', params: { pluginName, formData: {} } });
    await waitMessageId(++WS_ID, '/api/savepluginconfig', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/savepluginconfig', params: { pluginName: 'matterbridge-notvalid', formData } });
  });

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

    await waitMessageId(++WS_ID, '/api/removeplugin', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/removeplugin', params: { pluginName: '' } });
  });

  test('Websocket API /api/action with wrong plugin', async () => {
    const data = await waitMessageId(++WS_ID, '/api/action', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/action', params: { plugin: 'xyz', action: 'test' } });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();

    await waitMessageId(++WS_ID, '/api/action', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/action', params: { plugin: 'matterbridge-notvalid', action: 'test' } });
  });

  test('Websocket API /api/action with throw', async () => {
    const plugin = matterbridge.plugins.get('matterbridge-mock2');
    expect(plugin).toBeDefined();
    expect(plugin?.platform).toBeDefined();
    if (!plugin || !plugin.platform) return;
    jest.spyOn(plugin.platform, 'onAction').mockImplementationOnce(async () => {
      throw new Error('Test error in action');
    });
    const data = await waitMessageId(++WS_ID, '/api/action', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/action', params: { plugin: 'matterbridge-mock2', action: 'test' } });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  });

  test('Websocket API /api/action', async () => {
    const data = await waitMessageId(++WS_ID, '/api/action', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/action', params: { plugin: 'matterbridge-mock2', action: 'test' } });
    expect(data.success).toBeTruthy();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
  });

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

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Debug' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.DEBUG);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Info' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.INFO);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Notice' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.NOTICE);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Warn' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.WARN);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Error' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.ERROR);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmbloglevel', value: 'Fatal' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeLogLevel')).toBe(LogLevel.FATAL);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmblogfile', value: true } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeFileLog')).toBe(true);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmblogfile', value: false } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterbridgeFileLog')).toBe(false);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Debug' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.DEBUG);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Info' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.INFO);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Notice' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.NOTICE);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Warn' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.WARN);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Error' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.ERROR);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjloglevel', value: 'Fatal' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterLogLevel')).toBe(MatterLogLevel.FATAL);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjlogfile', value: true } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterFileLog')).toBe(true);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmjlogfile', value: false } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterFileLog')).toBe(false);

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
    expect(data.success).toBeUndefined();
    expect(data.error).toBe('Invalid value: reset matter commissioning port to default 5540');
    expect(await matterbridge.nodeContext?.get('matterport')).toBe(5540);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterdiscriminator', value: '3040' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterdiscriminator')).toBe(3040);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterdiscriminator', value: '5000' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBeUndefined();
    expect(data.error).toBe('Invalid value: reset matter commissioning discriminator to default undefined');
    expect(await matterbridge.nodeContext?.get('matterdiscriminator')).toBe(undefined);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterpasscode', value: '20202026' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('matterpasscode')).toBe(20202026);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setmatterpasscode', value: '-11' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBeUndefined();
    expect(data.error).toBe('Invalid value: reset matter commissioning passcode to default undefined');
    expect(await matterbridge.nodeContext?.get('matterpasscode')).toBe(undefined);

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setvirtualmode', value: 'disabled' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('virtualmode')).toBe('disabled');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setvirtualmode', value: 'light' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('virtualmode')).toBe('light');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setvirtualmode', value: 'outlet' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('virtualmode')).toBe('outlet');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setvirtualmode', value: 'switch' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('virtualmode')).toBe('switch');

    ws.send(JSON.stringify({ id: ++WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/config', params: { name: 'setvirtualmode', value: 'mounted_switch' } }));
    data = await waitMessageId(WS_ID);
    expect(data.success).toBe(true);
    expect(await matterbridge.nodeContext?.get('virtualmode')).toBe('mounted_switch');
  }, 60000);

  test('Websocket API /api/command with no params', async () => {
    const data = await waitMessageId(++WS_ID, '/api/command', { id: WS_ID, dst: 'Matterbridge', src: 'Jest test', method: '/api/command', params: {} });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  });

  test('Websocket API /api/command with selectdevice and invalid plugin', async () => {
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'selectdevice', plugin: 'matterbridge-invalid', serial: '0x123456789', name: 'Switch plugin 1' },
    });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  });

  test('Websocket API /api/command with unselectdevice and invalid plugin', async () => {
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'unselectdevice', plugin: 'matterbridge-invalid', serial: '0x123456789', name: 'Switch plugin 1' },
    });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  });

  test('Websocket API /api/command plugin matterbridge-mock1 with unselectdevice from name', async () => {
    const config = matterbridge.plugins.get('matterbridge-mock1')?.configJson;
    expect(config).toBeDefined();
    if (!config) return;
    config.postfix = 'JST';
    config.whiteList = ['Switch plugin 1'];
    expect(config.whiteList).toEqual(['Switch plugin 1']);
    expect(config.blackList).toEqual([]);
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'unselectdevice', plugin: 'matterbridge-mock1', serial: '0x123456789', name: 'Switch plugin 1' },
    });
    expect(data.success).toBeTruthy();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(config.whiteList).toEqual([]);
    expect(config.blackList).toEqual(['Switch plugin 1']);
  });

  test('Websocket API /api/command plugin matterbridge-mock2 with unselectdevice from serial', async () => {
    const config = matterbridge.plugins.get('matterbridge-mock2')?.configJson;
    expect(config).toBeDefined();
    if (!config) return;
    config.postfix = 'JST';
    config.whiteList = ['0x123456789'];
    expect(config.whiteList).toEqual(['0x123456789']);
    expect(config.blackList).toEqual([]);
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'unselectdevice', plugin: 'matterbridge-mock2', serial: '0x123456789', name: 'Outlet plugin 2' },
    });
    expect(data.success).toBeTruthy();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(config.whiteList).toEqual([]);
    expect(config.blackList).toEqual(['0x123456789']);
  });

  test('Websocket API /api/command plugin matterbridge-mock3 with unselectdevice', async () => {
    const config = matterbridge.plugins.get('matterbridge-mock3')?.configJson;
    expect(config).toBeDefined();
    expect(config?.whiteList).toEqual([]);
    expect(config?.blackList).toEqual([]);
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'unselectdevice', plugin: 'matterbridge-mock3', serial: '0x123456789', name: 'Light plugin 3' },
    });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
    expect(config?.whiteList).toEqual([]);
    expect(config?.blackList).toEqual([]);
  });

  test('Websocket API /api/command plugin matterbridge-mock1 with selectdevice from name', async () => {
    const config = matterbridge.plugins.get('matterbridge-mock1')?.configJson;
    expect(config).toBeDefined();
    if (!config) return;
    config.postfix = 'JST';
    config.whiteList = ['DeviceXYZ'];
    expect(config.whiteList).toEqual(['DeviceXYZ']);
    expect(config.blackList).toEqual(['Switch plugin 1']);
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'selectdevice', plugin: 'matterbridge-mock1', serial: '0x123456789', name: 'Switch plugin 1' },
    });
    expect(data.success).toBeTruthy();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(config.whiteList).toEqual(['DeviceXYZ', 'Switch plugin 1']);
    expect(config.blackList).toEqual([]);
  });

  test('Websocket API /api/command plugin matterbridge-mock2 with selectdevice from serial', async () => {
    const config = matterbridge.plugins.get('matterbridge-mock2')?.configJson;
    expect(config).toBeDefined();
    if (!config) return;
    config.whiteList = ['SerialXYZ'];
    expect(config.whiteList).toEqual(['SerialXYZ']);
    expect(config.blackList).toEqual(['0x123456789']);
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'selectdevice', plugin: 'matterbridge-mock2', serial: '0x123456789', name: 'Outlet plugin 2' },
    });
    expect(data.success).toBeTruthy();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(config.whiteList).toEqual(['SerialXYZ', '0x123456789']);
    expect(config.blackList).toEqual([]);
  });

  test('Websocket API /api/command plugin matterbridge-mock3 with selectdevice', async () => {
    const config = matterbridge.plugins.get('matterbridge-mock3')?.configJson;
    expect(config).toBeDefined();
    expect(config?.whiteList).toEqual([]);
    expect(config?.blackList).toEqual([]);
    const data = await waitMessageId(++WS_ID, '/api/command', {
      id: WS_ID,
      dst: 'Matterbridge',
      src: 'Jest test',
      method: '/api/command',
      params: { command: 'selectdevice', plugin: 'matterbridge-mock3', serial: '0x123456789', name: 'Light plugin 3' },
    });
    expect(data.success).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
    expect(config?.whiteList).toEqual([]);
    expect(config?.blackList).toEqual([]);
  });

  test('Websocket SendMessage', async () => {
    const spyWssBroadcastMessage = jest.spyOn(Frontend.prototype, 'wssBroadcastMessage');
    matterbridge.frontend.wssSendLogMessage('', '', '', ``);
    expect(spyWssBroadcastMessage).not.toHaveBeenCalled();

    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'log') {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendLogMessage('info', '12:45', 'Frontend', `***${CYAN}Test message 01234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789${rs}`);
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string) as WsMessageApiLog;
    expect(data).toBeDefined();
    expect(isBroadcast(data)).toBe(true);
    expect(isApiRequest(data)).toBe(false);
    expect(isApiResponse(data)).toBe(false);
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.response.level).toBe('info');
    expect(data.response.time).toBe('12:45');
    expect(data.response.name).toBe('Frontend');
    expect(data.response.message).toBe('Test message 01234567890123456789 ... 01234567890123456789');
    expect(data.method).toBe('log');
    expect(data.response).toEqual({ level: 'info', time: '12:45', name: 'Frontend', message: 'Test message 01234567890123456789 ... 01234567890123456789' });
    expect((data as any).error).toBeUndefined();
    expect(spyWssBroadcastMessage).toHaveBeenCalled();
    spyWssBroadcastMessage.mockRestore();
  });

  test('Websocket SendRefreshRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'refresh_required') {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendRefreshRequired('matter');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('refresh_required');
    expect(data.response).toEqual({ changed: 'matter' });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendRestartRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'restart_required') {
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
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('restart_required');
    expect(data.response).toEqual({ 'fixed': false });
    expect(data.error).toBeUndefined();
    expect(wssSendSnackbarMessageSpy).toHaveBeenCalledWith('Restart required', 0);
  });

  test('Websocket SendRestartNotRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'restart_not_required') {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendRestartNotRequired();
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('restart_not_required');
    expect(data.params).toBeUndefined();
    expect(data.response).toBeUndefined();
    expect(data.error).toBeUndefined();
    expect(wssSendCloseSnackbarMessageSpy).toHaveBeenCalledWith('Restart required');
  });

  test('Websocket SendUpdateRequired', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'update_required') {
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
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('update_required');
    expect(data.response).toEqual({ devVersion: false });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendCpuUpdate', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'cpu_update') {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendCpuUpdate(50, 35);
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('cpu_update');
    expect(data.response).toEqual({ cpuUsage: 50, processCpuUsage: 35 });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendMemoryUpdate', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'memory_update') {
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
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('memory_update');
    expect(data.response).toEqual({ totalMemory: 'totalMemory', freeMemory: 'freeMemory', rss: 'rss', heapTotal: 'heapTotal', heapUsed: 'heapUsed', external: 'external', arrayBuffers: 'arrayBuffers' });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendUptimeUpdate', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'uptime_update') {
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
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('uptime_update');
    expect(data.response).toEqual({ systemUptime: '1 hour', processUptime: '2 minutes' });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendSnackbarMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'snackbar') {
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
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('snackbar');
    expect(data.response).toEqual({ message: 'Message', timeout: 5, severity: 'info' });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendCloseSnackbarMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'close_snackbar') {
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
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('close_snackbar');
    expect(data.response).toEqual({ message: 'Message' });
    expect(data.error).toBeUndefined();
  });

  test('Websocket SendAttributeChangedMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'state_update') {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    matterbridge.frontend.wssSendAttributeChangedMessage('matterbridge-mock1', 'serial', 'unique', EndpointNumber(123), '123', 'cluster', 'attribute', 'value');
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('state_update');
    expect(data.response).toEqual({
      'attribute': 'attribute',
      'cluster': 'cluster',
      'id': '123',
      'number': 123,
      'plugin': 'matterbridge-mock1',
      'serialNumber': 'serial',
      'uniqueId': 'unique',
      'value': 'value',
    });
    expect(data.error).toBeUndefined();
  });

  test('Websocket BroadcastMessage', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const received = new Promise((resolve) => {
      const onMessage = (event: WebSocket.MessageEvent) => {
        const data = JSON.parse(event.data as string);
        if (data.method === 'memory_update') {
          ws.removeEventListener('message', onMessage);
          resolve(event.data);
        }
      };
      ws.addEventListener('message', onMessage);
    });
    const msg: WsMessageApiMemoryUpdate = {
      id: 0,
      method: 'memory_update',
      src: 'Matterbridge',
      dst: 'Frontend',
      success: true,
      response: { totalMemory: 'tm', freeMemory: 'fm', heapTotal: 'ht', heapUsed: 'hu', external: 'ext', arrayBuffers: 'ab', rss: 'rss' },
    };
    expect(isBroadcast(msg as any)).toBeTruthy();
    expect(isApiRequest(msg as any)).toBeFalsy();
    expect(isApiResponse(msg as any)).toBeFalsy();
    matterbridge.frontend.wssBroadcastMessage(msg);
    const response = await received;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(0);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Frontend');
    expect(data.method).toBe('memory_update');
    expect(data.response).toEqual(msg.response);
    expect(data.error).toBeUndefined();
  });

  test('Websocket API ping', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.ping();
    await wait(100, 'Wait for ping', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client ping`);
  });

  test('Websocket API pong', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.pong();
    await wait(100, 'Wait for pong', true);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client pong`);
  });

  test('Websocket client disconnected', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    // prettier-ignore
    await waiter('Websocket closed', () => { return ws.readyState === WebSocket.CLOSED; });
    expect(ws.readyState).toBe(WebSocket.CLOSED);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `WebSocket client disconnected`);
  });

  test('Remove mock plugin 1', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin1');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeFalsy();
  });

  test('Remove mock plugin 2', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin2');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock2${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeFalsy();
  });

  test('Remove mock plugin 3', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin3');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock3${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeFalsy();
  });

  test('Plugins removed', async () => {
    expect((matterbridge as any).plugins.size).toBe(0);
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10, 100);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);
});
