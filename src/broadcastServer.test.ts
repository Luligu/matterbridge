// src\broadcastChannel.test.ts

const MATTER_PORT = 0;
const NAME = 'BroadcastServer';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import { BroadcastChannel } from 'node:worker_threads';

import { jest } from '@jest/globals';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import { flushAsync, setupTest } from './utils/jestHelpers.js';

// Setup the test environment
setupTest(NAME, false);

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
    expect(id1).toBeGreaterThanOrEqual(100000);
    expect(id1).toBeLessThanOrEqual(999999);
    expect(id2).toBeGreaterThanOrEqual(100000);
    expect(id2).toBeLessThanOrEqual(999999);
    expect(id1).not.toEqual(id2); // Very small chance of collision, but should be fine for tests
  });

  test('type guards: isWorkerRequest and isWorkerResponse', () => {
    // Prepare messages with proper BaseMessage structure
    const requestMsg = { id: 123456, type: 'jest', src: 'frontend', dst: 'manager' };
    const responseMsg = { id: 123456, type: 'jest', src: 'manager', dst: 'frontend', response: { name: 'Alice', age: 30 } };

    const isReq = server.isWorkerRequest(requestMsg, 'jest');
    const isRes = server.isWorkerResponse(responseMsg, 'jest');

    expect(isReq).toBe(true);
    expect(isRes).toBe(true);

    // Negative cases
    expect(server.isWorkerRequest(responseMsg, 'jest')).toBe(false);
    expect(server.isWorkerResponse(requestMsg, 'jest')).toBe(false);

    // Test missing fields
    const invalidMsg = { id: 123456, type: 'jest' }; // missing src, dst
    expect(server.isWorkerRequest(invalidMsg, 'jest')).toBe(false);
  });

  test('request: should broadcast a valid request message', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const requestMsg = { id: 654321, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    server.request(requestMsg);
    expect(postMessageSpy).toHaveBeenCalledWith(requestMsg);
    postMessageSpy.mockRestore();
  });

  test('request: should broadcast a valid request message adding id', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const requestMsg = { type: 'jest', src: 'frontend', dst: 'manager' } as const;
    server.request(requestMsg);
    expect(postMessageSpy).toHaveBeenCalledWith(expect.objectContaining({ id: expect.any(Number), ...requestMsg }));
    postMessageSpy.mockRestore();
  });

  test('request: should not broadcast an invalid request message', () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage').mockImplementation(() => {});
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    // @ts-expect-error: purposely wrong message (missing src/dst and has response)
    server.request({ id: 1, type: 'jest', response: { name: 'Eve', age: 99 } });
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(logErrorSpy).toHaveBeenCalled();
    postMessageSpy.mockRestore();
    logErrorSpy.mockRestore();
  });

  test('respond: should broadcast a valid response message', async () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage');
    const responseMsg = { id: 654321, type: 'jest', src: 'manager', dst: 'frontend', response: { name: 'Bob', age: 42 } } as const;
    server.respond(responseMsg);
    expect(postMessageSpy).toHaveBeenCalledWith(responseMsg);
    postMessageSpy.mockRestore();
  });

  test('respond: should not broadcast an invalid response message', () => {
    const postMessageSpy = jest.spyOn((server as any).broadcastChannel, 'postMessage').mockImplementation(() => {});
    const logErrorSpy = jest.spyOn(log, 'error').mockImplementation(() => {});
    // @ts-expect-error: purposely wrong message (missing src/dst and response)
    server.respond({ id: 2, type: 'jest' });
    expect(postMessageSpy).not.toHaveBeenCalled();
    expect(logErrorSpy).toHaveBeenCalled();
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

  test('fetch: should resolve with correct response', async () => {
    const requestMsg = { id: 111111, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    const responseMsg = { id: 111111, type: 'jest', src: 'manager', dst: 'frontend', response: { name: 'Test', age: 99 } } as const;
    setTimeout(() => {
      // Simulate receiving the response
      (server as any).broadcastChannel.onmessage({ data: responseMsg });
    }, 10);
    const result = await server.fetch(requestMsg);
    expect(result).toEqual(responseMsg);
  });

  test('fetch: should resolve with correct response from another thread', async () => {
    const handler = (msg: any) => {
      if (msg.type === 'jest' && !('response' in msg)) {
        server.respond({ ...msg, src: 'manager', dst: msg.src, response: { name: 'Alice', age: 30 } });
      }
    };
    server.on('broadcast_message', handler);

    // Use a separate BroadcastServer instance to simulate another worker
    const testServer = new BroadcastServer('manager', log, NAME);
    const result = await testServer.fetch({ id: 123456, type: 'jest', src: 'frontend', dst: 'manager' });
    testServer.close();
    expect(result).toEqual({ id: 123456, type: 'jest', src: 'manager', dst: 'frontend', response: { name: 'Alice', age: 30 } });

    server.off('broadcast_message', handler);
  });

  test('fetch: should reject on timeout', async () => {
    const requestMsg = { id: 222222, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    await expect(server.fetch(requestMsg)).rejects.toThrow(/Fetch timeout/);
  });

  test('fetch: should reject on timeout from another thread', async () => {
    const handler = (msg: any) => {
      if (msg.type === 'jest' && !('response' in msg)) {
        setTimeout(() => {
          server.respond({ ...msg, src: 'manager', dst: msg.src, response: { name: 'Alice', age: 30 } });
        }, 200).unref(); // Deliberate delay to cause timeout
      }
    };
    server.on('broadcast_message', handler);

    // Use a separate BroadcastServer instance to simulate another worker
    const testServer = new BroadcastServer('manager', log, NAME);
    await expect(testServer.fetch({ id: 123456, type: 'jest', src: 'frontend', dst: 'manager' })).rejects.toThrow(/Fetch timeout/);
    testServer.close();

    server.off('broadcast_message', handler);
  });

  test('fetch: should ignore wrong response type', async () => {
    const requestMsg = { id: 333333, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    const wrongResponse = { id: 333333, type: 'plugins_length', src: 'manager', dst: 'frontend', response: { length: 5 } };
    setTimeout(() => {
      (server as any).broadcastChannel.onmessage({ data: wrongResponse });
    }, 10);
    await expect(server.fetch(requestMsg)).rejects.toThrow(/Fetch timeout/);
  });

  test('fetch: should handle multiple fetches independently', async () => {
    const req1 = { id: 444444, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    const req2 = { id: 555555, type: 'jest', src: 'frontend', dst: 'manager' } as const;
    const res1 = { id: 444444, type: 'jest', src: 'manager', dst: 'frontend', response: { name: 'A', age: 1 } } as const;
    const res2 = { id: 555555, type: 'jest', src: 'manager', dst: 'frontend', response: { name: 'B', age: 2 } } as const;
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
});
