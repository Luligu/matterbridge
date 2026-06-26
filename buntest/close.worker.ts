// buntest/close.worker.ts
// Echo worker that calls parentPort.close() after replying.
// Note: Bun runs this .ts file directly — no build step, no dist/.
// BUN QUIRK: under Bun, close() does NOT end the thread, so 'exit' never fires.
import { parentPort } from 'node:worker_threads';

parentPort?.on('message', (msg: unknown) => {
  parentPort?.postMessage(`echo:${String(msg)}`);
  parentPort?.close(); // close the port (does NOT exit the worker under Bun)
});
