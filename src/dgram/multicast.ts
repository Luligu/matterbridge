/**
 * @description This file contains the class Multicast.
 * @file multicast.ts
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

// AnsiLogger imports

// Node.js imports
import { AddressInfo } from 'node:net';
import os from 'node:os';

import { BLUE, CYAN, db, RED, YELLOW } from 'node-ansi-logger';

// Net imports
import { Dgram } from './dgram.js';

export const MDNS_MULTICAST_IPV4_ADDRESS = '224.0.0.251';
export const MDNS_MULTICAST_IPV6_ADDRESS = 'ff02::fb';
export const MDNS_MULTICAST_PORT = 5353;

export const COAP_MULTICAST_IPV4_ADDRESS = '224.0.1.187';
export const COAP_MULTICAST_IPV6_ADDRESS = 'ff02::fd';
export const COAP_MULTICAST_PORT = 5683;

/**
 * This class implements a multicast dgram socket.
 */
export class Multicast extends Dgram {
  multicastAddress: string;
  multicastPort: number;
  joinedInterfaces: string[] = [];

  /**
   * Creates an instance of Multicast.
   *
   * @param {string} name - The name of the socket.
   * @param {string} multicastAddress - The multicast address to join.
   * @param {number} multicastPort - The port number to bind to.
   * @param {'udp4' | 'udp6'} socketType - The type of the socket (IPv4 or IPv6).
   * @param {boolean | undefined} reuseAddr - Whether to allow address reuse.
   * @param {string} [interfaceName] - The name of the network interface to bind to.
   * @param {string} [interfaceAddress] - The address of the network interface to bind to.
   */
  constructor(name: string, multicastAddress: string, multicastPort: number, socketType: 'udp4' | 'udp6', reuseAddr: boolean | undefined = true, interfaceName?: string, interfaceAddress?: string) {
    super(name, socketType, reuseAddr, interfaceName, interfaceAddress);
    this.multicastAddress = multicastAddress;
    this.multicastPort = multicastPort;
  }

  /**
   * Starts the dgram multicast socket.
   */
  start() {
    // Get the local ipv4 or ipv6 address to bind to.
    if (this.socketType === 'udp4') {
      this.log.debug(`Starting ipv4 dgram multicast socket...`);
      this.interfaceAddress = this.interfaceAddress ?? this.getIpv4InterfaceAddress(this.interfaceName);
    } else {
      this.log.debug(`Starting ipv6 dgram multicast socket...`);
      this.interfaceAddress = this.interfaceAddress ?? this.getIpv6InterfaceAddress(this.interfaceName);
    }
    this.log.debug(`Binding dgram multicast socket to ${BLUE}${this.interfaceAddress}${db}:${BLUE}${this.multicastPort}${db} on interface ${CYAN}${this.interfaceName}${db}`);
    this.socket.bind(this.multicastPort, this.interfaceAddress, () => {
      const address = this.socket.address();
      this.log.debug(`Dgram multicast socket bound to ${BLUE}${address.family}${db} ${BLUE}${address.address}${db}:${BLUE}${address.port}${db}`);
      this.emit('bound', address);
    });
  }

  /**
   * Event handler for the 'listening' event. This event is emitted when the socket starts listening for datagram messages.
   *
   * @param {AddressInfo} [address] - The address info.
   */
  override onListening(address: AddressInfo) {
    this.log.debug(`Dgram multicast socket listening on ${BLUE}${address.family}${db} ${BLUE}${address.address}${db}:${BLUE}${address.port}${db}`);
    this.socket.setBroadcast(true);
    this.log.debug(`Dgram multicast socket broadcast enabled`);
    this.socket.setMulticastTTL(255);
    this.log.debug(`Dgram multicast socket multicast TTL set to 255`);
    this.socket.setMulticastLoopback(true);
    this.log.debug(`Dgram multicast socket multicast loopback enabled`);
    // Find the correct network interfaces and join the multicast group on each interface. For IPv6, we will use the scope ID if available. If not available, we will use the Unique Local Address.
    Object.entries(os.networkInterfaces()).forEach(([name, interfaces]) => {
      this.log.debug(`Dgram multicast socket processing interface ${CYAN}${name}${db}`);
      if (!interfaces) return;
      if (this.interfaceName && name !== this.interfaceName) return; // Only process the specified interface
      let iface;
      let membershipInterface;
      // Find the first ipv4 interface
      const ifaceIpv4 = interfaces.find((iface) => iface.family === 'IPv4' && this.socketType === 'udp4');
      if (ifaceIpv4) {
        iface = ifaceIpv4;
        membershipInterface = ifaceIpv4.address;
      }
      // Find the first IPv6 Address
      const ifaceIpv6 = interfaces.find((iface) => iface.family === 'IPv6' && this.socketType === 'udp6');
      if (ifaceIpv6) {
        iface = ifaceIpv6;
        membershipInterface = ifaceIpv6.address;
      }
      // Find the first Unique Local IPv6 Address (ULA)
      const ifaceUla = interfaces.find((iface) => iface.family === 'IPv6' && this.socketType === 'udp6' && iface.address.startsWith('fd'));
      if (ifaceUla) {
        iface = ifaceUla;
        membershipInterface = ifaceUla.address + (this.socketType === 'udp6' && ifaceUla.scopeid ? (process.platform === 'win32' ? '%' + String(ifaceUla.scopeid) : '%' + name) : '');
      }
      // Find the first Unique Local IPv6 Address (ULA) with prefix length /64 (netmask ffff:ffff:ffff:ffff::)
      const ifaceUla64 = interfaces.find((iface) => iface.family === 'IPv6' && this.socketType === 'udp6' && iface.address.startsWith('fd') && iface.netmask === 'ffff:ffff:ffff:ffff::');
      if (ifaceUla64) {
        iface = ifaceUla64;
        membershipInterface = ifaceUla64.address + (this.socketType === 'udp6' && ifaceUla64.scopeid ? (process.platform === 'win32' ? '%' + String(ifaceUla64.scopeid) : '%' + name) : '');
      }
      // Find the first Link-local IPv6 Address
      const ifaceLinkLocal = interfaces.find((iface) => iface.family === 'IPv6' && this.socketType === 'udp6' && iface.address.startsWith('fe80'));
      if (ifaceLinkLocal) {
        iface = ifaceLinkLocal;
        membershipInterface = ifaceLinkLocal.address + (this.socketType === 'udp6' && ifaceLinkLocal.scopeid ? (process.platform === 'win32' ? '%' + String(ifaceLinkLocal.scopeid) : '%' + name) : '');
      }
      // Add the interface address to the multicast group
      if (iface && membershipInterface) {
        try {
          this.socket.addMembership(this.multicastAddress, membershipInterface);
          this.joinedInterfaces.push(membershipInterface);
          this.log.debug(
            `Dgram multicast socket joined multicast group ${BLUE}${this.multicastAddress}${db} on interface ${CYAN}${name}${db} ${BLUE}${iface.family}${db} ${BLUE}${iface.address}${db} ${BLUE}${iface.scopeid}${db} >>> ${YELLOW}${membershipInterface}${db}`,
          );
        } catch (error) {
          this.log.debug(
            `Dgram multicast socket failed to join multicast group ${BLUE}${this.multicastAddress}${db} on interface ${CYAN}${name}${db} ${BLUE}${iface.family}${db} ${BLUE}${iface.address}${db} ${BLUE}${iface.scopeid}${db} >>> ${RED}${membershipInterface}${db}: ${error instanceof Error ? error.message : error}`,
          );
        }
      }
    });
    this.socket.setMulticastInterface(this.interfaceAddress as string);
    this.log.debug(`Dgram multicast socket multicastInterface set to ${BLUE}${this.interfaceAddress}${db}`);
    this.emit('ready', address);
  }

  /**
   * Stops the dgram multicast socket.
   */
  stop() {
    this.log.debug('Stopping dgram multicast socket...');
    this.joinedInterfaces.forEach((membershipInterface) => {
      try {
        this.socket.dropMembership(this.multicastAddress, membershipInterface);
        this.log.debug(`Dgram multicast socket dropped multicast group ${BLUE}${this.multicastAddress}${db} on interface ${YELLOW}${membershipInterface}${db}`);
      } catch (error) {
        this.log.debug(`Dgram multicast socket failed to drop multicast group ${BLUE}${this.multicastAddress}${db} on interface ${RED}${membershipInterface}${db}: ${error}`);
      }
    });
    this.joinedInterfaces = [];
    this.socket.close();
    this.log.debug('Stopped dgram multicast socket.');
  }
}
