/**
 * @file packages/dgram/buntest/mdnsResolver.test.ts
 * @description MdnsResolver service resolution tests.
 * @author Luca Liguori
 */

import { afterEach, beforeEach, describe, expect, it, spyOn, vi } from 'bun:test';
import os from 'node:os';

import { DnsClass, DnsHeaderFlag, DnsRecordType, Mdns } from '../src/mdns.js';
import { MdnsResolver } from '../src/mdnsResolver.js';

const INSTANCE = '87E1B004E235A130-8FC7772401CD0696._matter._tcp.local';
const HOST = 'B75AFB458ECD0000.local';
const PORT = 5353;

type Record = Parameters<Mdns['encodeResourceRecord']>[0];

/**
 * Delivers encoded records to a resolver socket.
 *
 * @param {Mdns} socket - Resolver socket.
 * @param {Record[]} answers - DNS answers.
 * @param {Record[]} [additionals] - Additional DNS records.
 * @param {number} [flags] - DNS response flags.
 * @param {number} [port] - Sender port.
 * @param {string} [address] - Sender address.
 */
function reply(socket: Mdns, answers: Record[], additionals: Record[] = [], flags: number = DnsHeaderFlag.QR, port: number = PORT, address = '192.0.2.1'): void {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(flags, 2);
  header.writeUInt16BE(answers.length, 6);
  header.writeUInt16BE(additionals.length, 10);
  const packet = Buffer.concat([header, ...[...answers, ...additionals].map((record) => socket.encodeResourceRecord(record))]);
  socket.onMessage(packet, { address, family: address.includes(':') ? 'IPv6' : 'IPv4', port, size: packet.length });
}

/**
 * Builds a complete reply for the test instance.
 *
 * @param {Mdns} socket - Codec for the record data.
 * @returns {Record[]} The SRV, TXT, A and AAAA records.
 */
function completeReply(socket: Mdns): Record[] {
  return [
    { name: INSTANCE, rtype: DnsRecordType.SRV, rclass: DnsClass.IN, ttl: 120, rdata: socket.encodeSrvRdata(0, 0, 5540, HOST) },
    { name: INSTANCE, rtype: DnsRecordType.TXT, rclass: DnsClass.IN, ttl: 120, rdata: socket.encodeTxtRdata(['T=6']) },
    { name: HOST, rtype: DnsRecordType.A, rclass: DnsClass.IN, ttl: 120, rdata: socket.encodeA('192.0.2.10') },
    { name: HOST, rtype: DnsRecordType.AAAA, rclass: DnsClass.IN, ttl: 120, rdata: socket.encodeAAAA('fd00::1234') },
  ];
}

describe('MdnsResolver', () => {
  let sockets: Mdns[];
  let questions: Parameters<Mdns['sendQuery']>[0][number][];

  beforeEach(() => {
    vi.useFakeTimers();
    sockets = [];
    questions = [];
    spyOn(Mdns.prototype, 'start').mockImplementation(function (this: Mdns) {
      sockets.push(this);
      this.emit('ready', { address: this.interfaceAddress ?? '', family: this.socketType === 'udp4' ? 'IPv4' : 'IPv6', port: PORT });
    });
    spyOn(Mdns.prototype, 'sendQuery').mockImplementation((sent) => {
      questions.push(...sent);
      return Buffer.alloc(0);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should collect split replies and return before the lookup timeout', async () => {
    const resolution = new MdnsResolver({ timeoutMs: 1500 }).resolve(INSTANCE + '.');
    const [ipv4, ipv6] = sockets;
    const srv = { name: INSTANCE.toLowerCase(), rtype: DnsRecordType.SRV, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeSrvRdata(0, 0, 5540, HOST) };
    const txt = { name: INSTANCE, rtype: DnsRecordType.TXT, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeTxtRdata(['SII=5000', 'note=a, b', 'flag']) };
    const a = { name: HOST.toLowerCase(), rtype: DnsRecordType.A, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeA('192.0.2.10') };
    const aaaa = { name: HOST, rtype: DnsRecordType.AAAA, rclass: DnsClass.IN, ttl: 120, rdata: ipv6.encodeAAAA('fd00::1234') };

    expect(questions.map(({ type }) => type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT, DnsRecordType.SRV, DnsRecordType.TXT]);
    reply(ipv4, [srv], [a, { ...a, name: 'other.local', rdata: ipv4.encodeA('192.0.2.11') }]);
    expect(questions.slice(4).map(({ name, type }) => [name, type])).toEqual([
      [HOST, DnsRecordType.A],
      [HOST, DnsRecordType.AAAA],
      [HOST, DnsRecordType.A],
      [HOST, DnsRecordType.AAAA],
    ]);
    vi.advanceTimersByTime(100);
    reply(ipv4, [a]);
    vi.advanceTimersByTime(100);
    reply(ipv6, [txt, aaaa, a, { ...a, rdata: ipv4.encodeA('192.0.2.12') }]);

    expect(await resolution).toEqual({
      instanceName: INSTANCE,
      target: HOST,
      port: 5540,
      addresses: ['192.0.2.10', 'fd00:0:0:0:0:0:0:1234', '192.0.2.12'],
      txt: ['SII=5000', 'note=a, b', 'flag'],
    });
    for (const socket of sockets) expect(() => socket.socket.address()).toThrow();
    vi.advanceTimersByTime(1500);
    expect(questions).toHaveLength(8);
  });

  it('should return undefined when no usable SRV arrives before the deadline', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false, timeoutMs: 1500 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const srv = { name: INSTANCE, rtype: DnsRecordType.SRV, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeSrvRdata(0, 0, 5540, HOST) };
    reply(ipv4, [srv], [], 0);
    reply(ipv4, [srv], [], DnsHeaderFlag.QR, PORT + 1);
    reply(ipv4, [{ ...srv, name: 'Other._matter._tcp.local' }]);
    reply(ipv4, [{ ...srv, rclass: DnsClass.ANY }]);
    reply(ipv4, [{ ...srv, ttl: 0 }]);
    reply(ipv4, [{ ...srv, rdata: Buffer.alloc(5) }]);
    reply(ipv4, [{ ...srv, rdata: Buffer.concat([srv.rdata, Buffer.from([0])]) }]);
    reply(ipv4, [srv, { ...srv, rtype: DnsRecordType.TXT, rdata: Buffer.from([2, 0x61]) }]);
    reply(ipv4, [srv, { ...srv, name: HOST, rtype: DnsRecordType.A, rdata: Buffer.alloc(5) }]);
    vi.advanceTimersByTime(1500);

    expect(await resolution).toBeUndefined();
    expect(questions.map(({ type }) => type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT, DnsRecordType.SRV, DnsRecordType.TXT]);
  });

  it('should return without follow-up queries when one packet contains all four record types', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false }).resolve(INSTANCE);
    const [ipv4] = sockets;
    reply(ipv4, completeReply(ipv4));

    expect(await resolution).toMatchObject({ addresses: ['192.0.2.10', 'fd00:0:0:0:0:0:0:1234'], txt: ['T=6'] });
    expect(questions.map(({ type }) => type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT]);
  });

  it('should use matching addresses received before SRV and TXT', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, a, aaaa] = completeReply(ipv4);
    reply(ipv4, [{ ...a, name: HOST.toLowerCase() }, aaaa, { ...a, name: 'other.local', rdata: ipv4.encodeA('192.0.2.11') }]);
    reply(ipv4, [srv, txt]);

    expect(await resolution).toMatchObject({ addresses: ['192.0.2.10', 'fd00:0:0:0:0:0:0:1234'] });
    expect(questions.map(({ type }) => type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT]);
  });

  it.each([
    ['IPv4', '192.0.2.10'],
    ['IPv6', 'fd00:0:0:0:0:0:0:1234'],
  ])('should return immediately with only an %s address', async (family, address) => {
    const resolution = new MdnsResolver({ enableIpv6: false }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, a, aaaa] = completeReply(ipv4);
    reply(ipv4, [srv, txt, family === 'IPv4' ? a : aaaa]);

    expect(await resolution).toMatchObject({ addresses: [address], txt: ['T=6'] });
  });

  it.each(['TXT', 'SRV'])('should return undefined when %s is missing at timeout', async (missingType) => {
    const resolution = new MdnsResolver({ enableIpv6: false, timeoutMs: 100 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, a, aaaa] = completeReply(ipv4);
    reply(ipv4, [missingType === 'TXT' ? srv : txt, a, aaaa]);
    vi.advanceTimersByTime(100);

    expect(await resolution).toBeUndefined();
  });

  it('should omit expired and withdrawn records when returning the endpoint', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false, timeoutMs: 1500 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const srv = { name: INSTANCE, rtype: DnsRecordType.SRV, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeSrvRdata(0, 0, 5540, HOST) };
    const txt = { name: INSTANCE, rtype: DnsRecordType.TXT, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeTxtRdata(['SII=5000']) };
    const a = { name: HOST, rtype: DnsRecordType.A, rclass: DnsClass.IN, ttl: 120, rdata: ipv4.encodeA('192.0.2.10') };
    reply(ipv4, [srv, a, { ...a, ttl: 1, rdata: ipv4.encodeA('192.0.2.11') }]);
    reply(ipv4, [{ ...a, ttl: 0 }]);
    vi.advanceTimersByTime(1000);
    reply(ipv4, [txt]);
    vi.advanceTimersByTime(500);

    expect(await resolution).toBeUndefined();
  });

  it('should return undefined when TXT is withdrawn before the last address arrives', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false, timeoutMs: 100 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, a] = completeReply(ipv4);
    reply(ipv4, [srv, txt]);
    reply(ipv4, [{ ...txt, ttl: 0 }, a]);
    vi.advanceTimersByTime(100);

    expect(await resolution).toBeUndefined();
  });

  it('should continue on the ready family when multicast setup fails on the other', async () => {
    spyOn(Mdns.prototype, 'start').mockImplementation(function (this: Mdns) {
      sockets.push(this);
      if (this.socketType === 'udp6')
        spyOn(this.socket, 'setBroadcast').mockImplementation(() => {
          throw new Error('Multicast unavailable for udp6');
        });
      if (this.socketType === 'udp6') this.onListening({ address: '::', family: 'IPv6', port: PORT });
      else this.emit('ready', { address: '0.0.0.0', family: 'IPv4', port: PORT });
    });
    const resolution = new MdnsResolver({ timeoutMs: 100 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    reply(ipv4, completeReply(ipv4));

    expect(await resolution).toMatchObject({ target: HOST, port: 5540 });
  });

  it('should add the zone of a link-local sender to link-local addresses and leave the routable ones as they are', async () => {
    const resolution = new MdnsResolver().resolve(INSTANCE);
    const [, ipv6] = sockets;
    const [srv, txt, , aaaa] = completeReply(ipv6);
    reply(ipv6, [srv, txt, aaaa, { ...aaaa, rdata: ipv6.encodeAAAA('fe80::10') }], [], DnsHeaderFlag.QR, PORT, 'fe80::99%en5');

    expect(await resolution).toMatchObject({ addresses: ['fd00:0:0:0:0:0:0:1234', 'fe80:0:0:0:0:0:0:10%en5'] });
  });

  it('should leave a link-local address without zone when no interface holds the sender', async () => {
    spyOn(os, 'networkInterfaces').mockReturnValue({});
    const resolution = new MdnsResolver({ enableIpv6: false }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, , aaaa] = completeReply(ipv4);
    reply(ipv4, [srv, txt, { ...aaaa, rdata: ipv4.encodeAAAA('fe80::10') }]);

    expect(await resolution).toMatchObject({ addresses: ['fe80:0:0:0:0:0:0:10'] });
  });

  it('should reject with the abort reason and close the sockets when the lookup is aborted', async () => {
    const before = new AbortController();
    before.abort(new Error('cancelled before'));
    expect(await new MdnsResolver().resolve(INSTANCE, { signal: before.signal }).catch((error: unknown) => error)).toMatchObject({ message: 'cancelled before' });
    expect(sockets).toHaveLength(0);

    const during = new AbortController();
    const resolution = new MdnsResolver().resolve(INSTANCE, { signal: during.signal }).catch((error: unknown) => error);
    expect(sockets).toHaveLength(2);
    during.abort('user cancelled');
    expect(await resolution).toMatchObject({ name: 'AbortError' });
    for (const socket of sockets) expect(() => socket.socket.address()).toThrow();
    vi.advanceTimersByTime(3000);
    expect(questions).toHaveLength(4);
  });

  it('should reject invalid configuration or an invalid instance name', () => {
    expect(() => new MdnsResolver({ enableIpv4: false, enableIpv6: false })).toThrow('must be enabled');
    expect(() => new MdnsResolver({ timeoutMs: 0 })).toThrow('invalid timeoutMs');
    expect(() => new MdnsResolver({ mdnsPort: 65536 })).toThrow('invalid mdnsPort');
    expect(new MdnsResolver().resolve('_matter._tcp.local')).rejects.toThrow('expected a full DNS-SD instance name');
    expect(sockets).toHaveLength(0);
  });

  it('should reject when no enabled socket can start', () => {
    spyOn(Mdns.prototype, 'start').mockImplementation(() => {
      throw new Error('bind failed');
    });
    expect(new MdnsResolver().resolve(INSTANCE)).rejects.toThrow('bind failed');
  });

  it('should reject with an Error when the sockets fail to start with a value that is not an Error', () => {
    spyOn(Mdns.prototype, 'start').mockImplementation(() => {
      // oxlint-disable-next-line typescript/only-throw-error -- exercises the non-Error branch
      throw 'bind failed';
    });
    expect(new MdnsResolver().resolve(INSTANCE)).rejects.toThrow('bind failed');
  });

  it('should reject at the deadline when no socket becomes ready', async () => {
    spyOn(Mdns.prototype, 'start').mockImplementation(() => {});
    const resolution = new MdnsResolver({ timeoutMs: 100 }).resolve(INSTANCE).catch((error: unknown) => error);
    vi.advanceTimersByTime(100);
    expect(await resolution).toMatchObject({ message: 'MdnsResolver: no mDNS socket became ready' });
  });

  it('should reject with the Error reason when the lookup is aborted with an Error', async () => {
    const controller = new AbortController();
    const resolution = new MdnsResolver().resolve(INSTANCE, { signal: controller.signal }).catch((error: unknown) => error);
    controller.abort(new Error('cancelled during'));
    expect(await resolution).toMatchObject({ message: 'cancelled during' });
  });

  it('should query only the missing TXT record when the SRV record is known at the retry', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false, timeoutMs: 1500 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [, txt] = completeReply(ipv4);
    reply(ipv4, [txt]);
    vi.advanceTimersByTime(1000);
    expect(questions.map(({ type }) => type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT, DnsRecordType.SRV]);
    vi.advanceTimersByTime(500);

    expect(await resolution).toBeUndefined();
  });

  it('should query the known target on a socket that becomes ready later and ignore its errors once ready', async () => {
    spyOn(Mdns.prototype, 'start').mockImplementation(function (this: Mdns) {
      sockets.push(this);
      if (this.socketType === 'udp4') this.emit('ready', { address: '0.0.0.0', family: 'IPv4', port: PORT });
    });
    const resolution = new MdnsResolver({ timeoutMs: 1500 }).resolve(INSTANCE);
    const [ipv4, ipv6] = sockets;
    const [srv, txt, a] = completeReply(ipv4);
    reply(ipv4, [srv]);
    questions = [];
    ipv6.emit('ready', { address: '::', family: 'IPv6', port: PORT });
    expect(questions.map(({ name, type }) => [name, type])).toEqual([
      [INSTANCE, DnsRecordType.SRV],
      [INSTANCE, DnsRecordType.TXT],
      [HOST, DnsRecordType.A],
      [HOST, DnsRecordType.AAAA],
    ]);
    ipv4.emit('error', new Error('late error'));
    ipv6.emit('error', new Error('late error'));
    reply(ipv6, [txt, a]);

    expect(await resolution).toMatchObject({ target: HOST, addresses: ['192.0.2.10'] });
  });

  it('should follow the SRV target changes and withdrawals and ignore the unusable instance records', async () => {
    const resolution = new MdnsResolver({ enableIpv6: false, timeoutMs: 1500 }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, a] = completeReply(ipv4);
    const other = 'other.local';
    const srvOther = { ...srv, rdata: ipv4.encodeSrvRdata(0, 0, 5540, other) };
    reply(ipv4, [srv]);
    reply(ipv4, [{ ...srv, rdata: ipv4.encodeSrvRdata(0, 0, 0, HOST) }]); // No port: ignored
    reply(ipv4, [{ ...srv, ttl: 0, rdata: ipv4.encodeSrvRdata(0, 0, 5541, HOST) }]); // Goodbye of another port: ignored
    reply(ipv4, [srvOther]);
    questions = [];
    vi.advanceTimersByTime(1000); // Only the retry of the current target is sent
    expect(questions.map(({ name, type }) => [name, type])).toEqual([
      [INSTANCE, DnsRecordType.TXT],
      [other, DnsRecordType.A],
      [other, DnsRecordType.AAAA],
    ]);
    reply(ipv4, [{ ...srvOther, ttl: 0 }]); // Goodbye of the current SRV
    reply(ipv4, [{ ...txt, ttl: 0 }]); // Goodbye of an unknown TXT: ignored
    reply(ipv4, [txt, { ...a, name: INSTANCE }, { ...a, name: other }]);
    vi.advanceTimersByTime(500);

    expect(await resolution).toBeUndefined();
  });

  it('should take the records of a response without the answer or the additional section', async () => {
    const decode = Mdns.prototype.decodeMdnsMessage;
    spyOn(Mdns.prototype, 'decodeMdnsMessage')
      .mockImplementationOnce(function (this: Mdns, packet: Buffer) {
        return { ...decode.call(this, packet), additionals: undefined };
      })
      .mockImplementationOnce(function (this: Mdns, packet: Buffer) {
        return { ...decode.call(this, packet), answers: undefined };
      });
    const resolution = new MdnsResolver({ enableIpv6: false }).resolve(INSTANCE);
    const [ipv4] = sockets;
    const [srv, txt, a, aaaa] = completeReply(ipv4);
    reply(ipv4, [srv, txt], [a]);
    reply(ipv4, [a], [aaaa]);

    expect(await resolution).toMatchObject({ addresses: ['fd00:0:0:0:0:0:0:1234'] });
  });
});
