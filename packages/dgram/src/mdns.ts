/**
 * @description This file contains the class Mdns.
 * @file mdns.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.1
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
import dgram from 'node:dgram';

// AnsiLogger imports
import { AnsiLogger, BLUE, CYAN, db, GREEN, idn, MAGENTA, nf, rs } from 'node-ansi-logger';
// Utils imports
import { hasParameter } from '@matterbridge/utils';

// Net imports
import { Multicast } from './multicast.js';
export const enum DnsRecordType {
  A = 1,
  NS = 2,
  MD = 3,
  MF = 4,
  CNAME = 5,
  SOA = 6,
  MB = 7,
  MG = 8,
  MR = 9,
  NULL = 10,
  WKS = 11,
  PTR = 12,
  HINFO = 13,
  MINFO = 14,
  MX = 15,
  TXT = 16,
  RP = 17,
  AFSDB = 18,
  X25 = 19,
  ISDN = 20,
  RT = 21,
  NSAP = 22,
  NSAP_PTR = 23,
  SIG = 24,
  KEY = 25,
  PX = 26,
  GPOS = 27,
  AAAA = 28,
  LOC = 29,
  NXT = 30,
  EID = 31,
  NIMLOC = 32,
  SRV = 33,
  ATMA = 34,
  NAPTR = 35,
  KX = 36,
  CERT = 37,
  A6 = 38,
  DNAME = 39,
  SINK = 40,
  OPT = 41,
  APL = 42,
  DS = 43,
  SSHFP = 44,
  IPSECKEY = 45,
  RRSIG = 46,
  NSEC = 47,
  DNSKEY = 48,
  DHCID = 49,
  NSEC3 = 50,
  NSEC3PARAM = 51,
  TLSA = 52,
  SMIMEA = 53,
  HIP = 55,
  NINFO = 56,
  RKEY = 57,
  TALINK = 58,
  CDS = 59,
  CDNSKEY = 60,
  OPENPGPKEY = 61,
  CSYNC = 62,
  ZONEMD = 63,
  SVCB = 64,
  HTTPS = 65,
  SPF = 99,
  UINFO = 100,
  UID = 101,
  GID = 102,
  UNSPEC = 103,
  NID = 104,
  L32 = 105,
  L64 = 106,
  LP = 107,
  EUI48 = 108,
  EUI64 = 109,
  TKEY = 249,
  TSIG = 250,
  IXFR = 251,
  AXFR = 252,
  MAILB = 253,
  MAILA = 254,
  ANY = 255,
  URI = 256,
  CAA = 257,
  AVC = 258,
  DOA = 259,
  AMTRELAY = 260,
  ZONEVERSION = 261,
  // 262-32767 are unassigned/reserved
  TA = 32768,
  DLV = 32769,
}

export const enum DnsClass {
  IN = 1, // Internet
  CH = 3, // Chaos
  HS = 4, // Hesiod
  ANY = 255, // Any class
}

export const enum DnsClassFlag {
  FLUSH = 0x8000, // For answers (resource records)
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  QU = 0x8000, // For questions (unicast response preferred)
}

export interface MdnsMessage {
  id: number;
  qr: number; // 0 for query, 1 for response
  opcode: number; // Operation Code = 0 for standard query
  aa: boolean; // Authoritative Answer flag
  tc: boolean; // Truncated message flag
  rd: boolean; // Recursion Desired flag
  ra: boolean; // Recursion Available flag
  z: number; // Reserved bits
  rcode: number; // Response Code = 0 for no error
  qdCount: number; // Question Count
  anCount: number; // Answer Record Count
  nsCount: number; // Authority Record Count
  arCount: number; // Additional Record Count
  questions?: DnsQuestion[];
  answers?: MdnsRecord[];
  authorities?: MdnsRecord[];
  additionals?: MdnsRecord[];
}

interface DnsQuestion {
  name: string;
  type: number;
  class: number;
}

interface MdnsRecord {
  name: string;
  type: number;
  class: number;
  ttl: number;
  data: string;
}

type IpAddress = string;

/**
 * Checks if a given message is an mDNS message.
 *
 * @param {Buffer} message - The message buffer to check.
 * @returns {boolean} True if the message is an mDNS message, false otherwise.
 */
export function isMdns(message: Buffer): boolean {
  if (!message || message.length < 12) return false;
  const id = message.readUInt16BE(0);
  return id === 0;
}

/**
 * Checks if a given mDNS message is a query.
 *
 * @param {Buffer} message - The mDNS message buffer to check.
 * @returns {boolean} True if the message is a query, false otherwise.
 */
export function isMdnsQuery(message: Buffer): boolean {
  if (message.length < 12) return false;
  const id = message.readUInt16BE(0);
  const flags = message.readUInt16BE(2);

  const qr = (flags & 0x8000) >> 15; // Bit 15: 0=query, 1=response.
  return id == 0 && qr === 0;
}

/**
 * Checks if a given mDNS message is a query.
 *
 * @param {Buffer} message - The mDNS message buffer to check.
 * @returns {boolean} True if the message is a query, false otherwise.
 */
export function isMdnsResponse(message: Buffer): boolean {
  if (message.length < 12) return false;
  const id = message.readUInt16BE(0);
  const flags = message.readUInt16BE(2);

  const qr = (flags & 0x8000) >> 15; // Bit 15: 0=query, 1=response.
  return id == 0 && qr === 1;
}

export class Mdns extends Multicast {
  deviceQueries = new Map<IpAddress, { rinfo: dgram.RemoteInfo; query: MdnsMessage }>();
  deviceResponses = new Map<IpAddress, { rinfo: dgram.RemoteInfo; response: MdnsMessage; dataPTR?: string }>();
  filters: string[] = [];
  ipFilters: string[] = [];

  /**
   * Creates an instance of the Mdns class.
   *
   * @param {string} name - The internal name of the mDNS server for the logs.
   * @param {string} multicastAddress - The multicast address for mDNS (i.e. 224.0.0.251 for udp4 or ff02::fb for udp6).
   * @param {number} multicastPort - The port for mDNS (i.e. 5353).
   * @param {('udp4' | 'udp6')} socketType - The type of socket to create (either 'udp4' or 'udp6').
   * @param {boolean} [reuseAddr] - Whether to reuse the address. Defaults to true.
   * @param {string} [interfaceName] - The optional name of the network interface to use.
   * @param {string} [interfaceAddress] - The optional IP address of the network interface to use.
   * @param {string} [outgoingInterfaceAddress] - The address of the outgoing network interface.
   */
  constructor(
    name: string,
    multicastAddress: string,
    multicastPort: number,
    socketType: 'udp4' | 'udp6',
    reuseAddr: boolean | undefined = true,
    interfaceName?: string,
    interfaceAddress?: string,
    outgoingInterfaceAddress?: string,
  ) {
    super(name, multicastAddress, multicastPort, socketType, reuseAddr, interfaceName, interfaceAddress, outgoingInterfaceAddress);
  }

  onQuery(rinfo: dgram.RemoteInfo, _query: MdnsMessage) {
    this.log.debug(`mDNS query received from ${BLUE}${rinfo.family}${db} ${BLUE}${rinfo.address}${db}:${BLUE}${rinfo.port}${db}`);
  }

  onResponse(rinfo: dgram.RemoteInfo, _response: MdnsMessage) {
    this.log.debug(`mDNS response received from ${BLUE}${rinfo.family}${db} ${BLUE}${rinfo.address}${db}:${BLUE}${rinfo.port}${db}`);
  }

  override onMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    if (this.filters.length === 0)
      this.log.info(`Dgram mDNS server received a mDNS message from ${BLUE}${rinfo.family}${nf} ${BLUE}${rinfo.address}${nf}:${BLUE}${rinfo.port}${nf}`);
    // Apply ip filters if any
    if (this.ipFilters.length > 0) {
      for (const filter of this.ipFilters) {
        if (rinfo.address === filter) {
          this.log.debug(`mDNS message filtered out by ip filters: ${this.ipFilters.join(', ')}`);
          return;
        }
      }
      this.log.debug(`mDNS message does not match any ip filter, ignoring.`);
      return;
    }
    try {
      const result = this.decodeMdnsMessage(msg);
      if (result.qr === 0) {
        this.deviceQueries.set(rinfo.address, { rinfo, query: result });
        this.onQuery(rinfo, result);
      } else {
        const ptr =
          result.answers?.find((record) => record.name === '_shelly._tcp.local' && record.type === DnsRecordType.PTR) ||
          result.answers?.find((record) => record.name === '_http._tcp.local' && record.type === DnsRecordType.PTR) ||
          result.answers?.find((record) => record.type === DnsRecordType.PTR) ||
          result.answers?.find((record) => record.type === DnsRecordType.TXT) ||
          result.answers
            ? result.answers[0]
            : undefined; // Fallback to the first answer if no PTR or TXT found
        this.deviceResponses.set(rinfo.address, { rinfo, response: result, dataPTR: ptr?.type === DnsRecordType.PTR ? ptr?.data : ptr?.name });
        this.onResponse(rinfo, result);
      }
      // Apply filters if any
      if (this.filters.length > 0) {
        this.log.debug(`mDNS message filtered out by filters: ${this.filters.join(', ')}`);
        for (const filter of this.filters) {
          const foundInQuestions = result.questions?.some((q) => q.name.includes(filter));
          const foundInAnswers = result.answers?.some((a) => a.name.includes(filter) || a.data.includes(filter));
          const foundInAdditionals = result.additionals?.some((a) => a.name.includes(filter) || a.data.includes(filter));
          if (foundInQuestions || foundInAnswers || foundInAdditionals) {
            this.log.info(`Dgram mDNS server received a mDNS message from ${BLUE}${rinfo.family}${nf} ${BLUE}${rinfo.address}${nf}:${BLUE}${rinfo.port}${nf}`);
            this.logMdnsMessage(result);
            return;
          }
        }
        this.log.debug(`mDNS message does not match any filter, ignoring.`);
        return;
      }
      this.logMdnsMessage(result);
    } catch (error) {
      this.log.error(`Error decoding mDNS message: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Decodes an mDNS message, including the header, question section, answer section,
   * authority section, and additional section.
   *
   * @param {Buffer} msg - The raw mDNS message buffer.
   * @returns {MdnsMessage} An object representing the decoded mDNS message.
   * @throws {Error} if the message is too short.
   */
  decodeMdnsMessage(msg: Buffer): MdnsMessage {
    if (msg.length < 12) {
      throw new Error('mDNS message too short');
    }

    const id = msg.readUInt16BE(0);
    const flags = msg.readUInt16BE(2);

    const qr = (flags & 0x8000) >> 15; // Bit 15: 0=query, 1=response (QR = Query/Response).
    const opcode = (flags & 0x7800) >> 11; // Bits 14-11 (OPCODE: kind of query; in mDNS this is typically 0 = standard query).
    const aa = Boolean(flags & 0x0400); // Bit 10 (AA: Authoritative Answer; sender claims authority for the name).
    const tc = Boolean(flags & 0x0200); // Bit 9 (TC: TrunCation; message was truncated due to length limits).
    const rd = Boolean(flags & 0x0100); // Bit 8 (RD: Recursion Desired; usually 0 in mDNS).
    const ra = Boolean(flags & 0x0080); // Bit 7 (RA: Recursion Available; meaningful for recursive resolvers, usually 0 in mDNS).
    const z = (flags & 0x0070) >> 4; // Bits 6-4 (Z: reserved in DNS; should be 0 in classic DNS/mDNS).
    const rcode = flags & 0x000f; // Bits 3-0 (RCODE: Response Code; 0 = NoError, 3 = NXDomain, etc).

    const qdCount = msg.readUInt16BE(4);
    const anCount = msg.readUInt16BE(6);
    const nsCount = msg.readUInt16BE(8);
    const arCount = msg.readUInt16BE(10);

    const mdnsMessage: MdnsMessage = {
      id,
      qr,
      opcode,
      aa,
      tc,
      rd,
      ra,
      z,
      rcode,
      qdCount,
      anCount,
      nsCount,
      arCount,
      questions: [],
      answers: [],
      authorities: [],
      additionals: [],
    };

    let offset = 12;

    // Decode the question section.
    for (let i = 0; i < qdCount; i++) {
      const qnameResult = this.decodeDnsName(msg, offset);
      const qname = qnameResult.name;
      offset = qnameResult.newOffset;
      const qtype = msg.readUInt16BE(offset);
      offset += 2;
      const qclass = msg.readUInt16BE(offset);
      offset += 2;
      mdnsMessage.questions?.push({ name: qname, type: qtype, class: qclass });
    }

    // Decode the answer section.
    for (let i = 0; i < anCount; i++) {
      const rrResult = this.decodeResourceRecord(msg, offset);
      mdnsMessage.answers?.push(rrResult.record);
      offset = rrResult.newOffset;
    }

    // Decode the authority (NS) section.
    for (let i = 0; i < nsCount; i++) {
      const rrResult = this.decodeResourceRecord(msg, offset);
      mdnsMessage.authorities?.push(rrResult.record);
      offset = rrResult.newOffset;
    }

    // Decode the additional records section.
    for (let i = 0; i < arCount; i++) {
      const rrResult = this.decodeResourceRecord(msg, offset);
      mdnsMessage.additionals?.push(rrResult.record);
      offset = rrResult.newOffset;
    }

    return mdnsMessage;
  }

  /**
   * Decodes a DNS name from a buffer, handling compression.
   *
   * @param {Buffer} msg - The full mDNS message buffer.
   * @param {number} offset - The offset at which the DNS name starts.
   * @returns {{ name: string; newOffset: number }} An object with the decoded name and the new offset.
   * @throws {Error} if the offset exceeds the buffer length or too many iterations are performed.
   */
  decodeDnsName(msg: Buffer, offset: number): { name: string; newOffset: number } {
    const labels: string[] = [];
    let jumped = false;
    let originalOffset = offset;
    let iterations = 0; // Prevent infinite loops

    while (true) {
      // Safety guard: prevent infinite loops in malformed messages.
      if (iterations++ > 1000) {
        throw new Error('Too many iterations while decoding DNS name. Possible malformed message.');
      }
      // Check that offset is within buffer bounds.
      if (offset >= msg.length) {
        throw new Error('Offset exceeds buffer length while decoding DNS name.');
      }
      const len = msg.readUInt8(offset);
      if (len === 0) {
        offset++;
        break;
      }
      // Check for pointer (first two bits are 11)
      if ((len & 0xc0) === 0xc0) {
        // Ensure the pointer has two bytes available.
        if (offset + 1 >= msg.length) {
          throw new Error('Incomplete pointer encountered while decoding DNS name.');
        }
        const pointer = ((len & 0x3f) << 8) | msg.readUInt8(offset + 1);
        if (!jumped) {
          originalOffset = offset + 2;
        }
        offset = pointer;
        jumped = true;
        continue;
      }
      offset++;
      // Check that the label length doesn't go beyond the buffer.
      if (offset + len > msg.length) {
        throw new Error('Label length exceeds buffer bounds while decoding DNS name.');
      }
      labels.push(msg.toString('utf8', offset, offset + len));
      offset += len;
    }

    return { name: labels.join('.'), newOffset: jumped ? originalOffset : offset };
  }

  /**
   * Encodes a domain name into the DNS label format.
   *
   * For example, "example.local" becomes:
   * [7] "example" [5] "local" [0]
   *
   * @param {string} name - The domain name to encode.
   * @returns {Buffer} The encoded domain name as a Buffer.
   */
  encodeDnsName(name: string): Buffer {
    const labels = name.split('.');
    const buffers: Buffer[] = labels.map((label) => {
      const lenBuf = Buffer.alloc(1);
      lenBuf.writeUInt8(label.length, 0);
      return Buffer.concat([lenBuf, Buffer.from(label)]);
    });
    // Append the null byte to terminate the name.
    return Buffer.concat([...buffers, Buffer.from([0])]);
  }

  /**
   * Encodes TXT record RDATA.
   *
   * In DNS/mDNS, TXT RDATA is a sequence of one or more <character-string>,
   * each encoded as: [length byte][UTF-8 bytes].
   *
   * @param {string[]} txt - Array of TXT entries, e.g. ["key=value", "path=/"].
   * @returns {Buffer} Encoded TXT RDATA.
   * @throws {Error} If any entry exceeds 255 bytes.
   *
   * @example
   * const txtRdata = mdns.encodeTxtRdata(['txtvers=1', 'path=/']);
   * mdns.sendResponse([
   *   { name: 'example._http._tcp.local', rtype: DnsRecordType.TXT, rclass: DnsClass.IN | DnsClassFlag.FLUSH, ttl: 120, rdata: txtRdata },
   * ]);
   */
  encodeTxtRdata(txt: string[]): Buffer {
    const parts = txt.map((entry) => {
      const value = Buffer.from(entry, 'utf8');
      if (value.length > 255) throw new Error(`TXT entry too long: ${entry}`);
      return Buffer.concat([Buffer.from([value.length]), value]);
    });
    return Buffer.concat(parts);
  }

  /**
   * Encodes SRV record RDATA.
   *
   * SRV RDATA layout (RFC 2782):
   * - priority (2 bytes)
   * - weight   (2 bytes)
   * - port     (2 bytes)
   * - target   (DNS name)
   *
   * @param {number} priority - SRV priority.
   * @param {number} weight - SRV weight.
   * @param {number} port - Service port.
   * @param {string} target - Target hostname (e.g. "matterbridge.local").
   * @returns {Buffer} Encoded SRV RDATA.
   */
  encodeSrvRdata(priority: number, weight: number, port: number, target: string): Buffer {
    const fixed = Buffer.alloc(6);
    fixed.writeUInt16BE(priority, 0);
    fixed.writeUInt16BE(weight, 2);
    fixed.writeUInt16BE(port, 4);
    return Buffer.concat([fixed, this.encodeDnsName(target)]);
  }

  /**
   * Encodes an IPv4 address for an A record RDATA (4 bytes).
   *
   * @param {string} ipv4 - IPv4 address, e.g. "192.168.1.10".
   * @returns {Buffer} 4-byte buffer.
   * @throws {Error} If the address is not a valid dotted-quad.
   */
  encodeA(ipv4: string): Buffer {
    const parts = ipv4.split('.').map((p) => Number(p));
    if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      throw new Error(`Invalid IPv4 address: ${ipv4}`);
    }
    return Buffer.from(parts);
  }

  /**
   * Encodes an IPv6 address for an AAAA record RDATA (16 bytes).
   *
   * Supports the "::" zero-compression form and ignores an optional scope id
   * suffix (e.g. "fe80::1%12" or "fe80::1%eth0").
   *
   * @param {string} ipv6WithOptionalScope - IPv6 address (optionally with scope id).
   * @returns {Buffer} 16-byte buffer.
   * @throws {Error} If the address is not a valid IPv6 literal.
   */
  encodeAAAA(ipv6WithOptionalScope: string): Buffer {
    const ipv6 = ipv6WithOptionalScope.split('%')[0];

    // Expand IPv6 to 8 groups of 16-bit words.
    const [left, right] = ipv6.split('::');
    const leftParts = left ? left.split(':').filter(Boolean) : [];
    const rightParts = right ? right.split(':').filter(Boolean) : [];
    if (ipv6.includes('::')) {
      const missing = 8 - (leftParts.length + rightParts.length);
      if (missing < 0) throw new Error(`Invalid IPv6 address: ${ipv6WithOptionalScope}`);
      const groups = [...leftParts, ...Array(missing).fill('0'), ...rightParts];
      return Buffer.from(
        groups.flatMap((g) => {
          const word = parseInt(g, 16);
          if (!Number.isFinite(word) || word < 0 || word > 0xffff) {
            throw new Error(`Invalid IPv6 group: ${g}`);
          }
          return [(word >> 8) & 0xff, word & 0xff];
        }),
      );
    }

    const groups = ipv6.split(':');
    if (groups.length !== 8) throw new Error(`Invalid IPv6 address: ${ipv6WithOptionalScope}`);
    return Buffer.from(
      groups.flatMap((g) => {
        if (!g) throw new Error(`Invalid IPv6 group: ${g}`);
        const word = parseInt(g, 16);
        if (!Number.isFinite(word) || word < 0 || word > 0xffff) throw new Error(`Invalid IPv6 group: ${g}`);
        return [(word >> 8) & 0xff, word & 0xff];
      }),
    );
  }

  /**
   * Decodes a DNS resource record.
   *
   * @param {Buffer} msg - The full mDNS message buffer.
   * @param {number} offset - The offset at which the resource record starts.
   * @returns {{ record: MdnsRecord; newOffset: number }} An object containing the decoded record and the new offset.
   */
  decodeResourceRecord(msg: Buffer, offset: number): { record: MdnsRecord; newOffset: number } {
    // Decode the NAME field (which may be compressed)
    const nameResult = this.decodeDnsName(msg, offset);
    const name = nameResult.name;
    offset = nameResult.newOffset;

    // Read TYPE (16 bits), CLASS (16 bits), TTL (32 bits), and RDLENGTH (16 bits)
    const type = msg.readUInt16BE(offset);
    offset += 2;
    const rrclass = msg.readUInt16BE(offset);
    offset += 2;
    const ttl = msg.readUInt32BE(offset);
    offset += 4;
    const rdlength = msg.readUInt16BE(offset);
    offset += 2;

    let data = '';
    if (type === DnsRecordType.PTR) {
      // PTR record (type 12): decode its RDATA as a domain name.
      const ptrResult = this.decodeDnsName(msg, offset);
      data = ptrResult.name;
      offset += rdlength;
    } else if (type === DnsRecordType.TXT) {
      // TXT record: may consist of one or more length-prefixed strings.
      const txtStrings: string[] = [];
      const end = offset + rdlength;
      while (offset < end) {
        const txtLen = msg[offset];
        offset++;
        const txt = msg.slice(offset, offset + txtLen).toString('utf8');
        txtStrings.push(txt);
        offset += txtLen;
      }
      data = txtStrings.join(', ');
    } else if (type === DnsRecordType.SRV) {
      // SRV record (type === 33): consists of 2 bytes for priority, 2 for weight, 2 for port, followed by the target domain name.
      const priority = msg.readUInt16BE(offset);
      const weight = msg.readUInt16BE(offset + 2);
      const port = msg.readUInt16BE(offset + 4);
      offset += 6;
      const srvTargetResult = this.decodeDnsName(msg, offset);
      data = JSON.stringify({
        priority,
        weight,
        port,
        target: srvTargetResult.name,
      });
      offset = srvTargetResult.newOffset;
    } else if (type === DnsRecordType.A) {
      // A record (type 1): an IPv4 address stored in 4 bytes.
      const ipBytes = msg.slice(offset, offset + 4);
      data = Array.from(ipBytes).join('.');
      offset += 4;
    } else if (type === DnsRecordType.AAAA) {
      // AAAA record (type 28): IPv6 address stored in 16 bytes.
      const ipBytes = msg.slice(offset, offset + 16);
      // Convert the 16 bytes into an IPv6 address string (colon-separated)
      const ipv6Parts: string[] = [];
      for (let i = 0; i < 16; i += 2) {
        ipv6Parts.push(ipBytes.readUInt16BE(i).toString(16));
      }
      data = ipv6Parts.join(':');
      offset += 16;
    } else if (type === DnsRecordType.NSEC) {
      // NSEC record: RDATA consists of:
      //   - Next Domain Name (in DNS label format)
      //   - Type Bit Maps (variable length)
      const { name: nextDomain, newOffset } = this.decodeDnsName(msg, offset);
      const nextDomainLength = newOffset - offset;
      offset = newOffset;

      // Calculate the remaining length for the type bit maps.
      const bitmapLength = rdlength - nextDomainLength;
      const bitmapData = msg.slice(offset, offset + bitmapLength);
      const types: string[] = [];
      let bitmapOffset = 0;

      while (bitmapOffset < bitmapData.length) {
        const windowBlock = bitmapData[bitmapOffset];
        const windowLength = bitmapData[bitmapOffset + 1];
        bitmapOffset += 2;
        for (let i = 0; i < windowLength; i++) {
          const octet = bitmapData[bitmapOffset + i];
          for (let bit = 0; bit < 8; bit++) {
            if (octet & (0x80 >> bit)) {
              const typeCode = windowBlock * 256 + i * 8 + bit;
              types.push(this.dnsTypeToString(typeCode));
            }
          }
        }
        bitmapOffset += windowLength;
      }
      data = JSON.stringify({
        nextDomain,
        types,
      });
      offset += bitmapLength;
    } else {
      // Fall back
      data = msg.slice(offset, offset + rdlength).toString('hex');
      offset += rdlength;
    }

    return {
      record: { name, type, class: rrclass, ttl, data },
      newOffset: offset,
    };
  }

  /**
   * Sends a DNS query with multiple questions.
   *
   * @param {Array<{ name: string; type: number; class: number; unicastResponse?: boolean }>} questions - Array of questions
   * to include in the query.
   * @returns {Buffer<ArrayBuffer>} The constructed query buffer.
   *
   * @remarks
   * Each question should have a name (e.g., "_http._tcp.local"), type (e.g., DnsRecordType.PTR), class (e.g., DnsClass.IN),
   * and an optional unicastResponse flag (this will add the DnsClassFlag.QU flag to the query).
   */
  sendQuery(questions: { name: string; type: number; class: number; unicastResponse?: boolean }[]): Buffer<ArrayBuffer> {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // ID
    header.writeUInt16BE(0, 2); // Flags
    header.writeUInt16BE(questions.length, 4); // QDCOUNT
    header.writeUInt16BE(0, 6); // ANCOUNT
    header.writeUInt16BE(0, 8); // NSCOUNT
    header.writeUInt16BE(0, 10); // ARCOUNT

    const questionBuffers = questions.map(({ name, type: qtype, class: qclass, unicastResponse = false }) => {
      const qname = this.encodeDnsName(name);
      const qfields = Buffer.alloc(4);
      qfields.writeUInt16BE(qtype, 0);
      qfields.writeUInt16BE(unicastResponse ? qclass | DnsClassFlag.QU : qclass, 2);
      return Buffer.concat([qname, qfields]);
    });

    const query = Buffer.concat([header, ...questionBuffers]);
    if (hasParameter('v') || hasParameter('verbose')) {
      const decoded = this.decodeMdnsMessage(query);
      this.logMdnsMessage(decoded, undefined, 'Sending query mDNS message');
    }

    this.socket.send(query, 0, query.length, this.multicastPort, this.multicastAddress, (error: Error | null) => {
      if (error) {
        this.log.error(`Dgram mDNS server failed to send query message: ${error instanceof Error ? error.message : error}`);
        this.emit('error', error);
      } else {
        this.log.debug(`Dgram mDNS server sent query message`);
        this.emit('sent', query, this.multicastAddress, this.multicastPort);
      }
    });
    return query;
  }

  /**
   * Constructs an mDNS response packet and sends it to the multicast address and port.
   *
   * @param {Array<{ name: string; rtype: number; rclass: number; ttl: number; rdata: Buffer }>} answers - Array of answer records.
   * @returns {Buffer<ArrayBuffer>} The constructed response buffer.
   *
   * @example
   *   const ptrRdata = mdnsIpv4.encodeDnsName('matterbridge._http._tcp.local');
   *   mdnsIpv4.sendResponse([{ name: '_http._tcp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl: 120, rdata: ptrRdata }]);
   */
  sendResponse(answers: { name: string; rtype: number; rclass: number; ttl: number; rdata: Buffer }[]): Buffer<ArrayBuffer> {
    if (!Array.isArray(answers) || answers.length === 0) {
      throw new Error('sendResponse requires a non-empty answers array');
    }
    // Create a 12-byte DNS header.
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // ID is set to 0 in mDNS.
    // Set flags: QR (response) bit and AA (authoritative answer) bit.
    header.writeUInt16BE(0x8400, 2);
    header.writeUInt16BE(0, 4); // QDCOUNT: 0 questions in response.
    header.writeUInt16BE(answers.length, 6); // ANCOUNT: number of answer records.
    header.writeUInt16BE(0, 8); // NSCOUNT: 0 authority records.
    header.writeUInt16BE(0, 10); // ARCOUNT: 0 additional records.

    const answerBuffers = answers.map(({ name, rtype, rclass, ttl, rdata }) => {
      // Encode the domain name in DNS label format.
      const aname = this.encodeDnsName(name);

      // Prepare the fixed part of the answer record:
      // - 2 bytes for qtype,
      // - 2 bytes for qclass,
      // - 4 bytes for TTL,
      // - 2 bytes for RDLENGTH (length of the rdata).
      const answerFixed = Buffer.alloc(10);
      answerFixed.writeUInt16BE(rtype, 0); // Record type.
      answerFixed.writeUInt16BE(rclass, 2); // Record class.
      answerFixed.writeUInt32BE(ttl, 4); // Time-to-live.
      answerFixed.writeUInt16BE(rdata.length, 8); // RDLENGTH.

      // Concatenate the answer: encoded name, fixed fields, and resource data.
      return Buffer.concat([aname, answerFixed, rdata]);
    });

    // Concatenate header and answers to form the complete mDNS response packet.
    const response = Buffer.concat([header, ...answerBuffers]);
    if (hasParameter('v') || hasParameter('verbose')) {
      const decoded = this.decodeMdnsMessage(response);
      this.logMdnsMessage(decoded, undefined, 'Sending response mDNS message');
    }

    // Send the response packet via the socket.
    this.socket.send(response, 0, response.length, this.multicastPort, this.multicastAddress, (error: Error | null) => {
      if (error) {
        this.log.error(`Dgram mDNS server failed to send response message: ${error instanceof Error ? error.message : error}`);
        this.emit('error', error);
      } else {
        this.log.debug(`Dgram mDNS server sent response message`);
        this.emit('sent', response, this.multicastAddress, this.multicastPort);
      }
    });
    return response;
  }

  /**
   * Converts a DNS record type numeric value to its string representation.
   *
   * @param {number} type - The numeric DNS record type.
   * @returns {string} The string representation of the record type.
   */
  dnsTypeToString(type: number): string {
    const typeMap: Record<number, string> = {
      [DnsRecordType.A]: 'A',
      [DnsRecordType.NS]: 'NS',
      [DnsRecordType.MD]: 'MD',
      [DnsRecordType.MF]: 'MF',
      [DnsRecordType.CNAME]: 'CNAME',
      [DnsRecordType.SOA]: 'SOA',
      [DnsRecordType.MB]: 'MB',
      [DnsRecordType.MG]: 'MG',
      [DnsRecordType.MR]: 'MR',
      [DnsRecordType.NULL]: 'NULL',
      [DnsRecordType.WKS]: 'WKS',
      [DnsRecordType.PTR]: 'PTR',
      [DnsRecordType.HINFO]: 'HINFO',
      [DnsRecordType.MINFO]: 'MINFO',
      [DnsRecordType.MX]: 'MX',
      [DnsRecordType.TXT]: 'TXT',
      [DnsRecordType.RP]: 'RP',
      [DnsRecordType.AFSDB]: 'AFSDB',
      [DnsRecordType.X25]: 'X25',
      [DnsRecordType.ISDN]: 'ISDN',
      [DnsRecordType.RT]: 'RT',
      [DnsRecordType.NSAP]: 'NSAP',
      [DnsRecordType.NSAP_PTR]: 'NSAP_PTR',
      [DnsRecordType.SIG]: 'SIG',
      [DnsRecordType.KEY]: 'KEY',
      [DnsRecordType.PX]: 'PX',
      [DnsRecordType.GPOS]: 'GPOS',
      [DnsRecordType.AAAA]: 'AAAA',
      [DnsRecordType.LOC]: 'LOC',
      [DnsRecordType.NXT]: 'NXT',
      [DnsRecordType.EID]: 'EID',
      [DnsRecordType.NIMLOC]: 'NIMLOC',
      [DnsRecordType.SRV]: 'SRV',
      [DnsRecordType.ATMA]: 'ATMA',
      [DnsRecordType.NAPTR]: 'NAPTR',
      [DnsRecordType.KX]: 'KX',
      [DnsRecordType.CERT]: 'CERT',
      [DnsRecordType.A6]: 'A6',
      [DnsRecordType.DNAME]: 'DNAME',
      [DnsRecordType.SINK]: 'SINK',
      [DnsRecordType.OPT]: 'OPT',
      [DnsRecordType.APL]: 'APL',
      [DnsRecordType.DS]: 'DS',
      [DnsRecordType.SSHFP]: 'SSHFP',
      [DnsRecordType.IPSECKEY]: 'IPSECKEY',
      [DnsRecordType.RRSIG]: 'RRSIG',
      [DnsRecordType.NSEC]: 'NSEC',
      [DnsRecordType.DNSKEY]: 'DNSKEY',
      [DnsRecordType.DHCID]: 'DHCID',
      [DnsRecordType.NSEC3]: 'NSEC3',
      [DnsRecordType.NSEC3PARAM]: 'NSEC3PARAM',
      [DnsRecordType.TLSA]: 'TLSA',
      [DnsRecordType.SMIMEA]: 'SMIMEA',
      [DnsRecordType.HIP]: 'HIP',
      [DnsRecordType.NINFO]: 'NINFO',
      [DnsRecordType.RKEY]: 'RKEY',
      [DnsRecordType.TALINK]: 'TALINK',
      [DnsRecordType.CDS]: 'CDS',
      [DnsRecordType.CDNSKEY]: 'CDNSKEY',
      [DnsRecordType.OPENPGPKEY]: 'OPENPGPKEY',
      [DnsRecordType.CSYNC]: 'CSYNC',
      [DnsRecordType.ZONEMD]: 'ZONEMD',
      [DnsRecordType.SVCB]: 'SVCB',
      [DnsRecordType.HTTPS]: 'HTTPS',
      [DnsRecordType.SPF]: 'SPF',
      [DnsRecordType.UINFO]: 'UINFO',
      [DnsRecordType.UID]: 'UID',
      [DnsRecordType.GID]: 'GID',
      [DnsRecordType.UNSPEC]: 'UNSPEC',
      [DnsRecordType.NID]: 'NID',
      [DnsRecordType.L32]: 'L32',
      [DnsRecordType.L64]: 'L64',
      [DnsRecordType.LP]: 'LP',
      [DnsRecordType.EUI48]: 'EUI48',
      [DnsRecordType.EUI64]: 'EUI64',
      [DnsRecordType.TKEY]: 'TKEY',
      [DnsRecordType.TSIG]: 'TSIG',
      [DnsRecordType.IXFR]: 'IXFR',
      [DnsRecordType.AXFR]: 'AXFR',
      [DnsRecordType.MAILB]: 'MAILB',
      [DnsRecordType.MAILA]: 'MAILA',
      [DnsRecordType.ANY]: 'ANY',
      [DnsRecordType.URI]: 'URI',
      [DnsRecordType.CAA]: 'CAA',
      [DnsRecordType.AVC]: 'AVC',
      [DnsRecordType.DOA]: 'DOA',
      [DnsRecordType.AMTRELAY]: 'AMTRELAY',
      [DnsRecordType.ZONEVERSION]: 'ZONEVERSION',
      [DnsRecordType.TA]: 'TA',
      [DnsRecordType.DLV]: 'DLV',
    };

    return typeMap[type] ?? `TYPE${type}`;
  }

  /**
   * Converts a DNS response class numeric value to its string representation.
   *
   * @param {number} cls - The numeric DNS class.
   * @returns {string} The string representation of the DNS class.
   */
  dnsResponseClassToString(cls: number): string {
    const isFlush = !!(cls & DnsClassFlag.FLUSH);
    const baseClass = cls & 0x7fff;

    let classStr: string;
    switch (baseClass) {
      case DnsClass.IN:
        classStr = 'IN';
        break;
      case DnsClass.CH:
        classStr = 'CH';
        break;
      case DnsClass.HS:
        classStr = 'HS';
        break;
      case DnsClass.ANY:
        classStr = 'ANY';
        break;
      default:
        classStr = `CLASS${baseClass}`;
    }

    return isFlush ? `${classStr}|FLUSH` : classStr;
  }

  /**
   * Converts a DNS question class to a human-readable string.
   * Adds support for mDNS QU (unicast-response) bit.
   *
   * @param {number} cls - The numeric question class.
   * @returns {string} The string representation, e.g. "IN|QU"
   */
  dnsQuestionClassToString(cls: number): string {
    const isQU = !!(cls & DnsClassFlag.QU);
    const baseClass = cls & 0x7fff;

    let classStr: string;
    switch (baseClass) {
      case DnsClass.IN:
        classStr = 'IN';
        break;
      case DnsClass.CH:
        classStr = 'CH';
        break;
      case DnsClass.HS:
        classStr = 'HS';
        break;
      case DnsClass.ANY:
        classStr = 'ANY';
        break;
      default:
        classStr = `CLASS${baseClass}`;
    }

    return isQU ? `${classStr}|QU` : classStr;
  }

  /**
   * Logs the decoded mDNS message header.
   *
   * @param {MdnsMessage} msg - The mDNS message header object.
   * @param {AnsiLogger} [log] - The logger to use (defaults to this.log).
   * @param {string} [text] - Optional additional text to include in the log.
   */
  logMdnsMessage(msg: MdnsMessage, log: AnsiLogger = this.log, text: string = 'Decoded mDNS message'): void {
    log.info(
      `${text}: ID ${MAGENTA}${msg.id}${nf}, QR ${GREEN}${msg.qr === 0 ? 'Query' : 'Response'}${nf}, OPCODE ${MAGENTA}${msg.opcode}${nf}, AA ${MAGENTA}${msg.aa}${nf}, TC ${MAGENTA}${msg.tc}${nf}, RD ${MAGENTA}${msg.rd}${nf}, RA ${MAGENTA}${msg.ra}${nf}, Z ${MAGENTA}${msg.z}${nf}, RCODE ${MAGENTA}${msg.rcode}${nf}, QDCount ${MAGENTA}${msg.qdCount}${nf}, ANCount ${MAGENTA}${msg.anCount}${nf}, NSCount ${MAGENTA}${msg.nsCount}${nf}, ARCount ${MAGENTA}${msg.arCount}${nf}`,
    );
    msg.questions?.forEach((question) => {
      log.info(
        `Question: ${CYAN}${question.name}${nf} type ${idn}${this.dnsTypeToString(question.type)}${rs}${nf} class ${CYAN}${this.dnsQuestionClassToString(question.class)}${nf}`,
      );
    });
    msg.answers?.forEach((answer) => {
      log.info(
        `Answer: ${CYAN}${answer.name}${nf} type ${idn}${this.dnsTypeToString(answer.type)}${rs}${nf} class ${CYAN}${this.dnsResponseClassToString(answer.class)}${nf} ttl ${CYAN}${answer.ttl}${nf} data ${CYAN}${answer.data}${nf}`,
      );
    });
    msg.authorities?.forEach((authority) => {
      log.info(
        `Authority: ${CYAN}${authority.name}${nf} type ${idn}${this.dnsTypeToString(authority.type)}${rs}${nf} class ${CYAN}${this.dnsResponseClassToString(authority.class)}${nf} ttl ${CYAN}${authority.ttl}${nf} data ${CYAN}${authority.data}${nf}`,
      );
    });
    msg.additionals?.forEach((additional) => {
      log.info(
        `Additional: ${CYAN}${additional.name}${nf} type ${idn}${this.dnsTypeToString(additional.type)}${rs}${nf} class ${CYAN}${this.dnsResponseClassToString(additional.class)}${nf} ttl ${CYAN}${additional.ttl}${nf} data ${CYAN}${additional.data}${nf}`,
      );
    });
    log.info(`---\n`);
  }

  /**
   * Logs the discovered devices from the mDNS queries and responses.
   */
  logDevices() {
    this.log.info(`Discovered query devices: ${MAGENTA}${this.deviceQueries.size}${nf}`);
    // Collect devices into an array
    const deviceQueryArray = Array.from(this.deviceQueries.entries());
    // Sort the array by numeric value of the IP address
    deviceQueryArray.sort(([addressA], [addressB]) => {
      const partsA = addressA.split('.').map(Number);
      const partsB = addressB.split('.').map(Number);
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const diff = (partsA[i] || 0) - (partsB[i] || 0);
        if (diff !== 0) return diff;
      }
      // istanbul ignore next
      return 0;
    });
    // Log the sorted devices
    deviceQueryArray.forEach(([rinfo, response]) => {
      this.log.info(`- ${MAGENTA}${rinfo}${nf} family ${BLUE}${response.rinfo.family}${nf} address ${BLUE}${response.rinfo.address}${nf} port ${BLUE}${response.rinfo.port}${nf}`);
    });

    this.log.info(`Discovered response devices: ${MAGENTA}${this.deviceResponses.size}${nf}`);
    // Collect devices into an array
    const deviceResponseArray = Array.from(this.deviceResponses.entries());
    // Sort the array by numeric value of the IP address
    deviceResponseArray.sort(([addressA], [addressB]) => {
      const partsA = addressA.split(/[:.]/).map((part) => parseInt(part, 16));
      const partsB = addressB.split(/[:.]/).map((part) => parseInt(part, 16));
      for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const diff = (partsA[i] || 0) - (partsB[i] || 0);
        if (diff !== 0) return diff;
      }
      // istanbul ignore next
      return 0;
    });
    // Log the sorted devices
    deviceResponseArray.forEach(([rinfo, response]) => {
      this.log.info(
        `- ${MAGENTA}${rinfo}${nf} family ${BLUE}${response.rinfo.family}${nf} address ${BLUE}${response.rinfo.address}${nf} port ${BLUE}${response.rinfo.port}${nf} PTR ${GREEN}${response.dataPTR}${nf}`,
      );
    });
  }
}
