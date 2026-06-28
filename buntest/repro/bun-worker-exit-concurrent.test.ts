// buntest/repro/bun-worker-exit-concurrent.test.ts

// Repro: start multiple workers together, then assert each one replies and exits.
//
// Run: bun test buntest/repro/bun-worker-exit-concurrent.test.ts

import { expect, test } from 'bun:test';
import { Worker } from 'node:worker_threads';

import type { WorkerMessage } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from '../../packages/thread/src/broadcastServer.js';

process.argv.push('--debug', '--verbose');

type WorkerResult = {
  broadcast: WorkerMessage;
  index: number;
  message: string;
  exitCode: number;
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

async function waitForOnline(worker: Worker): Promise<void> {
  return await new Promise<void>((resolve, reject) => {
    worker.once('online', resolve);
    worker.once('error', reject);
  });
}

async function waitForBroadcast(worker: Worker): Promise<WorkerMessage> {
  return await new Promise<WorkerMessage>((resolve, reject) => {
    worker.once('broadcast', (value) => resolve(value as WorkerMessage));
    worker.once('error', reject);
  });
}

async function waitForResult(index: number, worker: Worker, alive: Set<Worker>): Promise<WorkerResult> {
  return await new Promise<WorkerResult>((resolve, reject) => {
    let broadcast: WorkerMessage | undefined;
    let message: string | undefined;
    let exitCode: number | undefined;

    const tryResolve = (): void => {
      if (broadcast !== undefined && message !== undefined && exitCode !== undefined) {
        resolve({ broadcast, index, message, exitCode });
      }
    };

    worker.once('broadcast', (value) => {
      broadcast = value as WorkerMessage;
      tryResolve();
    });
    worker.once('message', (value) => {
      message = String(value);
      tryResolve();
    });
    worker.once('exit', (code) => {
      alive.delete(worker);
      exitCode = code;
      tryResolve();
    });
    worker.once('error', reject);
  });
}

test('starts 5 worker-exit workers together and waits for replies and exits', async () => {
  const channel = `worker-exit-concurrent-${Date.now()}-${Math.random()}`;
  const log = new AnsiLogger({ logName: 'WorkerExitConcurrent', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
  const server = new BroadcastServer('manager', log, channel);
  const fetchUrls = ['https://matterbridge.io', 'https://registry-1.docker.io/v2/'];

  const workers = Array.from({ length: 5 }, (_, index) => ({
    index,
    worker: new Worker(new URL('./worker-exit.worker.ts', import.meta.url)),
  }));
  const alive = new Set(workers.map(({ worker }) => worker));

  try {
    server.on('broadcast_message', (msg) => {
      const worker = workers.find(({ index }) => msg.id === index);
      worker?.worker.emit('broadcast', msg);
    });

    const onlinePromises = workers.map(async ({ worker }) => await waitForOnline(worker));
    const readyPromises = workers.map(async ({ worker }) => await waitForBroadcast(worker));
    const resultPromises = workers.map(async ({ index, worker }) => await waitForResult(index, worker, alive));

    await withTimeout(Promise.all(onlinePromises), 5_000, 'workers online');
    workers.forEach(({ index, worker }) => worker.postMessage({ channel, fetchUrls, index, payload: `ping-${index}` }));

    await withTimeout(Promise.all(readyPromises), 5_000, 'worker broadcast servers ready');
    const fetchResults = await withTimeout(
      Promise.all(
        workers.map(async ({ index }) => {
          const response = await server.fetch({ type: 'jest_simple', id: index, src: 'manager', dst: 'matter' }, 5_000);
          return { index, response };
        }),
      ),
      10_000,
      'broadcast fetch responses',
    );
    const results = (await withTimeout(Promise.all(resultPromises), 15_000, 'worker replies and exits')).toSorted((a, b) => a.index - b.index);

    expect(fetchResults.toSorted((a, b) => a.index - b.index)).toEqual(
      Array.from({ length: 5 }, (_, index) => ({
        index,
        response: expect.objectContaining({ dst: 'manager', id: index, result: { success: true }, src: 'matter', type: 'jest_simple' }),
      })),
    );
    expect(results).toEqual(
      Array.from({ length: 5 }, (_, index) => ({
        broadcast: expect.objectContaining({ dst: 'manager', id: index, src: 'matter', type: 'jest_simple' }),
        index,
        message: expect.stringMatching(new RegExp(`^echo:ping-${index}:fetch:status:\\d+,status:\\d+$`)),
        exitCode: 0,
      })),
    );
  } finally {
    server.close();
    await Promise.allSettled([...alive].map(async (worker) => worker.terminate()));
  }
});
