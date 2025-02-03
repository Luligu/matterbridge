/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'frontend.test.js', '-logger', 'info', '-matterlogger', 'notice', '-bridge', '-profile', 'Jest', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils.js';
import WebSocket from 'ws';
import { onOffLight, onOffOutlet, onOffSwitch, temperatureSensor } from './matterbridgeDeviceTypes.js';
import { Identify } from '@matter/main/clusters';
import { RegisteredPlugin } from './matterbridgeTypes.js';
import { MdnsService } from '@matter/main/protocol';
import http from 'http';
import { MatterbridgeEndpoint } from './matterbridgeEndpoint.js';

// Default colors
const plg = '\u001B[38;5;33m';
const dev = '\u001B[38;5;79m';
const typ = '\u001B[38;5;207m';

describe('Matterbridge frontend', () => {
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

  describe('Matterbridge frontend express test', () => {
    let matterbridge: Matterbridge;
    let baseUrl: string;

    beforeAll(async () => {
      // Load the Matterbridge instance
      matterbridge = await Matterbridge.loadInstance(true);
    });

    afterAll(async () => {
      // Close the Matterbridge instance
      await matterbridge.destroyInstance();
    });

    const makeRequest = (path: string, method: string, body?: any) => {
      return new Promise<{ status: number; body: any }>((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const req = http.request(
          `${'http://localhost:8283'}${path}`,
          {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': data ? Buffer.byteLength(data) : 0,
            },
          },
          (res) => {
            let responseBody = '';
            res.on('data', (chunk) => (responseBody += chunk));
            res.on('end', () => {
              resolve({
                status: res.statusCode || 500,
                body: JSON.parse(responseBody),
              });
            });
          },
        );
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
      });
    };

    test('Reset Jest plugins', async () => {
      matterbridge.plugins.clear();
      expect(await matterbridge.plugins.saveToStorage()).toBe(0);
    });

    test('Frontend is running on http', async () => {
      expect((matterbridge as any).frontend.httpServer).toBeDefined();
      expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
      expect((matterbridge as any).frontend.expressApp).toBeDefined();
      expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    });

    test('POST /api/login with valid password', async () => {
      // Set the password in the nodeContext
      await matterbridge.nodeContext?.set('password', 'testpassword');

      const response = await makeRequest('/api/login', 'POST', { password: 'testpassword' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    test('POST /api/login with invalid password', async () => {
      // Set the password in the nodeContext
      await matterbridge.nodeContext?.set('password', 'testpassword');

      const response = await makeRequest('/api/login', 'POST', { password: 'wrongpassword' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);
    });

    test('POST /api/login with no nodeContext', async () => {
      // Temporarily remove the nodeContext
      const originalNodeContext = matterbridge.nodeContext;
      matterbridge.nodeContext = undefined;

      const response = await makeRequest('/api/login', 'POST', { password: 'testpassword' });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(false);

      // Restore the nodeContext
      matterbridge.nodeContext = originalNodeContext;
    });

    test('GET /health', async () => {
      const response = await makeRequest('/health', 'GET');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(typeof response.body.uptime).toBe('number');
      expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
    });

    test('GET /api/settings', async () => {
      const response = await makeRequest('/api/settings', 'GET');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('systemInformation');
      expect(response.body.systemInformation).toHaveProperty('interfaceName');
      expect(response.body.systemInformation).toHaveProperty('macAddress');
      expect(response.body.systemInformation).toHaveProperty('ipv4Address');
      expect(response.body.systemInformation).toHaveProperty('ipv6Address');
      expect(response.body.systemInformation).toHaveProperty('nodeVersion');
      expect(response.body.systemInformation).toHaveProperty('hostname');
      expect(response.body.systemInformation).toHaveProperty('user');
      expect(response.body.systemInformation).toHaveProperty('osType');
      expect(response.body.systemInformation).toHaveProperty('osRelease');
      expect(response.body.systemInformation).toHaveProperty('osPlatform');
      expect(response.body.systemInformation).toHaveProperty('osArch');
      expect(response.body.systemInformation).toHaveProperty('totalMemory');
      expect(response.body.systemInformation).toHaveProperty('freeMemory');
      expect(response.body.systemInformation).toHaveProperty('systemUptime');

      expect(response.body).toHaveProperty('matterbridgeInformation');
      expect(response.body.matterbridgeInformation).toHaveProperty('bridgeMode');
      expect(response.body.matterbridgeInformation).toHaveProperty('restartMode');
      expect(response.body.matterbridgeInformation).toHaveProperty('loggerLevel');
      expect(response.body.matterbridgeInformation).toHaveProperty('matterLoggerLevel');
      expect(response.body.matterbridgeInformation).toHaveProperty('matterPort');
      expect(response.body.matterbridgeInformation).toHaveProperty('profile');
    });

    test('GET /api/plugins', async () => {
      const response = await makeRequest('/api/plugins', 'GET');

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('object');
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('GET /api/devices', async () => {
      const response = await makeRequest('/api/devices', 'GET');

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('object');
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Matterbridge frontend websocket test', () => {
    let matterbridge: Matterbridge;
    let ws: WebSocket;

    afterAll(async () => {
      ws.close();
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
      await waiter('Frontend Initialize done', () => { return (matterbridge as any).frontend.httpServer!==undefined; });
      // prettier-ignore
      await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).frontend.webSocketServer!==undefined; });
      // prettier-ignore
      await waiter('Matter server node started', () => { return (matterbridge as any).reachabilityTimeout; });

      const server = matterbridge.serverNode;

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);

      ws = new WebSocket(`ws://localhost:8283`);
      expect(ws).toBeDefined();
      // prettier-ignore
      await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
      expect(ws.readyState).toBe(WebSocket.OPEN);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));

      const message = JSON.stringify({ id: 15, dst: 'Matterbridge', src: 'Jest test', method: '/api/restart', params: {} });
      ws.send(message);

      // Close the Matterbridge instance
      // prettier-ignore
      await waiter('Cleanup done', () => { return (matterbridge as any).initialized === false; });
      await server?.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocketServer closed`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Cleanup completed. Restarting...`);
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
      await waiter('Frontend Initialize done', () => { return (matterbridge as any).frontend.httpServer!==undefined; });
      // prettier-ignore
      await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).frontend.webSocketServer!==undefined; });
      // prettier-ignore
      await waiter('Matter server node started', () => { return (matterbridge as any).reachabilityTimeout; });

      const server = matterbridge.serverNode;

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);

      ws = new WebSocket(`ws://localhost:8283`);
      expect(ws).toBeDefined();
      // prettier-ignore
      await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
      expect(ws.readyState).toBe(WebSocket.OPEN);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));

      const message = JSON.stringify({ id: 15, dst: 'Matterbridge', src: 'Jest test', method: '/api/shutdown', params: {} });
      ws.send(message);

      // Close the Matterbridge instance
      // prettier-ignore
      await waiter('Cleanup done', () => { return (matterbridge as any).initialized === false; });
      await server?.env.get(MdnsService)[Symbol.asyncDispose]();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocketServer closed`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    }, 60000);

    test('Matterbridge.loadInstance(true) -bridge mode', async () => {
      matterbridge = await Matterbridge.loadInstance(true);
      expect(matterbridge).toBeDefined();
      expect(matterbridge.profile).toBe('Jest');
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `The WebSocketServer is listening on ${UNDERLINE}ws://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Starting Matterbridge server node`);
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
      ws = new WebSocket(`ws://localhost:8283`);
      expect(ws).toBeDefined();
      // prettier-ignore
      await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
      expect(ws.readyState).toBe(WebSocket.OPEN);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));
    }, 60000);

    test('Websocket API send bad json message', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = 'This is not a JSON message';
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Error parsing message/), expect.stringMatching(/^Unexpected token/));
    }, 60000);

    test('Websocket API send wrong message', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matter', src: 'Jest test', method: '/api/settings', params: {} });
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid message from websocket client/));
    }, 60000);

    test('Websocket API send wrong method', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api', params: {} });
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Invalid method from websocket client/));
    }, 60000);

    test('Websocket API send /api/login with no nodeContext', async () => {
      const context = (matterbridge as any).nodeContext;
      (matterbridge as any).nodeContext = undefined;
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringMatching(/^Login nodeContext not found/));
      (matterbridge as any).nodeContext = context;
    }, 60000);

    test('Websocket API send /api/login with empty password', async () => {
      await (matterbridge as any).nodeContext.set('password', '');
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: '' } });
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
    }, 60000);

    test('Websocket API send /api/login with password', async () => {
      await (matterbridge as any).nodeContext.set('password', '');
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: 'test' } });
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Login password valid/));
    }, 60000);

    test('Websocket API send /api/login with wrong password', async () => {
      await (matterbridge as any).nodeContext.set('password', 'abcdef');
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/login', params: { password: 'test' } });
      ws.send(message);
      await wait(1000, 'Wait for send', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Error wrong password/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/clusters without params', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: {} });
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
      expect(data.method).toBe('/api/clusters');
      expect(data.response).toBeUndefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/clusters with wrong params', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1' } });
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
      expect(data.method).toBe('/api/clusters');
      expect(data.response).toBeUndefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/clusters', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/clusters', params: { plugin: 'matterbridge-mock1', endpoint: 2 } });
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
      expect(data.method).toBe('/api/clusters');
      expect(data.response).toBeDefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/select without plugin param', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/select', params: {} });
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
      expect(data.method).toBe('/api/select');
      expect(data.error).toBeDefined();
      expect(data.error).toBe('Wrong parameter plugin in /api/select');
      expect(data.response).toBeUndefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/select with wrong plugin', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/select', params: { plugin: 'matterbridge_unknown' } });
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
      expect(data.method).toBe('/api/select');
      expect(data.error).toBeDefined();
      expect(data.error).toBe('Plugin not found in /api/select');
      expect(data.response).toBeUndefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/select', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/select', params: { plugin: 'matterbridge-mock1' } });
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
      expect(data.method).toBe('/api/select');
      expect(data.error).toBeUndefined();
      // expect(data.response).toBeDefined();
      // expect(data.response).toBe([]);

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/select/entities without plugin param', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: {} });
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
      expect(data.method).toBe('/api/select/entities');
      expect(data.error).toBeDefined();
      expect(data.error).toBe('Wrong parameter plugin in /api/select/entities');
      expect(data.response).toBeUndefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/select/entities with wrong plugin', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: { plugin: 'matterbridge_unknown' } });
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
      expect(data.method).toBe('/api/select/entities');
      expect(data.error).toBeDefined();
      expect(data.error).toBe('Plugin not found in /api/select/entities');
      expect(data.response).toBeUndefined();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
    }, 60000);

    test('Websocket API send /api/select/entities', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      const message = JSON.stringify({ id: 1, dst: 'Matterbridge', src: 'Jest test', method: '/api/select/entities', params: { plugin: 'matterbridge-mock1' } });
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
      expect(data.method).toBe('/api/select/entities');
      expect(data.error).toBeUndefined();
      // expect(data.response).toBeDefined();
      // expect(data.response).toBe([]);

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, expect.stringContaining('installed correctly'));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('closed with code 0'));
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

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Spawn command/));
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
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client ping`);
    }, 60000);

    test('Websocket API pong', async () => {
      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.pong();
      await wait(1000, 'Wait for pong', true);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket client pong`);
    }, 60000);

    test('Websocket API close', async () => {
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

    test('Matterbridge.destroyInstance() -bridge mode', async () => {
      expect((matterbridge as any).plugins.size).toBe(0);

      // Close the Matterbridge instance
      const server = matterbridge.serverNode;
      await matterbridge.destroyInstance();
      await server?.env.get(MdnsService)[Symbol.asyncDispose]();

      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    }, 60000);
  });
});
