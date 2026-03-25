/**
 * @description This file contains the bin mb_coap for the class Coap.
 * @file packages/core/src/mb_coap.ts
 * @author Luca Liguori
 * @created 2025-07-22
 * @version 2.0.0
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

import { AddressInfo } from 'node:net';

import { Coap, COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, COAP_OPTION_URI_PATH } from '@matterbridge/dgram';
import { getIntParameter, getParameter, hasParameter } from '@matterbridge/utils/cli';

export const MB_COAP_DEFAULT_REQUEST_INTERVAL_MS = 10000;
export const MB_COAP_DEFAULT_TIMEOUT_MS = 600000;

export interface MbCoapOptions {
  showHelp: boolean;
  requestIntervalMs?: number;
  interfaceName?: string;
  ipv4InterfaceAddress: string;
  ipv6InterfaceAddress: string;
  disableLoopback: boolean;
  disableIpv4: boolean;
  disableIpv6: boolean;
  disableTimeout: boolean;
}

export interface MbCoapRuntime {
  coapIpv4?: Coap;
  coapIpv6?: Coap;
  cleanupAndLogAndExit: () => void;
}

/**
 * Logs CLI output with the default console logger.
 *
 * @param {string} message The message to print.
 */
function defaultConsoleLog(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message);
}

/**
 * Returns the help text for the `mb_coap` CLI.
 *
 * @returns {string} The full help text.
 */
export function getMbCoapHelpText(): string {
  return `Copyright (c) Matterbridge. All rights reserved. Version 2.0.0.

Usage: mb_coap [options...]

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

`;
}

/**
 * Prints the `mb_coap` help text.
 *
 * @param {(message: string) => void} log The logger used to print the help text.
 */
export function printMbCoapHelp(log: (message: string) => void = defaultConsoleLog): void {
  log(getMbCoapHelpText());
}

/**
 * Parses CLI arguments into `mb_coap` runtime options.
 *
 * @returns {MbCoapOptions} The parsed CLI options.
 */
export function getMbCoapOptions(): MbCoapOptions {
  const requestIntervalMs = hasParameter('request') ? getIntParameter('request') || MB_COAP_DEFAULT_REQUEST_INTERVAL_MS : undefined;

  return {
    showHelp: hasParameter('h') || hasParameter('help'),
    requestIntervalMs,
    interfaceName: getParameter('interfaceName'),
    ipv4InterfaceAddress: getParameter('ipv4InterfaceAddress') || '0.0.0.0',
    ipv6InterfaceAddress: getParameter('ipv6InterfaceAddress') || '::',
    disableLoopback: hasParameter('no-loopback'),
    disableIpv4: hasParameter('noIpv4'),
    disableIpv6: hasParameter('noIpv6'),
    disableTimeout: hasParameter('no-timeout'),
  };
}

/**
 * Starts the IPv4 and IPv6 CoAP listeners according to the provided options.
 *
 * @param {MbCoapOptions} options The CLI options.
 * @param {(code: number) => never | void} exitFn Exit function used during cleanup.
 * @param {boolean} registerSignalHandlers Whether to register process signal handlers.
 * @returns {MbCoapRuntime} The running CoAP resources and cleanup function.
 */
export function startMbCoap(options: MbCoapOptions, exitFn: (code: number) => never | void = process.exit, registerSignalHandlers: boolean = true): MbCoapRuntime {
  let coapIpv4: Coap | undefined;
  let coapIpv6: Coap | undefined;

  if (!options.disableIpv4) {
    coapIpv4 = new Coap('CoAP Server udp4', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true, options.interfaceName, options.ipv4InterfaceAddress);
    if (hasParameter('v') || hasParameter('verbose')) coapIpv4.listNetworkInterfaces();
  }

  if (!options.disableIpv6) {
    coapIpv6 = new Coap('CoAP Server udp6', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, options.interfaceName, options.ipv6InterfaceAddress);
    if (options.disableIpv4 && (hasParameter('v') || hasParameter('verbose'))) coapIpv6.listNetworkInterfaces();
  }

  /**
   * Stops active CoAP servers and exits the process.
   */
  function cleanupAndLogAndExit(): void {
    coapIpv4?.stop();
    coapIpv6?.stop();
    exitFn(0);
  }

  const requestUdp4 = () => {
    coapIpv4?.sendRequest(
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

  const requestUdp6 = () => {
    coapIpv6?.sendRequest(
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

  if (registerSignalHandlers) {
    process.on('SIGINT', () => {
      cleanupAndLogAndExit();
    });
  }

  if (coapIpv4) {
    coapIpv4.start();
    coapIpv4.on('ready', (address: AddressInfo) => {
      if (options.disableLoopback) {
        coapIpv4.socket.setMulticastLoopback(false);
        coapIpv4.log.info('Multicast loopback disabled for coapIpv4');
      }
      coapIpv4.log.info(`coapIpv4 server ready on ${address.family} ${address.address}:${address.port}`);
      if (options.requestIntervalMs === undefined) return;
      requestUdp4();
      setInterval(() => {
        requestUdp4();
      }, options.requestIntervalMs).unref();
    });
  }

  if (coapIpv6) {
    coapIpv6.start();
    coapIpv6.on('ready', (address: AddressInfo) => {
      if (options.disableLoopback) {
        coapIpv6.socket.setMulticastLoopback(false);
        coapIpv6.log.info('Multicast loopback disabled for coapIpv6');
      }
      coapIpv6.log.info(`coapIpv6 server ready on ${address.family} ${address.address}:${address.port}`);
      if (options.requestIntervalMs === undefined) return;
      requestUdp6();
      setInterval(() => {
        requestUdp6();
      }, options.requestIntervalMs).unref();
    });
  }

  if (!options.disableTimeout) {
    setTimeout(() => {
      cleanupAndLogAndExit();
    }, MB_COAP_DEFAULT_TIMEOUT_MS).unref();
  }

  return {
    coapIpv4,
    coapIpv6,
    cleanupAndLogAndExit,
  };
}

/**
 * CLI entrypoint for `mb_coap`.
 *
 * @param {(code: number) => never | void} exitFn Exit function used when help is requested.
 * @param {(message: string) => void} log The logger used to print help text.
 * @returns {MbCoapRuntime | undefined} The running runtime, or `undefined` when exiting after help.
 */
export function mbCoapMain(exitFn: (code: number) => never | void = process.exit, log: (message: string) => void = defaultConsoleLog): MbCoapRuntime | undefined {
  const options = getMbCoapOptions();

  if (options.showHelp) {
    printMbCoapHelp(log);
    exitFn(0);
    return;
  }

  return startMbCoap(options, exitFn);
}
