/**
 * @description This file contains the class MdnsReflectorClient.
 * @file src/dgram/mdnsReflectorClient.ts
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

import { getStringArrayParameter, hasParameter } from '../utils/commandLine.js';

import { Mdns } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';
import { Unicast } from './unicast.js';
import { MDNS_REFLECTOR_ADDRESS, MDNS_REFLECTOR_BIND_ADDRESS_IPV4, MDNS_REFLECTOR_BIND_ADDRESS_IPV6, MDNS_REFLECTOR_HOST_DOCKER, MDNS_REFLECTOR_PORT } from './mdnsReflectorTypes.js';

export class MdnsReflectorClient {
  verbose = hasParameter('v') || hasParameter('verbose');
  debug = hasParameter('d') || hasParameter('debug') || hasParameter('v') || hasParameter('verbose');
  silent = hasParameter('s') || hasParameter('silent');
  log = new AnsiLogger({ logName: 'MdnsReflectorClient', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: this.debug ? LogLevel.DEBUG : this.silent ? LogLevel.NOTICE : LogLevel.INFO });

  mdnsIpv4 = new Mdns('mDNS udp4 Server', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV4);
  mdnsIpv6 = new Mdns('mDNS udp6 Server', MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT, 'udp6', true, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV6);

  unicastIpv4 = new Unicast('mDNS udp4 Reflector Client', 'udp4', false, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV4);
  unicastIpv6 = new Unicast('mDNS udp6 Reflector Client', 'udp6', false, undefined, MDNS_REFLECTOR_BIND_ADDRESS_IPV6);

  constructor() {
    this.log.logNameColor = '\x1b[38;5;97m';
    this.mdnsIpv4.log.logNameColor = '\x1b[38;5;97m';
    this.mdnsIpv4.log.logLevel = LogLevel.WARN;
    this.mdnsIpv6.log.logNameColor = '\x1b[38;5;97m';
    this.mdnsIpv6.log.logLevel = LogLevel.WARN;
    this.unicastIpv4.log.logNameColor = '\x1b[38;5;97m';
    this.unicastIpv4.log.logLevel = LogLevel.WARN;
    this.unicastIpv6.log.logNameColor = '\x1b[38;5;97m';
    this.unicastIpv6.log.logLevel = LogLevel.WARN;
    // Apply filters if any
    const filters = getStringArrayParameter('filter');
    if (filters) this.mdnsIpv4.filters.push(...filters);
    if (filters) this.mdnsIpv6.filters.push(...filters);
  }

  async start() {
    this.log.notice('mDNS Reflector Client starting...');

    this.mdnsIpv4.on('error', (err) => {
      this.log.error(`mDNS udp4 Server error:\n${err.stack}`);
    });

    this.mdnsIpv6.on('error', (err) => {
      this.log.error(`mDNS udp6 Server error:\n${err.stack}`);
    });

    this.unicastIpv4.on('error', (err) => {
      this.log.error(`mDNS udp4 Reflector Client error:\n${err.stack}`);
    });

    this.unicastIpv6.on('error', (err) => {
      this.log.error(`mDNS udp6 Reflector Client error:\n${err.stack}`);
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

    this.mdnsIpv4.on('message', (msg, rinfo) => {
      this.log.notice(`Sending message from mDNS ipv4 multicast ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt} to unicast ipv4 reflector`);
      this.unicastIpv4.send(msg, MDNS_REFLECTOR_HOST_DOCKER, MDNS_REFLECTOR_PORT);
      this.unicastIpv4.send(msg, MDNS_REFLECTOR_ADDRESS, MDNS_REFLECTOR_PORT);
    });

    this.mdnsIpv6.on('message', (msg, rinfo) => {
      this.log.notice(`Sending message from mDNS ipv6 multicast ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt} to unicast ipv6 reflector`);
      this.unicastIpv6.send(msg, MDNS_REFLECTOR_HOST_DOCKER, MDNS_REFLECTOR_PORT);
      this.unicastIpv6.send(msg, MDNS_REFLECTOR_ADDRESS, MDNS_REFLECTOR_PORT);
    });

    this.unicastIpv4.on('message', (msg, rinfo) => {
      this.log.notice(`Received message from unicast reflector on ipv4 ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt}: ${msg.toString()}`);
    });

    this.unicastIpv6.on('message', (msg, rinfo) => {
      this.log.notice(`Received message from unicast reflector on ipv6 ${BLUE}${rinfo.address}${nt}:${BLUE}${rinfo.port}${nt}: ${msg.toString()}`);
    });

    this.log.notice('mDNS Reflector Client started.');
  }

  async stop() {
    this.log.notice('mDNS Reflector Client stopping...');

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

    this.log.notice('mDNS Reflector Client stopped.');
  }
}
