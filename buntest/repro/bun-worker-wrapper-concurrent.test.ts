// buntest/repro/bun-worker-wrapper-concurrent.test.ts

// Repro: launch multiple real WorkerWrapper workers through ThreadsManager, then wait for wrapper exit.
//
// Run: bun test buntest/repro/bun-worker-wrapper-concurrent.test.ts

import { expect, test } from 'bun:test';
import path from 'node:path';
import type { Worker } from 'node:worker_threads';

import type { ParentPortMessage } from '@matterbridge/types';

import { ThreadsManager } from '../../packages/thread/src/threadsManager.js';

process.argv.push('--debug');

type ThreadInfoForTest = {
  name: string;
  path: string;
  type: 'worker' | 'thread';
  worker?: Worker;
  runCount?: number;
  errorCount?: number;
  lastStarted?: number;
  lastStopped?: number;
  lastDuration?: number;
  lastSeen?: number;
};

type WrapperRunResult = {
  exitCode: number;
  exitMessage: Extract<ParentPortMessage, { type: 'exit' }>;
  logs: Array<Extract<ParentPortMessage, { type: 'log' }>>;
  name: string;
};

type ReproFailure = {
  actualThreadName?: string;
  errorCount?: number;
  exitCode: number;
  lastDuration?: number;
  lastSeen?: number;
  lastStarted?: number;
  lastStopped?: number;
  logMessages: string[];
  name: string;
  runCount?: number;
  success: boolean;
  workerStillSet: boolean;
};

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${ms} ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout !== undefined) {
      clearTimeout(timeout);
    }
  }
}

async function waitForWrapperResult(name: string, worker: Worker): Promise<WrapperRunResult> {
  return await new Promise<WrapperRunResult>((resolve, reject) => {
    const logs: Array<Extract<ParentPortMessage, { type: 'log' }>> = [];
    let exitMessage: Extract<ParentPortMessage, { type: 'exit' }> | undefined;
    let exitCode: number | undefined;

    const tryResolve = (): void => {
      if (exitMessage !== undefined && exitCode !== undefined) {
        resolve({ exitCode, exitMessage, logs, name });
      }
    };

    worker.on('message', (message: ParentPortMessage) => {
      if (message.type === 'log') {
        logs.push(message);
      }
      if (message.type === 'exit') {
        exitMessage = message;
        tryResolve();
      }
    });
    worker.once('exit', (code) => {
      exitCode = code;
      tryResolve();
    });
    worker.once('error', reject);
  });
}

test('starts 5 WorkerWrapper workers through ThreadsManager and waits for exits', async () => {
  const manager = new ThreadsManager(60_000);
  const workerPath = path.resolve('buntest/repro/worker-wrapper-exit.worker.ts');
  const originalResolvePath = manager.resolvePath.bind(manager);
  manager.resolvePath = (fileName: string): string => (path.isAbsolute(fileName) ? fileName : originalResolvePath(fileName));
  const threadInfos = (manager as unknown as { threads: ThreadInfoForTest[] }).threads;
  const originalThreads = [...threadInfos];
  const wrapperThreads: ThreadInfoForTest[] = Array.from({ length: 5 }, (_, index) => ({
    name: `WrapperRepro${index}`,
    path: workerPath,
    type: 'worker',
  }));

  threadInfos.splice(0, threadInfos.length, ...wrapperThreads);

  try {
    const startedWorkers = wrapperThreads.map((thread) => {
      const worker = manager.runThread(thread.name, undefined, process.argv.slice(2), process.env, undefined, true);
      return { thread, worker, result: waitForWrapperResult(thread.name, worker) };
    });

    const results = await withTimeout(Promise.all(startedWorkers.map(async ({ result }) => await result)), 30_000, 'WorkerWrapper workers exit');

    const failures: ReproFailure[] = [];
    const sortedResults = results.toSorted((a, b) => a.name.localeCompare(b.name));

    sortedResults.forEach((result) => {
      const thread = wrapperThreads.find((item) => item.name === result.name);
      const fetchSkippedLog = result.logs.some((log) => log.message === 'WorkerWrapper repro external fetch skipped');
      const managerLog = result.logs.some((log) => log.message.startsWith('WorkerWrapper repro manager log level:'));
      const ok =
        result.exitCode === 0 &&
        result.exitMessage.success &&
        result.exitMessage.threadName === 'DockerVersion' &&
        fetchSkippedLog &&
        managerLog &&
        thread?.worker === undefined &&
        thread?.runCount === 1 &&
        (thread.errorCount ?? 0) === 0 &&
        thread.lastStopped !== undefined;

      if (!ok) {
        failures.push({
          actualThreadName: result.exitMessage.threadName,
          errorCount: thread?.errorCount,
          exitCode: result.exitCode,
          lastDuration: thread?.lastDuration,
          lastSeen: thread?.lastSeen,
          lastStarted: thread?.lastStarted,
          lastStopped: thread?.lastStopped,
          logMessages: result.logs.map((log) => log.message),
          name: result.name,
          runCount: thread?.runCount,
          success: result.exitMessage.success,
          workerStillSet: thread?.worker !== undefined,
        });
      }
    });

    expect(failures).toEqual([]);
  } finally {
    await Promise.allSettled(wrapperThreads.map(async (thread) => await thread.worker?.terminate()));
    threadInfos.splice(0, threadInfos.length, ...originalThreads);
    manager.destroy();
  }
});
