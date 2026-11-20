/**
 * @file packages/dgram/src/mdnsResponder.ts
 * @description Shared RFC 6762 / RFC 6763 mDNS and DNS-SD responder.
 * @author Luca Liguori
 * @created 2026-09-28
 * @version 1.0.5
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

/* oxlint-disable no-bitwise */

/* oxlint-disable max-lines -- Keep the single-interface RFC 6762 state machine together. */

// Node.js imports
import type dgram from 'node:dgram';
import type { SocketType } from 'node:dgram';
import EventEmitter from 'node:events';
import os from 'node:os';

// @matterbridge
import { getErrorMessage } from '@matterbridge/utils/error';
// AnsiLogger imports
import { AnsiLogger, BLUE, CYAN, LogLevel, nf, TimestampFormat } from 'node-ansi-logger';

// Dgram imports
import { DnsClass, DnsClassFlag, DnsHeaderFlag, DnsRecordType, isFirstOnPort, Mdns, MDNS_MAX_MESSAGE_LENGTH } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';

/** TTL in seconds of the records that contain a host name, as name or in the rdata: A, AAAA, SRV and their NSEC (RFC 6762 §10). */
export const MDNS_HOST_RECORD_TTL = 120;
/** TTL in seconds of the other records: PTR, TXT and the instance NSEC (RFC 6762 §10, 75 minutes). */
export const MDNS_OTHER_RECORD_TTL = 4500;
/** Implementation polling interval in ms; RFC 6762 §8.4 requires updates but prescribes no polling period. */
export const MDNS_ADVERTISE_DEFAULT_ADDRESS_CHECK_MS = 10000;

const SERVICES_ENUMERATION_NAME = '_services._dns-sd._udp.local'; // RFC 6763 §9
const PROBE_MAX_INITIAL_DELAY_MS = 250; // RFC 6762 §8.1
const PROBE_INTERVAL_MS = 250; // RFC 6762 §8.1
const PROBE_COUNT = 3; // RFC 6762 §8.1
const PROBE_TIEBREAK_LOST_DELAY_MS = 1000; // RFC 6762 §8.2
const PROBE_CONFLICT_WINDOW_MS = 10000; // RFC 6762 §8.1
const PROBE_CONFLICT_LIMIT = 15; // RFC 6762 §8.1
const PROBE_THROTTLE_DELAY_MS = 5000; // RFC 6762 §8.1
const PROBE_FAILURE_ERROR_MS = 60000; // RFC 6762 §9 step 5
/** Default number of unsolicited announcements; RFC 6762 §8.3 requires at least 2 and allows up to 8. */
export const MDNS_ANNOUNCE_DEFAULT_COUNT = 8;
const ANNOUNCE_MIN_COUNT = 2; // RFC 6762 §8.3
const ANNOUNCE_MAX_COUNT = 8; // RFC 6762 §8.3
const ANNOUNCE_FIRST_INTERVAL_MS = 1000; // RFC 6762 §8.3: one second, then doubling
const RESPONSE_MIN_DELAY_MS = 20; // RFC 6762 §6
const RESPONSE_MAX_DELAY_MS = 120; // RFC 6762 §6
const TRUNCATED_MIN_DELAY_MS = 400; // RFC 6762 §6, §7.2
const TRUNCATED_MAX_DELAY_MS = 500; // RFC 6762 §6, §7.2
const MULTICAST_MIN_INTERVAL_MS = 1000; // RFC 6762 §6
const PROBE_DEFENSE_MIN_INTERVAL_MS = 250; // RFC 6762 §6
const LEGACY_UNICAST_MAX_TTL = 10; // RFC 6762 §6.7
const GOODBYE_CLOSE_DELAY_MS = 100;

/**
 * Options of {@link MdnsResponder}. Service identity and interface are supplied by the caller.
 */
export interface MdnsResponderOptions {
  /** Service port advertised in the SRV records, 1..65535. */
  port: number;
  /** DNS-SD subtype labels, applied to each service. */
  subtypes?: string[];
  /** Restrict published addresses to this local IP address. */
  address?: string;
  /** Reject packets whose source belongs to another interface. */
  restrictInterfacePackets?: boolean;
  /** Restrict advertised address records to this family. */
  addressFamily?: 'ipv4' | 'ipv6';
  /** Resolve a conflicting name; undefined stops advertising that claim. */
  resolveConflict?: (kind: 'host' | 'instance', current: string) => string | undefined;

  /** Host label without `.local`, supplied by the service advertiser. */
  hostName: string;
  /** Refresh the application-provided host label during address checks. */
  hostNameProvider?: () => string | undefined;
  /** Alias host label (without `.local`) also claimed for the addresses, given up on conflict. Omitted or `false` disables it. */
  alias?: string | false;
  /** Service instance name (RFC 6763 §4.1.1): user friendly Net-Unicode text, at most 63 UTF-8 bytes. */
  instanceName: string;
  /** Service types as `_service._tcp` or `_service._udp`. */
  services: string[];
  /** TXT entries as `key=value`. Defaults to an empty TXT record. */
  txt?: string[];
  /** Network interface to advertise on, supplied by the service advertiser. */
  interfaceName: string;
  /** Advertise on IPv4 (224.0.0.251). Defaults to true. */
  enableIpv4?: boolean;
  /** Advertise on IPv6 (ff02::fb). Defaults to true. */
  enableIpv6?: boolean;
  /** Interval in ms between two checks of the interface addresses, 0 disables it. Defaults to {@link MDNS_ADVERTISE_DEFAULT_ADDRESS_CHECK_MS}. */
  addressCheckIntervalMs?: number;
  /** Number of unsolicited announcements, 2..8 (RFC 6762 §8.3): one second apart, then doubling. Defaults to {@link MDNS_ANNOUNCE_DEFAULT_COUNT}. */
  announceCount?: number;
  /** mDNS UDP port. Defaults to 5353; only tests should change it. */
  mdnsPort?: number;
}

/**
 * Events emitted by {@link MdnsResponder}.
 */
export interface MdnsResponderEvents {
  /** The records have been announced (first packet of each announcement sequence). */
  announced: [];
  /** A name was in use by another host and has been changed (RFC 6762 §9): the application should store the new name. */
  nameChanged: [kind: 'host' | 'instance', oldName: string, newName: string];
  /** The alias was in use by another host and has been given up. */
  aliasLost: [alias: string];
  /** A socket error. */
  error: [error: Error];
}

/** A socket family of the advertiser. */
export type MdnsResponderFamily = 'ipv4' | 'ipv6';

/** The unique names the advertiser claims by probing (RFC 6762 §8.1). */
type ClaimKind = 'host' | 'alias' | 'instance';

/** The state of a claim: being probed, owned (probed and announced) or lost (alias only). */
type ClaimState = 'probing' | 'owned' | 'lost';

/**
 * A resource record owned by the advertiser.
 */
export interface MdnsResponderRecord {
  /** Full name, e.g. `example-host.local`. */
  name: string;
  /** Record type. */
  type: DnsRecordType;
  /** TTL in seconds. */
  ttl: number;
  /** Uncompressed rdata. */
  rdata: Buffer;
  /** Unique (cache-flush) or shared record (RFC 6762 §2). */
  unique: boolean;
  /** The claim a unique record belongs to. */
  claim?: ClaimKind;
  /** The name in the rdata of PTR and SRV records. */
  target?: string;
}

/** A decoded question. */
interface ParsedQuestion {
  name: string;
  type: DnsRecordType;
  qclass: DnsClass;
  qu: boolean;
}

/** A decoded resource record with its uncompressed rdata. */
interface ParsedRecord {
  name: string;
  type: DnsRecordType;
  rrclass: DnsClass;
  ttl: number;
  rdata: Buffer;
}

/** A decoded message with raw uncompressed rdata, needed to compare records (RFC 6762 §8.2, §9). */
interface ParsedMessage {
  id: number;
  qr: number;
  opcode: number;
  tc: boolean;
  rcode: number;
  questions: ParsedQuestion[];
  answers: ParsedRecord[];
  authorities: ParsedRecord[];
  additionals: ParsedRecord[];
}

/** Pending multicast answers of one socket, aggregated until sent (RFC 6762 §6.4). */
interface MulticastBatch {
  answers: Map<string, MdnsResponderRecord>;
  additionals: Map<string, MdnsResponderRecord>;
  minInterval: number;
  timer?: NodeJS.Timeout;
}

/** A query with the TC bit waiting for its Known-Answer packets (RFC 6762 §7.2). */
interface TruncatedQuery {
  family: MdnsResponderFamily;
  message: ParsedMessage;
  knownAnswers: ParsedRecord[];
  rinfo: dgram.RemoteInfo;
  timer?: NodeJS.Timeout;
}

/**
 * Mdns socket used by the advertiser: it hands the raw packets to the advertiser instead of logging them.
 */
class MdnsResponderSocket extends Mdns {
  onPacket?: (msg: Buffer, rinfo: dgram.RemoteInfo) => void;

  /**
   * Creates the socket of one family.
   *
   * @param {string} name - The name of the socket for the logs.
   * @param {string} multicastAddress - The mDNS multicast address (224.0.0.251 or ff02::fb).
   * @param {number} multicastPort - The mDNS port.
   * @param {SocketType} socketType - The socket type.
   * @param {string} interfaceName - The interface to join the multicast group on.
   * @param {string} interfaceAddress - The address to bind to (0.0.0.0 or ::).
   */
  constructor(name: string, multicastAddress: string, multicastPort: number, socketType: SocketType, interfaceName: string, interfaceAddress: string) {
    super(name, multicastAddress, multicastPort, socketType, true, interfaceName, interfaceAddress);
  }

  /**
   * Hands a received packet to the advertiser.
   *
   * @param {Buffer} msg - Received datagram.
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   */
  override onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    this.onPacket?.(msg, rinfo);
  }

  /**
   * Sends a packet best-effort: a destination that cannot be reached loses that packet and does not fail the socket.
   *
   * @remarks
   * A unicast reply (RFC 6762 §5.4, §6.7) goes to the address of the querier, which may have left the link since
   * its query (EHOSTUNREACH, ENETUNREACH, EHOSTDOWN). mDNS has no delivery guarantee: the querier asks again.
   *
   * @param {Buffer} msg - The packet.
   * @param {string} serverAddress - Destination address.
   * @param {number} serverPort - Destination port.
   */
  override send(msg: Buffer, serverAddress: string, serverPort: number): void {
    this.socket.send(msg, 0, msg.length, serverPort, serverAddress, (error: Error | null) => {
      if (error) {
        this.log.warn(`Packet to ${serverAddress}:${serverPort} dropped: ${getErrorMessage(error)}`);
        return;
      }
      this.emit('sent', msg, serverAddress, serverPort);
      this.onSent(msg, serverAddress, serverPort);
    });
  }
}

/**
 * RFC 6762 (mDNS) and RFC 6763 (DNS-SD) responder that advertises DNS-SD services on one interface, over IPv4 and IPv6.
 *
 * It claims its unique names by probing (§8.1, §8.2, §9), announces its records (§8.3), answers queries (§5.4, §6, §7)
 * with known-answer suppression, negative NSEC answers, additional records and unicast replies, re-announces on changes (§8.4)
 * and sends goodbyes on stop (§10.1). Every A and AAAA record is sent on both the IPv4 and the IPv6 socket (§6.2).
 *
 * @remarks
 * Each instance advertises one interface. Multiple instances do not guarantee receive isolation: standard Node/Bun
 * sockets omit receiving-interface metadata. Source/IPv6-zone checks are best-effort; strict link scoping (§14)
 * requires a transport supplying handlePacket context. Conflict-resolved names are independent per instance.
 */
export class MdnsResponder extends EventEmitter<MdnsResponderEvents> {
  readonly log: AnsiLogger;
  readonly interfaceName: string;
  readonly mdnsPort: number;
  readonly sockets: Partial<Record<MdnsResponderFamily, Mdns>> = {};
  private readonly advertiseSockets: Partial<Record<MdnsResponderFamily, MdnsResponderSocket>> = {};

  private readonly options: MdnsResponderOptions;
  private port: number;
  private txt: string[];
  private readonly services: string[];
  private hostBase: string;
  private hostCounter = 1;
  private hostLabel: string;
  private providerHostLabel: string;
  private readonly instanceBase: string;
  private instanceCounter = 1;
  private instanceLabel: string;
  private readonly aliasLabel: string | undefined;
  private readonly addressCheckIntervalMs: number;
  private readonly announceCount: number;
  private readonly codec: Mdns;

  private readonly claims = new Map<ClaimKind, ClaimState>();
  private ipv4Addresses: string[] = [];
  private ipv6Addresses: string[] = [];
  private readonly timers = new Set<NodeJS.Timeout>();
  private started = false;
  private stopped = false;
  private probeTimer: NodeJS.Timeout | undefined;
  private probesSent = 0;
  private probeWindowOpen = false;
  private conflictTimes: number[] = [];
  private firstConflictTime: number | undefined;
  private probeFailureLogged = false;
  private announceTimer: NodeJS.Timeout | undefined;
  private addressTimer: NodeJS.Timeout | undefined;
  private readonly batches: Partial<Record<MdnsResponderFamily, MulticastBatch>> = {};
  private readonly lastMulticast: Record<MdnsResponderFamily, Map<string, number>> = { ipv4: new Map(), ipv6: new Map() };
  private readonly pendingMulticast: Record<MdnsResponderFamily, Map<string, { record: MdnsResponderRecord; answer: boolean; interval: number }>> = {
    ipv4: new Map(),
    ipv6: new Map(),
  };
  private readonly multicastTimers: Partial<Record<MdnsResponderFamily, NodeJS.Timeout>> = {};
  private readonly truncatedQueries = new Map<string, TruncatedQuery>();
  private announcedResolve: (() => void) | undefined;
  private readonly firstOnPort: Record<MdnsResponderFamily, boolean> = { ipv4: true, ipv6: true };

  /**
   * Creates the advertiser. It does not open the sockets: call {@link MdnsResponder.start}.
   *
   * @param {MdnsResponderOptions} options - The advertiser options.
   * @throws {Error} If no usable interface is found or an option is invalid.
   */
  constructor(options: MdnsResponderOptions) {
    super();
    this.options = { ...options, subtypes: options.subtypes ? [...options.subtypes] : undefined };
    this.log = new AnsiLogger({ logName: 'MdnsResponder', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.INFO });
    this.mdnsPort = options.mdnsPort ?? MDNS_MULTICAST_PORT;
    this.port = options.port;
    this.txt = [...(options.txt ?? [])];
    this.services = [...options.services];
    this.addressCheckIntervalMs = options.addressCheckIntervalMs ?? MDNS_ADVERTISE_DEFAULT_ADDRESS_CHECK_MS;
    this.announceCount = options.announceCount ?? MDNS_ANNOUNCE_DEFAULT_COUNT;
    if (!Number.isInteger(this.announceCount) || this.announceCount < ANNOUNCE_MIN_COUNT || this.announceCount > ANNOUNCE_MAX_COUNT)
      throw new RangeError(`MdnsResponder: announceCount must be an integer from ${ANNOUNCE_MIN_COUNT} to ${ANNOUNCE_MAX_COUNT}`);

    const interfaceName = options.interfaceName;
    if (!interfaceName || !os.networkInterfaces()[interfaceName]) throw new Error(`MdnsResponder: network interface ${interfaceName ?? '(none found)'} not available`);
    this.interfaceName = interfaceName;
    this.hostBase = options.hostName;
    this.instanceBase = options.instanceName;
    this.aliasLabel = options.alias === false ? undefined : options.alias;
    this.hostLabel = this.hostBase;
    this.providerHostLabel = this.hostBase;
    this.instanceLabel = this.instanceBase;
    this.validateOptions();

    if (options.enableIpv4 !== false) {
      this.advertiseSockets.ipv4 = new MdnsResponderSocket('MdnsResponderUdp4', MDNS_MULTICAST_IPV4_ADDRESS, this.mdnsPort, 'udp4', interfaceName, '0.0.0.0');
    }
    if (options.enableIpv6 !== false) {
      this.advertiseSockets.ipv6 = new MdnsResponderSocket('MdnsResponderUdp6', MDNS_MULTICAST_IPV6_ADDRESS, this.mdnsPort, 'udp6', interfaceName, '::');
    }
    this.sockets.ipv4 = this.advertiseSockets.ipv4;
    this.sockets.ipv6 = this.advertiseSockets.ipv6;
    const codec = this.sockets.ipv4 ?? this.sockets.ipv6;
    if (!codec) throw new Error('MdnsResponder: at least one of IPv4 and IPv6 must be enabled');
    this.codec = codec;
    this.readAddresses();
    // RFC 6762 §8.2 and §17: each unique name's complete proposal must fit together.
    for (const kind of ['host', 'alias', 'instance'] as const) {
      for (const name of this.claimNames(kind)) {
        const authorities = this.proposedRecords([kind]).filter((record) => sameName(record.name, name));
        const packet = this.buildPacket({
          id: 0,
          flags: 0,
          questions: [{ name, type: DnsRecordType.ANY, qclass: DnsClass.IN, qu: true }],
          answers: [],
          authorities,
          additionals: [],
          legacy: false,
        });
        if (packet.length > MDNS_MAX_MESSAGE_LENGTH) throw new Error('MdnsResponder: probe exceeds packet limit');
      }
    }
  }

  /**
   * The current full host name.
   *
   * @returns {string} The host name, e.g. `example-host.local`.
   */
  get hostName(): string {
    return `${this.hostLabel}.local`;
  }

  /**
   * The alias full host name, only while it is owned.
   *
   * @returns {string | undefined} The alias, e.g. `example-alias.local`.
   */
  get aliasName(): string | undefined {
    return this.aliasLabel && this.claims.get('alias') === 'owned' ? `${this.aliasLabel}.local` : undefined;
  }

  /**
   * The current service instance name.
   *
   * @returns {string} The instance name, e.g. `Example service`.
   */
  get instanceName(): string {
    return this.instanceLabel;
  }

  /**
   * Opens the sockets, probes the names and announces the records.
   *
   * @returns {Promise<void>} Resolves when the records have been announced for the first time (or the advertiser is stopped).
   */
  async start(): Promise<void> {
    if (this.started) throw new Error('MdnsResponder: already started');
    this.started = true;
    this.claims.set('host', 'probing');
    this.claims.set('instance', 'probing');
    if (this.aliasLabel) this.claims.set('alias', 'probing');

    const announced = new Promise<void>((resolve) => {
      this.announcedResolve = resolve;
    });
    for (const family of this.families()) {
      this.firstOnPort[family] = await isFirstOnPort(family === 'ipv4' ? 'udp4' : 'udp6', this.mdnsPort);
      if (!this.firstOnPort[family])
        this.sockets[family]?.log.info(`Another mDNS responder is bound to ${family} port ${this.mdnsPort}: probing without unicast responses (RFC 6762 §15.1)`);
    }
    if (this.stopped) return;
    await Promise.all(this.families().map(async (family) => this.startSocket(family)));
    if (this.stopped) return;
    this.log.info(`Advertising ${CYAN}${this.instanceLabel}${nf} on ${CYAN}${this.hostName}${nf} port ${BLUE}${this.port}${nf} on interface ${CYAN}${this.interfaceName}${nf}`);
    if (this.addressCheckIntervalMs > 0) {
      this.addressTimer = setInterval(() => this.checkAddresses(), this.addressCheckIntervalMs).unref();
    }
    this.startProbing();
    await announced;
  }

  /**
   * Sends the goodbye packets (RFC 6762 §10.1) and closes the sockets.
   *
   * @returns {Promise<void>} Resolves when the sockets are closed.
   */
  async stop(): Promise<void> {
    if (!this.started || this.stopped) return;
    this.stopped = true;
    this.clearTimers();
    if (this.addressTimer) clearInterval(this.addressTimer);
    const goodbye = this.activeRecords();
    if (goodbye.length > 0) {
      this.log.info(`Sending goodbye for ${CYAN}${this.hostName}${nf} and ${CYAN}${this.instanceLabel}${nf}`);
      for (const family of this.families()) this.sendMulticast(family, goodbye, [], 0);
    }
    this.announcedResolve?.();
    await new Promise<void>((resolve) => setTimeout(resolve, GOODBYE_CLOSE_DELAY_MS));
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
   * Changes the port and/or the TXT entries and re-announces the records (RFC 6762 §8.4). No new probe is needed.
   * Do not update more than ten times per minute (RFC 6762 §8.4).
   *
   * @param {{ port?: number; txt?: string[] }} changes - The new port and/or TXT entries.
   * @throws {Error} If a new value is invalid; the previous values are kept.
   */
  update(changes: { port?: number; txt?: string[] }): void {
    const previous = { port: this.port, txt: this.txt };
    if (changes.port !== undefined) this.port = changes.port;
    if (changes.txt !== undefined) this.txt = [...changes.txt];
    try {
      this.validateOptions();
    } catch (error) {
      this.port = previous.port;
      this.txt = previous.txt;
      throw error;
    }
    if (this.started && !this.stopped && this.claims.get('instance') === 'owned') this.startAnnouncing();
  }

  /**
   * Returns the records currently advertised: the ones of the owned claims and their shared PTR records.
   *
   * @returns {MdnsResponderRecord[]} The active records.
   */
  activeRecords(): MdnsResponderRecord[] {
    return this.buildRecords().filter((record) => {
      if (record.claim) return this.claims.get(record.claim) === 'owned';
      return this.claims.get('instance') === 'owned'; // Shared PTR records point to the instances
    });
  }

  /**
   * Sends a packet. Every packet of the advertiser goes through this method.
   *
   * @param {MdnsResponderFamily} family - The socket to send from.
   * @param {Buffer} packet - The packet.
   * @param {string} address - Destination address.
   * @param {number} port - Destination port.
   */
  transmit(family: MdnsResponderFamily, packet: Buffer, address: string, port: number): void {
    this.sockets[family]?.send(packet, address, port);
  }

  // --------------------------------------------------------------------------------------------
  // Interface and records
  // --------------------------------------------------------------------------------------------

  /**
   * Validates the names, services, port and TXT entries.
   *
   * @throws {Error} If an option is invalid.
   */
  private validateOptions(): void {
    // Host labels use an ASCII LDH API policy; RFC 6763 §4.1.1 instance labels allow punctuation.
    const hostLabel = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;
    if (!hostLabel.test(this.hostBase)) throw new Error(`MdnsResponder: invalid host name ${this.hostBase}`);
    if (this.aliasLabel !== undefined && !hostLabel.test(this.aliasLabel)) throw new Error(`MdnsResponder: invalid alias ${this.aliasLabel}`);
    const invalidInstance = !this.instanceBase || hasControlCharacters(this.instanceBase) || Buffer.byteLength(this.instanceBase) > 63;
    if (invalidInstance) throw new Error(`MdnsResponder: invalid instance name ${this.instanceBase}`);
    // RFC 6763 §7.1: subtype labels need not begin with an underscore.
    for (const subtype of this.options.subtypes ?? []) {
      if (!subtype || Buffer.byteLength(subtype) > 63) throw new Error(`MdnsResponder: invalid subtype ${subtype}`);
    }
    if (this.services.length === 0) throw new Error('MdnsResponder: at least one service is required');
    for (const service of this.services) {
      const validShape = /^_[A-Za-z0-9](?:[A-Za-z0-9-]{0,13}[A-Za-z0-9])?\._(tcp|udp)$/.test(service);
      const hasLetter = /[A-Za-z]/.test(service.split('.')[0]);
      if (!validShape || !hasLetter || service.includes('--')) throw new Error(`MdnsResponder: invalid service ${service}`);
    }
    if (!Number.isInteger(this.port) || this.port < 1 || this.port > 65535) throw new Error(`MdnsResponder: invalid port ${this.port}`);
    // RFC 6763 §6.1 / §6.4: 255-byte strings, nonempty printable ASCII keys, no duplicate keys.
    const keys = new Set<string>();
    for (const entry of this.txt) {
      if (Buffer.byteLength(entry) > 255) throw new Error(`MdnsResponder: TXT entry too long ${entry}`);
      if (entry === '' && this.txt.length === 1) continue;
      const key = entry.split('=')[0];
      if (!/^[\x20-\x3c\x3e-\x7e]+$/.test(key)) throw new Error('MdnsResponder: invalid TXT key');
      const canonical = dnsCase(key);
      if (keys.has(canonical)) throw new Error('MdnsResponder: duplicate TXT key');
      keys.add(canonical);
    }
    // RFC 6762 §17 discourages fragmentation. Our implementation caps records at the Ethernet payload.
    // This is an implementation limit, not the RFC's absolute 9000-byte fragmented-packet ceiling.
    for (const service of this.services) {
      const name = `${escapeLabel(this.instanceLabel)}.${service}.local`;
      const txtLength = this.txt.reduce((total, entry) => total + 1 + Buffer.byteLength(entry), 0);
      const size = 12 + this.codecNameLength(name) + 10 + Math.max(1, txtLength);
      if (size > MDNS_MAX_MESSAGE_LENGTH) throw new Error('MdnsResponder: TXT record exceeds packet limit');
    }
  }

  /**
   * Returns the uncompressed wire length of an instance name.
   * @param {string} name - Escaped DNS name.
   * @returns {number} Wire length including label lengths and root.
   */
  private codecNameLength(name: string): number {
    return Buffer.byteLength(name.replaceAll('\\.', '.').replaceAll('\\\\', '\\')) + 2;
  }

  /** Reads the addresses of the interface. */
  private readAddresses(): void {
    const infos = (os.networkInterfaces()[this.interfaceName] ?? []).filter(
      (info) => !info.internal && (!this.options.address || info.address.split('%')[0] === this.options.address.split('%')[0]),
    );
    this.ipv4Addresses = infos.filter((info) => info.family === 'IPv4' && this.options.addressFamily !== 'ipv6').map((info) => info.address);
    this.ipv6Addresses = infos.filter((info) => info.family === 'IPv6' && this.options.addressFamily !== 'ipv4').map((info) => info.address.split('%')[0]);
  }

  /** Re-probes and re-announces when the interface addresses change (RFC 6762 §8). */
  private checkAddresses(): void {
    const previousHost = this.hostName;
    const previous = this.activeRecords();
    const before = [...this.ipv4Addresses, ...this.ipv6Addresses].join(',');
    const nextHost = this.options.hostNameProvider?.();
    if (nextHost !== undefined) {
      if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(nextHost)) {
        this.log.error('Ignoring invalid host name from hostNameProvider');
        return;
      }
      // RFC 6762 §9: preserve a conflict-resolved name until the application identity actually changes.
      if (nextHost !== this.providerHostLabel) {
        this.providerHostLabel = nextHost;
        this.hostBase = nextHost;
        this.hostCounter = 1;
        this.hostLabel = nextHost;
      }
    }
    this.readAddresses();
    if (previousHost === this.hostName && before === [...this.ipv4Addresses, ...this.ipv6Addresses].join(',')) return;
    // RFC 6762 §8.4: address updates retain name ownership; cache-flush replaces old RDATA.
    // A changed host identity is a new claim and must complete §8.1 probing before publication.
    if (previousHost !== this.hostName) {
      for (const family of this.families()) this.sendMulticast(family, previous, [], 0);
      for (const [kind, state] of this.claims) if (state !== 'lost') this.claims.set(kind, 'probing');
      this.startProbing();
    } else if ([...this.claims.values()].includes('probing')) {
      this.startProbing();
    } else {
      // §10.1: an RRSet removed entirely needs a goodbye; no replacement can flush it.
      const current = this.activeRecords();
      const removed = previous.filter((record) => !current.some((candidate) => sameRrset(record, candidate)));
      for (const family of this.families()) this.sendMulticast(family, removed, [], 0);
      this.startAnnouncing();
    }
  }

  /**
   * Returns the full names of a claim.
   *
   * @param {ClaimKind} kind - The claim.
   * @returns {string[]} The full names.
   */
  private claimNames(kind: ClaimKind): string[] {
    if (kind === 'host') return [this.hostName];
    if (kind === 'alias') return this.aliasLabel ? [`${this.aliasLabel}.local`] : [];
    return this.services.map((service) => `${escapeLabel(this.instanceLabel)}.${service}.local`);
  }

  /**
   * Returns the claim that owns a name.
   *
   * @param {string} name - A full name.
   * @returns {ClaimKind | undefined} The claim.
   */
  private claimOf(name: string): ClaimKind | undefined {
    const lower = dnsCase(name);
    for (const kind of this.claims.keys()) {
      if (this.claimNames(kind).some((claimName) => dnsCase(claimName) === lower)) return kind;
    }
    return undefined;
  }

  /**
   * Builds all the records of the advertiser, whatever the claim state.
   *
   * @returns {MdnsResponderRecord[]} The records.
   */
  private buildRecords(): MdnsResponderRecord[] {
    const records: MdnsResponderRecord[] = [];
    // RFC 6762 §6.2 / §10: publish both address families with host TTLs, independently of transport.
    const addressNames: [string, ClaimKind][] = [[this.hostName, 'host']];
    if (this.aliasLabel) addressNames.push([`${this.aliasLabel}.local`, 'alias']);
    for (const [name, claim] of addressNames) {
      const types: DnsRecordType[] = [];
      for (const address of this.ipv4Addresses) records.push({ name, type: DnsRecordType.A, ttl: MDNS_HOST_RECORD_TTL, rdata: this.codec.encodeA(address), unique: true, claim });
      for (const address of this.ipv6Addresses)
        records.push({ name, type: DnsRecordType.AAAA, ttl: MDNS_HOST_RECORD_TTL, rdata: this.codec.encodeAAAA(address), unique: true, claim });
      if (this.ipv4Addresses.length > 0) types.push(DnsRecordType.A);
      if (this.ipv6Addresses.length > 0) types.push(DnsRecordType.AAAA);
      if (types.length > 0) records.push({ name, type: DnsRecordType.NSEC, ttl: MDNS_HOST_RECORD_TTL, rdata: this.encodeNsecRdata(name, types), unique: true, claim });
    }
    const txtRdata = this.txt.length > 0 ? this.codec.encodeTxtRdata(this.txt) : Buffer.from([0]); // RFC 6763 §6.1: an empty TXT is a single zero byte
    // RFC 6763 §4 / §5 / §6 / §9: PTR browsing, SRV endpoint, mandatory TXT, and type enumeration.
    for (const service of this.services) {
      const serviceName = `${service}.local`;
      const instance = `${escapeLabel(this.instanceLabel)}.${serviceName}`;
      records.push(
        {
          name: instance,
          type: DnsRecordType.SRV,
          ttl: MDNS_HOST_RECORD_TTL,
          rdata: this.codec.encodeSrvRdata(0, 0, this.port, this.hostName),
          unique: true,
          claim: 'instance',
          target: this.hostName,
        },
        { name: instance, type: DnsRecordType.TXT, ttl: MDNS_OTHER_RECORD_TTL, rdata: txtRdata, unique: true, claim: 'instance' },
        {
          name: instance,
          type: DnsRecordType.NSEC,
          ttl: MDNS_OTHER_RECORD_TTL,
          rdata: this.encodeNsecRdata(instance, [DnsRecordType.TXT, DnsRecordType.SRV]),
          unique: true,
          claim: 'instance',
        },
        { name: serviceName, type: DnsRecordType.PTR, ttl: MDNS_OTHER_RECORD_TTL, rdata: this.codec.encodeDnsName(instance), unique: false, target: instance },
        { name: SERVICES_ENUMERATION_NAME, type: DnsRecordType.PTR, ttl: MDNS_OTHER_RECORD_TTL, rdata: this.codec.encodeDnsName(serviceName), unique: false, target: serviceName },
      );
    }
    // RFC 6763 §7.1: subtype PTRs point at the same base-service instance, not a new SRV/TXT owner.
    for (const service of this.services) {
      const instance = `${escapeLabel(this.instanceLabel)}.${service}.local`;
      for (const subtype of this.options.subtypes ?? []) {
        records.push({
          name: `${escapeLabel(subtype)}._sub.${service}.local`,
          type: DnsRecordType.PTR,
          ttl: MDNS_OTHER_RECORD_TTL,
          rdata: this.codec.encodeDnsName(instance),
          unique: false,
          target: instance,
        });
      }
    }
    return records;
  }

  /**
   * Encodes the rdata of a restricted form NSEC record (RFC 6762 §6.1): next domain name is the own name, block 0.
   *
   * @param {string} name - The record name.
   * @param {DnsRecordType[]} types - The types that exist for the name (all below 256).
   * @returns {Buffer} The rdata.
   */
  private encodeNsecRdata(name: string, types: DnsRecordType[]): Buffer {
    // RFC 6762 §6.1: one bitmap window; synthesized NSEC deliberately omits its own type bit.
    const bitmap = Buffer.alloc(Math.floor(Math.max(...types) / 8) + 1);
    for (const type of types) bitmap[Math.floor(type / 8)] |= 0x80 >> (type % 8);
    return Buffer.concat([this.codec.encodeDnsName(name), Buffer.from([0, bitmap.length]), bitmap]);
  }

  // --------------------------------------------------------------------------------------------
  // Probing (RFC 6762 §8.1, §8.2, §9) and announcing (§8.3)
  // --------------------------------------------------------------------------------------------

  /**
   * Starts a probe cycle for the claims in probing state.
   *
   * @param {number} [delayMs] - Delay before the first probe; defaults to a random 0-250 ms, or 5 s after too many conflicts.
   */
  private startProbing(delayMs?: number): void {
    this.cancelProbing();
    this.cancelAnnouncing();
    if (![...this.claims.values()].includes('probing')) return;
    const now = Date.now();
    this.conflictTimes = this.conflictTimes.filter((time) => now - time < PROBE_CONFLICT_WINDOW_MS);
    const throttled = this.conflictTimes.length >= PROBE_CONFLICT_LIMIT;
    const delay = throttled ? PROBE_THROTTLE_DELAY_MS : (delayMs ?? randomInt(0, PROBE_MAX_INITIAL_DELAY_MS));
    this.probeTimer = this.setTimer(() => this.sendProbe(), delay);
  }

  /** Cancels the current probe cycle. */
  private cancelProbing(): void {
    this.clearTimer(this.probeTimer);
    this.probeTimer = undefined;
    this.probesSent = 0;
    this.probeWindowOpen = false;
  }

  /** Sends a probe query and schedules the next one, or the end of probing. */
  private sendProbe(): void {
    const probing = [...this.claims.entries()].filter(([, state]) => state === 'probing').map(([kind]) => kind);
    const names = probing.flatMap((kind) => this.claimNames(kind));
    const proposed = this.proposedRecords(probing);
    this.probeWindowOpen = true;
    this.probesSent++;
    this.log.debug(`Probe ${this.probesSent}/${PROBE_COUNT} for ${names.join(', ')}`);
    for (const family of this.families()) {
      // RFC 6762 §8.1: QU probes, unless another responder is bound first to the port and would receive the unicast answers (§15.1)
      const questions = names.map((name) => ({ name, type: DnsRecordType.ANY, qclass: DnsClass.IN, qu: this.firstOnPort[family] }));
      const packet = this.buildPacket({ id: 0, flags: 0, questions, answers: [], authorities: proposed, additionals: [], legacy: false });
      if (packet.length <= MDNS_MAX_MESSAGE_LENGTH) this.transmit(family, packet, this.multicastAddress(family), this.mdnsPort);
      else {
        // RFC 6762 §8.2 requires all proposed records for a name together for tiebreaking.
        // Reject oversized claims at construction rather than fragmenting their authority RRSet.
        for (const question of questions) {
          const authorities = proposed.filter((record) => sameName(record.name, question.name));
          const probe = this.buildPacket({ id: 0, flags: 0, questions: [question], answers: [], authorities, additionals: [], legacy: false });
          this.transmit(family, probe, this.multicastAddress(family), this.mdnsPort);
        }
      }
    }
    if (this.probesSent < PROBE_COUNT) {
      this.probeTimer = this.setTimer(() => this.sendProbe(), PROBE_INTERVAL_MS);
    } else {
      this.probeTimer = this.setTimer(() => this.probingSucceeded(), PROBE_INTERVAL_MS);
    }
  }

  /**
   * Returns the records proposed in the Authority section of the probes (RFC 6762 §8.2): all the unique records except NSEC.
   *
   * @param {ClaimKind[]} kinds - The claims being probed.
   * @returns {MdnsResponderRecord[]} The proposed records.
   */
  private proposedRecords(kinds: ClaimKind[]): MdnsResponderRecord[] {
    return this.buildRecords().filter((record) => record.claim && kinds.includes(record.claim) && record.type !== DnsRecordType.NSEC);
  }

  /** Marks the probed claims as owned and announces them. */
  private probingSucceeded(): void {
    this.cancelProbing();
    for (const [kind, state] of this.claims) if (state === 'probing') this.claims.set(kind, 'owned');
    this.firstConflictTime = undefined;
    this.probeFailureLogged = false;
    this.log.info(`Probing succeeded: ${CYAN}${this.hostName}${nf}${this.aliasName ? ` (alias ${CYAN}${this.aliasName}${nf})` : ''} instance ${CYAN}${this.instanceLabel}${nf}`);
    this.startAnnouncing();
  }

  /**
   * Handles a conflict found while probing (RFC 6762 §8.1, §9): gives up the alias or renames the host or the instance, then probes again.
   *
   * @param {ClaimKind} kind - The conflicting claim.
   */
  private probeConflict(kind: ClaimKind): void {
    const now = Date.now();
    this.conflictTimes.push(now);
    this.firstConflictTime ??= now;
    if (!this.probeFailureLogged && now - this.firstConflictTime >= PROBE_FAILURE_ERROR_MS) {
      this.probeFailureLogged = true;
      this.log.error('Unable to find an unused name after one minute of probing');
    }
    if (kind !== 'alias' && this.options.resolveConflict) {
      const oldName = kind === 'host' ? this.hostLabel : this.instanceLabel;
      const newName = this.options.resolveConflict(kind, oldName);
      const validHost = newName !== undefined && /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(newName);
      const validInstance = newName !== undefined && !hasControlCharacters(newName) && Buffer.byteLength(newName) <= 63;
      if (!newName || !(kind === 'host' ? validHost : validInstance)) {
        void this.stop();
        const error = new Error(`MdnsResponder: conflicting ${kind} ${oldName}`);
        if (this.listenerCount('error') > 0) this.emit('error', error);
        else this.log.error(error.message);
        return;
      }
      if (kind === 'host') this.hostLabel = newName;
      else this.instanceLabel = newName;
      this.emit('nameChanged', kind, oldName, newName);
      this.startProbing();
      return;
    }
    if (kind === 'alias') {
      this.claims.set('alias', 'lost');
      this.log.info(`Alias ${CYAN}${this.aliasLabel}.local${nf} is in use by another host: giving it up`);
      if (this.aliasLabel) this.emit('aliasLost', this.aliasLabel);
    } else if (kind === 'host') {
      const oldName = this.hostName;
      this.hostCounter++;
      const suffix = `-${this.hostCounter}`;
      this.hostLabel = this.hostBase.slice(0, 63 - suffix.length) + suffix;
      this.log.info(`Host name ${CYAN}${oldName}${nf} is in use by another host: renamed to ${CYAN}${this.hostName}${nf}`);
      this.emit('nameChanged', 'host', oldName, this.hostName);
    } else {
      const oldName = this.instanceLabel;
      this.instanceCounter++;
      const suffix = ` (${this.instanceCounter})`;
      let base = this.instanceBase;
      while (Buffer.byteLength(base + suffix) > 63) base = base.slice(0, -1);
      this.instanceLabel = base + suffix;
      this.log.info(`Instance name ${CYAN}${oldName}${nf} is in use by another host: renamed to ${CYAN}${this.instanceLabel}${nf}`);
      this.emit('nameChanged', 'instance', oldName, this.instanceLabel);
    }
    this.startProbing();
  }

  /** Starts an announcement sequence: announceCount unsolicited responses, one second apart, then doubling (RFC 6762 §8.3). */
  private startAnnouncing(): void {
    this.cancelAnnouncing();
    const announce = (index: number): void => {
      const records = this.activeRecords();
      const answers = records.filter((record) => record.type !== DnsRecordType.NSEC);
      const additionals = records.filter((record) => record.type === DnsRecordType.NSEC);
      for (const family of this.families()) this.sendMulticast(family, answers, additionals);
      this.log.info(`Announced ${CYAN}${this.hostName}${nf} and ${CYAN}${this.instanceLabel}${nf} (${index + 1}/${this.announceCount})`);
      if (index === 0) {
        this.emit('announced');
        this.announcedResolve?.();
        this.announcedResolve = undefined;
      }
      if (index + 1 < this.announceCount) this.announceTimer = this.setTimer(() => announce(index + 1), ANNOUNCE_FIRST_INTERVAL_MS * 2 ** index);
    };
    announce(0);
  }

  /** Cancels the current announcement sequence. */
  private cancelAnnouncing(): void {
    this.clearTimer(this.announceTimer);
    this.announceTimer = undefined;
  }

  // --------------------------------------------------------------------------------------------
  // Receiving
  // --------------------------------------------------------------------------------------------

  /**
   * Opens a socket and waits until it is ready.
   *
   * @param {MdnsResponderFamily} family - The socket family.
   * @returns {Promise<void>} Resolves when the socket is ready.
   */
  private async startSocket(family: MdnsResponderFamily): Promise<void> {
    const socket = this.advertiseSockets[family];
    /* v8 ignore next - startSocket() is only called for the families with a socket */
    if (!socket) return;
    socket.onPacket = (msg: Buffer, rinfo: dgram.RemoteInfo): void => this.handlePacket(family, msg, rinfo);
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
   * Handles a received packet, optionally with destination/interface metadata from a native transport.
   * Standard Node/Bun sockets provide neither field, so destination-dependent checks require an adapter.
   *
   * @param {MdnsResponderFamily} family - The socket that received it.
   * @param {Buffer} msg - The packet.
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   * @param {object} [context] - Optional received-packet metadata.
   * @param {string} [context.interfaceName] - Receiving interface name.
   * @param {string} [context.destinationAddress] - Destination IP address.
   */
  handlePacket(family: MdnsResponderFamily, msg: Buffer, rinfo: dgram.RemoteInfo, context?: { interfaceName?: string; destinationAddress?: string }): void {
    if (this.stopped) return;
    if (context?.interfaceName && context.interfaceName !== this.interfaceName) return;
    const direct = context?.destinationAddress !== undefined && context.destinationAddress.split('%')[0].toLowerCase() !== this.multicastAddress(family);
    // RFC 6762 §5.5, §11: subnet checks apply to direct unicast, never to received multicast.
    if (direct && !this.isOnLink(rinfo.address)) return;
    if (this.options.restrictInterfacePackets) {
      const [source, zone] = rinfo.address.split('%');
      const interfaces = os.networkInterfaces();
      const local = interfaces[this.interfaceName] ?? [];
      if (zone && zone !== this.interfaceName && !local.some((info) => String(info.scopeid) === zone)) return;
      const own = local.some((info) => info.address.split('%')[0] === source);
      if (!own && Object.values(interfaces).some((infos) => infos?.some((info) => info.address.split('%')[0] === source))) return;
    }
    let message: ParsedMessage;
    try {
      message = this.parsePacket(msg);
    } catch (error) {
      this.log.debug(`Ignoring malformed packet from ${rinfo.address}: ${getErrorMessage(error)}`);
      return;
    }
    if (message.opcode !== 0 || message.rcode !== 0) return; // RFC 6762 §18.3, §18.11
    if (message.qr === 1) {
      // §6: unsolicited unicast responses are not accepted; this responder queries only while probing.
      if (direct && (!this.probeWindowOpen || !this.firstOnPort[family])) return;
      this.handleResponse(family, message, rinfo);
    } else this.handleQuery(family, message, rinfo, direct);
  }

  /**
   * Handles a response: conflicts (RFC 6762 §6.6, §8.1, §9), TTL corrections (§6.6) and duplicate answer suppression (§7.4).
   *
   * @param {MdnsResponderFamily} family - The socket that received it.
   * @param {ParsedMessage} message - The response.
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   */
  private handleResponse(family: MdnsResponderFamily, message: ParsedMessage, rinfo: dgram.RemoteInfo): void {
    if (rinfo.port !== this.mdnsPort) return; // RFC 6762 §6: responses must come from the mDNS port
    const all = this.buildRecords();
    const active = this.activeRecords();
    const conflicts = new Set<ClaimKind>();
    for (const received of [...message.answers, ...message.authorities, ...message.additionals]) {
      const kind = this.claimOf(received.name);
      const state = kind ? this.claims.get(kind) : undefined;
      if (kind && state === 'probing' && this.probeWindowOpen) {
        // RFC 6762 §8.1: any record with a probed name, of any type, is a conflict unless identical to ours
        if (!all.some((record) => sameRecord(record, received))) conflicts.add(kind);
      } else if (kind && state === 'owned') {
        // RFC 6762 §9: a record with the same name, type and class but different rdata is a conflict
        const mine = active.filter((record) => record.unique && sameName(record.name, received.name) && record.type === received.type);
        if (mine.length > 0 && received.rrclass === DnsClass.IN && !mine.some((record) => sameRecord(record, received))) conflicts.add(kind);
      }
      const identical = active.find((record) => sameRecord(record, received));
      if (!identical) continue;
      // RFC 6762 §7.4: duplicate answer suppression
      const batch = this.batches[family];
      if (batch && received.ttl >= identical.ttl) batch.answers.delete(recordKey(identical));
      // RFC 6762 §6.6: correct a TTL lower than half of ours
      if (received.ttl < identical.ttl / 2) this.queueMulticast(family, [identical], [], randomInt(RESPONSE_MIN_DELAY_MS, RESPONSE_MAX_DELAY_MS), MULTICAST_MIN_INTERVAL_MS);
    }
    for (const kind of conflicts) {
      if (this.stopped) break; // A conflict without a replacement name stopped the responder
      if (this.claims.get(kind) === 'probing') {
        this.probeConflict(kind);
      } else {
        this.log.info(`Conflicting record received for ${CYAN}${this.claimNames(kind).join(', ')}${nf} from ${BLUE}${rinfo.address}${nf}: probing again`);
        this.claims.set(kind, 'probing');
        this.startProbing();
      }
    }
  }

  /**
   * Handles a query: probe tiebreaking (RFC 6762 §8.2), truncated queries (§7.2) and answers.
   *
   * @param {MdnsResponderFamily} family - The socket that received it.
   * @param {ParsedMessage} message - The query.
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   * @param {boolean} [direct] - Whether the query arrived by direct unicast (RFC 6762 §5.5).
   */
  private handleQuery(family: MdnsResponderFamily, message: ParsedMessage, rinfo: dgram.RemoteInfo, direct = false): void {
    if (direct) for (const question of message.questions) question.qu = true;
    const legacy = rinfo.port !== this.mdnsPort;
    if (message.authorities.length > 0 && this.probeWindowOpen && this.tiebreakLost(message)) {
      this.log.info(`Simultaneous probe from ${BLUE}${rinfo.address}${nf} won the tiebreak: probing again in one second`);
      this.startProbing(PROBE_TIEBREAK_LOST_DELAY_MS);
    }
    const key = `${family}|${rinfo.address}|${rinfo.port}`;
    if (message.questions.length === 0) {
      // RFC 6762 §7.2: a Known-Answer continuation packet
      const pending = this.truncatedQueries.get(key);
      if (!pending) return;
      pending.knownAnswers.push(...message.answers);
      if (message.tc) this.scheduleTruncated(key, pending);
      return;
    }
    if (message.tc && !legacy) {
      this.clearTimer(this.truncatedQueries.get(key)?.timer);
      const pending: TruncatedQuery = { family, message, knownAnswers: [...message.answers], rinfo };
      this.truncatedQueries.set(key, pending);
      this.scheduleTruncated(key, pending);
      return;
    }
    this.answerQuery(family, message, message.answers, rinfo, false);
  }

  /**
   * (Re)schedules the answer 400-500 ms after the last TC-set packet (RFC 6762 §7.2).
   *
   * @param {string} key - The query key.
   * @param {TruncatedQuery} pending - The pending query.
   */
  private scheduleTruncated(key: string, pending: TruncatedQuery): void {
    this.clearTimer(pending.timer);
    pending.timer = this.setTimer(
      () => {
        this.truncatedQueries.delete(key);
        this.answerQuery(pending.family, pending.message, pending.knownAnswers, pending.rinfo, true);
      },
      randomInt(TRUNCATED_MIN_DELAY_MS, TRUNCATED_MAX_DELAY_MS),
    );
  }

  /**
   * Returns true when a simultaneous probe wins the tiebreak against one of our claims being probed (RFC 6762 §8.2).
   *
   * @param {ParsedMessage} message - The probe query.
   * @returns {boolean} True if we lost.
   */
  private tiebreakLost(message: ParsedMessage): boolean {
    for (const [kind, state] of this.claims) {
      if (state !== 'probing') continue;
      for (const name of this.claimNames(kind)) {
        if (!message.questions.some((question) => sameName(question.name, name))) continue;
        const theirs = message.authorities.filter((record) => sameName(record.name, name));
        if (theirs.length === 0) continue;
        const ours = this.proposedRecords([kind]).filter((record) => sameName(record.name, name));
        if (compareRecordSets(ours, theirs) < 0) return true;
      }
    }
    return false;
  }

  // --------------------------------------------------------------------------------------------
  // Answering
  // --------------------------------------------------------------------------------------------

  /**
   * Answers a query (RFC 6762 §5.4, §6, §6.1, §6.2, §6.5, §6.7, §7.1; RFC 6763 §12).
   *
   * @param {MdnsResponderFamily} family - The socket that received the query.
   * @param {ParsedMessage} message - The query.
   * @param {ParsedRecord[]} knownAnswers - The Known-Answer records of the query (and of its continuation packets).
   * @param {dgram.RemoteInfo} rinfo - Sender address information.
   * @param {boolean} delayed - True when the answer has already been delayed (truncated query).
   */
  private answerQuery(family: MdnsResponderFamily, message: ParsedMessage, knownAnswers: ParsedRecord[], rinfo: dgram.RemoteInfo, delayed: boolean): void {
    const active = this.activeRecords();
    const answers = new Map<string, MdnsResponderRecord>();
    const unicastRequested = new Set<string>();
    for (const question of message.questions) {
      if (question.qclass !== DnsClass.IN && question.qclass !== DnsClass.ANY) continue;
      let matches = active.filter(
        (record) => sameName(record.name, question.name) && (question.type === DnsRecordType.ANY ? record.type !== DnsRecordType.NSEC : record.type === question.type),
      );
      if (matches.length === 0 && question.type !== DnsRecordType.ANY) {
        // RFC 6762 §6.1: negative answer for a type that does not exist on a name we own
        matches = active.filter((record) => record.type === DnsRecordType.NSEC && sameName(record.name, question.name));
      }
      for (const record of matches) {
        answers.set(recordKey(record), record);
        if (question.qu) unicastRequested.add(recordKey(record));
      }
    }
    // RFC 6762 §7.1: known-answer suppression
    const isKnown = (record: MdnsResponderRecord): boolean => knownAnswers.some((known) => sameRecord(record, known) && known.ttl >= record.ttl / 2);
    for (const [key, record] of answers) if (isKnown(record)) answers.delete(key);
    if (answers.size === 0) return;

    const answerList = [...answers.values()];
    const additionals = this.additionalRecords(answerList, active).filter((record) => !isKnown(record));
    const legacy = rinfo.port !== this.mdnsPort;
    if (legacy) {
      // RFC 6762 §6.7: conventional unicast response to the source port, with the query ID and question
      if (!this.isOnLink(rinfo.address)) return;
      const packets = this.buildPackets(message.id, message.questions, answerList, additionals, true);
      for (const packet of packets) this.transmit(family, packet, this.unicastAddress(rinfo.address), rinfo.port);
      return;
    }

    const isDefense = message.authorities.length > 0 && answerList.some((record) => record.unique);
    const now = Date.now();
    const unicast: MdnsResponderRecord[] = [];
    const multicast: MdnsResponderRecord[] = [];
    const onLink = this.isOnLink(rinfo.address);
    for (const record of answerList) {
      const last = this.lastMulticast[family].get(recordKey(record));
      const recentlyMulticast = last !== undefined && now - last < (record.ttl * 1000) / 4;
      if (unicastRequested.has(recordKey(record)) && onLink) {
        // RFC 6762 §5.4: unicast reply, but multicast when not multicast within a quarter of the TTL (probe defenses get both)
        if (recentlyMulticast || isDefense) unicast.push(record);
        if (!recentlyMulticast) multicast.push(record);
      } else {
        multicast.push(record);
      }
    }
    const allUnique = answerList.every((record) => record.unique);
    const delay =
      delayed || isDefense || (allUnique && message.questions.every((question) => answerList.some((record) => sameName(record.name, question.name))))
        ? 0
        : randomInt(RESPONSE_MIN_DELAY_MS, RESPONSE_MAX_DELAY_MS);
    if (unicast.length > 0) {
      const send = (): void => {
        /* v8 ignore next - stop() clears the pending timers, so a delayed send never runs after stop */
        if (this.stopped) return;
        for (const packet of this.buildPackets(0, [], unicast, additionals, false)) this.transmit(family, packet, this.unicastAddress(rinfo.address), rinfo.port);
      };
      if (delay === 0) send();
      else this.setTimer(send, delay);
    }
    if (multicast.length > 0) this.queueMulticast(family, multicast, additionals, delay, isDefense ? PROBE_DEFENSE_MIN_INTERVAL_MS : MULTICAST_MIN_INTERVAL_MS);
  }

  /**
   * Returns the additional records of an answer (RFC 6763 §12, RFC 6762 §6.1, §6.2).
   *
   * @param {MdnsResponderRecord[]} answers - The answer records.
   * @param {MdnsResponderRecord[]} active - The active records.
   * @returns {MdnsResponderRecord[]} The additional records, without the answers.
   */
  private additionalRecords(answers: MdnsResponderRecord[], active: MdnsResponderRecord[]): MdnsResponderRecord[] {
    const answerKeys = new Set(answers.map((record) => recordKey(record)));
    const additionals = new Map<string, MdnsResponderRecord>();
    const add = (record: MdnsResponderRecord): void => {
      const key = recordKey(record);
      if (!answerKeys.has(key)) additionals.set(key, record);
    };
    const addNamed = (name: string, types: DnsRecordType[]): void => {
      for (const record of active) if (sameName(record.name, name) && types.includes(record.type)) add(record);
    };
    for (const record of answers) {
      if (record.type === DnsRecordType.PTR && record.target && this.claimOf(record.target) === 'instance') {
        addNamed(record.target, [DnsRecordType.SRV, DnsRecordType.TXT]);
        addNamed(this.hostName, [DnsRecordType.A, DnsRecordType.AAAA]);
      } else if (record.type === DnsRecordType.SRV && record.target) {
        addNamed(record.target, [DnsRecordType.A, DnsRecordType.AAAA]);
      } else if (record.type === DnsRecordType.A || record.type === DnsRecordType.AAAA) {
        addNamed(record.name, [DnsRecordType.A, DnsRecordType.AAAA]); // RFC 6762 §6.2: fate sharing of both address families
      }
    }
    // The NSEC of every unique name in the response, so the querier knows the other types do not exist
    const names = new Set([...answers, ...additionals.values()].filter((record) => record.unique).map((record) => dnsCase(record.name)));
    for (const name of names) addNamed(name, [DnsRecordType.NSEC]);
    return [...additionals.values()];
  }

  // --------------------------------------------------------------------------------------------
  // Sending
  // --------------------------------------------------------------------------------------------

  /**
   * Queues multicast answers, aggregated with the pending ones (RFC 6762 §6.4), and sends them after the delay.
   *
   * @param {MdnsResponderFamily} family - The socket to send from.
   * @param {MdnsResponderRecord[]} answers - The answer records.
   * @param {MdnsResponderRecord[]} additionals - The additional records.
   * @param {number} delay - The delay in ms (0 sends now).
   * @param {number} minInterval - The minimum interval since the last multicast of a record (RFC 6762 §6).
   */
  private queueMulticast(family: MdnsResponderFamily, answers: MdnsResponderRecord[], additionals: MdnsResponderRecord[], delay: number, minInterval: number): void {
    let batch = this.batches[family];
    if (!batch) {
      batch = { answers: new Map(), additionals: new Map(), minInterval };
      this.batches[family] = batch;
    }
    for (const record of answers) batch.answers.set(recordKey(record), record);
    for (const record of additionals) batch.additionals.set(recordKey(record), record);
    batch.minInterval = Math.min(batch.minInterval, minInterval);
    if (delay === 0) this.flushMulticast(family);
    else batch.timer ??= this.setTimer(() => this.flushMulticast(family), delay);
  }

  /**
   * Sends the pending multicast answers of a socket, skipping the records multicast too recently (RFC 6762 §6).
   *
   * @param {MdnsResponderFamily} family - The socket.
   */
  private flushMulticast(family: MdnsResponderFamily): void {
    const batch = this.batches[family];
    /* v8 ignore next - flushMulticast() is only called right after a batch is queued or by its own timer */
    if (!batch) return;
    this.clearTimer(batch.timer);
    this.batches[family] = undefined;
    /* v8 ignore next - stop() clears the batch timers and no packet is handled after stop */
    if (this.stopped) return;
    const now = Date.now();
    // RFC 6762 §6 / §10.2: suppress whole recently sent RRSets, never individual unique siblings.
    const eligible = (record: MdnsResponderRecord): boolean => {
      const siblings = record.unique ? this.completeRrsets([record]) : [record];
      return siblings.every((sibling) => {
        const last = this.lastMulticast[family].get(recordKey(sibling));
        return last === undefined || now - last >= batch.minInterval;
      });
    };
    const answers = [...batch.answers.values()].filter((record) => batch.minInterval === PROBE_DEFENSE_MIN_INTERVAL_MS || eligible(record));
    if (answers.length === 0) return;
    const answerKeys = new Set(answers.map(recordKey));
    // RFC 6763 §12: additionals are an optimization; they must not hold up eligible answers.
    const additionals = [...batch.additionals.values()].filter((record) => !answerKeys.has(recordKey(record)) && eligible(record));
    this.sendMulticast(family, answers, additionals, undefined, batch.minInterval);
  }

  /**
   * Sends multicast response packets and records the time each record was multicast.
   *
   * @param {MdnsResponderFamily} family - The socket.
   * @param {MdnsResponderRecord[]} answers - The answer records.
   * @param {MdnsResponderRecord[]} additionals - The additional records.
   * @param {number} [ttl] - A TTL overriding the records TTL (0 for goodbye packets).
   * @param {number} [minInterval] - Minimum multicast interval; 250 ms only for probe defense (§6).
   */
  private sendMulticast(
    family: MdnsResponderFamily,
    answers: MdnsResponderRecord[],
    additionals: MdnsResponderRecord[],
    ttl?: number,
    minInterval = MULTICAST_MIN_INTERVAL_MS,
  ): void {
    if (answers.length === 0) return;
    const fullAnswers = ttl === undefined ? this.completeRrsets(answers) : answers;
    const fullAdditionals = ttl === undefined ? this.completeRrsets(additionals) : additionals;
    // RFC 6762 §10.1: goodbyes withdraw immediately and must not be merged with positive answers.
    if (ttl === 0) {
      for (const packet of this.buildPackets(0, [], fullAnswers, fullAdditionals, false, ttl)) this.transmit(family, packet, this.multicastAddress(family), this.mdnsPort);
      return;
    }
    // RFC 6762 §6.4: one pending entry per record merges repeated requests during the rate-limit window.
    const pending = this.pendingMulticast[family];
    for (const [records, answer] of [
      [fullAnswers, true],
      [fullAdditionals, false],
    ] as const) {
      for (const record of records) {
        const key = recordKey(record);
        const previous = pending.get(key);
        pending.set(key, { record, answer: answer || previous?.answer === true, interval: Math.min(minInterval, previous?.interval ?? minInterval) });
      }
    }
    this.flushPendingMulticast(family);
  }

  /**
   * Sends eligible complete RRSets and schedules one timer for the remaining records (§6, §6.4, §10.2).
   * @param {MdnsResponderFamily} family - Socket family.
   */
  private flushPendingMulticast(family: MdnsResponderFamily): void {
    this.clearTimer(this.multicastTimers[family]);
    this.multicastTimers[family] = undefined;
    const pending = this.pendingMulticast[family];
    const active = new Set(this.activeRecords().map(recordKey));
    for (const key of pending.keys()) if (!active.has(key)) pending.delete(key);
    const now = Date.now();
    const answers: MdnsResponderRecord[] = [];
    const additionals: MdnsResponderRecord[] = [];
    let nextDelay = Infinity;
    let answerDeferred = false;
    const ready: string[] = [];
    for (const [key, entry] of pending) {
      const siblings = [...pending.values()].filter((other) => (entry.record.unique ? sameRrset(entry.record, other.record) : recordKey(other.record) === key));
      // The probe-defense exception applies to the complete RRSet, not just the queried member.
      const interval = Math.min(...siblings.map((sibling) => sibling.interval));
      const delay = Math.max(
        0,
        ...siblings.map((sibling) => {
          const last = this.lastMulticast[family].get(recordKey(sibling.record));
          return last === undefined ? 0 : last + interval - now;
        }),
      );
      if (delay > 0) {
        nextDelay = Math.min(nextDelay, delay);
        if (entry.answer) answerDeferred = true;
        continue;
      }
      ready.push(key);
      (entry.answer ? answers : additionals).push(entry.record);
    }
    // Ready additionals wait for a rate-limited answer; without one they are dropped.
    if (answers.length > 0 || !answerDeferred) for (const key of ready) pending.delete(key);
    if (answers.length > 0) {
      for (const record of [...answers, ...additionals]) this.lastMulticast[family].set(recordKey(record), now);
      for (const packet of this.buildPackets(0, [], answers, additionals, false)) this.transmit(family, packet, this.multicastAddress(family), this.mdnsPort);
    }
    if (Number.isFinite(nextDelay)) this.multicastTimers[family] = this.setTimer(() => this.flushPendingMulticast(family), nextDelay);
  }

  /**
   * Expands selected unique records to their complete current RRSets (RFC 6762 §10.2).
   * @param {MdnsResponderRecord[]} records - Selected records.
   * @returns {MdnsResponderRecord[]} Deduplicated records including every owned sibling.
   */
  private completeRrsets(records: MdnsResponderRecord[]): MdnsResponderRecord[] {
    const result = new Map(records.map((record) => [recordKey(record), record]));
    for (const candidate of this.activeRecords()) {
      if (candidate.unique && records.some((record) => record.unique && sameRrset(record, candidate))) result.set(recordKey(candidate), candidate);
    }
    return [...result.values()];
  }

  /**
   * Builds response bursts without losing unique RRSet members (RFC 6762 §10.2, §17).
   * The sizes are those of the compressed packets, so each packet is built with the next record to check that it fits.
   *
   * @param {number} id - The message ID (0, or the query ID for legacy unicast responses).
   * @param {ParsedQuestion[]} questions - The questions to repeat (legacy unicast responses only).
   * @param {MdnsResponderRecord[]} answers - The answer records.
   * @param {MdnsResponderRecord[]} additionals - The additional records.
   * @param {boolean} legacy - Legacy unicast response: no cache-flush bit and TTL at most 10 seconds (RFC 6762 §6.7).
   * @param {number} [ttl] - A TTL overriding the records TTL (0 for goodbye packets).
   * @returns {Buffer[]} The packets.
   */
  private buildPackets(id: number, questions: ParsedQuestion[], answers: MdnsResponderRecord[], additionals: MdnsResponderRecord[], legacy: boolean, ttl?: number): Buffer[] {
    const flags = DnsHeaderFlag.QR | DnsHeaderFlag.AA;
    const build = (packetAnswers: MdnsResponderRecord[], packetAdditionals: MdnsResponderRecord[]): Buffer =>
      this.buildPacket({ id, flags, questions, answers: packetAnswers, authorities: [], additionals: packetAdditionals, legacy, ttl });
    const packets: Buffer[] = [];
    let current: MdnsResponderRecord[] = [];
    let extra: MdnsResponderRecord[] = [];
    const fullAnswers = ttl === undefined && !legacy ? this.completeRrsets(answers) : answers;
    const answerKeys = new Set(fullAnswers.map(recordKey));
    const fullAdditionals = (ttl === undefined && !legacy ? this.completeRrsets(additionals) : additionals).filter((record) => !answerKeys.has(recordKey(record)));
    // RFC 6762 §10.2, §17: preserve complete unique RRSets in a burst; never discard a sibling.
    // Legacy DNS has one response, so omit overflowing additionals and truncate answers instead.
    for (const record of fullAnswers) {
      if (build([...current, record], []).length > (legacy ? 512 : MDNS_MAX_MESSAGE_LENGTH)) {
        if (legacy) {
          const packet = build(current, []);
          packet.writeUInt16BE(DnsHeaderFlag.QR | DnsHeaderFlag.AA | DnsHeaderFlag.TC, 2);
          return [packet];
        }
        if (current.length) packets.push(build(current, []));
        current = [];
      }
      if (build([record], []).length > MDNS_MAX_MESSAGE_LENGTH) throw new Error('MdnsResponder: record exceeds packet limit');
      current.push(record);
    }
    for (const record of fullAdditionals) {
      if (build(current, [...extra, record]).length > (legacy ? 512 : MDNS_MAX_MESSAGE_LENGTH)) {
        if (legacy) continue;
        if (current.length || extra.length) packets.push(build(current, extra));
        current = [];
        extra = [];
      }
      if (build([], [record]).length > MDNS_MAX_MESSAGE_LENGTH) throw new Error('MdnsResponder: record exceeds packet limit');
      extra.push(record);
    }
    if (current.length || extra.length) packets.push(build(current, extra));
    return packets;
  }

  /**
   * Builds one packet, with its names compressed (RFC 6762 §18.14).
   *
   * @param {object} parts - The packet parts.
   * @param {number} parts.id - The message ID.
   * @param {number} parts.flags - The header flags.
   * @param {ParsedQuestion[]} parts.questions - The questions.
   * @param {MdnsResponderRecord[]} parts.answers - The answer records.
   * @param {MdnsResponderRecord[]} parts.authorities - The authority records.
   * @param {MdnsResponderRecord[]} parts.additionals - The additional records.
   * @param {boolean} parts.legacy - Legacy unicast response.
   * @param {number} [parts.ttl] - A TTL overriding the records TTL.
   * @returns {Buffer} The packet.
   */
  private buildPacket(parts: {
    id: number;
    flags: number;
    questions: ParsedQuestion[];
    answers: MdnsResponderRecord[];
    authorities: MdnsResponderRecord[];
    additionals: MdnsResponderRecord[];
    legacy: boolean;
    ttl?: number;
  }): Buffer {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(parts.id, 0);
    header.writeUInt16BE(parts.flags, 2);
    header.writeUInt16BE(parts.questions.length, 4);
    header.writeUInt16BE(parts.answers.length, 6);
    header.writeUInt16BE(parts.authorities.length, 8);
    header.writeUInt16BE(parts.additionals.length, 10);
    // Each part is encoded at its offset in the packet, so that its names can point to the names written before it
    const compression = new Map<string, number>();
    const buffers: Buffer[] = [header];
    let offset = header.length;
    const add = (buffer: Buffer): void => {
      buffers.push(buffer);
      offset += buffer.length;
    };
    for (const question of parts.questions) add(this.encodeQuestion(question, compression, offset));
    for (const record of parts.answers) add(this.encodeRecord(record, parts.legacy, parts.ttl, compression, offset));
    // Authority records of a probe carry no cache-flush bit
    for (const record of parts.authorities) add(this.encodeRecord({ ...record, unique: false }, parts.legacy, parts.ttl, compression, offset));
    for (const record of parts.additionals) add(this.encodeRecord(record, parts.legacy, parts.ttl, compression, offset));
    return Buffer.concat(buffers);
  }

  /**
   * Encodes a question.
   *
   * @param {ParsedQuestion} question - The question.
   * @param {Map<string, number>} compression - The compression table of the packet.
   * @param {number} offset - The offset of the question in the packet.
   * @returns {Buffer} The encoded question.
   */
  private encodeQuestion(question: ParsedQuestion, compression: Map<string, number>, offset: number): Buffer {
    const fields = Buffer.alloc(4);
    fields.writeUInt16BE(question.type, 0);
    fields.writeUInt16BE(question.qu ? question.qclass | DnsClassFlag.QU : question.qclass, 2);
    return Buffer.concat([this.codec.encodeDnsName(question.name, compression, offset), fields]);
  }

  /**
   * Encodes a record, with the cache-flush bit for unique records (RFC 6762 §10.2).
   *
   * @param {MdnsResponderRecord} record - The record.
   * @param {boolean} legacy - Legacy unicast response: no cache-flush bit and TTL at most 10 seconds.
   * @param {number} [ttl] - A TTL overriding the record TTL.
   * @param {Map<string, number>} compression - The compression table of the packet.
   * @param {number} offset - The offset of the record in the packet.
   * @returns {Buffer} The encoded record.
   */
  private encodeRecord(record: MdnsResponderRecord, legacy: boolean, ttl: number | undefined, compression: Map<string, number>, offset: number): Buffer {
    // RFC 6762 §6.7 / §10.2 / §18.14: legacy replies have no flush bit and no SRV target compression.
    const recordTtl = ttl ?? (legacy ? Math.min(record.ttl, LEGACY_UNICAST_MAX_TTL) : record.ttl);
    return this.codec.encodeResourceRecord(
      { name: record.name, rtype: record.type, rclass: DnsClass.IN, flush: record.unique && !legacy, ttl: recordTtl, rdata: record.rdata },
      compression,
      offset,
      !(legacy && record.type === DnsRecordType.SRV),
    );
  }

  // --------------------------------------------------------------------------------------------
  // Parsing
  // --------------------------------------------------------------------------------------------

  /**
   * Parses a packet, keeping the uncompressed rdata of each record.
   *
   * @param {Buffer} msg - The packet.
   * @returns {ParsedMessage} The parsed message.
   * @throws {Error} If the packet is malformed.
   */
  private parsePacket(msg: Buffer): ParsedMessage {
    if (msg.length < 12) throw new Error('packet too short');
    const flags = msg.readUInt16BE(2);
    const message: ParsedMessage = {
      id: msg.readUInt16BE(0),
      qr: (flags & DnsHeaderFlag.QR) >> 15,
      opcode: (flags & DnsHeaderFlag.OPCODE) >> 11,
      tc: (flags & DnsHeaderFlag.TC) !== 0,
      rcode: flags & DnsHeaderFlag.RCODE,
      questions: [],
      answers: [],
      authorities: [],
      additionals: [],
    };
    const counts = [msg.readUInt16BE(4), msg.readUInt16BE(6), msg.readUInt16BE(8), msg.readUInt16BE(10)];
    let offset = 12;
    for (let i = 0; i < counts[0]; i++) {
      const { name, newOffset } = this.codec.decodeDnsName(msg, offset);
      if (newOffset + 4 > msg.length) throw new Error('truncated question');
      const qclass = msg.readUInt16BE(newOffset + 2);
      message.questions.push({
        name,
        type: wireToDnsRecordType(msg.readUInt16BE(newOffset)),
        qclass: wireToDnsClass(qclass & ~DnsClassFlag.QU & 0xffff),
        qu: (qclass & DnsClassFlag.QU) !== 0,
      });
      offset = newOffset + 4;
    }
    const sections = [message.answers, message.authorities, message.additionals];
    for (let section = 0; section < 3; section++) {
      for (let i = 0; i < counts[section + 1]; i++) {
        const { name, newOffset } = this.codec.decodeDnsName(msg, offset);
        if (newOffset + 10 > msg.length) throw new Error('truncated record');
        const type = wireToDnsRecordType(msg.readUInt16BE(newOffset));
        const rrclass = wireToDnsClass(msg.readUInt16BE(newOffset + 2) & ~DnsClassFlag.FLUSH & 0xffff);
        const ttl = msg.readUInt32BE(newOffset + 4);
        const rdlength = msg.readUInt16BE(newOffset + 8);
        const start = newOffset + 10;
        if (start + rdlength > msg.length) throw new Error('truncated rdata');
        sections[section].push({ name, type, rrclass, ttl, rdata: this.uncompressedRdata(msg, type, start, rdlength) });
        offset = start + rdlength;
      }
    }
    return message;
  }

  /**
   * Returns the rdata of a record with its names uncompressed (RFC 6762 §8.2: names must be uncompressed before comparison).
   *
   * @param {Buffer} msg - The packet.
   * @param {DnsRecordType} type - The record type.
   * @param {number} start - The rdata offset.
   * @param {number} length - The rdata length.
   * @returns {Buffer} The uncompressed rdata.
   */
  private uncompressedRdata(msg: Buffer, type: DnsRecordType, start: number, length: number): Buffer {
    if (type === DnsRecordType.PTR || type === DnsRecordType.CNAME || type === DnsRecordType.NS) {
      return this.codec.encodeDnsName(this.codec.decodeDnsName(msg, start).name);
    }
    if (type === DnsRecordType.SRV && length >= 7) {
      return Buffer.concat([msg.subarray(start, start + 6), this.codec.encodeDnsName(this.codec.decodeDnsName(msg, start + 6).name)]);
    }
    if (type === DnsRecordType.NSEC && length >= 1) {
      const { name, newOffset } = this.codec.decodeDnsName(msg, start);
      return Buffer.concat([this.codec.encodeDnsName(name), msg.subarray(newOffset, start + length)]);
    }
    return Buffer.from(msg.subarray(start, start + length));
  }

  // --------------------------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------------------------

  /**
   * Returns the enabled socket families.
   *
   * @returns {MdnsResponderFamily[]} The families.
   */
  private families(): MdnsResponderFamily[] {
    return (['ipv4', 'ipv6'] as const).filter((family) => this.sockets[family]);
  }

  /**
   * Returns the multicast address of a family.
   *
   * @param {MdnsResponderFamily} family - The family.
   * @returns {string} The multicast address.
   */
  private multicastAddress(family: MdnsResponderFamily): string {
    return family === 'ipv4' ? MDNS_MULTICAST_IPV4_ADDRESS : MDNS_MULTICAST_IPV6_ADDRESS;
  }

  /**
   * Adds the interface scope to a link-local IPv6 destination that has none.
   *
   * @param {string} address - The destination address.
   * @returns {string} The address to send to.
   */
  private unicastAddress(address: string): string {
    if (!address.toLowerCase().startsWith('fe80') || address.includes('%')) return address;
    /* v8 ignore next - a link-local IPv6 sender is only received on the IPv6 socket */
    return address + (this.sockets.ipv6?.getIpv6ScopeId(this.interfaceName) ?? '');
  }

  /**
   * Returns true when an address is on the link of the interface (RFC 6762 §5.5, §11).
   *
   * @param {string} address - The source address.
   * @returns {boolean} True if on link.
   */
  private isOnLink(address: string): boolean {
    const plain = address.split('%')[0].toLowerCase();
    const infos = (os.networkInterfaces()[this.interfaceName] ?? []).filter(
      (info) => !info.internal && (!this.options.address || info.address.split('%')[0] === this.options.address.split('%')[0]),
    );
    if (plain.includes(':')) {
      if (plain.startsWith('fe80')) return true;
      let bytes: Buffer;
      try {
        bytes = this.codec.encodeAAAA(plain);
      } catch {
        return false;
      }
      return infos.some((info) => info.family === 'IPv6' && samePrefix(bytes, this.codec.encodeAAAA(info.address.split('%')[0]), this.codec.encodeAAAA(info.netmask)));
    }
    let bytes: Buffer;
    try {
      bytes = this.codec.encodeA(plain);
    } catch {
      return false;
    }
    return infos.some((info) => info.family === 'IPv4' && samePrefix(bytes, this.codec.encodeA(info.address), this.codec.encodeA(info.netmask)));
  }

  /**
   * Starts a tracked timer, cleared on stop.
   *
   * @param {() => void} callback - The callback.
   * @param {number} delay - The delay in ms.
   * @returns {NodeJS.Timeout} The timer.
   */
  private setTimer(callback: () => void, delay: number): NodeJS.Timeout {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, delay).unref();
    this.timers.add(timer);
    return timer;
  }

  /**
   * Clears a tracked timer.
   *
   * @param {NodeJS.Timeout | undefined} timer - The timer.
   */
  private clearTimer(timer: NodeJS.Timeout | undefined): void {
    if (!timer) return;
    clearTimeout(timer);
    this.timers.delete(timer);
  }

  /** Clears all the tracked timers. */
  private clearTimers(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.probeTimer = undefined;
    this.announceTimer = undefined;
    this.truncatedQueries.clear();
    this.batches.ipv4 = undefined;
    this.batches.ipv6 = undefined;
    for (const family of this.families()) {
      this.pendingMulticast[family].clear();
      this.multicastTimers[family] = undefined;
    }
  }
}

/**
 * Returns a random integer in [min, max].
 *
 * @param {number} min - The minimum.
 * @param {number} max - The maximum.
 * @returns {number} The random integer.
 */
function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Compares two names case-insensitively.
 *
 * @param {string} a - A name.
 * @param {string} b - A name.
 * @returns {boolean} True if equal.
 */
function sameName(a: string, b: string): boolean {
  return dnsCase(a) === dnsCase(b);
}

/**
 * Returns the identity key of a record: name, type and rdata (RFC 6762 §9: the TTL is not part of it).
 *
 * @param {MdnsResponderRecord} record - The record.
 * @returns {string} The key.
 */
function recordKey(record: MdnsResponderRecord): string {
  return `${dnsCase(record.name)}|${record.type}|${record.rdata.toString('hex')}`;
}

/**
 * Converts a record type read from the wire. Unknown types are kept as-is (RFC 3597), so the value may be a type DnsRecordType does not list.
 *
 * @param {number} value - The numeric record type read from the message.
 * @returns {DnsRecordType} The record type.
 */
function wireToDnsRecordType(value: number): DnsRecordType {
  // oxlint-disable-next-line typescript/no-unsafe-enum-assignment
  return value;
}

/**
 * Converts a class read from the wire, with the cache-flush or unicast-response bit masked off. Unknown classes are kept as-is, so the value may be a class DnsClass does not list.
 *
 * @param {number} value - The numeric class read from the message.
 * @returns {DnsClass} The class.
 */
function wireToDnsClass(value: number): DnsClass {
  // oxlint-disable-next-line typescript/no-unsafe-enum-assignment
  return value;
}

/**
 * Returns true when a received record is identical to one of ours: same name, type, class and rdata.
 *
 * @param {MdnsResponderRecord} ours - Our record.
 * @param {ParsedRecord} received - The received record.
 * @returns {boolean} True if identical.
 */
function sameRecord(ours: MdnsResponderRecord, received: ParsedRecord): boolean {
  if (!sameName(ours.name, received.name) || ours.type !== received.type || received.rrclass !== DnsClass.IN) return false;
  return canonicalRdata(ours.type, ours.rdata).equals(canonicalRdata(received.type, received.rdata));
}

/**
 * Compares two records in the lexicographical order of RFC 6762 §8.2: class, then type, then raw rdata bytes (unsigned).
 *
 * @param {{ rrclass: DnsClass; type: DnsRecordType; rdata: Buffer }} a - A record.
 * @param {{ rrclass: DnsClass; type: DnsRecordType; rdata: Buffer }} b - A record.
 * @returns {number} Negative if a is earlier, positive if later, 0 if equal.
 */
function compareRecords(a: { rrclass: DnsClass; type: DnsRecordType; rdata: Buffer }, b: { rrclass: DnsClass; type: DnsRecordType; rdata: Buffer }): number {
  if (a.rrclass !== b.rrclass) return a.rrclass - b.rrclass;
  if (a.type !== b.type) return a.type - b.type;
  return Buffer.compare(a.rdata, b.rdata);
}

/**
 * Compares our proposed records with the ones of a simultaneous probe (RFC 6762 §8.2.1): both sorted, compared pairwise,
 * and the list with records remaining wins.
 *
 * @param {MdnsResponderRecord[]} ours - Our proposed records.
 * @param {ParsedRecord[]} theirs - Their proposed records.
 * @returns {number} Negative if we lose, positive if we win, 0 if identical (no conflict).
 */
function compareRecordSets(ours: MdnsResponderRecord[], theirs: ParsedRecord[]): number {
  const a = ours.map((record) => ({ rrclass: DnsClass.IN, type: record.type, rdata: record.rdata })).toSorted(compareRecords);
  const b = theirs.toSorted(compareRecords);
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const result = compareRecords(a[i], b[i]);
    if (result !== 0) return result;
  }
  return a.length - b.length;
}

/**
 * Returns true when two addresses have the same prefix under a netmask.
 *
 * @param {Buffer} address - An address.
 * @param {Buffer} other - Another address.
 * @param {Buffer} netmask - The netmask.
 * @returns {boolean} True if same prefix.
 */
function samePrefix(address: Buffer, other: Buffer, netmask: Buffer): boolean {
  for (let i = 0; i < netmask.length; i++) if ((address[i] & netmask[i]) !== (other[i] & netmask[i])) return false;
  return true;
}

/**
 * Escapes a literal DNS label for the codec's dotted presentation format.
 * @param {string} label - Literal label.
 * @returns {string} Escaped label.
 */
function escapeLabel(label: string): string {
  return label.replaceAll('\\', '\\\\').replaceAll('.', '\\.');
}

/**
 * Folds only ASCII letters, as required by RFC 6762 section 16.
 * @param {string} name - DNS name or TXT key.
 * @returns {string} ASCII-folded text.
 */
function dnsCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}

/**
 * Tests membership in the same IN-class RRSet (RFC 6762 §10.2).
 * @param {MdnsResponderRecord} a - First record.
 * @param {MdnsResponderRecord} b - Second record.
 * @returns {boolean} Whether owner and type match.
 */
function sameRrset(a: MdnsResponderRecord, b: MdnsResponderRecord): boolean {
  return sameName(a.name, b.name) && a.type === b.type;
}

/**
 * Rejects ASCII control characters forbidden in DNS-SD instance names (RFC 6763 §4.1.1).
 * @param {string} value - Instance label.
 * @returns {boolean} Whether it contains a forbidden control character.
 */
function hasControlCharacters(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Folds embedded DNS names for equality, without changing binary payloads or probe tiebreak ordering.
 * RFC 6762 §16 applies ASCII case-insensitivity to DNS names; §8.2 tiebreaking remains raw byte order.
 * @param {DnsRecordType} type - Resource record type.
 * @param {Buffer} rdata - Uncompressed record data.
 * @returns {Buffer} Data with ASCII letters folded only inside the embedded domain name.
 */
function canonicalRdata(type: DnsRecordType, rdata: Buffer): Buffer {
  if (![DnsRecordType.PTR, DnsRecordType.SRV, DnsRecordType.NSEC, DnsRecordType.CNAME, DnsRecordType.NS].includes(type)) return rdata;
  const result = Buffer.from(rdata);
  let offset = type === DnsRecordType.SRV ? 6 : 0;
  while (offset < result.length) {
    const length = result[offset++];
    if (length === 0 || length > 63 || offset + length > result.length) break;
    for (let index = offset; index < offset + length; index++) {
      if (result[index] >= 65 && result[index] <= 90) result[index] += 32;
    }
    offset += length;
  }
  return result;
}
