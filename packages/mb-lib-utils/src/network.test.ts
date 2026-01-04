// src\utils\network.test.ts

import os from 'node:os';
import dns from 'node:dns';

import { jest } from '@jest/globals';
import { LogLevel, BLUE, nf } from 'node-ansi-logger';
import { loggerLogSpy, setupTest } from 'mb-lib-test';

import { getIpv4InterfaceAddress, getIpv6InterfaceAddress, getMacAddress, logInterfaces, resolveHostname, getInterfaceName, getInterfaceDetails } from './network.js';

jest.useFakeTimers();

await setupTest('Network');

describe('getInterfaceDetails() / getInterfaceName() / getIpv4InterfaceAddress / getIpv6InterfaceAddress / getMacAddress', () => {
  const fakeIfaces = {
    missed: undefined,
    empty: [],
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
    wlan0: null,
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

// eslint-disable-next-line jest/no-commented-out-tests
/*
describe('getNpmPackageVersion()', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('returns the latest version on 200 + valid JSON', async () => {
    const { getNpmPackageVersion } = await import('./network.js');
    await expect(getNpmPackageVersion('some-package')).resolves.toBe('1.2.3');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/some-package', expect.any(Object), expect.any(Function));
  });

  it('rejects when statusCode is not 200', async () => {
    const { getNpmPackageVersion } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 500;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    await expect(getNpmPackageVersion('some-package')).rejects.toThrow('Status code: 500');
  });

  it('rejects when tag is missing in dist-tags', async () => {
    const { getNpmPackageVersion } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 200;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      mockRes.emit('data', Buffer.from(JSON.stringify({ 'dist-tags': { other: '9.9.9' } })));
      mockRes.emit('end');
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    await expect(getNpmPackageVersion('some-package', 'latest')).rejects.toThrow('Tag "latest" not found');
  });

  it('rejects when JSON parsing fails', async () => {
    const { getNpmPackageVersion } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 200;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      mockRes.emit('data', Buffer.from('not-json'));
      mockRes.emit('end');
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    await expect(getNpmPackageVersion('some-package')).rejects.toThrow('Failed to parse response JSON');
  });

  it('rejects on request error event', async () => {
    const { getNpmPackageVersion } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, _optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), _callback?: (res: IncomingMessage) => void) => {
      const req = {
        on: jest.fn((event: string, handler: (arg: unknown) => void) => {
          if (event === 'error') {
            // Reject immediately; the suite uses fake timers.
            handler(new Error('req-fail'));
          }
          return req;
        }),
        destroy: jest.fn(),
        end: jest.fn(),
      };
      return req as unknown as ClientRequest;
    });

    await expect(getNpmPackageVersion('some-package')).rejects.toThrow('Request failed: req-fail');
  });

  it('rejects on timeout', async () => {
    const { getNpmPackageVersion } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 200;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      // Do not emit 'end' so the promise remains pending until timeout.
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    const p = getNpmPackageVersion('some-package', 'latest', 1);
    void p.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(2);
    await expect(p).rejects.toThrow('Request timed out after');
  });
});

describe('getGitHubUpdate()', () => {
  afterEach(() => {
    mockedGet.mockReset();
  });

  it('returns parsed JSON on 200', async () => {
    const { getGitHubUpdate } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 200;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      mockRes.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            latest: '1.0.0',
            latestDate: '2025-01-01',
            dev: '1.0.0-dev',
            devDate: '2025-01-02',
            latestMessage: 'ok',
            latestMessageSeverity: 'info',
            devMessage: 'ok',
            devMessageSeverity: 'info',
          }),
        ),
      );
      mockRes.emit('end');
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    await expect(getGitHubUpdate('main', 'update.json')).resolves.toMatchObject({ latest: '1.0.0', dev: '1.0.0-dev' });
  });

  it('rejects when statusCode is not 200', async () => {
    const { getGitHubUpdate } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 404;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    await expect(getGitHubUpdate('main', 'update.json')).rejects.toThrow('Status code: 404');
  });

  it('rejects when JSON parsing fails', async () => {
    const { getGitHubUpdate } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 200;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      mockRes.emit('data', Buffer.from('not-json'));
      mockRes.emit('end');
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    await expect(getGitHubUpdate('main', 'update.json')).rejects.toThrow('Failed to parse response JSON');
  });

  it('rejects on timeout', async () => {
    const { getGitHubUpdate } = await import('./network.js');

    mockedGet.mockImplementationOnce((_urlOrOptions: string | URL | RequestOptions, optionsOrCallback?: RequestOptions | ((res: IncomingMessage) => void), callback?: (res: IncomingMessage) => void) => {
      const cb = typeof optionsOrCallback === 'function' ? optionsOrCallback : callback;
      const mockRes = new PassThrough();
      // @ts-ignore
      mockRes.statusCode = 200;
      // @ts-ignore
      mockRes.resume = jest.fn();
      cb?.(mockRes as unknown as IncomingMessage);
      // Do not emit 'end' so the promise remains pending until timeout.
      return { on: jest.fn(), destroy: jest.fn(), end: jest.fn() } as unknown as ClientRequest;
    });

    const p = getGitHubUpdate('main', 'update.json', 1);
    void p.catch(() => undefined);
    await jest.advanceTimersByTimeAsync(2);
    await expect(p).rejects.toThrow('Request timed out after');
  });
});
*/
