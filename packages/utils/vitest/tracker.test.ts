/**
 * @file packages/utils/vitest/tracker.test.ts
 * @description This file contains the tests for tracker.
 * @author Luca Liguori
 */

import os, { type CpuInfo } from 'node:os';

import { consoleLogSpy, setDebug, setupTest } from './vitestSetupTest.js';

// Setup the test environment
await setupTest('Tracker', false);

describe('Tracker', () => {
  const originalArgv = [...process.argv];
  const originalGc = global.gc;

  beforeEach(async () => {
    // Reset all modules before each test
    vi.resetModules();
    vi.doUnmock('../src/runtimeBun.js');
    // Setup the test environment
    await setDebug(false);
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.argv = [...originalArgv];
    global.gc = originalGc;
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.doUnmock('../src/runtimeBun.js');
    // Restore all mocks
    vi.restoreAllMocks();
  });

  afterAll(() => {
    process.argv = originalArgv;
    global.gc = originalGc;
    vi.doUnmock('../src/runtimeBun.js');
    // Restore all mocks
    vi.restoreAllMocks();
  });

  test.each([
    { name: 'valid footprint', bun: { unsafe: { memoryFootprint: (): number => 123 } }, expected: 123 },
    { name: 'missing footprint API', bun: {}, expected: 456 },
  ])('should safely sample Bun memory with $name', async ({ bun, expected }) => {
    vi.useFakeTimers();
    vi.stubGlobal('Bun', bun);
    vi.spyOn(process, 'memoryUsage').mockReturnValue({ rss: 456, heapUsed: 1, heapTotal: 2, external: 3, arrayBuffers: 4 });
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('BunMemory');
    const memorySpy = vi.fn();
    const snapshotSpy = vi.fn();
    tracker.on('memory', memorySpy);
    tracker.on('snapshot', snapshotSpy);
    tracker.start(20);
    vi.advanceTimersByTime(20);
    tracker.stop();
    expect(memorySpy).toHaveBeenCalledWith(expect.any(Number), expect.any(Number), expected, 1, 2, 3, 4);
    expect(snapshotSpy).toHaveBeenCalledWith(expect.objectContaining({ rss: expected, peakRss: expected }));
  });

  test('should log increasing and unchanged memory and CPU peaks in debug mode', async () => {
    vi.useFakeTimers();
    const cpu = (user: number): CpuInfo => ({ model: 'test', speed: 1, times: { user, nice: 0, sys: 0, idle: 0, irq: 0 } });
    vi.spyOn(os, 'cpus')
      .mockReturnValueOnce([cpu(0)])
      .mockReturnValueOnce([cpu(100)])
      .mockReturnValue([cpu(200)]);
    vi.spyOn(process, 'memoryUsage').mockReturnValue({ rss: 1000, heapUsed: 1000, heapTotal: 1000, external: 1000, arrayBuffers: 1000 });
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('DebugPeaks', true);
    const debugSpy = vi.spyOn(tracker['log'], 'debug');
    tracker.start(20);
    vi.advanceTimersByTime(40);
    tracker.stop();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('rss:'));
  });

  test('does not print loader banner when loader flag missing', async () => {
    process.argv.push('--loader');

    await import('../src/tracker.js');

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Tracker loaded'));
  });

  test('verbose mode queries system info when debug enabled', async () => {
    process.argv.push('--verbose', '--debug');
    const spyCpus = vi.spyOn(os, 'cpus');
    const spyCpuUsage = vi.spyOn(process, 'cpuUsage');
    const spyMem = vi.spyOn(process, 'memoryUsage');

    const { Tracker } = await import('../src/tracker.js');
    // Instantiate to trigger verbose branch in constructor
    new Tracker('VerboseTester');

    expect(spyCpus).toHaveBeenCalled();
    expect(spyCpuUsage).toHaveBeenCalled();
    expect(spyMem).toHaveBeenCalled();
  });

  test('single-dash debug and verbose flags do not enable verbose mode', async () => {
    process.argv.push('-verbose', '-debug');
    const spyMem = vi.spyOn(process, 'memoryUsage');

    const { Tracker } = await import('../src/tracker.js');
    new Tracker('SingleDashTester');

    expect(spyMem).not.toHaveBeenCalled();
  });

  test('does not print loader banner when flag is absent', async () => {
    await import('../src/tracker.js');
    expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Tracker loaded'));
  });

  test('start emits events and stop clears interval', async () => {
    vi.useFakeTimers();
    process.argv.push('--debug');
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('EventTester');

    const events = { uptime: 0, cpu: 0, memory: 0, tracker: 0 };
    tracker.on('uptime', () => events.uptime++);
    tracker.on('cpu', () => events.cpu++);
    tracker.on('memory', () => events.memory++);
    tracker.on('snapshot', () => events.tracker++);

    tracker.start(20);
    // Run a few samples
    vi.advanceTimersByTime(65);

    tracker.stop();

    expect(events.uptime).toBeGreaterThan(0);
    expect(events.cpu).toBeGreaterThan(0);
    expect(events.memory).toBeGreaterThan(0);
    expect(events.tracker).toBeGreaterThan(0);
  });

  test('constructor tracker flag does not enable sample debug output without debug flag', async () => {
    vi.useFakeTimers();
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('TrackerFlagTester', false, false, true);
    const debugSpy = vi.spyOn((tracker as any)['log'], 'debug');

    tracker.start(10);
    vi.advanceTimersByTime(10);
    tracker.stop();

    expect(debugSpy).not.toHaveBeenCalledWith(expect.stringContaining('Time: '));
  });

  test('tracker argv flag enables tracker mode', async () => {
    process.argv.push('--tracker');
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('TrackerArgvTester');

    expect((tracker as any)['tracker']).toBe(true);
  });

  test('reset peaks triggers reset_done', async () => {
    vi.useFakeTimers();
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker();

    let resetCalled = 0;
    tracker.on('reset_peaks_done', () => resetCalled++);

    tracker.start(10);
    vi.advanceTimersByTime(25);
    tracker.emit('reset_peaks');

    expect(resetCalled).toBe(1);
    tracker.stop();
  });

  test.each([false, true])('gc event runs garbage collector and emits gc_done (major-sync) with debug=%s', async (debug) => {
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('GCTester', debug);

    const gcMock = vi.fn<(...args: any[]) => any>(() => {});
    global.gc = ((arg?: unknown) => {
      return gcMock(arg as any);
    }) as any;

    const results: Array<[string, string]> = [];
    tracker.on('gc_done', (type, execution) => results.push([type, execution]));

    tracker.runGarbageCollector();

    expect(gcMock).toHaveBeenCalledWith({ type: 'major', execution: 'async' });
    expect(results).toContainEqual(['major', 'async']);
  });

  test.each([false, true])('gc event falls back to minor-async when major call throws with debug=%s', async (debug) => {
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('GCTester2', debug);

    const gcMock = vi.fn<(...args: any[]) => any>((arg?: unknown) => {
      if (arg !== undefined) throw new Error('no args supported');
      return;
    });
    global.gc = ((arg?: unknown) => {
      return gcMock(arg as any);
    }) as any;

    const results: Array<[string, string]> = [];
    tracker.on('gc_done', (type, execution) => results.push([type, execution]));

    tracker.emit('gc');

    // First call attempted with options (throws), then called again without args
    expect(gcMock).toHaveBeenCalled();
    expect(results).toContainEqual(['minor', 'async']);
  });

  test.each([false, true])('gc not exposed does not throw with debug=%s', async (debug) => {
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('GCTester3', debug);

    delete (global as any).gc;

    expect(() => tracker.runGarbageCollector()).not.toThrow();
  });

  test.each([false, true])('gc uses Bun garbage collector when running on Bun with debug=%s', async (debug) => {
    const bunGcMock = vi.fn();
    const setGcLevelMock = vi.fn();
    vi.doMock('../src/runtimeBun.js', () => ({
      gc: bunGcMock,
      isBun: vi.fn(() => true),
      setGcLevel: setGcLevelMock,
    }));

    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('BunGCTester', debug);

    const results: Array<[string, string]> = [];
    tracker.on('gc_done', (type, execution) => results.push([type, execution]));

    tracker.runGarbageCollector('minor', 'sync');

    expect(setGcLevelMock).toHaveBeenCalledWith(2);
    expect(bunGcMock).toHaveBeenCalledWith(true);
    expect(bunGcMock).toHaveBeenCalledTimes(1);
    expect(results).toContainEqual(['minor', 'sync']);
  });

  test.each([false, true])('gc handles Bun garbage collector errors with debug=%s', async (debug) => {
    const bunGcMock = vi.fn(() => {
      throw new Error('bun gc failed');
    });
    vi.doMock('../src/runtimeBun.js', () => ({
      gc: bunGcMock,
      isBun: vi.fn(() => true),
      setGcLevel: vi.fn(),
    }));

    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('BunGCErrorTester', debug);

    let gcDoneCount = 0;
    tracker.on('gc_done', () => gcDoneCount++);

    expect(() => tracker.runGarbageCollector()).not.toThrow();
    expect(bunGcMock).toHaveBeenCalledTimes(1);
    expect(gcDoneCount).toBe(0);
  });

  test('hourly gc trigger inside sampling loop', async () => {
    vi.useFakeTimers();
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('HourlyGCTester');

    const spy = vi.spyOn(tracker as any, 'runGarbageCollector');
    // Interval > 1 hour so first tick triggers GC path (> 3600 seconds accumulated)
    tracker.start(3_601_000);

    vi.advanceTimersByTime(3_601_000);

    expect(spy).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  test('force-gc flag triggers gc inside sampling loop before hourly interval', async () => {
    vi.useFakeTimers();
    process.argv.push('--force-gc');
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('ForceGCTester');

    const spy = vi.spyOn(tracker as any, 'runGarbageCollector');
    tracker.start(10);

    vi.advanceTimersByTime(10);

    expect(spy).toHaveBeenCalledTimes(1);
    tracker.stop();
  });

  test('cpu load calc handles missing prev and zero deltas', async () => {
    vi.useFakeTimers();
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('CpuBranchTester');

    const cpuTimes = { user: 100, nice: 0, sys: 50, idle: 200, irq: 0 };
    const cpu: CpuInfo = { model: 'x', speed: 1000, times: { ...cpuTimes } };
    const spyCpus = vi.spyOn(os, 'cpus').mockImplementation(() => [cpu]);

    let cpuEvents = 0;
    tracker.on('cpu', () => cpuEvents++);

    // Force prevCpus to be empty to hit the `!prev` branch on first tick
    (tracker as any).prevCpus = [];
    tracker.start(10);
    vi.advanceTimersByTime(10);

    // Second tick with unchanged times hits totalDelta <= 0 branch
    vi.advanceTimersByTime(10);

    tracker.stop();
    spyCpus.mockRestore();

    expect(cpuEvents).toBeGreaterThanOrEqual(2);
  });

  test('start early-return when already running', async () => {
    vi.useFakeTimers();
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('StartGuardTester');

    let trackerEvents = 0;
    tracker.on('snapshot', () => trackerEvents++);

    tracker.start(10);
    tracker.start(10); // should early-return and not create a second interval
    vi.advanceTimersByTime(15);

    tracker.stop();

    // Only one tick should have fired
    expect(trackerEvents).toBe(1);
  });

  test('gc not exposed logs message when in debug mode', async () => {
    process.argv.push('--debug');
    const { Tracker } = await import('../src/tracker.js');
    delete (global as any).gc;
    const tracker = new Tracker('GCDebug');
    const debugSpy = vi.spyOn((tracker as any)['log'], 'debug');
    tracker.runGarbageCollector();
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Garbage collection not exposed'));
  });

  test('reset peaks logs in debug mode', async () => {
    vi.useFakeTimers();
    process.argv.push('--debug');
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('ResetTesterDebug');
    const debugSpy = vi.spyOn((tracker as any)['log'], 'debug');

    tracker.start(10);
    // ensure at least one entry was recorded so resetPeaks message is meaningful
    vi.advanceTimersByTime(15);

    tracker.emit('reset_peaks');
    expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Peaks reset'));

    tracker.stop();
  });

  test('stop event', async () => {
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('StopEventTester');
    tracker.emit('stop');
    // @ts-expect-error accessing private member for test
    expect(tracker.trackerInterval).toBeUndefined();
  });

  test('start event', async () => {
    const { Tracker } = await import('../src/tracker.js');
    const tracker = new Tracker('StartEventTester');
    tracker.emit('start');
    // @ts-expect-error accessing private member for test
    expect(tracker.trackerInterval).toBeDefined();
    // Clear the real (non-fake) interval started above so it does not keep the Jest worker alive.
    tracker.stop();
  });
});
