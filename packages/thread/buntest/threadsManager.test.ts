/**
 * @file packages/thread/buntest/threadsManager.test.ts
 * @description This file contains the tests for the ThreadsManager class.
 * @author Luca Liguori
 */

/* oxlint-disable typescript/no-non-null-assertion */

const NAME = 'ThreadsManager';

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'bun:test';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
// oxlint-disable-next-line import/no-namespace
import * as workerThreads from 'node:worker_threads';

import { originalProcessArgv, resetTest, setupTest } from '@matterbridge/test-utils/buntest/setup';
import type { ThreadType } from '@matterbridge/types';
import { AnsiLogger, LogLevel } from 'node-ansi-logger';

import { ThreadsManager } from '../src/threadsManager.js';

// Copy of the real exports, used to put node:worker_threads back after the lifecycle tests replace Worker.
const actualWorkerThreads = { ...workerThreads };

// Setup the test environment
await setupTest(NAME, false);

// Directory of the @matterbridge/core cli module used to resolve the core runners
const coreDirectory = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..', 'core', 'src');

describe('ThreadsManager', () => {
  const moduleDirectory = path.dirname(url.fileURLToPath(new URL('../src/threadsManager.js', import.meta.url)));
  const tempWorkerDirectory = path.resolve('.cache', 'bun', NAME, 'temp-workers');

  beforeAll(() => {
    mkdirSync(tempWorkerDirectory, { recursive: true });
  });

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterAll(() => {
    // Restore all mocks
    vi.restoreAllMocks();
    resetTest();
  });

  describe('command line flags', () => {
    test.each([
      { flag: undefined, debug: false, verbose: false, tracker: false },
      { flag: 'debug', debug: true, verbose: false, tracker: false },
      { flag: 'verbose', debug: true, verbose: true, tracker: false },
      { flag: 'debug-threads', debug: true, verbose: false, tracker: false },
      { flag: 'verbose-threads', debug: true, verbose: true, tracker: false },
      { flag: 'tracker', debug: false, verbose: false, tracker: true },
      { flag: 'tracker-threads', debug: false, verbose: false, tracker: true },
    ])('should configure flags for $flag', ({ flag, debug, verbose, tracker }) => {
      const savedArgv = process.argv;
      const originalLogLevel = ThreadsManager.logLevel;
      process.argv = originalProcessArgv.slice(0, 2);
      if (flag) process.argv.push(`--${flag}`);
      let manager: ThreadsManager | undefined;
      try {
        manager = new ThreadsManager(coreDirectory);
        expect(manager['debug']).toBe(debug);
        expect(manager['verbose']).toBe(verbose);
        expect(manager['tracker']).toBe(tracker);
        expect(ThreadsManager.logLevel).toBe(debug ? LogLevel.DEBUG : LogLevel.INFO);
      } finally {
        manager?.destroy();
        process.argv = savedArgv;
        ThreadsManager.logLevel = originalLogLevel;
      }
    });
  });

  describe('resolvePath', () => {
    const manager = new ThreadsManager(coreDirectory);

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

    test('resolves the core runners candidates when the core directory is provided', () => {
      const coreRoot = path.join(tempWorkerDirectory, 'core');
      const coreSrc = path.join(coreRoot, 'src');
      const coreDist = path.join(coreRoot, 'dist');
      const fileName = 'resolvePath.core.test.tmp.js';
      rmSync(coreRoot, { recursive: true, force: true });
      mkdirSync(path.join(coreSrc, 'runners'), { recursive: true });
      mkdirSync(path.join(coreDist, 'runners'), { recursive: true });
      const coreManager = new ThreadsManager(coreSrc);
      try {
        // Bun: the core src runners directory with the .ts extension
        writeFileSync(path.join(coreSrc, 'runners', 'resolvePath.core.test.tmp.ts'), '// temp test file', { encoding: 'utf8' });
        expect(coreManager.resolvePath(fileName)).toBe(path.join(coreSrc, 'runners', 'resolvePath.core.test.tmp.ts'));
        // Tests: the core dist runners directory from the core src directory
        writeFileSync(path.join(coreDist, 'runners', fileName), '// temp test file', { encoding: 'utf8' });
        expect(coreManager.resolvePath(fileName)).toBe(path.join(coreDist, 'runners', fileName));
        // Production: the runners directory alongside the core module
        writeFileSync(path.join(coreSrc, 'runners', fileName), '// temp test file', { encoding: 'utf8' });
        expect(coreManager.resolvePath(fileName)).toBe(path.join(coreSrc, 'runners', fileName));
      } finally {
        coreManager.destroy();
        rmSync(coreRoot, { recursive: true, force: true });
      }
    });
  });

  describe('runThread', () => {
    test('should allow concurrent instances when the thread allows multiple', async () => {
      const { EventEmitter } = await import('node:events');
      const manager = new ThreadsManager(coreDirectory);
      const threadInfo = manager['threads'].find((thread) => thread.name === 'RootNode');
      expect(threadInfo?.multiple).toBe(true);
      if (!threadInfo) throw new Error('RootNode thread not registered');
      let nextThreadId = 1;
      const createWorkerSpy = vi.spyOn(manager, 'createESMWorker').mockImplementation(() => {
        return Object.assign(new EventEmitter(), { threadId: nextThreadId++, terminate: vi.fn(async () => 0) }) as unknown as ReturnType<typeof manager.createESMWorker>;
      });
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));
      const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
      try {
        // Multiple instances are tracked in instances, never in worker
        const first = manager.runThread('RootNode');
        expect(threadInfo.worker).toBeUndefined();
        expect(threadInfo.instances).toEqual([{ worker: first }]);
        const second = manager.runThread('RootNode');
        expect(second).not.toBe(first);
        expect(threadInfo.worker).toBeUndefined();
        expect(threadInfo.instances).toEqual([{ worker: first }, { worker: second }]);

        // Instance events update the instance, while errors are counted on the thread
        second.emit('online');
        expect(threadInfo.instances?.[1]).toEqual({ worker: second, lastSeen: 1000, lastStarted: 1000 });
        nowSpy.mockReturnValue(1500);
        second.emit('message', { type: 'pong', threadId: 2, threadName: 'RootNode' });
        expect(threadInfo.instances?.[1].lastSeen).toBe(1500);
        second.emit('messageerror', new Error('message error'));
        expect(threadInfo.errorCount).toBe(1);
        nowSpy.mockReturnValue(2000);
        second.emit('exit', 0);
        expect(threadInfo.instances?.[1]).toEqual({ worker: undefined, lastSeen: 2000, lastStarted: 1000, lastStopped: 2000, lastDuration: 1000 });
        first.emit('error', new Error('boom'));
        expect(threadInfo.instances?.[0]).toEqual({ worker: undefined, lastSeen: 2000, lastStopped: 2000, lastDuration: 0 });
        expect(threadInfo.errorCount).toBe(2);

        // Events of a worker no longer tracked are ignored
        nowSpy.mockReturnValue(3000);
        first.emit('online');
        first.emit('message', { type: 'pong', threadId: 1, threadName: 'RootNode' });
        first.emit('messageerror', new Error('message error'));
        first.emit('exit', 1);
        second.emit('error', new Error('late error'));
        expect(threadInfo.instances?.[0]).toEqual({ worker: undefined, lastSeen: 2000, lastStopped: 2000, lastDuration: 0 });
        expect(threadInfo.errorCount).toBe(2);
        expect(threadInfo.lastSeen).toBeUndefined();
        expect(threadInfo.worker).toBeUndefined();

        // Exited instances are not removed yet
        expect(threadInfo.instances).toHaveLength(2);
        const third = manager.runThread('RootNode');
        expect(threadInfo.instances).toHaveLength(3);
        expect(threadInfo.instances?.[2]).toEqual({ worker: third });
        third.emit('exit', 0);
        expect(createWorkerSpy).toHaveBeenCalledTimes(3);
      } finally {
        manager.destroy();
        nowSpy.mockRestore();
      }
    });

    test('throws when the thread is not found', () => {
      const manager = new ThreadsManager(coreDirectory);
      expect(() => manager.runThread('DoesNotExist')).toThrow('Thread DoesNotExist not found');
      manager.destroy();
    });

    test('throws when the resolved worker file does not exist', () => {
      const manager = new ThreadsManager(coreDirectory);
      const fileName = `runThread.does-not-exist.${Date.now()}.js`;
      const threads = (manager as any).threads as Array<{ name: string; path: string; type: ThreadType }>;
      threads.push({ name: 'MissingFileWorker', path: fileName, type: 'worker' });
      expect(() => manager.runThread('MissingFileWorker')).toThrow(/Thread MissingFileWorker file not found at path/);
      manager.destroy();
    });

    test('starts a thread and creates a worker with expected workerData and argv', async () => {
      const manager = new ThreadsManager(coreDirectory);

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
          type: ThreadType;
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
        expect(message.workerData.type).toBe('worker');
        // ThreadsManager adds the base worker data used by isWorkerData
        expect(message.workerData.debug).toBe((manager as any).debug);
        expect(message.workerData.verbose).toBe((manager as any).verbose);
        expect(message.workerData.tracker).toBe((manager as any).tracker);
        expect(message.workerData.logLevel).toBe((manager as any).log.logLevel);
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
      const manager = new ThreadsManager(coreDirectory);
      const closeSpy = vi.spyOn((manager as any).server, 'close');
      manager.destroy();
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('msgHandler', () => {
    test('responds to get_log_level and set_log_level', async () => {
      const savedArgv = process.argv;
      process.argv = savedArgv.filter((arg) => arg !== '--verbose' && arg !== '-verbose');

      try {
        const manager = new ThreadsManager(coreDirectory);
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
        await (manager as any).msgHandler({ type: 'test_simple', id: 3, timestamp: 3, src: 'frontend', dst: 'manager' });
        expect(debugSpy).not.toHaveBeenCalled();

        manager.destroy();
      } finally {
        process.argv = savedArgv;
      }
    });

    test('set_log_level does not change when debug=true', async () => {
      const savedArgv = process.argv;
      process.argv = [...originalProcessArgv.slice(0, 2), '--debug'];

      try {
        const manager = new ThreadsManager(coreDirectory);
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
        process.argv = savedArgv;
      }
    });

    test('responds to manager_run (success + failure)', async () => {
      const manager = new ThreadsManager(coreDirectory);
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
      const savedArgv = process.argv;
      process.argv = [...originalProcessArgv.slice(0, 2), '--verbose'];

      try {
        const manager = new ThreadsManager(coreDirectory);
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
        await (manager as any).msgHandler({ type: 'test_simple', id: 3, timestamp: 3, src: 'frontend', dst: 'manager' });
        expect(respondSpy).not.toHaveBeenCalled();
        expect(debugSpy).toHaveBeenCalled();

        manager.destroy();
      } finally {
        process.argv = savedArgv;
      }
    });
  });

  describe('runInMainThread', () => {
    test('throws when the thread is not found', async () => {
      const manager = new ThreadsManager(coreDirectory);

      expect(manager.runInMainThread('DoesNotExist')).rejects.toThrow('Thread DoesNotExist not found');

      manager.destroy();
    });

    test.each([
      { type: 'worker' as const, ok: true },
      { type: 'thread' as const, ok: true },
      { type: 'thread' as const, ok: false },
    ])('runs a $type wrapper in the main thread with success $ok', async ({ type, ok }) => {
      const manager = new ThreadsManager(coreDirectory);

      const tempWorkerFileName = `runInMainThread.test.${type}.${ok}.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(
        tempWorkerPath,
        [
          'const state = {',
          "  name: 'RunInMainThreadWorker',",
          '  workerData: null,',
          '  destroy: function(success) { this.destroyCalledWith = success; },',
          '  entrypoint: async function(worker) {',
          '    this.entrypointCalledWith = worker;',
          '    return worker.workerData?.ok === true;',
          '  },',
          '};',
          'export default state;',
        ].join('\n'),
        { encoding: 'utf8' },
      );

      try {
        vi.spyOn(manager, 'resolvePath').mockReturnValue(tempWorkerPath);

        const threads = (manager as any).threads as Array<{ name: string; path: string; type: ThreadType }>;
        threads.push({ name: 'RunInMainThreadWorker', path: tempWorkerFileName, type });

        // @ts-expect-error test-only workerData shape
        const result = await manager.runInMainThread('RunInMainThreadWorker', { ok, payload: 'value' });

        expect(result).toBe(ok);

        const imported = (await import(url.pathToFileURL(tempWorkerPath).href)).default;
        expect(imported.workerData).toEqual({ ok, payload: 'value', type });
        expect(imported.entrypointCalledWith).toBe(imported);
        expect(imported.destroyCalledWith).toBe(type === 'thread' && ok ? undefined : ok);
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        manager.destroy();
      }
    });

    test('passes null workerData when none is given', async () => {
      const manager = new ThreadsManager(coreDirectory);

      const tempWorkerFileName = `runInMainThread.nodata.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(
        tempWorkerPath,
        [
          'const state = {',
          "  name: 'NoDataMainThreadWorker',",
          '  workerData: undefined,',
          '  destroy: function(success) { this.destroyCalledWith = success; },',
          '  entrypoint: async function(worker) {',
          '    this.entrypointCalledWith = worker;',
          '    return worker.workerData === null;',
          '  },',
          '};',
          'export default state;',
        ].join('\n'),
        { encoding: 'utf8' },
      );

      try {
        vi.spyOn(manager, 'resolvePath').mockReturnValue(tempWorkerPath);

        const threads = (manager as any).threads as Array<{ name: string; path: string; type: ThreadType }>;
        threads.push({ name: 'NoDataMainThreadWorker', path: tempWorkerFileName, type: 'worker' });

        const result = await manager.runInMainThread('NoDataMainThreadWorker');

        expect(result).toBe(true);

        const imported = (await import(url.pathToFileURL(tempWorkerPath).href)).default;
        expect(imported.workerData).toBeNull();
        expect(imported.entrypointCalledWith).toBe(imported);
        expect(imported.destroyCalledWith).toBe(true);
      } finally {
        if (existsSync(tempWorkerPath)) rmSync(tempWorkerPath, { force: true });
        manager.destroy();
      }
    });

    test('returns false when the imported default export is not a matching worker wrapper', async () => {
      const manager = new ThreadsManager(coreDirectory);

      const tempWorkerFileName = `runInMainThread.invalid.${Date.now()}.js`;
      const tempWorkerPath = path.join(tempWorkerDirectory, tempWorkerFileName);
      writeFileSync(tempWorkerPath, "export default { name: 'DifferentName', entrypoint: async () => true, destroy: () => undefined };", { encoding: 'utf8' });

      try {
        vi.spyOn(manager, 'resolvePath').mockReturnValue(tempWorkerPath);

        const threads = (manager as any).threads as Array<{ name: string; path: string; type: ThreadType }>;
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
      const savedArgv = process.argv;
      const originalFoo = process.env.FOO;

      const defaultArgvMarker = `--default-argv-marker-${Date.now()}`;
      process.argv = [...originalProcessArgv.slice(0, 2), '--verbose', defaultArgvMarker];
      delete process.env.FOO;

      const manager = new ThreadsManager(coreDirectory);
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
        process.argv = savedArgv;
        if (originalFoo === undefined) delete process.env.FOO;
        else process.env.FOO = originalFoo;
        manager.destroy();
      }
    }, 10000);

    test('uses provided argv/env', async () => {
      const savedArgv = process.argv;
      const originalFoo = process.env.FOO;
      delete process.env.FOO;

      // Ensure ThreadsManager.verbose is false so we cover the non-logging branch.
      process.argv = savedArgv.filter((arg) => arg !== '--verbose' && arg !== '-verbose' && arg !== '--verbose-worker' && arg !== '-verbose-worker');

      const manager = new ThreadsManager(coreDirectory);
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
        process.argv = savedArgv;
        if (originalFoo === undefined) delete process.env.FOO;
        else process.env.FOO = originalFoo;
        manager.destroy();
      }
    }, 10000);
  });

  describe('intervalHandler', () => {
    test('logs thread status', () => {
      const manager = new ThreadsManager(coreDirectory);
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
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Thread CheckUpdates running: yes, threadId: 1'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('lastSeen: 1970-01-01T00:00:00.001Z'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('runs: 2, errors: 3'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Thread SystemCheck running: no'));
      expect(debugSpy).toHaveBeenCalledWith(expect.stringContaining('Thread SystemCheck running: no, threadId: none'));

      // A multiple thread logs a summary line, then one line per instance.
      expect(debugSpy).toHaveBeenCalledWith('Thread RootNode instances: 0, running: 0, runs: 0, errors: 0');
      const rootNode = threads.find((thread) => thread.name === 'RootNode');
      rootNode.runCount = 2;
      rootNode.errorCount = 1;
      rootNode.instances = [
        { worker: { threadId: 7, postMessage: vi.fn<(...args: any[]) => any>() }, lastSeen: 1, lastStarted: 1 },
        { lastSeen: 2, lastStarted: 1, lastStopped: 2, lastDuration: 1 },
        {},
      ];
      debugSpy.mockClear();
      (manager as any).intervalHandler();
      expect(debugSpy).toHaveBeenCalledWith('Thread RootNode instances: 3, running: 1, runs: 2, errors: 1');
      expect(debugSpy).toHaveBeenCalledWith(
        '- instance 0 running: yes, threadId: 7, lastSeen: 1970-01-01T00:00:00.001Z, lastStarted: 1970-01-01T00:00:00.001Z, lastStopped: never, lastDuration: none ms',
      );
      expect(debugSpy).toHaveBeenCalledWith(
        '- instance 1 running: no, threadId: none, lastSeen: 1970-01-01T00:00:00.002Z, lastStarted: 1970-01-01T00:00:00.001Z, lastStopped: 1970-01-01T00:00:00.002Z, lastDuration: 1 ms',
      );
      expect(debugSpy).toHaveBeenCalledWith('- instance 2 running: no, threadId: none, lastSeen: never, lastStarted: never, lastStopped: never, lastDuration: none ms');
      manager.destroy();
    });

    test('terminates workers queued for cleanup', () => {
      const manager = new ThreadsManager(coreDirectory);
      const debugSpy = vi.spyOn((manager as any).log, 'debug');
      const errorSpy = vi.spyOn((manager as any).log, 'error');
      const terminateWorker = { threadId: 123, terminate: vi.fn(async () => 0) };
      const throwingWorker = {
        threadId: 456,
        terminate: vi.fn(() => {
          throw new Error('terminate failed');
        }),
      };

      const terminateWorkers = (manager as any).terminateWorkers as Set<typeof terminateWorker | typeof throwingWorker>;
      terminateWorkers.add(terminateWorker);
      terminateWorkers.add(throwingWorker);

      (manager as any).intervalHandler();

      expect(debugSpy).toHaveBeenCalledWith('Terminating 2 workers that have exited...');
      expect(terminateWorker.terminate).toHaveBeenCalledTimes(1);
      expect(debugSpy).toHaveBeenCalledWith('Terminating worker with thread id 123...');
      expect(throwingWorker.terminate).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to terminate worker with thread id 456'));
      expect(terminateWorkers.size).toBe(0);

      manager.destroy();
    });

    test('pings after interval and warns after 2x interval', () => {
      const manager = new ThreadsManager(coreDirectory, 1000);
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
        thread.worker.postMessage.mockClear();
        nowSpy.mockReturnValue(10_000);
        thread.lastSeen = 8_999;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 123, threadName: thread.name });
        expect(warnSpy).not.toHaveBeenCalled();

        // Beyond 2x: ping + warn
        thread.worker.postMessage.mockClear();
        nowSpy.mockReturnValue(10_000);
        thread.lastSeen = 7_999;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 123, threadName: thread.name });
        expect(warnSpy).toHaveBeenCalled();

        // lastSeen missing should fall back to 0 (covers (thread.lastSeen || 0) branch)
        thread.worker.postMessage.mockClear();
        warnSpy.mockClear();
        nowSpy.mockReturnValue(10_000);
        delete thread.lastSeen;
        (manager as any).intervalHandler();
        expect(thread.worker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 123, threadName: thread.name });
        expect(warnSpy).toHaveBeenCalled();

        // A multiple thread pings and warns each running instance by its own lastSeen
        delete thread.worker;
        warnSpy.mockClear();
        const rootNode = threads.find((t) => t.name === 'RootNode');
        const staleWorker = { threadId: 7, postMessage: vi.fn<(...args: any[]) => any>() };
        const freshWorker = { threadId: 8, postMessage: vi.fn<(...args: any[]) => any>() };
        rootNode.instances = [{ worker: staleWorker, lastSeen: 7_999 }, { worker: freshWorker, lastSeen: 9_500 }, { lastSeen: 0 }];
        (manager as any).intervalHandler();
        expect(staleWorker.postMessage).toHaveBeenCalledWith({ type: 'ping', threadId: 7, threadName: 'RootNode' });
        expect(freshWorker.postMessage).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('RootNode'));
      } finally {
        nowSpy.mockRestore();
        manager.destroy();
      }
    });
  });

  describe('runThread (lifecycle branch coverage)', () => {
    let nextThreadId = 1;

    /** Minimal Worker stand-in: the tests drive its lifecycle by emitting the native events and messages. */
    class WorkerMock extends EventEmitter {
      threadId = nextThreadId++;
      constructor(_specifier: unknown, _options: unknown) {
        super();
      }
    }

    beforeEach(() => {
      nextThreadId = 1;
      // Bun updates the live Worker binding already imported by threadsManager.ts, so no module reset is needed.
      void vi.mock('node:worker_threads', () => ({ ...actualWorkerThreads, Worker: WorkerMock }));
    });

    afterEach(() => {
      void vi.mock('node:worker_threads', () => actualWorkerThreads);
    });

    test('should update lifecycle state when the worker goes online, sends messages and exits', async () => {
      const nowSpy = vi.spyOn(Date, 'now');
      // Each handled event reads Date.now() once, in this order:
      // - online, init message, exit message, native exit
      // - after a restart: online, init message, failed exit message, error
      const times = [1000, 1001, 2000, 3000, 4000, 4001, 5000, 6000];
      nowSpy.mockImplementation(() => times.shift() ?? 9999);

      const manager = new ThreadsManager(coreDirectory);
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      const worker = threadInfo.worker;
      expect(threadInfo.lastStarted).toBeUndefined();
      expect(threadInfo.runCount).toBeUndefined();

      // lastStarted is set when the worker comes online.
      worker.emit('online');
      expect(threadInfo.lastSeen).toBe(1000);
      expect(threadInfo.lastStarted).toBe(1000);
      expect(threadInfo.runCount).toBeUndefined();

      // runCount is incremented by the init control message.
      worker.emit('message', { type: 'init', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.lastSeen).toBe(1001);
      expect(threadInfo.lastStarted).toBe(1000);
      expect(threadInfo.runCount).toBe(1);

      // The exit control message only queues the worker for termination: the native exit clears it.
      worker.emit('message', { type: 'exit', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.lastSeen).toBe(2000);
      expect(threadInfo.lastStopped).toBeUndefined();
      expect(threadInfo.errorCount).toBeUndefined();
      expect(threadInfo.worker).toBe(worker);
      expect((manager as any).terminateWorkers.has(worker)).toBe(true);
      worker.emit('exit', 0);
      expect(threadInfo.lastSeen).toBe(3000);
      expect(threadInfo.lastStopped).toBe(3000);
      expect(threadInfo.lastDuration).toBe(2000);
      expect(threadInfo.worker).toBeUndefined();
      expect((manager as any).terminateWorkers.has(worker)).toBe(false);

      // After a restart, a failed exit message and an error both count as errors.
      manager.runThread('TestWorker');
      expect(threadInfo.lastStarted).toBeUndefined();
      expect(threadInfo.lastStopped).toBeUndefined();
      expect(threadInfo.lastDuration).toBeUndefined();
      const failedWorker = threadInfo.worker;
      failedWorker.emit('online');
      failedWorker.emit('message', { type: 'init', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.runCount).toBe(2);
      failedWorker.emit('message', { type: 'exit', threadId: 1, threadName: 'TestWorker', success: false });
      expect(threadInfo.lastSeen).toBe(5000);
      expect(threadInfo.errorCount).toBe(1);
      failedWorker.emit('error', new Error('boom'));
      expect(threadInfo.lastSeen).toBe(6000);
      expect(threadInfo.lastStopped).toBe(6000);
      expect(threadInfo.lastDuration).toBe(2000);
      expect(threadInfo.errorCount).toBe(2);
      expect(threadInfo.worker).toBeUndefined();

      // Events of a worker no longer tracked only log.
      const debugSpy = vi.spyOn((manager as any).log, 'debug');
      failedWorker.emit('message', { type: 'pong', threadId: 1, threadName: 'TestWorker' });
      failedWorker.emit('exit', 1);
      expect(threadInfo.lastSeen).toBe(6000);
      expect(threadInfo.lastStopped).toBe(6000);
      expect(threadInfo.lastDuration).toBe(2000);
      expect(debugSpy).toHaveBeenCalledWith(expect.stringMatching(/Thread TestWorker received a pong at /));

      manager.destroy();
      nowSpy.mockRestore();
    });

    test('clears worker on native exit when no exit message was received', async () => {
      const nowSpy = vi.spyOn(Date, 'now');
      const times = [1000, 1500, 2000];
      nowSpy.mockImplementation(() => times.shift() ?? 9999);

      const manager = new ThreadsManager(coreDirectory);
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      const worker = threadInfo.worker;

      worker.emit('online');
      worker.emit('message', { type: 'init', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.lastStarted).toBe(1000);
      expect(threadInfo.lastSeen).toBe(1500);
      expect(threadInfo.worker).toBe(worker);

      worker.emit('exit', 0);

      expect(threadInfo.lastSeen).toBe(2000);
      expect(threadInfo.lastStopped).toBe(2000);
      expect(threadInfo.lastDuration).toBe(1000);
      expect(threadInfo.worker).toBeUndefined();

      manager.destroy();
      nowSpy.mockRestore();
    });

    test('should compute zero duration when the worker exits before coming online', async () => {
      const nowSpy = vi.spyOn(Date, 'now');
      nowSpy.mockReturnValue(2000);

      const manager = new ThreadsManager(coreDirectory);
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));

      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      const worker = threadInfo.worker;

      expect(threadInfo.lastStarted).toBeUndefined();

      // The exit message does not clear the worker: the native exit does.
      worker.emit('message', { type: 'exit', threadId: 1, threadName: 'TestWorker', success: true });
      expect(threadInfo.worker).toBe(worker);
      worker.emit('exit', 0);

      expect(threadInfo.lastSeen).toBe(2000);
      expect(threadInfo.lastStopped).toBe(2000);
      expect(threadInfo.lastDuration).toBe(0);
      expect(threadInfo.worker).toBeUndefined();

      manager.destroy();
      nowSpy.mockRestore();
    });

    test('increments errorCount on messageerror and logs', async () => {
      const manager = new ThreadsManager(coreDirectory);
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

    test.each([false, true])('logs worker log messages through AnsiLogger.create with verbose=%s', async (verbose) => {
      const createSpy = vi.spyOn(AnsiLogger, 'create');
      const logSpy = vi.fn<(...args: any[]) => any>();
      createSpy.mockReturnValue({ log: logSpy } as any);

      const manager = new ThreadsManager(coreDirectory);
      manager['verbose'] = verbose;
      const debugSpy = vi.spyOn(manager['log'], 'debug');
      // Worker is mocked, so the resolved path only needs to exist to pass the file check.
      vi.spyOn(manager, 'resolvePath').mockReturnValue(url.fileURLToPath(import.meta.url));
      const threads = (manager as any).threads as Array<any>;
      threads.push({ name: 'TestWorker', path: 'does-not-exist.js', type: 'worker' });

      manager.runThread('TestWorker');
      const threadInfo = threads.find((t) => t.name === 'TestWorker');
      expect(threadInfo.worker).toBeDefined();

      debugSpy.mockClear();
      threadInfo.worker.emit('message', { type: 'log', logLevel: LogLevel.INFO, message: 'from worker' });

      expect(createSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(LogLevel.INFO, 'from worker');
      const expectedMessage = expect.stringContaining('Thread TestWorker sent a message at');
      expect(debugSpy.mock.calls).toEqual(verbose ? [[expectedMessage]] : []);

      manager.destroy();
    });

    test('throws if the thread is already running; allows restart after exit', async () => {
      const manager = new ThreadsManager(coreDirectory);
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
      const manager = new ThreadsManager(coreDirectory);
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
