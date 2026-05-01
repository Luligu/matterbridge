import { jest } from '@jest/globals';
import { originalProcessArgv, setupTest } from '@matterbridge/jest-utils';

const mockCoapInstances: MockCoap[] = [];
const scheduledIntervals: Array<{ callback: () => void; delay: number | undefined; unref: jest.Mock }> = [];
const scheduledTimeouts: Array<{ callback: () => void; delay: number | undefined; unref: jest.Mock }> = [];

class MockCoap {
  static clear() {
    mockCoapInstances.length = 0;
  }

  readonly constructorArgs: unknown[];
  readonly socket = {
    setMulticastLoopback: jest.fn(),
  };
  readonly log = {
    info: jest.fn(),
  };
  readonly start = jest.fn();
  readonly stop = jest.fn();
  readonly listNetworkInterfaces = jest.fn();
  readonly sendRequest = jest.fn();
  private readonly eventHandlers = new Map<string, Array<(...args: unknown[]) => void>>();

  constructor(...args: unknown[]) {
    this.constructorArgs = args;
    mockCoapInstances.push(this);
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
  Coap: MockCoap,
  COAP_MULTICAST_IPV4_ADDRESS: '224.0.0.1',
  COAP_MULTICAST_IPV6_ADDRESS: 'ff02::1',
  COAP_MULTICAST_PORT: 5683,
  COAP_OPTION_URI_PATH: 11,
}));

const { MB_COAP_DEFAULT_REQUEST_INTERVAL_MS, MB_COAP_DEFAULT_TIMEOUT_MS, getMbCoapHelpText, getMbCoapOptions, mbCoapMain, printMbCoapHelp, startMbCoap } =
  await import('./mb_coap.js');

await setupTest('MbCoap', false);

describe('mb_coap', () => {
  beforeEach(() => {
    MockCoap.clear();
    scheduledIntervals.length = 0;
    scheduledTimeouts.length = 0;
    process.argv = originalProcessArgv.slice(0, 2);

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
      'mb_coap',
      '--request',
      '5000',
      '--interfaceName',
      'eth0',
      '--ipv4InterfaceAddress',
      '192.168.1.10',
      '--ipv6InterfaceAddress',
      '::1',
      '--no-loopback',
      '--noIpv6',
      '--no-timeout',
    ];

    expect(getMbCoapOptions()).toEqual({
      showHelp: false,
      requestIntervalMs: 5000,
      interfaceName: 'eth0',
      ipv4InterfaceAddress: '192.168.1.10',
      ipv6InterfaceAddress: '::1',
      disableLoopback: true,
      disableIpv4: false,
      disableIpv6: true,
      disableTimeout: true,
    });
  });

  test('prints help and exits', () => {
    process.argv = ['node', 'mb_coap', '--help'];
    const exitFn = jest.fn();
    const logFn = jest.fn();

    expect(mbCoapMain(exitFn as any, logFn)).toBeUndefined();
    expect(logFn).toHaveBeenCalledWith(getMbCoapHelpText());
    expect(exitFn).toHaveBeenCalledWith(0);
    expect(mockCoapInstances).toHaveLength(0);
  });

  test('prints help with default console logger', () => {
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    printMbCoapHelp();

    expect(consoleLogSpy).toHaveBeenCalledWith(getMbCoapHelpText());
  });

  test('mbCoapMain uses default exit and log handlers for help', () => {
    process.argv = ['node', 'mb_coap', '--help'];
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const processExitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);

    expect(mbCoapMain()).toBeUndefined();
    expect(consoleLogSpy).toHaveBeenCalledWith(getMbCoapHelpText());
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  test('starts enabled listeners and schedules requests', () => {
    const exitFn = jest.fn();
    const runtime = startMbCoap(
      {
        showHelp: false,
        requestIntervalMs: 1000,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        disableLoopback: true,
        disableIpv4: false,
        disableIpv6: false,
        disableTimeout: true,
      },
      exitFn as any,
      false,
    );

    expect(mockCoapInstances).toHaveLength(2);
    expect(mockCoapInstances[0].constructorArgs).toEqual(['CoAP Server udp4', '224.0.0.1', 5683, 'udp4', true, 'eth0', '192.168.1.10']);
    expect(mockCoapInstances[1].constructorArgs).toEqual(['CoAP Server udp6', 'ff02::1', 5683, 'udp6', true, 'eth0', '::1']);

    mockCoapInstances[0].emit('ready', { family: 'IPv4', address: '192.168.1.10', port: 5683 });
    mockCoapInstances[1].emit('ready', { family: 'IPv6', address: '::1', port: 5683 });

    expect(mockCoapInstances[0].socket.setMulticastLoopback).toHaveBeenCalledWith(false);
    expect(mockCoapInstances[1].socket.setMulticastLoopback).toHaveBeenCalledWith(false);
    expect(mockCoapInstances[0].sendRequest).toHaveBeenCalledTimes(1);
    expect(mockCoapInstances[1].sendRequest).toHaveBeenCalledTimes(1);
    expect(scheduledIntervals).toHaveLength(2);
    expect(scheduledIntervals[0].delay).toBe(1000);
    expect(scheduledIntervals[1].delay).toBe(1000);
    expect(scheduledIntervals[0].unref).toHaveBeenCalled();
    expect(scheduledIntervals[1].unref).toHaveBeenCalled();

    scheduledIntervals[0].callback();
    scheduledIntervals[1].callback();

    expect(mockCoapInstances[0].sendRequest).toHaveBeenCalledTimes(2);
    expect(mockCoapInstances[1].sendRequest).toHaveBeenCalledTimes(2);

    runtime.cleanupAndLogAndExit();

    expect(mockCoapInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(mockCoapInstances[1].stop).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  test('mbCoapMain starts runtime when help is not requested', () => {
    process.argv = ['node', 'mb_coap', '--no-timeout'];
    const exitFn = jest.fn();

    const runtime = mbCoapMain(exitFn as any, jest.fn());

    expect(runtime).toBeDefined();
    expect(mockCoapInstances).toHaveLength(2);
    expect(exitFn).not.toHaveBeenCalled();
  });

  test('ready handlers log and skip requests when request mode is disabled', () => {
    const runtime = startMbCoap(
      {
        showHelp: false,
        requestIntervalMs: undefined,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        disableLoopback: false,
        disableIpv4: false,
        disableIpv6: false,
        disableTimeout: true,
      },
      jest.fn() as any,
      false,
    );

    mockCoapInstances[0].emit('ready', { family: 'IPv4', address: '192.168.1.10', port: 5683 });
    mockCoapInstances[1].emit('ready', { family: 'IPv6', address: '::1', port: 5683 });

    expect(mockCoapInstances[0].log.info).toHaveBeenCalledWith('coapIpv4 server ready on IPv4 192.168.1.10:5683');
    expect(mockCoapInstances[1].log.info).toHaveBeenCalledWith('coapIpv6 server ready on IPv6 ::1:5683');
    expect(mockCoapInstances[0].socket.setMulticastLoopback).not.toHaveBeenCalled();
    expect(mockCoapInstances[1].socket.setMulticastLoopback).not.toHaveBeenCalled();
    expect(mockCoapInstances[0].sendRequest).not.toHaveBeenCalled();
    expect(mockCoapInstances[1].sendRequest).not.toHaveBeenCalled();
    expect(scheduledIntervals).toHaveLength(0);
    expect(runtime.coapIpv4).toBeDefined();
    expect(runtime.coapIpv6).toBeDefined();
  });

  test('uses defaults when request has no explicit interval and applies timeout', () => {
    process.argv = ['node', 'mb_coap', '--request', '--noIpv4'];
    const options = getMbCoapOptions();
    const exitFn = jest.fn();
    const runtime = startMbCoap(options, exitFn as any, false);

    expect(options.requestIntervalMs).toBe(MB_COAP_DEFAULT_REQUEST_INTERVAL_MS);
    expect(mockCoapInstances).toHaveLength(1);

    mockCoapInstances[0].emit('ready', { family: 'IPv6', address: '::', port: 5683 });

    expect(scheduledIntervals).toHaveLength(1);
    expect(scheduledIntervals[0].delay).toBe(MB_COAP_DEFAULT_REQUEST_INTERVAL_MS);
    expect(scheduledTimeouts).toHaveLength(1);
    expect(scheduledTimeouts[0].delay).toBe(MB_COAP_DEFAULT_TIMEOUT_MS);
    expect(scheduledTimeouts[0].unref).toHaveBeenCalled();

    scheduledTimeouts[0].callback();

    expect(mockCoapInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);
    expect(runtime.coapIpv4).toBeUndefined();
  });

  test('registers SIGINT handler and cleans up on signal', () => {
    let sigintHandler: (() => void) | undefined;
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      if (event === 'SIGINT') sigintHandler = handler;
      return process;
    }) as typeof process.on);
    const exitFn = jest.fn();

    startMbCoap(
      {
        showHelp: false,
        requestIntervalMs: undefined,
        interfaceName: undefined,
        ipv4InterfaceAddress: '0.0.0.0',
        ipv6InterfaceAddress: '::',
        disableLoopback: false,
        disableIpv4: false,
        disableIpv6: true,
        disableTimeout: true,
      },
      exitFn as any,
      true,
    );

    expect(processOnSpy).toHaveBeenCalled();
    expect(sigintHandler).toBeDefined();

    sigintHandler?.();

    expect(mockCoapInstances[0].stop).toHaveBeenCalledTimes(1);
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  test('startMbCoap uses default signal registration path', () => {
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(((event: string, handler: () => void) => {
      return process;
    }) as typeof process.on);

    startMbCoap({
      showHelp: false,
      requestIntervalMs: undefined,
      interfaceName: undefined,
      ipv4InterfaceAddress: '0.0.0.0',
      ipv6InterfaceAddress: '::',
      disableLoopback: false,
      disableIpv4: true,
      disableIpv6: true,
      disableTimeout: true,
    });

    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
  });

  test('lists network interfaces for verbose IPv4 and IPv6-only startup', () => {
    process.argv = ['node', 'mb_coap', '--verbose'];

    startMbCoap(
      {
        showHelp: false,
        requestIntervalMs: undefined,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        disableLoopback: false,
        disableIpv4: false,
        disableIpv6: false,
        disableTimeout: true,
      },
      jest.fn() as any,
      false,
    );

    expect(mockCoapInstances[0].listNetworkInterfaces).toHaveBeenCalledTimes(1);
    expect(mockCoapInstances[1].listNetworkInterfaces).not.toHaveBeenCalled();

    MockCoap.clear();
    process.argv = ['node', 'mb_coap', '--verbose'];

    startMbCoap(
      {
        showHelp: false,
        requestIntervalMs: undefined,
        interfaceName: 'eth0',
        ipv4InterfaceAddress: '192.168.1.10',
        ipv6InterfaceAddress: '::1',
        disableLoopback: false,
        disableIpv4: true,
        disableIpv6: false,
        disableTimeout: true,
      },
      jest.fn() as any,
      false,
    );

    expect(mockCoapInstances).toHaveLength(1);
    expect(mockCoapInstances[0].listNetworkInterfaces).toHaveBeenCalledTimes(1);
  });
});
