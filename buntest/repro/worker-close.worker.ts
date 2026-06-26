// buntest/repro/worker-close.worker.ts
// Worker for bun-worker-exit.test.ts: replies to one message, then closes its message port.
import { parentPort } from 'node:worker_threads';

parentPort?.on('message', (msg: unknown) => {
  parentPort?.postMessage(`echo:${String(msg)}`);
  parentPort?.close();
});
