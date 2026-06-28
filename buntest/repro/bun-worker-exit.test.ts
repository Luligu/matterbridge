// buntest/repro/bun-worker-exit.test.ts

// Bug repro: on Bun a worker that calls parentPort.close() does not exit — the 'exit' event is
// never emitted, so the worker thread stays alive. On Node, closing the port lets the worker's
// event loop drain and the worker exits with code 0, emitting 'exit'.
//
// Expected: 'exit' fires after the worker closes its port (as on Node).
// Actual on Bun: 'exit' never arrives (observed here as the timeout sentinel `undefined`).
//
// Run:  bun test buntest/repro/bun-worker-exit.test.ts

import { expect, test } from 'bun:test';
import { isMainThread, Worker } from 'node:worker_threads';

test("worker emits 'exit' after parentPort.close()", async () => {
  expect(isMainThread).toBe(true);
  const worker = new Worker(new URL('./worker-close.worker.ts', import.meta.url));

  // Confirm the worker is alive and processed the message before it closes its port.
  const reply = await new Promise<string>((resolve, reject) => {
    worker.once('message', (m) => resolve(String(m)));
    worker.once('error', reject);
    worker.postMessage('ping');
  });
  expect(reply).toBe('echo:ping');

  // Record the exit code if/when 'exit' fires.
  let exitCode: number | undefined;
  worker.once('exit', (c) => {
    exitCode = c;
  });

  // Grace window: Node exits the worker well within this after the port closes; Bun never does.
  await new Promise<void>((resolve) => setTimeout(resolve, 1000));

  try {
    // Node: worker exited with code 0. Bun: 'exit' never fired, so exitCode is still undefined.
    expect(exitCode).toBe(0);
  } finally {
    // Ensure the thread is gone even when 'exit' never fired (Bun).
    await worker.terminate();
  }
});
