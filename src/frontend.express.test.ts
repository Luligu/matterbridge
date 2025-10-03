// src\frontend.express.test.ts

const MATTER_PORT = 6007;
const FRONTEND_PORT = 8283;
const NAME = 'FrontendExpress';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'frontend.test.js', '-logger', 'debug', '-matterlogger', 'debug', '-bridge', '-homedir', HOMEDIR, '-profile', 'JestFrontendExpress', '-port', MATTER_PORT.toString(), '-passcode', '123456', '-discriminator', '3860'];

import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import { jest } from '@jest/globals';
import { LogLevel } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils/export.js';
import { loggerLogSpy, setDebug, setupTest } from './utils/jestHelpers.js';
import { MATTER_LOGGER_FILE, MATTERBRIDGE_LOGGER_FILE } from './matterbridgeTypes.js';

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge frontend express with http', () => {
  let matterbridge: Matterbridge;
  let baseUrl: string;

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

  const makeMultipartRequest = (path: string, filename: string, fileContent: Buffer) => {
    return new Promise<{ status: number; body: any }>((resolve, reject) => {
      const boundary = '----formdata-boundary';
      const formData = [
        `--${boundary}`,
        `Content-Disposition: form-data; name="filename"`,
        '',
        filename,
        `--${boundary}`,
        `Content-Disposition: form-data; name="file"; filename="${filename}"`,
        `Content-Type: application/octet-stream`,
        '',
        fileContent.toString('binary'),
        `--${boundary}--`,
        '',
      ].join('\r\n');

      const req = http.request(
        `http://localhost:8283${path}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': Buffer.byteLength(formData, 'binary'),
          },
        },
        (res) => {
          let responseBody = '';
          res.on('data', (chunk) => (responseBody += chunk));
          res.on('end', () => {
            resolve({
              status: res.statusCode || 500,
              body: responseBody,
            });
          });
        },
      );
      req.on('error', reject);
      req.write(formData, 'binary');
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

  test('POST /api/login with nodeContext error', async () => {
    // Temporarily mock the nodeContext
    const getMock = jest.spyOn(matterbridge.nodeContext as any, 'get').mockImplementation(() => {
      throw new Error('NodeContext error');
    });
    const response = await makeRequest('/api/login', 'POST', { password: 'testpassword' });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(false);

    // Restore the nodeContext
    getMock.mockRestore();
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
    expect(typeof response.body.cjsModules).toBe('object');
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
  }, 30000);

  test('GET /api/plugins', async () => {
    const response = await makeRequest('/api/plugins', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('object');
    expect(Array.isArray(response.body)).toBe(true);
  }, 30000);

  test('GET /api/devices', async () => {
    const response = await makeRequest('/api/devices', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('object');
    expect(Array.isArray(response.body)).toBe(true);
  }, 30000);

  test('GET /api/view-mblog error', async () => {
    const response = await makeRequest('/api/view-mblog', 'GET');

    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Error reading matterbridge log file. Please enable the matterbridge log on file in the settings.');
  }, 30000);

  test('GET /api/view-mblog', async () => {
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), 'Test log content', 'utf8');
    const response = await makeRequest('/api/view-mblog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Test log content');

    await fs.unlink(path.join(matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE));
  }, 30000);

  test('GET /api/view-mjlog error', async () => {
    const response = await makeRequest('/api/view-mjlog', 'GET');

    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Error reading matter log file. Please enable the matter log on file in the settings.');
  }, 30000);

  test('GET /api/view-mjlog', async () => {
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), 'Test log content', 'utf8');
    const response = await makeRequest('/api/view-mjlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Test log content');

    await fs.unlink(path.join(matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE));
  }, 30000);

  test('GET /api/view-diagnostic', async () => {
    const response = await makeRequest('/api/view-diagnostic', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
  }, 30000);

  test('GET /api/shellyviewsystemlog error', async () => {
    const response = await makeRequest('/api/shellyviewsystemlog', 'GET');

    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Error reading shelly log file. Please create the shelly system log before loading it.');
  }, 30000);

  test('GET /api/shellyviewsystemlog', async () => {
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, 'shelly.log'), 'Test shelly log content', 'utf8');
    const response = await makeRequest('/api/shellyviewsystemlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Test shelly log content');

    await fs.unlink(path.join(matterbridge.matterbridgeDirectory, 'shelly.log'));
  }, 30000);

  test('GET /api/download-mblog no log', async () => {
    const response = await makeRequest('/api/download-mblog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Enable the matterbridge log on file in the settings to download the matterbridge log.');
  }, 30000);

  test('GET /api/download-mblog', async () => {
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE), 'Test log content', 'utf8');
    const response = await makeRequest('/api/download-mblog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Test log content');

    await fs.unlink(path.join(matterbridge.matterbridgeDirectory, MATTERBRIDGE_LOGGER_FILE));
  }, 30000);

  test('GET /api/download-mjlog no log', async () => {
    const response = await makeRequest('/api/download-mjlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Enable the matter log on file in the settings to download the matter log.');
  }, 30000);

  test('GET /api/download-mjlog', async () => {
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE), 'Test log content', 'utf8');
    const response = await makeRequest('/api/download-mjlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Test log content');

    await fs.unlink(path.join(matterbridge.matterbridgeDirectory, MATTER_LOGGER_FILE));
  }, 30000);

  test('GET /api/shellydownloadsystemlog no log', async () => {
    const response = await makeRequest('/api/shellydownloadsystemlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Create the Shelly system log before downloading it.');
  }, 30000);

  test('GET /api/shellydownloadsystemlog', async () => {
    await fs.writeFile(path.join(matterbridge.matterbridgeDirectory, 'shelly.log'), 'Test shelly log content', 'utf8');
    const response = await makeRequest('/api/shellydownloadsystemlog', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toBe('Test shelly log content');

    await fs.unlink(path.join(matterbridge.matterbridgeDirectory, 'shelly.log'));
  }, 30000);

  test('GET /api/download-mbstorage', async () => {
    const response = await makeRequest('/api/download-mbstorage', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  }, 30000);

  test('GET /api/download-mjstorage', async () => {
    const response = await makeRequest('/api/download-mjstorage', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  }, 30000);

  test('GET /api/download-pluginstorage', async () => {
    const response = await makeRequest('/api/download-pluginstorage', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  }, 30000);

  test('GET /api/download-pluginconfig', async () => {
    const response = await makeRequest('/api/download-pluginconfig', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  }, 30000);

  test('GET /api/download-backup', async () => {
    try {
      await fs.access(path.join(os.tmpdir(), `matterbridge.backup.zip`), fs.constants.F_OK);
    } catch (error) {
      await fs.copyFile('./src/mock/test.zip', path.join(os.tmpdir(), `matterbridge.backup.zip`));
    }

    const response = await makeRequest('/api/download-backup', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body.startsWith('PK')).toBe(true);
  }, 60000);

  test('POST /api/uploadpackage with invalid request', async () => {
    // Read the test file
    const response = await makeRequest('/api/uploadpackage', 'POST', { filename: 'test.zip' });
    expect(response.status).toBe(500);
  }, 30000);

  test('POST /api/uploadpackage with test.zip', async () => {
    // Read the test file
    const testFileContent = await fs.readFile('./src/mock/test.zip');
    const response = await makeMultipartRequest('/api/uploadpackage', 'test.zip', testFileContent);
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('File test.zip uploaded successfully');
    await expect(fs.access(path.join(matterbridge.matterbridgeDirectory, 'uploads/test.zip'))).resolves.toBeUndefined();
  }, 30000);

  test('POST /api/uploadpackage with matterbridge-plugin-template.tgz', async () => {
    // setDebug(true);
    // Read the test file
    const testFileContent = await fs.readFile('./src/mock/matterbridge-plugin-template._tgz');
    const response = await makeMultipartRequest('/api/uploadpackage', 'matterbridge-plugin-template.tgz', testFileContent);
    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('Plugin package matterbridge-plugin-template.tgz uploaded and installed successfully');
    await expect(fs.access(path.join(matterbridge.matterbridgeDirectory, 'uploads/matterbridge-plugin-template.tgz'))).resolves.toBeUndefined();
    // setDebug(false);
  }, 30000);

  test('POST /api/uploadpackage with wrong tgz', async () => {
    // Read the test file
    const testFileContent = await fs.readFile('./src/mock/test.zip');
    const response = await makeMultipartRequest('/api/uploadpackage', 'matterbridge-plugin-template.tgz', testFileContent);
    expect(response.status).toBe(500);
    expect(typeof response.body).toBe('string');
    expect(response.body).toContain('Error uploading or installing plugin package matterbridge-plugin-template.tgz');
    await expect(fs.access(path.join(matterbridge.matterbridgeDirectory, 'uploads/matterbridge-plugin-template.tgz'))).resolves.toBeUndefined();
  }, 30000);

  test('GET Fallback for routing', async () => {
    const response = await makeRequest('/whatever', 'GET');

    expect(response.status).toBe(200);
    expect(typeof response.body).toBe('string');
    expect(response.body).toMatch(/^<!doctype html>/i);
  });

  test('Matterbridge.destroyInstance() -bridge mode', async () => {
    // Close the Matterbridge instance
    await matterbridge.destroyInstance(10, 100);

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Stopping the frontend...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend app closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `WebSocket server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Http server closed successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Frontend stopped successfully`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.NOTICE, `Cleanup completed. Shutting down...`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, `Closed Matterbridge MdnsService`);
  }, 60000);
});
