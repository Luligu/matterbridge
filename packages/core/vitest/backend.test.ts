/**
 * @file packages/core/vitest/backend.test.ts
 * @description This file contains the tests for the Backend class.
 * @author Luca Liguori
 */

const NAME = 'Backend';

import { once } from 'node:events';
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import tls from 'node:tls';

import { BroadcastServer } from '@matterbridge/thread/server';
import type { SharedMatterbridge, WorkerMessage } from '@matterbridge/types';
import { wait } from '@matterbridge/utils/wait';
import { HOMEDIR, log, loggerDebugSpy, loggerErrorSpy, loggerInfoSpy, setupTest } from '@matterbridge/vitest-utils';
import { LogLevel } from 'node-ansi-logger';
import { WebSocket } from 'ws';

import { Backend } from '../src/backend.js';

// Setup the test environment
await setupTest(NAME, false);

const CERTS_DIR = path.join(HOMEDIR, 'certs');

const caCert = readFileSync(new URL('../src/mock/certs/ca.crt', import.meta.url), 'utf8');
const clientCert = readFileSync(new URL('../src/mock/certs/client.crt', import.meta.url), 'utf8');
const clientKey = readFileSync(new URL('../src/mock/certs/client.key', import.meta.url), 'utf8');

/**
 * Create the shared Matterbridge object used by the Backend.
 *
 * @param {string} [ipv4Address] - The ipv4 address of the system.
 * @param {string} [ipv6Address] - The ipv6 address of the system.
 * @returns {SharedMatterbridge} The shared Matterbridge object.
 */
function createSharedMatterbridge(ipv4Address: string = '', ipv6Address: string = ''): SharedMatterbridge {
  return {
    matterbridgeDirectory: HOMEDIR,
    rootDirectory: HOMEDIR,
    systemInformation: { ipv4Address, ipv6Address },
  } as unknown as SharedMatterbridge;
}

/**
 * Empty the certs directory and copy the given mock certificates into it.
 *
 * @param {Record<string, string>} files - Map of destination file name in the certs directory to the source file name in src/mock/certs.
 */
function setCerts(files: Record<string, string>): void {
  rmSync(CERTS_DIR, { recursive: true, force: true });
  mkdirSync(CERTS_DIR, { recursive: true });
  for (const [destination, source] of Object.entries(files)) {
    copyFileSync(new URL(`../src/mock/certs/${source}`, import.meta.url), path.join(CERTS_DIR, destination));
  }
}

const PEM_CERTS = { 'cert.pem': 'server.crt', 'key.pem': 'server.key', 'ca.pem': 'ca.crt' };

/**
 * Get a free TCP port from the OS.
 *
 * @returns {Promise<number>} A free port number.
 */
async function getFreePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0);
  await once(server, 'listening');
  const address = server.address() as net.AddressInfo;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

/**
 * Send a real GET request to the backend and collect the response.
 *
 * @param {string} url - The url to request.
 * @param {https.RequestOptions} [options] - The TLS options (ca, cert, key) for https requests.
 * @returns {Promise<{ statusCode: number | undefined; body: string }>} The status code and the body of the response.
 */
async function get(url: string, options: https.RequestOptions = {}): Promise<{ statusCode: number | undefined; body: string }> {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(url, { ...options, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk: string) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
  });
}

/**
 * Send a raw request on a plain or TLS socket and collect everything the server writes until it closes the socket.
 *
 * @param {number} port - The backend port.
 * @param {boolean} secure - True to use a TLS socket.
 * @param {string} request - The raw request to write.
 * @returns {Promise<string>} The raw response.
 */
async function rawRequest(port: number, secure: boolean, request: string): Promise<string> {
  const socket = secure ? tls.connect({ port, host: 'localhost', ca: caCert, servername: 'localhost' }) : net.connect({ port, host: 'localhost' });
  await once(socket, secure ? 'secureConnect' : 'connect');
  return new Promise((resolve) => {
    let response = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => (response += chunk));
    socket.on('error', () => resolve(response));
    socket.on('close', () => resolve(response));
    socket.write(request);
  });
}

/**
 * Open a real WebSocket connection to the backend.
 *
 * @param {string} url - The WebSocket url.
 * @param {WebSocket.ClientOptions} [options] - The TLS options (ca, cert, key) for wss connections.
 * @returns {Promise<WebSocket>} The open WebSocket client.
 */
async function connectWebSocket(url: string, options: WebSocket.ClientOptions = {}): Promise<WebSocket> {
  const client = new WebSocket(url, options);
  return new Promise((resolve, reject) => {
    client.once('open', () => resolve(client));
    client.once('error', reject);
  });
}

/**
 * Close a WebSocket client and wait for the close event.
 *
 * @param {WebSocket} client - The WebSocket client to close.
 */
async function closeWebSocket(client: WebSocket): Promise<void> {
  const closed = once(client, 'close');
  client.close();
  await closed;
}

/**
 * Create an error with a system error code.
 *
 * @param {string} code - The error code.
 * @returns {NodeJS.ErrnoException} The error.
 */
function errnoError(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`Test error ${code}`), { code });
}

describe('Backend', () => {
  let backend: Backend | undefined;
  let port = 0;

  /**
   * Set process.argv, create a Backend on a free port and start it.
   *
   * @param {string[]} args - The command line arguments.
   * @param {SharedMatterbridge} [matterbridge] - The shared Matterbridge object.
   * @returns {Promise<Backend>} The listening Backend.
   */
  async function startBackend(args: string[], matterbridge: SharedMatterbridge = createSharedMatterbridge()): Promise<Backend> {
    process.argv = ['node', 'backend.test.js', ...args, '--debug-frontend', '--verbose-frontend'];
    port = await getFreePort();
    backend = new Backend(matterbridge);
    backend.storedPassword = 'testpassword';
    const listening = once(backend, 'server_listening');
    await backend.start(port);
    await listening;
    return backend;
  }

  /**
   * Set process.argv, create a Backend and start it expecting a server_error.
   *
   * @param {string[]} args - The command line arguments.
   * @returns {Promise<unknown>} The error emitted with server_error.
   */
  async function startBackendWithError(args: string[]): Promise<unknown> {
    process.argv = ['node', 'backend.test.js', ...args, '--debug-frontend', '--verbose-frontend'];
    port = await getFreePort();
    backend = new Backend(createSharedMatterbridge());
    const serverError = once(backend, 'server_error');
    await backend.start(port);
    const [error] = await serverError;
    return error;
  }

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await backend?.stop();
    backend?.destroy();
    backend = undefined;
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test('should answer get_log_level and set_log_level broadcast requests', async () => {
    process.argv = ['node', 'backend.test.js'];
    backend = new Backend(createSharedMatterbridge());
    const manager = new BroadcastServer('manager', log);

    const getResponse = await manager.fetch({ type: 'get_log_level', src: 'manager', dst: 'frontend', params: undefined });
    expect(getResponse.result.logLevel).toBe(LogLevel.INFO);

    const setResponse = await manager.fetch({ type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } });
    expect(setResponse.result.logLevel).toBe(LogLevel.DEBUG);
    expect((backend as any).log.logLevel).toBe(LogLevel.DEBUG);

    // A request of an unhandled type and a message that is not a request are ignored
    manager.request({ type: 'matterbridge_apisettings', src: 'manager', dst: 'frontend', params: undefined });
    manager.broadcast({ type: 'get_log_level', src: 'manager', dst: 'frontend', result: { logLevel: LogLevel.INFO } });
    await wait(100);
    expect(loggerErrorSpy).not.toHaveBeenCalled();

    manager.close();
  });

  test('should fetch settings, plugins and devices from the other threads', async () => {
    process.argv = ['node', 'backend.test.js'];
    backend = new Backend(createSharedMatterbridge());

    const matterbridgeServer = new BroadcastServer('matterbridge', log);
    matterbridgeServer.on('broadcast_message', (msg: WorkerMessage) => {
      if (matterbridgeServer.isWorkerRequestOfType(msg, 'matterbridge_apisettings')) {
        matterbridgeServer.respond({ ...msg, result: { data: { test: 'settings' } as any, success: true } });
      }
    });
    const pluginsServer = new BroadcastServer('plugins', log);
    pluginsServer.on('broadcast_message', (msg: WorkerMessage) => {
      if (pluginsServer.isWorkerRequestOfType(msg, 'plugins_apipluginarray')) {
        pluginsServer.respond({ ...msg, result: { plugins: [{ name: 'plugin1' }] as any } });
      }
    });
    const devicesServer = new BroadcastServer('devices', log);
    devicesServer.on('broadcast_message', (msg: WorkerMessage) => {
      if (devicesServer.isWorkerRequestOfType(msg, 'devices_apidevicearray')) {
        devicesServer.respond({ ...msg, result: { devices: msg.params.pluginName === 'plugin1' ? [{ pluginName: 'plugin1' } as any] : [] } });
      }
    });

    expect(await backend.getApiSettings()).toEqual({ test: 'settings' });
    expect(await backend.getApiPlugins()).toEqual([{ name: 'plugin1' }]);
    expect(await backend.getApiDevices('plugin1')).toEqual([{ pluginName: 'plugin1' }]);
    expect(await backend.getApiDevices()).toEqual([]);
    await expect(backend.generateDiagnostic()).resolves.toBeUndefined();

    matterbridgeServer.close();
    pluginsServer.close();
    devicesServer.close();
  });

  test('should serve http and ws when started without ssl', async () => {
    process.argv = ['node', 'backend.test.js', '--debug-frontend', '--verbose-frontend'];
    port = await getFreePort();
    backend = new Backend(createSharedMatterbridge());
    backend.storedPassword = 'testpassword';

    const listening = once(backend, 'server_listening');
    const wsListening = once(backend, 'websocket_server_listening');
    await backend.start(port);
    expect(await listening).toEqual(['http', port]);
    expect(await wsListening).toEqual(['ws']);
    expect((backend as any).httpServer).toBeDefined();
    expect((backend as any).httpsServer).toBeUndefined();

    const response = await get(`http://localhost:${port}/health`);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ status: 'ok' });

    await expect(connectWebSocket(`ws://localhost:${port}?password=wrong`)).rejects.toThrow('401');
    const client = await connectWebSocket(`ws://localhost:${port}?password=testpassword`);
    expect(client.readyState).toBe(WebSocket.OPEN);
    await closeWebSocket(client);
  });

  test('should serve https and wss when started with ssl', async () => {
    setCerts(PEM_CERTS);
    process.argv = ['node', 'backend.test.js', '--ssl', '--debug-frontend', '--verbose-frontend'];
    port = await getFreePort();
    backend = new Backend(createSharedMatterbridge());
    backend.storedPassword = 'testpassword';

    const listening = once(backend, 'server_listening');
    const wsListening = once(backend, 'websocket_server_listening');
    await backend.start(port);
    expect(await listening).toEqual(['https', port]);
    expect(await wsListening).toEqual(['wss']);
    expect((backend as any).httpServer).toBeUndefined();
    expect((backend as any).httpsServer).toBeDefined();
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded CA certificate file'));

    const response = await get(`https://localhost:${port}/health`, { ca: caCert, rejectUnauthorized: true });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ status: 'ok' });

    await expect(connectWebSocket(`wss://localhost:${port}?password=wrong`, { ca: caCert, rejectUnauthorized: true })).rejects.toThrow('401');
    const client = await connectWebSocket(`wss://localhost:${port}?password=testpassword`, { ca: caCert, rejectUnauthorized: true });
    expect(client.readyState).toBe(WebSocket.OPEN);
    await closeWebSocket(client);
  });

  test('should serve https without the ca certificate when ca.pem is missing', async () => {
    setCerts({ 'cert.pem': 'server.crt', 'key.pem': 'server.key' });
    await startBackend(['--ssl']);
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('ca.pem not loaded'));

    const response = await get(`https://localhost:${port}/health`, { ca: caCert, rejectUnauthorized: true });
    expect(response.statusCode).toBe(200);
  });

  test('should require a client certificate when started with ssl and mtls', async () => {
    setCerts(PEM_CERTS);
    process.argv = ['node', 'backend.test.js', '--ssl', '--mtls', '--debug-frontend', '--verbose-frontend'];
    port = await getFreePort();
    backend = new Backend(createSharedMatterbridge());
    backend.storedPassword = 'testpassword';

    const listening = once(backend, 'server_listening');
    const wsListening = once(backend, 'websocket_server_listening');
    await backend.start(port);
    expect(await listening).toEqual(['https', port]);
    expect(await wsListening).toEqual(['wss']);
    expect((backend as any).httpsServer).toBeDefined();

    // Without the client certificate the TLS handshake is rejected
    await expect(get(`https://localhost:${port}/health`, { ca: caCert, rejectUnauthorized: true })).rejects.toThrow();

    // With the client certificate the request succeeds
    const tlsOptions = { ca: caCert, cert: clientCert, key: clientKey, rejectUnauthorized: true };
    const response = await get(`https://localhost:${port}/health`, tlsOptions);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ status: 'ok' });

    const client = await connectWebSocket(`wss://localhost:${port}?password=testpassword`, tlsOptions);
    expect(client.readyState).toBe(WebSocket.OPEN);
    await closeWebSocket(client);
  });

  test('should serve https and wss when started with ssl and a p12 certificate with passphrase', async () => {
    setCerts({ 'cert.p12': 'server.p12', 'cert.pass': 'server.pass' });
    process.argv = ['node', 'backend.test.js', '--ssl', '--debug-frontend', '--verbose-frontend'];
    port = await getFreePort();
    backend = new Backend(createSharedMatterbridge());
    backend.storedPassword = 'testpassword';

    const listening = once(backend, 'server_listening');
    const wsListening = once(backend, 'websocket_server_listening');
    await backend.start(port);
    expect(await listening).toEqual(['https', port]);
    expect(await wsListening).toEqual(['wss']);
    expect((backend as any).httpServer).toBeUndefined();
    expect((backend as any).httpsServer).toBeDefined();
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded p12 certificate file'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded p12 passphrase file'));
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('Loaded certificate file'));

    const response = await get(`https://localhost:${port}/health`, { ca: caCert, rejectUnauthorized: true });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({ status: 'ok' });

    const client = await connectWebSocket(`wss://localhost:${port}?password=testpassword`, { ca: caCert, rejectUnauthorized: true });
    expect(client.readyState).toBe(WebSocket.OPEN);
    await closeWebSocket(client);
  });

  test('should emit server_error when the p12 certificate cannot be read', async () => {
    setCerts({});
    // A directory named cert.p12 exists but cannot be read as a file
    mkdirSync(path.join(CERTS_DIR, 'cert.p12'));
    await startBackendWithError(['--ssl']);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading p12 certificate file'));
    expect((backend as any).httpsServer).toBeUndefined();
  });

  test('should emit server_error when the p12 passphrase is missing', async () => {
    setCerts({ 'cert.p12': 'server.p12' });
    await startBackendWithError(['--ssl']);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading p12 passphrase file'));
    expect((backend as any).httpsServer).toBeUndefined();
  });

  test('should emit server_error when the certificate is missing', async () => {
    setCerts({});
    await startBackendWithError(['--ssl']);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading certificate file'));
    expect((backend as any).httpsServer).toBeUndefined();
  });

  test('should emit server_error when the key is missing', async () => {
    setCerts({ 'cert.pem': 'server.crt' });
    await startBackendWithError(['--ssl']);
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error reading key file'));
    expect((backend as any).httpsServer).toBeUndefined();
  });

  test('should emit server_error when the http server cannot be created', async () => {
    loggerDebugSpy.mockImplementation((message: string) => {
      if (message.startsWith('Creating HTTP server')) throw new Error('Test error');
    });
    try {
      await startBackendWithError([]);
    } finally {
      loggerDebugSpy.mockReset();
    }
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create HTTP server'));
    expect((backend as any).httpServer).toBeUndefined();
  });

  test('should emit server_error when the https server cannot be created', async () => {
    setCerts(PEM_CERTS);
    loggerDebugSpy.mockImplementation((message: string) => {
      if (message.startsWith('Creating HTTPS server')) throw new Error('Test error');
    });
    try {
      await startBackendWithError(['--ssl']);
    } finally {
      loggerDebugSpy.mockReset();
    }
    expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to create HTTPS server'));
    expect((backend as any).httpsServer).toBeUndefined();
  });

  test('should log the listening addresses when the system addresses are known', async () => {
    await startBackend([], createSharedMatterbridge('192.168.1.100', 'fd00::100'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('http://192.168.1.100'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('http://[fd00::100]'));
    await backend?.stop();

    setCerts(PEM_CERTS);
    await startBackend(['--ssl'], createSharedMatterbridge('192.168.1.100', 'fd00::100'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('https://192.168.1.100'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('https://[fd00::100]'));
  });

  test('should bind to the address given with --bind', async () => {
    await startBackend(['--bind', '127.0.0.1'], createSharedMatterbridge('192.168.1.100', 'fd00::100'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('bound to IPv4 127.0.0.1'));
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('http://192.168.1.100'));
    await backend?.stop();

    setCerts(PEM_CERTS);
    await startBackend(['--ssl', '--bind', '127.0.0.1'], createSharedMatterbridge('192.168.1.100', 'fd00::100'));
    expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('bound to IPv4 127.0.0.1'));
    expect(loggerInfoSpy).not.toHaveBeenCalledWith(expect.stringContaining('https://192.168.1.100'));
  });

  for (const secure of [false, true]) {
    const protocol = secure ? 'https' : 'http';

    test(`should handle the ${protocol} websocket upgrade edge cases`, async () => {
      if (secure) setCerts(PEM_CERTS);
      const instance = await startBackend(secure ? ['--ssl'] : []);

      // Upgrade to a protocol other than websocket
      const notWebSocket = await rawRequest(port, secure, 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: foo\r\n\r\n');
      expect(notWebSocket).toContain('400 Bad Request');

      // Missing password
      const noPassword = await rawRequest(port, secure, 'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
      expect(noPassword).toContain('401 Unauthorized');
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid password (empty)'));

      // Missing host header (allowed in HTTP/1.0)
      const noHost = await rawRequest(port, secure, 'GET / HTTP/1.0\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
      expect(noHost).toContain('401 Unauthorized');

      // Invalid host header makes the URL parsing throw
      const badHost = await rawRequest(port, secure, 'GET / HTTP/1.1\r\nHost: [\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n');
      expect(badHost).toContain('500 Internal Server Error');

      // Empty stored password accepts a connection without password
      instance.storedPassword = '';
      const client = await connectWebSocket(`${secure ? 'wss' : 'ws'}://localhost:${port}`, { ca: caCert, rejectUnauthorized: true });
      expect(client.readyState).toBe(WebSocket.OPEN);
      await closeWebSocket(client);
    });

    test(`should log the ${protocol} server errors`, async () => {
      if (secure) setCerts(PEM_CERTS);
      const instance = await startBackend(secure ? ['--ssl'] : []);
      const server = (instance as any)[secure ? 'httpsServer' : 'httpServer'] as net.Server;

      // A second backend on the same port fails with EADDRINUSE
      const second = new Backend(createSharedMatterbridge());
      const serverError = once(second, 'server_error');
      await second.start(port);
      const [error] = await serverError;
      expect((error as NodeJS.ErrnoException).code).toBe('EADDRINUSE');
      expect(loggerErrorSpy).toHaveBeenCalledWith(`Port ${port} is already in use`);
      await second.stop();
      second.destroy();

      // Errors emitted by the listening server
      const errors: unknown[] = [];
      instance.on('server_error', (err) => errors.push(err));
      server.emit('error', errnoError('EACCES'));
      server.emit('error', errnoError('EOTHER'));
      expect(loggerErrorSpy).toHaveBeenCalledWith(`Port ${port} requires elevated privileges`);
      expect(errors).toHaveLength(2);
    });
  }
});
