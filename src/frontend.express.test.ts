/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'frontend.test.js', '-logger', 'debug', '-matterlogger', 'debug', '-bridge', '-profile', 'JestFrontendExpress', '-port', '5555', '-passcode', '123456', '-discriminator', '3860'];

import { expect, jest } from '@jest/globals';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { createZip, waiter } from './utils/export.js';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { copyFile } from 'node:fs';

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  return undefined as never;
});

describe('Matterbridge frontend express', () => {
  let matterbridge: Matterbridge;
  let baseUrl: string;

  let loggerLogSpy: jest.SpiedFunction<typeof AnsiLogger.prototype.log>;
  let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
  let consoleDebugSpy: jest.SpiedFunction<typeof console.log>;
  let consoleInfoSpy: jest.SpiedFunction<typeof console.log>;
  let consoleWarnSpy: jest.SpiedFunction<typeof console.log>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.log>;
  const debug = false;

  if (!debug) {
    // Spy on and mock AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      //
    });
    // Spy on and mock console.log
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.info
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args: any[]) => {
      //
    });
    // Spy on and mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: any[]) => {
      //
    });
  } else {
    // Spy on AnsiLogger.log
    loggerLogSpy = jest.spyOn(AnsiLogger.prototype, 'log');
    // Spy on console.log
    consoleLogSpy = jest.spyOn(console, 'log');
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug');
    // Spy on console.info
    consoleInfoSpy = jest.spyOn(console, 'info');
    // Spy on console.warn
    consoleWarnSpy = jest.spyOn(console, 'warn');
    // Spy on console.error
    consoleErrorSpy = jest.spyOn(console, 'error');
  }

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  const makeRequest = (path: string, method: string, body?: any) => {
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null;
      const req = http.request(
        `${'http://localhost:8283'}${path}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data ? Buffer.byteLength(data) : 0,
          },
        },
        (res) => {
          let responseBody = '';
          res.on('data', (chunk) => (responseBody += chunk));
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode || 500,
                body: JSON.parse(responseBody),
              });
            } catch (error) {
              resolve({
                status: res.statusCode || 500,
                body: responseBody,
              });
            }
          });
        },
      );
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  };

  test('Matterbridge.loadInstance(true) -bridge mode', async () => {
    matterbridge = await Matterbridge.loadInstance(true);
    expect(matterbridge).toBeDefined();
    expect(matterbridge.profile).toBe('JestFrontendExpress');
    expect(matterbridge.bridgeMode).toBe('bridge');
    expect((matterbridge as any).initialized).toBe(true);
  }, 60000);

  test('Reset Jest plugins', async () => {
    matterbridge.plugins.clear();
    expect(await matterbridge.plugins.saveToStorage()).toBe(0);
  });

  test('Frontend is running on http', async () => {
    expect((matterbridge as any).frontend.httpServer).toBeDefined();
    expect((matterbridge as any).frontend.httpsServer).toBeUndefined();
    expect((matterbridge as any).frontend.expressApp).toBeDefined();
    expect((matterbridge as any).frontend.webSocketServer).toBeDefined();

    // prettier-ignore
    await waiter('Initialize done', () => { return (matterbridge as any).initialized === true; });
    // prettier-ignore
    await waiter('Frontend Initialize done', () => { return (matterbridge as any).frontend.httpServer!==undefined; });
    // prettier-ignore
    await waiter('WebSocketServer Initialize done', () => { return (matterbridge as any).frontend.webSocketServer!==undefined; });
    // prettier-ignore
    await waiter('Matter server node started', () => { return (matterbridge as any).reachabilityTimeout; });
    // prettier-ignore
    await waiter('Matter server node started', () => { return matterbridge.serverNode?.lifecycle.isOnline === true; });
  }, 60000);

  test('POST /api/login with valid password', async () => {
    // Set the password in the nodeContext
    await matterbridge.nodeContext?.set('password', 'testpassword');

    const response = await makeRequest('/api/login', 'POST', { password: 'testpassword' });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
  });

  test('POST /api/login with invalid password', async () => {
    // Set the password in the nodeContext
    await matterbridge.nodeContext?.set('password', 'testpassword');

    const response = await makeRequest('/api/login', 'POST', { password: 'wrongpassword' });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);
  });

  test('POST /api/login with no nodeContext', async () => {
    // Temporarily remove the nodeContext
    const originalNodeContext = matterbridge.nodeContext;
    matterbridge.nodeContext = undefined;

    const response = await makeRequest('/api/login', 'POST', { password: 'testpassword' });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);

    // Restore the nodeContext
    matterbridge.nodeContext = originalNodeContext;
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
    expect(typeof response.body.heapSpaces).toBe('object');
    expect(typeof response.body.loadedModules).toBe('object');
  });

  test('GET /api/settings', async () => {
    const response = await makeRequest('/api/settings', 'GET');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('systemInformation');
    expect(response.body.systemInformation).toHaveProperty('interfaceName');
    expect(response.body.systemInformation).toHaveProperty('macAddress');
    expect(response.body.systemInformation).toHaveProperty('ipv4Address');
    expect(response.body.systemInformation).toHaveProperty('ipv6Address');
    expect(response.body.systemInformation).toHaveProperty('nodeVersion');
    expect(response.body.systemInformation).toHaveProperty('hostname');
    expect(response.body.systemInformation).toHaveProperty('user');
    expect(response.body.systemInformation).toHaveProperty('osType');
    expect(response.body.systemInformation).toHaveProperty('osRelease');
    expect(response.body.systemInformation).toHaveProperty('osPlatform');
    expect(response.body.systemInformation).toHaveProperty('osArch');
    expect(response.body.systemInformation).toHaveProperty('totalMemory');
    expect(response.body.systemInformation).toHaveProperty('freeMemory');
    expect(response.body.systemInformation).toHaveProperty('systemUptime');

    expect(response.body).toHaveProperty('matterbridgeInformation');
    expect(response.body.matterbridgeInformation).toHaveProperty('bridgeMode');
    expect(response.body.matterbridgeInformation).toHaveProperty('restartMode');
    expect(response.body.matterbridgeInformation).toHaveProperty('loggerLevel');
    expect(response.body.matterbridgeInformation).toHaveProperty('matterLoggerLevel');
    expect(response.body.matterbridgeInformation).toHaveProperty('matterPort');
    expect(response.body.matterbridgeInformation).toHaveProperty('profile');
  });

  test('GET /api/plugins', async () => {
    const response = await makeRequest('/api/plugins', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('object');
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/devices', async () => {
    const response = await makeRequest('/api/devices', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('object');
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('GET /api/view-mblog', async () => {
    const response = await makeRequest('/api/view-mblog', 'GET');

    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Error reading matterbridge log file. Please enable the matterbridge log on file in the settings.');
  });

  test('GET /api/view-mjlog', async () => {
    const response = await makeRequest('/api/view-mjlog', 'GET');

    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Error reading matter log file. Please enable the matter log on file in the settings.');
  });

  test('GET /api/shellyviewsystemlog', async () => {
    const response = await makeRequest('/api/shellyviewsystemlog', 'GET');

    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Error reading shelly log file. Please create the shelly system log before loading it.');
  });

  test('GET /api/download-mblog', async () => {
    const response = await makeRequest('/api/download-mblog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Enable the matterbridge log on file in the settings to download the matterbridge log.');
  });

  test('GET /api/download-mjlog', async () => {
    const response = await makeRequest('/api/download-mjlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Enable the matter log on file in the settings to download the matter log.');
  });

  test('GET /api/shellydownloadsystemlog', async () => {
    const response = await makeRequest('/api/shellydownloadsystemlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Create the Shelly system log before downloading it.');
  });

  test('GET /api/download-mbstorage', async () => {
    const response = await makeRequest('/api/download-mbstorage', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  });

  test('GET /api/download-mjstorage', async () => {
    const response = await makeRequest('/api/download-mjstorage', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  });

  test('GET /api/download-pluginstorage', async () => {
    const response = await makeRequest('/api/download-pluginstorage', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  });

  test('GET /api/download-pluginconfig', async () => {
    const response = await makeRequest('/api/download-pluginconfig', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  });

  test('GET /api/download-backup', async () => {
    try {
      await fs.access(path.join(os.tmpdir(), `matterbridge.backup.zip`), fs.constants.F_OK);
    } catch (error) {
      await fs.copyFile('./src/mock/test.zip.txt', path.join(os.tmpdir(), `matterbridge.backup.zip`));
      // await createZip(path.join(os.tmpdir(), `matterbridge.backup.zip`), path.join(matterbridge.matterbridgeDirectory), path.join(matterbridge.matterbridgePluginDirectory));
    }

    const response = await makeRequest('/api/download-backup', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  }, 60000);

  test('GET Fallback for routing', async () => {
    const response = await makeRequest('/whatever', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toMatch(/^<!doctype html>/);
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance();

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);

  test('Cleanup storage', async () => {
    process.argv.push('-factoryreset');
    (matterbridge as any).initialized = true;
    await (matterbridge as any).parseCommandLine();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Factory reset done! Remove all paired fabrics from the controllers.');
  }, 60000);
});
