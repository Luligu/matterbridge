/**
 * @file packages/dgram/buntest/mdnsScanner.test.ts
 * @description MdnsScanner class test
 * @author Luca Liguori
 */

import { afterAll, afterEach, beforeEach, describe, expect, it, spyOn, vi } from 'bun:test';
import dgram from 'node:dgram';
import os from 'node:os';

import { consoleErrorSpy, consoleLogSpy, loggerLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { getFreePort } from '@matterbridge/utils/port';
import { LogLevel } from 'node-ansi-logger';

import { DnsClass, DnsHeaderFlag, DnsRecordType, Mdns, MDNS_MAX_MESSAGE_LENGTH, type MdnsMessage } from '../src/mdns.js';
import {
  MDNS_SCAN_HELP,
  MDNS_SCANNER_DEFAULT_SERVICES,
  MdnsScanner,
  type MdnsScannerFamily,
  type MdnsScannerHost,
  type MdnsScannerInstance,
  type MdnsScannerOptions,
  runMdnsScanner,
} from '../src/mdnsScanner.js';

// Mocks AnsiLogger.prototype.log and the console methods, and sets process.argv to ['bun', NAME].
await setupTest('ScanTest');

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
const srv = (instance: string, target: string, ttl = 120, port = 5540): Record => ({
  name: instance,
  type: DnsRecordType.SRV,
  ttl,
  rdata: codec.encodeSrvRdata(0, 0, port, target),
  flush: true,
});
const a = (host: string, address: string, ttl = 120, flush = true): Record => ({ name: host, type: DnsRecordType.A, ttl, rdata: codec.encodeA(address), flush });
const aaaa = (host: string, address: string, ttl = 120): Record => ({ name: host, type: DnsRecordType.AAAA, ttl, rdata: codec.encodeAAAA(address), flush: true });
const txt = (instance: string, strings: string[], ttl = 4500): Record => ({ name: instance, type: DnsRecordType.TXT, ttl, rdata: codec.encodeTxtRdata(strings), flush: true });

describe('MdnsScanner', () => {
  let scanner: MdnsScanner | undefined;
  let sent: { family: MdnsScannerFamily; msg: Buffer; address: string; port: number }[] = [];
  let interfacesSpy: ReturnType<typeof spyOn<typeof os, 'networkInterfaces'>> | undefined;
  const platform = process.platform;

  /**
   * Creates a scanner with a spy on the socket send and starts it. It sends no query unless the test enables them.
   *
   * @param {MdnsScannerOptions} [options] - Extra options.
   * @returns {Promise<MdnsScanner>} The started scanner.
   */
  async function startScanner(options: MdnsScannerOptions = {}): Promise<MdnsScanner> {
    const created = new MdnsScanner({ mdnsPort: await getFreePort('udp'), query: false, resolve: false, ...options });
    scanner = created;
    sent = [];
    for (const family of ['ipv4', 'ipv6'] as const) {
      const socket = created.sockets[family]?.socket;
      if (!socket) continue;
      spyOn(socket, 'send').mockImplementation(((msg: Buffer, _offset: number, _length: number, port: number, address: string) => {
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
   * Replaces the local network interfaces seen by the scanner until the end of the test.
   *
   * @param {NodeJS.Dict<os.NetworkInterfaceInfo[]>} value - The interfaces.
   */
  function mockInterfaces(value: NodeJS.Dict<os.NetworkInterfaceInfo[]>): void {
    interfacesSpy ??= spyOn(os, 'networkInterfaces');
    interfacesSpy.mockReturnValue(value);
  }

  /**
   * Sets process.platform until the end of the test.
   *
   * @param {NodeJS.Platform} platform - The platform.
   */
  function mockPlatform(platform: NodeJS.Platform): void {
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  }

  /**
   * Returns a service instance.
   *
   * @param {string} name - The instance name.
   * @returns {MdnsScannerInstance | undefined} The instance.
   */
  function instance(name: string = OPERATIONAL): MdnsScannerInstance | undefined {
    return scanner?.instances.get(name.toLowerCase());
  }

  /**
   * Returns the host of a target.
   *
   * @param {string} target - The SRV target.
   * @returns {MdnsScannerHost | undefined} The host.
   */
  function host(target: string = HOST): MdnsScannerHost | undefined {
    return scanner?.hosts.get(target.toLowerCase());
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    if (scanner) {
      await scanner.stop();
      scanner = undefined;
    }
    interfacesSpy?.mockRestore();
    interfacesSpy = undefined;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  afterAll(() => {
    codec.socket.close();
    vi.restoreAllMocks();
    resetTest();
  });

  describe('construction', () => {
    it('should scan the Matter commissionable, operational and commissioner services on IPv4 and IPv6 by default', () => {
      const created = new MdnsScanner();
      expect(created.services).toEqual(['_matterc._udp', '_matter._tcp', '_matterd._udp', '_matterbridge._tcp']);
      expect(created.services).not.toBe(MDNS_SCANNER_DEFAULT_SERVICES);
      expect(created.queryNames).toEqual([]);
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
      expect(() => new MdnsScanner({ services: ['_matterc._udp'], queryNames: [] })).not.toThrow();
      expect(() => new MdnsScanner({ services: ['_matterc._udp'], queryNames: ['L840._sub._matterc._udp'] })).toThrow('invalid query name');
      expect(() => new MdnsScanner({ services: ['_matterc._udp'], queryNames: [`_${'a'.repeat(63)}._sub._matterc._udp`] })).toThrow('invalid query name');
      expect(() => new MdnsScanner({ services: ['_matterc._udp'], queryNames: ['_L840._sub._matter._tcp'] })).toThrow('not of a scanned service');
      expect(() => new MdnsScanner({ services: ['_matterc._udp'], queryNames: ['_matter._tcp'] })).toThrow('not of a scanned service');
      expect(() => new MdnsScanner({ services: ['_matterc._udp'], queryNames: ['_L840._sub._MATTERC._udp', '_matterc._udp'] })).not.toThrow();
      expect(() => new MdnsScanner({ enableIpv4: false, enableIpv6: false })).toThrow('at least one of IPv4 and IPv6 must be enabled');
      expect(() => new MdnsScanner({ services: ['_matter._tcp'], queryInstance: 'AB-42._matterc._udp.local' })).toThrow('queryInstance must name an instance of a scanned service');
      expect(() => new MdnsScanner({ services: ['_matter._tcp'], queryInstance: 'AB-42._matter._tcp.local', queryNames: ['_matter._tcp'] })).toThrow(
        'cannot be combined with PTR query names',
      );
    });

    it('should reject an invalid port and the intervals setInterval() would turn into 1 ms', async () => {
      for (const mdnsPort of [0, 65536, 1.5, Number.NaN]) expect(() => new MdnsScanner({ mdnsPort })).toThrow('invalid mdnsPort');
      for (const queryIntervalMs of [-1, 0.5, 0x80000000, 3_000_000_000, Number.POSITIVE_INFINITY, Number.NaN]) {
        expect(() => new MdnsScanner({ queryIntervalMs })).toThrow('invalid queryIntervalMs');
        expect(() => new MdnsScanner({ logIntervalMs: queryIntervalMs })).toThrow('invalid logIntervalMs');
      }
      const created = new MdnsScanner({ mdnsPort: 65535, queryIntervalMs: 0x7fffffff, logIntervalMs: 0 });
      expect(created.mdnsPort).toBe(65535);
      await created.stop();
    });
  });

  describe('lifecycle', () => {
    it('should send a PTR query for every service on both sockets on start, one question per query', async () => {
      await startScanner({ query: true });
      expect(sent).toHaveLength(8);
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

    it('should query only the selected instance and ignore records for other instances', async () => {
      const other = '0000000000000000-000000000000002A._matter._tcp.local';
      const service = '_matter._tcp.local';
      const created = await startScanner({ queryInstance: OPERATIONAL, query: true, queryIntervalMs: 1000, resolve: true, enableIpv6: false });
      const questions = (): [string, number, boolean][] =>
        sent.flatMap(({ msg }) => (codec.decodeMdnsMessage(msg).questions ?? []).map(({ name, type, unicastResponse }) => [name, type, unicastResponse]));

      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.TXT, true],
      ]);

      inject(buildPacket([ptr(service, other), srv(other, HOST), txt(other, ['T=6']), a(HOST, '192.0.2.1')]));
      expect(created.instances.size).toBe(0);
      expect(created.hosts.size).toBe(0);

      sent = [];
      vi.advanceTimersByTime(1000);
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, false],
        [OPERATIONAL, DnsRecordType.TXT, false],
      ]);

      inject(buildPacket([ptr(service, OPERATIONAL), srv(OPERATIONAL.toLowerCase(), HOST), txt(OPERATIONAL, ['T=6']), a(HOST, '192.0.2.2'), aaaa(HOST, '2001:db8::1')]));
      expect([...created.instances.keys()]).toEqual([OPERATIONAL.toLowerCase()]);
      expect(instance()?.ptrExpires).toBeDefined();
      expect(instance()?.txt?.strings).toEqual(['T=6']);
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.0.2.2']);

      sent = [];
      vi.advanceTimersByTime(1000);
      expect(sent).toHaveLength(0);
    });

    it('should ask for unicast responses only in the first queries, when it is the first socket bound to the port (RFC 6762 §5.4, §15.1)', async () => {
      const created = await startScanner({ query: true });
      const unicast = (): boolean[] => sent.flatMap((packet) => codec.decodeMdnsMessage(packet.msg).questions?.map((question) => question.unicastResponse) ?? []);
      expect(unicast()).toEqual(Array(8).fill(true)); // Alone on the random test port
      sent = [];
      created.sendQuery();
      expect(unicast()).toEqual(Array(8).fill(false));
    });

    it('should send a scoped service and subtype queries and accept their PTR answers', async () => {
      const queryNames = ['_L840._sub._matterc._udp', '_S3._sub._matterc._udp', '_CM._sub._matterc._udp'];
      const created = await startScanner({ services: ['_matterc._udp'], queryNames, query: true });
      expect(created.services).toEqual(['_matterc._udp']);
      expect(created.queryNames).toEqual(queryNames);
      for (const family of ['ipv4', 'ipv6'] as const) {
        const messages = sent.filter((packet) => packet.family === family).map((packet) => codec.decodeMdnsMessage(packet.msg));
        expect(messages.map((message) => message.questions?.[0]?.name)).toEqual(['_matterc._udp', ...queryNames].map((name) => `${name}.local`));
      }
      inject(
        buildPacket(
          queryNames.map((name) => ptr(`${name}.local`, COMMISSIONABLE)),
          [srv(COMMISSIONABLE, HOST)],
        ),
      );
      expect(created.instances.size).toBe(1);
      expect([...(instance(COMMISSIONABLE)?.subtypes.keys() ?? [])].toSorted()).toEqual(['_CM', '_L840', '_S3']);
    });

    it('should ask for multicast responses when another mDNS responder is bound to the port first (RFC 6762 §15.1)', async () => {
      const port = await getFreePort('udp');
      const responder = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      await new Promise<void>((resolve) => responder.bind(port, '0.0.0.0', resolve));
      await startScanner({ query: true, mdnsPort: port, enableIpv6: false });
      const unicast = sent.flatMap((packet) => codec.decodeMdnsMessage(packet.msg).questions?.map((question) => question.unicastResponse) ?? []);
      expect(unicast).toEqual(Array(4).fill(false));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining(`Another mDNS responder is bound to ipv4 port ${port}`));
      await new Promise<void>((resolve) => responder.close(() => resolve()));
    });

    it('should not log another mDNS responder on the port when the start query is disabled', async () => {
      const port = await getFreePort('udp');
      const responder = dgram.createSocket({ type: 'udp4', reuseAddr: true });
      await new Promise<void>((resolve) => responder.bind(port, '0.0.0.0', resolve));
      await startScanner({ mdnsPort: port, enableIpv6: false });
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Another mDNS responder is bound'));
      await new Promise<void>((resolve) => responder.close(() => resolve()));
    });

    it('should not send a query when disabled', async () => {
      await startScanner({ query: false, queryIntervalMs: 30000 });
      vi.advanceTimersByTime(30000);
      expect(sent).toHaveLength(0);
    });

    it('should send service queries when query names are omitted', async () => {
      const created = await startScanner({ query: true, queryIntervalMs: 30000 });
      expect(sent).toHaveLength(8);
      sent = [];
      vi.advanceTimersByTime(30000);
      expect(sent).toHaveLength(8);
      await created.stop();
    });

    it('should repeat the query at the query interval with the known answers (RFC 6762 §7.1), until stopped', async () => {
      const created = await startScanner({
        query: true,
        queryIntervalMs: 30000,
        services: ['_matter._tcp'],
        enableIpv6: false,
        refresh: false,
      });
      expect(sent).toHaveLength(1);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['T=1'])]));
      inject(buildPacket([ptr('_matter._tcp.local', 'srvless._matter._tcp.local')], [txt('srvless._matter._tcp.local', ['T=1'])]));
      inject(buildPacket([ptr('_matter._tcp.local', 'txtless._matter._tcp.local')], [srv('txtless._matter._tcp.local', HOST)]));
      vi.advanceTimersByTime(29000);
      expect(sent).toHaveLength(1);
      vi.advanceTimersByTime(1000);
      expect(sent).toHaveLength(2);
      const message = codec.decodeMdnsMessage(sent[1].msg);
      expect(message.questions?.map((question) => question.name)).toEqual(['_matter._tcp.local']);
      // The instances still lacking their SRV or TXT record are not known answers, so they are answered again
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

    /**
     * Starts a scanner that must fail and returns the error.
     *
     * @param {MdnsScanner} created - The scanner.
     * @returns {Promise<Error>} The error start() rejected with.
     */
    async function startError(created: MdnsScanner): Promise<Error> {
      let error: unknown;
      try {
        await created.start();
      } catch (err) {
        error = err;
      }
      expect(error).toBeInstanceOf(Error);
      return error as Error;
    }

    /**
     * Records the families whose socket is closed.
     *
     * @param {MdnsScanner} created - The scanner.
     * @returns {MdnsScannerFamily[]} The families closed so far, filled as they close.
     */
    function trackClosed(created: MdnsScanner): MdnsScannerFamily[] {
      const closed: MdnsScannerFamily[] = [];
      for (const family of ['ipv4', 'ipv6'] as const) created.sockets[family]?.once('close', () => closed.push(family));
      return closed;
    }

    it('should close the sockets when stopped before being started, and refuse to start after', async () => {
      const created = new MdnsScanner({ mdnsPort: await getFreePort('udp') });
      const closed = trackClosed(created);
      await created.stop();
      expect(closed.toSorted()).toEqual(['ipv4', 'ipv6']);
      expect((await startError(created)).message).toContain('already stopped');
    });

    it('should start nothing when stopped while start() checks the port', async () => {
      const created = new MdnsScanner({ mdnsPort: await getFreePort('udp'), query: true, queryIntervalMs: 1000 });
      const closed = trackClosed(created);
      const sockets = [created.sockets.ipv4, created.sockets.ipv6];
      const starts = sockets.map((socket) => (socket ? spyOn(socket, 'start') : undefined));
      const starting = created.start();
      await created.stop();
      await starting;
      expect(closed.toSorted()).toEqual(['ipv4', 'ipv6']);
      for (const start of starts) expect(start).not.toHaveBeenCalled();
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Scanning'));
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should start nothing when stopped while the sockets are binding', async () => {
      const created = new MdnsScanner({ mdnsPort: await getFreePort('udp'), enableIpv6: false, query: true, queryIntervalMs: 1000 });
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const closed = trackClosed(created);
      const send = spyOn(socket.socket, 'send');
      const start = socket.start.bind(socket);
      let stopping: Promise<void> | undefined;
      spyOn(socket, 'start').mockImplementation(() => {
        start();
        stopping = created.stop();
      });
      await created.start();
      await stopping;
      expect(closed).toEqual(['ipv4']);
      expect(send).not.toHaveBeenCalled();
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Scanning'));
      expect(vi.getTimerCount()).toBe(0);
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

    it('should reject start() and close the sockets, also the one already bound, when a socket fails to start', async () => {
      const created = new MdnsScanner({ mdnsPort: await getFreePort('udp') });
      const socket = created.sockets.ipv6;
      if (!socket) throw new Error('IPv6 socket not created');
      const closed = trackClosed(created);
      spyOn(socket, 'start').mockImplementation(() => {
        throw new Error('bind failed');
      });
      expect((await startError(created)).message).toBe('bind failed');
      expect(closed.toSorted()).toEqual(['ipv4', 'ipv6']);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('should reject start() instead of throwing an uncaught exception when there is no external IPv4 interface', async () => {
      const created = new MdnsScanner({ mdnsPort: await getFreePort('udp'), enableIpv6: false });
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const closed = trackClosed(created);
      spyOn(socket, 'getIpv4InterfaceAddress').mockImplementation(() => {
        throw new Error(`Didn't find an external IPv4 network interface`);
      });
      expect((await startError(created)).message).toBe(`Didn't find an external IPv4 network interface`);
      expect(closed).toEqual(['ipv4']);
    });
  });

  describe('records', () => {
    it('should resolve an operational advertisement to an instance with its SRV, TXT and host addresses', async () => {
      const created = await startScanner();
      mockInterfaces({}); // The receiving interface of the link-local address cannot be determined
      const added = vi.fn();
      created.on('added', added);
      inject(
        buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['SII=5000', 'SAI=300']), a(HOST, '192.168.1.10'), aaaa(HOST, 'fe80::1')]),
      );
      const now = Date.now();
      expect(created.instances.size).toBe(1);
      expect(instance()).toEqual({
        name: OPERATIONAL,
        service: '_matter._tcp',
        type: 'operational',
        ptrExpires: now + 4500000,
        subtypes: new Map(),
        srv: { priority: 0, weight: 0, port: 5540, target: HOST, expires: now + 120000 },
        txt: { strings: ['SII=5000', 'SAI=300'], expires: now + 4500000 },
        host: { name: HOST, a: new Map([['192.168.1.10', now + 120000]]), aaaa: new Map([['fe80:0:0:0:0:0:0:1', now + 120000]]) },
      });
      expect(instance()?.host).toBe(host());
      expect(added).toHaveBeenCalledTimes(1);
      expect(added).toHaveBeenCalledWith(instance());
    });

    it('should keep the instances of a host apart, each with its port and subtypes, when they share the host and its addresses', async () => {
      const created = await startScanner();
      const added = vi.fn();
      const updated = vi.fn();
      created.on('added', added);
      created.on('updated', updated);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL), ptr('_I8FC7772401CD0696._sub._matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)]));
      inject(
        buildPacket(
          [ptr('_matterc._udp.local', COMMISSIONABLE), ptr('_L3840._sub._matterc._udp.local', COMMISSIONABLE)],
          [srv(COMMISSIONABLE, HOST, 120, 5541), a(HOST, '192.168.1.10')],
        ),
        'ipv6',
      );
      expect(added.mock.calls.map((call) => (call[0] as MdnsScannerInstance).name)).toEqual([OPERATIONAL, COMMISSIONABLE]);
      // The address of the shared host is an update of the instance already known
      expect(updated.mock.calls.map((call) => (call[0] as MdnsScannerInstance).name)).toEqual([OPERATIONAL]);
      expect(created.instances.size).toBe(2);
      expect(created.hosts.size).toBe(1);
      expect(instance()).toMatchObject({ type: 'operational', srv: { port: 5540, target: HOST } });
      expect(instance(COMMISSIONABLE)).toMatchObject({ type: 'commissionable', service: '_matterc._udp', srv: { port: 5541, target: HOST } });
      expect([...(instance()?.subtypes.keys() ?? [])]).toEqual(['_I8FC7772401CD0696']);
      expect([...(instance(COMMISSIONABLE)?.subtypes.keys() ?? [])]).toEqual(['_L3840']);
      expect(instance()?.host).toBe(host());
      expect(instance(COMMISSIONABLE)?.host).toBe(host());
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
    });

    it('should take the SRV and TXT records received last when an instance has several, and not report a refresh as an update', async () => {
      const created = await startScanner({ refresh: false });
      const updated = vi.fn();
      created.on('updated', updated);
      inject(
        buildPacket([
          { ...srv(OPERATIONAL, HOST, 4500), flush: false },
          { ...txt(OPERATIONAL, ['DN=Kitchen']), flush: false },
        ]),
      );
      vi.advanceTimersByTime(2000);
      inject(
        buildPacket([
          { ...srv(OPERATIONAL, HOST, 4500), flush: false },
          { ...txt(OPERATIONAL, ['DN=Kitchen']), flush: false },
        ]),
      );
      expect(updated).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      // The same instance on another port and with a TXT value in another case: new records, not a refresh of the first ones
      inject(
        buildPacket([
          { ...srv(OPERATIONAL, HOST, 120, 5541), flush: false },
          { ...txt(OPERATIONAL, ['DN=kitchen'], 120), flush: false },
        ]),
      );
      expect(updated).toHaveBeenCalledTimes(1);
      expect(instance()?.srv?.port).toBe(5541);
      expect(instance()?.txt?.strings).toEqual(['DN=kitchen']);
      expect(created.instances.size).toBe(1);
      vi.advanceTimersByTime(120000); // Only the first records are left
      expect(instance()?.srv?.port).toBe(5540);
      expect(instance()?.txt?.strings).toEqual(['DN=Kitchen']);
      expect(updated).toHaveBeenCalledTimes(2);
    });

    it('should take the SRV and TXT records refreshed last, even when they were cached first', async () => {
      await startScanner({ refresh: false });
      inject(
        buildPacket([
          { ...srv(OPERATIONAL, HOST, 4500), flush: false },
          { ...txt(OPERATIONAL, ['DN=First']), flush: false },
        ]),
      );
      vi.advanceTimersByTime(1000);
      inject(
        buildPacket([
          { ...srv(OPERATIONAL, HOST, 4500, 5541), flush: false },
          { ...txt(OPERATIONAL, ['DN=Second']), flush: false },
        ]),
      );
      expect(instance()?.srv?.port).toBe(5541);
      expect(instance()?.txt?.strings).toEqual(['DN=Second']);
      vi.advanceTimersByTime(1000);
      inject(
        buildPacket([
          { ...srv(OPERATIONAL, HOST, 4500), flush: false },
          { ...txt(OPERATIONAL, ['DN=First']), flush: false },
        ]),
      );
      expect(instance()?.srv?.port).toBe(5540);
      expect(instance()?.txt?.strings).toEqual(['DN=First']);
      inject(buildPacket([{ ...txt(OPERATIONAL, ['DN=Second'], 0), flush: false }])); // A goodbye changes nothing until it expires
      expect(instance()?.txt?.strings).toEqual(['DN=First']);
    });

    it('should take the records of a response without the answer or the additional section', async () => {
      const created = await startScanner();
      const socket = created.sockets.ipv4;
      if (!socket) throw new Error('IPv4 socket not created');
      const decode = socket.decodeMdnsMessage.bind(socket);
      spyOn(socket, 'decodeMdnsMessage')
        .mockImplementationOnce((packet: Buffer) => ({ ...decode(packet), additionals: undefined }))
        .mockImplementationOnce((packet: Buffer) => ({ ...decode(packet), answers: undefined }));
      inject(buildPacket([srv(OPERATIONAL, HOST)], [txt(OPERATIONAL, ['T=1'])]));
      expect(instance()?.srv?.port).toBe(5540);
      expect(instance()?.txt).toBeUndefined();
      inject(buildPacket([a(HOST, '192.168.1.10')], [txt(OPERATIONAL, ['T=1'])]));
      expect(instance()?.txt?.strings).toEqual(['T=1']);
      expect(host()?.a.size).toBe(0);
    });

    it('should preserve the TXT string boundaries, and take the last record of a packet', async () => {
      await startScanner();
      inject(
        buildPacket(
          [ptr('_matterc._udp.local', COMMISSIONABLE)],
          [
            srv(COMMISSIONABLE, HOST),
            { ...txt(COMMISSIONABLE, ['PI=Press', 'DN=Fake', 'D=840']), flush: false },
            { ...txt(COMMISSIONABLE, ['PI=Press, DN=Fake', 'D=840']), flush: false },
          ],
        ),
      );
      expect(instance(COMMISSIONABLE)?.txt?.strings).toEqual(['PI=Press, DN=Fake', 'D=840']);
    });

    it('should add the addresses of a known target received later, and ignore the addresses of other hosts', async () => {
      const created = await startScanner();
      inject(buildPacket([a(HOST, '192.168.1.10')])); // Target not known yet
      inject(buildPacket([srv(OPERATIONAL, HOST)]));
      expect(host()?.a.size).toBe(0);
      inject(buildPacket([a(HOST, '192.168.1.10'), a('other.local', '192.168.1.20')]));
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      expect(created.hosts.size).toBe(1);
    });

    it('should ignore the other services, the queries, the non-IN classes and the malformed packets', async () => {
      const created = await startScanner();
      inject(buildPacket([ptr('_http._tcp.local', 'x._http._tcp.local'), ptr('_services._dns-sd._udp.local', '_matter._tcp.local')], [srv('x._http._tcp.local', HOST)]));
      inject(buildPacket([ptr('_matter._tcp.local', 'x._http._tcp.local')])); // Pointing to another service
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)], 0)); // Known answers of a query
      inject(buildPacket([{ ...srv(OPERATIONAL, HOST), rclass: DnsClass.CH }]));
      inject(Buffer.from([0, 0, 0x84, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0xff]));
      expect(created.instances.size).toBe(0);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Ignoring malformed packet from 192.168.1.99'));
    });

    it('should take only the single label instances and subtypes, not the subtype owners or the names with more labels (RFC 6763 §4.1, §7.1)', async () => {
      const created = await startScanner();
      inject(
        buildPacket(
          [
            ptr('_matter._tcp.local', OPERATIONAL),
            ptr('_IC._sub._matter._tcp.local', OPERATIONAL),
            ptr('_x\\.y._sub._matter._tcp.local', OPERATIONAL), // One label with an escaped dot
            ptr('a.b._sub._matter._tcp.local', OPERATIONAL),
            ptr('_matter._tcp.local', 'a.b._matter._tcp.local'),
          ],
          [
            srv(OPERATIONAL, HOST),
            txt('_IC._sub._matter._tcp.local', ['IC=1']), // Matter 1.6.1 Core § 4.3.2.7: the TXT record of the subtype
            srv('a.b._matter._tcp.local', HOST),
            srv('foo\\._matter._tcp.local', HOST), // The dot before the service is escaped: one label foo._matter
          ],
        ),
      );
      expect([...created.instances.values()].map((entry) => entry.name)).toEqual([OPERATIONAL]);
      expect(instance()?.ptrExpires).toBeDefined();
      expect([...(instance()?.subtypes.keys() ?? [])].toSorted()).toEqual(['_IC', '_x\\.y']);
    });

    it('should ignore the responses not sent from the mDNS port (RFC 6762 §6)', async () => {
      const created = await startScanner();
      const packet = buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST)]);
      created.sockets.ipv4?.socket.emit('message', packet, { address: '192.168.1.99', family: 'IPv4', port: created.mdnsPort + 1, size: packet.length });
      expect(created.instances.size).toBe(0);
      inject(packet);
      expect(created.instances.size).toBe(1);
    });

    it('should ignore an SRV record whose data cannot be decoded', async () => {
      const created = await startScanner();
      inject(buildPacket([{ name: OPERATIONAL, type: DnsRecordType.SRV, ttl: 120, rdata: Buffer.alloc(4) }]));
      expect(created.instances.size).toBe(0);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Invalid SRV record length'));
    });

    it('should ignore the packets received after stop', async () => {
      const created = await startScanner();
      const socket = created.sockets.ipv4?.socket;
      await created.stop();
      socket?.emit('message', buildPacket([srv(OPERATIONAL, HOST)]), { address: '192.168.1.99', family: 'IPv4', port: created.mdnsPort, size: 0 });
      expect(created.instances.size).toBe(0);
    });
  });

  describe('link-local zones', () => {
    const ipv4Info = (address: string, cidr: string | null = `${address}/24`, internal = false): os.NetworkInterfaceInfo => ({
      address,
      netmask: '255.255.255.0',
      family: 'IPv4',
      mac: '00:00:00:00:00:00',
      internal,
      cidr,
    });
    const ipv6Info = (address: string, scopeid: number): os.NetworkInterfaceInfo => ({
      address,
      netmask: 'ffff:ffff:ffff:ffff::',
      family: 'IPv6',
      mac: '00:00:00:00:00:00',
      internal: false,
      cidr: `${address}/64`,
      scopeid,
    });
    const OTHER = 'OTHER.local';
    const advertisement = (target = HOST): Buffer =>
      buildPacket([srv(`${target.replace('.local', '')}-${OPERATIONAL}`, target)], [aaaa(target, 'fe80::1'), aaaa(target, '2001:db8::1')]);
    const addresses = (target = HOST): string[] => [...(host(target)?.aaaa.keys() ?? [])];

    it('should take the zone of a link-local sender, and leave the routable addresses as they are', async () => {
      const created = await startScanner();
      const packet = advertisement();
      created.sockets.ipv6?.socket.emit('message', packet, { address: 'fe80::1234%en5', family: 'IPv6', port: created.mdnsPort, size: packet.length });
      expect(addresses()).toEqual(['fe80:0:0:0:0:0:0:1%en5', '2001:db8:0:0:0:0:0:1']);
    });

    it('should keep the same link-local address received on two interfaces as two addresses', async () => {
      const created = await startScanner();
      const packet = advertisement();
      for (const zone of ['%en0', '%en1']) {
        created.sockets.ipv6?.socket.emit('message', packet, { address: `fe80::1234${zone}`, family: 'IPv6', port: created.mdnsPort, size: packet.length });
      }
      expect(addresses()).toEqual(['fe80:0:0:0:0:0:0:1%en0', '2001:db8:0:0:0:0:0:1', 'fe80:0:0:0:0:0:0:1%en1']);
    });

    it.each(['linux', 'win32'] as const)('should use the zone of the subnet matching the sender on %s', async (platform) => {
      const created = await startScanner();
      mockPlatform(platform);
      mockInterfaces({
        lo0: [ipv4Info('192.168.1.1', '192.168.1.1/24', true)],
        eth7: [ipv4Info('192.168.1.2'), ipv6Info('fe80::2', 7)],
        eth8: [ipv4Info('10.0.0.2', null), ipv6Info('2001:db8::2', 8)],
        eth9: undefined,
      });
      inject(advertisement()); // From 192.168.1.99
      expect(addresses()).toEqual([`fe80:0:0:0:0:0:0:1%${platform === 'win32' ? '7' : 'eth7'}`, '2001:db8:0:0:0:0:0:1']);
      const packet = advertisement(OTHER);
      created.sockets.ipv6?.socket.emit('message', packet, { address: '2001:db8::5', family: 'IPv6', port: created.mdnsPort, size: packet.length });
      expect(addresses(OTHER)).toEqual([`fe80:0:0:0:0:0:0:1%${platform === 'win32' ? '8' : 'eth8'}`, '2001:db8:0:0:0:0:0:1']);
    });

    it('should use the interface index as the zone on Windows, and no zone without an IPv6 index', async () => {
      await startScanner();
      mockPlatform('win32');
      mockInterfaces({ eth7: [ipv4Info('192.168.1.2'), ipv6Info('fe80::2', 7)] });
      inject(advertisement());
      expect(addresses()).toEqual(['fe80:0:0:0:0:0:0:1%7', '2001:db8:0:0:0:0:0:1']);
      mockInterfaces({ eth7: [ipv4Info('192.168.1.2')] });
      inject(advertisement(OTHER));
      expect(addresses(OTHER)).toEqual(['fe80:0:0:0:0:0:0:1', '2001:db8:0:0:0:0:0:1']);
    });

    it('should leave a link-local address without zone when no interface or more than one holds the sender', async () => {
      const created = await startScanner();
      mockInterfaces({ eth7: [ipv4Info('10.0.0.2')] });
      inject(advertisement());
      expect(addresses()).toEqual(['fe80:0:0:0:0:0:0:1', '2001:db8:0:0:0:0:0:1']);
      mockInterfaces({ eth7: [ipv4Info('192.168.1.2')], eth8: [ipv4Info('192.168.1.3')] });
      inject(advertisement(OTHER));
      expect(addresses(OTHER)).toEqual(['fe80:0:0:0:0:0:0:1', '2001:db8:0:0:0:0:0:1']);
    });

    it.each(['linux', 'win32'] as const)('should use the zone of the selected interface on %s', async (platform) => {
      const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => info.family === 'IPv4' && !info.internal))?.[0];
      if (!interfaceName) return; // No usable interface on this host
      await startScanner({ interfaceName, enableIpv6: false });
      mockPlatform(platform);
      mockInterfaces({ [interfaceName]: [ipv6Info('fe80::2', 7)] });
      inject(advertisement());
      expect(addresses()).toEqual([`fe80:0:0:0:0:0:0:1%${platform === 'win32' ? '7' : interfaceName}`, '2001:db8:0:0:0:0:0:1']);
    });
  });

  describe('expiry', () => {
    it('should remove the instance on the goodbye of its records and an address on its goodbye', async () => {
      const created = await startScanner();
      const removed = vi.fn();
      created.on('removed', removed);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10'), a(HOST, '192.168.1.11', 120, false)]));
      inject(buildPacket([a(HOST, '192.168.1.11', 0)]));
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.168.1.10', '192.168.1.11']); // RFC 6762 §10.1: deleted one second later
      vi.advanceTimersByTime(2000);
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      inject(buildPacket([a(HOST, '192.168.1.99', 0)])); // Goodbye of an unknown record
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 0)], [srv(OPERATIONAL, HOST, 0)]));
      expect(created.instances.size).toBe(1);
      vi.advanceTimersByTime(2000);
      expect(created.instances.size).toBe(0);
      expect(created.hosts.size).toBe(0);
      expect(removed).toHaveBeenCalledTimes(1);
      expect((removed.mock.calls[0][0] as MdnsScannerInstance).name).toBe(OPERATIONAL);
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
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
      expect(added).toHaveBeenCalledTimes(1);
      expect(removed).not.toHaveBeenCalled();
    });

    it('should expire the records when their TTL has elapsed, and remove the instance with its last record', async () => {
      const created = await startScanner({ refresh: false });
      const updated = vi.fn();
      const removed = vi.fn();
      created.on('updated', updated);
      created.on('removed', removed);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST, 120), a(HOST, '192.168.1.10', 60)]));
      vi.advanceTimersByTime(60000);
      expect(host()?.a.size).toBe(0);
      expect(updated).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(60000);
      // The PTR record is still cached: the instance stays, without its SRV record and its host
      expect(instance()?.srv).toBeUndefined();
      expect(instance()?.host).toBeUndefined();
      expect(instance()?.ptrExpires).toBe(Date.now() + 4380000);
      expect(created.hosts.size).toBe(0);
      expect(updated).toHaveBeenCalledTimes(2);
      expect(removed).not.toHaveBeenCalled();
      inject(buildPacket([srv(OPERATIONAL, HOST, 120, 5541)]));
      expect(instance()?.srv?.port).toBe(5541);
      vi.advanceTimersByTime(4380000);
      expect(created.instances.size).toBe(0);
      expect(removed).toHaveBeenCalledTimes(1);
    });

    it('should expire in one second the records of a set flushed by a cache-flush record (RFC 6762 §10.2)', async () => {
      await startScanner();
      inject(buildPacket([srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10')]));
      inject(buildPacket([a(HOST, '192.168.1.11')])); // Received less than one second later: kept
      expect(host()?.a.size).toBe(2);
      vi.advanceTimersByTime(2000);
      inject(buildPacket([a(HOST, '192.168.1.12')]));
      expect(host()?.a.get('192.168.1.10')).toBe(Date.now() + 1000);
      vi.advanceTimersByTime(1000);
      expect([...(host()?.a.keys() ?? [])]).toEqual(['192.168.1.12']);
    });
  });

  describe('logs', () => {
    it('should log the hosts and their instances every minute', async () => {
      await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), aaaa(HOST, 'fe80::1')]));
      inject(buildPacket([srv(COMMISSIONABLE, 'A0000000000000.local')]));
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(59000);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Advertising'));
      vi.advanceTimersByTime(1000);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Advertising'));
      const lines = loggerLogSpy.mock.calls.map((call) => call[1]);
      expect(lines.some((line) => line.includes('Advertising') && line.includes('instances on') && line.includes('hosts'))).toBe(true);
      expect(lines.some((line) => line.includes(`${OPERATIONAL}:5540`) && line.includes('operational'))).toBe(true);
      expect(lines.some((line) => line.includes('    PTR ') && line.includes('4440') && line.includes('subtypes none'))).toBe(true);
      expect(lines.some((line) => line.includes('    PTR none'))).toBe(true);
      expect(lines.some((line) => line.includes('fe80:0:0:0:0:0:0:1') && line.includes('60'))).toBe(true);
      expect(lines.some((line) => line.includes('  A none'))).toBe(true);
      expect(lines.findIndex((line) => line.includes('A0000000000000.local'))).toBeLessThan(lines.findIndex((line) => line.includes(HOST)));
      expect(lines.some((line) => line.startsWith('- ') && line.includes(HOST) && line.includes('operational'))).toBe(true);
      expect(lines.some((line) => line.startsWith('- ') && line.includes('A0000000000000.local') && line.includes('commissionable'))).toBe(true);
      expect(lines.some((line) => line.includes('no SRV record'))).toBe(false);
    });

    it('should log the SRV, the TXT strings and the subtypes of the instances, and the instances without an SRV record apart', async () => {
      const created = await startScanner({ services: ['_matter._tcp', '_matterc._udp'] });
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['SII=5000', 'SAI=300']), txt('other._matter._tcp.local', ['T=1'])]));
      inject(buildPacket([ptr('_L840._sub._matterc._udp.local', COMMISSIONABLE)], [srv(COMMISSIONABLE, HOST, 120, 5541)]));
      loggerLogSpy.mockClear();
      created.logInstances();
      const lines = loggerLogSpy.mock.calls.map((call) => call[1]);
      expect(lines.some((line) => line.startsWith('- ') && line.includes(HOST) && line.includes('commissionable, operational'))).toBe(true);
      expect(lines.some((line) => line.includes('    SRV ') && line.includes(`${HOST}:5540 priority 0 weight 0`) && line.includes('120'))).toBe(true);
      expect(lines.some((line) => line.includes('    SRV ') && line.includes(`${HOST}:5541`))).toBe(true);
      expect(lines.some((line) => line.includes('    TXT ') && line.includes('SII=5000, SAI=300') && line.includes('4500'))).toBe(true);
      expect(lines.some((line) => line.includes('    PTR none subtypes ') && line.includes('_L840'))).toBe(true);
      const unresolved = lines.findIndex((line) => line.includes('no SRV record'));
      expect(lines.slice(unresolved).some((line) => line.includes('other._matter._tcp.local'))).toBe(true);
      expect(lines.slice(unresolved).some((line) => line.includes('    SRV none'))).toBe(true);
      expect(lines.slice(0, unresolved).some((line) => line.includes('    TXT none'))).toBe(true);
    });

    it('should show every kind of the host, and the service type for the other services', async () => {
      const created = await startScanner({ services: ['_matterc._udp', '_matter._tcp', '_matterd._udp', '_http._tcp'] });
      inject(buildPacket([srv(OPERATIONAL, HOST), srv(COMMISSIONABLE, HOST), srv('TV._matterd._udp.local', HOST), srv('web._http._tcp.local', HOST)]));
      expect([...created.instances.values()].map((found) => found.type).toSorted()).toEqual(['_http._tcp', 'commissionable', 'commissioner', 'operational']);
      expect(instance('web._http._tcp.local')?.service).toBe('_http._tcp');
      loggerLogSpy.mockClear();
      created.logInstances();
      expect(loggerLogSpy.mock.calls.some((call) => call[1].includes(HOST) && call[1].includes('_http._tcp, commissionable, commissioner, operational'))).toBe(true);
    });

    it('should expire the records before logging them', async () => {
      const created = await startScanner();
      inject(buildPacket([srv(OPERATIONAL, HOST, 10)]));
      const now = spyOn(Date, 'now').mockReturnValue(Date.now() + 10000); // Expired, but the expire timer has not run yet
      loggerLogSpy.mockClear();
      created.logInstances();
      now.mockRestore();
      expect(created.instances.size).toBe(0);
      expect(loggerLogSpy.mock.calls.some((call) => call[1].includes(HOST))).toBe(false);
    });

    it('should not log the instances when the log interval is 0', async () => {
      await startScanner({ logIntervalMs: 0 });
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(120000);
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Advertising'));
    });
  });

  describe('refresh', () => {
    let random = spyOn(Math, 'random');

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
      random = spyOn(Math, 'random').mockReturnValue(0); // No jitter: the refresh queries at exactly 80, 85, 90 and 95% of the TTL
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
      expect(created.instances.size).toBe(0);
      vi.advanceTimersByTime(120000);
      expect(queries()).toHaveLength(16);
    });

    it('should keep an instance whose records are refreshed by the answers', async () => {
      const created = await startScanner();
      const announcement = buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 120)], [srv(OPERATIONAL, HOST), a(HOST, '192.168.1.10')]);
      inject(announcement);
      vi.advanceTimersByTime(96000);
      expect(queries()).toHaveLength(3); // PTR, SRV and A
      inject(announcement); // The answer to the refresh queries
      vi.advanceTimersByTime(60000); // 156 s: past the first TTL, before the next 80%
      expect(created.instances.size).toBe(1);
      expect(queries()).toHaveLength(3);
      vi.advanceTimersByTime(36000); // 192 s: 80% of the refreshed TTL
      expect(queries()).toHaveLength(6);
    });

    it('should send the records with more than half of their TTL left as known answers', async () => {
      await startScanner();
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL, 120)], [srv(OPERATIONAL, HOST, 4500)]));
      inject(buildPacket([ptr('_matter._tcp.local', 'second._matter._tcp.local')], [srv('second._matter._tcp.local', HOST, 4500), txt('second._matter._tcp.local', ['T=1'])]));
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
      const instanceName = (index: number): string => `${String(index).padStart(16, '0')}-${'F'.repeat(16)}._matter._tcp.local`;
      const names = Array.from({ length: 79 }, (_, index) => instanceName(index + 1));
      inject(buildPacket([ptr('_matter._tcp.local', instanceName(0), 120)]));
      inject(buildPacket(names.map((name) => ptr('_matter._tcp.local', name))));
      inject(buildPacket(names.flatMap((name) => [srv(name, HOST, 4500), txt(name, ['T=1'])]))); // Resolved, so their PTR records are known answers
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
      expect(created.instances.size).toBe(1);
    });
  });

  describe('resolve', () => {
    let random = spyOn(Math, 'random');

    /**
     * Returns the questions of the queries sent, with their unicast-response bit, and forgets them.
     *
     * @returns {[string, DnsRecordType, boolean][]} The questions.
     */
    function questions(): [string, DnsRecordType, boolean][] {
      const asked = sent.flatMap((packet) => codec.decodeMdnsMessage(packet.msg).questions ?? []);
      sent = [];
      return asked.map((question) => [question.name, question.type, question.unicastResponse]);
    }

    beforeEach(() => {
      random = spyOn(Math, 'random').mockReturnValue(0); // No jitter: the first lookup query 20 ms after the record is found lacking
    });

    afterEach(() => {
      random.mockRestore();
    });

    it('should query the SRV and TXT records an instance lacks, then the A and AAAA records its target lacks', async () => {
      const created = await startScanner({ resolve: true, enableIpv6: false });
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)])); // A PTR answer without the additional records (RFC 6763 §12.1)
      expect(instance()?.ptrExpires).toBeDefined();
      expect(instance()?.srv).toBeUndefined();
      expect(instance()?.txt).toBeUndefined();
      vi.advanceTimersByTime(19);
      expect(sent).toHaveLength(0);
      vi.advanceTimersByTime(1);
      // The first query of a record asks for a unicast response (RFC 6762 §5.4)
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.TXT, true],
      ]);
      inject(buildPacket([srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['T=1'])]));
      vi.advanceTimersByTime(20);
      expect(questions()).toEqual([
        [HOST, DnsRecordType.A, true],
        [HOST, DnsRecordType.AAAA, true],
      ]);
      inject(buildPacket([a(HOST, '192.168.1.10')]));
      vi.advanceTimersByTime(1000);
      expect(questions()).toEqual([[HOST, DnsRecordType.AAAA, false]]);
      vi.advanceTimersByTime(2000);
      expect(questions()).toEqual([[HOST, DnsRecordType.AAAA, false]]);
      // An IPv4 only host: the AAAA record is no longer queried, and the instance stays
      vi.advanceTimersByTime(30000);
      expect(questions()).toEqual([]);
      expect(created.instances.size).toBe(1);
      expect([...(instance()?.host?.a.keys() ?? [])]).toEqual(['192.168.1.10']);
    });

    it('should query only the SRV and TXT records of queryInstance, with QU the first time, until its SRV record is cached', async () => {
      const created = await startScanner({ queryInstance: OPERATIONAL, resolve: true, enableIpv6: false });
      created.sendQuery();
      // The first query asks for a unicast response (RFC 6762 §5.4), the next ones for multicast responses
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.TXT, true],
      ]);
      created.sendQuery();
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, false],
        [OPERATIONAL, DnsRecordType.TXT, false],
      ]);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)], [srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['T=1'])]));
      expect(instance()?.srv).toBeDefined();
      sent = [];
      // Once SRV is cached, the lookup and refresh timers maintain its records
      created.sendQuery();
      expect(questions()).toEqual([]);
    });

    it('should drop an instance whose SRV record is not answered (RFC 6762 §10.4)', async () => {
      const created = await startScanner({ resolve: true, enableIpv6: false, refresh: false });
      const removed = vi.fn();
      created.on('removed', removed);
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL), ptr('_matter._tcp.local', 'alive._matter._tcp.local')], [txt(OPERATIONAL, ['T=1'])]));
      inject(buildPacket([srv('alive._matter._tcp.local', HOST), txt('alive._matter._tcp.local', ['T=1']), a(HOST, '192.168.1.10'), aaaa(HOST, '2001:db8::1')]));
      vi.advanceTimersByTime(3020); // The queries at 20 ms, 1 s and 2 s later
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.SRV, false],
        [OPERATIONAL, DnsRecordType.SRV, false],
      ]);
      vi.advanceTimersByTime(3999);
      expect(created.instances.size).toBe(2);
      vi.advanceTimersByTime(1);
      expect([...created.instances.keys()]).toEqual(['alive._matter._tcp.local']);
      expect(removed.mock.calls.map((call) => (call[0] as MdnsScannerInstance).name)).toEqual([OPERATIONAL]);
      vi.advanceTimersByTime(30000);
      expect(questions()).toEqual([]);
    });

    it('should query again the SRV, TXT, A and AAAA records of a known instance when requery is called', async () => {
      const created = await startScanner({ enableIpv6: false });
      expect(created.requery(OPERATIONAL)).toBe(false); // Not known
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)]));
      expect(created.requery(OPERATIONAL.toUpperCase())).toBe(true);
      // Without an SRV record there is no host to query
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.TXT, true],
      ]);
      inject(buildPacket([srv(OPERATIONAL, HOST), txt(OPERATIONAL, ['T=1']), a(HOST, '192.168.1.10')]));
      expect(created.requery(OPERATIONAL)).toBe(true);
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.TXT, true],
        [HOST, DnsRecordType.A, true],
        [HOST, DnsRecordType.AAAA, true],
      ]);
      // The queries carry no known answers, so the responder answers all of them (RFC 6762 §7.1)
      created.requery(OPERATIONAL);
      expect(sent.flatMap((packet) => codec.decodeMdnsMessage(packet.msg).answers ?? [])).toEqual([]);
      // An answer with a new address updates the instance as usual
      const updated = vi.fn();
      created.on('updated', updated);
      inject(buildPacket([a(HOST, '192.168.1.10'), a(HOST, '192.168.1.20', 120, false)]));
      expect(updated).toHaveBeenCalledTimes(1);
      expect([...(instance()?.host?.a.keys() ?? [])]).toEqual(['192.168.1.10', '192.168.1.20']);
      sent = [];
      await created.stop();
      expect(created.requery(OPERATIONAL)).toBe(false);
      expect(sent).toHaveLength(0);
    });

    it('should send only the lookup queries that are due', async () => {
      await startScanner({ resolve: true, enableIpv6: false, refresh: false });
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)]));
      vi.advanceTimersByTime(20);
      expect(questions()).toEqual([
        [OPERATIONAL, DnsRecordType.SRV, true],
        [OPERATIONAL, DnsRecordType.TXT, true],
      ]);
      vi.advanceTimersByTime(100);
      inject(buildPacket([ptr('_matter._tcp.local', 'second._matter._tcp.local')]));
      vi.advanceTimersByTime(20); // The lookups of the first instance are due 1 s after their first query
      expect(questions()).toEqual([
        ['second._matter._tcp.local', DnsRecordType.SRV, true],
        ['second._matter._tcp.local', DnsRecordType.TXT, true],
      ]);
    });

    it('should not query again before the scanner is started', async () => {
      const created = new MdnsScanner({ mdnsPort: await getFreePort('udp') });
      expect(created.requery(OPERATIONAL)).toBe(false);
    });

    it('should not send the lookup queries after stop', async () => {
      const created = await startScanner({ resolve: true });
      inject(buildPacket([ptr('_matter._tcp.local', OPERATIONAL)]));
      await created.stop();
      vi.advanceTimersByTime(10000);
      expect(sent).toHaveLength(0);
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
      const result = await runMdnsScanner(argv, { mdnsPort: await getFreePort('udp') });
      const code = process.exitCode;
      process.exitCode = exitCode ?? 0; // Bun ignores undefined, so the exit code of the test run would stay 2
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
      const sendQuery = spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      const sigint = process.listenerCount('SIGINT');
      const created = await runMdnsScanner(['--interface', interfaceName ?? '', '--query'], { mdnsPort: await getFreePort('udp'), enableIpv6: false });
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
      const sendQuery = spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      scanner = await runMdnsScanner([], { mdnsPort: await getFreePort('udp') });
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
      scanner = await runMdnsScanner(['--service', '_matter._tcp', '--service', '_http._tcp', '--no-resolve', '--no-refresh', '--log-interval', '0', '--no-ipv6', '--debug'], {
        mdnsPort: await getFreePort('udp'),
      });
      expect(scanner?.services).toEqual(['_matter._tcp', '_http._tcp']);
      expect(scanner?.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(scanner?.sockets.ipv6).toBeUndefined();
      expect(scanner?.log.logLevel).toBe(LogLevel.DEBUG);
      // --no-resolve, --no-refresh and --log-interval 0: no lookup query, no refresh query and no log of the instances
      const ipv4 = scanner?.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      const send = spyOn(ipv4, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      scanner?.sockets.ipv4?.socket.emit('message', buildPacket([srv(OPERATIONAL, HOST)]), {
        address: '192.168.1.99',
        family: 'IPv4',
        port: scanner?.mdnsPort ?? 5353,
        size: 0,
      } satisfies dgram.RemoteInfo);
      expect(scanner?.instances.size).toBe(1);
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(119000);
      expect(send).not.toHaveBeenCalled();
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Advertising'));
      removeListeners();
    });

    it('should log at debug level with --verbose and only on IPv6 with --no-ipv4', async () => {
      scanner = await runMdnsScanner(['--verbose', '--no-ipv4', '--log-interval', '30'], { mdnsPort: await getFreePort('udp') });
      expect(scanner?.sockets.ipv4).toBeUndefined();
      expect(scanner?.sockets.ipv6).toBeInstanceOf(Mdns);
      expect(scanner?.log.logLevel).toBe(LogLevel.DEBUG);
      loggerLogSpy.mockClear();
      vi.advanceTimersByTime(30000);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Advertising'));
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

    it('should take the query interval of --query=<seconds>', async () => {
      const sendQuery = spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      scanner = await runMdnsScanner(['--query=5', '--no-ipv6'], { mdnsPort: await getFreePort('udp') });
      expect((scanner as unknown as { queryIntervalMs: number }).queryIntervalMs).toBe(5000);
      expect(sendQuery).toHaveBeenCalledTimes(4); // One query per service
      removeListeners();
      sendQuery.mockRestore();
    });

    it('should report an unknown option', async () => {
      expect(await runWithError(['--unknown'])).toContain('--unknown');
    });

    it('should report an invalid log interval', async () => {
      expect(await runWithError(['--log-interval', 'abc'])).toContain('invalid --log-interval abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--log-interval=-1'])).toContain('invalid --log-interval -1');
    });

    it('should report a query or a log interval longer than a timer can wait', async () => {
      expect(await runWithError(['--query', '3000000'])).toContain('invalid --query 3000000');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--log-interval=3000000'])).toContain('invalid --log-interval 3000000');
    });

    it('should report an invalid service', async () => {
      expect(await runWithError(['--service', '_matter.tcp'])).toContain('invalid service _matter.tcp');
    });

    it('should report the scanner errors', async () => {
      expect(await runWithError(['--no-ipv4', '--no-ipv6'])).toContain('at least one of IPv4 and IPv6 must be enabled');
    });
  });
});
