// src\frontend.express.test.ts

/* eslint-disable no-console */

const MATTER_PORT = 6005;
const FRONTEND_PORT = 8285;
const NAME = 'Frontend';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'frontend.test.js', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString(), '-debug'];

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
import { PowerSource } from '@matter/main/clusters/power-source';

import type { Matterbridge as MatterbridgeType } from './matterbridge.js';
import type { Frontend as FrontendType } from './frontend.js';
import { cliEmitter } from './cliEmitter.js';
import { wait } from './utils/wait.js';
import { loggerLogSpy, setDebug, setupTest } from './utils/jestHelpers.ts';
import {} from './frontendTypes.ts';

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

    await new Promise<void>((resolve) => {
      frontend.once('server_listening', () => resolve());
    });

    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(createServerMock).toHaveBeenCalled();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Initializing the frontend http server on port ${YELLOW}${FRONTEND_PORT}${db}`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The frontend http server is listening on`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening on`));
  }, 60000);

  test('Frontend cliEmitter', () => {
    // Test the cliEmitter functionality
    expect(cliEmitter).toBeDefined();
    expect(cliEmitter.on).toBeDefined();
    expect(cliEmitter.emit).toBeDefined();
    expect(cliEmitter.listeners('uptime')).toHaveLength(1);
    expect(cliEmitter.listeners('memory')).toHaveLength(1);
    expect(cliEmitter.listeners('cpu')).toHaveLength(1);

    cliEmitter.emit('uptime', 123456);
    cliEmitter.emit('memory', 123456789);
    cliEmitter.emit('cpu', 12.34);
  });

  test('Frontend formatMemoryUsage', () => {
    // Test the formatMemoryUsage  functionality
    expect((frontend as any).formatMemoryUsage(1024 ** 3)).toBe('1.00 GB');
    expect((frontend as any).formatMemoryUsage(1024 ** 2)).toBe('1.00 MB');
    expect((frontend as any).formatMemoryUsage(3000)).toBe('2.93 KB');
  });

  test('Frontend formatOsUpTime', () => {
    // Test the formatOsUpTime functionality
    expect((frontend as any).formatOsUpTime(123456)).toBe('1 day');
    expect((frontend as any).formatOsUpTime(3800)).toBe('1 hour');
    expect((frontend as any).formatOsUpTime(3600)).toBe('1 hour');
    expect((frontend as any).formatOsUpTime(65)).toBe('1 minute');
    expect((frontend as any).formatOsUpTime(60)).toBe('1 minute');
    expect((frontend as any).formatOsUpTime(30)).toBe('30 seconds');
    expect((frontend as any).formatOsUpTime(0)).toBe('0 seconds');
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

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
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
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`The WebSocketServer is listening on`));

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

  test('Frontend.start() -ssl without certs', async () => {
    process.argv = ['node', 'frontend.test.js', '-ssl', '-novirtual', '-test', '-homedir', HOMEDIR, '-frontend', FRONTEND_PORT.toString(), '-port', MATTER_PORT.toString()];

    frontend.start(FRONTEND_PORT);
    await new Promise<void>((resolve) => {
      frontend.once('server_error', () => resolve());
    });
    expect((matterbridge as any).initialized).toBe(true);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
    expect(startSpy).toHaveBeenNthCalledWith(1, FRONTEND_PORT);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Error reading certificate file`));
  });

  test('Frontend.start() -ssl without key certs', async () => {
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
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
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
      });
      frontend.on('websocket_server_listening', (host) => {
        expect(host.startsWith('wss://')).toBe(true);
        expect(host.endsWith(`:${FRONTEND_PORT}`)).toBe(true);
        resolve();
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
      });
      frontend.on('websocket_server_listening', (host) => {
        expect(host.startsWith('wss://')).toBe(true);
        expect(host.endsWith(`:${FRONTEND_PORT}`)).toBe(true);
        resolve();
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
    // Test the frontend error on start with p12 passphrase
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
      });
      frontend.on('websocket_server_listening', (host) => {
        expect(host.startsWith('wss://')).toBe(true);
        expect(host.endsWith(`:${FRONTEND_PORT}`)).toBe(true);
        resolve();
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
      });
      frontend.on('websocket_server_listening', (host) => {
        expect(host.startsWith('wss://')).toBe(true);
        expect(host.endsWith(`:${FRONTEND_PORT}`)).toBe(true);
        resolve();
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
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10, 100);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);

    expect(stopSpy).toHaveBeenCalledTimes(1);
    expect((matterbridge as any).frontend.httpServer).toBeUndefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeUndefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeUndefined();
  });
});
