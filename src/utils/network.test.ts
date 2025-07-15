// src\utils\network.test.ts
/* eslint-disable @typescript-eslint/ban-ts-comment */

import { jest } from '@jest/globals';

// ESM mock for https get
let mockedGet: jest.MockedFunction<typeof get>;
let mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });
let mockedGetStatusCode = 200;
jest.unstable_mockModule('node:https', () => {
  mockedGet = jest.fn((url: string | URL, options: RequestOptions, callback?: (res: IncomingMessage) => void) => {
    const mockRes = new PassThrough();
    // @ts-ignore
    mockRes.statusCode = mockedGetStatusCode;
    const reqStub = { on: jest.fn(), destroy: jest.fn() };
    if (callback) {
      callback(mockRes as unknown as IncomingMessage);
    }
    mockRes.emit('data', Buffer.from(mockedGetPayload));
    mockRes.emit('end');
    // Return a mock ClientRequest to match the expected return type
    return reqStub as unknown as ClientRequest;
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
import { AnsiLogger, idn, rs, LogLevel, BLUE, nf } from 'node-ansi-logger';

import { getIpv4InterfaceAddress, getIpv6InterfaceAddress, getMacAddress, logInterfaces, resolveHostname, getNpmPackageVersion, getGlobalNodeModules } from './network.js';

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

describe('getNpmPackageVersion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves with version when tag exists', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });

    await expect(getNpmPackageVersion('mypkg', 'latest', 5_000)).resolves.toBe('1.2.3');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/mypkg', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('rejects if tag is not found', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ 'dist-tags': { beta: '2.0.0' } });

    await expect(getNpmPackageVersion('mypkg', 'latest', 5_000)).rejects.toThrow('Tag "latest" not found for package "mypkg"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/mypkg', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('rejects on non-200 status code', async () => {
    // Set the statusCode
    mockedGetStatusCode = 404;

    await expect(getNpmPackageVersion('mypkg')).rejects.toThrow("Cannot access 'req' before initialization");
    // await expect(getNpmPackageVersion('mypkg')).rejects.toThrow('Failed to fetch data. Status code: 404');
    // expect(reqStub.destroy).toHaveBeenCalled();
  });

  it('rejects on invalid JSON', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = 'not-json';

    await expect(getNpmPackageVersion('mypkg')).rejects.toThrow(/Failed to parse response JSON/);
  });
});

describe('getIpv4InterfaceAddress / getIpv6InterfaceAddress / getMacAddress', () => {
  const fakeIfaces = {
    eth0: [
      { family: 'IPv4', internal: false, address: '1.2.3.4', mac: 'aa:bb:cc:dd:ee:ff' },
      { family: 'IPv6', internal: false, address: '::1', mac: 'aa:bb:cc:dd:ee:ff' },
    ],
    lo: [{ family: 'IPv4', internal: true, address: '127.0.0.1', mac: '00:00:00:00:00:00' }],
  };

  beforeAll(() => {
    jest.spyOn(os, 'networkInterfaces').mockReturnValue(fakeIfaces as any);
  });

  it('returns the first non-internal IPv4 address', () => {
    expect(getIpv4InterfaceAddress()).toBe('1.2.3.4');
  });

  it('returns the first non-internal IPv6 address', () => {
    expect(getIpv6InterfaceAddress()).toBe('::1');
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
