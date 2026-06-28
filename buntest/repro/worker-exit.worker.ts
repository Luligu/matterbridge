// buntest/repro/worker-exit.worker.ts

// Worker for bun-worker-exit.test.ts: replies to one message, then closes its message port.

import { parentPort } from 'node:worker_threads';

import type { WorkerMessage, WorkerMessageRequest } from '@matterbridge/types';
import { AnsiLogger, LogLevel, TimestampFormat } from 'node-ansi-logger';

import { BroadcastServer } from '../../packages/thread/src/broadcastServer.js';

type WorkerCommand = {
  channel?: string;
  fetchUrls?: string[];
  index?: number;
  payload: string;
};

function isWorkerCommand(value: unknown): value is WorkerCommand {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const command = value as Partial<WorkerCommand>;
  return typeof command.payload === 'string';
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs).unref();

  try {
    const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
    return `status:${response.status}`;
  } catch (error) {
    return error instanceof Error ? `error:${error.name}:${error.message}` : `error:${String(error)}`;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAllWithTimeout(urls: string[], timeoutMs: number): Promise<string> {
  const results = await Promise.all(urls.map(async (url) => await fetchWithTimeout(url, timeoutMs)));
  return results.join(',');
}

function isMatchingRequest(msg: WorkerMessage, index: number | undefined): msg is WorkerMessageRequest<'jest_simple'> {
  return msg.type === 'jest_simple' && msg.id === index && msg.dst === 'matter';
}

async function handleMessage(msg: unknown): Promise<void> {
  const payload = isWorkerCommand(msg) ? msg.payload : String(msg);
  const fetchResult = isWorkerCommand(msg) && msg.fetchUrls !== undefined ? await fetchAllWithTimeout(msg.fetchUrls, 5_000) : 'skipped';
  let server: BroadcastServer | undefined;

  if (isWorkerCommand(msg) && msg.channel !== undefined) {
    const log = new AnsiLogger({ logName: 'WorkerExitRepro', logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });
    server = new BroadcastServer('matter', log, msg.channel);
    server.on('broadcast_message', (broadcastMsg) => {
      if (!isMatchingRequest(broadcastMsg, msg.index)) {
        return;
      }
      server?.respond({
        type: 'jest_simple',
        id: broadcastMsg.id,
        timestamp: broadcastMsg.timestamp,
        src: 'matter',
        dst: broadcastMsg.src,
        result: { success: true },
      });
      parentPort?.postMessage(`echo:${payload}:fetch:${fetchResult}`);
      server?.close();
      parentPort?.close();
      process.exit(0); // Ensure the worker exits after responding to the broadcast request
    });
    server.broadcast({
      type: 'jest_simple',
      id: msg.index,
      src: 'matter',
      dst: 'manager',
    } satisfies WorkerMessage);
    return;
  }

  parentPort?.postMessage(`echo:${payload}:fetch:${fetchResult}`);
  parentPort?.close();
  process.exit(0); // Ensure the worker exits after closing the message port
}

parentPort?.on('message', (msg: unknown) => {
  void handleMessage(msg);
});
