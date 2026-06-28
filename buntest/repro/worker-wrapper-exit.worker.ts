// buntest/repro/worker-wrapper-exit.worker.ts

// WorkerWrapper repro worker: does a BroadcastServer.fetch() round trip, then exits through WorkerWrapper.destroy().

import { LogLevel } from 'node-ansi-logger';

import { WorkerWrapper } from '../../packages/thread/src/workerWrapper.js';

export default new WorkerWrapper('DockerVersion', async (worker) => {
  worker.logger(LogLevel.INFO, 'WorkerWrapper repro starting');
  worker.logger(LogLevel.INFO, 'WorkerWrapper repro external fetch skipped');

  const response = await worker.server.fetch({ type: 'get_log_level', src: 'matterbridge', dst: 'manager' }, 5_000);
  worker.logger(LogLevel.INFO, `WorkerWrapper repro manager log level: ${response.result.logLevel}`);

  return true;
});
