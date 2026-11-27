/**
 * @file packages/dgram/vitest/coapMonitor.test.ts
 * @description CoAP monitor and command line tests
 * @author Luca Liguori
 */

import os from 'node:os';

import { consoleErrorSpy, consoleLogSpy, loggerLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/vitest/setup';
import { getFreePort } from '@matterbridge/utils/port';
import { LogLevel } from 'node-ansi-logger';

import { Coap, COAP_OPTION_URI_PATH } from '../src/coap.js';
import { COAP_MONITOR_HELP, COAP_MONITOR_REQUEST_MESSAGE_ID, CoapMonitor, runCoapMonitor } from '../src/coapMonitor.js';
import { COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS } from '../src/multicast.js';

await setupTest('CoapMonitorTest');

describe('CoapMonitor', () => {
  /** The 'close' events of the sockets closed by closeSockets(), awaited before the console spies are restored. */
  const pendingCloses: Promise<void>[] = [];

  afterEach(() => vi.clearAllMocks());
  afterAll(async () => {
    await Promise.all(pendingCloses);
    vi.restoreAllMocks();
    resetTest();
  });

  /**
   * Returns the last listener of a process signal.
   *
   * @param {NodeJS.Signals} signal - The signal.
   * @returns {() => void} The listener.
   */
  function lastListener(signal: NodeJS.Signals): () => void {
    return process.listeners(signal).at(-1) as () => void;
  }

  /**
   * Closes any unstarted sockets held by a monitor. The 'close' event, and its debug log, arrives on a later tick:
   * it is collected in pendingCloses so it cannot be printed after afterAll has restored the console spies.
   *
   * @param {CoapMonitor | undefined} monitor - The monitor to clean up.
   */
  function closeSockets(monitor: CoapMonitor | undefined): void {
    for (const socket of [monitor?.sockets.ipv4?.socket, monitor?.sockets.ipv6?.socket]) {
      if (!socket) continue;
      socket.close();
      pendingCloses.push(new Promise<void>((resolve) => socket.once('close', () => resolve())));
    }
  }

  describe('construction', () => {
    it('should create both sockets on the CoAP multicast groups', async () => {
      const monitor = new CoapMonitor({ coapPort: await getFreePort('udp') });
      expect(monitor.sockets.ipv4).toBeInstanceOf(Coap);
      expect(monitor.sockets.ipv6).toBeInstanceOf(Coap);
      expect(monitor.sockets.ipv4?.multicastAddress).toBe(COAP_MULTICAST_IPV4_ADDRESS);
      expect(monitor.sockets.ipv6?.multicastAddress).toBe(COAP_MULTICAST_IPV6_ADDRESS);
      expect(monitor.log).toBe(monitor.sockets.ipv4?.log);
      closeSockets(monitor);
    });

    it('should use the CoAP port by default and make the sockets verbose', () => {
      const monitor = new CoapMonitor({ enableIpv6: false, verbose: true });
      expect((monitor as unknown as { coapPort: number }).coapPort).toBe(5683);
      expect(monitor.sockets.ipv4?.verbose).toBe(true);
      expect(monitor.sockets.ipv6).toBeUndefined();
      monitor.setLogLevel(LogLevel.DEBUG);
      expect(monitor.sockets.ipv4?.log.logLevel).toBe(LogLevel.DEBUG);
      closeSockets(monitor);
    });

    it('should create only the IPv6 socket, verbose, and use it as the primary socket when enableIpv4 is false', async () => {
      const monitor = new CoapMonitor({ enableIpv4: false, verbose: true, coapPort: await getFreePort('udp') });
      expect(monitor.sockets.ipv4).toBeUndefined();
      expect(monitor.sockets.ipv6?.verbose).toBe(true);
      expect(monitor.log).toBe(monitor.sockets.ipv6?.log);
      monitor.setLogLevel(LogLevel.DEBUG);
      expect(monitor.sockets.ipv6?.log.logLevel).toBe(LogLevel.DEBUG);
      closeSockets(monitor);
    });

    it('should throw when both IPv4 and IPv6 are disabled', () => {
      expect(() => new CoapMonitor({ enableIpv4: false, enableIpv6: false })).toThrow('CoapMonitor: IPv4 and IPv6 are both disabled');
    });
  });

  describe('lifecycle and runtime', () => {
    it('should bind sockets, send the initial requests, disable loopback and stop once', async () => {
      const monitor = new CoapMonitor({ request: true, requestIntervalMs: 0, loopback: false, timeoutMs: 0, coapPort: await getFreePort('udp') });
      const sendRequestSpy = vi.spyOn(CoapMonitor.prototype, 'sendRequest');
      const coapSendRequestSpy = vi.spyOn(Coap.prototype, 'sendRequest').mockImplementation(() => {});
      const sockets = [monitor.sockets.ipv4, monitor.sockets.ipv6].filter((socket): socket is Coap => socket !== undefined);
      const readyPromises = sockets.map(async (socket) => new Promise<void>((resolve) => socket.once('ready', () => resolve())));
      const closePromises = sockets.map(async (socket) => new Promise<void>((resolve) => socket.once('close', () => resolve())));

      monitor.start();
      await Promise.all(readyPromises);
      expect(sendRequestSpy).toHaveBeenCalledTimes(sockets.length);
      for (const socket of sockets) {
        expect(sendRequestSpy).toHaveBeenCalledWith(socket);
        expect(coapSendRequestSpy).toHaveBeenCalledWith(
          COAP_MONITOR_REQUEST_MESSAGE_ID,
          [
            { number: COAP_OPTION_URI_PATH, value: Buffer.from('cit') },
            { number: COAP_OPTION_URI_PATH, value: Buffer.from('d') },
          ],
          {},
          undefined,
          socket.multicastAddress,
          socket.multicastPort,
        );
      }
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Multicast loopback disabled'));

      const stopSpies = sockets.map((socket) => vi.spyOn(socket, 'stop'));
      monitor.stop();
      await Promise.all(closePromises);
      monitor.stop();
      for (const stopSpy of stopSpies) expect(stopSpy).toHaveBeenCalledTimes(1);

      sendRequestSpy.mockRestore();
      coapSendRequestSpy.mockRestore();
    });

    it('should call stop automatically when timeoutMs elapses', async () => {
      const monitor = new CoapMonitor({ timeoutMs: 50, coapPort: await getFreePort('udp') });
      const stopSpy = vi.spyOn(monitor, 'stop');
      const sockets = [monitor.sockets.ipv4, monitor.sockets.ipv6].filter((socket): socket is Coap => socket !== undefined);
      const closePromises = sockets.map(async (socket) => new Promise<void>((resolve) => socket.once('close', () => resolve())));

      monitor.start();
      const deadline = Date.now() + 500;
      while (stopSpy.mock.calls.length === 0 && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      expect(stopSpy).toHaveBeenCalledTimes(1);
      await Promise.all(closePromises);
    });

    it('should log socket errors after start', async () => {
      const monitor = new CoapMonitor({ timeoutMs: 0, enableIpv6: false, coapPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      const start = vi.spyOn(ipv4, 'start').mockImplementation(() => {}); // No real bind: only the handlers are registered

      monitor.start();
      ipv4.emit('error', new Error('boom'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Server error: boom'));

      start.mockRestore();
      closeSockets(monitor);
    });

    it('should start the sockets only once and not after stop', async () => {
      const monitor = new CoapMonitor({ timeoutMs: 0, enableIpv6: false, coapPort: await getFreePort('udp') });
      const stopped = new CoapMonitor({ timeoutMs: 0, enableIpv6: false, coapPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      const stoppedIpv4 = stopped.sockets.ipv4;
      if (!ipv4 || !stoppedIpv4) throw new Error('IPv4 socket not created');
      const start = vi.spyOn(ipv4, 'start').mockImplementation(() => {}); // No real bind
      const stoppedStart = vi.spyOn(stoppedIpv4, 'start').mockImplementation(() => {});
      vi.spyOn(stoppedIpv4, 'stop').mockImplementation(() => {});

      monitor.start();
      monitor.start();
      expect(start).toHaveBeenCalledTimes(1);

      stopped.stop();
      stopped.start();
      expect(stoppedStart).not.toHaveBeenCalled();

      closeSockets(monitor);
      closeSockets(stopped);
    });

    it('should list the network interfaces when verbose and ignore a socket ready after stop', async () => {
      const monitor = new CoapMonitor({ timeoutMs: 0, enableIpv6: false, verbose: true, request: true, coapPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      vi.spyOn(ipv4, 'start').mockImplementation(() => {}); // No real bind
      vi.spyOn(ipv4, 'stop').mockImplementation(() => {});
      const listSpy = vi.spyOn(ipv4, 'listNetworkInterfaces').mockImplementation(() => {});
      const sendRequestSpy = vi.spyOn(monitor, 'sendRequest');

      monitor.start();
      expect(listSpy).toHaveBeenCalledTimes(1);
      monitor.stop();
      ipv4.emit('ready', { address: '0.0.0.0', family: 'IPv4', port: 5683 });
      expect(sendRequestSpy).not.toHaveBeenCalled();
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('server ready'));

      closeSockets(monitor);
    });

    it('should repeat the requests every requestIntervalMs', async () => {
      const sendRequestSpy = vi.spyOn(CoapMonitor.prototype, 'sendRequest');
      const coapSendRequestSpy = vi.spyOn(Coap.prototype, 'sendRequest').mockImplementation(() => {});
      const monitor = new CoapMonitor({ request: true, requestIntervalMs: 20, timeoutMs: 0, enableIpv6: false, coapPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      const closed = new Promise<void>((resolve) => ipv4.once('close', () => resolve()));

      monitor.start();
      const deadline = Date.now() + 1000;
      while (sendRequestSpy.mock.calls.length < 2 && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      expect(sendRequestSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      monitor.stop();
      await closed;
      sendRequestSpy.mockRestore();
      coapSendRequestSpy.mockRestore();
    });

    it('should log an error when sending the request fails', async () => {
      const coapSendRequestSpy = vi.spyOn(Coap.prototype, 'sendRequest').mockImplementation(() => {
        throw new Error('send failed');
      });
      const monitor = new CoapMonitor({ enableIpv6: false, coapPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');

      monitor.sendRequest(ipv4);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error sending CoAP request: send failed'));

      coapSendRequestSpy.mockRestore();
      closeSockets(monitor);
    });
  });

  describe('runCoapMonitor', () => {
    /** The private options of the monitor read by the tests. */
    interface Internals {
      interfaceName: string | undefined;
      ipv4Address: string;
      ipv6Address: string;
      outgoingIpv4Address: string | undefined;
      outgoingIpv6Address: string | undefined;
      request: boolean;
      requestIntervalMs: number;
      loopback: boolean;
      timeoutMs: number;
      verbose: boolean;
    }

    /**
     * Removes the signal listeners added by runCoapMonitor and closes any unstarted sockets.
     *
     * @param {CoapMonitor | undefined} monitor - The monitor.
     */
    function cleanup(monitor: CoapMonitor | undefined): void {
      process.removeListener('SIGINT', lastListener('SIGINT'));
      process.removeListener('SIGTERM', lastListener('SIGTERM'));
      closeSockets(monitor);
    }

    /**
     * Runs runCoapMonitor with a command line that must fail, and restores the exit code.
     *
     * @param {string[]} argv - The command line.
     * @returns {Promise<string>} The error printed.
     */
    async function runWithError(argv: string[]): Promise<string> {
      const exitCode = process.exitCode;
      const sigint = process.listenerCount('SIGINT');
      const result = runCoapMonitor(argv, { coapPort: await getFreePort('udp') });
      const code = process.exitCode;
      process.exitCode = exitCode ?? 0; // Bun ignores undefined, so the exit code of the test run would stay 2
      expect(result).toBeUndefined();
      expect(code).toBe(2);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const message = String(consoleErrorSpy.mock.calls[0][0]);
      expect(message).toContain('Run coap --help to see the options.');
      return message;
    }

    it('should print the help and start nothing with --help or -h', () => {
      const sigint = process.listenerCount('SIGINT');
      expect(runCoapMonitor(['--help'])).toBeUndefined();
      expect(runCoapMonitor(['-h', '--request'])).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(COAP_MONITOR_HELP);
      expect(COAP_MONITOR_HELP).toContain('Usage: coap [options]');
      for (const option of [
        '--interface',
        '--ipv4-address',
        '--ipv6-address',
        '--outgoing-ipv4-address',
        '--outgoing-ipv6-address',
        '--request',
        '--no-ipv4',
        '--no-ipv6',
        '--no-loopback',
        '--timeout',
        '--no-timeout',
        '-d, --debug',
        '-v, --verbose',
        '-s, --silent',
        '-h, --help',
      ])
        expect(COAP_MONITOR_HELP).toContain(option);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
    });

    it('should report command line errors', async () => {
      expect(await runWithError(['--unknown'])).toContain('--unknown');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--request=abc'])).toContain('invalid --request abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--request='])).toContain('invalid --request ');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--request', 'abc'])).toContain('invalid --request abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--timeout=-1'])).toContain('invalid --timeout -1');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--timeout='])).toContain('invalid --timeout ');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--timeout', 'abc'])).toContain('invalid --timeout abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--no-ipv4', '--no-ipv6'])).toContain('CoapMonitor: IPv4 and IPv6 are both disabled');
    });

    it('should map command line options and stop on SIGINT', async () => {
      const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => info.family === 'IPv4' && !info.internal))?.[0] ?? '';
      const start = vi.spyOn(CoapMonitor.prototype, 'start').mockImplementation(() => {});
      const stop = vi.spyOn(CoapMonitor.prototype, 'stop').mockImplementation(() => {});
      const sigint = process.listenerCount('SIGINT');

      const monitor = runCoapMonitor(
        [
          '--interface',
          interfaceName,
          '--ipv4-address',
          '0.0.0.0',
          '--ipv6-address',
          '::',
          '--outgoing-ipv4-address',
          '192.0.2.1',
          '--outgoing-ipv6-address',
          '::%eth0',
          '--request',
          '5',
          '--no-loopback',
          '--timeout',
          '30',
          '-d',
        ],
        { coapPort: await getFreePort('udp') },
      );

      expect(start).toHaveBeenCalledTimes(1);
      const internals = monitor as unknown as Internals;
      expect(internals.interfaceName).toBe(interfaceName);
      expect(internals.ipv4Address).toBe('0.0.0.0');
      expect(internals.ipv6Address).toBe('::');
      expect(internals.outgoingIpv4Address).toBe('192.0.2.1');
      expect(internals.outgoingIpv6Address).toBe('::%eth0');
      expect(monitor?.sockets.ipv4?.outgoingInterfaceAddress).toBe('192.0.2.1');
      expect(monitor?.sockets.ipv6?.outgoingInterfaceAddress).toBe('::%eth0');
      expect(internals.request).toBe(true);
      expect(internals.requestIntervalMs).toBe(5000);
      expect(internals.loopback).toBe(false);
      expect(internals.timeoutMs).toBe(30000);
      expect(monitor?.sockets.ipv4?.log.logLevel).toBe(LogLevel.DEBUG);
      expect(monitor?.sockets.ipv6?.log.logLevel).toBe(LogLevel.DEBUG);

      expect(process.listenerCount('SIGINT')).toBe(sigint + 1);
      lastListener('SIGINT')();
      expect(stop).toHaveBeenCalledTimes(1);

      cleanup(monitor);
      start.mockRestore();
      stop.mockRestore();
    });

    it('should take the request interval of --request=<seconds> and the default without seconds', async () => {
      const start = vi.spyOn(CoapMonitor.prototype, 'start').mockImplementation(() => {});

      const seconds = runCoapMonitor(['--request=2', '--no-ipv6'], { coapPort: await getFreePort('udp') });
      expect((seconds as unknown as Internals).requestIntervalMs).toBe(2000);
      expect(seconds?.sockets.ipv6).toBeUndefined();
      cleanup(seconds);

      const defaults = runCoapMonitor(['--request', '--no-ipv4'], { coapPort: await getFreePort('udp') });
      expect((defaults as unknown as Internals).request).toBe(true);
      expect((defaults as unknown as Internals).requestIntervalMs).toBe(10000);
      expect(defaults?.sockets.ipv4).toBeUndefined();
      cleanup(defaults);

      start.mockRestore();
    });

    it('should log at debug level with -v, at notice level with -s, disable the timeout with --no-timeout and keep the defaults without options', async () => {
      const start = vi.spyOn(CoapMonitor.prototype, 'start').mockImplementation(() => {});

      const verbose = runCoapMonitor(['-v', '--no-timeout'], { coapPort: await getFreePort('udp') });
      expect((verbose as unknown as Internals).verbose).toBe(true);
      expect((verbose as unknown as Internals).timeoutMs).toBe(0);
      expect(verbose?.log.logLevel).toBe(LogLevel.DEBUG);
      cleanup(verbose);

      const silent = runCoapMonitor(['-s'], { coapPort: await getFreePort('udp') });
      expect(silent?.sockets.ipv4?.log.logLevel).toBe(LogLevel.NOTICE);
      expect(silent?.sockets.ipv6?.log.logLevel).toBe(LogLevel.NOTICE);
      cleanup(silent);

      const debugWins = runCoapMonitor(['--debug', '--silent'], { coapPort: await getFreePort('udp') });
      expect(debugWins?.log.logLevel).toBe(LogLevel.DEBUG);
      cleanup(debugWins);

      const defaults = runCoapMonitor([], { coapPort: await getFreePort('udp') });
      const internals = defaults as unknown as Internals;
      expect(internals.request).toBe(false);
      expect(internals.loopback).toBe(true);
      expect(internals.timeoutMs).toBe(600000);
      expect(defaults?.log.logLevel).not.toBe(LogLevel.DEBUG);
      expect(defaults?.log.logLevel).not.toBe(LogLevel.NOTICE);
      cleanup(defaults);

      expect(start).toHaveBeenCalledTimes(4);
      start.mockRestore();
    });
  });
});
