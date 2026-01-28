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

const { mbHealthCli, mbHealthExitCode, mbHealthMain } = await import('./mb_health.ts');

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

      queueMicrotask(() => callback({ statusCode: 200, resume: jest.fn() }));
      return request;
    });

    await expect(mbHealthExitCode('http://localhost:8283/health', 100)).resolves.toBe(0);
  });

  test('returns 1 on non-2xx (http)', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      queueMicrotask(() => callback({ statusCode: 500, resume: jest.fn() }));
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
    httpsRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      queueMicrotask(() => callback({ statusCode: 204, resume: jest.fn() }));
      return request;
    });

    await expect(mbHealthExitCode('https://localhost:8283/health', 100)).resolves.toBe(0);
    expect(httpsRequestImpl).toHaveBeenCalled();
  });

  test('cli calls exit with correct code', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      queueMicrotask(() => callback({ statusCode: 200, resume: jest.fn() }));
      return request;
    });

    const exitFn = jest.fn();
    await mbHealthCli('http://localhost:8283/health', 100, exitFn as any);
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  test('main calls exit with correct code', async () => {
    httpRequestImpl.mockImplementation((_options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        destroy: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
      };

      queueMicrotask(() => callback({ statusCode: 200, resume: jest.fn() }));
      return request;
    });

    const exitFn = jest.fn();
    await mbHealthMain(exitFn as any);
    expect(exitFn).toHaveBeenCalledWith(0);
  });
});
