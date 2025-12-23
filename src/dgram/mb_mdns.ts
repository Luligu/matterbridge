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
import { DnsClass, DnsRecordType, Mdns } from './mdns.js';

// istanbul ignore next
{
  if (hasParameter('h') || hasParameter('help')) {
    // eslint-disable-next-line no-console
    console.log(`Usage: mb_mdns [options]

Options:
  -h, --help                                Show this help message and exit.
  --interfaceName <name>                    Network interface name to bind to (default all interfaces).
  --ipv4InterfaceAddress <address>          IPv4 address of the network interface to bind to (default: 0.0.0.0).
  --ipv6InterfaceAddress <address>          IPv6 address of the network interface to bind to (default: ::).
  --outgoingIpv4InterfaceAddress <address>  Outgoing IPv4 address (default first external address).
  --outgoingIpv6InterfaceAddress <address>  Outgoing IPv6 address (default first external address).
  --advertise <interval>                    Enable mDNS advertisement each ms (default interval: 10000ms).
  --query <interval>                        Enable mDNS query each ms (default interval: 10000ms).
  --filter <string>                         Filter string to match in the mDNS record name (can be repeated).
  -v, --verbose                             Enable verbose logging (default: disabled).

Examples:
  # List Matter device commissioner service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matterc._udp

  # List Matter device service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matter._tcp

  # List both Matter commissioner and device service records only on eth0 interface
  mb_mdns --interfaceName eth0 --filter _matterc._udp _matter._tcp

  # Query for mDNS devices every 10s on a specific interface
  mb_mdns --interfaceName eth0 --query

  # Advertise matterbridge._http._tcp.local every 5s with filter
  mb_mdns --advertise 5000 --filter matterbridge._http._tcp.local

  # Listen for matterbridge._http._tcp.local service recordsq
  mb_mdns --filter matterbridge._http._tcp.local
`);
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  const mdnsIpv4 = new Mdns('mDNS Server udp4', MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_PORT, 'udp4', true, getParameter('interfaceName'), getParameter('ipv4InterfaceAddress') || '0.0.0.0', getParameter('outgoingIpv4InterfaceAddress'));
  const mdnsIpv6 = new Mdns('mDNS Server udp6', MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT, 'udp6', true, getParameter('interfaceName'), getParameter('ipv6InterfaceAddress') || '::', getParameter('outgoingIpv6InterfaceAddress'));
  if (hasParameter('v') || hasParameter('verbose')) {
    mdnsIpv4.log.logLevel = LogLevel.DEBUG;
    mdnsIpv6.log.logLevel = LogLevel.DEBUG;
  } else {
    mdnsIpv4.log.logLevel = LogLevel.INFO;
    mdnsIpv6.log.logLevel = LogLevel.INFO;
  }

  mdnsIpv4.listNetworkInterfaces();

  const filters = getStringArrayParameter('filter');
  if (filters) {
    mdnsIpv4.filters.push(...filters);
    mdnsIpv6.filters.push(...filters);
  }
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
    mdnsIpv4.log.info('Sending mDNS query for services...');
    mdnsIpv4.sendQuery([
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
      { name: '_http._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
      { name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: false },
    ]);
  };

  /**
   * Sends an mDNS advertisement for the HTTP service over UDP IPv4.
   */
  const advertiseUdp4 = () => {
    mdnsIpv4.log.info('Sending mDNS advertisement for matterbridge service...');
    const ptrRdata = mdnsIpv4.encodeDnsName('matterbridge._http._tcp.local');
    mdnsIpv4.sendResponse('_http._tcp.local', DnsRecordType.PTR, DnsClass.IN, 120, ptrRdata);
  };

  /**
   *  Queries mDNS services over UDP IPv6 and sends a response for a specific service instance.
   *  This function sends a query for Shelly, HTTP, and services, and responds with the appropriate PTR records.
   */
  const queryUdp6 = () => {
    mdnsIpv6.log.info('Sending mDNS query for services...');
    mdnsIpv6.sendQuery([
      { name: '_matter._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_shelly._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_http._tcp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
      { name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse: true },
    ]);
  };

  /**
   * Sends an mDNS advertisement for the HTTP service over UDP IPv6.
   */
  const advertiseUdp6 = () => {
    mdnsIpv6.log.info('Sending mDNS advertisement for matterbridge service...');
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
    if (hasParameter('advertise')) {
      advertiseUdp4();
      setInterval(
        () => {
          advertiseUdp4();
        },
        getIntParameter('advertise') || 10000,
      ).unref();
    }
    if (hasParameter('query')) {
      queryUdp4();
      setInterval(
        () => {
          queryUdp4();
        },
        getIntParameter('query') || 10000,
      ).unref();
    }
  });

  mdnsIpv6.start();
  mdnsIpv6.on('ready', (address: AddressInfo) => {
    mdnsIpv6.log.info(`mdnsIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
    if (hasParameter('advertise')) {
      advertiseUdp6();
      setInterval(
        () => {
          advertiseUdp6();
        },
        getIntParameter('advertise') || 10000,
      ).unref();
    }
    if (hasParameter('query')) {
      queryUdp6();
      setInterval(
        () => {
          queryUdp6();
        },
        getIntParameter('query') || 10000,
      ).unref();
    }
  });

  setTimeout(() => {
    cleanupAndLogAndExit();
  }, 600000); // 10 minutes timeout to exit if no activity
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
  sudo tcpdump -i eth0 -nn -s0 udp port 5353 | grep matterbridge._http._tcp.local

  Example (filter commissioner service on specific Wi-Fi interface):
  mb_mdns --interfaceName "Wi-Fi" --filter _matterc._udp
*/
