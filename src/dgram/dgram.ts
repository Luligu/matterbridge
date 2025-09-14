/**
 * @description This file contains the class Dgram.
 * @file dgram.ts
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
import dgram from 'node:dgram';
import EventEmitter from 'node:events';
import { AddressInfo } from 'node:net';
import os from 'node:os';

// AnsiLogger imports
import { AnsiLogger, BLUE, db, idn, LogLevel, nf, rs, TimestampFormat } from 'node-ansi-logger';

/**
 * Represents the Dgram events.
 */
interface DgramEvents {
  error: [error: Error];
  close: [];
  connect: [];
  message: [msg: Buffer, rinfo: dgram.RemoteInfo];
  listening: [address: AddressInfo];
  sent: [msg: Buffer, serverAddress: string, serverPort: number];
  ready: [address: AddressInfo];
  bound: [address: AddressInfo];
}

/**
 * This class implements a dgram socket.
 */
export class Dgram extends EventEmitter<DgramEvents> {
  log;
  socket: dgram.Socket;
  bound = false;
  socketType: 'udp4' | 'udp6';
  interfaceName?: string;
  interfaceAddress?: string;
  interfaceNetmask?: string;

  /**
   * Creates an instance of Dgram.
   *
   * @param {string} name - The name of the socket.
   * @param {'udp4' | 'udp6'} socketType - The type of the socket (IPv4 or IPv6).
   * @param {boolean | undefined} reuseAddr - Whether to allow address reuse.
   * @param {string} [interfaceName] - The name of the network interface to bind to.
   * @param {string} [interfaceAddress] - The address of the network interface to bind to.
   */
  constructor(name: string, socketType: 'udp4' | 'udp6', reuseAddr: boolean | undefined = true, interfaceName?: string, interfaceAddress?: string) {
    super();
    this.log = new AnsiLogger({ logName: name, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    this.socket = dgram.createSocket({ type: socketType, reuseAddr });
    this.socketType = socketType;
    this.interfaceName = interfaceName;
    this.interfaceAddress = interfaceAddress;

    this.socket.on('error', (error) => {
      this.log.debug(`Socket error: ${error instanceof Error ? error.message : error}`);
      this.emit('error', error);
      this.onError(error);
    });

    this.socket.on('close', () => {
      this.log.debug('Socket closed');
      this.bound = false;
      this.emit('close');
      this.onClose();
    });

    this.socket.on('connect', () => {
      this.log.info('Socket connected');
      this.emit('connect');
      this.onConnect();
    });

    this.socket.on('message', (msg, rinfo) => {
      this.log.debug(`Socket received a message from ${BLUE}${rinfo.family}${db} ${BLUE}${rinfo.address}${db}:${BLUE}${rinfo.port}${db}`);
      this.emit('message', msg, rinfo);
      this.onMessage(msg, rinfo);
    });

    this.socket.on('listening', () => {
      this.bound = true;
      const address = this.socket.address();
      this.log.debug(`Socket listening on ${BLUE}${address.family}${db} ${BLUE}${address.address}${db}:${BLUE}${address.port}${db}`);
      this.emit('listening', address);
      this.onListening(address);
    });
  }

  /**
   * Sends a message to the specified server.
   *
   * @param {Buffer} msg - The message buffer to send.
   * @param {string} serverAddress - The IPv4 address of the destination server.
   * @param {number} serverPort - The port of the destination server.
   */
  send(msg: Buffer, serverAddress: string, serverPort: number) {
    this.socket.send(msg, 0, msg.length, serverPort, serverAddress, (error: Error | null) => {
      if (error) {
        this.log.error(`Socket failed to send a message: ${error instanceof Error ? error.message : error}`);
        this.emit('error', error);
        this.onError(error);
      } else {
        this.log.debug(`Socket sent a message to ${BLUE}${serverAddress}${db}:${BLUE}${serverPort}${db}`);
        this.emit('sent', msg, serverAddress, serverPort);
        this.onSent(msg, serverAddress, serverPort);
      }
    });
  }

  onError(error: Error) {
    this.log.error(`Socket error: ${error instanceof Error ? error.message : error}`);
  }

  onClose() {
    this.log.info(`Socket closed`);
  }

  onConnect() {
    this.log.info(`Socket connected`);
  }

  onSent(msg: Buffer, serverAddress: string, serverPort: number) {
    this.log.info(`Socket sent a message to ${BLUE}${serverAddress}${db}:${BLUE}${serverPort}${db}`);
  }

  onMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    this.log.info(`Socket received a message from ${BLUE}${rinfo.family}${nf} ${BLUE}${rinfo.address}${nf}:${BLUE}${rinfo.port}${nf}`);
  }

  onListening(address: AddressInfo) {
    this.log.info(`Socket listening on ${BLUE}${address.family}${nf} ${BLUE}${address.address}${nf}:${BLUE}${address.port}${nf}`);
    this.onReady(address);
  }

  onReady(address: AddressInfo) {
    this.log.info(`Socket ready on ${BLUE}${address.family}${nf} ${BLUE}${address.address}${nf}:${BLUE}${address.port}${nf}`);
    this.emit('ready', address);
  }

  /**
   * Retrieves the IPv4 address of the specified network interface or the first external IPv4 interface if no interface is specified.
   * Throws an error if no suitable interface or address is found.
   *
   * @param {string} networkInterface - The name of the network interface to retrieve the IPv4 address from. If not specified, the first external IPv4 interface will be used.
   * @returns {string | undefined} The IPv4 address of the specified network interface or the first external IPv4 interface.
   * @throws {Error} if no suitable interface or address is found.
   */
  getIpv4InterfaceAddress(networkInterface?: string): string | undefined {
    // Normalize the interface name: treat an empty string as undefined.
    if (networkInterface === '') networkInterface = undefined;

    const interfaces = os.networkInterfaces();

    // If a specific interface is provided but not found, warn and fall back.
    if (networkInterface && !interfaces[networkInterface]) {
      this.log.warn(`Interface "${networkInterface}" not found. Using first external IPv4 interface.`);
      networkInterface = undefined;
    }

    // If no interface was specified or the provided one doesn't exist, find the first external IPv4 interface.
    if (!networkInterface) {
      for (const [interfaceName, interfaceDetails] of Object.entries(interfaces)) {
        if (!interfaceDetails) continue;
        // Check if at least one external IPv4 address exists on this interface.
        for (const detail of interfaceDetails) {
          if (detail.family === 'IPv4' && !detail.internal) {
            networkInterface = interfaceName;
            break;
          }
        }
        if (networkInterface) break;
      }
    }
    if (!networkInterface) {
      throw new Error(`Didn't find an external IPv4 network interface`);
    }

    // Select the first external IPv4 address from the interface.
    const addresses = interfaces[networkInterface];
    const ipv4Address = addresses?.find((addr) => addr.family === 'IPv4' && !addr.internal);
    if (!ipv4Address) {
      throw new Error(`Interface ${networkInterface} does not have an external IPv4 address`);
    }

    return ipv4Address.address;
  }

  /**
   * Retrieves the IPv6 address of the specified network interface or the first external IPv6 interface if no interface is specified.
   * Throws an error if no suitable interface or address is found.
   *
   * @param {string} [networkInterface] - The name of the network interface to retrieve the IPv6 address from. If not specified, the first external IPv6 interface will be used.
   * @returns {string | undefined} The IPv6 address of the specified network interface or the first external IPv6 interface.
   * @throws {Error} If no suitable interface or address is found.
   */
  getIpv6InterfaceAddress(networkInterface?: string): string | undefined {
    // Normalize the interface name: treat an empty string as undefined.
    if (networkInterface === '') networkInterface = undefined;

    const interfaces = os.networkInterfaces();

    // If a specific interface is provided, verify it exists. Otherwise, warn and use the first external IPv6 interface.
    if (networkInterface && !interfaces[networkInterface]) {
      this.log.warn(`Interface "${networkInterface}" not found. Using first external IPv6 interface.`);
      networkInterface = undefined;
    }

    // If no network interface was specified, search for the first external IPv6 interface.
    if (!networkInterface) {
      for (const [interfaceName, interfaceDetails] of Object.entries(interfaces)) {
        if (!interfaceDetails) continue;
        for (const detail of interfaceDetails) {
          if (detail.family === 'IPv6' && !detail.internal) {
            networkInterface = interfaceName;
            break;
          }
        }
        if (networkInterface) break;
      }
    }
    if (!networkInterface) {
      throw new Error(`Didn't find an external IPv6 network interface`);
    }

    const addresses = interfaces[networkInterface];

    // Try to find a link-local address and use scopeid
    const linkLocalAddress = addresses?.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fe80'));
    if (linkLocalAddress) {
      this.log.debug('Found IPv6 link-local address');
      return linkLocalAddress.scopeid ? `${linkLocalAddress.address}%${process.platform !== 'win32' ? networkInterface : linkLocalAddress.scopeid}` : linkLocalAddress.address;
    }
    this.log.debug('No IPv6 link-local address found');

    // Try to find a unique local address
    const ulaAddress = addresses?.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fd') && addr.netmask === 'ffff:ffff:ffff:ffff::');
    if (ulaAddress) {
      this.log.debug('Found IPv6 Unique Local Addresses (ULA) unicast address');
      return ulaAddress.address;
    }
    this.log.debug('No IPv6 Unique Local Addresses (ULA) unicast address found');

    // Try to find a unique local address
    const uniqueLocalAddress = addresses?.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.address.startsWith('fd'));
    if (uniqueLocalAddress) {
      this.log.debug('Found IPv6 Unique Local Addresses (ULA) address');
      return uniqueLocalAddress.address;
    }
    this.log.debug('No IPv6 Unique Local Addresses (ULA) address found');

    throw new Error(`Interface ${networkInterface} does not have a suitable external IPv6 address`);
  }

  /**
   * Retrieves the names of all available network interfaces.
   *
   * @returns {string[]} An array of network interface names.
   */
  getInterfacesNames(): string[] {
    const interfaces = os.networkInterfaces();
    const interfaceNames: string[] = [];
    for (const name in interfaces) {
      if (interfaces[name]) {
        interfaceNames.push(name);
      }
    }
    return interfaceNames;
  }

  /**
   *  Retrieves the scope ID of the first found IPv6 address on the specified network interface or on any interface if none is specified.
   *
   * @param {string} [interfaceName] - The name of the network interface. If not provided, the first found IPv6 address will be used.
   * @returns {string} The scope ID of the first found IPv6 address or an empty string.
   */
  getIpv6ScopeId(interfaceName?: string): string {
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
      if (interfaceName && name !== interfaceName) continue;
      const iface = interfaces[name];
      if (iface) {
        const ipv6Address = iface.find((addr) => addr.family === 'IPv6' && !addr.internal && addr.scopeid);
        if (ipv6Address) {
          return process.platform === 'win32' ? '%' + String(ipv6Address.scopeid) : '%' + name; // Use the scope ID for Windows, or the interface name for non-Windows platforms
        }
      }
    }
    return '';
  }

  /**
   * Retrieves the interface name from the scope id of an IPv6 address.
   *
   * @param {number} scopeId - The scope id of the IPv6 address.
   * @returns {string | undefined} The interface name or undefined if not found.
   */
  getInterfaceNameFromScopeId(scopeId: number): string | undefined {
    const nets = os.networkInterfaces();
    for (const ifaceName in nets) {
      const addresses = nets[ifaceName] || [];
      for (const addr of addresses) {
        // Check for IPv6 addresses with a matching scope id.
        if (addr.family === 'IPv6' && addr.scopeid === scopeId) {
          return ifaceName;
        }
      }
    }
    return undefined;
  }

  /**
   * Retrieves the netmask of the specified interface address.
   *
   * @param {string} interfaceAddress - The interface address for which to retrieve the netmask.
   * @returns {string | undefined} The netmask of the specified interface address or undefined if not found.
   */
  getNetmask(interfaceAddress: string): string | undefined {
    // Remove zone index if present (e.g. for IPv6 "fe80::1%eth0")
    const cleanedAddress = interfaceAddress.includes('%') ? interfaceAddress.split('%')[0] : interfaceAddress;

    // Iterate over all interfaces.
    const nets = os.networkInterfaces();
    for (const ifaceName in nets) {
      const ifaceAddresses = nets[ifaceName];
      if (!ifaceAddresses) continue;
      for (const addr of ifaceAddresses) {
        if (addr.address === cleanedAddress) {
          return addr.netmask;
        }
      }
    }
    return undefined;
  }

  /**
   * Computes the broadcast address given an IPv4 address and netmask.
   *
   * @param {string | undefined} [ipAddress] - The IPv4 address e.g. "192.168.1.20"
   * @param {string | undefined} [netmask] - The IPv4 netmask e.g. "255.255.255.0"
   * @returns {string | undefined} The computed broadcast address, e.g. "192.168.1.255"
   */
  getIpv4BroadcastAddress(ipAddress: string | undefined, netmask: string | undefined): string | undefined {
    if (!ipAddress || !netmask) {
      return undefined;
    }
    const ipParts = ipAddress.split('.').map(Number);
    const maskParts = netmask.split('.').map(Number);
    const broadcastParts = ipParts.map((octet, i) => (octet & maskParts[i]) | (255 - maskParts[i]));
    return broadcastParts.join('.');
  }

  /**
   * Returns the broadcast IPv6 address.
   *
   * @returns {string} The broadcast IPv6 address, e.g. "ff02::1"
   */
  getIpv6BroadcastAddress(): string {
    return 'ff02::1';
  }

  /**
   * Logs all available network interfaces and their details.
   */
  listNetworkInterfaces() {
    const interfaces = os.networkInterfaces();
    for (const [name, addresses] of Object.entries(interfaces)) {
      if (!addresses) continue;
      this.log.debug(`Interface: ${idn}${name}${rs}${db}`);
      for (const address of addresses) {
        this.log.debug(
          `- address ${BLUE}${address.address}${db} netmask ${BLUE}${address.netmask}${db} ${address.mac ? 'MAC: ' + BLUE + address.mac + db : ''} type: ${BLUE}${address.family}${db} ${BLUE}${address.internal ? 'internal' : 'external'}${db} ${address.scopeid !== undefined ? 'scopeid: ' + BLUE + address.scopeid + db : ''} cidr: ${BLUE}${address.cidr}${db}`,
        );
      }
    }
  }
}
