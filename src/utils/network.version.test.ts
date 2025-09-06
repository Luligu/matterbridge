// src\utils\network.version.test.ts
/* eslint-disable @typescript-eslint/ban-ts-comment */

// ESM mock for https get
let mockedGet: jest.MockedFunction<typeof get>;
let mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });
let mockedGetStatusCode = 200;
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
    // For non-200 status codes, the response handling is done in the callback
    // no need to emit data/end events

    // Return a mock ClientRequest to match the expected return type
    return mockReq as unknown as ClientRequest;
  }) as unknown as jest.MockedFunction<typeof get>;

  return { get: mockedGet };
});

import { get, RequestOptions } from 'node:https';
import { PassThrough } from 'node:stream';
import { ClientRequest, IncomingMessage } from 'node:http';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { jest } from '@jest/globals';

import { getNpmPackageVersion } from './network.js';

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
  const mockNpmResponse = {
    'dist-tags': {
      latest: '2.1.0',
      beta: '2.2.0-beta.1',
      alpha: '2.3.0-alpha.2',
      next: '3.0.0-rc.1',
    },
    versions: {
      '2.1.0': {},
      '2.2.0-beta.1': {},
      '2.3.0-alpha.2': {},
      '3.0.0-rc.1': {},
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should resolve with version when tag exists (latest)', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'latest', 5000);

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with version when tag exists (beta)', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'beta', 5000);

    expect(result).toBe('2.2.0-beta.1');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with version when tag exists (alpha)', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'alpha', 5000);

    expect(result).toBe('2.3.0-alpha.2');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default tag (latest) when not specified', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package');

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default timeout when not specified', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'latest');

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject when tag does not exist', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    await expect(getNpmPackageVersion('test-package', 'nonexistent', 5000)).rejects.toThrow('Tag "nonexistent" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on non-200 status code (404)', async () => {
    // Set the statusCode
    mockedGetStatusCode = 404;

    await expect(getNpmPackageVersion('nonexistent-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 404');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/nonexistent-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on 500 server error', async () => {
    // Set the statusCode
    mockedGetStatusCode = 500;

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 500');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on invalid JSON response', async () => {
    // Set the statusCode and invalid payload
    mockedGetStatusCode = 200;
    mockedGetPayload = 'not-valid-json{';

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on empty response', async () => {
    // Set the statusCode and empty payload
    mockedGetStatusCode = 200;
    mockedGetPayload = '';

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on malformed JSON with trailing comma', async () => {
    // Set the statusCode and malformed payload
    mockedGetStatusCode = 200;
    mockedGetPayload = '{"dist-tags": {"latest": "1.0.0",}}';

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle response with missing dist-tags', async () => {
    // Set the statusCode and payload without dist-tags
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ versions: { '1.0.0': {} } });

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Tag "latest" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle response with empty dist-tags', async () => {
    // Set the statusCode and payload with empty dist-tags
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ 'dist-tags': {} });

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Tag "latest" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle scoped package names', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('@scope/package-name', 'latest', 5000);

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/@scope/package-name', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on timeout', async () => {
    // Override the mock to simulate a request that never responds
    // @ts-ignore
    mockedGet.mockImplementationOnce((url: string | URL, options: RequestOptions, callback?: (res: IncomingMessage) => void) => {
      const mockReq = {
        on: jest.fn(),
        destroy: jest.fn(),
        end: jest.fn(),
      };

      // Don't call the callback - simulate hanging request
      // The real setTimeout will trigger the timeout

      return mockReq as unknown as ClientRequest;
    });

    // Start the request with a very short timeout (100ms)
    const promise = getNpmPackageVersion('test-package', 'latest', 100);

    // The timeout should trigger after 100ms
    await expect(promise).rejects.toThrow('Request timed out after 0.1 seconds');
  }, 10000);

  it('should reject on request error', async () => {
    // Override the mock to simulate a request error
    // @ts-ignore
    mockedGet.mockImplementationOnce((url: string | URL, options: RequestOptions, callback?: (res: IncomingMessage) => void) => {
      const mockReq = {
        on: jest.fn((event: string, handler: (error: Error) => void) => {
          if (event === 'error') {
            // Simulate an error event
            setTimeout(() => handler(new Error('Network connection failed')), 0);
          }
        }),
        destroy: jest.fn(),
        end: jest.fn(),
      };

      return mockReq as unknown as ClientRequest;
    });

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Request failed: Network connection failed');
  });
});
