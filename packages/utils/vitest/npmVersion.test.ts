// vitest\npmVersion.test.ts

import type { ClientRequest, IncomingMessage } from 'node:http';
import type { RequestOptions } from 'node:https';
import { PassThrough } from 'node:stream';

import type { Mock } from 'vitest';

type GetFn = (url: string | URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest;

// ESM mock for https get
let mockedGet: Mock<GetFn>;
let mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });
let mockedGetStatusCode = 200;
vi.doMock('node:https', () => {
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

  return { get: mockedGet };
});

import { setupTest } from './vitestSetupTest.js';

const { getNpmPackageVersion } = await import('../src/npmVersion.js');

await setupTest('NpmVersion');

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
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with version when tag exists (beta)', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'beta', 5000);

    expect(result).toBe('2.2.0-beta.1');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with version when tag exists (alpha)', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'alpha', 5000);

    expect(result).toBe('2.3.0-alpha.2');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default tag (latest) when not specified', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package');

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default timeout when not specified', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('test-package', 'latest');

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject when tag does not exist', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    await expect(getNpmPackageVersion('test-package', 'nonexistent', 5000)).rejects.toThrow('Tag "nonexistent" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on non-200 status code (404)', async () => {
    mockedGetStatusCode = 404;

    await expect(getNpmPackageVersion('nonexistent-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 404');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/nonexistent-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on 500 server error', async () => {
    mockedGetStatusCode = 500;

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 500');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on invalid JSON response', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = 'not-valid-json{';

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on empty response', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = '';

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on malformed JSON with trailing comma', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = '{"dist-tags": {"latest": "1.0.0",}}';

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle response with missing dist-tags', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ versions: { '1.0.0': {} } });

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Tag "latest" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle response with empty dist-tags', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify({ 'dist-tags': {} });

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Tag "latest" not found for package "test-package"');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/test-package', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle scoped package names', async () => {
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockNpmResponse);

    const result = await getNpmPackageVersion('@scope/package-name', 'latest', 5000);

    expect(result).toBe('2.1.0');
    expect(mockedGet).toHaveBeenCalledWith('https://registry.npmjs.org/@scope/package-name', expect.not.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on timeout', async () => {
    const destroy = vi.fn<(error?: Error) => void>();
    mockedGet.mockImplementationOnce((_url, _options) => {
      const mockReq = {
        on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>(),
        destroy,
        end: vi.fn<() => void>(),
      };
      return mockReq as unknown as ClientRequest;
    });

    const promise = getNpmPackageVersion('test-package', 'latest', 100);

    await expect(promise).rejects.toThrow('Request timed out after 0.1 seconds');
    expect(destroy).toHaveBeenCalledWith(expect.any(Error));
  }, 10000);

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

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Request failed: Network connection failed');
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

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).resolves.toBe('2.1.0');
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

    await expect(getNpmPackageVersion('test-package', 'latest', 5000)).rejects.toThrow('Failed to fetch data. Status code: 500');

    errorHandler?.(new Error('late network error'));
  });
});
