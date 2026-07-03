// buntest/repro/worker-exit.worker.ts

// Worker replies to one message, then closes its message port and calls process.exit().

import { parentPort } from 'node:worker_threads';

if (!parentPort) throw new Error('parentPort is not available');

parentPort.on('message', (msg: unknown) => {
  parentPort?.postMessage(`echo:${String(msg)}`);
  parentPort?.close();
  process.exit(0);
});
