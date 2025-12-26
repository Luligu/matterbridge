/**
 * @description MdnsReflectorServer upgradeAddressForDocker() test
 * @file mdnsReflectorServer.test.ts
 * @author Luca Liguori
 * @created 2025-12-26
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import EventEmitter from 'node:events';

import { LogLevel } from 'node-ansi-logger';
import { jest } from '@jest/globals';

import { setupTest } from '../jestutils/jestHelpers.js';

import { DnsClass, DnsRecordType, Mdns } from './mdns.js';
import { MdnsReflectorServer } from './mdnsReflectorServer.js';

process.argv.push('--verbose');

jest.mock('node:dgram');

// Setup the test environment
await setupTest('MdnsReflectorServer', false);

describe('MdnsReflectorServer', () => {
  class FakeEndpoint extends EventEmitter {
    start = jest.fn(() => {
      setImmediate(() => this.emit('bound', { family: 'IPv4', address: '0.0.0.0', port: 1 }));
    });
    stop = jest.fn(() => {
      setImmediate(() => this.emit('closed'));
    });
    send = jest.fn();
  }

  class FakeMdns extends FakeEndpoint {
    socketType: 'udp4' | 'udp6' = 'udp4';
    interfaceName: string | undefined = undefined;
    log = { error: jest.fn() };
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

  it('upgradeAddressForDocker should rewrite A and AAAA RDATA to host addresses', () => {
    const server = new MdnsReflectorServer();

    // Make host addresses deterministic for the test.
    (server.mdnsIpv4.getIpv4InterfaceAddress as unknown as jest.Mock) = jest.fn(() => '192.168.1.10');
    (server.mdnsIpv6.getIpv6InterfaceAddress as unknown as jest.Mock) = jest.fn(() => 'fd00::1');

    // Reuse existing encoder helpers.
    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');

    const name = 'matterbridge.local';
    const ttl = 120;

    const header = buildHeader({ anCount: 2 });
    const rrA = buildARecord(mdns, name, ttl, [172, 17, 0, 2]);
    const rrAAAA = buildAAAARecord(mdns, name, ttl, 'fd00::2');
    const msg = Buffer.concat([header, rrA, rrAAAA]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);

    const a = decoded.answers?.find((r) => r.type === DnsRecordType.A);
    const aaaa = decoded.answers?.find((r) => r.type === DnsRecordType.AAAA);

    expect(a?.data).toBe('192.168.1.10');
    expect(aaaa?.data).toBe('fd00:0:0:0:0:0:0:1');
  });

  it('upgradeAddressForDocker should return same buffer if message is shorter than DNS header', () => {
    const server = new MdnsReflectorServer();
    const msg = Buffer.alloc(11);
    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddressForDocker should rewrite only A when only host IPv4 is available', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '10.0.0.5');
    (server.mdnsIpv6.getIpv6InterfaceAddress as any) = jest.fn(() => {
      throw new Error('no ipv6');
    });

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 2 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2]), buildAAAARecord(mdns, name, ttl, 'fd00::2')]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).not.toBe(msg);

    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    const a = decoded.answers?.find((r) => r.type === DnsRecordType.A);
    const aaaa = decoded.answers?.find((r) => r.type === DnsRecordType.AAAA);
    expect(a?.data).toBe('10.0.0.5');
    expect(aaaa?.data).toBe('fd00:0:0:0:0:0:0:2');
  });

  it('upgradeAddressForDocker should rewrite only AAAA when only host IPv6 is available', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => {
      throw new Error('no ipv4');
    });
    (server.mdnsIpv6.getIpv6InterfaceAddress as any) = jest.fn(() => 'fd00::1234');

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ anCount: 2 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2]), buildAAAARecord(mdns, name, ttl, 'fd00::2')]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).not.toBe(msg);

    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    const a = decoded.answers?.find((r) => r.type === DnsRecordType.A);
    const aaaa = decoded.answers?.find((r) => r.type === DnsRecordType.AAAA);
    expect(a?.data).toBe('172.17.0.2');
    expect(aaaa?.data).toBe('fd00:0:0:0:0:0:0:1234');
  });

  it('upgradeAddressForDocker should rewrite A/AAAA in authority and additional sections', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '192.168.50.10');
    (server.mdnsIpv6.getIpv6InterfaceAddress as any) = jest.fn(() => 'fd00::abcd');

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;
    const msg = Buffer.concat([buildHeader({ nsCount: 1, arCount: 1 }), buildARecord(mdns, name, ttl, [172, 17, 0, 2]), buildAAAARecord(mdns, name, ttl, 'fd00::2')]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    const decoded = mdns.decodeMdnsMessage(upgraded as unknown as Buffer);
    expect(decoded.authorities?.find((r) => r.type === DnsRecordType.A)?.data).toBe('192.168.50.10');
    expect(decoded.additionals?.find((r) => r.type === DnsRecordType.AAAA)?.data).toBe('fd00:0:0:0:0:0:0:abcd');
  });

  it('upgradeAddressForDocker should return original message on decode errors (catch path)', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '10.0.0.5');
    (server.mdnsIpv6.getIpv6InterfaceAddress as any) = jest.fn(() => 'fd00::1');

    // qdCount=1 but message does not contain the question section -> decodeDnsName throws.
    const msg = buildHeader({ qdCount: 1 });
    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddressForDocker should return original message when question section is truncated after name', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '10.0.0.5');
    (server.mdnsIpv6.getIpv6InterfaceAddress as any) = jest.fn(() => 'fd00::1');

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const qname = mdns.encodeDnsName('_http._tcp.local');
    // Missing QTYPE/QCLASS bytes -> triggers offset > length early return.
    const msg = Buffer.concat([buildHeader({ qdCount: 1 }), qname]);
    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
    expect(upgraded).toBe(msg);
  });

  it('upgradeAddressForDocker should not modify A record when RDLENGTH is not 4', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '10.0.0.5');

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const rdlength = 5; // invalid for A, should be ignored by upgrader
    const fixed = buildFixed(DnsRecordType.A, ttl, rdlength);
    const rdata = Buffer.from([172, 17, 0, 2, 0xff]);
    const rr = Buffer.concat([mdns.encodeDnsName(name), fixed, rdata]);
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), rr]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>) as unknown as Buffer;
    expect(upgraded).not.toBe(msg);

    // RDATA starts after header + encoded name + fixed(10)
    const rdataOffset = 12 + mdns.encodeDnsName(name).length + 10;
    expect(upgraded.slice(rdataOffset, rdataOffset + rdlength).equals(rdata)).toBe(true);
  });

  it('upgradeAddressForDocker should stop safely when RDLENGTH points past buffer end', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '10.0.0.5');

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const ttl = 120;

    const fixed = buildFixed(DnsRecordType.A, ttl, 1000);
    const rrTruncated = Buffer.concat([mdns.encodeDnsName(name), fixed, Buffer.from([172, 17, 0, 2])]);
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), rrTruncated]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>) as unknown as Buffer;
    expect(upgraded).not.toBe(msg);
    expect(upgraded.equals(msg)).toBe(true);
  });

  it('upgradeAddressForDocker should stop safely when RR fixed fields are truncated (offset + 10 guard)', () => {
    const server = new MdnsReflectorServer();
    (server.mdnsIpv4.getIpv4InterfaceAddress as any) = jest.fn(() => '10.0.0.5');

    const mdns = new Mdns('test', '224.0.0.251', 5353, 'udp4');
    const name = 'matterbridge.local';
    const rrNameOnly = mdns.encodeDnsName(name); // missing TYPE/CLASS/TTL/RDLENGTH
    const msg = Buffer.concat([buildHeader({ anCount: 1 }), rrNameOnly]);

    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>) as unknown as Buffer;
    expect(upgraded).not.toBe(msg);
    expect(upgraded.equals(msg)).toBe(true);
  });

  it('upgradeAddressForDocker should return original message when no host addresses are available', () => {
    const server = new MdnsReflectorServer();

    (server.mdnsIpv4.getIpv4InterfaceAddress as unknown as jest.Mock) = jest.fn(() => {
      throw new Error('no ipv4');
    });
    (server.mdnsIpv6.getIpv6InterfaceAddress as unknown as jest.Mock) = jest.fn(() => {
      throw new Error('no ipv6');
    });

    const msg = Buffer.alloc(12);
    const upgraded = server.upgradeAddressForDocker(msg as unknown as Buffer<ArrayBufferLike>);
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
    const mdns = new FakeMdns();
    mdns.socketType = 'udp4';
    mdns.getIpv4InterfaceAddress = jest.fn(() => {
      throw new Error('boom');
    });

    const broadcast = server.getBroadcastAddress(mdns as unknown as Mdns);
    expect(broadcast).toBeUndefined();
    expect(mdns.log.error).toHaveBeenCalled();
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

      const payload = Buffer.from([1, 2, 3]);
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

      const payload = Buffer.from([9, 8, 7]);
      (unicastIpv6 as any).emit('message', payload, { family: 'IPv6', address: 'fd00::2', port: 6666, size: payload.length });

      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::fb', 5353);
      expect(mdnsIpv6.send).toHaveBeenCalledWith(payload, 'ff02::1', 5353);
      expect(unicastIpv6.send).toHaveBeenCalledWith(expect.any(Buffer), 'fd00::2', 6666);

      await server.stop();
    } finally {
      process.argv = argvBefore;
    }
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
