// src\cli.test.ts
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
process.argv = ['node', './cli.js', '-memorycheck', '-inspect', '-frontend', '0', '-profile', 'JestCli', '-debug', '-logger', 'debug', '-matterlogger', 'debug'];

import { jest } from '@jest/globals';
import { AnsiLogger, BRIGHT, LogLevel, YELLOW } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
import { MockMatterbridge } from './mock/mockMatterbridge.js';

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
  loggerLogSpy = jest.spyOn(console, 'log');
  // Spy on console.debug
  consoleDebugSpy = jest.spyOn(console, 'debug');
  // Spy on console.info
  consoleInfoSpy = jest.spyOn(console, 'info');
  // Spy on console.warn
  consoleWarnSpy = jest.spyOn(console, 'warn');
  // Spy on console.error
  consoleErrorSpy = jest.spyOn(console, 'error');
}

const loadInstance = jest.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  console.log('mockImplementation of Matterbridge.loadInstance() called');
  return MockMatterbridge.loadInstance() as unknown as Matterbridge;
});

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  console.log('mockImplementation of process.exit() called');
  return undefined as never;
});

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeAll(async () => {
    //
  });

  beforeEach(async () => {
    //
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should start matterbridge', async () => {
    expect(loggerLogSpy).toHaveBeenCalledTimes(0);
    expect(loadInstance).toHaveBeenCalledTimes(0);

    // Dynamically import the cli module
    const cli = await import('./cli.js');
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(cli.instance).toBeDefined();
    expect(cli.instance).toBeInstanceOf(MockMatterbridge);
    matterbridge = cli.instance as unknown as Matterbridge;

    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cli main() started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Starting heap sampling...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Started heap sampling');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) called');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) exited');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`***${YELLOW}${BRIGHT}Cpu usage:`));
  }, 10000);

  it('should shutdown matterbridge', async () => {
    jest.clearAllMocks();

    matterbridge.emit('shutdown');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received shutdown event, exiting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Stopping heap sampling...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Heap sampling profile saved to Heap-sampling-profile.heapprofile');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Stopped heap sampling');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cpu memory check stopped.'));
    expect(exit).toHaveBeenCalled();
  }, 10000);

  it('should start memory check', async () => {
    jest.clearAllMocks();

    matterbridge.emit('startmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received start memory check event');
    expect(exit).not.toHaveBeenCalled();
  }, 10000);

  it('should stop memory check', async () => {
    jest.clearAllMocks();

    matterbridge.emit('stopmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received stop memory check event');
    expect(exit).not.toHaveBeenCalled();
  }, 10000);

  it('should restart matterbridge', async () => {
    jest.clearAllMocks();

    matterbridge.emit('restart');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received restart event, loading...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  }, 60000);

  it('should update matterbridge', async () => {
    jest.clearAllMocks();

    matterbridge.emit('update');
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received update event, updating...');
    expect(loadInstance).toHaveBeenCalledTimes(1);

    matterbridge.emit('shutdown');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(exit).toHaveBeenCalled();
  }, 60000);
});
