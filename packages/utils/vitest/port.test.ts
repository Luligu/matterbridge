/**
 * @file packages/utils/vitest/port.test.ts
 * @description This file contains the tests for isPortFree, getFreePort and getFreePortRange.
 * @author Luca Liguori
 */

import dgram from 'node:dgram';
import { EventEmitter } from 'node:events';
import net from 'node:net';

import { setupTest } from '@matterbridge/test-utils/vitest/setup';

import { getFreePort, getFreePortRange, isPortFree } from '../src/port.js';

// Setup the test environment
await setupTest('Port', false);

// The tests bind real sockets on ports assigned by the OS, so no fixed port is assumed free.

/**
 * Binds a TCP server on a port.
 *
 * @param {number} port - The port.
 * @returns {Promise<net.Server>} The listening server.
 */
async function listenTcp(port: number): Promise<net.Server> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen({ port }, resolve);
  });
  return server;
}

/**
 * Binds a UDP socket on a port, on the wildcard address.
 *
 * @param {'udp4' | 'udp6'} type - The socket type.
 * @param {number} port - The port.
 * @returns {Promise<dgram.Socket>} The bound socket.
 */
async function bindUdp(type: 'udp4' | 'udp6', port: number): Promise<dgram.Socket> {
  const socket = dgram.createSocket({ type, reuseAddr: false });
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject);
    socket.bind(port, type === 'udp4' ? '0.0.0.0' : '::', resolve);
  });
  return socket;
}

/**
 * Closes a TCP server or a UDP socket.
 *
 * @param {net.Server | dgram.Socket} handle - The server or the socket.
 * @returns {Promise<void>} Resolves when it is closed.
 */
async function release(handle: net.Server | dgram.Socket): Promise<void> {
  await new Promise<void>((resolve) => handle.close(() => resolve()));
}

/**
 * Creates a fake UDP socket whose bind fails, and whose close throws as on a socket already closed.
 *
 * @param {string} [code] - The error code of the bind failure, none when omitted.
 * @returns {dgram.Socket} The fake socket.
 */
function failingUdp(code?: string): dgram.Socket {
  const socket = Object.assign(new EventEmitter(), {
    bind: vi.fn(() => socket.emit('error', Object.assign(new Error('Bind failed'), code ? { code } : {}))),
    close: vi.fn(() => {
      throw new Error('Not running');
    }),
  });
  return socket as unknown as dgram.Socket;
}

describe('isPortFree()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([0, -1, 65536, 1.5, Number.NaN])('should throw a RangeError for the invalid port %s', async (port) => {
    await expect(isPortFree(port)).rejects.toThrow(RangeError);
  });

  it.each(['tcp', 'udp4', 'udp6', 'udp', 'tcp+udp'] as const)('should return true for a free %s port', async (type) => {
    const port = await getFreePort(type);
    expect(await isPortFree(port, type)).toBe(true);
  });

  it('should default to tcp', async () => {
    const server = await listenTcp(0);
    const { port } = server.address() as net.AddressInfo;
    try {
      expect(await isPortFree(port)).toBe(false);
    } finally {
      await release(server);
    }
  });

  it('should return false for a busy tcp port, and for tcp+udp', async () => {
    const server = await listenTcp(await getFreePort('tcp+udp'));
    const { port } = server.address() as net.AddressInfo;
    try {
      expect(await isPortFree(port, 'tcp')).toBe(false);
      expect(await isPortFree(port, 'tcp+udp')).toBe(false);
    } finally {
      await release(server);
    }
  });

  it.each(['udp4', 'udp6'] as const)('should return false for a busy %s port, and for udp and tcp+udp', async (type) => {
    const socket = await bindUdp(type, await getFreePort('tcp+udp'));
    const { port } = socket.address();
    try {
      expect(await isPortFree(port, type)).toBe(false);
      expect(await isPortFree(port, 'udp')).toBe(false);
      expect(await isPortFree(port, 'tcp+udp')).toBe(false);
    } finally {
      await release(socket);
    }
  });

  it('should check the given host', async () => {
    const port = await getFreePort('udp4', '127.0.0.1');
    expect(await isPortFree(port, 'udp4', '127.0.0.1')).toBe(true);
    expect(await isPortFree(port, 'tcp', '127.0.0.1')).toBe(true);
  });

  it('should return true for udp when only tcp is busy', async () => {
    const server = await listenTcp(await getFreePort('tcp+udp'));
    const { port } = server.address() as net.AddressInfo;
    try {
      expect(await isPortFree(port, 'udp')).toBe(true);
    } finally {
      await release(server);
    }
  });

  it('should skip udp6 for tcp+udp on a host without IPv6', async () => {
    const port = await getFreePort('tcp+udp');
    const createSocket = dgram.createSocket;
    vi.spyOn(dgram, 'createSocket').mockImplementation((options: dgram.SocketOptions) => (options.type === 'udp6' ? failingUdp('EAFNOSUPPORT') : createSocket(options)));
    expect(await isPortFree(port, 'tcp+udp')).toBe(true);
  });

  it('should return false for tcp+udp when only udp6 is busy', async () => {
    const port = await getFreePort('tcp+udp');
    const createSocket = dgram.createSocket;
    vi.spyOn(dgram, 'createSocket').mockImplementation((options: dgram.SocketOptions) => (options.type === 'udp6' ? failingUdp('EADDRINUSE') : createSocket(options)));
    expect(await isPortFree(port, 'tcp+udp')).toBe(false);
  });

  it('should report a udp error without code as busy', async () => {
    vi.spyOn(dgram, 'createSocket').mockReturnValueOnce(failingUdp());
    expect(await isPortFree(5353, 'udp4')).toBe(false);
  });

  it('should report a tcp error without code as busy', async () => {
    const server = Object.assign(new EventEmitter(), { listen: vi.fn(() => server.emit('error', new Error('Listen failed'))) });
    vi.spyOn(net, 'createServer').mockReturnValueOnce(server as unknown as net.Server);
    expect(await isPortFree(5540, 'tcp')).toBe(false);
  });
});

describe('getFreePort()', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should default to tcp', async () => {
    const port = await getFreePort();
    expect(port).toBeGreaterThan(0);
    expect(await isPortFree(port, 'tcp')).toBe(true);
  });

  it.each(['tcp', 'udp4', 'udp6', 'udp', 'tcp+udp'] as const)('should return a port that can be bound on %s', async (type) => {
    const port = await getFreePort(type);
    expect(Number.isInteger(port)).toBe(true);
    expect(port).toBeGreaterThan(0);
    expect(port).toBeLessThanOrEqual(65535);
    if (type === 'tcp' || type === 'tcp+udp') await release(await listenTcp(port));
    if (type === 'udp4' || type === 'udp' || type === 'tcp+udp') await release(await bindUdp('udp4', port));
    if (type === 'udp6' || type === 'udp') await release(await bindUdp('udp6', port));
  });

  it('should throw when the host cannot be bound', async () => {
    await expect(getFreePort('tcp', '192.0.2.1')).rejects.toThrow('Unable to get a free tcp port');
    await expect(getFreePort('udp4', '192.0.2.1')).rejects.toThrow('Unable to get a free udp4 port');
  });

  it('should throw when no tcp port is also free on udp', async () => {
    vi.spyOn(dgram, 'createSocket').mockImplementation(() => failingUdp('EADDRINUSE'));
    await expect(getFreePort('tcp+udp')).rejects.toThrow('Unable to get a free tcp+udp port after 100 attempts');
  });

  it('should throw when no udp4 port is also free on udp6', async () => {
    const createSocket = dgram.createSocket;
    vi.spyOn(dgram, 'createSocket').mockImplementation((options: dgram.SocketOptions) => (options.type === 'udp6' ? failingUdp('EADDRINUSE') : createSocket(options)));
    await expect(getFreePort('udp')).rejects.toThrow('Unable to get a free udp port after 100 attempts');
  });
});

describe('getFreePortRange()', () => {
  it('should throw a RangeError for an invalid size or start', async () => {
    await expect(getFreePortRange(0)).rejects.toThrow(RangeError);
    await expect(getFreePortRange(1.5)).rejects.toThrow(RangeError);
    await expect(getFreePortRange(2, 'tcp', 0)).rejects.toThrow(RangeError);
    await expect(getFreePortRange(2, 'tcp', 65536)).rejects.toThrow(RangeError);
  });

  it('should return a range of consecutive free ports', async () => {
    const [min, max] = await getFreePortRange(3, 'udp4');
    expect(min).toBeGreaterThanOrEqual(49152);
    expect(max - min).toBe(2);
    for (let port = min; port <= max; port++) expect(await isPortFree(port, 'udp4')).toBe(true);
  });

  it('should default to tcp', async () => {
    const [min, max] = await getFreePortRange(2);
    expect(max - min).toBe(1);
    expect(await isPortFree(min, 'tcp')).toBe(true);
  });

  it('should restart the scan after a busy port', async () => {
    const socket = await bindUdp('udp4', 0);
    const { port } = socket.address();
    try {
      const [min, max] = await getFreePortRange(2, 'udp4', port);
      expect(min).toBeGreaterThan(port);
      expect(max - min).toBe(1);
    } finally {
      await release(socket);
    }
  });

  it('should throw when no range fits below 65536', async () => {
    await expect(getFreePortRange(2, 'tcp', 65535)).rejects.toThrow('No range of 2 free tcp ports found from 65535');
  });
});
