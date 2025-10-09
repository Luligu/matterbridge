// src\cli.test.ts

/* eslint-disable no-console */
const NAME = 'CliMain';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', './cli.js', '-trace', '-memorycheck', '-inspect', '-snapshotinterval', '60000', '-frontend', '0', '-profile', 'JestCli', '-debug', '-logger', 'debug', '-matterlogger', 'debug'];

import os from 'node:os';
import { HeapProfiler, InspectorNotification, Session } from 'node:inspector';
import path from 'node:path';

import { jest } from '@jest/globals';
import { BRIGHT, CYAN, db, LogLevel, YELLOW } from 'node-ansi-logger';

import { Matterbridge } from './matterbridge.js';
// eslint-disable-next-line n/no-missing-import
import { MockMatterbridge } from './mock/mockMatterbridge.js';
import { cliEmitter } from './cliEmitter.js';
import { loggerLogSpy, setupTest } from './utils/jestHelpers.js';

const loadInstance = jest.spyOn(Matterbridge, 'loadInstance').mockImplementation(async (_initialize?: boolean) => {
  // console.log('mockImplementation of Matterbridge.loadInstance() called');
  return MockMatterbridge.loadInstance() as unknown as Matterbridge; // Simulate a successful load by returning an instance of MockMatterbridge
});

const exit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  // console.log('mockImplementation of process.exit() called');
  return undefined as never; // Prevent actual exit during tests
});

const postSpy = jest.spyOn(Session.prototype, 'post').mockImplementation((method, callback?: (err: Error | null, params?: object) => void) => {
  // console.log(`mockImplementation of Session.post() called with method: ${method}`);
  if (typeof callback === 'function') {
    // console.log(`mockImplementation of Session.post() callback called with null`);
    callback(null, { profile: '' }); // call callback with no error
  }
});

// Setup the test environment
setupTest(NAME, false);

describe('Matterbridge', () => {
  let matterbridge: Matterbridge;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should start matterbridge', async () => {
    jest.useFakeTimers();
    // Dynamically import the cli module
    const cli = await import('./cli.js');
    await new Promise<void>((resolve) => {
      cliEmitter.once('ready', resolve);
    });
    expect(cli.instance).toBeDefined();
    expect(cli.instance).toBeInstanceOf(MockMatterbridge);
    matterbridge = cli.instance as unknown as Matterbridge;

    expect(loadInstance).toHaveBeenCalledTimes(1);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cli main() started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Cpu memory check started');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Starting heap sampling...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Started heap sampling');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `***Started heap snapshot interval of ${CYAN}60000${db} ms`);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) called');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Matterbridge.loadInstance(true) exited');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registering event handlers...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Registered event handlers');
  }, 10000);

  it('should call CpuMemoryCheck interval', async () => {
    jest.spyOn(os, 'totalmem').mockImplementationOnce(() => {
      console.log('mockImplementation of os.totalmem() called');
      return 1024;
    });
    jest.spyOn(os, 'freemem').mockImplementationOnce(() => {
      console.log('mockImplementation of os.freemem() called');
      return 512;
    });
    jest.spyOn(os, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of os.uptime() called');
      return 4000;
    });
    jest.spyOn(process, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of process.uptime() called');
      return 4000;
    });
    jest.spyOn(process, 'memoryUsage').mockImplementationOnce(() => {
      console.log('mockImplementation of process.memoryUsage() called');
      return {
        rss: 256,
        heapTotal: 128,
        heapUsed: 64,
        external: 32,
        arrayBuffers: 16,
      };
    });
    jest.advanceTimersByTime(10 * 1000); // Fast-forward time by 10 seconds
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`***${YELLOW}${BRIGHT}Host cpu:`));

    // Simulate different uptime values
    jest.clearAllMocks();
    jest.spyOn(os, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of os.uptime() called');
      return 90000;
    });
    jest.spyOn(process, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of process.uptime() called');
      return 90000;
    });
    jest.advanceTimersByTime(10 * 1000); // Fast-forward time by 10 seconds
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`***${YELLOW}${BRIGHT}Host cpu:`));

    jest.clearAllMocks();
    jest.spyOn(os, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of os.uptime() called');
      return 4000;
    });
    jest.spyOn(process, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of process.uptime() called');
      return 4000;
    });
    jest.advanceTimersByTime(10 * 1000); // Fast-forward time by 10 seconds
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`***${YELLOW}${BRIGHT}Host cpu:`));

    jest.clearAllMocks();
    jest.spyOn(os, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of os.uptime() called');
      return 70;
    });
    jest.spyOn(process, 'uptime').mockImplementationOnce(() => {
      console.log('mockImplementation of process.uptime() called');
      return 70;
    });
    jest.advanceTimersByTime(10 * 1000); // Fast-forward time by 10 seconds
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining(`***${YELLOW}${BRIGHT}Host cpu:`));

    // Simulate a failure in os.cpus()
    jest.clearAllMocks();
    jest.spyOn(os, 'cpus').mockImplementationOnce(() => {
      console.log('mockImplementation of os.cpus() called');
      return [];
    });
    jest.advanceTimersByTime(10 * 1000); // Fast-forward time by 10 seconds
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Cpu check length failed, resetting previous cpus`);
  });

  it('should call Inspector interval', async () => {
    console.log('should call Inspector interval');
    jest.clearAllMocks();
    jest.advanceTimersByTime(60 * 1000); // Fast-forward time by 60 seconds
    jest.useRealTimers();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, `Run heap snapshot interval`);
    expect(matterbridge).toBeDefined();
    matterbridge.emit('stopmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }, 10000);

  it('should shutdown matterbridge', async () => {
    matterbridge.emit('shutdown');
    await new Promise<void>((resolve) => {
      cliEmitter.once('shutdown', resolve);
    });

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received shutdown event, exiting...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Stopping heap sampling...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Clearing heap snapshot interval...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('***Heap sampling snapshot saved to'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('***Heap sampling profile saved to'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Stopped heap sampling');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Cpu memory check stopped.'));
    expect(exit).toHaveBeenCalled();
  }, 60000);

  it('should start memory check', async () => {
    matterbridge.emit('startmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received start memory check event');
    expect(exit).not.toHaveBeenCalled();
  }, 60000);

  it('should stop memory check', async () => {
    matterbridge.emit('stopmemorycheck');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received stop memory check event');
    expect(exit).not.toHaveBeenCalled();
  }, 60000);

  it('should not start inspector', async () => {
    const connectSpy = jest.spyOn(Session.prototype, 'connect').mockImplementationOnce(() => {
      throw new Error('connect throw an error');
    });
    matterbridge.emit('startinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('***Failed to start heap sampling'));
  }, 60000);

  it('should start inspector', async () => {
    matterbridge.emit('startinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Starting heap sampling...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('***Started heap sampling'));
  }, 60000);

  it('should call takeHeapSnapshot', async () => {
    const onSpy = jest.spyOn(Session.prototype, 'on').mockImplementationOnce(((event: 'HeapProfiler.addHeapSnapshotChunk', listener?: (message: InspectorNotification<HeapProfiler.AddHeapSnapshotChunkEventDataType>) => void) => {
      console.log(`mockImplementation of Session.on() called with event: ${event}`);
      if (typeof listener === 'function') {
        console.log(`mockImplementation of Session.on() listener called with null`);
        listener({ params: { chunk: 'chunk' } } as InspectorNotification<HeapProfiler.AddHeapSnapshotChunkEventDataType>); // call listener with no error
      }
    }) as any);

    const postSpy = jest.spyOn(Session.prototype, 'post').mockImplementationOnce((method, callback?: (err: Error | null, params?: object) => void) => {
      console.log(`mockImplementation of Session.post() called with method: ${method}`);
      if (typeof callback === 'function') {
        console.log(`mockImplementation of Session.post() callback called with null`);
        callback(new Error('post throw an error')); // call callback with error
      }
    });

    matterbridge.emit('takeheapsnapshot');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onSpy).toHaveBeenCalledWith('HeapProfiler.addHeapSnapshotChunk', expect.any(Function));
    expect(postSpy).toHaveBeenCalledWith('HeapProfiler.takeHeapSnapshot', expect.any(Function));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Taking heap snapshot...'));
  }, 60000);

  it('should stop inspector', async () => {
    matterbridge.emit('stopinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Stopping heap sampling...');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('***Heap sampling profile saved to'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Stopped heap sampling');
  }, 60000);

  it('should not stop inspector', async () => {
    matterbridge.emit('startinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));

    jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
      console.log('mockImplementation of JSON.stringify() called');
      throw new Error('stringify throw an error');
    });
    matterbridge.emit('stopinspector');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, '***Stopping heap sampling...');
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('***No active inspector session.'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.ERROR, expect.stringContaining('***Failed to stop heap sampling'));
  }, 60000);

  it('should call global.gc', async () => {
    const savedGc = global.gc; // Save the original global.gc function
    global.gc = jest.fn() as any; // Mock global.gc function
    matterbridge.emit('triggergarbagecollection');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Manual garbage collection triggered via global.gc().'));
    expect(global.gc).toHaveBeenCalled();
    global.gc = savedGc; // Restore the original global.gc function
  }, 60000);

  it('should not call global.gc', async () => {
    const savedGc = global.gc; // Save the original global.gc function
    global.gc = undefined; // Ensure global.gc is not defined
    matterbridge.emit('triggergarbagecollection');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, expect.stringContaining('Garbage collection is not exposed.'));
    expect(global.gc).toBeUndefined(); // Ensure global.gc is still undefined
    global.gc = savedGc; // Restore the original global.gc function
  }, 60000);

  it('should restart matterbridge', async () => {
    matterbridge.emit('restart');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received restart event, loading...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  }, 60000);

  it('should update matterbridge', async () => {
    matterbridge.emit('update');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.DEBUG, 'Received update event, updating...');
    expect(loadInstance).toHaveBeenCalledTimes(1);
  }, 60000);

  it('should shutdown again matterbridge', async () => {
    matterbridge.emit('shutdown');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(exit).toHaveBeenCalled();
  }, 60000);
});
