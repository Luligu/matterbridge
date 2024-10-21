/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-logger', 'debug', '-matterlogger', 'fatal', '-bridge', '-profile', 'Jest', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { jest } from '@jest/globals';

jest.mock('@project-chip/matter-node.js/util');

import { AnsiLogger, db, LogLevel, nf, rs, UNDERLINE, UNDERLINEOFF } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils.js';
import WebSocket from 'ws';

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
      console.error(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      console.error(args);
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

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('Jest');
    expect(matterbridge.bridgeMode).toBe('bridge');

    await wait(5000);

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `The frontend http server is listening on ${UNDERLINE}http://${matterbridge.systemInformation.ipv4Address}:8283${UNDERLINEOFF}${rs}`);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Matter server started`);

    await wait(1000, 'Wait for matter to load', false);
  }, 60000);

  test('Add mock plugin 1', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    await (matterbridge as any).plugins.add('./src/mock/plugin1');
    const plugins = (matterbridge as any).plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(1);
    expect(plugins[0].name).toBe('matterbridge-mock1');
    expect(plugins[0].version).toBe('1.0.1');
    expect(plugins[0].description).toBe('Matterbridge mock plugin 1');
  }, 60000);

  test('Add mock plugin 2', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    await (matterbridge as any).plugins.add('./src/mock/plugin2');
    const plugins = (matterbridge as any).plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(2);
    expect(plugins[1].name).toBe('matterbridge-mock2');
    expect(plugins[1].version).toBe('1.0.2');
    expect(plugins[1].description).toBe('Matterbridge mock plugin 2');
  }, 60000);

  test('Add mock plugin 3', async () => {
    // loggerLogSpy.mockRestore();
    // consoleLogSpy.mockRestore();

    await (matterbridge as any).plugins.add('./src/mock/plugin3');
    const plugins = (matterbridge as any).plugins.array();
    expect(plugins).toBeDefined();
    expect(plugins.length).toBe(3);
    expect(plugins[2].name).toBe('matterbridge-mock3');
    expect(plugins[2].version).toBe('1.0.3');
    expect(plugins[2].description).toBe('Matterbridge mock plugin 3');
  }, 60000);

  test('Websocket API connect', async () => {
    ws = new WebSocket(`ws://localhost:8283`);
    expect(ws).toBeDefined();
    // prettier-ignore
    await waiter('Websocket connected', () => { return ws.readyState === WebSocket.OPEN; });
    expect(ws.readyState).toBe(WebSocket.OPEN);
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/WebSocketServer client ".*" connected to Matterbridge/));
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
    expect(data.response).toBeDefined();
    expect(data.response.length).toBe(0);

    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringMatching(/^Received message from websocket client/));
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

  test('Remove plugin 1', async () => {
    await (matterbridge as any).plugins.remove('./src/mock/plugin1');
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock1${nf}`);
  }, 60000);

  test('Remove plugin 2', async () => {
    await (matterbridge as any).plugins.remove('./src/mock/plugin2');
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock2${nf}`);
  }, 60000);

  test('Remove plugin 3', async () => {
    await (matterbridge as any).plugins.remove('./src/mock/plugin3');
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.INFO, `Removed plugin ${plg}matterbridge-mock3${nf}`);
  }, 60000);

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    await matterbridge.destroyInstance();
    expect((matterbridge as any).log.log).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    await wait(1000, 'Wait for matter to unload', false);
  }, 60000);
});
