// src\backendWsServer.test.ts

const MATTER_PORT = 9300;
const FRONTEND_PORT = 8287;
const NAME = 'BackendWsServer';
const HOMEDIR = path.join('.cache', 'jest', NAME);

process.argv = ['node', 'backendWsServer.test.js', '--debug-frontend', '--verbose-frontend'];

import { EventEmitter } from 'node:events';
import path from 'node:path';

import { jest } from '@jest/globals';
import { Logger, LogLevel as MatterLogLevel } from '@matter/general';
import type { SharedMatterbridge } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

import { BackendsWsServer } from './backendWsServer.js';
import type { Frontend } from './frontend.js';
import { isWorkerRequestBroadcastServerSpy } from './jestutils/jestBroadcastServerSpy.js';
import { loggerDebugSpy, loggerErrorSpy, loggerInfoSpy, setupTest } from './jestutils/jestHelpers.js';

const mockedSharedMatterbridge = {
  //
} as unknown as SharedMatterbridge;

const mockedBackend = {
  emit: jest.fn(),
  authClients: new Set<string>(),
  restartRequired: false,
  fixedRestartRequired: false,
  updateRequired: false,
} as unknown as Frontend;

// Setup the test environment
await setupTest(NAME, false);

// No isolation needed or allowed since we're testing a single module and want to preserve module state across tests

describe('BackendWsServer', () => {
  let wsServer: BackendsWsServer;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Constructor', () => {
    wsServer = new BackendsWsServer(mockedSharedMatterbridge, mockedBackend);
    expect(wsServer).toBeInstanceOf(BackendsWsServer);
  });

  test('BroadcastServer handler', async () => {
    isWorkerRequestBroadcastServerSpy.mockReturnValue(true);
    await (wsServer as any).broadcastMsgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'frontend' });
    await (wsServer as any).broadcastMsgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } });
    expect((wsServer as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('Start', async () => {
    await wsServer.start();
    expect(mockedBackend.emit).toHaveBeenCalledWith('websocket_server_listening', 'ws');
  });

  test('WebSocket handlers + wsMessageHandler paths', async () => {
    const wss: any = (wsServer as any).webSocketServer;

    class FakeClient extends EventEmitter {
      OPEN = 1;
      readyState = 1;
      send = jest.fn();
      pong = jest.fn();
      close = jest.fn();
    }

    const client1: any = new FakeClient();
    const client2: any = new FakeClient();

    // Pretend they are connected clients
    wss.clients.add(client1);
    wss.clients.add(client2);

    const request: any = { socket: { remoteAddress: '127.0.0.1' } };

    // Exercise callbackLogLevel selection (INFO and DEBUG branches)
    const originalMatterLogLevel = (Logger as any).level;
    try {
      (wsServer as any).log.logLevel = LogLevel.NOTICE;
      (Logger as any).level = MatterLogLevel.INFO;
      wss.emit('connection', client1, request);
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('connected to Matterbridge'));
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('logger global callback set to'));

      (wsServer as any).log.logLevel = LogLevel.NOTICE;
      (Logger as any).level = MatterLogLevel.DEBUG;
      wss.emit('connection', client2, request);
      expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('connected to Matterbridge'));
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('logger global callback set to'));
    } finally {
      (Logger as any).level = originalMatterLogLevel;
    }

    // invalid JSON => catch
    client1.emit('message', Buffer.from('{invalid json'));
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error parsing message from websocket client'));

    // invalid message (wrong dst) => send error response
    client1.emit('message', Buffer.from(JSON.stringify({ id: 1, src: 'Frontend', dst: 'Wrong', method: 'noop' })));
    expect(client1.send).toHaveBeenCalled();

    // client not open => sendResponse error branch
    client1.readyState = 0;
    await (wsServer as any).wsMessageHandler(client1, Buffer.from(JSON.stringify({ id: 2, src: 'Frontend', dst: 'Wrong', method: 'noop' })));
    client1.readyState = client1.OPEN;

    // Force sendResponse "response" branch via prototype property
    const originalResponseDescriptor = Object.getOwnPropertyDescriptor(Object.prototype, 'response');
    Object.defineProperty(Object.prototype, 'response', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: { forced: true },
    });
    await (wsServer as any).wsMessageHandler(client1, Buffer.from(JSON.stringify({ id: 22, src: 'Frontend', dst: 'Wrong', method: 'noop' })));
    if (originalResponseDescriptor) {
      Object.defineProperty(Object.prototype, 'response', originalResponseDescriptor);
    } else {
      delete (Object.prototype as any).response;
    }

    // valid message parses and passes validation
    client1.emit('message', Buffer.from(JSON.stringify({ id: 3, src: 'Frontend', dst: 'Matterbridge', method: 'noop' })));

    // ping/pong
    client1.emit('ping');
    expect(client1.pong).toHaveBeenCalled();
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('ping received'));
    client1.emit('pong');
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('pong received'));

    // client error handler
    client1.emit('error', new Error('client error'));

    // server close handler (still has another client)
    wss.clients.delete(client1);
    client1.emit('close', 1001, Buffer.from('going away'));

    // server-level close event
    wss.emit('close');
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('WebSocketServer closed'));

    // server-level error event
    wss.emit('error', client2, new Error('server error'));
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('WebSocketServer error'));

    // close branch when clients go to 0 + timeout cleanup
    jest.useFakeTimers();
    try {
      wss.clients.delete(client2);
      client2.emit('close', 1000, Buffer.from('done'));
      jest.advanceTimersByTime(1100);
      await Promise.resolve();
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Auth clients list cleared'));
    } finally {
      jest.useRealTimers();
    }
  });

  test('Send helpers (active + inactive clients)', async () => {
    // No clients => early returns
    expect(wsServer.hasActiveClients()).toBe(false);
    wsServer.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log', success: true } as any);
    wsServer.wssSendLogMessage('info', 't', 'n', 'm');
    wsServer.wssSendRefreshRequired('settings');
    wsServer.wssSendRestartRequired();
    wsServer.wssSendRestartRequired(true, true);
    wsServer.wssSendRestartNotRequired();
    wsServer.wssSendRestartNotRequired(true);
    wsServer.wssSendUpdateRequired();
    wsServer.wssSendUpdateRequired(true);
    wsServer.wssSendCpuUpdate(1, 2);
    wsServer.wssSendMemoryUpdate('1', '2', '3', '4', '5', '6', '7');
    wsServer.wssSendUptimeUpdate('sys', 'proc');
    wsServer.wssSendSnackbarMessage('hello');
    wsServer.wssSendSnackbarMessage('hello', 0, 'success');
    wsServer.wssSendCloseSnackbarMessage('hello');
    wsServer.wssSendAttributeChangedMessage('p', 's', 'u', 1 as any, 'id', 'cluster', 'attr', true);

    // Attach a fake server + open client for active paths
    class FakeClient extends EventEmitter {
      OPEN = 1;
      readyState = 1;
      send = jest.fn();
      close = jest.fn();
    }
    const client: any = new FakeClient();
    (wsServer as any).webSocketServer = {
      clients: new Set([client]),
      close: (cb: (error?: Error) => void) => cb(),
      removeAllListeners: jest.fn(),
    };

    expect(wsServer.hasActiveClients()).toBe(true);
    wsServer.wssSendRestartRequired(true, true);
    expect((mockedBackend as any).restartRequired).toBe(true);
    expect((mockedBackend as any).fixedRestartRequired).toBe(true);

    wsServer.wssSendRestartNotRequired(true);
    expect((mockedBackend as any).restartRequired).toBe(false);

    wsServer.wssSendUpdateRequired(true);
    expect((mockedBackend as any).updateRequired).toBe(true);

    wsServer.wssSendRefreshRequired('settings');
    wsServer.wssSendCpuUpdate(12.3456, 23.4567);
    wsServer.wssSendMemoryUpdate('1', '2', '3', '4', '5', '6', '7');
    wsServer.wssSendUptimeUpdate('sys', 'proc');
    wsServer.wssSendSnackbarMessage('hello', 0, 'success');
    wsServer.wssSendCloseSnackbarMessage('hello');
    wsServer.wssSendAttributeChangedMessage('p', 's', 'u', 1 as any, 'id', 'cluster', 'attr', true);

    wsServer.wssSendLogMessage('info', 't', 'n', `***hello\n\tworld ${'x'.repeat(150)}`);
    wsServer.wssSendLogMessage('spawn', 't', 'n', 'no-split');
    wsServer.wssSendLogMessage('', 't', 'n', 'missing level');

    const circular: any = { id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log', success: true };
    circular.self = circular;
    wsServer.wssBroadcastMessage(circular);

    expect(client.send).toHaveBeenCalled();
  });

  test('Stop', async () => {
    // Cover stop() error branch (no recreate): close callback with error
    class FakeClientForStop extends EventEmitter {
      readyState = 1;
      send = jest.fn();
      close = jest.fn();
    }
    const stopClient: any = new FakeClientForStop();
    (wsServer as any).webSocketServer = {
      clients: new Set([stopClient]),
      close: (cb: (error?: Error) => void) => cb(new Error('close failed')),
      removeAllListeners: jest.fn(),
    };
    await wsServer.stop();

    // stop with a running server (success path emits)
    const stopClient2: any = new FakeClientForStop();
    (wsServer as any).webSocketServer = {
      clients: new Set([stopClient2]),
      close: (cb: (error?: Error) => void) => cb(),
      removeAllListeners: jest.fn(),
    };
    await wsServer.stop();
    expect(mockedBackend.emit).toHaveBeenCalledWith('websocket_server_stopped');

    // stop when server is not running (covers debug branch)
    await wsServer.stop();
  });

  test('Destroy', async () => {
    wsServer.destroy();

    const server: any = (wsServer as any).server;
    expect(server).toBeDefined();
    expect(server.closed).toBe(true);
    expect(server.broadcastChannel?.onmessage).toBe(null);
    expect(server.broadcastChannel?.onmessageerror).toBe(null);
  });
});
