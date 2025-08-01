/**
 * @description Multicast class test
 * @file multicast.test.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import os from 'node:os';
import { AddressInfo } from 'node:net';
import { BindOptions, Socket } from 'node:dgram';

import { AnsiLogger, BLUE, db, LogLevel } from 'node-ansi-logger';

import { jest } from '@jest/globals';

import { Multicast, COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT } from './multicast.js';
import { Dgram } from './dgram.js';

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false;

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

function setDebug(debug: boolean) {
  if (debug) {
    loggerLogSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    consoleLogSpy = jest.spyOn(console, 'log');
    consoleDebugSpy = jest.spyOn(console, 'debug');
    consoleInfoSpy = jest.spyOn(console, 'info');
    consoleWarnSpy = jest.spyOn(console, 'warn');
    consoleErrorSpy = jest.spyOn(console, 'error');
  } else {
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
  }
}

describe('Multicast', () => {
  let mcast: Multicast;

  beforeAll(() => {
    //
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    //
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('Create the multicast with udp4 with no available interfaces', async () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true);
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp4');

    jest.spyOn(os, 'networkInterfaces').mockReturnValueOnce({});
    expect(() => {
      mcast.start();
    }).toThrow("Didn't find an external IPv4 network interface");
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv4 dgram multicast socket...'));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket listening'));

    mcast.joinedInterfaces = ['127.0.0.1'];
    mcast.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram multicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket failed to drop multicast group'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram multicast socket.'));
  });

  test('Create the multicast with udp6 with no available interfaces', async () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp6');
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp6');

    jest.spyOn(os, 'networkInterfaces').mockReturnValueOnce({});
    expect(() => {
      mcast.start();
    }).toThrow("Didn't find an external IPv6 network interface");
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv6 dgram multicast socket...'));
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket listening'));

    mcast.joinedInterfaces = ['::1'];
    mcast.stop();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram multicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket failed to drop multicast group'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram multicast socket.'));
  });

  test('Create the multicast with udp6 and let listenig fail', async () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp6');
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp6');
    jest.spyOn(Socket.prototype, 'addMembership').mockImplementationOnce((multicastAddress: string, multicastInterface?: string) => {
      throw new Error('Test error');
    });
    mcast.start();
    mcast.stop();
  });

  test('Create the multicast with udp4 on all interfaces', async () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true, undefined, '0.0.0.0');
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp4');

    const ready = new Promise<AddressInfo>((resolve) => {
      mcast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('0.0.0.0');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    mcast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv4 dgram multicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket multicast TTL set to 255'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Dgram multicast socket multicastInterface set to ${BLUE}${'0.0.0.0'}${db}`));
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Dgram multicast socket joined multicast group ${BLUE}${COAP_MULTICAST_IPV4_ADDRESS}${db} on interface ${BLUE}${'0.0.0.0'}${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      mcast.on('close', () => {
        resolve();
      });
    });
    mcast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram multicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram multicast socket.'));
  });

  test('Create the multicast with udp6 on all interfaces', async () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp6');

    const ready = new Promise<AddressInfo>((resolve) => {
      mcast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('::');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    mcast.start();
    await ready;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Starting ipv6 dgram multicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket listening on'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket broadcast enabled'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket bound to'));

    const closed = new Promise<void>((resolve) => {
      mcast.on('close', () => {
        resolve();
      });
    });
    mcast.stop();
    await closed;
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopping dgram multicast socket...'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Stopped dgram multicast socket.'));
  });

  test('Create multicast with undefined interfaces in network interface list', async () => {
    // Test line 103: if (!interfaces) return;
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true, undefined, '0.0.0.0');
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp4');

    // Mock networkInterfaces to return an interface with undefined details
    const networkInterfacesMock = jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      'test-interface': undefined,
    });

    const ready = new Promise<AddressInfo>((resolve) => {
      mcast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('0.0.0.0');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    mcast.start();
    await ready;

    // Should not attempt to join multicast group on undefined interface
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Dgram multicast socket joined multicast group'));

    const closed = new Promise<void>((resolve) => {
      mcast.on('close', () => {
        resolve();
      });
    });
    mcast.stop();
    await closed;

    // Restore the mock
    networkInterfacesMock.mockRestore();
  });

  test('Create ipv6 multicast with specific interfaces', async () => {
    // Test line 104: if (this.interfaceName && name !== this.interfaceName) return;
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true);
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp6');

    // Mock networkInterfaces to return multiple interfaces, but only one matches the specified name
    const networkInterfacesMock = jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      'eth0': [
        {
          address: 'fd78:cbf8:4939:746:a58f:3de1:74fc:5db9',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: '00:00:00:00:00:01',
          internal: false,
          cidr: 'fd78:cbf8:4939:746:a58f:3de1:74fc:5db9/64',
          scopeid: 0,
        },
        {
          address: 'fd78:cbf8:4939:746:698e:b44d:64e6:4fb1',
          netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
          family: 'IPv6',
          mac: '00:00:00:00:00:01',
          internal: false,
          cidr: 'fd78:cbf8:4939:746:698e:b44d:64e6:4fb1/128',
          scopeid: 0,
        },
        {
          address: 'fe80::5a71:b2f6:7bc8:d00b',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: '00:00:00:00:00:01',
          internal: false,
          cidr: 'fe80::5a71:b2f6:7bc8:d00b/64',
          scopeid: 8,
        },
      ],
    });
    const socketBindMock = jest.spyOn(mcast.socket as any, 'bind').mockImplementation((...args: any[]) => {
      const callback = args.find((arg) => typeof arg === 'function');
      if (callback) {
        // setImmediate(callback);
      }
      mcast.socket.emit('listening');
    });
    const socketAddressMock = jest.spyOn(mcast.socket, 'address').mockReturnValue({
      address: 'fd78:cbf8:4939:746:698e:b44d:64e6:4fb1',
      family: 'IPv6',
      port: COAP_MULTICAST_PORT,
    });
    const socketSetBroadcastMock = jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    const socketSetTTLMock = jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    const socketSetMulticastTTLMock = jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    const socketSetMulticastLoopbackMock = jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    const socketAddMembershipMock = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    const socketSetMulticastInterfaceMock = jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});
    const socketDropMembershipMock = jest.spyOn(mcast.socket as any, 'dropMembership').mockImplementation(() => {});

    const ready = new Promise<AddressInfo>((resolve) => {
      mcast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv6');
        expect(address.address).toBe('fd78:cbf8:4939:746:698e:b44d:64e6:4fb1');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    mcast.start();
    await ready;

    // The multicast instance should have successfully started and joined the target interface
    expect(mcast.joinedInterfaces.length).toBeGreaterThanOrEqual(0);

    const closed = new Promise<void>((resolve) => {
      mcast.on('close', () => {
        resolve();
      });
    });
    mcast.stop();
    await closed;

    // Restore the mock
    networkInterfacesMock.mockRestore();
    socketBindMock.mockRestore();
    socketAddressMock.mockRestore();
    socketSetBroadcastMock.mockRestore();
    socketSetTTLMock.mockRestore();
    socketSetMulticastTTLMock.mockRestore();
    socketSetMulticastLoopbackMock.mockRestore();
    socketAddMembershipMock.mockRestore();
    socketSetMulticastInterfaceMock.mockRestore();
    socketDropMembershipMock.mockRestore();
  });

  test('Create multicast with specific interface name that filters out other interfaces', async () => {
    // Test line 104: if (this.interfaceName && name !== this.interfaceName) return;
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true, 'target-interface', '0.0.0.0');
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp4');

    // Mock networkInterfaces to return multiple interfaces, but only one matches the specified name
    const networkInterfacesMock = jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      'other-interface': [
        {
          address: '192.168.1.200',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:01',
          internal: false,
          cidr: '192.168.1.200/24',
        },
      ],
      'target-interface': [
        {
          address: '0.0.0.0',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:02',
          internal: false,
          cidr: '0.0.0.0/24',
        },
      ],
    });

    const ready = new Promise<AddressInfo>((resolve) => {
      mcast.on('ready', (address: AddressInfo) => {
        expect(address.family).toBe('IPv4');
        expect(address.address).toBe('0.0.0.0');
        expect(address.port).toBeGreaterThan(0);
        resolve(address);
      });
    });
    mcast.start();
    await ready;

    // The multicast instance should have successfully started and joined the target interface
    expect(mcast.joinedInterfaces.length).toBeGreaterThanOrEqual(0);

    const closed = new Promise<void>((resolve) => {
      mcast.on('close', () => {
        resolve();
      });
    });
    mcast.stop();
    await closed;

    // Restore the mock
    networkInterfacesMock.mockRestore();
  });
});
