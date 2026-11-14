/**
 * @file packages/dgram/buntest/matterbridgeAdvertise.test.ts
 * @description Matterbridge frontend defaults and command line tests
 * @author Luca Liguori
 */

import { afterAll, afterEach, describe, expect, it, spyOn, vi } from 'bun:test';
import os from 'node:os';

import { consoleErrorSpy, consoleLogSpy, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import { LogLevel } from 'node-ansi-logger';

import { MATTERBRIDGE_ADVERTISE_HELP, MatterbridgeAdvertise, runMatterbridgeAdvertise } from '../src/matterbridgeAdvertise.js';
import { Mdns } from '../src/mdns.js';

await setupTest('MatterbridgeAdvertiseTest');
let nextPort = 40000 + Math.floor(Math.random() * 20000);

describe('MatterbridgeAdvertise', () => {
  afterEach(() => vi.clearAllMocks());
  afterAll(() => {
    vi.restoreAllMocks();
    resetTest();
  });
  describe('construction', () => {
    it('should derive the host and instance names from the interface MAC address when no names are given', () => {
      const advertiser = new MatterbridgeAdvertise({ addressCheckIntervalMs: 0 });
      expect(advertiser.hostName).toMatch(/^matterbridge-[0-9A-F]{12}\.local$/);
      const id = advertiser.hostName.slice('matterbridge-'.length, -'.local'.length);
      expect(advertiser.instanceName).toBe(`Matterbridge ${id.slice(-6)}`);
      expect(advertiser.aliasName).toBeUndefined(); // Not owned before probing
      expect(advertiser.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(advertiser.sockets.ipv6).toBeInstanceOf(Mdns);
      advertiser.sockets.ipv4?.socket.close();
      advertiser.sockets.ipv6?.socket.close();
    });

    it('should use the given names and create only the enabled sockets', () => {
      const advertiser = new MatterbridgeAdvertise({ hostName: 'bridge', instanceName: 'My Bridge', alias: false, enableIpv6: false, addressCheckIntervalMs: 0 });
      expect(advertiser.hostName).toBe('bridge.local');
      expect(advertiser.instanceName).toBe('My Bridge');
      expect(advertiser.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(advertiser.sockets.ipv6).toBeUndefined();
      advertiser.sockets.ipv4?.socket.close();
    });

    it('should throw when no external interface is found', () => {
      const networkInterfaces = spyOn(os, 'networkInterfaces').mockReturnValue({});
      expect(() => new MatterbridgeAdvertise()).toThrow('network interface (none found) not available');
      networkInterfaces.mockRestore();
    });
  });

  describe('runMatterbridgeAdvertise', () => {
    /** The private options of the advertiser read by the tests. */
    interface Internals {
      port: number;
      services: string[];
      txt: string[];
      aliasLabel: string | undefined;
      addressCheckIntervalMs: number;
    }

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
     * Removes the signal listeners added by runMatterbridgeAdvertise and closes the sockets of an advertiser that was never started.
     *
     * @param {MatterbridgeAdvertise | undefined} advertiser - The advertiser.
     */
    function cleanup(advertiser: MatterbridgeAdvertise | undefined): void {
      process.removeListener('SIGINT', lastListener('SIGINT'));
      process.removeListener('SIGTERM', lastListener('SIGTERM'));
      advertiser?.sockets.ipv4?.socket.close();
      advertiser?.sockets.ipv6?.socket.close();
    }

    /**
     * Runs runMatterbridgeAdvertise with a command line that must fail, and restores the exit code.
     *
     * @param {string[]} argv - The command line.
     * @returns {Promise<string>} The error printed.
     */
    async function runWithError(argv: string[]): Promise<string> {
      const exitCode = process.exitCode;
      const sigint = process.listenerCount('SIGINT');
      const result = await runMatterbridgeAdvertise(argv, { mdnsPort: nextPort++, addressCheckIntervalMs: 0 });
      const code = process.exitCode;
      process.exitCode = exitCode;
      expect(result).toBeUndefined();
      expect(code).toBe(2);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const message = String(consoleErrorSpy.mock.calls[0][0]);
      expect(message).toContain('Run mdns-advertise --help to see the options.');
      return message;
    }

    it('should create and start an advertiser from the command line arguments, and stop it on SIGINT', async () => {
      const interfaceName = Object.entries(os.networkInterfaces()).find(([, infos]) => infos?.some((info) => info.family === 'IPv4' && !info.internal))?.[0] ?? '';
      const start = spyOn(MatterbridgeAdvertise.prototype, 'start').mockImplementation(async () => {});
      const stop = spyOn(MatterbridgeAdvertise.prototype, 'stop');
      const sigint = process.listenerCount('SIGINT');
      const advertiser = await runMatterbridgeAdvertise(['--interface', interfaceName, '--port', '5541', '--hostname', 'test-host', '--instance', 'Test Instance'], {
        mdnsPort: nextPort++,
        addressCheckIntervalMs: 0,
      });
      expect(start).toHaveBeenCalledTimes(1);
      expect(advertiser?.interfaceName).toBe(interfaceName);
      expect(advertiser?.hostName).toBe('test-host.local');
      expect(advertiser?.instanceName).toBe('Test Instance');
      expect((advertiser as unknown as Internals).port).toBe(5541);
      expect(process.listenerCount('SIGINT')).toBe(sigint + 1);
      lastListener('SIGINT')(); // As the signal would
      expect(stop).toHaveBeenCalledTimes(1);
      cleanup(advertiser);
      start.mockRestore();
      stop.mockRestore();
    });

    it('should use the defaults when no arguments are given', async () => {
      const start = spyOn(MatterbridgeAdvertise.prototype, 'start').mockImplementation(async () => {});
      const advertiser = await runMatterbridgeAdvertise([], { mdnsPort: nextPort++ });
      expect(advertiser?.hostName).toMatch(/^matterbridge-[0-9A-F]{12}\.local$/);
      expect(advertiser?.instanceName).toMatch(/^Matterbridge [0-9A-F]{6}$/);
      const internals = advertiser as unknown as Internals;
      expect(internals.port).toBe(8283);
      expect(internals.services).toEqual(['_matterbridge._tcp', '_http._tcp']);
      expect(internals.txt).toEqual(['txtvers=1', 'path=/']);
      expect(internals.aliasLabel).toBe('matterbridge');
      expect(internals.addressCheckIntervalMs).toBe(10000);
      expect(advertiser?.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(advertiser?.sockets.ipv6).toBeInstanceOf(Mdns);
      expect(advertiser?.log.logLevel).toBe(LogLevel.INFO);
      cleanup(advertiser);
      start.mockRestore();
    });

    it('should apply every option of the command line', async () => {
      const start = spyOn(MatterbridgeAdvertise.prototype, 'start').mockImplementation(async () => {});
      const argv = ['--alias', 'mb-test', '--service', '_http._tcp', '--service', '_test._udp', '--txt', 'a=1', '--txt', 'b=2', '--address-check', '5', '--no-ipv6', '--debug'];
      const advertiser = await runMatterbridgeAdvertise(argv, { mdnsPort: nextPort++ });
      const internals = advertiser as unknown as Internals;
      expect(internals.aliasLabel).toBe('mb-test');
      expect(internals.services).toEqual(['_http._tcp', '_test._udp']);
      expect(internals.txt).toEqual(['a=1', 'b=2']);
      expect(internals.addressCheckIntervalMs).toBe(5000);
      expect(advertiser?.sockets.ipv4).toBeInstanceOf(Mdns);
      expect(advertiser?.sockets.ipv6).toBeUndefined();
      expect(advertiser?.log.logLevel).toBe(LogLevel.DEBUG);
      cleanup(advertiser);
      start.mockRestore();
    });

    it('should not claim an alias with --no-alias and advertise only on IPv6 with --no-ipv4', async () => {
      const start = spyOn(MatterbridgeAdvertise.prototype, 'start').mockImplementation(async () => {});
      const advertiser = await runMatterbridgeAdvertise(['--no-alias', '--no-ipv4'], { mdnsPort: nextPort++, addressCheckIntervalMs: 0 });
      expect((advertiser as unknown as Internals).aliasLabel).toBeUndefined();
      expect(advertiser?.sockets.ipv4).toBeUndefined();
      expect(advertiser?.sockets.ipv6).toBeInstanceOf(Mdns);
      cleanup(advertiser);
      start.mockRestore();
    });

    it('should print the help and start nothing with --help or -h', async () => {
      const sigint = process.listenerCount('SIGINT');
      expect(await runMatterbridgeAdvertise(['--help'])).toBeUndefined();
      expect(await runMatterbridgeAdvertise(['-h', '--port', '5540'])).toBeUndefined();
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(MATTERBRIDGE_ADVERTISE_HELP);
      expect(MATTERBRIDGE_ADVERTISE_HELP).toContain('Usage: mdns-advertise [options]');
      for (const option of [
        '--interface',
        '--port',
        '--hostname',
        '--alias',
        '--no-alias',
        '--instance',
        '--service',
        '--txt',
        '--address-check',
        '--no-ipv4',
        '--no-ipv6',
        '--debug',
        '--help',
      ])
        expect(MATTERBRIDGE_ADVERTISE_HELP).toContain(option);
      expect(process.listenerCount('SIGINT')).toBe(sigint);
    });

    it('should report an unknown option', async () => {
      expect(await runWithError(['--unknown'])).toContain('--unknown');
    });

    it('should report an invalid address check interval', async () => {
      expect(await runWithError(['--address-check', 'abc'])).toContain('invalid --address-check abc');
    });

    it('should report the advertiser errors, such as an invalid port', async () => {
      expect(await runWithError(['--port', 'abc'])).toContain('invalid port');
    });
  });
});
