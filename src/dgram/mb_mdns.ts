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
import os from 'node:os';

// Matterbridge
import { getIntParameter, getParameter, getStringArrayParameter, hasParameter } from '../utils/commandLine.js';

// Net imports
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';
import { DnsClass, DnsClassFlag, DnsRecordType, Mdns } from './mdns.js';
import { MdnsReflectorClient } from './mdnsReflectorClient.js';
import { MdnsReflectorServer } from './mdnsReflectorServer.js';

// istanbul ignore next
{
  if (hasParameter('h') || hasParameter('help')) {
    // eslint-disable-next-line no-console
    console.log(`Copyright (c) Matterbridge. All rights reserved. Version 1.0.0.\n`);
    // eslint-disable-next-line no-console
    console.log(`Usage: mb_mdns [options...]

If no command line is provided, mb_mdns shows all incoming mDNS records on all interfaces (0.0.0.0 and ::).

Options:
  -h, --help                                Show this help message and exit.
  --interfaceName <name>                    Network interface name to bind to (default all interfaces).
  --ipv4InterfaceAddress <address>          IPv4 address of the network interface to bind to (default: 0.0.0.0).
  --ipv6InterfaceAddress <address>          IPv6 address of the network interface to bind to (default: ::).
  --outgoingIpv4InterfaceAddress <address>  Outgoing IPv4 address of the network interface (default first external address).
  --outgoingIpv6InterfaceAddress <address>  Outgoing IPv6 address of the network interface (default first external address).
  --advertise <interval>                    Enable matterbridge mDNS advertisement each ms (default interval: 10000ms).
  --query <interval>                        Enable common mDNS services query each ms (default interval: 10000ms).
  --filter <string...>                      Filter strings to match in the mDNS record name (default: no filter).
  --noIpv4                                  Disable IPv4 mDNS server (default: enabled).
  --noIpv6                                  Disable IPv6 mDNS server (default: enabled).
  --no-timeout                              Disable automatic timeout of 10 minutes. Reflector mode disables timeout automatically.
  --reflector-client                        Enable mDNS reflector client (default: disabled).
  --reflector-server                        Enable mDNS reflector server (default: disabled).
  -d, --debug                               Enable debug logging (default: disabled).
  -v, --verbose                             Enable verbose logging (default: disabled).
  -s, --silent                              Enable silent mode, only log notices, warnings and errors.

Examples:
  # Listen for Matter device commissioner service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matterc._udp

  # Listen for Matter device discovery service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matter._tcp

  # Listen for Matter commissioner and discovery service records on all interfaces
  mb_mdns --filter _matterc._udp _matter._tcp

  # Query for mDNS devices every 10s on a specific interface
  mb_mdns --interfaceName eth0 --query

  # Advertise _matterbridge._tcp.local every 5s with filter
  mb_mdns --advertise 5000 --filter _matterbridge._tcp.local

  # Query each 5s and listen for _matterbridge._tcp.local service records
  mb_mdns --query 5000 --filter _matterbridge._tcp.local
`);
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  // Dynamic JSON import (Node >= 20) with import attributes
  const { default: pkg } = await import('../../package.json', { with: { type: 'json' } });

  let mdnsIpv4QueryInterval: NodeJS.Timeout | undefined;
  let mdnsIpv6QueryInterval: NodeJS.Timeout | undefined;
  let mdnsIpv4AdvertiseInterval: NodeJS.Timeout | undefined;
  let mdnsIpv6AdvertiseInterval: NodeJS.Timeout | undefined;

  let mdnsIpv4: Mdns | undefined = undefined;
  let mdnsIpv6: Mdns | undefined = undefined;

  let reflectorClient: MdnsReflectorClient | undefined = undefined;
  let reflectorServer: MdnsReflectorServer | undefined = undefined;

  /**
   * Cleanup and log device information before exiting.
   */
  async function cleanupAndLogAndExit() {
    clearInterval(mdnsIpv4QueryInterval);
    clearInterval(mdnsIpv6QueryInterval);
    clearInterval(mdnsIpv4AdvertiseInterval);
    clearInterval(mdnsIpv6AdvertiseInterval);
    if (hasParameter('advertise')) {
      if (mdnsIpv4) advertise(mdnsIpv4, 0); // Send goodbye with TTL 0
      if (mdnsIpv6) advertise(mdnsIpv6, 0); // Send goodbye with TTL 0
    }
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for 250ms to allow goodbye messages to be sent
    mdnsIpv4?.stop();
    mdnsIpv6?.stop();
    mdnsIpv4?.logDevices();
    mdnsIpv6?.logDevices();
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for 250ms to allow sockets to close

    await reflectorClient?.stop();
    await reflectorServer?.stop();
  }

  const query = (mdns: Mdns) => {
    mdns.log.info('Sending mDNS query for services...');
    mdns.sendQuery([
      { name: '_matterc._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_matterbridge._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_mqtt._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_http._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
    ]);
  };

  /**
   * Sends an mDNS advertisement for the HTTP service over UDP IPv4.
   *
   * @param {Mdns} mdns - The Mdns instance to use for sending the advertisement.
   * @param {number} [ttl] - The time-to-live for the advertisement records. Defaults to 120 seconds. Send 0 for goodbye.
   */
  const advertise = (mdns: Mdns, ttl: number = 120) => {
    mdns.log.info(`Sending mDNS advertisement for matterbridge service with TTL ${ttl ? ttl.toString() : 'goodbye'}...`);
    const httpServiceType = '_http._tcp.local';
    const matterbridgeServiceType = '_matterbridge._tcp.local';
    const httpInstanceName = 'matterbridge._http._tcp.local';
    const matterbridgeInstanceName = 'matterbridge._matterbridge._tcp.local';
    const hostName = 'matterbridge.local';
    const port = 8283;

    const ptrHttpServiceTypeRdata = mdns.encodeDnsName(httpServiceType);
    const ptrMatterbridgeServiceTypeRdata = mdns.encodeDnsName(matterbridgeServiceType);
    const ptrHttpInstanceRdata = mdns.encodeDnsName(httpInstanceName);
    const ptrMatterbridgeInstanceRdata = mdns.encodeDnsName(matterbridgeInstanceName);
    const srvRdata = mdns.encodeSrvRdata(0, 0, port, hostName);
    const txtRdata = mdns.encodeTxtRdata([`version=${pkg.version}`, 'path=/']);

    const answers: { name: string; rtype: number; rclass: number; ttl: number; rdata: Buffer }[] = [
      // PTR records for service types and instances
      { name: '_services._dns-sd._udp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrHttpServiceTypeRdata },
      { name: httpServiceType, rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrHttpInstanceRdata },
      { name: '_services._dns-sd._udp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrMatterbridgeServiceTypeRdata },
      { name: matterbridgeServiceType, rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl, rdata: ptrMatterbridgeInstanceRdata },
      // SRV record for the HTTP instance
      { name: httpInstanceName, rtype: DnsRecordType.SRV, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: srvRdata },
      // SRV record for the matterbridge instance
      { name: matterbridgeInstanceName, rtype: DnsRecordType.SRV, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: srvRdata },
      // TXT record for the HTTP instance
      { name: httpInstanceName, rtype: DnsRecordType.TXT, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: txtRdata },
      // TXT record for the matterbridge instance
      { name: matterbridgeInstanceName, rtype: DnsRecordType.TXT, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: txtRdata },
    ];
    // Always attempt to add both A and all AAAA records (best effort), regardless of the socket family.
    const interfaces = os.networkInterfaces();
    // Use specified interface name if provided
    let interfaceInfos: os.NetworkInterfaceInfo[] | undefined = mdns.interfaceName ? interfaces[mdns.interfaceName] : undefined;
    // Find the first non-internal IPv4 and IPv6 addresses if interface name is not provided or not found
    if (!interfaceInfos) {
      interfaceInfos = [];
      for (const name of Object.keys(interfaces)) {
        const infos = interfaces[name];
        if (infos && infos.length > 0 && !infos[0].internal) {
          interfaceInfos.push(...infos);
          break;
        }
      }
    }
    // Encode A and AAAA records for all non-internal addresses of the selected interface
    try {
      for (const info of interfaceInfos) {
        if (info.family === 'IPv4' && !info.internal) {
          const ipv4 = info.address;
          answers.push({ name: hostName, rtype: DnsRecordType.A, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: mdns.encodeA(ipv4) });
        } else if (info.family === 'IPv6' && !info.internal) {
          const ipv6 = info.address;
          answers.push({ name: hostName, rtype: DnsRecordType.AAAA, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: mdns.encodeAAAA(ipv6) });
        }
      }
    } catch (error) {
      mdns.log.error(`Error encoding network interface addresses: ${(error as Error).message}`);
    }
    const _response = mdns.sendResponse(answers);
  };

  if (!hasParameter('noIpv4') && !hasParameter('reflector-server') && !hasParameter('reflector-client')) {
    mdnsIpv4 = new Mdns('mDNS Server udp4', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, getParameter('interfaceName'), getParameter('ipv4InterfaceAddress') || '0.0.0.0', getParameter('outgoingIpv4InterfaceAddress'));
    if (hasParameter('v') || hasParameter('verbose')) mdnsIpv4.listNetworkInterfaces();

    // Apply filters if any
    const filters = getStringArrayParameter('filter');
    if (filters) mdnsIpv4.filters.push(...filters);

    // Start the IPv4 mDNS server
    mdnsIpv4.start();
    mdnsIpv4.on('ready', (address: AddressInfo) => {
      mdnsIpv4?.log.info(`mdnsIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
      if (hasParameter('advertise')) {
        advertise(mdnsIpv4 as Mdns);
        mdnsIpv4AdvertiseInterval = setInterval(() => advertise(mdnsIpv4 as Mdns), getIntParameter('advertise') || 10000).unref();
      }
      if (hasParameter('query')) {
        query(mdnsIpv4 as Mdns);
        mdnsIpv4QueryInterval = setInterval(() => query(mdnsIpv4 as Mdns), getIntParameter('query') || 10000).unref();
      }
    });
  }

  if (!hasParameter('noIpv6') && !hasParameter('reflector-server') && !hasParameter('reflector-client')) {
    mdnsIpv6 = new Mdns('mDNS Server udp6', MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT, 'udp6', true, getParameter('interfaceName'), getParameter('ipv6InterfaceAddress') || '::', getParameter('outgoingIpv6InterfaceAddress'));
    if (hasParameter('v') || hasParameter('verbose')) mdnsIpv6.listNetworkInterfaces();

    // Apply filters if any
    const filters = getStringArrayParameter('filter');
    if (filters) mdnsIpv6.filters.push(...filters);

    // Start the IPv6 mDNS server
    mdnsIpv6.start();
    mdnsIpv6.on('ready', (address: AddressInfo) => {
      mdnsIpv6?.log.info(`mdnsIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
      if (hasParameter('advertise')) {
        advertise(mdnsIpv6 as Mdns);
        mdnsIpv6AdvertiseInterval = setInterval(() => advertise(mdnsIpv6 as Mdns), getIntParameter('advertise') || 10000).unref();
      }
      if (hasParameter('query')) {
        query(mdnsIpv6 as Mdns);
        mdnsIpv6QueryInterval = setInterval(() => query(mdnsIpv6 as Mdns), getIntParameter('query') || 10000).unref();
      }
    });
  }

  if (hasParameter('reflector-client')) {
    reflectorClient = new MdnsReflectorClient();
    await reflectorClient.start();
  }

  if (hasParameter('reflector-server')) {
    reflectorServer = new MdnsReflectorServer();
    await reflectorServer.start();
  }

  // Handle Ctrl+C (SIGINT) and SIGTERM to stop and log devices
  process.on('SIGINT', async () => {
    await cleanupAndLogAndExit();
  });
  process.on('SIGTERM', async () => {
    await cleanupAndLogAndExit();
  });

  // Exit after a timeout to avoid running indefinitely in test environments
  if (!hasParameter('no-timeout') && !hasParameter('reflector-server') && !hasParameter('reflector-client')) {
    setTimeout(async () => {
      await cleanupAndLogAndExit();
    }, 600000).unref(); // 10 minutes timeout to exit if no activity
  }
}
