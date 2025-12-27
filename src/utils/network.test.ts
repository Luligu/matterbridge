// src\utils\network.test.ts
/* eslint-disable @typescript-eslint/ban-ts-comment */

// ESM mock for https get
let mockedGet: jest.MockedFunction<typeof get>;
const mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });
const mockedGetStatusCode = 200;
jest.unstable_mockModule('node:https', () => {
  mockedGet = jest.fn((url: string | URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => {
    const mockRes = new PassThrough();
    const mockReq = {
      on: jest.fn(),
      destroy: jest.fn(),
      end: jest.fn(),
    };
    // @ts-ignore
    mockRes.statusCode = mockedGetStatusCode;
    // @ts-ignore
    mockRes.resume = jest.fn();

    // Call the callback immediately with the mocked response
    callback(mockRes as unknown as IncomingMessage);

    // Emit data and end events synchronously based on status code
    if (mockedGetStatusCode === 200) {
      mockRes.emit('data', Buffer.from(mockedGetPayload));
      mockRes.emit('end');
    }
    // For non-200 status codes, the response handling is done in the callback no need to emit data/end events

    // Return a mock ClientRequest to match the expected return type
    return mockReq as unknown as ClientRequest;
  }) as unknown as jest.MockedFunction<typeof get>;

  return { get: mockedGet };
});

// ESM mock for child_process exec
let mockedExec: jest.MockedFunction<typeof exec>;
jest.unstable_mockModule('node:child_process', () => {
  mockedExec = jest.fn((command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void) => {
    if (command === 'npm root -g' && callback) {
      callback(null, '/usr/lib/node_modules\n', '');
    }
    // Return a mock ChildProcess to match the expected return type
    return {} as ChildProcess;
  }) as unknown as jest.MockedFunction<typeof exec>;

  return { exec: mockedExec };
});

import os from 'node:os';
import dns from 'node:dns';
import { get, RequestOptions } from 'node:https';
import { exec, ChildProcess, ExecException } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { ClientRequest, IncomingMessage } from 'node:http';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, BLUE, nf } from 'node-ansi-logger';

import { getIpv4InterfaceAddress, getIpv6InterfaceAddress, getMacAddress, logInterfaces, resolveHostname, getGlobalNodeModules, getInterfaceName, getInterfaceDetails } from './network.js';

jest.useFakeTimers();

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

describe('getGlobalNodeModules()', () => {
  it('resolves with trimmed global modules path', async () => {
    await expect(getGlobalNodeModules()).resolves.toBe('/usr/lib/node_modules');
  });

  it('rejects on exec error', async () => {
    // Change the implementation for the next call only
    (mockedExec as any).mockImplementationOnce((command: string, callback?: (error: ExecException | null, stdout: string, stderr: string) => void) => {
      if (command === 'npm root -g' && callback) {
        callback(new Error('fail'), '', '');
      }
      // Return a mock ChildProcess to match the expected return type
      return {} as ChildProcess;
    });
    await expect(getGlobalNodeModules()).rejects.toThrow('fail');
  });
});
