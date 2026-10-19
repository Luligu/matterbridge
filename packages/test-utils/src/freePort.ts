/**
 * @file packages/test-utils/src/freePort.ts
 * @description This file contains the getFreePort helper.
 * @author Luca Liguori
 * @created 2026-10-06
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
import { once } from 'node:events';
import net from 'node:net';

/**
 * Get a free TCP or UDP port from the OS, by binding a socket on port 0 and closing it.
 *
 * @param {'tcp' | 'udp4' | 'udp6'} [type] - The socket type (default 'tcp').
 * @returns {Promise<number>} A free port number.
 */
export async function getFreePort(type: 'tcp' | 'udp4' | 'udp6' = 'tcp'): Promise<number> {
  if (type !== 'tcp') {
    const socket = dgram.createSocket(type);
    socket.bind(0);
    await once(socket, 'listening');
    const { port } = socket.address();
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    return port;
  }
  const server = net.createServer();
  server.listen(0);
  await once(server, 'listening');
  const address = server.address();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (address === null || typeof address === 'string') throw new Error('Unable to get a free port');
  return address.port;
}
