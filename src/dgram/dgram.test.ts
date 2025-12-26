/**
 * @description Dgram class test
 * @file dgram.test.ts
 * @author Luca Liguori
 * @created 2025-03-22
 * @version 1.0.0
 * @license Apache-2.0
 * @copyright 2025, 2026, 2027 Luca Liguori.
 */

import os from 'node:os';

import { BLUE, db, LogLevel } from 'node-ansi-logger';
import { jest } from '@jest/globals';

import { loggerDebugSpy, loggerLogSpy, setupTest } from '../jestutils/jestHelpers.js';

import { Dgram } from './dgram.js';

// Setup the test environment
await setupTest('Dgram', false);

describe('Dgram', () => {
  let dgram: Dgram;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test('Create the dgram with udp4', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    expect(dgram).not.toBeUndefined();
    expect(dgram).toBeInstanceOf(Dgram);
    expect(dgram.socketType).toBe('udp4');
    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Create the dgram with udp6', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    expect(dgram).not.toBeUndefined();
    expect(dgram).toBeInstanceOf(Dgram);
    expect(dgram.socketType).toBe('udp6');
    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Send a message successfully', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const sendSpy = jest.spyOn(dgram.socket, 'send').mockImplementation((...args: any[]) => {
      const callback = args[args.length - 1];
      if (callback) callback(null, args[2]);
    });

    const message = Buffer.from('Hello');
    dgram.send(message, '127.0.0.1', 12345);

    expect(sendSpy).toHaveBeenCalledWith(message, 0, message.length, 12345, '127.0.0.1', expect.any(Function));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Socket sent a message to ${BLUE}${'127.0.0.1'}${db}:${BLUE}${12345}${db}`);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle error when sending a message', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    dgram.on('error', (error: Error) => {
      dgram.log.error(`Error: ${error.message}`);
    });
    const sendSpy = jest.spyOn(dgram.socket, 'send').mockImplementation((...args: any[]) => {
      const callback = args[args.length - 1];
      if (callback) callback(new Error('Mock send error'), 0);
    });
    const errorSpy = jest.spyOn(dgram, 'onError');
    const message = Buffer.from('Hello');
    dgram.send(message, '127.0.0.1', 12345);

    expect(sendSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining(`Socket failed to send a message:`));

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle socket error event', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    dgram.on('error', (error: Error) => {
      dgram.log.error(`Error: ${error.message}`);
    });
    const errorSpy = jest.spyOn(dgram, 'onError');
    const error = new Error('Socket error');

    dgram.socket.emit('error', error);

    expect(errorSpy).toHaveBeenCalledWith(error);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle socket close event', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const closeSpy = jest.spyOn(dgram, 'onClose');

    dgram.socket.emit('close');

    expect(closeSpy).toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle socket connect event', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const connectSpy = jest.spyOn(dgram, 'onConnect');

    dgram.socket.emit('connect');

    expect(connectSpy).toHaveBeenCalled();

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle socket message event', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const messageSpy = jest.spyOn(dgram, 'onMessage');
    const message = Buffer.from('Hello');
    const rinfo = { address: '127.0.0.1', family: 'IPv4', port: 12345, size: message.length };

    dgram.socket.emit('message', message, rinfo);

    expect(messageSpy).toHaveBeenCalledWith(message, rinfo);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle socket listening event', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const listeningSpy = jest.spyOn(dgram, 'onListening');
    const address = { address: '127.0.0.1', family: 'IPv4', port: 12345 };

    jest.spyOn(dgram.socket, 'address').mockReturnValue(address);

    dgram.socket.emit('listening');

    expect(listeningSpy).toHaveBeenCalledWith(address);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv4 broadcast address', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const broadcastAddress = dgram.getIpv4BroadcastAddress('192.168.1.120', '255.255.255.0');

    expect(broadcastAddress).toBe('192.168.1.255');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 broadcast address', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    const broadcastAddress = dgram.getIpv6BroadcastAddress();

    expect(broadcastAddress).toBe('ff02::1');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv4 interface address', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: '192.168.1.120', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null }],
    });

    const ipv4Address = dgram.getIpv4InterfaceAddress('eth0');
    expect(ipv4Address).toBe('192.168.1.120');

    expect(dgram.getInterfacesNames()).toEqual(['eth0']);
    expect(dgram.getIpv6ScopeId()).toEqual('');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv4 interface address with no suitable interface', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({});

    expect(() => dgram.getIpv4InterfaceAddress()).toThrow("Didn't find an external IPv4 network interface");

    expect(dgram.getInterfacesNames()).toEqual([]);
    expect(dgram.getIpv6ScopeId()).toEqual('');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv4 interface address with undefined interfaces', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({ empty: undefined });

    expect(() => dgram.getIpv4InterfaceAddress()).toThrow("Didn't find an external IPv4 network interface");

    expect(dgram.getInterfacesNames()).toEqual([]);
    expect(dgram.getIpv6ScopeId()).toEqual('');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv4 interface address with interface with internal only addresses', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({ internalonly: [{ address: '192.168.1.120', family: 'IPv4', internal: true, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null }] });

    expect(() => dgram.getIpv4InterfaceAddress('internalonly')).toThrow('Interface internalonly does not have an external IPv4 address');

    expect(dgram.getInterfacesNames()).toEqual(['internalonly']);
    expect(dgram.getIpv6ScopeId()).toEqual('');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv4 interface address with non existing interface name', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({ eth0: [{ address: '192.168.1.120', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null }] });
    dgram.getIpv4InterfaceAddress('NoName');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Interface "${'NoName'}" not found. Using first external IPv4 interface.`);

    expect(dgram.getInterfacesNames()).toEqual(['eth0']);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 interface address with no suitable interface', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({});

    expect(() => dgram.getIpv6InterfaceAddress()).toThrow("Didn't find an external IPv6 network interface");

    expect(dgram.getInterfacesNames()).toEqual([]);
    expect(dgram.getIpv6ScopeId()).toEqual('');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 interface address with non existing interface name', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      /* prettier-ignore */
      eth0: [{ address: 'fd78:cbf8:4939:746:a58f:3de1:74fc:5db9', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
            { address: 'fd78:cbf8:4939:746:18b5:993b:ce2c:a95e', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
            { address: 'fe80::5a71:b2f6:7bc8:d00b', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 2, mac: '00:00:00:00:00:00', cidr: null }
        ],
    });
    const info = dgram.getIpv6InterfaceAddress('NoName');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.WARN, `Interface "${'NoName'}" not found. Using first external IPv6 interface.`);

    expect(dgram.getInterfacesNames()).toEqual(['eth0']);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 interface address with link-local address', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      /* prettier-ignore */
      eth0: [{ address: 'fd78:cbf8:4939:746:a58f:3de1:74fc:5db9', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
            { address: 'fd78:cbf8:4939:746:18b5:993b:ce2c:a95e', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
            { address: 'fe80::5a71:b2f6:7bc8:d00b', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 2, mac: '00:00:00:00:00:00', cidr: null }
      ],
    });
    const info = dgram.getIpv6InterfaceAddress();
    expect(info).toBeDefined();
    expect(info).toBe(`fe80::5a71:b2f6:7bc8:d00b%` + (process.platform === 'win32' ? `2` : `eth0`));

    expect(dgram.getInterfacesNames()).toEqual(['eth0']);

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 interface address with global unique local address', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      /* prettier-ignore */
      eth0: [
        { address: 'fd78:cbf8:4939:746:18b5:993b:ce2c:a95e', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
        { address: 'fd78:cbf8:4939:746:a58f:3de1:74fc:5db9', netmask: 'ffff:ffff:ffff:ffff::', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
      ],
    });
    const info = dgram.getIpv6InterfaceAddress();
    expect(info).toBeDefined();
    expect(info).toBe('fd78:cbf8:4939:746:a58f:3de1:74fc:5db9');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 interface address with unique local address', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      /* prettier-ignore */
      eth0: [
        { address: 'fd78:cbf8:4939:746:18b5:993b:ce2c:a95e', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
      ],
    });
    const info = dgram.getIpv6InterfaceAddress();
    expect(info).toBeDefined();
    expect(info).toBe('fd78:cbf8:4939:746:18b5:993b:ce2c:a95e');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get IPv6 interface address with no suitable address', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      /* prettier-ignore */
      eth0: [
        { address: 'fe78:cbf8:4939:746:18b5:993b:ce2c:a95e', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 0, mac: '00:00:00:00:00:00', cidr: null },
      ],
    });
    expect(() => dgram.getIpv6InterfaceAddress()).toThrow('Interface eth0 does not have a suitable external IPv6 address');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get interface name from scope ID', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 2, mac: '00:00:00:00:00:00', cidr: null }],
    });

    const interfaceName = dgram.getInterfaceNameFromScopeId(2);
    expect(interfaceName).toBe('eth0');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get interface name from invalid scope ID', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: 'fe80::1', netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', family: 'IPv6', internal: false, scopeid: 2, mac: '00:00:00:00:00:00', cidr: null }],
    });

    const interfaceName = dgram.getInterfaceNameFromScopeId(3);
    expect(interfaceName).toBeUndefined();

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get netmask for a valid interface address', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: '192.168.1.120', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null }],
    });

    const netmask = dgram.getNetmask('192.168.1.120');
    expect(netmask).toBe('255.255.255.0');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Get netmask for an invalid interface address', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [{ address: '192.168.1.120', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null }],
    });

    const netmask = dgram.getNetmask('192.168.1.121');
    expect(netmask).toBeUndefined();

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('List network interfaces', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    jest.spyOn(os, 'networkInterfaces').mockReturnValue({
      eth0: [
        { address: '192.168.1.120', family: 'IPv4', internal: false, netmask: '255.255.255.0', mac: '00:00:00:00:00:00', cidr: null },
        { address: 'fe80::1', family: 'IPv6', internal: false, netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff', scopeid: 2, mac: '00:00:00:00:00:00', cidr: null },
      ],
    });

    dgram.listNetworkInterfaces();

    expect(loggerDebugSpy).toHaveBeenCalledTimes(4);
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('192.168.1.120'));
    expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('fe80::1'));

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle invalid IPv4 broadcast address inputs', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const broadcastAddress = dgram.getIpv4BroadcastAddress(undefined, undefined);
    expect(broadcastAddress).toBeUndefined();

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle invalid IPv6 broadcast address inputs', async () => {
    dgram = new Dgram('Dgram', 'udp6');
    const broadcastAddress = dgram.getIpv6BroadcastAddress();
    expect(broadcastAddress).toBe('ff02::1');

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });

  test('Handle socket binding failure', async () => {
    dgram = new Dgram('Dgram', 'udp4');
    const errorSpy = jest.spyOn(dgram, 'onError');
    const bindSpy = jest.spyOn(dgram.socket, 'bind').mockImplementation(() => {
      throw new Error('Bind failed');
    });

    expect(() => dgram.socket.bind()).toThrow('Bind failed');
    expect(bindSpy).toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled(); // Error is not emitted in this case

    await new Promise<void>((resolve) => {
      dgram.on('close', resolve);
      dgram.socket.close();
    });
  });
});
