/**
 * @file packages/utils/buntest/npmVersion.test.ts
 * @description This file contains the tests for npmVersion.
 * @author Luca Liguori
 */

import { afterAll, beforeEach, describe, expect, it, type Mock, spyOn, vi } from 'bun:test';
import type { ClientRequest, IncomingMessage } from 'node:http';
// Namespace import: spyOn() on it also intercepts the source's `await import(...)` of the same module.
// oxlint-disable-next-line import/no-namespace
import * as https from 'node:https';
import type { RequestOptions } from 'node:https';
import { PassThrough } from 'node:stream';

type GetFn = (url: string | URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;

// ESM mock for https get
let mockedGet: Mock<GetFn>;
let mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });
let mockedGetStatusCode = 200;
mockedGet = vi.fn<GetFn>((_url, _options, callback) => {
  const mockRes = new PassThrough();
  const mockReq = {
    on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>(),
    destroy: vi.fn<(error?: Error) => void>(),
    end: vi.fn<() => void>(),
  };
  // @ts-expect-error statusCode is not on PassThrough
  mockRes.statusCode = mockedGetStatusCode;
  mockRes.resume = vi.fn<() => PassThrough>();

  callback(mockRes as unknown as IncomingMessage);

  if (mockedGetStatusCode === 200) {
    mockRes.emit('data', Buffer.from(mockedGetPayload));
    mockRes.emit('end');
  }

  return mockReq as unknown as ClientRequest;
});

// Bun has no vi.doMock(): route node:https get() through the fake instead.
spyOn(https, 'get').mockImplementation(mockedGet as unknown as typeof https.get);

import { resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';

const { getNpmPackageVersion } = await import('../src/npmVersion.js');

// Mocks AnsiLogger.prototype.log and the console methods, and sets process.argv to ['bun', NAME].
await setupTest('NpmVersionTest');

describe('getNpmPackageVersion', () => {
  const mockNpmResponse = {
    'dist-tags': {
      latest: '2.1.0',
      beta: '2.2.0-beta.1',
      alpha: '2.3.0-alpha.2',
      next: '3.0.0-rc.1',
    },
    'versions': {
      '2.1.0': {},
      '2.2.0-beta.1': {},
      '2.3.0-alpha.2': {},
      '3.0.0-rc.1': {},
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve with version when tag exists (latest)', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'latest', 5000);

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with version when tag exists (beta)', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'beta', 5000);

    expect(result).toBe('2.2.0-beta.1');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with version when tag exists (alpha)', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'alpha', 5000);

    expect(result).toBe('2.3.0-alpha.2');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default tag (latest) when not specified', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package');

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default timeout when not specified', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'latest');

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject when tag does not exist', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    expect(getNpmPackageVersion('test-package', 'nonexistent', 5000)).rejects.toThrow('Tag "nonexistent" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on non-200 status code (404)', async () => {
    mockedGetStatusCode = 404;

    expect(getNpmPackageVersion('nonexistent-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 404');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/nonexistent-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on 500 server error', async () => {
    mockedGetStatusCode = 500;

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 500');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on invalid JSON response', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = 'not-valid-json{';

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on empty response', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = '';

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on malformed JSON with trailing comma', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = '{"dist-tags": {"latest": "1.0.0",}}';

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle response with missing dist-tags', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ versions: { '1.0.0': {} } });

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Tag "latest" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle response with empty dist-tags', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ 'dist-tags': {} });

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Tag "latest" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle scoped package names', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('@scope/package-name', 'latest', 5000);

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/@scope/package-name', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on timeout', async () => {
    let requestOptions: RequestOptions | undefined;
    mockedGet.mockImplementationOnce((_url, options) => {
      requestOptions = options;
      const mockReq = {
        on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>(),
        destroy: vi.fn<(error?: Error) => void>(),
        end: vi.fn<() => void>(),
      };
      return mockReq as unknown as ClientRequest;
    });

    vi.useFakeTimers();
    try {
      const promise = getNpmPackageVersion('test-package', 'latest', 100);
      // The timeout is scheduled just before https.get(), so wait until the mocked get() has run
      for (let i = 0; i < 100 && mockedGet.mock.calls.length === 0; i++) await Promise.resolve();
      expect(requestOptions).toBeDefined();
      vi.advanceTimersByTime(100);

      // Await the rejection instead of using the blocking .rejects matcher, so a missed timeout fails
      // on the test timeout instead of hanging the run
      const error = await promise.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Request timed out after 0.1 seconds');
      expect(requestOptions?.signal).toBeInstanceOf(AbortSignal);
      expect(requestOptions?.signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('should reject on request error', async () => {
    mockedGet.mockImplementationOnce((_url, _options) => {
      const mockReq = {
        on: vi.fn<(event: string, handler: (error: Error) => void) => void>((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('Network connection failed')), 0);
          }
        }),
        destroy: vi.fn<(error?: Error) => void>(),
        end: vi.fn<() => void>(),
      };
      return mockReq as unknown as ClientRequest;
    });

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Request failed: Network connection failed');
  });

  it('should ignore duplicate response end events after resolve', async () => {
    mockedGet.mockImplementationOnce((_url, _options, callback) => {
      const mockRes = new PassThrough();
      const mockReq = {
        on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>(),
        destroy: vi.fn<(error?: Error) => void>(),
        end: vi.fn<() => void>(),
      };
      // @ts-expect-error statusCode is not on PassThrough
      mockRes.statusCode = 200;
      mockRes.resume = vi.fn<() => PassThrough>();

      callback(mockRes as unknown as IncomingMessage);
      mockRes.emit('data', Buffer.from(JSON.stringify(mockNpmResponse)));
      mockRes.emit('end');
      mockRes.emit('end');

      return mockReq as unknown as ClientRequest;
    });

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).resolves.toBe('2.1.0');
  });

  it('should ignore request errors after rejection', async () => {
    let errorHandler: ((error: Error) => void) | undefined;

    mockedGet.mockImplementationOnce((_url, _options, callback) => {
      const mockRes = new PassThrough();
      const mockReq = {
        on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>((event, listener) => {
          if (event === 'error') errorHandler = listener as (error: Error) => void;
        }),
        destroy: vi.fn<(error?: Error) => void>(),
        end: vi.fn<() => void>(),
      };
      // @ts-expect-error statusCode is not on PassThrough
      mockRes.statusCode = 500;
      mockRes.resume = vi.fn<() => PassThrough>();

      callback(mockRes as unknown as IncomingMessage);

      return mockReq as unknown as ClientRequest;
    });

    expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 500');

    errorHandler?.(new Error('late network error'));
  });
});

afterAll(() => {
  resetTest();
});
