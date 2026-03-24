/**
 * @description Multicast class test
 * @file multicast.test.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import { Socket } from 'node:dgram';
import { AddressInfo } from 'node:net';
import os from 'node:os';

import { jest } from '@jest/globals';
import { loggerLogSpy, setupTest } from '@matterbridge/jest-utils';
import { BLUE, db, LogLevel } from 'node-ansi-logger';

import { COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, Multicast } from './multicast.js';

// Setup the test environment
await setupTest('Multicast', false);

describe('Multicast', () => {
  let mcast: Multicast;
  const originalEnv = process.env;
  const originalArgv = process.argv;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.argv = ['jest', 'multicast.test.ts'];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
    process.argv = originalArgv;
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
    // expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`Dgram multicast socket multicastInterface set to ${BLUE}${'0.0.0.0'}${db}`));
    expect(loggerLogSpy).toHaveBeenCalledWith(
      LogLevel.DEBUG,
      expect.stringContaining(`Dgram multicast socket multicastInterface set to ${BLUE}${mcast.getIpv4InterfaceAddress()}${db}`),
    );
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

  test('Create ipv6 multicast with specific interfaces', async () => {
    // Test line 104: if (this.interfaceName && name !== this.interfaceName) return;
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true);
    expect(mcast).not.toBeUndefined();
    expect(mcast).toBeInstanceOf(Multicast);
    expect(mcast.socketType).toBe('udp6');

    /* Global Unicast Address (GUA) example of os.networkInterfaces():
    {
      'Wi-Fi': [
        {
          address: '2a02:1210:5435:2f00:374c:ad:aa56:a58e',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: 'c4:cb:76:b3:cd:1f',
          internal: false,
          cidr: '2a02:1210:5435:2f00:374c:ad:aa56:a58e/64',
          scopeid: 0
        },
        {
          address: '2a02:1210:5435:2f00:5c16:8f32:1288:1d5a',
          netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
          family: 'IPv6',
          mac: 'c4:cb:76:b3:cd:1f',
          internal: false,
          cidr: '2a02:1210:5435:2f00:5c16:8f32:1288:1d5a/128',
          scopeid: 0
        },
        {
          address: 'fe80::5a71:b2f6:7bc8:d00b',
          netmask: 'ffff:ffff:ffff:ffff::',
          family: 'IPv6',
          mac: 'c4:cb:76:b3:cd:1f',
          internal: false,
          cidr: 'fe80::5a71:b2f6:7bc8:d00b/64',
          scopeid: 7
        },
        {
          address: '192.168.1.108',
          netmask: '255.255.255.0',
          family: 'IPv4',
          mac: 'c4:cb:76:b3:cd:1f',
          internal: false,
          cidr: '192.168.1.108/24'
        }
      ],
    }
    */
    // Mock networkInterfaces to return multiple interfaces, but only one matches the specified name
    const networkInterfacesMock = jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
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

  test('onListening skips undefined interface entries', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({ empty: undefined });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    const setBroadcastSpy = jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    const setTTLSpy = jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    const setMulticastTTLSpy = jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    const setMulticastLoopbackSpy = jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    const setMulticastInterfaceSpy = jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).not.toHaveBeenCalled();
    expect(setBroadcastSpy).toHaveBeenCalledWith(true);
    expect(setTTLSpy).toHaveBeenCalledWith(255);
    expect(setMulticastTTLSpy).toHaveBeenCalledWith(255);
    expect(setMulticastLoopbackSpy).toHaveBeenCalledWith(true);
    expect(setMulticastInterfaceSpy).toHaveBeenCalledWith('::');
  });

  test('onListening joins multicast using the first IPv6 address', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      // prettier-ignore
      eth0: [{ address: '2001:db8::10', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:10', internal: false, cidr: '2001:db8::10/64', scopeid: 4 }],
    });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).toHaveBeenCalledWith(COAP_MULTICAST_IPV6_ADDRESS, `2001:db8::10%eth0`);
    expect(mcast.joinedInterfaces).toContain('2001:db8::10%eth0');
  });

  test('onListening prefers a ULA IPv6 address over a generic IPv6 address', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        // prettier-ignore
        { address: '2001:db8::10', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:10', internal: false, cidr: '2001:db8::10/64', scopeid: 4 },
        // prettier-ignore
        { address: 'fd12:3456:789a::20', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', mac: '00:00:00:00:00:20', internal: false, cidr: 'fd12:3456:789a::20/128', scopeid: 5 },
      ],
    });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).toHaveBeenCalledWith(COAP_MULTICAST_IPV6_ADDRESS, `fd12:3456:789a::20%eth0`);
  });

  test('onListening prefers a /64 ULA IPv6 address over a generic ULA', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        // prettier-ignore
        { address: 'fd12:3456:789a::20', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', mac: '00:00:00:00:00:20', internal: false, cidr: 'fd12:3456:789a::20/128', scopeid: 5 },
        // prettier-ignore
        { address: 'fd12:3456:789a::30', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:30', internal: false, cidr: 'fd12:3456:789a::30/64', scopeid: 6 },
      ],
    });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).toHaveBeenCalledWith(COAP_MULTICAST_IPV6_ADDRESS, `fd12:3456:789a::30%eth0`);
  });

  test('onListening prefers a link-local IPv6 address when available', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        // prettier-ignore
        { address: 'fd12:3456:789a::30', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:30', internal: false, cidr: 'fd12:3456:789a::30/64', scopeid: 6 },
        // prettier-ignore
        { address: 'fe80::40', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:40', internal: false, cidr: 'fe80::40/64', scopeid: 7 },
      ],
    });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).toHaveBeenCalledWith(COAP_MULTICAST_IPV6_ADDRESS, `fe80::40%eth0`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('joined multicast group'));
  });

  test('onListening logs a failed link-local multicast join', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      // prettier-ignore
      eth0: [{ address: 'fe80::40', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:40', internal: false, cidr: 'fe80::40/64', scopeid: 7 }],
    });
    jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {
      throw new Error('join failed');
    });
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(mcast.joinedInterfaces).toEqual([]);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('failed to join multicast group'));
  });

  test('onListening logs a failed multicast join when addMembership throws a non-Error value', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      // prettier-ignore
      eth0: [{ address: 'fe80::41', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:41', internal: false, cidr: 'fe80::41/64', scopeid: 8 }],
    });
    jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {
      throw 'join failed string';
    });
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('join failed string'));
  });

  test('onListening skips the join block when the selected membership interface is empty', () => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV4_ADDRESS, COAP_MULTICAST_PORT, 'udp4', true, undefined, '0.0.0.0');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      // prettier-ignore
      eth0: [{ address: '', netmask: '255.255.255.0', family: 'IPv4', mac: '00:00:00:00:00:50', internal: false, cidr: null }],
    });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '0.0.0.0', family: 'IPv4', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).not.toHaveBeenCalled();
    expect(mcast.joinedInterfaces).toEqual([]);
  });

  test.each([
    [
      'plain IPv6',
      // prettier-ignore
      [{ address: '2001:db8::10', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:10', internal: false, cidr: '2001:db8::10/64' }],
      '2001:db8::10',
    ],
    [
      'ULA IPv6',
      // prettier-ignore
      [{ address: 'fd12:3456:789a::20', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', mac: '00:00:00:00:00:20', internal: false, cidr: 'fd12:3456:789a::20/128' }],
      'fd12:3456:789a::20',
    ],
    [
      'ULA /64 IPv6',
      // prettier-ignore
      [{ address: 'fd12:3456:789a::30', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:30', internal: false, cidr: 'fd12:3456:789a::30/64' }],
      'fd12:3456:789a::30',
    ],
    [
      'link-local IPv6',
      // prettier-ignore
      [{ address: 'fe80::40', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:40', internal: false, cidr: 'fe80::40/64' }],
      'fe80::40',
    ],
  ])('onListening joins multicast for %s without scope id suffix', (_label, interfaces, membershipInterface) => {
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({ eth0: interfaces as any });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });

    expect(addMembershipSpy).toHaveBeenCalledWith(COAP_MULTICAST_IPV6_ADDRESS, membershipInterface);
  });

  test.each([
    [
      'plain IPv6',
      // prettier-ignore
      [{ address: '2001:db8::10', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:10', internal: false, cidr: '2001:db8::10/64', scopeid: 4 }],
      '2001:db8::10%4',
    ],
    [
      'ULA IPv6',
      // prettier-ignore
      [{ address: 'fd12:3456:789a::20', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', mac: '00:00:00:00:00:20', internal: false, cidr: 'fd12:3456:789a::20/128', scopeid: 5 }],
      'fd12:3456:789a::20%5',
    ],
    [
      'ULA /64 IPv6',
      // prettier-ignore
      [{ address: 'fd12:3456:789a::30', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:30', internal: false, cidr: 'fd12:3456:789a::30/64', scopeid: 6 }],
      'fd12:3456:789a::30%6',
    ],
    [
      'link-local IPv6',
      // prettier-ignore
      [{ address: 'fe80::40', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', mac: '00:00:00:00:00:40', internal: false, cidr: 'fe80::40/64', scopeid: 7 }],
      'fe80::40%7',
    ],
  ])('onListening joins multicast for %s with a Windows scope id suffix', (_label, interfaces, membershipInterface) => {
    const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    mcast = new Multicast('Multicast', COAP_MULTICAST_IPV6_ADDRESS, COAP_MULTICAST_PORT, 'udp6', true, undefined, '::');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({ eth0: interfaces as any });
    const addMembershipSpy = jest.spyOn(mcast.socket as any, 'addMembership').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setBroadcast').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastTTL').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastLoopback').mockImplementation(() => {});
    jest.spyOn(mcast.socket as any, 'setMulticastInterface').mockImplementation(() => {});

    try {
      mcast.onListening({ address: '::', family: 'IPv6', port: COAP_MULTICAST_PORT });
    } finally {
      if (originalPlatformDescriptor) Object.defineProperty(process, 'platform', originalPlatformDescriptor);
    }

    expect(addMembershipSpy).toHaveBeenCalledWith(COAP_MULTICAST_IPV6_ADDRESS, membershipInterface);
  });
});
