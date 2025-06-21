// src\shelly.test.ts

/* eslint-disable no-console */

import { jest } from '@jest/globals';
import http, { IncomingMessage, ServerResponse } from 'node:http';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.ts';
import { getShelly, postShelly, setVerifyIntervalSecs, setVerifyTimeoutSecs } from './shelly.ts';

const log = new AnsiLogger({ logName: 'Matterbridge', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
const debug = false; // Set to true to enable debug logging

if (!debug) {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {});
  consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {});
  consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {});
  consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {});
  consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {});
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {});
} else {
  loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
  consoleLogSpy = jest.spyOn(console, 'log');
  consoleDebugSpy = jest.spyOn(console, 'debug');
  consoleInfoSpy = jest.spyOn(console, 'info');
  consoleWarnSpy = jest.spyOn(console, 'warn');
  consoleErrorSpy = jest.spyOn(console, 'error');
}

describe('getMatterbridgeLatestVersion', () => {
  let server: http.Server;
  let serverFail = false;
  let updatingInProgress = false;
  let matterbridgeMock: Matterbridge;

  beforeAll(async () => {
    server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url || serverFail) {
        res.writeHead(400);
        return res.end();
      }

      switch (req.url) {
        case '/api/updates/sys/check':
        case '/api/updates/main/check':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify([{ name: 'shelly' }]));

        case '/api/updates/sys/perform':
        case '/api/updates/main/perform':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 'updatingInProgress': true }));

        case '/api/updates/sys/status':
        case '/api/updates/main/status':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          // eslint-disable-next-line no-case-declarations
          const msg = res.end(JSON.stringify({ 'updatingInProgress': updatingInProgress }));
          updatingInProgress = false;
          return msg;

        case '/api/network/connection/static':
        case '/api/network/connection/dynamic':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({}));

        case '/api/system/reboot':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 'success': true }));

        case '/api/reset/soft':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 'ok': true }));

        case '/api/reset/hard':
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ 'ok': true }));

        case '/api/logs/system':
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          return res.end('SYSTEM LOG LINE');

        default:
          res.writeHead(404);
          return res.end();
      }
    });

    // Listen on fixed port 8101 at localhost
    await new Promise<void>((resolve) => {
      server.listen(8101, '127.0.0.1', () => {
        console.log(`Server is running...`);
        resolve();
      });
    });

    matterbridgeMock = {
      matterbridgeVersion: '1.0.0',
      matterbridgeInformation: {},
      matterbridgeDirectory: 'test',
      log,
      frontend: {
        wssSendRefreshRequired: jest.fn(),
        wssSendUpdateRequired: jest.fn(),
        wssBroadcastMessage: jest.fn(),
        wssSendSnackbarMessage: jest.fn(),
        wssSendCloseSnackbarMessage: jest.fn(),
      },
    } as unknown as Matterbridge;
  });

  beforeEach(() => {
    serverFail = false;
    setVerifyTimeoutSecs(10);
    setVerifyIntervalSecs(1);
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore the original implementations
    jest.restoreAllMocks();
  });

  it('should set the verify timeout', async () => {
    const { setVerifyTimeoutSecs } = await import('./shelly.js');
    expect(setVerifyTimeoutSecs(10)).toBeUndefined();
  });

  it('should set the verify interval', async () => {
    const { setVerifyIntervalSecs } = await import('./shelly.js');
    expect(setVerifyIntervalSecs(2)).toBeUndefined();
  });

  it('should getShellySysUpdate', async () => {
    const { getShellySysUpdate } = await import('./shelly.js');
    const result = await getShellySysUpdate(matterbridgeMock);
    expect(result).toBeUndefined();

    serverFail = true;
    await getShellySysUpdate(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  });

  it('should triggerShellySysUpdate', async () => {
    const { triggerShellySysUpdate, setVerifyTimeoutSecs } = await import('./shelly.js');
    const result = await triggerShellySysUpdate(matterbridgeMock);
    expect(result).toBeUndefined();

    updatingInProgress = true;
    await triggerShellySysUpdate(matterbridgeMock);

    setVerifyTimeoutSecs(1);
    await triggerShellySysUpdate(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('timed out'));

    serverFail = true;
    await triggerShellySysUpdate(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should verifyShellyUpdate', async () => {
    const { verifyShellyUpdate, setVerifyTimeoutSecs } = await import('./shelly.js');
    const result = await verifyShellyUpdate(matterbridgeMock, '/api/updates/sys/status', 'Shelly system update');
    expect(result).toBeUndefined();

    updatingInProgress = true;
    await verifyShellyUpdate(matterbridgeMock, '/api/updates/sys/status', 'Shelly system update');

    setVerifyTimeoutSecs(1);
    await verifyShellyUpdate(matterbridgeMock, '/api/updates/sys/status', 'Shelly system update');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('timed out'));

    serverFail = true;
    setVerifyTimeoutSecs(10);
    setVerifyIntervalSecs(1);
    await verifyShellyUpdate(matterbridgeMock, '/api/updates/sys/status', 'Shelly system update');
    await new Promise((resolve) => setTimeout(resolve, 1000)); // wait for the error to be logged
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should getShellyMainUpdate', async () => {
    const { getShellyMainUpdate } = await import('./shelly.js');
    const result = await getShellyMainUpdate(matterbridgeMock);
    expect(result).toBeUndefined();

    serverFail = true;
    await getShellyMainUpdate(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  });

  it('should triggerShellyMainUpdate', async () => {
    const { triggerShellyMainUpdate } = await import('./shelly.js');
    const result = await triggerShellyMainUpdate(matterbridgeMock);
    expect(result).toBeUndefined();

    updatingInProgress = true;
    await triggerShellyMainUpdate(matterbridgeMock);

    setVerifyTimeoutSecs(1);
    await triggerShellyMainUpdate(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('timed out'));

    serverFail = true;
    await triggerShellyMainUpdate(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should triggerShellyChangeIp dhcp', async () => {
    const { triggerShellyChangeIp } = await import('./shelly.js');
    const result = await triggerShellyChangeIp(matterbridgeMock, { type: 'dhcp', ip: '', subnet: '', gateway: '', dns: '' });
    expect(result).toBeUndefined();

    serverFail = true;
    await triggerShellyChangeIp(matterbridgeMock, { type: 'dhcp', ip: '', subnet: '', gateway: '', dns: '' });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should triggerShellyChangeIp static', async () => {
    const { triggerShellyChangeIp } = await import('./shelly.js');
    const result = await triggerShellyChangeIp(matterbridgeMock, { type: 'static', ip: '', subnet: '', gateway: '', dns: '' });
    expect(result).toBeUndefined();

    serverFail = true;
    await triggerShellyChangeIp(matterbridgeMock, { type: 'static', ip: '', subnet: '', gateway: '', dns: '' });
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should triggerShellyReboot', async () => {
    const { triggerShellyReboot } = await import('./shelly.js');
    const result = await triggerShellyReboot(matterbridgeMock);
    expect(result).toBeUndefined();

    serverFail = true;
    await triggerShellyReboot(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should triggerShellySoftReset', async () => {
    const { triggerShellySoftReset } = await import('./shelly.js');
    const result = await triggerShellySoftReset(matterbridgeMock);
    expect(result).toBeUndefined();

    serverFail = true;
    await triggerShellySoftReset(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should triggerShellyHardReset', async () => {
    const { triggerShellyHardReset } = await import('./shelly.js');
    const result = await triggerShellyHardReset(matterbridgeMock);
    expect(result).toBeUndefined();

    serverFail = true;
    await triggerShellyHardReset(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should createShellySystemLog', async () => {
    const { createShellySystemLog } = await import('./shelly.js');
    const result = await createShellySystemLog(matterbridgeMock);
    expect(result).toBeUndefined();

    serverFail = true;
    await createShellySystemLog(matterbridgeMock);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('Error'));
  }, 30000);

  it('should close the server', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    expect(server.listening).toBe(false);
  });

  it('should rejects on network error', async () => {
    const { getShelly } = await import('./shelly.js');
    await expect(getShelly('/status')).rejects.toThrow(/Request failed:/);
  });
});

describe('getShelly full coverage against real HTTP server', () => {
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url) {
        res.writeHead(400);
        return res.end();
      }

      switch (req.url) {
        case '/status':
          // valid JSON branch
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ foo: 'bar' }));

        case '/api/logs/system':
          // raw-text branch
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          return res.end('SYSTEM LOG');

        case '/invalid-json':
          // JSON-parse-error branch
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end('{"not": "closed"'); // malformed

        case '/notfound':
          // non-200 status branch
          res.writeHead(404);
          return res.end('Not Found');

        case '/slow':
          // timeout branch: never send headers/body
          // just keep the connection open
          return;

        default:
          res.writeHead(500);
          return res.end('Unexpected');
      }
    });

    // Listen on fixed port 8101 at localhost
    await new Promise<void>((resolve) => {
      server.listen(8101, '127.0.0.1', () => resolve());
    });
  });

  it('resolves JSON on /status', async () => {
    const data = await getShelly('/status');
    expect(data).toEqual({ foo: 'bar' });
  });

  it('resolves raw text on /api/logs/system', async () => {
    const text = await getShelly('/api/logs/system');
    expect(text).toBe('SYSTEM LOG');
  });

  it('rejects on non-200 status', async () => {
    await expect(getShelly('/notfound')).rejects.toThrow(/Failed to fetch data\. Status code: 404/);
  });

  it('rejects on JSON parse error', async () => {
    await expect(getShelly('/invalid-json')).rejects.toThrow(/Failed to parse response JSON/);
  });

  it('rejects on timeout', async () => {
    // use a small timeout so test runs fast
    await expect(getShelly('/slow', 10)).rejects.toThrow(/Request timed out after 0\.\d+ seconds/);
  });

  it('rejects on network error', async () => {
    // shut down server to force a connection error
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await expect(getShelly('/status')).rejects.toThrow(/Request failed:/);
  });
});

describe('postShelly full coverage against real HTTP server', () => {
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer((req: IncomingMessage, res: ServerResponse) => {
      if (!req.url || req.method !== 'POST') {
        res.writeHead(400);
        return res.end();
      }

      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        switch (req.url) {
          case '/echo':
            // success branch: echo back parsed JSON
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ received: JSON.parse(body) }));

          case '/invalid-json':
            // JSON-parse-error branch
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end('not-a-json');

          case '/error':
            // non-success status branch
            res.writeHead(301);
            return res.end('Redirect');

          case '/slow':
            // timeout branch: never send headers/body
            return;

          default:
            res.writeHead(500);
            return res.end('Unexpected');
        }
      });
    });

    // Listen on fixed port 8101 at localhost
    await new Promise<void>((resolve) => {
      server.listen(8101, '127.0.0.1', () => resolve());
    });
  });

  it('resolves with echoed JSON on /echo', async () => {
    const payload = { foo: 'bar' };
    const result = await postShelly('/echo', payload);
    expect(result).toEqual({ received: payload });
  });

  it('rejects on non-200 status', async () => {
    await expect(postShelly('/error', { a: 1 })).rejects.toThrow(/Failed to post data\. Status code: 301/);
  });

  it('rejects on JSON parse error', async () => {
    await expect(postShelly('/invalid-json', { x: 2 })).rejects.toThrow(/Failed to parse response JSON/);
  });

  it('rejects on timeout', async () => {
    await expect(postShelly('/slow', { t: true }, 10)).rejects.toThrow(/Request timed out after 0\.\d+ seconds/);
  });

  it('rejects on network error', async () => {
    // close server to force a connection error
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await expect(postShelly('/echo', { z: 3 })).rejects.toThrow(/Request failed:/);
  });
});
