/**
 * @file packages/dgram/src/coapMonitor.ts
 * @description This file contains the class CoapMonitor, the coap bin that logs the CoAP multicast traffic.
 * @author Luca Liguori
 * @created 2026-11-24
 * @version 1.0.0
 * @license Apache-2.0
 *
 * Copyright 2026, 2027, 2028 Luca Liguori.
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

import type { AddressInfo } from 'node:net';
import { parseArgs } from 'node:util';

import { getErrorMessage } from '@matterbridge/utils/error';
import { type AnsiLogger, BLUE, LogLevel, nf } from 'node-ansi-logger';

import { Coap, COAP_OPTION_URI_PATH } from './coap.js';
import { COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT } from './multicast.js';

/** Default interval in ms between two CoAP requests when `--request` is enabled without a value. */
export const COAP_MONITOR_DEFAULT_REQUEST_INTERVAL_MS = 10000;
/** Default automatic shutdown timeout in ms (10 minutes). */
export const COAP_MONITOR_DEFAULT_TIMEOUT_MS = 600000;
/** Message ID of the multicast CoAP requests. */
export const COAP_MONITOR_REQUEST_MESSAGE_ID = 32000;
/** URI path segments of the multicast CoAP requests (the CoIoT device description `/cit/d`). */
export const COAP_MONITOR_REQUEST_PATH = ['cit', 'd'] as const;

/**
 * Options for {@link CoapMonitor}.
 */
export interface CoapMonitorOptions {
  /** Network interface name to bind to; omit to listen on all interfaces. */
  interfaceName?: string;
  /** IPv4 address to bind to. Defaults to `0.0.0.0`. */
  ipv4Address?: string;
  /** IPv6 address to bind to. Defaults to `::`. */
  ipv6Address?: string;
  /** Outgoing multicast interface for IPv4: a local IPv4 address of the interface, e.g. `192.168.1.10`. Defaults to the bound address, or the first external IPv4 address. */
  outgoingIpv4Address?: string;
  /** Outgoing multicast interface for IPv6: `::%<interface name>`, or `::%<interface index>` on Windows, e.g. `::%eth0`. Defaults to `::` with the zone of the first external interface. */
  outgoingIpv6Address?: string;
  /** Send a multicast GET request to {@link COAP_MONITOR_REQUEST_PATH} when the sockets are ready. Defaults to false. */
  request?: boolean;
  /** Interval in ms between periodic requests; 0 sends a single request on start. Defaults to {@link COAP_MONITOR_DEFAULT_REQUEST_INTERVAL_MS}. */
  requestIntervalMs?: number;
  /** Enable the IPv4 listener. Defaults to true. */
  enableIpv4?: boolean;
  /** Enable the IPv6 listener. Defaults to true. */
  enableIpv6?: boolean;
  /** Enable multicast loopback on the sockets. Defaults to true. */
  loopback?: boolean;
  /** Automatic stop timeout in ms; 0 disables it. Defaults to {@link COAP_MONITOR_DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Log all network interfaces on start and enable verbose packet logs. Defaults to false. */
  verbose?: boolean;
  /** CoAP UDP port. Defaults to 5683; only tests should change it. */
  coapPort?: number;
}

/**
 * Dual-stack CoAP multicast traffic monitor that logs the incoming messages, optionally sending periodic multicast requests.
 */
export class CoapMonitor {
  /** The enabled CoAP sockets keyed by IP family. */
  readonly sockets: { ipv4?: Coap; ipv6?: Coap } = {};

  private readonly primarySocket: Coap;
  private readonly coapPort: number;
  private readonly interfaceName: string | undefined;
  private readonly ipv4Address: string;
  private readonly ipv6Address: string;
  private readonly outgoingIpv4Address: string | undefined;
  private readonly outgoingIpv6Address: string | undefined;
  private readonly request: boolean;
  private readonly requestIntervalMs: number;
  private readonly loopback: boolean;
  private readonly timeoutMs: number;
  private readonly verbose: boolean;
  private readonly requestIntervals: ReturnType<typeof setInterval>[] = [];
  private timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private stopped = false;

  /**
   * Creates the CoAP monitor without starting its sockets: call {@link CoapMonitor.start}.
   *
   * @param {CoapMonitorOptions} [options] - Configuration overrides.
   * @throws {Error} If both IPv4 and IPv6 are disabled.
   */
  constructor(options: CoapMonitorOptions = {}) {
    const enableIpv4 = options.enableIpv4 !== false;
    const enableIpv6 = options.enableIpv6 !== false;
    if (!enableIpv4 && !enableIpv6) throw new Error('CoapMonitor: IPv4 and IPv6 are both disabled');

    this.coapPort = options.coapPort ?? COAP_MULTICAST_PORT;
    this.interfaceName = options.interfaceName;
    this.ipv4Address = options.ipv4Address ?? '0.0.0.0';
    this.ipv6Address = options.ipv6Address ?? '::';
    this.outgoingIpv4Address = options.outgoingIpv4Address;
    this.outgoingIpv6Address = options.outgoingIpv6Address;
    this.request = options.request ?? false;
    this.requestIntervalMs = options.requestIntervalMs ?? COAP_MONITOR_DEFAULT_REQUEST_INTERVAL_MS;
    this.loopback = options.loopback ?? true;
    this.timeoutMs = options.timeoutMs ?? COAP_MONITOR_DEFAULT_TIMEOUT_MS;
    this.verbose = options.verbose ?? false;

    if (enableIpv4) {
      const ipv4 = new Coap('CoAP Server udp4', COAP_MULTICAST_IPV4_ADDRESS, this.coapPort, 'udp4', true, this.interfaceName, this.ipv4Address, this.outgoingIpv4Address);
      if (this.verbose) ipv4.verbose = true;
      this.sockets.ipv4 = ipv4;
    }

    if (enableIpv6) {
      const ipv6 = new Coap('CoAP Server udp6', COAP_MULTICAST_IPV6_ADDRESS, this.coapPort, 'udp6', true, this.interfaceName, this.ipv6Address, this.outgoingIpv6Address);
      if (this.verbose) ipv6.verbose = true;
      this.sockets.ipv6 = ipv6;
    }

    const primary = this.sockets.ipv4 ?? this.sockets.ipv6;
    /* v8 ignore next - guarded by the check at the start of the constructor */
    if (!primary) throw new Error('CoapMonitor: IPv4 and IPv6 are both disabled');
    this.primarySocket = primary;
  }

  /**
   * Returns the logger of the primary CoAP socket.
   *
   * @returns {AnsiLogger} The socket logger.
   */
  get log(): AnsiLogger {
    return this.primarySocket.log;
  }

  /**
   * Sets the log level on all enabled sockets.
   *
   * @param {LogLevel} level - The log level to apply.
   */
  setLogLevel(level: LogLevel): void {
    if (this.sockets.ipv4) this.sockets.ipv4.log.logLevel = level;
    if (this.sockets.ipv6) this.sockets.ipv6.log.logLevel = level;
  }

  /**
   * Starts the CoAP sockets, periodic requests and automatic timeout.
   * Calling `start()` more than once, or after {@link CoapMonitor.stop}, has no effect.
   */
  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    if (this.verbose) this.primarySocket.listNetworkInterfaces();

    for (const socket of [this.sockets.ipv4, this.sockets.ipv6]) {
      if (!socket) continue;
      socket.on('error', (error) => {
        socket.log.error(`CoAP ${socket.socketType} Server error: ${getErrorMessage(error)}`);
      });
      socket.on('ready', (address: AddressInfo) => {
        if (this.stopped) return;
        if (!this.loopback) {
          socket.socket.setMulticastLoopback(false);
          socket.log.info(`Multicast loopback disabled for ${socket.socketType}`);
        }
        socket.log.info(`CoAP ${socket.socketType} server ready on ${BLUE}${address.family}${nf} ${BLUE}${address.address}${nf}:${BLUE}${address.port}${nf}`);
        if (this.request) {
          this.sendRequest(socket);
          if (this.requestIntervalMs > 0) {
            this.requestIntervals.push(setInterval(() => this.sendRequest(socket), this.requestIntervalMs).unref());
          }
        }
      });
      socket.start();
    }

    if (!this.stopped && this.timeoutMs > 0) {
      this.timeoutTimer = setTimeout(() => this.stop(), this.timeoutMs).unref();
    }
  }

  /**
   * Sends a multicast GET request for {@link COAP_MONITOR_REQUEST_PATH} on the given socket.
   *
   * @param {Coap} socket - The CoAP socket used to send the request.
   */
  sendRequest(socket: Coap): void {
    socket.log.info(`Sending CoAP multicast request for /${COAP_MONITOR_REQUEST_PATH.join('/')}...`);
    try {
      socket.sendRequest(
        COAP_MONITOR_REQUEST_MESSAGE_ID,
        COAP_MONITOR_REQUEST_PATH.map((segment) => ({ number: COAP_OPTION_URI_PATH, value: Buffer.from(segment) })),
        {},
        undefined,
        socket.multicastAddress,
        this.coapPort,
      );
    } catch (error) {
      socket.log.error(`Error sending CoAP request: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Stops the timers and closes the sockets.
   * Calling `stop()` more than once has no effect.
   */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    for (const timer of this.requestIntervals) clearInterval(timer);
    this.requestIntervals.length = 0;
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }

    this.sockets.ipv4?.stop();
    this.sockets.ipv6?.stop();
  }
}

/** The help text of the `coap` bin. */
export const COAP_MONITOR_HELP = `Usage: coap [options]

Listens for CoAP multicast messages over IPv4 and IPv6 and logs all decoded messages.
Stop it with Ctrl+C.

Options:
  --interface <name>               Network interface name to bind to (default: all interfaces)
  --ipv4-address <address>         IPv4 address to bind to (default: 0.0.0.0)
  --ipv6-address <address>         IPv6 address to bind to (default: ::)
  --outgoing-ipv4-address <addr>   Outgoing multicast interface as a local IPv4 address, e.g. 192.168.1.10 (default: first external IPv4 address)
  --outgoing-ipv6-address <addr>   Outgoing multicast interface as ::%<name>, ::%<index> on Windows, e.g. ::%eth0 (default: :: with the zone of the first external interface)
  --request [seconds]              Send a multicast request to /${COAP_MONITOR_REQUEST_PATH.join('/')} every <seconds>, 0 sends once on ready (default: ${COAP_MONITOR_DEFAULT_REQUEST_INTERVAL_MS / 1000}s when omitted)
  --no-ipv4                        Disable IPv4 listener (default: enabled)
  --no-ipv6                        Disable IPv6 listener (default: enabled)
  --no-loopback                    Disable multicast loopback (default: enabled)
  --timeout <seconds>              Automatic shutdown timeout in seconds, 0 disables it (default: ${COAP_MONITOR_DEFAULT_TIMEOUT_MS / 1000}s)
  --no-timeout                     Disable the automatic timeout
  -d, --debug                      Log at debug level
  -v, --verbose                    Log network interfaces and packet trace at debug level
  -s, --silent                     Log only notices, warnings and errors
  -h, --help                       Show this help

Examples:
  coap --interface eth0
  coap --request
  coap --request 5 --no-ipv6
`;

/**
 * Prints a command line error and sets exit code 2.
 *
 * @param {string} message - The error message.
 * @returns {undefined} Nothing, so callers can return early.
 */
function commandLineError(message: string): undefined {
  // oxlint-disable-next-line no-console
  console.error(`coap: ${message}\nRun coap --help to see the options.`);
  process.exitCode = 2;
}

/**
 * Runs the CoAP monitor from a terminal until SIGINT, SIGTERM or timeout.
 * It is the `coap` bin: see {@link COAP_MONITOR_HELP} for the options.
 *
 * @param {string[]} argv - The arguments after the script name.
 * @param {CoapMonitorOptions} [options] - Extra options, used by the tests.
 * @returns {CoapMonitor | undefined} The running monitor, or undefined after `--help` or a command line error.
 */
export function runCoapMonitor(argv: string[], options: CoapMonitorOptions = {}): CoapMonitor | undefined {
  // parseArgs() has no options with an optional value: extract the seconds of --request first
  const args: string[] = [];
  let requestSeconds: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--request=')) requestSeconds = arg.slice('--request='.length);
    else if (arg === '--request' && index + 1 < argv.length && !argv[index + 1].startsWith('-')) requestSeconds = argv[++index];
    args.push(arg.startsWith('--request=') ? '--request' : arg);
  }
  const config = {
    args,
    options: {
      'interface': { type: 'string' },
      'ipv4-address': { type: 'string' },
      'ipv6-address': { type: 'string' },
      'outgoing-ipv4-address': { type: 'string' },
      'outgoing-ipv6-address': { type: 'string' },
      'request': { type: 'boolean' },
      'no-ipv4': { type: 'boolean' },
      'no-ipv6': { type: 'boolean' },
      'no-loopback': { type: 'boolean' },
      'timeout': { type: 'string' },
      'no-timeout': { type: 'boolean' },
      'debug': { type: 'boolean', short: 'd' },
      'verbose': { type: 'boolean', short: 'v' },
      'silent': { type: 'boolean', short: 's' },
      'help': { type: 'boolean', short: 'h' },
    },
  } as const;
  let values: ReturnType<typeof parseArgs<typeof config>>['values'];
  try {
    ({ values } = parseArgs(config));
  } catch (error) {
    return commandLineError(getErrorMessage(error));
  }
  if (values.help) {
    // oxlint-disable-next-line no-console
    console.log(COAP_MONITOR_HELP);
    return undefined;
  }
  const requestInterval = requestSeconds === undefined ? undefined : Number(requestSeconds);
  if (requestInterval !== undefined && (requestSeconds === '' || !Number.isFinite(requestInterval) || requestInterval < 0))
    return commandLineError(`invalid --request ${requestSeconds}`);
  const timeout = values.timeout === undefined ? undefined : Number(values.timeout);
  if (timeout !== undefined && (values.timeout === '' || !Number.isFinite(timeout) || timeout < 0)) return commandLineError(`invalid --timeout ${values.timeout}`);

  let monitor: CoapMonitor;
  try {
    monitor = new CoapMonitor({
      interfaceName: values.interface,
      ipv4Address: values['ipv4-address'],
      ipv6Address: values['ipv6-address'],
      outgoingIpv4Address: values['outgoing-ipv4-address'],
      outgoingIpv6Address: values['outgoing-ipv6-address'],
      request: values.request === true,
      requestIntervalMs: requestInterval === undefined ? undefined : requestInterval * 1000,
      enableIpv4: values['no-ipv4'] !== true,
      enableIpv6: values['no-ipv6'] !== true,
      loopback: values['no-loopback'] !== true,
      timeoutMs: values['no-timeout'] === true ? 0 : timeout === undefined ? undefined : timeout * 1000,
      verbose: values.verbose === true,
      ...options,
    });
  } catch (error) {
    return commandLineError(getErrorMessage(error));
  }
  if (values.debug === true || values.verbose === true) monitor.setLogLevel(LogLevel.DEBUG);
  else if (values.silent === true) monitor.setLogLevel(LogLevel.NOTICE);
  const shutdown = (): void => monitor.stop();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  monitor.start();
  return monitor;
}
