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

// Node.js imports
import { LogLevel } from 'node-ansi-logger';

// Matterbridge
import { getIntParameter, getParameter, getStringArrayParameter, hasParameter } from '../utils/commandLine.js';

// Net imports
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';
import { DnsClass, DnsClassFlag, DnsRecordType, Mdns } from './mdns.js';

// istanbul ignore next
{
  if (hasParameter('h') || hasParameter('help')) {
    // eslint-disable-next-line no-console
    console.log(`Copyright (c) Matterbridge. All rights reserved.\n`);
    // eslint-disable-next-line no-console
    console.log(`Usage: mb_mdns [options...]

If no command line is provided, mb_mdns shows all incoming mDNS records.

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
  -v, --verbose                             Enable verbose logging (default: disabled).

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

  const mdnsIpv4 = new Mdns('mDNS Server udp4', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, getParameter('interfaceName'), getParameter('ipv4InterfaceAddress') || '0.0.0.0', getParameter('outgoingIpv4InterfaceAddress'));
  const mdnsIpv6 = new Mdns('mDNS Server udp6', MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT, 'udp6', true, getParameter('interfaceName'), getParameter('ipv6InterfaceAddress') || '::', getParameter('outgoingIpv6InterfaceAddress'));
  if (hasParameter('v') || hasParameter('verbose')) {
    mdnsIpv4.log.logLevel = LogLevel.DEBUG;
    mdnsIpv6.log.logLevel = LogLevel.DEBUG;
  } else {
    mdnsIpv4.log.logLevel = LogLevel.INFO;
    mdnsIpv6.log.logLevel = LogLevel.INFO;
  }

  // List network interfaces
  mdnsIpv4.listNetworkInterfaces();

  // Apply filters if any
  const filters = getStringArrayParameter('filter');
  if (filters) {
    mdnsIpv4.filters.push(...filters);
    mdnsIpv6.filters.push(...filters);
  }

  /**
   * Cleanup and log device information before exiting.
   */
  async function cleanupAndLogAndExit() {
    if (hasParameter('advertise')) {
      advertise(mdnsIpv4, 0); // Send goodbye with TTL 0
      advertise(mdnsIpv6, 0); // Send goodbye with TTL 0
    }
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for 250ms to allow goodbye messages to be sent
    clearInterval(mdnsIpv4QueryInterval);
    clearInterval(mdnsIpv6QueryInterval);
    clearInterval(mdnsIpv4AdvertiseInterval);
    clearInterval(mdnsIpv6AdvertiseInterval);
    mdnsIpv4.stop();
    mdnsIpv6.stop();
    await new Promise((resolve) => setTimeout(resolve, 250)); // Wait for 250ms to allow sockets to close
    mdnsIpv4.logDevices();
    mdnsIpv6.logDevices();
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  const query = (mdns: Mdns) => {
    mdns.log.info('Sending mDNS query for services...');
    mdns.sendQuery([
      { name: '_matterc._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_matterbridge._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
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

    // Always attempt to add both A and AAAA records (best effort), regardless of the socket family.
    try {
      const ipv4 = mdns.getIpv4InterfaceAddress(mdns.interfaceName); // getIpv4InterfaceAddress();
      if (ipv4) {
        answers.push({ name: hostName, rtype: DnsRecordType.A, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: mdns.encodeA(ipv4) });
      }
    } catch (error) {
      mdns.log.warn(`Error sending mDNS advertisement for matterbridge service A record: ${(error as Error).message}`);
    }

    try {
      const ipv6 = mdns.getIpv6InterfaceAddress(mdns.interfaceName); // getIpv6InterfaceAddress();
      if (ipv6) {
        answers.push({ name: hostName, rtype: DnsRecordType.AAAA, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl, rdata: mdns.encodeAAAA(ipv6) });
      }
    } catch (error) {
      mdns.log.warn(`Error sending mDNS advertisement for matterbridge service AAAA record: ${(error as Error).message}`);
    }

    const response = mdns.sendResponse(answers);
    if (hasParameter('broadcast')) {
      try {
        const address = mdns.socketType === 'udp4' ? mdns.getIpv4InterfaceAddress(mdns.interfaceName) : mdns.getIpv6InterfaceAddress(mdns.interfaceName);
        const mask = mdns.socketType === 'udp4' ? mdns.getNetmask(address as string) : undefined;
        const broadcastAddress = mdns.socketType === 'udp4' ? mdns.getIpv4BroadcastAddress(address, mask) : mdns.getIpv6BroadcastAddress();
        mdns.log.info(`Broadcasting mDNS advertisement for matterbridge service to ${broadcastAddress}...`);
        mdns.socket.send(response, 0, response.length, mdns.multicastPort, broadcastAddress, (error: Error | null) => {
          if (error) {
            mdns.log.error(`Error broadcasting mDNS advertisement: ${error.message}`);
          } else {
            mdns.log.info(`mDNS advertisement broadcasted successfully to ${broadcastAddress}`);
          }
        });
      } catch (error) {
        mdns.log.error(`Error broadcasting mDNS advertisement: ${(error as Error).message}`);
      }
    }
  };

  // Handle Ctrl+C (SIGINT) to stop and log devices
  process.on('SIGINT', async () => {
    await cleanupAndLogAndExit();
  });

  mdnsIpv4.start();
  mdnsIpv4.on('ready', (address: AddressInfo) => {
    mdnsIpv4.log.info(`mdnsIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
    if (hasParameter('advertise')) {
      advertise(mdnsIpv4);
      mdnsIpv4AdvertiseInterval = setInterval(
        () => {
          advertise(mdnsIpv4);
        },
        getIntParameter('advertise') || 10000,
      ).unref();
    }
    if (hasParameter('query')) {
      query(mdnsIpv4);
      mdnsIpv4QueryInterval = setInterval(
        () => {
          query(mdnsIpv4);
        },
        getIntParameter('query') || 10000,
      ).unref();
    }
  });

  mdnsIpv6.start();
  mdnsIpv6.on('ready', (address: AddressInfo) => {
    mdnsIpv6.log.info(`mdnsIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
    if (hasParameter('advertise')) {
      advertise(mdnsIpv6);
      mdnsIpv6AdvertiseInterval = setInterval(
        () => {
          advertise(mdnsIpv6);
        },
        getIntParameter('advertise') || 10000,
      ).unref();
    }
    if (hasParameter('query')) {
      query(mdnsIpv6);
      mdnsIpv6QueryInterval = setInterval(
        () => {
          query(mdnsIpv6);
        },
        getIntParameter('query') || 10000,
      ).unref();
    }
  });

  setTimeout(async () => {
    await cleanupAndLogAndExit();
  }, 600000).unref(); // 10 minutes timeout to exit if no activity
}

/*
  avahi-browse -pr _matterc._udp for advertise
  avahi-browse -pr _matter._tcp for query

  avahi-browse -pr _matterc._udp | sed 's/^/[commissioner] /' &
  avahi-browse -pr _matter._tcp  | sed 's/^/[device]       /' &
  wait

  for advertise
  sudo tcpdump -i eth0 -nn -s0 udp port 5353 | grep _matterc._udp
  for query
  sudo tcpdump -i eth0 -nn -s0 udp port 5353 | grep _matter._tcp
  for matterbridge
  sudo tcpdump -i eth0 -nn -s0 udp port 5353 | grep _matterbridge._tcp

  Example (filter commissioner service on specific Wi-Fi interface):
  mb_mdns --interfaceName "Wi-Fi" --filter _matterc._udp
*/
