// src\broadcastChannel.test.ts

const MATTER_PORT = 0;
const NAME = 'BroadcastServer';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import { BroadcastChannel } from 'node:worker_threads';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import { broadcastServerBroadcastSpy, broadcastServerRequestSpy, broadcastServerRespondSpy, flushAsync, setupTest } from './jestutils/jestHelpers.js';

// Setup the test environment
await setupTest(NAME, false);

describe('BroadcastServer', () => {
  const log = new AnsiLogger({ logName: 'BroadcastServer', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  let server: BroadcastServer;

  beforeAll(async () => {});

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('constructor', async () => {
    server = new BroadcastServer('manager', log, NAME);
    expect(server).toBeInstanceOf(BroadcastServer);
    expect((server as any).broadcastChannel).toBeInstanceOf(BroadcastChannel);
  });

  test('getUniqueId', async () => {
    const id1 = server.getUniqueId();
    const id2 = server.getUniqueId();
    expect(id1).toBeGreaterThanOrEqual(100_000_000);
    expect(id1).toBeLessThanOrEqual(999_999_999);
    expect(id2).toBeGreaterThanOrEqual(100_000_000);
    expect(id2).toBeLessThanOrEqual(999_999_999);
    expect(id1).not.toEqual(id2); // Very small chance of collision, but should be fine for tests
  });

  test('type guards: isWorkerRequest and isWorkerResponse', () => {
    // Prepare messages with proper BaseMessage structure
    const requestMsg = { id: 123456, timestamp: 0, type: 'jest', src: 'frontend', dst: 'manager' };
    const responseMsg = { id: 123456, timestamp: 0, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Alice', age: 30 } };
    const responseErrorMsg = { id: 123456, timestamp: 0, type: 'jest', src: 'manager', dst: 'frontend', error: 'Not found' };
    const responseWithBoth = { ...responseMsg, error: 'duplicate' };
    const requestWithResult = { ...requestMsg, result: { duplicate: true } };
    const requestWithError = { ...requestMsg, error: 'should fail' };
    const malformedRequest: unknown = { ...requestMsg, type: 42 };
    const malformedResponse: unknown = { ...responseMsg, type: 42 };

    // Positive cases
    expect(server.isWorkerRequest(requestMsg)).toBe(true);
    expect(server.isWorkerResponse(responseMsg)).toBe(true);
    expect(server.isWorkerResponse(responseErrorMsg)).toBe(true);

    // Negative cases
    expect(server.isWorkerRequest(responseMsg)).toBe(false);
    expect(server.isWorkerResponse(requestMsg)).toBe(false);
    expect(server.isWorkerResponse(responseWithBoth)).toBe(false);
    expect(server.isWorkerRequest(requestWithResult)).toBe(false);
    expect(server.isWorkerRequest(requestWithError)).toBe(false);
    expect(server.isWorkerRequest(malformedRequest)).toBe(false);
    expect(server.isWorkerResponse(malformedResponse)).toBe(false);
    expect(server.isWorkerRequest(null)).toBe(false);
    expect(server.isWorkerResponse(null)).toBe(false);

    // Test missing fields
    const invalidMsg = { id: 123456, type: 'jest' }; // missing src, dst
    expect(server.isWorkerRequest(invalidMsg)).toBe(false);
  });

  test('type guards: isWorkerRequestOfType and isWorkerResponseOfType', () => {
    const requestMsg = { id: 123457, timestamp: 1, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 7 } } as const;
    const simpleRequestMsg = { id: 123458, timestamp: 2, type: 'jest_simple', src: 'frontend', dst: 'manager' } as const;
    const responseMsg = { id: 123457, timestamp: 3, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Alice', age: 31 } } as const;
    const responseErrorMsg = { id: 123457, timestamp: 4, type: 'jest', src: 'manager', dst: 'frontend', error: 'Not found' } as const;

    // Positive request cases
    expect(server.isWorkerRequestOfType(requestMsg, 'jest')).toBe(true);
    expect(server.isWorkerRequestOfType(simpleRequestMsg, 'jest_simple')).toBe(true);

    // Negative request cases
    expect(server.isWorkerRequestOfType(requestMsg, 'jest_simple')).toBe(false);
    expect(server.isWorkerRequestOfType(simpleRequestMsg, 'jest')).toBe(false);
    expect(server.isWorkerRequestOfType(responseMsg, 'jest')).toBe(false);

    // Positive response cases
    expect(server.isWorkerResponseOfType(responseMsg, 'jest')).toBe(true);
    expect(server.isWorkerResponseOfType(responseErrorMsg, 'jest')).toBe(true);

    // Negative response cases
    expect(server.isWorkerResponseOfType(responseMsg, 'jest_simple')).toBe(false);
    expect(server.isWorkerResponseOfType(requestMsg, 'jest')).toBe(false);
    const malformedResponse = { id: 123459, timestamp: 5, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Alice', age: 32 }, error: 'duplicate' };
    expect(server.isWorkerResponseOfType(malformedResponse, 'jest')).toBe(false);
  });

  test('broadcast: should broadcast a valid simple request message', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    server.broadcast({ type: 'jest_simple', src: 'frontend', dst: 'manager' });
    server.broadcast({ type: 'jest_simple', src: 'frontend', dst: 'manager', result: { success: true } });
    server.broadcast({ type: 'jest_simple', src: 'frontend', dst: 'manager', error: 'Any error' });
    expect(postMessageSpy).toHaveBeenCalledTimes(3);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest_simple', src: 'manager', dst: 'manager' });
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest_simple', src: 'manager', dst: 'manager', result: { success: true } });
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest_simple', src: 'manager', dst: 'manager', error: 'Any error' });
    postMessageSpy.mockRestore();
  });

  test('broadcast: should broadcast a valid request message', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    server.broadcast({ type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } });
    server.broadcast({ type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'Bob', age: 42 } });
    server.broadcast({ type: 'jest', src: 'frontend', dst: 'manager', error: 'Not found' });
    expect(postMessageSpy).toHaveBeenCalledTimes(3);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest', src: 'manager', dst: 'manager', params: { userId: 1 } });
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest', src: 'manager', dst: 'manager', result: { name: 'Bob', age: 42 } });
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest', src: 'manager', dst: 'manager', error: 'Not found' });
    postMessageSpy.mockRestore();
  });

  test('request: should broadcast a valid simple request message', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const requestMsg = { type: 'jest_simple', src: 'frontend', dst: 'manager' } as const;
    server.request(requestMsg);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest_simple', src: 'manager', dst: 'manager' });
    postMessageSpy.mockRestore();
  });

  test('request: should broadcast a valid request message', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const requestMsg = { type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    server.request(requestMsg);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest', src: 'manager', dst: 'manager', params: { userId: 1 } });
    postMessageSpy.mockRestore();
  });

  test('request: should broadcast a valid request message adding id and timestamp', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const requestMsg = { type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    server.request(requestMsg);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest', src: 'manager', dst: 'manager', params: { userId: 1 } });
    postMessageSpy.mockRestore();
  });

  test('request: should not broadcast an invalid request message', () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage').mockImplementation(() => {});
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    // @ts-expect-error: purposely wrong message (missing src/dst and has response)
    server.request({ id: 1, type: 'jest', response: { name: 'Eve', age: 99 } });
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Invalid request message format/));
    postMessageSpy.mockRestore();
    logErrorSpy.mockRestore();
  });

  test('respond: should broadcast a valid response message adding elapsed', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const responseMsg = { id: 654321, timestamp: Date.now() - 1000, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Bob', age: 42 } } as const;
    server.respond(responseMsg);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: 654321, timestamp: expect.any(Number), elapsed: expect.any(Number), type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Bob', age: 42 } });
    postMessageSpy.mockRestore();
  });

  test('respond: should broadcast a valid response message adding timestamp but not elapsed', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const responseMsg = { id: 654321, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Bob', age: 42 } } as const;
    server.respond(responseMsg);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: 654321, timestamp: expect.any(Number), elapsed: undefined, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Bob', age: 42 } });
    postMessageSpy.mockRestore();
  });

  test('respond: should broadcast a valid response message reverse of src dst', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const responseMsg = { id: 654321, timestamp: Date.now() - 1000, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 }, result: { name: 'Bob', age: 42 } } as const;
    server.respond(responseMsg);
    expect(postMessageSpy).toHaveBeenCalledWith({ id: 654321, timestamp: expect.any(Number), elapsed: expect.any(Number), type: 'jest', src: 'manager', dst: 'frontend', params: { userId: 1 }, result: { name: 'Bob', age: 42 } });
    postMessageSpy.mockRestore();
  });

  test('respond: should not broadcast an invalid response message', () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage').mockImplementation(() => {});
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    // @ts-expect-error: purposely wrong message (missing src/dst and response)
    server.respond({ id: 2, type: 'jest' });
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Invalid response message format/));
    postMessageSpy.mockRestore();
    logErrorSpy.mockRestore();
  });

  test('broadcastMessageHandler: should receive a broadcast message', async () => {
    const eventHandler = jest.fn();
    server.on('broadcast_message', eventHandler);

    const testServer = new BroadcastServer('manager', log, NAME);
    const testMessage = { id: 123456, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    // @ts-expect-error: access private method for test
    testServer.broadcastChannel.postMessage(testMessage);
    testServer.close();
    await flushAsync();

    expect(eventHandler).toHaveBeenCalledWith(testMessage);
    server.off('broadcast_message', eventHandler);
  });

  test('fetch: should resolve get_log_level', async () => {
    setTimeout(() => {
      // Simulate receiving the response
      (server as any).broadcastChannel.onmessage({ data: { id: 111111, timestamp: Date.now(), type: 'get_log_level', src: 'matter', dst: 'manager', result: { logLevel: LogLevel.DEBUG } } });
    }, 10);
    expect((await server.fetch({ id: 111111, type: 'get_log_level', src: 'manager', dst: 'matter' })).result.logLevel).toBe(LogLevel.DEBUG);
  });

  test('fetch: should resolve set_log_level', async () => {
    setTimeout(() => {
      // Simulate receiving the response
      (server as any).broadcastChannel.onmessage({ data: { id: 111111, timestamp: Date.now(), type: 'set_log_level', src: 'matter', dst: 'manager', result: { logLevel: LogLevel.DEBUG } } });
    }, 10);
    expect((await server.fetch({ id: 111111, type: 'set_log_level', src: 'manager', dst: 'matter', params: { logLevel: LogLevel.DEBUG } })).result.logLevel).toBe(LogLevel.DEBUG);
  });

  test('fetch: should resolve with correct response', async () => {
    const requestMsg = { id: 111111, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    const responseMsg = { id: 111111, timestamp: Date.now(), type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'Test', age: 99 } } as const;
    setTimeout(() => {
      // Simulate receiving the response
      (server as any).broadcastChannel.onmessage({ data: responseMsg });
    }, 10);
    const result = await server.fetch(requestMsg);
    expect(result).toEqual({ id: 111111, timestamp: expect.any(Number), type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'Test', age: 99 } });
  });

  test('fetch: should resolve with correct response without id', async () => {
    const requestMsg = { type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    const responseMsg = { type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'Test', age: 99 } } as const;
    setTimeout(() => {
      // Simulate receiving the response
      (server as any).broadcastChannel.onmessage({ data: { ...responseMsg, id: (requestMsg as any).id, timestamp: Date.now() } });
    }, 10);
    const result = await server.fetch(requestMsg);
    expect(result).toEqual({ id: expect.any(Number), timestamp: expect.any(Number), type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'Test', age: 99 } });
  });

  test('fetch: should resolve with correct response from another thread', async () => {
    const handler = (msg: any) => {
      if (msg.type === 'jest' && !('response' in msg)) {
        server.respond({ ...msg, src: 'manager', dst: msg.src, result: { name: 'Alice', age: 33 } });
      }
    };
    server.on('broadcast_message', handler);

    // Use a separate BroadcastServer instance to simulate another worker
    const testServer = new BroadcastServer('frontend', log, NAME);
    const result = await testServer.fetch({ id: 123456, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } });
    testServer.close();
    expect(result).toEqual({ id: 123456, timestamp: expect.any(Number), elapsed: expect.any(Number), params: { userId: 1 }, type: 'jest', src: 'manager', dst: 'frontend', result: { name: 'Alice', age: 33 } });

    server.off('broadcast_message', handler);
  });

  test('fetch: should reject on error response', async () => {
    const requestMsg = { id: 666666, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 4 } } as const;
    setTimeout(() => {
      (server as any).broadcastChannel.onmessage({ data: { id: 666666, timestamp: Date.now(), type: 'jest', src: 'frontend', dst: 'manager', error: 'Nope' } });
    }, 10);
    await expect(server.fetch(requestMsg)).rejects.toThrow(/Fetch received error response Nope/);
  });

  test('fetch: should reject malformed response', async () => {
    const requestMsg = { id: 777777, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 5 } } as const;
    const originalGuard = server.isWorkerResponseOfType.bind(server);
    const guardSpy = jest.spyOn(server, 'isWorkerResponseOfType').mockImplementation((value, type) => {
      if ((value as any).id === 777777) {
        return true;
      }
      return originalGuard(value, type);
    });
    setTimeout(() => {
      (server as any).broadcastChannel.onmessage({ data: { id: 777777, timestamp: Date.now(), type: 'jest', src: 'frontend', dst: 'manager' } });
    }, 10);
    try {
      await expect(server.fetch(requestMsg)).rejects.toThrow(/Fetch received malformed response/);
    } finally {
      guardSpy.mockRestore();
    }
  });

  test('fetch: should reject on timeout', async () => {
    const requestMsg = { id: 222222, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    await expect(server.fetch(requestMsg)).rejects.toThrow(/Fetch timeout/);
  });

  test('fetch: should reject on timeout from another thread', async () => {
    // Use a separate BroadcastServer instance to simulate another worker
    const testServer = new BroadcastServer('manager', log, NAME);
    await expect(testServer.fetch({ id: 123456, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } }, 10)).rejects.toThrow(/Fetch timeout/);
    testServer.close();
  });

  test('fetch: should ignore wrong response type', async () => {
    const requestMsg = { id: 333333, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    const wrongResponse = { id: 333333, type: 'plugins_length', src: 'manager', dst: 'frontend', response: { length: 5 } };
    setTimeout(() => {
      (server as any).broadcastChannel.onmessage({ data: wrongResponse });
    }, 10);
    await expect(server.fetch(requestMsg, 20)).rejects.toThrow(/Fetch timeout/);
  });

  test('fetch: should handle multiple fetches independently', async () => {
    const req1 = { id: 444444, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 1 } } as const;
    const req2 = { id: 555555, type: 'jest', src: 'frontend', dst: 'manager', params: { userId: 2 } } as const;
    const res1 = { id: 444444, timestamp: Date.now(), type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'A', age: 1 } } as const;
    const res2 = { id: 555555, timestamp: Date.now(), type: 'jest', src: 'frontend', dst: 'manager', result: { name: 'B', age: 2 } } as const;
    setTimeout(() => {
      (server as any).broadcastChannel.onmessage({ data: res2 });
      (server as any).broadcastChannel.onmessage({ data: res1 });
    }, 10);
    const [result1, result2] = await Promise.all([server.fetch(req1), server.fetch(req2)]);
    expect(result1).toEqual(res1);
    expect(result2).toEqual(res2);
  });

  test('close', async () => {
    server.close();
    expect((server as any).broadcastChannel.onmessage).toBeNull();
  });

  test('broadcast: should log error if the port is closed', async () => {
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    const requestMsg = { id: 654321, timestamp: Date.now(), type: 'jest', src: 'manager', dst: 'manager', params: { userId: 1 } } as const;
    server.broadcast(requestMsg);
    await flushAsync(undefined, undefined, 50);
    expect(broadcastServerBroadcastSpy).toHaveBeenCalledWith(requestMsg);
    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to broadcast message/));
    logErrorSpy.mockRestore();
  });

  test('request: should log error if the port is closed', async () => {
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    const requestMsg = { id: 654321, timestamp: Date.now(), type: 'jest', src: 'manager', dst: 'manager', params: { userId: 1 } } as const;
    server.request(requestMsg);
    await flushAsync(undefined, undefined, 50);
    expect(broadcastServerRequestSpy).toHaveBeenCalledWith(requestMsg);
    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to broadcast request message/));
    logErrorSpy.mockRestore();
  });

  test('respond: should log error if the port is closed', async () => {
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    const responseMsg = { id: 654321, timestamp: Date.now(), type: 'jest', src: 'manager', dst: 'manager', result: { name: 'Bob', age: 42 } } as const;
    server.respond(responseMsg);
    await flushAsync(undefined, undefined, 50);
    expect(broadcastServerRespondSpy).toHaveBeenCalledWith(responseMsg);
    expect(logErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Failed to broadcast response message/));
    logErrorSpy.mockRestore();
  });
});
