// vitest\threadsManager.test.ts

/* eslint-disable @typescript-eslint/no-non-null-assertion */

const NAME = 'ThreadsManager';

import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';

import { LogLevel } from 'node-ansi-logger';
import type { Mock } from 'vitest';

import { ThreadsManager } from '../src/threadsManager.js';
import { setupTest } from './vitestSetupTest.js';

// Setup the test environment
await setupTest(NAME, false);

describe('ThreadsManager', () => {
  const moduleDirectory = path.dirname(url.fileURLToPath(new URL('../src/threadsManager.js', import.meta.url)));
  const tempWorkerDirectory = path.resolve('.cache', 'vitest', NAME, 'temp-workers');

  beforeAll(() => {
    mkdirSync(tempWorkerDirectory, { recursive: true });
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {});

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  describe('resolvePath', () => {
    const manager = new ThreadsManager();

    const tempFileName = 'resolvePath.test.tmp.js';
    const tempSrcPath = path.join(moduleDirectory, tempFileName);
    const tempDistPath = path.join(moduleDirectory, '..', 'dist', tempFileName);

    afterEach(() => {
      // Ensure we leave the workspace clean even if a test fails
      if (existsSync(tempSrcPath)) rmSync(tempSrcPath, { force: true });
      if (existsSync(tempDistPath)) rmSync(tempDistPath, { force: true });
    });

    afterAll(() => {
      manager.destroy();
    });

    test('returns the file path in the current module directory when it exists', () => {
      writeFileSync(tempSrcPath, '// temp test file', { encoding: 'utf8' });
      if (existsSync(tempDistPath)) rmSync(tempDistPath, { force: true });

      const resolved = manager.resolvePath(tempFileName);

      expect(resolved).toBe(tempSrcPath);
    });

    test('falls back to ../dist when the file is not in the current module directory', () => {
      const fileName = 'workerGlobalPrefix.js';
      const expectedSrcCandidate = path.join(moduleDirectory, fileName);
      const expectedDistCandidate = path.join(moduleDirectory, '..', 'dist', fileName);

      // Dist artifact should exist for thread package tests
      expect(existsSync(expectedDistCandidate)).toBe(true);
      // It is typically not present in src; if it is, this test still passes but would not exercise the fallback.
      if (existsSync(expectedSrcCandidate)) rmSync(expectedSrcCandidate, { force: true });

      const resolved = manager.resolvePath(fileName);

      expect(resolved).toBe(expectedDistCandidate);
    });

    test('returns the first candidate when no candidate exists (best effort)', () => {
      const fileName = `resolvePath.does-not-exist.${Date.now()}.js`;
      const expectedFirstCandidate = path.join(moduleDirectory, fileName);
      const expectedSecondCandidate = path.join(moduleDirectory, '..', 'dist', fileName);

      expect(existsSync(expectedFirstCandidate)).toBe(false);
      expect(existsSync(expectedSecondCandidate)).toBe(false);

      const resolved = manager.resolvePath(fileName);

      expect(resolved).toBe(expectedFirstCandidate);
    });
  });

  describe('runThread', () => {
    test('throws when the thread is not found', () => {
      const manager = new ThreadsManager();
      expect(() => manager.runThread('DoesNotExist')).toThrow('Thread DoesNotExist not found');
      manager.destroy();
    });

    test('throws when the resolved worker file does not exist', () => {
      const manager = new ThreadsManager();
      const fileName = `runThread.does-not-exist.${Date.now()}.js`;
      const threads = (manager as any).threads as Array<{ name: string; path: string; type: 'worker' | 'thread' }>;
      threads.push({ name: 'MissingFileWorker', path: fileName, type: 'worker' });
      expect(() => manager.runThread('MissingFileWorker')).toThrow(/Thread MissingFileWorker file not found at path/);
      manager.destroy();
    });

    test('starts a thread and creates a worker with expected workerData and argv', async () => {
      const manager = new ThreadsManager();

      const tempWorkerFileName = `runThread.test.worker.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(
        tempWorkerPath,
        [
          "import { parentPort, threadId, workerData } from 'node:worker_threads';",
          "parentPort?.postMessage({ type: 'init', threadId, threadName: workerData.threadName, success: true });",
          "parentPort?.postMessage({ type: 'payload', workerData, argv: process.argv });",
          'setTimeout(() => {',
          "  parentPort?.postMessage({ type: 'exit', threadId, threadName: workerData.threadName, success: true });",
          '  parentPort?.close();',
          '}, 0);',
        ].join('\n'),
        { encoding: 'utf8' },
      );

      try {
        vi.spyOn(manager, 'resolvePath').mockReturnValue(tempWorkerPath);

        // Inject a test thread entry so we don't run real worker scripts.
        const threads = (manager as any).threads as Array<{
          name: string;
          path: string;
          type: 'worker' | 'thread';
          worker?: any;
          runCount?: number;
          lastStarted?: number;
          lastStopped?: number;
          lastDuration?: number;
        }>;
        threads.push({ name: 'TestWorker', path: tempWorkerFileName, type: 'worker' });

        const testArgv = ['--from-threadsManager-test'];
        // @ts-expect-error workerData is an internal implementation detail of the worker script, we just want to ensure it is passed through correctly.
        manager.runThread('TestWorker', { foo: 'bar' }, testArgv);

        const threadInfo = threads.find((t) => t.name === 'TestWorker');
        expect(threadInfo).toBeDefined();
        expect(threadInfo?.worker).toBeDefined();
        expect(threadInfo?.worker.threadId).toBeGreaterThan(0);

        // runCount/lastStarted are updated when the worker sends its init control message.
        expect(threadInfo?.lastStopped).toBeUndefined();
        expect(threadInfo?.lastDuration).toBeUndefined();

        const worker = threadInfo!.worker;
        const exitPromise = new Promise<void>((resolve, reject) => {
          worker.once('exit', () => resolve());
          worker.once('error', reject);
        });

        const message = await new Promise<any>((resolve, reject) => {
          worker.on('message', (payload: { type?: string }) => {
            if (payload.type === 'payload') resolve(payload);
          });
          worker.once('error', reject);
        });

        expect(message).toBeDefined();
        expect(message.workerData).toBeDefined();
        expect(message.workerData.foo).toBe('bar');
        // ThreadsManager adds threadName into workerData
        expect(message.workerData.threadName).toBe('TestWorker');
        expect(Array.isArray(message.argv)).toBe(true);
        expect(message.argv.join(' ')).toContain(testArgv[0]);

        expect(threadInfo?.runCount).toBe(1);
        expect(threadInfo?.lastStarted).toBeDefined();
        expect(typeof threadInfo?.lastStarted).toBe('number');

        await exitPromise;

        // Lifecycle timestamps should be set on stop.
        expect(threadInfo?.lastStopped).toBeDefined();
        expect(typeof threadInfo?.lastStopped).toBe('number');
        expect(threadInfo?.lastDuration).toBeDefined();
        expect(typeof threadInfo?.lastDuration).toBe('number');
        expect(threadInfo!.lastDuration!).toBeGreaterThanOrEqual(0);
        expect(threadInfo!.lastStopped!).toBeGreaterThanOrEqual(threadInfo!.lastStarted ?? threadInfo!.lastStopped!);

        // Worker reference should be cleared on exit.
        expect(threadInfo?.worker).toBeUndefined();
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        manager.destroy();
      }
    }, 10000);
  });

  describe('destroy', () => {
    test('closes the broadcast server', () => {
      const manager = new ThreadsManager();
      const closeSpy = vi.spyOn((manager as any).server, 'close');
      manager.destroy();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('msgHandler', () => {
    test('responds to get_log_level and set_log_level', async () => {
      const originalArgv = process.argv;
      process.argv = originalArgv.filter((arg) => arg !== '--verbose' && arg !== '-verbose');

      try {
        const manager = new ThreadsManager();
        const server = (manager as any).server;
        const respondSpy = vi.spyOn(server, 'respond').mockImplementation(() => {});
        const debugSpy = vi.spyOn((manager as any).log, 'debug');

        await (manager as any).msgHandler({ type: 'get_log_level', id: 1, timestamp: 1, src: 'frontend', dst: 'manager' });
        expect(respondSpy).toHaveBeenCalledTimes(1);
        expect(respondSpy).toHaveBeenLastCalledWith(
          expect.objectContaining({ type: 'get_log_level', src: 'frontend', dst: 'manager', result: { logLevel: (manager as any).log.logLevel } }),
        );

        await (manager as any).msgHandler({
          type: 'set_log_level',
          id: 2,
          timestamp: 2,
          src: 'frontend',
          dst: 'manager',
          params: { logLevel: LogLevel.DEBUG },
        });
        expect((manager as any).log.logLevel).toBe(LogLevel.DEBUG);
        expect(respondSpy).toHaveBeenCalledTimes(2);
        expect(respondSpy).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'set_log_level', src: 'frontend', dst: 'manager', result: { logLevel: LogLevel.DEBUG } }));

        // Default branch with verbose=false should not log.
        await (manager as any).msgHandler({ type: 'jest_simple', id: 3, timestamp: 3, src: 'frontend', dst: 'manager' });
        expect(debugSpy).not.toHaveBeenCalled();

        manager.destroy();
      } finally {
        process.argv = originalArgv;
      }
    });

    test('set_log_level does not change when debug=true', async () => {
      const originalArgv = process.argv;
      process.argv = [...originalArgv.slice(0, 2), '--debug'];

      try {
        const manager = new ThreadsManager();
        const server = (manager as any).server;
        const respondSpy = vi.spyOn(server, 'respond').mockImplementation(() => {});

        const originalLevel = (manager as any).log.logLevel;

        await (manager as any).msgHandler({
          type: 'set_log_level',
          id: 200,
          timestamp: 200,
          src: 'frontend',
          dst: 'manager',
          params: { logLevel: LogLevel.DEBUG },
        });

        // In debug mode, ThreadsManager intentionally refuses to change log level.
        expect((manager as any).log.logLevel).toBe(originalLevel);
        expect(respondSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'set_log_level', result: { logLevel: originalLevel } }));

        manager.destroy();
      } finally {
        process.argv = originalArgv;
      }
    });

    test('responds to manager_run (success + failure)', async () => {
      const manager = new ThreadsManager();
      const server = (manager as any).server;
      const respondSpy = vi.spyOn(server, 'respond').mockImplementation(() => {});

      const runThreadSpy = vi.spyOn(manager, 'runThread').mockImplementation(() => ({ threadId: 1 }) as any);

      await (manager as any).msgHandler({
        type: 'manager_run',
        id: 10,
        timestamp: 10,
        src: 'frontend',
        dst: 'manager',
        params: { name: 'CheckUpdates' },
      });
      expect(runThreadSpy).toHaveBeenCalledTimes(1);
      // oxlint-disable-next-line unicorn/no-useless-undefined
      expect(runThreadSpy).toHaveBeenLastCalledWith('CheckUpdates', undefined, undefined, undefined, undefined, undefined);
      expect(respondSpy).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'manager_run', id: 10, src: 'frontend', dst: 'manager', result: { success: true } }));

      runThreadSpy.mockImplementationOnce(() => {
        throw new Error('boom');
      });
      await (manager as any).msgHandler({
        type: 'manager_run',
        id: 11,
        timestamp: 11,
        src: 'frontend',
        dst: 'manager',
        params: { name: 'SystemCheck' },
      });
      expect(runThreadSpy).toHaveBeenCalledTimes(2);
      // oxlint-disable-next-line unicorn/no-useless-undefined
      expect(runThreadSpy).toHaveBeenLastCalledWith('SystemCheck', undefined, undefined, undefined, undefined, undefined);
      expect(respondSpy).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'manager_run', id: 11, src: 'frontend', dst: 'manager', result: { success: false } }));

      manager.destroy();
    });

    test('ignores non-requests / wrong dst and logs unknown types when verbose', async () => {
      const originalArgv = process.argv;
      process.argv = [...originalArgv.slice(0, 2), '--verbose'];

      try {
        const manager = new ThreadsManager();
        const server = (manager as any).server;
        const respondSpy = vi.spyOn(server, 'respond').mockImplementation(() => {});
        const debugSpy = vi.spyOn((manager as any).log, 'debug');

        // Invalid request structure => isWorkerRequest(false) => no respond.
        await (manager as any).msgHandler({ type: 'get_log_level', src: 'frontend', dst: 'manager' });
        expect(respondSpy).not.toHaveBeenCalled();

        // Valid request but wrong dst => ignored.
        await (manager as any).msgHandler({ type: 'get_log_level', id: 1, timestamp: 1, src: 'frontend', dst: 'plugins' });
        expect(respondSpy).not.toHaveBeenCalled();

        // Valid request with unknown type => hits default branch.
        await (manager as any).msgHandler({ type: 'jest_simple', id: 3, timestamp: 3, src: 'frontend', dst: 'manager' });
        expect(respondSpy).not.toHaveBeenCalled();
        expect(debugSpy).toHaveBeenCalled();

        manager.destroy();
      } finally {
        process.argv = originalArgv;
      }
    });
  });

  describe('runInMainThread', () => {
    test('throws when the thread is not found', async () => {
      const manager = new ThreadsManager();

      await expect(manager.runInMainThread('DoesNotExist')).rejects.toThrow('Thread DoesNotExist not found');

      manager.destroy();
    });

    test('runs the exported worker wrapper in the main thread and returns the callback result', async () => {
      const manager = new ThreadsManager();

      const tempWorkerFileName = `runInMainThread.test.worker.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(
        tempWorkerPath,
        [
          'const state = {',
          "  name: 'RunInMainThreadWorker',",
          '  workerData: null,',
          '  destroy: function(success) { this.destroyCalledWith = success; },',
          '  callback: async function(worker) {',
          '    this.callbackCalledWith = worker;',
          '    return worker.workerData?.ok === true;',
          '  },',
          '};',
          'export default state;',
        ].join('\n'),
        { encoding: 'utf8' },
      );

      try {
        vi.spyOn(manager, 'resolvePath').mockReturnValue(tempWorkerPath);

        const threads = (manager as any).threads as Array<{ name: string; path: string; type: 'worker' | 'thread' }>;
        threads.push({ name: 'RunInMainThreadWorker', path: tempWorkerFileName, type: 'worker' });

        // @ts-expect-error test-only workerData shape
        const result = await manager.runInMainThread('RunInMainThreadWorker', { ok: true, payload: 'value' });

        expect(result).toBe(true);

        const imported = (await import(url.pathToFileURL(tempWorkerPath).href)).default;
        expect(imported.workerData).toEqual({ ok: true, payload: 'value' });
        expect(imported.callbackCalledWith).toBe(imported);
        expect(imported.destroyCalledWith).toBe(true);
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        manager.destroy();
      }
    });

    test('returns false when the imported default export is not a matching worker wrapper', async () => {
      const manager = new ThreadsManager();

      const tempWorkerFileName = `runInMainThread.invalid.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(tempWorkerPath, "export default { name: 'DifferentName', callback: async () => true, destroy: () => undefined };", { encoding: 'utf8' });

      try {
        vi.spyOn(manager, 'resolvePath').mockReturnValue(tempWorkerPath);

        const threads = (manager as any).threads as Array<{ name: string; path: string; type: 'worker' | 'thread' }>;
        threads.push({ name: 'InvalidMainThreadWorker', path: tempWorkerFileName, type: 'worker' });

        const result = await manager.runInMainThread('InvalidMainThreadWorker');

        expect(result).toBe(false);

        const imported = (await import(url.pathToFileURL(tempWorkerPath).href)).default;
        expect(imported.workerData).toBeUndefined();
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        manager.destroy();
      }
    });
  });

  describe('createESMWorker', () => {
    test('uses default argv/env and logs when verbose', async () => {
      const originalArgv = process.argv;
      const originalFoo = process.env.FOO;

      const defaultArgvMarker = `--default-argv-marker-${Date.now()}`;
      process.argv = [...originalArgv.slice(0, 2), '--verbose', defaultArgvMarker];
      delete process.env.FOO;

      const manager = new ThreadsManager();
      const debugSpy = vi.spyOn((manager as any).log, 'debug');

      const tempWorkerFileName = `createESMWorker.test.worker.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(
        tempWorkerPath,
        [
          "import { parentPort, workerData } from 'node:worker_threads';",
          'parentPort?.postMessage({ workerData, argv: process.argv, envFoo: process.env.FOO });',
          'setTimeout(() => process.exit(0), 0);',
        ].join('\n'),
        { encoding: 'utf8' },
      );

      try {
        const worker = manager.createESMWorker('VerboseWorker', tempWorkerPath, { hello: 'world' }, undefined, undefined, undefined, true);

        // When pipedOutput=true, stdout/stderr should be available.
        expect(worker.stdout).toBeDefined();
        expect(worker.stderr).toBeDefined();

        const message = await new Promise<any>((resolve, reject) => {
          worker.once('message', resolve);
          worker.once('error', reject);
        });

        expect(message.workerData.hello).toBe('world');
        expect(message.workerData.threadName).toBe('VerboseWorker');
        expect(message.envFoo).toBeUndefined();
        expect(message.argv.join(' ')).toContain(defaultArgvMarker);

        // verbose => debug log executed
        expect(debugSpy).toHaveBeenCalled();

        await worker.terminate();
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        process.argv = originalArgv;
        if (originalFoo === undefined) delete process.env.FOO;
        else process.env.FOO = originalFoo;
        manager.destroy();
      }
    }, 10000);

    test('uses provided argv/env', async () => {
      const originalArgv = process.argv;
      const originalFoo = process.env.FOO;
      delete process.env.FOO;

      // Ensure ThreadsManager.verbose is false so we cover the non-logging branch.
      process.argv = originalArgv.filter((arg) => arg !== '--verbose' && arg !== '-verbose' && arg !== '--verbose-worker' && arg !== '-verbose-worker');

      const manager = new ThreadsManager();
      const tempWorkerFileName = `createESMWorker.test.worker2.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(
        tempWorkerPath,
        [
          "import { parentPort, workerData } from 'node:worker_threads';",
          'parentPort?.postMessage({ workerData, argv: process.argv, envFoo: process.env.FOO });',
          'setTimeout(() => process.exit(0), 0);',
        ].join('\n'),
        { encoding: 'utf8' },
      );

      try {
        const customMarker = `--custom-argv-${Date.now()}`;
        const worker = manager.createESMWorker('CustomWorker', tempWorkerPath, { a: 1 }, [customMarker], { ...process.env, FOO: 'BAR' });

        const message = await new Promise<any>((resolve, reject) => {
          worker.once('message', resolve);
          worker.once('error', reject);
        });

        expect(message.workerData.a).toBe(1);
        expect(message.workerData.threadName).toBe('CustomWorker');
        expect(message.envFoo).toBe('BAR');
        expect(message.argv.join(' ')).toContain(customMarker);

        await worker.terminate();
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        process.argv = originalArgv;
        if (originalFoo === undefined) delete process.env.FOO;
        else process.env.FOO = originalFoo;
        manager.destroy();
      }
    }, 10000);
  });

  describe('intervalHandler', () => {
    test('logs thread status', () => {
      const manager = new ThreadsManager();
      const debugSpy = vi.spyOn((manager as any).log, 'debug');

      (manager as any).intervalHandler();

      // Also cover the "running: yes" / lastSeen present / non-nullish runCount+errorCount branches.
      const threads = (manager as any).threads as Array<any>;
      threads[0].worker = { threadId: 1, postMessage: vi.fn<(...args: any[]) => any>() };
      threads[0].lastSeen = 1;
      threads[0].runCount = 2;
      threads[0].errorCount = 3;
      (manager as any).intervalHandler();

      expect(debugSpy).toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Thread CheckUpdates running: yes'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('lastSeen: 1970-01-01T00:00:00.001Z'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('runs: 2, errors: 3'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Thread SystemCheck running: no'));
      manager.destroy();
    });

    test('pings after interval and warns after 2x interval', () => {
      const manager = new ThreadsManager(1000);
      const warnSpy = vi.spyOn((manager as any).log, 'warn');

      const threads = (manager as any).threads as Array<any>;
      const thread = threads[0];
      thread.worker = { threadId: 123, postMessage: vi.fn<(...args: any[]) => any>() };

      const nowSpy = vi.spyOn(Date, 'now');
      try {
        // Not stale yet: no ping, no warn (covers false branches when worker exists)
        nowSpy.mockReturnValue(10_000);
        thread.lastSeen = 9_500;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).not.toHaveBeenCalled();
        expect(warnSpy).not.toHaveBeenCalled();

        // Between 1x and 2x: ping but no warn
        (thread.worker.postMessage as Mock).mockClear();
        nowSpy.mockReturnValue(10_000);
        thread.lastSeen = 8_999;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 123, threadName: thread.name });
        expect(warnSpy).not.toHaveBeenCalled();

        // Beyond 2x: ping + warn
        (thread.worker.postMessage as Mock).mockClear();
        nowSpy.mockReturnValue(10_000);
        thread.lastSeen = 7_999;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 123, threadName: thread.name });
        expect(warnSpy).toHaveBeenCalled();

        // lastSeen missing should fall back to 0 (covers (thread.lastSeen || 0) branch)
        (thread.worker.postMessage as Mock).mockClear();
        warnSpy.mockClear();
        nowSpy.mockReturnValue(10_000);
        delete thread.lastSeen;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 123, threadName: thread.name });
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        nowSpy.mockRestore();
        manager.destroy();
      }
    });
  });

  describe('runThread (lifecycle branch coverage)', () => {
    test('updates lifecycle state from init and exit worker messages', async () => {
      vi.resetModules();

      const nowSpy = vi.spyOn(Date, 'now');
      // ThreadsManager uses Date.now() multiple times across the lifecycle handlers:
      // - native online: log timestamp only
      // - init message: lastSeen + lastStarted
      // - exit message: lastSeen + lastStopped
      // - second init/failed exit messages after a restart
      const times = [1000, 1001, 2000, 4000, 5000];
      nowSpy.mockImplementation(() => times.shift() ?? 9999);

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = 1;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const manager = new ThreadsManagerMocked();
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      const worker = threadInfo.worker;

      // lastStarted/runCount are set only after the worker sends the init control message.
      expect(threadInfo.lastStarted).toBeUndefined();
      expect(threadInfo.runCount).toBeUndefined();

      // Native worker online only logs after the refactor.
      worker.emit('online');
      expect(threadInfo.lastStarted).toBeUndefined();
      expect(threadInfo.runCount).toBeUndefined();

      worker.emit('message', { type: 'init', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.lastSeen).toBe(1001);
      expect(threadInfo.lastStarted).toBe(1001);
      expect(threadInfo.runCount).toBe(1);

      worker.emit('message', { type: 'exit', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.lastSeen).toBe(2000);
      expect(threadInfo.lastStopped).toBe(2000);
      expect(threadInfo.lastDuration).toBe(999);
      expect(threadInfo.lastStopped).toBeGreaterThanOrEqual(threadInfo.lastStarted);
      expect(threadInfo.errorCount).toBeUndefined();

      // Worker reference should be cleared on exit.
      expect(threadInfo.worker).toBeUndefined();

      manager.runThread('TestWorker');
      const failedWorker = threadInfo.worker;
      failedWorker.emit('message', { type: 'init', threadId: 1, threadName: 'TestWorker', success: true });
      failedWorker.emit('message', { type: 'exit', threadId: 1, threadName: 'TestWorker', success: false });
      expect(threadInfo.lastSeen).toBe(5000);
      expect(threadInfo.lastStopped).toBe(5000);
      expect(threadInfo.lastDuration).toBe(1000);
      expect(threadInfo.errorCount).toBe(1);
      expect(threadInfo.worker).toBeUndefined();

      // Native worker exit is a no-op after the explicit exit message has already cleared this worker.
      threadInfo.lastSeen = 3000;
      threadInfo.lastStopped = 3000;
      threadInfo.lastDuration = 1999;
      worker.emit('exit', 0);
      expect(threadInfo.lastSeen).toBe(3000);
      expect(threadInfo.lastStopped).toBe(3000);
      expect(threadInfo.lastDuration).toBe(1999);

      manager.destroy();
      nowSpy.mockRestore();
    });

    test('clears worker on native exit when no exit message was received', async () => {
      vi.resetModules();

      const nowSpy = vi.spyOn(Date, 'now');
      const times = [1000, 2000];
      nowSpy.mockImplementation(() => times.shift() ?? 9999);

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = 1;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const manager = new ThreadsManagerMocked();
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      const worker = threadInfo.worker;

      worker.emit('message', { type: 'init', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.lastStarted).toBe(1000);
      expect(threadInfo.worker).toBe(worker);

      worker.emit('exit', 0);

      expect(threadInfo.lastSeen).toBe(2000);
      expect(threadInfo.lastStopped).toBe(2000);
      expect(threadInfo.lastDuration).toBe(1000);
      expect(threadInfo.worker).toBeUndefined();

      manager.destroy();
      nowSpy.mockRestore();
    });

    test('computes zero duration when exit message arrives before init', async () => {
      vi.resetModules();

      const nowSpy = vi.spyOn(Date, 'now');
      nowSpy.mockReturnValue(2000);

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = 1;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const manager = new ThreadsManagerMocked();
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      const worker = threadInfo.worker;

      expect(threadInfo.lastStarted).toBeUndefined();

      worker.emit('message', { type: 'exit', threadId: 1, threadName: 'TestWorker', success: true });

      expect(threadInfo.lastSeen).toBe(2000);
      expect(threadInfo.lastStopped).toBe(2000);
      expect(threadInfo.lastDuration).toBe(0);
      expect(threadInfo.worker).toBeUndefined();

      manager.destroy();
      nowSpy.mockRestore();
    });

    test('increments errorCount on messageerror and logs', async () => {
      vi.resetModules();

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = 1;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const manager = new ThreadsManagerMocked();
      const errorSpy = vi.spyOn((manager as any).log, 'error');
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      expect(threadInfo.worker).toBeDefined();
      expect(threadInfo.errorCount).toBeUndefined();

      threadInfo.worker.emit('messageerror');

      expect(threadInfo.errorCount).toBe(1);
      expect(errorSpy).toHaveBeenCalled();

      manager.destroy();
    });

    test('logs worker log messages through AnsiLogger.create', async () => {
      vi.resetModules();

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = 1;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const { AnsiLogger: AnsiLoggerMocked } = await import('node-ansi-logger');
      const createSpy = vi.spyOn(AnsiLoggerMocked, 'create');
      const logSpy = vi.fn<(...args: any[]) => any>();
      createSpy.mockReturnValue({ log: logSpy } as any);

      const manager = new ThreadsManagerMocked();
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));
      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      expect(threadInfo.worker).toBeDefined();

      threadInfo.worker.emit('message', { type: 'log', logLevel: LogLevel.INFO, message: 'from worker' });

      expect(createSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(LogLevel.INFO, 'from worker');

      manager.destroy();
    });

    test('throws if the thread is already running; allows restart after exit', async () => {
      vi.resetModules();

      let nextThreadId = 1;

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = nextThreadId++;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const manager = new ThreadsManagerMocked();
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      const threadInfo = threads.find((t) => t.name === 'TestWorker');

      const first = manager.runThread('TestWorker');
      expect(threadInfo.worker).toBe(first);

      expect(() => manager.runThread('TestWorker')).toThrow('Thread TestWorker is already running');

      // Native worker exit is a fallback cleanup path when no explicit exit message was received.
      (first as any).emit('exit', 0);
      expect(threadInfo.worker).toBeUndefined();

      const second = manager.runThread('TestWorker');
      expect(threadInfo.worker).toBe(second);

      manager.destroy();
    });

    test('sets lastStopped/lastDuration and clears worker on error (and increments errorCount)', async () => {
      vi.resetModules();

      const { EventEmitter } = await import('node:events');
      class WorkerMock extends EventEmitter {
        threadId = 1;
        constructor(_specifier: unknown, _options: unknown) {
          super();
        }
      }

      vi.doMock('node:worker_threads', async () => {
        const actual = await vi.importActual<any>('node:worker_threads');
        return {
          ...actual,
          Worker: WorkerMock,
        };
      });

      const { ThreadsManager: ThreadsManagerMocked } = await import('../src/threadsManager.js');
      const manager = new ThreadsManagerMocked();
      const errorSpy = vi.spyOn((manager as any).log, 'error');
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      expect(threadInfo.lastStopped).toBeUndefined();
      expect(threadInfo.lastDuration).toBeUndefined();
      expect(threadInfo.errorCount).toBeUndefined();
      expect(threadInfo.worker).toBeDefined();

      threadInfo.worker.emit('error', new Error('boom'));
      expect(threadInfo.lastStopped).toBeDefined();
      expect(threadInfo.lastDuration).toBeDefined();
      expect(threadInfo.errorCount).toBe(1);
      expect(threadInfo.worker).toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));

      manager.destroy();
    });
  });
});
