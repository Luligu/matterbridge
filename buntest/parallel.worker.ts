// buntest/parallel.worker.ts
// Worker used by runtime.test.ts to keep several Bun workers alive at once.
import { parentPort, workerData } from 'node:worker_threads';

const index = typeof workerData === 'object' && workerData && 'index' in workerData ? Number(workerData.index) : -1;

parentPort?.on('message', (msg: unknown) => {
  setTimeout(() => {
    parentPort?.postMessage({ index, reply: `echo:${String(msg)}` });
    process.exit(0);
  }, 100);
});
