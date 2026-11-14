/**
 * @file packages/dgram/src/mdnsScanner.ts
 * @description This file contains the class MdnsScanner, a dual stack mDNS scanner that tracks the Matter advertisements on the network.
 * @author Luca Liguori
 * @created 2026-09-28
 * @version 1.0.4
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
import { DnsClass, DnsRecordType, isFirstOnPort, Mdns, MDNS_MAX_MESSAGE_LENGTH, type MdnsMessage } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';

/** DNS-SD service type of the Matter Commissionable Node Discovery (Matter Core §4.3.1). */
export const MATTER_COMMISSIONABLE_SERVICE = '_matterc._udp';
/** DNS-SD service type of the Matter Operational Discovery (Matter Core §4.3.2). */
export const MATTER_OPERATIONAL_SERVICE = '_matter._tcp';
/** DNS-SD service type of the Matter Commissioner Discovery (Matter Core §4.3.3). */
export const MATTER_COMMISSIONER_SERVICE = '_matterd._udp';
/** The Matter DNS-SD service types scanned by default. */
export const MDNS_SCANNER_MATTER_SERVICES = [MATTER_COMMISSIONABLE_SERVICE, MATTER_OPERATIONAL_SERVICE, MATTER_COMMISSIONER_SERVICE];
/** Default interval in ms between two logs of the devices. */
export const MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS = 60000;

const EXPIRE_INTERVAL_MS = 1000;
const CACHE_FLUSH_GRACE_MS = 1000; // RFC 6762 §10.2
const GOODBYE_DELAY_MS = 1000; // RFC 6762 §10.1
const REFRESH_PERCENTS = [80, 85, 90, 95]; // RFC 6762 §5.2
const REFRESH_JITTER_PERCENT = 2; // RFC 6762 §5.2
const SERVICE_LABELS: Record<string, string> = {
  [MATTER_COMMISSIONABLE_SERVICE]: 'commissionable',
  [MATTER_OPERATIONAL_SERVICE]: 'operational',
  [MATTER_COMMISSIONER_SERVICE]: 'commissioner',
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
  /** Service types as `_service._tcp` or `_service._udp`. Defaults to {@link MDNS_SCANNER_MATTER_SERVICES}. */
  services?: string[];
  /** Send a PTR query for the services on start, so the devices already advertised answer at once. Defaults to true. */
  query?: boolean;
  /** Query the records again at 80%, 85%, 90% and 95% of their TTL, so the ones still alive do not expire (RFC 6762 §5.2). Defaults to true. */
  refresh?: boolean;
  /** Interval in ms between two logs of the devices, 0 disables it. Defaults to {@link MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS}. */
  logIntervalMs?: number;
  /** mDNS UDP port. Defaults to 5353; only tests should change it. */
  mdnsPort?: number;
}

/**
 * Events emitted by {@link MdnsScanner}.
 */
export interface MdnsScannerEvents {
  /** A new SRV target has been discovered. */
  added: [device: MdnsScannerDevice];
  /** All the SRV records of a target have expired or said goodbye. */
  removed: [device: MdnsScannerDevice];
  /** A socket error. */
  error: [error: Error];
}

/** A socket family of the scanner. */
export type MdnsScannerFamily = 'ipv4' | 'ipv6';

/**
 * A device of the scanner, keyed by the target of its SRV records.
 * Each map goes from the record data to the time in ms (as Date.now()) when the record expires.
 */
export interface MdnsScannerDevice {
  /** The SRV target, e.g. `B75AFB458ECD0000.local`. */
  target: string;
  /** The kinds of the SRV instances of the target: `commissionable`, `operational`, `commissioner`, or the service type for the other services. */
  types: string[];
  /** The PTR data, i.e. the service instance names, e.g. `87E1B004E235A130-8FC7772401CD0696._matter._tcp.local`, whose SRV record points to the target. */
  ptr: Map<string, number>;
  /** The A data (IPv4 addresses) of the target. */
  a: Map<string, number>;
  /** The AAAA data (IPv6 addresses) of the target. */
  aaaa: Map<string, number>;
}

/** A cached record. */
interface CachedRecord {
  /** Owner name. */
  name: string;
  /** Record type: PTR, SRV, A or AAAA. */
  type: DnsRecordType;
  /** PTR: the instance name; SRV: the target; A and AAAA: the address. */
  data: string;
  /** Time in ms when the record was received. */
  received: number;
  /** Time in ms when the record expires. */
  expires: number;
  /** The TTL in seconds. */
  ttl: number;
  /** The times in ms of the refresh queries still to send (RFC 6762 §5.2). */
  refreshAt: number[];
}

/** A question of a refresh query. */
interface RefreshQuestion {
  name: string;
  type: DnsRecordType;
}

/** A known answer of a refresh query (RFC 6762 §7.1). */
interface KnownAnswer {
  name: string;
  rtype: number;
  rclass: number;
  ttl: number;
  rdata: Buffer;
}

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
 * operational nodes (`_matter._tcp`) and commissioners (`_matterd._udp`), including their subtypes.
 *
 * It keeps a map keyed by the SRV target with the PTR, A and AAAA data of each target. Every record expires when its
 * TTL has elapsed or when a goodbye (TTL 0) is received (RFC 6762 §10.1), and the cache-flush bit is honored (RFC 6762 §10.2).
 * The records are queried again at 80%, 85%, 90% and 95% of their TTL, so the ones still alive are refreshed (RFC 6762 §5.2).
 * The map is logged every minute.
 */
export class MdnsScanner extends EventEmitter<MdnsScannerEvents> {
  readonly log: AnsiLogger;
  readonly interfaceName: string | undefined;
  readonly mdnsPort: number;
  readonly services: string[];
  readonly sockets: Partial<Record<MdnsScannerFamily, Mdns>> = {};
  /** The devices keyed by the lower case SRV target. */
  readonly devices = new Map<string, MdnsScannerDevice>();
  private readonly scannerSockets: Partial<Record<MdnsScannerFamily, MdnsScannerSocket>> = {};
  private readonly codec: Mdns;
  private readonly query: boolean;
  private readonly refresh: boolean;
  private readonly logIntervalMs: number;
  private readonly records = new Map<string, CachedRecord>();
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
    this.services = options.services ?? [...MDNS_SCANNER_MATTER_SERVICES];
    this.query = options.query ?? true;
    this.refresh = options.refresh ?? true;
    this.logIntervalMs = options.logIntervalMs ?? MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS;
    if (this.services.length === 0) throw new Error('MdnsScanner: at least one service is required');
    for (const service of this.services) {
      if (!/^_[A-Za-z0-9-]{1,15}\._(tcp|udp)$/.test(service)) throw new Error(`MdnsScanner: invalid service ${service}`);
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
   * Opens the sockets, sends the PTR queries and starts the expire and log timers.
   *
   * @returns {Promise<void>} Resolves when the sockets are ready.
   */
  async start(): Promise<void> {
    if (this.started) throw new Error('MdnsScanner: already started');
    this.started = true;
    // RFC 6762 §15.1: only the first socket bound to the port receives the unicast responses, so check it before binding ours
    for (const family of this.families()) {
      this.firstOnPort[family] = await isFirstOnPort(family === 'ipv4' ? 'udp4' : 'udp6', this.mdnsPort);
      if (!this.firstOnPort[family] && this.query)
        this.log.info(`Another mDNS responder is bound to ${family} port ${this.mdnsPort}: querying without unicast responses (RFC 6762 §15.1)`);
    }
    await Promise.all(this.families().map(async (family) => this.startSocket(family)));
    this.log.info(`Scanning ${CYAN}${this.services.join(', ')}${nf} on ${CYAN}${this.interfaceName ?? 'all interfaces'}${nf}`);
    this.expireTimer = setInterval(() => {
      this.expire();
      this.sendRefreshQueries();
    }, EXPIRE_INTERVAL_MS).unref();
    if (this.logIntervalMs > 0) this.logTimer = setInterval(() => this.logDevices(), this.logIntervalMs).unref();
    if (this.query) this.sendQuery();
  }

  /**
   * Stops the timers and closes the sockets.
   *
   * @returns {Promise<void>} Resolves when the sockets are closed.
   */
  async stop(): Promise<void> {
    if (!this.started || this.stopped) return;
    this.stopped = true;
    clearInterval(this.expireTimer);
    clearInterval(this.logTimer);
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
   * Sends a PTR query for every service on each socket, one question per query: some responders do not answer the queries with several questions.
   * The first queries ask for unicast responses (QU) on the families where the scanner is the first socket bound to the mDNS port (RFC 6762 §5.4, §15.1),
   * so every responder answers even the records it multicast recently; the next ones ask for multicast responses (QM).
   */
  sendQuery(): void {
    for (const service of this.services) {
      for (const family of this.families()) {
        const unicastResponse = this.firstOnPort[family] && !this.queried;
        this.sockets[family]?.sendQuery([{ name: `${service}.local`, type: DnsRecordType.PTR, class: DnsClass.IN, unicastResponse }]);
      }
    }
    this.queried = true;
  }

  /**
   * Removes the records whose TTL has elapsed and updates the devices.
   */
  expire(): void {
    const now = Date.now();
    let changed = false;
    for (const [key, record] of this.records) {
      if (record.expires > now) continue;
      this.records.delete(key);
      changed = true;
    }
    if (changed) this.updateDevices();
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
    // Keep only the known answers that fit in one message; the sizes are uncompressed, so the compressed packet is smaller.
    // A known answer left out only costs an answer the responder sends again.
    const nameLength = (name: string): number => Buffer.byteLength(name) + 2;
    for (const { name, type } of due.values()) {
      let length = 12 + nameLength(name) + 4;
      const answers: KnownAnswer[] = [];
      for (const answer of this.knownAnswers({ name, type }, now)) {
        length += nameLength(answer.name) + 10 + answer.rdata.length;
        if (length > MDNS_MAX_MESSAGE_LENGTH) break;
        answers.push(answer);
      }
      for (const family of this.families()) this.sockets[family]?.sendQuery([{ name, type, class: DnsClass.IN }], answers);
    }
  }

  /**
   * Logs the devices.
   */
  logDevices(): void {
    this.expire();
    const now = Date.now();
    const list = (records: Map<string, number>): string =>
      [...records].map(([data, expires]) => `${CYAN}${data}${nf} (${MAGENTA}${Math.max(0, Math.round((expires - now) / 1000))}${nf}s)`).join(', ') || 'none';
    this.log.info(`Matter devices: ${MAGENTA}${this.devices.size}${nf}`);
    for (const device of [...this.devices.values()].toSorted((a, b) => a.target.localeCompare(b.target))) {
      this.log.info(`- ${GREEN}${device.target}${nf} ${MAGENTA}${device.types.join(', ')}${nf}`);
      this.log.info(`  PTR ${list(device.ptr)}`);
      this.log.info(`  A ${list(device.a)}`);
      this.log.info(`  AAAA ${list(device.aaaa)}`);
    }
  }

  // --------------------------------------------------------------------------------------------
  // Receiving
  // --------------------------------------------------------------------------------------------

  /**
   * Opens a socket and waits until it is ready.
   *
   * @param {MdnsScannerFamily} family - The socket family.
   * @returns {Promise<void>} Resolves when the socket is ready.
   */
  private async startSocket(family: MdnsScannerFamily): Promise<void> {
    const socket = this.scannerSockets[family];
    /* v8 ignore next - startSocket() is only called for the families with a socket */
    if (!socket) return;
    socket.onPacket = (msg: Buffer, rinfo: dgram.RemoteInfo): void => this.handlePacket(socket, msg, rinfo);
    await new Promise<void>((resolve, reject) => {
      socket.once('ready', () => {
        socket.on('error', (error) => {
          this.log.error(`Socket ${family} error: ${getErrorMessage(error)}`);
          if (this.listenerCount('error') > 0) this.emit('error', error);
        });
        resolve();
      });
      socket.once('error', reject);
      try {
        socket.start();
      } catch (error) {
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
    const received = [...(message.answers ?? []), ...(message.additionals ?? [])];
    const now = Date.now();
    let changed = false;
    // The PTR and SRV records first, so the A and AAAA records of the targets in the same packet are kept
    for (const record of received) {
      if (record.type === DnsRecordType.PTR && this.isServicePtr(record.name, record.data))
        changed = this.cache(record.name, record.type, record.data, record.class, record.cacheFlush, record.ttl, now) || changed;
      if (record.type === DnsRecordType.SRV && this.isServiceInstance(record.name)) {
        const target = srvTarget(record.data);
        if (target === undefined) continue;
        changed = this.cache(record.name, record.type, target, record.class, record.cacheFlush, record.ttl, now) || changed;
      }
    }
    for (const record of received) {
      if ((record.type === DnsRecordType.A || record.type === DnsRecordType.AAAA) && this.isTarget(record.name)) {
        changed = this.cache(record.name, record.type, record.data, record.class, record.cacheFlush, record.ttl, now) || changed;
      }
    }
    if (changed) this.updateDevices();
  }

  /**
   * Adds, refreshes or removes (goodbye) a record in the cache.
   *
   * @param {string} name - The owner name.
   * @param {DnsRecordType} type - The record type.
   * @param {string} data - The record data.
   * @param {DnsClass} rrclass - The record class.
   * @param {boolean} cacheFlush - True when the record has the cache-flush bit set.
   * @param {number} ttl - The TTL in seconds.
   * @param {number} now - The current time in ms.
   * @returns {boolean} True if the cache changed.
   */
  private cache(name: string, type: DnsRecordType, data: string, rrclass: DnsClass, cacheFlush: boolean, ttl: number, now: number): boolean {
    if (rrclass !== DnsClass.IN) return false;
    const key = `${name.toLowerCase()}|${type}|${data.toLowerCase()}`;
    if (ttl === 0) {
      // RFC 6762 §10.1: a goodbye is recorded as a TTL of 1 and the record is deleted one second later
      this.log.debug(`Goodbye received for ${name} ${type} ${data}`);
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
        if (otherKey === key || other.type !== type || other.name.toLowerCase() !== name.toLowerCase()) continue;
        if (now - other.received > CACHE_FLUSH_GRACE_MS) other.expires = Math.min(other.expires, now + CACHE_FLUSH_GRACE_MS);
      }
    }
    const refreshAt = REFRESH_PERCENTS.map((percent) => now + ttl * 10 * (percent + Math.random() * REFRESH_JITTER_PERCENT));
    this.records.set(key, { name, type, data, received: now, expires: now + ttl * 1000, ttl, refreshAt });
    return true;
  }

  /**
   * Returns the known answers of a refresh question: the cached records of the same name and type with more than half of their TTL left (RFC 6762 §7.1).
   * The SRV records are not included, since only their target is cached.
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
      if (record.type === DnsRecordType.PTR) rdata = this.codec.encodeDnsName(record.data);
      else if (record.type === DnsRecordType.A) rdata = this.codec.encodeA(record.data);
      else if (record.type === DnsRecordType.AAAA) rdata = this.codec.encodeAAAA(record.data);
      else continue;
      answers.push({ name: record.name, rtype: record.type, rclass: DnsClass.IN, ttl: Math.floor((record.expires - now) / 1000), rdata });
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
    const lowerName = name.toLowerCase();
    const lowerData = data.toLowerCase();
    return this.services.some((service) => {
      const serviceName = `${service}.local`.toLowerCase();
      return (lowerName === serviceName || lowerName.endsWith(`._sub.${serviceName}`)) && lowerData.endsWith(`.${serviceName}`);
    });
  }

  /**
   * Returns true when a name is an instance of a scanned service.
   *
   * @param {string} name - The name, e.g. `87E1B004E235A130-8FC7772401CD0696._matter._tcp.local`.
   * @returns {boolean} True if relevant.
   */
  private isServiceInstance(name: string): boolean {
    const lowerName = name.toLowerCase();
    return this.services.some((service) => lowerName.endsWith(`.${service}.local`.toLowerCase()));
  }

  /**
   * Returns true when a name is the target of a cached SRV record.
   *
   * @param {string} name - The host name.
   * @returns {boolean} True if a target.
   */
  private isTarget(name: string): boolean {
    const lowerName = name.toLowerCase();
    for (const record of this.records.values()) if (record.type === DnsRecordType.SRV && record.data.toLowerCase() === lowerName) return true;
    return false;
  }

  /**
   * Rebuilds the devices from the cached records and emits the added and removed events.
   */
  private updateDevices(): void {
    const records = [...this.records.values()];
    const next = new Map<string, MdnsScannerDevice>();
    const set = (map: Map<string, number>, data: string, expires: number): void => {
      map.set(data, Math.max(map.get(data) ?? 0, expires));
    };
    for (const srv of records.filter((record) => record.type === DnsRecordType.SRV)) {
      const key = srv.data.toLowerCase();
      let device = next.get(key);
      if (!device) {
        device = { target: srv.data, types: [], ptr: new Map(), a: new Map(), aaaa: new Map() };
        next.set(key, device);
      }
      const instance = srv.name.toLowerCase();
      const service = this.services.find((candidate) => instance.endsWith(`.${candidate}.local`.toLowerCase()));
      const label = service && (SERVICE_LABELS[service] ?? service);
      if (label && !device.types.includes(label)) device.types = [...device.types, label].toSorted();
      for (const ptr of records) if (ptr.type === DnsRecordType.PTR && ptr.data.toLowerCase() === instance) set(device.ptr, ptr.data, ptr.expires);
    }
    for (const address of records.filter((record) => record.type === DnsRecordType.A || record.type === DnsRecordType.AAAA)) {
      const device = next.get(address.name.toLowerCase());
      if (device) set(address.type === DnsRecordType.A ? device.a : device.aaaa, address.data, address.expires);
    }
    // Addresses without a target are no longer needed
    for (const [key, record] of this.records) {
      if ((record.type === DnsRecordType.A || record.type === DnsRecordType.AAAA) && !next.has(record.name.toLowerCase())) this.records.delete(key);
    }
    const removed = [...this.devices].filter(([key]) => !next.has(key)).map(([, device]) => device);
    const added = [...next].filter(([key]) => !this.devices.has(key)).map(([, device]) => device);
    this.devices.clear();
    for (const [key, device] of next) this.devices.set(key, device);
    for (const device of removed) {
      this.log.info(`Removed ${GREEN}${device.target}${nf}`);
      this.emit('removed', device);
    }
    for (const device of added) {
      this.log.info(`Added ${GREEN}${device.target}${nf}`);
      this.emit('added', device);
    }
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

/**
 * Returns the target of an SRV record from its decoded data (see {@link Mdns.decodeResourceRecord}).
 *
 * @param {string} data - The SRV data, e.g. `{"priority":0,"weight":0,"port":5540,"target":"B75AFB458ECD0000.local"}`.
 * @returns {string | undefined} The target, or undefined if the data is not valid.
 */
function srvTarget(data: string): string | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return undefined;
  }
  return typeof parsed === 'object' && parsed !== null && 'target' in parsed && typeof parsed.target === 'string' ? parsed.target : undefined;
}

/** The help of the `mdns-scan` bin. */
export const MDNS_SCAN_HELP = `Usage: mdns-scan [options]

Scans the Matter DNS-SD services (or the ones given) with mDNS over IPv4 and IPv6, and logs the devices every minute.
Stop it with Ctrl+C.

Options:
  --interface <name>        Network interface to scan on (default: all the interfaces)
  --query                   Query the services on start (default: only listen)
  --service <type>          Service type to scan, as _service._tcp or _service._udp; repeat it for more services
                            (default: ${MDNS_SCANNER_MATTER_SERVICES.join(', ')})
  --no-refresh              Do not query the records again at 80-95% of their TTL
  --log-interval <seconds>  Seconds between two logs of the devices, 0 disables them (default: ${MDNS_SCANNER_DEFAULT_LOG_INTERVAL_MS / 1000})
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
  const config = {
    args: argv,
    options: {
      'interface': { type: 'string' },
      'query': { type: 'boolean' },
      'service': { type: 'string', multiple: true },
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
  if (logInterval !== undefined && (!Number.isFinite(logInterval) || logInterval < 0)) return commandLineError(`invalid --log-interval ${values['log-interval']}`);
  let scanner: MdnsScanner;
  try {
    scanner = new MdnsScanner({
      interfaceName: values.interface,
      query: values.query === true,
      services: values.service,
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
