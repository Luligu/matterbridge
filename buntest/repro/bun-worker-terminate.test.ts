// buntest/repro/bun-worker-terminate.test.ts

/**
 * Run a worker that closes its parentPort, then call worker.terminate() from the main thread.
 */

// Run: bun test buntest/repro/bun-worker-terminate.test.ts
// Run: bun test --rerun-each 100 buntest/repro/bun-worker-terminate.test.ts

import { expect, test } from 'bun:test';
import { isMainThread, Worker } from 'node:worker_threads';

test('Worker with worker.terminate()', async () => {
  expect(isMainThread).toBe(true);

  const worker = new Worker(new URL('./worker-close.worker.ts', import.meta.url));

  // Record the exit code if/when 'exit' fires.
  let exitCode: number | undefined;
  worker.once('exit', (c) => {
    exitCode = c;
  });

  // Confirm the worker is alive and processed the message before it closes its port.
  const reply = await new Promise<string>((resolve, reject) => {
    worker.once('message', (m) => resolve(String(m)));
    worker.once('error', reject);
    worker.postMessage('ping');
  });
  expect(reply).toBe('echo:ping');

  // Grace window: Node exits the worker well within this after the port closes; Bun never does.
  await new Promise<void>((resolve) => setTimeout(resolve, 50));

  // Ensure the thread is gone even when 'exit' never fired (Bun).
  await worker.terminate();

  // Node: worker exited with code 0. Bun: 'exit' never fired, so exitCode is still undefined.
  expect(exitCode).toBe(0);
});
