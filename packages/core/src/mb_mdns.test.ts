import os from 'node:os';

import { jest } from '@jest/globals';
import { originalProcessArgv, setupTest } from '@matterbridge/jest-utils';

const mockMdnsInstances: MockMdns[] = [];
const scheduledIntervals: Array<{ callback: () => void; delay: number | undefined; unref: jest.Mock }> = [];
const scheduledTimeouts: Array<{ callback: () => void; delay: number | undefined; unref: jest.Mock }> = [];

class MockMdns {
  static clear() {
    mockMdnsInstances.length = 0;
  }

  readonly constructorArgs: unknown[];
  readonly interfaceName?: string;
  readonly filters: string[] = [];
  readonly ipFilters: string[] = [];
  readonly socket = {
    setMulticastLoopback: jest.fn(),
  };
  readonly log = {
    info: jest.fn(),
    error: jest.fn(),
  };
  readonly start = jest.fn();
  readonly stop = jest.fn();
  readonly listNetworkInterfaces = jest.fn();
  readonly logDevices = jest.fn();
  readonly sendQuery = jest.fn();
  readonly sendResponse = jest.fn();
  readonly encodeDnsName = jest.fn((value: string) => Buffer.from(value));
  readonly encodeSrvRdata = jest.fn((priority: number, weight: number, port: number, host: string) => Buffer.from(`${priority}:${weight}:${port}:${host}`));
  readonly encodeTxtRdata = jest.fn((values: string[]) => Buffer.from(values.join(',')));
  readonly encodeA = jest.fn((value: string) => Buffer.from(value));
  readonly encodeAAAA = jest.fn((value: string) => Buffer.from(value));
  private readonly eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(...args: unknown[]) {
    this.constructorArgs = args;
    this.interfaceName = args[5] as string | undefined;
    mockMdnsInstances.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    const handlers = this.eventHandlers.get(event) ?? [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.eventHandlers.get(event) ?? []) handler(...args);
  }
}

jest.unstable_mockModule('@matterbridge/dgram', async () => ({
  DnsClass: { IN: 1 },
  DnsClassFlag: { FLUSH: 32768 },
  DnsRecordType: { A: 1, PTR: 12, TXT: 16, AAAA: 28, SRV: 33 },
  Mdns: MockMdns,
  MDNS_MULTICAST_IPV4_ADDRESS: '224.0.0.251',
  MDNS_MULTICAST_IPV6_ADDRESS: 'ff02::fb',
  MDNS_MULTICAST_PORT: 5353,
}));

const {
  MB_MDNS_CLEANUP_DELAY_MS,
  MB_MDNS_DEFAULT_INTERVAL_MS,
  MB_MDNS_DEFAULT_TIMEOUT_MS,
  advertiseMatterbridgeService,
  getMbMdnsHelpText,
  getMbMdnsOptions,
  mbMdnsMain,
  printMbMdnsHelp,
  sendMdnsQuery,
  startMbMdns,
} = await import('./mb_mdns.js');

await setupTest('MbMdns', false);

describe('mb_mdns', () => {
  beforeEach(() => {
    MockMdns.clear();
    scheduledIntervals.length = 0;
    scheduledTimeouts.length = 0;
    process.argv = [...originalProcessArgv.slice(0, 2)];

    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        { address: '192.168.1.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:11:22:33:44:55', internal: false, cidr: '192.168.1.10/24' },
        { address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:11:22:33:44:55', internal: false, cidr: 'fe80::1/64', scopeid: 0 },
      ],
    });

    jest.spyOn(global, 'setInterval').mockImplementation(((callback: () => void, delay?: number) => {
      const timer = { unref: jest.fn() };
      scheduledIntervals.push({ callback, delay, unref: timer.unref });
      return timer as unknown as ReturnType<typeof setInterval>;
    }) as typeof setInterval);

    jest.spyOn(global, 'setTimeout').mockImplementation(((callback: () => void, delay?: number) => {
      const timer = { unref: jest.fn() };
      scheduledTimeouts.push({ callback, delay, unref: timer.unref });
      return timer as unknown as ReturnType<typeof setTimeout>;
    }) as typeof setTimeout);
  });

  afterEach(() => {
    process.argv = [...originalProcessArgv];
    jest.restoreAllMocks();
  });

  test('parses CLI options', () => {
    process.argv = [
      'node',
      'mb_mdns',
      '--advertise',
      '5000',
      '--query',
      '--interfaceName',
      'eth0',
      '--ipv4InterfaceAddress',
      '192.168.1.20',
      '--ipv6InterfaceAddress',
      '::1',
      '--outgoingIpv4InterfaceAddress',
      '192.168.1.21',
      '--outgoingIpv6InterfaceAddress',
      'fe80::2',
      '--unicast',
      '--filter',
      '_matter._tcp',
      '_matterc._udp',
      '--ip-filter',
      '192.168.1.30',
      'fe80::3',
      '--no-loopback',
      '--noIpv6',
      '--no-timeout',
      '--verbose',
    ];

    expect(getMbMdnsOptions()).toEqual({
      showHelp: false,
      interfaceName: 'eth0',
      ipv4InterfaceAddress: '192.168.1.20',
      ipv6InterfaceAddress: '::1',
      outgoingIpv4InterfaceAddress: '192.168.1.21',
      outgoingIpv6InterfaceAddress: 'fe80::2',
      advertiseIntervalMs: 5000,
      queryIntervalMs: MB_MDNS_DEFAULT_INTERVAL_MS,
      unicast: true,
      filters: ['_matter._tcp', '_matterc._udp'],
      ipFilters: ['192.168.1.30', 'fe80::3'],
      disableIpv4: false,
      disableIpv6: true,
      disableLoopback: true,
      disableTimeout: true,
      verbose: true,
    });
  });

  test('prints help and exits', () => {
    process.argv = ['node', 'mb_mdns', '--help'];
    const exitFn = jest.fn();
    const logFn = jest.fn();

    expect(mbMdnsMain(exitFn as any, logFn)).toBeUndefined();
    expect(logFn).toHaveBeenCalledWith(getMbMdnsHelpText());
    expect(exitFn).toHaveBeenCalledWith(0);
    expect(mockMdnsInstances).toHaveLength(0);
  });

  test('prints help with default console logger', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    printMbMdnsHelp();

    expect(consoleLogSpy).toHaveBeenCalledWith(getMbMdnsHelpText());
  });

  test('mbMdnsMain uses default exit and log handlers for help', () => {
    process.argv = ['node', 'mb_mdns', '--help'];
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    expect(mbMdnsMain()).toBeUndefined();
    expect(consoleLogSpy).toHaveBeenCalledWith(getMbMdnsHelpText());
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('mbMdnsMain starts runtime when help is not requested', () => {
    process.argv = ['node', 'mb_mdns', '--no-timeout'];

    const runtime = mbMdnsMain(jest.fn() as any, jest.fn());

    expect(runtime).toBeDefined();
    expect(mockMdnsInstances).toHaveLength(2);
  });

  test('sendMdnsQuery logs errors from sendQuery', () => {
    const mdns = new MockMdns('mDNS Server udp4', '224.0.0.251', 5353, 'udp4', true, 'eth0', '0.0.0.0');
    mdns.sendQuery.mockImplementation(() => {
      throw new Error('query failed');
    });

    sendMdnsQuery(mdns as unknown as never, true);

    expect(mdns.log.info).toHaveBeenCalledWith('Sending mDNS query for common services...');
    expect(mdns.log.error).toHaveBeenCalledWith('Error sending mDNS query: query failed');
  });

  test('sendMdnsQuery defaults unicast responses to false', () => {
    const mdns = new MockMdns('mDNS Server udp4', '224.0.0.251', 5353, 'udp4', true, 'eth0', '0.0.0.0');

    sendMdnsQuery(mdns as unknown as never);

    const questions = mdns.sendQuery.mock.calls[0][0] as Array<{ unicastResponse: boolean }>;
    expect(questions.every((question) => question.unicastResponse === false)).toBe(true);
  });

  test('advertiseMatterbridgeService falls back to the first eligible interface and logs send errors', () => {
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      vEthernet: [{ address: '10.0.0.1', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:01', internal: false, cidr: '10.0.0.1/24' }],
      lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', mac: '00:00:00:00:00:02', internal: true, cidr: '127.0.0.1/8' }],
      eth1: [
        { address: '192.168.50.10', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:03', internal: false, cidr: '192.168.50.10/24' },
        { address: 'fe80::internal', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:03', internal: true, cidr: 'fe80::internal/64', scopeid: 0 },
        { address: 'fe80::50', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:03', internal: false, cidr: 'fe80::50/64', scopeid: 0 },
      ],
    });
    const mdns = new MockMdns('mDNS Server udp4', '224.0.0.251', 5353, 'udp4', true, 'missing', '0.0.0.0');
    mdns.sendResponse.mockImplementation(() => {
      throw new Error('advertise failed');
    });

    advertiseMatterbridgeService(mdns as unknown as never, 33);

    expect(mdns.encodeA).toHaveBeenCalledWith('192.168.50.10');
    expect(mdns.encodeAAAA).toHaveBeenCalledWith('fe80::50');
    expect(mdns.encodeAAAA).not.toHaveBeenCalledWith('fe80::internal');
    expect(mdns.log.error).toHaveBeenCalledWith('Error sending mDNS advertisement: advertise failed');
  });

  test('cleanup skips missing ipv6 advertisement when only ipv4 is enabled', async () => {
    const runtime = startMbMdns(
      {
        showHelp: false,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        outgoingIpv4InterfaceAddress: undefined,
        outgoingIpv6InterfaceAddress: undefined,
        advertiseIntervalMs: 1000,
        queryIntervalMs: undefined,
        unicast: false,
        filters: [],
        ipFilters: [],
        disableIpv4: false,
        disableIpv6: true,
        disableLoopback: false,
        disableTimeout: true,
        verbose: false,
      },
      false,
    );

    const cleanupPromise = runtime.cleanupAndLogAndExit();

    expect(mockMdnsInstances).toHaveLength(1);
    expect(mockMdnsInstances[0].sendResponse).toHaveBeenCalledTimes(1);
    expect((mockMdnsInstances[0].sendResponse.mock.calls[0][0] as Array<{ ttl: number }>).every((answer) => answer.ttl === 0)).toBe(true);

    scheduledTimeouts[0].callback();
    await Promise.resolve();
    scheduledTimeouts[1].callback();
    await cleanupPromise;
  });

  test('starts enabled listeners, schedules query and advertisement, and cleans up', async () => {
    const runtime = startMbMdns(
      {
        showHelp: false,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        outgoingIpv4InterfaceAddress: '192.168.1.11',
        outgoingIpv6InterfaceAddress: 'fe80::2',
        advertiseIntervalMs: 1000,
        queryIntervalMs: 2000,
        unicast: true,
        filters: ['_matter._tcp'],
        ipFilters: ['192.168.1.30'],
        disableIpv4: false,
        disableIpv6: false,
        disableLoopback: true,
        disableTimeout: true,
        verbose: true,
      },
      false,
    );

    expect(mockMdnsInstances).toHaveLength(2);
    expect(mockMdnsInstances[0].constructorArgs).toEqual(['mDNS Server udp4', '224.0.0.251', 5353, 'udp4', true, 'eth0', '192.168.1.10', '192.168.1.11']);
    expect(mockMdnsInstances[1].constructorArgs).toEqual(['mDNS Server udp6', 'ff02::fb', 5353, 'udp6', true, 'eth0', '::1', 'fe80::2']);
    expect(mockMdnsInstances[0].filters).toEqual(['_matter._tcp']);
    expect(mockMdnsInstances[1].filters).toEqual(['_matter._tcp']);
    expect(mockMdnsInstances[0].ipFilters).toEqual(['192.168.1.30']);
    expect(mockMdnsInstances[1].ipFilters).toEqual(['192.168.1.30']);
    expect(mockMdnsInstances[0].listNetworkInterfaces).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].listNetworkInterfaces).not.toHaveBeenCalled();

    mockMdnsInstances[0].emit('ready', { family: 'IPv4', address: '192.168.1.10', port: 5353 });
    mockMdnsInstances[1].emit('ready', { family: 'IPv6', address: '::1', port: 5353 });

    expect(mockMdnsInstances[0].socket.setMulticastLoopback).toHaveBeenCalledWith(false);
    expect(mockMdnsInstances[1].socket.setMulticastLoopback).toHaveBeenCalledWith(false);
    expect(mockMdnsInstances[0].sendQuery).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].sendQuery).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[0].sendResponse).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].sendResponse).toHaveBeenCalledTimes(1);
    expect(scheduledIntervals).toHaveLength(4);
    expect(scheduledIntervals.map(({ delay }) => delay)).toEqual([1000, 2000, 1000, 2000]);
    expect(scheduledIntervals.every(({ unref }) => unref.mock.calls.length === 1)).toBe(true);

    const ipv4Answers = mockMdnsInstances[0].sendResponse.mock.calls[0][0] as Array<{ name: string; ttl: number; rtype: number; rdata: Buffer }>;
    expect(ipv4Answers.some((answer) => answer.name === 'matterbridge.local' && answer.ttl === 120 && answer.rtype === 1 && answer.rdata.equals(Buffer.from('192.168.1.10')))).toBe(
      true,
    );
    expect(ipv4Answers.some((answer) => answer.name === 'matterbridge.local' && answer.ttl === 120 && answer.rtype === 28 && answer.rdata.equals(Buffer.from('fe80::1')))).toBe(
      true,
    );

    scheduledIntervals[0].callback();
    scheduledIntervals[1].callback();
    scheduledIntervals[2].callback();
    scheduledIntervals[3].callback();

    expect(mockMdnsInstances[0].sendResponse).toHaveBeenCalledTimes(2);
    expect(mockMdnsInstances[1].sendResponse).toHaveBeenCalledTimes(2);
    expect(mockMdnsInstances[0].sendQuery).toHaveBeenCalledTimes(2);
    expect(mockMdnsInstances[1].sendQuery).toHaveBeenCalledTimes(2);

    const cleanupPromise = runtime.cleanupAndLogAndExit();

    expect(mockMdnsInstances[0].sendResponse).toHaveBeenCalledTimes(3);
    expect(mockMdnsInstances[1].sendResponse).toHaveBeenCalledTimes(3);
    expect(scheduledTimeouts).toHaveLength(1);
    expect(scheduledTimeouts[0].delay).toBe(MB_MDNS_CLEANUP_DELAY_MS);

    scheduledTimeouts[0].callback();
    await Promise.resolve();

    expect(mockMdnsInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].stop).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[0].logDevices).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].logDevices).toHaveBeenCalledTimes(1);
    expect(scheduledTimeouts).toHaveLength(2);
    expect(scheduledTimeouts[1].delay).toBe(MB_MDNS_CLEANUP_DELAY_MS);

    scheduledTimeouts[1].callback();
    await cleanupPromise;

    const goodbyeAnswers = mockMdnsInstances[0].sendResponse.mock.calls[2][0] as Array<{ ttl: number }>;
    expect(goodbyeAnswers.every((answer) => answer.ttl === 0)).toBe(true);
  });

  test('ready handlers log and skip query and advertisement when disabled', () => {
    const runtime = startMbMdns(
      {
        showHelp: false,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        outgoingIpv4InterfaceAddress: undefined,
        outgoingIpv6InterfaceAddress: undefined,
        advertiseIntervalMs: undefined,
        queryIntervalMs: undefined,
        unicast: false,
        filters: [],
        ipFilters: [],
        disableIpv4: false,
        disableIpv6: false,
        disableLoopback: false,
        disableTimeout: true,
        verbose: false,
      },
      false,
    );

    mockMdnsInstances[0].emit('ready', { family: 'IPv4', address: '192.168.1.10', port: 5353 });
    mockMdnsInstances[1].emit('ready', { family: 'IPv6', address: '::1', port: 5353 });

    expect(mockMdnsInstances[0].log.info).toHaveBeenCalledWith('mdnsIpv4 server ready on IPv4 192.168.1.10:5353');
    expect(mockMdnsInstances[1].log.info).toHaveBeenCalledWith('mdnsIpv6 server ready on IPv6 ::1:5353');
    expect(mockMdnsInstances[0].socket.setMulticastLoopback).not.toHaveBeenCalled();
    expect(mockMdnsInstances[1].socket.setMulticastLoopback).not.toHaveBeenCalled();
    expect(mockMdnsInstances[0].sendQuery).not.toHaveBeenCalled();
    expect(mockMdnsInstances[1].sendQuery).not.toHaveBeenCalled();
    expect(mockMdnsInstances[0].sendResponse).not.toHaveBeenCalled();
    expect(mockMdnsInstances[1].sendResponse).not.toHaveBeenCalled();
    expect(scheduledIntervals).toHaveLength(0);
    expect(runtime.mdnsIpv4).toBeDefined();
    expect(runtime.mdnsIpv6).toBeDefined();
  });

  test('uses default intervals and applies timeout', async () => {
    process.argv = ['node', 'mb_mdns', '--query', '--advertise', '--noIpv4'];
    const options = getMbMdnsOptions();

    const runtime = startMbMdns(options, false);

    expect(options.queryIntervalMs).toBe(MB_MDNS_DEFAULT_INTERVAL_MS);
    expect(options.advertiseIntervalMs).toBe(MB_MDNS_DEFAULT_INTERVAL_MS);
    expect(mockMdnsInstances).toHaveLength(1);

    mockMdnsInstances[0].emit('ready', { family: 'IPv6', address: '::', port: 5353 });

    expect(scheduledIntervals).toHaveLength(2);
    expect(scheduledIntervals[0].delay).toBe(MB_MDNS_DEFAULT_INTERVAL_MS);
    expect(scheduledIntervals[1].delay).toBe(MB_MDNS_DEFAULT_INTERVAL_MS);
    expect(scheduledTimeouts).toHaveLength(1);
    expect(scheduledTimeouts[0].delay).toBe(MB_MDNS_DEFAULT_TIMEOUT_MS);
    expect(scheduledTimeouts[0].unref).toHaveBeenCalled();

    const cleanupPromise = scheduledTimeouts[0].callback() as unknown as Promise<void>;
    expect(scheduledTimeouts).toHaveLength(2);
    scheduledTimeouts[1].callback();
    await Promise.resolve();
    expect(mockMdnsInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[0].logDevices).toHaveBeenCalledTimes(1);

    scheduledTimeouts[2].callback();
    await (cleanupPromise ?? runtime.cleanupAndLogAndExit());
  });

  test('registers SIGINT and SIGTERM handlers and cleans up on signal', async () => {
    let sigintHandler: (() => Promise<void>) | undefined;
    let sigtermHandler: (() => Promise<void>) | undefined;
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: () => Promise<void>) => {
      if (event === 'SIGINT') sigintHandler = handler;
      if (event === 'SIGTERM') sigtermHandler = handler;
      return process;
    }) as typeof process.on);

    startMbMdns(
      {
        showHelp: false,
        interfaceName: undefined,
        ipv4InterfaceAddress: '0.0.0.0',
        ipv6InterfaceAddress: '::',
        outgoingIpv4InterfaceAddress: undefined,
        outgoingIpv6InterfaceAddress: undefined,
        advertiseIntervalMs: undefined,
        queryIntervalMs: undefined,
        unicast: false,
        filters: [],
        ipFilters: [],
        disableIpv4: false,
        disableIpv6: true,
        disableLoopback: false,
        disableTimeout: true,
        verbose: false,
      },
      true,
    );

    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    expect(sigintHandler).toBeDefined();
    expect(sigtermHandler).toBeDefined();

    const cleanupPromise = sigtermHandler?.();
    expect(scheduledTimeouts).toHaveLength(1);
    scheduledTimeouts[0].callback();
    await Promise.resolve();
    scheduledTimeouts[1].callback();
    await cleanupPromise;

    expect(mockMdnsInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[0].logDevices).toHaveBeenCalledTimes(1);
  });

  test('ipv4 and ipv6 error handlers log emitted errors and SIGINT cleanup works', async () => {
    let sigintHandler: (() => Promise<void>) | undefined;
    jest.spyOn(process, 'on').mockImplementation(((event: string, handler: () => Promise<void>) => {
      if (event === 'SIGINT') sigintHandler = handler;
      return process;
    }) as typeof process.on);

    startMbMdns(
      {
        showHelp: false,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        outgoingIpv4InterfaceAddress: undefined,
        outgoingIpv6InterfaceAddress: undefined,
        advertiseIntervalMs: undefined,
        queryIntervalMs: undefined,
        unicast: false,
        filters: [],
        ipFilters: [],
        disableIpv4: false,
        disableIpv6: false,
        disableLoopback: false,
        disableTimeout: true,
        verbose: false,
      },
      true,
    );

    mockMdnsInstances[0].emit('error', new Error('udp4 failed'));
    mockMdnsInstances[1].emit('error', new Error('udp6 failed'));

    expect(mockMdnsInstances[0].log.error).toHaveBeenCalledWith(expect.stringContaining('mDNS udp4 Server error: udp4 failed'));
    expect(mockMdnsInstances[1].log.error).toHaveBeenCalledWith(expect.stringContaining('mDNS udp6 Server error: udp6 failed'));

    const cleanupPromise = sigintHandler?.();
    scheduledTimeouts[0].callback();
    await Promise.resolve();
    scheduledTimeouts[1].callback();
    await cleanupPromise;

    expect(mockMdnsInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].stop).toHaveBeenCalledTimes(1);
  });

  test('lists network interfaces for verbose IPv4 and IPv6-only startup', () => {
    process.argv = ['node', 'mb_mdns', '--verbose'];

    startMbMdns(
      {
        showHelp: false,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        outgoingIpv4InterfaceAddress: undefined,
        outgoingIpv6InterfaceAddress: undefined,
        advertiseIntervalMs: undefined,
        queryIntervalMs: undefined,
        unicast: false,
        filters: [],
        ipFilters: [],
        disableIpv4: false,
        disableIpv6: false,
        disableLoopback: false,
        disableTimeout: true,
        verbose: true,
      },
      false,
    );

    expect(mockMdnsInstances[0].listNetworkInterfaces).toHaveBeenCalledTimes(1);
    expect(mockMdnsInstances[1].listNetworkInterfaces).not.toHaveBeenCalled();

    MockMdns.clear();

    startMbMdns(
      {
        showHelp: false,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        outgoingIpv4InterfaceAddress: undefined,
        outgoingIpv6InterfaceAddress: undefined,
        advertiseIntervalMs: undefined,
        queryIntervalMs: undefined,
        unicast: false,
        filters: [],
        ipFilters: [],
        disableIpv4: true,
        disableIpv6: false,
        disableLoopback: false,
        disableTimeout: true,
        verbose: true,
      },
      false,
    );

    expect(mockMdnsInstances).toHaveLength(1);
    expect(mockMdnsInstances[0].listNetworkInterfaces).toHaveBeenCalledTimes(1);
  });
});
