/**
 * @description This file contains the bin mb_coap for the class Coap.
 * @file src/dgram/mb_coap.ts
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

// @matterbridge
import { Coap, COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, COAP_OPTION_URI_PATH } from '@matterbridge/dgram';
import { getIntParameter, getParameter, hasParameter } from '@matterbridge/utils/cli';

// istanbul ignore next
{
  if (hasParameter('h') || hasParameter('help')) {
    // eslint-disable-next-line no-console
    console.log(`Copyright (c) Matterbridge. All rights reserved. Version 1.0.0.\n`);
    // eslint-disable-next-line no-console
    console.log(`Usage: mb_coap [options...]

If no command line is provided, mb_coap starts IPv4 and IPv6 CoAP multicast listeners and waits for incoming traffic for up to 10 minutes.

Options:
  -h, --help                 Show this help message and exit.
  --request <interval>       Send a multicast CoAP request to /cit/d (default interval: 10000ms).
  --interfaceName <name>     Network interface name to bind to (default all interfaces).
  --ipv4InterfaceAddress <address>  IPv4 address of the network interface to bind to (default: 0.0.0.0).
  --ipv6InterfaceAddress <address>  IPv6 address of the network interface to bind to (default: ::).
  --no-loopback              Disable multicast loopback (default: enabled).
  --noIpv4                   Disable IPv4 CoAP server (default: enabled).
  --noIpv6                   Disable IPv6 CoAP server (default: enabled).
  --no-timeout               Disable automatic timeout of 10 minutes.
  -d, --debug                Enable debug logging (default: disabled).
  -v, --verbose              Enable verbose logging (default: disabled).
  -s, --silent               Enable silent mode, only log notices, warnings and errors.

Examples:
  # Start IPv4 and IPv6 CoAP listeners and wait for incoming traffic
  mb_coap

  # Start listeners and send multicast CoAP requests every 10 seconds
  mb_coap --request

  # Start listeners and send multicast CoAP requests every 5 seconds
  mb_coap --request 5000

  # Start listeners only on the eth0 interface
  mb_coap --interfaceName eth0

  # Start listeners with verbose logging enabled
  mb_coap --verbose

  # Start only the IPv4 listener and send multicast CoAP requests every 10 seconds
  mb_coap --request --noIpv6
`);
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  let coapIpv4: Coap | undefined;
  let coapIpv6: Coap | undefined;
  const interfaceName = getParameter('interfaceName');
  const ipv4InterfaceAddress = getParameter('ipv4InterfaceAddress') || '0.0.0.0';
  const ipv6InterfaceAddress = getParameter('ipv6InterfaceAddress') || '::';

  if (!hasParameter('noIpv4')) {
    coapIpv4 = new Coap('CoAP Server udp4', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true, interfaceName, ipv4InterfaceAddress);
    if (hasParameter('v') || hasParameter('verbose')) coapIpv4.listNetworkInterfaces();
  }

  if (!hasParameter('noIpv6')) {
    coapIpv6 = new Coap('CoAP Server udp6', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, interfaceName, ipv6InterfaceAddress);
    if (hasParameter('noIpv4') && (hasParameter('v') || hasParameter('verbose'))) coapIpv6.listNetworkInterfaces();
  }

  /**
   * Cleanup and log device information before exiting.
   */
  function cleanupAndLogAndExit() {
    coapIpv4?.stop();
    coapIpv6?.stop();
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  /**
   *  Queries mDNS services over UDP IPv4 and sends a response for a specific service instance.
   *  This function sends a query for Shelly, HTTP, and services, and responds with the appropriate PTR records.
   */
  const requestUdp4 = () => {
    if (!coapIpv4) return;
    coapIpv4.sendRequest(
      32000,
      [
        { number: COAP_OPTION_URI_PATH, value: Buffer.from('cit') },
        { number: COAP_OPTION_URI_PATH, value: Buffer.from('d') },
      ],
      {},
      undefined,
      COAP_MULTICAST_IPV4_ADDRESS,
      COAP_MULTICAST_PORT,
    );
  };

  /**
   *  Queries mDNS services over UDP IPv4 and sends a response for a specific service instance.
   *  This function sends a query for Shelly, HTTP, and services, and responds with the appropriate PTR records.
   */
  const requestUdp6 = () => {
    if (!coapIpv6) return;
    coapIpv6.sendRequest(
      32000,
      [
        { number: COAP_OPTION_URI_PATH, value: Buffer.from('cit') },
        { number: COAP_OPTION_URI_PATH, value: Buffer.from('d') },
      ],
      {},
      undefined,
      COAP_MULTICAST_IPV6_ADDRESS,
      COAP_MULTICAST_PORT,
    );
  };

  // Handle Ctrl+C (SIGINT) to stop and log devices
  process.on('SIGINT', () => {
    cleanupAndLogAndExit();
  });

  if (coapIpv4) {
    coapIpv4.start();
    coapIpv4.on('ready', (address: AddressInfo) => {
      if (hasParameter('no-loopback')) {
        coapIpv4?.socket.setMulticastLoopback(false);
        coapIpv4?.log.info('Multicast loopback disabled for coapIpv4');
      }
      coapIpv4?.log.info(`coapIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
      if (!hasParameter('request')) return; // Skip querying if --request is not specified
      requestUdp4();
      setInterval(
        () => {
          requestUdp4();
        },
        getIntParameter('request') || 10000,
      ).unref();
    });
  }

  if (coapIpv6) {
    coapIpv6.start();
    coapIpv6.on('ready', (address: AddressInfo) => {
      if (hasParameter('no-loopback')) {
        coapIpv6?.socket.setMulticastLoopback(false);
        coapIpv6?.log.info('Multicast loopback disabled for coapIpv6');
      }
      coapIpv6?.log.info(`coapIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
      if (!hasParameter('request')) return; // Skip querying if --request is not specified
      requestUdp6();
      setInterval(
        () => {
          requestUdp6();
        },
        getIntParameter('request') || 10000,
      ).unref();
    });
  }

  if (!hasParameter('no-timeout')) {
    setTimeout(() => {
      cleanupAndLogAndExit();
    }, 600000); // 10 minutes timeout to exit if no activity
  }
}
