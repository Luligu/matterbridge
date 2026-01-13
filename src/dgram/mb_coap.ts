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

// Net imports
import { COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, Coap, COAP_OPTION_URI_PATH } from '@matterbridge/dgram';

// istanbul ignore next
{
  const coapIpv4 = new Coap('CoAP Server udp4', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true);
  const coapIpv6 = new Coap('CoAP Server udp6', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true);
  coapIpv4.listNetworkInterfaces();

  /**
   * Cleanup and log device information before exiting.
   */
  function cleanupAndLogAndExit() {
    if (process.argv.includes('--coap-udp4')) coapIpv4.stop();
    if (process.argv.includes('--coap-udp6')) coapIpv6.stop();
    // eslint-disable-next-line n/no-process-exit
    process.exit(0);
  }

  /**
   *  Queries mDNS services over UDP IPv4 and sends a response for a specific service instance.
   *  This function sends a query for Shelly, HTTP, and services, and responds with the appropriate PTR records.
   */
  const requestUdp4 = () => {
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

  coapIpv4.start();
  coapIpv4.on('ready', (address: AddressInfo) => {
    coapIpv4.log.info(`coapIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
    if (!process.argv.includes('--coap-request')) return; // Skip querying if --coap-request is not specified
    requestUdp4();
    setInterval(() => {
      requestUdp4();
    }, 10000).unref();
  });

  coapIpv6.start();
  coapIpv6.on('ready', (address: AddressInfo) => {
    coapIpv6.log.info(`coapIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
    if (!process.argv.includes('--coap-request')) return; // Skip querying if --coap-request is not specified
    requestUdp6();
    setInterval(() => {
      requestUdp6();
    }, 10000).unref();
  });

  setTimeout(() => {
    cleanupAndLogAndExit();
  }, 600000); // 10 minutes timeout to exit if no activity
}
