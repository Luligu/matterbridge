// buntest/repro/bun-worker-wrapper.test.ts

/**
 * Run a worker with WorkerWrapper.
 */

// Run: bun test buntest/repro/bun-worker-wrapper.test.ts
// Run: bun test --rerun-each 100 buntest/repro/bun-worker-wrapper.test.ts

import { expect, test } from 'bun:test';
import { isMainThread, Worker, type WorkerOptions } from 'node:worker_threads';

import { BroadcastServer } from '@matterbridge/thread/server';
import { AnsiLogger, LogLevel, MAGENTA, TimestampFormat } from 'node-ansi-logger';

test('WorkerWrapper', async () => {
  expect(isMainThread).toBe(true);

  // Create the server that the worker will connect to.
  const log = new AnsiLogger({
    logName: 'ThreadsManager',
    logNameColor: MAGENTA,
    logTimestampFormat: TimestampFormat.TIME_MILLIS,
    logLevel: LogLevel.DEBUG,
  });
  const server = new BroadcastServer('manager', log);
  server.on('broadcast_message', (message) => {
    log.info(`Broadcast message received: ${JSON.stringify(message)}`);
    if (server.isWorkerRequest(message) && message.type === 'get_log_level') {
      server.respond({ ...message, result: { logLevel: log.logLevel } });
    }
  });

  // Create the worker.
  const options: WorkerOptions = {
    workerData: { threadName: 'worker-wrapper.worker.ts', debug: true, verbose: true },
    name: 'worker-wrapper.worker.ts',
  };
  const worker = new Worker(new URL('./worker-wrapper.worker.ts', import.meta.url), options);

  // Record the exit code if/when 'exit' fires.
  let exitCode: number | undefined;
  worker.once('exit', (c) => {
    exitCode = c;
  });

  // Confirm the worker is alive and processed the message before it closes its port.
  await new Promise<unknown>((resolve, reject) => {
    let initReceived = false;
    let pongReceived = false;
    let exitReceived = false;
    worker.on('message', (m) => {
      if (m.type === 'init') initReceived = true;
      if (m.type === 'pong') pongReceived = true;
      if (m.type === 'exit') exitReceived = true;
      if (initReceived && pongReceived && exitReceived) resolve(m);
    });
    worker.once('error', reject);
    worker.postMessage({ type: 'ping' });
  });

  // Ensure the thread is gone even when 'exit' never fired (Bun).
  await worker.terminate();

  // Node: worker exited with code 0. Bun: 'exit' never fired, so exitCode is still undefined.
  expect(exitCode).toBe(0);

  // Close the server
  server.close();
});
