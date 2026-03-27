import { jest } from '@jest/globals';

let httpRequestImpl: jest.Mock<any>;
let httpsRequestImpl: jest.Mock<any>;

jest.unstable_mockModule('node:http', async () => {
  const originalModule = jest.requireActual<typeof import('node:http')>('node:http');
  const originalDefault = (originalModule as any).default ?? originalModule;

  return {
    ...originalModule,
    default: {
      ...originalDefault,
      request: (...args: any[]) => httpRequestImpl(...args),
    },
    request: (...args: any[]) => httpRequestImpl(...args),
  };
});

jest.unstable_mockModule('node:https', async () => {
  const originalModule = jest.requireActual<typeof import('node:https')>('node:https');
  const originalDefault = (originalModule as any).default ?? originalModule;

  return {
    ...originalModule,
    default: {
      ...originalDefault,
      request: (...args: any[]) => httpsRequestImpl(...args),
    },
    request: (...args: any[]) => httpsRequestImpl(...args),
  };
});

const { checkHealth, mbHealthCli, mbHealthExitCode, mbHealthMain } = await import('./mb_health.js');

function createStreamingResponse(statusCode: number | undefined, body: string, emitAsString = false) {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};

  return {
    statusCode,
    on: (event: string, handler: (...args: any[]) => void) => {
      handlers[event] ??= [];
      handlers[event].push(handler);
      return undefined as any;
    },
    emit: (event: string, ...args: any[]) => {
      for (const handler of handlers[event] ?? []) handler(...args);
    },
    start: () => {
      if (body.length > 0) {
        const chunk = emitAsString ? body : Buffer.from(body);
        (handlers['data'] ?? []).forEach((h) => h(chunk));
      }
      (handlers['end'] ?? []).forEach((h) => h());
    },
  };
}

describe('mb_health', () => {
  beforeEach(() => {
    httpRequestImpl = jest.fn();
    httpsRequestImpl = jest.fn();
  });

  test('returns 0 on 2xx (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(0);
  });

  test('checkHealth returns true on 2xx', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    await expect(checkHealth('http://localhost:8283/health', 100)).resolves.toBe(true);
  });

  test('checkHealth returns false on invalid url', async () => {
    await expect(checkHealth('not a url', 100)).resolves.toBe(false);
  });

  test('returns 1 on non-2xx (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(500, JSON.stringify({ ok: false }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 on <200 (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(199, JSON.stringify({ ok: false }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 on request error (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, _callback: (res: any) => void) => {
      let errorHandler: (() => void) | undefined;

      const request = {
        on: jest.fn((event: string, handler: () => void) => {
          if (event === 'error') errorHandler = handler;
          return request;
        }),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn(() => {
          queueMicrotask(() => errorHandler?.());
          return request;
        }),
      };

      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 on response error event (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true }));
      queueMicrotask(() => {
        callback(response);
        response.emit('error');
      });
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 when response statusCode is undefined (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(undefined, JSON.stringify({ ok: false }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 when response error has undefined statusCode (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(undefined, JSON.stringify({ ok: false }));
      queueMicrotask(() => {
        callback(response);
        response.emit('error');
      });
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 on timeout (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, _callback: (res: any) => void) => {
      let timeoutHandler: (() => void) | undefined;

      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn((_ms: number, handler: () => void) => {
          timeoutHandler = handler;
          return request;
        }),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn(() => {
          queueMicrotask(() => timeoutHandler?.());
          return request;
        }),
      };

      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(1);
  });

  test('returns 1 on invalid url', async () => {
    await expect(mbHealthExitCode('not a url', 100)).resolves.toBe(1);
  });

  test('uses https module for https URLs', async () => {
    let capturedOptions: any;

    httpsRequestImpl.mockImplementation((options: any, callback: (res: any) => void) => {
      capturedOptions = options;
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    await expect(mbHealthExitCode('https://localhost:8443/health?full=1', 100)).resolves.toBe(0);
    expect(capturedOptions).toEqual(
      expect.objectContaining({
        protocol: 'https:',
        hostname: 'localhost',
        port: '8443',
        path: '/health?full=1',
        method: 'GET',
        rejectUnauthorized: false,
      }),
    );
  });

  test('prints parsed json and exits 0 on success', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true, nested: { value: 1 } }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    const exitFn = jest.fn();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mbHealthCli('http://localhost:8283/health', 100, exitFn as any);

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true, nested: { value: 1 } }, null, 2));
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  test('prints plain body when response is not json and exits 1 on failure', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(503, 'service unavailable', true);
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    const exitFn = jest.fn();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mbHealthCli('http://localhost:8283/health', 100, exitFn as any);

    expect(consoleLogSpy).toHaveBeenCalledWith('service unavailable');
    expect(exitFn).toHaveBeenCalledWith(1);
  });

  test('prints fallback payload when body is empty', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(204, '');
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    const exitFn = jest.fn();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mbHealthCli('http://localhost:8283/health', 100, exitFn as any);

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true, statusCode: 204 }, null, 2));
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  test('cli uses default process.exit when exitFn is omitted', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ status: 'ok' }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    const originalExit = process.exit;
    const exitSpy = jest.fn();
    (process as any).exit = exitSpy;

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await mbHealthCli('http://localhost:8283/health', 100);

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ status: 'ok' }, null, 2));
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      (process as any).exit = originalExit;
      consoleLogSpy.mockRestore();
    }
  });

  test('main uses default url when not provided', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    const exitFn = jest.fn();
    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await mbHealthMain(exitFn as any);

    expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true }, null, 2));
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  test('main uses default process.exit when exitFn is omitted', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      const response = createStreamingResponse(200, JSON.stringify({ ok: true }));
      queueMicrotask(() => {
        callback(response);
        response.start();
      });
      return request;
    });

    const originalExit = process.exit;
    const exitSpy = jest.fn();
    (process as any).exit = exitSpy;

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      await mbHealthMain();

      expect(consoleLogSpy).toHaveBeenCalledWith(JSON.stringify({ ok: true }, null, 2));
      expect(exitSpy).toHaveBeenCalledWith(0);
    } finally {
      (process as any).exit = originalExit;
      consoleLogSpy.mockRestore();
    }
  });
});
