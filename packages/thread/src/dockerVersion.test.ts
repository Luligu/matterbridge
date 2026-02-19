import { jest } from '@jest/globals';

let httpsGetImpl: jest.Mock<any>;

jest.unstable_mockModule('node:https', async () => {
  return {
    get: (...args: any[]) => httpsGetImpl(...args),
  };
});

const { getDockerVersion } = await import('./dockerVersion.js');

function createStreamingJsonResponse(statusCode: number | undefined, jsonBody: any, raw = false, headers: Record<string, any> = {}) {
  const handlers: Record<string, Array<(...args: any[]) => void>> = {};
  const body = raw ? String(jsonBody) : JSON.stringify(jsonBody);

  const response = {
    statusCode,
    headers,
    resume: jest.fn(),
    on: (event: string, handler: (...args: any[]) => void) => {
      handlers[event] ??= [];
      handlers[event].push(handler);
      return response as any;
    },
    start: () => {
      (handlers['data'] ?? []).forEach((h) => h(body));
      (handlers['end'] ?? []).forEach((h) => h());
    },
  };

  return response;
}

describe('getDockerVersion', () => {
  beforeEach(() => {
    httpsGetImpl = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('returns org.opencontainers.image.version from Docker Hub image config', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = {
        on: jest.fn().mockReturnThis(),
      };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.opencontainers.image.version': '3.5.5' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('3.5.5');
  });

  test('follows 307 redirect for config blob and drops Authorization on cross-host redirect', async () => {
    let redirectedOptions: any;

    httpsGetImpl.mockImplementation((url: string, options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(307, '', true, { location: 'https://redirect.example/config.json' });
          callback(response);
          // No body needed; redirect is handled before streaming
          return;
        }

        if (url === 'https://redirect.example/config.json') {
          redirectedOptions = options;
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.opencontainers.image.version': '8.8.8' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('8.8.8');
    expect(redirectedOptions?.headers?.Authorization).toBeUndefined();
  });

  test('uses default tag (latest) when tag not provided', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.endsWith('/manifests/latest')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.opencontainers.image.version': '3.5.5' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge')).resolves.toBe('3.5.5');
  });

  test('returns undefined for 3xx response without Location header', async () => {
    const resume = jest.fn();

    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(307, '', true, {});
          (response as any).resume = resume;
          callback(response);
          return;
        }
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
    expect(resume).toHaveBeenCalled();
  });

  test('follows redirect when Location is an array and keeps Authorization for same-host redirect', async () => {
    let redirectedOptions: any;

    httpsGetImpl.mockImplementation((url: string, options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(307, '', true, { location: ['https://registry-1.docker.io/redirected/config.json'] });
          callback(response);
          return;
        }

        if (url === 'https://registry-1.docker.io/redirected/config.json') {
          redirectedOptions = options;
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.opencontainers.image.version': '6.6.6' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('6.6.6');
    expect(typeof redirectedOptions?.headers?.Authorization).toBe('string');
  });

  test('supports access_token and container_config Labels', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { access_token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { container_config: { Labels: { 'org.opencontainers.image.version': '9.9.9' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('9.9.9');
  });

  test('falls back to org.label-schema.version in config Labels', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.label-schema.version': '1.2.3' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('1.2.3');
  });

  test('falls back to org.label-schema.version in container_config Labels', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { container_config: { Labels: { 'org.label-schema.version': '7.7.7' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('7.7.7');
  });

  test('handles multi-arch manifest list (prefers linux/amd64)', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.endsWith('/manifests/latest')) {
          const response = createStreamingJsonResponse(200, {
            schemaVersion: 2,
            manifests: [
              { digest: 'sha256:arm64', platform: { os: 'linux', architecture: 'arm64' } },
              { digest: 'sha256:amd64', platform: { os: 'linux', architecture: 'amd64' } },
            ],
          });
          callback(response);
          response.start();
          return;
        }

        if (url.endsWith('/manifests/sha256:amd64')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.opencontainers.image.version': '4.4.4' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('4.4.4');
  });

  test('falls back to first manifest digest when linux/amd64 not present', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.endsWith('/manifests/latest')) {
          const response = createStreamingJsonResponse(200, {
            schemaVersion: 2,
            manifests: [{ digest: 'sha256:first', platform: { os: 'linux', architecture: 'arm64' } }],
          });
          callback(response);
          response.start();
          return;
        }

        if (url.endsWith('/manifests/sha256:first')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'sha256:configdigest' } });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/blobs/sha256:configdigest')) {
          const response = createStreamingJsonResponse(200, { config: { Labels: { 'org.opencontainers.image.version': '5.5.5' } } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBe('5.5.5');
  });

  test('returns undefined when manifest list has no manifests', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, manifests: [] });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });

  test('returns undefined when manifest list has no digests', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, {
            schemaVersion: 2,
            manifests: [{ platform: { os: 'linux', architecture: 'amd64' } }],
          });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });

  test('returns undefined when config digest is invalid', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }

        if (url.includes('/manifests/')) {
          const response = createStreamingJsonResponse(200, { schemaVersion: 2, config: { digest: 'short' } });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });

  test('returns undefined when token is missing/invalid', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'short' });
          callback(response);
          response.start();
          return;
        }

        throw new Error(`Unexpected url: ${url}`);
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });

  test('returns undefined on non-2xx response (including missing statusCode)', async () => {
    const resume = jest.fn();

    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(undefined, { token: 'token-1234567890' });
          (response as any).resume = resume;
          callback(response);
          // no need to stream body; handler should reject immediately
          return;
        }
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
    expect(resume).toHaveBeenCalled();
  });

  test('returns undefined when response JSON is invalid (parse error)', async () => {
    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, '{ not valid json', true);
          callback(response);
          response.start();
          return;
        }
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });

  test('returns undefined when JSON.parse throws non-Error', async () => {
    const originalParse = JSON.parse;

    (JSON as any).parse = () => {
      throw 'bad';
    };

    httpsGetImpl.mockImplementation((url: string, _options: any, callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };

      queueMicrotask(() => {
        if (url.startsWith('https://auth.docker.io/token')) {
          const response = createStreamingJsonResponse(200, { token: 'token-1234567890' });
          callback(response);
          response.start();
          return;
        }
      });

      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();

    // restore

    (JSON as any).parse = originalParse;
  });

  test('returns undefined on request timeout', async () => {
    jest.useFakeTimers();

    httpsGetImpl.mockImplementation((_url: string, _options: any, _callback: (res: any) => void) => {
      const request = { on: jest.fn().mockReturnThis() };
      return request as any;
    });

    const promise = getDockerVersion('luligu', 'matterbridge', 'latest', 10);
    // Allow async dynamic import + promise executor to run
    await Promise.resolve();
    await Promise.resolve();

    await jest.advanceTimersByTimeAsync(20);
    await expect(promise).resolves.toBeUndefined();
  });

  test('returns undefined on request error', async () => {
    httpsGetImpl.mockImplementation((_url: string, _options: any, _callback: (res: any) => void) => {
      const request = {
        on: jest.fn((event: string, handler: (err: any) => void) => {
          if (event === 'error') queueMicrotask(() => handler(new Error('network error')));
          return request;
        }),
      };
      return request as any;
    });

    await expect(getDockerVersion('luligu', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });

  test('returns undefined on invalid args', async () => {
    await expect(getDockerVersion('', 'matterbridge', 'latest', 5_000)).resolves.toBeUndefined();
  });
});
