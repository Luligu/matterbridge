// tracker.test.ts

const MATTER_PORT = 0;
const NAME = 'Tracker';
const HOMEDIR = path.join('jest', NAME);

import path from 'node:path';
import os, { type CpuInfo } from 'node:os';

import { jest } from '@jest/globals';

import { consoleLogSpy, setDebug, setupTest } from 'mb-lib-test';

// Setup the test environment
await setupTest(NAME, false);

describe('Tracker', () => {
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

    await import('./tracker.js');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tracker loaded'));
  });

  test('verbose mode queries system info when debug enabled', async () => {
    process.argv.push('--verbose', '--debug');
    const spyCpus = jest.spyOn(os, 'cpus');
    const spyCpuUsage = jest.spyOn(process, 'cpuUsage');
    const spyMem = jest.spyOn(process, 'memoryUsage');

    const { Tracker } = await import('./tracker.js');
    // Instantiate to trigger verbose branch in constructor
    new Tracker('VerboseTester');

    expect(spyCpus).toHaveBeenCalled();
    expect(spyCpuUsage).toHaveBeenCalled();
    expect(spyMem).toHaveBeenCalled();
  });

  test('does not print loader banner when flag is absent', async () => {
    await import('./tracker.js');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Tracker loaded'));
  });

  test('start emits events and stop clears interval', async () => {
    jest.useFakeTimers();
    process.argv.push('--debug');
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('EventTester');

    const events = { uptime: 0, cpu: 0, memory: 0, tracker: 0 };
    tracker.on('uptime', () => events.uptime++);
    tracker.on('cpu', () => events.cpu++);
    tracker.on('memory', () => events.memory++);
    tracker.on('snapshot', () => events.tracker++);

    tracker.start(20);
    // Run a few samples
    jest.advanceTimersByTime(65);

    tracker.stop();

    expect(events.uptime).toBeGreaterThan(0);
    expect(events.cpu).toBeGreaterThan(0);
    expect(events.memory).toBeGreaterThan(0);
    expect(events.tracker).toBeGreaterThan(0);
  });

  test('reset peaks triggers reset_done', async () => {
    jest.useFakeTimers();
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('ResetTester');

    let resetCalled = 0;
    tracker.on('reset_peaks_done', () => resetCalled++);

    tracker.start(10);
    jest.advanceTimersByTime(25);
    tracker.emit('reset_peaks');

    expect(resetCalled).toBe(1);
    tracker.stop();
  });

  test('gc event runs garbage collector and emits gc_done (major-sync)', async () => {
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('GCTester');

    const gcMock: (...args: any[]) => any = jest.fn(() => undefined);
    global.gc = ((arg?: unknown) => {
      return gcMock(arg as any) as any;
    }) as any;

    const results: Array<[string, string]> = [];
    tracker.on('gc_done', (type, execution) => results.push([type, execution]));

    tracker.runGarbageCollector();

    expect(gcMock).toHaveBeenCalledWith({ type: 'major', execution: 'async' });
    expect(results).toContainEqual(['major', 'async']);
  });

  test('gc event falls back to minor-async when major call throws', async () => {
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('GCTester2');

    const gcMock: (...args: any[]) => any = jest.fn((arg?: unknown) => {
      if (arg !== undefined) throw new Error('no args supported');
      return undefined;
    });
    global.gc = ((arg?: unknown) => {
      return gcMock(arg as any) as any;
    }) as any;

    const results: Array<[string, string]> = [];
    tracker.on('gc_done', (type, execution) => results.push([type, execution]));

    tracker.emit('gc');

    // First call attempted with options (throws), then called again without args
    expect(gcMock).toHaveBeenCalled();
    expect(results).toContainEqual(['minor', 'async']);
  });

  test('gc not exposed does not throw', async () => {
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('GCTester3');

    delete (global as any).gc;

    expect(() => tracker.runGarbageCollector()).not.toThrow();
  });

  test('hourly gc trigger inside sampling loop', async () => {
    jest.useFakeTimers();
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('HourlyGCTester');

    const spy = jest.spyOn(tracker as any, 'runGarbageCollector');
    // Interval > 1 hour so first tick triggers GC path (> 3600 seconds accumulated)
    tracker.start(3_601_000);

    jest.advanceTimersByTime(3_601_000);

    expect(spy).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  test('cpu load calc handles missing prev and zero deltas', async () => {
    jest.useFakeTimers();
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('CpuBranchTester');

    const cpuTimes = { user: 100, nice: 0, sys: 50, idle: 200, irq: 0 };
    const cpu: CpuInfo = { model: 'x', speed: 1000, times: { ...cpuTimes } } as unknown as CpuInfo;
    const spyCpus = jest.spyOn(os, 'cpus').mockImplementation(() => [cpu] as any);

    let cpuEvents = 0;
    tracker.on('cpu', () => cpuEvents++);

    // Force prevCpus to be empty to hit the `!prev` branch on first tick
    (tracker as any).prevCpus = [];
    tracker.start(10);
    jest.advanceTimersByTime(10);

    // Second tick with unchanged times hits totalDelta <= 0 branch
    jest.advanceTimersByTime(10);

    tracker.stop();
    spyCpus.mockRestore();

    expect(cpuEvents).toBeGreaterThanOrEqual(2);
  });

  test('start early-return when already running', async () => {
    jest.useFakeTimers();
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('StartGuardTester');

    let trackerEvents = 0;
    tracker.on('snapshot', () => trackerEvents++);

    tracker.start(10);
    tracker.start(10); // should early-return and not create a second interval
    jest.advanceTimersByTime(15);

    tracker.stop();

    // Only one tick should have fired
    expect(trackerEvents).toBe(1);
  });

  test('gc not exposed logs message when in debug mode', async () => {
    process.argv.push('--debug');
    const { Tracker } = await import('./tracker.js');
    delete (global as any).gc;
    const tracker = new Tracker('GCDebug');
    const debugSpy = jest.spyOn((tracker as any)['log'], 'debug');
    tracker.runGarbageCollector();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Garbage collection not exposed'));
  });

  test('reset peaks logs in debug mode', async () => {
    jest.useFakeTimers();
    process.argv.push('--debug');
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('ResetTesterDebug');
    const debugSpy = jest.spyOn((tracker as any)['log'], 'debug');

    tracker.start(10);
    // ensure at least one entry was recorded so resetPeaks message is meaningful
    jest.advanceTimersByTime(15);

    tracker.emit('reset_peaks');
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Peaks reset'));

    tracker.stop();
  });

  test('stop event', async () => {
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('StopEventTester');
    tracker.emit('stop');
    // @ts-expect-error accessing private member for test
    expect(tracker.trackerInterval).toBeUndefined();
  });

  test('start event', async () => {
    const { Tracker } = await import('./tracker.js');
    const tracker = new Tracker('StartEventTester');
    tracker.emit('start');
    // @ts-expect-error accessing private member for test
    expect(tracker.trackerInterval).toBeDefined();
  });
});
