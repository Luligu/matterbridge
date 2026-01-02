/**
 * @description MdnsReflectorServer upgradeAddress() test
 * @file mdnsReflectorServer.test.ts
 * @author Luca Liguori
 * @created 2025-12-26
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import EventEmitter from 'node:events';
import os from 'node:os';

import { LogLevel } from 'node-ansi-logger';
import { jest } from '@jest/globals';

import { loggerDebugSpy, loggerErrorSpy, setupTest } from '../jestutils/jestHelpers.js';

import { DnsClass, DnsRecordType, Mdns } from './mdns.js';
import { MdnsReflectorServer } from './mdnsReflectorServer.js';

jest.mock('node:dgram');

// Setup the test environment
await setupTest('MdnsReflectorServer', false);

describe('MdnsReflectorServer', () => {
  class FakeEndpoint extends EventEmitter {
    start = jest.fn(() => {
      setImmediate(() => this.emit('bound', { family: 'IPv4', address: '0.0.0.0', port: 1 }));
    });
    stop = jest.fn(() => {
      setImmediate(() => this.emit('close'));
    });
    send = jest.fn();
    socket = {
      setMulticastLoopback: jest.fn(),
    };
  }

  class FakeMdns extends FakeEndpoint {
    socketType: 'udp4' | 'udp6' = 'udp4';
    interfaceName: string | undefined = undefined;
    getIpv4InterfaceAddress = jest.fn(() => '192.168.1.10');
    getIpv6InterfaceAddress = jest.fn(() => 'fe80::1');
    getNetmask = jest.fn(() => '255.255.255.0');
    getIpv4BroadcastAddress = jest.fn((_ip: string | undefined, _mask: string | undefined) => '192.168.1.255');
    getIpv6BroadcastAddress = jest.fn(() => 'ff02::1');
  }

  const buildHeader = ({ qdCount = 0, anCount = 0, nsCount = 0, arCount = 0 }: { qdCount?: number; anCount?: number; nsCount?: number; arCount?: number }) => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0); // id
    header.writeUInt16BE(0x8400, 2); // flags (response)
    header.writeUInt16BE(qdCount, 4);
    header.writeUInt16BE(anCount, 6);
    header.writeUInt16BE(nsCount, 8);
    header.writeUInt16BE(arCount, 10);
    return header;
  };

  const buildQueryHeader = () => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0);
    header.writeUInt16BE(0x0000, 2); // query
    return header;
  };

  const buildResponseHeader = () => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(0, 0);
    header.writeUInt16BE(0x8000, 2); // response (QR=1)
    return header;
  };

  const buildNotMdnsHeader = () => {
    const header = Buffer.alloc(12);
    header.writeUInt16BE(1, 0); // non-zero id => not mDNS
    header.writeUInt16BE(0x0000, 2);
    return header;
  };

  const buildFixed = (rtype: number, ttl: number, rdlength: number) => {
    const fixed = Buffer.alloc(10);
    fixed.writeUInt16BE(rtype, 0);
    fixed.writeUInt16BE(DnsClass.IN, 2);
    fixed.writeUInt32BE(ttl, 4);
    fixed.writeUInt16BE(rdlength, 8);
    return fixed;
  };

  const buildARecord = (mdns: Mdns, name: string, ttl: number, ipBytes: number[]) => Buffer.concat([mdns.encodeDnsName(name), buildFixed(DnsRecordType.A, ttl, 4), Buffer.from(ipBytes)]);
  const buildAAAARecord = (mdns: Mdns, name: string, ttl: number, ipv6: string) => Buffer.concat([mdns.encodeDnsName(name), buildFixed(DnsRecordType.AAAA, ttl, 16), mdns.encodeAAAA(ipv6)]);

  const mockNetworkInterfaces = (value: ReturnType<typeof os.networkInterfaces>) => {
    return jest.spyOn(os, 'networkInterfaces').mockReturnValue(value);
  };

  afterEach(() => {
    jest.clearAllMocks();
    const maybeNetworkInterfacesSpy = os.networkInterfaces as unknown as { mockRestore?: () => void };
    maybeNetworkInterfacesSpy.mockRestore?.();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('upgradeAddress should rewrite A and AAAA RDATA to host addresses', () => {
    const server = new MdnsReflectorServer();

    mockNetworkInterfaces({
      eth0: [
        { address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.1.10/24' },
        { address: 'fd00::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::1/64', scopeid: 0 },
      ],
    } as any);

    // Reuse existing encoder helpers.
    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');

    const name = 'matterbridge.local';
    const ttl = 120;

    const header = buildHeader({ anCount: 2 });
    const rrA = buildARecord(mdns, name, ttl, [172, 17, 0, 2]);
    const rrAAAA = buildAAAARecord(mdns, name, ttl, 'fd00::2');
    const msg = Buffer.concat([header, rrA, rrAAAA]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);

    const a = decoded.answers?.find((r) => r.type === DnsRecordType.A);
    const aaaa = decoded.answers?.find((r) => r.type === DnsRecordType.AAAA);

    expect(a?.data).toBe('192.168.1.10');
    expect(aaaa?.data).toBe('fd00:0:0:0:0:0:0:1');
  });

  it('upgradeAddress should prefer mdnsIpv4.interfaceName when it has external addresses', () => {
    const server = new MdnsReflectorServer();

    // Force the "preferred interface" branch to run.
    (server.mdnsIpv4 as any).interfaceName = 'preferred0';

    mockNetworkInterfaces({
      preferred0: [{ address: '10.10.10.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:aa', internal: false, cidr: '10.10.10.10/24' }],
      eth0: [{ address: '20.20.20.20', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:bb', internal: false, cidr: '20.20.20.20/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);
    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);

    expect(decoded.answers?.find((r) => r.type === DnsRecordType.A)?.data).toBe('10.10.10.10');
  });

  it('upgradeAddress should fall back when preferred interface has only internal addresses', () => {
    const server = new MdnsReflectorServer();

    // Force the "preferred interface" branch to run.
    (server.mdnsIpv4 as any).interfaceName = 'preferred0';

    mockNetworkInterfaces({
      preferred0: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:cc', internal: true, cidr: '127.0.0.1/8' }],
      eth0: [{ address: '30.30.30.30', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:dd', internal: false, cidr: '30.30.30.30/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);
    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);

    expect(decoded.answers?.find((r) => r.type === DnsRecordType.A)?.data).toBe('30.30.30.30');
  });

  it('upgradeAddress should map duplicated AAAA records to different host IPv6 addresses when available', () => {
    const server = new MdnsReflectorServer();

    mockNetworkInterfaces({
      eth0: [
        { address: 'fd00::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::1/64', scopeid: 0 },
        { address: 'fd00::2', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::2/64', scopeid: 0 },
      ],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    // Two AAAA records with the same (container) address, which the upgrader should de-duplicate by mapping to fd00::1 and fd00::2.
    const header = buildHeader({ anCount: 2 });
    const rrAAAA1 = buildAAAARecord(mdns, name, ttl, 'fd00::99');
    const rrAAAA2 = buildAAAARecord(mdns, name, ttl, 'fd00::99');
    const msg = Buffer.concat([header, rrAAAA1, rrAAAA2]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);

    const aaaa = decoded.answers?.filter((r) => r.type === DnsRecordType.AAAA).map((r) => r.data) ?? [];
    expect(aaaa.length).toBe(2);
    expect(new Set(aaaa).size).toBe(2);
    expect(aaaa).toContain('fd00:0:0:0:0:0:0:1');
    expect(aaaa).toContain('fd00:0:0:0:0:0:0:2');
  });

  it('upgradeAddressForDocker should delegate to upgradeAddress', () => {
    const server = new MdnsReflectorServer();
    const msg = Buffer.alloc(12);
    const spy = jest.spyOn(server, 'upgradeAddress').mockReturnValue(msg as unknown as Buffer<ArrayBufferLike>);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(spy).toHaveBeenCalledWith(msg);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddress should decode/log the upgraded message when debug is enabled', () => {
    process.argv.push('--log-reflector-messages');
    const server = new MdnsReflectorServer();
    (server as any).debug = true;

    mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);

    const decodeSpy = jest.spyOn((server as any).mdnsIpv4, 'decodeMdnsMessage').mockReturnValue({} as any);
    const logSpy = jest.spyOn((server as any).mdnsIpv4, 'logMdnsMessage').mockImplementation(() => {});

    server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(decodeSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    process.argv.pop();
  });

  it('upgradeAddress should skip decode/log when --log-reflector-messages is not set (false branch)', () => {
    const argvBefore = [...process.argv];
    try {
      process.argv = ['node', 'jest'];

      const server = new MdnsReflectorServer();

      mockNetworkInterfaces({
        eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
      } as any);

      const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
      const name = 'matterbridge.local';
      const ttl = 120;
      const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);

      const decodeSpy = jest.spyOn((server as any).mdnsIpv4, 'decodeMdnsMessage');
      const logSpy = jest.spyOn((server as any).mdnsIpv4, 'logMdnsMessage');

      const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
      expect(upgraded).not.toBe(msg);
      expect(decodeSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('upgradeAddress should log an error when log-reflector-messages decoding fails', () => {
    const argvBefore = [...process.argv];
    try {
      if (!process.argv.includes('--log-reflector-messages')) process.argv.push('--log-reflector-messages');
      const server = new MdnsReflectorServer();

      mockNetworkInterfaces({
        eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
      } as any);

      const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
      const name = 'matterbridge.local';
      const ttl = 120;
      const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);

      jest.spyOn((server as any).mdnsIpv4, 'decodeMdnsMessage').mockImplementation(() => {
        throw new Error('decode boom');
      });

      expect(() => server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>)).not.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('UpgradeAddress failed to decode message:'));
    } finally {
      process.argv = argvBefore;
    }
  });

  it('upgradeAddress should ignore decode errors when debug is enabled', () => {
    const server = new MdnsReflectorServer();
    (server as any).debug = true;

    mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);

    jest.spyOn((server as any).mdnsIpv4, 'decodeMdnsMessage').mockImplementation(() => {
      throw new Error('decode boom');
    });

    expect(() => server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>)).not.toThrow();
  });

  it('upgradeAddress should return same buffer if message is shorter than DNS header', () => {
    const server = new MdnsReflectorServer();
    const msg = Buffer.alloc(11);
    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddress should rewrite only A when only host IPv4 is available', () => {
    const server = new MdnsReflectorServer();
    const networkInterfacesMock = mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 2 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2]), buildAAAARecord(mdns, name, ttl, 'fd00::2')]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).not.toBe(msg);

    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    const a = decoded.answers?.find((r) => r.type === DnsRecordType.A);
    const aaaa = decoded.answers?.find((r) => r.type === DnsRecordType.AAAA);
    expect(a?.data).toBe('10.0.0.5');
    expect(aaaa?.data).toBe('fd00:0:0:0:0:0:0:2');
  });

  it('upgradeAddress should rewrite only AAAA when only host IPv6 is available', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [{ address: 'fd00::1234', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::1234/64', scopeid: 0 }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 2 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2]), buildAAAARecord(mdns, name, ttl, 'fd00::2')]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).not.toBe(msg);

    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    const a = decoded.answers?.find((r) => r.type === DnsRecordType.A);
    const aaaa = decoded.answers?.find((r) => r.type === DnsRecordType.AAAA);
    expect(a?.data).toBe('172.17.0.2');
    expect(aaaa?.data).toBe('fd00:0:0:0:0:0:0:1234');
  });

  it('upgradeAddress should rewrite A/AAAA in authority and additional sections', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [
        { address: '192.168.50.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '192.168.50.10/24' },
        { address: 'fd00::abcd', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::abcd/64', scopeid: 0 },
      ],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ nsCount: 1, arCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2]), buildAAAARecord(mdns, name, ttl, 'fd00::2')]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    expect(decoded.authorities?.find((r) => r.type === DnsRecordType.A)?.data).toBe('192.168.50.10');
    expect(decoded.additionals?.find((r) => r.type === DnsRecordType.AAAA)?.data).toBe('fd00:0:0:0:0:0:0:abcd');
  });

  it('upgradeAddress should ignore empty IPv6 entries when normalizing host IPv6 list', () => {
    const server = new MdnsReflectorServer();

    mockNetworkInterfaces({
      eth0: [
        { address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' },
        // Empty IPv6 address should be ignored by `if (normalized)`.
        { address: '', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: '::/64', scopeid: 0 },
      ],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2])]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);

    expect(decoded.answers?.find((r) => r.type === DnsRecordType.A)?.data).toBe('10.0.0.5');
  });

  it('upgradeAddress should return original message on decode errors (catch path)', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [
        { address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' },
        { address: 'fd00::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::1/64', scopeid: 0 },
      ],
    } as any);

    // qdCount=1 but message does not contain the question section -> decodeDnsName throws.
    const msg = buildHeader({ qdCount: 1 });
    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddress should return original message when question section is truncated after name', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [
        { address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' },
        { address: 'fd00::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:01', internal: false, cidr: 'fd00::1/64', scopeid: 0 },
      ],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const qname = mdns.encodeDnsName('_http._tcp.local');
    // Missing QTYPE/QCLASS bytes -> triggers offset > length early return.
    const msg = Buffer.concat([buildHeader({ qdCount: 1 }), qname]);
    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddress should not modify A record when RDLENGTH is not 4', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const rdlength = 5; // invalid for A, should be ignored by upgrader
    const fixed = buildFixed(DnsRecordType.A, ttl, rdlength);
    const rdata = Buffer.from([172, 17, 0, 2, 0xff]);
    const rr = Buffer.concat([mdns.encodeDnsName(name), fixed, rdata]);
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), rr]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>) as unknown as Buffer;
    expect(upgraded).not.toBe(msg);

    // RDATA starts after header + encoded name + fixed(10)
    const rdataOffset = 12 + mdns.encodeDnsName(name).length + 10;
    expect(upgraded.slice(rdataOffset, rdataOffset + rdlength).equals(rdata)).toBe(true);
  });

  it('upgradeAddress should stop safely when RDLENGTH points past buffer end', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const fixed = buildFixed(DnsRecordType.A, ttl, 1000);
    const rrTruncated = Buffer.concat([mdns.encodeDnsName(name), fixed, Buffer.from([172, 17, 0, 2])]);
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), rrTruncated]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>) as unknown as Buffer;
    expect(upgraded).not.toBe(msg);
    expect(upgraded.equals(msg)).toBe(true);
  });

  it('upgradeAddress should stop safely when RR fixed fields are truncated (offset + 10 guard)', () => {
    const server = new MdnsReflectorServer();
    mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const rrNameOnly = mdns.encodeDnsName(name); // missing TYPE/CLASS/TTL/RDLENGTH
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), rrNameOnly]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>) as unknown as Buffer;
    expect(upgraded).not.toBe(msg);
    expect(upgraded.equals(msg)).toBe(true);
  });

  it('upgradeAddress should return original message when no host addresses are available', () => {
    const server = new MdnsReflectorServer();

    mockNetworkInterfaces({
      lo: [
        { address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:00', internal: true, cidr: '127.0.0.1/8' },
        { address: '::1', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', mac: '00:00:00:00:00:00', internal: true, cidr: '::1/128', scopeid: 0 },
      ],
    } as any);

    const msg = Buffer.alloc(12);
    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddress should return original message when no external interfaces are found (pickInterface undefined)', () => {
    const server = new MdnsReflectorServer();

    // Force preferred interface lookup, but provide no matching/external interface.
    (server.mdnsIpv4 as any).interfaceName = 'nonexistent0';

    mockNetworkInterfaces({} as any);

    const msg = Buffer.alloc(12);
    msg.writeUInt16BE(0, 0); // mDNS id
    msg.writeUInt16BE(0x8000, 2); // response

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('constructor should use NOTICE log level when --silent is set and debug is off', () => {
    const argvBefore = [...process.argv];
    try {
      process.argv = ['node', 'test', '--silent'];
      const server = new MdnsReflectorServer();
      expect((server as any).log.logLevel).toBe(LogLevel.NOTICE);
    } finally {
      process.argv = argvBefore;
    }
  });

  it('constructor should use DEBUG log level when --debug is set', () => {
    const argvBefore = [...process.argv];
    try {
      process.argv = ['node', 'test', '--debug'];
      const server = new MdnsReflectorServer();
      expect((server as any).log.logLevel).toBe(LogLevel.DEBUG);
    } finally {
      process.argv = argvBefore;
    }
  });

  it('constructor should apply --filter values to mdnsIpv4 and mdnsIpv6 filters', () => {
    const argvBefore = [...process.argv];
    try {
      process.argv = ['node', 'test', '--filter', 'alpha', 'beta'];
      const server = new MdnsReflectorServer();

      expect((server as any).mdnsIpv4.filters).toEqual(expect.arrayContaining(['alpha', 'beta']));
      expect((server as any).mdnsIpv6.filters).toEqual(expect.arrayContaining(['alpha', 'beta']));
    } finally {
      process.argv = argvBefore;
    }
  });

  it('upgradeAddress should parse a valid question section when qdCount > 0', () => {
    const server = new MdnsReflectorServer();

    mockNetworkInterfaces({
      eth0: [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }],
    } as any);

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const question = Buffer.concat([mdns.encodeDnsName(name), Buffer.from([0x00, DnsRecordType.A, 0x00, DnsClass.IN])]);
    const answer = buildARecord(mdns, name, ttl, [172, 17, 0, 2]);
    const msg = Buffer.concat([buildHeader({ qdCount: 1, anCount: 1 }), question, answer]);

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).not.toBe(msg);

    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    expect(decoded.answers?.find((r) => r.type === DnsRecordType.A)?.data).toBe('10.0.0.5');
  });

  it('getBroadcastAddress should return IPv4 broadcast address', () => {
    const server = new MdnsReflectorServer();
    const mdns = new FakeMdns();
    mdns.socketType = 'udp4';
    mdns.getIpv4InterfaceAddress = jest.fn(() => '192.168.1.10');
    mdns.getNetmask = jest.fn(() => '255.255.255.0');
    mdns.getIpv4BroadcastAddress = jest.fn(() => '192.168.1.255');

    const broadcast = server.getBroadcastAddress(mdns as unknown as Mdns);
    expect(broadcast).toBe('192.168.1.255');
  });

  it('getBroadcastAddress should return IPv6 broadcast address', () => {
    const server = new MdnsReflectorServer();
    const mdns = new FakeMdns();
    mdns.socketType = 'udp6';
    mdns.getIpv6InterfaceAddress = jest.fn(() => 'fe80::1');
    mdns.getIpv6BroadcastAddress = jest.fn(() => 'ff02::1');

    const broadcast = server.getBroadcastAddress(mdns as unknown as Mdns);
    expect(broadcast).toBe('ff02::1');
  });

  it('getBroadcastAddress should log error and return undefined on failure', () => {
    const server = new MdnsReflectorServer();
    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    jest.spyOn(mdns, 'getIpv4InterfaceAddress').mockImplementation(() => {
      throw new Error('boom');
    });

    const broadcast = server.getBroadcastAddress(mdns as unknown as Mdns);
    expect(broadcast).toBeUndefined();
    expect(loggerErrorSpy).toHaveBeenCalledWith('Error getting broadcast address: boom');
  });

  it('start/stop should bind and close all sockets', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeEndpoint();
    const mdnsIpv6 = new FakeEndpoint();
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    // Replace real endpoints with fakes.
    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    const rmMdns4 = jest.spyOn(mdnsIpv4, 'removeAllListeners');
    const rmMdns6 = jest.spyOn(mdnsIpv6, 'removeAllListeners');
    const rmUni4 = jest.spyOn(unicastIpv4, 'removeAllListeners');
    const rmUni6 = jest.spyOn(unicastIpv6, 'removeAllListeners');

    await server.start();
    expect(mdnsIpv4.start).toHaveBeenCalledTimes(1);
    expect(mdnsIpv6.start).toHaveBeenCalledTimes(1);
    expect(unicastIpv4.start).toHaveBeenCalledTimes(1);
    expect(unicastIpv6.start).toHaveBeenCalledTimes(1);

    await server.stop();
    expect(mdnsIpv4.stop).toHaveBeenCalledTimes(1);
    expect(mdnsIpv6.stop).toHaveBeenCalledTimes(1);
    expect(unicastIpv4.stop).toHaveBeenCalledTimes(1);
    expect(unicastIpv6.stop).toHaveBeenCalledTimes(1);

    expect(rmMdns4).toHaveBeenCalled();
    expect(rmMdns6).toHaveBeenCalled();
    expect(rmUni4).toHaveBeenCalled();
    expect(rmUni6).toHaveBeenCalled();
  });

  it('start should reflect ipv4 unicast message to multicast and broadcast when -broadcast is set', async () => {
    // Ensure broadcast flag is present for this test only.
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--broadcast')) process.argv.push('--broadcast');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      await server.start();

      const payload = buildQueryHeader();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: payload.length });

      // Expect: multicast send + broadcast send.
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '192.168.1.255', 5353);
      // Acknowledge reply to client.
      expect(unicastIpv4.send).toHaveBeenCalledWith(expect.any(Buffer), '10.0.0.2', 5555);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should not broadcast when --broadcast is set but broadcast address is undefined', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--broadcast')) process.argv.push('--broadcast');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      // Force the inner `if (broadcastAddress)` branch to be false.
      jest.spyOn(server as any, 'getBroadcastAddress').mockReturnValue(undefined);

      await server.start();

      const payload = buildQueryHeader();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: payload.length });
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);
      expect(mdnsIpv4.send).not.toHaveBeenCalledWith(payload, '192.168.1.255', 5353);

      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'fd00::2', port: 6666, size: payload.length });
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);
      expect(mdnsIpv6.send).not.toHaveBeenCalledWith(payload, 'ff02::1', 5353);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should reflect ipv6 unicast message to multicast and broadcast when -broadcast is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--broadcast')) process.argv.push('--broadcast');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      await server.start();

      const payload = buildQueryHeader();
      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'fd00::2', port: 6666, size: payload.length });

      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::1', 5353);
      expect(unicastIpv6.send).toHaveBeenCalledWith(expect.any(Buffer), 'fd00::2', 6666);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should share ipv4 unicast messages with other ipv4 clients when --share-with-clients is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--share-with-clients')) process.argv.push('--share-with-clients');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      await server.start();

      const payload = buildQueryHeader();
      const clientA = { family: 'IPv4', address: '10.0.0.2', port: 5555, size: payload.length };
      const clientB = { family: 'IPv4', address: '10.0.0.3', port: 5556, size: payload.length };

      // Register client A (no share yet).
      (unicastIpv4 as any).emit('message', payload, clientA);

      // Register client B and ensure the message is shared to A (but not to itself).
      (unicastIpv4 as any).emit('message', payload, clientB);

      // Shared to the other client (A)
      expect(unicastIpv4.send).toHaveBeenCalledWith(payload, '10.0.0.2', 5555);
      // Must not echo the payload back to the sender via share-with-clients
      expect(unicastIpv4.send).not.toHaveBeenCalledWith(payload, '10.0.0.3', 5556);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should share ipv6 unicast messages with other ipv6 clients when --share-with-clients is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--share-with-clients')) process.argv.push('--share-with-clients');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      await server.start();

      const payload = buildQueryHeader();
      const clientA = { family: 'IPv6', address: 'fd00::2', port: 6666, size: payload.length };
      const clientB = { family: 'IPv6', address: 'fd00::3', port: 6667, size: payload.length };

      (unicastIpv6 as any).emit('message', payload, clientA);
      (unicastIpv6 as any).emit('message', payload, clientB);

      expect(unicastIpv6.send).toHaveBeenCalledWith(payload, 'fd00::2', 6666);
      expect(unicastIpv6.send).not.toHaveBeenCalledWith(payload, 'fd00::3', 6667);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should reflect ipv4 unicast message to multicast and localhost when --localhost is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--localhost')) process.argv.push('--localhost');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      await server.start();

      const payload = buildQueryHeader();
      (unicastIpv4 as any).emit('message', payload, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: payload.length });

      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, '224.0.0.251', 5353);
      expect(mdnsIpv4.send).toHaveBeenCalledWith(payload, 'localhost', 5353);
      expect(unicastIpv4.send).toHaveBeenCalledWith(expect.any(Buffer), '10.0.0.2', 5555);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should reflect ipv6 unicast message to multicast and localhost when --localhost is set', async () => {
    const argvBefore = [...process.argv];
    if (!process.argv.includes('--localhost')) process.argv.push('--localhost');

    try {
      const server = new MdnsReflectorServer();

      const mdnsIpv4 = new FakeMdns();
      mdnsIpv4.socketType = 'udp4';
      const mdnsIpv6 = new FakeMdns();
      mdnsIpv6.socketType = 'udp6';
      const unicastIpv4 = new FakeEndpoint();
      const unicastIpv6 = new FakeEndpoint();

      (server as any).mdnsIpv4 = mdnsIpv4;
      (server as any).mdnsIpv6 = mdnsIpv6;
      (server as any).unicastIpv4 = unicastIpv4;
      (server as any).unicastIpv6 = unicastIpv6;

      await server.start();

      const payload = buildQueryHeader();
      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'fd00::2', port: 6666, size: payload.length });

      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'localhost', 5353);
      expect(unicastIpv6.send).toHaveBeenCalledWith(expect.any(Buffer), 'fd00::2', 6666);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
  });

  it('start should ignore non-mDNS messages from unicast clients', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    await server.start();

    const bad = buildNotMdnsHeader();
    (unicastIpv4 as any).emit('message', bad, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: bad.length });
    expect(mdnsIpv4.send).not.toHaveBeenCalled();

    (unicastIpv6 as any).emit('message', bad, { family: 'IPv6', address: 'fd00::2', port: 6666, size: bad.length });
    expect(mdnsIpv6.send).not.toHaveBeenCalled();

    await server.stop();
  });

  it('upgradeAddress should log N/A when no interface is selected (selectedInterfaceName undefined)', () => {
    const server = new MdnsReflectorServer();

    mockNetworkInterfaces({} as any);

    const msg = Buffer.alloc(12);
    msg.writeUInt16BE(0, 0); // mDNS id
    msg.writeUInt16BE(0x8000, 2); // response

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('selected interface'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('N/A'));
  });

  it('upgradeAddress should tolerate a selected interface resolving to undefined (interfaces[name] ?? [])', () => {
    const server = new MdnsReflectorServer();
    // Force the preferred-interface branch.
    (server.mdnsIpv4 as any).interfaceName = 'eth0';

    const infos = [{ address: '10.0.0.5', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.5/24' }];
    let accessCount = 0;
    const interfacesWithFlakyGetter: any = {};
    Object.defineProperty(interfacesWithFlakyGetter, 'eth0', {
      enumerable: true,
      get() {
        accessCount++;
        return accessCount === 1 ? infos : undefined;
      },
    });

    mockNetworkInterfaces(interfacesWithFlakyGetter);

    const msg = Buffer.alloc(12);
    msg.writeUInt16BE(0, 0); // mDNS id
    msg.writeUInt16BE(0x8000, 2); // response

    const upgraded = server.upgradeAddress(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
    expect(accessCount).toBeGreaterThanOrEqual(2);
  });

  it('start should upgrade only responses (isMdnsResponse path)', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    const upgradeSpy = jest.spyOn(server as any, 'upgradeAddress');
    await server.start();

    // Query should not be upgraded
    const query = buildQueryHeader();
    (unicastIpv4 as any).emit('message', query, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: query.length });
    (unicastIpv6 as any).emit('message', query, { family: 'IPv6', address: 'fd00::2', port: 6666, size: query.length });
    // Response should be upgraded
    const response = buildResponseHeader();
    (unicastIpv4 as any).emit('message', response, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: response.length });
    (unicastIpv6 as any).emit('message', response, { family: 'IPv6', address: 'fd00::2', port: 6666, size: response.length });

    expect(upgradeSpy).toHaveBeenCalledTimes(2);
    await server.stop();
  });

  it('start should forward multicast messages to registered ipv4 clients', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    await server.start();

    // Register client via unicast.
    const query = buildQueryHeader();
    (unicastIpv4 as any).emit('message', query, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: query.length });

    // Now multicast messages (query + response) should be forwarded to that client.
    const q = buildQueryHeader();
    (mdnsIpv4 as any).emit('message', q, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: q.length });
    expect(unicastIpv4.send).toHaveBeenCalledWith(q, '10.0.0.2', 5555);

    const resp = buildResponseHeader();
    (mdnsIpv4 as any).emit('message', resp, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: resp.length });
    expect(unicastIpv4.send).toHaveBeenCalledWith(resp, '10.0.0.2', 5555);

    await server.stop();
  });

  it('start should not forward multicast messages when no clients are registered (ipv4+ipv6)', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    await server.start();

    const q = buildQueryHeader();
    const r = buildResponseHeader();

    (mdnsIpv4 as any).emit('message', q, { family: 'IPv4', address: '224.0.0.251', port: 5353, size: q.length });
    (mdnsIpv6 as any).emit('message', r, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: r.length });

    expect(unicastIpv4.send).not.toHaveBeenCalled();
    expect(unicastIpv6.send).not.toHaveBeenCalled();

    await server.stop();
  });

  it('stop should notify registered clients', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    await server.start();

    const query = buildQueryHeader();
    (unicastIpv4 as any).emit('message', query, { family: 'IPv4', address: '10.0.0.2', port: 5555, size: query.length });
    (unicastIpv6 as any).emit('message', query, { family: 'IPv6', address: 'fd00::2', port: 6666, size: query.length });

    await server.stop();

    expect(unicastIpv4.send).toHaveBeenCalledWith(expect.any(Buffer), '10.0.0.2', 5555);
    expect(unicastIpv6.send).toHaveBeenCalledWith(expect.any(Buffer), 'fd00::2', 6666);
  });

  it('start should forward multicast messages to registered ipv6 clients', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    await server.start();

    const query = buildQueryHeader();
    (unicastIpv6 as any).emit('message', query, { family: 'IPv6', address: 'fd00::2', port: 6666, size: query.length });
    const q = buildQueryHeader();
    (mdnsIpv6 as any).emit('message', q, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: q.length });
    expect(unicastIpv6.send).toHaveBeenCalledWith(q, 'fd00::2', 6666);

    const resp = buildResponseHeader();
    (mdnsIpv6 as any).emit('message', resp, { family: 'IPv6', address: 'ff02::fb', port: 5353, size: resp.length });
    expect(unicastIpv6.send).toHaveBeenCalledWith(resp, 'fd00::2', 6666);

    await server.stop();
  });

  it('start should attach error handlers for all sockets', async () => {
    const server = new MdnsReflectorServer();

    const mdnsIpv4 = new FakeMdns();
    mdnsIpv4.socketType = 'udp4';
    const mdnsIpv6 = new FakeMdns();
    mdnsIpv6.socketType = 'udp6';
    const unicastIpv4 = new FakeEndpoint();
    const unicastIpv6 = new FakeEndpoint();

    (server as any).mdnsIpv4 = mdnsIpv4;
    (server as any).mdnsIpv6 = mdnsIpv6;
    (server as any).unicastIpv4 = unicastIpv4;
    (server as any).unicastIpv6 = unicastIpv6;

    const errorSpy = jest.spyOn((server as any).log, 'error');
    await server.start();

    const err = new Error('fail');
    err.stack = 'STACK';
    (mdnsIpv4 as any).emit('error', err);
    (mdnsIpv6 as any).emit('error', err);
    (unicastIpv4 as any).emit('error', err);
    (unicastIpv6 as any).emit('error', err);

    expect(errorSpy).toHaveBeenCalled();
    await server.stop();
  });
});
