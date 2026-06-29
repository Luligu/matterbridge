// buntest/repro/worker-wrapper-exit.worker.ts

// WorkerWrapper repro worker.

import { parentPort } from 'node:worker_threads';

import { LogLevel } from 'node-ansi-logger';

// @ts-expect-error: Import from TypeScript file with .ts extension
import { WorkerWrapper } from '../../packages/thread/src/workerWrapper.ts';

if (!parentPort) throw new Error('parentPort is not available');

// oxlint-disable-next-line typescript/require-await
export default new WorkerWrapper('DockerVersion', async (worker) => {
  worker.logger(LogLevel.INFO, 'WorkerWrapper repro starting');
  worker.logger(LogLevel.INFO, 'WorkerWrapper repro external fetch skipped');

  parentPort?.on('message', (message: unknown) => {
    if (message === 'ping') {
      parentPort?.postMessage(`echo:${message}`);
    }
  });

  // const response = await worker.server.fetch({ type: 'get_log_level', src: 'matterbridge', dst: 'manager' }, 5_000);
  // worker.logger(LogLevel.INFO, `WorkerWrapper repro manager log level: ${response.result.logLevel}`);

  return true;
});
