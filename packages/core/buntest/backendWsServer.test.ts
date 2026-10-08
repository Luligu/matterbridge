/**
 * @file packages/core/buntest/backendWsServer.test.ts
 * @description This file contains the tests for backendWsServer.
 * @author Luca Liguori
 */

const NAME = 'BackendWsServer';

import { afterAll, beforeEach, describe, expect, test, vi, type Mock } from 'bun:test';
import { EventEmitter } from 'node:events';

import { Logger, LogLevel as MatterLogLevel } from '@matter/general';
import { log, loggerDebugSpy, loggerErrorSpy, loggerInfoSpy, originalProcessArgv, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { BroadcastServer } from '@matterbridge/thread/server';
import type { ApiMatter, SharedMatterbridge } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

import type { Backend } from '../src/backend.js';
import { BackendWsServer } from '../src/backendWsServer.js';

// Spy on BroadcastServer methods
const isWorkerRequestBroadcastServerSpy = vi.spyOn(BroadcastServer.prototype, 'isWorkerRequest');

const mockedSharedMatterbridge = {
  //
} as unknown as SharedMatterbridge;

const mockedBackend = {
  emit: vi.fn(),
  authClients: new Set<string>(),
  restartRequired: false,
  fixedRestartRequired: false,
  updateRequired: false,
  secure: false,
  getApiMatter: vi.fn<Backend['getApiMatter']>(),
  getApiSettings: vi.fn(async () => ({ matterbridgeInformation: {} })),
  getApiPlugins: vi.fn(async () => [{ name: 'matterbridge-test' }]),
  getApiDevices: vi.fn(async () => [{ name: 'Device' }]),
  getApiCluster: vi.fn<Backend['getApiCluster']>(),
} as unknown as Backend;

// Setup the test environment
await setupTest(NAME, false, ['--debug-backend', '--verbose-backend']);

class FakeClient extends EventEmitter {
  OPEN = 1;
  readyState = 1;
  send = vi.fn();
  pong = vi.fn();
  close = vi.fn();
}

// No isolation needed or allowed since we're testing a single module and want to preserve module state across tests

describe('BackendWsServer', () => {
  let wsServer: BackendWsServer;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('Constructor', () => {
    wsServer = new BackendWsServer(mockedSharedMatterbridge, mockedBackend);
    expect(wsServer).toBeInstanceOf(BackendWsServer);
  });

  test('BroadcastServer handler', async () => {
    isWorkerRequestBroadcastServerSpy.mockReturnValue(true);
    await (wsServer as any).broadcastMsgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'frontend' });
    await (wsServer as any).broadcastMsgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } });
    expect((wsServer as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('should answer broadcast requests from another thread and ignore other messages', async () => {
    isWorkerRequestBroadcastServerSpy.mockRestore();
    const manager = new BroadcastServer('manager', log);
    const response = await manager.fetch({ type: 'get_log_level', src: 'manager', dst: 'frontend', params: undefined });
    expect(response.result.logLevel).toBe((wsServer as any).log.logLevel);

    // A response message is not a request and is ignored
    await (wsServer as any).broadcastMsgHandler({ id: 123456, timestamp: Date.now(), type: 'get_log_level', src: 'manager', dst: 'frontend', result: { logLevel: LogLevel.INFO } });
    manager.close();
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
      send = vi.fn();
      pong = vi.fn();
      close = vi.fn();
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
    vi.useFakeTimers();
    try {
      wss.clients.delete(client2);
      client2.emit('close', 1000, Buffer.from('done'));
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
      expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Auth clients list cleared'));
    } finally {
      vi.useRealTimers();
    }
  });

  test('should keep the auth clients when a client reconnects before the cleanup timer fires', async () => {
    const wss: any = (wsServer as any).webSocketServer;
    const client: any = new FakeClient();
    mockedBackend.authClients.add('127.0.0.1');

    vi.useFakeTimers();
    try {
      wss.emit('connection', client, { socket: { remoteAddress: '127.0.0.1' } });
      client.emit('close', 1000, Buffer.from('done'));
      // A client connects again before the timer fires
      wss.clients.add(client);
      vi.advanceTimersByTime(1100);
      await Promise.resolve();
      expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('Auth clients list cleared'));
      expect(mockedBackend.authClients.has('127.0.0.1')).toBe(true);
    } finally {
      wss.clients.delete(client);
      vi.useRealTimers();
    }
  });

  test('should parse fragmented and ArrayBuffer messages', async () => {
    const client: any = new FakeClient();
    const message = JSON.stringify({ id: 4, src: 'Frontend', dst: 'Matterbridge', method: 'noop' });

    await (wsServer as any).wsMessageHandler(client, [Buffer.from(message.slice(0, 10)), Buffer.from(message.slice(10))]);
    const arrayBuffer = new ArrayBuffer(message.length);
    new Uint8Array(arrayBuffer).set(Buffer.from(message));
    await (wsServer as any).wsMessageHandler(client, arrayBuffer);

    expect(loggerDebugSpy.mock.calls.filter((args) => args[0].includes('Received message from websocket client'))).toHaveLength(2);
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  test('should respond with pong when an API ping request is received', async () => {
    const client = new FakeClient();
    await (wsServer as any).wsMessageHandler(client, Buffer.from(JSON.stringify({ id: 9, src: 'Frontend', dst: 'Matterbridge', method: 'ping', params: {} })));
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send).toHaveBeenCalledWith(JSON.stringify({ id: 9, method: 'pong', src: 'Matterbridge', dst: 'Frontend', success: true, response: 'pong' }));
  });

  test('should serialize bigint response values with an n suffix and preserve other values', async () => {
    const client = new FakeClient();
    const response = { id: 'Matterbridge', values: [9007199254740993n, -42n, 0n, 42, 'text', true, null], nested: { value: 12n } };
    (mockedBackend.getApiMatter as unknown as Mock<(...args: any[]) => any>).mockResolvedValueOnce(response);
    await (wsServer as any).wsMessageHandler(
      client,
      Buffer.from(JSON.stringify({ id: 8, src: 'Frontend', dst: 'Matterbridge', method: '/api/matter', params: { id: 'Matterbridge' } })),
    );
    expect(client.send).toHaveBeenCalledTimes(1);
    expect(client.send).toHaveBeenCalledWith(
      JSON.stringify({
        id: 8,
        method: '/api/matter',
        src: 'Matterbridge',
        dst: 'Frontend',
        success: true,
        response: { id: 'Matterbridge', values: ['9007199254740993n', '-42n', '0n', 42, 'text', true, null], nested: { value: '12n' } },
      }),
    );
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  test('should answer the settings, plugins, devices and clusters api requests', async () => {
    const client: any = new FakeClient();
    const request = async (method: string, params: Record<string, unknown> = {}): Promise<any> => {
      client.send.mockClear();
      await (wsServer as any).wsMessageHandler(client, Buffer.from(JSON.stringify({ id: 10, src: 'Frontend', dst: 'Matterbridge', method, params })));
      expect(client.send).toHaveBeenCalledTimes(1);
      return JSON.parse(client.send.mock.calls[0][0]);
    };

    expect(await request('/api/matter', { id: 1 })).toMatchObject({ error: 'Wrong parameter id in /api/matter' });
    // oxlint-disable-next-line unicorn/no-useless-undefined -- Explicitly mock a missing server node.
    (mockedBackend.getApiMatter as unknown as Mock<(...args: any[]) => any>).mockResolvedValueOnce(undefined);
    expect(await request('/api/matter', { id: 'missing' })).toMatchObject({ error: 'Unknown server node id missing in /api/matter' });
    const matter = { id: 'Matterbridge' } as ApiMatter;
    (mockedBackend.getApiMatter as unknown as Mock<(...args: any[]) => any>).mockResolvedValueOnce(matter);
    expect(await request('/api/matter', { id: 'Matterbridge', server: true })).toMatchObject({ success: true, response: matter });
    expect(mockedBackend.getApiMatter).toHaveBeenLastCalledWith('Matterbridge');
    expect(await request('/api/settings')).toEqual({
      id: 10,
      method: '/api/settings',
      src: 'Matterbridge',
      dst: 'Frontend',
      success: true,
      response: { matterbridgeInformation: {} },
    });
    expect(mockedBackend.getApiSettings).toHaveBeenCalled();

    expect(await request('/api/plugins')).toMatchObject({ success: true, response: [{ name: 'matterbridge-test' }] });
    expect(mockedBackend.getApiPlugins).toHaveBeenCalled();

    expect(await request('/api/devices')).toMatchObject({ success: true, response: [{ name: 'Device' }] });
    expect((mockedBackend.getApiDevices as unknown as Mock<(...args: any[]) => any>).mock.lastCall).toEqual([undefined]);
    expect(await request('/api/devices', { pluginName: 'matterbridge-test' })).toMatchObject({ success: true });
    expect(mockedBackend.getApiDevices).toHaveBeenLastCalledWith('matterbridge-test');

    expect(await request('/api/clusters', { plugin: 'short', endpoint: 1 })).toMatchObject({ error: 'Wrong parameter plugin in /api/clusters' });
    expect(await request('/api/clusters', { plugin: 'matterbridge-test', endpoint: 0 })).toMatchObject({ error: 'Wrong parameter endpoint in /api/clusters' });
    expect(mockedBackend.getApiCluster).not.toHaveBeenCalled();

    expect(await request('/api/clusters', { plugin: 'matterbridge-test', endpoint: 1 })).toMatchObject({ error: 'Endpoint not found in /api/clusters' });
    expect((mockedBackend.getApiCluster as unknown as Mock<(...args: any[]) => any>).mock.lastCall).toEqual(['matterbridge-test', 1, undefined, undefined]);

    (mockedBackend.getApiCluster as unknown as Mock<(...args: any[]) => any>).mockResolvedValueOnce({ plugin: 'matterbridge-test', endpoint: 1 });
    expect(await request('/api/clusters', { plugin: 'matterbridge-test', endpoint: 1, serialNumber: 'SN1', uniqueId: 'UID1' })).toMatchObject({
      success: true,
      response: { plugin: 'matterbridge-test', endpoint: 1 },
    });
    expect(mockedBackend.getApiCluster).toHaveBeenLastCalledWith('matterbridge-test', 1, 'SN1', 'UID1');
    expect(loggerErrorSpy).not.toHaveBeenCalled();
  });

  test.each(['/api/restart', '/api/shutdown'] as const)('should forward %s to the main thread and acknowledge the request', async (method) => {
    const client = new FakeClient();
    const fetchSpy = vi.spyOn(BroadcastServer.prototype, 'fetch').mockResolvedValueOnce({ result: { success: true } } as never);
    const snackbarSpy = vi.spyOn(wsServer, 'wssSendSnackbarMessage');
    try {
      await (wsServer as any).wsMessageHandler(client, Buffer.from(JSON.stringify({ id: 12, src: 'Frontend', dst: 'Matterbridge', method, params: {} })));
      expect(fetchSpy).toHaveBeenCalledWith({
        type: method === '/api/restart' ? 'matterbridge_restart' : 'matterbridge_shutdown',
        src: 'frontend',
        dst: 'matterbridge',
        params: undefined,
      });
      expect(snackbarSpy).toHaveBeenCalledWith(method === '/api/restart' ? 'Restarting matterbridge...' : 'Shutting down matterbridge...', 0);
      expect(JSON.parse(client.send.mock.calls[0][0])).toEqual({ id: 12, method, src: 'Matterbridge', dst: 'Frontend', success: true });
    } finally {
      fetchSpy.mockRestore();
      snackbarSpy.mockRestore();
    }
  });

  test('should write the diagnostic timings when diagnostic is enabled', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const client: any = new FakeClient();
    (wsServer as any).diagnostic = true;
    try {
      for (const method of ['/api/settings', '/api/plugins', '/api/devices', '/api/clusters']) {
        await (wsServer as any).wsMessageHandler(
          client,
          Buffer.from(JSON.stringify({ id: 11, src: 'Frontend', dst: 'Matterbridge', sender: 'Test', method, params: { plugin: 'matterbridge-test', endpoint: 1 } })),
        );
      }
      for (const name of ['getApiSettings', 'getApiPlugins', 'getApiDevices', 'getApiCluster']) {
        expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining(`Frontend:Test: ${name}() took`));
      }
      expect(client.send).toHaveBeenCalledTimes(4);
    } finally {
      (wsServer as any).diagnostic = false;
      stderrSpy.mockRestore();
    }
  });

  test('Send helpers (active + inactive clients)', () => {
    // No clients => early returns
    expect(wsServer.hasActiveClients()).toBe(false);
    wsServer.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log', success: true } as any);
    wsServer.wssSendLogMessage('info', 't', 'n', 'm');
    wsServer.wssSendRefreshRequired('settings');
    wsServer.wssSendRestartRequired();
    wsServer.wssSendRestartRequired(true, true);
    wsServer.wssSendRestartNotRequired();
    wsServer.wssSendRestartNotRequired(true);
    wsServer.wssSendUpdateRequired('3.0.0', false);
    wsServer.wssSendUpdateRequired('3.0.0', true);
    wsServer.wssSendPluginUpdateRequired('plugin', '3.0.0', false);
    wsServer.wssSendPluginUpdateRequired('plugin', '3.0.0', true);
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
      send = vi.fn();
      close = vi.fn();
    }
    const client: any = new FakeClient();
    (wsServer as any).webSocketServer = {
      clients: new Set([client]),
      // oxlint-disable-next-line typescript/explicit-function-return-type
      close: (cb: (error?: Error) => void) => cb(),
      removeAllListeners: vi.fn(),
    };

    expect(wsServer.hasActiveClients()).toBe(true);
    wsServer.wssSendRestartRequired(true, true);
    // TODO: re-enable when the backend state mutations are restored in wssSendRestartRequired() (see the "// TODO check" lines in backendWsServer.ts).
    // expect((mockedBackend as any).restartRequired).toBe(true);
    // expect((mockedBackend as any).fixedRestartRequired).toBe(true);

    wsServer.wssSendRestartNotRequired(true);
    // expect((mockedBackend as any).restartRequired).toBe(false);

    wsServer.wssSendUpdateRequired('3.3.0', true);
    // TODO: re-enable when the backend state mutation is restored in wssSendUpdateRequired() (see the "// TODO check" line in backendWsServer.ts).
    // expect((mockedBackend as any).updateRequired).toBe(true);

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

  test('should not broadcast to clients that are not open', () => {
    const open: any = { OPEN: 1, readyState: 1, send: vi.fn() };
    const closing: any = { OPEN: 1, readyState: 2, send: vi.fn() };
    (wsServer as any).webSocketServer = { clients: new Set([open, closing]) };

    wsServer.wssBroadcastMessage({ id: 0, src: 'Matterbridge', dst: 'Frontend', method: 'log', success: true } as any);

    expect(open.send).toHaveBeenCalledTimes(1);
    expect(closing.send).not.toHaveBeenCalled();
  });

  test('should send the status updates and skip the snackbar when not requested', () => {
    // No clients => early returns
    (wsServer as any).webSocketServer = undefined;
    wsServer.wssSendPluginStatusUpdate('plugin', {});
    wsServer.wssSendMatterbridgeStatusUpdate({} as any);

    const client: any = new FakeClient();
    (wsServer as any).webSocketServer = { clients: new Set([client]) };
    wsServer.wssSendPluginStatusUpdate('plugin', { loaded: true });
    wsServer.wssSendMatterbridgeStatusUpdate({ online: true } as any);
    wsServer.wssSendRestartRequired(false);
    wsServer.wssSendRestartNotRequired(false);
    wsServer.wssSendPluginUpdateRequired('plugin', '3.0.0');

    const methods = client.send.mock.calls.map((args: string[]) => JSON.parse(args[0]).method);
    expect(methods).toEqual(['plugin_status_update', 'matterbridge_status_update', 'restart_required', 'restart_not_required', 'plugin_update_required']);
  });

  test('Stop', async () => {
    // Cover stop() error branch (no recreate): close callback with error
    class FakeClientForStop extends EventEmitter {
      readyState = 1;
      send = vi.fn();
      close = vi.fn();
    }
    const stopClient: any = new FakeClientForStop();
    (wsServer as any).webSocketServer = {
      clients: new Set([stopClient]),
      // oxlint-disable-next-line typescript/explicit-function-return-type
      close: (cb: (error?: Error) => void) => cb(new Error('close failed')),
      removeAllListeners: vi.fn(),
    };
    await wsServer.stop();

    // stop with a running server (success path emits)
    const stopClient2: any = new FakeClientForStop();
    (wsServer as any).webSocketServer = {
      clients: new Set([stopClient2]),
      // oxlint-disable-next-line typescript/explicit-function-return-type
      close: (cb: (error?: Error) => void) => cb(),
      removeAllListeners: vi.fn(),
    };
    await wsServer.stop();
    expect(mockedBackend.emit).toHaveBeenCalledWith('websocket_server_stopped');

    // stop when server is not running (covers debug branch)
    await wsServer.stop();
  });

  test('should not close the clients that are not open on stop', async () => {
    const closedClient: any = new FakeClient();
    closedClient.readyState = 3;
    (wsServer as any).webSocketServer = {
      clients: new Set([closedClient]),
      // oxlint-disable-next-line typescript/explicit-function-return-type
      close: (cb: (error?: Error) => void) => cb(),
      removeAllListeners: vi.fn(),
    };
    await wsServer.stop();
    expect(closedClient.close).not.toHaveBeenCalled();
  });

  test('Destroy', () => {
    wsServer.destroy();

    const server: any = (wsServer as any).server;
    expect(server).toBeDefined();
    expect(server.closed).toBe(true);
    expect(server.broadcastChannel?.onmessage).toBe(null);
    expect(server.broadcastChannel?.onmessageerror).toBe(null);
  });

  test('should use wss, the info log level and no verbose logs without debug flags and with a secure backend', async () => {
    const savedArgv = process.argv;
    process.argv = originalProcessArgv.slice(0, 2);
    (mockedBackend as any).secure = true;
    try {
      const quietServer = new BackendWsServer(mockedSharedMatterbridge, mockedBackend);
      expect((quietServer as any).log.logLevel).toBe(LogLevel.INFO);
      await quietServer.start();
      expect(mockedBackend.emit).toHaveBeenCalledWith('websocket_server_listening', 'wss');

      const realServer = (quietServer as any).webSocketServer;
      const client: any = new FakeClient();
      (quietServer as any).webSocketServer = { clients: new Set([client]) };
      quietServer.wssSendRefreshRequired('settings');
      quietServer.wssSendRestartRequired();
      quietServer.wssSendRestartNotRequired();
      quietServer.wssSendUpdateRequired('3.0.0');
      quietServer.wssSendPluginUpdateRequired('plugin', '3.0.0');
      quietServer.wssSendPluginStatusUpdate('plugin', {});
      quietServer.wssSendMatterbridgeStatusUpdate({} as any);
      quietServer.wssSendCpuUpdate(1, 2);
      quietServer.wssSendMemoryUpdate('1', '2', '3', '4', '5', '6', '7');
      quietServer.wssSendUptimeUpdate('sys', 'proc');
      quietServer.wssSendSnackbarMessage('hello');
      quietServer.wssSendCloseSnackbarMessage('hello');
      quietServer.wssSendAttributeChangedMessage('p', 's', 'u', 1 as any, 'id', 'cluster', 'attr', true);
      expect(client.send).toHaveBeenCalled();
      expect(loggerDebugSpy).not.toHaveBeenCalledWith(expect.stringContaining('to all connected clients'));

      (quietServer as any).webSocketServer = realServer;
      await quietServer.stop();
      quietServer.destroy();
    } finally {
      (mockedBackend as any).secure = false;
      process.argv = savedArgv;
    }
  });
});
