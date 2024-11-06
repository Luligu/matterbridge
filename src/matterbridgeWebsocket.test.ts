/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-logger', 'debug', '-matterlogger', 'fatal', '-bridge', '-profile', 'Jest', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils.js';
import WebSocket from 'ws';
import { MatterbridgeDevice, onOffLight, onOffOutlet, onOffSwitch } from './matterbridgeDevice.js';
import { Identify } from '@matter/main/clusters';
import { RegisteredPlugin } from './matterbridgeTypes.js';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('Matterbridge loadInstance() and cleanup() -bridge mode', () => {
  let matterbridge: Matterbridge;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let loggerLogSpy: jest.SpiedFunction<(level: LogLevel, message: string, ...parameters: any[]) => void>;
  let ws: WebSocket;

  beforeAll(async () => {
    // Spy on and mock the AnsiLogger.log method
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.error(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      // console.error(args);
    });
  });

  beforeEach(() => {
    loggerLogSpy.mockClear();
    consoleLogSpy.mockClear();
  });

  afterAll(async () => {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
  }, 60000);

  test('Matterbridge.loadInstance(true) -bridge mode and send /api/restart', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).httpServer; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).webSocketServer; });
    // prettier-ignore
    await waiter('Matter server started', () => { return (matterbridge as any).reachabilityTimeout; });

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Matter server started`);

    ws = new WebSocket(`ws://localhost:8283`);
    expect(ws).toBeDefined();
    // prettier-ignore
    await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));

    const message = JSON.stringify({ id: 15, dst: 'Matterbridge', src: 'Jest test', method: '/api/restart', params: {} });
    ws.send(message);

    // prettier-ignore
    await waiter('Cleanup done', () => { return (matterbridge as any).initialized === false; });
  }, 60000);

  test('Matterbridge.loadInstance(true) -bridge mode and send /api/shutdown', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).httpServer; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).webSocketServer; });
    // prettier-ignore
    await waiter('Matter server started', () => { return (matterbridge as any).reachabilityTimeout; });

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Matter server started`);

    ws = new WebSocket(`ws://localhost:8283`);
    expect(ws).toBeDefined();
    // prettier-ignore
    await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));

    const message = JSON.stringify({ id: 15, dst: 'Matterbridge', src: 'Jest test', method: '/api/shutdown', params: {} });
    ws.send(message);

    // prettier-ignore
    await waiter('Cleanup done', () => { return (matterbridge as any).initialized === false; });
  }, 60000);

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).httpServer; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).webSocketServer; });
    // prettier-ignore
    await waiter('Matter server started', () => { return (matterbridge as any).reachabilityTimeout; });

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Matter server started`);
  }, 60000);

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
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock1${nf}`);
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
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock2${nf}`);
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
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Added plugin ${plg}matterbridge-mock3${nf}`);
  }, 60000);

  test('create an switch device: Switch 1 for plugin matterbridge-mock1', async () => {
    const device = new MatterbridgeDevice(onOffSwitch);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Switch 1', 'SerialSwitch1', 1, 'VendorName', 'ProductName');
    device.plugin = 'matterbridge-mock1';
    await matterbridge.addBridgedDevice('matterbridge-mock1', device);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged device/));
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged device/));
  }, 60000);

  test('create an light device: Light 1 for plugin matterbridge-mock2', async () => {
    const device = new MatterbridgeDevice(onOffLight);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Light 1', 'SerialLight1', 1, 'VendorName', 'ProductName');
    device.plugin = 'matterbridge-mock2';
    await matterbridge.addBridgedDevice('matterbridge-mock2', device);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged device/));
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged device/));
  }, 60000);

  test('create an outlet device: Outlet 1 for plugin matterbridge-mock3', async () => {
    const device = new MatterbridgeDevice(onOffOutlet);
    expect(device).toBeDefined();
    device.createDefaultIdentifyClusterServer(0, Identify.IdentifyType.None);
    device.createDefaultGroupsClusterServer();
    device.createDefaultOnOffClusterServer(false);
    device.createDefaultBridgedDeviceBasicInformationClusterServer('Outlet 1', 'SerialOutlet1', 1, 'VendorName', 'ProductName');
    device.plugin = 'matterbridge-mock3';
    await matterbridge.addBridgedDevice('matterbridge-mock3', device);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Adding bridged device/));
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/^Added and registered bridged device/));
  }, 60000);

  test('Websocket API connect', async () => {
    ws = new WebSocket(`ws://localhost:8283`);
    expect(ws).toBeDefined();
    // prettier-ignore
    await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));
  }, 60000);

  test('Websocket API send bad json message', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = 'This is not a JSON message';
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Error parsing message from websocket client/), expect.stringMatching(/^Unexpected token/));
  }, 60000);

  test('Websocket API send wrong message', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matter', src: 'Jest test', method: '/api/settings', params: {} });
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid message from websocket client/));
  }, 60000);

  test('Websocket API send wrong method', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api', params: {} });
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid method from websocket client/));
  }, 60000);

  test('Websocket API send /api/login with no nodeContext', async () => {
    const context = (matterbridge as any).nodeContext;
    (matterbridge as any).nodeContext = undefined;
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Login nodeContext not found/));
    (matterbridge as any).nodeContext = context;
  }, 60000);

  test('Websocket API send /api/login with empty password', async () => {
    await (matterbridge as any).nodeContext.set('password', '');
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
  }, 60000);

  test('Websocket API send /api/login with password', async () => {
    await (matterbridge as any).nodeContext.set('password', '');
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: 'test' } });
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
  }, 60000);

  test('Websocket API send /api/login with wrong password', async () => {
    await (matterbridge as any).nodeContext.set('password', 'abcdef');
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: 'test' } });
    ws.send(message);
    await wait(1000, 'Wait for send', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Error wrong password/));
    await (matterbridge as any).nodeContext.set('password', '');
  }, 60000);

  test('Websocket API send ping', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: 'ping', params: {} });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(1);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeDefined();
    expect(data.response).toBe('pong');

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/settings', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/settings', params: {} });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(1);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeDefined();
    expect(data.response.matterbridgeInformation).toBeDefined();
    expect(data.response.systemInformation).toBeDefined();

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/plugins', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/plugins', params: {} });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(1);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeDefined();
    expect(data.response.length).toBe(3);

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/devices', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/devices', params: {} });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(1);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeDefined();
    expect(data.response.length).toBe(3);

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API send /api/devices with params', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/devices', params: { pluginName: 'matterbridge-mock1' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(1);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeDefined();
    expect(data.response.length).toBe(1);

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
  }, 60000);

  test('Websocket API install without params', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: {} });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).not.toBeDefined();
    expect(data.error).toBeDefined();
    expect(data.error).toBe('Wrong parameter packageName in /api/install');
  }, 60000);

  test('Websocket API install with wrong params', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbri' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).not.toBeDefined();
    expect(data.error).toBeDefined();
    expect(data.error).toBe('Wrong parameter packageName in /api/install');
  }, 60000);

  test('Websocket API install', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbridge-test' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBe(true);
    expect(data.error).not.toBeDefined();

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('installed correctly'));
  }, 60000);

  test('Websocket API install with wrong package name', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/install', params: { packageName: 'matterbridge-xxxtest' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
  }, 60000);

  test('Websocket API uninstall with wrong params', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbri' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).not.toBeDefined();
    expect(data.error).toBeDefined();
    expect(data.error).toBe('Wrong parameter packageName in /api/uninstall');
  }, 60000);

  test('Websocket API uninstall', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-test' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBe(true);
    expect(data.error).not.toBeDefined();

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('closed with code 0'));
  }, 60000);

  test('Websocket API uninstall wrong package name', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-st' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeDefined();
    expect(data.error).toBeUndefined();

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
  }, 60000);

  test('Websocket API uninstall wrong package name with mock', async () => {
    // Mock `spawnCommand` to reject with an error
    jest.spyOn(matterbridge as any, 'spawnCommand').mockRejectedValue(new Error('Package not found'));

    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    const message = JSON.stringify({ id: 10, dst: 'Matterbridge', src: 'Jest test', method: '/api/uninstall', params: { packageName: 'matterbridge-st' } });
    ws.send(message);

    // Set up a promise to wait for the response
    const responsePromise = new Promise((resolve) => {
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data as string);
        if (data.id === 10) resolve(event.data);
      };
    });

    // Wait for the response
    const response = await responsePromise;
    expect(response).toBeDefined();
    const data = JSON.parse(response as string);
    expect(data).toBeDefined();
    expect(data.id).toBe(10);
    expect(data.src).toBe('Matterbridge');
    expect(data.dst).toBe('Jest test');
    expect(data.response).toBeUndefined();
    expect(data.error).toBeDefined();
  }, 60000);

  test('Websocket API ping', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.ping();
    await wait(1000, 'Wait for ping', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client ping`);
  }, 60000);

  test('Websocket API pong', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.pong();
    await wait(1000, 'Wait for pong', true);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client pong`);
  }, 60000);

  test('Websocket API close', async () => {
    expect(ws).toBeDefined();
    expect(ws.readyState).toBe(WebSocket.OPEN);
    ws.close();
    // prettier-ignore
    await waiter('Websocket closed', () => { return ws.readyState === WebSocket.CLOSED; });
    expect(ws.readyState).toBe(WebSocket.CLOSED);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `WebSocket client disconnected`);
  }, 60000);

  test('Remove mock plugin 1', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin1');
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock1')).toBeFalsy();
  }, 60000);

  test('Remove mock plugin 2', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin2');
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock2${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock2')).toBeFalsy();
  }, 60000);

  test('Remove mock plugin 3', async () => {
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeTruthy();
    await (matterbridge as any).plugins.remove('./src/mock/plugin3');
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock3${nf}`);
    expect((matterbridge as any).plugins.has('matterbridge-mock3')).toBeFalsy();
  }, 60000);

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    expect((matterbridge as any).plugins.size).toBe(0);
    await matterbridge.destroyInstance();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    await wait(1000, 'Wait for matter to unload', false);
  }, 60000);
});
