/**
 * @file packages/core/buntest/mb_health.test.ts
 * @description This file contains the bun tests for the mb_health cli.
 * @author Luca Liguori
 */

import { afterEach, describe, expect, spyOn, test, vi } from 'bun:test';
import http from 'node:http';
import https from 'node:https';

import { checkHealth, mbHealthCli, mbHealthExitCode, mbHealthMain } from '../src/mb_health.js';

/** How the fake request ends: a response, a response error, a request error or a timeout. */
type Outcome = { statusCode: number | undefined; body?: string; asString?: boolean; responseError?: boolean } | 'requestError' | 'timeout';

const HEALTH_URL = 'http://localhost:8283/health';
const OK = JSON.stringify({ ok: true });

/**
 * Replaces the request function of the http or https module with a fake that ends with the given outcome.
 *
 * @param {Outcome} outcome - How the request ends.
 * @param {typeof http | typeof https} [module] - The module to fake (default http).
 * @returns {{ options: unknown[] }} The request options received by the fake, in order.
 */
function fakeRequest(outcome: Outcome, module: typeof http | typeof https = http): { options: unknown[] } {
  const received = { options: [] as unknown[] };
  spyOn(module, 'request').mockImplementation(((options: unknown, callback: (response: unknown) => void) => {
    received.options.push(options);
    const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    const emit = (event: string, ...args: unknown[]): void => {
      for (const handler of handlers[event] ?? []) handler(...args);
    };
    let onTimeout: (() => void) | undefined;
    const request = {
      on: (event: string, handler: (...args: unknown[]) => void): unknown => {
        (handlers[event] ??= []).push(handler);
        return request;
      },
      destroy: (): unknown => request,
      setTimeout: (_ms: number, handler: () => void): unknown => {
        onTimeout = handler;
        return request;
      },
      end: (): unknown => {
        queueMicrotask(() => {
          if (outcome === 'requestError') return emit('error');
          if (outcome === 'timeout') return onTimeout?.();
          // The response has its own handlers, registered by the callback.
          const responseHandlers: Record<string, Array<(...args: unknown[]) => void>> = {};
          const response = {
            statusCode: outcome.statusCode,
            on: (event: string, handler: (...args: unknown[]) => void): void => {
              (responseHandlers[event] ??= []).push(handler);
            },
          };
          callback(response);
          const fire = (event: string, ...args: unknown[]): void => {
            for (const handler of responseHandlers[event] ?? []) handler(...args);
          };
          if (outcome.responseError) return fire('error');
          if (outcome.body) fire('data', outcome.asString ? outcome.body : Buffer.from(outcome.body));
          fire('end');
        });
        return request;
      },
    };
    return request;
  }) as never);
  return received;
}

describe('mb_health', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test.each<[string, Outcome, number]>([
    ['a 2xx response', { statusCode: 200, body: OK }, 0],
    ['a non-2xx response', { statusCode: 500, body: OK }, 1],
    ['a response below 200', { statusCode: 199, body: OK }, 1],
    ['a response without status code', { statusCode: undefined, body: OK }, 1],
    ['a request error', 'requestError', 1],
    ['a response error', { statusCode: 200, responseError: true }, 1],
    ['a response error without status code', { statusCode: undefined, responseError: true }, 1],
    ['a timeout', 'timeout', 1],
  ])('mbHealthExitCode maps %s to exit code %d', async (_name, outcome, exitCode) => {
    fakeRequest(outcome);
    expect(await mbHealthExitCode(HEALTH_URL, 100)).toBe(exitCode);
  });

  test('checkHealth and mbHealthExitCode handle a 2xx response and an invalid url', async () => {
    fakeRequest({ statusCode: 200, body: OK });
    expect(await checkHealth(HEALTH_URL, 100)).toBe(true);
    expect(await checkHealth('not a url', 100)).toBe(false);
    expect(await mbHealthExitCode('not a url', 100)).toBe(1);
  });

  test('uses the https module for https URLs', async () => {
    const { options } = fakeRequest({ statusCode: 200, body: OK }, https);
    expect(await mbHealthExitCode('https://localhost:8443/health?full=1', 100)).toBe(0);
    expect(options[0]).toMatchObject({ protocol: 'https:', hostname: 'localhost', port: '8443', path: '/health?full=1', method: 'GET', rejectUnauthorized: false });
  });

  test.each<[string, Outcome, string, number]>([
    ['parsed json', { statusCode: 200, body: JSON.stringify({ ok: true, nested: { value: 1 } }) }, JSON.stringify({ ok: true, nested: { value: 1 } }, null, 2), 0],
    ['a plain body', { statusCode: 503, body: 'service unavailable', asString: true }, 'service unavailable', 1],
    ['a fallback payload for an empty body', { statusCode: 204, body: '' }, JSON.stringify({ ok: true, statusCode: 204 }, null, 2), 0],
  ])('mbHealthCli prints %s', async (_name, outcome, printed, exitCode) => {
    fakeRequest(outcome);
    const exitFn = vi.fn();
    const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    await mbHealthCli(HEALTH_URL, 100, exitFn as never);
    expect(consoleLogSpy).toHaveBeenCalledWith(printed);
    expect(exitFn).toHaveBeenCalledWith(exitCode);
  });

  test('mbHealthCli and mbHealthMain default to process.exit, mbHealthMain to the default url', async () => {
    const { options } = fakeRequest({ statusCode: 200, body: OK });
    const consoleLogSpy = spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = spyOn(process, 'exit').mockImplementation((() => {}) as never);

    await mbHealthCli(HEALTH_URL, 100);
    await mbHealthMain();
    const exitFn = vi.fn();
    await mbHealthMain(exitFn as never);

    expect(exitSpy.mock.calls).toEqual([[0], [0]]);
    expect(exitFn).toHaveBeenCalledWith(0);
    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true }, null, 2));
    expect(options[1]).toMatchObject({ hostname: 'localhost', port: '8283', path: '/health' });
  });
});
