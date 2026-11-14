/**
 * @file packages/dgram/src/matterAdvertise.ts
 * @description Matter discovery advertisements using the local mDNS responder (Matter Core 1.6.1 §4.3).
 * @author Luca Liguori
 * @created 2026-11-11
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

import { randomBytes } from 'node:crypto';
import EventEmitter from 'node:events';
import { isIP } from 'node:net';
import os from 'node:os';

import { MdnsResponder, type MdnsResponderRecord } from './mdnsResponder.js';

/** Common Matter discovery options (Core §4.3.4). */
export interface MatterAdvertiseCommonOptions {
  /** Port accepting the advertised protocol, 1..65535. */
  port: number;
  /** Restrict discovery to this interface; defaults to all external interfaces. */
  interfaceName?: string;
  /** Restrict advertised addresses to this local IPv4 or IPv6 address (an IPv6 zone is allowed). */
  address?: string;
  /** Restrict both transport and address records to this IP family. Defaults to both. */
  family?: 'ipv4' | 'ipv6';
  /** Idle MRP retransmission interval, 0..3600000 milliseconds. */
  sessionIdleInterval?: number;
  /** Active MRP retransmission interval, 0..3600000 milliseconds. */
  sessionActiveInterval?: number;
  /** Active MRP threshold, 0..65535 milliseconds. */
  sessionActiveThreshold?: number;
  /** Only set for devices supporting Long Idle Time ICD mode: current operating mode. */
  longIdleTime?: boolean;
  /** Automatically withdraw discovery after this many milliseconds; omitted means until stop(). */
  durationMs?: number;
  /** Address polling interval in milliseconds, 0 disables polling. Defaults to 10000. */
  addressCheckIntervalMs?: number;
  /** mDNS port override for tests. Defaults to 5353. */
  mdnsPort?: number;
}

/** Optional identifying information for commissionable nodes and commissioners. */
export interface MatterDiscoveryIdentity {
  /** Vendor ID, 0..65535; omitted by default for privacy. */
  vendorId?: number;
  /** Product ID, 0..65535; requires vendorId. */
  productId?: number;
  /** Primary device type, unsigned 32-bit integer. */
  deviceType?: number;
  /** User-controlled discovery name, at most 32 UTF-8 bytes; omitted by default. */
  deviceName?: string;
}

/**
 * Commissioning mode advertised in the CM key of the _matterc._udp TXT record (Core 1.6.1 §4.3.1.7).
 * The values differ from the Administrator Commissioning WindowStatus attribute, where
 * EnhancedWindowOpen = 1 and BasicWindowOpen = 2: Basic and Enhanced are swapped.
 */
export enum CommissioningMode {
  /** CM=0: not in commissioning mode (extended discovery); the _CM subtype is not published. */
  None = 0,
  /** CM=1: basic commissioning, using the passcode of the device (factory new or OpenBasicCommissioningWindow). */
  Basic = 1,
  /** CM=2: enhanced commissioning, using a dynamic passcode from OpenCommissioningWindow. */
  Enhanced = 2,
  /** CM=3: Joint Fabric commissioning, using a dynamic passcode from OpenJointCommissioningWindow. */
  JointFabric = 3,
}

/** Commissionable node discovery (Core §4.3.1). Create a new advertiser for each commissioning window. */
export interface MatterCommissionableOptions extends MatterAdvertiseCommonOptions, MatterDiscoveryIdentity {
  /** Advertise _matterc._udp. */
  mode: 'commissionable';
  /** Full 12-bit discriminator, 0..4095. */
  discriminator: number;
  /** Commissioning mode advertised in CM; Joint Fabric is not supported. Defaults to CommissioningMode.Basic. */
  commissioningMode?: Exclude<CommissioningMode, CommissioningMode.JointFabric>;
  /** Rotating device identifier, 1..50 octets encoded as uppercase hexadecimal. */
  rotatingDeviceId?: string;
}

/** Operational discovery for one fabric (Core §4.3.2). Use one advertiser per fabric. */
export interface MatterOperationalOptions extends MatterAdvertiseCommonOptions {
  /** Advertise _matter._tcp; this service name also covers UDP Matter messaging. */
  mode: 'operational';
  /**
   * Already-derived compressed fabric identifier; not the uncompressed Fabric ID.
   *
   * @remarks
   * Core §4.3.2.2: a 64-bit representation of the full Fabric Reference, derived with Crypto_KDF
   * from the operational root public key and Fabric ID, using "CompressedFabric" as the info string.
   * It identifies the fabric in operational DNS-SD instance names and fabric-specific _I subtypes.
   * Supply the derived value; this advertiser does not compute it from the fabric credentials.
   */
  compressedFabricId: bigint;
  /** Operational node identifier, 1..0xFFFF_FFEF_FFFF_FFFF. */
  nodeId: bigint;
  /** Additional TCP capabilities: 0, 2 (client), 4 (server), or 6 (both). */
  tcpSupport?: 0 | 2 | 4 | 6;
  /** Set only during the NFC incomplete-commissioning steps defined by Core §4.3.2.5. */
  incompleteCommissioning?: boolean;
}

/** Controller/commissioner discovery for User Directed Commissioning (Core §4.3.3). */
export interface MatterControllerOptions extends MatterAdvertiseCommonOptions, MatterDiscoveryIdentity {
  /** Advertise _matterd._udp on the UDC port, distinct from Matter messaging ports. */
  mode: 'controller';
  /** Other Matter messaging ports on this device, used to reject UDC port collisions. */
  matterPorts?: readonly number[];
  /** Whether the commissioner supports the Commissioner Passcode feature. */
  commissionerPasscode?: boolean;
}

/** Options discriminated by the discovery role. */
export type MatterAdvertiseOptions = MatterCommissionableOptions | MatterOperationalOptions | MatterControllerOptions;

/** Events emitted by the Matter advertiser. */
export interface MatterAdvertiseEvents {
  /** All selected interfaces have completed their initial announcements. */
  announced: [];
  /** Discovery has failed on an interface. */
  error: [error: Error];
}

/** A validated Matter service description, independent of network interfaces. */
interface MatterService {
  service: string;
  instance: string;
  subtypes: string[];
  txt: string[];
}

/**
 * Placeholder MAC reported by platforms that hide the real link-layer address (e.g. macOS privacy, Android, iOS).
 */
const PLACEHOLDER_MAC = '020000000000';

/**
 * Random locally administered unicast 48-bit identity, chosen once per process (boot), used as the Matter host name
 * when no real link-layer address is available (Core 1.6.1 §4.3.1.1).
 */
const randomLinkLayerId = ((): string => {
  const bytes = randomBytes(6);
  // Clear the multicast bit and set the locally administered bit.
  bytes[0] = bytes[0] - (bytes[0] % 4) + 2;
  return bytes.toString('hex').toUpperCase();
})();

/**
 * Advertises one Matter discovery role on every selected external interface using the local dgram library.
 * Each interface has its own responder so that link-local address records and multicast sends stay scoped.
 * Start a fresh instance when opening a commissioning window; stop it when the window closes.
 */
export class MatterAdvertise extends EventEmitter<MatterAdvertiseEvents> {
  private readonly responders: MdnsResponder[] = [];
  private readonly options: MatterAdvertiseOptions;
  private started = false;
  private stopped = false;
  private durationTimer?: NodeJS.Timeout;

  /**
   * Validates the advertisement and prepares its interface responders without opening sockets.
   *
   * @param {MatterAdvertiseOptions} options - Discovery role, port, identity and network selection.
   * @throws {Error} If options are invalid or no matching external address exists.
   */
  constructor(options: MatterAdvertiseOptions) {
    super();
    const service = createService(options);
    this.options = { ...options };
    const address = options.address?.split('%')[0];
    const zone = options.address?.split('%')[1];
    if (address !== undefined && !isIP(address)) throw new Error('MatterAdvertise: invalid address');
    if (options.family !== undefined && options.family !== 'ipv4' && options.family !== 'ipv6') throw new Error('MatterAdvertise: invalid family');
    const available = os.networkInterfaces();
    // Core 1.6.1 §4.3.1.1 permits reusing another interface's link-layer identity for local uniqueness.
    const fallbackMac = linkLayerId(Object.values(available).flatMap((infos) => infos ?? []));
    const networks = Object.entries(available).filter(([name]) => !options.interfaceName || options.interfaceName === name);
    // Core §4.3.1: commissionable nodes advertise on all connected IP networks unless explicitly scoped.
    // RFC 6762 §14: each link has an independent name-ownership and address-record scope.
    for (const [name, infos] of networks) {
      const selected = (infos ?? []).filter(
        (info) =>
          !info.internal &&
          (!address || info.address.split('%')[0] === address) &&
          (!zone || zone === name || zone === String(info.scopeid)) &&
          (!options.family || info.family === (options.family === 'ipv4' ? 'IPv4' : 'IPv6')),
      );
      if (selected.length === 0) continue;
      const mac = linkLayerId(selected) ?? fallbackMac ?? randomLinkLayerId;
      const responder = new MdnsResponder({
        port: options.port,
        interfaceName: name,
        address,
        addressFamily: options.family,
        restrictInterfacePackets: true,
        hostName: mac,
        // Core §4.3.1.1 / §4.3.2.4: rotate the target host name when its privacy MAC rotates.
        hostNameProvider: (): string | undefined => {
          const current = os.networkInterfaces();
          return linkLayerId(current[name] ?? []) ?? linkLayerId(Object.values(current).flatMap((entries) => entries ?? [])) ?? randomLinkLayerId;
        },
        alias: false,
        instanceName: service.instance,
        services: [service.service],
        subtypes: service.subtypes,
        txt: service.txt,
        enableIpv4: selected.some((info) => info.family === 'IPv4'),
        enableIpv6: selected.some((info) => info.family === 'IPv6'),
        mdnsPort: options.mdnsPort,
        addressCheckIntervalMs: options.addressCheckIntervalMs,
        // Core §4.3.1 and §4.3.3 require a fresh 64-bit temporary identifier on collision.
        // Operational names (§4.3.2.1) and MAC-derived hosts cannot acquire arbitrary numeric suffixes.
        // Stopping those claims is our failure policy, not an alternate Matter naming scheme.
        resolveConflict: (kind): string | undefined => (kind === 'instance' && options.mode !== 'operational' ? randomInstance() : undefined),
      });
      responder.on('error', (error) => {
        void this.stop();
        if (this.listenerCount('error') > 0) this.emit('error', error);
        else responder.log.error(error.message);
      });
      this.responders.push(responder);
    }
    if (this.responders.length === 0) throw new Error('MatterAdvertise: no matching external interface/address');
  }

  /**
   * Returns the selected interface names.
   *
   * @returns {string[]} Interface names.
   */
  get interfaceNames(): string[] {
    return this.responders.map((responder) => responder.interfaceName);
  }

  /**
   * Opens sockets, probes and announces on every selected interface.
   *
   * @returns {Promise<void>} Resolves after initial announcements or cancellation by stop().
   * @throws {Error} If already started/stopped or a socket cannot be opened.
   */
  async start(): Promise<void> {
    if (this.started || this.stopped) throw new Error('MatterAdvertise: already started or stopped');
    this.started = true;
    try {
      await Promise.all(this.responders.map(async (responder) => responder.start()));
      if (this.stopped) return;
      // Core §4.3.1.2 / §4.3.3: applications must control extended/commissioner discovery lifetime.
      // This optional timer is an application convenience, not a duration mandated by Matter.
      if (this.options.durationMs !== undefined) this.durationTimer = setTimeout(() => void this.stop(), this.options.durationMs).unref();
      this.emit('announced');
    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  /**
   * Withdraws records with goodbye packets and closes all sockets. Safe to call repeatedly.
   *
   * @returns {Promise<void>} Resolves when all responders have stopped.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    clearTimeout(this.durationTimer);
    await Promise.all(this.responders.map(async (responder) => responder.stop()));
  }

  /**
   * Returns currently owned records, grouped by interface.
   *
   * @returns {ReadonlyMap<string, MdnsResponderRecord[]>} Active records for each selected interface.
   */
  activeRecords(): ReadonlyMap<string, MdnsResponderRecord[]> {
    return new Map(this.responders.map((responder) => [responder.interfaceName, responder.activeRecords()]));
  }
}

/**
 * Generates the temporary 64-bit DNS-SD instance identifier.
 *
 * @returns {string} Sixteen uppercase hexadecimal digits.
 */
function randomInstance(): string {
  // Core §4.3.1, reused by §4.3.3: exactly 64 random bits represented by 16 uppercase hex digits.
  return randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Validates an integer option.
 *
 * @param {string} name - Option name.
 * @param {number} value - Value to validate.
 * @param {number} maximum - Inclusive upper bound.
 * @param {number} minimum - Inclusive lower bound.
 * @throws {Error} If the value is outside the integer range.
 */
function integer(name: string, value: number, maximum: number, minimum = 0): void {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`MatterAdvertise: invalid ${name}`);
}

/**
 * Validates options and constructs the role-specific service records (Matter Core §4.3).
 *
 * @param {MatterAdvertiseOptions} options - Advertisement options.
 * @returns {MatterService} Validated service description.
 * @throws {Error} If any supplied option violates its Matter wire format.
 */
function createService(options: MatterAdvertiseOptions): MatterService {
  integer('port', options.port, 65535, 1);
  if (options.mdnsPort !== undefined) integer('mdnsPort', options.mdnsPort, 65535, 1);
  if (options.durationMs !== undefined) integer('durationMs', options.durationMs, 2147483647, 1);
  if (options.addressCheckIntervalMs !== undefined) integer('addressCheckIntervalMs', options.addressCheckIntervalMs, 2147483647);
  const result: MatterService = { service: '', instance: randomInstance(), subtypes: [], txt: [] };
  // Core §4.3.4: decimal milliseconds, without leading zeros; these are upper bounds, not default intervals.
  for (const [key, value, maximum] of [
    ['SII', options.sessionIdleInterval, 3600000], // Idle MRP retry interval: at most 1 hour (3,600,000 ms).
    ['SAI', options.sessionActiveInterval, 3600000], // Active MRP retry interval: at most 1 hour (3,600,000 ms).
    ['SAT', options.sessionActiveThreshold, 65535], // Time kept active after network activity: at most 65.535 seconds (65,535 ms).
  ] as const) {
    if (value === undefined) continue;
    integer(key, value, maximum);
    result.txt.push(`${key}=${value}`);
  }
  // Core §4.3.4: ICD is optional and only valid for nodes supporting Long Idle Time mode.
  if (options.longIdleTime !== undefined) result.txt.push(`ICD=${options.longIdleTime ? 1 : 0}`);
  if (options.mode === 'operational') {
    if (typeof options.compressedFabricId !== 'bigint' || options.compressedFabricId < 0n || options.compressedFabricId > 0xffffffffffffffffn)
      throw new Error('MatterAdvertise: invalid compressedFabricId');
    if (typeof options.nodeId !== 'bigint' || options.nodeId < 1n || options.nodeId > 0xffffffefffffffffn) throw new Error('MatterAdvertise: invalid nodeId');
    // Core §4.3.2.1: <compressed-fabric-id>-<node-id>, each fixed-width 16-digit uppercase hex.
    const fabric = options.compressedFabricId.toString(16).toUpperCase().padStart(16, '0');
    result.instance = `${fabric}-${options.nodeId.toString(16).toUpperCase().padStart(16, '0')}`;
    // Core §4.3.2.3 / §4.3.2.5: _tcp is used even for UDP-only nodes; _I filters by fabric.
    result.service = '_matter._tcp';
    result.subtypes.push(`_I${fabric}`);
    // Core §4.3.4: T is operational-only; reserved bit 0 stays clear, bits 1/2 advertise TCP roles.
    if (options.tcpSupport !== undefined) {
      if (![0, 2, 4, 6].includes(options.tcpSupport)) throw new Error('MatterAdvertise: invalid tcpSupport');
      result.txt.push(`T=${options.tcpSupport}`);
    }
    // Core §4.3.2.5 / §4.3.2.7: NFC incomplete commissioning pairs the _IC subtype with IC=1.
    if (options.incompleteCommissioning) {
      result.subtypes.push('_IC');
      result.txt.push('IC=1');
    }
    return result;
  }
  if (options.mode !== 'commissionable' && options.mode !== 'controller') throw new Error('MatterAdvertise: invalid mode');
  if (options.productId !== undefined && options.vendorId === undefined) throw new Error('MatterAdvertise: productId requires vendorId');
  // Core §4.3.1.6 and §4.3.3: VP is decimal vendor[+product]; optional _V enables filtering.
  if (options.vendorId !== undefined) {
    integer('vendorId', options.vendorId, 65535);
    if (options.productId !== undefined) integer('productId', options.productId, 65535);
    result.txt.push(`VP=${options.vendorId}${options.productId === undefined ? '' : `+${options.productId}`}`);
    result.subtypes.push(`_V${options.vendorId}`);
  }
  // Core §4.3.1.3 / §4.3.1.8 / §4.3.3: decimal DT and _T subtype describe the primary type.
  if (options.deviceType !== undefined) {
    integer('deviceType', options.deviceType, 0xffffffff);
    result.txt.push(`DT=${options.deviceType}`);
    result.subtypes.push(`_T${options.deviceType}`);
  }
  // Core §4.3.1.9 / §4.3.3: DN is optional for privacy and limited to 32 UTF-8 bytes.
  if (options.deviceName !== undefined) {
    if (Buffer.byteLength(options.deviceName) > 32) throw new Error('MatterAdvertise: deviceName exceeds 32 UTF-8 bytes');
    result.txt.push(`DN=${options.deviceName}`);
  }
  // Core §4.3.3: commissioner discovery uses a separate UDC port and optional CP capability.
  if (options.mode === 'controller') {
    if (options.matterPorts?.includes(options.port)) throw new Error('MatterAdvertise: controller UDC port must differ from Matter messaging ports');
    result.service = '_matterd._udp';
    if (options.commissionerPasscode !== undefined) result.txt.push(`CP=${options.commissionerPasscode ? 1 : 0}`);
  } else {
    // Core §4.3.1.3, §4.3.1.5, §4.3.1.7: D is 12 bits; _S uses its upper four bits.
    // _CM is omitted for extended discovery (CM=0); Joint Fabric CM=3 is not exposed by this API.
    integer('discriminator', options.discriminator, 4095);
    const mode = options.commissioningMode ?? CommissioningMode.Basic;
    integer('commissioningMode', mode, 2);
    result.service = '_matterc._udp';
    result.txt.push(`D=${options.discriminator}`, `CM=${mode}`);
    result.subtypes.push(`_L${options.discriminator}`, `_S${Math.floor(options.discriminator / 256)}`);
    if (mode !== CommissioningMode.None) result.subtypes.push('_CM');
    // Core §4.3.1.10: RI is up to 50 octets encoded as uppercase hexadecimal.
    if (options.rotatingDeviceId !== undefined) {
      if (!/^(?:[0-9A-F]{2}){1,50}$/.test(options.rotatingDeviceId)) throw new Error('MatterAdvertise: invalid rotatingDeviceId');
      result.txt.push(`RI=${options.rotatingDeviceId}`);
    }
  }
  return result;
}

/**
 * Finds an available link-layer identity suitable for a Matter host name.
 *
 * @param {os.NetworkInterfaceInfo[]} infos - Interface addresses.
 * @returns {string | undefined} Uppercase 48-bit or 64-bit MAC identity, if available.
 */
function linkLayerId(infos: os.NetworkInterfaceInfo[]): string | undefined {
  return infos
    .filter((info) => !info.internal)
    .map((info) => info.mac.replaceAll(':', '').toUpperCase())
    .find((value) => /^(?:[0-9A-F]{12}|[0-9A-F]{16})$/.test(value) && !/^0+$/.test(value) && value !== PLACEHOLDER_MAC);
}
