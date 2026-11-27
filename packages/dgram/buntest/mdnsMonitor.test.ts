/**
 * @file packages/dgram/buntest/mdnsMonitor.test.ts
 * @description mDNS monitor and command line tests
 * @author Luca Liguori
 */

import { afterAll, afterEach, describe, expect, it, spyOn, vi } from 'bun:test';
import os from 'node:os';

import { consoleErrorSpy, consoleLogSpy, loggerLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { getFreePort } from '@matterbridge/utils/port';
import { LogLevel } from 'node-ansi-logger';

import { Mdns } from '../src/mdns.js';
import { MDNS_MONITOR_HELP, MdnsMonitor, runMdnsMonitor } from '../src/mdnsMonitor.js';

await setupTest('MdnsMonitorTest');

describe('MdnsMonitor', () => {
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
   * @param {MdnsMonitor | undefined} monitor - The monitor to clean up.
   */
  function closeSockets(monitor: MdnsMonitor | undefined): void {
    for (const socket of [monitor?.sockets.ipv4?.socket, monitor?.sockets.ipv6?.socket]) {
      if (!socket) continue;
      socket.close();
      pendingCloses.push(new Promise<void>((resolve) => socket.once('close', () => resolve())));
    }
  }

  describe('construction', () => {
    it('should create both sockets and apply filters and ipFilters', async () => {
      const monitor = new MdnsMonitor({
        filters: ['_matterc._udp', '_matter._tcp'],
        ipFilters: ['192.168.1.10'],
        mdnsPort: await getFreePort('udp'),
      });
      expect(monitor.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(monitor.sockets.ipv6).toBeInstanceOf(Mdns);
      expect(monitor.sockets.ipv4?.filters).toEqual(['_matterc._udp', '_matter._tcp']);
      expect(monitor.sockets.ipv6?.filters).toEqual(['_matterc._udp', '_matter._tcp']);
      expect(monitor.sockets.ipv4?.ipFilters).toEqual(['192.168.1.10']);
      expect(monitor.sockets.ipv6?.ipFilters).toEqual(['192.168.1.10']);
      closeSockets(monitor);
    });

    it('should create only the IPv4 socket when enableIpv6 is false', async () => {
      const monitor = new MdnsMonitor({ enableIpv6: false, mdnsPort: await getFreePort('udp') });
      expect(monitor.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(monitor.sockets.ipv6).toBeUndefined();
      closeSockets(monitor);
    });

    it('should use the mDNS port by default and make the sockets verbose', () => {
      const monitor = new MdnsMonitor({ enableIpv6: false, verbose: true });
      expect((monitor as unknown as { mdnsPort: number }).mdnsPort).toBe(5353);
      expect(monitor.sockets.ipv4?.verbose).toBe(true);
      monitor.setLogLevel(LogLevel.DEBUG);
      expect(monitor.sockets.ipv4?.log.logLevel).toBe(LogLevel.DEBUG);
      closeSockets(monitor);
    });

    it('should create only the IPv6 socket, verbose, and use it as the primary socket when enableIpv4 is false', async () => {
      const monitor = new MdnsMonitor({ enableIpv4: false, verbose: true, mdnsPort: await getFreePort('udp') });
      expect(monitor.sockets.ipv4).toBeUndefined();
      expect(monitor.sockets.ipv6?.verbose).toBe(true);
      expect(monitor.log === monitor.sockets.ipv6?.log).toBe(true);
      monitor.setLogLevel(LogLevel.DEBUG);
      expect(monitor.sockets.ipv6?.log.logLevel).toBe(LogLevel.DEBUG);
      closeSockets(monitor);
    });

    it('should throw when both IPv4 and IPv6 are disabled', () => {
      expect(() => new MdnsMonitor({ enableIpv4: false, enableIpv6: false })).toThrow('MdnsMonitor: IPv4 and IPv6 are both disabled');
    });
  });

  describe('lifecycle and runtime', () => {
    it('should bind sockets, send initial queries, disable loopback and log devices once on stop', async () => {
      const monitor = new MdnsMonitor({
        query: true,
        queryIntervalMs: 0,
        loopback: false,
        timeoutMs: 0,
        mdnsPort: await getFreePort('udp'),
      });
      const sendQuerySpy = spyOn(MdnsMonitor.prototype, 'sendQuery');
      const logDevicesSpy = spyOn(Mdns.prototype, 'logDevices');
      const sockets = [monitor.sockets.ipv4, monitor.sockets.ipv6].filter((socket): socket is Mdns => socket !== undefined);
      const readyPromises = sockets.map(
        async (socket) =>
          new Promise<void>((resolve) => {
            socket.once('ready', () => resolve());
          }),
      );

      const closePromises = sockets.map(
        async (socket) =>
          new Promise<void>((resolve) => {
            socket.once('close', () => resolve());
          }),
      );

      monitor.start();
      await Promise.all(readyPromises);
      expect(sendQuerySpy).toHaveBeenCalledTimes(sockets.length);
      for (const socket of sockets) expect(sendQuerySpy).toHaveBeenCalledWith(socket);

      monitor.stop();
      await Promise.all(closePromises);
      expect(logDevicesSpy).toHaveBeenCalledTimes(sockets.length);

      logDevicesSpy.mockClear();
      monitor.stop();
      expect(logDevicesSpy).not.toHaveBeenCalled();

      sendQuerySpy.mockRestore();
      logDevicesSpy.mockRestore();
    });

    it('should call stop automatically when timeoutMs elapses', async () => {
      const monitor = new MdnsMonitor({ timeoutMs: 50, mdnsPort: await getFreePort('udp') });
      const stopSpy = spyOn(monitor, 'stop');
      const sockets = [monitor.sockets.ipv4, monitor.sockets.ipv6].filter((socket): socket is Mdns => socket !== undefined);
      const closePromises = sockets.map(
        async (socket) =>
          new Promise<void>((resolve) => {
            socket.once('close', () => resolve());
          }),
      );

      monitor.start();
      const deadline = Date.now() + 500;
      while (stopSpy.mock.calls.length === 0 && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      expect(stopSpy).toHaveBeenCalledTimes(1);
      await Promise.all(closePromises);
    });

    it('should log socket errors after start', async () => {
      const monitor = new MdnsMonitor({ timeoutMs: 0, enableIpv6: false, mdnsPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      const start = spyOn(ipv4, 'start').mockImplementation(() => {}); // No real bind: only the handlers are registered

      monitor.start();
      ipv4.emit('error', new Error('boom'));
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Server error: boom'));

      start.mockRestore();
      closeSockets(monitor);
    });

    it('should start the sockets only once and not after stop', async () => {
      const monitor = new MdnsMonitor({ timeoutMs: 0, enableIpv6: false, mdnsPort: await getFreePort('udp') });
      const stopped = new MdnsMonitor({ timeoutMs: 0, enableIpv6: false, mdnsPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      const stoppedIpv4 = stopped.sockets.ipv4;
      if (!ipv4 || !stoppedIpv4) throw new Error('IPv4 socket not created');
      const start = spyOn(ipv4, 'start').mockImplementation(() => {}); // No real bind
      const stoppedStart = spyOn(stoppedIpv4, 'start').mockImplementation(() => {});
      spyOn(stoppedIpv4, 'stop').mockImplementation(() => {});

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
      const monitor = new MdnsMonitor({ timeoutMs: 0, enableIpv6: false, verbose: true, query: true, mdnsPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      spyOn(ipv4, 'start').mockImplementation(() => {}); // No real bind
      spyOn(ipv4, 'stop').mockImplementation(() => {});
      const listSpy = spyOn(ipv4, 'listNetworkInterfaces').mockImplementation(() => {});
      const sendQuerySpy = spyOn(monitor, 'sendQuery');

      monitor.start();
      expect(listSpy).toHaveBeenCalledTimes(1);
      monitor.stop();
      ipv4.emit('ready', { address: '0.0.0.0', family: 'IPv4', port: 5353 });
      expect(sendQuerySpy).not.toHaveBeenCalled();
      expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('server ready'));

      closeSockets(monitor);
    });

    it('should repeat the queries every queryIntervalMs', async () => {
      const sendQuerySpy = spyOn(MdnsMonitor.prototype, 'sendQuery');
      const mdnsSendQuerySpy = spyOn(Mdns.prototype, 'sendQuery').mockReturnValue(Buffer.alloc(0));
      const monitor = new MdnsMonitor({ query: true, queryIntervalMs: 20, timeoutMs: 0, enableIpv6: false, mdnsPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');
      const closed = new Promise<void>((resolve) => ipv4.once('close', () => resolve()));

      monitor.start();
      const deadline = Date.now() + 1000;
      while (sendQuerySpy.mock.calls.length < 2 && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
      }
      expect(sendQuerySpy.mock.calls.length).toBeGreaterThanOrEqual(2);

      monitor.stop();
      await closed;
      sendQuerySpy.mockRestore();
      mdnsSendQuerySpy.mockRestore();
    });

    it('should log an error when sending the query fails', async () => {
      const mdnsSendQuerySpy = spyOn(Mdns.prototype, 'sendQuery').mockImplementation(() => {
        throw new Error('send failed');
      });
      const monitor = new MdnsMonitor({ enableIpv6: false, mdnsPort: await getFreePort('udp') });
      const ipv4 = monitor.sockets.ipv4;
      if (!ipv4) throw new Error('IPv4 socket not created');

      monitor.sendQuery(ipv4);
      expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error sending mDNS query: send failed'));

      mdnsSendQuerySpy.mockRestore();
      closeSockets(monitor);
    });
  });

  describe('runMdnsMonitor', () => {
    /** The private options of the monitor read by the tests. */
    interface Internals {
      interfaceName: string | undefined;
      query: boolean;
      queryIntervalMs: number;
      unicast: boolean;
      filters: string[];
      ipFilters: string[];
      loopback: boolean;
      timeoutMs: number;
    }

    /**
     * Removes the signal listeners added by runMdnsMonitor and closes any unstarted sockets.
     *
     * @param {MdnsMonitor | undefined} monitor - The monitor.
     */
    function cleanup(monitor: MdnsMonitor | undefined): void {
      process.removeListener('SIGINT', lastListener('SIGINT'));
      process.removeListener('SIGTERM', lastListener('SIGTERM'));
      closeSockets(monitor);
    }

    /**
     * Runs runMdnsMonitor with a command line that must fail, and restores the exit code.
     *
     * @param {string[]} argv - The command line.
     * @returns {Promise<string>} The error printed.
     */
    async function runWithError(argv: string[]): Promise<string> {
      const exitCode = process.exitCode;
      const sigint = process.listenerCount('SIGINT');
      const result = runMdnsMonitor(argv, { mdnsPort: await getFreePort('udp') });
      const code = process.exitCode;
      process.exitCode = exitCode ?? 0; // Bun ignores undefined, so the exit code of the test run would stay 2
      expect(result).toBeUndefined();
      expect(code).toBe(2);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const message = String(consoleErrorSpy.mock.calls[0][0]);
      expect(message).toContain('Run mdns --help to see the options.');
      return message;
    }

    it('should print the help and start nothing with --help or -h', () => {
      const sigint = process.listenerCount('SIGINT');
      expect(runMdnsMonitor(['--help'])).toBeUndefined();
      expect(runMdnsMonitor(['-h', '--query'])).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(MDNS_MONITOR_HELP);
      expect(MDNS_MONITOR_HELP).toContain('Usage: mdns [options]');
      for (const option of [
        '--interface',
        '--ipv4-address',
        '--ipv6-address',
        '--outgoing-ipv4-address',
        '--outgoing-ipv6-address',
        '--query',
        '--unicast',
        '--filter',
        '--ip-filter',
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
        expect(MDNS_MONITOR_HELP).toContain(option);
      expect(MDNS_MONITOR_HELP).not.toContain('--advertise');
      expect(process.listenerCount('SIGINT')).toBe(sigint);
    });

    it('should report command line errors', async () => {
      expect(await runWithError(['--unknown'])).toContain('--unknown');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--query=abc'])).toContain('invalid --query abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--query', 'abc'])).toContain('invalid --query abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--timeout=-1'])).toContain('invalid --timeout -1');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--timeout', 'abc'])).toContain('invalid --timeout abc');
      consoleErrorSpy.mockClear();
      expect(await runWithError(['--no-ipv4', '--no-ipv6'])).toContain('MdnsMonitor: IPv4 and IPv6 are both disabled');
    });

    it('should map command line options and stop on SIGINT', async () => {
      const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => info.family === 'IPv4' && !info.internal))?.[0] ?? '';
      const start = spyOn(MdnsMonitor.prototype, 'start').mockImplementation(() => {});
      const stop = spyOn(MdnsMonitor.prototype, 'stop').mockImplementation(() => {});
      const sigint = process.listenerCount('SIGINT');

      const monitor = runMdnsMonitor(
        [
          '--interface',
          interfaceName,
          '--filter',
          '_matterc._udp',
          '--filter',
          '_matter._tcp',
          '--ip-filter',
          '192.168.1.20',
          '--query',
          '5',
          '--unicast',
          '--no-loopback',
          '--timeout',
          '30',
          '--debug',
        ],
        { mdnsPort: await getFreePort('udp') },
      );

      expect(start).toHaveBeenCalledTimes(1);
      const internals = monitor as unknown as Internals;
      expect(internals.interfaceName).toBe(interfaceName);
      expect(internals.filters).toEqual(['_matterc._udp', '_matter._tcp']);
      expect(internals.ipFilters).toEqual(['192.168.1.20']);
      expect(internals.query).toBe(true);
      expect(internals.queryIntervalMs).toBe(5000);
      expect(internals.unicast).toBe(true);
      expect(internals.loopback).toBe(false);
      expect(internals.timeoutMs).toBe(30000);
      expect(monitor?.log.logLevel).toBe(LogLevel.DEBUG);
      expect(monitor?.sockets.ipv4?.log.logLevel).toBe(LogLevel.DEBUG);
      expect(monitor?.sockets.ipv6?.log.logLevel).toBe(LogLevel.DEBUG);

      expect(process.listenerCount('SIGINT')).toBe(sigint + 1);
      lastListener('SIGINT')();
      expect(stop).toHaveBeenCalledTimes(1);

      cleanup(monitor);
      start.mockRestore();
      stop.mockRestore();
    });

    it('should log at debug level with -v, at notice level with -s, disable the timeout with --no-timeout and keep the defaults without options', async () => {
      const start = spyOn(MdnsMonitor.prototype, 'start').mockImplementation(() => {});

      const verbose = runMdnsMonitor(['-v', '--no-timeout'], { mdnsPort: await getFreePort('udp') });
      expect((verbose as unknown as Internals).timeoutMs).toBe(0);
      expect(verbose?.log.logLevel).toBe(LogLevel.DEBUG);
      cleanup(verbose);

      const silent = runMdnsMonitor(['-s'], { mdnsPort: await getFreePort('udp') });
      expect(silent?.sockets.ipv4?.log.logLevel).toBe(LogLevel.NOTICE);
      expect(silent?.sockets.ipv6?.log.logLevel).toBe(LogLevel.NOTICE);
      cleanup(silent);

      const debugWins = runMdnsMonitor(['-d', '--silent'], { mdnsPort: await getFreePort('udp') });
      expect(debugWins?.log.logLevel).toBe(LogLevel.DEBUG);
      cleanup(debugWins);

      const defaults = runMdnsMonitor([], { mdnsPort: await getFreePort('udp') });
      expect((defaults as unknown as Internals).timeoutMs).toBeGreaterThan(0);
      expect(defaults?.log.logLevel).not.toBe(LogLevel.DEBUG);
      expect(defaults?.log.logLevel).not.toBe(LogLevel.NOTICE);
      cleanup(defaults);

      expect(start).toHaveBeenCalledTimes(4);
      start.mockRestore();
    });
  });
});
