// vitest\githubVersion.test.ts

import type { ClientRequest, IncomingMessage } from 'node:http';
import type { get, RequestOptions } from 'node:https';
import { PassThrough } from 'node:stream';

import type { Mock } from 'vitest';

// ESM mock for https get
let mockedGet: Mock<typeof get>;
let mockedGetPayload = JSON.stringify({ 'dist-tags': { latest: '1.2.3' } });
let mockedGetStatusCode = 200;
vi.doMock('node:https', () => {
  mockedGet = vi.fn<(url: string | URL, options: RequestOptions, callback: (res: IncomingMessage) => void) => ClientRequest>((_url, _options, callback) => {
    const mockRes = new PassThrough();
    const mockReq = {
      on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>(),
      destroy: vi.fn<(error?: Error) => void>(),
      end: vi.fn<() => void>(),
    };
    // @ts-expect-error statusCode is not on PassThrough
    mockRes.statusCode = mockedGetStatusCode;
    mockRes.resume = vi.fn<() => PassThrough>();

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
  }) as unknown as Mock<typeof get>;

  return { get: mockedGet };
});

import { setupTest } from './vitestSetupTest.js';

const { getGitHubUpdate } = await import('../src/githubVersion.js');

await setupTest('GitHubVersion');

describe('getGitHubUpdate', () => {
  const mockUpdateJson = {
    latest: '3.1.9',
    latestDate: '2025-07-30',
    dev: '3.1.9-dev',
    devDate: '2025-07-30',
    latestMessage: 'Bumped matter.js to 0.15.2',
    latestMessageSeverity: 'info',
    devMessage: 'Bumped matter.js to 0.15.2',
    devMessageSeverity: 'info',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve with update data when request is successful', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockUpdateJson);

    const result = await getGitHubUpdate('dev', 'update.json', 5_000);

    expect(result).toEqual(mockUpdateJson);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with update data from main branch', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockUpdateJson);

    const result = await getGitHubUpdate('main', 'update.json', 10_000);

    expect(result).toEqual(mockUpdateJson);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/main_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should resolve with custom file data', async () => {
    const customData = { version: '1.0.0', build: 123 };
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(customData);

    const result = await getGitHubUpdate('dev', 'custom.json', 5_000);

    expect(result).toEqual(customData);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_custom.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should use default timeout when not specified', async () => {
    // Set the statusCode and payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(mockUpdateJson);

    const result = await getGitHubUpdate('dev', 'update.json');

    expect(result).toEqual(mockUpdateJson);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on non-200 status code', async () => {
    // Set the statusCode
    mockedGetStatusCode = 404;

    await expect(getGitHubUpdate('dev', 'update.json', 5_000)).rejects.toThrow('Failed to fetch data. Status code: 404');
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on 500 server error', async () => {
    // Set the statusCode
    mockedGetStatusCode = 500;

    await expect(getGitHubUpdate('main', 'update.json', 5_000)).rejects.toThrow('Failed to fetch data. Status code: 500');
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/main_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on invalid JSON response', async () => {
    // Set the statusCode and invalid payload
    mockedGetStatusCode = 200;
    mockedGetPayload = 'not-valid-json{';

    await expect(getGitHubUpdate('dev', 'update.json', 5_000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on empty response', async () => {
    // Set the statusCode and empty payload
    mockedGetStatusCode = 200;
    mockedGetPayload = '';

    await expect(getGitHubUpdate('dev', 'update.json', 5_000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on malformed JSON with trailing comma', async () => {
    // Set the statusCode and malformed payload
    mockedGetStatusCode = 200;
    mockedGetPayload = '{"version": "1.0.0",}';

    await expect(getGitHubUpdate('dev', 'update.json', 5_000)).rejects.toThrow(/Failed to parse response JSON/);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/dev_update.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should handle complex nested JSON structure', async () => {
    const complexData = {
      latest: '3.2.0',
      metadata: {
        buildNumber: 456,
        features: ['feature1', 'feature2'],
        dependencies: {
          'matter.js': '0.15.3',
          'node-ansi-logger': '2.1.0',
        },
      },
      isStable: true,
    };

    // Set the statusCode and complex payload
    mockedGetStatusCode = 200;
    mockedGetPayload = JSON.stringify(complexData);

    const result = await getGitHubUpdate('main', 'metadata.json', 8_000);

    expect(result).toEqual(complexData);
    expect(mockedGet).toHaveBeenCalledWith('https://matterbridge.io/main_metadata.json', expect.objectContaining({ signal: expect.any(Object) }), expect.any(Function));
  });

  it('should reject on timeout', async () => {
    let requestOptions: RequestOptions | undefined;
    // Override the mock to simulate a request that never responds
    mockedGet.mockImplementationOnce((url: string | URL, options: RequestOptions, callback?: (res: IncomingMessage) => void) => {
      requestOptions = options;
      const mockReq = {
        on: vi.fn<(event: string | symbol, listener: (...args: any[]) => void) => void>(),
        destroy: vi.fn<(error?: Error) => void>(),
        end: vi.fn<() => void>(),
      };
      // Don't call the callback - simulate hanging request
      // The abort timeout will trigger the timeout
      return mockReq as unknown as ClientRequest;
    });

    // Start the request with a very short timeout (100ms)
    const promise = getGitHubUpdate('dev', 'update.json', 100);

    // The timeout should trigger after 100ms
    await expect(promise).rejects.toThrow('Request timed out after 0.1 seconds');
    expect(requestOptions?.signal).toBeInstanceOf(AbortSignal);
    expect(requestOptions?.signal?.aborted).toBe(true);
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

      callback?.(mockRes as unknown as IncomingMessage);
      mockRes.emit('data', Buffer.from(JSON.stringify(mockUpdateJson)));
      mockRes.emit('end');
      mockRes.emit('end');

      return mockReq as unknown as ClientRequest;
    });

    await expect(getGitHubUpdate('dev', 'update.json', 5_000)).resolves.toEqual(mockUpdateJson);
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

      callback?.(mockRes as unknown as IncomingMessage);

      return mockReq as unknown as ClientRequest;
    });

    await expect(getGitHubUpdate('dev', 'update.json', 5_000)).rejects.toThrow('Failed to fetch data. Status code: 500');

    errorHandler?.(new Error('late network error'));
  });
});
