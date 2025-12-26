/**
 * @description This file contains the class MdnsReflectorServer.
 * @file src/dgram/mdnsReflectorServer.ts
 * @author Luca Liguori
 * @created 2025-12-25
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

import { AnsiLogger, LogLevel, TimestampFormat, BLUE, nt } from 'node-ansi-logger';

import { hasParameter } from '../utils/commandLine.js';

import { DnsRecordType, Mdns } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';
import { Unicast } from './unicast.js';
import { MDNS_REFLECTOR_BIND_ADDRESS_IPV4, MDNS_REFLECTOR_BIND_ADDRESS_IPV6, MDNS_REFLECTOR_PORT } from './mdnsReflectorTypes.js';

export class MdnsReflectorServer {
  verbose = hasParameter('v') || hasParameter('verbose');
  debug = hasParameter('d') || hasParameter('debug') || hasParameter('v') || hasParameter('verbose');
  silent = hasParameter('s') || hasParameter('silent');
  log = new AnsiLogger({ logName: 'MdnsReflectorServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.debug ? LogLevel.DEBUG : this.silent ? LogLevel.NOTICE : LogLevel.INFO });

  mdnsIpv4 = new Mdns('mDNS udp4 Server', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV4);
  mdnsIpv6 = new Mdns('mDNS udp6 Server', MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT, 'udp6', true, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV6);

  unicastIpv4 = new Unicast('mDNS udp4 Reflector Server', 'udp4', true, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV4, MDNS_REFLECTOR_PORT);
  unicastIpv6 = new Unicast('mDNS udp6 Reflector Server', 'udp6', true, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV6, MDNS_REFLECTOR_PORT);

  constructor() {
    this.log.logNameColor = '\x1b[38;5;115m';
    this.mdnsIpv4.log.logNameColor = '\x1b[38;5;115m';
    this.mdnsIpv6.log.logNameColor = '\x1b[38;5;115m';
    this.unicastIpv4.log.logNameColor = '\x1b[38;5;115m';
    this.unicastIpv6.log.logNameColor = '\x1b[38;5;115m';
  }

  getBroadcastAddress(mdns: Mdns): string | undefined {
    try {
      const address = mdns.socketType === 'udp4' ? mdns.getIpv4InterfaceAddress(mdns.interfaceName) : mdns.getIpv6InterfaceAddress(mdns.interfaceName);
      const mask = mdns.socketType === 'udp4' ? mdns.getNetmask(address as string) : undefined;
      const broadcastAddress = mdns.socketType === 'udp4' ? mdns.getIpv4BroadcastAddress(address, mask) : mdns.getIpv6BroadcastAddress();
      return broadcastAddress;
    } catch (error) {
      mdns.log.error(`Error getting broadcast address: ${(error as Error).message}`);
    }
  }

  /**
   * Decode and upgrade the A and AAAA records from Docker environment to point the host machine.
   * Matterbridge running inside Docker Desktop containers register mDNS records with the container's IP address,
   * which is not reachable from outside the Docker network.
   * To make these services reachable, we need to upgrade the A and AAAA records using the host machine IP addresses.
   * The reflector server runs on the host, while mDNS advertisements come from containers.
   *
   * @param {Buffer<ArrayBufferLike>} msg - The mDNS message buffer.
   * @returns {Buffer<ArrayBufferLike>} The upgraded mDNS message buffer.
   */
  upgradeAddressForDocker(msg: Buffer<ArrayBufferLike>): Buffer<ArrayBufferLike> {
    // Safety: if it's not even a DNS header, do nothing.
    if (!msg || msg.length < 12) return msg;

    let hostIpv4: string | undefined;
    let hostIpv6: string | undefined;
    try {
      hostIpv4 = this.mdnsIpv4.getIpv4InterfaceAddress(this.mdnsIpv4.interfaceName);
    } catch {
      hostIpv4 = undefined;
    }
    try {
      hostIpv6 = this.mdnsIpv6.getIpv6InterfaceAddress(this.mdnsIpv6.interfaceName);
    } catch {
      hostIpv6 = undefined;
    }

    if (!hostIpv4 && !hostIpv6) return msg;

    // Copy the message so callers can safely re-use the original buffer.
    const upgradedMsg = Buffer.from(msg);

    const qdCount = upgradedMsg.readUInt16BE(4);
    const anCount = upgradedMsg.readUInt16BE(6);
    const nsCount = upgradedMsg.readUInt16BE(8);
    const arCount = upgradedMsg.readUInt16BE(10);

    let offset = 12;

    try {
      // Skip questions
      for (let i = 0; i < qdCount; i++) {
        const qnameResult = this.mdnsIpv4.decodeDnsName(upgradedMsg, offset);
        offset = qnameResult.newOffset;
        // QTYPE + QCLASS
        offset += 4;
        if (offset > upgradedMsg.length) return msg;
      }

      const hostA = hostIpv4 ? this.mdnsIpv4.encodeA(hostIpv4) : undefined;
      const hostAAAA = hostIpv6 ? this.mdnsIpv6.encodeAAAA(hostIpv6) : undefined;

      const upgradeResourceRecords = (count: number) => {
        for (let i = 0; i < count; i++) {
          const nameResult = this.mdnsIpv4.decodeDnsName(upgradedMsg, offset);
          offset = nameResult.newOffset;

          if (offset + 10 > upgradedMsg.length) return;
          const type = upgradedMsg.readUInt16BE(offset);
          offset += 2;
          // class (unused)
          offset += 2;
          // ttl (unused)
          offset += 4;
          const rdlength = upgradedMsg.readUInt16BE(offset);
          offset += 2;

          const rdataOffset = offset;
          const endOfRdata = rdataOffset + rdlength;
          if (endOfRdata > upgradedMsg.length) return;

          if (type === DnsRecordType.A && rdlength === 4 && hostA) {
            hostA.copy(upgradedMsg, rdataOffset);
          } else if (type === DnsRecordType.AAAA && rdlength === 16 && hostAAAA) {
            hostAAAA.copy(upgradedMsg, rdataOffset);
          }

          offset = endOfRdata;
        }
      };

      // Walk RR sections and patch A/AAAA in-place.
      upgradeResourceRecords(anCount);
      upgradeResourceRecords(nsCount);
      upgradeResourceRecords(arCount);
    } catch (error) {
      this.log.debug(`upgradeAddressForDocker() failed to parse message: ${(error as Error).message}`);
      return msg;
    }

    return upgradedMsg;
  }

  async start() {
    this.log.notice('mDNS Reflector Server starting...');

    this.mdnsIpv4.on('error', (err) => {
      this.log.error(`mDNS udp4 Server error:\n${err.stack}`);
    });

    this.mdnsIpv6.on('error', (err) => {
      this.log.error(`mDNS udp6 Server error:\n${err.stack}`);
    });

    this.unicastIpv4.on('error', (err) => {
      this.log.error(`mDNS udp4 Reflector Server error:\n${err.stack}`);
    });

    this.unicastIpv6.on('error', (err) => {
      this.log.error(`mDNS udp6 Reflector Server error:\n${err.stack}`);
    });

    const promises: Promise<void>[] = [];
    promises[0] = new Promise((resolve) => {
      this.mdnsIpv4.once('bound', () => resolve());
      this.mdnsIpv4.start();
    });
    promises[1] = new Promise((resolve) => {
      this.mdnsIpv6.once('bound', () => resolve());
      this.mdnsIpv6.start();
    });
    promises[2] = new Promise((resolve) => {
      this.unicastIpv4.once('bound', () => resolve());
      this.unicastIpv4.start();
    });
    promises[3] = new Promise((resolve) => {
      this.unicastIpv6.once('bound', () => resolve());
      this.unicastIpv6.start();
    });
    await Promise.all(promises);

    this.unicastIpv4.on('message', (msg, rinfo) => {
      this.log.notice(`Reflecting message from unicast client ipv4 ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt} to mDNS ipv4 multicast`);
      this.mdnsIpv4.send(msg, MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT);
      if (hasParameter('broadcast')) {
        const broadcastAddress = this.getBroadcastAddress(this.mdnsIpv4);
        if (broadcastAddress) {
          this.log.notice(`Reflecting message from unicast client ipv4 ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt} to ipv4 broadcast address ${BLUE}${broadcastAddress}${nt}`);
          this.mdnsIpv4.send(msg, broadcastAddress, MDNS_MULTICAST_PORT);
        }
      }
      this.unicastIpv4.send(Buffer.from('Received on ipv4'), rinfo.address, rinfo.port);
    });

    this.unicastIpv6.on('message', (msg, rinfo) => {
      this.log.notice(`Reflecting message from unicast client ipv6 ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt} to mDNS ipv6 multicast`);
      this.mdnsIpv6.send(msg, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT);
      if (hasParameter('broadcast')) {
        const broadcastAddress = this.getBroadcastAddress(this.mdnsIpv6);
        if (broadcastAddress) {
          this.log.notice(`Reflecting message from unicast client ipv6 ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt} to ipv6 broadcast address ${BLUE}${broadcastAddress}${nt}`);
          this.mdnsIpv6.send(msg, broadcastAddress, MDNS_MULTICAST_PORT);
        }
      }
      this.unicastIpv6.send(Buffer.from('Received on ipv6'), rinfo.address, rinfo.port);
    });

    this.log.notice('mDNS Reflector Server started.');
  }

  async stop() {
    this.log.notice('mDNS Reflector Server stopping...');

    const promises: Promise<void>[] = [];
    promises[0] = new Promise((resolve) => {
      this.mdnsIpv4.once('closed', () => resolve());
      this.mdnsIpv4.stop();
    });
    promises[1] = new Promise((resolve) => {
      this.mdnsIpv6.once('closed', () => resolve());
      this.mdnsIpv6.stop();
    });
    promises[2] = new Promise((resolve) => {
      this.unicastIpv4.once('closed', () => resolve());
      this.unicastIpv4.stop();
    });
    promises[3] = new Promise((resolve) => {
      this.unicastIpv6.once('closed', () => resolve());
      this.unicastIpv6.stop();
    });
    await Promise.all(promises);

    this.mdnsIpv4.removeAllListeners();
    this.mdnsIpv6.removeAllListeners();
    this.unicastIpv4.removeAllListeners();
    this.unicastIpv6.removeAllListeners();

    this.log.notice('mDNS Reflector Server stopped.');
  }
}
