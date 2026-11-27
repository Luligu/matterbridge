/**
 * @file packages/utils/src/port.ts
 * @description This file contains the isPortFree, getFreePort and getFreePortRange functions.
 * @author Luca Liguori
 * @created 2026-11-27
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import dgram from 'node:dgram';
import net from 'node:net';

import { logModuleLoaded } from './loader.js';

logModuleLoaded('Port');

/**
 * The transports a port must be free on.
 * - `tcp`: TCP on `host`, or on the wildcard address (dual stack where IPv6 is available).
 * - `udp4` / `udp6`: UDP on `host`, or on `0.0.0.0` / `::`.
 * - `udp`: UDP IPv4 and IPv6 on the same number, as the mDNS and CoAP sockets of both families, on the wildcard addresses.
 * - `tcp+udp`: TCP and UDP on the same number, as Matter uses 5540, on the wildcard addresses.
 *
 * For `udp` and `tcp+udp`, UDP IPv6 is skipped on a host without IPv6.
 */
export type PortType = 'tcp' | 'udp4' | 'udp6' | 'udp' | 'tcp+udp';

/** The bind errors that mean the host has no IPv6, not that the port is busy. */
const NO_IPV6_CODES = new Set(['EAFNOSUPPORT', 'EADDRNOTAVAIL', 'EPROTONOSUPPORT']);

/** The attempts of getFreePort('udp') and getFreePort('tcp+udp') before it gives up. */
const MULTI_ATTEMPTS = 100;

/** The result of a probe: the bound port, or the bind error code. */
type ProbeResult = { port: number } | { code: string };

/**
 * Binds a TCP server on a port and releases it.
 *
 * @param {number} port - The port, 0 for one chosen by the OS.
 * @param {string} [host] - The address, the wildcard address when omitted.
 * @returns {Promise<ProbeResult>} The bound port, or the bind error code.
 */
async function probeTcp(port: number, host?: string): Promise<ProbeResult> {
  return await new Promise<ProbeResult>((resolve) => {
    const server = net.createServer();
    // A server whose listen failed is not running: there is nothing to close
    server.once('error', (error: NodeJS.ErrnoException) => resolve({ code: error.code ?? 'UNKNOWN' }));
    server.listen({ port, host }, () => {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a listening TCP server always has an AddressInfo address
      const address = server.address() as net.AddressInfo;
      server.close(() => resolve({ port: address.port }));
    });
  });
}

/**
 * Binds a UDP socket on a port, without address reuse, and releases it.
 *
 * @param {'udp4' | 'udp6'} type - The socket type.
 * @param {number} port - The port, 0 for one chosen by the OS.
 * @param {string} [host] - The address, `0.0.0.0` or `::` when omitted.
 * @returns {Promise<ProbeResult>} The bound port, or the bind error code.
 */
async function probeUdp(type: 'udp4' | 'udp6', port: number, host?: string): Promise<ProbeResult> {
  return await new Promise<ProbeResult>((resolve) => {
    const socket = dgram.createSocket({ type, reuseAddr: false });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      try {
        socket.close();
      } catch {
        // Already closed by the failed bind
      }
      resolve({ code: error.code ?? 'UNKNOWN' });
    });
    socket.bind(port, host ?? (type === 'udp4' ? '0.0.0.0' : '::'), () => {
      const bound = socket.address().port;
      socket.close(() => resolve({ port: bound }));
    });
  });
}

/**
 * Probes a port on one or more transports.
 *
 * @param {number} port - The port, 0 for one chosen by the OS (not for `udp` and `tcp+udp`).
 * @param {PortType} type - The transports.
 * @param {string} [host] - The address, ignored for `udp` and `tcp+udp`.
 * @returns {Promise<ProbeResult>} The bound port, or the first bind error code.
 */
async function probe(port: number, type: PortType, host?: string): Promise<ProbeResult> {
  if (type === 'tcp') return await probeTcp(port, host);
  if (type === 'udp4' || type === 'udp6') return await probeUdp(type, port, host);
  if (type === 'tcp+udp') {
    const tcp = await probeTcp(port);
    if (!('port' in tcp)) return tcp;
  }
  const udp4 = await probeUdp('udp4', port);
  if (!('port' in udp4)) return udp4;
  const udp6 = await probeUdp('udp6', port);
  if (!('port' in udp6) && !NO_IPV6_CODES.has(udp6.code)) return udp6;
  return udp4;
}

/**
 * Validates a port number.
 *
 * @param {number} port - The port.
 * @param {string} name - The parameter name, for the error message.
 * @throws {RangeError} When the port is not an integer between 1 and 65535.
 */
function assertPort(port: number, name: string): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new RangeError(`${name} must be an integer between 1 and 65535, got ${port}`);
}

/**
 * Returns true when a port can be bound and released on the given transports.
 * A port is reported busy on EADDRINUSE, and also on EACCES: on Windows, Hyper-V and WSL reserve whole blocks of the dynamic range.
 *
 * @param {number} port - The port to check, 1 to 65535.
 * @param {PortType} [type] - The transports the port must be free on (default `tcp`).
 * @param {string} [host] - The address to check, the wildcard address when omitted. Ignored for `udp` and `tcp+udp`.
 * @returns {Promise<boolean>} True when the port is free.
 */
export async function isPortFree(port: number, type: PortType = 'tcp', host?: string): Promise<boolean> {
  assertPort(port, 'port');
  return 'port' in (await probe(port, type, host));
}

/**
 * Gets a port the OS reports free, by binding port 0 and releasing it.
 * The port is released before it is returned, so another socket can take it before the caller binds it:
 * when possible, bind port 0 and keep that socket open instead.
 *
 * @param {PortType} [type] - The transports the port must be free on (default `tcp`).
 * @param {string} [host] - The address to bind, the wildcard address when omitted. Ignored for `udp` and `tcp+udp`.
 * @returns {Promise<number>} The free port.
 * @throws {Error} When no port can be bound, or no candidate is free on all the transports after 100 attempts.
 */
export async function getFreePort(type: PortType = 'tcp', host?: string): Promise<number> {
  if (type !== 'udp' && type !== 'tcp+udp') {
    const result = await probe(0, type, host);
    if ('port' in result) return result.port;
    throw new Error(`Unable to get a free ${type} port: ${result.code}`);
  }
  for (let attempt = 0; attempt < MULTI_ATTEMPTS; attempt++) {
    // The OS picks the candidate on the first transport, the others are checked on the same number
    const candidate = await getFreePort(type === 'udp' ? 'udp4' : 'tcp');
    if ('port' in (await probe(candidate, type))) return candidate;
  }
  throw new Error(`Unable to get a free ${type} port after ${MULTI_ATTEMPTS} attempts`);
}

/**
 * Gets the first range of consecutive free ports at or above `start`.
 * The scan restarts after the first busy port it meets, so the result is deterministic for a given set of busy ports.
 *
 * @param {number} size - The number of consecutive ports, 1 or more.
 * @param {PortType} [type] - The transports the ports must be free on (default `tcp`).
 * @param {number} [start] - The first port to scan (default 49152, the start of the IANA dynamic range).
 * @returns {Promise<[number, number]>} The first and last port of the range.
 * @throws {Error} When no such range exists below 65536.
 */
export async function getFreePortRange(size: number, type: PortType = 'tcp', start: number = 49152): Promise<[number, number]> {
  if (!Number.isInteger(size) || size < 1) throw new RangeError(`size must be a positive integer, got ${size}`);
  assertPort(start, 'start');
  let min = start;
  while (min + size - 1 <= 65535) {
    let next = 0;
    for (let port = min; port < min + size; port++) {
      if (!(await isPortFree(port, type))) {
        next = port + 1;
        break;
      }
    }
    if (next === 0) return [min, min + size - 1];
    min = next;
  }
  throw new Error(`No range of ${size} free ${type} ports found from ${start}`);
}
