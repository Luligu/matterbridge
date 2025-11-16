// src\frontend.express.test.ts

/* eslint-disable no-console */

const MATTER_PORT = 6005;
const FRONTEND_PORT = 8285;
const NAME = 'Frontend';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'frontend.test.js', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString(), '-debug', '-logger', 'debug'];

import { copyFileSync, readFileSync } from 'node:fs';
import path from 'node:path';

jest.unstable_mockModule('node:http', async () => {
  const originalModule = jest.requireActual<typeof import('node:http')>('node:http');
  return {
    ...originalModule,
    createServer: jest.fn((...args) => {
      return (originalModule.createServer as typeof originalModule.createServer)(...(args as any));
    }),
  };
});
const http = await import('node:http');
const createServerMock = http.createServer as jest.MockedFunction<typeof http.createServer>;

import { jest } from '@jest/globals';
import { db, LogLevel, rs, UNDERLINE, UNDERLINEOFF, YELLOW } from 'node-ansi-logger';
import { WebSocket } from 'ws';
// Dynamically import after mocking
const { Matterbridge } = await import('./matterbridge.ts');
const { Frontend } = await import('./frontend.ts');
import { Lifecycle } from '@matter/general';
import { PowerSource } from '@matter/types/clusters/power-source';

import type { Matterbridge as MatterbridgeType } from './matterbridge.js';
import type { Frontend as FrontendType } from './frontend.js';
import { cliEmitter } from './cliEmitter.js';
import { wait, waiter } from './utils/wait.js';
import { closeMdnsInstance, destroyInstance, loggerLogSpy, setDebug, setupTest } from './jestutils/jestHelpers.js';
import { BroadcastServer } from './broadcastServer.js';

// Mock BroadcastServer methods
const broadcastServerIsWorkerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerRequest').mockImplementation(() => true);
const broadcastServerIsWorkerResponseSpy = jest.spyOn(BroadcastServer.prototype, 'isWorkerResponse').mockImplementation(() => true);
const broadcastServerBroadcastMessageHandlerSpy = jest.spyOn(BroadcastServer.prototype as any, 'broadcastMessageHandler').mockImplementation(() => {});
const broadcastServerRequestSpy = jest.spyOn(BroadcastServer.prototype, 'request').mockImplementation(() => {});
const broadcastServerRespondSpy = jest.spyOn(BroadcastServer.prototype, 'respond').mockImplementation(() => {});
const broadcastServerFetchSpy = jest.spyOn(BroadcastServer.prototype, 'fetch').mockImplementation(async () => {
  return Promise.resolve(undefined) as any;
});

// Spy on Frontend methods
const startSpy = jest.spyOn(Frontend.prototype, 'start');
const stopSpy = jest.spyOn(Frontend.prototype, 'stop');

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge frontend', () => {
  let matterbridge: MatterbridgeType;
  let frontend: FrontendType;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    frontend.destroy();
    // Close mDNS instance
    await closeMdnsInstance(matterbridge);
    // Restore all mocks
    jest.restoreAllMocks();
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

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).frontend.httpServer!==undefined; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).frontend.webSocketServer!==undefined; });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(createServerMock).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}${FRONTEND_PORT}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on`));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening`));
  }, 60000);

  test('broadcast handler', async () => {
    startSpy.mockImplementationOnce(() => Promise.resolve());
    stopSpy.mockImplementationOnce(() => Promise.resolve());
    broadcastServerIsWorkerRequestSpy.mockImplementationOnce(() => false);
    await (frontend as any).msgHandler({} as any);
    broadcastServerIsWorkerResponseSpy.mockImplementationOnce(() => false);
    await (frontend as any).msgHandler({} as any);

    expect((frontend as any).server).toBeInstanceOf(BroadcastServer);

    await (frontend as any).msgHandler({ type: 'jest', src: 'manager', dst: 'frontend' } as any); // no id
    await (frontend as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'unknown' } as any); // unknown dst
    await (frontend as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'frontend' } as any); // valid
    await (frontend as any).msgHandler({ id: 123456, type: 'jest', src: 'manager', dst: 'all' } as any); // valid
    await (frontend as any).msgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'frontend', params: {} } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_start', src: 'manager', dst: 'frontend', params: { port: 3000 } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_stop', src: 'manager', dst: 'frontend', params: { port: 3000 } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_refreshrequired', src: 'manager', dst: 'frontend', params: { changed: 'matter', matter: {} } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_restartrequired', src: 'manager', dst: 'frontend', params: { snackbar: true, fixed: true } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_restartnotrequired', src: 'manager', dst: 'frontend', params: { snackbar: true } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_updaterequired', src: 'manager', dst: 'frontend', params: { devVersion: true } } as any);
    await (frontend as any).msgHandler({ id: 123456, type: 'frontend_snackbarmessage', src: 'manager', dst: 'frontend', params: { message: 'message', timeout: 5, severity: 'info' } } as any);
    await (frontend as any).msgHandler({
      id: 123456,
      type: 'frontend_attributechanged',
      src: 'manager',
      dst: 'frontend',
      params: { plugin: 'test', serialNumber: '1234', uniqueId: 'uniqueId', number: 123, id: 'id', cluster: 'cluster', attribute: 'attribute', value: 'value' },
    } as any);
    for (const type of ['plugins_install', 'plugins_uninstall'] as const) {
      await (frontend as any).msgHandler({ id: 123456, type, src: 'manager', dst: 'all', response: { success: true, packageName: 'testPlugin' } } as any);
      await (frontend as any).msgHandler({ id: 123456, type, src: 'manager', dst: 'all', response: { success: false, packageName: 'testPlugin' } } as any);
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

  test('Frontend getReachability', () => {
    // Test the getReachability functionality
    expect((frontend as any).getReachability({ lifecycle: { isReady: false } })).toBeFalsy();
    expect((frontend as any).getReachability({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBeFalsy();
    expect((frontend as any).getReachability({ hasClusterServer: () => true, getAttribute: () => true, lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active } })).toBeTruthy();
    expect(
      (frontend as any).getReachability({ hasClusterServer: () => false, mode: 'server', serverNode: { state: { basicInformation: { reachable: true } } }, lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active } }),
    ).toBeTruthy();
    matterbridge.bridgeMode = 'childbridge';
    expect((frontend as any).getReachability({ hasClusterServer: () => false, lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active } })).toBeTruthy();
    matterbridge.bridgeMode = 'bridge';
    expect((frontend as any).getReachability({ hasClusterServer: () => false, lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active } })).toBeFalsy();
  });

  test('Frontend getPowerSource', () => {
    // Undefined if not active
    expect((frontend as any).getPowerSource({ lifecycle: { isReady: false } })).toBeUndefined();
    expect((frontend as any).getPowerSource({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBeUndefined();

    // Wired ac
    let device = { lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active }, hasClusterServer: jest.fn(), getAttribute: jest.fn((cluster: number, attribute: string) => {}), getChildEndpoints: jest.fn() };
    device.hasClusterServer = jest.fn(() => true);
    device.getAttribute = jest.fn((cluster: number, attribute: string) => {
      if (cluster === PowerSource.Cluster.id && attribute === 'featureMap') return { wired: true };
      if (cluster === PowerSource.Cluster.id && attribute === 'wiredCurrentType') return PowerSource.WiredCurrentType.Ac;
    });
    expect((frontend as any).getPowerSource(device)).toBe('ac');

    // Battery
    device = { lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active }, hasClusterServer: jest.fn(), getAttribute: jest.fn((cluster: number, attribute: string) => {}), getChildEndpoints: jest.fn() };
    device.hasClusterServer = jest.fn(() => true);
    device.getAttribute = jest.fn((cluster: number, attribute: string) => {
      if (cluster === PowerSource.Cluster.id && attribute === 'featureMap') return { battery: true };
      if (cluster === PowerSource.Cluster.id && attribute === 'batChargeLevel') return PowerSource.BatChargeLevel.Ok;
    });
    expect((frontend as any).getPowerSource(device)).toBe('ok');

    // Not wired nor battery
    device = { lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Active }, hasClusterServer: jest.fn(), getAttribute: jest.fn((cluster: number, attribute: string) => {}), getChildEndpoints: jest.fn() };
    device.hasClusterServer = jest.fn(() => true);
    device.getAttribute = jest.fn((cluster: number, attribute: string) => {
      if (cluster === PowerSource.Cluster.id && attribute === 'featureMap') return {};
    });
    expect((frontend as any).getPowerSource(device)).toBe(undefined);

    // Child endpoints
    device.hasClusterServer.mockImplementationOnce(() => false);
    device.getChildEndpoints = jest.fn(() => [device]);
    expect((frontend as any).getPowerSource(device)).toBe(undefined);
  });

  test('Frontend getPlugins', () => {
    matterbridge.hasCleanupStarted = true;
    expect((frontend as any).getPlugins()).toEqual([]);
    matterbridge.hasCleanupStarted = false;
  });

  test('Frontend getDevices', async () => {
    matterbridge.hasCleanupStarted = true;
    expect(await (frontend as any).getDevices()).toEqual([]);
    matterbridge.hasCleanupStarted = false;
  });

  test('Frontend getClusterTextFromDevice', () => {
    // Undefined if not active
    expect((frontend as any).getClusterTextFromDevice({ lifecycle: { isReady: false } })).toBe('');
    expect((frontend as any).getClusterTextFromDevice({ lifecycle: { isReady: true }, construction: { status: Lifecycle.Status.Inactive } })).toBe('');
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

    client.ping(); // Send a ping to test the connection

    client.pong(); // Send a pong to test the connection

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

  test('WebSocketServer connection and message with no password', async () => {
    // @ts-expect-error accessing private variable
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
    // @ts-expect-error accessing private variable
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
    process.argv = ['node', 'frontend.test.js', '-ingress', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, `Failed to create HTTP server: Error: Test error`);
  });

  test('Frontend.start() -ingress', async () => {
    process.argv = ['node', 'frontend.test.js', '-ingress', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}${FRONTEND_PORT}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on ${UNDERLINE}http://0.0.0.0:${FRONTEND_PORT}${UNDERLINEOFF}${rs}`));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening`));

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

  test('Frontend.stop() -ingress', async () => {
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

    copyFileSync(path.join('src/mock/certs/server.crt'), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pem'));

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

    copyFileSync(path.join('src/mock/certs/server.key'), path.join(matterbridge.matterbridgeDirectory, 'certs/key.pem'));

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
    process.argv = ['node', 'frontend.test.js', '-ingress', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    copyFileSync(path.join('src/mock/certs/ca.crt'), path.join(matterbridge.matterbridgeDirectory, 'certs/ca.pem'));

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

    // @ts-expect-error accessing private variable
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

    // @ts-expect-error accessing private variable
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
    // @ts-expect-error accessing private variable
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

    copyFileSync(path.join('src/mock/certs/server.p12'), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.p12'));
    copyFileSync(path.join('src/mock/certs/server.pass'), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pass'));

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
      ca: readFileSync(path.join('src/mock/certs/ca.crt'), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('message', (data) => {
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
    process.argv = ['node', 'frontend.test.js', '-ssl', '-mtls', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    copyFileSync(path.join('src/mock/certs/server.p12'), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.p12'));
    copyFileSync(path.join('src/mock/certs/server.pass'), path.join(matterbridge.matterbridgeDirectory, 'certs/cert.pass'));

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
      cert: readFileSync(path.join('src/mock/certs/client.crt'), 'utf8'), // Provide certificate for validation
      key: readFileSync(path.join('src/mock/certs/client.key'), 'utf8'), // Provide key for validation
      ca: readFileSync(path.join('src/mock/certs/ca.crt'), 'utf8'), // Provide CA certificate for validation
      rejectUnauthorized: true, // Force certificate validation
    });
    await new Promise<void>((resolve, reject) => {
      client.on('open', () => {
        console.log(`WebSocket connection established`);
        resolve();
      });
      client.on('message', (data) => {
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
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
  });
});
