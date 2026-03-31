// src\backendWsServer.test.ts

const MATTER_PORT = 9300;
const FRONTEND_PORT = 8287;
const NAME = 'BackendWsServer';
const HOMEDIR = path.join('.cache', 'jest', NAME);

process.argv = [
  'node',
  'backendWsServer.test.js',
  '--novirtual',
  '--test',
  '--homedir',
  HOMEDIR,
  '--frontend',
  FRONTEND_PORT.toString(),
  '--port',
  MATTER_PORT.toString(),
  '--logger',
  'debug',
  '--debug-frontend',
  '--verbose-frontend',
];

import path from 'node:path';

import { jest } from '@jest/globals';
import type { SharedMatterbridge } from '@matterbridge/types';
import { LogLevel } from 'node-ansi-logger';

import { FrontendsWsServer } from './backendWsServer.js';
import type { Frontend } from './frontend.js';
import { broadcastServerIsWorkerRequestSpy, setupTest } from './jestutils/jestHelpers.js';

const mockedSharedMatterbridge = {
  //
} as unknown as SharedMatterbridge;

const mockedBackend = {
  emit: jest.fn(),
} as unknown as Frontend;

// Setup the test environment
await setupTest(NAME, false);

describe('BackendWsServer', () => {
  let wsServer: FrontendsWsServer;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('Constructor', () => {
    wsServer = new FrontendsWsServer(mockedSharedMatterbridge, mockedBackend);
    expect(wsServer).toBeInstanceOf(FrontendsWsServer);
  });

  test('BroadcastServer handler', async () => {
    broadcastServerIsWorkerRequestSpy.mockReturnValue(true);
    await (wsServer as any).broadcastMsgHandler({ id: 123456, type: 'get_log_level', src: 'manager', dst: 'frontend' });
    await (wsServer as any).broadcastMsgHandler({ id: 123456, type: 'set_log_level', src: 'manager', dst: 'frontend', params: { logLevel: LogLevel.DEBUG } });
    expect((wsServer as any).log.logLevel).toBe(LogLevel.DEBUG);
  });

  test('Start', async () => {
    await wsServer.start();
  });

  test('Stop', async () => {
    await wsServer.stop();
  });

  test('Destroy', async () => {
    wsServer.destroy();
  });
});
