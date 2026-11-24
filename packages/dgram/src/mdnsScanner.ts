/**
 * @file packages/dgram/src/mdnsScanner.ts
 * @description This file contains the class MdnsScanner, a dual stack mDNS scanner that tracks the Matter advertisements on the network.
 * @author Luca Liguori
 * @created 2026-09-28
 * @version 2.2.0
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

// Node.js imports
import type dgram from 'node:dgram';
import type { SocketType } from 'node:dgram';
import EventEmitter from 'node:events';
import { parseArgs } from 'node:util';

// @matterbridge
import { getErrorMessage } from '@matterbridge/utils/error';
// AnsiLogger imports
import { AnsiLogger, CYAN, GREEN, LogLevel, MAGENTA, nf, TimestampFormat } from 'node-ansi-logger';

// Dgram imports
import { isLinkLocalIpv6, receivingZone } from './dgram.js';
import { DnsClass, DnsRecordType, isFirstOnPort, Mdns, MDNS_MAX_MESSAGE_LENGTH, type MdnsMessage, type MdnsSrvData } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';

/** DNS-SD service type of the Matter Commissionable Node Discovery (Matter Core §4.3.1). */
export const MATTER_COMMISSIONABLE_SERVICE = '_matterc._udp';
/** DNS-SD service type of the Matter Operational Discovery (Matter Core §4.3.2). */
export const MATTER_OPERATIONAL_SERVICE = '_matter._tcp';
/** DNS-SD service type of the Matter Commissioner Discovery (Matter Core §4.3.3). */
export const MATTER_COMMISSIONER_SERVICE = '_matterd._udp';
/** DNS-SD service type of the Matterbridge frontend, as advertised by {@link MatterbridgeAdvertise}. */
export const MATTERBRIDGE_SERVICE = '_matterbridge._tcp';
/** The Matter DNS-SD service types. */
export const MDNS_SCANNER_MATTER_SERVICES = [MATTER_COMMISSIONABLE_SERVICE, MATTER_OPERATIONAL_SERVICE, MATTER_COMMISSIONER_SERVICE];
/** The DNS-SD service types scanned by default: the Matter ones and Matterbridge. */
export const MDNS_SCANNER_DEFAULT_SERVICES = [...MDNS_SCANNER_MATTER_SERVICES, MATTERBRIDGE_SERVICE];
/** Default interval in ms between two logs of the hosts and their instances. */
export const MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS = 60000;

const EXPIRE_INTERVAL_MS = 1000;
const CACHE_FLUSH_GRACE_MS = 1000; // RFC 6762 §10.2
const GOODBYE_DELAY_MS = 1000; // RFC 6762 §10.1
const REFRESH_PERCENTS = [80, 85, 90, 95]; // RFC 6762 §5.2
const REFRESH_JITTER_PERCENT = 2; // RFC 6762 §5.2
const LOOKUP_FIRST_DELAY_MS = 20; // RFC 6762 §5.2: the first query is delayed by 20 to 120 ms
const LOOKUP_FIRST_JITTER_MS = 100;
const LOOKUP_WAITS_MS = [1000, 2000, 4000]; // The wait after each query, the last one before giving up (RFC 6762 §5.2: the interval at least doubles)
const SERVICE_LABELS: Record<string, string> = {
  [MATTER_COMMISSIONABLE_SERVICE]: 'commissionable',
  [MATTER_OPERATIONAL_SERVICE]: 'operational',
  [MATTER_COMMISSIONER_SERVICE]: 'commissioner',
  [MATTERBRIDGE_SERVICE]: 'matterbridge',
};

/**
 * Options of {@link MdnsScanner}. Every option has a default.
 */
export interface MdnsScannerOptions {
  /** Network interface to scan on. Defaults to all the interfaces. */
  interfaceName?: string;
  /** Scan on IPv4 (224.0.0.251). Defaults to true. */
  enableIpv4?: boolean;
  /** Scan on IPv6 (ff02::fb). Defaults to true. */
  enableIpv6?: boolean;
  /** Service types as `_service._tcp` or `_service._udp`. Defaults to {@link MDNS_SCANNER_DEFAULT_SERVICES}. */
  services?: string[];
  /** Extra PTR owner names to query, as one of the `services` or one of its subtypes `_subtype._sub._service._tcp`/`_udp`. Defaults to no query names. */
  queryNames?: string[];
  /** Send a PTR query for the query names on start, so the devices already advertised answer at once. Defaults to true. */
  query?: boolean;
  /** Interval in ms between two PTR queries for the query names after the one on start, 0 sends only the one on start. Needs `query`. Defaults to 0. */
  queryIntervalMs?: number;
  /**
   * Query the SRV and TXT records an instance lacks and the A and AAAA records its target lacks, since a responder is not required to add them to its PTR answer
   * (RFC 6763 §12.1). An instance whose SRV record is not answered is dropped (RFC 6762 §10.4). Defaults to true.
   */
  resolve?: boolean;
  /** Query the records again at 80%, 85%, 90% and 95% of their TTL, so the ones still alive do not expire (RFC 6762 §5.2). Defaults to true. */
  refresh?: boolean;
  /** Interval in ms between two logs of the hosts and their instances, 0 disables it. Defaults to {@link MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS}. */
  logIntervalMs?: number;
  /** mDNS UDP port. Defaults to 5353; only tests should change it. */
  mdnsPort?: number;
}

/**
 * Events emitted by {@link MdnsScanner}. Each one carries the instance as it is at that time: read {@link MdnsScanner.instances} for the current one.
 */
export interface MdnsScannerEvents {
  /** The first record of a service instance has been received. */
  added: [instance: MdnsScannerInstance];
  /** The base PTR, the subtypes, the SRV data, the TXT strings or the addresses of an instance have changed. A record that is only refreshed does not emit it. */
  updated: [instance: MdnsScannerInstance];
  /** All the records of an instance have expired or said goodbye, or its SRV record could not be resolved. */
  removed: [instance: MdnsScannerInstance];
  /** A socket error. */
  error: [error: Error];
}

/** A socket family of the scanner. */
export type MdnsScannerFamily = 'ipv4' | 'ipv6';

/** The SRV record of a service instance. */
export interface MdnsScannerSrv extends MdnsSrvData {
  /** Time in ms (as `Date.now()`) when the record expires. */
  expires: number;
}

/** The TXT record of a service instance. */
export interface MdnsScannerTxt {
  /** Decoded TXT strings in wire order. */
  strings: string[];
  /** Time in ms (as `Date.now()`) when the record expires. */
  expires: number;
}

/**
 * A host of the scanner: the target of one or more SRV records, shared by all the instances it hosts.
 */
export interface MdnsScannerHost {
  /** The host name, e.g. `B75AFB458ECD0000.local`. */
  name: string;
  /** The A data (IPv4 addresses) of the host, mapped to expiration time in ms. */
  a: Map<string, number>;
  /**
   * The AAAA data (IPv6 addresses) of the host, mapped to expiration time in ms. A link-local address carries the zone of the interface it was received on (RFC 4007 §11),
   * e.g. `fe80::1%en0`, or `fe80::1%15` on Windows, and has no zone when that interface cannot be determined.
   */
  aaaa: Map<string, number>;
}

/**
 * A DNS-SD service instance of the scanner (RFC 6763 §4.1), e.g. one Matter node: several instances can share a host and differ by their port.
 */
export interface MdnsScannerInstance {
  /** The service instance name, e.g. `87E1B004E235A130-8FC7772401CD0696._matter._tcp.local`. */
  name: string;
  /** The scanned service type of the instance, e.g. `_matter._tcp`. */
  service: string;
  /** The kind of the instance: `commissionable`, `operational`, `commissioner` or `matterbridge`, or the service type for the other services. */
  type: string;
  /** Time in ms when the PTR record of the service pointing to the instance expires, or undefined when it has not been received. */
  ptrExpires?: number;
  /** The subtypes of the instance, e.g. `_L3840`, mapped to the expiration time in ms of their PTR record. */
  subtypes: Map<string, number>;
  /** The SRV record received last, or undefined until it is received. */
  srv?: MdnsScannerSrv;
  /** The TXT record received last, or undefined until it is received. */
  txt?: MdnsScannerTxt;
  /** The host of the SRV target with its addresses, shared with the other instances of the host; undefined without an SRV record. */
  host?: MdnsScannerHost;
}

/** The typed data of a cached record. */
type CachedData =
  | { type: DnsRecordType.PTR; data: string }
  | { type: DnsRecordType.SRV; data: MdnsSrvData }
  | { type: DnsRecordType.TXT; data: string[] }
  | { type: DnsRecordType.A | DnsRecordType.AAAA; data: string };

/** A cached record. PTR: the instance name; SRV: the priority, weight, port and target; TXT: the wire-order strings; A and AAAA: the address. */
type CachedRecord = CachedData & {
  /** Owner name. */
  name: string;
  /** Time in ms when the record was received. */
  received: number;
  /** Time in ms when the record expires. */
  expires: number;
  /** The TTL in seconds. */
  ttl: number;
  /** The times in ms of the refresh queries still to send (RFC 6762 §5.2). */
  refreshAt: number[];
};

/** A question of a refresh or lookup query. */
interface RefreshQuestion {
  name: string;
  type: DnsRecordType;
}

/** The query of a record an instance or a host lacks. */
interface Lookup extends RefreshQuestion {
  /** The queries sent. */
  attempts: number;
  /** Time in ms of the next query, or of the failure once all the queries are sent; Infinity after the failure. */
  nextAt: number;
}

/** A known answer of a refresh query (RFC 6762 §7.1). */
interface KnownAnswer {
  name: string;
  rtype: number;
  rclass: number;
  ttl: number;
  rdata: Buffer;
}

/** The longest delay setInterval() takes as is: a longer one, or a non-finite one, becomes 1 ms (2^31 - 1 ms). */
const MAX_TIMER_DELAY_MS = 0x7fffffff;

/**
 * Returns true when an interval option is 0 (disabled) or a delay setInterval() takes as is, from 1 ms to {@link MAX_TIMER_DELAY_MS}.
 *
 * @param {number} ms - The interval in ms.
 * @returns {boolean} True if valid.
 */
function isValidInterval(ms: number): boolean {
  return ms === 0 || (Number.isFinite(ms) && ms >= 1 && ms <= MAX_TIMER_DELAY_MS);
}

/** One DNS label in presentation format: any character but an unescaped dot or a lone backslash (RFC 6763 §4.3). */
const SINGLE_LABEL = /^(?:\\.|[^.\\])+$/;

/**
 * Mdns socket used by the scanner: it hands the raw packets to the scanner instead of logging them.
 */
class MdnsScannerSocket extends Mdns {
  onPacket?: (msg: Buffer, rinfo: dgram.RemoteInfo) => void;

  /**
   * Creates the socket of one family.
   *
   * @param {string} name - The name of the socket for the logs.
   * @param {string} multicastAddress - The mDNS multicast address (224.0.0.251 or ff02::fb).
   * @param {number} multicastPort - The mDNS port.
   * @param {SocketType} socketType - The socket type.
   * @param {string | undefined} interfaceName - The interface to join the multicast group on, or undefined for all.
   * @param {string} interfaceAddress - The address to bind to (0.0.0.0 or ::).
   */
  constructor(name: string, multicastAddress: string, multicastPort: number, socketType: SocketType, interfaceName: string | undefined, interfaceAddress: string) {
    super(name, multicastAddress, multicastPort, socketType, true, interfaceName, interfaceAddress);
  }

  /**
   * Hands a received packet to the scanner.
   *
   * @param {Buffer} msg - Received datagram.
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   */
  override onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    this.onPacket?.(msg, rinfo);
  }
}

/**
 * Dual stack (IPv4 and IPv6) mDNS scanner of the Matter advertisements: commissionable nodes (`_matterc._udp`),
 * operational nodes (`_matter._tcp`) and commissioners (`_matterd._udp`), including their subtypes, plus the Matterbridge frontends (`_matterbridge._tcp`).
 *
 * It keeps a map of the DNS-SD service instances (RFC 6763 §4.1), each with its PTR, subtypes, SRV and TXT data, and a map of the hosts they
 * point to with their A and AAAA data: a host can hold several instances on different ports. The records an instance or a host lacks are queried.
 * Every record expires when its TTL has elapsed or when a goodbye (TTL 0) is received (RFC 6762 §10.1), and the cache-flush bit is honored (RFC 6762 §10.2).
 * The records are queried again at 80%, 85%, 90% and 95% of their TTL, so the ones still alive are refreshed (RFC 6762 §5.2).
 * The maps are logged every minute.
 */
export class MdnsScanner extends EventEmitter<MdnsScannerEvents> {
  readonly log: AnsiLogger;
  readonly interfaceName: string | undefined;
  readonly mdnsPort: number;
  readonly services: string[];
  readonly queryNames: string[];
  readonly sockets: Partial<Record<MdnsScannerFamily, Mdns>> = {};
  /** The service instances keyed by the lower case instance name. The instances are replaced when a record changes: do not keep them. */
  readonly instances = new Map<string, MdnsScannerInstance>();
  /** The hosts keyed by the lower case SRV target. */
  readonly hosts = new Map<string, MdnsScannerHost>();
  private readonly scannerSockets: Partial<Record<MdnsScannerFamily, MdnsScannerSocket>> = {};
  private readonly codec: Mdns;
  private readonly query: boolean;
  private readonly queryIntervalMs: number;
  private queryTimer: NodeJS.Timeout | undefined;
  private readonly resolve: boolean;
  private readonly refresh: boolean;
  private readonly logIntervalMs: number;
  private readonly records = new Map<string, CachedRecord>();
  private readonly signatures = new Map<string, string>();
  private readonly lookups = new Map<string, Lookup>();
  private lookupTimer: NodeJS.Timeout | undefined;
  private expireTimer: NodeJS.Timeout | undefined;
  private logTimer: NodeJS.Timeout | undefined;
  private started = false;
  private readonly firstOnPort: Record<MdnsScannerFamily, boolean> = { ipv4: false, ipv6: false };
  private queried = false;
  private stopped = false;

  /**
   * Creates the scanner. It does not open the sockets: call {@link MdnsScanner.start}.
   *
   * @param {MdnsScannerOptions} [options] - The scanner options.
   * @throws {Error} If both IPv4 and IPv6 are disabled or a service is invalid.
   */
  constructor(options: MdnsScannerOptions = {}) {
    super();
    this.log = new AnsiLogger({ logName: 'MdnsScanner', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });
    this.interfaceName = options.interfaceName;
    this.mdnsPort = options.mdnsPort ?? MDNS_MULTICAST_PORT;
    this.services = options.services ?? [...MDNS_SCANNER_DEFAULT_SERVICES];
    this.queryNames = options.queryNames ?? [];
    this.query = options.query ?? true;
    this.queryIntervalMs = options.queryIntervalMs ?? 0;
    this.resolve = options.resolve ?? true;
    this.refresh = options.refresh ?? true;
    this.logIntervalMs = options.logIntervalMs ?? MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS;
    if (!Number.isInteger(this.mdnsPort) || this.mdnsPort < 1 || this.mdnsPort > 65535) throw new Error(`MdnsScanner: invalid mdnsPort ${this.mdnsPort}`);
    if (!isValidInterval(this.queryIntervalMs)) throw new Error(`MdnsScanner: invalid queryIntervalMs ${this.queryIntervalMs}`);
    if (!isValidInterval(this.logIntervalMs)) throw new Error(`MdnsScanner: invalid logIntervalMs ${this.logIntervalMs}`);
    if (this.services.length === 0) throw new Error('MdnsScanner: at least one service is required');
    for (const service of this.services) {
      if (!/^_[A-Za-z0-9-]{1,15}\._(tcp|udp)$/.test(service)) throw new Error(`MdnsScanner: invalid service ${service}`);
    }
    for (const name of this.queryNames) {
      // The subtype label is at most 63 bytes, like any DNS label (RFC 6763 §7.1)
      const service = /^(?:_[A-Za-z0-9-]{1,62}\._sub\.)?(_[A-Za-z0-9-]{1,15}\._(?:tcp|udp))$/.exec(name)?.[1];
      if (service === undefined) throw new Error(`MdnsScanner: invalid query name ${name}`);
      // The answers are kept only for the scanned services and their subtypes (see isServicePtr)
      if (!this.services.some((candidate) => candidate.toLowerCase() === service.toLowerCase())) throw new Error(`MdnsScanner: query name ${name} is not of a scanned service`);
    }
    if (options.enableIpv4 !== false) {
      this.scannerSockets.ipv4 = new MdnsScannerSocket('MdnsScannerUdp4', MDNS_MULTICAST_IPV4_ADDRESS, this.mdnsPort, 'udp4', this.interfaceName, '0.0.0.0');
    }
    if (options.enableIpv6 !== false) {
      this.scannerSockets.ipv6 = new MdnsScannerSocket('MdnsScannerUdp6', MDNS_MULTICAST_IPV6_ADDRESS, this.mdnsPort, 'udp6', this.interfaceName, '::');
    }
    this.sockets.ipv4 = this.scannerSockets.ipv4;
    this.sockets.ipv6 = this.scannerSockets.ipv6;
    const codec = this.sockets.ipv4 ?? this.sockets.ipv6;
    if (!codec) throw new Error('MdnsScanner: at least one of IPv4 and IPv6 must be enabled');
    this.codec = codec;
  }

  /**
   * Opens the sockets, sends the PTR queries and starts the expire and log timers. When a socket fails to start, the scanner is stopped
   * and the error rethrown; when {@link MdnsScanner.stop} is called meanwhile, it resolves without starting anything.
   *
   * @returns {Promise<void>} Resolves when the sockets are ready.
   * @throws {Error} If the scanner was already started or stopped, or a socket fails to start.
   */
  async start(): Promise<void> {
    if (this.started) throw new Error('MdnsScanner: already started');
    if (this.stopped) throw new Error('MdnsScanner: already stopped');
    this.started = true;
    // RFC 6762 §15.1: only the first socket bound to the port receives the unicast responses, so check it before binding ours
    for (const family of this.families()) {
      this.firstOnPort[family] = await isFirstOnPort(family === 'ipv4' ? 'udp4' : 'udp6', this.mdnsPort);
      if (this.stopped) return;
      if (!this.firstOnPort[family] && this.query)
        this.log.info(`Another mDNS responder is bound to ${family} port ${this.mdnsPort}: querying without unicast responses (RFC 6762 §15.1)`);
    }
    try {
      await Promise.all(this.families().map(async (family) => this.startSocket(family)));
    } catch (error) {
      // Close the sockets already bound, with their multicast memberships
      await this.stop();
      throw error;
    }
    if (this.stopped) return;
    this.log.info(`Scanning ${CYAN}${this.services.join(', ')}${nf} on ${CYAN}${this.interfaceName ?? 'all interfaces'}${nf} (${CYAN}${this.families().join(', ')}${nf})`);
    this.expireTimer = setInterval(() => {
      this.expire();
      this.sendRefreshQueries();
    }, EXPIRE_INTERVAL_MS).unref();
    if (this.logIntervalMs > 0) this.logTimer = setInterval(() => this.logInstances(), this.logIntervalMs).unref();
    if (this.query) this.sendQuery();
    if (this.query && this.queryIntervalMs > 0) this.queryTimer = setInterval(() => this.sendQuery(), this.queryIntervalMs).unref();
  }

  /**
   * Stops the timers and closes the sockets, also when the scanner was never started or is still starting. A stopped scanner cannot be started again.
   *
   * @returns {Promise<void>} Resolves when the sockets are closed.
   */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.expireTimer);
    clearInterval(this.logTimer);
    clearInterval(this.queryTimer);
    clearTimeout(this.lookupTimer);
    await Promise.all(
      this.families().map(async (family) => {
        const socket = this.sockets[family];
        /* v8 ignore next - families() only lists the families with a socket */
        if (!socket) return;
        await new Promise<void>((resolve) => {
          socket.once('close', () => resolve());
          socket.stop();
        });
      }),
    );
    this.log.info('Stopped');
  }

  /**
   * Sends a PTR query for every service and configured query name on each socket, one question per query: some responders do not answer the queries with several questions.
   * The first queries ask for unicast responses (QU) on the families where the scanner is the first socket bound to the mDNS port (RFC 6762 §5.4, §15.1),
   * so every responder answers even the records it multicast recently; the next ones ask for multicast responses (QM).
   * The fresh PTR records of the instances with their SRV and TXT records are sent as known answers (RFC 6762 §7.1), so the queries repeated with `queryIntervalMs`
   * are answered only by the instances not known yet.
   */
  sendQuery(): void {
    const names = [...new Set([...this.services, ...this.queryNames])];
    this.log.info(
      `Querying ${CYAN}${names.map((name) => `${name}.local`).join(', ')}${nf} on ${CYAN}${this.interfaceName ?? 'all interfaces'}${nf} (${CYAN}${this.families().join(', ')}${nf})`,
    );
    const now = Date.now();
    for (const queryName of names) {
      const name = `${queryName}.local`;
      const answers = this.fittingKnownAnswers({ name, type: DnsRecordType.PTR }, now);
      for (const family of this.families()) {
        const unicastResponse = this.firstOnPort[family] && !this.queried;
        this.sockets[family]?.sendQuery([{ name, type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse }], answers);
      }
    }
    this.queried = true;
  }

  /**
   * Removes the records whose TTL has elapsed and updates the instances.
   */
  expire(): void {
    const now = Date.now();
    let changed = false;
    for (const [key, record] of this.records) {
      if (record.expires > now) continue;
      this.records.delete(key);
      changed = true;
    }
    if (changed) this.updateInstances();
  }

  /**
   * Sends the refresh queries of the records at 80%, 85%, 90% and 95% of their TTL (RFC 6762 §5.2), with the fresh records as known answers (RFC 6762 §7.1).
   * Each question goes in its own query, since some responders do not answer the queries with several questions.
   */
  sendRefreshQueries(): void {
    if (!this.refresh) return;
    const now = Date.now();
    const due = new Map<string, RefreshQuestion>();
    for (const record of this.records.values()) {
      let isDue = false;
      while (record.refreshAt.length > 0 && record.refreshAt[0] <= now) {
        record.refreshAt.shift();
        isDue = true;
      }
      if (isDue) due.set(`${record.name.toLowerCase()}|${record.type}`, { name: record.name, type: record.type });
    }
    if (due.size === 0) return;
    this.log.debug(`Refreshing ${due.size} record sets`);
    for (const { name, type } of due.values()) {
      const answers = this.fittingKnownAnswers({ name, type }, now);
      for (const family of this.families()) this.sockets[family]?.sendQuery([{ name, type, class: DnsClass.IN }], answers);
    }
  }

  /**
   * Queries again now the SRV and TXT records of a known instance and the A and AAAA records of its host, e.g. when the instance does not answer at its addresses.
   * Each question goes in its own query without known answers, so the responder answers all of them (RFC 6762 §7.1), and asks for a unicast response where the
   * scanner is the first socket bound to the mDNS port (RFC 6762 §5.4). The answers update the instance as usual: an `updated` event is emitted only if its data changed.
   *
   * @param {string} instanceName - The service instance name, e.g. `DD200C20D25AE5F7._matterc._udp.local`.
   * @returns {boolean} True if the queries were sent, false if the scanner is not running or does not know the instance.
   */
  requery(instanceName: string): boolean {
    if (!this.started || this.stopped) return false;
    const instance = this.instances.get(instanceName.toLowerCase());
    if (!instance) return false;
    const questions: RefreshQuestion[] = [
      { name: instance.name, type: DnsRecordType.SRV },
      { name: instance.name, type: DnsRecordType.TXT },
    ];
    if (instance.host) questions.push({ name: instance.host.name, type: DnsRecordType.A }, { name: instance.host.name, type: DnsRecordType.AAAA });
    this.log.debug(`Querying again ${instance.name}`);
    for (const { name, type } of questions) {
      for (const family of this.families()) this.sockets[family]?.sendQuery([{ name, type, class: DnsClass.IN, unicastResponse: this.firstOnPort[family] }]);
    }
    return true;
  }

  /**
   * Logs the hosts with their addresses and instances, then the instances without an SRV record yet.
   */
  logInstances(): void {
    this.expire();
    const now = Date.now();
    const ttl = (expires: number): string => `(${MAGENTA}${Math.max(0, Math.round((expires - now) / 1000))}${nf}s)`;
    const formatList = (entries: Iterable<[string, number]>): string => [...entries].map(([data, expires]) => `${CYAN}${data}${nf} ${ttl(expires)}`).join(', ') || 'none';
    const logInstance = (instance: MdnsScannerInstance): void => {
      const port = instance.srv ? `:${instance.srv.port}` : '';
      this.log.info(`  - ${GREEN}${instance.name}${port}${nf} ${MAGENTA}${instance.type}${nf}`);
      this.log.info(`    PTR ${instance.ptrExpires === undefined ? 'none' : ttl(instance.ptrExpires)} subtypes ${formatList(instance.subtypes)}`);
      const { srv, txt } = instance;
      this.log.info(`    SRV ${srv ? formatList([[`${srv.target}:${srv.port} priority ${srv.priority} weight ${srv.weight}`, srv.expires]]) : 'none'}`);
      this.log.info(`    TXT ${txt ? formatList([[txt.strings.join(', '), txt.expires]]) : 'none'}`);
    };
    const instances = [...this.instances.values()].toSorted((a, b) => a.name.localeCompare(b.name));
    this.log.info(`Advertising ${CYAN}${this.services.join(', ')}${nf}: ${MAGENTA}${this.instances.size}${nf} instances on ${MAGENTA}${this.hosts.size}${nf} hosts`);
    for (const host of [...this.hosts.values()].toSorted((a, b) => a.name.localeCompare(b.name))) {
      const hosted = instances.filter((instance) => instance.host === host);
      this.log.info(`- ${GREEN}${host.name}${nf} ${MAGENTA}${[...new Set(hosted.map((instance) => instance.type))].toSorted().join(', ')}${nf}`);
      this.log.info(`  A ${formatList(host.a)}`);
      this.log.info(`  AAAA ${formatList(host.aaaa)}`);
      for (const instance of hosted) logInstance(instance);
    }
    const unresolved = instances.filter((instance) => !instance.host);
    if (unresolved.length > 0) this.log.info(`- ${GREEN}no SRV record${nf}`);
    for (const instance of unresolved) logInstance(instance);
  }

  // --------------------------------------------------------------------------------------------
  // Receiving
  // --------------------------------------------------------------------------------------------

  /**
   * Opens a socket and waits until it is ready, or closed by {@link MdnsScanner.stop}.
   *
   * @param {MdnsScannerFamily} family - The socket family.
   * @returns {Promise<void>} Resolves when the socket is ready or closed.
   */
  private async startSocket(family: MdnsScannerFamily): Promise<void> {
    const socket = this.scannerSockets[family];
    /* v8 ignore next - startSocket() is only called for the families with a socket */
    if (!socket) return;
    socket.onPacket = (msg: Buffer, rinfo: dgram.RemoteInfo): void => this.handlePacket(socket, msg, rinfo);
    await new Promise<void>((resolve, reject) => {
      // Removes the three listeners once one of them settles the start: assigned below, after the listeners it removes
      let cleanup: (() => void) | undefined;
      const onReady = (): void => {
        cleanup?.();
        socket.on('error', (error) => {
          this.log.error(`Socket ${family} error: ${getErrorMessage(error)}`);
          if (this.listenerCount('error') > 0) this.emit('error', error);
        });
        resolve();
      };
      const onError = (error: Error): void => {
        cleanup?.();
        reject(error);
      };
      const onClose = (): void => {
        cleanup?.();
        resolve();
      };
      cleanup = (): void => {
        socket.off('ready', onReady);
        socket.off('error', onError);
        socket.off('close', onClose);
      };
      socket.on('ready', onReady);
      socket.on('error', onError);
      socket.on('close', onClose);
      try {
        socket.start();
      } catch (error) {
        cleanup();
        /* v8 ignore next - Mdns.start() only throws Error instances */
        reject(error instanceof Error ? error : new Error(getErrorMessage(error)));
      }
    });
  }

  /**
   * Handles a received packet: only the responses are used, the known answers of the queries are not authoritative.
   *
   * @param {Mdns} socket - The socket that received it, used to decode it.
   * @param {Buffer} msg - The packet.
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   */
  private handlePacket(socket: Mdns, msg: Buffer, rinfo: dgram.RemoteInfo): void {
    if (this.stopped) return;
    if (rinfo.port !== this.mdnsPort) return; // RFC 6762 §6: responses must come from the mDNS port
    let message: MdnsMessage;
    try {
      message = socket.decodeMdnsMessage(msg);
    } catch (error) {
      this.log.debug(`Ignoring malformed packet from ${rinfo.address}: ${getErrorMessage(error)}`);
      return;
    }
    if (message.qr !== 1 || message.opcode !== 0 || message.rcode !== 0) return; // RFC 6762 §18.3, §18.11
    const received = [...(message.answers ?? []), ...(message.additionals ?? [])].filter((record) => record.class === DnsClass.IN);
    const now = Date.now();
    let changed = false;
    // The PTR and SRV records first, so the A and AAAA records of the targets in the same packet are kept
    for (const record of received) {
      const { name, cacheFlush, ttl } = record;
      if (record.type === DnsRecordType.PTR && this.isServicePtr(name, record.data))
        changed = this.cache(name, { type: record.type, data: record.data }, cacheFlush, ttl, now) || changed;
      if (record.type === DnsRecordType.SRV && this.isServiceInstance(name)) changed = this.cache(name, { type: record.type, data: record.data }, cacheFlush, ttl, now) || changed;
      if (record.type === DnsRecordType.TXT && this.isServiceInstance(name)) changed = this.cache(name, { type: record.type, data: record.data }, cacheFlush, ttl, now) || changed;
    }
    let zone: string | undefined; // '' when the receiving interface cannot be determined
    for (const record of received) {
      if ((record.type === DnsRecordType.A || record.type === DnsRecordType.AAAA) && this.isTarget(record.name)) {
        let data = record.data;
        // A link-local address is reachable only through the interface it was received on (RFC 4007 §6)
        if (record.type === DnsRecordType.AAAA && isLinkLocalIpv6(data) && !data.includes('%')) {
          zone ??= receivingZone(rinfo.address, this.interfaceName) ?? '';
          data += zone;
        }
        changed = this.cache(record.name, { type: record.type, data }, record.cacheFlush, record.ttl, now) || changed;
      }
    }
    if (changed) this.updateInstances();
  }

  /**
   * Adds, refreshes or removes (goodbye) a record in the cache. Two records of the same name and type with different data are two records,
   * e.g. two SRV records of an instance with different ports.
   *
   * @param {string} name - The owner name.
   * @param {CachedData} entry - The record type and its typed data.
   * @param {boolean} cacheFlush - True when the record has the cache-flush bit set.
   * @param {number} ttl - The TTL in seconds.
   * @param {number} now - The current time in ms.
   * @returns {boolean} True if the cache changed.
   */
  private cache(name: string, entry: CachedData, cacheFlush: boolean, ttl: number, now: number): boolean {
    let rdata: string;
    if (entry.type === DnsRecordType.SRV) rdata = `${entry.data.priority} ${entry.data.weight} ${entry.data.port} ${entry.data.target.toLowerCase()}`;
    else if (entry.type === DnsRecordType.TXT) rdata = entry.data.join('\0'); // The TXT values are case-sensitive (RFC 6763 §6.5)
    else rdata = entry.data.toLowerCase();
    const key = `${name.toLowerCase()}|${entry.type}|${rdata}`;
    if (ttl === 0) {
      // RFC 6762 §10.1: a goodbye is recorded as a TTL of 1 and the record is deleted one second later
      this.log.debug(`Goodbye received for ${name} ${entry.type} ${rdata}`);
      const record = this.records.get(key);
      if (record) {
        record.expires = Math.min(record.expires, now + GOODBYE_DELAY_MS);
        record.refreshAt = [];
      }
      return false;
    }
    if (cacheFlush) {
      // RFC 6762 §10.2: the other records of the set received more than one second ago expire in one second
      for (const [otherKey, other] of this.records) {
        if (otherKey === key || other.type !== entry.type || other.name.toLowerCase() !== name.toLowerCase()) continue;
        if (now - other.received > CACHE_FLUSH_GRACE_MS) other.expires = Math.min(other.expires, now + CACHE_FLUSH_GRACE_MS);
      }
    }
    const refreshAt = REFRESH_PERCENTS.map((percent) => now + ttl * 10 * (percent + Math.random() * REFRESH_JITTER_PERCENT));
    this.records.set(key, { ...entry, name, received: now, expires: now + ttl * 1000, ttl, refreshAt });
    return true;
  }

  /**
   * Returns the known answers of a question: the cached records of the same name and type with more than half of their TTL left (RFC 6762 §7.1).
   * A PTR record is included only when its instance has its SRV and TXT records, so the instances still to resolve are answered again with their additional records.
   * The SRV and TXT records are not included: they are unique records, queried only to refresh them.
   *
   * @param {RefreshQuestion} question - The question.
   * @param {number} now - The current time in ms.
   * @returns {KnownAnswer[]} The known answers.
   */
  private knownAnswers(question: RefreshQuestion, now: number): KnownAnswer[] {
    const answers: KnownAnswer[] = [];
    for (const record of this.records.values()) {
      if (record.type !== question.type || record.name.toLowerCase() !== question.name.toLowerCase()) continue;
      if (record.expires - now <= (record.ttl * 1000) / 2) continue;
      let rdata: Buffer;
      if (record.type === DnsRecordType.PTR) {
        const instance = this.instances.get(record.data.toLowerCase());
        if (!instance?.srv || !instance.txt) continue;
        rdata = this.codec.encodeDnsName(record.data);
      } else if (record.type === DnsRecordType.A) rdata = this.codec.encodeA(record.data);
      else if (record.type === DnsRecordType.AAAA) rdata = this.codec.encodeAAAA(record.data);
      else continue;
      answers.push({ name: record.name, rtype: record.type, rclass: DnsClass.IN, ttl: Math.floor((record.expires - now) / 1000), rdata });
    }
    return answers;
  }

  /**
   * Returns the known answers of a question that fit in one message with it; the sizes are uncompressed, so the compressed packet is smaller.
   * A known answer left out only costs an answer the responder sends again.
   *
   * @param {RefreshQuestion} question - The question.
   * @param {number} now - The current time in ms.
   * @returns {KnownAnswer[]} The known answers that fit.
   */
  private fittingKnownAnswers(question: RefreshQuestion, now: number): KnownAnswer[] {
    const nameLength = (name: string): number => Buffer.byteLength(name) + 2;
    let length = 12 + nameLength(question.name) + 4;
    const answers: KnownAnswer[] = [];
    for (const answer of this.knownAnswers(question, now)) {
      length += nameLength(answer.name) + 10 + answer.rdata.length;
      if (length > MDNS_MAX_MESSAGE_LENGTH) break;
      answers.push(answer);
    }
    return answers;
  }

  /**
   * Returns true when a PTR record belongs to a scanned service: the service or one of its subtypes, pointing to an instance of the service.
   *
   * @param {string} name - The PTR name, e.g. `_matterc._udp.local` or `_L3840._sub._matterc._udp.local`.
   * @param {string} data - The PTR data, e.g. `DD200C20D25AE5F7._matterc._udp.local`.
   * @returns {boolean} True if relevant.
   */
  private isServicePtr(name: string, data: string): boolean {
    const service = this.serviceOf(data);
    if (service === undefined) return false;
    const serviceName = `${service}.local`;
    return name.toLowerCase() === serviceName.toLowerCase() || this.prefixLabel(name, `._sub.${serviceName}`) !== undefined;
  }

  /**
   * Returns true when a name is an instance of a scanned service.
   *
   * @param {string} name - The name, e.g. `87E1B004E235A130-8FC7772401CD0696._matter._tcp.local`.
   * @returns {boolean} True if relevant.
   */
  private isServiceInstance(name: string): boolean {
    return this.serviceOf(name) !== undefined;
  }

  /**
   * Returns the scanned service of a service instance name `<Instance>.<Service>.local`, whose instance is one DNS label (RFC 6763 §4.1),
   * so a subtype PTR owner like `_IC._sub._matter._tcp.local` or a name with more labels before the service is not an instance.
   *
   * @param {string} name - The name, e.g. `87E1B004E235A130-8FC7772401CD0696._matter._tcp.local`.
   * @returns {string | undefined} The service, or undefined if the name is not an instance of a scanned service.
   */
  private serviceOf(name: string): string | undefined {
    return this.services.find((service) => this.prefixLabel(name, `.${service}.local`) !== undefined);
  }

  /**
   * Returns the single DNS label before a suffix, compared without case, e.g. the subtype of `_L840._sub._matterc._udp.local` before `._sub._matterc._udp.local`.
   * The dot that starts the suffix must not be escaped and the label must not contain an unescaped dot (RFC 6763 §4.3).
   *
   * @param {string} name - The name.
   * @param {string} suffix - The suffix, starting with a dot.
   * @returns {string | undefined} The label, or undefined if the name is not one label followed by the suffix.
   */
  private prefixLabel(name: string, suffix: string): string | undefined {
    if (name.length <= suffix.length || name.slice(-suffix.length).toLowerCase() !== suffix.toLowerCase()) return undefined;
    const label = name.slice(0, -suffix.length);
    return SINGLE_LABEL.test(label) ? label : undefined;
  }

  /**
   * Returns true when a name is the target of a cached SRV record.
   *
   * @param {string} name - The host name.
   * @returns {boolean} True if a target.
   */
  private isTarget(name: string): boolean {
    const lowerName = name.toLowerCase();
    for (const record of this.records.values()) if (record.type === DnsRecordType.SRV && record.data.target.toLowerCase() === lowerName) return true;
    return false;
  }

  /**
   * Rebuilds the instances and the hosts from the cached records in one pass, emits the added, updated and removed events, and queries the records still lacking.
   * An instance with several SRV or TXT records, e.g. after a port change announced without the cache-flush bit, takes the one received last.
   */
  private updateInstances(): void {
    const instances = new Map<string, MdnsScannerInstance>();
    const hosts = new Map<string, MdnsScannerHost>();
    const latest = new Map<string, number>();
    const instanceOf = (name: string): MdnsScannerInstance => {
      const key = name.toLowerCase();
      let instance = instances.get(key);
      if (!instance) {
        /* v8 ignore next - the cached PTR, SRV and TXT records are all of a scanned service */
        const service = this.serviceOf(name) ?? '';
        instance = { name, service, type: SERVICE_LABELS[service] ?? service, subtypes: new Map() };
        instances.set(key, instance);
      }
      return instance;
    };
    // True when a record is the last received of its kind for its instance
    const isLatest = (kind: string, record: CachedRecord): boolean => {
      const key = `${kind}|${record.name.toLowerCase()}`;
      if (record.received < (latest.get(key) ?? 0)) return false;
      latest.set(key, record.received);
      return true;
    };
    for (const record of this.records.values()) {
      if (record.type === DnsRecordType.PTR) {
        const instance = instanceOf(record.data);
        // isServicePtr() kept only the service PTR and the single label subtype PTRs of the instance service
        const subtype = this.prefixLabel(record.name, `._sub.${instance.service}.local`);
        if (subtype === undefined) instance.ptrExpires = record.expires;
        else instance.subtypes.set(subtype, record.expires);
      } else if (record.type === DnsRecordType.SRV) {
        const instance = instanceOf(record.name);
        if (isLatest('srv', record)) instance.srv = { ...record.data, expires: record.expires };
        const target = record.data.target.toLowerCase();
        if (!hosts.has(target)) hosts.set(target, { name: record.data.target, a: new Map(), aaaa: new Map() });
      } else if (record.type === DnsRecordType.TXT) {
        const instance = instanceOf(record.name);
        if (isLatest('txt', record)) instance.txt = { strings: [...record.data], expires: record.expires };
      }
    }
    for (const [key, record] of this.records) {
      if (record.type !== DnsRecordType.A && record.type !== DnsRecordType.AAAA) continue;
      const host = hosts.get(record.name.toLowerCase());
      if (host) (record.type === DnsRecordType.A ? host.a : host.aaaa).set(record.data, record.expires);
      else this.records.delete(key); // Addresses without a target are no longer needed
    }
    const signatures = new Map<string, string>();
    const added: MdnsScannerInstance[] = [];
    const updated: MdnsScannerInstance[] = [];
    for (const [key, instance] of instances) {
      if (instance.srv) instance.host = hosts.get(instance.srv.target.toLowerCase());
      const { srv, txt, host } = instance;
      // What the events report: the data without the expiration times, so a refreshed record is not an update
      const signature = JSON.stringify([
        instance.ptrExpires !== undefined,
        [...instance.subtypes.keys()].map((subtype) => subtype.toLowerCase()).toSorted(),
        srv && [srv.priority, srv.weight, srv.port, srv.target.toLowerCase()],
        txt?.strings,
        [...(host?.a.keys() ?? [])].toSorted(),
        [...(host?.aaaa.keys() ?? [])].toSorted(),
      ]);
      signatures.set(key, signature);
      const previous = this.signatures.get(key);
      if (previous === undefined) added.push(instance);
      else if (previous !== signature) updated.push(instance);
    }
    const removed = [...this.instances].filter(([key]) => !instances.has(key)).map(([, instance]) => instance);
    this.instances.clear();
    for (const [key, instance] of instances) this.instances.set(key, instance);
    this.hosts.clear();
    for (const [key, host] of hosts) this.hosts.set(key, host);
    this.signatures.clear();
    for (const [key, signature] of signatures) this.signatures.set(key, signature);
    this.updateLookups();
    for (const instance of removed) {
      this.log.info(`Removed ${GREEN}${instance.name}${nf}`);
      this.emit('removed', instance);
    }
    for (const instance of added) {
      this.log.info(`Added ${GREEN}${instance.name}${nf}`);
      this.emit('added', instance);
    }
    for (const instance of updated) {
      this.log.info(`Updated ${GREEN}${instance.name}${nf}`);
      this.emit('updated', instance);
    }
  }

  // --------------------------------------------------------------------------------------------
  // Resolving
  // --------------------------------------------------------------------------------------------

  /**
   * Starts a lookup for each record still lacking: the SRV and TXT records of an instance and the A and AAAA records of a host.
   * The responders should add them to their PTR answer, but they are not required to (RFC 6763 §12.1). The lookups no longer needed are dropped.
   */
  private updateLookups(): void {
    if (!this.resolve) return;
    const now = Date.now();
    const needed = new Map<string, RefreshQuestion>();
    const need = (name: string, type: DnsRecordType): void => void needed.set(`${name.toLowerCase()}|${type}`, { name, type });
    for (const instance of this.instances.values()) {
      if (!instance.srv) need(instance.name, DnsRecordType.SRV);
      if (!instance.txt) need(instance.name, DnsRecordType.TXT);
    }
    for (const host of this.hosts.values()) {
      if (host.a.size === 0) need(host.name, DnsRecordType.A);
      if (host.aaaa.size === 0) need(host.name, DnsRecordType.AAAA);
    }
    for (const key of this.lookups.keys()) if (!needed.has(key)) this.lookups.delete(key);
    for (const [key, question] of needed) {
      if (!this.lookups.has(key)) this.lookups.set(key, { ...question, attempts: 0, nextAt: now + LOOKUP_FIRST_DELAY_MS + Math.random() * LOOKUP_FIRST_JITTER_MS });
    }
    this.scheduleLookups();
  }

  /**
   * Arms the timer of the next lookup query.
   */
  private scheduleLookups(): void {
    clearTimeout(this.lookupTimer);
    const next = Math.min(...[...this.lookups.values()].map((lookup) => lookup.nextAt));
    if (next !== Infinity) this.lookupTimer = setTimeout(() => this.sendLookups(), Math.max(0, next - Date.now())).unref();
  }

  /**
   * Sends the lookup queries that are due, each question in its own query: the first one 20 to 120 ms after the record is found lacking, the next ones 1 and 2 seconds
   * after the one before (RFC 6762 §5.2). The first one asks for a unicast response where the scanner is the first socket bound to the mDNS port (RFC 6762 §5.4).
   * An instance whose SRV record is still lacking 4 seconds after the last query is dropped with its records, since its PTR record is stale (RFC 6762 §10.4);
   * the other records left unanswered, e.g. the AAAA record of an IPv4 only host, are no longer queried.
   */
  private sendLookups(): void {
    const now = Date.now();
    const stale = new Set<string>();
    for (const lookup of this.lookups.values()) {
      if (lookup.nextAt > now) continue;
      if (lookup.attempts === LOOKUP_WAITS_MS.length) {
        lookup.nextAt = Infinity;
        if (lookup.type === DnsRecordType.SRV) stale.add(lookup.name.toLowerCase());
        continue;
      }
      for (const family of this.families()) {
        const unicastResponse = lookup.attempts === 0 && this.firstOnPort[family];
        this.sockets[family]?.sendQuery([{ name: lookup.name, type: lookup.type, class: DnsClass.IN, unicastResponse }]);
      }
      lookup.nextAt = now + LOOKUP_WAITS_MS[lookup.attempts++];
    }
    if (stale.size === 0) {
      this.scheduleLookups();
      return;
    }
    for (const [key, record] of this.records) {
      const instance = record.type === DnsRecordType.PTR ? record.data : record.name;
      if (!stale.has(instance.toLowerCase())) continue;
      this.log.debug(`No SRV record for ${instance}: dropping its ${DnsRecordType[record.type]} record (RFC 6762 §10.4)`);
      this.records.delete(key);
    }
    this.updateInstances();
  }

  /**
   * Returns the enabled socket families.
   *
   * @returns {MdnsScannerFamily[]} The families.
   */
  private families(): MdnsScannerFamily[] {
    return (['ipv4', 'ipv6'] as const).filter((family) => this.sockets[family]);
  }
}

/** The help of the `mdns-scan` bin. */
export const MDNS_SCAN_HELP = `Usage: mdns-scan [options]

Scans the Matter and Matterbridge DNS-SD services (or the ones given) with mDNS over IPv4 and IPv6, and logs the hosts and their service instances every minute.
Stop it with Ctrl+C.

Options:
  --interface <name>        Network interface to scan on (default: all the interfaces)
  --query [seconds]         Send one PTR query per service on start, when the sockets are ready, and then every <seconds>;
                            without <seconds> it is sent only on start (default: only listen)
  --service <type>          Service type to scan, as _service._tcp or _service._udp; repeat it for more services
                            (default: ${MDNS_SCANNER_DEFAULT_SERVICES.join(', ')})
  --no-resolve              Do not query the SRV, TXT, A and AAAA records a responder left out of its answer:
                            an instance then stays incomplete until they are advertised
                            (default: resolve, and drop the instances whose SRV record is not answered)
  --no-refresh              Do not query again the records of the known instances at 80, 85, 90 and 95% of their TTL:
                            an instance then stays only as long as it advertises again before its records expire
                            (default: refresh, so the instances still alive do not expire)
  --log-interval <seconds>  Seconds between two logs of the hosts and instances, 0 disables them (default: ${MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS / 1000})
  --no-ipv4                 Do not scan on IPv4 (224.0.0.251)
  --no-ipv6                 Do not scan on IPv6 (ff02::fb)
  --debug                   Log at debug level
  --verbose                 Log at debug level and decode every query sent
  -h, --help                Show this help
`;

/**
 * Prints a command line error and sets the exit code.
 *
 * @param {string} message - The error message.
 * @returns {undefined} Nothing, so the caller can return it.
 */
function commandLineError(message: string): undefined {
  // oxlint-disable-next-line no-console
  console.error(`mdns-scan: ${message}\nRun mdns-scan --help to see the options.`);
  process.exitCode = 2;
}

/**
 * Runs the scanner from a terminal until SIGINT or SIGTERM. It is the `mdns-scan` bin: see {@link MDNS_SCAN_HELP} for the options.
 *
 * @param {string[]} argv - The arguments after the script name.
 * @param {MdnsScannerOptions} [options] - Extra options, used by the tests.
 * @returns {Promise<MdnsScanner | undefined>} The started scanner, or undefined after the help or a command line error.
 */
export async function runMdnsScanner(argv: string[], options: MdnsScannerOptions = {}): Promise<MdnsScanner | undefined> {
  // parseArgs() has no options with an optional value: take the seconds of --query out of the arguments
  const args: string[] = [];
  let querySeconds: string | undefined;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg.startsWith('--query=')) querySeconds = arg.slice('--query='.length);
    else if (arg === '--query' && /^\d/.test(argv[index + 1] ?? '')) querySeconds = argv[++index];
    args.push(arg.startsWith('--query=') ? '--query' : arg);
  }
  const config = {
    args,
    options: {
      'interface': { type: 'string' },
      'query': { type: 'boolean' },
      'service': { type: 'string', multiple: true },
      'no-resolve': { type: 'boolean' },
      'no-refresh': { type: 'boolean' },
      'log-interval': { type: 'string' },
      'no-ipv4': { type: 'boolean' },
      'no-ipv6': { type: 'boolean' },
      'debug': { type: 'boolean' },
      'verbose': { type: 'boolean' },
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
    console.log(MDNS_SCAN_HELP);
    return undefined;
  }
  const logInterval = values['log-interval'] === undefined ? undefined : Number(values['log-interval']);
  if (logInterval !== undefined && !isValidInterval(logInterval * 1000)) return commandLineError(`invalid --log-interval ${values['log-interval']}`);
  const queryInterval = querySeconds === undefined ? undefined : Number(querySeconds);
  if (queryInterval !== undefined && (querySeconds === '' || !isValidInterval(queryInterval * 1000))) return commandLineError(`invalid --query ${querySeconds}`);
  let scanner: MdnsScanner;
  try {
    scanner = new MdnsScanner({
      interfaceName: values.interface,
      query: values.query === true,
      queryIntervalMs: queryInterval === undefined ? undefined : queryInterval * 1000,
      services: values.service,
      resolve: values['no-resolve'] !== true,
      refresh: values['no-refresh'] !== true,
      logIntervalMs: logInterval === undefined ? undefined : logInterval * 1000,
      enableIpv4: values['no-ipv4'] !== true,
      enableIpv6: values['no-ipv6'] !== true,
      ...options,
    });
  } catch (error) {
    return commandLineError(getErrorMessage(error));
  }
  if (values.debug === true || values.verbose === true) scanner.log.logLevel = LogLevel.DEBUG;
  const shutdown = (): void => void scanner.stop();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  await scanner.start();
  return scanner;
}
