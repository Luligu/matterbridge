/**
 * @file packages/dgram/vitest/mdnsScanner.test.ts
 * @description MdnsScanner class test
 * @author Luca Liguori
 */

import dgram from 'node:dgram';
import os from 'node:os';

import { consoleErrorSpy, consoleLogSpy, loggerLogSpy, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { LogLevel } from 'node-ansi-logger';

import { DnsClass, DnsHeaderFlag, DnsRecordType, Mdns, MDNS_MAX_MESSAGE_LENGTH, type MdnsMessage } from '../src/mdns.js';
import {
  MDNS_SCAN_HELP,
  MDNS_SCANNER_DEFAULT_SERVICES,
  MdnsScanner,
  type MdnsScannerDevice,
  type MdnsScannerFamily,
  type MdnsScannerOptions,
  runMdnsScanner,
} from '../src/mdnsScanner.js';

// Setup the test environment
await setupTest('Scan', false);

// No module is mocked: the scanner opens real sockets on a random high port (so no mDNS traffic from the LAN arrives),
// the queries it sends are captured by a spy on the socket send (so nothing reaches the LAN), incoming packets are injected
// by emitting 'message' on the real sockets, and fake timers drive the expiry and the logs.

interface Record {
  name: string;
  type: DnsRecordType;
  ttl: number;
  rdata: Buffer;
  flush?: boolean;
  rclass?: number;
}

const codec = new Mdns('Codec', '224.0.0.251', 5353, 'udp4');
let nextPort = 40000 + Math.floor(Math.random() * 20000);

const HOST = 'B75AFB458ECD0000.local';
const OPERATIONAL = '87E1B004E235A130-8FC7772401CD0696._matter._tcp.local';
const COMMISSIONABLE = 'DD200C20D25AE5F7._matterc._udp.local';

/**
 * Builds a DNS response (or query) packet.
 *
 * @param {Record[]} answers - The answer records.
 * @param {Record[]} [additionals] - The additional records.
 * @param {number} [flags] - The header flags, a response by default.
 * @returns {Buffer} The packet.
 */
function buildPacket(answers: Record[], additionals: Record[] = [], flags: number = DnsHeaderFlag.QR + DnsHeaderFlag.AA): Buffer {
  const header = Buffer.alloc(12);
  header.writeUInt16BE(flags, 2);
  header.writeUInt16BE(answers.length, 6);
  header.writeUInt16BE(additionals.length, 10);
  const encodeRecord = (record: Record): Buffer =>
    codec.encodeResourceRecord({ name: record.name, rtype: record.type, rclass: record.rclass ?? DnsClass.IN, flush: record.flush, ttl: record.ttl, rdata: record.rdata });
  return Buffer.concat([header, ...answers.map(encodeRecord), ...additionals.map(encodeRecord)]);
}

const ptr = (name: string, instance: string, ttl = 4500): Record => ({ name, type: DnsRecordType.PTR, ttl, rdata: codec.encodeDnsName(instance) });
const srv = (instance: string, target: string, ttl = 120): Record => ({
  name: instance,
  type: DnsRecordType.SRV,
  ttl,
  rdata: codec.encodeSrvRdata(0, 0, 5540, target),
  flush: true,
});
const a = (host: string, address: string, ttl = 120, flush = true): Record => ({ name: host, type: DnsRecordType.A, ttl, rdata: codec.encodeA(address), flush });
const aaaa = (host: string, address: string, ttl = 120): Record => ({ name: host, type: DnsRecordType.AAAA, ttl, rdata: codec.encodeAAAA(address), flush: true });
const txt = (instance: string, strings: string[], ttl = 4500): Record => ({ name: instance, type: DnsRecordType.TXT, ttl, rdata: codec.encodeTxtRdata(strings), flush: true });

describe('MdnsScanner', () => {
  let scanner: MdnsScanner | undefined;
  let sent: { family: MdnsScannerFamily; msg: Buffer; address: string; port: number }[] = [];

  /**
   * Creates a scanner with a spy on the socket send and starts it.
   *
   * @param {MdnsScannerOptions} [options] - Extra options.
   * @returns {Promise<MdnsScanner>} The started scanner.
   */
  async function startScanner(options: MdnsScannerOptions = {}): Promise<MdnsScanner> {
    const created = new MdnsScanner({ mdnsPort: nextPort++, query: false, ...options });
    scanner = created;
    sent = [];
    for (const family of ['ipv4', 'ipv6'] as const) {
      const socket = created.sockets[family]?.socket;
      if (!socket) continue;
      vi.spyOn(socket, 'send').mockImplementation(((msg: Buffer, _offset: number, _length: number, port: number, address: string) => {
        sent.push({ family, msg, address, port });
      }) as unknown as typeof socket.send);
    }
    await created.start();
    return created;
  }

  /**
   * Injects a packet into a socket of the scanner.
   *
   * @param {Buffer} packet - The packet.
   * @param {MdnsScannerFamily} [family] - The socket, IPv4 by default.
   */
  function inject(packet: Buffer, family: MdnsScannerFamily = 'ipv4'): void {
    const rinfo: dgram.RemoteInfo = {
      address: family === 'ipv4' ? '192.168.1.99' : 'fe80::1234',
      family: family === 'ipv4' ? 'IPv4' : 'IPv6',
      port: scanner?.mdnsPort ?? 5353,
      size: packet.length,
    };
    scanner?.sockets[family]?.socket.emit('message', packet, rinfo);
  }

  /**
   * Returns the device of a target.
   *
   * @param {string} target - The SRV target.
   * @returns {MdnsScannerDevice | undefined} The device.
   */
  function device(target: string = HOST): MdnsScannerDevice | undefined {
    return scanner?.devices.get(target.toLowerCase());
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (scanner) {
      await scanner.stop();
      scanner = undefined;
    }
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    codec.socket.close();
    vi.restoreAllMocks();
  });

  describe('construction', () => {
    it('should scan the Matter commissionable, operational and commissioner services on IPv4 and IPv6 by default', () => {
      const created = new MdnsScanner();
      expect(created.services).toEqual(['_matterc._udp', '_matter._tcp', '_matterd._udp', '_matterbridge._tcp']);
      expect(created.services).not.toBe(MDNS_SCANNER_DEFAULT_SERVICES);
      expect(created.mdnsPort).toBe(5353);
      expect(created.interfaceName).toBeUndefined();
      expect(created.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(created.sockets.ipv6).toBeInstanceOf(Mdns);
      created.sockets.ipv4?.socket.close();
      created.sockets.ipv6?.socket.close();
    });

    it('should open only the enabled families', () => {
      const created = new MdnsScanner({ enableIpv6: false });
      expect(created.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(created.sockets.ipv6).toBeUndefined();
      created.sockets.ipv4?.socket.close();
    });

    it('should reject invalid options', () => {
      expect(() => new MdnsScanner({ services: [] })).toThrow('at least one service is required');
      expect(() => new MdnsScanner({ services: ['_matter.tcp'] })).toThrow('invalid service');
      expect(() => new MdnsScanner({ enableIpv4: false, enableIpv6: false })).toThrow('at least one of IPv4 and IPv6 must be enabled');
    });
  });

  describe('lifecycle', () => {
    it('should send a PTR query for every service on both sockets on start, one question per query', async () => {
      await startScanner({ query: true });
      expect(sent).toHaveLength(8);
      expect(loggerLogSpy).toHaveBeenCalledWith(
        LogLevel.INFO,
        expect.stringMatching(/Querying .*_matterc\._udp, _matter\._tcp, _matterd\._udp, _matterbridge\._tcp.* on .*all interfaces.* \(.*ipv4, ipv6.*\)/),
      );
      for (const family of ['ipv4', 'ipv6'] as const) {
        const packets = sent.filter((packet) => packet.family === family);
        for (const packet of packets) expect(packet.address).toBe(family === 'ipv4' ? '224.0.0.251' : 'ff02::fb');
        const messages = packets.map((packet) => codec.decodeMdnsMessage(packet.msg));
        for (const message of messages) expect(message.qr).toBe(0);
        expect(messages.map((message) => message.questions?.map((question) => [question.name, question.type]))).toEqual([
          [['_matterc._udp.local', DnsRecordType.PTR]],
          [['_matter._tcp.local', DnsRecordType.PTR]],
          [['_matterd._udp.local', DnsRecordType.PTR]],
          [['_matterbridge._tcp.local', DnsRecordType.PTR]],
        ]);
      }
    });

    it('should ask for unicast responses only in the first queries, when it is the first socket bound to the port (RFC 6762 §5.4, §15.1)', async () => {
      const created = await startScanner({ query: true });
      const unicast = (): boolean[] => sent.flatMap((packet) => codec.decodeMdnsMessage(packet.msg).questions?.map((question) => question.unicastResponse) ?? []);
      expect(unicast()).toEqual(Array(8).fill(true)); // Alone on the random test port
      sent = [];
      created.sendQuery();
      expect(unicast()).toEqual(Array(8).fill(false));
    });

    it('should ask for multicast responses when another mDNS responder is bound to the port first (RFC 6762 §15.1)', async () => {
      const port = nextPort++;
      const responder = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      await new Promise<void>((resolve) => responder.bind(port, '0.0.0.0', resolve));
      await startScanner({ query: true, mdnsPort: port, enableIpv6: false });
      const unicast = sent.flatMap((packet) => codec.decodeMdnsMessage(packet.msg).questions?.map((question) => question.unicastResponse) ?? []);
      expect(unicast).toEqual(Array(4).fill(false));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Another mDNS responder is bound to ipv4 port ${port}`));
      await new Promise<void>((resolve) => responder.close(() => resolve()));
    });

    it('should not log another mDNS responder on the port when the start query is disabled', async () => {
      const port = nextPort++;
      const responder = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      await new Promise<void>((resolve) => responder.bind(port, '0.0.0.0', resolve));
      await startScanner({ mdnsPort: port, enableIpv6: false });
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Another mDNS responder is bound'));
      await new Promise<void>((resolve) => responder.close(() => resolve()));
    });

    it('should not send a query when disabled', async () => {
      await startScanner({ queryIntervalMs: 30000 });
      vi.advanceTimersByTime(30000);
      expect(sent).toHaveLength(0);
    });

    it('should repeat the query at the query interval with the known answers (RFC 6762 §7.1), until stopped', async () => {
      const created = await startScanner({ query: true, queryIntervalMs: 30000, services: ['_matter._tcp'], enableIpv6: false, refresh: false });
      expect(sent).toHaveLength(1);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)]));
      vi.advanceTimersByTime(29000);
      expect(sent).toHaveLength(1);
      vi.advanceTimersByTime(1000);
      expect(sent).toHaveLength(2);
      const message = codec.decodeMdnsMessage(sent[1].msg);
      expect(message.questions?.map((question) => question.name)).toEqual(['_matter._tcp.local']);
      expect(message.answers?.map((answer) => [answer.name, answer.data])).toEqual([['_matter._tcp.local', OPERATIONAL]]);
      await created.stop();
      vi.advanceTimersByTime(60000);
      expect(sent).toHaveLength(2);
    });

    it('should refuse to start twice and stop only once', async () => {
      const created = await startScanner();
      let error: unknown;
      try {
        await created.start();
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('already started');
      await created.stop();
      await created.stop();
      expect(loggerLogSpy.mock.calls.filter((call) => call[0] === LogLevel.INFO && call[1] === 'Stopped')).toHaveLength(1);
    });

    it('should do nothing when stopped before being started', async () => {
      const created = new MdnsScanner({ mdnsPort: nextPort++ });
      await expect(created.stop()).resolves.toBeUndefined();
      created.sockets.ipv4?.socket.close();
      created.sockets.ipv6?.socket.close();
    });

    it('should log the socket errors and emit them only when there is a listener', async () => {
      const created = await startScanner();
      created.sockets.ipv4?.socket.emit('error', new Error('first'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, 'Socket ipv4 error: first');
      const errors = vi.fn();
      created.on('error', errors);
      created.sockets.ipv6?.socket.emit('error', new Error('second'));
      expect(errors).toHaveBeenCalledTimes(1);
    });

    it('should reject start() when a socket fails to start', async () => {
      const created = new MdnsScanner({ mdnsPort: nextPort++, enableIpv6: false });
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const start = vi.spyOn(socket, 'start').mockImplementation(() => {
        throw new Error('bind failed');
      });
      let error: unknown;
      try {
        await created.start();
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('bind failed');
      start.mockRestore();
      socket.socket.close();
    });
  });

  describe('records', () => {
    it('should map the SRV target to the PTR, A and AAAA data of an operational advertisement', async () => {
      const created = await startScanner();
      const added = vi.fn();
      created.on('added', added);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10'), aaaa(HOST, 'fe80::1')]));
      expect(created.devices.size).toBe(1);
      const found = device();
      expect(found?.target).toBe(HOST);
      expect([...(found?.ptr.keys() ?? [])]).toEqual([OPERATIONAL]);
      expect([...(found?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      expect([...(found?.aaaa.keys() ?? [])]).toEqual(['fe80:0:0:0:0:0:0:1']);
      expect(found?.a.get('192.168.1.10')).toBe(Date.now() + 120000);
      expect(found?.ptr.get(OPERATIONAL)).toBe(Date.now() + 4500000);
      expect(added).toHaveBeenCalledWith(found);
    });

    it('should merge the instances of the same target, including subtypes, and the records received on IPv6', async () => {
      const created = await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL), ptr('_I8FC7772401CD0696._sub._matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)]));
      inject(
        buildPacket([ptr('_matterc._udp.local', COMMISSIONABLE), ptr('_L3840._sub._matterc._udp.local', COMMISSIONABLE)], [srv(COMMISSIONABLE, HOST), a(HOST, '192.168.1.10')]),
        'ipv6',
      );
      expect(created.devices.size).toBe(1);
      expect([...(device()?.ptr.keys() ?? [])].toSorted()).toEqual([OPERATIONAL, COMMISSIONABLE].toSorted());
      expect([...(device()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
    });

    it('should add the addresses of a known target received later, and ignore the addresses of other hosts', async () => {
      const created = await startScanner();
      inject(buildPacket([a(HOST, '192.168.1.10')])); // Target not known yet
      inject(buildPacket([srv(OPERATIONAL, HOST)]));
      expect(device()?.a.size).toBe(0);
      inject(buildPacket([a(HOST, '192.168.1.10'), a('other.local', '192.168.1.20')]));
      expect([...(device()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      expect(created.devices.size).toBe(1);
    });

    it('should ignore the other services, the queries, the non-IN classes and the malformed packets', async () => {
      const created = await startScanner();
      inject(buildPacket([ptr('_http._tcp.local', 'x._http._tcp.local'), ptr('_services._dns-sd._udp.local', '_matter._tcp.local')], [srv('x._http._tcp.local', HOST)]));
      inject(buildPacket([ptr('_matter._tcp.local', 'x._http._tcp.local')])); // Pointing to another service
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)], 0)); // Known answers of a query
      inject(buildPacket([{ ...srv(OPERATIONAL, HOST), rclass: DnsClass.CH }]));
      inject(Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0xff]));
      expect(created.devices.size).toBe(0);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Ignoring malformed packet from 192.168.1.99'));
    });

    it('should ignore the responses not sent from the mDNS port (RFC 6762 §6)', async () => {
      const created = await startScanner();
      const packet = buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)]);
      created.sockets.ipv4?.socket.emit('message', packet, { address: '192.168.1.99', family: 'IPv4', port: created.mdnsPort + 1, size: packet.length });
      expect(created.devices.size).toBe(0);
      inject(packet);
      expect(created.devices.size).toBe(1);
    });

    it('should ignore an SRV record whose data cannot be decoded', async () => {
      const created = await startScanner();
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      vi.spyOn(socket, 'decodeMdnsMessage').mockReturnValueOnce({
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
        anCount: 1,
        nsCount: 0,
        arCount: 0,
        answers: [{ name: OPERATIONAL, type: DnsRecordType.SRV, class: DnsClass.IN, cacheFlush: false, ttl: 120, data: 'not json' }],
      });
      inject(buildPacket([]));
      expect(created.devices.size).toBe(0);
    });

    it('should ignore the packets received after stop', async () => {
      const created = await startScanner();
      const socket = created.sockets.ipv4?.socket;
      await created.stop();
      socket?.emit('message', buildPacket([srv(OPERATIONAL, HOST)]), { address: '192.168.1.99', family: 'IPv4', port: created.mdnsPort, size: 0 });
      expect(created.devices.size).toBe(0);
    });
  });

  describe('expiry', () => {
    it('should remove the device on the SRV goodbye and an address on its goodbye', async () => {
      const created = await startScanner();
      const removed = vi.fn();
      created.on('removed', removed);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10'), a(HOST, '192.168.1.11', 120, false)]));
      inject(buildPacket([a(HOST, '192.168.1.11', 0)]));
      expect([...(device()?.a.keys() ?? [])]).toEqual(['192.168.1.10', '192.168.1.11']); // RFC 6762 §10.1: deleted one second later
      vi.advanceTimersByTime(2000);
      expect([...(device()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      inject(buildPacket([a(HOST, '192.168.1.99', 0)])); // Goodbye of an unknown record
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 0)], [srv(OPERATIONAL, HOST, 0)]));
      expect(created.devices.size).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(created.devices.size).toBe(0);
      expect(removed).toHaveBeenCalledTimes(1);
      expect((removed.mock.calls[0][0] as MdnsScannerDevice).target).toBe(HOST);
    });

    it('should absorb a goodbye followed by a new announcement within one second (RFC 6762 §10.1)', async () => {
      const created = await startScanner();
      const added = vi.fn();
      const removed = vi.fn();
      created.on('added', added);
      created.on('removed', removed);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10')]));
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 0)], [srv(OPERATIONAL, HOST, 0), a(HOST, '192.168.1.10', 0)]));
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10')]));
      vi.advanceTimersByTime(2000);
      expect([...(device()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      expect(added).toHaveBeenCalledTimes(1);
      expect(removed).not.toHaveBeenCalled();
    });

    it('should expire the records when their TTL has elapsed', async () => {
      const created = await startScanner();
      const removed = vi.fn();
      created.on('removed', removed);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST, 120), a(HOST, '192.168.1.10', 60)]));
      vi.advanceTimersByTime(60000);
      expect(device()?.a.size).toBe(0);
      expect(device()?.ptr.size).toBe(1);
      vi.advanceTimersByTime(60000);
      expect(created.devices.size).toBe(0);
      expect(removed).toHaveBeenCalledTimes(1);
      // The PTR record is still cached: a new SRV record brings the device back with its instance
      inject(buildPacket([srv(OPERATIONAL, HOST)]));
      expect([...(device()?.ptr.keys() ?? [])]).toEqual([OPERATIONAL]);
    });

    it('should expire in one second the records of a set flushed by a cache-flush record (RFC 6762 §10.2)', async () => {
      await startScanner();
      inject(buildPacket([srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10')]));
      inject(buildPacket([a(HOST, '192.168.1.11')])); // Received less than one second later: kept
      expect(device()?.a.size).toBe(2);
      vi.advanceTimersByTime(2000);
      inject(buildPacket([a(HOST, '192.168.1.12')]));
      expect(device()?.a.get('192.168.1.10')).toBe(Date.now() + 1000);
      vi.advanceTimersByTime(1000);
      expect([...(device()?.a.keys() ?? [])]).toEqual(['192.168.1.12']);
    });
  });

  describe('logs', () => {
    it('should log the devices every minute', async () => {
      await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), aaaa(HOST, 'fe80::1')]));
      inject(buildPacket([srv(COMMISSIONABLE, 'A0000000000000.local')]));
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(59000);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Devices advertising'));
      vi.advanceTimersByTime(1000);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Devices advertising'));
      const lines = loggerLogSpy.mock.calls.map((call) => call[1]);
      expect(lines.some((line) => line.includes(OPERATIONAL) && line.includes('4440'))).toBe(true);
      expect(lines.some((line) => line.includes('fe80:0:0:0:0:0:0:1') && line.includes('60'))).toBe(true);
      expect(lines.some((line) => line.includes('A none'))).toBe(true);
      expect(lines.findIndex((line) => line.includes('A0000000000000.local'))).toBeLessThan(lines.findIndex((line) => line.includes(HOST)));
      expect(lines.some((line) => line.includes(HOST) && line.includes('operational'))).toBe(true);
      expect(lines.some((line) => line.includes('A0000000000000.local') && line.includes('commissionable'))).toBe(true);
    });

    it('should log the scanned services with the number of devices', async () => {
      const created = await startScanner({ services: ['_http._tcp', '_ipp._tcp'] });
      loggerLogSpy.mockClear();
      created.logDevices();
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringMatching(/Devices advertising .*_http\._tcp, _ipp\._tcp.*: .*0/));
    });

    it('should log the SRV port and the TXT strings of the instances of the target', async () => {
      const created = await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['SII=5000', 'SAI=300']), txt('other._matter._tcp.local', ['T=1'])]));
      expect([...(device()?.srv.keys() ?? [])]).toEqual([`${OPERATIONAL}:5540`]);
      expect([...(device()?.txt.keys() ?? [])]).toEqual([`${OPERATIONAL} SII=5000, SAI=300`]);
      loggerLogSpy.mockClear();
      created.logDevices();
      const lines = loggerLogSpy.mock.calls.map((call) => call[1]);
      expect(lines.some((line) => line.includes('  SRV ') && line.includes(`${OPERATIONAL}:5540`) && line.includes('120'))).toBe(true);
      expect(lines.some((line) => line.includes('  TXT ') && line.includes('SII=5000, SAI=300') && line.includes('4500'))).toBe(true);
      // A new TXT with the cache-flush bit replaces the previous one after the grace second (RFC 6762 §10.2)
      vi.advanceTimersByTime(2000);
      inject(buildPacket([txt(OPERATIONAL, ['SII=3000'])]));
      vi.advanceTimersByTime(2000);
      expect([...(device()?.txt.keys() ?? [])]).toEqual([`${OPERATIONAL} SII=3000`]);
    });

    it('should show every kind of the target, and the service type for the other services', async () => {
      const created = await startScanner({ services: ['_matterc._udp', '_matter._tcp', '_matterd._udp', '_http._tcp'] });
      inject(buildPacket([srv(OPERATIONAL, HOST), srv(COMMISSIONABLE, HOST), srv('TV._matterd._udp.local', HOST), srv('web._http._tcp.local', HOST)]));
      expect(device()?.types).toEqual(['_http._tcp', 'commissionable', 'commissioner', 'operational']);
      loggerLogSpy.mockClear();
      created.logDevices();
      expect(loggerLogSpy.mock.calls.some((call) => call[1].includes(HOST) && call[1].includes('commissionable, commissioner, operational'))).toBe(true);
    });

    it('should expire the records before logging them', async () => {
      const created = await startScanner();
      inject(buildPacket([srv(OPERATIONAL, HOST, 10)]));
      const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 10000); // Expired, but the expire timer has not run yet
      loggerLogSpy.mockClear();
      created.logDevices();
      now.mockRestore();
      expect(created.devices.size).toBe(0);
      expect(loggerLogSpy.mock.calls.some((call) => call[1].includes(HOST) && !call[1].startsWith('Removed'))).toBe(false);
    });

    it('should not log the devices when the log interval is 0', async () => {
      await startScanner({ logIntervalMs: 0 });
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(120000);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Devices advertising'));
    });
  });

  describe('refresh', () => {
    let random = vi.spyOn(Math, 'random');

    /**
     * Returns the decoded queries sent on a family.
     *
     * @param {MdnsScannerFamily} family - The family.
     * @returns {MdnsMessage[]} The queries.
     */
    function queries(family: MdnsScannerFamily = 'ipv4'): MdnsMessage[] {
      return sent.filter((packet) => packet.family === family).map((packet) => codec.decodeMdnsMessage(packet.msg));
    }

    beforeEach(() => {
      random = vi.spyOn(Math, 'random').mockReturnValue(0); // No jitter: the refresh queries at exactly 80, 85, 90 and 95% of the TTL
    });

    afterEach(() => {
      random.mockRestore();
    });

    it('should query the records again at 80, 85, 90 and 95% of their TTL, then let them expire', async () => {
      const created = await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 120)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10'), aaaa(HOST, 'fe80::1')]));
      vi.advanceTimersByTime(95000);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1000); // 96 s: 80%
      expect(sent).toHaveLength(8); // One query per question, on each family
      expect(new Set(sent.map((packet) => packet.address))).toEqual(new Set(['224.0.0.251', 'ff02::fb']));
      for (const query of queries()) {
        expect(query.qr).toBe(0);
        expect(query.questions).toHaveLength(1);
        expect(query.answers).toHaveLength(0); // Every record is past half of its TTL
      }
      expect(queries().map((query) => [query.questions?.[0].name, query.questions?.[0].type, query.questions?.[0].class])).toEqual([
        ['_matter._tcp.local', DnsRecordType.PTR, DnsClass.IN],
        [OPERATIONAL, DnsRecordType.SRV, DnsClass.IN],
        [HOST, DnsRecordType.A, DnsClass.IN],
        [HOST, DnsRecordType.AAAA, DnsClass.IN],
      ]);
      vi.advanceTimersByTime(6000); // 102 s: 85%
      vi.advanceTimersByTime(6000); // 108 s: 90%
      vi.advanceTimersByTime(6000); // 114 s: 95%
      expect(queries()).toHaveLength(16);
      expect(queries('ipv6')).toHaveLength(16);
      vi.advanceTimersByTime(6000); // 120 s: no answer, expired
      expect(created.devices.size).toBe(0);
      vi.advanceTimersByTime(120000);
      expect(queries()).toHaveLength(16);
    });

    it('should keep a device whose records are refreshed by the answers', async () => {
      const created = await startScanner();
      const announcement = buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 120)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10')]);
      inject(announcement);
      vi.advanceTimersByTime(96000);
      expect(queries()).toHaveLength(3); // PTR, SRV and A
      inject(announcement); // The answer to the refresh queries
      vi.advanceTimersByTime(60000); // 156 s: past the first TTL, before the next 80%
      expect(created.devices.size).toBe(1);
      expect(queries()).toHaveLength(3);
      vi.advanceTimersByTime(36000); // 192 s: 80% of the refreshed TTL
      expect(queries()).toHaveLength(6);
    });

    it('should send the records with more than half of their TTL left as known answers', async () => {
      await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 120)], [srv(OPERATIONAL, HOST, 4500)]));
      inject(buildPacket([ptr('_matter._tcp.local', 'second._matter._tcp.local')], [srv('second._matter._tcp.local', HOST, 4500)]));
      vi.advanceTimersByTime(96000);
      const [query] = queries();
      expect(query.questions?.map((question) => [question.name, question.type])).toEqual([['_matter._tcp.local', DnsRecordType.PTR]]);
      expect(query.answers?.map((answer) => [answer.name, answer.type, answer.data, answer.ttl])).toEqual([
        ['_matter._tcp.local', DnsRecordType.PTR, 'second._matter._tcp.local', 4404],
      ]);
    });

    it('should send the known answers of the A and AAAA records', async () => {
      await startScanner();
      inject(buildPacket([srv(OPERATIONAL, HOST, 4500), a(HOST, '192.168.1.10', 120, false), aaaa(HOST, 'fe80::1')]));
      vi.advanceTimersByTime(2000);
      inject(buildPacket([a(HOST, '192.168.1.11', 4500, false), { ...aaaa(HOST, 'fe80::2', 4500), flush: false }]));
      vi.advanceTimersByTime(94000); // 96 s: 80% of the first A and AAAA records
      const [queryA, queryAAAA] = queries();
      expect(queryA.questions?.map((question) => question.type)).toEqual([DnsRecordType.A]);
      expect(queryA.answers?.map((answer) => [answer.type, answer.data])).toEqual([[DnsRecordType.A, '192.168.1.11']]);
      expect(queryAAAA.questions?.map((question) => question.type)).toEqual([DnsRecordType.AAAA]);
      expect(queryAAAA.answers?.map((answer) => [answer.type, answer.data])).toEqual([[DnsRecordType.AAAA, 'fe80:0:0:0:0:0:0:2']]);
    });

    it('should add up to 2% of random jitter to the refresh times', async () => {
      random.mockReturnValue(1);
      await startScanner();
      inject(buildPacket([srv(OPERATIONAL, HOST)]));
      vi.advanceTimersByTime(98000);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1000); // 99 s: past 82% (98.4 s)
      expect(queries()).toHaveLength(1);
    });

    it('should not send the SRV records as known answers when an SRV record is refreshed', async () => {
      await startScanner({ enableIpv6: false });
      inject(buildPacket([srv(OPERATIONAL, HOST, 120), { ...srv(OPERATIONAL, 'other.local', 4500), flush: false }]));
      vi.advanceTimersByTime(96000); // 80% of the first SRV record; the second has more than half of its TTL left
      const [query] = queries();
      expect(query.questions?.map((question) => [question.name, question.type])).toEqual([[OPERATIONAL, DnsRecordType.SRV]]);
      expect(query.answers ?? []).toEqual([]);
    });

    it('should send each refresh question in its own query', async () => {
      await startScanner({ enableIpv6: false });
      const instances = ['first._matter._tcp.local', 'second._matter._tcp.local', 'third._matter._tcp.local'];
      inject(buildPacket(instances.map((instance) => srv(instance, HOST))));
      vi.advanceTimersByTime(96000);
      expect(queries().map((query) => query.questions?.map((question) => question.name))).toEqual(instances.map((instance) => [instance]));
    });

    it('should keep only the known answers that fit the maximum message length', async () => {
      await startScanner({ enableIpv6: false });
      const instance = (index: number): string => `${String(index).padStart(16, '0')}-${'F'.repeat(16)}._matter._tcp.local`;
      inject(buildPacket([ptr('_matter._tcp.local', instance(0), 120)]));
      inject(buildPacket(Array.from({ length: 79 }, (_, index) => ptr('_matter._tcp.local', instance(index + 1)))));
      vi.advanceTimersByTime(96000); // 80% of the first PTR record; the other 79 are known answers
      expect(sent).toHaveLength(1);
      expect(sent[0].msg.length).toBeLessThanOrEqual(MDNS_MAX_MESSAGE_LENGTH);
      const [query] = queries();
      expect(query.questions?.map((question) => question.name)).toEqual(['_matter._tcp.local']);
      expect(query.answers?.length).toBeGreaterThan(0);
      expect(query.answers?.length).toBeLessThan(79);
    });

    it('should not refresh the records when disabled', async () => {
      const created = await startScanner({ refresh: false });
      inject(buildPacket([srv(OPERATIONAL, HOST)]));
      vi.advanceTimersByTime(119000);
      expect(sent).toHaveLength(0);
      expect(created.devices.size).toBe(1);
    });
  });

  describe('runMdnsScanner', () => {
    /**
     * Returns the last listener of a process signal.
     *
     * @param {NodeJS.Signals} signal - The signal.
     * @returns {() => void} The listener.
     */
    function lastListener(signal: NodeJS.Signals): () => void {
      return process.listeners(signal).at(-1) as () => void;
    }

    /** Removes the signal listeners added by runMdnsScanner. */
    function removeListeners(): void {
      process.removeListener('SIGINT', lastListener('SIGINT'));
      process.removeListener('SIGTERM', lastListener('SIGTERM'));
    }

    /**
     * Runs runMdnsScanner with a command line that must fail, and restores the exit code.
     *
     * @param {string[]} argv - The command line.
     * @returns {Promise<string>} The error printed.
     */
    async function runWithError(argv: string[]): Promise<string> {
      const exitCode = process.exitCode;
      const sigint = process.listenerCount('SIGINT');
      const result = await runMdnsScanner(argv, { mdnsPort: nextPort++ });
      const code = process.exitCode;
      process.exitCode = exitCode;
      expect(result).toBeUndefined();
      expect(code).toBe(2);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const message = String(consoleErrorSpy.mock.calls[0][0]);
      expect(message).toContain('Run mdns-scan --help to see the options.');
      return message;
    }

    it('should start a scanner on the interface given, with the start query, and stop it on SIGINT', async () => {
      const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => info.family === 'IPv4' && !info.internal))?.[0];
      const sendQuery = vi.spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      const sigint = process.listenerCount('SIGINT');
      const created = await runMdnsScanner(['--interface', interfaceName ?? '', '--query'], { mdnsPort: nextPort++, enableIpv6: false });
      if (!created) throw new Error('scanner not created');
      expect(created.interfaceName).toBe(interfaceName);
      expect(sendQuery).toHaveBeenCalledTimes(4); // One query per service
      expect(process.listenerCount('SIGINT')).toBe(sigint + 1);
      const stopped = new Promise<void>((resolve) => created.sockets.ipv4?.once('close', () => resolve()));
      lastListener('SIGINT')();
      await stopped;
      removeListeners();
      sendQuery.mockRestore();
    });

    it('should start a scanner on all the interfaces with the defaults and without the start query', async () => {
      const sendQuery = vi.spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      scanner = await runMdnsScanner([], { mdnsPort: nextPort++ });
      expect(scanner?.interfaceName).toBeUndefined();
      expect(scanner?.services).toEqual(MDNS_SCANNER_DEFAULT_SERVICES);
      expect(scanner?.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(scanner?.sockets.ipv6).toBeInstanceOf(Mdns);
      expect(scanner?.log.logLevel).toBe(LogLevel.INFO);
      expect(sendQuery).not.toHaveBeenCalled();
      removeListeners();
      sendQuery.mockRestore();
    });

    it('should apply every option of the command line', async () => {
      scanner = await runMdnsScanner(['--service', '_matter._tcp', '--service', '_http._tcp', '--no-refresh', '--log-interval', '0', '--no-ipv6', '--debug'], {
        mdnsPort: nextPort++,
      });
      expect(scanner?.services).toEqual(['_matter._tcp', '_http._tcp']);
      expect(scanner?.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(scanner?.sockets.ipv6).toBeUndefined();
      expect(scanner?.log.logLevel).toBe(LogLevel.DEBUG);
      // --no-refresh and --log-interval 0: no refresh query and no log of the devices
      const ipv4 = scanner?.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      const send = vi.spyOn(ipv4, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      scanner?.sockets.ipv4?.socket.emit('message', buildPacket([srv(OPERATIONAL, HOST)]), {
        address: '192.168.1.99',
        family: 'IPv4',
        port: 5353,
        size: 0,
      } satisfies dgram.RemoteInfo);
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(119000);
      expect(send).not.toHaveBeenCalled();
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Devices advertising'));
      removeListeners();
    });

    it('should log at debug level with --verbose and only on IPv6 with --no-ipv4', async () => {
      scanner = await runMdnsScanner(['--verbose', '--no-ipv4', '--log-interval', '30'], { mdnsPort: nextPort++ });
      expect(scanner?.sockets.ipv4).toBeUndefined();
      expect(scanner?.sockets.ipv6).toBeInstanceOf(Mdns);
      expect(scanner?.log.logLevel).toBe(LogLevel.DEBUG);
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(30000);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Devices advertising'));
      removeListeners();
    });

    it('should print the help and start nothing with --help or -h', async () => {
      const sigint = process.listenerCount('SIGINT');
      expect(await runMdnsScanner(['--help'])).toBeUndefined();
      expect(await runMdnsScanner(['-h', '--query'])).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(MDNS_SCAN_HELP);
      expect(MDNS_SCAN_HELP).toContain('Usage: mdns-scan [options]');
      for (const option of ['--interface', '--query', '--service', '--no-refresh', '--log-interval', '--no-ipv4', '--no-ipv6', '--debug', '--verbose', '--help'])
        expect(MDNS_SCAN_HELP).toContain(option);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
    });

    it('should report an unknown option', async () => {
      expect(await runWithError(['--unknown'])).toContain('--unknown');
    });

    it('should repeat the query every --query seconds, and only on start without them', async () => {
      const sendQuery = vi.spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      for (const [args, repeated] of [
        [['--query', '30'], true],
        [['--query=30'], true],
        [['--query'], false],
      ] as const) {
        sendQuery.mockClear();
        scanner = await runMdnsScanner([...args, '--service', '_matter._tcp'], { mdnsPort: nextPort++, enableIpv6: false });
        expect(sendQuery).toHaveBeenCalledTimes(1);
        vi.advanceTimersByTime(30000);
        expect(sendQuery).toHaveBeenCalledTimes(repeated ? 2 : 1);
        await scanner?.stop();
        removeListeners();
      }
      sendQuery.mockRestore();
    });

    it('should report an invalid query interval', async () => {
      expect(await runWithError(['--query=abc'])).toContain('invalid --query abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--query='])).toContain('invalid --query ');
    });

    it('should report an invalid log interval', async () => {
      expect(await runWithError(['--log-interval', 'abc'])).toContain('invalid --log-interval abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--log-interval=-1'])).toContain('invalid --log-interval -1');
    });

    it('should report an invalid service', async () => {
      expect(await runWithError(['--service', '_matter.tcp'])).toContain('invalid service _matter.tcp');
    });

    it('should report the scanner errors', async () => {
      expect(await runWithError(['--no-ipv4', '--no-ipv6'])).toContain('at least one of IPv4 and IPv6 must be enabled');
    });
  });

  describe('branch coverage', () => {
    const response = (answers?: MdnsMessage['answers'], additionals?: MdnsMessage['additionals']): MdnsMessage => ({
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
      anCount: answers?.length ?? 0,
      nsCount: 0,
      arCount: additionals?.length ?? 0,
      answers,
      additionals,
    });

    it('should accept a response without answers or additionals', async () => {
      const created = await startScanner();
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      vi.spyOn(socket, 'decodeMdnsMessage').mockReturnValueOnce(response());
      inject(buildPacket([]));
      expect(created.devices.size).toBe(0);
    });

    it('should ignore SRV data that is valid JSON without a string target or a number port', async () => {
      const created = await startScanner();
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const record = (data: string): NonNullable<MdnsMessage['answers']>[number] => ({
        name: OPERATIONAL,
        type: DnsRecordType.SRV,
        class: DnsClass.IN,
        cacheFlush: false,
        ttl: 120,
        data,
      });
      vi.spyOn(socket, 'decodeMdnsMessage').mockReturnValueOnce(
        response([record('5'), record('null'), record('{"port":5540}'), record('{"target":1}'), record(`{"target":"${HOST}"}`), record(`{"target":"${HOST}","port":"5540"}`)]),
      );
      inject(buildPacket([]));
      expect(created.devices.size).toBe(0);
    });

    it('should keep the changed state when a PTR or TXT record of another class is not cached', async () => {
      const created = await startScanner();
      inject(buildPacket([{ ...ptr('_matter._tcp.local', OPERATIONAL), rclass: 3 }, ptr('_matter._tcp.local', OPERATIONAL)]));
      inject(buildPacket([{ ...txt(OPERATIONAL, ['SII=5000']), rclass: 3 }]));
      expect(created.devices.size).toBe(0);
    });
  });
});
