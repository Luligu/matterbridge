/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0'];

import { jest } from '@jest/globals';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { waiter } from './utils.js';
import { MatterbridgeDynamicPlatform } from './matterbridgeDynamicPlatform.js';

describe('Matterbridge dynamic platform', () => {
  beforeAll(async () => {
    jest.spyOn(AnsiLogger.prototype, 'log').mockImplementation((level: string, message: string, ...parameters: any[]) => {
      // console.log(`Mocked log: ${level} - ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'debug').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked debug: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'info').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked info: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'warn').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked warn: ${message}`, ...parameters);
    });
    jest.spyOn(AnsiLogger.prototype, 'error').mockImplementation((message: string, ...parameters: any[]) => {
      // console.log(`Mocked error: ${message}`, ...parameters);
    });
  });

  afterAll(async () => {
    (AnsiLogger.prototype.log as jest.Mock).mockRestore();
  }, 60000);

  test('unregisterAllDevices calls matterbridge.removeAllBridgedDevices with correct parameters', async () => {
    const matterbridge = await Matterbridge.loadInstance(true);
    const platform = new MatterbridgeDynamicPlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('DynamicPlatform');
    await matterbridge.destroyInstance();
    await waiter(
      'Matterbridge destroyInstance()',
      () => {
        return (Matterbridge as any).instance === undefined;
      },
      false,
      20000,
      500,
      true,
    );
    matterbridge.removeAllListeners();
    await waiter(
      'Matterbridge destroyInstance() extended',
      () => {
        return false;
      },
      false,
      10000,
      500,
      true,
    );
  }, 60000);
});
