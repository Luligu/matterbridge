/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

process.argv = ['node', 'matterbridge.test.js', '-frontend', '0', '-profile', 'Jest'];

import { jest } from '@jest/globals';

import { AnsiLogger, LogLevel } from 'node-ansi-logger';
import { Matterbridge } from './matterbridge.js';
import { wait, waiter } from './utils/utils.js';
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

  test('create a MatterbridgeDynamicPlatform', async () => {
    const matterbridge = await Matterbridge.loadInstance(true);
    expect((Matterbridge as any).instance).toBeDefined();

    const platform = new MatterbridgeDynamicPlatform(matterbridge, new AnsiLogger({ logName: 'Matterbridge platform' }), { name: 'test', type: 'type', debug: false, unregisterOnShutdown: false });
    expect(platform.type).toBe('DynamicPlatform');

    // Destroy the Matterbridge instance
    await matterbridge.destroyInstance();
    expect((Matterbridge as any).instance).toBeUndefined();

    /*
    // Wait for the Matterbridge instance to be destroyed (give time to getGlobalNodeModules and getMatterbridgeLatestVersion)
    await waiter(
      'Matterbridge destroyInstance()',
      () => {
        return (Matterbridge as any).instance === undefined;
      },
      false,
      20000,
      500,
      false,
    );

    // Wait for the Matterbridge instance to be destroyed (give time to getGlobalNodeModules and getMatterbridgeLatestVersion) and the storage to close
    await wait(1000, 'Wait for the Matterbridge instance to be destroyed', false);
    */
  }, 60000);
});
