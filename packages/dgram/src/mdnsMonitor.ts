/**
 * @file packages/dgram/src/mdnsMonitor.ts
 * @description This file contains the class MdnsMonitor, the mdns bin that logs the mDNS traffic.
 * @author Luca Liguori
 * @created 2026-11-23
 * @version 1.0.1
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

import { DnsClass, DnsRecordType, Mdns } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';

/** Default interval in ms between two mDNS queries when `--query` is enabled without a value. */
export const MDNS_MONITOR_DEFAULT_QUERY_INTERVAL_MS = 10000;
/** Default automatic shutdown timeout in ms (10 minutes). */
export const MDNS_MONITOR_DEFAULT_TIMEOUT_MS = 600000;

/** Common DNS-SD service names queried when `--query` is enabled. */
export const MDNS_MONITOR_QUERY_SERVICES = [
  '_matterc._udp.local',
  '_matter._tcp.local',
  '_matterbridge._tcp.local',
  '_home-assistant._tcp.local',
  '_shelly._tcp.local',
  '_mqtt._tcp.local',
  '_http._tcp.local',
  '_googlecast._tcp.local',
  '_airplay._tcp.local',
  '_amzn-alexa._tcp.local',
  '_companion-link._tcp.local',
  '_hap._tcp.local',
  '_hap._udp.local',
  '_ipp._tcp.local',
  '_ipps._tcp.local',
  '_meshcop._tcp.local',
  '_printer._tcp.local',
  '_raop._tcp.local',
  '_sleep-proxy._tcp.local',
  '_ssh._tcp.local',
  '_services._dns-sd._udp.local',
] as const;

/**
 * Options for {@link MdnsMonitor}.
 */
export interface MdnsMonitorOptions {
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
  /** Send PTR queries for {@link MDNS_MONITOR_QUERY_SERVICES} when the sockets are ready. Defaults to false. */
  query?: boolean;
  /** Interval in ms between periodic queries; 0 sends a single query on start. Defaults to {@link MDNS_MONITOR_DEFAULT_QUERY_INTERVAL_MS}. */
  queryIntervalMs?: number;
  /** Request unicast responses (`QU`) in outgoing queries. Defaults to false. */
  unicast?: boolean;
  /** Substrings matched against the mDNS record name or text. */
  filters?: string[];
  /** Substrings matched against the sender IP address. */
  ipFilters?: string[];
  /** Enable the IPv4 listener. Defaults to true. */
  enableIpv4?: boolean;
  /** Enable the IPv6 listener. Defaults to true. */
  enableIpv6?: boolean;
  /** Enable multicast loopback on the sockets. Defaults to true. */
  loopback?: boolean;
  /** Automatic stop timeout in ms; 0 disables it. Defaults to {@link MDNS_MONITOR_DEFAULT_TIMEOUT_MS}. */
  timeoutMs?: number;
  /** Log all network interfaces on start and enable verbose packet logs. Defaults to false. */
  verbose?: boolean;
  /** mDNS UDP port. Defaults to 5353; only tests should change it. */
  mdnsPort?: number;
}

/**
 * Dual-stack mDNS traffic monitor that logs incoming queries and responses, optionally sending periodic DNS-SD queries.
 */
export class MdnsMonitor {
  /** The enabled mDNS sockets keyed by IP family. */
  readonly sockets: { ipv4?: Mdns; ipv6?: Mdns } = {};

  private readonly primarySocket: Mdns;
  private readonly mdnsPort: number;
  private readonly interfaceName: string | undefined;
  private readonly ipv4Address: string;
  private readonly ipv6Address: string;
  private readonly outgoingIpv4Address: string | undefined;
  private readonly outgoingIpv6Address: string | undefined;
  private readonly query: boolean;
  private readonly queryIntervalMs: number;
  private readonly unicast: boolean;
  private readonly filters: string[];
  private readonly ipFilters: string[];
  private readonly loopback: boolean;
  private readonly timeoutMs: number;
  private readonly verbose: boolean;
  private readonly queryIntervals: ReturnType<typeof setInterval>[] = [];
  private timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private started = false;
  private stopped = false;

  /**
   * Creates the mDNS monitor without starting its sockets: call {@link MdnsMonitor.start}.
   *
   * @param {MdnsMonitorOptions} [options] - Configuration overrides.
   * @throws {Error} If both IPv4 and IPv6 are disabled.
   */
  constructor(options: MdnsMonitorOptions = {}) {
    const enableIpv4 = options.enableIpv4 !== false;
    const enableIpv6 = options.enableIpv6 !== false;
    if (!enableIpv4 && !enableIpv6) throw new Error('MdnsMonitor: IPv4 and IPv6 are both disabled');

    this.mdnsPort = options.mdnsPort ?? MDNS_MULTICAST_PORT;
    this.interfaceName = options.interfaceName;
    this.ipv4Address = options.ipv4Address ?? '0.0.0.0';
    this.ipv6Address = options.ipv6Address ?? '::';
    this.outgoingIpv4Address = options.outgoingIpv4Address;
    this.outgoingIpv6Address = options.outgoingIpv6Address;
    this.query = options.query ?? false;
    this.queryIntervalMs = options.queryIntervalMs ?? MDNS_MONITOR_DEFAULT_QUERY_INTERVAL_MS;
    this.unicast = options.unicast ?? false;
    this.filters = options.filters ? [...options.filters] : [];
    this.ipFilters = options.ipFilters ? [...options.ipFilters] : [];
    this.loopback = options.loopback ?? true;
    this.timeoutMs = options.timeoutMs ?? MDNS_MONITOR_DEFAULT_TIMEOUT_MS;
    this.verbose = options.verbose ?? false;

    if (enableIpv4) {
      const ipv4 = new Mdns('mDNS Server udp4', MDNS_MULTICAST_IPV4_ADDRESS, this.mdnsPort, 'udp4', true, this.interfaceName, this.ipv4Address, this.outgoingIpv4Address);
      if (this.filters.length > 0) ipv4.filters.push(...this.filters);
      if (this.ipFilters.length > 0) ipv4.ipFilters.push(...this.ipFilters);
      if (this.verbose) ipv4.verbose = true;
      this.sockets.ipv4 = ipv4;
    }

    if (enableIpv6) {
      const ipv6 = new Mdns('mDNS Server udp6', MDNS_MULTICAST_IPV6_ADDRESS, this.mdnsPort, 'udp6', true, this.interfaceName, this.ipv6Address, this.outgoingIpv6Address);
      if (this.filters.length > 0) ipv6.filters.push(...this.filters);
      if (this.ipFilters.length > 0) ipv6.ipFilters.push(...this.ipFilters);
      if (this.verbose) ipv6.verbose = true;
      this.sockets.ipv6 = ipv6;
    }

    const primary = this.sockets.ipv4 ?? this.sockets.ipv6;
    /* v8 ignore next - guarded by the check at the start of the constructor */
    if (!primary) throw new Error('MdnsMonitor: IPv4 and IPv6 are both disabled');
    this.primarySocket = primary;
  }

  /**
   * Returns the logger of the primary mDNS socket.
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
   * Starts the mDNS sockets, periodic queries and automatic timeout.
   * Calling `start()` more than once, or after {@link MdnsMonitor.stop}, has no effect.
   */
  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    if (this.verbose) this.primarySocket.listNetworkInterfaces();

    for (const socket of [this.sockets.ipv4, this.sockets.ipv6]) {
      if (!socket) continue;
      socket.on('error', (error) => {
        socket.log.error(`mDNS ${socket.socketType} Server error: ${getErrorMessage(error)}`);
      });
      socket.on('ready', (address: AddressInfo) => {
        if (this.stopped) return;
        if (!this.loopback) {
          socket.socket.setMulticastLoopback(false);
          socket.log.info(`Multicast loopback disabled for ${socket.socketType}`);
        }
        socket.log.info(`mDNS ${socket.socketType} server ready on ${BLUE}${address.family}${nf} ${BLUE}${address.address}${nf}:${BLUE}${address.port}${nf}`);
        if (this.query) {
          this.sendQuery(socket);
          if (this.queryIntervalMs > 0) {
            this.queryIntervals.push(setInterval(() => this.sendQuery(socket), this.queryIntervalMs).unref());
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
   * Sends a PTR query for {@link MDNS_MONITOR_QUERY_SERVICES} on the given socket.
   *
   * @param {Mdns} socket - The mDNS socket used to send the query.
   */
  sendQuery(socket: Mdns): void {
    socket.log.info('Sending mDNS query for common services...');
    try {
      socket.sendQuery(
        MDNS_MONITOR_QUERY_SERVICES.map((name) => ({
          name,
          type: DnsRecordType.PTR,
          class: DnsClass.IN,
          unicastResponse: this.unicast,
        })),
      );
    } catch (error) {
      socket.log.error(`Error sending mDNS query: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Stops the timers, closes the sockets and logs the discovered devices.
   * Calling `stop()` more than once has no effect.
   */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    for (const timer of this.queryIntervals) clearInterval(timer);
    this.queryIntervals.length = 0;
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = undefined;
    }

    this.sockets.ipv4?.stop();
    this.sockets.ipv6?.stop();
    this.sockets.ipv4?.logDevices();
    this.sockets.ipv6?.logDevices();
  }
}

/** The help text of the `mdns` bin. */
export const MDNS_MONITOR_HELP = `Usage: mdns [options]

Listens for mDNS queries and responses over IPv4 and IPv6 and logs all decoded messages.
Stop it with Ctrl+C to log the discovered devices summary.

Options:
  --interface <name>               Network interface name to bind to (default: all interfaces)
  --ipv4-address <address>         IPv4 address to bind to (default: 0.0.0.0)
  --ipv6-address <address>         IPv6 address to bind to (default: ::)
  --outgoing-ipv4-address <addr>   Outgoing multicast interface as a local IPv4 address, e.g. 192.168.1.10 (default: first external IPv4 address)
  --outgoing-ipv6-address <addr>   Outgoing multicast interface as ::%<name>, ::%<index> on Windows, e.g. ::%eth0 (default: :: with the zone of the first external interface)
  --query [seconds]                Send queries for common services every <seconds>, 0 sends once on ready (default: ${MDNS_MONITOR_DEFAULT_QUERY_INTERVAL_MS / 1000}s when omitted)
  --unicast                        Request unicast responses in outgoing queries (default: disabled)
  --filter <string>                Filter mDNS record name or text; repeat for multiple filters (default: no filter)
  --ip-filter <address>            Filter sender IP address; repeat for multiple filters (default: no filter)
  --no-ipv4                        Disable IPv4 listener (default: enabled)
  --no-ipv6                        Disable IPv6 listener (default: enabled)
  --no-loopback                    Disable multicast loopback (default: enabled)
  --timeout <seconds>              Automatic shutdown timeout in seconds, 0 disables it (default: ${MDNS_MONITOR_DEFAULT_TIMEOUT_MS / 1000}s)
  --no-timeout                     Disable the automatic timeout
  -d, --debug                      Log at debug level
  -v, --verbose                    Log network interfaces and packet trace at debug level
  -s, --silent                     Log only notices, warnings and errors
  -h, --help                       Show this help

Examples:
  mdns --interface eth0 --filter _matterc._udp
  mdns --filter _matterc._udp --filter _matter._tcp --ip-filter 192.168.1.20
  mdns --query
  mdns --query 5 --filter _matterbridge._tcp.local
`;

/**
 * Prints a command line error and sets exit code 2.
 *
 * @param {string} message - The error message.
 * @returns {undefined} Nothing, so callers can return early.
 */
function commandLineError(message: string): undefined {
  // oxlint-disable-next-line no-console
  console.error(`mdns: ${message}\nRun mdns --help to see the options.`);
  process.exitCode = 2;
}

/**
 * Runs the mDNS monitor from a terminal until SIGINT, SIGTERM or timeout, then logs the devices summary.
 * It is the `mdns` bin: see {@link MDNS_MONITOR_HELP} for the options.
 *
 * @param {string[]} argv - The arguments after the script name.
 * @param {MdnsMonitorOptions} [options] - Extra options, used by the tests.
 * @returns {MdnsMonitor | undefined} The running monitor, or undefined after `--help` or a command line error.
 */
export function runMdnsMonitor(argv: string[], options: MdnsMonitorOptions = {}): MdnsMonitor | undefined {
  // parseArgs() has no options with an optional value: extract the seconds of --query first
  const args: string[] = [];
  let querySeconds: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--query=')) querySeconds = arg.slice('--query='.length);
    else if (arg === '--query' && index + 1 < argv.length && !argv[index + 1].startsWith('-')) querySeconds = argv[++index];
    args.push(arg.startsWith('--query=') ? '--query' : arg);
  }
  const config = {
    args,
    options: {
      'interface': { type: 'string' },
      'ipv4-address': { type: 'string' },
      'ipv6-address': { type: 'string' },
      'outgoing-ipv4-address': { type: 'string' },
      'outgoing-ipv6-address': { type: 'string' },
      'query': { type: 'boolean' },
      'unicast': { type: 'boolean' },
      'filter': { type: 'string', multiple: true },
      'ip-filter': { type: 'string', multiple: true },
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
    console.log(MDNS_MONITOR_HELP);
    return undefined;
  }
  const queryInterval = querySeconds === undefined ? undefined : Number(querySeconds);
  if (queryInterval !== undefined && (querySeconds === '' || !Number.isFinite(queryInterval) || queryInterval < 0)) return commandLineError(`invalid --query ${querySeconds}`);
  const timeout = values.timeout === undefined ? undefined : Number(values.timeout);
  if (timeout !== undefined && (values.timeout === '' || !Number.isFinite(timeout) || timeout < 0)) return commandLineError(`invalid --timeout ${values.timeout}`);

  let monitor: MdnsMonitor;
  try {
    monitor = new MdnsMonitor({
      interfaceName: values.interface,
      ipv4Address: values['ipv4-address'],
      ipv6Address: values['ipv6-address'],
      outgoingIpv4Address: values['outgoing-ipv4-address'],
      outgoingIpv6Address: values['outgoing-ipv6-address'],
      query: values.query === true,
      queryIntervalMs: queryInterval === undefined ? undefined : queryInterval * 1000,
      unicast: values.unicast === true,
      filters: values.filter,
      ipFilters: values['ip-filter'],
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
