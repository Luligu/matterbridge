/**
 * @file packages/core/buntest/mb_coap.test.ts
 * @description This file contains the bun tests for the mb_coap cli.
 * @author Luca Liguori
 */

import { afterEach, beforeEach, describe, expect, mock, spyOn, test, vi } from 'bun:test';

import { originalProcessArgv } from '@matterbridge/test-utils/buntest/setup';

/** A timer scheduled through the faked setInterval or setTimeout. */
type ScheduledTimer = { callback: () => void; delay: number | undefined; unref: ReturnType<typeof vi.fn> };

const mockCoapInstances: MockCoap[] = [];
const scheduledIntervals: ScheduledTimer[] = [];
const scheduledTimeouts: ScheduledTimer[] = [];

class MockCoap {
  readonly constructorArgs: unknown[];
  readonly socket = { setMulticastLoopback: vi.fn() };
  readonly log = { info: vi.fn() };
  readonly start = vi.fn();
  readonly stop = vi.fn();
  readonly listNetworkInterfaces = vi.fn();
  readonly sendRequest = vi.fn();
  private readonly eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(...args: unknown[]) {
    this.constructorArgs = args;
    mockCoapInstances.push(this);
  }

  on(event: string, handler: (...args: unknown[]) => void): this {
    this.eventHandlers.set(event, [...(this.eventHandlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    for (const handler of this.eventHandlers.get(event) ?? []) handler(...args);
  }
}

await mock.module('@matterbridge/dgram', () => ({
  Coap: MockCoap,
  COAP_MULTICAST_IPV4_ADDRESS: '224.0.0.1',
  COAP_MULTICAST_IPV6_ADDRESS: 'ff02::1',
  COAP_MULTICAST_PORT: 5683,
  COAP_OPTION_URI_PATH: 11,
}));

const { MB_COAP_DEFAULT_REQUEST_INTERVAL_MS, MB_COAP_DEFAULT_TIMEOUT_MS, getMbCoapHelpText, getMbCoapOptions, mbCoapMain, printMbCoapHelp, startMbCoap } =
  await import('../src/mb_coap.js');

type MbCoapOptions = ReturnType<typeof getMbCoapOptions>;

/**
 * Builds the mb_coap options: both families on eth0, no request, no timeout, unless overridden.
 *
 * @param {Partial<MbCoapOptions>} [overrides] - The options to override.
 * @returns {MbCoapOptions} The options.
 */
const coapOptions = (overrides: Partial<MbCoapOptions> = {}): MbCoapOptions => ({
  showHelp: false,
  requestIntervalMs: undefined,
  interfaceName: 'eth0',
  ipv4InterfaceAddress: '192.168.1.10',
  ipv6InterfaceAddress: '::1',
  disableLoopback: false,
  disableIpv4: false,
  disableIpv6: false,
  disableTimeout: true,
  ...overrides,
});

/**
 * Sets the cli arguments after the node and script paths.
 *
 * @param {...string} args - The cli arguments.
 * @returns {void}
 */
const setArgv = (...args: string[]): void => {
  process.argv = [...originalProcessArgv.slice(0, 2), ...args];
};

/**
 * Emits the ready event of both listeners.
 *
 * @returns {void}
 */
const emitReady = (): void => {
  mockCoapInstances[0].emit('ready', { family: 'IPv4', address: '192.168.1.10', port: 5683 });
  mockCoapInstances[1].emit('ready', { family: 'IPv6', address: '::1', port: 5683 });
};

describe('mb_coap', () => {
  beforeEach(() => {
    mockCoapInstances.length = 0;
    scheduledIntervals.length = 0;
    scheduledTimeouts.length = 0;
    setArgv();
    for (const [name, list] of [
      ['setInterval', scheduledIntervals],
      ['setTimeout', scheduledTimeouts],
    ] as const) {
      spyOn(globalThis, name).mockImplementation(((callback: () => void, delay?: number) => {
        const timer = { unref: vi.fn() };
        list.push({ callback, delay, unref: timer.unref });
        return timer;
      }) as never);
    }
  });

  afterEach(() => {
    process.argv = [...originalProcessArgv];
    vi.restoreAllMocks();
  });

  test('parses CLI options and defaults the request interval', () => {
    setArgv('--request', '5000', '--interfaceName', 'eth0', '--ipv4InterfaceAddress', '192.168.1.10', '--ipv6InterfaceAddress', '::1', '--no-loopback', '--noIpv6', '--no-timeout');
    expect(getMbCoapOptions()).toEqual(coapOptions({ requestIntervalMs: 5000, disableLoopback: true, disableIpv6: true }));
    setArgv('--request');
    expect(getMbCoapOptions().requestIntervalMs).toBe(MB_COAP_DEFAULT_REQUEST_INTERVAL_MS);
  });

  test('prints the help with the given or the default handlers', () => {
    setArgv('--help');
    const exitFn = vi.fn();
    const logFn = vi.fn();
    expect(mbCoapMain(exitFn as never, logFn)).toBeUndefined();
    expect(logFn).toHaveBeenCalledWith(getMbCoapHelpText());
    expect(exitFn).toHaveBeenCalledWith(0);
    expect(mockCoapInstances).toHaveLength(0);

    const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    const processExitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never);
    printMbCoapHelp();
    expect(mbCoapMain()).toBeUndefined();
    expect(consoleLogSpy.mock.calls).toEqual([[getMbCoapHelpText()], [getMbCoapHelpText()]]);
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('starts enabled listeners, schedules requests and cleans up', () => {
    const exitFn = vi.fn();
    const runtime = startMbCoap(coapOptions({ requestIntervalMs: 1000, disableLoopback: true }), exitFn as never, false);
    expect(mockCoapInstances.map((coap) => coap.constructorArgs)).toEqual([
      ['CoAP Server udp4', '224.0.0.1', 5683, 'udp4', true, 'eth0', '192.168.1.10'],
      ['CoAP Server udp6', 'ff02::1', 5683, 'udp6', true, 'eth0', '::1'],
    ]);

    emitReady();
    for (const coap of mockCoapInstances) {
      expect(coap.socket.setMulticastLoopback).toHaveBeenCalledWith(false);
      expect(coap.sendRequest).toHaveBeenCalledTimes(1);
    }
    expect(scheduledIntervals.map((timer) => timer.delay)).toEqual([1000, 1000]);
    for (const timer of scheduledIntervals) {
      expect(timer.unref).toHaveBeenCalled();
      timer.callback();
    }
    for (const coap of mockCoapInstances) expect(coap.sendRequest).toHaveBeenCalledTimes(2);

    runtime.cleanupAndLogAndExit();
    for (const coap of mockCoapInstances) expect(coap.stop).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);

    // mbCoapMain starts the runtime when the help is not requested.
    mockCoapInstances.length = 0;
    setArgv('--no-timeout');
    const mainExit = vi.fn();
    expect(mbCoapMain(mainExit as never, vi.fn())).toBeDefined();
    expect(mockCoapInstances).toHaveLength(2);
    expect(mainExit).not.toHaveBeenCalled();
  });

  test('ready handlers log and skip the requests when the request mode is disabled', () => {
    const runtime = startMbCoap(coapOptions(), vi.fn() as never, false);
    emitReady();
    expect(mockCoapInstances[0].log.info).toHaveBeenCalledWith('coapIpv4 server ready on IPv4 192.168.1.10:5683');
    expect(mockCoapInstances[1].log.info).toHaveBeenCalledWith('coapIpv6 server ready on IPv6 ::1:5683');
    for (const coap of mockCoapInstances) {
      expect(coap.socket.setMulticastLoopback).not.toHaveBeenCalled();
      expect(coap.sendRequest).not.toHaveBeenCalled();
    }
    expect(scheduledIntervals).toHaveLength(0);
    expect([runtime.coapIpv4, runtime.coapIpv6].every(Boolean)).toBe(true);
  });

  test('uses the default request interval and applies the timeout', () => {
    setArgv('--request', '--noIpv4');
    const exitFn = vi.fn();
    const runtime = startMbCoap(getMbCoapOptions(), exitFn as never, false);
    expect(mockCoapInstances).toHaveLength(1);

    mockCoapInstances[0].emit('ready', { family: 'IPv6', address: '::', port: 5683 });
    expect(scheduledIntervals.map((timer) => timer.delay)).toEqual([MB_COAP_DEFAULT_REQUEST_INTERVAL_MS]);
    expect(scheduledTimeouts.map((timer) => timer.delay)).toEqual([MB_COAP_DEFAULT_TIMEOUT_MS]);
    expect(scheduledTimeouts[0].unref).toHaveBeenCalled();

    scheduledTimeouts[0].callback();
    expect(mockCoapInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);
    expect(runtime.coapIpv4).toBeUndefined();
  });

  test('registers the SIGINT handler, with the given or the default exit, and cleans up on signal', () => {
    let sigintHandler: (() => void) | undefined;
    const processOnSpy = spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      if (event === 'SIGINT') sigintHandler = handler;
      return process;
    }) as never);
    const exitFn = vi.fn();
    startMbCoap(coapOptions({ interfaceName: undefined, ipv4InterfaceAddress: '0.0.0.0', ipv6InterfaceAddress: '::', disableIpv6: true }), exitFn as never, true);
    sigintHandler?.();
    expect(mockCoapInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);

    processOnSpy.mockClear();
    startMbCoap(coapOptions({ disableIpv4: true, disableIpv6: true }));
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  test('lists the network interfaces once in verbose mode, on the first enabled listener', () => {
    setArgv('--verbose');
    startMbCoap(coapOptions(), vi.fn() as never, false);
    expect(mockCoapInstances.map((coap) => coap.listNetworkInterfaces.mock.calls.length)).toEqual([1, 0]);

    mockCoapInstances.length = 0;
    startMbCoap(coapOptions({ disableIpv4: true }), vi.fn() as never, false);
    expect(mockCoapInstances.map((coap) => coap.listNetworkInterfaces.mock.calls.length)).toEqual([1]);
  });
});
