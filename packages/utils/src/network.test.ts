// src\utils\network.test.ts

import dns from 'node:dns';
import os from 'node:os';

import { jest } from '@jest/globals';
import { loggerLogSpy, setupTest } from '@matterbridge/jest-utils';
import { BLUE, LogLevel, nf } from 'node-ansi-logger';

import { getInterfaceDetails, getInterfaceName, getIpv4InterfaceAddress, getIpv6InterfaceAddress, getMacAddress, logInterfaces, resolveHostname } from './network.js';

jest.useFakeTimers();

await setupTest('Network');

describe('getInterfaceDetails() / getInterfaceName() / getIpv4InterfaceAddress / getIpv6InterfaceAddress / getMacAddress', () => {
  const fakeIfaces = {
    missed: undefined,
    empty: [],
    tailscale: [
      { family: 'IPv4', internal: false, address: '1.2.3.4', mac: 'aa:bb:cc:dd:ee:ff' },
      { family: 'IPv6', internal: false, address: '::1', mac: 'aa:bb:cc:dd:ee:ff' },
    ],
    eth0: [
      { family: 'IPv4', internal: false, address: '1.2.3.4', mac: 'aa:bb:cc:dd:ee:ff' },
      { family: 'IPv6', internal: false, address: '::1', mac: 'aa:bb:cc:dd:ee:ff' },
    ],
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1', mac: '00:00:00:00:00:00' }],
  };

  beforeAll(() => {
    jest.spyOn(os, 'networkInterfaces').mockReturnValue(fakeIfaces as any);
  });

  it('returns the first non-internal interface details', () => {
    expect(getInterfaceDetails()).toEqual({
      interfaceName: 'eth0',
      ipv4Address: '1.2.3.4',
      ipv6Address: '::1',
      macAddress: 'aa:bb:cc:dd:ee:ff',
    });
  });

  it('returns the first non-internal interface name', () => {
    expect(getInterfaceName()).toBe('eth0');
  });

  it('returns the first non-internal IPv4 address', () => {
    expect(getIpv4InterfaceAddress()).toBe('1.2.3.4');
  });

  it('returns the first non-internal IPv6 address', () => {
    expect(getIpv6InterfaceAddress()).toBe('::1');
  });

  it('returns the first non-internal IPv6 address with scope on Windows (uses %scopeid)', () => {
    const platformSpy = jest.spyOn(os, 'platform').mockReturnValue('win32');
    (os.networkInterfaces as jest.Mock).mockReturnValue({
      eth0: [{ family: 'IPv6', internal: false, address: 'fe80::1', scopeid: 11, mac: 'aa' }],
    } as any);

    expect(getIpv6InterfaceAddress(true)).toBe('fe80::1%11');
    platformSpy.mockRestore();
    (os.networkInterfaces as jest.Mock).mockReturnValue(fakeIfaces as any);
  });

  it('returns the first non-internal IPv6 address with scope on non-Windows (uses %interfaceName)', () => {
    const platformSpy = jest.spyOn(os, 'platform').mockReturnValue('linux');
    (os.networkInterfaces as jest.Mock).mockReturnValue({
      eth0: [{ family: 'IPv6', internal: false, address: 'fe80::1', mac: 'aa' }],
    } as any);

    expect(getIpv6InterfaceAddress(true)).toBe('fe80::1%eth0');
    platformSpy.mockRestore();
    (os.networkInterfaces as jest.Mock).mockReturnValue(fakeIfaces as any);
  });

  it('returns the IPv6 address unchanged when it already contains a zone id', () => {
    const platformSpy = jest.spyOn(os, 'platform').mockReturnValue('win32');
    (os.networkInterfaces as jest.Mock).mockReturnValue({
      eth0: [{ family: 'IPv6', internal: false, address: 'fe80::1%11', scopeid: 11, mac: 'aa' }],
    } as any);

    expect(getIpv6InterfaceAddress(true)).toBe('fe80::1%11');
    platformSpy.mockRestore();
    (os.networkInterfaces as jest.Mock).mockReturnValue(fakeIfaces as any);
  });

  it('returns the IPv6 address without scope when scope id is not available on Windows', () => {
    const platformSpy = jest.spyOn(os, 'platform').mockReturnValue('win32');
    (os.networkInterfaces as jest.Mock).mockReturnValue({
      eth0: [{ family: 'IPv6', internal: false, address: 'fe80::1', mac: 'aa' }],
    } as any);

    expect(getIpv6InterfaceAddress(true)).toBe('fe80::1');
    platformSpy.mockRestore();
    (os.networkInterfaces as jest.Mock).mockReturnValue(fakeIfaces as any);
  });

  it('returns the MAC address from the first non-internal interface', () => {
    expect(getMacAddress()).toBe('aa:bb:cc:dd:ee:ff');
  });

  it('returns undefined if no interfaces', () => {
    (os.networkInterfaces as jest.Mock).mockReturnValue({});
    expect(getIpv4InterfaceAddress()).toBeUndefined();
    expect(getIpv6InterfaceAddress()).toBeUndefined();
    expect(getMacAddress()).toBeUndefined();
  });

  it('returns undefined if no details', () => {
    const fakeIfaces = {
      eth0: undefined,
      wlan0: null,
      lo: undefined,
    };
    (os.networkInterfaces as jest.Mock).mockReturnValue(fakeIfaces);
    expect(getIpv4InterfaceAddress()).toBeUndefined();
    expect(getIpv6InterfaceAddress()).toBeUndefined();
    expect(getMacAddress()).toBeUndefined();
  });
});

describe('logInterfaces()', () => {
  const fakeIfaces = {
    eth0: [{ family: 'IPv4', internal: false, address: '1.2.3.4', mac: 'aa' }],
    eth1: [{ family: 'IPv4', internal: false, scopeid: 1, cidr: '1.2.3.4', address: '1.2.3.4', mac: 'aa' }],
    wlan0: null,
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1', mac: '00:00:00:00:00:00' }],
  };

  beforeAll(() => {
    jest.spyOn(os, 'networkInterfaces').mockReturnValueOnce(fakeIfaces as any);
  });

  afterAll(() => {});

  it('logs interface details when debug=true', () => {
    logInterfaces();
    // First call: Available Network Interfaces:
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Available Network Interfaces:');
    // Second: Interface: <idn>eth0<rs>
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Network interface ${BLUE}eth0${nf}:`);
  });
});

describe('resolveHostname()', () => {
  const lookupMock = jest.spyOn(dns.promises, 'lookup');

  afterEach(() => {
    lookupMock.mockReset();
  });

  it('resolves to an address on success', async () => {
    lookupMock.mockResolvedValue({ address: '9.8.7.6', family: 4 });
    await expect(resolveHostname('example.com')).resolves.toBe('9.8.7.6');
    expect(lookupMock).toHaveBeenCalledWith('example.com', { family: 4 });
  });

  it('returns null on failure', async () => {
    lookupMock.mockRejectedValue(new Error('dns fail'));
    await expect(resolveHostname('does.not.exist')).resolves.toBeNull();
  });
});
