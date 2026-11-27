/**
 * @file packages/dgram/buntest/mdnsResponder.test.ts
 * @description MdnsResponder class test
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, spyOn, vi } from 'bun:test';
import dgram from 'node:dgram';
import { once } from 'node:events';
import os from 'node:os';

import { loggerLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { getFreePort } from '@matterbridge/utils/port';
import { LogLevel } from 'node-ansi-logger';

import { DnsClass, DnsClassFlag, DnsHeaderFlag, DnsRecordType, Mdns, MDNS_MAX_MESSAGE_LENGTH, type MdnsMessage } from '../src/mdns.js';
import {
  MDNS_ANNOUNCE_DEFAULT_COUNT,
  MDNS_HOST_RECORD_TTL,
  MDNS_OTHER_RECORD_TTL,
  MdnsResponder,
  type MdnsResponderFamily,
  type MdnsResponderOptions,
} from '../src/mdnsResponder.js';

// Mocks AnsiLogger.prototype.log and the console methods, and sets process.argv to ['bun', NAME].
await setupTest('MdnsResponderTest');
const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => !info.internal))?.[0];
if (!interfaceName) throw new Error('No external interface for responder tests');
const defaults: MdnsResponderOptions = {
  interfaceName,
  port: 1234,
  hostName: 'example-host',
  instanceName: 'Example',
  services: ['_example._tcp', '_http._tcp'],
  alias: 'example',
  txt: ['txtvers=1', 'path=/'],
};

// No module is mocked: the advertiser opens real sockets on an OS-assigned UDP port (so no mDNS traffic from the LAN arrives),
// every packet it sends is captured by a spy on transmit() (so nothing reaches the LAN), incoming packets are injected by
// emitting 'message' on the real sockets, and fake timers drive probing, announcing and the response delays.

interface Sent {
  family: MdnsResponderFamily;
  address: string;
  port: number;
  packet: Buffer;
  message: MdnsMessage;
}

interface Question {
  name: string;
  type: DnsRecordType;
  qclass?: number;
  qu?: boolean;
}

interface Record {
  name: string;
  type: DnsRecordType;
  ttl: number;
  rdata: Buffer;
  flush?: boolean;
}

const codec = new Mdns('Codec', '224.0.0.251', 5353, 'udp4');

/**
 * Builds a DNS packet.
 *
 * @param {object} parts - The packet parts.
 * @param {number} [parts.id] - The message ID.
 * @param {number} [parts.flags] - The header flags.
 * @param {Question[]} [parts.questions] - The questions.
 * @param {Record[]} [parts.answers] - The answer records.
 * @param {Record[]} [parts.authorities] - The authority records.
 * @param {Record[]} [parts.additionals] - The additional records.
 * @returns {Buffer} The packet.
 */
function buildPacket(parts: { id?: number; flags?: number; questions?: Question[]; answers?: Record[]; authorities?: Record[]; additionals?: Record[] }): Buffer {
  const { id = 0, flags = 0, questions = [], answers = [], authorities = [], additionals = [] } = parts;
  const header = Buffer.alloc(12);
  header.writeUInt16BE(id, 0);
  header.writeUInt16BE(flags, 2);
  header.writeUInt16BE(questions.length, 4);
  header.writeUInt16BE(answers.length, 6);
  header.writeUInt16BE(authorities.length, 8);
  header.writeUInt16BE(additionals.length, 10);
  const encodeQuestion = (question: Question): Buffer => {
    const fields = Buffer.alloc(4);
    fields.writeUInt16BE(question.type, 0);
    fields.writeUInt16BE((question.qclass ?? DnsClass.IN) + (question.qu ? DnsClassFlag.QU : 0), 2);
    return Buffer.concat([codec.encodeDnsName(question.name), fields]);
  };
  const encodeRecord = (record: Record): Buffer =>
    codec.encodeResourceRecord({ name: record.name, rtype: record.type, rclass: DnsClass.IN, flush: record.flush, ttl: record.ttl, rdata: record.rdata });
  return Buffer.concat([header, ...questions.map(encodeQuestion), ...answers.map(encodeRecord), ...authorities.map(encodeRecord), ...additionals.map(encodeRecord)]);
}

/**
 * Returns the non-internal addresses of an interface.
 *
 * @param {string} interfaceName - The interface name.
 * @returns {{ ipv4: string[]; ipv6: string[] }} The addresses.
 */
function interfaceAddresses(interfaceName: string): { ipv4: string[]; ipv6: string[] } {
  const infos = (os.networkInterfaces()[interfaceName] ?? []).filter((info) => !info.internal);
  return {
    ipv4: infos.filter((info) => info.family === 'IPv4').map((info) => info.address),
    ipv6: infos.filter((info) => info.family === 'IPv6').map((info) => info.address),
  };
}

/**
 * Lets pending promise continuations run.
 */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

describe('MdnsResponder', () => {
  let adv: MdnsResponder | undefined;
  let sent: Sent[] = [];
  let started: Promise<void> | undefined;
  let port = 0;
  let ipv4: string[] = [];
  let ipv6: string[] = [];

  /**
   * Creates an advertiser with a spy on transmit, starts it and waits until the sockets are ready.
   *
   * @param {Partial<MdnsResponderOptions>} [options] - Extra options.
   * @returns {Promise<MdnsResponder>} The advertiser, probing.
   */
  async function startAdvertiser(options: Partial<MdnsResponderOptions> = {}): Promise<MdnsResponder> {
    for (let attempt = 1; ; attempt++) {
      port = options.mdnsPort ?? (await getFreePort(options.enableIpv4 === false ? 'udp6' : 'udp4'));
      // Three announcements keep the sequences of these tests short; the default of 8 has its own test.
      const advertiser = new MdnsResponder({ ...defaults, mdnsPort: port, addressCheckIntervalMs: 0, announceCount: 3, ...options });
      adv = advertiser;
      sent = [];
      spyOn(advertiser, 'transmit').mockImplementation((family, packet, address, destinationPort) => {
        sent.push({ family, address, port: destinationPort, packet, message: codec.decodeMdnsMessage(packet) });
      });
      const families = (['ipv4', 'ipv6'] as const).filter((family) => advertiser.sockets[family]);
      const ready = Promise.all(families.map(async (family) => new Promise((resolve) => advertiser.sockets[family]?.once('ready', resolve))));
      // Pin the random 0-250 ms first probe delay (RFC 6762 §8.1) to 125 ms: a delay of 0 or 250 would put two probes
      // or none in the first 250 ms window the tests advance. No other random value is drawn before probing starts.
      const random = spyOn(Math, 'random').mockReturnValueOnce(0.5);
      started = advertiser.start();
      try {
        await Promise.race([ready, started]);
      } catch (error) {
        random.mockRestore();
        const stopping = advertiser.stop();
        vi.advanceTimersByTime(200);
        await stopping;
        adv = undefined;
        if (options.mdnsPort !== undefined || attempt === 3 || !(error instanceof Error) || !('code' in error) || (error.code !== 'EADDRINUSE' && error.code !== 'EACCES')) {
          throw error;
        }
        continue;
      }
      await flushMicrotasks();
      ({ ipv4, ipv6 } = interfaceAddresses(advertiser.interfaceName));
      return advertiser;
    }
  }

  /**
   * Runs the probing to completion (3 probes and the final wait) and waits for start() to resolve.
   */
  async function completeProbing(): Promise<void> {
    vi.advanceTimersByTime(1000);
    await started;
  }

  /**
   * Starts an advertiser, completes probing and the announcement sequence, and clears the captured packets.
   *
   * @param {Partial<MdnsResponderOptions>} [options] - Extra options.
   * @returns {Promise<MdnsResponder>} The advertiser, announced.
   */
  async function announcedAdvertiser(options: Partial<MdnsResponderOptions> = {}): Promise<MdnsResponder> {
    const advertiser = await startAdvertiser(options);
    await completeProbing();
    vi.advanceTimersByTime(3000 + 1000); // Announcements at 0, 1 and 3 s, plus 1 s so the records can be multicast again
    sent.length = 0;
    return advertiser;
  }

  /**
   * Injects a packet into a socket of the advertiser.
   *
   * @param {MdnsResponderFamily} family - The socket.
   * @param {Buffer} packet - The packet.
   * @param {Partial<dgram.RemoteInfo>} [rinfo] - The sender, by default an on-link address on the mDNS port.
   */
  function inject(family: MdnsResponderFamily, packet: Buffer, rinfo: Partial<dgram.RemoteInfo> = {}): void {
    const address = family === 'ipv4' ? (ipv4[0] ?? '192.168.1.99') : 'fe80::1234';
    adv?.sockets[family]?.socket.emit('message', packet, { address, family: family === 'ipv4' ? 'IPv4' : 'IPv6', port, size: packet.length, ...rinfo });
  }

  /**
   * Returns the captured packets of a family.
   *
   * @param {MdnsResponderFamily} family - The family.
   * @returns {Sent[]} The packets.
   */
  function sentOn(family: MdnsResponderFamily): Sent[] {
    return sent.filter((packet) => packet.family === family);
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (adv) {
      const stopping = adv.stop();
      vi.advanceTimersByTime(200);
      await stopping;
      adv = undefined;
    }
    started = undefined;
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    codec.socket.close();
    vi.restoreAllMocks();
    resetTest();
  });

  describe('construction', () => {
    it('should leave generic advertisements free of Matterbridge defaults', () => {
      const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => !info.internal))?.[0];
      if (!interfaceName) throw new Error('No external interface for the responder test');
      const responder = new MdnsResponder({ port: 1234, hostName: 'example-host', instanceName: 'Example', services: ['_example._udp'], interfaceName });
      try {
        const records = responder['buildRecords']();
        expect(responder.hostName).toBe('example-host.local');
        expect(responder.instanceName).toBe('Example');
        expect(records.some((record) => record.name.includes('matterbridge'))).toBe(false);
        expect(records.find((record) => record.type === DnsRecordType.TXT)?.rdata).toEqual(Buffer.from([0]));
        expect(records.find((record) => record.type === DnsRecordType.SRV)?.rdata.readUInt16BE(4)).toBe(1234);
        expect(records.filter((record) => record.type === DnsRecordType.PTR).map((record) => record.name)).toEqual(['_example._udp.local', '_services._dns-sd._udp.local']);
      } finally {
        responder.sockets.ipv4?.socket.close();
        responder.sockets.ipv6?.socket.close();
      }
    });

    it('should throw when an option is invalid', () => {
      expect(() => new MdnsResponder({ ...defaults, interfaceName: 'no-such-interface' })).toThrow('network interface no-such-interface not available');
      expect(() => new MdnsResponder({ ...defaults, hostName: 'bad_name' })).toThrow('invalid host name');
      expect(() => new MdnsResponder({ ...defaults, alias: '-bad' })).toThrow('invalid alias');
      expect(() => new MdnsResponder({ ...defaults, instanceName: 'a\u0000b' })).toThrow('invalid instance name');
      expect(() => new MdnsResponder({ ...defaults, instanceName: 'x'.repeat(64) })).toThrow('invalid instance name');
      expect(() => new MdnsResponder({ ...defaults, services: [] })).toThrow('at least one service is required');
      expect(() => new MdnsResponder({ ...defaults, services: ['_http.tcp'] })).toThrow('invalid service');
      expect(() => new MdnsResponder({ ...defaults, port: 0 })).toThrow('invalid port');
      expect(() => new MdnsResponder({ ...defaults, txt: ['x'.repeat(256)] })).toThrow('TXT entry too long');
      expect(() => new MdnsResponder({ ...defaults, enableIpv4: false, enableIpv6: false })).toThrow('at least one of IPv4 and IPv6 must be enabled');
      for (const announceCount of [1, 9, 2.5]) {
        expect(() => new MdnsResponder({ ...defaults, announceCount })).toThrow('announceCount must be an integer from 2 to 8');
      }
    });
  });

  describe('RFC regressions', () => {
    it('should validate DNS-SD labels and TXT keys without imposing Matter naming rules', () => {
      for (const instanceName of ['a\u0000b', 'a\u007fb']) {
        expect(() => new MdnsResponder({ ...defaults, instanceName })).toThrow('invalid instance');
      }
      for (const service of ['_123._tcp', '_a--b._tcp', '_-a._tcp', '_a-._tcp']) {
        expect(() => new MdnsResponder({ ...defaults, services: [service] })).toThrow('invalid service');
      }
      for (const txt of [['=value'], ['é=value'], ['KEY=1', 'key=2']]) {
        expect(() => new MdnsResponder({ ...defaults, txt })).toThrow('TXT key');
      }
      expect(() => new MdnsResponder({ ...defaults, txt: Array.from({ length: 10 }, (_, i) => `k${i}=${'x'.repeat(240)}`) })).toThrow('packet limit');
    });

    it('should preserve dots and backslashes in instance labels and allow unprefixed subtypes', async () => {
      const advertiser = await announcedAdvertiser({ instanceName: 'Office.Printer\\One', subtypes: ['colour'] });
      inject('ipv4', buildPacket({ questions: [{ name: 'colour._sub._example._tcp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(120);
      const target = sent[0].message.answers?.[0].data;
      expect(target).toBe('Office\\.Printer\\\\One._example._tcp.local');
      expect(advertiser.instanceName).toBe('Office.Printer\\One');
    });

    it('should fold ASCII names but distinguish non-ASCII case', async () => {
      await announcedAdvertiser({ instanceName: 'Écho' });
      inject('ipv4', buildPacket({ questions: [{ name: 'écho._example._tcp.local', type: DnsRecordType.TXT }] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(0);
      inject('ipv4', buildPacket({ questions: [{ name: 'ÉCHO._EXAMPLE._TCP.LOCAL', type: DnsRecordType.TXT }] }));
      expect(sent).toHaveLength(1);
    });

    it('should suppress known PTR answers with ASCII case changes in the target', async () => {
      const advertiser = await announcedAdvertiser();
      const name = '_example._tcp.local';
      const target = `${advertiser.instanceName}._example._tcp.local`.toUpperCase();
      inject('ipv4', buildPacket({ questions: [{ name, type: DnsRecordType.PTR }], answers: [{ name, type: DnsRecordType.PTR, ttl: 4500, rdata: codec.encodeDnsName(target) }] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(0);
    });

    it('should correct TTL with the complete address RRSet', async () => {
      const advertiser = await announcedAdvertiser();
      advertiser['ipv4Addresses'] = ['192.0.2.1', '192.0.2.2'];
      const answer = { name: advertiser.hostName, type: DnsRecordType.A, ttl: 1, rdata: codec.encodeA('192.0.2.1') };
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [answer] }));
      vi.advanceTimersByTime(120);
      expect(sent[0].message.answers?.filter((record) => record.type === DnsRecordType.A).map((record) => record.data)).toEqual(['192.0.2.1', '192.0.2.2']);
    });

    it('should delay multicast probe defense to the 250 ms boundary instead of dropping it', async () => {
      const advertiser = await announcedAdvertiser();
      const question = { name: advertiser.hostName, type: DnsRecordType.ANY };
      inject('ipv4', buildPacket({ questions: [question] }));
      expect(sent).toHaveLength(1);
      sent.length = 0;
      inject('ipv4', buildPacket({ questions: [question], authorities: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: codec.encodeA('192.0.2.200') }] }));
      vi.advanceTimersByTime(249);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(sent).toHaveLength(1);
    });

    it('should omit recently multicast optional RRSets without delaying a PTR answer', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] }));
      sent.length = 0;
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers?.[0].type).toBe(DnsRecordType.PTR);
      expect(sent[0].message.additionals?.some((record) => record.name === advertiser.hostName)).toBe(false);
      vi.advanceTimersByTime(3000);
      expect(sent).toHaveLength(1);
    });

    it('should keep ready additionals for a rate-limited answer', async () => {
      const advertiser = await announcedAdvertiser();
      const answers = advertiser.activeRecords().filter((record) => record.type === DnsRecordType.SRV);
      const additionals = advertiser.activeRecords().filter((record) => record.type === DnsRecordType.TXT);
      advertiser['sendMulticast']('ipv4', answers, []);
      sent.length = 0;
      advertiser['sendMulticast']('ipv4', answers, additionals);
      expect(sent).toHaveLength(0);
      expect(advertiser['pendingMulticast'].ipv4.size).toBe(answers.length + additionals.length);
      vi.advanceTimersByTime(1000);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers).toHaveLength(answers.length);
      expect(sent[0].message.additionals).toHaveLength(additionals.length);
      expect(advertiser['pendingMulticast'].ipv4.size).toBe(0);
    });

    it('should merge repeated rate-limited sends and leave no trailing retransmissions', async () => {
      const advertiser = await announcedAdvertiser();
      const answers = advertiser.activeRecords().filter((record) => record.type === DnsRecordType.SRV);
      advertiser['sendMulticast']('ipv4', answers, []);
      sent.length = 0;
      for (let index = 0; index < 3; index++) advertiser['sendMulticast']('ipv4', answers, []);
      expect(advertiser['pendingMulticast'].ipv4.size).toBe(answers.length);
      vi.advanceTimersByTime(999);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers).toHaveLength(answers.length);
      vi.advanceTimersByTime(3000);
      expect(sent).toHaveLength(1);
      expect(advertiser['pendingMulticast'].ipv4.size).toBe(0);
      expect(advertiser['multicastTimers'].ipv4).toBeUndefined();
    });

    it('should suppress an entire unique RRSet when any sibling was multicast recently', async () => {
      const advertiser = await announcedAdvertiser();
      advertiser['ipv4Addresses'] = ['192.0.2.1', '192.0.2.2'];
      const first = advertiser.activeRecords().find((record) => record.type === DnsRecordType.A && record.name === advertiser.hostName);
      if (!first) throw new Error('Missing host address');
      advertiser['lastMulticast'].ipv4.set(`${first.name.toLowerCase()}|${first.type}|${first.rdata.toString('hex')}`, Date.now());
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.A }] }));
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1000);
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.A }] }));
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers?.map((record) => record.data)).toEqual(['192.0.2.1', '192.0.2.2']);
    });

    it.each([false, true])('should retain a conflict-resolved host until the provider identity changes (custom resolver: %s)', async (custom) => {
      let provider = 'example-host';
      const advertiser = await startAdvertiser({ hostNameProvider: () => provider, resolveConflict: custom ? (): string => 'resolved-host' : undefined });
      vi.advanceTimersByTime(250);
      const name = advertiser.hostName;
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name, type: DnsRecordType.A, ttl: 120, rdata: codec.encodeA('203.0.113.200') }] }));
      await completeProbing();
      vi.advanceTimersByTime(4000);
      const resolved = advertiser.hostName;
      expect(resolved).toBe(custom ? 'resolved-host.local' : 'example-host-2.local');
      sent.length = 0;
      advertiser['checkAddresses']();
      advertiser['checkAddresses']();
      expect(advertiser.hostName).toBe(resolved);
      expect(sent).toHaveLength(0);
      provider = 'rotated-host';
      advertiser['checkAddresses']();
      expect(advertiser.hostName).toBe('rotated-host.local');
      expect(advertiser.activeRecords()).toEqual([]);
      expect(sent[0].message.answers?.every((record) => record.ttl === 0)).toBe(true);
      vi.advanceTimersByTime(1000);
      expect(advertiser.activeRecords().some((record) => record.name === 'rotated-host.local')).toBe(true);
      const conflict = buildPacket({
        flags: DnsHeaderFlag.QR,
        answers: [{ name: 'rotated-host.local', type: DnsRecordType.A, ttl: 120, rdata: codec.encodeA('203.0.113.200') }],
      });
      inject('ipv4', conflict); // Owned-name conflict returns the claim to probing (RFC 6762 §9).
      vi.advanceTimersByTime(250);
      inject('ipv4', conflict); // The existing owner defends, so choose a replacement.
      expect(advertiser.hostName).toBe(custom ? 'resolved-host.local' : 'rotated-host-2.local');
      advertiser['checkAddresses']();
      expect(advertiser.hostName).toBe(custom ? 'resolved-host.local' : 'rotated-host-2.local');
    });

    it('should clear the merged multicast queue on stop', async () => {
      const advertiser = await announcedAdvertiser();
      const answers = advertiser.activeRecords().filter((record) => record.type === DnsRecordType.SRV);
      advertiser['sendMulticast']('ipv4', answers, []);
      advertiser['sendMulticast']('ipv4', answers, []);
      const stopping = advertiser.stop();
      vi.advanceTimersByTime(100);
      await stopping;
      sent.length = 0;
      vi.advanceTimersByTime(5000);
      expect(sent).toHaveLength(0);
      expect(advertiser['pendingMulticast'].ipv4.size).toBe(0);
      expect(advertiser['multicastTimers'].ipv4).toBeUndefined();
    });

    it('should use destination metadata for direct unicast and preserve multicast across overlaid subnets', async () => {
      const advertiser = await announcedAdvertiser({ restrictInterfacePackets: true });
      const question = buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] });
      const remote: dgram.RemoteInfo = { address: ipv4[0], family: 'IPv4', port, size: question.length };
      advertiser.handlePacket('ipv4', question, remote, { destinationAddress: ipv4[0], interfaceName: advertiser.interfaceName });
      expect(sent[0].address).toBe(ipv4[0]);
      sent.length = 0;
      advertiser.handlePacket('ipv4', question, { ...remote, address: '203.0.113.100' }, { destinationAddress: ipv4[0] });
      expect(sent).toHaveLength(0);
      advertiser.handlePacket('ipv4', question, { ...remote, address: '203.0.113.100' }, { destinationAddress: '224.0.0.251' });
      expect(sent[0].address).toBe('224.0.0.251');
      sent.length = 0;
      advertiser.handlePacket('ipv4', question, remote, { interfaceName: 'another-interface' });
      expect(sent).toHaveLength(0);
    });

    it('should reject a packet carrying an IPv6 zone from another interface', async () => {
      const advertiser = await announcedAdvertiser({ restrictInterfacePackets: true });
      const query = buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] });
      inject('ipv6', query, { address: 'fe80::1234%unrelated-interface' });
      expect(sent).toHaveLength(0);
      inject('ipv6', query, { address: `fe80::1234%${advertiser.interfaceName}` });
      // The multicast answer and the unicast copy to the on-link querier
      expect(sent).toHaveLength(2);
      expect(sent.filter((packet) => packet.address === 'ff02::fb')).toHaveLength(1);
    });

    it('should preserve owned records when the host name provider returns an invalid label', async () => {
      const advertiser = await announcedAdvertiser({ hostNameProvider: () => '-invalid' });
      const before = advertiser.activeRecords();
      const error = spyOn(advertiser.log, 'error');
      advertiser['checkAddresses']();
      expect(advertiser.hostName).toBe('example-host.local');
      expect(advertiser.activeRecords()).toEqual(before);
      expect(sent).toHaveLength(0);
      expect(error).toHaveBeenCalledWith('Ignoring invalid host name from hostNameProvider');
      error.mockRestore();
    });

    it('should restart probing with current addresses when addresses change during a probe cycle', async () => {
      const advertiser = await startAdvertiser();
      vi.advanceTimersByTime(250);
      advertiser['ipv4Addresses'] = ['203.0.113.200'];
      sent.length = 0;
      advertiser['checkAddresses']();
      expect(advertiser.activeRecords()).toEqual([]);
      await completeProbing();
      const probes = sentOn('ipv4').filter((packet) => packet.message.qr === 0);
      expect(probes).toHaveLength(3);
      const addresses = probes[0].message.authorities?.filter((record) => record.type === DnsRecordType.A && record.name === advertiser.hostName);
      expect(addresses?.map((record) => record.data)).toEqual(ipv4);
      expect(advertiser.activeRecords().length).toBeGreaterThan(0);
    });

    it('should probe and announce the host name supplied by a custom conflict resolver', async () => {
      const resolveConflict = vi.fn(() => 'replacement-host');
      const advertiser = await startAdvertiser({ resolveConflict });
      const oldName = advertiser.hostName;
      vi.advanceTimersByTime(250);
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: oldName, type: DnsRecordType.A, ttl: 120, rdata: codec.encodeA('203.0.113.200') }] }));
      expect(resolveConflict).toHaveBeenCalledWith('host', 'example-host');
      expect(advertiser.hostName).toBe('replacement-host.local');
      sent.length = 0;
      await completeProbing();
      expect(sentOn('ipv4')[0].message.questions?.some((question) => question.name === 'replacement-host.local')).toBe(true);
      const service = advertiser.activeRecords().find((record) => record.type === DnsRecordType.SRV);
      expect(service?.target).toBe('replacement-host.local');
    });

    it('should not rename or probe the instance after a host conflict without a replacement stopped the responder', async () => {
      const advertiser = await startAdvertiser({ resolveConflict: (kind) => (kind === 'instance' ? 'Renamed' : undefined) });
      const error = vi.fn();
      const nameChanged = vi.fn();
      advertiser.on('error', error);
      advertiser.on('nameChanged', nameChanged);
      const closed = Promise.all(Object.values(advertiser.sockets).map(async (socket) => new Promise<void>((resolve) => socket.once('close', resolve))));
      vi.advanceTimersByTime(250);
      inject(
        'ipv4',
        buildPacket({
          flags: DnsHeaderFlag.QR,
          answers: [
            { name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: codec.encodeA('203.0.113.200') },
            { name: 'Example._example._tcp.local', type: DnsRecordType.SRV, ttl: 120, rdata: codec.encodeSrvRdata(0, 0, 9999, 'other.local') },
          ],
        }),
      );
      expect(error).toHaveBeenCalledTimes(1);
      expect(nameChanged).not.toHaveBeenCalled();
      expect(advertiser['instanceLabel']).toBe('Example');
      expect(advertiser['probeTimer']).toBeUndefined();
      vi.advanceTimersByTime(100);
      await closed;
      await started;
      adv = undefined;
    });

    it('should log and stop on an invalid conflict replacement when no error listener is registered', async () => {
      const advertiser = await startAdvertiser({ resolveConflict: () => '-invalid' });
      const error = spyOn(advertiser.log, 'error');
      const closed = Promise.all(Object.values(advertiser.sockets).map(async (socket) => new Promise<void>((resolve) => socket.once('close', resolve))));
      vi.advanceTimersByTime(250);
      const name = advertiser.hostName;
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name, type: DnsRecordType.A, ttl: 120, rdata: codec.encodeA('203.0.113.200') }] }));
      expect(error).toHaveBeenCalledWith('MdnsResponder: conflicting host example-host');
      expect(advertiser.hostName).toBe(name);
      vi.advanceTimersByTime(100);
      await closed;
      await started;
      adv = undefined;
      expect(advertiser.activeRecords()).toEqual([]);
      error.mockRestore();
    });

    it('should truncate an oversized legacy answer into one response with the query ID and TC flag', async () => {
      const txt = Array.from({ length: 3 }, (_, index) => `k${index}=${'x'.repeat(200)}`);
      const advertiser = await announcedAdvertiser({ txt });
      const name = `${advertiser.instanceName}._example._tcp.local`;
      inject('ipv4', buildPacket({ id: 123, questions: [{ name, type: DnsRecordType.TXT }] }), { port: 12345 });
      expect(sent).toHaveLength(1);
      expect(sent[0].packet.length).toBeLessThanOrEqual(512);
      expect(sent[0].message.id).toBe(123);
      expect(sent[0].message.tc).toBe(true);
      expect(sent[0].message.questions?.[0].name).toBe(name);
      expect(sent[0].message.answers).toEqual([]);
      expect(sent[0].port).toBe(12345);
    });

    it('should not compress the SRV target in a legacy response', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ id: 42, questions: [{ name: `${advertiser.instanceName}._example._tcp.local`, type: DnsRecordType.SRV }] }), { port: 12345 });
      const packet = sent[0].packet;
      const questionEnd = codec.decodeDnsName(packet, 12).newOffset + 4;
      const ownerEnd = codec.decodeDnsName(packet, questionEnd).newOffset;
      const targetStart = ownerEnd + 10 + 6;
      const target = codec.encodeDnsName(advertiser.hostName);
      expect(packet.subarray(targetStart, targetStart + target.length)).toEqual(target);
    });
  });

  describe('probing', () => {
    it('should send 3 probes 250 ms apart with ANY QU questions and the proposed records in the authority section', async () => {
      const advertiser = await startAdvertiser();
      vi.advanceTimersByTime(250);
      expect(sentOn('ipv4')).toHaveLength(1);
      expect(sentOn('ipv6')).toHaveLength(1);
      vi.advanceTimersByTime(250);
      expect(sentOn('ipv4')).toHaveLength(2);
      vi.advanceTimersByTime(250);
      expect(sentOn('ipv4')).toHaveLength(3);
      for (const probe of sent) {
        expect(probe.port).toBe(port);
        expect(probe.address).toBe(probe.family === 'ipv4' ? '224.0.0.251' : 'ff02::fb');
        expect(probe.message.qr).toBe(0);
        expect(probe.message.questions?.map((question) => question.name)).toEqual([
          advertiser.hostName,
          `${advertiser.instanceName}._example._tcp.local`,
          `${advertiser.instanceName}._http._tcp.local`,
          'example.local',
        ]);
        for (const question of probe.message.questions ?? []) {
          expect(question.type).toBe(DnsRecordType.ANY);
          expect(advertiser.sockets.ipv4?.dnsQuestionClassToString(question.class, question.unicastResponse)).toBe('IN|QU');
        }
        const authorities = probe.message.authorities ?? [];
        expect(authorities.filter((record) => record.type === DnsRecordType.A)).toHaveLength(2 * ipv4.length); // host and alias
        expect(authorities.filter((record) => record.type === DnsRecordType.AAAA)).toHaveLength(2 * ipv6.length);
        expect(authorities.filter((record) => record.type === DnsRecordType.SRV)).toHaveLength(2);
        expect(authorities.filter((record) => record.type === DnsRecordType.TXT)).toHaveLength(2);
        expect(authorities.some((record) => record.type === DnsRecordType.NSEC)).toBe(false);
        expect(authorities.some((record) => record.cacheFlush)).toBe(false);
      }
      await completeProbing();
    });

    it('should probe with QM questions when another responder is bound first to the port (RFC 6762 §15.1)', async () => {
      let blockedPort = 0;
      const blockers: dgram.Socket[] = [];
      try {
        for (const type of ['udp4', 'udp6'] as const) {
          const blocker = dgram.createSocket({ type, reuseAddr: true });
          blockers.push(blocker);
          const listening = once(blocker, 'listening');
          blocker.bind(blockedPort, type === 'udp4' ? '0.0.0.0' : '::');
          await listening;
          blockedPort = blocker.address().port;
        }
        const advertiser = await startAdvertiser({ mdnsPort: blockedPort });
        expect(port).toBe(blockedPort);
        vi.advanceTimersByTime(250);
        expect(sent).toHaveLength(2);
        for (const probe of sent) {
          for (const question of probe.message.questions ?? []) expect(advertiser.sockets.ipv4?.dnsQuestionClassToString(question.class, question.unicastResponse)).toBe('IN');
        }
        await completeProbing();
      } finally {
        await Promise.all(blockers.map(async (blocker) => new Promise<void>((resolve) => blocker.close(resolve))));
      }
    });

    it('should rename the host and probe again when a response conflicts with the host name', async () => {
      const advertiser = await startAdvertiser();
      const nameChanged = vi.fn();
      advertiser.on('nameChanged', nameChanged);
      const oldName = advertiser.hostName;
      vi.advanceTimersByTime(250);
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR + DnsHeaderFlag.AA, answers: [{ name: oldName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }] }));
      expect(nameChanged).toHaveBeenCalledWith('host', oldName, oldName.replace('.local', '-2.local'));
      expect(advertiser.hostName).toBe(oldName.replace('.local', '-2.local'));
      sent.length = 0;
      await completeProbing();
      expect(sentOn('ipv4')[0].message.questions?.[0].name).toBe(advertiser.hostName);
    });

    it('should rename the host when a response has a different NSEC record of the host name', async () => {
      const advertiser = await startAdvertiser();
      const nameChanged = vi.fn();
      advertiser.on('nameChanged', nameChanged);
      const oldName = advertiser.hostName;
      vi.advanceTimersByTime(250);
      const rdata = Buffer.concat([codec.encodeDnsName(oldName), Buffer.from([0, 1, 0x40])]); // Restricted form: next domain is the own name, block 0 with only A
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR + DnsHeaderFlag.AA, answers: [{ name: oldName, type: DnsRecordType.NSEC, ttl: 120, rdata }] }));
      expect(nameChanged).toHaveBeenCalledWith('host', oldName, oldName.replace('.local', '-2.local'));
      await completeProbing();
    });

    it('should rename the instance with a counter when a response conflicts with an instance name', async () => {
      const advertiser = await startAdvertiser({ instanceName: 'Bridge' });
      const nameChanged = vi.fn();
      advertiser.on('nameChanged', nameChanged);
      vi.advanceTimersByTime(250);
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: 'Bridge._http._tcp.local', type: DnsRecordType.TXT, ttl: 4500, rdata: Buffer.from([0]) }] }));
      expect(nameChanged).toHaveBeenCalledWith('instance', 'Bridge', 'Bridge (2)');
      await completeProbing();
      expect(advertiser.instanceName).toBe('Bridge (2)');
    });

    it('should give up the alias without renaming when a response conflicts with it', async () => {
      const advertiser = await startAdvertiser();
      const aliasLost = vi.fn();
      advertiser.on('aliasLost', aliasLost);
      const hostName = advertiser.hostName;
      vi.advanceTimersByTime(250);
      inject('ipv6', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: 'Example.local', type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }] }));
      expect(aliasLost).toHaveBeenCalledWith('example');
      await completeProbing();
      expect(advertiser.hostName).toBe(hostName);
      expect(advertiser.aliasName).toBeUndefined();
      expect(
        sentOn('ipv4')
          .at(-1)
          ?.message.answers?.some((record) => record.name === 'example.local'),
      ).toBe(false);
    });

    it('should not see a conflict in a response with records identical to the proposed ones', async () => {
      const advertiser = await startAdvertiser({ alias: false });
      const nameChanged = vi.fn();
      advertiser.on('nameChanged', nameChanged);
      vi.advanceTimersByTime(250);
      const [ownAddress] = ipv4.length > 0 ? [codec.encodeA(ipv4[0])] : [codec.encodeAAAA(ipv6[0])];
      inject(
        'ipv4',
        buildPacket({
          flags: DnsHeaderFlag.QR,
          answers: [{ name: advertiser.hostName, type: ipv4.length > 0 ? DnsRecordType.A : DnsRecordType.AAAA, ttl: 120, rdata: ownAddress }],
        }),
      );
      await completeProbing();
      expect(nameChanged).not.toHaveBeenCalled();
    });

    it('should ignore conflicting responses received before the first probe and from a port other than the mDNS port', async () => {
      const advertiser = await startAdvertiser();
      const nameChanged = vi.fn();
      advertiser.on('nameChanged', nameChanged);
      const conflicting = buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }] });
      inject('ipv4', conflicting); // Before the first probe (RFC 6762 §8.1)
      vi.advanceTimersByTime(250);
      inject('ipv4', conflicting, { port: 12345 }); // Not from the mDNS port (RFC 6762 §6)
      await completeProbing();
      expect(nameChanged).not.toHaveBeenCalled();
    });

    it('should wait one second and probe again when a simultaneous probe wins the tiebreak', async () => {
      const advertiser = await startAdvertiser({ alias: false });
      vi.advanceTimersByTime(250);
      const probe = buildPacket({
        questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY, qu: true }],
        authorities: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([255, 255, 255, 255]) }],
      });
      inject('ipv4', probe);
      sent.length = 0;
      vi.advanceTimersByTime(999);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(sentOn('ipv4')).toHaveLength(1);
      await completeProbing();
    });

    it('should keep probing when it wins the tiebreak or the simultaneous probe is identical', async () => {
      const advertiser = await startAdvertiser({ alias: false });
      vi.advanceTimersByTime(250);
      const losing = buildPacket({
        questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY, qu: true }],
        authorities: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([0, 0, 0, 0]) }],
      });
      inject('ipv4', losing);
      inject('ipv4', sentOn('ipv4')[0].packet); // Our own probe echoed back
      vi.advanceTimersByTime(500);
      expect(sentOn('ipv4')).toHaveLength(3);
      await completeProbing();
    });

    it('should wait 5 seconds before probing again after 15 conflicts in 10 seconds', async () => {
      const advertiser = await startAdvertiser({ alias: false });
      for (let i = 0; i < 15; i++) {
        vi.advanceTimersByTime(250);
        inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }] }));
      }
      sent.length = 0;
      vi.advanceTimersByTime(4999);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1);
      expect(sentOn('ipv4')).toHaveLength(1);
      await completeProbing();
    });

    it('should log an error after one minute of failed probing (RFC 6762 §9)', async () => {
      const advertiser = await startAdvertiser({ alias: false });
      // Conflicts on every probe cycle for more than one minute (throttled to one every 5 s after 15 in 10 s)
      const start = Date.now();
      while (Date.now() - start < 61000) {
        const before = sent.length;
        while (sent.length === before) vi.advanceTimersByTime(50); // Until the next probe is sent
        inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }] }));
      }
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Unable to find an unused name after one minute of probing');
      expect(loggerLogSpy.mock.calls.filter((call) => call[0] === LogLevel.ERROR)).toHaveLength(1);
      vi.advanceTimersByTime(5000); // The last probe can still be throttled to 5 s after the conflict (RFC 6762 §8.1)
      await completeProbing();
    });
  });

  describe('announcing', () => {
    it('should announce all the records 3 times at 0, 1 and 3 seconds and then stop announcing', async () => {
      const advertiser = await startAdvertiser();
      const announced = vi.fn();
      advertiser.on('announced', announced);
      await completeProbing();
      expect(announced).toHaveBeenCalledTimes(1);
      expect(advertiser.aliasName).toBe('example.local');
      const announcements = (): Sent[] => sentOn('ipv4').filter((packet) => packet.message.qr === 1);
      expect(announcements()).toHaveLength(1);
      vi.advanceTimersByTime(1000);
      expect(announcements()).toHaveLength(2);
      vi.advanceTimersByTime(2000);
      expect(announcements()).toHaveLength(3);
      vi.advanceTimersByTime(60000);
      expect(announcements()).toHaveLength(3); // RFC 6762 §8.3: no periodic announcements

      for (const family of ['ipv4', 'ipv6'] as const) {
        const announcement = sentOn(family).find((packet) => packet.message.qr === 1)?.message;
        if (!announcement) throw new Error('No announcement');
        expect(announcement.aa).toBe(true);
        const answers = announcement.answers ?? [];
        // Both address families on both sockets (RFC 6762 §6.2)
        expect(answers.filter((record) => record.name === advertiser.hostName && record.type === DnsRecordType.A)).toHaveLength(ipv4.length);
        expect(answers.filter((record) => record.name === advertiser.hostName && record.type === DnsRecordType.AAAA)).toHaveLength(ipv6.length);
        expect(answers.filter((record) => record.name === 'example.local')).toHaveLength(ipv4.length + ipv6.length);
        const ptr = answers.find((record) => record.name === '_example._tcp.local');
        expect(ptr?.data).toBe(`${advertiser.instanceName}._example._tcp.local`);
        expect(ptr?.ttl).toBe(MDNS_OTHER_RECORD_TTL);
        expect(ptr?.cacheFlush).toBe(false); // Shared record
        expect(answers.filter((record) => record.name === '_services._dns-sd._udp.local').map((record) => record.data)).toEqual(['_example._tcp.local', '_http._tcp.local']);
        const srv = answers.find((record) => record.type === DnsRecordType.SRV);
        expect(srv?.data).toEqual({ priority: 0, weight: 0, port: 1234, target: advertiser.hostName });
        expect(srv?.ttl).toBe(MDNS_HOST_RECORD_TTL);
        expect(srv?.cacheFlush).toBe(true); // Unique record
        expect(answers.find((record) => record.type === DnsRecordType.TXT)?.data).toEqual(['txtvers=1', 'path=/']);
        expect(answers.some((record) => record.type === DnsRecordType.NSEC)).toBe(false);
        const nsec = (announcement.additionals ?? []).filter((record) => record.type === DnsRecordType.NSEC);
        expect(nsec.map((record) => record.name)).toEqual([
          advertiser.hostName,
          'example.local',
          `${advertiser.instanceName}._example._tcp.local`,
          `${advertiser.instanceName}._http._tcp.local`,
        ]);
        expect(nsec[2].data).toEqual({ nextDomain: `${advertiser.instanceName}._example._tcp.local`, types: ['TXT', 'SRV'] });
      }
    });

    it('should announce 8 times by default, doubling the interval (RFC 6762 §8.3)', async () => {
      expect(MDNS_ANNOUNCE_DEFAULT_COUNT).toBe(8);
      await startAdvertiser({ announceCount: undefined });
      await completeProbing();
      const announcements = (): Sent[] => sentOn('ipv4').filter((packet) => packet.message.qr === 1);
      expect(announcements()).toHaveLength(1);
      // The announcements follow at 1, 3, 7, 15, 31, 63 and 127 seconds.
      for (const [index, interval] of [1000, 2000, 4000, 8000, 16000, 32000, 64000].entries()) {
        vi.advanceTimersByTime(interval);
        expect(announcements()).toHaveLength(index + 2);
      }
      vi.advanceTimersByTime(300000);
      expect(announcements()).toHaveLength(8);
    });

    it('should re-announce with the new port and TXT after an update', async () => {
      const advertiser = await announcedAdvertiser();
      advertiser.update({ port: 9000, txt: [] });
      const srv = sentOn('ipv4')[0].message.answers?.find((record) => record.type === DnsRecordType.SRV);
      expect(srv?.type === DnsRecordType.SRV ? srv.data.port : undefined).toBe(9000);
      const txt = sentOn('ipv4')[0].message.answers?.find((record) => record.type === DnsRecordType.TXT);
      expect(txt?.data).toEqual(['']); // RFC 6763 §6.1: an empty TXT is a single zero byte
      expect(() => advertiser.update({ port: 70000 })).toThrow('invalid port');
      sent.length = 0;
      advertiser.update({ txt: ['version=1'] }); // The invalid port was not kept
      vi.advanceTimersByTime(1000); // Unchanged SRV records respect the one-second multicast limit.
      const srvAfter = sentOn('ipv4')
        .flatMap((packet) => packet.message.answers ?? [])
        .find((record) => record.type === DnsRecordType.SRV);
      expect(srvAfter?.type === DnsRecordType.SRV ? srvAfter.data.port : undefined).toBe(9000);
    });

    it('should reannounce without probing when only addresses change (RFC 6762 §8.4)', async () => {
      const advertiser = await announcedAdvertiser({ addressCheckIntervalMs: 10000 });
      vi.advanceTimersByTime(10000);
      expect(sent).toHaveLength(0); // Addresses unchanged
      advertiser['ipv4Addresses'] = ['10.9.8.7']; // As if the interface had this address before
      vi.advanceTimersByTime(10000); // The check runs, then the probing and the 3 announcements complete within this time
      expect(sentOn('ipv4').filter((packet) => packet.message.qr === 0)).toHaveLength(0); // Existing name ownership is retained
      const responses = sentOn('ipv4').filter((packet) => packet.message.qr === 1);
      expect(responses).toHaveLength(3); // Cache-flush announcements replace old addresses
      expect(responses[0].message.answers?.every((record) => record.ttl > 0)).toBe(true);
    });

    it('should probe again and rename when a conflicting record is received after announcing and the other host defends', async () => {
      const advertiser = await announcedAdvertiser({ alias: false });
      const nameChanged = vi.fn();
      advertiser.on('nameChanged', nameChanged);
      const conflicting = buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }] });
      inject('ipv4', conflicting);
      vi.advanceTimersByTime(250);
      expect(sentOn('ipv4')[0].message.qr).toBe(0); // Probing again
      inject('ipv4', conflicting); // The other host defends its name
      expect(nameChanged).toHaveBeenCalled();
    });
  });

  describe('answering', () => {
    it('should send a unicast copy of a QM answer to an on-link querier, even when the multicast answer is rate limited', async () => {
      const advertiser = await announcedAdvertiser();
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      const query = buildPacket({ questions: [{ name: instance, type: DnsRecordType.SRV }] });
      inject('ipv6', query);
      expect(sentOn('ipv6').map((packet) => packet.address.split('%')[0])).toEqual(['fe80::1234', 'ff02::fb']);
      expect(sentOn('ipv6')[0].port).toBe(port);
      expect(sentOn('ipv6')[0].message.answers?.map((record) => record.type)).toEqual([DnsRecordType.SRV]);
      sent.length = 0;
      // Within one second of the last multicast: the multicast answer is rate limited, the unicast copy is not
      inject('ipv6', query);
      vi.advanceTimersByTime(1000);
      expect(sentOn('ipv6').map((packet) => packet.address.split('%')[0])).toEqual(['fe80::1234']);
    });

    it('should log the number of a question type that has no name', async () => {
      const advertiser = await announcedAdvertiser();
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      // oxlint-disable-next-line typescript/no-unsafe-enum-assignment -- a type number missing from the enum
      const unnamed = 0xff00 as DnsRecordType;
      inject(
        'ipv4',
        buildPacket({
          questions: [
            { name: instance, type: DnsRecordType.SRV },
            { name: instance, type: unnamed },
          ],
        }),
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`${instance} 65280 QM`));
    });

    it('should not send a unicast copy to a query from this host', async () => {
      const advertiser = await announcedAdvertiser();
      const own = ipv6.find((address) => address.startsWith('fe80'));
      if (!own) return;
      inject('ipv6', buildPacket({ questions: [{ name: `${advertiser.instanceName}._example._tcp.local`, type: DnsRecordType.SRV }] }), { address: own });
      expect(sentOn('ipv6').map((packet) => packet.address)).toEqual(['ff02::fb']);
    });

    it('should answer by unicast, when probing succeeds, a query received while probing (RFC 6762 §8.1)', async () => {
      const advertiser = await startAdvertiser();
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      inject('ipv6', buildPacket({ questions: [{ name: instance, type: DnsRecordType.SRV, qu: true }] }));
      expect(sent.filter((packet) => packet.message.qr === 1)).toHaveLength(0);
      await completeProbing();
      const unicast = sentOn('ipv6').filter((packet) => packet.address.split('%')[0] === 'fe80::1234');
      expect(unicast).toHaveLength(1);
      expect(unicast[0].message.answers?.map((record) => record.name)).toEqual([instance]);
    });

    it('should not queue a query for records that are already announced', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv6', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      inject('ipv6', buildPacket({ questions: [{ name: `${advertiser.instanceName}._example._tcp.local`, type: DnsRecordType.SRV }] }));
      expect(advertiser['probingQueries']).toHaveLength(0);
    });

    it('should keep at most 16 queries received while probing and forget them on stop', async () => {
      const advertiser = await startAdvertiser();
      const query = buildPacket({ questions: [{ name: `${advertiser.instanceName}._example._tcp.local`, type: DnsRecordType.SRV, qu: true }] });
      for (let i = 0; i < 20; i++) inject('ipv6', query, { address: `fe80::${i + 1}` });
      expect(advertiser['probingQueries']).toHaveLength(16);
      await completeProbing();
      expect(advertiser['probingQueries']).toHaveLength(0);
      expect(sentOn('ipv6').filter((packet) => packet.address.startsWith('fe80::') && packet.message.qr === 1)).toHaveLength(16);
      await startAdvertiser();
      inject('ipv6', query);
      expect(adv?.['probingQueries']).toHaveLength(1);
      const stopping = adv?.stop();
      vi.advanceTimersByTime(1000);
      await stopping;
      expect(adv?.['probingQueries']).toHaveLength(0);
    });

    it('should answer a PTR query after a random 20-120 ms delay with the SRV, TXT, addresses and NSEC as additionals', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(19);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(101);
      expect(sent).toHaveLength(1);
      const response = sent[0];
      expect(response.address).toBe('224.0.0.251');
      expect(response.message.answers?.map((record) => record.data)).toEqual([`${advertiser.instanceName}._example._tcp.local`]);
      const additionals = response.message.additionals ?? [];
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      expect(additionals.filter((record) => record.name === instance).map((record) => record.type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT, DnsRecordType.NSEC]);
      expect(additionals.filter((record) => record.name === advertiser.hostName).map((record) => record.type)).toEqual([
        ...ipv4.map(() => DnsRecordType.A),
        ...ipv6.map(() => DnsRecordType.AAAA),
        DnsRecordType.NSEC,
      ]);
    });

    it('should answer an address query at once, with the other address family as additionals (RFC 6762 §6.2)', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv6', buildPacket({ questions: [{ name: advertiser.hostName.toUpperCase(), type: DnsRecordType.A }] }));
      // The multicast answer and the unicast copy to the on-link querier
      expect(sentOn('ipv6')).toHaveLength(2);
      const response = sentOn('ipv6').find((packet) => packet.address === 'ff02::fb')?.message;
      expect(response?.answers?.map((record) => record.data)).toEqual(ipv4);
      expect(response?.additionals?.filter((record) => record.type === DnsRecordType.AAAA)).toHaveLength(ipv6.length);
      expect(response?.additionals?.at(-1)?.type).toBe(DnsRecordType.NSEC);
    });

    it('should answer a query for a type that does not exist on an owned name with an NSEC record (RFC 6762 §6.1)', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.TXT }] }));
      const answer = sentOn('ipv4')[0].message.answers?.[0];
      expect(answer?.type).toBe(DnsRecordType.NSEC);
      expect(answer?.type === DnsRecordType.NSEC ? answer.data.types : undefined).toEqual([...(ipv4.length > 0 ? ['A'] : []), ...(ipv6.length > 0 ? ['AAAA'] : [])]);
    });

    it('should answer ANY with all the records of the name except NSEC (RFC 6762 §6.5)', async () => {
      const advertiser = await announcedAdvertiser();
      const instance = `${advertiser.instanceName}._http._tcp.local`;
      inject('ipv4', buildPacket({ questions: [{ name: instance, type: DnsRecordType.ANY }] }));
      const response = sentOn('ipv4')[0].message;
      expect(response.answers?.map((record) => record.type)).toEqual([DnsRecordType.SRV, DnsRecordType.TXT]);
      expect(response.additionals?.some((record) => record.name === instance && record.type === DnsRecordType.NSEC)).toBe(true);
    });

    it('should answer the service enumeration query', async () => {
      await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: '_services._dns-sd._udp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(120);
      expect(sentOn('ipv4')[0].message.answers?.map((record) => record.data)).toEqual(['_example._tcp.local', '_http._tcp.local']);
      expect(sentOn('ipv4')[0].message.additionals).toEqual([]);
    });

    it('should not answer questions for other names, other classes, or messages with a non-zero OPCODE or RCODE', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: 'other.local', type: DnsRecordType.A }] }));
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.A, qclass: DnsClass.CH }] }));
      inject('ipv4', buildPacket({ flags: 0x0800, questions: [{ name: advertiser.hostName, type: DnsRecordType.A }] })); // OPCODE 1
      inject('ipv4', buildPacket({ flags: 0x0001, questions: [{ name: advertiser.hostName, type: DnsRecordType.A }] })); // RCODE 1
      inject('ipv4', Buffer.from([0, 0, 0])); // Malformed
      vi.advanceTimersByTime(1000);
      expect(sent).toHaveLength(0);
    });

    it('should suppress the answers the querier lists as known with at least half the TTL (RFC 6762 §7.1)', async () => {
      const advertiser = await announcedAdvertiser();
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      const known = (ttl: number): Record => ({ name: '_example._tcp.local', type: DnsRecordType.PTR, ttl, rdata: codec.encodeDnsName(instance) });
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }], answers: [known(MDNS_OTHER_RECORD_TTL / 2)] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(0);
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }], answers: [known(MDNS_OTHER_RECORD_TTL / 2 - 1)] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(1);
    });

    it('should wait for the Known-Answer packets of a truncated query and answer 400-500 ms after the last TC-set packet (RFC 6762 §7.2)', async () => {
      const advertiser = await announcedAdvertiser();
      const http = `${advertiser.instanceName}._http._tcp.local`;
      inject(
        'ipv4',
        buildPacket({
          flags: DnsHeaderFlag.TC,
          questions: [
            { name: '_example._tcp.local', type: DnsRecordType.PTR },
            { name: '_http._tcp.local', type: DnsRecordType.PTR },
          ],
        }),
      );
      vi.advanceTimersByTime(300);
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.TC, answers: [{ name: '_http._tcp.local', type: DnsRecordType.PTR, ttl: 4500, rdata: codec.encodeDnsName(http) }] })); // Continuation, TC set extends the deadline
      inject('ipv6', buildPacket({ answers: [] })); // A continuation without a pending query is ignored
      vi.advanceTimersByTime(399);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(101);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers?.map((record) => record.name)).toEqual(['_example._tcp.local']);
    });

    it('should answer a QU question by unicast when the record was multicast recently, and by multicast otherwise (RFC 6762 §5.4)', async () => {
      const advertiser = await announcedAdvertiser();
      const query = buildPacket({ questions: [{ name: advertiser.hostName, type: ipv4.length > 0 ? DnsRecordType.A : DnsRecordType.AAAA, qu: true }] });
      inject('ipv4', query);
      expect(sent).toHaveLength(1);
      expect(sent[0].address).toBe(ipv4[0] ?? '192.168.1.99'); // Multicast 4 s ago, within a quarter of the 120 s TTL
      vi.advanceTimersByTime(31000); // Now more than a quarter of the TTL
      inject('ipv4', query);
      expect(sent).toHaveLength(2);
      expect(sent[1].address).toBe('224.0.0.251');
    });

    it('should reply by multicast to a QU question from an off-link or malformed source address, and by unicast to an on-link IPv6 source (RFC 6762 §11)', async () => {
      const advertiser = await announcedAdvertiser();
      const query = buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.NSEC, qu: true }] });
      inject('ipv6', query, { address: '2001:db8::1' }); // Off link
      inject('ipv4', query, { address: '203.0.113.1' }); // Off link
      inject('ipv4', query, { address: 'not-an-address' });
      inject('ipv6', query, { address: 'not:an:address' });
      expect(sent.map((packet) => packet.address)).toEqual(['ff02::fb', '224.0.0.251']); // The later ones are rate limited
      const ula = ipv6.find((address) => !address.toLowerCase().startsWith('fe80'));
      vi.advanceTimersByTime(1000);
      sent.length = 0;
      inject('ipv6', query, { address: 'fe80::1234' }); // Link local: unicast, with the interface scope added
      if (ula) inject('ipv6', query, { address: ula }); // Same prefix as the interface: unicast
      expect(sent.map((packet) => packet.address.split('%')[0])).toEqual(['fe80::1234', ...(ula ? [ula] : [])]);
      expect(sent[0].address).toMatch(/^fe80::1234%/);
    });

    it('should delay a unicast reply to a QU question with shared answers', async () => {
      await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR, qu: true }] }));
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(1);
      expect(sent[0].address).toBe(ipv4[0] ?? '192.168.1.99');
    });

    it('should not send a delayed unicast reply after stop', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR, qu: true }] }));
      const stopping = advertiser.stop();
      vi.advanceTimersByTime(200);
      await stopping;
      adv = undefined;
      expect(sent.every((packet) => packet.message.answers?.every((record) => record.ttl === 0))).toBe(true); // Only the goodbyes
    });

    it('should answer a legacy query from a port other than 5353 by unicast with its ID, question, no flush bit and TTL at most 10 s (RFC 6762 §6.7)', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ id: 0x1234, questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] }), { port: 12345 });
      expect(sent).toHaveLength(1);
      expect(sent[0].port).toBe(12345);
      const response = sent[0].message;
      expect(response.id).toBe(0x1234);
      expect(response.questions?.map((question) => question.name)).toEqual([advertiser.hostName]);
      for (const record of [...(response.answers ?? []), ...(response.additionals ?? [])]) {
        expect(record.ttl).toBeLessThanOrEqual(10);
        expect(record.cacheFlush).toBe(false);
      }
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] }), { port: 12345, address: '203.0.113.1' });
      expect(sent).toHaveLength(1); // Not on link: ignored
    });

    it('should not multicast a record again within one second and aggregate the pending answers (RFC 6762 §6, §6.4)', async () => {
      const advertiser = await announcedAdvertiser();
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      inject('ipv4', buildPacket({ questions: [{ name: '_http._tcp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers?.map((record) => record.name)).toEqual(['_example._tcp.local', '_http._tcp.local']);
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(1);
      expect(advertiser.instanceName).toBeDefined();
    });

    it('should answer a probe for an owned name at once, by unicast and multicast (RFC 6762 §6, §8.1)', async () => {
      const advertiser = await announcedAdvertiser({ alias: false });
      inject(
        'ipv4',
        buildPacket({
          questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY, qu: true }],
          authorities: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }],
        }),
      );
      expect(sent.map((packet) => packet.address)).toEqual([ipv4[0] ?? '192.168.1.99']); // Multicast recently: unicast only
      vi.advanceTimersByTime(31000);
      inject(
        'ipv4',
        buildPacket({
          questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY, qu: true }],
          authorities: [{ name: advertiser.hostName, type: DnsRecordType.A, ttl: 120, rdata: Buffer.from([10, 9, 8, 7]) }],
        }),
      );
      expect(sent.slice(1).map((packet) => packet.address)).toEqual([ipv4[0] ?? '192.168.1.99', '224.0.0.251']);
    });

    it('should drop a pending answer when another host sends it first (RFC 6762 §7.4)', async () => {
      const advertiser = await announcedAdvertiser();
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      inject(
        'ipv4',
        buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: '_example._tcp.local', type: DnsRecordType.PTR, ttl: 4500, rdata: codec.encodeDnsName(instance) }] }),
      );
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(0);
    });

    it('should multicast a record again when another host sends it with less than half the TTL (RFC 6762 §6.6)', async () => {
      const advertiser = await announcedAdvertiser();
      const instance = `${advertiser.instanceName}._example._tcp.local`;
      inject('ipv4', buildPacket({ flags: DnsHeaderFlag.QR, answers: [{ name: '_example._tcp.local', type: DnsRecordType.PTR, ttl: 10, rdata: codec.encodeDnsName(instance) }] }));
      vi.advanceTimersByTime(120);
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers?.[0].ttl).toBe(MDNS_OTHER_RECORD_TTL);
    });
  });

  describe('packet size', () => {
    // Six TXT entries of 225 bytes: a 1350-byte TXT rdata, that fits alone in a packet but not after a PTR and a SRV record
    const bigTxt = Array.from({ length: 6 }, (_, index) => `k${index}=${'x'.repeat(221)}`);

    it('should compress the names in the packets (RFC 6762 §18.14)', async () => {
      const advertiser = await startAdvertiser();
      await completeProbing();
      const announcement = sentOn('ipv4').find((packet) => packet.message.qr === 1);
      if (!announcement) throw new Error('No announcement');
      const records = advertiser.activeRecords();
      expect((announcement.message.answers ?? []).length + (announcement.message.additionals ?? []).length).toBe(records.length); // NSEC records as additionals
      const uncompressed =
        12 +
        records.reduce(
          (size, record) => size + codec.encodeResourceRecord({ name: record.name, rtype: record.type, rclass: DnsClass.IN, ttl: record.ttl, rdata: record.rdata }).length,
          0,
        );
      expect(announcement.packet.length).toBeLessThan(uncompressed);
      expect(announcement.packet.includes(Buffer.from([0xc0, 0x0c]))).toBe(true); // A pointer to the first name at 12
    });

    it('should split the announcement over several packets that fit in the maximum message length (RFC 6762 §17)', async () => {
      const advertiser = await startAdvertiser({ txt: bigTxt });
      await completeProbing();
      for (const packet of sent) expect(packet.packet.length).toBeLessThanOrEqual(MDNS_MAX_MESSAGE_LENGTH);
      const announcements = sentOn('ipv4').filter((packet) => packet.message.qr === 1);
      expect(announcements.length).toBeGreaterThan(1);
      for (const announcement of announcements) expect(announcement.packet.length).toBeLessThanOrEqual(MDNS_MAX_MESSAGE_LENGTH);
      const answers = announcements.flatMap((announcement) => announcement.message.answers ?? []);
      expect(answers.filter((record) => record.type === DnsRecordType.TXT).map((record) => record.name)).toEqual(
        ['_example._tcp', '_http._tcp'].map((service) => `${advertiser.instanceName}.${service}.local`),
      );
    });

    it('should preserve additional records in a packet burst when they do not fit', async () => {
      const advertiser = await announcedAdvertiser({ txt: bigTxt });
      inject('ipv4', buildPacket({ questions: [{ name: '_example._tcp.local', type: DnsRecordType.PTR }] }));
      vi.advanceTimersByTime(120);
      expect(sent.length).toBeGreaterThan(1);
      for (const response of sent) expect(response.packet.length).toBeLessThanOrEqual(MDNS_MAX_MESSAGE_LENGTH);
      const records = sent.flatMap((response) => [...(response.message.answers ?? []), ...(response.message.additionals ?? [])]);
      expect(records.some((record) => record.type === DnsRecordType.TXT && record.name === `${advertiser.instanceName}._example._tcp.local`)).toBe(true);
      expect(records.filter((record) => record.name === advertiser.hostName && record.type === DnsRecordType.A)).toHaveLength(ipv4.length);
    });
  });

  describe('sockets', () => {
    it('should receive a real packet through the socket and send through it', async () => {
      const advertiser = await announcedAdvertiser({ enableIpv6: false });
      const received = new Promise((resolve) => advertiser.sockets.ipv4?.socket.once('message', resolve));
      const transmitted = new Promise((resolve) => advertiser.sockets.ipv4?.once('sent', resolve));
      const query = buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] });
      MdnsResponder.prototype.transmit.call(advertiser, 'ipv4', query, '127.0.0.1', port); // The real transmit, on the loopback only
      await transmitted;
      await received;
      expect(sent).toHaveLength(1);
      expect(sent[0].message.answers?.[0].name).toBe(advertiser.hostName);
    });

    it('should log a socket error and emit it when there is a listener', async () => {
      const advertiser = await announcedAdvertiser();
      advertiser.sockets.ipv4?.socket.emit('error', new Error('first'));
      const errors = vi.fn();
      advertiser.on('error', errors);
      advertiser.sockets.ipv6?.socket.emit('error', new Error('second'));
      expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: 'second' }));
      expect(errors).toHaveBeenCalledTimes(1);
    });

    it('should drop the packet and keep advertising when a destination is unreachable', async () => {
      const advertiser = await announcedAdvertiser({ enableIpv6: false });
      const socket = advertiser.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const errors = vi.fn();
      advertiser.on('error', errors);
      socket.on('error', errors);
      const warn = spyOn(socket.log, 'warn').mockImplementation(() => {});
      // The querier left the link after its query: the unicast reply cannot be delivered.
      const send = spyOn(socket.socket, 'send').mockImplementationOnce(((...parameters: unknown[]) => {
        const callback = parameters.at(-1) as (error: Error | null) => void;
        callback(Object.assign(new Error('send EHOSTUNREACH 192.168.69.103:5353'), { code: 'EHOSTUNREACH', syscall: 'send' }));
      }) as never);
      const query = buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.ANY }] });
      MdnsResponder.prototype.transmit.call(advertiser, 'ipv4', query, '192.168.69.103', 5353);
      expect(send).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('Packet to 192.168.69.103:5353 dropped: send EHOSTUNREACH 192.168.69.103:5353');
      expect(errors).not.toHaveBeenCalled();
      // The responder still answers: the next packet goes through the same socket.
      const transmitted = new Promise((resolve) => socket.once('sent', resolve));
      MdnsResponder.prototype.transmit.call(advertiser, 'ipv4', query, '127.0.0.1', port);
      await transmitted;
      expect(errors).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('should reject start() when a socket fails to start', async () => {
      const advertiser = new MdnsResponder({ ...defaults, mdnsPort: await getFreePort('udp4'), addressCheckIntervalMs: 0, enableIpv6: false });
      const socket = advertiser.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const start = spyOn(socket, 'start').mockImplementation(() => {
        throw new Error('bind failed');
      });
      let error: unknown;
      try {
        await advertiser.start();
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('bind failed');
      start.mockRestore();
      socket.socket.close();
    });
  });

  describe('stopping', () => {
    it('should send the goodbye packets with TTL 0 on both sockets and close them', async () => {
      const advertiser = await announcedAdvertiser();
      const stopping = advertiser.stop();
      for (const family of ['ipv4', 'ipv6'] as const) {
        const goodbye = sentOn(family)[0].message;
        expect(goodbye.answers?.length).toBeGreaterThan(0);
        expect(goodbye.answers?.every((record) => record.ttl === 0)).toBe(true);
      }
      vi.advanceTimersByTime(100);
      await stopping;
      adv = undefined;
      inject('ipv4', buildPacket({ questions: [{ name: advertiser.hostName, type: DnsRecordType.A }] }));
      expect(sent).toHaveLength(2);
      await advertiser.stop(); // Stopping twice does nothing
    });

    it('should not open the sockets or probe when stopped while starting', async () => {
      const advertiser = new MdnsResponder({ ...defaults, mdnsPort: await getFreePort('udp4') });
      const startSocket = spyOn(advertiser as unknown as { startSocket: () => Promise<void> }, 'startSocket');
      const starting = advertiser.start();
      const stopping = advertiser.stop();
      await starting;
      vi.advanceTimersByTime(100);
      await stopping;
      expect(startSocket).not.toHaveBeenCalled();
      expect(advertiser['addressTimer']).toBeUndefined();
      expect(advertiser['probeTimer']).toBeUndefined();
    });

    it('should not probe when stopped while the sockets are starting', async () => {
      const advertiser = new MdnsResponder({ ...defaults, mdnsPort: await getFreePort('udp4') });
      let stopping: Promise<void> | undefined;
      spyOn(advertiser as unknown as { startSocket: () => Promise<void> }, 'startSocket').mockImplementation(async () => {
        stopping ??= advertiser.stop();
      });
      await advertiser.start();
      vi.advanceTimersByTime(100);
      await stopping;
      expect(advertiser['addressTimer']).toBeUndefined();
      expect(advertiser['probeTimer']).toBeUndefined();
    });

    it('should resolve start() when stopped before announcing and refuse to start twice', async () => {
      const advertiser = await startAdvertiser();
      expect(advertiser.start()).rejects.toThrow('already started');
      const stopping = advertiser.stop();
      vi.advanceTimersByTime(100);
      await stopping;
      await started;
      adv = undefined;
      expect(sent).toHaveLength(0); // Nothing was owned: no goodbye
    });
  });
});
