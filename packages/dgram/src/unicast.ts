/**
 * @description This file contains the class Unicast.
 * @file unicast.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2025, 2026, 2027 Luca Liguori.
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

// Node.js imports
import { AddressInfo } from 'node:net';
import { RemoteInfo } from 'node:dgram';

// AnsiLogger imports
import { BLUE, db } from 'node-ansi-logger';

// Net imports
import { Dgram } from './dgram.js';

/**
 * This class implements a unicast dgram socket.
 */
export class Unicast extends Dgram {
  port: number | undefined;

  /**
   * Creates an instance of Unicast.
   *
   * @param {string} name - The name of the socket.
   * @param {'udp4' | 'udp6'} socketType - The type of the socket (IPv4 or IPv6).
   * @param {boolean | undefined} reuseAddr - Whether to allow address reuse. Defaults to true.
   * @param {string} [interfaceName] - The name of the network interface to bind to. If provided, the interfaceAddress will be determined based on this name if not explicitly provided.
   * @param {string} [interfaceAddress] - The address of the network interface to bind to. If not provided, it will be determined based on the interfaceName.
   * @param {number} [port] - The port number to bind to. If not provided, it will bind to any available port.
   */
  constructor(name: string, socketType: 'udp4' | 'udp6', reuseAddr: boolean | undefined = true, interfaceName?: string, interfaceAddress?: string, port?: number) {
    super(name, socketType, reuseAddr, interfaceName, interfaceAddress);
    this.port = port;
  }

  /**
   * Starts the dgram unicast socket.
   */
  start() {
    // Get the local ipv4 or ipv6 interfaceAddress to bind to. If not provided and interfaceName has been provided, use the first one found.
    // If neither interfaceAddress nor interfaceName is provided, use undefined to bind to any available address. In this case broadcast will not work.
    if (this.socketType === 'udp4') {
      this.log.debug(`Starting ipv4 dgram unicast socket...`);
      this.interfaceAddress = this.interfaceAddress ?? (this.interfaceName ? this.getIpv4InterfaceAddress(this.interfaceName) : undefined);
    } else {
      this.log.debug(`Starting ipv6 dgram unicast socket...`);
      this.interfaceAddress = this.interfaceAddress ?? (this.interfaceName ? this.getIpv6InterfaceAddress(this.interfaceName) : undefined);
    }
    this.interfaceNetmask = this.interfaceAddress ? this.getNetmask(this.interfaceAddress) : undefined;
    // Bind to the local address and port:
    // port 0 or undefined means "assign any available port"
    // address 0.0.0.0 or :: means "bind to all available addresses"
    this.log.debug(`Binding dgram unicast socket to ${BLUE}${this.interfaceAddress || 'all available addresses'}${db} on port ${BLUE}${this.port || 'any available port'}${db}...`);
    this.socket.bind(this.port, this.interfaceAddress, () => {
      const address = this.socket.address();
      this.log.debug(`Dgram unicast socket bound to ${BLUE}${address.family}${db} ${BLUE}${address.address}${db}:${BLUE}${address.port}${db}`);
      this.emit('bound', address);
    });
  }

  /**
   * Event handler for the 'listening' event. This event is emitted when the socket starts listening for datagram messages.
   *
   * @param {AddressInfo} [address] - The address info.
   */
  override onListening(address: AddressInfo) {
    this.log.debug(`Dgram unicast socket listening on ${BLUE}${address.family}${db} ${BLUE}${address.address}${db}:${BLUE}${address.port}${db}`);
    this.socket.setBroadcast(true);
    this.log.debug(`Dgram unicast socket broadcast enabled`);
    this.emit('ready', address);
  }

  /**
   * Event handler for the 'message' event. This event is emitted when a datagram message is received.
   *
   * @param {Buffer} msg - The message buffer.
   * @param {RemoteInfo} rinfo - The remote info.
   */
  override onMessage(msg: Buffer, rinfo: RemoteInfo) {
    this.log.debug(`Socket received a message from ${BLUE}${rinfo.family}${db} ${BLUE}${rinfo.address}${db}:${BLUE}${rinfo.port}${db}`);
  }

  /**
   * Stops the dgram unicast socket.
   */
  stop() {
    this.log.debug('Stopping dgram unicast socket...');
    this.socket.close();
    this.log.debug('Stopped dgram unicast socket.');
  }
}
