// buntest\workerWrapper.realworker.test.ts

import { describe, expect, test } from 'bun:test';
import { Worker } from 'node:worker_threads';

import type { ParentPortMessage } from '@matterbridge/types';

type WorkerRunResult = {
  messages: ParentPortMessage[];
  exitCode: number;
};

async function runWorker(workerUrl: URL): Promise<WorkerRunResult> {
  const worker = new Worker(workerUrl, {
    workerData: { threadName: 'CheckUpdates', debug: false, verbose: false, tracker: false },
    stdout: true,
    stderr: true,
  });
  const messages: ParentPortMessage[] = [];

  worker.stdout?.on('data', () => {});
  worker.stderr?.on('data', () => {});
  worker.on('message', (message: ParentPortMessage) => {
    messages.push(message);
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    worker.once('error', reject);
    worker.once('exit', resolve);
  });

  return { messages, exitCode };
}

describe('WorkerWrapper real Bun worker shutdown', () => {
  test('exits with code 0 after a successful callback', async () => {
    const result = await runWorker(new URL('./workerWrapper.success.worker.ts', import.meta.url));

    expect(result.exitCode).toBe(0);
    expect(result.messages).toContainEqual(expect.objectContaining({ type: 'init', threadName: 'CheckUpdates', success: true }));
    expect(result.messages).toContainEqual(expect.objectContaining({ type: 'exit', threadName: 'CheckUpdates', success: true }));
  });

  test('exits with code 1 after a false callback result', async () => {
    const result = await runWorker(new URL('./workerWrapper.failure.worker.ts', import.meta.url));

    expect(result.exitCode).toBe(1);
    expect(result.messages).toContainEqual(expect.objectContaining({ type: 'init', threadName: 'CheckUpdates', success: true }));
    expect(result.messages).toContainEqual(expect.objectContaining({ type: 'exit', threadName: 'CheckUpdates', success: false }));
  });

  test('exits with code 1 after a thrown callback error', async () => {
    const result = await runWorker(new URL('./workerWrapper.throw.worker.ts', import.meta.url));

    expect(result.exitCode).toBe(1);
    expect(result.messages).toContainEqual(expect.objectContaining({ type: 'init', threadName: 'CheckUpdates', success: true }));
    expect(result.messages).toContainEqual(expect.objectContaining({ type: 'exit', threadName: 'CheckUpdates', success: false }));
  });
});
