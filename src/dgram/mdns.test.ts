/**
 * @description Mdns class test
 * @file mdns.test.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import dgram from 'node:dgram';

import { jest } from '@jest/globals';

import { Mdns, DnsRecordType, DnsClass, DnsClassFlag } from './mdns.js';

process.argv.push('--verbose');

jest.mock('node:dgram');

const BLUE = '';
const MAGENTA = '';
const CYAN = '';
const GREEN = '';
const nf = '';
const db = '';
const er = '';
const idn = '';
const rs = '';

// Mock logger
class MockLogger {
  info = jest.fn();
  debug = jest.fn();
  error = jest.fn();
}

const mockRinfo: dgram.RemoteInfo = { family: 'IPv4', address: '1.2.3.4', port: 5353, size: 32 };

describe('Mdns', () => {
  let mdns: Mdns;
  let mockSocket: any;
  let logger: MockLogger;

  beforeEach(() => {
    mockSocket = {
      send: jest.fn((...args: any[]) => {
        const cb = args[args.length - 1];
        if (typeof cb === 'function') cb(null);
      }),
    };
    logger = new MockLogger();
    mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    // Override protected for test
    (mdns as any).socket = mockSocket;
    (mdns as any).log = logger;
  });

  it('should construct and initialize properties', () => {
    expect(mdns.deviceQueries).toBeInstanceOf(Map);
    expect(mdns.deviceResponses).toBeInstanceOf(Map);
  });

  it('should encode and decode DNS names', () => {
    const name = 'example.local';
    const encoded = mdns.encodeDnsName(name);
    const { name: decoded, newOffset } = mdns.decodeDnsName(encoded, 0);
    expect(decoded).toBe(name);
    expect(encoded[encoded.length - 1]).toBe(0);
    expect(newOffset).toBe(encoded.length);
  });

  describe('encodeTxtRdata', () => {
    it('should encode an empty TXT array as an empty buffer', () => {
      const rdata = mdns.encodeTxtRdata([]);
      expect(Buffer.isBuffer(rdata)).toBe(true);
      expect(rdata.length).toBe(0);
    });

    it('should encode a single ASCII entry', () => {
      const entry = 'test';
      const rdata = mdns.encodeTxtRdata([entry]);
      expect(rdata[0]).toBe(Buffer.from(entry, 'utf8').length);
      expect(rdata.slice(1).toString('utf8')).toBe(entry);
    });

    it('should encode multiple entries in sequence', () => {
      const entries = ['txtvers=1', 'path=/'];
      const expected = Buffer.concat(
        entries.map((e) => {
          const bytes = Buffer.from(e, 'utf8');
          return Buffer.concat([Buffer.from([bytes.length]), bytes]);
        }),
      );

      const rdata = mdns.encodeTxtRdata(entries);
      expect(rdata.equals(expected)).toBe(true);
    });

    it('should use UTF-8 byte length (not string length) for the prefix', () => {
      const entry = 'café';
      const bytes = Buffer.from(entry, 'utf8');
      const rdata = mdns.encodeTxtRdata([entry]);

      expect(rdata[0]).toBe(bytes.length);
      expect(rdata.slice(1).equals(bytes)).toBe(true);
    });

    it('should allow an empty string entry', () => {
      const rdata = mdns.encodeTxtRdata(['']);
      expect(rdata.length).toBe(1);
      expect(rdata[0]).toBe(0);
    });

    it('should allow an entry with exactly 255 bytes', () => {
      const entry = 'a'.repeat(255);
      const rdata = mdns.encodeTxtRdata([entry]);

      expect(rdata[0]).toBe(255);
      expect(rdata.slice(1).toString('utf8')).toBe(entry);
    });

    it('should throw if any entry exceeds 255 bytes', () => {
      const entry = 'a'.repeat(256);
      expect(() => mdns.encodeTxtRdata([entry])).toThrow(/TXT entry too long/);
    });
  });

  describe('encodeSrvRdata', () => {
    it('should encode SRV RDATA with priority, weight, port and target', () => {
      const priority = 1;
      const weight = 2;
      const port = 80;
      const target = 'target.local';

      const rdata = mdns.encodeSrvRdata(priority, weight, port, target);

      expect(rdata.readUInt16BE(0)).toBe(priority);
      expect(rdata.readUInt16BE(2)).toBe(weight);
      expect(rdata.readUInt16BE(4)).toBe(port);

      const decodedTarget = mdns.decodeDnsName(rdata, 6);
      expect(decodedTarget.name).toBe(target);
      expect(decodedTarget.newOffset).toBe(rdata.length);

      const expectedTarget = mdns.encodeDnsName(target);
      expect(rdata.slice(6).equals(expectedTarget)).toBe(true);
    });
  });

  describe('encodeA', () => {
    it('should encode a valid IPv4 address into 4 bytes', () => {
      const rdata = mdns.encodeA('192.168.1.2');
      expect(rdata.equals(Buffer.from([192, 168, 1, 2]))).toBe(true);
    });

    it('should throw for invalid IPv4 addresses', () => {
      expect(() => mdns.encodeA('')).toThrow(/Invalid IPv4 address/);
      expect(() => mdns.encodeA('1.2.3')).toThrow(/Invalid IPv4 address/);
      expect(() => mdns.encodeA('1.2.3.4.5')).toThrow(/Invalid IPv4 address/);
      expect(() => mdns.encodeA('256.0.0.1')).toThrow(/Invalid IPv4 address/);
      expect(() => mdns.encodeA('1.2.3.-1')).toThrow(/Invalid IPv4 address/);
      expect(() => mdns.encodeA('a.b.c.d')).toThrow(/Invalid IPv4 address/);
    });
  });

  describe('encodeAAAA', () => {
    it('should encode a full 8-group IPv6 address into 16 bytes', () => {
      const rdata = mdns.encodeAAAA('2001:0db8:0000:0000:0000:0000:0000:0001');
      expect(rdata.length).toBe(16);
      expect(rdata.readUInt16BE(0)).toBe(0x2001);
      expect(rdata.readUInt16BE(2)).toBe(0x0db8);
      expect(rdata.readUInt16BE(14)).toBe(0x0001);
    });

    it('should support :: compression and ignore %scope', () => {
      const withScope = mdns.encodeAAAA('fe80::1%12');
      const withoutScope = mdns.encodeAAAA('fe80::1');
      expect(withScope.equals(withoutScope)).toBe(true);

      // fe80::1 => fe80 0000 0000 0000 0000 0000 0000 0001
      expect(withoutScope.readUInt16BE(0)).toBe(0xfe80);
      expect(withoutScope.readUInt16BE(14)).toBe(0x0001);
    });

    it('should throw for invalid IPv6 addresses', () => {
      expect(() => mdns.encodeAAAA('abcd')).toThrow(/Invalid IPv6 address/);
      expect(() => mdns.encodeAAAA('1:2:3:4:5:6:7')).toThrow(/Invalid IPv6 address/);
      expect(() => mdns.encodeAAAA('gggg::1')).toThrow(/Invalid IPv6 group/);
    });
  });

  it('should decode a valid mDNS message', () => {
    // Minimal valid DNS query: header + 1 question for _http._tcp.local PTR
    const name = '_http._tcp.local';
    const qname = mdns.encodeDnsName(name);
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id
    header.writeUInt16BE(0, 2); // flags
    header.writeUInt16BE(1, 4); // qdcount
    const qtype = Buffer.alloc(2);
    qtype.writeUInt16BE(DnsRecordType.PTR, 0);
    const qclass = Buffer.alloc(2);
    qclass.writeUInt16BE(DnsClass.IN, 0);
    const buf = Buffer.concat([header, qname, qtype, qclass]);
    const msg = mdns.decodeMdnsMessage(buf);
    expect(msg.questions?.[0].name).toBe(name);
    expect(msg.questions?.[0].type).toBe(DnsRecordType.PTR);
    expect(msg.questions?.[0].class).toBe(DnsClass.IN);
  });

  it('should throw on too short mDNS message', () => {
    expect(() => mdns.decodeMdnsMessage(Buffer.alloc(5))).toThrow('mDNS message too short');
  });

  it('should decode PTR, TXT, SRV, A, AAAA, NSEC, and fallback records', () => {
    // PTR
    const ptrName = mdns.encodeDnsName('service.local');
    const rr = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN, 0, 0, 0, 1, 0, ptrName.length]), ptrName]);
    let { record } = mdns.decodeResourceRecord(rr, 0);
    expect(record.type).toBe(DnsRecordType.PTR);
    expect(record.data).toBe('service.local');
    // TXT
    const txt = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.TXT, 0, DnsClass.IN, 0, 0, 0, 1, 0, 5]), Buffer.from([4]), Buffer.from('test')]);
    record = mdns.decodeResourceRecord(txt, 0).record;
    expect(record.type).toBe(DnsRecordType.TXT);
    expect(record.data).toContain('test');
    // SRV
    const srvTarget = mdns.encodeDnsName('target.local');
    const srv = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.SRV, 0, DnsClass.IN, 0, 0, 0, 1, 0, srvTarget.length + 6]), Buffer.from([0, 1, 0, 2, 0, 80]), srvTarget]);
    record = mdns.decodeResourceRecord(srv, 0).record;
    expect(record.type).toBe(DnsRecordType.SRV);
    expect(record.data).toContain('target.local');
    // A
    const a = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.A, 0, DnsClass.IN, 0, 0, 0, 1, 0, 4]), Buffer.from([192, 168, 1, 2])]);
    record = mdns.decodeResourceRecord(a, 0).record;
    expect(record.type).toBe(DnsRecordType.A);
    expect(record.data).toBe('192.168.1.2');
    // AAAA
    const aaaa = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.AAAA, 0, DnsClass.IN, 0, 0, 0, 1, 0, 16]), Buffer.alloc(16, 1)]);
    record = mdns.decodeResourceRecord(aaaa, 0).record;
    expect(record.type).toBe(DnsRecordType.AAAA);
    expect(record.data).toContain(':');
    // NSEC (minimal, with empty bitmap)
    const nsecDomain = mdns.encodeDnsName('next.local');
    const nsec = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.NSEC, 0, DnsClass.IN, 0, 0, 0, 1, 0, nsecDomain.length + 2]), nsecDomain, Buffer.from([0, 0])]);
    record = mdns.decodeResourceRecord(nsec, 0).record;
    expect(record.type).toBe(DnsRecordType.NSEC);
    expect(record.data).toContain('next.local');
    // Fallback (unknown type)
    const fallback = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, 99, 0, DnsClass.IN, 0, 0, 0, 1, 0, 2]), Buffer.from([0xab, 0xcd])]);
    record = mdns.decodeResourceRecord(fallback, 0).record;
    expect(record.type).toBe(99);
    expect(record.data).toBe('abcd');
  });

  it('should send a query and log', () => {
    mdns.sendQuery([{ name: 'foo.local', type: DnsRecordType.PTR, class: DnsClass.IN }]);
    expect(mockSocket.send).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('should send a response and log', () => {
    const rdata = mdns.encodeDnsName('foo.local');
    mdns.sendResponse([{ name: 'foo.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl: 120, rdata }]);
    expect(mockSocket.send).toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('should send a multi-answer response with correct ANCOUNT', () => {
    const rdata1 = mdns.encodeDnsName('instance1._http._tcp.local');
    const rdata2 = mdns.encodeDnsName('instance2._http._tcp.local');

    mdns.sendResponse([
      { name: '_http._tcp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl: 120, rdata: rdata1 },
      { name: '_http._tcp.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl: 120, rdata: rdata2 },
    ]);

    const sendArgs = mockSocket.send.mock.calls[0];
    const responseBuffer = sendArgs[0] as Buffer;

    expect(responseBuffer.readUInt16BE(6)).toBe(2); // ANCOUNT
    const decoded = mdns.decodeMdnsMessage(responseBuffer);
    expect(decoded.anCount).toBe(2);
    expect(decoded.answers?.length).toBe(2);
    expect(decoded.answers?.[0].name).toBe('_http._tcp.local');
    expect(decoded.answers?.[0].type).toBe(DnsRecordType.PTR);
  });

  it('should throw if sendResponse answers array is empty', () => {
    expect(() => mdns.sendResponse([])).toThrow('sendResponse requires a non-empty answers array');
  });

  it('should convert DNS types and classes to string', () => {
    expect(mdns.dnsTypeToString(DnsRecordType.PTR)).toBe('PTR');
    expect(mdns.dnsTypeToString(9999)).toBe('TYPE9999');
    expect(mdns.dnsResponseClassToString(DnsClass.IN | DnsClassFlag.FLUSH)).toContain('IN|FLUSH');
    expect(mdns.dnsQuestionClassToString(DnsClass.IN | DnsClassFlag.QU)).toContain('IN|QU');
  });

  it('should log mDNS message and devices', () => {
    const msg = {
      id: 0,
      qr: 0,
      opcode: 0,
      aa: false,
      tc: false,
      rd: false,
      ra: false,
      z: 0,
      rcode: 0,
      qdCount: 1,
      anCount: 0,
      nsCount: 0,
      arCount: 0,
      questions: [{ name: 'foo.local', type: DnsRecordType.PTR, class: DnsClass.IN }],
      answers: [],
      authorities: [],
      additionals: [],
    };
    mdns.logMdnsMessage(msg as any);
    mdns.deviceQueries.set('1.2.3.4', { rinfo: mockRinfo, query: msg as any });
    mdns.deviceResponses.set('1.2.3.4', { rinfo: mockRinfo, response: msg as any, dataPTR: 'foo.local' });
    mdns.logDevices();
    expect(logger.info).toHaveBeenCalled();
  });

  it('should handle errors in onMessage', () => {
    const badMsg = Buffer.from([0, 1, 2]);
    mdns.onMessage(badMsg, mockRinfo);
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle decodeDnsName error cases', () => {
    // Test iterations limit
    const malformedMsg = Buffer.alloc(10);
    malformedMsg[0] = 0xc0; // Pointer
    malformedMsg[1] = 0x00; // Points to beginning (creates loop)
    expect(() => mdns.decodeDnsName(malformedMsg, 0)).toThrow('Too many iterations while decoding DNS name');

    // Test offset exceeds buffer length
    const shortMsg = Buffer.from([5]); // Expects 5 more bytes but buffer ends
    expect(() => mdns.decodeDnsName(shortMsg, 0)).toThrow('Label length exceeds buffer bounds while decoding DNS name');

    // Test incomplete pointer
    const incompletePointer = Buffer.from([0xc0]); // Pointer without second byte
    expect(() => mdns.decodeDnsName(incompletePointer, 0)).toThrow('Incomplete pointer encountered while decoding DNS name');

    // Test offset bounds
    const emptyMsg = Buffer.alloc(0);
    expect(() => mdns.decodeDnsName(emptyMsg, 0)).toThrow('Offset exceeds buffer length while decoding DNS name');
  });

  it('should handle all DNS class types in string conversion', () => {
    // Test CH class
    expect(mdns.dnsResponseClassToString(DnsClass.CH)).toBe('CH');
    expect(mdns.dnsQuestionClassToString(DnsClass.CH)).toBe('CH');

    // Test HS class
    expect(mdns.dnsResponseClassToString(DnsClass.HS)).toBe('HS');
    expect(mdns.dnsQuestionClassToString(DnsClass.HS)).toBe('HS');

    // Test ANY class
    expect(mdns.dnsResponseClassToString(DnsClass.ANY)).toBe('ANY');
    expect(mdns.dnsQuestionClassToString(DnsClass.ANY)).toBe('ANY');

    // Test CH with FLUSH flag
    expect(mdns.dnsResponseClassToString(DnsClass.CH | DnsClassFlag.FLUSH)).toBe('CH|FLUSH');

    // Test CH with QU flag
    expect(mdns.dnsQuestionClassToString(DnsClass.CH | DnsClassFlag.QU)).toBe('CH|QU');

    // Test unknown class (line 720) - should use default case
    expect(mdns.dnsResponseClassToString(999)).toBe('CLASS999');
    expect(mdns.dnsQuestionClassToString(999)).toBe('CLASS999');
  });

  it('should handle sendQuery error callback', () => {
    // Mock socket to call callback with error
    mockSocket.send = jest.fn((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb(new Error('Network error'));
    });
    mdns.on('error', (err: Error) => {
      //
    });
    mdns.sendQuery([{ name: 'foo.local', type: DnsRecordType.PTR, class: DnsClass.IN }]);
    expect(mockSocket.send).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith('Dgram mDNS server failed to send query message: Network error');
  });

  it('should handle sendResponse error callback', () => {
    // Mock socket to call callback with error
    mockSocket.send = jest.fn((...args: any[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === 'function') cb(new Error('Send failed'));
    });
    mdns.on('error', (err: Error) => {
      //
    });

    const rdata = mdns.encodeDnsName('foo.local');
    mdns.sendResponse([{ name: 'foo.local', rtype: DnsRecordType.PTR, rclass: DnsClass.IN, ttl: 120, rdata }]);
    expect(mockSocket.send).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should handle response messages in onMessage', () => {
    // Create a response message (QR=1)
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id
    header.writeUInt16BE(0x8000, 2); // flags with QR=1 (response)
    header.writeUInt16BE(1, 4); // qdcount
    header.writeUInt16BE(1, 6); // ancount
    header.writeUInt16BE(0, 8); // nsCount
    header.writeUInt16BE(1, 10); // arCount

    // Create a question record
    const qname = mdns.encodeDnsName('_matter._tcp.local');
    const question = Buffer.concat([qname, Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN])]);

    // Create an answer record
    const name = mdns.encodeDnsName('_shelly._tcp.local');
    const answerData = mdns.encodeDnsName('test-device._shelly._tcp.local');
    const answer = Buffer.concat([name, Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN, 0, 0, 0, 120, 0, answerData.length]), answerData]);

    const responseMsg = Buffer.concat([header, question, answer, answer]);

    mdns.onMessage(responseMsg, mockRinfo);

    expect(mdns.deviceResponses.has('1.2.3.4')).toBe(true);
    const stored = mdns.deviceResponses.get('1.2.3.4');
    expect(stored?.dataPTR).toBe('test-device._shelly._tcp.local');

    mdns.filters.push('test-device._shelly._tcp.local');
    mdns.onMessage(responseMsg, mockRinfo);
    mdns.filters = [];

    mdns.filters.push('nope-device._shelly._tcp.local');
    mdns.onMessage(responseMsg, mockRinfo);
    mdns.filters = [];
  });

  it('should decode NSEC record with bitmap data', () => {
    const nsecDomain = mdns.encodeDnsName('next.local');
    // Create bitmap data: window block 0, length 3, then 3 bytes of bitmap
    const bitmapData = Buffer.from([0, 3, 0x80, 0x40, 0x20]); // Sets bits for types 0, 9, 18
    const nsec = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.NSEC, 0, DnsClass.IN, 0, 0, 0, 1, 0, nsecDomain.length + bitmapData.length]), nsecDomain, bitmapData]);

    const { record } = mdns.decodeResourceRecord(nsec, 0);
    expect(record.type).toBe(DnsRecordType.NSEC);
    expect(record.data).toContain('next.local');
    expect(record.data).toContain('A'); // Type 1 should be in the types array
  });

  it('should decode IPv6 AAAA record correctly', () => {
    // Create AAAA record with specific IPv6 address (2001:db8::1)
    const ipv6Bytes = Buffer.from([0x20, 0x01, 0x0d, 0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);
    const aaaa = Buffer.concat([mdns.encodeDnsName('foo.local'), Buffer.from([0, DnsRecordType.AAAA, 0, DnsClass.IN, 0, 0, 0, 1, 0, 16]), ipv6Bytes]);

    const { record } = mdns.decodeResourceRecord(aaaa, 0);
    expect(record.type).toBe(DnsRecordType.AAAA);
    expect(record.data).toBe('2001:db8:0:0:0:0:0:1');
  });

  it('should handle device sorting in logDevices', () => {
    // Add multiple devices with different IP addresses
    const devices = [
      { address: '192.168.1.10', query: { qr: 0 } as any },
      { address: '192.168.1.2', query: { qr: 0 } as any },
      { address: '10.0.0.1', query: { qr: 0 } as any },
    ];

    devices.forEach((device) => {
      const rinfo = { ...mockRinfo, address: device.address };
      mdns.deviceQueries.set(device.address, { rinfo, query: device.query });
    });

    // Add IPv6 style addresses for response sorting
    const ipv6Style = '2001:db8::1';
    const response = { qr: 1, rinfo: { ...mockRinfo, address: ipv6Style }, dataPTR: 'test' } as any;
    mdns.deviceResponses.set(ipv6Style, { rinfo: { ...mockRinfo, address: ipv6Style }, response, dataPTR: 'test' });

    mdns.logDevices();
    expect(logger.info).toHaveBeenCalled();
  });

  it('should handle authorities and additionals in logMdnsMessage', () => {
    const msg = {
      id: 0,
      qr: 1,
      opcode: 0,
      aa: true,
      tc: false,
      rd: false,
      ra: false,
      z: 0,
      rcode: 0,
      qdCount: 0,
      anCount: 0,
      nsCount: 1,
      arCount: 1,
      questions: [],
      answers: [],
      authorities: [{ name: 'auth.local', type: DnsRecordType.NS, class: DnsClass.IN, ttl: 300, data: 'ns.local' }],
      additionals: [{ name: 'add.local', type: DnsRecordType.A, class: DnsClass.IN, ttl: 60, data: '1.2.3.4' }],
    };

    mdns.logMdnsMessage(msg as any);
    expect(logger.info).toHaveBeenCalled();
  });

  it('should decode mDNS message with authorities and additionals', () => {
    // Create a message with authority and additional records
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id
    header.writeUInt16BE(0x8000, 2); // flags with QR=1 (response)
    header.writeUInt16BE(0, 4); // qdcount
    header.writeUInt16BE(0, 6); // ancount
    header.writeUInt16BE(1, 8); // nscount (1 authority)
    header.writeUInt16BE(1, 10); // arcount (1 additional)

    // Create authority record (PTR instead of NS for proper decoding)
    const authName = mdns.encodeDnsName('example.local');
    const authData = mdns.encodeDnsName('ns.example.local');
    const authority = Buffer.concat([authName, Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN, 0, 0, 1, 44, 0, authData.length]), authData]);

    // Create additional record (A)
    const addName = mdns.encodeDnsName('ns.example.local');
    const addData = Buffer.from([192, 168, 1, 1]);
    const additional = Buffer.concat([addName, Buffer.from([0, DnsRecordType.A, 0, DnsClass.IN, 0, 0, 0, 60, 0, 4]), addData]);

    const completeMsg = Buffer.concat([header, authority, additional]);
    const decoded = mdns.decodeMdnsMessage(completeMsg);

    expect(decoded.authorities).toHaveLength(1);
    expect(decoded.authorities?.[0].type).toBe(DnsRecordType.PTR);
    expect(decoded.authorities?.[0].data).toBe('ns.example.local');

    expect(decoded.additionals).toHaveLength(1);
    expect(decoded.additionals?.[0].type).toBe(DnsRecordType.A);
    expect(decoded.additionals?.[0].data).toBe('192.168.1.1');
  });

  it('should handle different PTR record types in response messages', () => {
    // Test _http._tcp.local PTR record
    const httpHeader = Buffer.alloc(12);
    httpHeader.writeUInt16BE(0, 0); // id
    httpHeader.writeUInt16BE(0x8000, 2); // flags with QR=1 (response)
    httpHeader.writeUInt16BE(0, 4); // qdcount
    httpHeader.writeUInt16BE(1, 6); // ancount

    const httpName = mdns.encodeDnsName('_http._tcp.local');
    const httpData = mdns.encodeDnsName('test-http._http._tcp.local');
    const httpAnswer = Buffer.concat([httpName, Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN, 0, 0, 0, 120, 0, httpData.length]), httpData]);

    const httpMsg = Buffer.concat([httpHeader, httpAnswer]);
    mdns.onMessage(httpMsg, mockRinfo);

    let stored = mdns.deviceResponses.get('1.2.3.4');
    expect(stored?.dataPTR).toBe('test-http._http._tcp.local');

    // Test generic PTR record (not _shelly or _http)
    const genericHeader = Buffer.alloc(12);
    genericHeader.writeUInt16BE(0, 0); // id
    genericHeader.writeUInt16BE(0x8000, 2); // flags with QR=1 (response)
    genericHeader.writeUInt16BE(0, 4); // qdcount
    genericHeader.writeUInt16BE(1, 6); // ancount

    const genericName = mdns.encodeDnsName('_generic._tcp.local');
    const genericData = mdns.encodeDnsName('test-generic._generic._tcp.local');
    const genericAnswer = Buffer.concat([genericName, Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN, 0, 0, 0, 120, 0, genericData.length]), genericData]);

    const genericMsg = Buffer.concat([genericHeader, genericAnswer]);
    const newRinfo = { ...mockRinfo, address: '5.6.7.8' };
    mdns.onMessage(genericMsg, newRinfo);

    stored = mdns.deviceResponses.get('5.6.7.8');
    expect(stored?.dataPTR).toBe('test-generic._generic._tcp.local');
  });

  it('should handle response messages without PTR records', () => {
    // Create response with A record (no PTR)
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id
    header.writeUInt16BE(0x8000, 2); // flags with QR=1 (response)
    header.writeUInt16BE(0, 4); // qdcount
    header.writeUInt16BE(1, 6); // ancount

    const name = mdns.encodeDnsName('example.local');
    const answer = Buffer.concat([name, Buffer.from([0, DnsRecordType.A, 0, DnsClass.IN, 0, 0, 0, 120, 0, 4]), Buffer.from([192, 168, 1, 100])]);

    const responseMsg = Buffer.concat([header, answer]);
    const newRinfo = { ...mockRinfo, address: '9.10.11.12' };
    mdns.onMessage(responseMsg, newRinfo);

    const stored = mdns.deviceResponses.get('9.10.11.12');
    expect(stored?.dataPTR).toBe('example.local');
  });

  it('should handle query messages in onMessage', () => {
    // Create a query message (QR=0)
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id
    header.writeUInt16BE(0, 2); // flags with QR=0 (query)
    header.writeUInt16BE(1, 4); // qdcount

    const qname = mdns.encodeDnsName('_matter._tcp.local');
    const question = Buffer.concat([qname, Buffer.from([0, DnsRecordType.PTR, 0, DnsClass.IN])]);

    const queryMsg = Buffer.concat([header, question]);
    const queryRinfo = { ...mockRinfo, address: '13.14.15.16' };
    mdns.onMessage(queryMsg, queryRinfo);

    expect(mdns.deviceQueries.has('13.14.15.16')).toBe(true);
    const stored = mdns.deviceQueries.get('13.14.15.16');
    expect(stored?.query.qr).toBe(0);
    expect(stored?.query.questions?.[0].name).toBe('_matter._tcp.local');
  });

  it('should log response devices with forEach loop (lines 813-819)', () => {
    // Add multiple response devices to test the forEach logging loop
    const devices = [
      { address: '192.168.1.100', response: { qr: 1, rinfo: { family: 'IPv4', address: '192.168.1.100', port: 5353 } }, dataPTR: 'device1.local' },
      { address: '192.168.1.50', response: { qr: 1, rinfo: { family: 'IPv4', address: '192.168.1.50', port: 5353 } }, dataPTR: 'device2.local' },
      { address: '10.0.0.5', response: { qr: 1, rinfo: { family: 'IPv4', address: '10.0.0.5', port: 5353 } }, dataPTR: 'device3.local' },
    ];

    // Add devices to the responses map
    devices.forEach((device) => {
      mdns.deviceResponses.set(device.address, {
        rinfo: device.response.rinfo as dgram.RemoteInfo,
        response: device.response as any,
        dataPTR: device.dataPTR,
      });
    });

    // Call logDevices to trigger the forEach loop on lines 813-819
    mdns.logDevices();

    // Verify that the forEach loop was executed by checking log calls
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Discovered response devices:'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('192.168.1.100'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('192.168.1.50'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('10.0.0.5'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('PTR'));
  });

  it('should cover return 0 in sort comparison (line 819)', () => {
    // Add two devices with same IP to trigger return 0 in sort comparison
    mdns.deviceResponses.set('192.168.1.100', {
      rinfo: { family: 'IPv4', address: '192.168.1.100', port: 5353 } as dgram.RemoteInfo,
      response: { qr: 1 } as any,
      dataPTR: 'device1.local',
    });

    // Add another entry with exactly the same IP address to force comparison to return 0
    mdns.deviceResponses.set('192.168.1.100', {
      rinfo: { family: 'IPv4', address: '192.168.1.100', port: 5354 } as dgram.RemoteInfo,
      response: { qr: 1 } as any,
      dataPTR: 'device2.local',
    });

    // Add devices with identical hex-parsed addresses to trigger the return 0 case
    mdns.deviceResponses.set('c0:a8:01:64', {
      rinfo: { family: 'IPv4', address: 'c0:a8:01:64', port: 5353 } as dgram.RemoteInfo,
      response: { qr: 1 } as any,
      dataPTR: 'device3.local',
    });

    mdns.deviceResponses.set('c0:a8:01:64', {
      rinfo: { family: 'IPv4', address: 'c0:a8:01:64', port: 5354 } as dgram.RemoteInfo,
      response: { qr: 1 } as any,
      dataPTR: 'device4.local',
    });

    // Call logDevices to trigger sorting and the return 0 case
    mdns.logDevices();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Discovered response devices:'));
  });
});
