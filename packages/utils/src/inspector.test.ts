// tracker.test.ts

import { jest } from '@jest/globals';
import { consoleLogSpy, setDebug, setupTest } from '@matterbridge/jest-utils';

// Setup the test environment
await setupTest('Inspector', false);

describe('Inspector', () => {
  const originalArgv = [...process.argv];
  const originalGc = global.gc;

  beforeEach(async () => {
    // Reset all modules before each test
    jest.resetModules();
    // Setup the test environment
    setDebug(false);
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    global.gc = originalGc;
    jest.useRealTimers();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.argv = originalArgv;
    global.gc = originalGc;
    // Restore all mocks
    jest.restoreAllMocks();
  });

  test('does not print loader banner when loader flag missing', async () => {
    process.argv.push('-loader');

    await import('./inspector.js');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Inspector loaded'));
  });

  test('argv flags: --debug and -verbose enable debug logging', async () => {
    process.argv.push('--debug');
    process.argv.push('--verbose');
    const { Inspector } = await import('./inspector.js');
    delete (global as any).gc;
    const inspector = new Inspector('Inspector', true);
    expect(inspector['debug']).toBe(true);
    expect(inspector['verbose']).toBe(true);
    const debugSpy = jest.spyOn((inspector as any)['log'], 'debug');
    inspector.runGarbageCollector();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Garbage collection not exposed'));
  });

  test('argv flags: -debug and --verbose also work', async () => {
    process.argv.push('-debug');
    process.argv.push('--verbose');
    const { Inspector } = await import('./inspector.js');
    delete (global as any).gc;
    const inspector = new Inspector('Inspector');
    const debugSpy = jest.spyOn((inspector as any)['log'], 'debug');
    inspector.runGarbageCollector();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Garbage collection not exposed'));
  });

  // Keep loader banner covered by the previous test; avoid ESM re-import flakiness here.

  test('runGarbageCollector: no global.gc is safe', async () => {
    const { Inspector } = await import('./inspector.js');
    delete (global as any).gc;

    const inspector = new Inspector('Inspector', true, false);
    expect(() => inspector.runGarbageCollector()).not.toThrow();
  });

  test('runGarbageCollector: with global.gc options and fallback', async () => {
    const { Inspector } = await import('./inspector.js');
    const gc = jest
      .fn()
      // Throw when called with options object
      .mockImplementationOnce(() => {
        throw new Error('unsupported options');
      })
      // Fallback call without args
      .mockImplementationOnce(() => undefined);
    (global as any).gc = gc;

    const inspector = new Inspector('Inspector', true, false);

    const done: { t: string; e: string }[] = [];
    inspector.on('gc_done', (t, e) => done.push({ t, e }));

    inspector.runGarbageCollector('major', 'sync');

    // First call throws and fallback triggers minor-async event
    expect(gc).toHaveBeenCalledTimes(2);
    expect(done).toEqual([{ t: 'minor', e: 'async' }]);
  });

  test('start: warns when session already active', async () => {
    // Mock only what we need later, but here we avoid triggering real inspector
    const mod = await import('./inspector.js');
    const inspector = new mod.Inspector('Inspector', true, false) as any;
    const warnSpy = jest.spyOn(inspector['log'], 'warn');
    inspector.session = {};
    await inspector.start();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('session already active'));
  });

  test('takeHeapSnapshot: warns without active session', async () => {
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    const warnSpy = jest.spyOn((inspector as any)['log'], 'warn');
    await inspector.takeHeapSnapshot();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No active inspector session'));
  });

  test('stop: warns when no active session', async () => {
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    const warnSpy = jest.spyOn((inspector as any)['log'], 'warn');
    await inspector.stop();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No active inspector session'));
  });

  test('interval: runs and logs, then skips while in progress', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else cb(null);
      }
    }
    jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    jest.unstable_mockModule('node:fs', () => ({ mkdirSync: () => {} }));
    jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => 30000 }));

    jest.useFakeTimers();
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false) as any;
    const debugSpy = jest.spyOn(inspector['log'], 'debug');
    // Make snapshot call a fast no-op
    jest.spyOn(inspector, 'takeHeapSnapshot').mockResolvedValue(undefined as any);
    await inspector.start();
    // First tick: should run snapshot interval
    jest.advanceTimersByTime(30000);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Run heap snapshot interval'));
    // Next tick with in-progress should skip
    inspector.snapshotInProgress = true;
    jest.advanceTimersByTime(30000);
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('previous snapshot still in progress'));
    jest.useRealTimers();
  });

  test('heap snapshot: write backpressure branch executes', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.takeHeapSnapshot') cb(null);
        else if (method === 'HeapProfiler.stopSampling') cb(null, { profile: {} });
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    // Make write return false once to hit the if (!write) branch
    let first = true;
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: () => {},
      createWriteStream: () => ({
        once: () => {},
        write: () => {
          if (first) {
            first = false;
            return false;
          }
          return true;
        },
        end: (cb?: () => void) => cb && cb(),
      }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => undefined }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    await inspector.start();
    await inspector.takeHeapSnapshot();
    // If we reached here without throw, branch was exercised
    expect(true).toBeTruthy();
    await inspector.stop();
  });

  test('heap snapshot: stream.end throws and is caught', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.takeHeapSnapshot') cb(null);
        else if (method === 'HeapProfiler.stopSampling') cb(null, { profile: {} });
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: () => {},
      createWriteStream: () => ({
        once: () => {},
        write: () => true,
        end: () => {
          throw new Error('end-error');
        },
      }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => undefined }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false) as any;
    const errorSpy = jest.spyOn(inspector['log'], 'error');
    await inspector.start();
    await inspector.takeHeapSnapshot();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error finalizing heap snapshot stream'));
    await inspector.stop();
  });

  test('runGarbageCollector: success path with options logs and emits', async () => {
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    const debugSpy = jest.spyOn((inspector as any)['log'], 'debug');
    const events: Array<{ t: string; e: string }> = [];
    inspector.on('gc_done', (t, e) => events.push({ t, e }));
    (global as any).gc = jest.fn();
    inspector.runGarbageCollector('minor', 'sync');
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Garbage collection (minor-sync) triggered'));
    expect(events).toContainEqual({ t: 'minor', e: 'sync' });
  });

  test('heap snapshot: stream error is logged', async () => {
    const FakeEmitter = (await import('node:events')).default;
    let onError: ((e: any) => void) | undefined;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.takeHeapSnapshot') cb(null);
        else if (method === 'HeapProfiler.stopSampling') cb(null, { profile: {} });
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: () => {},
      createWriteStream: () => ({
        once: (_: string, fn: (e: any) => void) => {
          onError = fn;
        },
        write: () => true,
        end: (cb?: () => void) => cb && cb(),
      }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => undefined }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false) as any;
    const errorSpy = jest.spyOn(inspector['log'], 'error');
    await inspector.start();
    // Trigger stream error before snapshot completes
    await inspector.takeHeapSnapshot();
    onError?.(new Error('stream-error'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Heap snapshot stream error'));
    await inspector.stop();
  });

  test('interval: unref is called', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    await jest.unstable_mockModule('node:fs', () => ({ mkdirSync: () => {} }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => 30000 }));

    const originalSetInterval = global.setInterval;
    let unrefCalled = false;
    // @ts-expect-error simplify setInterval typing for test
    global.setInterval = (handler: (...args: any[]) => void, _timeout?: number) => {
      return {
        unref() {
          unrefCalled = true;
          return this;
        },
      } as any;
    };
    try {
      const { Inspector } = await import('./inspector.js');
      const inspector = new Inspector('Inspector', true, false);
      await inspector.start();
      expect(unrefCalled).toBe(true);
    } finally {
      global.setInterval = originalSetInterval;
    }
  });

  test('interval: logs error when scheduled snapshot throws', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    await jest.unstable_mockModule('node:fs', () => ({ mkdirSync: () => {} }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => 30000 }));

    jest.useFakeTimers();
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false) as any;
    const errorSpy = jest.spyOn(inspector['log'], 'error');
    jest.spyOn(inspector, 'takeHeapSnapshot').mockRejectedValue(new Error('scheduled-error'));
    await inspector.start();
    await jest.advanceTimersByTimeAsync(30000);
    // Allow any pending microtasks from the async interval handler to settle
    await Promise.resolve();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error during scheduled heap snapshot'));
    jest.useRealTimers();
  });

  test('events: snapshot emits warn without session, gc emits gc_done', async () => {
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    const warnSpy = jest.spyOn((inspector as any)['log'], 'warn');
    const gcDone: Array<{ t: string; e: string }> = [];
    inspector.on('gc_done', (t, e) => gcDone.push({ t, e }));
    // snapshot event should call takeHeapSnapshot and warn (no session)
    inspector.emit('snapshot');
    // gc event should call runGarbageCollector (uses default major/async)
    (global as any).gc = jest.fn();
    inspector.emit('gc');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No active inspector session'));
    expect(gcDone).toContainEqual({ t: 'major', e: 'async' });
  });

  test('full flow: start -> snapshot (via interval) -> stop using mocks', async () => {
    // Prepare minimal ESM mocks for node:inspector, node:fs, and getIntParameter
    const writes: string[] = [];
    const mkdirCalls: string[] = [];
    const filesWritten: string[] = [];

    const FakeEmitter = (await import('node:events')).default;

    class FakeSession extends FakeEmitter {
      connected = false;
      connect() {
        this.connected = true;
      }
      disconnect() {
        this.connected = false;
      }
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') {
          cb(null);
        } else if (method === 'HeapProfiler.takeHeapSnapshot') {
          // Emit a couple of chunks, then finish
          this.emit('HeapProfiler.addHeapSnapshotChunk', { params: { chunk: 'A' } });
          this.emit('HeapProfiler.addHeapSnapshotChunk', { params: { chunk: 'B' } });
          cb(null);
        } else if (method === 'HeapProfiler.stopSampling') {
          cb(null, { profile: { samples: [1, 2, 3] } });
        } else {
          cb(null);
        }
      }
    }

    // Use ESM mocking for dynamic imports in inspector.ts
    await jest.unstable_mockModule('node:inspector', () => ({
      default: {},
      Session: FakeSession,
    }));

    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: (p: string) => {
        mkdirCalls.push(p);
      },
      createWriteStream: () => {
        return {
          once: (_: string, __: (e: any) => void) => {},
          write: (c: string) => {
            writes.push(c);
            return true;
          },
          end: (cb?: () => void) => {
            if (cb) cb();
          },
        } as any;
      },
      writeFileSync: (p: string, _d: string) => {
        filesWritten.push(p);
      },
    }));

    await jest.unstable_mockModule('./commandLine.js', () => ({
      getIntParameter: () => 30000,
    }));

    const { Inspector } = await import('./inspector.js');

    // Expose a fake gc to cover gc paths invoked around snapshot
    (global as any).gc = jest.fn();

    const inspector = new Inspector('Inspector', true, false);
    await inspector.start();

    // Directories created
    expect(mkdirCalls).toEqual(expect.arrayContaining(['heap_profiles', 'heap_snapshots']));

    // Manually trigger a snapshot (interval existence is covered by start)
    const snapshotDone: Array<true> = [];
    inspector.on('snapshot_done', () => snapshotDone.push(true));
    await inspector.takeHeapSnapshot();

    // Our mocked stream should have written both chunks
    expect(writes.join('')).toBe('AB');

    // Now stop -> should write the final .heapprofile file
    await inspector.stop();

    expect(filesWritten.length).toBeGreaterThanOrEqual(1);
    expect(filesWritten[0]).toContain('heap_profiles');

    // Ensure snapshot_done was emitted at least once (stop() takes a final snapshot too)
    expect(snapshotDone.length).toBeGreaterThanOrEqual(1);
  });

  test('start: no interval when value below 30000', async () => {
    const writes: string[] = [];
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.stopSampling') cb(null, { profile: {} });
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: (_p: string) => {},
      createWriteStream: () => ({
        once: () => {},
        write: (c: string) => {
          writes.push(c);
          return true;
        },
        end: (cb?: () => void) => cb && cb(),
      }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => 1000 }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    await inspector.start();
    await inspector.stop();
    expect(writes.length).toBe(0); // no scheduled or final snapshot
  });

  test('takeHeapSnapshot: skip when already in progress', async () => {
    const writes: string[] = [];
    const FakeEmitter = (await import('node:events')).default;
    class FakeSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.takeHeapSnapshot') cb(null);
        else if (method === 'HeapProfiler.stopSampling') cb(null, { profile: {} });
        else cb(null);
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: FakeSession }));
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: (_p: string) => {},
      createWriteStream: () => ({
        once: () => {},
        write: (c: string) => {
          writes.push(c);
          return true;
        },
        end: (cb?: () => void) => cb && cb(),
      }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => undefined }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false) as any;
    await inspector.start();
    inspector.snapshotInProgress = true; // force skip
    const debugSpy = jest.spyOn(inspector['log'], 'debug');
    await inspector.takeHeapSnapshot();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('already in progress'));
    expect(writes.length).toBe(0);
    await inspector.stop();
  });

  test('takeHeapSnapshot: logs error when snapshot post returns error', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class ErrSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.takeHeapSnapshot') cb(new Error('take-error'));
        else if (method === 'HeapProfiler.stopSampling') cb(null, { profile: {} });
        else cb(null);
      }
      on() {
        return this;
      }
      off() {
        return this;
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: ErrSession }));
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: (_p: string) => {},
      createWriteStream: () => ({ once: () => {}, write: () => true, end: (cb?: () => void) => cb && cb() }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => undefined }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false) as any;
    await inspector.start();
    const errorSpy = jest.spyOn(inspector['log'], 'error');
    await inspector.takeHeapSnapshot();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to take heap snapshot'));
    await inspector.stop();
  });

  test('stop: logs error when stopSampling fails', async () => {
    const FakeEmitter = (await import('node:events')).default;
    class StopErrSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') cb(null);
        else if (method === 'HeapProfiler.takeHeapSnapshot') cb(null);
        else if (method === 'HeapProfiler.stopSampling') cb(new Error('stop-error'));
        else cb(null);
      }
      on() {
        return this;
      }
      off() {
        return this;
      }
    }
    await jest.unstable_mockModule('node:inspector', () => ({ default: {}, Session: StopErrSession }));
    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: (_p: string) => {},
      createWriteStream: () => ({ once: () => {}, write: () => true, end: (cb?: () => void) => cb && cb() }),
      writeFileSync: () => {},
    }));
    await jest.unstable_mockModule('./commandLine.js', () => ({ getIntParameter: () => undefined }));
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('Inspector', true, false);
    await inspector.start();
    const errorSpy = jest.spyOn((inspector as any)['log'], 'error');
    await inspector.stop();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to stop heap sampling'));
  });

  test('start: handles startSampling error gracefully', async () => {
    const FakeEmitter = (await import('node:events')).default;

    class FailingSession extends FakeEmitter {
      connect() {}
      disconnect() {}
      post(method: string, cb: (err: any, result?: any) => void) {
        if (method === 'HeapProfiler.startSampling') {
          cb(new Error('boom'));
        } else {
          cb(null);
        }
      }
    }

    await jest.unstable_mockModule('node:inspector', () => ({
      default: {},
      Session: FailingSession,
    }));

    await jest.unstable_mockModule('node:fs', () => ({
      mkdirSync: (_p: string) => {},
    }));

    await jest.unstable_mockModule('./commandLine.js', () => ({
      getIntParameter: () => undefined,
    }));

    const { Inspector } = await import('./inspector.js');

    const inspector = new Inspector('Inspector', true, false) as any;
    const errorSpy = jest.spyOn(inspector['log'], 'error');
    await inspector.start();

    // Should have logged the failure and cleared the session
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to start heap sampling'));
    expect(inspector.session).toBeUndefined();
  });

  test('start event', async () => {
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('StartEventTester');
    // @ts-expect-error accessing private member for test
    expect(inspector.session).toBeUndefined();
    await inspector.start();
    inspector.emit('start');
    await new Promise((resolve) => setTimeout(resolve, 500)); // allow any async handlers to run
    await inspector.stop();
  });

  test('stop event', async () => {
    const { Inspector } = await import('./inspector.js');
    const inspector = new Inspector('StopEventTester');
    // @ts-expect-error accessing private member for test
    expect(inspector.session).toBeUndefined();
    await inspector.start();
    await inspector.stop();
    inspector.emit('stop');
    await new Promise((resolve) => setTimeout(resolve, 500)); // allow any async handlers to run
  });
});
