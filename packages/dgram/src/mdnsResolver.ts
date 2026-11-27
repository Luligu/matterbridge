/**
 * @file packages/dgram/src/mdnsResolver.ts
 * @description Resolve a DNS-SD service instance over mDNS.
 * @author Luca Liguori
 * @created 2026-11-19
 * @version 1.0.2
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

import type { RemoteInfo } from 'node:dgram';

import { getErrorMessage } from '@matterbridge/utils/error';

import { isLinkLocalIpv6, receivingZone } from './dgram.js';
import { DnsClass, DnsRecordType, Mdns, type MdnsMessage, type MdnsSrvData } from './mdns.js';
import { MDNS_MULTICAST_IPV4_ADDRESS, MDNS_MULTICAST_IPV6_ADDRESS, MDNS_MULTICAST_PORT } from './multicast.js';

const RETRY_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 3000;

/** Network and timing options for {@link MdnsResolver}. */
export interface MdnsResolverOptions {
  /** Network interface to use. Defaults to the system's outgoing multicast interface for each family. */
  interfaceName?: string;
  /** Send and receive mDNS over IPv4. Defaults to true. */
  enableIpv4?: boolean;
  /** Send and receive mDNS over IPv6. Defaults to true. */
  enableIpv6?: boolean;
  /** Maximum time to wait for records in milliseconds. Defaults to 3000. */
  timeoutMs?: number;
  /** mDNS UDP port. Defaults to 5353; only tests should change it. */
  mdnsPort?: number;
}

/**
 * The SRV endpoint and records collected for one DNS-SD service instance.
 *
 * @example
 * {
 *   instanceName: '87E1B004E235A130-8FC7772401CD0696._matter._tcp.local',
 *   target: 'B75AFB458ECD0000.local',
 *   port: 5540,
 *   addresses: ['192.0.2.10', 'fe80:0:0:0:0:0:0:1234'],
 *   txt: ['SII=5000', 'SAI=300'],
 * }
 */
export interface MdnsResolvedService {
  /** Resolved instance name in DNS presentation form. */
  instanceName: string;
  /** SRV target hostname. */
  target: string;
  /** SRV port. */
  port: number;
  /**
   * Unique IPv4 and IPv6 addresses from the target's A and AAAA records. A link-local IPv6 address carries the zone of the interface
   * it was received on (RFC 4007 §11), e.g. `fe80::1%en0`, or `fe80::1%15` on Windows, and has no zone when that interface cannot be determined.
   */
  addresses: string[];
  /** TXT strings in wire order. */
  txt: string[];
}

type ResolvedRecord<T> = { data: T; expires: number };

/** Per-lookup options of {@link MdnsResolver.resolve}. */
export interface MdnsResolveOptions {
  /** Abort the lookup and close its sockets. The lookup rejects with the signal's reason. */
  signal?: AbortSignal;
}

/** mDNS socket that delivers decoded responses to a lookup. */
class MdnsResolverSocket extends Mdns {
  onReply?: (message: MdnsMessage, remote: RemoteInfo) => void;

  /**
   * Delivers a valid mDNS response from the configured port.
   *
   * @param {Buffer} packet - Received datagram.
   * @param {RemoteInfo} remote - Sender address information.
   */
  override onMessage(packet: Buffer, remote: RemoteInfo): void {
    if (remote.port !== this.multicastPort) return;
    let message: MdnsMessage;
    try {
      message = this.decodeMdnsMessage(packet);
    } catch (error) {
      this.log.debug(`Ignoring malformed packet from ${remote.address}: ${getErrorMessage(error)}`);
      return;
    }
    if (message.qr === 1 && message.opcode === 0 && message.rcode === 0) this.onReply?.(message, remote);
  }
}

/** Resolves one fully qualified DNS-SD service instance per lookup using multicast DNS. */
export class MdnsResolver {
  private readonly timeoutMs: number;
  private readonly mdnsPort: number;
  private readonly options: MdnsResolverOptions;

  /**
   * Configures the resolver. Each lookup opens and closes its own sockets.
   *
   * @param {MdnsResolverOptions} [options] - Network and timing options.
   * @throws {Error} If both socket families are disabled or the timeout or port is invalid.
   */
  constructor(options: MdnsResolverOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.mdnsPort = options.mdnsPort ?? MDNS_MULTICAST_PORT;
    if (options.enableIpv4 === false && options.enableIpv6 === false) throw new Error('MdnsResolver: at least one of IPv4 and IPv6 must be enabled');
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1 || this.timeoutMs > 0x7fffffff) throw new Error('MdnsResolver: invalid timeoutMs');
    if (!Number.isInteger(this.mdnsPort) || this.mdnsPort < 1 || this.mdnsPort > 65535) throw new Error('MdnsResolver: invalid mdnsPort');
    this.options = { ...options };
  }

  /**
   * Queries an instance's SRV and TXT records, then queries the SRV target's A and AAAA records.
   *
   * @param {string} instanceName - Full DNS-SD instance name, including the service type and .local suffix.
   * @param {MdnsResolveOptions} [options] - Per-lookup options.
   * @returns {Promise<MdnsResolvedService | undefined>} The service once SRV, TXT and an address are available, or undefined at timeout.
   * @throws {Error} If the instance name is invalid, none of the enabled sockets can start, or the lookup is aborted.
   */
  async resolve(instanceName: string, options: MdnsResolveOptions = {}): Promise<MdnsResolvedService | undefined> {
    const { signal } = options;
    signal?.throwIfAborted();
    const sockets: MdnsResolverSocket[] = [];
    try {
      const { interfaceName, enableIpv4, enableIpv6 } = this.options;
      if (enableIpv4 !== false) sockets.push(new MdnsResolverSocket('MdnsResolverUdp4', MDNS_MULTICAST_IPV4_ADDRESS, this.mdnsPort, 'udp4', true, interfaceName, '0.0.0.0'));
      if (enableIpv6 !== false) sockets.push(new MdnsResolverSocket('MdnsResolverUdp6', MDNS_MULTICAST_IPV6_ADDRESS, this.mdnsPort, 'udp6', true, interfaceName, '::'));
      const codec = sockets[0];
      const name = codec.decodeDnsName(codec.encodeDnsName(instanceName), 0).name;
      if (!/^(?:\\.|[^.\\])+\._[a-z0-9-]+\._(?:tcp|udp)\.local$/i.test(name)) throw new Error('MdnsResolver: expected a full DNS-SD instance name ending in .local');
      return await new MdnsLookup(name, interfaceName).collect(sockets, this.timeoutMs, signal);
    } finally {
      await Promise.all(
        sockets.map(async (socket) => {
          socket.onReply = undefined;
          await new Promise<void>((resolve) => {
            socket.once('close', resolve);
            socket.stop();
          });
        }),
      );
    }
  }
}

/** Response state for a single lookup. */
class MdnsLookup {
  private readonly instanceKey: string;
  private srv: ResolvedRecord<MdnsSrvData> | undefined;
  private txt: ResolvedRecord<string[]> | undefined;
  private readonly addresses = new Map<string, Map<string, number>>();

  /**
   * Starts collecting records for an instance.
   *
   * @param {string} instanceName - Canonical presentation name of the service instance.
   * @param {string | undefined} interfaceName - Interface the sockets are bound to, used for the zone of link-local addresses.
   */
  constructor(
    private readonly instanceName: string,
    private readonly interfaceName: string | undefined,
  ) {
    this.instanceKey = dnsCase(instanceName);
  }

  /**
   * Waits for SRV, TXT and a target address or the lookup deadline.
   *
   * @param {MdnsResolverSocket[]} sockets - Sockets owned by this lookup.
   * @param {number} timeoutMs - Maximum wait, including socket startup.
   * @param {AbortSignal} [signal] - Aborts the wait with the signal's reason.
   * @returns {Promise<MdnsResolvedService | undefined>} The collected service, if available.
   */
  async collect(sockets: MdnsResolverSocket[], timeoutMs: number, signal?: AbortSignal): Promise<MdnsResolvedService | undefined> {
    const ready = new Set<MdnsResolverSocket>();
    const retries: NodeJS.Timeout[] = [];
    const failed = new Set<MdnsResolverSocket>();
    let deadline: NodeJS.Timeout | undefined;
    let onAbort: (() => void) | undefined;
    try {
      return await new Promise<MdnsResolvedService | undefined>((resolve, reject) => {
        onAbort = (): void => reject(abortReason(signal));
        signal?.addEventListener('abort', onAbort, { once: true });
        deadline = setTimeout(() => {
          if (ready.size === 0) reject(new Error('MdnsResolver: no mDNS socket became ready'));
          else resolve(this.result());
        }, timeoutMs);

        const onReply = (message: MdnsMessage, remote: RemoteInfo): void => {
          const target = this.receive(message, remote.address);
          const result = this.result();
          if (result) {
            resolve(result);
            return;
          }
          if (target) for (const socket of ready) this.queryAddresses(socket, target, retries);
        };

        for (const socket of sockets) {
          socket.once('ready', () => {
            ready.add(socket);
            socket.onReply = onReply;
            ask(socket, this.instanceName, DnsRecordType.SRV, DnsRecordType.TXT);
            retries.push(
              setTimeout(() => {
                if (!this.srv) ask(socket, this.instanceName, DnsRecordType.SRV);
                if (!this.txt) ask(socket, this.instanceName, DnsRecordType.TXT);
              }, RETRY_INTERVAL_MS),
            );
            const target = this.srv?.data.target;
            if (target) this.queryAddresses(socket, target, retries);
          });
          socket.on('error', (error) => {
            if (ready.has(socket)) return;
            failed.add(socket);
            if (failed.size === sockets.length) reject(error);
          });
          try {
            socket.start();
          } catch (error) {
            socket.emit('error', error instanceof Error ? error : new Error(getErrorMessage(error)));
          }
        }
      });
    } finally {
      /* v8 ignore next - the Promise executor always sets onAbort */
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      clearTimeout(deadline);
      for (const retry of retries) clearTimeout(retry);
    }
  }

  private get target(): string | undefined {
    return this.srv && dnsCase(this.srv.data.target);
  }

  private queryAddresses(socket: Mdns, target: string, retries: NodeJS.Timeout[]): void {
    ask(socket, target, DnsRecordType.A, DnsRecordType.AAAA);
    retries.push(
      setTimeout(() => {
        if (this.target === dnsCase(target)) ask(socket, target, DnsRecordType.A, DnsRecordType.AAAA);
      }, RETRY_INTERVAL_MS),
    );
  }

  /**
   * Collects instance and host records from answers and additionals.
   *
   * @param {MdnsMessage} message - Decoded mDNS response.
   * @param {string} source - Sender address of the response, used for the zone of its link-local addresses.
   * @returns {string | undefined} A newly discovered target to query for addresses.
   */
  private receive(message: MdnsMessage, source: string): string | undefined {
    const now = Date.now();
    const records = [...(message.answers ?? []), ...(message.additionals ?? [])].filter((record) => record.class === DnsClass.IN);
    const previousTarget = this.target;

    for (const record of records) {
      if (dnsCase(record.name) !== this.instanceKey) continue;
      const expires = now + record.ttl * 1000;
      if (record.type === DnsRecordType.SRV) {
        const srv = record.data;
        if (srv.target && srv.port) {
          if (record.ttl > 0) this.srv = { data: srv, expires };
          else if (this.target === dnsCase(srv.target) && this.srv?.data.port === srv.port) this.srv = undefined;
        }
      } else if (record.type === DnsRecordType.TXT) {
        const txt = record.data;
        const current = this.txt?.data;
        if (record.ttl > 0) this.txt = { data: txt, expires };
        else if (current?.length === txt.length && txt.every((entry, index) => entry === current[index])) this.txt = undefined;
      }
    }

    const target = this.target;
    const targetChanged = previousTarget !== target;
    if (targetChanged) {
      const cached = target && this.addresses.get(target);
      this.addresses.clear();
      if (target && cached) this.addresses.set(target, cached);
    }
    let zone: string | undefined; // '' when the receiving interface cannot be determined
    for (const record of records) {
      if (record.type !== DnsRecordType.A && record.type !== DnsRecordType.AAAA) continue;
      const host = dnsCase(record.name);
      if (target && host !== target) continue;
      let data = record.data;
      // A link-local address is reachable only through the interface it was received on (RFC 4007 §6)
      if (record.type === DnsRecordType.AAAA && isLinkLocalIpv6(data) && !data.includes('%')) {
        zone ??= receivingZone(source, this.interfaceName) ?? '';
        data += zone;
      }
      const cached = this.addresses.get(host);
      if (record.ttl === 0) cached?.delete(data);
      else if (cached) cached.set(data, now + record.ttl * 1000);
      else this.addresses.set(host, new Map([[data, now + record.ttl * 1000]]));
    }
    return targetChanged ? this.srv?.data.target : undefined;
  }

  /**
   * Builds a result from live SRV, TXT and address records.
   *
   * @returns {MdnsResolvedService | undefined} The complete service, if available.
   */
  private result(): MdnsResolvedService | undefined {
    const now = Date.now();
    if (!this.srv || this.srv.expires <= now || !this.txt || this.txt.expires <= now) return undefined;
    const cached = this.addresses.get(dnsCase(this.srv.data.target));
    const addresses = [...(cached ?? [])].filter(([, expires]) => expires > now).map(([address]) => address);
    if (addresses.length === 0) return undefined;
    return {
      instanceName: this.instanceName,
      target: this.srv.data.target,
      port: this.srv.data.port,
      addresses,
      txt: this.txt.data,
    };
  }
}

/**
 * Sends one question per packet for compatibility with single-question responders.
 *
 * @param {Mdns} socket - Ready mDNS socket.
 * @param {string} name - Record owner.
 * @param {...DnsRecordType} types - Record types to query.
 */
function ask(socket: Mdns, name: string, ...types: DnsRecordType[]): void {
  for (const type of types) socket.sendQuery([{ name, type, class: DnsClass.IN }]);
}

/**
 * Returns the error a lookup rejects with when it is aborted.
 *
 * @param {AbortSignal | undefined} signal - The aborted signal.
 * @returns {Error} The signal's reason when it is an Error, else an AbortError.
 */
function abortReason(signal: AbortSignal | undefined): Error {
  if (signal?.reason instanceof Error) return signal.reason;
  return new DOMException('mDNS resolution was aborted', 'AbortError');
}

/**
 * Folds DNS names using ASCII case rules (RFC 6762 §16).
 *
 * @param {string} name - DNS name in presentation form.
 * @returns {string} Case-insensitive lookup key.
 */
function dnsCase(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => letter.toLowerCase());
}
