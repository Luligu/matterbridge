// src\threadsManager.mainthread.test.ts

const NAME = 'ThreadsManagerMainThread';
const HOMEDIR = path.join('.cache', 'jest', NAME);

import path from 'node:path';

import { jest } from '@jest/globals';
import { setupTest } from '@matterbridge/core/jestutils';
import type { WorkerMessage } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from './broadcastServer.js';
import { ThreadsManager } from './threadsManager.js';

// Setup the test environment
await setupTest(NAME, false);

describe('ThreadsManagerMainThread', () => {
  const log = new AnsiLogger({ logName: 'ThreadsManagerMainThread', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  let broadcastserverMatterbridge: BroadcastServer;
  let broadcastserverPlugins: BroadcastServer;
  let manager: ThreadsManager;

  beforeAll(async () => {
    // process.argv.push('--debug-worker');
    // Create ThreadsManager instance
    manager = new ThreadsManager();
    // Create mocked broadcast servers
    broadcastserverMatterbridge = new BroadcastServer('matterbridge', log);
    broadcastserverMatterbridge.on('broadcast_message', (msg: WorkerMessage) => {
      if (broadcastserverMatterbridge.isWorkerRequest(msg) && msg.type === 'matterbridge_shared') {
        broadcastserverMatterbridge.respond({ ...msg, result: { data: { matterbridgeVersion: '1.0.0', logLevel: LogLevel.ERROR } as any, success: true } });
      }
    });
    broadcastserverPlugins = new BroadcastServer('plugins', log);
    broadcastserverPlugins.on('broadcast_message', (msg: WorkerMessage) => {
      if (broadcastserverPlugins.isWorkerRequest(msg) && msg.type === 'plugins_apipluginarray') {
        broadcastserverPlugins.respond({ ...msg, result: { plugins: [] } });
      }
    });
  });

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {});

  afterAll(async () => {
    // Close broadcast servers
    broadcastserverMatterbridge.close();
    broadcastserverPlugins.close();
    // Destroy ThreadsManager instance
    manager.destroy();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Run GlobalPrefix in the main thread', async () => {
    expect(await manager.runInMainThread('GlobalPrefix')).toBe(true);
  }, 10000);
});
