// buntest/exit.worker.ts
// Echo worker that self-exits with process.exit(0) after replying.
// Note: Bun runs this .ts file directly — no build step, no dist/.
import { parentPort } from 'node:worker_threads';

parentPort?.on('message', (msg: unknown) => {
  parentPort?.postMessage(`echo:${String(msg)}`);
  process.exit(0); // self-exit after replying (Bun does not exit on parentPort.close())
});
