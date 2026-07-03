// buntest/repro/worker-close.worker.ts

// Worker replies to one message, then closes its message port.

import { parentPort } from 'node:worker_threads';

if (!parentPort) throw new Error('parentPort is not available');

parentPort.on('message', (msg: unknown) => {
  parentPort?.postMessage(`echo:${String(msg)}`);
  parentPort?.close();
});
