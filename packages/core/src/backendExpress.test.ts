// src\backendExpress.test.ts

const MATTER_PORT = 9400;
const FRONTEND_PORT = 8287;
const NAME = 'BackendExpress';
const HOMEDIR = path.join('.cache', 'jest', NAME);

process.argv = ['node', 'backendExpress.test.js', '--debug-frontend', '--verbose-frontend'];

import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { jest } from '@jest/globals';
import {
  MATTER_LOGGER_FILE,
  MATTER_STORAGE_DIR,
  MATTERBRIDGE_DIAGNOSTIC_FILE,
  MATTERBRIDGE_HISTORY_FILE,
  MATTERBRIDGE_LOGGER_FILE,
  NODE_STORAGE_DIR,
  type SharedMatterbridge,
} from '@matterbridge/types';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { LogLevel } from 'node-ansi-logger';

import { BackendExpress } from './backendExpress.js';
import type { Frontend } from './frontend.js';
import { setupTest } from './jestutils/jestSetupTest.js';

const TEST_ZIP_FIXTURE = new URL('./mock/test.zip', import.meta.url);

const mockedSharedMatterbridge = {
  matterbridgeDirectory: HOMEDIR,
  rootDirectory: HOMEDIR,
} as unknown as SharedMatterbridge;

const mockedBackend = {
  authClients: new Set<string>(),
  storedPassword: 'testpassword',
  getApiSettings: () => ({ ok: true, settings: { a: 1 } }),
  getApiPlugins: () => ({ ok: true, plugins: [{ name: 'plugin1' }] }),
  getApiDevices: () => ({ ok: true, devices: [{ name: 'device1' }] }),
  wssSendSnackbarMessage: jest.fn(),
  wssSendCloseSnackbarMessage: jest.fn(),
  generateDiagnostic: jest.fn(async () => {
    const diagnosticPath = path.join(HOMEDIR, MATTERBRIDGE_DIAGNOSTIC_FILE);
    await fs.mkdir(path.dirname(diagnosticPath), { recursive: true });
    await fs.writeFile(diagnosticPath, `${'x'.repeat(29)}DIAGNOSTIC_OK`, 'utf8');
  }),
} as unknown as Frontend;

// No isolation needed or allowed since we're testing a single module and want to preserve module state across tests

// Setup the test environment
await setupTest(NAME, false);

describe('BackendExpress', () => {
  let backendExpress: BackendExpress;
  let expressApp: express.Application | undefined;
  let httpServer: http.Server | undefined;
  let httpPort = 0;
  let baseUrl = '';

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  const MAX_CAPTURE_BYTES = 32 * 1024;

  const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const makeRequest = (reqPath: string, method: string, body?: unknown) => {
    return new Promise<{
      status: number;
      body: any;
      headers: http.IncomingHttpHeaders;
      bytes: number;
      truncated: boolean;
    }>((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);

      const headers: Record<string, string> = {};
      if (data !== undefined) {
        headers['Content-Type'] = 'application/json';
        headers['Content-Length'] = String(Buffer.byteLength(data));
      }

      const req = http.request(
        `${baseUrl}${reqPath}`,
        {
          method,
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];
          let bytes = 0;
          let captured = 0;
          let truncated = false;

          res.on('data', (chunk) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buf.length;
            if (!truncated) {
              const remaining = MAX_CAPTURE_BYTES - captured;
              if (remaining <= 0) {
                truncated = true;
                return;
              }
              if (buf.length <= remaining) {
                chunks.push(buf);
                captured += buf.length;
              } else {
                chunks.push(buf.subarray(0, remaining));
                captured += remaining;
                truncated = true;
              }
            }
          });

          res.on('end', () => {
            const status = res.statusCode || 500;
            const contentType = String(res.headers['content-type'] ?? '');
            const raw = Buffer.concat(chunks);

            const rawText = raw.toString('utf8');
            const isJson = contentType.includes('application/json') || /^\s*(\[|{)/.test(rawText);
            const isText = contentType.startsWith('text/') || contentType.includes('json') || contentType.includes('xml') || contentType.includes('html');

            if (!isText && raw.length > 0) {
              resolve({
                status,
                body: `[binary response: ${bytes} bytes${contentType ? `; content-type=${contentType}` : ''}]`,
                headers: res.headers,
                bytes,
                truncated,
              });
              return;
            }

            if (isJson) {
              try {
                resolve({ status, body: JSON.parse(rawText), headers: res.headers, bytes, truncated });
                return;
              } catch {
                // fall through to text
              }
            }

            resolve({
              status,
              body: truncated ? `${rawText}\n[truncated ${captured}/${bytes} bytes]` : rawText,
              headers: res.headers,
              bytes,
              truncated,
            });
          });
        },
      );
      req.on('error', reject);
      if (data !== undefined) req.write(data);
      req.end();
    });
  };

  const makeGetRequestAndAbort = (reqPath: string) => {
    return new Promise<{ status: number }>((resolve) => {
      const req = http.request(`${baseUrl}${reqPath}`, { method: 'GET' }, (res) => {
        const status = res.statusCode || 0;
        res.destroy();
        req.destroy();
        resolve({ status });
      });
      req.on('error', () => resolve({ status: 0 }));
      req.end();
    });
  };

  const makeGetRequestAndAbortEarly = (reqPath: string) => {
    return new Promise<void>((resolve) => {
      const req = http.request(`${baseUrl}${reqPath}`, { method: 'GET' });

      req.on('response', (res) => {
        res.destroy();
      });
      req.on('error', () => resolve());

      req.end();
      setImmediate(() => req.destroy());
      setTimeout(resolve, 25);
    });
  };

  const makeGetRequestAndDrain = (reqPath: string) => {
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; bytes: number }>((resolve, reject) => {
      const req = http.request(`${baseUrl}${reqPath}`, { method: 'GET' }, (res) => {
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk));
        });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, headers: res.headers, bytes });
        });
      });
      req.on('error', reject);
      req.end();
    });
  };

  const makeMultipartRequest = (reqPath: string, filename: string, fileContent: Buffer) => {
    return new Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const boundary = '----formdata-boundary';
      const preamble = Buffer.from(
        [
          `--${boundary}`,
          `Content-Disposition: form-data; name="filename"`,
          '',
          filename,
          `--${boundary}`,
          `Content-Disposition: form-data; name="file"; filename="${filename}"`,
          `Content-Type: application/octet-stream`,
          '',
        ].join('\r\n') + '\r\n',
        'utf8',
      );
      const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
      const payload = Buffer.concat([preamble, fileContent, epilogue]);

      const req = http.request(
        `${baseUrl}${reqPath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(payload.length),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            resolve({
              status: res.statusCode || 500,
              body: Buffer.concat(chunks).toString('utf8'),
              headers: res.headers,
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  };

  const makeMultipartRequestWithoutFile = (reqPath: string, filename: string) => {
    return new Promise<{ status: number; body: any; headers: http.IncomingHttpHeaders }>((resolve, reject) => {
      const boundary = '----formdata-boundary';
      const payload = Buffer.from([`--${boundary}`, `Content-Disposition: form-data; name="filename"`, '', filename, `--${boundary}--`, ''].join('\r\n'), 'utf8');

      const req = http.request(
        `${baseUrl}${reqPath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': String(payload.length),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            resolve({
              status: res.statusCode || 500,
              body: Buffer.concat(chunks).toString('utf8'),
              headers: res.headers,
            });
          });
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  };

  test('Constructor', () => {
    backendExpress = new BackendExpress(mockedSharedMatterbridge, mockedBackend);
    expect(backendExpress).toBeInstanceOf(BackendExpress);
  });

  test('BroadcastServer handler', async () => {
    const isWorkerRequestSpy = jest.spyOn((backendExpress as any).server, 'isWorkerRequest').mockReturnValue(true);
    await (backendExpress as any).broadcastMsgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'frontend' });
    await (backendExpress as any).broadcastMsgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } });
    expect((backendExpress as any).log.logLevel).toBe(LogLevel.DEBUG);
    isWorkerRequestSpy.mockRestore();
  });

  test('Start', async () => {
    await fs.mkdir(path.join(HOMEDIR, 'uploads'), { recursive: true });
    await fs.mkdir(path.join(HOMEDIR, 'apps', 'frontend', 'build'), { recursive: true });
    await fs.writeFile(path.join(HOMEDIR, 'apps', 'frontend', 'build', 'index.html'), '<html>BackendExpress</html>', 'utf8');

    // 1) Trigger limiter once (low limit) to verify it's wired
    // Use a delegating middleware so we can swap limits later without restarting.
    let currentLimiter = rateLimit({ windowMs: 1000, max: 2 });
    (backendExpress as any).fileLimiter = (req: any, res: any, next: any) => currentLimiter(req, res, next);

    expressApp = await backendExpress.start();

    expect(expressApp).toBeDefined();

    httpServer = http.createServer(expressApp);
    await new Promise<void>((resolve) => httpServer?.listen(0, '127.0.0.1', () => resolve()));
    const address = httpServer.address();
    expect(address).toBeDefined();
    httpPort = typeof address === 'string' ? Number.parseInt(address.split(':').pop() ?? '0', 10) : (address?.port ?? 0);
    expect(httpPort).toBeGreaterThan(0);
    baseUrl = `http://127.0.0.1:${httpPort}`;

    // Hit a limited endpoint 3x quickly -> 3rd should be 429
    const r1 = await makeRequest('/api/download-backup', 'GET');
    const r2 = await makeRequest('/api/download-backup', 'GET');
    const r3 = await makeRequest('/api/download-backup', 'GET');
    expect(r3.status).toBe(429);

    // 2) Raise limit so the rest of the suite doesn't trip it
    currentLimiter = rateLimit({ windowMs: 1000, max: 60 });
  });

  test('validateReq returns true when req.ip is missing', () => {
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
    } as any;

    const allowed = (backendExpress as any).validateReq({ ip: undefined } as any, res);
    expect(allowed).toBe(true);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('validateReq uses req.url when req.originalUrl is undefined', () => {
    (mockedBackend as any).authClients.clear();

    const warnSpy = jest.spyOn((backendExpress as any).log, 'warn');
    const res = {
      status: jest.fn(() => res),
      json: jest.fn(() => res),
    } as any;

    const allowed = (backendExpress as any).validateReq({ ip: '127.0.0.1', originalUrl: undefined, url: '/fallback-url' } as any, res);

    expect(allowed).toBe(false);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/fallback-url'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1'));
  });

  test('GET /health', async () => {
    const response = await makeRequest('/health', 'GET');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
    expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date');
  });

  test('GET /memory', async () => {
    const response = await makeRequest('/memory', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body.memoryUsage).toBe('object');
    expect(typeof response.body.heapStats).toBe('object');
    expect(Array.isArray(response.body.heapSpaces)).toBe(true);
    expect(Array.isArray(response.body.cjsModules)).toBe(true);
  });

  test('GET /api/settings unauthorized', async () => {
    (mockedBackend as any).authClients.clear();

    const response = await makeRequest('/api/settings', 'GET');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized' });

    const protectedGetEndpoints = [
      '/api/plugins',
      '/api/devices',
      '/api/view-mblog',
      '/api/download-mblog',
      '/api/view-mjlog',
      '/api/download-mjlog',
      '/api/view-diagnostic',
      '/api/download-diagnostic',
      '/api/viewhistory',
      '/api/downloadhistory',
      '/api/download-backup',
      '/api/download-mbstorage',
      '/api/download-mjstorage',
      '/api/download-pluginstorage',
      '/api/download-pluginconfig',
    ];

    for (const endpoint of protectedGetEndpoints) {
      const unauthorized = await makeRequest(endpoint, 'GET');
      expect(unauthorized.status).toBe(401);
      expect(unauthorized.body).toEqual({ error: 'Unauthorized' });
    }

    const unauthorizedUpload = await makeMultipartRequest('/api/uploadpackage', 'test.zip', Buffer.from('ZIP', 'utf8'));
    expect(unauthorizedUpload.status).toBe(401);
    expect(unauthorizedUpload.body).toContain('Unauthorized');
  });

  test('POST /api/login wrong password', async () => {
    (mockedBackend as any).authClients.clear();
    (mockedBackend as any).storedPassword = 'secret';

    const response = await makeRequest('/api/login', 'POST', { password: 'wrong' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: false });
    expect((mockedBackend as any).authClients.size).toBe(0);
  });

  test('POST /api/login empty password', async () => {
    (mockedBackend as any).authClients.clear();
    (mockedBackend as any).storedPassword = '';

    const response = await makeRequest('/api/login', 'POST', { password: '' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: true });
    expect((mockedBackend as any).authClients.size).toBe(1);
  });

  test('POST /api/login valid password + authorize client', async () => {
    (mockedBackend as any).authClients.clear();
    (mockedBackend as any).storedPassword = 'secret';

    const response = await makeRequest('/api/login', 'POST', { password: 'secret' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ valid: true });
    expect((mockedBackend as any).authClients.size).toBe(1);
  });

  test('GET /api/settings authorized', async () => {
    const response = await makeRequest('/api/settings', 'GET');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, settings: { a: 1 } });
  });

  test('GET /api/plugins authorized', async () => {
    const response = await makeRequest('/api/plugins', 'GET');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.plugins)).toBe(true);
  });

  test('GET /api/devices authorized', async () => {
    const response = await makeRequest('/api/devices', 'GET');
    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.devices)).toBe(true);
  });

  test('GET /api/view-mblog success then error', async () => {
    const logPath = path.join(HOMEDIR, MATTERBRIDGE_LOGGER_FILE);
    await fs.writeFile(logPath, 'MBLOG_OK', 'utf8');

    const ok = await makeRequest('/api/view-mblog', 'GET');
    expect(ok.status).toBe(200);
    expect(typeof ok.body).toBe('string');
    expect(ok.body).toContain('MBLOG_OK');

    await fs.rm(logPath, { force: true });
    const err = await makeRequest('/api/view-mblog', 'GET');
    expect(err.status).toBe(500);
    expect(typeof err.body).toBe('string');
    expect(err.body).toContain('Error reading matterbridge log file');
  });

  test('GET /api/download-mblog missing then present', async () => {
    const debugSpy = jest.spyOn((backendExpress as any).log, 'debug');
    const logPath = path.join(HOMEDIR, MATTERBRIDGE_LOGGER_FILE);
    await fs.rm(logPath, { force: true });

    const missing = await makeRequest('/api/download-mblog', 'GET');
    expect(missing.status).toBe(200);
    expect(typeof missing.body).toBe('string');
    expect(missing.body).toContain('Enable the matterbridge log on file');

    await fs.writeFile(logPath, 'MBLOG_DOWNLOAD_OK', 'utf8');
    const present = await makeRequest('/api/download-mblog', 'GET');
    expect(present.status).toBe(200);
    expect(typeof present.body).toBe('string');
    expect(present.body).toContain('MBLOG_DOWNLOAD_OK');
    await delay(50);

    const sawSuccess = debugSpy.mock.calls.some((args) => String(args[0]).includes(MATTERBRIDGE_LOGGER_FILE) && String(args[0]).includes('downloaded successfully'));
    expect(sawSuccess).toBe(true);
  });

  test('GET /api/download-mblog aborted download triggers error callback branch', async () => {
    const result = await makeGetRequestAndAbortEarly('/api/download-mblog');
    expect(result).toBeUndefined();
  });

  test('GET /api/view-mjlog success then error', async () => {
    const logPath = path.join(HOMEDIR, MATTER_LOGGER_FILE);
    await fs.writeFile(logPath, 'MJLOG_OK', 'utf8');

    const ok = await makeRequest('/api/view-mjlog', 'GET');
    expect(ok.status).toBe(200);
    expect(typeof ok.body).toBe('string');
    expect(ok.body).toContain('MJLOG_OK');

    await fs.rm(logPath, { force: true });
    const err = await makeRequest('/api/view-mjlog', 'GET');
    expect(err.status).toBe(500);
    expect(typeof err.body).toBe('string');
    expect(err.body).toContain('Error reading matter log file');
  });

  test('GET /api/download-mjlog missing then present', async () => {
    const debugSpy = jest.spyOn((backendExpress as any).log, 'debug');
    const logPath = path.join(HOMEDIR, MATTER_LOGGER_FILE);
    await fs.rm(logPath, { force: true });

    const missing = await makeRequest('/api/download-mjlog', 'GET');
    expect(missing.status).toBe(200);
    expect(typeof missing.body).toBe('string');
    expect(missing.body).toContain('Enable the matter log on file');

    await fs.writeFile(logPath, 'MJLOG_DOWNLOAD_OK', 'utf8');
    const present = await makeRequest('/api/download-mjlog', 'GET');
    expect(present.status).toBe(200);
    expect(typeof present.body).toBe('string');
    expect(present.body).toContain('MJLOG_DOWNLOAD_OK');
    await delay(50);

    const sawSuccess = debugSpy.mock.calls.some((args) => String(args[0]).includes(MATTER_LOGGER_FILE) && String(args[0]).includes('downloaded successfully'));
    expect(sawSuccess).toBe(true);
  });

  test('GET /api/download-mjlog aborted download triggers error callback branch', async () => {
    const result = await makeGetRequestAndAbortEarly('/api/download-mjlog');
    expect(result).toBeUndefined();
  });

  test('GET /api/view-diagnostic + /api/download-diagnostic', async () => {
    const debugSpy = jest.spyOn((backendExpress as any).log, 'debug');
    const view = await makeRequest('/api/view-diagnostic', 'GET');
    expect(view.status).toBe(200);
    expect(typeof view.body).toBe('string');
    expect(view.body).toContain('DIAGNOSTIC_OK');

    const download = await makeRequest('/api/download-diagnostic', 'GET');
    expect(download.status).toBe(200);
    expect(typeof download.body).toBe('string');
    expect(download.body).toContain('DIAGNOSTIC_OK');
    await delay(50);

    const sawSuccess = debugSpy.mock.calls.some((args) => String(args[0]).includes(MATTERBRIDGE_DIAGNOSTIC_FILE) && String(args[0]).includes('downloaded successfully'));
    expect(sawSuccess).toBe(true);
  });

  test('GET /api/view-diagnostic error when diagnostic file missing', async () => {
    const diagnosticPath = path.join(HOMEDIR, MATTERBRIDGE_DIAGNOSTIC_FILE);
    await fs.rm(diagnosticPath, { force: true });

    (mockedBackend as any).generateDiagnostic.mockImplementationOnce(async () => {
      await fs.rm(diagnosticPath, { force: true });
    });

    const response = await makeRequest('/api/view-diagnostic', 'GET');
    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('Error reading diagnostic log file');
  });

  test('GET /api/download-diagnostic aborted download triggers error callback branch', async () => {
    const result = await makeGetRequestAndAbortEarly('/api/download-diagnostic');
    expect(result).toBeUndefined();
  });

  test('GET /api/viewhistory + downloadhistory success then error', async () => {
    const debugSpy = jest.spyOn((backendExpress as any).log, 'debug');
    const historyPath = path.join(HOMEDIR, MATTERBRIDGE_HISTORY_FILE);
    await fs.writeFile(historyPath, '<html>HISTORY_OK</html>', 'utf8');

    const view = await makeRequest('/api/viewhistory', 'GET');
    expect(view.status).toBe(200);
    expect(typeof view.body).toBe('string');
    expect(view.body).toContain('HISTORY_OK');

    const downloadOk = await makeRequest('/api/downloadhistory', 'GET');
    expect(downloadOk.status).toBe(200);
    expect(typeof downloadOk.body).toBe('string');
    expect(downloadOk.body).toContain('HISTORY_OK');
    await delay(50);

    const sawSuccess = debugSpy.mock.calls.some((args) => String(args[0]).includes(MATTERBRIDGE_HISTORY_FILE) && String(args[0]).includes('downloaded successfully'));
    expect(sawSuccess).toBe(true);

    await fs.rm(historyPath, { force: true });
    const downloadErr = await makeRequest('/api/downloadhistory', 'GET');
    expect(downloadErr.status).toBe(500);
    expect(typeof downloadErr.body).toBe('string');
    expect(downloadErr.body).toContain('Error reading history file');
  });

  test('GET /api/viewhistory error when history file missing', async () => {
    const historyPath = path.join(HOMEDIR, MATTERBRIDGE_HISTORY_FILE);
    await fs.rm(historyPath, { force: true });

    const response = await makeRequest('/api/viewhistory', 'GET');
    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('Error reading history file');
  });

  test('GET /api/downloadhistory aborted download triggers error callback branch', async () => {
    const historyPath = path.join(HOMEDIR, MATTERBRIDGE_HISTORY_FILE);
    await fs.writeFile(historyPath, '<html>HISTORY_ABORT</html>', 'utf8');

    const result = await makeGetRequestAndAbortEarly('/api/downloadhistory');
    expect(result).toBeUndefined();
  });

  test('GET /api/download-* zip endpoints error callback branches (missing file)', async () => {
    const tmp = os.tmpdir();
    const cases = [
      { endpoint: '/api/download-backup', filename: 'matterbridge.backup.zip' },
      { endpoint: '/api/download-mbstorage', filename: `matterbridge.${NODE_STORAGE_DIR}.zip` },
      { endpoint: '/api/download-mjstorage', filename: `matterbridge.${MATTER_STORAGE_DIR}.zip` },
      { endpoint: '/api/download-pluginstorage', filename: 'matterbridge.pluginstorage.zip' },
      { endpoint: '/api/download-pluginconfig', filename: 'matterbridge.pluginconfig.zip' },
    ];

    for (const c of cases) {
      const filePath = path.join(tmp, c.filename);
      const backupPath = `${filePath}.bak.${process.pid}.${Date.now()}`;
      let restored = false;

      try {
        await fs.rename(filePath, backupPath);
        restored = true;
      } catch {
        // file did not exist or could not be renamed; proceed anyway
      }

      try {
        const response = await makeRequest(c.endpoint, 'GET');
        expect([404, 500]).toContain(response.status);
        await delay(10);
      } finally {
        if (restored) {
          await fs.rename(backupPath, filePath);
        }
      }
    }
  });

  test('GET /api/download-* zip endpoints success callback branches (files present)', async () => {
    const tmp = os.tmpdir();
    const zipPaths = [
      path.join(tmp, 'matterbridge.backup.zip'),
      path.join(tmp, `matterbridge.${NODE_STORAGE_DIR}.zip`),
      path.join(tmp, `matterbridge.${MATTER_STORAGE_DIR}.zip`),
      path.join(tmp, 'matterbridge.pluginstorage.zip'),
      path.join(tmp, 'matterbridge.pluginconfig.zip'),
    ];
    for (const filePath of zipPaths) {
      await fs.copyFile(TEST_ZIP_FIXTURE, filePath);
    }

    const endpoints = ['/api/download-backup', '/api/download-mbstorage', '/api/download-mjstorage', '/api/download-pluginstorage', '/api/download-pluginconfig'];
    for (const endpoint of endpoints) {
      const response = await makeGetRequestAndDrain(endpoint);
      expect(response.status).toBe(200);
      expect(response.headers['content-disposition']).toBeDefined();
      expect(String(response.headers['content-disposition'])).toContain('attachment');
      expect(response.bytes).toBeGreaterThan(0);
      await delay(10);
    }

    expect((mockedBackend as any).wssSendCloseSnackbarMessage).toHaveBeenCalledTimes(endpoints.length);
  });

  test('POST /api/uploadpackage invalid request (no file)', async () => {
    // authorize again
    (mockedBackend as any).storedPassword = '';
    await makeRequest('/api/login', 'POST', { password: 'anything' });

    const response = await makeMultipartRequestWithoutFile('/api/uploadpackage', 'test.zip');
    expect(response.status).toBe(400);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('Invalid request');
  });

  test('POST /api/uploadpackage success (non-tgz, no manager request)', async () => {
    const uploadPath = path.join(HOMEDIR, 'uploads', 'test.zip');
    await fs.rm(uploadPath, { force: true });

    const response = await makeMultipartRequest('/api/uploadpackage', 'test.zip', Buffer.from('ZIP', 'utf8'));
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('File test.zip uploaded successfully');
    await expect(fs.access(uploadPath)).resolves.toBeUndefined();
  }, 30000);

  test('POST /api/uploadpackage success (.tgz triggers manager request)', async () => {
    const server = (backendExpress as any).server;
    const requestSpy = jest.spyOn(server, 'request');

    const uploadPath = path.join(HOMEDIR, 'uploads', 'test.tgz');
    await fs.rm(uploadPath, { force: true });

    const response = await makeMultipartRequest('/api/uploadpackage', 'test.tgz', Buffer.from('TGZ', 'utf8'));
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('File test.tgz uploaded successfully');
    await expect(fs.access(uploadPath)).resolves.toBeUndefined();

    expect(requestSpy).toHaveBeenCalledTimes(1);
    expect(requestSpy.mock.calls[0]?.[0]).toMatchObject({
      type: 'manager_run',
      src: 'frontend',
      dst: 'manager',
      params: {
        name: 'SpawnCommand',
      },
    });
  }, 30000);

  test('POST /api/uploadpackage error path (rename fails)', async () => {
    const uploadPath = path.join(HOMEDIR, 'uploads', 'dir-as-file.zip');
    await fs.rm(uploadPath, { recursive: true, force: true });
    await fs.mkdir(uploadPath, { recursive: true });

    const response = await makeMultipartRequest('/api/uploadpackage', 'dir-as-file.zip', Buffer.from('ZIP', 'utf8'));
    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('Error uploading or installing');
  }, 30000);

  test('GET Fallback for routing', async () => {
    const response = await makeRequest('/some/unknown/path', 'GET');
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('BackendExpress');
  });

  test('Stop', async () => {
    if (httpServer) {
      await new Promise<void>((resolve) => httpServer?.close(() => resolve()));
      httpServer = undefined;
      httpPort = 0;
      baseUrl = '';
    }

    expressApp = await backendExpress.stop();

    expect(expressApp).toBeUndefined();
  });

  test('Stop when already stopped', async () => {
    expressApp = await backendExpress.stop();
    expect(expressApp).toBeUndefined();
  });

  test('Destroy', async () => {
    backendExpress.destroy();

    const server: any = (backendExpress as any).server;
    expect(server).toBeDefined();
    expect(server.closed).toBe(true);
    expect(server.broadcastChannel?.onmessage).toBe(null);
    expect(server.broadcastChannel?.onmessageerror).toBe(null);
  });
});
