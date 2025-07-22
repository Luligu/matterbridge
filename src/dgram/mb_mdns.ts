/**
 * @description This file contains the bin mb_mdns for the class Mdns.
 * @file src/dgram/mb_mdns.ts
 * @author Luca Liguori
 * @created 2025-07-22
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

// Net imports
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';
import { DnsClass, DnsRecordType, Mdns } from './mdns.js';

// istanbul ignore next
{
  const mdnsIpv4 = new Mdns('mDNS Server udp4', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, undefined, '0.0.0.0');
  const mdnsIpv6 = new Mdns('mDNS Server udp6', MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT, 'udp6', true, undefined, '::');
  mdnsIpv4.listNetworkInterfaces();

  /**
   * Cleanup and log device information before exiting.
   */
  function cleanupAndLogAndExit() {
    mdnsIpv4.stop();
    mdnsIpv6.stop();
    mdnsIpv4.logDevices();
    mdnsIpv6.logDevices();
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  /**
   *  Queries mDNS services over UDP IPv4 and sends a response for a specific service instance.
   *  This function sends a query for Shelly, HTTP, and services, and responds with the appropriate PTR records.
   */
  const queryUdp4 = () => {
    mdnsIpv4.sendQuery([
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
      { name: '_http._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
      { name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
    ]);

    const ptrRdata = mdnsIpv4.encodeDnsName('matterbridge._http._tcp.local');
    mdnsIpv4.sendResponse('_http._tcp.local', DnsRecordType.PTR, DnsClass.IN, 120, ptrRdata);
  };

  /**
   *  Queries mDNS services over UDP IPv6 and sends a response for a specific service instance.
   *  This function sends a query for Shelly, HTTP, and services, and responds with the appropriate PTR records.
   */
  const queryUdp6 = () => {
    mdnsIpv6.sendQuery([
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_http._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
    ]);

    const ptrRdata = mdnsIpv6.encodeDnsName('matterbridge._http._tcp.local');
    mdnsIpv6.sendResponse('_http._tcp.local', DnsRecordType.PTR, DnsClass.IN, 120, ptrRdata);
  };

  // Handle Ctrl+C (SIGINT) to stop and log devices
  process.on('SIGINT', () => {
    cleanupAndLogAndExit();
  });

  mdnsIpv4.start();
  mdnsIpv4.on('ready', (address: AddressInfo) => {
    mdnsIpv4.log.info(`mdnsIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
    if (!process.argv.includes('--query')) return; // Skip querying if --query is not specified
    queryUdp4();
    setInterval(() => {
      queryUdp4();
    }, 10000).unref();
  });

  mdnsIpv6.start();
  mdnsIpv6.on('ready', (address: AddressInfo) => {
    mdnsIpv6.log.info(`mdnsIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
    if (!process.argv.includes('--query')) return; // Skip querying if --query is not specified
    queryUdp6();
    setInterval(() => {
      queryUdp6();
    }, 10000).unref();
  });

  setTimeout(() => {
    cleanupAndLogAndExit();
  }, 600000); // 10 minutes timeout to exit if no activity
}
