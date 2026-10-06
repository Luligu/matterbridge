/**
 * @file packages/dgram/vitest/mdns.port.test.ts
 * @description isFirstOnPort test with real sockets
 * @author Luca Liguori
 */

import dgram, { type SocketType } from 'node:dgram';

import { isFirstOnPort } from '../src/mdns.js';
import { getFreePort } from './freePort.js';
import { setupTest } from './setupTest.js';

// Setup the test environment
await setupTest('MdnsPort', false);

// No module is mocked: the tests bind real sockets on ports assigned by the OS, so the mDNS port of the host is never touched.
// A random port is not used: Windows reserves whole port ranges (Hyper-V, WinNAT) where any bind fails.

/**
 * Binds a socket with address reuse on a port, as an mDNS responder (mDNSResponder, avahi) does on 5353.
 *
 * @param {SocketType} socketType - The socket type.
 * @param {number} port - The port.
 * @returns {Promise<dgram.Socket>} The bound socket.
 */
async function bindResponder(socketType: SocketType, port: number): Promise<dgram.Socket> {
  const socket = dgram.createSocket({ type: socketType, reuseAddr: true });
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject); // Fail fast with the bind error instead of hanging until the test timeout
    socket.bind(port, socketType === 'udp4' ? '0.0.0.0' : '::', resolve);
  });
  return socket;
}

/**
 * Closes a socket.
 *
 * @param {dgram.Socket} socket - The socket.
 * @returns {Promise<void>} Resolves when the socket is closed.
 */
async function close(socket: dgram.Socket): Promise<void> {
  await new Promise<void>((resolve) => socket.close(() => resolve()));
}

describe('isFirstOnPort', () => {
  for (const socketType of ['udp4', 'udp6'] as const) {
    it(`should return true when no socket is bound to the port (${socketType})`, async () => {
      expect(await isFirstOnPort(socketType, await getFreePort(socketType))).toBe(true);
    });

    it(`should return false when another socket is bound to the port, even with address reuse (${socketType})`, async () => {
      const port = await getFreePort(socketType);
      const responder = await bindResponder(socketType, port);
      expect(await isFirstOnPort(socketType, port)).toBe(false);
      await close(responder);
    });

    it(`should leave the port free for the caller after the check (${socketType})`, async () => {
      const port = await getFreePort(socketType);
      expect(await isFirstOnPort(socketType, port)).toBe(true);
      const own = await bindResponder(socketType, port); // Fails with EADDRINUSE if the probe socket were still bound
      await close(own);
    });
  }
});
